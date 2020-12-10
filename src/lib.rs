#[macro_use]
extern crate vst;
extern crate vst_gui;
extern crate serde_json;

use std::sync::{Arc, Mutex};
use std::include_str;

use vst::api;
use vst::editor::Editor;
use vst::buffer::{AudioBuffer, SendEventBuffer};
use vst::event::{Event, MidiEvent};
use vst::plugin::{CanDo, HostCallback, Info, Plugin};

plugin_main!(MyPlugin); // Important!

const HTML: &'static str = include_str!("../ui/build/index.html");

struct KeyMapper {
    key: Option<u8>,
    scale: Option<Vec<u8>>,
}

impl KeyMapper {
    fn transpose_pressed_key(&mut self, pressed_key: u8) -> Option<u8> {
        if !self.key.is_some() || !self.scale.is_some() {
            return Some(pressed_key);
        }

        let remainder = pressed_key%12 - self.key.unwrap()%12;
        if remainder as u8 > self.scale.as_ref().unwrap().len() as u8 {
            return None;
        }

        let offset: u8 = self.scale.as_ref().unwrap()[remainder as usize];
        let base = pressed_key as i8/12 - self.key.unwrap() as i8/12;

        Some((self.key.unwrap() as i8 + base*12 + offset as i8) as u8) 
    }
}

fn create_javascript_callback(
    key_mapper: Arc<Mutex<KeyMapper>>) -> vst_gui::JavascriptCallback
{
    Box::new(move |message: String| {
        let mut tokens = message.split_whitespace();

        let command = tokens.next().unwrap_or("");
        match command {
            "stop" => {
                let mut locked_key_mapper = key_mapper.lock().unwrap();
                locked_key_mapper.key = None;
                locked_key_mapper.scale = None;

                return String::new()
            },
            "set" => {
                let mut locked_key_mapper = key_mapper.lock().unwrap();
                let key = tokens.next().unwrap_or("").parse::<u8>();
                match key {
                    Ok(inner) => {
                        locked_key_mapper.key = Some(inner);
                    },
                    _ => {
                        locked_key_mapper.key = None;
                    }
                }

                let scale_str = tokens.next().unwrap_or("").parse::<String>();
                match scale_str {
                    Ok(inner) => {
                        let scale: Vec<u8> = serde_json::from_str(inner.as_str()).unwrap();
                        locked_key_mapper.scale = Some(scale);
                    },
                    _ => {
                        locked_key_mapper.scale = None;
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
    events: Vec<MidiEvent>,
    send_buffer: SendEventBuffer,
    key_mapper: Arc<Mutex<KeyMapper>>
}

impl Default for MyPlugin {
    fn default() -> MyPlugin {
        let key_mapper = Arc::new(Mutex::new(
            KeyMapper {
                key: None,
                scale: None,
            }
        ));

        MyPlugin {
            host: HostCallback::default(),
            events: [].to_vec(),
            send_buffer: SendEventBuffer::default(),
            key_mapper: key_mapper.clone(),
        }
    }
}

impl MyPlugin {
    fn send_midi(&mut self) {
        self.send_buffer.send_events(&self.events, &mut self.host);
        self.events.clear();
    }
}

impl Plugin for MyPlugin {
    fn new(host: HostCallback) -> Self {
        let mut p = MyPlugin::default();
        p.host = host;
        p
    }

    fn get_info(&self) -> Info {
        Info {
            name: "in_tune".to_string(),
            unique_id: 7357001, // Used by hosts to differentiate between plugins.
            inputs: 2,
            outputs: 2,
            midi_inputs: 1,
            midi_outputs: 1,
            parameters: 0,
            initial_delay: 0,
            ..Info::default()
        }
    }

    fn process_events(&mut self, events: &api::Events) {
        for e in events.events() {
            #[allow(clippy::single_match)]
            match e {
                Event::Midi(mut e) => {
                    let mut locked_key_mapper = self.key_mapper.lock().unwrap();
                    let new_key: Option<u8> = locked_key_mapper.transpose_pressed_key(e.data[1]);
                    match new_key {
                        Some(inner) => {
                            e.data[1] = inner;
                            self.events.push(e)
                        },
                        _ => (),
                    };
                },
                _ => (),
            }
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
            Some((1500, 800)));
        Some(Box::new(gui))
    }

    fn can_do(&self, can_do: CanDo) -> vst::api::Supported {
        use vst::api::Supported::*;
        use vst::plugin::CanDo::*;

        match can_do {
            SendEvents | SendMidiEvent | ReceiveEvents | ReceiveMidiEvent => Yes,
            _ => No,
        }
    }
}
