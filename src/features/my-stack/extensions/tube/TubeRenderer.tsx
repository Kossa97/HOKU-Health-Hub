import type { Ref } from 'react'
import { TubeVisual } from './TubeVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface TubeRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Kein Slosh-Provider: die Tube enthält Paste und steht auf einer flachen
// Standfläche. Und keine Farbe: Aluminium hat eine feste, der Name übernimmt
// das Unterscheiden.
export function TubeRenderer({ item, ...visualProps }: TubeRendererProps) {
  return (
    <div data-stack-renderer="tube" data-umriss-form="tube">
      <TubeVisual name={item.display_name} {...visualProps} />
    </div>
  )
}
