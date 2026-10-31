import { useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { formatLocalDay } from '../lib/localDays'
import {
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
  Flag,
  Pause,
  Play,
} from 'lucide-react'
import { parseISO } from 'date-fns'
import { methodLabel } from '../../../lib/intakeMethods'
import { dosePlanCapabilities } from '../lib/dosePlan'
import { FEATURES } from '../../../config/features'
import { type Peptide, type Cycle, type CycleView } from './model'
import { DosePlanActions } from './DosePlanActions'

/**
 * Zyklus-Verwaltung ohne Plan-Zeitleiste (planTimelineV2 aus): Zyklen, Dosisanpassungen, Pausen.
 */
export function LegacyCycleManager({
  cycleView,
  cycleManagerPeptide,
  setCycleManagerPeptide,
}: {
  cycleView: CycleView
  cycleManagerPeptide: Peptide | null
  setCycleManagerPeptide: Dispatch<SetStateAction<Peptide | null>>
}) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const {
    cyclesOf,
    escalationsOf,
    openNewCycle,
    dismissZyklusBtn,
    openEditCycle,
    removeCycle,
    toggleCycleActive,
    currentQuantityLabel,
    freqLabel,
    intakeLabel,
    plannedQuantityRows,
    doseAdjustmentIcon,
    escalationQuantityLabel,
    escalationIsActive,
    escLabel,
    openEditEsc,
    removeEsc,
    openNewEsc,
    reminderLabel,
    planStufenListe,
    endCycle,
    scheduledQuantityLabel,
  } = cycleView
  // Welche Karten und Dosisanpassungs-Listen aufgeklappt sind — nur hier gebraucht.
  const [managerCardOpen, setManagerCardOpen] = useState<Set<string>>(() => new Set())
  const [managerEscOpen, setManagerEscOpen] = useState<Set<string>>(() => new Set())
  const umschalten = (id: string) => (prev: Set<string>) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  }
  const toggleManagerCard = (id: string) => setManagerCardOpen(umschalten(id))
  const toggleManagerEsc = (id: string) => setManagerEscOpen(umschalten(id))
  return (
    <>
      {cycleManagerPeptide && !FEATURES.planTimelineV2 && (() => {
        const managerCycles = cyclesOf(cycleManagerPeptide.id)
        const activeCycles = managerCycles.filter(c => c.active)
        const inactiveCycles = managerCycles.filter(c => !c.active)

        const cycleIcons = (c: Cycle) => (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => { openEditCycle(cycleManagerPeptide, c.id); setCycleManagerPeptide(null) }}
              aria-label={t('bearbeiten')}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400 transition-colors hover:border-sky-500/40 hover:text-sky-300"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => removeCycle(c.id)}
              aria-label={t('loeschen')}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/5 text-red-300 transition-colors hover:border-red-400/45 hover:bg-red-500/10"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )

        const cycleMeta = (c: Cycle) => (
          <>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
              {dosePlanCapabilities(cycleManagerPeptide.tracking_level).permanent && (
                <span className="font-medium text-slate-200">{currentQuantityLabel(c)}</span>
              )}
              <span>{freqLabel(c)}</span>
              <span>{methodLabel(t, c.method)}</span>
              <span>{t('ab_datum', { date: formatLocalDay(c.start_date, language) })}</span>
              {c.end_date ? (
                <span>{t('bis_datum', { date: formatLocalDay(c.end_date, language) })}</span>
              ) : (
                <span>{t('ende_offen')}</span>
              )}
            </div>
            {(() => {
              const intake = intakeLabel(c)
              const reminder = reminderLabel(c)
              return intake || reminder ? (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {intake && <span className="text-slate-300">{intake}</span>}
                  {reminder && <span className="text-slate-300">{reminder}</span>}
                </div>
              ) : null
            })()}
            {dosePlanCapabilities(cycleManagerPeptide.tracking_level).permanent && plannedQuantityRows(c)}
            {/* Die Planstufen samt „Stufe zuruecknehmen" standen frueher auf der
                Vollbildseite. Seit der Zyklus dort nur noch ein Knopf ist, gehoeren
                sie hierher — nicht in den Papierkorb. */}
            {planStufenListe(c)}
          </>
        )

        const cycleActions = (c: Cycle, isEnded: boolean) => (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => toggleCycleActive(c)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors ${c.active ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-400/50 hover:bg-red-500/15' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/50 hover:bg-emerald-500/15'}`}
            >
              {c.active ? <><Pause size={13} /> {t('deaktivieren')}</> : <><Play size={13} /> {t('aktivieren')}</>}
            </button>
            {!isEnded && (
              <button
                type="button"
                onClick={() => endCycle(c)}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--lg-hair)] bg-[var(--lg-fill)] px-2 text-xs font-medium text-[var(--lg-text)] transition-colors hover:border-[var(--border-strong)]"
              >
                <Flag size={13} /> {t('beenden')}
              </button>
            )}
          </div>
        )

        const cycleEsc = (c: Cycle) => {
          if (!dosePlanCapabilities(cycleManagerPeptide.tracking_level).titration) return null
          const pEscs = escalationsOf(c.id)
          const open = managerEscOpen.has(c.id)
          return (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => toggleManagerEsc(c.id)}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-300 transition-colors hover:border-slate-700"
              >
                <SlidersHorizontal size={14} strokeWidth={1.5} className="text-slate-500" /> {t('dosiserhoehungen')}
                <span className={`ml-auto font-medium ${pEscs.length > 0 ? 'text-slate-200' : 'text-slate-500'}`}>
                  {pEscs.length > 0 ? (pEscs.length === 1 ? t('stufe_count_one') : t('stufe_count_many', { n: pEscs.length })) : t('keine')}
                </span>
                {open ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
              </button>
              {open && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
                    <span className="min-w-0 truncate text-slate-300">{t('basis')}</span>
                    <span className="shrink-0 font-medium text-white">{scheduledQuantityLabel(c, parseISO(c.start_date))}</span>
                  </div>
                  {pEscs.map((e, idx) => {
                    const AdjustmentIcon = doseAdjustmentIcon(c, e)
                    return (
                      <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div className="min-w-0 text-xs">
                          <p className="flex items-center gap-1 truncate font-medium text-white">
                            <AdjustmentIcon size={12} /> #{idx + 1} {escalationQuantityLabel(c, e)}
                          </p>
                          {!escalationIsActive(c, e) && <p className="text-xs text-slate-500">{t('dose_plan_planned', { defaultValue: 'Geplant' })}</p>}
                          <p className="truncate text-slate-400">{escLabel(e)}</p>
                          {e.notes && <p className="truncate text-slate-500">{e.notes}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { openEditEsc(c, e); setCycleManagerPeptide(null) }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-sky-300"
                            aria-label={t('dosisanpassung_bearbeiten')}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEsc(e.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
                            aria-label={t('dosisanpassung_loeschen')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  <DosePlanActions
                    trackingLevel={cycleManagerPeptide.tracking_level}
                    onPermanent={() => { openEditCycle(cycleManagerPeptide, c.id); setCycleManagerPeptide(null) }}
                    onTitration={() => { openNewEsc(c); setCycleManagerPeptide(null) }}
                  />
                </div>
              )}
            </div>
          )
        }

        const renderActiveCard = (c: Cycle) => {
          const isEnded = c.end_date ? parseISO(c.end_date).getTime() < Date.now() : false
          return (
            <div key={c.id} data-cycle-id={c.id} className="rounded-xl border border-emerald-500/25 bg-slate-900/35 p-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{c.name}</p>
                    <span className="shrink-0 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">{t('aktiv_badge')}</span>
                  </div>
                  {cycleMeta(c)}
                </div>
                {cycleIcons(c)}
              </div>
              {cycleActions(c, isEnded)}
              {cycleEsc(c)}
            </div>
          )
        }

        const renderInactiveCard = (c: Cycle) => {
          const isEnded = c.end_date ? parseISO(c.end_date).getTime() < Date.now() : false
          const open = managerCardOpen.has(c.id)
          const statusLabel = isEnded ? t('beendet') : t('inaktiv_badge')
          return (
            <div key={c.id} data-cycle-id={c.id} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/35">
              <button
                type="button"
                onClick={() => toggleManagerCard(c.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-2.5 p-3 text-left"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-slate-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{c.name}</p>
                    <span className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-medium text-slate-400">{statusLabel}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {dosePlanCapabilities(cycleManagerPeptide.tracking_level).permanent ? currentQuantityLabel(c) : ''}
                    {c.end_date ? ` · ${t('bis_datum', { date: formatLocalDay(c.end_date, language) })}` : ''}
                  </p>
                </div>
                {open ? <ChevronUp size={16} className="shrink-0 text-slate-500" /> : <ChevronDown size={16} className="shrink-0 text-slate-500" />}
              </button>
              {open && (
                <div className="border-t border-slate-800/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">{cycleMeta(c)}</div>
                    {cycleIcons(c)}
                  </div>
                  {cycleActions(c, isEnded)}
                  {cycleEsc(c)}
                </div>
              )}
            </div>
          )
        }

        return (
          <div className="fixed inset-0 z-50 flex justify-center bg-slate-950" data-app-modal>
            <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-slate-950">
              <div className="shrink-0 border-b border-slate-800 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-500">{t('zyklen_verwalten')}</p>
                    <h2 className="mt-1 truncate text-lg font-medium text-white">{cycleManagerPeptide.name}</h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {managerCycles.length === 1 ? t('zyklus_count_one') : t('zyklus_count_many', { n: managerCycles.length })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCycleManagerPeptide(null)}
                    data-app-back-close
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
                    aria-label={t('close')}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => {
                    openNewCycle(cycleManagerPeptide)
                    dismissZyklusBtn()
                    setCycleManagerPeptide(null)
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--lg-hair)] bg-[var(--lg-fill)] px-4 text-sm font-medium text-[var(--lg-text)] transition-colors hover:border-[var(--border-strong)]"
                >
                  <Plus size={16} /> {t('neuer_zyklus')}
                </button>

                {managerCycles.length === 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
                    <p className="text-sm font-medium text-white">{t('noch_kein_zyklus')}</p>
                    <p className="mt-1 text-xs text-slate-500">{t('noch_kein_zyklus_desc')}</p>
                  </div>
                )}

                {activeCycles.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 px-1 text-[13px] font-medium text-emerald-300">
                      <Play size={12} /> {t('aktiv_badge')}
                    </p>
                    {activeCycles.map(renderActiveCard)}
                  </div>
                )}

                {inactiveCycles.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 px-1 text-[13px] font-medium text-slate-500">
                      <Flag size={12} /> {t('beendet_inaktiv')}
                    </p>
                    {inactiveCycles.map(renderInactiveCard)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
