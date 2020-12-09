import React from 'react'
import styled from 'styled-components'
import { Select } from 'semantic-ui-react'
import { Scale } from "@tonaljs/tonal"

const BoldLabel = styled.label`
  font-weight: bold;
`

const Wrapper = styled.div`
  display: inline-flex;
  flex-direction: column;
  align-items: baseline;
`

export type ScaleSelectorProps = {
  disable: boolean;
  value: string;
  onChange: (key: string) => void;
}

export const ScaleSelector = ({
  disable,
  value,
  onChange
}: ScaleSelectorProps) => {
  const scales = Scale.names().sort().map(name => {
    return {
      key: name, 
      value: name, 
      text: name
    }
  })

  return (
    <Wrapper>
      <BoldLabel style={{ color: disable ? '#ccc' : 'black' }}>Scale:</BoldLabel>
      <Select 
        disabled={disable}
        value={value} 
        onChange={e => { 
          onChange((e.target as HTMLDivElement).textContent || '') 
        }} 
        placeholder='Select the scale' 
        options={scales} 
      />
    </Wrapper>
  )
}
