import { useTranslation } from 'react-i18next'
import type { Nutrients } from '../lib/nutrition'
import { MACRO_COLORS, MUTED } from '../styles'

/**
 * Kacheln kcal · Eiweiß · Kohlenhydrate · Fett; ohne Werte (ungültige Menge) mit Strich.
 * `compact`: flacher; „Kohlenhydrate“ ausgeschrieben, wo es passt (drei Kacheln, nicht auf sehr schmalen Geräten).
 */
export function MacroCells({ nutrients: nu, hideKcal, compact = false }: { nutrients: Nutrients | null; hideKcal: boolean; compact?: boolean }) {
  const { t } = useTranslation()
  const cells = [
    ...(hideKcal ? [] : [{ key: 'kcal', value: nu?.kcal, unit: '', name: 'kcal', color: MACRO_COLORS.kcal }]),
    { key: 'p', value: nu?.protein, unit: ' g', name: t('nutr_protein'), color: MACRO_COLORS.protein },
    // Ausgeschrieben nur, wo es passt: bei drei Kacheln (kcal ausgeblendet).
    { key: 'c', value: nu?.carbs, unit: ' g', name: t('nutr_carbs_short'), long: compact && hideKcal ? t('nutr_carbs') : undefined, color: MACRO_COLORS.carbs },
    { key: 'f', value: nu?.fat, unit: ' g', name: t('nutr_fat'), color: MACRO_COLORS.fat },
  ]
  return (
    <div className={`grid ${compact ? 'gap-1.5' : 'gap-2'} ${cells.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`} aria-live="polite">
      {cells.map(c => (
        <div key={c.key} className={`min-w-0 bg-[var(--lg-surface-2)] px-1 text-center ${compact ? 'rounded-[12px] py-1.5' : 'rounded-[14px] py-2.5'}`}>
          <div className={`${compact ? 'text-[16px]' : 'text-[17px]'} font-semibold tabular-nums text-[var(--lg-text)]`}>{c.value == null ? '–' : `${Math.round(c.value)}${c.unit}`}</div>
          <div className={`mt-0.5 flex items-center justify-center gap-1 ${compact ? 'text-[11px]' : 'text-[12px]'} leading-tight ${MUTED}`}>
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
            {'long' in c && c.long
              ? <><span className="truncate max-[359px]:hidden">{c.long}</span><span className="hidden truncate max-[359px]:inline">{c.name}</span></>
              : <span className="truncate">{c.name}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
