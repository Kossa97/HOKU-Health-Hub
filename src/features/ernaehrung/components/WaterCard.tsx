import { Droplets, Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { share } from '../lib/nutrition'
import { MACRO_COLORS, PRESSABLE, card, muted } from '../styles'

export const WATER_STEP_ML = 250

export function WaterCard({ ml, goalMl, onChange }: { ml: number; goalMl: number; onChange: (ml: number) => void }) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="nutr-water" className="p-4" style={card}>
      <div className="flex items-center justify-between">
        <h2 id="nutr-water" className="flex items-center gap-2 text-[0.95rem] font-extrabold" style={{ color: 'var(--text)' }}>
          <Droplets size={16} aria-hidden="true" style={{ color: MACRO_COLORS.water }} />{t('nutr_water')}
        </h2>
        <span className="text-[0.8rem] font-semibold tabular-nums" style={muted} aria-live="polite">
          {(ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} / {(goalMl / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} l
        </span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--border-strong)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, share(ml, goalMl) * 100)}%`, background: MACRO_COLORS.water, transition: 'width 300ms cubic-bezier(0.23, 1, 0.32, 1)' }} />
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={ml <= 0} onClick={() => onChange(Math.max(0, ml - WATER_STEP_ML))}
          aria-label={t('nutr_water_less', { ml: WATER_STEP_ML })} className={`btn-secondary grid h-11 w-14 place-items-center disabled:opacity-40 ${PRESSABLE}`}>
          <Minus size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onChange(ml + WATER_STEP_ML)} className={`btn-primary flex flex-1 items-center justify-center gap-1.5 ${PRESSABLE}`}>
          <Plus size={16} aria-hidden="true" />{t('nutr_water_glass', { ml: WATER_STEP_ML })}
        </button>
      </div>
    </section>
  )
}
