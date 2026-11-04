import { type ReactNode, useState } from 'react'
import { Dumbbell, Flame, Heart, Pencil, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Sheet } from './Panel'
import { SheetClose } from '../../../components/ui/SheetClose'
import { isIOS, isNative, requestPermissions } from '../../../lib/health'
import { type ActivityDay, type ActivityLog, type ActivityTotal, estimateActiveKcal } from '../lib/activity'
import { type Goals, parseAmount } from '../lib/nutrition'
import { DIM, ERROR_TEXT, MUTED } from '../styles'

/**
 * „Aktivität“ eines Tages: woher die Bewegung kommt, selbst eintragen, und was davon
 * aufs Tagesziel kommt. Geöffnet über das Flammen-Feld neben der Zahl oder „Dein Tag“.
 */
export function ActivitySheet({ dayLabel, day, error, total, bonus, goals, weightKg, onAdd, onRemove, onReload, onEditGoals, onClose }: {
  dayLabel: string
  day: ActivityDay | null
  error: boolean
  total: ActivityTotal
  bonus: number
  goals: Goals
  weightKg: number | null
  onAdd: (log: Omit<ActivityLog, 'id'>) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onReload: () => void
  onEditGoals: () => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [form, setForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const on = (s: 'health' | 'training' | 'manual') => goals.activitySources.includes(s)
  const time = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  const connect = async () => {
    setBusy(true)
    try {
      const r = await requestPermissions()
      if (!r.granted) toast.error(t('nutr_move_health_denied'))
      onReload()
    } finally { setBusy(false) }
  }

  const remove = async (log: ActivityLog) => {
    setBusy(true)
    try { await onRemove(log.id) } catch { toast.error(t('nutr_error')) } finally { setBusy(false) }
  }

  return (
    <Sheet labelledBy="nutr-move-sheet-title" busy={busy} onClose={onClose} data-nutr-activity>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="nutr-move-sheet-title" className="lg-title2">{t('nutr_move_sheet_title')}</h2>
          <p className={`mt-0.5 text-[13px] ${MUTED}`}>{dayLabel}</p>
        </div>
        <SheetClose onClick={onClose} disabled={busy} />
      </div>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-[40px] font-bold leading-none tabular-nums text-[var(--lg-text)]">{total.kcal}</span>
        <span className={`text-[16px] ${MUTED}`}>{t('nutr_move_kcal_active')}</span>
      </p>

      {error && <p role="alert" className={`mt-3 ${ERROR_TEXT}`}>{t('nutr_move_error')}</p>}

      <section aria-label={t('nutr_move_sources')} className="mt-4 overflow-hidden rounded-[18px] bg-[var(--lg-surface-2)]">
        <ul>
          {on('health') && (
            <Row icon={<Heart size={16} fill="#fff" />} tone="#ff375f" iconColor="#fff" title={t('nutr_move_health_row')}
              sub={day?.healthKcal == null ? t('nutr_move_health_web') : day.healthKcal > 0 ? '' : t('nutr_move_health_none')}
              value={day?.healthKcal ? String(day.healthKcal) : '–'}
              below={isNative && isIOS && day && !day.healthKcal ? (
                <button type="button" onClick={connect} disabled={busy} className="mt-1 min-h-9 text-[15px] font-semibold text-[var(--lg-accent-text)]">
                  {t('nutr_move_health_connect')}
                </button>
              ) : null} />
          )}
          {on('training') && day?.trainings.map(tr => (
            <Row key={tr.id} icon={<Dumbbell size={16} />} title={`${tr.title || t('nutr_move_training_default')} · ${time(tr.startedAt)}`}
              sub={[total.trainingsInHealth ? t('nutr_move_in_health') : '', tr.estimated ? t('nutr_move_estimated') : ''].filter(Boolean).join(' · ')}
              value={tr.kcal == null ? '–' : String(tr.kcal)} muted={total.trainingsInHealth} />
          ))}
          {on('manual') && day?.logs.map(l => (
            <Row key={l.id} icon={<Pencil size={15} />} tone="color-mix(in srgb, var(--lg-warn) 22%, transparent)" iconColor="var(--lg-warn)"
              title={l.minutes ? `${l.label} · ${l.minutes} min` : l.label} sub={t('nutr_move_manual_row')} value={String(l.kcal)}
              end={(
                <button type="button" onClick={() => void remove(l)} disabled={busy} aria-label={t('nutr_move_delete', { label: l.label })}
                  className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--lg-text-3)]">
                  <X size={16} aria-hidden="true" />
                </button>
              )} />
          ))}
        </ul>
        <p className={`px-4 py-3 text-[12px] leading-snug ${MUTED}`}>{t('nutr_move_once')}</p>
      </section>

      {on('manual') && (form
        ? <AddForm weightKg={weightKg} busy={busy} onCancel={() => setForm(false)}
            onSave={async log => {
              setBusy(true)
              try { await onAdd(log); setForm(false); toast.success(t('nutr_added')) } catch { toast.error(t('nutr_error')) } finally { setBusy(false) }
            }} />
        : <button type="button" onClick={() => setForm(true)} className="lg-gray-btn mt-3 w-full !min-h-12 gap-2">
            <Plus size={16} aria-hidden="true" />{t('nutr_move_add')}
          </button>)}

      <section className="mt-4 rounded-[18px] bg-[color-mix(in_srgb,var(--lg-warn)_12%,transparent)] p-4">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--lg-text)]">
          <Flame size={15} aria-hidden="true" className="shrink-0 text-[var(--lg-warn)]" />
          {goals.activityMode === 'budget'
            ? t(`nutr_move_counted_budget_${goals.activityShare}`, { kcal: bonus })
            : t('nutr_move_counted_deficit', { goal: goals.kcal })}
        </p>
        <p className={`mt-1.5 text-[13px] leading-snug ${DIM}`}>
          {goals.activityMode === 'budget' ? t(`nutr_move_share_${goals.activityShare}_hint`) : t('nutr_move_mode_deficit_hint')}
        </p>
        <button type="button" onClick={onEditGoals} className="mt-1 min-h-9 text-[15px] font-semibold text-[var(--lg-accent-text)]">
          {t('nutr_move_edit')} ›
        </button>
      </section>
    </Sheet>
  )
}

