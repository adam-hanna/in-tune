import React from 'react'
import styled from 'styled-components'

import { ScaleSelector } from '../Selectors/Scales'
import { KeySelector } from '../Selectors/Keys'
import { Bar } from '../MusicNotation/Bar'

const Wrapper = styled.div`
  display: inline-flex;
  flex-direction: column;
`

const SelectorsWrapper = styled.div`
  display: inline-flex;
  flex-direction: row;
  justify-content: center;
`

export type BarAndSelectorsProps = {
  disableSelectors: boolean;

  musicKey: string;
  onKeyChange: (key: string) => void;

  scale: string;
  onScaleChange: (scale: string) => void;

  hasClef: boolean;
  hasRepeat: boolean;

  showRemoveIcon: boolean
  remove: () => void
}

export const BarAndSelectors =({
  disableSelectors,
  musicKey,
  onKeyChange,
  scale,
  onScaleChange,
  hasClef,
  hasRepeat,
  showRemoveIcon,
  remove,
}: BarAndSelectorsProps) => {
  return (
    <Wrapper>
      <SelectorsWrapper>
        <KeySelector
          disable={disableSelectors}
          value={musicKey}
          onChange={onKeyChange}
        />
        <ScaleSelector
          disable={disableSelectors}
          value={scale}
          onChange={onScaleChange}
        />
      </SelectorsWrapper>
      <Bar
        hasClef={hasClef}
        hasRepeat={hasRepeat}
        showRemoveIcon={showRemoveIcon}
        remove={remove}
      />
    </Wrapper>
  )
}
