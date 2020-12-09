import React from 'react'
import { Select } from 'semantic-ui-react'
import styled from 'styled-components'

import { Keys } from '../../../Keys'

const BoldLabel = styled.label`
  font-weight: bold;
`

const Wrapper = styled.div`
  display: inline-flex;
  flex-direction: column;
  align-items: baseline;
`

export type KeySelectorProps = {
  disable: boolean;
  value: string;
  onChange: (key: string) => void;
}

export const KeySelector = ({
  disable,
  value,
  onChange
}: KeySelectorProps) => {
  const keys = Keys.sort().map(name => {
    return {
      key: name, 
      value: name, 
      text: name
    }
  })

  return (
    <Wrapper>
      <BoldLabel style={{ color: disable ? '#ccc' : 'black' }}>Key:</BoldLabel>
      <Select 
        disabled={disable}
        style={{ minWidth: 'auto', width: '95px' }} 
        value={value} 
        onChange={e => { 
          onChange((e.target as HTMLDivElement).textContent || '') 
        }} 
        placeholder='Select the key' 
        options={keys} 
      />
    </Wrapper>
  )
}
