import { ClipboardList, History, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type InjectionHistoryDays } from '../../lib/injectionHistory'
import type { OpenInjectionIntake } from '../../lib/injectionPersistence'
import type { InjectionTrackerTab } from '../../lib/injectionTrackerTabs'
import type { InjectionLog3D } from '../../lib/injectionLogTypes'
import { HistoryDaysSelect, InjectionHistorySheet } from './InjectionHistorySheet'
import { InjectionIntakeList } from './InjectionIntakeList'

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

  const labels: Record<InjectionTrackerTab, string> = {
    open: String(t('injection_tab_intakes', { defaultValue: 'Einnahmen' })),
    history: String(t('injection_tab_history', { defaultValue: 'Historie' })),
  }

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
        data-injection-cover="bottom"
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
          className="lg-backdrop fixed inset-0 z-[60] flex min-h-dvh flex-col overflow-hidden overscroll-y-contain"
          style={{
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
                  {t('injection_intakes_hint', { defaultValue: 'Einnahme wählen, dann die Stelle auf der Karte markieren.' })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-3">
            <InjectionIntakeList intakes={openIntakes} onSelect={intake => selectOpenIntake(intake)} />
          </div>
        </section>
      )}

      {activeSheet === 'history' && (
        <section
          data-injection-cover="bottom"
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
