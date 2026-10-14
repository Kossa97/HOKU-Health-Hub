import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, AlertTriangle, Copy, Minimize2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { FEATURES } from '../config/features'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { InjectionMapCanvas, type InjectionFocusRequest } from '../components/injection3d/InjectionMapCanvas'
import { InjectionIntroSheet, INJECTION_INTRO_VERSION } from '../components/injection3d/InjectionIntroSheet'
import { InjectionLogSheet, type InjectionSaveInput } from '../components/injection3d/InjectionLogSheet'
import { InjectionTrackerTabs } from '../components/injection3d/InjectionTrackerTabs'
import { InjectionEditSheet } from '../components/injection3d/InjectionEditSheet'
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

const SETUP_SQL = `create table if not exists injection_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  dose_log_id uuid,
  site text not null,
  notes text,
  logged_at timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table injection_logs
  add column if not exists stack_item_id uuid references stack_items on delete set null,
  add column if not exists cycle_id uuid references cycles on delete set null,
  add column if not exists dose numeric(10,3),
  add column if not exists unit text,
  add column if not exists method text,
  add column if not exists body_region text,
  add column if not exists body_side text,
  add column if not exists model_version text,
  add column if not exists position jsonb,
  add column if not exists normal jsonb,
  add column if not exists uv jsonb,
  add column if not exists camera_state jsonb,
  add column if not exists warning_state text,
  add column if not exists substance_label text;

alter table injection_logs enable row level security;

do $$ begin
  create policy "Own injection logs" on injection_logs
    for all using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

create index if not exists injection_logs_user_logged_at_idx
  on injection_logs (user_id, logged_at desc);
create index if not exists injection_logs_user_cycle_idx
  on injection_logs (user_id, cycle_id, logged_at desc);
create index if not exists injection_logs_user_region_idx
  on injection_logs (user_id, body_region, body_side, logged_at desc);
create unique index if not exists injection_logs_dose_log_id_unique_idx
  on injection_logs (dose_log_id)
  where dose_log_id is not null;`;

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
    toast.success('Einnahme ausgewählt. Markiere jetzt die Injektionsstelle.')
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
          ? 'Injektionsstelle hinzugefügt'
          : 'Injektion & Einnahme gespeichert'
        : 'Injektion gespeichert')
      setDraftPin(null)
      setShowLogSheet(false)
      setSelectedTargetIntakeKey(null)
      await loadData()
    } catch (error) {
      console.error('[InjektionsTracker] saveDraftPin error:', error)
      if (isDoseLogAlreadyLinkedError(error)) {
        toast.error('Für diese Einnahme wurde bereits eine Injektionsstelle gespeichert')
        setShowLogSheet(false)
        setSelectedTargetIntakeKey(null)
        await loadData()
        return
      }
      if (isInjectionProSchemaError(error)) {
        setShowLogSheet(false)
        setTableError(true)
        toast.error('Datenbank-Update erforderlich')
        return
      }
      await loadData()
      toast.error('Fehler beim Speichern')
    }
  }

  if (timelineLoadError) return <div role="alert">
    {t('inj_plan_load_error')}
    <button type="button" onClick={() => void loadData()}>{t('routine_confirmation_retry')}</button>
  </div>
  if (tableError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        <PageHeader onBack={goBack} />
        <SetupRequired onRetry={() => { setTableError(false); loadData() }} />
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
          />

          <button
            type="button"
            aria-label={String(t('injection_camera_reset', { defaultValue: 'Torso zentrieren' }))}
            onClick={() => setCameraResetRequestId(value => value + 1)}
            className="absolute right-4 z-30 grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/55 text-slate-100 shadow-[0_10px_28px_rgba(0,0,0,0.42)] backdrop-blur-xl"
            style={{ top: 'calc(88px + env(safe-area-inset-top))' }}
          >
            <Minimize2 size={18} aria-hidden="true" />
          </button>

          {activeLog && visibleLogIds.has(activeLog.id) && (
            <div
              className="injection-active-pin-chip pointer-events-none absolute left-4 right-4 z-30 flex justify-center"
              style={{ top: 'calc(78px + env(safe-area-inset-top))' }}
            >
              <div
                className="flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                style={{ background: 'rgba(7, 11, 24, 0.78)', borderColor: 'rgba(255,255,255,0.12)' }}
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
                className="flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                style={{ background: 'rgba(7, 11, 24, 0.78)', borderColor: 'rgba(34,211,238,0.22)' }}
              >
                <span className="shrink-0 text-[0.62rem] font-black uppercase text-cyan-300">Ausgewählt</span>
                <span className="min-w-0 flex-1 truncate">{activeTargetIntake.stackItemName}</span>
                <span className="shrink-0 text-cyan-100/80">{activeTargetIntake.dose} {activeTargetIntake.unit} - {format(parseISO(activeTargetIntake.scheduledAt), 'HH:mm')}</span>
              </div>
            </div>
          )}
          {showPositionActions && (
            <div
              className="absolute left-3 right-3 z-20 rounded-2xl border p-3"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                boxShadow: '0 -6px 32px rgba(0,0,0,0.5)',
                bottom: 'calc(14px + env(safe-area-inset-bottom))',
              }}
            >
              <div className="flex gap-3">
                <button type="button" className="btn-secondary min-h-11 flex-1" onClick={() => { setDraftPin(null); setSelectedTargetIntakeKey(null) }}>{t('injection_position_cancel', { defaultValue: 'Abbrechen' })}</button>
                <button type="button" className="btn-primary min-h-11 flex-1" onClick={() => setShowLogSheet(true)}>{t('injection_position_accept', { defaultValue: 'Position übernehmen' })}</button>
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
        <div role="alert" className="fixed left-4 right-4 top-24 z-50 rounded-2xl border border-amber-500/25 bg-slate-950/95 p-3 text-sm font-bold text-amber-200 shadow-2xl backdrop-blur-xl">
          <p>{t('inventory_committed_retry', { defaultValue: 'Die Einnahme ist gespeichert, aber der Bestand wurde nicht aktualisiert.' })}</p>
          <button
            type="button"
            onClick={() => void Promise.all(inventoryRetryIds.map(retryCommittedStock))}
            className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/15 px-3 text-sm font-black text-amber-100 transition-colors hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
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
        style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: overlay ? 'rgba(8,13,26,0.72)' : 'var(--surface)',
          border: '1px solid var(--border)',
          backdropFilter: overlay ? 'blur(16px)' : undefined,
          WebkitBackdropFilter: overlay ? 'blur(16px)' : undefined,
          pointerEvents: overlay ? 'auto' : undefined,
          color: 'var(--text-dim)',
        }}
      >
        <ArrowLeft size={16} />
      </button>
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0,
          textTransform: 'uppercase', color: 'var(--accent)',
          textShadow: overlay ? '0 2px 12px rgba(0,0,0,0.75)' : undefined,
        }}>
          {t('injection_pro_title', { defaultValue: 'Injektionstracker Pro' })}
        </p>
        <h1 style={{ fontSize: '1.32rem', fontWeight: 900, color: 'var(--text)', letterSpacing: 0, lineHeight: 1.1, textShadow: overlay ? '0 2px 14px rgba(0,0,0,0.8)' : undefined }}>
          {t('injection_map_title', { defaultValue: '3D Injektionskarte' })}
        </h1>
      </div>
    </div>
  )
}

