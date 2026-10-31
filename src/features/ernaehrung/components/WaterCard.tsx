import { Droplets, Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { share } from '../lib/nutrition'
import { CARD, MACRO_COLORS, MUTED } from '../styles'

export const WATER_STEP_ML = 250

export function WaterCard({ ml, goalMl, onChange }: { ml: number; goalMl: number; onChange: (ml: number) => void }) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="nutr-water" className={`${CARD} p-4`}>
      <div className="flex items-center justify-between">
        <h2 id="nutr-water" className="flex items-center gap-2 text-[17px] font-medium text-[var(--lg-text)]">
          <Droplets size={18} strokeWidth={1.5} aria-hidden="true" className="text-[var(--lg-text-2)]" />{t('nutr_water')}
        </h2>
        <span className={`text-[15px] tabular-nums ${MUTED}`} aria-live="polite">
          {(ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} / {(goalMl / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} l
        </span>
      </div>
      {/* Spur mit Messstrichen; die Füllung wächst per scaleX, nicht per Breite */}
      <div className="hk-scale mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--lg-fill)]">
        <div className="h-full origin-left" style={{ transform: `scaleX(${Math.min(1, share(ml, goalMl))})`, background: MACRO_COLORS.water, transition: 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={ml <= 0} onClick={() => onChange(Math.max(0, ml - WATER_STEP_ML))}
          aria-label={t('nutr_water_less', { ml: WATER_STEP_ML })} data-quiet className="lg-gray-btn !w-14 shrink-0 !px-0">
          <Minus size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onChange(ml + WATER_STEP_ML)} className="lg-gray-btn flex-1">
          <Plus size={16} aria-hidden="true" />{t('nutr_water_glass', { ml: WATER_STEP_ML })}
        </button>
      </div>
    </section>
  )
}
