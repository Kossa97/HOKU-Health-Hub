import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { stockUnitSingular } from '../../lib/bestandLabels'
import type { Translate } from '../../lib/planLabels'
import { AmpouleVisual } from './AmpouleVisual'
import { SloshProvider } from '../../../../components/SloshContext'
import type { SloshEngine } from '../../../../components/sloshEngine'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'
import { fuellfarbe } from '../../lib/fuellfarben'

export interface AmpouleRendererProps {
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

// "250 mg / ml" — strength per basis, the way it is printed on a real ampoule.
// Missing pieces are left out rather than filled with a placeholder.
function strengthLabel(item: StackItem, t: Translate): string | null {
  const ingredient = item.ingredients[0]
  if (!ingredient?.amount_unit) return null
  return ingredient.basis_unit
    // Die Bezugseinheit uebersetzt: „Sprühstoß", nicht „spray" — sonst
    // liest sich „/ Spray" wie „je Flasche".
    ? `${ingredient.amount_unit} / ${stockUnitSingular(t, ingredient.basis_unit)}`
    : ingredient.amount_unit
}

export function AmpouleRenderer({ item, sloshEngine, ...visualProps }: AmpouleRendererProps) {
  const { t } = useTranslation()
  const ingredient = item.ingredients[0]
  const ampoule = (
    <AmpouleVisual
      name={item.display_name}
      amount={ingredient?.amount_value}
      unit={strengthLabel(item, t)}
      color={item.color_hex ?? fuellfarbe()}
      {...visualProps}
    />
  )

  return (
    <div data-stack-renderer="ampoule" data-umriss-form="ampoule">
      {sloshEngine ? <SloshProvider engine={sloshEngine}>{ampoule}</SloshProvider> : ampoule}
    </div>
  )
}
