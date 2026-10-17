import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, AlertTriangle, ListChecks, Minimize2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { FEATURES } from '../config/features'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { InjectionMapCanvas, type InjectionFocusRequest } from '../components/injection3d/InjectionMapCanvas'
import { InjectionIntroSheet, INJECTION_INTRO_VERSION } from '../components/injection3d/InjectionIntroSheet'
import { InjectionLogSheet, type InjectionSaveInput } from '../components/injection3d/InjectionLogSheet'
import { InjectionTrackerTabs } from '../components/injection3d/InjectionTrackerTabs'
import { InjectionEditSheet } from '../components/injection3d/InjectionEditSheet'
import { InjectionSitePickerSheet } from '../components/injection3d/InjectionSitePickerSheet'
import { pinDraftFromPreset, type InjectionSitePreset } from '../lib/injectionSitePresets'
import {
  assertInjectionProSchema,
  confirmIntakeDoseLog,
  confirmIntakeWithInjection,
  deleteInjectionLog,
  loadInjectionLogs,
  loadSelectableInjectionIntakes,
  isDoseLogAlreadyLinkedError,
  isInjectionLogNotFoundError,
  isInjectionProSchemaError,
  resolveInjectionDoseLogId,
  saveInjectionLog,
  updateInjectionLog,
  type InjectionLogEdit,
  type OpenInjectionIntake,
} from '../lib/injectionPersistence'
import { proximityWarning } from '../lib/injectionGeometry'
import { debitPeptideStockForDoseById } from '../features/my-stack/extensions/peptide/vialStock'
import { formatInjectionPinAge, getInjectionPinAgeColor, getInjectionPinSubstance } from '../lib/injectionPinPresentation'
import { findTargetInjectionIntake, getOpenInjectionIntakeKey } from '../lib/injectionDeepLink'
import type { InjectionHistoryDays } from '../lib/injectionHistory'
import type {
  InjectionLog3D,
  InjectionPinDraft,
  InjectionProximityWarning,
} from '../lib/injectionLogTypes'

const INTRO_STORAGE_KEY = 'tyd_injection_intro_version'
const TRACKER_FULLSCREEN_HEIGHT = '100dvh'

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: 'linear-gradient(145deg, var(--surface), var(--surface))',
  border: '1px solid var(--border)',
  borderRadius: 22,
  boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
  position: 'relative',
  overflow: 'hidden',
}


// ── Supabase error helpers ────────────────────────────────────────────────────

function isTableMissingError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === '42P01' ||
    error.code === 'PGRST116' ||
    msg.includes('does not exist') ||
    msg.includes('undefined table') ||
    msg.includes('relation') && msg.includes('not exist')
  )
}

const NO_WARNING: InjectionProximityWarning = { level: 'none', nearestLogId: null, distance: null }

// ── Main Component ────────────────────────────────────────────────────────────

