import React, { useState, useReducer, useEffect } from 'react';
import 'semantic-ui-css/semantic.min.css'
import { Button, Input, Icon } from 'semantic-ui-react'
import styled from 'styled-components'
import { ScaleType, Interval } from "@tonaljs/tonal"

import './App.css';
import { BarAndSelectors } from './Components/BarAndSelectors'
import { KeysToRootNoteMap } from './Keys'

const { NODE_ENV } = process.env

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
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

const CurrentLocationMarker = styled.div`
  position: absolute;

  height: 120px;
  width: 5px;

  background-color: red;

  /*
  transition-property: left;
  transition-duration: 50ms;
  */
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
  const [icon, setIcon] = useState('play')
  const [currentMS, setCurrentMS] = useState(0)
  const [intrvl, setIntrvl] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [top, setTop] = useState(62.5)
  const [left, setLeft] = useState(0)
  const [currentBar, setCurrentBar] = useState(0)

  const handleKeyChange = (idx: number, data: string) => {
    dispatch({ idx, type: 'CHANGE_KEY', data });
  };
  const handleScaleChange = (idx: number, data: string) => {
    dispatch({ idx, type: 'CHANGE_SCALE', data });
  };

  useEffect(() => {
    if (icon === 'play') {
      clearInterval(intrvl)
      setStartTime(0)
      setCurrentMS(0)
      setCurrentBar(-1)
      setLeft(0)
      setTop(62.5)

      if (NODE_ENV === 'production') {
        // @ts-ignore
        // eslint-disable-next-line
        external.invoke(`stop`)
      }
    } else {
      setCurrentMS(0)
      const t = new Date().getTime()
      setStartTime(t)
      ;((tmpTime) => {
        const tmpInterval = setInterval(() => {
          setCurrentMS(new Date().getTime() - tmpTime)
        }, 50)
        setIntrvl(tmpInterval)
      })(t);
    }
  }, [icon])

  useEffect(() => {
    //console.log(`currentMS: ${currentMS}`)
    if (currentMS === 0) {
      setLeft(0)
      setTop(62.5)

    } else {
      const msPerBeat = (60 * 1000) / tempo
      const numBeats = currentMS / msPerBeat
      const barNumber = Math.floor(numBeats / beatsPerBar)
      const tmpCurrentBar = barNumber % bars.length
      setCurrentBar(tmpCurrentBar)

      // note: 4 bars per line
      // note: 300px per bar
      setLeft((tmpCurrentBar % 4) * 300 + (numBeats % beatsPerBar) * (300 / beatsPerBar))
      setTop(Math.floor(tmpCurrentBar / 4) * 212.5 + 62.5)
    }
  }, [currentMS])

  useEffect(() => {
    console.log(`currentBar: ${currentBar}`)
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
            if (icon === 'play') {
              setIcon('stop')
            } else {
              setIcon('play')
            }
          }}
          style={{ cursor: 'pointer' }} 
        />
      </InputsWrapper>
      <BarsWrapper>
        <CurrentLocationMarker 
            style={{
              top: `${top}px`,
              left: `${left}px`,
            }}
        />
        {(bars as BarState[]).map((bar, idx) => (
          <BarAndSelectors
            key={idx}
            disableSelectors={icon === 'stop'}

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
