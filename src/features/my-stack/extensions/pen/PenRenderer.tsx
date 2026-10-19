import type { Ref } from 'react'
import { PenVisual } from './PenVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'
import { fuellfarbe } from '../../lib/fuellfarben'

export interface PenRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Kein Slosh-Provider: ohne Kartuschenfenster gibt es keine sichtbare
// Flüssigkeit, die schwappen könnte. Die Eintragsfarbe geht an den Ring.
export function PenRenderer({ item, ...visualProps }: PenRendererProps) {
  return (
    <div data-stack-renderer="pen" data-umriss-form="pen">
      <PenVisual
        name={item.display_name}
        color={item.color_hex ?? fuellfarbe()}
        {...visualProps}
      />
    </div>
  )
}