export function InjektionsTracker() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const returnTo = searchParams.get('returnTo')

  const mapSectionRef = useRef<HTMLElement | null>(null)
  const [logs, setLogs] = useState<InjectionLog3D[]>([])
  const [openIntakes, setOpenIntakes] = useState<OpenInjectionIntake[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [timelineLoadError, setTimelineLoadError] = useState(false)

  const [draftPin, setDraftPin] = useState<InjectionPinDraft | null>(null)
  const [showLogSheet, setShowLogSheet] = useState(false)
  const [historyDays, setHistoryDays] = useState<InjectionHistoryDays>(7)
  const [trackerSheetOpen, setTrackerSheetOpen] = useState(false)
  const [selectedTargetIntakeKey, setSelectedTargetIntakeKey] = useState<string | null>(null)
  const [focusRequest, setFocusRequest] = useState<InjectionFocusRequest | null>(null)
  const [cameraResetRequestId, setCameraResetRequestId] = useState(0)
  const [visibleLogIds, setVisibleLogIds] = useState<Set<string>>(() => new Set())
  const [activeLogId, setActiveLogId] = useState<string | null>(null)
  const [inventoryRetryIds, setInventoryRetryIds] = useState<string[]>([])
  const [editingLog, setEditingLog] = useState<InjectionLog3D | null>(null)
  const [sitePickerOpen, setSitePickerOpen] = useState(false)
  const [showIntro, setShowIntro] = useState(
    () => Number(localStorage.getItem(INTRO_STORAGE_KEY) ?? 0) < INJECTION_INTRO_VERSION,
  )

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [loadedLogs, loadedIntakes] = await Promise.all([
        loadInjectionLogs(supabase, user.id),
        loadSelectableInjectionIntakes(supabase, user.id),
      ])
      setLogs(loadedLogs)
      setOpenIntakes(loadedIntakes)
      setTableError(false)
      setTimelineLoadError(false)
    } catch (error) {
      console.error('[InjektionsTracker] loadData error:', error)
      if (FEATURES.planTimelineV2) {
        setTimelineLoadError(true)
        setOpenIntakes([])
      }
      if (isTableMissingError(error as { message?: string; code?: string })) setTableError(true)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const closeIntro = () => setShowIntro(false)
  const dontShowIntro = () => {
    localStorage.setItem(INTRO_STORAGE_KEY, String(INJECTION_INTRO_VERSION))
    setShowIntro(false)
  }

  useEffect(() => {
    setFocusRequest(previous => previous
      ? { ...previous, requestId: previous.requestId + 1, sheetOpen: trackerSheetOpen }
      : previous)
  }, [trackerSheetOpen])

  const focusLog = (log: InjectionLog3D) => {
    setActiveLogId(log.id)
    setVisibleLogIds(prev => new Set(prev).add(log.id))
    setFocusRequest(previous => ({ log, requestId: (previous?.requestId ?? 0) + 1, sheetOpen: trackerSheetOpen }))
    requestAnimationFrame(() => mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const toggleLogVisibility = (id: string) => {
    const log = logs.find(item => item.id === id)
    setVisibleLogIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setActiveLogId(current => current === id ? null : current)
      } else {
        next.add(id)
        if (log) setActiveLogId(log.id)
      }
      return next
    })
  }

  const selectOpenIntakeForInjection = (intake: OpenInjectionIntake) => {
    setSelectedTargetIntakeKey(getOpenInjectionIntakeKey(intake))
    setTrackerSheetOpen(false)
    toast.success(t('injection_intake_selected_toast', { defaultValue: 'Einnahme ausgewählt. Markiere jetzt die Injektionsstelle.' }))
  }

  const targetIntake = useMemo(() => findTargetInjectionIntake(openIntakes, searchParams), [openIntakes, searchParams])
  const urlTargetIntakeKey = targetIntake ? getOpenInjectionIntakeKey(targetIntake) : null
  const targetIntakeKey = selectedTargetIntakeKey ?? urlTargetIntakeKey
  const activeTargetIntake = useMemo(() => {
    if (!targetIntakeKey) return null
    return openIntakes.find(intake => getOpenInjectionIntakeKey(intake) === targetIntakeKey) ?? targetIntake
  }, [openIntakes, targetIntake, targetIntakeKey])
  const goBack = () => {
    if (returnTo) navigate(returnTo)
    else navigate(-1)
  }

  const activeLog = activeLogId ? logs.find(log => log.id === activeLogId) ?? null : null
  const showPositionActions = draftPin && !showLogSheet
  const warning = draftPin ? proximityWarning(draftPin, logs, new Date()) : NO_WARNING

  const retryCommittedStock = async (doseLogId: string) => {
    try {
      await debitPeptideStockForDoseById(supabase, doseLogId)
      setInventoryRetryIds(current => current.filter(id => id !== doseLogId))
    } catch {
      toast.error(t('inventory_update_failed', { defaultValue: 'Bestand konnte nicht aktualisiert werden' }))
    }
  }

  // Weg ohne Long-Press: gleiche Wirkung wie ein Pin auf der Karte.
  const selectSitePreset = (preset: InjectionSitePreset) => {
    const pin = pinDraftFromPreset(preset)
    setDraftPin(pin)
    setShowLogSheet(false)
    setTrackerSheetOpen(false)
    setSitePickerOpen(false)
    setFocusRequest(previous => ({
      log: { position: pin.position, normal: pin.normal },
      requestId: (previous?.requestId ?? 0) + 1,
      sheetOpen: false,
    }))
  }

  const saveLogEdit = async (edit: InjectionLogEdit) => {
    if (!user || !editingLog) return
    try {
      await updateInjectionLog(supabase, user.id, editingLog, edit)
      toast.success(t('injection_edit_saved', { defaultValue: 'Änderungen gespeichert' }))
      setEditingLog(null)
      await loadData()
    } catch (error) {
      console.error('[InjektionsTracker] saveLogEdit error:', error)
      toast.error(t('injection_edit_failed', { defaultValue: 'Änderungen konnten nicht gespeichert werden' }))
      // Schon geloescht (anderes Geraet): Fenster zu, Liste auf den echten Stand.
      if (isInjectionLogNotFoundError(error)) {
        setEditingLog(null)
        await loadData()
      }
    }
  }

  const deleteEditingLog = async () => {
    if (!user || !editingLog) return
    const id = editingLog.id
    try {
      try {
        await deleteInjectionLog(supabase, user.id, id)
      } catch (error) {
        // Schon weg (anderes Geraet): das Ziel ist erreicht.
        if (!isInjectionLogNotFoundError(error)) throw error
      }
      setVisibleLogIds(prev => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setActiveLogId(current => current === id ? null : current)
      setFocusRequest(current => current?.log.id === id ? null : current)
      toast.success(t('injection_deleted', { defaultValue: 'Injektion gelöscht' }))
      setEditingLog(null)
      await loadData()
    } catch (error) {
      console.error('[InjektionsTracker] deleteEditingLog error:', error)
      toast.error(t('injection_delete_failed', { defaultValue: 'Injektion konnte nicht gelöscht werden' }))
    }
  }

  const saveDraftPin = async (input: InjectionSaveInput) => {
    if (!user || !draftPin) return
    try {
      await assertInjectionProSchema(supabase)

      // Bestand ist ein getrennt wiederholbarer Nachlauf zur gespeicherten Einnahme.
      const debitStock = async (committedDoseLogId: string) => {
        try {
          await debitPeptideStockForDoseById(supabase, committedDoseLogId)
        } catch {
          setInventoryRetryIds(current => current.includes(committedDoseLogId)
            ? current
            : [...current, committedDoseLogId])
          toast.error(t('inventory_update_failed', { defaultValue: 'Bestand konnte nicht aktualisiert werden' }))
        }
      }
      const warningState = warning.level === 'none' ? null : warning.level

      const openIntake = input.mode === 'intake' && input.intake?.status === 'open' ? input.intake : null
      const confirmInput = openIntake ? {
        userId: user.id,
        stackItemId: openIntake.stackItemId,
        dose: input.dose ?? openIntake.dose,
        unit: input.unit ?? openIntake.unit,
        method: input.method ?? openIntake.method,
        loggedAt: input.loggedAt,
        doseLogId: openIntake.doseLogId,
        cycleId: openIntake.cycleId,
        planVersionId: openIntake.planVersionId,
        routineSlotKey: openIntake.routineSlotKey,
        scheduledAt: openIntake.scheduledAt,
        debitVialStock: false,
      } : null

      // Offene Einnahme: bestaetigen und Stelle speichern in einer
      // Transaktion. `null` heisst, die Datenbank kennt die Funktion noch
      // nicht -- dann der bisherige Weg in zwei Schritten. Der alte Zweig
      // ohne Planversionen (planTimelineV2 aus) bleibt zweistufig; die
      // Datenbankfunktion braucht Zyklus und Planversion.
      const atomic = FEATURES.planTimelineV2 && confirmInput
        ? await confirmIntakeWithInjection(supabase, confirmInput, {
          notes: input.notes, warningState, substanceLabel: input.substanceLabel, pin: draftPin,
        })
        : null

      if (atomic) {
        await debitStock(atomic.doseLogId)
      } else {
        let doseLogId: string | null = null
        let stackItemId: string | null = null
        let cycleId: string | null = null

        if (input.mode === 'intake' && input.intake) {
          const intake = input.intake
          stackItemId = intake.stackItemId
          cycleId = intake.cycleId
          doseLogId = await resolveInjectionDoseLogId(intake, () => {
            if (!confirmInput) throw new Error('Open intake is missing its confirmation input')
            return confirmIntakeDoseLog(supabase, confirmInput)
          })
          await debitStock(doseLogId)
        }

        const confirmedSnapshot = FEATURES.planTimelineV2 && input.mode === 'intake' && input.intake?.status === 'confirmed'
          ? input.intake : null
        await saveInjectionLog(supabase, {
          userId: user.id,
          doseLogId,
          stackItemId,
          cycleId,
          dose: confirmedSnapshot?.dose ?? input.dose,
          unit: confirmedSnapshot?.unit ?? input.unit,
          method: confirmedSnapshot?.method ?? input.method,
          notes: input.notes,
          loggedAt: confirmedSnapshot?.scheduledAt ?? input.loggedAt,
          warningState,
          substanceLabel: input.substanceLabel,
          pin: draftPin,
        })
      }

      toast.success(input.mode === 'intake'
        ? input.intake?.status === 'confirmed'
          ? t('injection_site_added_toast', { defaultValue: 'Injektionsstelle hinzugefügt' })
          : t('injection_saved_with_intake_toast', { defaultValue: 'Injektion & Einnahme gespeichert' })
        : t('injection_saved_toast', { defaultValue: 'Injektion gespeichert' }))
      setDraftPin(null)
      setShowLogSheet(false)
      setSelectedTargetIntakeKey(null)
      await loadData()
    } catch (error) {
      console.error('[InjektionsTracker] saveDraftPin error:', error)
      if (isDoseLogAlreadyLinkedError(error)) {
        toast.error(t('injection_already_linked_toast', { defaultValue: 'Für diese Einnahme wurde bereits eine Injektionsstelle gespeichert' }))
        setShowLogSheet(false)
        setSelectedTargetIntakeKey(null)
        await loadData()
        return
      }
      if (isInjectionProSchemaError(error)) {
        setShowLogSheet(false)
        setTableError(true)
        toast.error(t('injection_unavailable_title', { defaultValue: 'Injektionstracker gerade nicht verfügbar' }))
        return
      }
      await loadData()
      toast.error(t('injection_save_failed_toast', { defaultValue: 'Injektion konnte nicht gespeichert werden' }))
    }
  }

  if (timelineLoadError || tableError) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 16,
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))',
      }}>
        <PageHeader onBack={goBack} />
        {/* Die genauere Ursache zuerst: fehlt die Tabelle, ist es nicht der Plan. */}
        {tableError ? (
          <TrackerUnavailable
            title={String(t('injection_unavailable_title', { defaultValue: 'Injektionstracker gerade nicht verfügbar' }))}
            hint={String(t('injection_unavailable_hint', { defaultValue: 'Deine Daten sind sicher gespeichert. Bitte versuche es gleich noch einmal.' }))}
            onRetry={() => { setTableError(false); void loadData() }}
          />
        ) : (
          <TrackerUnavailable title={String(t('inj_plan_load_error'))} onRetry={() => void loadData()} />
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-30 overflow-hidden" style={{ height: TRACKER_FULLSCREEN_HEIGHT, minHeight: TRACKER_FULLSCREEN_HEIGHT }}>
      {/* 3D Injektionskarte */}
      <section
        ref={mapSectionRef}
        style={{
          ...panelStyle,
          padding: 0,
          height: TRACKER_FULLSCREEN_HEIGHT,
          minHeight: TRACKER_FULLSCREEN_HEIGHT,
          border: 'none',
          borderRadius: 0,
          boxShadow: 'none',
        }}
      >
        <div style={{ position: 'relative', height: TRACKER_FULLSCREEN_HEIGHT, minHeight: TRACKER_FULLSCREEN_HEIGHT }}>
          <PageHeader onBack={goBack} overlay />
          <InjectionMapCanvas
            height={TRACKER_FULLSCREEN_HEIGHT}
            minHeight={TRACKER_FULLSCREEN_HEIGHT}
            draftPin={draftPin}
            logs={logs}
            visibleLogIds={visibleLogIds}
            focusRequest={focusRequest}
            resetRequestId={cameraResetRequestId}
            activeLogId={activeLogId}
            onDraftPinChange={(pin) => { setDraftPin(pin); setShowLogSheet(false); setTrackerSheetOpen(false) }}
            onLogFocus={focusLog}
            ariaLabel={String(t('injection_map_aria', { defaultValue: '3D-Körpermodell mit deinen Injektionsstellen. Stelle per langem Drücken setzen oder über „Stelle aus Liste wählen“.' }))}
          />

          <button
            type="button"
            aria-label={String(t('injection_camera_reset', { defaultValue: 'Torso zentrieren' }))}
            onClick={() => setCameraResetRequestId(value => value + 1)}
            className="lg-glass lg-icon-btn lg-press !absolute right-4 z-30"
            style={{ top: 'calc(88px + env(safe-area-inset-top))' }}
          >
            <Minimize2 size={19} aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label={String(t('injection_pick_site_action', { defaultValue: 'Stelle aus Liste wählen' }))}
            title={String(t('injection_pick_site_action', { defaultValue: 'Stelle aus Liste wählen' }))}
            aria-haspopup="dialog"
            onClick={() => setSitePickerOpen(true)}
            className="lg-glass lg-icon-btn lg-press !absolute right-4 z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            style={{ top: 'calc(144px + env(safe-area-inset-top))' }}
          >
            <ListChecks size={19} aria-hidden="true" />
          </button>

          {activeLog && visibleLogIds.has(activeLog.id) && (
            <div
              className="injection-active-pin-chip pointer-events-none absolute left-4 right-4 z-30 flex justify-center"
              style={{ top: 'calc(78px + env(safe-area-inset-top))' }}
            >
              <div
                className="lg-glass flex min-h-11 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-[var(--lg-text)]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: getInjectionPinAgeColor(activeLog.logged_at), boxShadow: '0 0 14px ' + getInjectionPinAgeColor(activeLog.logged_at) }}
                />
                <span className="truncate">
                  {getInjectionPinSubstance(activeLog)} - {formatInjectionPinAge(activeLog.logged_at)}
                </span>
              </div>
            </div>
          )}

          {activeTargetIntake && !showLogSheet && (
            <div
              className="injection-selected-intake-chip pointer-events-none absolute left-4 right-4 z-30 flex justify-center"
              style={{ top: 'calc(126px + env(safe-area-inset-top))' }}
            >
              <div
                className="lg-glass flex min-h-10 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-[var(--lg-text)]"
              >
                <span className="shrink-0 text-[12px] font-semibold uppercase text-[var(--lg-accent-text)]">{t('injection_selected_chip', { defaultValue: 'Ausgewählt' })}</span>
                <span className="min-w-0 flex-1 truncate">{activeTargetIntake.stackItemName}</span>
                <span className="shrink-0 text-[var(--lg-text-2)]">{activeTargetIntake.dose} {activeTargetIntake.unit} - {format(parseISO(activeTargetIntake.scheduledAt), 'HH:mm')}</span>
              </div>
            </div>
          )}
          {showPositionActions && (
            <div
              className="lg-sheet absolute left-2 right-2 z-20 p-3"
              style={{ bottom: 'calc(8px + env(safe-area-inset-bottom))' }}
            >
              <div className="flex gap-3">
                <button type="button" data-quiet className="lg-gray-btn min-h-12 flex-1 !text-[17px]" onClick={() => { setDraftPin(null); setSelectedTargetIntakeKey(null) }}>{t('injection_position_cancel', { defaultValue: 'Abbrechen' })}</button>
                <button type="button" autoFocus className="lg-btn lg-btn-primary min-h-12 flex-1 !px-4" onClick={() => setShowLogSheet(true)}>{t('injection_position_accept', { defaultValue: 'Position übernehmen' })}</button>
              </div>
            </div>
          )}
        </div>

        {/* Tracker tabs */}
        {!showPositionActions && (
          <InjectionTrackerTabs
            logs={loading ? [] : logs}
            openIntakes={loading ? [] : openIntakes}
            historyDays={historyDays}
            visibleLogIds={visibleLogIds}
            onHistoryDaysChange={setHistoryDays}
            onToggleLog={toggleLogVisibility}
            onFocusLog={focusLog}
            onEditLog={setEditingLog}
            onSelectOpenIntake={selectOpenIntakeForInjection}
            onSheetOpenChange={setTrackerSheetOpen}
          />
        )}
      </section>

      {inventoryRetryIds.length > 0 && (
        <div role="alert" className="lg-sheet fixed left-4 right-4 top-24 z-50 !rounded-[22px] p-4 text-[15px] font-semibold text-[var(--lg-warn-text)] shadow-2xl">
          <p>{t('inventory_committed_retry', { defaultValue: 'Die Einnahme ist gespeichert, aber der Bestand wurde nicht aktualisiert.' })}</p>
          <button
            type="button"
            onClick={() => void Promise.all(inventoryRetryIds.map(retryCommittedStock))}
            className="lg-gray-btn mt-3 !text-[var(--lg-warn-text)]"
          >
            <RefreshCw size={15} aria-hidden="true" /> {t('inventory_retry', { defaultValue: 'Bestand erneut versuchen' })}
          </button>
        </div>
      )}

      {showLogSheet && draftPin && (
        <InjectionLogSheet
          pin={draftPin}
          openIntakes={openIntakes}
          cycles={[]}
          warning={warning}
          targetIntakeKey={targetIntakeKey}
          onCancel={() => setShowLogSheet(false)}
          onSave={saveDraftPin}
        />
      )}

      {sitePickerOpen && (
        <InjectionSitePickerSheet onSelect={selectSitePreset} onClose={() => setSitePickerOpen(false)} />
      )}

      {editingLog && (
        <InjectionEditSheet
          key={editingLog.id}
          log={editingLog}
          onCancel={() => setEditingLog(null)}
          onSave={saveLogEdit}
          onDelete={deleteEditingLog}
        />
      )}

      {/* ── Intro ── */}
      {showIntro && (
        <InjectionIntroSheet onClose={closeIntro} onDontShowAgain={dontShowIntro} />
      )}
    </div>
  )
}

