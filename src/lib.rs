#[macro_use] extern crate vst;
#[macro_use] extern crate log;
extern crate simplelog;
extern crate serde_json;
extern crate vst_gui;

use std::sync::{Arc, Mutex};
use std::fs::File;
use std::include_str;
use std::collections::HashMap;
use std::panic;

use simplelog::*;
use vst::api;
use vst::editor::Editor;
use vst::buffer::{AudioBuffer, SendEventBuffer};
use vst::event::{Event, MidiEvent};
use vst::plugin::{CanDo, Category, HostCallback, Info, Plugin};

plugin_main!(MyPlugin); // Important!

const HTML: &'static str = include_str!("../ui/build/index.html");

struct KeyMapper {
    key: Arc<Mutex<u8>>,
    scale: Arc<Mutex<Vec<u8>>>,
    keys_on_map: Arc<Mutex<HashMap<u8, u8>>>, // note: map is pressed_key -> transposed_key
}

impl KeyMapper {
    fn transpose_pressed_key(&mut self, data: [u8; 3]) -> Option<u8> {
        let pressed_key = data[1];
        let command = data[0];

        let locked_key = self.key.lock().unwrap();
        let locked_scale = self.scale.lock().unwrap();

        if locked_scale.len() == 0 {
            return Some(pressed_key);
        }

        match command {
            144 => {
                // 144 is NOTE_ON
                let dist_from_root = pressed_key%12;
                if dist_from_root as u8 >= locked_scale.len() as u8 {
                    return None;
                }
                let offset: u8 = locked_scale[dist_from_root as usize];

                let octave = pressed_key/12;
                let delta_key = *locked_key - 12;

                let new_key = (12*octave)+delta_key + offset;
                
                let mut locked_keys_on_map = self.keys_on_map.lock().unwrap();
                locked_keys_on_map.insert(pressed_key, new_key);

                Some(new_key)
            },
            128 => {
                // 128 is NOTE_OFF
                let locked_keys_on_map = self.keys_on_map.lock().unwrap();
                match locked_keys_on_map.get(&pressed_key) {
                    Some(mapped_key) => {
                        return Some(*mapped_key);
                    },
                    None => {
                        return None;
                    },
                }
            },
            _ => {
                return None;
            },
        }
    }
}

fn create_javascript_callback(
    key_mapper: Arc<Mutex<KeyMapper>>) -> vst_gui::JavascriptCallback
{
    Box::new(move |message: String| {
        info!("message: {}", message);
        let mut tokens = message.split_whitespace();

        let command = tokens.next().unwrap_or("");
        match command {
            "stop" => {
                let locked_key_mapper = key_mapper.lock().unwrap();
                let mut locked_key = locked_key_mapper.key.lock().unwrap();
                let mut locked_scale = locked_key_mapper.scale.lock().unwrap();

                *locked_key = 0;
                locked_scale.clear();

                return String::new()
            },
            "set" => {
                let locked_key_mapper = key_mapper.lock().unwrap();
                let mut locked_key = locked_key_mapper.key.lock().unwrap();
                let mut locked_scale = locked_key_mapper.scale.lock().unwrap();
                let key = tokens.next().unwrap_or("").parse::<u8>();
                match key {
                    Ok(inner) => {
                        info!("inner key: {}", inner);
                        *locked_key = inner;
                    },
                    _ => {
                        *locked_key = 0;
                    }
                }

                let scale_str = tokens.next().unwrap_or("").parse::<String>();
                match scale_str {
                    Ok(inner) => {
                        info!("inner scale: {}", inner);
                        let scale: Vec<u8> = serde_json::from_str(inner.as_str()).unwrap();
                        info!("scale: {:?}", scale);
                        *locked_scale = scale;
                    },
                    _ => {
                        locked_scale.clear();
                    }
                }
                
                return String::new()
            },
            _ => {}
        }

        String::new()
    })
}

struct MyPlugin {
    host: HostCallback,
    events: Arc<Mutex<Vec<MidiEvent>>>,
    send_buffer: SendEventBuffer,
    key_mapper: Arc<Mutex<KeyMapper>>
}

