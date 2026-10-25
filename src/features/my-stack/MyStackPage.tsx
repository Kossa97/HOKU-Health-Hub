import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type UIEvent as ReactUIEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, Minus, Trash2, Activity,
  CalendarRange, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown,
  X, ExternalLink,
  Archive, Info,
  RotateCcw,
} from 'lucide-react'
import { useNew } from '../../lib/useNew'
import { format, parseISO, addDays } from 'date-fns'
import { effectiveQuantity, scheduleForDay } from '../../lib/intakeSchedule'
import { buildDoseAdjustmentBackfillUpdates, type DoseAdjustmentBackfillLog } from '../../lib/doseAdjustmentBackfill'
import type { VialStageLightHandle } from '../../components/PeptideVialVisual'
import { useSloshEngine } from '../../components/SloshContext'
import { LabLoader } from '../../components/LabLoader'
import { StackItemWizard } from './components/StackItemWizard'
import { hapticTick } from '../../lib/haptics'
import {
  detailAbschnitte, LEER_AUSBLENDEN, wirkstoffBezug,
  type DetailFeld,
} from './lib/stackDetailSections'
import { BestandCard, BestandEditorHost, type BestandActions, type BestandEditorArt } from './components/Bestand'
import { anbruchArt, spritzenRechnung, stueckRechnung, vialBuchtUeberBestand } from './lib/bestand'
import {
  openInventoryContainer,
  startInventory,
  saveInventoryDetails,
  updateInventory,
  uploadBatchDocument,
} from './services/stackInventory'
import { produktAngaben, type Angabe, type Zutat } from './lib/produktAngaben'
import { StackStage } from './components/StackStage'
import { StackArchive } from './components/StackArchive'
import { archiveStackItem, deleteStackItem, reconstituteStackItem, removePlanSegment, restoreStackItem, planScheduleSnapshot, savePlanChange, saveStackItem, saveStackItemSetup } from './services/stackItems'
import { powderVialForSave } from './lib/vialStrength'
import type { StackItem, StackItemSetupDraft } from './types'
import { getDosageForm, intakeUnitLabelKey, isStageRenderable } from './lib/dosageForms'
import { methodLabel } from '../../lib/intakeMethods'
import { laterChangeIdentity, type WizardSaveMode } from './lib/wizardState'
import type { LaterPlanStep } from './lib/planAdoption'
import { filterByTab, tabCounts, type StackTabKey } from './lib/stackTabs'
import { sortAbilities } from './lib/stackSort'
import { planSegments, planVersionSegments, stufenText } from './lib/planSegments'
import { cyclePeriod } from './lib/planCard'
import { getRandomStackItemColor } from './lib/colors'
import { backfillMessageKey, buildTitrationStep, dosePlanCapabilities, dosePlanQuantitiesForDay } from './lib/dosePlan'
import { FEATURES } from '../../config/features'
import { reportError } from '../../lib/monitoring'
import { formatInstantDay, formatLocalDay, shiftLocalDay } from './lib/localDays'
import { daysLabel, stockAmountLabel } from './lib/bestandLabels'
import { PlanManagementSection } from './components/PlanManagementSection'
import { PlanSummaryCard } from './components/PlanSummaryCard'
import { orderTimelines } from './lib/planLabels'
import { CourseTimezoneReview } from './components/CourseTimezoneReview'
import { resolveCycleCourseTimezone } from './services/planLifecycle'
import {
  endCycle as endTimelineCycle,
  pauseCycle,
  removeFuturePlanVersion,
  replaceFuturePlanVersion,
  resolveCycleMigrationConflict,
  restartCycle,
  resumeCycle,
  setPauseEnd,
} from './services/planLifecycle'
import {
  resolveCycleAt,
  type CyclePlanVersion,
  type CycleTimeline,
  type PlanChangeKind,
} from '../../lib/planTimeline'
import type { PlanChangeSubmission, PlanEditContext } from './lib/wizardState'
import {
  type Peptide,
  type Cycle,
  type Escalation,
  type EscalationForm,
  emptyEscalationForm,
  type InfoRow,
  type CycleView,
  readLocalFlag,
  writeLocalFlag,
  type PeptideSortKey,
  MY_STACK_DETAIL_HISTORY_KEY,
  historyStateRecord,
  PEPTIDE_SORT_GROUPS,
  NO_TIMELINES,
  ADD_SLOT,
  sortPeptides,
  FREQ_KEYS,
  INTAKE_TIME_CONFIG,
  REMINDER_OPTIONS,
  parseStoredDay,
  withEffectiveEscalationUnit,
  cycleAsIntakePlanDraft,
  type RecoverableMutation,
  planChangeSubmissionIdentity,
  versionAsIntakePlanDraft,
  versionSnapshot,
} from './page/model'
import { AddVialTile } from './page/stackTiles'
import { StackTabBar } from './page/StackTabBar'
import { useMyStackData } from './page/useMyStackData'
import { BewertenAnstoss } from '../reviews/components/BewertenAnstoss'
import { DeleteSubstanceDialog } from './page/DeleteSubstanceDialog'
import { VialCarousel } from './page/VialCarousel'
import { StageDetailView } from './page/StageDetailView'
import { PlanOverviewSheet } from './page/PlanOverviewSheet'
import { StackListView } from './page/StackListView'
import { MyStackHeader } from './page/MyStackHeader'
import { LegacyCycleManager } from './page/LegacyCycleManager'
import { RekonstitutionDialog } from './page/RekonstitutionDialog'
import { EscalationFormSheet } from './page/EscalationFormSheet'


// ─── Hauptkomponente ──────────────────────────────────────────────────────────

interface MyStackPageProps {
  stackDataClient?: typeof supabase
}

