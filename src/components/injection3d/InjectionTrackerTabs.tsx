import { format, parseISO } from 'date-fns'
import { CalendarClock, CheckCircle2, ClipboardList, History, Syringe, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { methodLabel } from '../../lib/intakeMethods'
import { type InjectionHistoryDays } from '../../lib/injectionHistory'
import type { OpenInjectionIntake } from '../../lib/injectionPersistence'
import type { InjectionTrackerTab } from '../../lib/injectionTrackerTabs'
import type { InjectionLog3D } from '../../lib/injectionLogTypes'
import {
  filterOpenInjectionIntakes,
  type IntakeHistoryDays,
} from '../../lib/openInjectionIntakeFilters'
import { HistoryDaysSelect, InjectionHistorySheet } from './InjectionHistorySheet'

const OPEN_DAYS_OPTIONS: IntakeHistoryDays[] = [0, 1, 7, 14]

export function InjectionTrackerTabs({
  logs,
  openIntakes,
  historyDays,
  visibleLogIds,
  onHistoryDaysChange,
  onToggleLog,
  onFocusLog,
  onEditLog,
  onSelectOpenIntake,
  onSheetOpenChange,
}: {
  logs: InjectionLog3D[]
  openIntakes: OpenInjectionIntake[]
  historyDays: InjectionHistoryDays
  visibleLogIds: Set<string>
  onHistoryDaysChange: (days: InjectionHistoryDays) => void
  onToggleLog: (id: string) => void
  onFocusLog: (log: InjectionLog3D) => void
  onEditLog?: (log: InjectionLog3D) => void
  onSelectOpenIntake: (intake: OpenInjectionIntake) => void
  onSheetOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [activeSheet, setActiveSheet] = useState<InjectionTrackerTab | null>(null)
  const [openCycleFilter, setOpenCycleFilter] = useState('all')
  const [openDaysFilter, setOpenDaysFilter] = useState<IntakeHistoryDays>(7)

  const labels: Record<InjectionTrackerTab, string> = {
    open: String(t('injection_tab_open', { defaultValue: 'Offene Einnahmen' })),
    history: String(t('injection_tab_history', { defaultValue: 'Historie' })),
  }

  const openCycleOptions = useMemo(() => Array.from(
    new Map(openIntakes.flatMap(intake => intake.cycleId ? [[
      intake.cycleId,
      { id: intake.cycleId, label: intake.cycleName || intake.stackItemName },
    ] as const] : [])).values(),
  ).sort((a, b) => a.label.localeCompare(b.label, 'de')), [openIntakes])

  const filteredOpenIntakes = useMemo(() => filterOpenInjectionIntakes(openIntakes, {
    cycleId: openCycleFilter,
    days: openDaysFilter,
    order: 'newest',
    status: 'open',
  }), [openCycleFilter, openDaysFilter, openIntakes])

  const openSheet = (sheet: InjectionTrackerTab) => setActiveSheet(sheet)
  const closeSheet = () => setActiveSheet(null)

  const selectOpenIntake = (intake: OpenInjectionIntake) => {
    onSelectOpenIntake(intake)
    closeSheet()
  }

  useEffect(() => {
    onSheetOpenChange(activeSheet !== null)
  }, [activeSheet, onSheetOpenChange])

  return (
    <>
      <div
        className="injection-floating-actions pointer-events-none absolute left-4 right-4 z-30 flex items-center justify-between gap-3"
        style={{ bottom: 'calc(14px + env(safe-area-inset-bottom))' }}
      >
        <FloatingActionButton
          icon={<ClipboardList size={18} aria-hidden="true" />}
          label={labels.open}
          active={activeSheet === 'open'}
          onClick={() => openSheet('open')}
        />
        <FloatingActionButton
          icon={<History size={18} aria-hidden="true" />}
          label={labels.history}
          active={activeSheet === 'history'}
          onClick={() => openSheet('history')}
        />
      </div>

      {activeSheet === 'open' && (
        <section
          data-app-modal
          data-app-back-dirty-on-interaction
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex min-h-dvh flex-col overflow-hidden overscroll-y-contain"
          style={{
            background: 'linear-gradient(180deg, rgba(7,11,24,0.96), var(--surface))',
            overscrollBehaviorY: 'contain',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="shrink-0 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={String(t('close', { defaultValue: 'Schließen' }))}
                onClick={closeSheet}
                data-app-back-close
                className="grid min-h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:text-white"
              >
                <X size={17} aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-black text-white">{labels.open}</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t('injection_open_fullscreen_hint', { defaultValue: 'Einnahme auswählen, danach die Stelle auf der 3D-Karte markieren und die Injektion mit vorausgefüllten Daten speichern.' })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="label">{t('injection_cycle_label', { defaultValue: 'Zyklus' })}</span>
                <select
                  className="input"
                  value={openCycleFilter}
                  onChange={event => setOpenCycleFilter(event.target.value)}
                >
                  <option value="all">{t('injection_all_cycles', { defaultValue: 'Alle Zyklen' })}</option>
                  {openCycleOptions.map(cycle => (
                    <option key={cycle.id} value={cycle.id}>{cycle.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">{t('injection_history_back', { defaultValue: 'Rückwirkend' })}</span>
                <select
                  className="input"
                  value={openDaysFilter}
                  onChange={event => setOpenDaysFilter(Number(event.target.value) as IntakeHistoryDays)}
                >
                  {OPEN_DAYS_OPTIONS.map(days => (
                    <option key={days} value={days}>{openDaysLabel(days, t)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3">
              <OpenIntakesTab openIntakes={filteredOpenIntakes} onSelectIntake={selectOpenIntake} />
            </div>
          </div>
        </section>
      )}

      {activeSheet === 'history' && (
        <section
          data-app-modal
          role="dialog"
          aria-modal="true"
          className="absolute bottom-0 left-0 right-0 z-40 max-h-[48dvh] overflow-hidden border-t border-white/10 px-4 pt-3"
          style={{
            background: 'linear-gradient(180deg, rgba(7, 11, 24, 0.92), var(--surface))',
            paddingBottom: 'calc(0.85rem + env(safe-area-inset-bottom))',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 -18px 46px rgba(0,0,0,0.45)',
          }}
        >
          <div className="mb-2 flex items-center gap-3">
            <button
              type="button"
              aria-label={String(t('close', { defaultValue: 'Schließen' }))}
              onClick={closeSheet}
              data-app-back-close
              className="grid min-h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:text-white"
            >
              <X size={17} aria-hidden="true" />
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-white">
                <History size={18} className="shrink-0 text-sky-300" aria-hidden="true" />
                <h2 className="truncate text-lg font-black">{labels.history}</h2>
              </div>
              <HistoryDaysSelect
                className="shrink-0"
                historyDays={historyDays}
                onHistoryDaysChange={onHistoryDaysChange}
              />
            </div>
          </div>

          <div className="max-h-[34dvh] overflow-y-auto pr-1">
            <InjectionHistorySheet
              embedded
              logs={logs}
              historyDays={historyDays}
              visibleLogIds={visibleLogIds}
              onHistoryDaysChange={onHistoryDaysChange}
              onToggleLog={onToggleLog}
              onFocusLog={onFocusLog}
              onEditLog={onEditLog}
            />
          </div>
        </section>
      )}
    </>
  )
}

function FloatingActionButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={'pointer-events-auto flex min-h-12 min-w-[8.5rem] cursor-pointer items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black shadow-[0_10px_26px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-colors ' + (active ? 'border-sky-300/35 bg-sky-400/20 text-sky-200' : 'border-white/10 bg-black/50 text-slate-200 hover:text-white')}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

function OpenIntakesTab({
  openIntakes,
  onSelectIntake,
}: {
  openIntakes: OpenInjectionIntake[]
  onSelectIntake: (intake: OpenInjectionIntake) => void
}) {
  const { t } = useTranslation()

  if (openIntakes.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-300" aria-hidden="true" />
        <p className="text-sm font-black text-white">{t('injection_open_empty_title', { defaultValue: 'Keine offenen Einnahmen' })}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{t('injection_open_empty_body', { defaultValue: 'Für diese Filter ist keine offene Einnahme vorhanden.' })}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 pb-5">
      {openIntakes.map(intake => {
        const key = intake.doseLogId ?? String(intake.cycleId) + '|' + intake.scheduledAt
        return <OpenIntakeRow key={key} intake={intake} onSelect={() => onSelectIntake(intake)} />
      })}
    </div>
  )
}

function OpenIntakeRow({ intake, onSelect }: { intake: OpenInjectionIntake; onSelect: () => void }) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-sky-300/35 hover:bg-sky-400/10"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-400">
          <CalendarClock size={16} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">{intake.stackItemName}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            <span className="text-amber-300">{t('injection_status_open', { defaultValue: 'Offen' })}</span>
            {' - '}{format(parseISO(intake.scheduledAt), 'dd.MM. HH:mm')}
            {intake.daysOverdue > 0 ? ` - ${openAgeLabel(intake.daysOverdue, t)}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black text-sky-300">{intake.dose} {intake.unit}</p>
          <p className="text-[0.62rem] text-slate-500">{methodLabel(t, intake.method)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-200">
        <Syringe size={14} aria-hidden="true" />
        {t('injection_open_select_action', { defaultValue: 'Auswählen & Stelle markieren' })}
      </div>
    </button>
  )
}

function openDaysLabel(days: IntakeHistoryDays, t: ReturnType<typeof useTranslation>['t']): string {
  if (days === 0) return String(t('injection_history_today', { defaultValue: 'Heute' }))
  if (days === 1) return String(t('injection_history_yesterday', { defaultValue: 'Gestern' }))
  return String(t('injection_history_days', { days, defaultValue: `${days} Tage` }))
}

function openAgeLabel(days: number, t: ReturnType<typeof useTranslation>['t']): string {
  if (days === 1) return String(t('injection_due_yesterday', { defaultValue: 'gestern fällig' }))
  return String(t('injection_due_days_ago', { days, defaultValue: `vor ${days} Tagen fällig` }))
}
