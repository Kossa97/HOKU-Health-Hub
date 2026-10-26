import type { Ref } from 'react'
import { PatchVisual } from './PatchVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface PatchRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Kein Slosh-Provider: ein Pflaster enthält keine sichtbare Flüssigkeit.
// Und keine Eintragsfarbe: ein Pflaster ist hautfarben, ein Farbfeld darauf
// wäre der einzige Fremdkörper im Bild. Diese Form zeigt color_hex nicht.
export function PatchRenderer({ item, ...visualProps }: PatchRendererProps) {
  return (
    <div data-stack-renderer="patch" data-umriss-form="patch">
      <PatchVisual name={item.display_name} {...visualProps} />
    </div>
  )
}
