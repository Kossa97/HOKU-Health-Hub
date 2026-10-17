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

const OPEN_DAYS_OPTIONS: IntakeHistoryDays[] = [0, 1, 7, 14, 30, 60, 90]

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
            background: '#000',
            overscrollBehaviorY: 'contain',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="shrink-0 px-4 pb-2 pt-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={String(t('close', { defaultValue: 'Schließen' }))}
                onClick={closeSheet}
                data-app-back-close
                className="lg-glass lg-icon-btn lg-press shrink-0"
              >
                <X size={20} aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[28px] font-bold leading-[34px] text-[var(--lg-text)]">{labels.open}</h2>
                <p className="mt-1 text-[13px] leading-snug text-[var(--lg-text-3)]">
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
          className="lg-sheet absolute bottom-2 left-2 right-2 z-40 max-h-[48dvh] overflow-hidden px-4 pt-3"
          style={{
            // Leicht durchscheinend: die Karte bleibt darunter erkennbar.
            background: 'rgba(28, 28, 30, 0.9)',
            paddingBottom: 'calc(0.85rem + env(safe-area-inset-bottom))',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          }}
        >
          <div className="mb-2 flex items-center gap-3">
            <button
              type="button"
              aria-label={String(t('close', { defaultValue: 'Schließen' }))}
              onClick={closeSheet}
              data-app-back-close
              className="lg-icon-btn lg-press shrink-0 bg-[var(--lg-fill)] !text-[var(--lg-text-2)]"
            >
              <X size={20} aria-hidden="true" />
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-[var(--lg-text)]">
                <h2 className="lg-title2 truncate">{labels.history}</h2>
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
      // Glas-Kapsel über der Karte; aktiv in der Akzentfarbe getönt.
      className={'lg-btn pointer-events-auto min-w-[8.5rem] !px-5 !text-[15px] ' + (active ? 'lg-btn-primary' : 'lg-glass lg-btn-glass')}
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
      <div className="lg-surface px-5 py-7 text-center">
        <CheckCircle2 size={28} className="mx-auto mb-2 text-[var(--lg-good)]" aria-hidden="true" />
        <p className="text-[17px] font-semibold text-[var(--lg-text)]">{t('injection_open_empty_title', { defaultValue: 'Keine offenen Einnahmen' })}</p>
        <p className="mt-1 text-[15px] leading-5 text-[var(--lg-text-3)]">{t('injection_open_empty_body', { defaultValue: 'Für diese Filter ist keine offene Einnahme vorhanden.' })}</p>
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
      className="lg-surface w-full cursor-pointer p-4 text-left transition-colors active:bg-[var(--lg-surface-2)]"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="lg-icon-tile bg-[#ff9f0a]">
          <CalendarClock size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold text-[var(--lg-text)]">{intake.stackItemName}</p>
          <p className="mt-0.5 text-[13px] text-[var(--lg-text-3)]">
            <span className="text-[var(--lg-warn-text)]">{t('injection_status_open', { defaultValue: 'Offen' })}</span>
            {' - '}{format(parseISO(intake.scheduledAt), 'dd.MM. HH:mm')}
            {intake.daysOverdue > 0 ? ` - ${openAgeLabel(intake.daysOverdue, t)}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-semibold tabular-nums text-[var(--lg-text)]">{intake.dose} {intake.unit}</p>
          <p className="text-[12px] text-[var(--lg-text-3)]">{methodLabel(t, intake.method)}</p>
        </div>
      </div>
      <div className="lg-gray-btn pointer-events-none mt-3 w-full">
        <Syringe size={15} aria-hidden="true" />
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
