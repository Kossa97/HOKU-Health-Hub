import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { AlertCircle, Eye, EyeOff, History, LocateFixed, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { methodLabel } from '../../lib/intakeMethods'
import {
  filterInjectionHistory,
  formatInjectionSite,
  hasExactInjectionPosition,
  isDoseConfirmationOpen,
  INJECTION_HISTORY_DAY_OPTIONS,
  type InjectionHistoryDays,
} from '../../lib/injectionHistory'
import type { InjectionLog3D } from '../../lib/injectionLogTypes'
import { denyProps } from '../../lib/denyFeedback'

export function InjectionHistorySheet({
  logs,
  historyDays,
  visibleLogIds,
  onHistoryDaysChange,
  onToggleLog,
  onFocusLog,
  onEditLog,
  embedded = false,
}: {
  logs: InjectionLog3D[]
  historyDays: InjectionHistoryDays
  visibleLogIds: Set<string>
  onHistoryDaysChange: (days: InjectionHistoryDays) => void
  onToggleLog: (id: string) => void
  onFocusLog: (log: InjectionLog3D) => void
  onEditLog?: (log: InjectionLog3D) => void
  embedded?: boolean
}) {
  const { t } = useTranslation()
  const groupLabel = (date: Date) => {
    if (isToday(date)) return String(t('injection_history_today', { defaultValue: 'Heute' }))
    if (isYesterday(date)) return String(t('injection_history_yesterday', { defaultValue: 'Gestern' }))
    return format(date, 'dd.MM.yyyy')
  }

  const filteredLogs = filterInjectionHistory(logs, new Date(), historyDays)
  const groups = filteredLogs.reduce<Array<{ label: string; logs: InjectionLog3D[] }>>((acc, log) => {
    const label = groupLabel(parseISO(log.logged_at))
    const group = acc.find(item => item.label === label)
    if (group) group.logs.push(log)
    else acc.push({ label, logs: [log] })
    return acc
  }, [])

  return (
    <section className={embedded ? 'space-y-3' : 'rounded-3xl border border-white/10 p-4'} style={embedded ? undefined : { background: 'var(--surface)' }}>
      {!embedded && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />}
      {!embedded && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History size={16} color="var(--accent)" aria-hidden="true" />
            <h2 className="text-sm font-black text-white">{t('injection_history', { defaultValue: 'Historie' })}</h2>
          </div>
          <HistoryDaysSelect historyDays={historyDays} onHistoryDaysChange={onHistoryDaysChange} />
        </div>
      )}

      <div className={embedded ? 'space-y-3' : 'max-h-[48vh] space-y-3 overflow-y-auto pr-1'}>
        {groups.length === 0 && (
          <p className="py-5 text-center text-sm text-slate-500">{t('injection_history_empty', { defaultValue: 'Keine Injektionen in diesem Zeitraum.' })}</p>
        )}
        {groups.map(group => (
          <div key={group.label}>
            <p className="mb-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
            <div className="space-y-2">
              {group.logs.map(log => {
                const visible = visibleLogIds.has(log.id)
                const exactPosition = hasExactInjectionPosition(log)
                const substance = log.stack_item_name ?? log.substance_label ?? t('injection_default_label', { defaultValue: 'Injektion' })
                const dose = [log.dose, log.unit].filter(value => value != null && value !== '').join(' ')
                const metadata = [format(parseISO(log.logged_at), 'HH:mm'), dose, methodLabel(t, log.method)].filter(Boolean).join(' - ')
                const confirmationOpen = isDoseConfirmationOpen(log)
                const pinLabel = visible
                  ? t('injection_pin_hide', { defaultValue: 'Pin ausblenden' })
                  : t('injection_pin_show', { defaultValue: 'Pin dauerhaft anzeigen' })

                return (
                  <article key={log.id} className={`rounded-2xl border p-3 ${confirmationOpen ? 'border-amber-400/30 bg-amber-400/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
                    <div className="flex items-start gap-2.5">
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          aria-label={String(pinLabel)}
                          title={String(pinLabel)}
                          onClick={() => onToggleLog(log.id)}
                          className={`grid h-11 w-11 place-items-center rounded-xl border ${visible ? 'border-sky-400/40 bg-sky-400/15 text-sky-300' : 'border-white/10 text-slate-500'}`}
                        >
                          {visible ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
                        </button>
                        <button
                          type="button"
                          aria-label={String(t('injection_focus_site', { defaultValue: 'Kamera zur Injektionsstelle bewegen' }))}
                          title={String(exactPosition
                            ? t('injection_focus_site_title', { defaultValue: 'Zur Injektionsstelle' })
                            : t('injection_focus_site_unavailable', { defaultValue: 'Keine genaue Position gespeichert' }))}
                          {...denyProps(!exactPosition, String(t('injection_focus_site_unavailable', { defaultValue: 'Keine genaue Position gespeichert' })))}
                          onClick={() => { if (exactPosition) onFocusLog(log) }}
                          className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-slate-400 aria-disabled:opacity-30"
                        >
                          <LocateFixed size={16} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">{substance}</p>
                        <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-300">{formatInjectionSite(log)}</p>
                        <p className="mt-1 text-[0.68rem] text-slate-500">{metadata}</p>
                        {confirmationOpen && (
                          <p className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[0.68rem] font-bold text-amber-300">
                            <AlertCircle size={12} aria-hidden="true" /> {t('injection_confirmation_open', { defaultValue: 'Einnahmebestätigung offen' })}
                          </p>
                        )}
                      </div>
                      {onEditLog && (
                        <button
                          type="button"
                          aria-label={String(t('injection_edit_action', { substance, defaultValue: '{{substance}} bearbeiten' }))}
                          onClick={() => onEditLog(log)}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-400"
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {log.notes?.trim() && (
                      <p className="mt-2 border-t border-white/10 pt-2 text-xs leading-5 text-slate-400">
                        {t('injection_note_prefix', { defaultValue: 'Notiz' })}: {log.notes.trim()}
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function HistoryDaysSelect({
  historyDays,
  onHistoryDaysChange,
  className = '',
}: {
  historyDays: InjectionHistoryDays
  onHistoryDaysChange: (days: InjectionHistoryDays) => void
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <label className={className}>
      <span className="sr-only">{t('injection_history_period', { defaultValue: 'Historienzeitraum' })}</span>
      <select
        className="h-10 rounded-xl border border-white/10 bg-black/20 px-2.5 text-xs font-bold text-slate-300 outline-none"
        value={historyDays}
        onChange={event => {
          const value = event.target.value
          onHistoryDaysChange(value === 'all' ? 'all' : Number(value) as InjectionHistoryDays)
        }}
      >
        {INJECTION_HISTORY_DAY_OPTIONS.map(days => (
          <option key={days} value={days}>{t('injection_history_days', { days, defaultValue: String(days) + ' Tage' })}</option>
        ))}
        <option value="all">{t('injection_history_all', { defaultValue: 'Alle' })}</option>
      </select>
    </label>
  )
}
