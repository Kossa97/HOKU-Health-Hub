import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { stockUnitSingular } from '../../lib/bestandLabels'
import type { Translate } from '../../lib/planLabels'
import { SprayVisual } from './SprayVisual'
import { SloshProvider } from '../../../../components/SloshContext'
import type { SloshEngine } from '../../../../components/sloshEngine'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'
import { fuellfarbe } from '../../lib/fuellfarben'

export interface SprayRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
  sloshEngine?: SloshEngine
  /** Wie voll der angebrochene Behaelter ist, 0–100. */
  fillPct?: number
}

// "1000 IU / spray" — Wirkstoff je Spruehstoss, wie es auf der Flasche steht.
// Fehlende Teile bleiben weg statt durch einen Platzhalter ersetzt zu werden.
function strengthLabel(item: StackItem, t: Translate): string | null {
  const ingredient = item.ingredients[0]
  if (!ingredient?.amount_unit) return null
  return ingredient.basis_unit
    // Die Bezugseinheit uebersetzt: „Sprühstoß", nicht „spray" — sonst
    // liest sich „/ Spray" wie „je Flasche".
    ? `${ingredient.amount_unit} / ${stockUnitSingular(t, ingredient.basis_unit)}`
    : ingredient.amount_unit
}

export function SprayRenderer({ item, sloshEngine, ...visualProps }: SprayRendererProps) {
  const { t } = useTranslation()
  const ingredient = item.ingredients[0]
  const spray = (
    <SprayVisual
      name={item.display_name}
      amount={ingredient?.amount_value}
      unit={strengthLabel(item, t)}
      color={item.color_hex ?? fuellfarbe()}
      {...visualProps}
    />
  )

  return (
    <div data-stack-renderer="spray" data-umriss-form="spray">
      {sloshEngine ? <SloshProvider engine={sloshEngine}>{spray}</SloshProvider> : spray}
    </div>
  )
}
