import type { Ref } from 'react'
import { PeptideVialVisual } from '../../../../components/PeptideVialVisual'
import type { VialStageLightHandle } from '../../../../components/PeptideVialVisual'
import { SloshProvider } from '../../../../components/SloshContext'
import type { SloshEngine } from '../../../../components/sloshEngine'
import type { StackItem } from '../../types'
import { fuellfarbe } from '../../lib/fuellfarben'

export interface VialRendererProps {
  item: StackItem
  fillPct?: number
  animateOnMount?: boolean
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<VialStageLightHandle>
  sloshEngine?: SloshEngine
}

export function VialRenderer({
  item,
  fillPct = 100,
  animateOnMount = false,
  size = 'large',
  className,
  showLabel,
  isActive,
  focus,
  lightOffset,
  stageLightRef,
  sloshEngine,
}: VialRendererProps) {
  const ingredient = item.ingredients[0]
  const vial = (
    <PeptideVialVisual
      name={item.display_name}
      amount={ingredient?.amount_value}
      unit={ingredient?.amount_unit}
      fillPct={fillPct}
      color={item.color_hex ?? fuellfarbe()}
      animateOnMount={animateOnMount}
      size={size}
      className={className}
      showLabel={showLabel}
      isActive={isActive}
      focus={focus}
      lightOffset={lightOffset}
      stageLightRef={stageLightRef}
    />
  )

  return (
    <div data-stack-renderer="vial" data-umriss-form="vial">
      {sloshEngine ? <SloshProvider engine={sloshEngine}>{vial}</SloshProvider> : vial}
    </div>
  )
}
