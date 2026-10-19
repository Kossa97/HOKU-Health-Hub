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
        <h2 id="nutr-water" className="flex items-center gap-2.5 text-[17px] font-semibold text-[var(--lg-text)]">
          <span className="lg-icon-tile" style={{ background: '#0a84ff' }} aria-hidden="true"><Droplets size={16} /></span>{t('nutr_water')}
        </h2>
        <span className={`text-[15px] tabular-nums ${MUTED}`} aria-live="polite">
          {(ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} / {(goalMl / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} l
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--lg-fill)]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, share(ml, goalMl) * 100)}%`, background: MACRO_COLORS.water, transition: 'width 300ms cubic-bezier(0.23, 1, 0.32, 1)' }} />
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
