import type { ReactNode } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { FEATURES } from '../../../config/features'
import { type CycleTimeline } from '../../../lib/planTimeline'
import { type Peptide, presentedTimelines } from './model'

/**
 * Plan & Verlauf eines Eintrags (Plan-Zeitleiste): alle Zyklen mit ihren Stufen, Pausen und Aktionen.
 */
export function PlanOverviewSheet({
  currentCycleManagerPeptide,
  setCycleManagerPeptide,
  planManagementSections,
  timelinesOf,
}: {
  currentCycleManagerPeptide: Peptide | null
  setCycleManagerPeptide: Dispatch<SetStateAction<Peptide | null>>
  planManagementSections: (p: Peptide, timelines: CycleTimeline[]) => ReactNode
  timelinesOf: (stackItemId: string) => CycleTimeline[]
}) {
  const { t } = useTranslation()
  return (
    <>
      {currentCycleManagerPeptide && FEATURES.planTimelineV2 && (
        <div className="lg-backdrop fixed inset-0 z-50 flex justify-center" data-app-modal>
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden">
            <div className="shrink-0 px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--lg-text-3)]">
                    {t('my_stack_plan_management', { defaultValue: 'Einnahmeplan' })}
                  </p>
                  <h2 className="mt-0.5 truncate text-[28px] font-medium leading-[34px] text-[var(--lg-text)]">{currentCycleManagerPeptide.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCycleManagerPeptide(null)}
                  data-app-back-close
                  className="lg-glass lg-icon-btn lg-press shrink-0"
                  aria-label={t('close')}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {planManagementSections(
                currentCycleManagerPeptide,
                presentedTimelines(currentCycleManagerPeptide, timelinesOf(currentCycleManagerPeptide.id)),
              )}
              {timelinesOf(currentCycleManagerPeptide.id).length === 0 && (
                <div className="lg-surface p-5 text-center">
                  <p className="text-[17px] font-medium text-[var(--lg-text)]">{t('noch_kein_zyklus')}</p>
                  <p className="mt-1 text-[15px] text-[var(--lg-text-3)]">{t('noch_kein_zyklus_desc')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