// ── PageHeader ─────────────────────────────────────────────────────────────────

function PageHeader({ onBack, overlay = false }: { onBack: () => void; overlay?: boolean }) {
  const { t } = useTranslation()
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      ...(overlay ? {
        position: 'absolute',
        top: 'calc(16px + env(safe-area-inset-top))',
        left: 14,
        right: 14,
        zIndex: 25,
        pointerEvents: 'none',
      } : null),
    }}>
      <button
        onClick={onBack}
        aria-label={String(t('back', { defaultValue: 'Zurück' }))}
        className="lg-glass lg-icon-btn lg-press shrink-0"
        style={{ pointerEvents: overlay ? 'auto' : undefined }}
      >
        <ArrowLeft size={20} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, fontWeight: 600,
          color: 'var(--lg-text-2)',
          textShadow: overlay ? '0 1px 10px rgba(0,0,0,0.8)' : undefined,
        }}>
          {t('injection_pro_title', { defaultValue: 'Injektionstracker Pro' })}
        </p>
        <h1 className="truncate" style={{ fontSize: 28, fontWeight: 700, lineHeight: '34px', letterSpacing: '0.013em', color: 'var(--text)', textShadow: overlay ? '0 2px 14px rgba(0,0,0,0.8)' : undefined }}>
          {t('injection_map_title', { defaultValue: '3D Injektionskarte' })}
        </h1>
      </div>
    </div>
  )
}

// ── TrackerUnavailable ──────────────────────────────────────────────────────
//
// Frueher stand hier das Einrichtungs-SQL zum Kopieren in den Supabase-Editor.
// Das ist ein Entwicklerwerkzeug: Nutzer koennen damit nichts anfangen, und es
// zeigt den Aufbau der Datenbank. Die Tabellen stehen versioniert im Repo
// (supabase-injection*.sql).

function TrackerUnavailable({ title, hint, onRetry }: { title: string; hint?: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="lg-surface" style={{ padding: 22, textAlign: 'center' }}>
      <div className="lg-icon-tile" style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--lg-warn)', margin: '0 auto 14px' }}>
        <AlertTriangle size={24} aria-hidden="true" />
      </div>
      <h2 className="lg-title2" style={{ marginBottom: hint ? 8 : 18 }}>{title}</h2>
      {hint && (
        <p style={{ fontSize: 15, color: 'var(--lg-text-3)', lineHeight: 1.5, marginBottom: 18 }}>{hint}</p>
      )}
      <button type="button" data-quiet className="lg-gray-btn min-h-11 w-full" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" /> {t('routine_confirmation_retry', { defaultValue: 'Erneut versuchen' })}
      </button>
    </div>
  )
}
