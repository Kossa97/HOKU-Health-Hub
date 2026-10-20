import type { Ref } from 'react'
import { TabletVisual } from './TabletVisual'
import { SloshProvider } from '../../../../components/SloshContext'
import type { SloshEngine } from '../../../../components/sloshEngine'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'
import { fuellfarbe } from '../../lib/fuellfarben'

export interface TabletRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
  sloshEngine?: SloshEngine
}

// Die Tablette liegt lose auf der Buehne und rollt beim Wischen an, statt zu
// schwappen: dieselbe Feder, andere Auswertung.
export function TabletRenderer({ item, sloshEngine, ...visualProps }: TabletRendererProps) {
  const tablet = (
    <TabletVisual
      name={item.display_name}
      color={item.color_hex ?? fuellfarbe()}
      {...visualProps}
    />
  )

  return (
    <div data-stack-renderer="tablet" data-umriss-form="tablet">
      {sloshEngine ? <SloshProvider engine={sloshEngine}>{tablet}</SloshProvider> : tablet}
    </div>
  )
}
