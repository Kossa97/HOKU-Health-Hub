import type { Ref } from 'react'
import { GelVisual } from './GelVisual'
import { SloshProvider } from '../../../../components/SloshContext'
import type { SloshEngine } from '../../../../components/sloshEngine'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'
import { fuellfarbe } from '../../lib/fuellfarben'

export interface GelRendererProps {
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

// Dieselbe Feder wie bei der Fluessigkeit, andere Auswertung — wie bei der
// Tablette, die anrollt statt zu schwappen. Das Gel filtert die Federantwort
// durch ein Verzoegerungsglied und kriecht der Bewegung hinterher.
//
// Kein Fuellstand: der Tiegel zeigt seinen Inhalt, aber die App kennt keine
// Menge. Die Farbe sitzt auf Deckel und Gel, wie bei der Tropfflasche auf
// Kappe und Fluessigkeit.
export function GelRenderer({ item, sloshEngine, ...visualProps }: GelRendererProps) {
  const jar = (
    <GelVisual
      name={item.display_name}
      color={item.color_hex ?? fuellfarbe()}
      {...visualProps}
    />
  )

  return (
    <div data-stack-renderer="gel" data-umriss-form="gel">
      {sloshEngine ? <SloshProvider engine={sloshEngine}>{jar}</SloshProvider> : jar}
    </div>
  )
}
