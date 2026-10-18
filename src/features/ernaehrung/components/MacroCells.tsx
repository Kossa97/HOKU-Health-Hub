import { useTranslation } from 'react-i18next'
import type { Nutrients } from '../lib/nutrition'
import { MACRO_COLORS, MUTED } from '../styles'

/** Kacheln kcal · Eiweiß · Kohlenhydrate · Fett; ohne Werte (ungültige Menge) mit Strich. */
export function MacroCells({ nutrients: nu, hideKcal }: { nutrients: Nutrients | null; hideKcal: boolean }) {
  const { t } = useTranslation()
  const cells = [
    ...(hideKcal ? [] : [{ key: 'kcal', value: nu?.kcal, unit: '', name: 'kcal', color: MACRO_COLORS.kcal }]),
    { key: 'p', value: nu?.protein, unit: ' g', name: t('nutr_protein'), color: MACRO_COLORS.protein },
    { key: 'c', value: nu?.carbs, unit: ' g', name: t('nutr_carbs_short'), color: MACRO_COLORS.carbs },
    { key: 'f', value: nu?.fat, unit: ' g', name: t('nutr_fat'), color: MACRO_COLORS.fat },
  ]
  return (
    <div className={`grid gap-2 ${cells.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`} aria-live="polite">
      {cells.map(c => (
        <div key={c.key} className="min-w-0 rounded-[14px] bg-[var(--lg-surface-2)] px-1 py-2.5 text-center">
          <div className="text-[17px] font-semibold tabular-nums text-[var(--lg-text)]">{c.value == null ? '–' : `${Math.round(c.value)}${c.unit}`}</div>
          <div className={`mt-0.5 flex items-center justify-center gap-1 text-[12px] leading-tight ${MUTED}`}>
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
            <span className="truncate">{c.name}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
