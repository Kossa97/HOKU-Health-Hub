import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FoodUnit, Per100 } from '../lib/nutrition'
import { MAX_MINUS, MAX_PLUS, type ScoreLevel, nutritionScore, scoreLevel, scoreParts, scoreTone } from '../lib/rating'
import { MUTED, SCORE_COLOR as TONE_COLOR } from '../styles'

const LEVELS: ScoreLevel[] = [1, 2, 3, 4, 5]
const VERDICT = { good: 'nutr_score_good', mid: 'nutr_score_mid', low: 'nutr_score_low' } as const

/**
 * Was die Nährwert-Punkte bedeuten — an der Stelle des Formulars, mit „Zurück“.
 * Oben die Stufe auf der Skala, darunter, was Punkte bringt und was sie kostet (je 100 g/ml).
 */
export function ScoreInfo({ per100, unit, name, onBack }: { per100: Per100; unit: FoodUnit; name: string; onBack: () => void }) {
  const { t, i18n } = useTranslation()
  const score = nutritionScore(per100, unit)
  const parts = scoreParts(per100, unit)
  if (score == null || !parts) return null
  const level = scoreLevel(score)
  const tone = scoreTone(level)
  const num = (n: number | null, digits = 1) => (n == null ? '–' : n.toLocaleString(i18n.language?.startsWith('de') ? 'de-DE' : 'en-US', { maximumFractionDigits: digits }))
  const plus = [
    { key: 'p', label: t('nutr_protein'), amount: `${num(per100.protein)} g`, value: parts.proteinCounts ? parts.protein : 0, off: !parts.proteinCounts },
    { key: 'fi', label: t('nutr_f_fiber'), amount: `${num(per100.fiber)} g`, value: parts.fiber, off: false },
  ]
  const minus = [
    { key: 'e', label: t('nutr_score_energy'), amount: `${num(per100.kcal, 0)} kcal`, value: parts.energy },
    { key: 's', label: t('nutr_score_sugar'), amount: `${num(per100.sugar)} g`, value: parts.sugar },
    { key: 'sf', label: t('nutr_score_satfat'), amount: `${num(per100.satFat)} g`, value: parts.satFat },
    { key: 'sa', label: t('nutr_f_salt'), amount: `${num(per100.salt, 2)} g`, value: parts.salt },
  ]
  const bar = (key: string, label: string, amount: string, value: number, max: number, color: string, note?: string) => (
    <li key={key} className="flex items-center gap-2 text-[14px] text-[var(--lg-text)]">
      <span className="w-[46%] min-w-0 shrink-0 leading-tight">{label} <span className={`text-[12px] tabular-nums ${MUTED}`}>{amount}</span></span>
      <span aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--lg-fill)]">
        <span className="block h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
      <span className={`w-[4.5rem] shrink-0 text-right text-[12px] tabular-nums ${MUTED}`}>{note ?? t('nutr_score_of', { value, max })}</span>
    </li>
  )

  return (
    <div>
      <div className="flex items-center">
        <button type="button" onClick={onBack} className="-ml-2 flex min-h-11 items-center gap-0.5 pr-2 text-[16px] text-[var(--accent)]">
          <ChevronLeft size={20} aria-hidden="true" />{t('back')}
        </button>
        <h2 id="nutr-score-title" className="min-w-0 flex-1 truncate pr-16 text-center text-[17px] font-semibold text-[var(--lg-text)]">{t('nutr_score_title')}</h2>
      </div>

      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-[34px] font-bold tabular-nums" style={{ color: TONE_COLOR[tone] }}>{level}</span>
        <span className={`text-[15px] ${MUTED}`}>{t('nutr_score_of_five')} · {t(VERDICT[tone])}</span>
      </p>
      <p className={`text-[13px] ${MUTED}`}>{t('nutr_score_basis', { name, unit })}</p>

      <div className="mt-3" role="img" aria-label={t('nutr_score_level_aria', { level })}>
        <div className="grid grid-cols-5 gap-1">
          {LEVELS.map(n => (
            <span key={n} className={`grid h-7 place-items-center rounded-[8px] text-[13px] font-bold ${n === level ? 'text-black outline outline-2 outline-offset-1 outline-[var(--lg-text)]' : 'text-black/60 opacity-35'}`}
              style={{ background: TONE_COLOR[scoreTone(n)] }}>{n}</span>
          ))}
        </div>
        <div className={`mt-1 flex justify-between text-[12px] ${MUTED}`}>
          <span>{t('nutr_score_low')}</span><span>{t('nutr_score_good')}</span>
        </div>
      </div>

      <h3 className="mt-4 text-[13px] font-bold text-[var(--lg-good-text)]">{t('nutr_score_plus')}</h3>
      <ul className="mt-1.5 space-y-1.5">
        {plus.map(r => bar(r.key, r.label, r.amount, r.value, MAX_PLUS, 'var(--lg-good-text)', r.off ? t('nutr_score_protein_off') : undefined))}
      </ul>
      <h3 className="mt-3 text-[13px] font-bold" style={{ color: TONE_COLOR.low }}>{t('nutr_score_minus')}</h3>
      <ul className="mt-1.5 space-y-1.5">
        {minus.map(r => bar(r.key, r.label, r.amount, r.value, MAX_MINUS, TONE_COLOR.low))}
      </ul>

      <p className={`mt-3 text-[12px] leading-snug ${MUTED}`}>{t('nutr_score_note')}</p>
    </div>
  )
}
