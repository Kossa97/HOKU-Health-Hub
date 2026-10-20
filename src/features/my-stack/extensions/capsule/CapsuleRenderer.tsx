import type { Ref } from 'react'
import { CapsuleVisual } from './CapsuleVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'
import { fuellfarbe } from '../../lib/fuellfarben'

export interface CapsuleRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Kein Slosh-Provider: eine liegende Kapsel schwingt nicht, sie lebt allein vom
// wandernden Licht.
export function CapsuleRenderer({ item, ...visualProps }: CapsuleRendererProps) {
  return (
    <div data-stack-renderer="capsule" data-umriss-form="capsule">
      <CapsuleVisual
        name={item.display_name}
        color={item.color_hex ?? fuellfarbe()}
        {...visualProps}
      />
    </div>
  )
}