export function MyStackPage({ stackDataClient = supabase }: MyStackPageProps = {}) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // ── Bestätigungs-Dialoge ──────────────────────────────────────────────────
  const [rekonstitutionTarget, setRekonstitutionTarget] = useState<Peptide | null>(null)
  const [rekonstitutionDontAsk,setRekonstitutionDontAsk]= useState(false)

  // ── Neu-Signale ───────────────────────────────────────────────────────────
  const [, dismissZyklusBtn]                   = useNew('zyklus_btn')

  // ── Inventar ─────────────────────────────────────────────────────────────
  // ── Laden ─────────────────────────────────────────────────────────────────
  // Stack, Zyklen, Zeitleisten, Bestand, Katalog und Dosisanpassungen — samt
  // erstem Laden beim Oeffnen. Siehe page/useMyStackData.ts.
  const {
    inventory, peptides, setPeptides, loading, initialLoad,
    cycles, cycleTimelines, setCycleTimelines, timelineLoadError,
    timelineLoading, catalogEntries, catalogUnavailable,
    archivedPeptides, escalations,
    loadInventory, loadPeptides, loadArchived, loadCycles, loadTimelines, loadEscalations,
    reloadTimelinesAndPeptides,
  } = useMyStackData({ stackDataClient, userId: user?.id })

  // ── Peptide ───────────────────────────────────────────────────────────────
  // Eine eben gespeicherte Substanz: ihre Zeile in der Liste rueckt ins Bild und leuchtet kurz.
  const [hervorgehobenId, setHervorgehobenId] = useState<string | null>(null)
  const hervorhebungGesehen = useCallback(() => setHervorgehobenId(null), [])
  const [showPeptideForm, setShowPeptideForm] = useState(false)
  const [editingPeptideId, setEditingPeptideId] = useState<string | null>(null)
  const [wizardInitialColor, setWizardInitialColor] = useState('')
  const [wizardIntent, setWizardIntent] = useState<'pk' | 'plan' | undefined>()
  const [wizardCycleId, setWizardCycleId] = useState<string | null>(null)
  const [planEditContext, setPlanEditContext] = useState<PlanEditContext | null>(null)
  const planSaveRecoveryRef = useRef<(RecoverableMutation & { identity: string }) | null>(null)
  const lifecycleIdempotencyKeysRef = useRef(new Map<string, RecoverableMutation>())
  // Ein zweiter Plan statt einer Aenderung am bestehenden.
  const [wizardNeuerZyklus, setWizardNeuerZyklus] = useState(false)
  const [search, setSearch]                   = useState('')
  const [searchOpen, setSearchOpen]           = useState(false)
  const [filterOpen, setFilterOpen]           = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [sortBy, setSortBy]                   = useState<PeptideSortKey>('active_name')
  const [activeTab, setActiveTab]             = useState<StackTabKey>('all')
  const [viewMode, setViewModeState]          = useState<'vials' | 'list'>(() =>
    localStorage.getItem('tyd_peptide_view') === 'list' ? 'list' : 'vials'
  )
  const [activePeptideId, setActivePeptideId] = useState<string | null>(null)
  // Ein gerade angelegter Eintrag, der auf die Buehne soll, sobald er im
  // Karussell steht (siehe den Effekt an `neuZentrieren`).
  const [neuZentrieren, setNeuZentrieren] = useState<string | null>(null)
  // Das Rechteck des angetippten Objekts — der Startpunkt des Flugs.
  const [detailUrsprung, setDetailUrsprung] = useState<DOMRect | null>(null)
  const detailHistoryPeptideId = typeof historyStateRecord(location.state)[MY_STACK_DETAIL_HISTORY_KEY] === 'string'
    ? historyStateRecord(location.state)[MY_STACK_DETAIL_HISTORY_KEY] as string
    : null
  const [isVialCarouselDragging, setIsVialCarouselDragging] = useState(false)
  const [addTileActive, setAddTileActive] = useState(false)
  // Stage light bypasses React entirely: each vial registers an imperative
  // handle and the scroll rAF pushes focus/lightOffset straight into the DOM.
  const vialStageLightHandlesRef = useRef(new Map<number, VialStageLightHandle>())
  const vialFocusFrameRef = useRef<number | null>(null)
  const sloshEngine = useSloshEngine()
  const vialCarouselRef = useRef<HTMLDivElement | null>(null)
  const vialScrollFrameRef = useRef<number | null>(null)
  const vialTargetIndexRef = useRef<number | null>(null)
  const vialDraggingRef = useRef(false)
  const vialDragStartXRef = useRef(0)
  const vialDragLastXRef = useRef(0)
  const vialDragLastTimeRef = useRef(0)
  const vialDragStartScrollLeftRef = useRef(0)
  const vialDragMovedRef = useRef(false)
  const vialSuppressClickRef = useRef(false)
  const vialWheelCooldownRef = useRef<number | null>(null)
  const vialLastScrollLeftRef = useRef(0)
  const vialLastScrollTimeRef = useRef(0)
  const [animationEpoch, setAnimationEpoch] = useState(0)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  // ── Zyklen ────────────────────────────────────────────────────────────────
  const [cycleManagerPeptide, setCycleManagerPeptide] = useState<Peptide | null>(null)
  // Ein einzelnes Aenderungsfenster zum Bestand (kein eigenes Bestand-Fenster).
  const [bestandEdit, setBestandEdit] = useState<{ peptideId: string; editor: BestandEditorArt } | null>(null)
  // Zyklus-Manager: welche inaktiven Karten / Dosisanpassungs-Sektionen sind aufgeklappt
  // Substanz entfernen: Archivieren vs. endgültig löschen
  const [deletePromptPeptide, setDeletePromptPeptide] = useState<Peptide | null>(null)
  const [deletePromptFromArchive, setDeletePromptFromArchive] = useState(false)
  const [deletingPeptide, setDeletingPeptide]     = useState(false)
  const [archiveViewOpen, setArchiveViewOpen]     = useState(false)
  const [archiveInfoPeptide, setArchiveInfoPeptide] = useState<Peptide | null>(null)
  const [archiveCyclesOpen, setArchiveCyclesOpen] = useState(false)
  const archiveInfoBackButtonRef = useRef<HTMLButtonElement | null>(null)
  const archiveDialogRef = useRef<HTMLDivElement | null>(null)
  const archiveCloseButtonRef = useRef<HTMLButtonElement | null>(null)

  // ── Dosisanpassungen ──────────────────────────────────────────────────────
  const [showEscForm, setShowEscForm]             = useState(false)
  const [escForCycle, setEscForCycle]             = useState<Cycle | null>(null)
  const [editingEscId, setEditingEscId]           = useState<string | null>(null)
  const [eForm, setEForm]                         = useState<EscalationForm | null>(null)
  const [savingEsc, setSavingEsc]                 = useState(false)

  const openArchiveInfo = (p: Peptide) => {
    setArchiveCyclesOpen(false)
    setArchiveInfoPeptide(p)
    window.requestAnimationFrame(() => archiveInfoBackButtonRef.current?.focus())
  }

  useEffect(() => {
    if (!archiveViewOpen) return

    const dialog = archiveDialogRef.current
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    archiveCloseButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      const nestedDialog = document.querySelector<HTMLElement>('[data-archive-delete-confirmation]')
      const archiveInfoDialog = document.querySelector<HTMLElement>('[data-archive-info-detail]')
      const focusScope = nestedDialog ?? archiveInfoDialog ?? dialog
      if (e.key === 'Escape') {
        e.preventDefault()
        if (nestedDialog) {
          setDeletePromptFromArchive(false)
          setDeletePromptPeptide(null)
          window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus())
        } else if (archiveInfoDialog) {
          const peptideId = archiveInfoDialog.dataset.archiveInfoDetail
          setArchiveInfoPeptide(null)
          window.requestAnimationFrame(() => {
            if (peptideId) document.querySelector<HTMLButtonElement>(`[data-archive-info-button="${peptideId}"]`)?.focus()
          })
        } else {
          setArchiveViewOpen(false)
        }
        return
      }
      if (e.key !== 'Tab') return

      const focusable = Array.from(focusScope?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!focusScope?.contains(document.activeElement)) {
        e.preventDefault()
        const target = e.shiftKey ? last : first
        target.focus()
        return
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [archiveViewOpen])



  useEffect(() => {
    setAnimationEpoch(e => e + 1)
  }, [location.key])

  useEffect(() => {
    if (location.hash !== '#new-substance') return
    setEditingPeptideId(null)
    setWizardCycleId(null)
    setPlanEditContext(null)
    setWizardIntent(undefined)
    setWizardInitialColor(getRandomStackItemColor())
    setShowPeptideForm(true)
    navigate(location.pathname, { replace: true })
  }, [location.hash, location.pathname, navigate])

  useEffect(() => {
    if (loading) return
    const params = new URLSearchParams(location.search)
    if (params.get('intent') !== 'pk') return
    const stackItemId = params.get('edit')
    if (!stackItemId || !peptides.some(item => item.id === stackItemId)) return

    setEditingPeptideId(stackItemId)
    setWizardCycleId(null)
    setPlanEditContext(null)
    setWizardInitialColor('')
    setWizardIntent('pk')
    setShowPeptideForm(true)
    navigate(location.pathname, { replace: true })
  }, [loading, location.pathname, location.search, navigate, peptides])

  useEffect(() => {
    if (loading || timelineLoading || timelineLoadError || !FEATURES.planTimelineV2) return
    const params = new URLSearchParams(location.search)
    if (params.get('review') !== 'timezone') return
    const requestedStackItemId = params.get('stackItem')
    const pendingStackItemIds = new Set(cycleTimelines
      .filter(timeline => timeline.cycle.timezone_review_required)
      .map(timeline => timeline.cycle.stack_item_id))
    const targetId = requestedStackItemId && pendingStackItemIds.has(requestedStackItemId)
      ? requestedStackItemId
      : pendingStackItemIds.values().next().value
    const target = peptides.find(item => item.id === targetId)
    const frame = window.requestAnimationFrame(() => {
      if (target) setCycleManagerPeptide(target)
      navigate(location.pathname, { replace: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [cycleTimelines, loading, location.pathname, location.search, navigate, peptides, timelineLoadError, timelineLoading])

  const activePeptideIds = useMemo(
    () => new Set(cycles.filter(c => c.active).map(c => c.stack_item_id)),
    [cycles],
  )
  const gesuchtePeptides = peptides.filter(
    p => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  )
  // Was in den Reitern steht, zaehlt ueber den GANZEN Stack — nicht ueber die
  // gerade gefilterte Liste, sonst zeigte jeder Reiter ausser dem offenen 0.
  const reiterZaehler = tabCounts(peptides)
  // Ein leerer Reiter laesst sich nicht waehlen. Wird der offene leer (letzte
  // Substanz archiviert oder geloescht), gilt wieder „Alle" — sonst stuende
  // das Karussell ohne Inhalt da, und mit ihm verschwaende die Reiterleiste.
  const offenerReiter: StackTabKey = (reiterZaehler.get(activeTab) ?? 0) > 0 ? activeTab : 'all'
  const offeneKategorie = filterByTab(gesuchtePeptides, offenerReiter)
  // …und merkt sich das: kommt spaeter wieder etwas in die alte Kategorie,
  // springt die Ansicht nicht ungefragt dorthin zurueck.
  useEffect(() => {
    if (offenerReiter !== activeTab) setActiveTab(offenerReiter)
  }, [offenerReiter, activeTab])
  // Welche Sortierungen dieser Reiter ueberhaupt beantworten kann.
  const moeglicheSortierungen = sortAbilities(offeneKategorie)
  // Sortiert jemand nach Fuellstand und wechselt dann in einen Reiter ohne
  // Vials, gaebe es die gewaehlte Sortierung dort nicht mehr — die Auswahl
  // zeigte einen Wert, den das Menue gar nicht fuehrt. Dann zurueck auf die
  // Vorgabe, die immer geht.
  const sortierungMoeglich = PEPTIDE_SORT_GROUPS.some(group => (
    group.options.includes(sortBy) && (!group.needs || moeglicheSortierungen.has(group.needs))
  ))
  const wirksameSortierung: PeptideSortKey = sortBy === 'active_name' || sortierungMoeglich
    ? sortBy
    : 'active_name'
  const displayPeptides = sortPeptides(offeneKategorie, wirksameSortierung, activePeptideIds)
  const stagePeptides = displayPeptides.filter(p => isStageRenderable(p.dosage_form))
  const listPeptides = viewMode === 'list'
    ? displayPeptides
    : displayPeptides.filter(p => !isStageRenderable(p.dosage_form))

  const setViewMode = (mode: 'vials' | 'list') => {
    setViewModeState(mode)
    localStorage.setItem('tyd_peptide_view', mode)
  }

  useEffect(() => {
    if (stagePeptides.length === 0) {
      if (activePeptideId) setActivePeptideId(null)
      return
    }
    if (!activePeptideId || !stagePeptides.some(p => p.id === activePeptideId)) {
      setActivePeptideId(stagePeptides[0].id)
    }
  }, [activePeptideId, stagePeptides])

  const cyclesOf      = (pid: string) => cycles
    .filter(c => c.stack_item_id === pid)
    .sort((a, b) =>
      (a.active === b.active)
        ? b.created_at.localeCompare(a.created_at)
        : (a.active ? -1 : 1))
  const escalationsOf = (cid: string) => escalations.filter(e => e.cycle_id === cid)
  // Je Eintrag EINE Liste, solange sich die Plaene nicht aendern: Bestand-Karte
  // und -Ansicht rechnen die Reichweite nur neu, wenn sich ihre Liste aendert.
  const timelinesByItem = useMemo(() => {
    const byItem = new Map<string, CycleTimeline[]>()
    for (const timeline of cycleTimelines) {
      const list = byItem.get(timeline.cycle.stack_item_id)
      if (list) list.push(timeline)
      else byItem.set(timeline.cycle.stack_item_id, [timeline])
    }
    return byItem
  }, [cycleTimelines])
  const timelinesOf = (stackItemId: string) => timelinesByItem.get(stackItemId) ?? NO_TIMELINES
  const currentCycleManagerPeptide = cycleManagerPeptide
    ? peptides.find(peptide => peptide.id === cycleManagerPeptide.id) ?? cycleManagerPeptide
    : null

  // ── Bestand (stack_item_inventory) ──────────────────────────────────────
  // Die Ansicht ruft nur diese Aktionen; nach jeder wird neu geladen, damit
  // Liste, Vial-Grafik und Karte denselben Stand zeigen. Fehler meldet sie
  // hier und reicht sie weiter, damit der Editor offen bleibt.
  const bestandActions = (p: Peptide): BestandActions => {
    const inventoryId = () => {
      if (!p.inventory?.id) throw new Error('Inventory missing')
      return p.inventory.id
    }
    const guarded = async (work: () => PromiseLike<unknown>) => {
      try {
        await work()
      } catch (error) {
        toast.error(t('my_stack_stock_save_failed'))
        throw error
      }
      await loadPeptides()
    }
    return {
      start: input => guarded(() => startInventory(stackDataClient as never, { userId: user!.id, stackItemId: p.id, ...input })),
      update: patch => guarded(() => updateInventory(stackDataClient as never, inventoryId(), patch)),
      openContainer: input => guarded(() => openInventoryContainer(stackDataClient as never, inventoryId(), input)),
    }
  }
  const bestandPeptide = bestandEdit ? peptides.find(peptide => peptide.id === bestandEdit.peptideId) ?? null : null

  // ── Rekonstitution wiederholen ────────────────────────────────────────────
  const handleRekonstitution = (p: Peptide) => {
    if (readLocalFlag('_skip_rekonstitution')) { doRekonstitution(p); return }
    setRekonstitutionDontAsk(false); setRekonstitutionTarget(p)
  }
  const doRekonstitution = async (p: Peptide) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    await reconstituteStackItem(supabase as never, p.id, today)
    setPeptides(prev => prev.map(pp =>
      pp.id === p.id ? { ...pp, reconstitution_date: today, vials_in_stock: 1, vials_initial: 1 } : pp
    ))
    if (p.inventory_item_id) {
      const invItem = inventory.find(i => i.id === p.inventory_item_id)
      if (invItem) {
        await supabase.from('inventory_items')
          .update({ vials_count: Math.max(0, invItem.vials_count - 1) })
          .eq('id', p.inventory_item_id)
        loadInventory()
      }
    }
    toast.success(t('rekonstitution_erneuert'))
    setRekonstitutionTarget(null); loadPeptides()
  }
  const confirmRekonstitution = () => {
    if (!rekonstitutionTarget) return
    if (rekonstitutionDontAsk) writeLocalFlag('_skip_rekonstitution')
    doRekonstitution(rekonstitutionTarget)
  }

  // ── Peptid CRUD ───────────────────────────────────────────────────────────
  const handleNewPeptide = () => {
    setEditingPeptideId(null)
    setWizardCycleId(null)
    setWizardNeuerZyklus(false)
    setPlanEditContext(null)
    setWizardIntent(undefined)
    setWizardInitialColor(getRandomStackItemColor())
    setShowPeptideForm(true)
  }

  const openEditPeptide = (p: Peptide) => {
    setEditingPeptideId(p.id)
    setWizardCycleId(null)
    setPlanEditContext(null)
    setWizardIntent(undefined)
    setWizardInitialColor('')
    setShowPeptideForm(true)
  }

  const handleSaveStackItem = async (
    draft: StackItemSetupDraft,
    _mode: WizardSaveMode,
    idempotencyKey: string,
  ) => {
    // Ein neu gewaehltes Analyse-Dokument erst jetzt hochladen: wer abbricht,
    // hinterlaesst nichts. Schlaegt es fehl, ist noch nichts gespeichert.
    const editedFrom = editingPeptideId ? peptides.find(item => item.id === editingPeptideId) ?? null : null
    let inventoryDraft = powderVialForSave(draft).inventory
    if (editedFrom && inventoryDraft.batchFile && user) {
      try {
        inventoryDraft = { ...inventoryDraft, batchFileUrl: await uploadBatchDocument(supabase as never, user.id, inventoryDraft.batchFile), batchFile: null }
      } catch (error) {
        toast.error(t('datei_upload_fehler'))
        throw error
      }
    }
    const savedRow = FEATURES.planTimelineV2 && draft.id && !wizardCycleId && !wizardNeuerZyklus
      ? await saveStackItem(stackDataClient as never, draft)
      : await saveStackItemSetup(stackDataClient as never, draft, idempotencyKey)
    // Beim Bearbeiten schreibt `save_stack_item` den Bestand nicht mit: die
    // Angaben zur Packung (Charge, Anmischen, Haltbarkeit) gehen extra — auch
    // fuer eine neue Variante, die aus einem bestehenden Eintrag entsteht.
    // Der Eintrag selbst steht dann schon; scheitert nur das, sagt es eine
    // eigene Meldung, statt „Speichern fehlgeschlagen" fuer alles.
    if ((editedFrom || inventoryDraft.reconstitutionMl != null) && user) {
      try {
        await saveInventoryDetails(stackDataClient as never, {
          userId: user.id,
          stackItemId: savedRow.id,
          before: draft.id === editedFrom?.id ? editedFrom?.inventory ?? null : null,
          draft: inventoryDraft,
        })
      } catch {
        toast.error(t('my_stack_stock_save_failed'))
      }
    }
    // Gespeichert ist ab hier. Scheitert nur das Neuladen, ist das kein
    // „Speichern fehlgeschlagen" — sonst speicherte man dasselbe ein zweites Mal.
    const neuGeladen = await Promise.allSettled([
      loadPeptides(),
      loadCycles(),
      ...(FEATURES.planTimelineV2 ? [loadTimelines(true)] : []),
    ])
    const nichtGeladen = neuGeladen.filter((ergebnis): ergebnis is PromiseRejectedResult => ergebnis.status === 'rejected')
    if (nichtGeladen.length > 0) {
      toast.error(t('error'))
      nichtGeladen.forEach(ergebnis => reportError(ergebnis.reason, 'my-stack.reload-after-save'))
    }
    setHervorgehobenId(savedRow.id)
    if (!draft.id) setNeuZentrieren(savedRow.id)
    toast.success(draft.id ? t('peptid_aktualisiert') : t('peptid_hinzugefuegt'))
  }

  const openExistingStackItem = (item: StackItem) => {
    setActivePeptideId(item.id)
    setViewMode('list')
    setHervorgehobenId(item.id)
  }

  const removePeptide = (id: string) => {
    const p = peptides.find(pp => pp.id === id)
    if (p) {
      setDeletePromptFromArchive(false)
      setDeletePromptPeptide(p)
    }
  }

  // „Behalten": Substanz aus My Stack ausblenden, alle Daten bleiben verknüpft.
  // V2 unterdrueckt archivierte Eintraege beim Lesen, ohne ihre Cycles zu beenden.
  const archivePeptide = async (p: Peptide) => {
    setDeletingPeptide(true)
    try {
      await archiveStackItem(supabase as never, p.id)
      if (!FEATURES.planTimelineV2) {
        const { error } = await supabase.from('cycles').update({ active: false }).eq('stack_item_id', p.id).eq('active', true)
        if (error) throw error
      }
    } catch {
      toast.error(t('error'))
      setDeletingPeptide(false)
      return
    }
    toast.success(t('substanz_archiviert'))
    setDeletePromptFromArchive(false)
    setDeletePromptPeptide(null); setDeletingPeptide(false)
    loadPeptides(); loadCycles()
  }

  // „Endgültig löschen": Substanz + ALLE zugehörigen Daten entfernen.
  // dose_logs / injection_logs / effects stehen auf ON DELETE SET NULL und müssen
  // explizit gelöscht werden, sonst bleiben namenlose Geister-Einträge zurück.
  // cycles, dose_escalations, vials, reviews werden per CASCADE mit entfernt.
  const hardDeletePeptide = async (p: Peptide) => {
    setDeletingPeptide(true)
    try {
      // Scheitert eines davon, bleibt der Eintrag stehen: sonst blieben die
      // Protokolle ohne Zuordnung zurueck und waeren nicht mehr zu loeschen.
      const ergebnisse = await Promise.all(['dose_logs', 'injection_logs', 'effects'].map(table => (
        supabase.from(table).delete().eq('stack_item_id', p.id)
      )))
      const fehler = ergebnisse.find(ergebnis => ergebnis.error)?.error
      if (fehler) throw fehler
      await deleteStackItem(supabase as never, p.id)
    } catch (error) {
      reportError(error, 'my-stack.hard-delete')
      toast.error(t('error'))
      setDeletingPeptide(false)
      return
    }
    toast.success(t('geloescht'))
    setDeletePromptFromArchive(false)
    setDeletePromptPeptide(null); setDeletingPeptide(false)
    window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus())
    loadPeptides(); loadCycles(); loadArchived()
  }

  const restorePeptide = async (p: Peptide) => {
    await restoreStackItem(supabase as never, p.id)
    toast.success(t('substanz_wiederhergestellt'))
    loadArchived(); loadPeptides()
  }

  // ── Zyklus-Aktionen ───────────────────────────────────────────────────────
  /**
   * Ein ZWEITER Plan fuer denselben Eintrag.
   *
   * Derselbe Weg wie „Plan aendern", nur ohne den bestehenden Plan im
   * Gepaeck: `save_stack_item_with_plan` legt ohne `p_plan.id` einen neuen
   * Zyklus an, statt den vorhandenen fortzuschreiben.
   */
  const openNewCycle = (p: Peptide) => {
    setEditingPeptideId(p.id)
    setWizardCycleId(null)
    setPlanEditContext(null)
    setWizardInitialColor('')
    setWizardIntent('plan')
    setWizardNeuerZyklus(true)
    setShowPeptideForm(true)
  }
  /**
   * Eine vorgemerkte Stufe zuruecknehmen.
   *
   * Geprueft wird im RPC, nicht hier: dass nur Kuenftiges geht, ist eine
   * Regel ueber die Daten und gehoert dorthin, wo sie sich nicht umgehen
   * laesst. Hier steht nur, was danach zu sehen ist.
   */
  const stufeZuruecknehmen = async (c: Cycle, effectiveFrom: string) => {
    try {
      await removePlanSegment(supabase, c.id, effectiveFrom)
      await loadCycles()
      toast.success(String(t('my_stack_plan_step_removed', { defaultValue: 'Stufe zurückgenommen.' })))
    } catch {
      toast.error(String(t('my_stack_plan_step_remove_failed', {
        defaultValue: 'Die Stufe konnte nicht zurückgenommen werden.',
      })))
    }
  }

  /**
   * Den Einnahmeplan eines Eintrags aendern.
   *
   * Frueher oeffnete das ein eigenes Zyklusformular, das direkt in `cycles`
   * schrieb — am RPC vorbei und damit an dessen Pruefungen. Es kannte
   * `slot_doses`, `slot_days`, `interval_unit` und die Wechseltage gar nicht:
   * ein `update` liess sie stehen, waehrend es `intake_time` ueberschrieb, und
   * die Listen liefen auseinander. Seine Segmentlogik war eine zweite, engere
   * Kopie der des RPC.
   *
   * Jetzt fuehrt auch dieser Weg durch den Assistenten und damit durch
   * `save_stack_item_with_plan`: ein Schreibweg, eine Pruefung, eine
   * Segmentlogik.
   */
  // Oeffnet den Plan-Editor. Alle Wege dorthin setzen denselben Zustand.
  const openPlanWizard = (p: Peptide, context: PlanEditContext | null, legacyCycleId: string | null) => {
    setPlanEditContext(context)
    setWizardCycleId(legacyCycleId)
    setEditingPeptideId(p.id)
    setWizardInitialColor('')
    setWizardNeuerZyklus(false)
    setWizardIntent('plan')
    setShowPeptideForm(true)
  }

  // Was fuer jeden Stichtag im Zyklus gilt: kein Tag, an dem schon eine Stufe
  // beginnt (ausser der bearbeiteten), und keiner nach einem festen Ende.
  const effectiveDateLimits = (timeline: CycleTimeline, exceptVersionId: string | null) => ({
    takenEffectiveDates: timeline.versions
      .filter(version => version.id !== exceptVersionId && version.effective_kind === 'local_date')
      .map(version => version.effective_local_date)
      .filter((day): day is string => Boolean(day)),
    maxEffectiveDate: cyclePeriod(timeline, timeZone).last,
  })

  // Die geplanten Stufen, im Format, in dem der Assistent speichert — damit
  // der Vergleich „traegt die Stufe noch den alten Plan?" gleich rechnet.
  const laterStepsOf = (
    p: Peptide,
    timeline: CycleTimeline,
    segments = planVersionSegments(timeline, new Date(), timeZone),
  ): LaterPlanStep[] => segments.flatMap(({ version, status }) => {
    if (status !== 'future' || version.effective_kind !== 'local_date' || !version.effective_local_date) return []
    const draft = versionAsIntakePlanDraft(timeline, version, timeZone)
    return [{
      versionId: version.id,
      effectiveLocalDate: version.effective_local_date,
      changeKind: version.change_kind,
      snapshot: planScheduleSnapshot(draft, p.tracking_level),
      draft,
    }]
  })

  const openEditCycle = (
    p: Peptide,
    cycleId: string,
    versionId?: string,
    changeKind: Exclude<PlanChangeKind, 'initial'> = 'dose',
  ) => {
    const timeline = cycleTimelines.find(candidate => candidate.cycle.id === cycleId)
    if (FEATURES.planTimelineV2 && timeline) {
      const selectedVersion = versionId
        ? timeline.versions.find(version => version.id === versionId)
        : resolveCycleAt(timeline, new Date(), timeZone).planVersion
      if (!selectedVersion) return
      // Eine geplante Stufe wird an der Stufe DAVOR gemessen: was sie
      // gegenueber ihr aendert, bestimmt, ob sie Dosis- oder Planaenderung ist.
      const segments = planVersionSegments(timeline, new Date(), timeZone)
      const ordered = segments.map(segment => segment.version)
      const previous = versionId ? ordered[ordered.findIndex(version => version.id === versionId) - 1] : undefined
      openPlanWizard(p, {
        target: versionId
          ? { cycleId, versionId, mode: 'replace_future' }
          : { cycleId, versionId: null, mode: 'new_change' },
        snapshot: versionAsIntakePlanDraft(timeline, selectedVersion, timeZone),
        changeKind,
        purpose: versionId ? 'edit_future' : 'adjust',
        timeZone,
        initialEffective: versionId
          ? { kind: 'date', localDate: selectedVersion.effective_local_date }
          : { kind: 'now', localDate: null },
        ...effectiveDateLimits(timeline, versionId ?? null),
        ...(previous ? { baseline: versionAsIntakePlanDraft(timeline, previous, timeZone) } : {}),
        laterSteps: laterStepsOf(p, timeline, segments),
      }, null)
    } else {
      if (!cycles.some(cycle => cycle.id === cycleId && cycle.stack_item_id === p.id)) return
      openPlanWizard(p, null, cycleId)
    }
  }

  // Eine Stufe hinter der letzten: vorausgefuellt mit ihr, das Datum danach
  // vorgewaehlt. Dasselbe Formular wie „Plan anpassen" — nur der Einstieg und
  // die Vorwahl sind anders. Aendern sich nur Mengen, ist es eine Titrationsstufe.
  // Waehlt man einen frueheren Tag oder „ab sofort", belegt der Assistent mit
  // dem Plan vor, der dann gilt (`current`, `laterSteps`).
  const openAddPlanStep = (
    p: Peptide,
    timeline: CycleTimeline,
    template: CyclePlanVersion,
    dates: { minDate: string; maxDate: string | null; defaultDate: string },
  ) => {
    const current = resolveCycleAt(timeline, new Date(), timeZone).planVersion
    openPlanWizard(p, {
      target: { cycleId: timeline.cycle.id, versionId: null, mode: 'new_change' },
      snapshot: versionAsIntakePlanDraft(timeline, template, timeZone),
      changeKind: 'titration',
      purpose: 'add_step',
      timeZone,
      initialEffective: { kind: 'date', localDate: dates.defaultDate },
      ...effectiveDateLimits(timeline, null),
      laterSteps: laterStepsOf(p, timeline),
      ...(current ? { current: versionAsIntakePlanDraft(timeline, current, timeZone) } : {}),
    }, null)
  }

  const replaceTimeline = (next: CycleTimeline) => {
    setCycleTimelines(current => current.map(timeline => (
      timeline.cycle.id === next.cycle.id ? next : timeline
    )))
  }

  const lifecycleKey = (action: string, targetId: string) => {
    const identity = `${action}:${targetId}`
    const existing = lifecycleIdempotencyKeysRef.current.get(identity)
    if (existing) return { identity, mutation: existing }
    const mutation = { key: globalThis.crypto.randomUUID(), committed: false }
    lifecycleIdempotencyKeysRef.current.set(identity, mutation)
    return { identity, mutation }
  }

  const completeLifecycleMutation = (identity: string, next: CycleTimeline) => {
    lifecycleIdempotencyKeysRef.current.delete(identity)
    replaceTimeline(next)
  }

  const saveVersionChange = async (submission: PlanChangeSubmission) => {
    const identity = planChangeSubmissionIdentity(submission)
    let recovery = planSaveRecoveryRef.current
    if (!recovery || recovery.identity !== identity) {
      recovery = { identity, key: globalThis.crypto.randomUUID(), committed: false }
      planSaveRecoveryRef.current = recovery
    }
    if (!recovery.committed) {
      await savePlanChange(
        stackDataClient as never,
        submission.target,
        submission.snapshot,
        submission.effective,
        {
          changeKind: submission.changeKind,
          idempotencyKey: recovery.key,
          timeZone: submission.timeZone,
        },
      )
      recovery.committed = true
    }
    // Danach die geprueften geplanten Stufen: erst entfernen, dann neu
    // schreiben — so ist ein frei gewordener Tag wieder frei. Jede Stufe ist
    // ein eigener, wiederholbarer Schritt. Der neue Plan steht dann schon:
    // auch bei einem Fehler die Ansicht nachladen, damit sie nicht den alten
    // zeigt.
    const laterChanges = [...submission.laterChanges ?? []]
      .sort((left, right) => (left.kind === right.kind ? 0 : left.kind === 'remove' ? -1 : 1))
    try {
      for (const change of laterChanges) {
        const mutation = lifecycleKey('later-step', `${identity}:${laterChangeIdentity(change)}`)
        if (mutation.mutation.committed) continue
        if (change.kind === 'remove') {
          await removeFuturePlanVersion(stackDataClient as never, {
            versionId: change.versionId,
            timeZone: submission.timeZone,
            idempotencyKey: mutation.mutation.key,
          })
        } else {
          await replaceFuturePlanVersion(stackDataClient as never, {
            versionId: change.versionId,
            effectiveKind: 'local_date',
            effectiveAt: null,
            effectiveLocalDate: change.effectiveLocalDate,
            changeKind: change.changeKind,
            schedule: change.schedule,
            timeZone: submission.timeZone,
            idempotencyKey: mutation.mutation.key,
          })
        }
        mutation.mutation.committed = true
      }
    } catch (error) {
      await loadTimelines(true).catch(() => undefined)
      throw error
    }
    await loadTimelines(true)
    for (const change of laterChanges) {
      lifecycleIdempotencyKeysRef.current.delete(`later-step:${identity}:${laterChangeIdentity(change)}`)
    }
    planSaveRecoveryRef.current = null
  }

  const removeFutureVersion = async (version: CyclePlanVersion) => {
    const mutation = lifecycleKey('remove-version', version.id)
    if (!mutation.mutation.committed) {
      await removeFuturePlanVersion(stackDataClient as never, {
        versionId: version.id,
        timeZone,
        idempotencyKey: mutation.mutation.key,
      })
      mutation.mutation.committed = true
    }
    await loadTimelines(true)
    lifecycleIdempotencyKeysRef.current.delete(mutation.identity)
  }

  const pauseTimeline = async (timeline: CycleTimeline, endsAt: string | null) => {
    const mutation = lifecycleKey('pause', timeline.cycle.id)
    const next = await pauseCycle(stackDataClient as never, {
      cycleId: timeline.cycle.id,
      endsAt,
      idempotencyKey: mutation.mutation.key,
    })
    completeLifecycleMutation(mutation.identity, next)
  }

  const setTimelinePauseEnd = async (timeline: CycleTimeline, endsAt: string | null) => {
    const pause = resolveCycleAt(timeline, new Date(), timeZone).pause
    if (!pause || !endsAt) throw new Error('An active pause and end date are required')
    const mutation = lifecycleKey('pause-end', pause.id)
    const next = await setPauseEnd(stackDataClient as never, {
      pauseId: pause.id,
      endsAt,
      idempotencyKey: mutation.mutation.key,
    })
    completeLifecycleMutation(mutation.identity, next)
  }

  const resumeTimeline = async (timeline: CycleTimeline) => {
    const mutation = lifecycleKey('resume', timeline.cycle.id)
    const next = await resumeCycle(stackDataClient as never, {
      cycleId: timeline.cycle.id,
      idempotencyKey: mutation.mutation.key,
    })
    completeLifecycleMutation(mutation.identity, next)
  }

  const finishTimeline = async (timeline: CycleTimeline) => {
    const mutation = lifecycleKey('end', timeline.cycle.id)
    const next = await endTimelineCycle(stackDataClient as never, {
      cycleId: timeline.cycle.id,
      idempotencyKey: mutation.mutation.key,
    })
    completeLifecycleMutation(mutation.identity, next)
    frageNachBewertung(timeline)
  }

  // Zyklus beendet: einmal kurz fragen, wie es war (Bewertungen v2).
  const frageNachBewertung = (timeline: CycleTimeline) => {
    const { stack_item_id: stackItemId, id: cycleId } = timeline.cycle
    const name = peptides.find(p => p.id === stackItemId)?.name ?? ''
    toast(meldung => (
      <BewertenAnstoss
        name={name}
        onSpaeter={() => toast.dismiss(meldung.id)}
        onBewerten={() => {
          toast.dismiss(meldung.id)
          navigate(`/bewertungen?bewerten=${encodeURIComponent(stackItemId)}&zyklus=${encodeURIComponent(cycleId)}`)
        }}
      />
    ), { id: `bewerten-${cycleId}`, duration: 12000 })
  }

  const restartTimeline = async (timeline: CycleTimeline) => {
    const source = resolveCycleAt(timeline, new Date(), timeZone).planVersion
    if (!source) return
    const mutation = lifecycleKey('restart', timeline.cycle.id)
    const next = await restartCycle(stackDataClient as never, {
      sourceCycleId: timeline.cycle.id,
      startedAt: new Date().toISOString(),
      timeZone,
      initialSchedule: versionSnapshot(source),
      idempotencyKey: mutation.mutation.key,
    })
    lifecycleIdempotencyKeysRef.current.delete(mutation.identity)
    setCycleTimelines(current => [
      next,
      ...current.filter(candidate => candidate.cycle.id !== next.cycle.id),
    ])
  }

  const resolveTimelineConflict = async (p: Peptide, timeline: CycleTimeline) => {
    const mutation = lifecycleKey('resolve-conflict', `${p.id}:${timeline.cycle.id}`)
    if (!mutation.mutation.committed) {
      await resolveCycleMigrationConflict(stackDataClient as never, {
        stackItemId: p.id,
        keepCycleId: timeline.cycle.id,
        idempotencyKey: mutation.mutation.key,
      })
      mutation.mutation.committed = true
    }
    await reloadTimelinesAndPeptides()
    lifecycleIdempotencyKeysRef.current.delete(mutation.identity)
  }

  // Angemischtes Vial: die Plan-Ansichten zeigen je Einnahme die Einheiten
  // auf der Spritze. Die Fluessigkeit kommt aus dem Bestand (`withVialInventory`).
  const syringeOf = (p: Peptide) => (
    anbruchArt(p.dosage_form) === 'vial'
      ? spritzenRechnung(p.ingredients, p.reconstitution_ml, p.syringe_type)
      : null
  )
  // Was man zaehlt (Spray, Tablette, Tropfen …): je Einnahme die Stueckzahl.
  const stueckOf = (p: Peptide) => (syringeOf(p) ? null : stueckRechnung(p.ingredients))

  const planManagementSection = (p: Peptide, timeline: CycleTimeline) => timeline.cycle.timezone_review_required ? (
    <CourseTimezoneReview key={timeline.cycle.id} timeZone={timeZone} onConfirm={async zone => {
      const mutation = lifecycleKey('resolve-timezone', `${p.id}:${zone}`)
      if (!mutation.mutation.committed) {
        await resolveCycleCourseTimezone(stackDataClient as never, {
          stackItemId: p.id, timeZone: zone, idempotencyKey: mutation.mutation.key,
        })
        mutation.mutation.committed = true
      }
      await reloadTimelinesAndPeptides({ quiet: true })
      lifecycleIdempotencyKeysRef.current.delete(mutation.identity)
    }} />
  ) : (
    <PlanManagementSection
      key={timeline.cycle.id}
      timeline={timeline}
      syringe={syringeOf(p)}
      stueck={stueckOf(p)}
      timeZone={timeZone}
      onAdjustPlan={() => openEditCycle(p, timeline.cycle.id)}
      onAddStep={(version, dates) => openAddPlanStep(p, timeline, version, dates)}
      onEditFuture={version => openEditCycle(
        p,
        timeline.cycle.id,
        version.id,
        // Die erste Stufe behaelt, was sie bisher beim Bearbeiten bekam.
        version.change_kind === 'initial' ? 'schedule' : version.change_kind === 'titration' ? 'titration' : 'dose',
      )}
      onRemoveFuture={removeFutureVersion}
      onPause={endsAt => pauseTimeline(timeline, endsAt)}
      onSetPauseEnd={endsAt => setTimelinePauseEnd(timeline, endsAt)}
      onResume={() => resumeTimeline(timeline)}
      onEnd={() => finishTimeline(timeline)}
      onRestart={() => restartTimeline(timeline)}
      needsReview={p.configuration_status === 'needs_review'}
      onResolveConflict={() => resolveTimelineConflict(p, timeline)}
    />
  )
  const planManagementSections = (p: Peptide, timelines: CycleTimeline[]) => {
    const orderedTimelines = orderTimelines(timelines, new Date(), timeZone).map(entry => entry.timeline)
    const reviewTimeline = orderedTimelines.find(timeline => timeline.cycle.timezone_review_required)
    return reviewTimeline
      ? planManagementSection(p, reviewTimeline)
      : orderedTimelines.map(timeline => planManagementSection(p, timeline))
  }
  const toggleCycleActive = async (c: Cycle) => {
    await supabase.from('cycles').update({ active: !c.active }).eq('id', c.id)
    toast.success(c.active ? t('zyklus_deaktiviert') : t('zyklus_aktiviert'))
    loadCycles()
  }
  // Zyklus sauber beenden: Enddatum = heute + deaktiviert. Historie bleibt erhalten.
  const endCycle = async (c: Cycle) => {
    if (!confirm(t('zyklus_beenden_confirm'))) return
    await supabase.from('cycles')
      .update({ active: false, end_date: format(new Date(), 'yyyy-MM-dd') })
      .eq('id', c.id)
    toast.success(t('zyklus_beendet'))
    loadCycles()
  }
  const removeCycle = async (id: string) => {
    if (!confirm(t('zyklus_loeschen'))) return
    await supabase.from('cycles').delete().eq('id', id)
    toast.success(t('geloescht')); loadCycles()
  }

  // ── Dosisanpassungs-Aktionen ──────────────────────────────────────────────
  const openNewEsc = (c: Cycle) => {
    const stackItem = peptides.find(item => item.id === c.stack_item_id)
    const currentQuantity = dosePlanQuantitiesForDay(c, new Date(), escalationsOf(c.id)).current
    if (!stackItem || !dosePlanCapabilities(stackItem.tracking_level).titration || !currentQuantity) return
    setEscForCycle(c); setEditingEscId(null)
    setEForm(withEffectiveEscalationUnit(c, emptyEscalationForm(currentQuantity.unit))); setShowEscForm(true)
  }
  const openEditEsc = (c: Cycle, e: Escalation) => {
    const stackItem = peptides.find(item => item.id === c.stack_item_id)
    if (!stackItem || !dosePlanCapabilities(stackItem.tracking_level).titration) return
    setEscForCycle(c); setEditingEscId(e.id)
    const startAfterValue = e.start_after_days !== null && e.start_after_days !== undefined
      ? (e.start_type === 'after_weeks' ? e.start_after_days / 7 : e.start_after_days).toString()
      : '2'
    setEForm({
      increase_amount: escalationTargetQuantity(c, e)?.dose.toString() ?? '',
      unit: doseBeforeAdjustment(c, e)?.unit ?? '',
      start_type: e.start_type,
      start_date: e.start_date ?? format(new Date(), 'yyyy-MM-dd'),
      start_after_days: startAfterValue,
      notes: e.notes ?? '',
    })
    setShowEscForm(true)
  }
  const backfillDoseAdjustmentLogs = async (
    cycle: Cycle,
    nextEscalations: Escalation[],
    affectedEscalations: Escalation[],
    affectedFromDay?: string,
  ) => {
    let query = supabase
      .from('dose_logs')
      .select('id, stack_item_id, logged_at, taken, dose, unit')
      .eq('user_id', user!.id)
      .eq('stack_item_id', cycle.stack_item_id)
      .gte('logged_at', `${cycle.start_date}T00:00:00.000`)
      .or('taken.is.null,taken.eq.false')

    if (cycle.end_date) query = query.lte('logged_at', `${cycle.end_date}T23:59:59.999`)

    const { data, error } = await query
    if (error) throw error

    const updates = buildDoseAdjustmentBackfillUpdates(
      cycle,
      nextEscalations,
      (data ?? []) as DoseAdjustmentBackfillLog[],
      affectedEscalations,
      affectedFromDay,
    )

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('dose_logs')
        .update({ dose: update.dose, unit: update.unit })
        .eq('id', update.id)
        .eq('user_id', user!.id)
      if (updateError) throw updateError
    }

    return updates.length
  }
  const saveEsc = async () => {
    if (!eForm || !escForCycle) return
    const stackItem = peptides.find(item => item.id === escForCycle.stack_item_id)
    if (!stackItem || !dosePlanCapabilities(stackItem.tracking_level).titration) return
    if (!eForm.increase_amount) return toast.error(t('erhoeht_erforderlich'))
    setSavingEsc(true)
    const targetDose = Number(eForm.increase_amount)
    if (!Number.isFinite(targetDose) || targetDose <= 0) {
      setSavingEsc(false)
      return toast.error(t('erhoeht_erforderlich'))
    }
    const enteredOffset = Number(eForm.start_after_days)
    const startAfterDays = eForm.start_type !== 'date'
      ? enteredOffset * (eForm.start_type === 'after_weeks' ? 7 : 1)
      : null
    const draftEsc: Escalation = {
      id: editingEscId ?? '__new_adjustment__',
      cycle_id: escForCycle.id,
      increase_amount: 0,
      unit: eForm.unit,
      start_type: eForm.start_type,
      start_date: eForm.start_type === 'date' ? eForm.start_date : null,
      start_after_days: startAfterDays,
      notes: eForm.notes || null,
    }
    const baseQuantityAtStart = doseBeforeAdjustment(escForCycle, draftEsc)
    if (!baseQuantityAtStart) {
      setSavingEsc(false)
      return toast.error(t('erhoeht_erforderlich'))
    }
    let step
    try {
      step = buildTitrationStep({
        trackingLevel: stackItem.tracking_level,
        cycleId: escForCycle.id,
        targetDose,
        effectiveDose: baseQuantityAtStart.dose,
        effectiveUnit: baseQuantityAtStart.unit,
        unit: eForm.unit,
        startType: eForm.start_type,
        startDate: eForm.start_type === 'date' ? eForm.start_date : null,
        startAfterDays,
      })
    } catch {
      setSavingEsc(false)
      return toast.error(t('erhoeht_erforderlich'))
    }
    const payload = {
      user_id: user!.id, cycle_id: escForCycle.id,
      increase_amount: step.increase_amount,
      unit: step.unit, start_type: step.start_type,
      start_date: step.start_date,
      start_after_days: step.start_after_days,
      notes: eForm.notes || null,
    }
    const previousEscalation = editingEscId
      ? escalations.find(e => e.id === editingEscId) ?? null
      : null
    const changedEscalation: Escalation = {
      id: editingEscId ?? '__new_adjustment__',
      cycle_id: escForCycle.id,
      increase_amount: payload.increase_amount,
      unit: payload.unit,
      start_type: payload.start_type,
      start_date: payload.start_date,
      start_after_days: payload.start_after_days,
      notes: payload.notes,
    }
    const nextEscalations = editingEscId
      ? escalations.map(e => e.id === editingEscId ? changedEscalation : e)
      : [...escalations, changedEscalation]
    const affectedEscalations = previousEscalation
      ? [previousEscalation, changedEscalation]
      : [changedEscalation]

    const { error } = editingEscId
      ? await supabase.from('dose_escalations').update(payload).eq('id', editingEscId)
      : await supabase.from('dose_escalations').insert(payload)
    if (error) toast.error(t('error'))
    else {
      let backfilled = 0
      try {
        backfilled = await backfillDoseAdjustmentLogs(escForCycle, nextEscalations, affectedEscalations)
      } catch {
        toast.error(t('dose_plan_titration_backfill_failed', { defaultValue: 'Die Dosisanpassung wurde gespeichert, aber offene oder verpasste Einnahmen konnten nicht aktualisiert werden.' }))
      }

      toast.success(editingEscId ? t('inventar_aktualisiert') : t('esc_gespeichert'))
      if (backfilled > 0) {
        toast(t(backfillMessageKey(backfilled), {
          count: backfilled,
          defaultValue: backfilled === 1
            ? '{{count}} offene oder verpasste Einnahme aktualisiert. Bestätigte Einnahmen bleiben unverändert.'
            : '{{count}} offene oder verpasste Einnahmen aktualisiert. Bestätigte Einnahmen bleiben unverändert.',
        }))
      }
      setShowEscForm(false); loadEscalations()
    }
    setSavingEsc(false)
  }
  const removeEsc = async (id: string) => {
    if (!confirm(t('esc_loeschen'))) return
    await supabase.from('dose_escalations').delete().eq('id', id)
    toast.success(t('geloescht')); loadEscalations()
  }

  // ── Helper ────────────────────────────────────────────────────────────────
  const escLabel = (e: Escalation) => {
    if (e.start_type === 'date' && e.start_date)
      return t('ab_datum', { date: formatLocalDay(e.start_date, language) })
    if (e.start_after_days) {
      const weeks = e.start_after_days % 7 === 0 ? e.start_after_days / 7 : null
      return weeks
        ? `${t('nach_prefix')} ${weeks} ${t('wochen_suffix')}`
        : `${t('nach_prefix')} ${e.start_after_days} ${t('tagen_suffix')}`
    }
    return ''
  }
  const intakeLabel = (c: Cycle) => {
    if (!c.intake_time) return null
    const keys = c.intake_time.split(',').filter(Boolean)
    const customs = (c.intake_time_custom ?? '').split(',')
    const labels = keys.map((key, i) => {
      if (key === 'custom') return customs[i] ?? null
      const cfg = (INTAKE_TIME_CONFIG as Record<string, { labelKey: string }>)[key]
      return cfg ? t(cfg.labelKey) : null
    }).filter(Boolean)
    return labels.length > 0 ? labels.join(' · ') : null
  }
  const freqLabel = (c: Cycle) => {
    if (c.frequency === 'Alle X Tage' && c.x_days_interval)
      return `${t('alle_prefix')} ${c.x_days_interval} ${t('tage_suffix')}`
    if (c.frequency === 'Wochentage wählen' && c.schedule_days?.length)
      return c.schedule_days.join(', ')
    return t(FREQ_KEYS[c.frequency] ?? c.frequency)
  }
  const escalationStartDate = (c: Cycle, e: Escalation) => {
    if (e.start_type === 'date' && e.start_date) return parseStoredDay(e.start_date)
    if (e.start_after_days !== null && Number.isInteger(e.start_after_days) && e.start_after_days > 0) {
      return addDays(parseISO(c.start_date), e.start_after_days)
    }
    return null
  }
  const escalationIsActive = (c: Cycle, e: Escalation) => {
    const start = escalationStartDate(c, e)
    return start ? start <= new Date() : false
  }
  const sortedEscalationsOf = (cid: string) => {
    const cycle = cycles.find(c => c.id === cid)
    return [...escalationsOf(cid)].sort((a, b) => {
      if (!cycle) return escLabel(a).localeCompare(escLabel(b))
      const aStart = escalationStartDate(cycle, a)?.getTime() ?? Number.MAX_SAFE_INTEGER
      const bStart = escalationStartDate(cycle, b)?.getTime() ?? Number.MAX_SAFE_INTEGER
      return aStart - bStart
    })
  }
  const dosePlanViewFor = (c: Cycle, day: Date = new Date()) => (
    dosePlanQuantitiesForDay(c, day, sortedEscalationsOf(c.id))
  )
  const currentQuantityLabel = (c: Cycle, day: Date = new Date()) => {
    const quantity = dosePlanViewFor(c, day).current
    return quantity ? `${quantity.dose} ${quantity.unit}` : '-'
  }
  const scheduledQuantityLabel = (c: Cycle, day: Date) => {
    const segment = scheduleForDay(c, day)
    return segment.dose != null && Number.isFinite(segment.dose) && segment.dose > 0 && segment.unit?.trim()
      ? `${segment.dose} ${segment.unit}`
      : '-'
  }
  /**
   * Was ab wann gilt.
   *
   * Nur wenn es mehr als eine Stufe gibt — bei einem Plan, der nie geaendert
   * wurde, saehe die Liste aus wie eine Wiederholung dessen, was darueber
   * schon steht.
   */
  const planStufenListe = (c: Cycle) => {
    const stufen = planSegments(c, new Date())
    if (stufen.length <= 1) return null
    return (
      <div data-plan-steps className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-2">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-sky-300">
          <CalendarRange size={13} /> {t('my_stack_plan_steps', { defaultValue: 'Planstufen' })}
        </p>
        <div className="space-y-1.5">
          {stufen.map(({ effectiveFrom, segment, status }) => (
            <div
              key={effectiveFrom}
              data-plan-step={effectiveFrom}
              data-plan-step-status={status}
              className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs ${status === 'current'
                ? 'border-sky-400/50 bg-sky-400/15 text-sky-100'
                : status === 'past'
                  ? 'border-slate-800 bg-slate-950/70 text-slate-500'
                  : 'border-slate-700 bg-slate-950/70 text-slate-300'
              }`}
            >
              <span className="shrink-0 font-semibold">
                {t('my_stack_plan_step_from', {
                  defaultValue: 'ab {{date}}',
                  date: formatLocalDay(effectiveFrom, language),
                })}
              </span>
              <span className="min-w-0 flex-1 truncate">{stufenText(segment)}</span>
              {status === 'current' && (
                <span className="shrink-0 rounded-md border border-sky-400/40 bg-sky-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-200">
                  {t('my_stack_plan_step_current', { defaultValue: 'gilt jetzt' })}
                </span>
              )}
              {/* Zuruecknehmen laesst sich nur, was noch nicht angefangen hat.
                  Was laeuft, ist eingetreten: der Kalender hat danach geplant. */}
              {status === 'future' && (
                <button
                  type="button"
                  onClick={() => stufeZuruecknehmen(c, effectiveFrom)}
                  aria-label={String(t('my_stack_plan_step_remove', {
                    defaultValue: 'Stufe ab {{date}} zurücknehmen',
                    date: formatLocalDay(effectiveFrom, language),
                  }))}
                  className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-400/10 hover:text-rose-300"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }
  const plannedQuantityRows = (c: Cycle) => {
    const planned = dosePlanViewFor(c).planned
    if (planned.length === 0) return null
    return (
      <div className="mt-1 space-y-1 text-xs text-slate-500">
        {planned.map(segment => (
          <p key={segment.effectiveFrom}>
            <span className="font-bold uppercase tracking-wide">{segment.status}</span>
            {' · '}{formatLocalDay(segment.effectiveFrom, language)}: {segment.dose} {segment.unit}
          </p>
        ))}
      </div>
    )
  }
  const escalationTargetQuantity = (c: Cycle, e: Escalation) => {
    const start = escalationStartDate(c, e)
    return start ? effectiveQuantity(c, start, sortedEscalationsOf(c.id)) : null
  }
  const escalationQuantityLabel = (c: Cycle, e: Escalation) => {
    const quantity = escalationTargetQuantity(c, e)
    return quantity ? `${quantity.dose} ${quantity.unit}` : '-'
  }
  const doseBeforeAdjustment = (c: Cycle, e: Escalation) => {
    const start = escalationStartDate(c, e)
    if (!start) return null
    return effectiveQuantity(c, start, sortedEscalationsOf(c.id).filter(row => row.id !== e.id))
  }
  const doseAdjustmentIcon = (c: Cycle, e: Escalation) => {
    const target = escalationTargetQuantity(c, e)
    const previous = doseBeforeAdjustment(c, e)
    if (target == null || previous == null) return Minus
    return target.dose > previous.dose ? TrendingUp : target.dose < previous.dose ? TrendingDown : Minus
  }
  const reminderLabel = (c: Cycle) => {
    if (!c.reminder || c.reminder === 'none') return null
    const labels = c.reminder.split(',').filter(v => v && v !== 'none').map(v => {
      const opt = REMINDER_OPTIONS.find(r => r.value === v)
      return opt ? t(opt.labelKey) : v
    }).filter(Boolean)
    return labels.length > 0 ? labels.join(' · ') : null
  }

  const cycleView: CycleView = {
    cyclesOf, escalationsOf, openNewCycle, dismissZyklusBtn, openEditCycle, removeCycle,
    toggleCycleActive, endCycle, currentQuantityLabel, scheduledQuantityLabel, freqLabel,
    intakeLabel, reminderLabel, plannedQuantityRows, planStufenListe, doseAdjustmentIcon,
    escalationQuantityLabel, escalationIsActive, escLabel, openEditEsc, removeEsc, openNewEsc,
  }

  const activeIndex = Math.max(0, stagePeptides.findIndex(p => p.id === activePeptideId))
  const activePeptide = stagePeptides[activeIndex] ?? null
  // Das Vollbild gehoert der Substanz in der Historie — im Karussell ist das
  // die aktive, in der Liste die angetippte Zeile.
  const detailPeptide = detailHistoryPeptideId
    ? peptides.find(p => p.id === detailHistoryPeptideId) ?? null
    : null
  // Focus the search field right after it expands.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])
  // Den Fokus mitnehmen: sonst bliebe er im eingeklappten Feld — auf dem
  // Handy stuende die Tastatur weiter offen, und Tippen filterte unsichtbar.
  const closeSearch = () => { searchInputRef.current?.blur(); setSearchOpen(false); setSearch('') }
  // On entering the vials view (toggle or page load), always reset to the first
  // peptide and center it, so the leading add tile isn't the centered item.
  useEffect(() => {
    if (viewMode !== 'vials') return
    const first = stagePeptides[0]
    if (!first) return
    setActivePeptideId(first.id)
    setAddTileActive(false)
    zentriereSlot(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, loading])
  // Aendert sich die Liste auf der Buehne — neu geladen nach dem Speichern,
  // umsortiert, archiviert, gesucht —, rueckt der aktive Eintrag wieder in die
  // Mitte. Sonst stuende ein anderer Eintrag dort, als die Zeile darueber
  // beschreibt: die Scrollposition kennt nur Pixel, keine Eintraege.
  const stageKey = stagePeptides.map(p => p.id).join('|')
  useEffect(() => {
    if (viewMode !== 'vials' || loading || addTileActive || stagePeptides.length === 0) return
    zentriereSlot(activeIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey])
  // Nach dem Anlegen steht der neue Eintrag in der Mitte — sobald er in der
  // geladenen Liste steht. Ohne das blieb das Karussell, wo es war: beim
  // ersten Eintrag auf der „Neu"-Kachel, waehrend die Zeile darueber schon den
  // neuen Eintrag beschrieb.
  useEffect(() => {
    if (!neuZentrieren) return
    const index = stagePeptides.findIndex(p => p.id === neuZentrieren)
    if (index < 0) {
      // Geladen, aber im aktuellen Reiter oder in der Suche nicht sichtbar:
      // nichts verschieben. Noch nicht geladen (Neuladen gescheitert): warten.
      if (peptides.some(p => p.id === neuZentrieren)) setNeuZentrieren(null)
      return
    }
    setNeuZentrieren(null)
    if (viewMode !== 'vials') return
    setActivePeptideId(neuZentrieren)
    setAddTileActive(false)
    zentriereSlot(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neuZentrieren, stageKey])
  // Feed carousel interaction velocity into the shared liquid physics engine.
  const pushVialSlosh = (velocity: number) => sloshEngine.pushImpulse(velocity)
  const updateVialFocus = () => {
    const carousel = vialCarouselRef.current
    if (!carousel) return

    const center = carousel.scrollLeft + carousel.clientWidth / 2
    const maxDistance = Math.max(1, carousel.clientWidth * 0.48)

    // measure every item first, then write, so layout reads never interleave
    // with the imperative attribute writes below
    const measured: Array<{ handle: VialStageLightHandle; normalized: number }> = []
    for (const item of carousel.querySelectorAll<HTMLElement>('[data-vial-index]')) {
      const index = Number(item.dataset.vialIndex)
      if (!Number.isFinite(index)) continue
      const handle = vialStageLightHandlesRef.current.get(index)
      if (!handle) continue

      const itemCenter = item.offsetLeft + item.offsetWidth / 2
      const distance = itemCenter - center
      measured.push({ handle, normalized: Math.max(-1, Math.min(1, distance / maxDistance)) })
    }

    for (const { handle, normalized } of measured) {
      // Der Abfall war zwischendurch sehr steil (Faktor 1,35, Boden 0,1) —
      // damit lagen die Nachbarn fast im Dunkeln. Jetzt liegt er dazwischen:
      // die Mitte bleibt der Hauptdarsteller, aber man erkennt daneben noch,
      // WAS dort steht.
      const focus = Math.max(0.25, 1 - Math.abs(normalized) * 1.05)
      handle.setStageLight(focus, -normalized)
    }
  }
  const scheduleVialFocusUpdate = () => {
    if (vialFocusFrameRef.current !== null) return
    vialFocusFrameRef.current = window.requestAnimationFrame(() => {
      vialFocusFrameRef.current = null
      updateVialFocus()
    })
  }
  /**
   * Reiter wechseln.
   *
   * Welcher Eintrag dann auf der Buehne steht, muss hier NICHT gesetzt werden:
   * `activeIndex` faellt ueber `Math.max(0, findIndex(...))` von selbst auf den
   * ersten des Reiters, sobald der bisherige nicht mehr dabei ist. Auch das
   * Rollen nicht: die Liste aendert sich, und der Effekt an `stageKey` stellt
   * den aktiven Eintrag in die Mitte — den bisherigen, wenn er im Reiter
   * steht, sonst den ersten. Nur von der „Neu"-Kachel muss es selbst weg:
   * zeigt der neue Reiter dieselbe Liste, laeuft der Effekt nicht.
   */
  const reiterWechseln = (key: StackTabKey) => {
    setActiveTab(key)
    if (addTileActive) {
      setAddTileActive(false)
      zentriereSlot(activeIndex)
    }
  }

  /**
   * Plaetze im Karussell: -1 ist die „Neu"-Kachel, 0 … n-1 sind die
   * Substanzen. Alle Wege — Wisch, Ziehen, Pfeil, Rad, Punkt, Antippen —
   * rechnen in diesen Plaetzen. Solange die Kachel nur ein Sonderfall der
   * Pfeile war, sprang sie beim Ziehen zurueck, und ein Tipp auf die
   * Nachbarsubstanz oeffnete gleich deren Vollbild.
   */
  const slotSelector = (slot: number) => (
    slot === ADD_SLOT ? '[data-vial-add]' : `[data-vial-index="${slot}"]`
  )
  /**
   * Einen Platz sofort in die Mitte stellen, ohne Animation — fuer alles, was
   * nicht der Nutzer angestossen hat (Laden, Reiter, neue Liste). Ein noch
   * laufendes Ziel aus `selectSlot` gilt dann nicht mehr.
   */
  function zentriereSlot(slot: number) {
    vialTargetIndexRef.current = null
    requestAnimationFrame(() => {
      vialCarouselRef.current
        ?.querySelector<HTMLElement>(slotSelector(slot))
        ?.scrollIntoView({ block: 'nearest', inline: 'center' })
      updateVialFocus()
    })
  }
  const scrollToSlot = (slot: number) => {
    vialCarouselRef.current
      ?.querySelector<HTMLElement>(slotSelector(slot))
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    window.requestAnimationFrame(updateVialFocus)
  }
  const selectSlot = (slot: number) => {
    if (slot !== ADD_SLOT && !stagePeptides[slot]) return
    vialTargetIndexRef.current = slot
    setAddTileActive(slot === ADD_SLOT)
    scrollToSlot(slot)
  }
  const selectPeptideIndex = (index: number) => selectSlot(index)
  const selectAddTile = () => selectSlot(ADD_SLOT)
  const currentSlot = addTileActive ? ADD_SLOT : activeIndex
  const getClosestSlot = (carousel: HTMLDivElement) => {
    const items = Array.from(carousel.querySelectorAll<HTMLElement>('[data-vial-index], [data-vial-add]'))
    const carouselCenter = carousel.scrollLeft + carousel.clientWidth / 2
    let closestSlot = currentSlot
    let closestDistance = Number.POSITIVE_INFINITY

    for (const item of items) {
      const slot = item.hasAttribute('data-vial-add') ? ADD_SLOT : Number(item.dataset.vialIndex)
      const itemCenter = item.offsetLeft + item.offsetWidth / 2
      const distance = Math.abs(itemCenter - carouselCenter)
      if (Number.isFinite(slot) && distance < closestDistance) {
        closestDistance = distance
        closestSlot = slot
      }
    }

    return closestSlot
  }
  const handleVialCarouselScroll = (e: ReactUIEvent<HTMLDivElement>) => {
    const carousel = vialCarouselRef.current
    if (!carousel) return

    const now = e.timeStamp
    if (vialLastScrollTimeRef.current > 0) {
      const delta = carousel.scrollLeft - vialLastScrollLeftRef.current
      const dt = Math.max(16, now - vialLastScrollTimeRef.current)
      if (Math.abs(delta) > 0.5) pushVialSlosh((delta / dt) * 2.6)
    }
    vialLastScrollLeftRef.current = carousel.scrollLeft
    vialLastScrollTimeRef.current = now
    scheduleVialFocusUpdate()

    if (vialScrollFrameRef.current !== null) window.cancelAnimationFrame(vialScrollFrameRef.current)

    vialScrollFrameRef.current = window.requestAnimationFrame(() => {
      const closestSlot = getClosestSlot(carousel)
      const next = stagePeptides[closestSlot]
      if (next && next.id !== activePeptideId) {
        // Ein Klick je Eintrag, den das Karussell passiert — wie am Rad einer
        // Uhr. Hier und nirgends sonst: jede Auswahl, ob Wisch, Punkt, Pfeil
        // oder Rad, laeuft ueber dieses Rollen, also fuehlt sich auch jede
        // gleich an.
        void hapticTick()
        setActivePeptideId(next.id)
      }
      const target = vialTargetIndexRef.current
      if (target === closestSlot) vialTargetIndexRef.current = null
      // Waehrend einer gezielten Fahrt gilt das Ziel, nicht der
      // Zwischenstand: sonst flackert die Markierung der Kachel, und ein
      // zweiter Pfeildruck rechnete vom falschen Platz aus.
      setAddTileActive(target !== null && target !== closestSlot ? target === ADD_SLOT : closestSlot === ADD_SLOT)
      vialScrollFrameRef.current = null
    })
  }
  const scrollToClosestVial = () => {
    const carousel = vialCarouselRef.current
    if (!carousel) return

    selectSlot(getClosestSlot(carousel))
  }
  /**
   * Pfeile und Rad laufen im Kreis — und die „Neu"-Kachel gehoert dazu. Sie
   * steht vor der ersten Substanz; wer auf der ersten „zurueck" tippt, landet
   * bei ihr, statt ungesehen ans Ende zu springen.
   */
  const selectPeptideOffset = (offset: number) => {
    if (stagePeptides.length === 0) return
    const plaetze = stagePeptides.length + 1
    const jetzt = vialTargetIndexRef.current ?? currentSlot
    pushVialSlosh(offset > 0 ? 1 : -1)
    selectSlot(((jetzt + 1 + offset) % plaetze + plaetze) % plaetze - 1)
  }
  const handleVialCarouselPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    vialTargetIndexRef.current = null
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const carousel = vialCarouselRef.current
    if (!carousel) return

    vialDragStartXRef.current = e.clientX
    vialDragLastXRef.current = e.clientX
    vialDragLastTimeRef.current = e.timeStamp
    vialDragStartScrollLeftRef.current = carousel.scrollLeft
    vialLastScrollLeftRef.current = carousel.scrollLeft
    vialLastScrollTimeRef.current = e.timeStamp
    vialDraggingRef.current = true
    vialDragMovedRef.current = false
    setIsVialCarouselDragging(true)
  }
  const handleVialCarouselPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!vialDraggingRef.current) return
    const carousel = vialCarouselRef.current
    if (!carousel) return

    const delta = e.clientX - vialDragStartXRef.current
    const now = e.timeStamp
    const stepDelta = e.clientX - vialDragLastXRef.current
    const dt = Math.max(16, now - vialDragLastTimeRef.current)
    if (Math.abs(delta) > 4) {
      vialDragMovedRef.current = true
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    }
    if (Math.abs(stepDelta) > 0.5) pushVialSlosh((-stepDelta / dt) * 2.4)
    vialDragLastXRef.current = e.clientX
    vialDragLastTimeRef.current = now
    carousel.scrollLeft = vialDragStartScrollLeftRef.current - delta
  }
  const handleVialCarouselPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!vialDraggingRef.current) return
    vialDraggingRef.current = false
    setIsVialCarouselDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (vialDragMovedRef.current) {
      vialSuppressClickRef.current = true
      window.setTimeout(() => { vialSuppressClickRef.current = false }, 0)
      scrollToClosestVial()
    }
  }
  const handleVialCarouselWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (stagePeptides.length <= 1 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    e.preventDefault()
    if (vialWheelCooldownRef.current !== null) return

    selectPeptideOffset(e.deltaY > 0 ? 1 : -1)
    vialWheelCooldownRef.current = window.setTimeout(() => {
      vialWheelCooldownRef.current = null
    }, 280)
  }
  /**
   * Erst wischen, dann tippen.
   *
   * Ein Tipp auf einen NACHBARN waehlt ihn nur aus — man holt ihn in die
   * Mitte. Ein Tipp auf das Objekt, das schon in der Mitte steht, oeffnet das
   * Vollbild. So braucht es keine zweite Schaltflaeche, und ein Fehltipp beim
   * Wischen kostet hoechstens einen Schritt, nie einen Bildschirmwechsel.
   */
  const handleVialCarouselItemClick = (index: number) => {
    if (vialSuppressClickRef.current) return
    if (index !== currentSlot) {
      pushVialSlosh(index > currentSlot ? 1 : -1)
      selectPeptideIndex(index)
      return
    }
    const objekt = vialCarouselRef.current?.querySelector<HTMLElement>(`[data-vial-index="${index}"]`)
    const peptide = stagePeptides[index]
    if (!objekt || !peptide) return
    oeffneVollbild(peptide, objekt)
  }
  /**
   * Das Vollbild einer Substanz, aufgeflogen aus `ursprung` — dem Objekt im
   * Karussell oder in der Listenzeile. Ein Eintrag in der Browser-Historie,
   * damit „Zurueck" es schliesst.
   */
  const oeffneVollbild = (peptide: Peptide, ursprung: HTMLElement) => {
    setDetailUrsprung(ursprung.getBoundingClientRect())
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      {
        replace: detailHistoryPeptideId === peptide.id,
        state: {
          ...historyStateRecord(location.state),
          [MY_STACK_DETAIL_HISTORY_KEY]: peptide.id,
        },
      },
    )
  }
  const handleVialCarouselItemKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (index !== currentSlot) pushVialSlosh(index > currentSlot ? 1 : -1)
    selectPeptideIndex(index)
  }

  useEffect(() => {
    return () => {
      if (vialScrollFrameRef.current !== null) window.cancelAnimationFrame(vialScrollFrameRef.current)
      if (vialFocusFrameRef.current !== null) window.cancelAnimationFrame(vialFocusFrameRef.current)
      if (vialWheelCooldownRef.current !== null) window.clearTimeout(vialWheelCooldownRef.current)
    }
  }, [])

  const closeStageDetail = () => {
    if (detailHistoryPeptideId) {
      navigate(-1)
      return
    }
    setDetailUrsprung(null)
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Alles zu dem Eintrag, der auf der Buehne steht.
   *
   * Steht NICHT mehr unter dem Karussell: dort ist jetzt das Objekt, sein
   * Name und eine Zeile — sonst nichts. Erst das Antippen oeffnet das hier,
   * im Vollbild. Als Funktion im Komponenten statt als eigene Datei, weil
   * der Block auf zwei Dutzend Zustaende und Handler zugreift, die alle
   * hier leben; herauszuloesen hiesse, sie alle durchzureichen.
   */
  const eintragDetails = (eintrag: Peptide) => (
    <>
                {(() => {
                  const invItem = eintrag.inventory_item_id ? inventory.find(i => i.id === eintrag.inventory_item_id) : null
                  const pCycles = cyclesOf(eintrag.id)
                  const activeCycle = pCycles.find(c => c.active) ?? null
                  const notSet = 'Nicht gesetzt'
                  /**
                   * Die Angaben, nach Form ausgesucht.
                   *
                   * Welche ueberhaupt vorkommen, entscheidet `detailAbschnitte`
                   * aus dem, was die Form ueber sich sagt — ein Pflaster kennt
                   * kein Anmischen, also steht dort auch keine Zeile dazu. Was
                   * hier steht, ist nur noch der TEXT dazu.
                   */
                  const form = getDosageForm(eintrag.dosage_form)
                  const wirkstoffLabel = {
                    pro_vial: 'Wirkstoff pro Vial',
                    pro_volumen: 'Wirkstoff pro ml',
                    // Pro Stueck, nicht pro Packung: „Wirkstoff pro Sprühstoß“.
                    pro_einheit: `Wirkstoff pro ${String(t(intakeUnitLabelKey(form.key)))}`,
                    pro_masse: 'Wirkstoff pro g',
                    roh: 'Wirkstoff',
                  }[wirkstoffBezug(form)]
                  /**
                   * Die Angaben kommen aus der Leseschicht, nicht direkt aus
                   * den Altspalten.
                   *
                   * Vorher stand hier `eintrag.vial_amount_mg` und so
                   * fort — also genau die Spalten, die NUR die
                   * Tracking-Details schreiben. Ein Eintrag aus dem
                   * Assistenten zeigte deshalb ueberall „Nicht gesetzt",
                   * obwohl seine Angaben in `stack_item_ingredients` und
                   * `stack_item_inventory` standen. Siehe `produktAngaben.ts`.
                   */
                  const angaben = produktAngaben({
                    item: eintrag,
                    vorratsposten: invItem,
                    zyklusMethode: activeCycle?.method ?? null,
                  })
                  const methodeText = (m: string) => methodLabel(t, m)
                  const zutatText = (z: Zutat, mitNamen: boolean) => [
                    mitNamen ? z.name : null,
                    `${z.wert ?? '-'} ${z.einheit ?? ''}`.trim(),
                    // Die Bezugseinheit uebersetzt: „/ 1 Sprühstoß", nicht „/ 1 spray".
                    z.basis != null
                      ? `/ ${z.basisEinheit ? stockAmountLabel(t, z.basis, z.basisEinheit, language) : z.basis}`
                      : null,
                  ].filter(Boolean).join(' ')
                  const angabeText = (feld: DetailFeld, a: Angabe): string => {
                    switch (a.art) {
                      case 'leer': return notSet
                      case 'zutaten':
                        return a.zutaten.map(z => zutatText(z, a.zutaten.length > 1)).join(' · ')
                      case 'menge': return `${a.wert} ${a.einheit ?? ''}`.trim()
                      case 'vorrat':
                        // Alt zaehlt Vials, neu zaehlt, was auf der Packung
                        // steht — „12 von 30 Tabletten".
                        return a.einheit == null
                          ? String(t('vials_vorratig', { n: a.rest }))
                          : a.packung != null
                            ? `${a.rest} / ${a.packung} ${a.einheit}`
                            : `${a.rest} ${a.einheit}`
                      case 'datum': return formatLocalDay(a.iso, language)
                      case 'tage': return daysLabel(t, a.n)
                      case 'datei': return a.url.split('/').pop() || 'Öffnen'
                      case 'text':
                        if (feld === 'kategorie') return String(t(`stack_category_${a.text}`))
                        if (feld === 'applikation') return methodeText(a.text)
                        return a.text
                    }
                  }
                  // „Haltbar danach" zaehlt ab dem Anmischen, „Haltbar bis"
                  // steht auf der Packung. Welche der beiden es ist, sagt die
                  // Angabe selbst — nicht die Form.
                  const art = anbruchArt(eintrag.dosage_form)
                  const haltbarkeitLabel = String(t(art === 'vial' ? 'my_stack_stock_use_within_vial' : 'my_stack_stock_use_within'))
                  const FELD_LABEL: Record<DetailFeld, string> = {
                    wirkstoff: wirkstoffLabel,
                    kategorie: 'Kategorie',
                    marke: 'Marke',
                    fluessigkeit: String(t('my_stack_stock_liquid')),
                    rekonstituiert_am: String(t(art === 'vial' ? 'my_stack_stock_mixed_on' : 'my_stack_stock_opened_on')),
                    haltbarkeit: haltbarkeitLabel,
                    // Wo angemischt oder geoeffnet wird, gilt das Datum dem
                    // UNgeoeffneten — sonst klingt es wie „Haltbar danach".
                    ablauf: String(t(art ? 'my_stack_stock_expires_unopened' : 'my_stack_stock_expires')),
                    vorrat: 'Vorrat',
                    // „Methode" und nicht „Applikationsart": im Zyklusknopf
                    // steht dasselbe Feld unter demselben Namen.
                    applikation: String(t('methode')),
                    batch: String(t('my_stack_stock_batch_number')),
                    quelle: String(t('my_stack_stock_source')),
                    analyse: String(t('my_stack_stock_document')),
                    notizen: 'Notizen',
                  }
                  const zeileFuer = (feld: DetailFeld): InfoRow => {
                    const a = angaben[feld]
                    const wert = angabeText(feld, a)
                    // Ueber zwei Spalten, wo eine Zeile sonst abgeschnitten
                    // waere: ein Kombipraeparat, ein Dateiname, eine Notiz.
                    const wide = feld === 'notizen'
                      || (a.art === 'zutaten' && a.zutaten.length > 1)
                    if (a.art === 'datei') {
                      return {
                        label: FELD_LABEL[feld], wide,
                        valueNode: (
                          <a className="truncate text-cyan-300 hover:text-cyan-200" href={a.url} target="_blank" rel="noopener noreferrer">
                            {wert}
                          </a>
                        ),
                      }
                    }
                    return { label: FELD_LABEL[feld], value: wert, wide }
                  }
                  const ABSCHNITT_TITEL: Record<'substanz' | 'produkt', string> = {
                    substanz: 'Substanz',
                    produkt: 'Zusammensetzung',
                  }
                  return (
                    <>
                    {/* Zusammensetzung und Substanz: offen, nicht hinter einem
                        Akkordeon. Wer das Vollbild oeffnet, will sie sehen —
                        ein Klappknopf davor war eine Huerde ohne Gegenwert.
                        Die Darreichungsform entscheidet, welche Zeilen es
                        ueberhaupt gibt. */}
                    {/* Der Plan zuerst: was gerade gilt, schaut man taeglich
                        nach — Substanz und Rekonstitution selten. Ein Tipp
                        oeffnet die volle Uebersicht. */}
                    {FEATURES.planTimelineV2 && (
                      <PlanSummaryCard
                        syringe={syringeOf(eintrag)}
                        stueck={stueckOf(eintrag)}
                        timelines={timelinesOf(eintrag.id)}
                        timeZone={timeZone}
                        loadState={timelineLoadError ? 'error' : timelineLoading ? 'loading' : 'ready'}
                        needsReview={eintrag.configuration_status === 'needs_review'}
                        onOpen={() => {
                          closeStageDetail()
                          setCycleManagerPeptide(eintrag)
                        }}
                        onStartNew={() => {
                          closeStageDetail()
                          openNewCycle(eintrag)
                        }}
                      />
                    )}
                    {/* Der Vorrat unter dem Plan; „Bestand aendern" oeffnet
                        nur die Mengen. Anmischen, Haltbarkeit und Charge
                        stehen darunter bei Zusammensetzung und Substanz. */}
                    <BestandCard
                      dosageForm={eintrag.dosage_form}
                      inventory={eintrag.inventory ?? null}
                      ingredients={eintrag.ingredients}
                      timelines={timelinesOf(eintrag.id)}
                      timeZone={timeZone}
                      // Vials bucht die Datenbank ueber den Bestand ab, wenn die
                      // Umrechnung eindeutig ist, alle anderen nur mit Staerke.
                      deductsIntakes={art === 'vial'
                        ? vialBuchtUeberBestand(eintrag.inventory, eintrag.ingredients)
                        : eintrag.tracking_level === 'complete'}
                      onEdit={editor => setBestandEdit({ peptideId: eintrag.id, editor })}
                    />
                    {detailAbschnitte(form).map(abschnitt => (
                      <section key={abschnitt.id} data-stack-detail={abschnitt.id} className="mx-1 mt-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
                        <h3 className="border-b border-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {ABSCHNITT_TITEL[abschnitt.id]}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 p-2 text-xs">
                          {(() => {
                            // Leer ohne Kachel, was `LEER_AUSBLENDEN` nennt.
                            const felder = abschnitt.felder.filter(feld => !LEER_AUSBLENDEN.has(feld) || angaben[feld].art !== 'leer')
                            // Bleibt eine halbe Kachel allein in ihrer Zeile, wird
                            // sie ganz breit: bei der Zusammensetzung der Wirkstoff
                            // vorn, sonst die letzte halbe.
                            const halbe = felder.filter(feld => !zeileFuer(feld).wide)
                            const einzeln = halbe.length % 2 === 1
                              ? abschnitt.id === 'produkt' && halbe.includes('wirkstoff') ? 'wirkstoff' : halbe.at(-1)
                              : null
                            return felder.map(feld => {
                            const zeile = zeileFuer(feld)
                            const vollbreit = Boolean(zeile.wide) || feld === einzeln
                            const kachel = `min-h-14 rounded-lg border border-slate-800 bg-slate-900/55 px-2.5 py-2 ${vollbreit ? 'col-span-2' : ''}`
                            return (
                              <div key={feld} data-stack-detail-field={feld} className={kachel}>
                                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{zeile.label}</p>
                                <div className="mt-1 truncate text-sm font-semibold text-slate-200">
                                  {'valueNode' in zeile ? zeile.valueNode : zeile.value}
                                </div>
                              </div>
                            )
                          })
                          })()}
                        </div>
                      </section>
                    ))}

                    {/* Alter Datenpfad: der Zyklus als Knopf nach den Angaben.
                        Mit der Plan-Zeitleiste steht stattdessen die
                        Plan-Karte oben (PlanSummaryCard). */}
                    {!FEATURES.planTimelineV2 && <div data-stack-detail="zyklus" className="mx-1 mt-2">
                      {activeCycle ? (
                        <button
                          type="button"
                          aria-label={`${String(t('aktiv_badge'))} ${activeCycle.name} ${String(t('zyklus'))}`}
                          onClick={() => {
                            closeStageDetail()
                            setCycleManagerPeptide(eintrag)
                          }}
                          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-violet-500/25 bg-slate-950/55 px-3 text-left transition-colors hover:border-violet-400/45"
                        >
                          <span
                            aria-hidden="true"
                            data-active-cycle-indicator
                            className="relative flex h-3 w-3 shrink-0 items-center justify-center"
                          >
                            <span className="absolute h-3 w-3 rounded-full bg-emerald-400/20 shadow-[0_0_10px_rgba(52,211,153,0.45)]" />
                            <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">
                            {activeCycle.name} {t('zyklus')}
                          </span>
                          <ChevronRight size={16} className="shrink-0 text-slate-600" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (pCycles.length > 0) {
                              closeStageDetail()
                              setCycleManagerPeptide(eintrag)
                              return
                            }
                            closeStageDetail()
                            openNewCycle(eintrag)
                          }}
                          className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/55 px-3 text-left transition-colors hover:border-violet-400/35"
                        >
                          <Activity size={16} className="shrink-0 text-slate-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-white">
                              {pCycles.length > 0 ? t('kein_aktiver_zyklus') : t('noch_kein_zyklus')}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {pCycles.length > 0
                                ? `${pCycles.length === 1 ? t('zyklus_count_one') : t('zyklus_count_many', { n: pCycles.length })} · ${t('keiner_aktiv')}`
                                : t('noch_kein_zyklus_desc')}
                            </span>
                          </span>
                          {pCycles.length > 0
                            ? <ChevronRight size={16} className="shrink-0 text-slate-600" />
                            : <Plus size={16} className="shrink-0 text-violet-300" />}
                        </button>
                      )}
                    </div>}

                    </>
                  )
                })()}
    </>
  )

  // Die Reiterleiste steht ueber dem Karussell. Gibt es dort nichts zu
  // zeigen (Suche ohne Treffer, nur Formen ohne Buehnengrafik), steht sie
  // allein — sonst verschwaende sie mit dem Karussell, und man kaeme aus dem
  // Reiter nicht mehr heraus.
  const reiterLeiste = (
    <StackTabBar counts={reiterZaehler} openTab={offenerReiter} onSelect={reiterWechseln} />
  )

  return (
    // `-mx-3 px-3`: die Seite reicht bis an den Bildschirmrand, ihr Inhalt
    // bleibt eingerueckt wie bisher. Sie schneidet ab (`overflow-hidden`) —
    // so schmal wie der Inhaltsbereich kappte sie Karussell und Reiter, die
    // mit `-mx-3` bis an den Rand reichen sollen, 12 px davor.
    <div
      data-my-stack-page
      className={`flex h-full min-h-0 flex-col overflow-hidden -mx-3 px-3 ${viewMode === 'vials' && activePeptide ? 'overscroll-none touch-pan-x' : ''}`}
    >
      {/* ── Header (single row): Titel · Suche · Ansicht/Filter ─────────── */}
      <MyStackHeader
        searchOpen={searchOpen}
        peptides={peptides}
        searchInputRef={searchInputRef}
        search={search}
        setSearch={setSearch}
        closeSearch={closeSearch}
        handleNewPeptide={handleNewPeptide}
        setSearchOpen={setSearchOpen}
        setFilterOpen={setFilterOpen}
        setArchiveViewOpen={setArchiveViewOpen}
        loadArchived={loadArchived}
        filterOpen={filterOpen}
        setViewMode={setViewMode}
        viewMode={viewMode}
        wirksameSortierung={wirksameSortierung}
        setSortBy={setSortBy}
        moeglicheSortierungen={moeglicheSortierungen}
      />

      {/* ══ MEINE PEPTIDE ════════════════════════════════════════════════════ */}
      <div
        data-my-stack-body
        className={`-mx-3 min-h-0 flex-1 px-3 ${viewMode === 'vials' && activePeptide ? 'flex flex-col overflow-hidden overscroll-none' : 'overflow-y-auto overscroll-contain'}`}
      >
          {initialLoad && <LabLoader fadingOut={!loading} />}

          {FEATURES.planTimelineV2 && timelineLoadError && (
            <div role="alert" className="mb-4 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">
              <p>{t('my_stack_plan_load_error', { defaultValue: 'Die Einnahmepläne konnten nicht geladen werden. Die übrigen Daten bleiben sichtbar.' })}</p>
              <button
                type="button"
                disabled={timelineLoading}
                onClick={() => { void loadTimelines() }}
                className="mt-2 min-h-10 rounded-lg border border-rose-200/30 px-3 font-semibold disabled:opacity-50"
              >
                {t('lab_retry', { defaultValue: 'Erneut versuchen' })}
              </button>
            </div>
          )}

          {!loading && peptides.length === 0 && (
            <div className="card text-center py-10 text-slate-500">
              <p className="mb-4">{t('keine_peptide')}</p>
              <AddVialTile onClick={handleNewPeptide} label={t('neues_peptid_title')} />
            </div>
          )}

          {search && displayPeptides.length === 0 && (
            <div className="card text-center py-8 text-slate-500 text-sm">
              {t('kein_peptid_gefunden_msg', { search })}
            </div>
          )}

          {!loading && viewMode === 'vials' && !activePeptide && peptides.length > 0 && (
            <div className="shrink-0 pt-1">{reiterLeiste}</div>
          )}

          <VialCarousel
            loading={loading}
            viewMode={viewMode}
            activePeptide={activePeptide}
            timeZone={timeZone}
            reiterLeiste={reiterLeiste}
            selectPeptideOffset={selectPeptideOffset}
            addTileActive={addTileActive}
            cyclesOf={cyclesOf}
            activeIndex={activeIndex}
            stagePeptides={stagePeptides}
            sloshEngine={sloshEngine}
            vialCarouselRef={vialCarouselRef}
            handleVialCarouselScroll={handleVialCarouselScroll}
            handleVialCarouselPointerDown={handleVialCarouselPointerDown}
            handleVialCarouselPointerMove={handleVialCarouselPointerMove}
            handleVialCarouselPointerUp={handleVialCarouselPointerUp}
            handleVialCarouselWheel={handleVialCarouselWheel}
            isVialCarouselDragging={isVialCarouselDragging}
            vialSuppressClickRef={vialSuppressClickRef}
            handleNewPeptide={handleNewPeptide}
            selectAddTile={selectAddTile}
            handleVialCarouselItemClick={handleVialCarouselItemClick}
            handleVialCarouselItemKeyDown={handleVialCarouselItemKeyDown}
            animationEpoch={animationEpoch}
            vialStageLightHandlesRef={vialStageLightHandlesRef}
            selectPeptideIndex={selectPeptideIndex}
          />

          {/* ── Peptid-Liste ────────────────────────────────────────────── */}
          <StackListView
            loading={loading}
            listPeptides={listPeptides}
            sloshEngine={sloshEngine}
            timelinesOf={timelinesOf}
            timelineState={timelineLoadError ? 'error' : timelineLoading ? 'loading' : 'ready'}
            timeZone={timeZone}
            animationEpoch={animationEpoch}
            openDetail={oeffneVollbild}
            openEdit={openEditPeptide}
            remove={removePeptide}
            aktivAlt={FEATURES.planTimelineV2 ? null : activePeptideIds}
            hervorgehobenId={hervorgehobenId}
            hervorhebungGesehen={hervorhebungGesehen}
          />
      </div>

      {/* ZYKLUS-MANAGER */}
      <PlanOverviewSheet
        currentCycleManagerPeptide={currentCycleManagerPeptide}
        setCycleManagerPeptide={setCycleManagerPeptide}
        planManagementSections={planManagementSections}
        timelinesOf={timelinesOf}
      />
      <LegacyCycleManager
        cycleView={cycleView}
        cycleManagerPeptide={cycleManagerPeptide}
        setCycleManagerPeptide={setCycleManagerPeptide}
      />

      {/* EINTRAG-VOLLBILD */}
      {/* Das Vollbild hinter einem Objekt. Der Uebergang ist FLIP: das Objekt
          wird an seinem Platz im Karussell gemessen und fliegt von dort an
          seine Stelle hier oben, dabei verkleinert. Waehrend des Flugs ist die
          Fluessigkeitsphysik still. */}
      <StageDetailView
        detailUrsprung={detailUrsprung}
        peptide={detailPeptide}
        rekonstitutionWiederholen={handleRekonstitution}
        timeZone={timeZone}
        closeStageDetail={closeStageDetail}
        sloshEngine={sloshEngine}
        openEditPeptide={openEditPeptide}
        removePeptide={removePeptide}
        setBestandEdit={setBestandEdit}
        eintragDetails={eintragDetails}
      />

      {showPeptideForm && (
        <StackItemWizard
          catalogEntries={catalogEntries}
          catalogUnavailable={catalogUnavailable}
          existingItems={peptides}
          existingItem={editingPeptideId ? peptides.find(item => item.id === editingPeptideId) : undefined}
          metadataOnly={FEATURES.planTimelineV2 && Boolean(editingPeptideId) && !wizardCycleId && !wizardNeuerZyklus && !planEditContext}
          {...(planEditContext
            ? { planEditContext, onSavePlanChange: saveVersionChange }
            : {
                existingPlan: FEATURES.planTimelineV2 && editingPeptideId && !wizardCycleId && !wizardNeuerZyklus
                  ? (() => {
                      const candidates = timelinesOf(editingPeptideId).filter(value => !value.cycle.timezone_review_required
                        && resolveCycleAt(value, new Date(), timeZone).status !== 'ended')
                      if (candidates.length !== 1) return undefined
                      const value = candidates[0]
                      const version = resolveCycleAt(value, new Date(), timeZone).planVersion ?? value.versions[0]
                      return version ? versionAsIntakePlanDraft(value, version, timeZone) : undefined
                    })()
                  : editingPeptideId && wizardCycleId && !wizardNeuerZyklus
                  ? cycles.find(cycle => cycle.id === wizardCycleId && cycle.stack_item_id === editingPeptideId)
                    ? cycleAsIntakePlanDraft(
                        cycles.find(cycle => cycle.id === wizardCycleId && cycle.stack_item_id === editingPeptideId)!,
                        new Date(),
                      )
                    : undefined
                  : undefined,
              })}
          initialColorHex={wizardInitialColor}
          intent={wizardIntent}
          onClose={() => {
            setShowPeptideForm(false)
            setWizardIntent(undefined)
            setWizardNeuerZyklus(false)
            setWizardCycleId(null)
            setPlanEditContext(null)
            if (!planSaveRecoveryRef.current?.committed) planSaveRecoveryRef.current = null
          }}
          onSave={handleSaveStackItem}
          onOpenExisting={openExistingStackItem}
        />
      )}

      {bestandPeptide && bestandEdit && (
        <BestandEditorHost
          editor={bestandEdit.editor}
          dosageForm={bestandPeptide.dosage_form}
          inventory={bestandPeptide.inventory ?? null}
          ingredients={bestandPeptide.ingredients}
          onClose={() => setBestandEdit(null)}
          actions={bestandActions(bestandPeptide)}
        />
      )}

      {/* ══ SUBSTANZ ENTFERNEN: ARCHIVIEREN vs. ENDGÜLTIG LÖSCHEN ═══════════════ */}
      <DeleteSubstanceDialog
        deletePromptPeptide={deletePromptPeptide}
        deletePromptFromArchive={deletePromptFromArchive}
        deletingPeptide={deletingPeptide}
        setDeletePromptFromArchive={setDeletePromptFromArchive}
        setDeletePromptPeptide={setDeletePromptPeptide}
        archiveCloseButtonRef={archiveCloseButtonRef}
        archivePeptide={archivePeptide}
        hardDeletePeptide={hardDeletePeptide}
      />

      {/* ══ ARCHIV ══════════════════════════════════════════════════════════════ */}
      {archiveViewOpen && (
        <StackArchive
          ref={archiveDialogRef}
          labelledBy="archive-title"
        >
          <header className="shrink-0 border-b border-slate-800 bg-slate-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Archive size={13} /> {t('archiv')}
                </p>
                <h2 id="archive-title" className="mt-1 truncate text-lg font-bold text-white">{t('archiv_title')}</h2>
              </div>
              <button
                type="button"
                ref={archiveCloseButtonRef}
                onClick={() => setArchiveViewOpen(false)}
                data-app-back-close
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 transition-colors hover:border-slate-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                aria-label={t('close')}
                title={t('close')}
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-3xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
              {archivedPeptides.length === 0 && (
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
                  <Archive size={22} className="mx-auto mb-2 text-slate-600" />
                  <p className="text-sm font-semibold text-white">{t('archiv_leer')}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('archiv_leer_desc')}</p>
                </div>
              )}

              {archivedPeptides.length > 0 && (
                <div className="divide-y divide-slate-800/80 border-y border-slate-800/80">
                  {archivedPeptides.map(p => {
                    const archivedDate = p.archived_at
                      ? formatInstantDay(p.archived_at, language)
                      : ''

                    return (
                      <div key={p.id} data-archive-row className="flex min-h-28 items-center gap-3 py-3">
                        <div className="flex w-16 shrink-0 justify-center opacity-75" aria-hidden="true">
                          <StackStage
                            item={{ ...p, color_hex: '#64748b' }}
                            fillPct={0}
                            animateOnMount={false}
                            isActive={false}
                            size="compact"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">{p.name}</p>
                          {p.archived_at && (
                            <p className="mt-1 text-xs text-slate-500">
                              {t('archiviert_am', { date: archivedDate })}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            data-archive-info-button={p.id}
                            onClick={() => openArchiveInfo(p)}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 transition-colors hover:border-cyan-400/45 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                            aria-label={t('infos')}
                            title={t('infos')}
                          >
                            <Info size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => restorePeptide(p)}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                            aria-label={t('wiederherstellen')}
                            title={t('wiederherstellen')}
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeletePromptFromArchive(true); setDeletePromptPeptide(p) }}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-300 transition-colors hover:border-red-400/45 hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                            aria-label={t('endgueltig_loeschen')}
                            title={t('endgueltig_loeschen')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </main>
          {archiveInfoPeptide && (() => {
            const p = archiveInfoPeptide
            const archivedCycles = cycles
              .filter(c => c.stack_item_id === p.id)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
            const invItem = inventory.find(item => item.id === p.inventory_item_id)
            const syringeMl = p.syringe_type?.split(':')[0]
            const syringeUnits = p.syringe_type?.split(':')[1]
            const formatStoredDate = (value: string | null) => value ? formatLocalDay(value, language) : '-'
            const expiryDate = p.reconstitution_date && p.expiry_days
              ? formatLocalDay(shiftLocalDay(p.reconstitution_date.slice(0, 10), p.expiry_days), language)
              : '-'
            const archivedDate = p.archived_at ? formatInstantDay(p.archived_at, language) : '-'
            const applicationRows: InfoRow[] = [
              {
                label: t('wirkstoff_pro_vial'),
                value: p.vial_amount_mg !== null ? `${p.vial_amount_mg} ${p.vial_amount_unit ?? 'mg'}` : '-',
              },
              {
                label: t('zugefuegte_fluessigkeit'),
                value: p.reconstitution_ml !== null ? `${p.reconstitution_ml} mL` : '-',
              },
              {
                label: t('applikation_info'),
                value: p.default_method ? methodLabel(t, p.default_method) : '-',
              },
              {
                label: t('spritzen_typ'),
                value: syringeMl && syringeUnits ? `${syringeMl} mL ? ${syringeUnits} ${t('einh_kurz')}` : '-',
              },
            ]
            const stockRows: InfoRow[] = [
              { label: t('datum_rekonstitution'), value: formatStoredDate(p.reconstitution_date) },
              { label: t('haltbarkeit_tage'), value: p.expiry_days !== null ? `${p.expiry_days}` : '-' },
              { label: t('ablauf_label'), value: expiryDate },
              {
                label: t('bestand_section'),
                value: p.vials_in_stock !== null
                  ? `${p.vials_in_stock} / ${p.vials_initial ?? '-'} ${t('vials')}`
                  : '-',
              },
              {
                label: t('vorraetige_vials'),
                value: invItem ? t('vials_vorratig', { n: invItem.vials_count }) : '-',
                wide: true,
              },
            ]
            const documentationRows: InfoRow[] = [
              { label: t('batch'), value: p.batch_number || '-' },
              { label: t('quelle'), value: p.batch_source || '-' },
              {
                label: t('analyse_dokument_section'),
                wide: true,
                valueNode: p.batch_file_url
                  ? (
                    <a
                      href={p.batch_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-2 text-cyan-300 hover:text-cyan-200"
                    >
                      <span className="truncate">{p.batch_file_url.split('/').pop() || t('dokument_oeffnen')}</span>
                      <ExternalLink size={14} className="shrink-0" />
                    </a>
                  )
                  : <span>-</span>,
              },
              { label: t('notizen_section'), value: p.notes || '-', wide: true },
            ]
            const renderInfoRows = (rows: InfoRow[]) => (
              <dl className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
                {rows.map(row => (
                  <div
                    key={row.label}
                    className={`min-w-0 border-b border-slate-800/70 py-3 ${row.wide ? 'sm:col-span-2' : ''}`}
                  >
                    <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-slate-200">
                      {row.valueNode ?? row.value ?? '-'}
                    </dd>
                  </div>
                ))}
              </dl>
            )

            return (
              <div
                data-archive-info-detail={p.id}
                data-app-modal
                className="fixed inset-0 z-[60] flex min-h-dvh flex-col bg-slate-950"
                role="dialog"
                aria-modal="true"
                aria-labelledby="archive-info-title"
              >
                <header className="shrink-0 border-b border-slate-800 bg-slate-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
                  <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-3 px-4">
                    <button
                      type="button"
                      ref={archiveInfoBackButtonRef}
                      onClick={() => {
                        setArchiveInfoPeptide(null)
                        window.requestAnimationFrame(() => {
                          document.querySelector<HTMLButtonElement>(`[data-archive-info-button="${p.id}"]`)?.focus()
                        })
                      }}
                      data-app-back-close
                      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition-colors hover:border-slate-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                      aria-label={t('back')}
                      title={t('back')}
                    >
                      <ChevronLeft size={19} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('archiv')}</p>
                      <h2 id="archive-info-title" className="truncate text-lg font-bold text-white">{p.name}</h2>
                    </div>
                  </div>
                </header>

                <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <div className="mx-auto w-full max-w-3xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                    <div className="flex items-center gap-5 py-5">
                      <div className="flex w-20 shrink-0 justify-center opacity-80" aria-hidden="true">
                        <StackStage
                          item={{ ...p, color_hex: '#64748b' }}
                          fillPct={0}
                          animateOnMount={false}
                          isActive={false}
                          size="compact"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-xl font-bold text-white">{p.name}</p>
                        {p.archived_at && (
                          <p className="mt-1 text-sm text-slate-500">
                            {t('archiviert_am', { date: archivedDate })}
                          </p>
                        )}
                      </div>
                    </div>

                    <section className="border-t border-slate-800 py-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                        {t('wirkstoff_rekonstitution')}
                      </h3>
                      {renderInfoRows(applicationRows)}
                    </section>

                    <section className="border-t border-slate-800 py-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                        {t('haltbarkeit_section_info')} &amp; {t('bestand_section')}
                      </h3>
                      {renderInfoRows(stockRows)}
                    </section>

                    <section className="border-t border-slate-800 py-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                        {t('batch_herkunft_section')}
                      </h3>
                      {renderInfoRows(documentationRows)}
                    </section>

                    <section className="border-t border-slate-800 py-4">
                      <button
                        type="button"
                        onClick={() => setArchiveCyclesOpen(open => !open)}
                        aria-expanded={archiveCyclesOpen}
                        aria-controls="archive-cycle-list"
                        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                          {t('zyklen_header')}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-xs font-medium text-slate-500">
                            {t(archivedCycles.length === 1 ? 'zyklus_count_one' : 'zyklus_count_many', { n: archivedCycles.length })}
                          </span>
                          {archiveCyclesOpen
                            ? <ChevronUp size={16} className="text-slate-400" />
                            : <ChevronDown size={16} className="text-slate-400" />}
                        </span>
                      </button>

                      {archiveCyclesOpen && (
                        <div id="archive-cycle-list">
                      {archivedCycles.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-500">{t('keine_zyklen')}</p>
                      ) : (
                        <div className="mt-2 divide-y divide-slate-800/80">
                          {archivedCycles.map(c => (
                            <article key={c.id} data-archive-cycle className="py-4">
                              <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 break-words text-sm font-bold text-white">{c.name}</p>
                                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${c.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                  {t(c.active ? 'aktiv_badge' : 'inaktiv_badge')}
                                </span>
                              </div>
                              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                                <div className="col-span-2 sm:col-span-3">
                                  <dt className="text-xs text-slate-500">{t('obx_cycdates_title')}</dt>
                                  <dd className="mt-0.5 text-sm font-medium text-slate-200">
                                    {formatStoredDate(c.start_date)} - {c.end_date ? formatStoredDate(c.end_date) : t('ende_offen')}
                                  </dd>
                                </div>
                                {dosePlanCapabilities(p.tracking_level).permanent && (
                                  <div>
                                    <dt className="text-xs text-slate-500">{t('dosis_label')}</dt>
                                    <dd className="mt-0.5 text-sm font-medium text-slate-200">{currentQuantityLabel(c)}</dd>
                                  </div>
                                )}
                                <div>
                                  <dt className="text-xs text-slate-500">{t('frequenz')}</dt>
                                  <dd className="mt-0.5 text-sm font-medium text-slate-200">{freqLabel(c)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-slate-500">{t('methode')}</dt>
                                  <dd className="mt-0.5 text-sm font-medium text-slate-200">
                                    {methodLabel(t, c.method)}
                                  </dd>
                                </div>
                              </dl>
                            </article>
                          ))}
                        </div>
                      )}
                        </div>
                      )}
                    </section>
                  </div>
                </main>
              </div>
            )
          })()}
        </StackArchive>
      )}

      {/* ══ ZYKLUS-FORMULAR ══════════════════════════════════════════════════ */}
      {/* Das eigene Zyklusformular ist entfallen. Es schrieb direkt in
          `cycles` — am RPC vorbei, ohne dessen Pruefungen, und mit einer
          zweiten, engeren Segmentlogik. „Plan aendern" fuehrt jetzt durch
          den Assistenten (`intent: 'plan'`) und damit durch
          `save_stack_item_with_plan`. */}

      {/* DOSISANPASSUNG-FORMULAR */}
      <EscalationFormSheet
        showEscForm={showEscForm}
        eForm={eForm}
        setShowEscForm={setShowEscForm}
        editingEscId={editingEscId}
        escForCycle={escForCycle}
        setEForm={setEForm}
        saveEsc={saveEsc}
        savingEsc={savingEsc}
      />

      {/* ══ REKONSTITUTION DIALOG ═════════════════════════════════════════════ */}
      <RekonstitutionDialog
        rekonstitutionTarget={rekonstitutionTarget}
        rekonstitutionDontAsk={rekonstitutionDontAsk}
        setRekonstitutionDontAsk={setRekonstitutionDontAsk}
        setRekonstitutionTarget={setRekonstitutionTarget}
        confirmRekonstitution={confirmRekonstitution}
      />

    </div>
  )
}
