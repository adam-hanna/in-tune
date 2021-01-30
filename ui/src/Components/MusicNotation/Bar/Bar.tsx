import React, { useState } from 'react'
import styled from 'styled-components'
import { Icon } from 'semantic-ui-react'

import { ReactComponent as BarSVG } from './bar.svg'
import { ReactComponent as ClefSVG } from './clef.svg'
import { ReactComponent as RepeatSVG } from './repeat.svg'

const Wrapper = styled.div`
  position: relative;
  display: inline-flex;
  flex-direction: column;

  padding: 15px 0px 40px 0px;

  cursor: pointer;
`

export type BarProps = {
  isActive: boolean;
  hasClef: boolean;
  hasRepeat: boolean;
  showRemoveIcon: boolean;
  remove: () => void
}

export const Bar = ({
  isActive,
  hasClef,
  hasRepeat,
  showRemoveIcon,
  remove,
}: BarProps) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Wrapper
      onClick={remove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)} 
    >
      {hasClef && <ClefSVG style={{ position: 'absolute', left: '10px', top: '0px', height: '150px' }} />}
      <BarSVG style={{ width: '300px', height: '100px', backgroundColor: `rgba(255, 255, 0, ${isActive ? 1 : 0})`, transition: 'background-color 0.25s ease-in-out' }} />
      {hasRepeat && <RepeatSVG style={{ position: 'absolute', right: '-20px', height: '100px' }} />}
      {hovered && showRemoveIcon && <Icon style={{ position: 'absolute', color: 'red', fontSize: '50px', left: '125px', top: '52.5px' }} name='remove circle' />}
    </Wrapper>
  )
}
