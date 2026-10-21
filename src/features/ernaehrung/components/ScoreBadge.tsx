import { useTranslation } from 'react-i18next'
import type { FoodUnit, Per100 } from '../lib/nutrition'
import { formatScore, nutritionScore, scoreOutOf5, scoreTone } from '../lib/rating'
import { SCORE_COLOR } from '../styles'

/**
 * Nährwert-Punkte als „4,8 /5“, farbig nach Bereich. Ohne genug Angaben steht nichts da.
 * `unit` ml = Getränk (eigene Schwellen). `size="lg"` für Kopfzeilen (Portion, Editor).
 */
export function ScoreBadge({ per100, unit, size = 'sm' }: { per100: Per100 | null; unit: FoodUnit; size?: 'sm' | 'lg' }) {
  const { t, i18n } = useTranslation()
  const score = per100 ? nutritionScore(per100, unit) : null
  if (score == null) return null
  const score5 = scoreOutOf5(score)
  const text = formatScore(score5, i18n.language ?? 'de')
  return (
    <span role="img" aria-label={t('nutr_score_level_aria', { level: text })} title={t('nutr_score_title')}
      className={`inline-flex shrink-0 items-baseline justify-center gap-px rounded-full bg-[var(--lg-fill)] font-bold tabular-nums ${size === 'lg'
        ? 'min-w-[52px] px-2.5 py-0.5 text-[15px]'
        : 'min-w-[40px] px-1.5 py-px text-[12px]'}`}
      style={{ color: SCORE_COLOR[scoreTone(score5)] }}>
      {text}<span aria-hidden="true" className={`font-semibold text-[var(--lg-text-3)] ${size === 'lg' ? 'text-[11px]' : 'text-[9px]'}`}>/5</span>
    </span>
  )
}
