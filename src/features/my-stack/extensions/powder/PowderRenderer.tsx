import type { Ref } from 'react'
import { PowderVisual } from './PowderVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'
import { fuellfarbe } from '../../lib/fuellfarben'

export interface PowderRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Weder Glas-Etikettband noch Fuellstand: beides ist fuer eine
// undurchsichtige Pulverdose bedeutungslos. Deshalb reicht der Renderer weder
// fillPct noch eine Slosh-Anbindung weiter. showLabel schaltet hier nicht das
// Band, sondern die Aufschrift auf der Dose ab — die Auswahlkachel im
// Formular zeigt das nackte Objekt. Die Farbe sitzt auf dem Deckel, anders
// als bei der Tube, die ganz ohne auskommt.
export function PowderRenderer({ item, ...visualProps }: PowderRendererProps) {
  return (
    <div data-stack-renderer="powder" data-umriss-form="powder">
      <PowderVisual
        name={item.display_name}
        color={item.color_hex ?? fuellfarbe()}
        {...visualProps}
      />
    </div>
  )
}
