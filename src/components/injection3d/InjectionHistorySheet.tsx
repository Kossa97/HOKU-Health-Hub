import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { AlertCircle, Eye, EyeOff, History, LocateFixed, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { methodLabel } from '../../lib/intakeMethods'
import {
  filterInjectionHistory,
  formatInjectionSite,
  hasExactInjectionPosition,
  isDoseConfirmationOpen,
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
          <p className="py-5 text-center text-[15px] text-[var(--lg-text-3)]">{t('injection_history_empty', { defaultValue: 'Keine Injektionen in diesem Zeitraum.' })}</p>
        )}
        {groups.map(group => (
          <div key={group.label}>
            <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.02em] text-[var(--lg-text-3)]">{group.label}</p>
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
                  <article key={log.id} className={`rounded-[20px] p-3 ${confirmationOpen ? 'bg-[color-mix(in_srgb,var(--lg-warn)_12%,transparent)]' : 'bg-[var(--lg-surface-2)]'}`}>
                    <div className="flex items-start gap-2.5">
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          aria-label={String(pinLabel)}
                          title={String(pinLabel)}
                          onClick={() => onToggleLog(log.id)}
                          className={`lg-icon-btn transition-colors ${visible ? 'bg-[rgba(0,204,245,0.18)] !text-[var(--lg-accent-text)]' : 'bg-[var(--lg-fill)] !text-[var(--lg-text-3)]'}`}
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
                          className="lg-icon-btn bg-[var(--lg-fill)] !text-[var(--lg-text-2)] aria-disabled:opacity-30"
                        >
                          <LocateFixed size={16} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-semibold text-[var(--lg-text)]">{substance}</p>
                        <p className="mt-0.5 text-[13px] leading-5 text-[var(--lg-text-2)]">{formatInjectionSite(log)}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--lg-text-3)]">{metadata}</p>
                        {confirmationOpen && (
                          <p className="lg-tag mt-2" data-tone="warn">
                            <AlertCircle size={12} aria-hidden="true" /> {t('injection_confirmation_open', { defaultValue: 'Einnahmebestätigung offen' })}
                          </p>
                        )}
                      </div>
                      {onEditLog && (
                        <button
                          type="button"
                          aria-label={String(t('injection_edit_action', { substance, defaultValue: '{{substance}} bearbeiten' }))}
                          onClick={() => onEditLog(log)}
                          className="lg-icon-btn shrink-0 bg-[var(--lg-fill)] !text-[var(--lg-text-2)]"
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {log.notes?.trim() && (
                      <p className="mt-2 border-t border-[var(--lg-separator)] pt-2 text-[13px] leading-5 text-[var(--lg-text-2)]">
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
        className="h-9 rounded-full bg-[var(--lg-fill)] px-3 text-[13px] font-semibold text-[var(--lg-text)] outline-none"
        value={historyDays}
        onChange={event => {
          const value = event.target.value
          onHistoryDaysChange(value === 'all' ? 'all' : Number(value) as InjectionHistoryDays)
        }}
      >
        {[7, 14, 30, 60, 90].map(days => (
          <option key={days} value={days}>{t('injection_history_days', { days, defaultValue: String(days) + ' Tage' })}</option>
        ))}
        <option value="all">{t('injection_history_all', { defaultValue: 'Alle' })}</option>
      </select>
    </label>
  )
}
