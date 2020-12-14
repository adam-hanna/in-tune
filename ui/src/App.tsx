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
type CurrentLocationMarkerProps = {
  left: string;
  top: string;
  transitionDuration: string;
}
const CurrentLocationMarker = styled.div`
  position: absolute;

  height: 120px;
  width: 5px;

  left: ${(props: CurrentLocationMarkerProps) => props.left};
  top: ${(props: CurrentLocationMarkerProps) => props.top};

  background-color: red;

  transition-property: left;
  transition-duration: ${(props: CurrentLocationMarkerProps) => props.transitionDuration};
  transition-timing-function: linear;
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
  const [msPerBeat, setMSPerBeat] = useState(0)
  const [msPerBar, setMSPerBar] = useState(0)

  const [icon, setIcon] = useState('play')
  const [intrvl, setIntrvl] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [top, setTop] = useState(62.5)
  const [left, setLeft] = useState(0)
  const [transitionTime, setTransitionTime] = useState(0)
  
  const [currentBar, setCurrentBar] = useState(0)
  const [currentRow, setCurrentRow] = useState(0)

  const handleKeyChange = (idx: number, data: string) => {
    dispatch({ idx, type: 'CHANGE_KEY', data });
  };
  const handleScaleChange = (idx: number, data: string) => {
    dispatch({ idx, type: 'CHANGE_SCALE', data });
  };

  useEffect(() => {
    const tmpMSPerBeat = (60 * 1000) / tempo
    const tmpMSPerBar = tmpMSPerBeat * beatsPerBar

    setMSPerBeat(tmpMSPerBeat)
    setMSPerBar(tmpMSPerBar)
  }, [tempo, beatsPerBar])

  useEffect(() => {
    if (icon === 'play') {
      clearInterval(intrvl)
      setStartTime(0)
      setCurrentBar(-1)
      setCurrentRow(0)
      setLeft(0)
      setTop(62.5)
      setTransitionTime(0)

      if (NODE_ENV === 'production') {
        // @ts-ignore
        // eslint-disable-next-line
        external.invoke(`stop`)
      }
    } else {
      setCurrentBar(0)
      const t = new Date().getTime()
      setStartTime(t)
      ;((tmpTime) => {
        const tmpInterval = setInterval(() => {
          const deltaMS = new Date().getTime() - tmpTime
          const quotient = deltaMS / msPerBar
          const tmpCurrentBar = Math.round(quotient)
          setCurrentBar(tmpCurrentBar%bars.length)
        }, msPerBar)
        setIntrvl(tmpInterval)
      })(t);
    }
  }, [icon])

  useEffect(() => {
    if (currentBar < 0) {
      setLeft(0)
      setTransitionTime(0)
      setTop(62.5)

    } else {
      if (currentBar === 0) {
        setLeft(0)
        setTransitionTime(0)
      }

      // note: 4 bars per line
      const tmpCurrentRow = Math.floor(currentBar / 4)
      setCurrentRow(tmpCurrentRow)
    }
  }, [currentBar])

  useEffect(() => {
    setLeft(0)
    setTransitionTime(0)
    setTop((currentRow) * 219.5 + 62.5)
  }, [currentRow])

  useEffect(() => {
    if (left === 0 && icon === 'stop') {
      const numRows = Math.ceil(bars.length / 4)
      let numBarsInCurrentRow = (currentRow + 1) !== numRows ? 4 : bars.length % 4;
      if (numBarsInCurrentRow === 0) {
        numBarsInCurrentRow = 4
      }
      
      // note: 300px per bar
      setLeft(numBarsInCurrentRow * 300)
      setTransitionTime(msPerBar*numBarsInCurrentRow)
    }
  }, [left, icon])

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
            top={`${top}px`}
            left={`${left}px`}
            transitionDuration={`${transitionTime}ms`}
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