// ── SetupRequired ─────────────────────────────────────────────────────────────

function SetupRequired({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Clipboard nicht verfügbar')
    }
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 22,
      padding: 22,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 18,
        background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 14px',
      }}>
        <AlertTriangle size={22} color="#f59e0b" />
      </div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', textAlign: 'center', marginBottom: 8 }}>
        {t('inj_setup_required', { defaultValue: 'Datenbank-Setup erforderlich' })}
      </h2>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center', marginBottom: 18 }}>
        {t('inj_setup_hint', { defaultValue: 'Führe folgendes SQL im Supabase SQL-Editor aus, um den Injektions-Tracker zu aktivieren.' })}
      </p>

      <div style={{
        background: 'rgba(0,0,0,0.45)', border: '1px solid var(--accent-border)',
        borderRadius: 14, padding: '12px 14px', marginBottom: 14,
      }}>
        <pre style={{
          fontSize: '0.6rem', color: 'var(--accent)',
          overflowX: 'auto', margin: 0, lineHeight: 1.65,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
        }}>
          {SETUP_SQL}
        </pre>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1, padding: '11px 0', borderRadius: 14,
            background: 'var(--accent-weak)', border: '1px solid var(--accent-border)',
            color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Copy size={14} />
          {copied
            ? t('inj_copied', { defaultValue: 'Kopiert ✓' })
            : t('inj_copy_sql', { defaultValue: 'SQL kopieren' })}
        </button>
        <button
          onClick={onRetry}
          style={{
            flex: 1, padding: '11px 0', borderRadius: 14,
            background: 'var(--surface)', border: '1px solid var(--border-strong)',
            color: 'var(--text-dim)', fontSize: '0.78rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <RefreshCw size={14} />
          {t('inj_retry', { defaultValue: 'Erneut versuchen' })}
        </button>
      </div>
    </div>
  )
}