function Row({ icon, tone = 'var(--lg-fill)', iconColor = 'var(--lg-text)', title, sub, value, muted = false, below, end }: {
  icon: ReactNode
  tone?: string
  iconColor?: string
  title: string
  sub: string
  value: string
  muted?: boolean
  /** Unter dem Titel (z. B. „Apple Health verbinden“). */
  below?: ReactNode
  /** Rechts neben dem Wert (z. B. Löschen). */
  end?: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 border-b border-[var(--lg-separator)] px-4 py-3">
      <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]" style={{ background: tone, color: iconColor }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[var(--lg-text)]">{title}</span>
        {sub && <span className={`mt-0.5 block text-[12px] leading-snug ${MUTED}`}>{sub}</span>}
        {below}
      </span>
      <span className={`shrink-0 text-[15px] tabular-nums ${muted ? MUTED : 'font-semibold text-[var(--lg-text)]'}`}>{value}</span>
      {end}
    </li>
  )
}

function AddForm({ weightKg, busy, onSave, onCancel }: {
  weightKg: number | null
  busy: boolean
  onSave: (log: Omit<ActivityLog, 'id'>) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [label, setLabel] = useState('')
  const [minutes, setMinutes] = useState('')
  const [kcal, setKcal] = useState('')
  const min = minutes.trim() ? parseAmount(minutes) : null
  const typed = kcal.trim() ? parseAmount(kcal) : null
  const minOk = min === null || (Number.isInteger(min) && min >= 1 && min <= 1440)
  const estimate = min !== null && minOk ? estimateActiveKcal(min, weightKg) : null
  const value = typed ?? estimate
  const kcalOk = value !== null && Number.isFinite(value) && Math.round(value) >= 1 && Math.round(value) <= 5000
  const valid = label.trim().length > 0 && minOk && kcalOk

  return (
    <form className="mt-3 rounded-[18px] bg-[var(--lg-surface-2)] p-4"
      onSubmit={e => { e.preventDefault(); if (valid && !busy) void onSave({ label: label.trim(), minutes: min, kcal: Math.round(value!) }) }}>
      <label htmlFor="nutr-move-label" className="label">{t('nutr_move_f_label')}</label>
      <input id="nutr-move-label" className="input" value={label} maxLength={60} enterKeyHint="next"
        placeholder={t('nutr_move_f_label_placeholder')} onChange={e => setLabel(e.target.value)} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="nutr-move-min" className="label">{t('nutr_move_f_minutes')}</label>
          <input id="nutr-move-min" className="input" inputMode="numeric" value={minutes} aria-invalid={!minOk} onChange={e => setMinutes(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="nutr-move-kcal" className="label">{t('nutr_move_f_kcal')}</label>
          <input id="nutr-move-kcal" className="input" inputMode="numeric" value={kcal} placeholder={estimate ? String(estimate) : ''}
            aria-invalid={typed !== null && !kcalOk} onChange={e => setKcal(e.target.value)} />
        </div>
      </div>
      <p className={`mt-2 text-[12px] leading-snug ${MUTED}`}>
        {weightKg ? t('nutr_move_f_estimate') : t('nutr_move_f_estimate_none')}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" data-quiet className="lg-gray-btn flex-1" disabled={busy} onClick={onCancel}>{t('cancel')}</button>
        <button type="submit" className="lg-btn lg-btn-primary flex-1 !px-4" disabled={!valid || busy}>{t('nutr_move_f_save')}</button>
      </div>
    </form>
  )
}
