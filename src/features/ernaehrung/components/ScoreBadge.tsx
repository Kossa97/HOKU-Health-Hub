import { useTranslation } from 'react-i18next'
import type { FoodUnit, Per100 } from '../lib/nutrition'
import { formatScore, nutritionScore, scoreTone } from '../lib/rating'

const TONE = {
  good: 'text-[var(--lg-good-text)]',
  mid: 'text-[#ffd60a]',
  low: 'text-[#ff9f0a]',
} as const

/**
 * Nährwert-Punkte als kleines Abzeichen („9,7"). Ohne genug Angaben steht nichts da.
 * `unit` ml = Getränk (eigene Schwellen). `size="lg"` für Kopfzeilen (Portion, Editor).
 */
export function ScoreBadge({ per100, unit, size = 'sm' }: { per100: Per100 | null; unit: FoodUnit; size?: 'sm' | 'lg' }) {
  const { t, i18n } = useTranslation()
  const score = per100 ? nutritionScore(per100, unit) : null
  if (score == null) return null
  const text = formatScore(score, i18n.language ?? 'de')
  return (
    <span role="img" aria-label={t('nutr_score_aria', { score: text })} title={t('nutr_score_label')}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--lg-fill)] font-bold tabular-nums ${TONE[scoreTone(score)]} ${size === 'lg'
        ? 'min-w-[44px] px-2.5 py-0.5 text-[15px]'
        : 'min-w-[34px] px-1.5 py-px text-[12px]'}`}>
      {text}
    </span>
  )
}
