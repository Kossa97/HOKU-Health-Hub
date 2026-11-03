import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Panel'
import { GoalsForm } from './GoalsForm'
import { SheetClose } from '../../../components/ui/SheetClose'
import type { Goals, Nutrients } from '../lib/nutrition'
import { MACRO_COLORS, MACRO_NAME, MUTED } from '../styles'

export type DayTab = 'today' | 'goals'

/**
 * „Dein Tag“: alles zum Tag an einer Stelle, geöffnet über den Knopf oben rechts
 * oder einen Tipp auf die Kugel. „Heute“ zeigt, was man hat, „Ziele“, was man
 * will — beide in derselben Reihenfolge, damit man jeden Wert an derselben
 * Stelle wiederfindet.
 */
export function DayPanel({ tab, onTab, dayLabel, total, waterMl, goals, userId, today, busy, onSaveGoals, onClose }: {
  tab: DayTab
  onTab: (tab: DayTab) => void
  /** „Heute, 3. Nov.“ — der Tag, der gerade oben steht. */
  dayLabel: string
  total: Nutrients
  waterMl: number | null
  goals: Goals
  userId: string
  today: string
  busy: boolean
  onSaveGoals: (g: Goals) => Promise<boolean> | void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const tabs: DayTab[] = ['today', 'goals']
  // „Abbrechen“ verwirft die Eingaben: das Formular neu anlegen.
  const [goalsKey, setGoalsKey] = useState(0)
  return (
    <Sheet labelledBy="nutr-day-title" busy={busy} onClose={onClose} data-nutr-day>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="nutr-day-title" className="lg-title2">{t('nutr_day_title')}</h2>
          <p className={`mt-0.5 text-[13px] ${MUTED}`}>{dayLabel}</p>
        </div>
        <SheetClose onClick={onClose} disabled={busy} />
      </div>

      <div role="tablist" aria-label={t('nutr_day_title')} className="mt-3 grid grid-cols-2 rounded-full bg-[var(--lg-fill)] p-0.5">
        {tabs.map(id => (
          <button key={id} type="button" role="tab" id={`nutr-day-tab-${id}`} aria-selected={tab === id} aria-controls={`nutr-day-panel-${id}`}
            disabled={busy} onClick={() => onTab(id)}
            className={`flex min-h-9 items-center justify-center rounded-full text-[15px] font-semibold transition-colors ${tab === id
              ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]'
              : 'text-[var(--lg-text-2)]'}`}>
            {t(id === 'today' ? 'nutr_today' : 'nutr_goals')}
          </button>
        ))}
      </div>

      {/* Beide Reiter bleiben stehen (der inaktive verborgen): ungespeicherte Ziele gehen beim Umschalten nicht verloren. */}
      <div role="tabpanel" id="nutr-day-panel-today" aria-labelledby="nutr-day-tab-today" hidden={tab !== 'today'}>
        <TodayView total={total} waterMl={waterMl} goals={goals} onEditGoals={() => onTab('goals')} />
      </div>
      <div role="tabpanel" id="nutr-day-panel-goals" aria-labelledby="nutr-day-tab-goals" hidden={tab !== 'goals'}>
        <GoalsForm key={goalsKey} userId={userId} today={today} current={goals} busy={busy} onSave={onSaveGoals} onCancel={() => { setGoalsKey(k => k + 1); onTab('today') }} />
      </div>
    </Sheet>
  )
}

function TodayView({ total, waterMl, goals, onEditGoals }: {
  total: Nutrients
  waterMl: number | null
  goals: Goals
  onEditGoals: () => void
}) {
  const { t } = useTranslation()
  // Ohne Tausenderpunkt, wie die Zahl unter der Kugel.
  const n = (v: number) => String(Math.round(v))
  // Kalorien ausgeblendet: Eiweiß ist die Hauptzahl (wie in der Kugel), ohne „übrig“.
  const hide = goals.hideKcal
  const value = hide ? total.protein : total.kcal
  const goal = hide ? goals.proteinG : goals.kcal
  const unit = hide ? 'g' : 'kcal'
  const rest = Math.round(goal - value)
  const macros = (['protein', 'carbs', 'fat'] as const).map(key => ({
    key, value: total[key], goal: key === 'protein' ? goals.proteinG : key === 'carbs' ? goals.carbsG : goals.fatG,
  }))

  return (
    <div className="mt-3 space-y-3">
      <section aria-labelledby="nutr-day-energy" className="rounded-[18px] bg-[var(--lg-surface-2)] p-4">
        <h3 id="nutr-day-energy" className="sr-only">{hide ? t('nutr_protein') : t('nutr_f_kcal')}</h3>
        <p className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-bold leading-none tabular-nums text-[var(--lg-text)]">{n(value)}</span>
          <span className={`text-[15px] tabular-nums ${MUTED}`}>{t('nutr_slash_goal', { goal: n(goal), unit })}</span>
        </p>
        <Bar value={value} goal={goal} color="var(--accent)" big />
        <div className="mt-2 flex items-center justify-between gap-3">
          {!hide
            ? <span className="text-[13px] tabular-nums text-[var(--lg-text-2)]">{rest >= 0 ? `${n(rest)} ${t('nutr_kcal_left')}` : `${n(-rest)} ${t('nutr_kcal_above')}`}</span>
            : <span />}
          <button type="button" onClick={onEditGoals} className="min-h-9 shrink-0 text-[15px] font-semibold text-[var(--lg-accent-text)]">
            {t('nutr_day_edit_goal')} ›
          </button>
        </div>
      </section>

      <section aria-labelledby="nutr-day-macros" className="rounded-[18px] bg-[var(--lg-surface-2)] px-4 py-1">
        <h3 id="nutr-day-macros" className="sr-only">{t('nutr_daypanel_macros')}</h3>
        <ul>
          {macros.map(m => (
            <li key={m.key} className="border-b border-[var(--lg-separator)] py-3 last:border-0">
              <div className="flex items-center gap-2 text-[15px]">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: MACRO_COLORS[m.key] }} />
                <span className="flex-1 text-[var(--lg-text)]">{t(MACRO_NAME[m.key])}</span>
                <span className="tabular-nums text-[var(--lg-text-2)]"><b className="font-semibold text-[var(--lg-text)]">{n(m.value)}</b> / {m.goal} g</span>
              </div>
              <Bar value={m.value} goal={m.goal} color={MACRO_COLORS[m.key]} />
            </li>
          ))}
        </ul>
      </section>

      {waterMl !== null && goals.waterMl > 0 && (
        <section aria-labelledby="nutr-day-water" className="rounded-[18px] bg-[var(--lg-surface-2)] px-4 py-3">
          <div className="flex items-center gap-2 text-[15px]">
            <h3 id="nutr-day-water" className="flex-1 font-normal text-[var(--lg-text)]">{t('nutr_water')}</h3>
            <span className="tabular-nums text-[var(--lg-text-2)]"><b className="font-semibold text-[var(--lg-text)]">{n(waterMl)}</b> / {n(goals.waterMl)} ml</span>
          </div>
          <Bar value={waterMl} goal={goals.waterMl} color="var(--accent)" />
        </section>
      )}
    </div>
  )
}

/** Fortschritt bis zum Ziel; darüber bleibt der Balken voll, ohne Wertung (kein Rot). */
function Bar({ value, goal, color, big = false }: { value: number; goal: number; color: string; big?: boolean }) {
  const p = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0
  return (
    <span aria-hidden="true" className={`mt-2 block overflow-hidden rounded-full bg-[var(--lg-fill)] ${big ? 'h-2' : 'h-1.5'}`}>
      <span className="block h-full rounded-full" style={{ width: `${p * 100}%`, background: color }} />
    </span>
  )
}