impl Default for MyPlugin {
    fn default() -> MyPlugin {
        info!("Default");
        let keys_on_map = Arc::new(Mutex::new(HashMap::new()));
        let key = Arc::new(Mutex::new(0));
        let scale = Arc::new(Mutex::new([].to_vec()));
        let key_mapper = Arc::new(Mutex::new(
            KeyMapper {
                key: key.clone(),
                scale: scale.clone(),
                keys_on_map: keys_on_map.clone(),
            }
        ));

        let events_vec = Arc::new(Mutex::new([].to_vec()));

        MyPlugin {
            host: HostCallback::default(),
            events: events_vec.clone(),
            send_buffer: SendEventBuffer::default(),
            key_mapper: key_mapper.clone(),
        }
    }
}

impl MyPlugin {
    fn send_midi(&mut self) {
        let mut locked_events = self.events.lock().unwrap();

        self.send_buffer.send_events(&*locked_events, &mut self.host);
        locked_events.clear();
    }
}

impl Plugin for MyPlugin {
    fn new(host: HostCallback) -> Self {
        let logger_config = Config::default();
        CombinedLogger::init(vec![WriteLogger::new(
            LevelFilter::max(),
            logger_config,
            File::create("/tmp/plugin.log").unwrap(),
        )])
        .unwrap();
        info!("====================================================================");
        info!("Plugin::new()");

        let mut p = MyPlugin::default();
        p.host = host;
        p
    }

    fn get_info(&self) -> Info {
        Info {
            name: "in_tune".to_string(),
            unique_id: 7357001, // Used by hosts to differentiate between plugins.
            category: Category::Synth,
            midi_inputs: 1,
            midi_outputs: 1,
            parameters: 0,
            initial_delay: 0,
            ..Info::default()
        }
    }

    fn process_events(&mut self, events: &api::Events) {
        let result = panic::catch_unwind(|| {
            for e in events.events() {
                #[allow(clippy::single_match)]
                match e {
                    Event::Midi(mut e) => {
                        let mut locked_key_mapper = self.key_mapper.lock().unwrap();
                        let new_key: Option<u8> = locked_key_mapper.transpose_pressed_key(e.data);
                        info!("old key: {}; new key: {:?}", e.data[1], new_key);
                        match new_key {
                            Some(inner) => {
                                info!("sending {}", inner);
                                e.data[1] = inner;

                                let mut locked_events = self.events.lock().unwrap();
                                locked_events.push(e)
                            },
                            _ => {
                                /*
                                info!("sending key off");
                                e.data[0] = 128; // note: KEY_OFF

                                let mut locked_events = self.events.lock().unwrap();
                                locked_events.push(e)
                                */
                            },
                        };
                    },
                    _ => (),
                }
            }
        });

        match result {
            Err(panic) => {
                match panic.downcast::<String>() {
                    Ok(panic_msg) => {
                        error!("panic happened: {}", panic_msg);
                    }
                    Err(_) => {
                        error!("panic happened: unknown type.");
                    }
                }
            },
            _ => ()
        }
    }

    fn process(&mut self, buffer: &mut AudioBuffer<f32>) {
        for (input, output) in buffer.zip() {
            for (in_sample, out_sample) in input.iter().zip(output) {
                *out_sample = *in_sample;
            }
        }
        self.send_midi();
    }

    fn process_f64(&mut self, buffer: &mut AudioBuffer<f64>) {
        for (input, output) in buffer.zip() {
            for (in_sample, out_sample) in input.iter().zip(output) {
                *out_sample = *in_sample;
            }
        }
        
        self.send_midi();
    }
    
    fn get_editor(&mut self) -> Option<Box<dyn Editor>> {
        let gui = vst_gui::new_plugin_gui(
            String::from(HTML),
            create_javascript_callback(self.key_mapper.clone()),
            Some((1250, 500)));
        Some(Box::new(gui))
    }

    fn can_do(&self, can_do: CanDo) -> vst::api::Supported {
        use vst::api::Supported::*;
        use vst::plugin::CanDo::*;

        match can_do {
            SendMidiEvent | ReceiveMidiEvent => Yes,
            _ => No,
        }
    }
}
