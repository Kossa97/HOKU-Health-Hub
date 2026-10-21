import { useTranslation } from 'react-i18next'
import type { FoodUnit, Per100 } from '../lib/nutrition'
import { nutritionScore, scoreLevel, scoreTone } from '../lib/rating'
import { SCORE_COLOR as TONE_COLOR } from '../styles'

/**
 * Nährwert-Punkte als fünf Punkte (Stufe 1–5). Ohne genug Angaben steht nichts da.
 * `unit` ml = Getränk (eigene Schwellen). `size="lg"` für Kopfzeilen (Portion, Editor).
 */
export function ScoreBadge({ per100, unit, size = 'sm' }: { per100: Per100 | null; unit: FoodUnit; size?: 'sm' | 'lg' }) {
  const { t } = useTranslation()
  const score = per100 ? nutritionScore(per100, unit) : null
  if (score == null) return null
  const level = scoreLevel(score)
  const color = TONE_COLOR[scoreTone(level)]
  const dot = size === 'lg' ? 'h-[7px] w-[7px]' : 'h-[5px] w-[5px]'
  return (
    <span role="img" aria-label={t('nutr_score_level_aria', { level })} title={t('nutr_score_title')}
      className={`inline-flex shrink-0 items-center rounded-full bg-[var(--lg-fill)] ${size === 'lg' ? 'gap-[3px] px-2 py-[5px]' : 'gap-[2px] px-1.5 py-[4px]'}`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} aria-hidden="true" className={`${dot} rounded-full`}
          style={{ background: n <= level ? color : 'color-mix(in srgb, var(--lg-text) 18%, transparent)' }} />
      ))}
    </span>
  )
}
