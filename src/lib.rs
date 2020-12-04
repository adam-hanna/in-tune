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
    let remainder = pressed_key % key;
    if remainder > MAJOR_SCALE.len() as u8 {
        return None;
    }

    let mut offset: u8 = 0;
    for (i, item) in MAJOR_SCALE.iter().enumerate() {
        if i as u8 >= remainder {
            break;
        }

        offset += *item as u8;
    }

    Some(key + offset)
}

/// Convert the midi note's pitch into the equivalent frequency.
///
/// This function assumes A4 is 440hz.
fn midi_pitch_to_freq(pitch: u8) -> f64 {
    const A4_PITCH: i8 = 69;
    const A4_FREQ: f64 = 440.0;

    // Midi notes can be 0-127
    ((f64::from(pitch as i8 - A4_PITCH)) / 12.).exp2() * A4_FREQ
}

#[derive(Default)]
struct MyPlugin {
    host: HostCallback,
    events: Vec<MidiEvent>,
    send_buffer: SendEventBuffer,
    sample_rate: f64,
    time: f64,
    note_duration: f64,
    note: Option<u8>,
}

impl MyPlugin {
    fn time_per_sample(&self) -> f64 {
        1.0 / self.sample_rate
    }

    fn send_midi(&mut self) {
        self.send_buffer.send_events(&self.events, &mut self.host);
        self.events.clear();
    }

    /// Process an incoming midi event.
    ///
    /// The midi data is split up like so:
    ///
    /// `data[0]`: Contains the status and the channel. Source: [source]
    /// `data[1]`: Contains the supplemental data for the message - so, if this was a NoteOn then
    ///            this would contain the note.
    /// `data[2]`: Further supplemental data. Would be velocity in the case of a NoteOn message.
    ///
    /// [source]: http://www.midimountain.com/midi/midi_status.htm
    fn process_midi_event(&mut self, data: [u8; 3]) {
        match data[0] {
            128 => {
                let transposed_note: Option<u8> = transpose_pressed_key(24, data[1]);
                match transposed_note {
                    Some(inner) => {
                        self.note_off(inner);
                    },
                    _ => (),
                };
            },
            144 => {
                let transposed_note: Option<u8> = transpose_pressed_key(24, data[1]);
                match transposed_note {
                    Some(inner) => {
                        self.note_on(inner);
                    },
                    _ => (),
                };
            },
            _ => (),
        }
    }

    fn note_on(&mut self, note: u8) {
        self.note_duration = 0.0;
        self.note = Some(note)
    }

    fn note_off(&mut self, note: u8) {
        if self.note == Some(note) {
            self.note = None
        }
    }
}

impl Plugin for MyPlugin {
    fn new(host: HostCallback) -> Self {
        let mut p = MyPlugin::default();
        p.host = host;
        p.set_sample_rate(44100.0);
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
            ..Default::default()
        }
    }

    fn process_events(&mut self, events: &api::Events) {
        for e in events.events() {
            #[allow(clippy::single_match)]
            match e {
                Event::Midi(mut e) => {
                    self.process_midi_event(e.data);
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

    fn set_sample_rate(&mut self, rate: f32) {
        self.sample_rate = f64::from(rate);
    }

    fn process(&mut self, buffer: &mut AudioBuffer<f32>) {
        let samples = buffer.samples();
        let (_, mut outputs) = buffer.split();
        let output_count = outputs.len();
        let per_sample = self.time_per_sample();
        let mut output_sample;
        for sample_idx in 0..samples {
            let note_duration = self.note_duration;
            if let Some(current_note) = self.note {
                let signal = midi_pitch_to_freq(current_note);

                // Apply a quick envelope to the attack of the signal to avoid popping.
                let attack = 0.5;
                let alpha = if note_duration < attack {
                    note_duration / attack
                } else {
                    1.0
                };

                output_sample = (signal * alpha) as f32;

                self.time += per_sample;
                self.note_duration += per_sample;
            } else {
                output_sample = 0.0;
            }
            for buf_idx in 0..output_count {
                let buff = outputs.get_mut(buf_idx);
                buff[sample_idx] = output_sample;
            }
        }

        self.send_midi();
    }

    fn process_f64(&mut self, buffer: &mut AudioBuffer<f64>) {
        let samples = buffer.samples();
        let (_, mut outputs) = buffer.split();
        let output_count = outputs.len();
        let per_sample = self.time_per_sample();
        let mut output_sample;
        for sample_idx in 0..samples {
            let note_duration = self.note_duration;
            if let Some(current_note) = self.note {
                let signal = midi_pitch_to_freq(current_note);

                // Apply a quick envelope to the attack of the signal to avoid popping.
                let attack = 0.5;
                let alpha = if note_duration < attack {
                    note_duration / attack
                } else {
                    1.0
                };

                output_sample = (signal * alpha) as f64;

                self.time += per_sample;
                self.note_duration += per_sample;
            } else {
                output_sample = 0.0;
            }
            for buf_idx in 0..output_count {
                let buff = outputs.get_mut(buf_idx);
                buff[sample_idx] = output_sample;
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
