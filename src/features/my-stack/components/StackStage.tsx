import { useTranslation } from 'react-i18next'
import type { Ref } from 'react'
import type { SloshEngine } from '../../../components/sloshEngine'
import type { StackItem } from '../types'
import { getDosageForm } from '../lib/dosageForms'
import type { StageLightHandle } from '../stage/useStageLight'
import { AmpouleRenderer } from '../extensions/ampoule/AmpouleRenderer'
import { CapsuleRenderer } from '../extensions/capsule/CapsuleRenderer'
import { NasalSprayRenderer } from '../extensions/nasal-spray/NasalSprayRenderer'
import { TabletRenderer } from '../extensions/tablet/TabletRenderer'
import { DropsRenderer } from '../extensions/drops/DropsRenderer'
import { PatchRenderer } from '../extensions/patch/PatchRenderer'
import { PenRenderer } from '../extensions/pen/PenRenderer'
import { GelRenderer } from '../extensions/gel/GelRenderer'
import { PowderRenderer } from '../extensions/powder/PowderRenderer'
import { SprayRenderer } from '../extensions/spray/SprayRenderer'
import { TubeRenderer } from '../extensions/tube/TubeRenderer'
import { VialRenderer } from '../extensions/peptide/VialRenderer'

// What every stage form understands. Anything beyond this — a fill level, a
// cap — belongs to the one form that has it.
export interface StackStageProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
  sloshEngine?: SloshEngine
  animateOnMount?: boolean
  // Vial, Spray, Nasenspray, Tropfflasche: wie voll der angebrochene Behaelter
  // ist. Eine Ampulle ist voll oder weg und bekommt keinen.
  fillPct?: number
}

export function StackStage({ item, fillPct, animateOnMount, showLabel, sloshEngine, ...visualProps }: StackStageProps) {
  const { t } = useTranslation()
  const renderer = getDosageForm(item.dosage_form).stageRenderer

  if (renderer === 'vial') {
    return <VialRenderer item={item} fillPct={fillPct} animateOnMount={animateOnMount} showLabel={showLabel} sloshEngine={sloshEngine} {...visualProps} />
  }

  // Weder Etikett noch Physik: beides ist fuer eine Kapsel bedeutungslos.
  if (renderer === 'capsule') {
    return <CapsuleRenderer item={item} showLabel={showLabel} {...visualProps} />
  }

  if (renderer === 'tablet') {
    return <TabletRenderer item={item} showLabel={showLabel} sloshEngine={sloshEngine} {...visualProps} />
  }

  if (renderer === 'ampoule') {
    return <AmpouleRenderer item={item} showLabel={showLabel} sloshEngine={sloshEngine} {...visualProps} />
  }

  if (renderer === 'drops') {
    return <DropsRenderer item={item} fillPct={fillPct} showLabel={showLabel} sloshEngine={sloshEngine} {...visualProps} />
  }

  if (renderer === 'nasal_spray') {
    return <NasalSprayRenderer item={item} fillPct={fillPct} showLabel={showLabel} sloshEngine={sloshEngine} {...visualProps} />
  }

  if (renderer === 'tube') {
    return <TubeRenderer item={item} showLabel={showLabel} {...visualProps} />
  }

  if (renderer === 'patch') {
    return <PatchRenderer item={item} showLabel={showLabel} {...visualProps} />
  }

  if (renderer === 'pen') {
    return <PenRenderer item={item} showLabel={showLabel} {...visualProps} />
  }

  // Wie die Tube: undurchsichtig, kein Etikett, kein Pegel, kein Schwappen.
  if (renderer === 'powder') {
    return <PowderRenderer item={item} showLabel={showLabel} {...visualProps} />
  }

  // Durchscheinend, und es bewegt sich — aber zaeh: dieselbe Feder, durch ein
  // Verzoegerungsglied gefiltert. Kein Etikettband, kein Pegel.
  if (renderer === 'gel') {
    return <GelRenderer item={item} showLabel={showLabel} sloshEngine={sloshEngine} {...visualProps} />
  }

  // Das Mundspray. Wie das Nasenspray eine Pumpflasche mit Etikett und
  // Schwappen — aber die kleinere, mit seitlicher Duese statt Nasenkegel.
  if (renderer === 'spray') {
    return <SprayRenderer item={item} fillPct={fillPct} showLabel={showLabel} sloshEngine={sloshEngine} {...visualProps} />
  }

  return (
    <div
      data-stack-renderer="unsupported"
      className="flex min-h-28 flex-col justify-center rounded-2xl border border-slate-700/70 bg-slate-950/80 px-5 py-4 shadow-[0_18px_45px_rgba(2,6,23,0.32)]"
    >
      <p className="font-medium text-white">{item.display_name}</p>
      <p className="mt-1 text-sm text-slate-400">{t('my_stack_visual_pending')}</p>
    </div>
  )
}
