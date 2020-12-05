#[macro_use]
extern crate vst;

use vst::api;
use vst::buffer::{AudioBuffer, SendEventBuffer};
use vst::event::{Event, MidiEvent};
use vst::plugin::{CanDo, HostCallback, Info, Plugin};

plugin_main!(MyPlugin); // Important!

#[repr(u8)]
#[derive(Copy, Clone)]
pub enum Step {
    SemiTone = 1,
    Tone = 2,
}

pub static MAJOR_SCALE: &'static [Step] = &[Step::Tone, Step::Tone, Step::SemiTone, Step::Tone, Step::Tone, Step::Tone, Step::SemiTone];

fn transpose_pressed_key(key: u8, pressed_key: u8) -> Option<u8> {
    let remainder = pressed_key%12 - key%12;
    if remainder as u8 > MAJOR_SCALE.len() as u8 {
        return None;
    }

    let mut offset: u8 = 0;
    for (i, item) in MAJOR_SCALE.iter().enumerate() {
        if i as u8 >= remainder as u8 {
            break;
        }

        offset += *item as u8;
    }
    
    let base = pressed_key as i8/12 - key as i8/12;

    Some((key as i8 + base*12 + offset as i8) as u8) 
}

#[derive(Default)]
struct MyPlugin {
    host: HostCallback,
    events: Vec<MidiEvent>,
    send_buffer: SendEventBuffer,
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
                    let new_key: Option<u8> = transpose_pressed_key(24, e.data[1]);
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

    fn can_do(&self, can_do: CanDo) -> vst::api::Supported {
        use vst::api::Supported::*;
        use vst::plugin::CanDo::*;

        match can_do {
            SendEvents | SendMidiEvent | ReceiveEvents | ReceiveMidiEvent => Yes,
            _ => No,
        }
    }
}
