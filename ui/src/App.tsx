import React, { useState, useReducer, useEffect } from 'react';
import 'semantic-ui-css/semantic.min.css'
import { Button, Input, Icon, Modal } from 'semantic-ui-react'
import styled from 'styled-components'
import { ScaleType, Interval } from "@tonaljs/tonal"

import './App.css';
import { BarAndSelectors } from './Components/BarAndSelectors'
import { KeysToRootNoteMap } from './Keys'
import { ScaleSelector } from './Components/Selectors/Scales'

const { NODE_ENV } = process.env

interface HTMLInputEvent extends Event {
    target: HTMLInputElement & EventTarget;
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

const HeaderWrapper = styled.div`
  width: 100%;
  
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`

const ControlsWrapper = styled.div`
  display: flex;
  flex-direction: row;

  margin-bottom: 10px;
`

const SaveLoadWrapper = styled.div`
  display: flex;
  flex-direction: column;
`

const BarsWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  max-width: 1200px;
`

const InputsWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;

  margin: 0px 0px 15px 0px;
`

const TemposWrapper = styled.div`
  display: flex;
  flex-direction: column;
`

type BarState = {
  musicKey: string;
  scale: string;
}

const initialBars: BarState[] = [
  {
    musicKey: "C",
    scale: "major",
  }
]

type Action = {
  idx: number;
  type: string;
  data: string;
}

type BarReducerFn = (state: BarState[], action: Action) => BarState[];

const barReducer: BarReducerFn = (state, action) => {
  switch (action.type) {
    case "CHANGE_KEY":
      return state.map((bar, idx) => {
        if (idx === action.idx) {
          return { ...bar, musicKey: action.data }
        }

        return bar
      })

    case "CHANGE_SCALE":
      return state.map((bar, idx) => {
        if (idx === action.idx) {
          return { ...bar, scale: action.data }
        }

        return bar
      })

    case "CHANGE_ALL_SCALES":
      return state.map((bar) => {
        return { ...bar, scale: action.data }
      })

    case "SET_BARS":
      try {
        const newBars = JSON.parse(action.data)
        return [ ...newBars ]
      } catch(e) {
        console.error('err processing data', action.data, e)
        return [ ...state ]
      }

    case "ADD_BAR":
      return [...state, { musicKey: "C", scale: "major" }]

    case "REMOVE_BAR":
    return [...state].filter((bar, idx) => {
      return idx !== action.idx
    });

    default:
      return state;
  }
}

function App() {
  const [bars, dispatch] = useReducer(
    barReducer,
    initialBars,
  );
  const [tempo, setTempo] = useState(108)
  const [beatsPerBar, setBeatsPerBar] = useState(4)
  const [beatNumber, setBeatNumber] = useState(0)

  const [icon, setIcon] = useState('play')
  const [intrvl, setIntrvl] = useState(0)
  
  const [currentBar, setCurrentBar] = useState(0)

  const [scaleModal, setScaleModal] = useState(false)
  const [scale, setScale] = useState('Major')

  const handleKeyChange = (idx: number, data: string) => {
    dispatch({ idx, type: 'CHANGE_KEY', data });
  };
  const handleScaleChange = (idx: number, data: string) => {
    dispatch({ idx, type: 'CHANGE_SCALE', data });
  };

  const LowAudio = new Audio("https://in-tune-media.s3.amazonaws.com/Low_Seiko_SQ50.wav")
  const HighAudio = new Audio("https://in-tune-media.s3.amazonaws.com/High_Seiko_SQ50.wav")

  useEffect(() => {
    const relativeBeat = (beatNumber % (bars.length * beatsPerBar))

    if (beatNumber > 0) {
      if (relativeBeat % beatsPerBar === 0) {
        HighAudio.play()
      } else {
        LowAudio.play()
      }
    }

    setCurrentBar(Math.floor(relativeBeat / beatsPerBar))
  }, [beatNumber, beatsPerBar, bars])

  useEffect(() => {
    if (icon === 'play') {
      clearInterval(intrvl)
      setCurrentBar(-1)
      setBeatNumber(0)

      if (NODE_ENV === 'production') {
        // @ts-ignore
        // eslint-disable-next-line
        external.invoke(`stop`)
      }
    } else {
      setCurrentBar(0)
      setBeatNumber(0)

      const tmpMSPerBeat = (60 * 1000) / tempo
      ;((msPerBeat) => {
        const tmpInterval = setInterval(() => {
          setBeatNumber(prevBeat => prevBeat + 1 )
        }, msPerBeat)
        setIntrvl(tmpInterval)
      })(tmpMSPerBeat);
    }
  }, [icon])

  useEffect(() => {
    if (currentBar < 0) {
      return
    }

    if (NODE_ENV === 'production') {
      const { musicKey, scale }= bars[currentBar]
      const keyIDX = KeysToRootNoteMap[musicKey]
      const { intervals } = ScaleType.get(scale)
      const semitones = intervals.map(interval => {
        return Interval.semitones(interval)
      })

      // @ts-ignore
      // eslint-disable-next-line
      external.invoke(`set ${keyIDX} [${semitones.join(",")}]`)
    }
  }, [currentBar])

  return (
    <Wrapper className="App">
      <Modal
        onClose={() => setScaleModal(false)}
        onOpen={() => setScaleModal(true)}
        open={scaleModal}
      >
        <Modal.Header>Select a Scale</Modal.Header>
        <Modal.Content>
          <Modal.Description>
            <ScaleSelector
              disable={false}
              value={scale}
              onChange={setScale}
            />
          </Modal.Description>
        </Modal.Content>
        <Modal.Actions>
          <Button color='black' onClick={() => setScaleModal(false)}>
            Cancel
          </Button>
          <Button
            content="Set Scale"
            labelPosition='right'
            icon='checkmark'
            onClick={() => {
              dispatch({ idx: -1, type: 'CHANGE_ALL_SCALES', data: scale })
              setScaleModal(false)
            }}
            positive
          />
        </Modal.Actions>
      </Modal>
      <HeaderWrapper>
        <ControlsWrapper>
          <SaveLoadWrapper>
            <Button 
              icon='download' 
              title="save" 
              onClick={() => {
                const textToWrite = JSON.stringify(bars)
                const textFileAsBlob = new Blob([ textToWrite ], { type: 'text/plain' })
                const fileNameToSaveAs = "bars.json"

                const downloadLink = document.createElement("a")
                downloadLink.download = fileNameToSaveAs
                downloadLink.innerHTML = "Download File"
                if (window.webkitURL != null) {
                  // Chrome allows the link to be clicked without actually adding it to the DOM.
                  downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob)
                } else {
                  // Firefox requires the link to be added to the DOM before it can be clicked.
                  downloadLink.href = window.URL.createObjectURL(textFileAsBlob)
                  downloadLink.onclick = () => {
                    document.body.removeChild(downloadLink)
                  }
                  downloadLink.style.display = "none"
                  document.body.appendChild(downloadLink)
                }

                downloadLink.click()
              }}
            />
            {/*
            <input 
              id="file-input" 
              type="file" 
              name="name" 
              style={{ display: "none" }} 
              onchange={(e: HTMLInputEvent) => {
                if (!e || !e.target || !e.target.files || e.target.files.length === 0) {
                  return
                }

                const selectedFile = e.target.files[0];
                const reader = new FileReader();

                reader.onload = function(event) {
                  if (!event || !event.target) {
                    return
                  }
                  dispatch({ idx: -1, type: 'SET_BARS', data: String(event.target.result) })
                };

                reader.readAsText(selectedFile);
              }}
            />
            */}
            <Button 
              icon='upload' 
              title="load" 
              onClick={() => {
                //document.getElementById('file-input')?.click()
                const downloadLink = document.createElement("input")
                downloadLink.type = "file"
                // @ts-ignore
                downloadLink.onchange = (e: HTMLInputEvent) => {
                  if (!e || !e.target || !e.target.files || e.target.files.length === 0) {
                    return
                  }

                  const selectedFile = e.target.files[0];
                  const reader = new FileReader();

                  reader.onload = function(event) {
                    if (!event || !event.target) {
                      return
                    }
                    dispatch({ idx: -1, type: 'SET_BARS', data: String(event.target.result) })
                  };

                  reader.readAsText(selectedFile);
                }

                downloadLink.innerHTML = "Upload File"
                if (window.webkitURL != null) {
                  // Chrome allows the link to be clicked without actually adding it to the DOM.
                } else {
                  // Firefox requires the link to be added to the DOM before it can be clicked.
                  downloadLink.onclick = () => {
                    document.body.removeChild(downloadLink)
                  }
                  downloadLink.style.display = "none"
                  document.body.appendChild(downloadLink)
                }

                downloadLink.click()
              }}
            />
          </SaveLoadWrapper>
          <Button secondary onClick={() => { setScaleModal(true) }}>Set All Scales</Button>
        </ControlsWrapper>
        <InputsWrapper>
          <TemposWrapper>
            <Input
              disabled={icon === 'stop'}
              label='Tempo (BPM)'
              value={tempo}
              onChange={e => {
                setTempo(Number(e.currentTarget.value))
              }}
            />
            <Input
              disabled={icon === 'stop'}
              label='Beats per Bar'
              value={beatsPerBar}
              onChange={e => {
                setBeatsPerBar(Number(e.currentTarget.value))
              }}
            />
          </TemposWrapper>
          <Icon 
            // @ts-ignore
            name={icon} 
            size='huge' 
            onClick={() => {
              HighAudio.play()
              if (icon === 'play') {
                setIcon('stop')
              } else {
                setIcon('play')
              }
            }}
            style={{ cursor: 'pointer' }} 
          />
        </InputsWrapper>
      </HeaderWrapper>
      <BarsWrapper>
        {(bars as BarState[]).map((bar, idx) => (
          <BarAndSelectors
            key={idx}
            disableSelectors={icon === 'stop'}
            isActive={currentBar === idx}

            musicKey={bar.musicKey}
            onKeyChange={(key: string) => { handleKeyChange(idx, key) }}

            scale={bar.scale}
            onScaleChange={(scale: string) => { handleScaleChange(idx, scale) }}

            hasClef={idx % 4 === 0}
            hasRepeat={idx === bars.length - 1}

            showRemoveIcon={icon !== 'stop'}
            remove={() => { 
              if (icon !== 'stop') {
                dispatch({ idx, type: 'REMOVE_BAR', data: '' }) 
              }
            }}
          />
        ))}
      </BarsWrapper>
      <div>
        <Button
          primary
          disabled={icon === 'stop'}
          onClick={() => { dispatch({ idx: -1, type: 'ADD_BAR', data: '' }) }}
        >
          Add Bar
        </Button>
      </div>
    </Wrapper>
  );
}

export default App;
