import { useTranslation } from 'react-i18next'
import { type Goals, type Nutrients, goalBand, share } from '../lib/nutrition'
import { CARD, DIM, MACRO_COLORS, MUTED } from '../styles'

function Ring({ value, goal, color, center, caption, ariaLabel }: {
  value: number; goal: number; color: string; center: string; caption: string; ariaLabel: string
}) {
  const r = 52
  const c = 2 * Math.PI * r
  const p = Math.min(share(value, goal), 1)
  return (
    <div className="relative grid h-[132px] w-[132px] shrink-0 place-items-center" role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" stroke="var(--lg-fill)" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round" stroke={color}
          strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset 400ms cubic-bezier(0.23, 1, 0.32, 1)' }} />
      </svg>
      <div className="text-center">
        <div className="text-[28px] font-bold leading-none tabular-nums text-[var(--lg-text)]">{center}</div>
        <div className={`mt-1 text-[12px] font-medium ${MUTED}`}>{caption}</div>
      </div>
    </div>
  )
}

/** Eine Makro-Spalte: Name, Balken, Wert — untereinander, damit es auch auf schmalen Geräten passt. */
function MacroColumn({ name, value, goal, color }: { name: string; value: number; goal: number; color: string }) {
  return (
    <div className="min-w-0 text-center">
      <div className={`truncate text-[13px] font-medium ${DIM}`}>{name}</div>
      <div className="mx-auto mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--lg-fill)]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, share(value, goal) * 100)}%`, background: color, transition: 'width 400ms cubic-bezier(0.23, 1, 0.32, 1)' }} />
      </div>
      <div className={`mt-1.5 whitespace-nowrap text-[13px] tabular-nums ${MUTED}`}>
        <b className="font-semibold text-[var(--lg-text)]">{Math.round(value)}</b> / {goal} g
      </div>
    </div>
  )
}

export function DaySummary({ total, goals }: { total: Nutrients; goals: Goals }) {
  const { t } = useTranslation()
  const kcal = Math.round(total.kcal)
  const protein = Math.round(total.protein)

  // Kalorien ausgeblendet: Eiweiß wird die Hauptzahl. Keine Kalorienzahl irgendwo.
  const ring = goals.hideKcal
    ? {
        value: total.protein, goal: goals.proteinG, color: MACRO_COLORS.protein,
        center: `${protein}`, caption: t('nutr_protein_of', { goal: goals.proteinG }),
        aria: t('nutr_protein_aria', { value: protein, goal: goals.proteinG }),
      }
    : (() => {
        const band = goalBand(total.kcal, goals.kcal)
        const left = goals.kcal - kcal
        return {
          value: total.kcal, goal: goals.kcal, color: MACRO_COLORS.kcal,
          center: `${Math.abs(left)}`,
          caption: band === 'over' ? t('nutr_kcal_above') : t('nutr_kcal_left'),
          aria: t('nutr_kcal_aria', { value: kcal, goal: goals.kcal }),
        }
      })()

  return (
    <section aria-label={t('nutr_summary')} className={`${CARD} p-4`}>
      <div className="flex items-center justify-center gap-5">
        <Ring value={ring.value} goal={ring.goal} color={ring.color} center={ring.center} caption={ring.caption} ariaLabel={ring.aria} />
        {!goals.hideKcal && (
          <div className="min-w-0">
            <p className={`text-[13px] font-medium ${MUTED}`}>{t('nutr_eaten')}</p>
            <p className="whitespace-nowrap text-[22px] font-bold leading-tight tabular-nums text-[var(--lg-text)]">{kcal}</p>
            <p className={`whitespace-nowrap text-[13px] tabular-nums ${MUTED}`}>{t('nutr_of_goal', { goal: goals.kcal })}</p>
          </div>
        )}
      </div>
      <div className={`mt-4 grid gap-4 ${goals.hideKcal ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {!goals.hideKcal && <MacroColumn name={t('nutr_protein')} value={total.protein} goal={goals.proteinG} color={MACRO_COLORS.protein} />}
        <MacroColumn name={t('nutr_carbs_short')} value={total.carbs} goal={goals.carbsG} color={MACRO_COLORS.carbs} />
        <MacroColumn name={t('nutr_fat')} value={total.fat} goal={goals.fatG} color={MACRO_COLORS.fat} />
      </div>
    </section>
  )
}
