import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FEATURES } from '../config/features'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays, FlaskConical, Archive, Calculator,
  BookHeart, Star, HelpCircle, User, ChevronRight,
  Microscope, Library, Droplets, Heart, FileText, type LucideIcon,
  Activity, CheckCircle2,
  Clock3, Package, ShieldCheck,
  Syringe, TrendingUp, Bell, XCircle, RotateCcw,
  Dumbbell, Dna, Zap, Moon, Brain, Bandage, HeartPulse, Lightbulb, Leaf, Bone,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BlutspiegelView } from '../features/blutspiegel/BlutspiegelView'
import { getPeptideExpiryAlerts, type PeptideExpiryAlert } from '../lib/peptideExpiry'
import { expirySources, vialStockOverview, type LegacyInventoryItem, type StockOverviewItem } from '../lib/stockOverview'
import {
  collectMissedIntakes,
  collectMissedTimelineIntakes,
  collectOpenTimelineIntakes,
  cycleAppliesToDay,
  effectiveSlotQuantity,
  resolveScheduleSlots,
  resolveTimelineIntakesForDay,
  scheduleForDay,
  AUTO_MISSED_NOTE,
  type EscalationRow,
  type IntakeLog,
  type ResolvedRoutineGroup,
  type ResolvedTimelineIntake,
  type ScheduleCycle,
} from '../lib/intakeSchedule'
import { loadCycleTimelines } from '../features/my-stack/services/planLifecycle'
import { localDateBoundaryInstant, localDateTimeKey, resolveCycleAt, type CycleTimeline } from '../lib/planTimeline'
import { ExpiryWarningBanners } from '../components/ExpiryWarningBanners'
import { WorkflowBanner } from '../components/WorkflowBanner'
import { InjectionTrackerHero, type InjectionHeroPin } from '../components/injection3d/InjectionTrackerHero'
import { buildInjectionTrackerUrl, isInjectableMethod } from '../lib/injectionDeepLink'
import { confirmIntakeDoseLog } from '../lib/injectionPersistence'
import { debitPeptideStockForDoseById } from '../features/my-stack/extensions/peptide/vialStock'
import { formatTrackedQuantity, hasTrackedQuantity } from '../features/routines/quantityPresentation'
import {
  buildConfirmationEntry,
  groupRoutineIntakes,
  routineGroupFromMinutes,
  type RoutineConfirmationEntry,
  type RoutineGroupModel,
  type RoutineIntake,
} from '../features/routines/intakeGroups'
import {
  confirmIntakeGroup,
  quantifiedVialEntries,
  skipIntakeGroup,
  skipIntakeGroupsInBatches,
  type IntakeConfirmationClient,
} from '../features/routines/services/intakeConfirmation'
import { RoutineConfirmationSheet } from '../features/routines/components/RoutineConfirmationSheet'
import {
  applyInventoryConfirmation,
  InventoryConfirmationError,
} from '../features/my-stack/services/stackInventory'
import toast from 'react-hot-toast'
import { differenceInDays, format, parseISO, startOfDay } from 'date-fns'
import { getDateLocale } from '../i18n/dateLocales'

const ROUTINE_GROUP_LABELS: Record<RoutineGroupModel['key'], { key: string; defaultValue: string }> = {
  morning: { key: 'my_stack_routine_morning', defaultValue: 'Morgens' },
  midday: { key: 'my_stack_routine_midday', defaultValue: 'Mittags' },
  evening: { key: 'my_stack_routine_evening', defaultValue: 'Abends' },
}

const PEPTIDE_STUDIES = [
  { icon: FlaskConical, title: 'BPC-157 beschleunigt Sehnen- & Muskelheilung signifikant', source: 'J. Physiol. · 2024' },
  { icon: Dumbbell,     title: 'TB-500 fördert Angiogenese & Wundheilung bei Gewebeschäden', source: 'Wound Rep. Reg. · 2023' },
  { icon: Dna,          title: 'GHK-Cu aktiviert über 4.000 Gene – Gewebereparatur & Anti-Aging', source: 'Biomolecules · 2024' },
  { icon: Zap,          title: 'Ipamorelin: selektive GH-Freisetzung ohne Cortisol- oder Prolaktin-Spitzen', source: 'Endocrinology · 2023' },
  { icon: Moon,         title: 'Epitalon verlängert Telomere & hemmt Tumorwachstum in Langzeitstudie', source: 'Aging · 2023' },
  { icon: Brain,        title: 'Selank (TP-7) zeigt anxiolytische Wirkung ohne Abhängigkeitspotenzial', source: 'Neuropharmacology · 2024' },
  { icon: Microscope,   title: 'MOTS-c verbessert Insulinsensitivität & Mitochondrienfunktion', source: 'Cell Metab. · 2024' },
  { icon: Bandage,      title: 'AOD-9604: gezielter Fettabbau ohne diabetogene Nebenwirkungen', source: 'Obes. Res. · 2023' },
  { icon: HeartPulse,   title: 'Thymosin α1 stärkt Immunantwort bei chronischer Entzündung', source: 'Immunology · 2024' },
  { icon: Lightbulb,    title: 'PT-141 (Bremelanotide) – erstes FDA-zugelassenes Peptid gegen Libidostörungen', source: 'FDA Approval · 2019' },
  { icon: TrendingUp,   title: 'CJC-1295 hält IGF-1-Spiegel über 14 Tage erhöht', source: 'J. Clin. Endocrinol. · 2006' },
  { icon: ShieldCheck,  title: 'Humanin schützt Neuronen vor amyloidbedingtem Zelltod – neue Daten', source: 'PNAS · 2024' },
  { icon: Leaf,         title: 'Epithalon reduziert oxidativen Stress & verbessert Schlafqualität', source: 'Biogerontology · 2023' },
  { icon: Bone,         title: 'BPC-157 fördert Knochenregeneration nach Fraktur – Tierstudie', source: 'Bone · 2024' },
] as const
const TODAY_STUDY = PEPTIDE_STUDIES[Math.floor(Date.now() / 86_400_000) % PEPTIDE_STUDIES.length]

interface TileDef {
  icon: LucideIcon
  labelKey: string
  descKey: string
  label?: string
  desc?: string
  path: string
  color: string
}

interface QuickActionDef {
  icon: LucideIcon
  labelKey: string
  label: string
  descKey: string
  desc: string
  path: string
  accent: string
}

interface FeatureDef {
  icon: LucideIcon
  labelKey: string
  label: string
  descKey: string
  desc: string
  path: string
  accent: string
  metric: string
}

interface OverviewStats {
  activeCycles: number
  peptides: number
  inventoryVials: number
  loggedToday: number
  lowStock: number
}

const EMPTY_OVERVIEW: OverviewStats = {
  activeCycles: 0,
  peptides: 0,
  inventoryVials: 0,
  loggedToday: 0,
  lowStock: 0,
}

const TILE_DEFS: TileDef[] = [
  { icon: CalendarDays, labelKey: 'tile_kalender',    descKey: 'tile_kalender_desc',    path: '/kalender',             color: '#00ccf5'          },
  { icon: Syringe,      labelKey: 'tile_injektionen', descKey: 'tile_injektionen_desc', path: '/injektionen',          color: '#10b981'         },
  { icon: Archive,      labelKey: 'tile_lager',       descKey: 'tile_lager_desc',       path: '/my-stack?tab=inventar', color: '#00ccf5'         },
  { icon: FlaskConical, labelKey: 'tile_peptide',     descKey: 'tile_peptide_desc',     path: '/my-stack',             color: '#22d3ee'         },
  { icon: Calculator,   labelKey: 'tile_rechner',     descKey: 'tile_rechner_desc',     path: '/rechner',              color: '#3b82f6'         },
  { icon: Droplets,     labelKey: 'tile_blutwerte',   descKey: 'tile_blutwerte_desc',   path: '/blutwerte',            color: '#f43f5e', label: 'Blutwerte', desc: 'Laborwerte erfassen' },
  { icon: Heart,        labelKey: 'tile_health',      descKey: 'tile_health_desc',      path: '/health',               color: '#f43f5e'          },
  { icon: FileText,     labelKey: 'tile_protokoll',   descKey: 'tile_protokoll_desc',   path: '/protokoll',            color: '#00ccf5', label: 'PDF-Generator', desc: 'Report mit Live-Vorschau' },
  { icon: Microscope,   labelKey: 'tile_lab',         descKey: 'tile_lab_desc',         path: '/lab',                  color: '#00ccf5'          },
  { icon: Library,      labelKey: 'tile_bibliothek',  descKey: 'tile_bibliothek_desc',  path: '/lab/peptipedia',        color: '#8b5cf6'         },
  { icon: BookHeart,    labelKey: 'tile_tagebuch',    descKey: 'tile_tagebuch_desc',    path: '/tagebuch',             color: '#8b5cf6'         },
  { icon: Star,         labelKey: 'tile_bewertungen', descKey: 'tile_bewertungen_desc', path: '/bewertungen',          color: '#f59e0b'         },
  { icon: HelpCircle,   labelKey: 'tile_faq',         descKey: 'tile_faq_desc',         path: '/faq',                  color: '#10b981'         },
  { icon: User,         labelKey: 'tile_profil',      descKey: 'tile_profil_desc',      path: '/profil',               color: '#f43f5e'          },
]

const QUICK_ACTIONS: QuickActionDef[] = [
  {
    icon: CheckCircle2,
    labelKey: 'home_action_log',
    label: 'Heute loggen',
    descKey: 'home_action_log_desc',
    desc: 'Einnahmen bestätigen',
    path: '/kalender',
    accent: '#10b981',
  },
  {
    icon: Syringe,
    labelKey: 'home_action_injection',
    label: 'Injektion loggen',
    descKey: 'home_action_injection_desc',
    desc: 'Stelle & Rotation tracken',
    path: '/injektionen',
    accent: '#00ccf5',
  },
  {
    icon: Calculator,
    labelKey: 'home_action_calc',
    label: 'Dosis rechnen',
    descKey: 'home_action_calc_desc',
    desc: 'Einheiten berechnen',
    path: '/rechner',
    accent: '#3b82f6',
  },
  {
    icon: TrendingUp,
    labelKey: 'home_action_progress',
    label: 'Fortschritt',
    descKey: 'home_action_progress_desc',
    desc: 'Gewicht & Fotos',
    path: '/progress',
    accent: '#10b981',
  },
  {
    icon: Activity,
    labelKey: 'home_action_simulation',
    label: 'Blutspiegel',
    descKey: 'home_action_simulation_desc',
    desc: 'PK-Kurve simulieren',
    path: '/simulation',
    accent: '#00ccf5',
  },
]

const FEATURE_CARDS: FeatureDef[] = [
  {
    icon: FileText,
    labelKey: 'home_feature_protocol',
    label: 'PDF-Generator',
    descKey: 'home_feature_protocol_desc',
    desc: 'Arzt-, Coach- oder Forum-PDF mit Live-Vorschau erstellen.',
    path: '/protokoll',
    accent: '#00ccf5',
    metric: 'Export',
  },
  {
    icon: Droplets,
    labelKey: 'home_feature_bloodwork',
    label: 'Blutwerte',
    descKey: 'home_feature_bloodwork_desc',
    desc: 'Laborwerte strukturiert erfassen und vergleichen.',
    path: '/blutwerte',
    accent: '#f43f5e',
    metric: 'Blutwerte',
  },
  {
    icon: Microscope,
    labelKey: 'home_feature_research',
    label: 'Research Feed',
    descKey: 'home_feature_research_desc',
    desc: 'PubMed-Studien und Peptipedia schneller finden.',
    path: '/lab',
    accent: '#8b5cf6',
    metric: 'PubMed',
  },
]

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 26,
  paddingBottom: 8,
}

/** Maße der Karten; das Material (Glas mit Lichtkante) kommt von `.lg-surface`. */
const panelStyle: CSSProperties = {
  borderRadius: 'var(--r-xl)',
  position: 'relative',
  overflow: 'hidden',
}

/** Großer Titel wie in iOS (34 pt, fett, leicht gesperrt). */
const largeTitleStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 34,
  lineHeight: '41px',
  fontWeight: 700,
  letterSpacing: '0.011em',
  color: 'var(--text)',
}

/** Abschnittstitel (Title 3): 20 pt fett. */
const sectionTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '0.019em',
  color: 'var(--text)',
}

/** Sheets der Startseite: schwebend mit Abstand zum Rand, festes Graphit wie iOS-Sheets. */
const homeSheetStyle: CSSProperties = {
  background: 'var(--lg-sheet-bg)',
  backdropFilter: 'var(--lg-sheet-blur)',
  WebkitBackdropFilter: 'var(--lg-sheet-blur)',
  boxShadow: '0 -16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.06)',
}

/** „Eingenommen": grün getönte Kapsel — Erfolg bleibt grün, wie bisher. */
const takenStyle: CSSProperties = {
  background: 'color-mix(in srgb, var(--lg-good) 20%, transparent)',
  color: 'var(--lg-good-text)',
}

/** „Alle als eingenommen markieren": grüne Kapsel, 44 px Tippfläche. */
const confirmAllStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--lg-good) 16%, transparent)',
  color: 'var(--lg-good-text)',
  fontSize: 13,
  fontWeight: 600,
}

interface HomeDoseLogPayloadInput {
  userId: string
  stackItemId: string
  doseNumber: number | null
  unit: string | null
  method: string | null
  scheduledAt: string
  taken: boolean
  timeValue?: string
  cycleId?: string | null
  planVersionId?: string | null
  routineSlotKey?: string | null
}

function buildHomeLoggedAt(scheduledAt: string, timeValue?: string): string {
  if (!timeValue) return scheduledAt
  const [hours, minutes] = timeValue.split(':').map(Number)
  const loggedAt = new Date(scheduledAt)
  if (Number.isFinite(hours) && Number.isFinite(minutes)) loggedAt.setHours(hours, minutes, 0, 0)
  return loggedAt.toISOString()
}

export function resolveHomeIntakeQuantity(
  cycle: ScheduleCycle,
  day: Date,
  escalations: EscalationRow[],
  /**
   * Die eigene Menge DIESES Zeitpunkts, falls der Plan sie je Zeitpunkt
   * festhaelt. Ohne sie galt bei „morgens 1000, abends 500" an beiden 1000 —
   * und dieselbe falsche Zahl landete bei verpassten Einnahmen im Protokoll.
   */
  slotDose: number | null = null,
): { doseNumber: number | null; unit: string | null; dose: string | null } {
  const quantity = effectiveSlotQuantity(cycle, day, escalations, slotDose) ?? { dose: null, unit: null }
  return {
    doseNumber: quantity.dose,
    unit: quantity.unit,
    dose: hasTrackedQuantity(quantity)
      ? formatTrackedQuantity(quantity.dose, quantity.unit, '')
      : null,
  }
}

export function buildHomeDoseLogPayload(input: HomeDoseLogPayloadInput) {
  const quantity = { dose: input.doseNumber, unit: input.unit }
  const tracked = hasTrackedQuantity(quantity)
  return {
    user_id: input.userId,
    stack_item_id: input.stackItemId,
    dose: tracked ? quantity.dose : null,
    unit: tracked ? quantity.unit : null,
    method: input.method ?? '',
    logged_at: buildHomeLoggedAt(input.scheduledAt, input.timeValue),
    taken: input.taken,
    ...(input.cycleId ? { cycle_id: input.cycleId } : {}),
    ...(input.planVersionId ? { plan_version_id: input.planVersionId } : {}),
    ...(input.routineSlotKey ? { routine_slot_key: input.routineSlotKey } : {}),
  }
}

interface HomeCycle extends ScheduleCycle {
  method: string | null
  stack_items: {
    display_name: string
    tracking_level: 'intake_only' | 'with_amount' | 'complete'
    dosage_form: string | null
  }
}

export interface TodayIntake {
  key: string
  time: string          // 'HH:MM'
  min: number           // Minuten seit Mitternacht (Sortierung)
  substance: string | null
  dose: string | null
  doseNumber: number | null
  unit: string | null
  stackItemId: string
  cycleId: string
  planVersionId: string | null
  pendingLogId: string | null
  pendingLoggedAt?: string
  pendingPlanVersionId?: string | null
  routineGroup: ResolvedRoutineGroup
  trackingLevel: 'intake_only' | 'with_amount' | 'complete'
  dosageForm: string | null
  method: string | null
  scheduledAt: string
}

export function buildHomeRoutineIntake(intake: TodayIntake): RoutineIntake {
  const intakeOnly = intake.trackingLevel === 'intake_only'
  return {
    key: intake.key,
    cycleId: intake.cycleId,
    planVersionId: intake.planVersionId,
    pendingLogId: intake.pendingLogId,
    stackItemId: intake.stackItemId,
    stackItemName: intake.substance ?? '',
    trackingLevel: intake.trackingLevel,
    group: intake.routineGroup,
    scheduledAt: intake.scheduledAt,
    dose: intakeOnly ? null : intake.doseNumber,
    unit: intakeOnly ? null : intake.unit,
    method: intake.method ?? '',
    injectable: isInjectableMethod(intake.method),
  }
}

interface InjectionHeroState {
  pins: InjectionHeroPin[]
}

const EMPTY_INJECTION_HERO: InjectionHeroState = {
  pins: [],
}

function isHeroVector(value: unknown): value is InjectionHeroPin['position'] {
  if (!value || typeof value !== 'object') return false
  const vector = value as Record<string, unknown>
  return typeof vector.x === 'number' && typeof vector.y === 'number' && typeof vector.z === 'number'
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 44,
  margin: '0 4px 6px',
}

interface HomeProps {
  homeDataClient?: typeof supabase
}

export function Home({ homeDataClient = supabase }: HomeProps = {}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  // Alle heute noch offenen (nicht bestätigten) Einnahmen, je mit eigenem Timer.
  const [todayIntakes, setTodayIntakes] = useState<TodayIntake[]>([])
  const [plannedToday, setPlannedToday] = useState(0)
  const [todayDone,   setTodayDone]   = useState(false)
  const [overview, setOverview] = useState<OverviewStats>(EMPTY_OVERVIEW)
  const [expiryAlerts, setExpiryAlerts] = useState<PeptideExpiryAlert[]>([])
  const [injectionHero, setInjectionHero] = useState<InjectionHeroState>(EMPTY_INJECTION_HERO)
  const [selectedHomeIntake, setSelectedHomeIntake] = useState<TodayIntake | null>(null)
  const [selectedHomeRoutine, setSelectedHomeRoutine] = useState<RoutineGroupModel | null>(null)
  const [homeConfirmStep, setHomeConfirmStep] = useState<'choice' | 'time'>('choice')
  const [homeConfirmTime, setHomeConfirmTime] = useState('')
  const [homeReloadKey, setHomeReloadKey] = useState(0)
  const [homeInventoryRetryIds, setHomeInventoryRetryIds] = useState<string[]>([])
  const [homeTimelines, setHomeTimelines] = useState<CycleTimeline[]>([])
  const homeRoutineCommitted = useRef(false)
  const [timelineLoadState, setTimelineLoadState] = useState<'loading' | 'ready' | 'error'>(
    FEATURES.planTimelineV2 ? 'loading' : 'ready',
  )

  // Rotate study daily
  const todayStudy = TODAY_STUDY

  useEffect(() => {
    if (!user) return
    let cancelled = false
    let missedTimer: number | undefined
    async function load() {
      const todayKey = format(new Date(), 'yyyy-MM-dd')
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      let autoMissSince = localStorage.getItem('tyd_automiss_since')
      if (!autoMissSince) { autoMissSince = todayKey; localStorage.setItem('tyd_automiss_since', autoMissSince) }
      const logsSince = localDateBoundaryInstant(autoMissSince, timeZone).toISOString()
      if (FEATURES.planTimelineV2) {
        setTimelineLoadState('loading')
        setTodayIntakes([])
        setPlannedToday(0)
        setTodayDone(false)
        setSelectedHomeIntake(null)
        if (!homeRoutineCommitted.current) setSelectedHomeRoutine(null)
      }

      try {
        let timelines: CycleTimeline[] = []
        let cycleData: unknown[] = []
        let logData: IntakeLog[] = []
        let stackItemData: Record<string, unknown>[] = []
        let inventoryData: Record<string, unknown>[] = []
        let escalationData: unknown[] = []
        let injectionData: Record<string, unknown>[] = []

        if (FEATURES.planTimelineV2) {
          const [loadedTimelines, logsResult, stackItemsResult, inventoryResult, injectionsResult] = await Promise.all([
            loadCycleTimelines(homeDataClient as never, user!.id),
            homeDataClient.from('dose_logs')
              .select('id, logged_at, stack_item_id, taken, cycle_id, plan_version_id, routine_slot_key')
              .eq('user_id', user!.id)
              .gte('logged_at', logsSince)
              .order('logged_at', { ascending: false }),
            homeDataClient.from('stack_items')
              .select('id, display_name, tracking_level, dosage_form, vials_in_stock, reconstitution_date, expiry_days, inventory_item_id, inventory:stack_item_inventory(enabled, package_unit, remaining_quantity, opened_at, use_within_days)')
              .eq('user_id', user!.id),
            homeDataClient.from('inventory_items')
              .select('id, vials_count')
              .eq('user_id', user!.id),
            homeDataClient.from('injection_logs')
              .select('id, logged_at, body_region, body_side, position, normal')
              .eq('user_id', user!.id)
              .order('logged_at', { ascending: false })
              .limit(30),
          ])
          if (cancelled) return
          if (logsResult.error) throw logsResult.error
          if (stackItemsResult.error) throw stackItemsResult.error
          timelines = loadedTimelines
          logData = (logsResult.data ?? []) as IntakeLog[]
          stackItemData = (stackItemsResult.data ?? []) as Record<string, unknown>[]
          inventoryData = (inventoryResult.data ?? []) as Record<string, unknown>[]
          injectionData = (injectionsResult.data ?? []) as Record<string, unknown>[]
        } else {
          const [cyclesResult, logsResult, stackItemsResult, inventoryResult, escalationsResult, injectionsResult] = await Promise.all([
            homeDataClient.from('cycles')
              .select('id, intake_time, intake_time_custom, stack_item_id, dose, unit, method, start_date, end_date, frequency, x_days_interval, interval_unit, cycle_on_days, cycle_off_days, slot_doses, slot_days, schedule_days, schedule_history, stack_items(display_name, tracking_level, dosage_form)')
              .eq('user_id', user!.id).eq('active', true),
            // All decided/reset logs — taken filtered per use site (overdue/timer).
            homeDataClient.from('dose_logs')
              .select('id, logged_at, stack_item_id, taken')
              .eq('user_id', user!.id)
              .gte('logged_at', logsSince)
              .order('logged_at', { ascending: false }),
            homeDataClient.from('stack_items')
              .select('id, display_name, tracking_level, dosage_form, vials_in_stock, reconstitution_date, expiry_days, inventory_item_id, inventory:stack_item_inventory(enabled, package_unit, remaining_quantity, opened_at, use_within_days)')
              .eq('user_id', user!.id),
            homeDataClient.from('inventory_items')
              .select('id, vials_count')
              .eq('user_id', user!.id),
            homeDataClient.from('dose_escalations')
              .select('cycle_id, increase_amount, unit, start_type, start_date, start_after_days')
              .eq('user_id', user!.id),
            homeDataClient.from('injection_logs')
              .select('id, logged_at, body_region, body_side, position, normal')
              .eq('user_id', user!.id)
              .order('logged_at', { ascending: false })
              .limit(30),
          ])
          cycleData = cyclesResult.data ?? []
          logData = (logsResult.data ?? []) as IntakeLog[]
          stackItemData = (stackItemsResult.data ?? []) as Record<string, unknown>[]
          inventoryData = (inventoryResult.data ?? []) as Record<string, unknown>[]
          escalationData = escalationsResult.data ?? []
          injectionData = (injectionsResult.data ?? []) as Record<string, unknown>[]
        }
        const cycles = (cycleData ?? []) as unknown as HomeCycle[]
        const escalations = (escalationData ?? []) as EscalationRow[]

        // ── Next intake time ─────────────────────────────────────────
        const now = new Date()
        let todaySlots: TodayIntake[] = []
        let openSlots: TodayIntake[] = []

        if (FEATURES.planTimelineV2) {
          const stackItemById = new Map(stackItemData.map(item => [item.id as string, item]))
          const toTodayIntake = (intake: ResolvedTimelineIntake): TodayIntake | null => {
            const stackItem = stackItemById.get(intake.stackItemId)
            if (!stackItem) return null
            const trackingLevel = stackItem.tracking_level as TodayIntake['trackingLevel']
            const intakeOnly = trackingLevel === 'intake_only'
            const quantity = { dose: intake.dose, unit: intake.unit }
            return {
              key: intake.routineSlotKey,
              min: intake.minutes,
              time: intake.time,
              substance: stackItem.display_name as string,
              dose: intakeOnly || !hasTrackedQuantity(quantity)
                ? null
                : formatTrackedQuantity(quantity.dose, quantity.unit, ''),
              doseNumber: intakeOnly ? null : intake.dose,
              unit: intakeOnly ? null : intake.unit,
              stackItemId: intake.stackItemId,
              cycleId: intake.cycleId,
              planVersionId: intake.planVersionId,
              pendingLogId: intake.pendingLogId,
              pendingLoggedAt: logData.find(log => log.id === intake.pendingLogId)?.logged_at,
              pendingPlanVersionId: logData.find(log => log.id === intake.pendingLogId)?.plan_version_id,
              routineGroup: intake.routineGroup,
              trackingLevel,
              dosageForm: (stackItem.dosage_form as string | null) ?? null,
              method: intake.method,
              scheduledAt: intake.scheduledAt,
            }
          }
          const localDate = localDateTimeKey(now, timeZone).slice(0, 10)
          todaySlots = timelines
            .flatMap(timeline => resolveTimelineIntakesForDay(timeline, localDate, timeZone))
            .map(toTodayIntake)
            .filter((intake): intake is TodayIntake => Boolean(intake))
          openSlots = collectOpenTimelineIntakes(timelines, logData, now, timeZone)
            .map(toTodayIntake)
            .filter((intake): intake is TodayIntake => Boolean(intake))
        } else {
          // How many of today's intakes are already decided (taken=true/false) per stack item.
          const decidedCountByStackItem = new Map<string, number>()
          const pendingLogIdsByStackItem = new Map<string, string[]>()
          for (const l of logData) {
            if (format(parseISO(l.logged_at), 'yyyy-MM-dd') !== todayKey) continue
            if (l.taken !== null) {
              decidedCountByStackItem.set(l.stack_item_id, (decidedCountByStackItem.get(l.stack_item_id) ?? 0) + 1)
            } else if (l.id) {
              const pendingIds = pendingLogIdsByStackItem.get(l.stack_item_id) ?? []
              pendingIds.unshift(l.id)
              pendingLogIdsByStackItem.set(l.stack_item_id, pendingIds)
            }
          }
          for (const c of cycles) {
            if (!cycleAppliesToDay(c, now)) continue
            const seg = scheduleForDay(c, now)
            const slots = resolveScheduleSlots(seg, now)
            const intakeOnly = c.stack_items.tracking_level === 'intake_only'
            slots.forEach(slot => {
              const resolvedQuantity = resolveHomeIntakeQuantity(c, now, escalations, slot.dose)
              const scheduledAt = new Date(now)
              scheduledAt.setHours(Math.floor(slot.minutes / 60), slot.minutes % 60, 0, 0)
              todaySlots.push({
                key: `${c.id}-${slot.minutes}`,
                min: slot.minutes,
                time: slot.time,
                substance: c.stack_items.display_name,
                dose: intakeOnly ? null : resolvedQuantity.dose,
                doseNumber: intakeOnly ? null : resolvedQuantity.doseNumber,
                unit: intakeOnly ? null : resolvedQuantity.unit,
                stackItemId: c.stack_item_id,
                cycleId: c.id,
                planVersionId: null,
                pendingLogId: null,
                routineGroup: slot.routineGroup,
                trackingLevel: c.stack_items.tracking_level,
                dosageForm: c.stack_items.dosage_form,
                method: c.method,
                scheduledAt: scheduledAt.toISOString(),
              })
            })
          }
          todaySlots.sort((a, b) => a.min - b.min)
          const consumedByStackItem = new Map<string, number>()
          for (const slot of todaySlots) {
            const used = consumedByStackItem.get(slot.stackItemId) ?? 0
            if (used < (decidedCountByStackItem.get(slot.stackItemId) ?? 0)) {
              consumedByStackItem.set(slot.stackItemId, used + 1)
              continue
            }
            slot.pendingLogId = pendingLogIdsByStackItem.get(slot.stackItemId)?.shift() ?? null
            openSlots.push(slot)
          }
        }

        const injectionRows = injectionData ?? []
        const recentInjectionRows = injectionRows.filter(row => {
          const ageMs = Date.now() - parseISO(row.logged_at as string).getTime()
          return ageMs >= 0 && ageMs <= 7 * 24 * 60 * 60 * 1000
        })
        const pins = recentInjectionRows
          .filter(row => isHeroVector(row.position) && isHeroVector(row.normal))
          .slice(0, 4)
          .map(row => ({
            id: row.id as string,
            position: row.position as InjectionHeroPin['position'],
            normal: row.normal as InjectionHeroPin['normal'],
          }))

        if (cancelled) return
        setHomeTimelines(timelines)
        setTimelineLoadState('ready')
        setPlannedToday(todaySlots.length)
        setTodayIntakes(openSlots)
        setTodayDone(todaySlots.length > 0 && openSlots.length === 0)
        setInjectionHero({ pins })

        const stockItems = stackItemData as unknown as StockOverviewItem[]
        setExpiryAlerts(getPeptideExpiryAlerts(expirySources(stockItems)))
        const vialStock = vialStockOverview(stockItems, inventoryData as unknown as LegacyInventoryItem[])

        setOverview({
          activeCycles: FEATURES.planTimelineV2 ? timelines.filter(timeline => {
            const { status } = resolveCycleAt(timeline, now, timeZone)
            return status === 'active' || status === 'paused'
          }).length : cycles.length,
          peptides: (stackItemData ?? []).length,
          inventoryVials: vialStock.inventoryVials,
          loggedToday: (logData ?? []).filter((log) => log.taken === true && format(parseISO(log.logged_at), 'yyyy-MM-dd') === todayKey).length,
          lowStock: vialStock.lowStock,
        })

        // Auto-miss is secondary: today's slots must paint first. The lookback
        // walks every plan for every past day and was measured at >2s on the
        // main thread when it ran before setTimelineLoadState('ready').
        const lookbackDays = Math.max(0, differenceInDays(startOfDay(now), startOfDay(parseISO(autoMissSince))))
        const AUTO_MISS_DAY_BATCH = 7
        let oldestRemaining = lookbackDays
        const runAutoMissBatch = () => {
          if (cancelled) return
          if (FEATURES.planTimelineV2) {
            if (oldestRemaining < 1) return
            const newest = Math.max(1, oldestRemaining - AUTO_MISS_DAY_BATCH + 1)
            const missed = collectMissedTimelineIntakes(
              timelines, logData, now, timeZone, oldestRemaining, newest,
            )
            if (missed.length > 0) {
              const stackItemById = new Map(stackItemData.map(item => [item.id as string, item]))
              const entries = missed.flatMap(m => {
                if (!m.routineSlotKey || !m.planVersionId || !m.scheduledAt) return []
                const stackItem = stackItemById.get(m.stackItemId)
                const trackingLevel = (stackItem?.tracking_level ?? 'intake_only') as TodayIntake['trackingLevel']
                const intakeOnly = trackingLevel === 'intake_only'
                return [{
                  key: m.routineSlotKey,
                  cycleId: m.cycleId,
                  planVersionId: m.planVersionId,
                  pendingLogId: null,
                  stackItemId: m.stackItemId,
                  stackItemName: String(stackItem?.display_name ?? ''),
                  trackingLevel,
                  group: routineGroupFromMinutes(m.minutes),
                  scheduledAt: m.scheduledAt,
                  dose: intakeOnly ? null : m.slotDose,
                  unit: intakeOnly ? null : m.unit ?? null,
                  method: m.method ?? '',
                  injectable: isInjectableMethod(m.method),
                  selected: true,
                  actualDose: intakeOnly ? null : m.slotDose,
                  actualUnit: intakeOnly ? null : m.unit ?? null,
                } satisfies RoutineConfirmationEntry]
              })
              // Idempotent in Postgres: mehrere offene Tabs duerfen denselben
              // ueberfaelligen Slot gleichzeitig abschliessen, ohne 409. Kleine
              // Pakete verhindern ein Statement-Timeout bei laengerem Rueckstand.
              if (entries.length > 0) {
                void skipIntakeGroupsInBatches(homeDataClient as unknown as IntakeConfirmationClient, entries)
                  .catch(error => console.error('[Home] auto-miss error:', error))
              }
            }
            oldestRemaining = newest - 1
            if (oldestRemaining >= 1) missedTimer = window.setTimeout(runAutoMissBatch, 0)
            return
          }
          const missed = collectMissedIntakes(cycles, logData, now, parseISO(autoMissSince))
          if (missed.length === 0) return
          const cycleById = new Map(cycles.map(c => [c.id, c]))
          const rows = missed.map(m => {
            const c = cycleById.get(m.cycleId)!
            const at = startOfDay(parseISO(m.dateKey))
            at.setHours(Math.floor(m.minutes / 60), m.minutes % 60, 0, 0)
            const intakeOnly = c.stack_items.tracking_level === 'intake_only'
            const quantity = intakeOnly ? null : effectiveSlotQuantity(c, parseISO(m.dateKey), escalations, m.slotDose)
            return {
              user_id: user!.id,
              stack_item_id: c.stack_item_id,
              dose: quantity?.dose ?? null,
              unit: quantity?.unit ?? null,
              method: c.method ?? '',
              logged_at: at.toISOString(),
              taken: false,
              notes: AUTO_MISSED_NOTE,
            }
          })
          void homeDataClient.from('dose_logs').insert(rows)
        }
        missedTimer = window.setTimeout(runAutoMissBatch, 0)
      } catch {
        if (cancelled) return
        if (FEATURES.planTimelineV2) {
          setTimelineLoadState('error')
          setHomeTimelines([])
          setTodayIntakes([])
          setPlannedToday(0)
          setTodayDone(false)
        }
        setOverview(EMPTY_OVERVIEW)
        setExpiryAlerts([])
        setInjectionHero(EMPTY_INJECTION_HERO)
      }
    }
    void load()
    return () => {
      cancelled = true
      if (missedTimer !== undefined) window.clearTimeout(missedTimer)
    }
  }, [homeDataClient, user, homeReloadKey])

  const { t } = useTranslation()
  const locale = getDateLocale()
  const hour    = new Date().getHours()
  const greeting = hour < 12 ? t('greeting_morning') : hour < 18 ? t('greeting_day') : t('greeting_evening')
  const dateStr  = format(new Date(), "EEEE, d. MMMM", { locale })
  const statusLabel = todayDone
    ? t('stat_today_done')
    : t('home_status_empty', { defaultValue: 'Kein aktiver Plan' })
  const completionLevel = plannedToday > 0
    ? Math.min(100, Math.round((overview.loggedToday / plannedToday) * 100))
    : 0
  const todayIntakeByKey = new Map(todayIntakes.map(intake => [intake.key, intake]))
  const homeRoutineGroups = groupRoutineIntakes(todayIntakes.map(buildHomeRoutineIntake))

  const defaultHomeConfirmTime = (intake: TodayIntake) => format(new Date(intake.scheduledAt), 'HH:mm')

  const closeHomeIntakeSheets = () => {
    setSelectedHomeIntake(null)
    setHomeConfirmStep('choice')
  }

  const openTodayIntake = (intake: TodayIntake) => {
    setSelectedHomeIntake(intake)
    setHomeConfirmTime(defaultHomeConfirmTime(intake))
    setHomeConfirmStep('choice')
  }

  const openHomeIntakeTimeForm = (intake: TodayIntake) => {
    setHomeConfirmTime(defaultHomeConfirmTime(intake))
    setHomeConfirmStep('time')
  }

  const openHomeIntakeInjection = (intake: TodayIntake) => {
    closeHomeIntakeSheets()
    navigate(buildInjectionTrackerUrl({
      cycleId: intake.cycleId,
      scheduledAt: intake.scheduledAt,
      returnTo: '/',
    }))
  }

  const applyHomeSingleInventory = async (doseLogId: string) => {
    try {
      await applyInventoryConfirmation(homeDataClient, doseLogId)
      setHomeInventoryRetryIds(current => current.filter(id => id !== doseLogId))
    } catch {
      setHomeInventoryRetryIds(current => current.includes(doseLogId) ? current : [...current, doseLogId])
      toast.error(t('inventory_update_failed', { defaultValue: 'Bestand konnte nicht aktualisiert werden' }))
    }
  }

  const confirmHomeIntake = async (intake: TodayIntake, taken: boolean, timeValue?: string) => {
    if (!user) return
    if (FEATURES.planTimelineV2 && timelineLoadState !== 'ready') return
    try {
      const quantity = { dose: intake.doseNumber, unit: intake.unit }
      if (FEATURES.planTimelineV2 && taken) {
        const actualLoggedAt = buildHomeLoggedAt(intake.scheduledAt, timeValue)
        const timeline = homeTimelines.find(item => item.cycle.id === intake.cycleId)
        const resolved = timeline && resolveCycleAt(timeline, new Date(actualLoggedAt), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
        if (!resolved?.planVersion || resolved.status !== 'active') throw new Error('Intake timestamp is not active')
        const [savedLog] = await confirmIntakeGroup(
          homeDataClient as unknown as IntakeConfirmationClient,
          [{ ...buildConfirmationEntry(buildHomeRoutineIntake(intake)),
            planVersionId: resolved.planVersion.id, actualLoggedAt }],
        )
        const doseLogId = savedLog?.id
        if (doseLogId && (intake.dosageForm === 'vial' || intake.trackingLevel === 'complete')) {
          await applyHomeSingleInventory(doseLogId)
        }
      } else if (taken && hasTrackedQuantity(quantity)) {
        const doseLogId = await confirmIntakeDoseLog(homeDataClient, {
          userId: user.id,
          stackItemId: intake.stackItemId,
          dose: quantity.dose,
          unit: quantity.unit,
          method: intake.method ?? '',
          loggedAt: buildHomeLoggedAt(intake.scheduledAt, timeValue),
          doseLogId: intake.pendingLogId,
          debitVialStock: false,
        })
        if (intake.dosageForm === 'vial' || intake.trackingLevel === 'complete') {
          await applyHomeSingleInventory(doseLogId)
        }
      } else {
        const skippedAt = intake.pendingLoggedAt ?? intake.scheduledAt
        const skipTimeline = homeTimelines.find(item => item.cycle.id === intake.cycleId)
        const skipPlanVersionId = intake.pendingPlanVersionId ?? (skipTimeline
          ? resolveCycleAt(skipTimeline, new Date(skippedAt), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC').planVersion?.id
          : null)
        const payload = buildHomeDoseLogPayload({
          userId: user.id,
          stackItemId: intake.stackItemId,
          doseNumber: intake.doseNumber,
          unit: intake.unit,
          method: intake.method,
          scheduledAt: FEATURES.planTimelineV2 ? intake.pendingLoggedAt ?? intake.scheduledAt : intake.scheduledAt,
          taken,
          timeValue,
          cycleId: FEATURES.planTimelineV2 ? intake.cycleId : null,
          planVersionId: FEATURES.planTimelineV2 ? skipPlanVersionId : null,
          routineSlotKey: FEATURES.planTimelineV2 ? intake.key : null,
        })
        if (FEATURES.planTimelineV2) {
          await skipIntakeGroup(
            homeDataClient as unknown as IntakeConfirmationClient,
            [{
              ...buildConfirmationEntry(buildHomeRoutineIntake(intake)),
              planVersionId: skipPlanVersionId ?? null,
              actualLoggedAt: skippedAt,
            }],
          )
        } else {
          const { error } = await homeDataClient.from('dose_logs').insert(payload)
          if (error) throw error
        }
      }
      closeHomeIntakeSheets()
      setHomeReloadKey(value => value + 1)
      if (taken) toast.success(t('einnahme_bestaetigt', { defaultValue: 'Einnahme bestätigt' }))
      else toast(t('einnahme_uebersp_toast', { defaultValue: 'Einnahme übersprungen' }))
    } catch (error) {
      console.error('[Home] confirmHomeIntake error:', error)
      toast.error(t('fehler_speichern', { defaultValue: 'Fehler beim Speichern' }))
      if (FEATURES.planTimelineV2 && !taken) setHomeReloadKey(value => value + 1)
    }
  }

  const confirmHomeRoutine = async (entries: RoutineConfirmationEntry[]): Promise<string[]> => {
    if (!user) return []
    if (FEATURES.planTimelineV2 && timelineLoadState !== 'ready') throw new Error('Timeline is not current')
    const saved = await confirmIntakeGroup(
      homeDataClient as unknown as IntakeConfirmationClient,
      entries,
    )
    homeRoutineCommitted.current = true
    return saved.map(row => row.id)
  }

  const afterHomeRoutineConfirmed = async (
    entries: RoutineConfirmationEntry[],
    savedLogIds: string[],
  ) => {
    if (!user) return
    const vialStackItemIds = new Set(
      todayIntakes.filter(intake => intake.dosageForm === 'vial').map(intake => intake.stackItemId),
    )
    const selectedEntries = entries.filter(entry => entry.selected)
    const confirmedEntries = selectedEntries.map((entry, index) => ({
      entry,
      doseLogId: savedLogIds[index],
    })).filter(item => Boolean(item.doseLogId))
    const stockUpdates = quantifiedVialEntries(entries, vialStackItemIds).map(async entry => {
      const doseLogId = confirmedEntries.find(item => item.entry.key === entry.key)?.doseLogId
      if (!doseLogId) return
      await debitPeptideStockForDoseById(homeDataClient, doseLogId)
    })
    const genericEntries = confirmedEntries.filter(({ entry }) => (
      entry.trackingLevel === 'complete'
      && !vialStackItemIds.has(entry.stackItemId)
    ))
    const [stockResults, inventoryResults] = await Promise.all([
      Promise.allSettled(stockUpdates),
      Promise.allSettled(genericEntries.map(({ doseLogId }) => (
        applyInventoryConfirmation(homeDataClient, doseLogId)
      ))),
    ])
    setHomeReloadKey(value => value + 1)
    toast.success(t('einnahme_bestaetigt', { defaultValue: 'Einnahme bestätigt' }))
    const failedVialIds = quantifiedVialEntries(entries, vialStackItemIds)
      .map(entry => confirmedEntries.find(item => item.entry.key === entry.key)?.doseLogId)
      .filter((doseLogId, index): doseLogId is string => (
        Boolean(doseLogId) && stockResults[index].status === 'rejected'
      ))
    const failedInventoryIds = genericEntries
      .filter((_, index) => inventoryResults[index].status === 'rejected')
      .map(item => item.doseLogId)
    const failedDoseLogIds = [...failedVialIds, ...failedInventoryIds]
    if (failedDoseLogIds.length > 0) {
      throw new InventoryConfirmationError(failedDoseLogIds)
    }
  }

  const openHomeRoutineInjection = (entry: RoutineIntake, doseLogId: string) => {
    navigate(buildInjectionTrackerUrl({
      doseLogId,
      cycleId: entry.cycleId,
      scheduledAt: entry.scheduledAt,
      returnTo: '/',
    }))
  }

  return (
    <div style={pageStyle} className="stagger-in">
      {/* ── Kopf: großer Titel wie in iOS, Profil als Glas-Knopf ── */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '4px 4px 0' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--lg-text-2)' }}>
            {dateStr}
          </p>
          <h1 style={largeTitleStyle}>
            {greeting}
          </h1>
        </div>
        <button
          onClick={() => navigate('/profil')}
          aria-label={String(t('tile_profil'))}
          className="lg-glass lg-press"
          style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--lg-text)' }}
        >
          <User size={20} />
        </button>
      </header>

      {/* ── Heute: ein Ring wie bei den Aktivitätsringen ── */}
      <section className="lg-surface" style={{ ...panelStyle, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <TodayRing percent={completionLevel} done={completionLevel >= 100} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>
              {t('home_completion', { defaultValue: 'Heute erledigt' })}
            </p>
            <p style={{ marginTop: 3, fontSize: 15, lineHeight: 1.35, color: 'var(--lg-text-2)' }}>
              {`${overview.loggedToday}/${plannedToday} ${t('home_completion_unit', { defaultValue: 'Einnahmen geloggt' })}`}
            </p>
            {todayIntakes.length === 0 && (!FEATURES.planTimelineV2 || timelineLoadState === 'ready') && (
              <p style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: todayDone ? 'var(--lg-good)' : 'var(--accent)' }}>
                <ShieldCheck size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                {statusLabel}
              </p>
            )}
          </div>
        </div>

        {FEATURES.planTimelineV2 && timelineLoadState !== 'ready' && (
          <div role={timelineLoadState === 'error' ? 'alert' : 'status'} className="text-sm text-slate-400">
            {timelineLoadState === 'loading'
              ? t('loading', { defaultValue: 'Lädt…' })
              : <>
                  <p>{t('my_stack_plan_load_error', { defaultValue: 'Die Einnahmepläne konnten nicht geladen werden. Deine übrigen Daten bleiben verfügbar.' })}</p>
                  <button type="button" className="mt-2 min-h-11 text-sky-400" onClick={() => setHomeReloadKey(value => value + 1)}>
                    {t('routine_confirmation_retry', { defaultValue: 'Erneut versuchen' })}
                  </button>
                </>}
          </div>
        )}
      </section>

      {homeInventoryRetryIds.length > 0 && (
        <div role="alert" className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm font-bold text-amber-200">
          <p>{t('inventory_committed_retry', { defaultValue: 'Die Einnahme ist gespeichert, aber der Bestand wurde nicht aktualisiert.' })}</p>
          <button
            type="button"
            onClick={() => void Promise.all(homeInventoryRetryIds.map(applyHomeSingleInventory))}
            className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/15 px-3 text-sm font-black text-amber-100 transition-colors hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <RotateCcw size={15} aria-hidden="true" /> {t('inventory_retry', { defaultValue: 'Bestand erneut versuchen' })}
          </button>
        </div>
      )}

      {/* ── Anstehende Einnahmen: je Tageszeit eine Gruppe ── */}
      {homeRoutineGroups.length > 0 && (
        <section>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>{t('home_upcoming_intakes', { defaultValue: 'Anstehende Einnahmen' })}</h2>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-text-3)' }}>{t('home_due_in', { defaultValue: 'fällig in:' })}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {homeRoutineGroups.map(group => {
              const groupLabel = t(ROUTINE_GROUP_LABELS[group.key].key, ROUTINE_GROUP_LABELS[group.key])
              const groupIntakes = group.items
                .map(item => todayIntakeByKey.get(item.key))
                .filter((intake): intake is TodayIntake => Boolean(intake))
              return (
                <div key={group.key} className="lg-surface" style={{ ...panelStyle, padding: '12px 14px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-text-2)' }}>
                      {groupLabel}
                    </p>
                    <button
                      type="button"
                      aria-label={`${t('routine_confirmation_confirm_all', { defaultValue: 'Alle als eingenommen markieren' })} – ${groupLabel}`}
                      onClick={() => { homeRoutineCommitted.current = false; setSelectedHomeRoutine(group) }}
                      className="lg-press"
                      style={confirmAllStyle}
                    >
                      <CheckCircle2 size={15} aria-hidden="true" /> {t('routine_confirmation_confirm_all', { defaultValue: 'Alle als eingenommen markieren' })}
                    </button>
                  </div>
                  <TodayIntakeCarousel
                    intakes={groupIntakes}
                    onItemClick={openTodayIntake}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {selectedHomeRoutine && (
        <RoutineConfirmationSheet
          group={selectedHomeRoutine}
          onClose={() => setSelectedHomeRoutine(null)}
          onConfirm={confirmHomeRoutine}
          onAfterConfirm={afterHomeRoutineConfirmed}
          onAddInjection={openHomeRoutineInjection}
        />
      )}

      {selectedHomeIntake && homeConfirmStep === 'choice' && (
        <HomeIntakeConfirmSheet
          intake={selectedHomeIntake}
          onClose={closeHomeIntakeSheets}
          onTaken={() => openHomeIntakeTimeForm(selectedHomeIntake)}
          onSkipped={() => confirmHomeIntake(selectedHomeIntake, false)}
          onInjection={isInjectableMethod(selectedHomeIntake.method) ? () => openHomeIntakeInjection(selectedHomeIntake) : undefined}
        />
      )}

      {selectedHomeIntake && homeConfirmStep === 'time' && (
        <HomeIntakeTimeSheet
          intake={selectedHomeIntake}
          timeValue={homeConfirmTime}
          onBack={() => setHomeConfirmStep('choice')}
          onClose={closeHomeIntakeSheets}
          onNow={() => setHomeConfirmTime(format(new Date(), 'HH:mm'))}
          onTimeChange={setHomeConfirmTime}
          onSave={() => confirmHomeIntake(selectedHomeIntake, true, homeConfirmTime)}
        />
      )}

      {/* ── Überblick: drei Zahlen nebeneinander ── */}
      <section>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>{t('home_overview_title', { defaultValue: 'Heute im Blick' })}</h2>
          <button
            onClick={() => navigate('/kalender')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, color: 'var(--accent)', fontSize: 15, fontWeight: 600 }}
          >
            {t('today')} <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <InsightCard
            icon={CalendarDays}
            label={String(t('stat_active_cycles'))}
            value={String(overview.activeCycles)}
            hint={String(t('home_active_cycles_hint', { defaultValue: 'laufende Pläne' }))}
            accent="#00ccf5"
            onClick={() => navigate('/kalender')}
          />
          <InsightCard
            icon={FlaskConical}
            label={String(t('stat_peptides'))}
            value={String(overview.peptides)}
            hint={String(t('home_peptides_hint', { defaultValue: 'rekonstituiert' }))}
            accent="#8b7cf0"
            onClick={() => navigate('/my-stack')}
          />
          <InsightCard
            icon={Package}
            label={String(t('stat_vials'))}
            value={String(overview.inventoryVials)}
            hint={overview.lowStock > 0
              ? String(t('home_low_stock', { defaultValue: '{{count}} niedrig', count: overview.lowStock }))
              : String(t('home_stock_ok', { defaultValue: 'Vorrat erfasst' }))}
            accent={overview.lowStock > 0 ? '#ff9f0a' : '#30d158'}
            onClick={() => navigate('/my-stack?tab=inventar')}
          />
        </div>
      </section>

      <InjectionTrackerHero
        pins={injectionHero.pins}
        onOpen={() => navigate('/injektionen')}
      />

      <section>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>{t('pk_live_title')}</h2>
        </div>
        <BlutspiegelView variant="compact" />
        <p className="disclaimer" style={{ marginTop: 8 }}>{t('pk_sim_disclaimer')}</p>
      </section>

      <ExpiryWarningBanners alerts={expiryAlerts} />

      {/* ── Direkt loslegen: Kacheln mit farbigem Symbol ── */}
      <section>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>{t('home_quick_title', { defaultValue: 'Direkt loslegen' })}</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS
            .filter(action => action.path !== '/progress' || FEATURES.FOTO_PROGRESS)
            .map((action, idx, arr) => {
              const isLastOdd = arr.length % 2 === 1 && idx === arr.length - 1
              return (
                <QuickAction
                  key={action.labelKey}
                  icon={action.icon}
                  label={String(t(action.labelKey, { defaultValue: action.label }))}
                  desc={String(t(action.descKey, { defaultValue: action.desc }))}
                  accent={action.accent}
                  wide={isLastOdd}
                  onClick={() => navigate(action.path)}
                />
              )
            })}
        </div>
      </section>

      {/* ── Studie des Tages ── */}
      <section className="lg-surface" style={{ ...panelStyle, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ ...iconTileStyle('#00b4e0'), width: 30, height: 30 }}>
            {(() => { const StudyIcon = todayStudy.icon; return <StudyIcon size={17} /> })()}
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-text-3)' }}>{t('stat_study')}</p>
            <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', lineHeight: 1.25 }}>
              {t('home_daily_research', { defaultValue: 'Daily Research' })}
            </p>
          </div>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--text)' }}>
          {todayStudy.title}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--lg-text-3)' }}>
            {todayStudy.source}
          </p>
          <button
            onClick={() => navigate('/lab')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, color: 'var(--accent)', fontSize: 15, fontWeight: 600 }}
          >
            {t('lab_snapshot_discover', { defaultValue: 'Entdecken' })} <ChevronRight size={16} />
          </button>
        </div>
      </section>

      {/* ── Mehr aus deinen Daten: wischbare Karten ── */}
      <section>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>{t('home_features_title', { defaultValue: 'Mehr aus deinen Daten machen' })}</h2>
        </div>
        <div className="lg-swipe">
          {FEATURE_CARDS.map((feature) => (
            <FeatureCard
              key={feature.labelKey}
              icon={feature.icon}
              label={String(t(feature.labelKey, { defaultValue: feature.label }))}
              desc={String(t(feature.descKey, { defaultValue: feature.desc }))}
              cta={String(t('home_feature_cta', { defaultValue: 'Öffnen' }))}
              metric={feature.metric}
              accent={feature.accent}
              onClick={() => navigate(feature.path)}
            />
          ))}
        </div>
      </section>

      <WorkflowBanner userId={user?.id} />

      {/* ── Alle Bereiche: gruppierte Liste wie in den iOS-Einstellungen ── */}
      <section>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>{t('home_all_tools', { defaultValue: 'Alle Tools' })}</h2>
        </div>
        <div className="lg-surface" style={{ ...panelStyle }} data-ob="home-tiles">
          {TILE_DEFS.map(tile => (
            <TileButton
              key={tile.labelKey}
              icon={tile.icon}
              label={String(t(tile.labelKey, { defaultValue: tile.label ?? tile.labelKey }))}
              desc={String(t(tile.descKey, { defaultValue: tile.desc ?? tile.descKey }))}
              color={tile.color}
              onClick={() => navigate(tile.path)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

/** Kontrast nach WCAG zwischen zwei Hex-Farben (#rrggbb). */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/**
 * Symbol-Quadrat wie in den iOS-Einstellungen: volle Farbe, Glyphe in der
 * lesbareren von Weiß/Dunkel. Erwartet #rrggbb (wie alle Kachel-Farben);
 * andere Formate bekommen eine weiße Glyphe.
 */
function iconTileStyle(color: string): CSSProperties {
  const glyph = /^#[0-9a-f]{6}$/i.test(color) && contrast(color, '#00141c') > contrast(color, '#ffffff') ? '#00141c' : '#ffffff'
  return {
    width: 32,
    height: 32,
    borderRadius: 9,
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    background: color,
    color: glyph,
  }
}

/** Tagesring wie die Aktivitätsringe: Verlauf entlang des Rings, voll = grün. */
function TodayRing({ percent, done }: { percent: number; done: boolean }) {
  const p = Math.max(0, Math.min(100, percent)) / 100
  const [from, to] = done ? ['#1fae4b', '#a6f36b'] : ['#00a9d4', '#5ae0ff']
  const ring = 'radial-gradient(farthest-side, transparent calc(100% - 11px), #000 calc(100% - 10.5px))'
  return (
    <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `conic-gradient(${from} 0turn, ${to} ${p}turn, ${from}2e ${p}turn)`,
          WebkitMask: ring,
          mask: ring,
        }}
      />
      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
        {percent}%
      </span>
    </div>
  )
}

const ellipsis: CSSProperties = { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

function QuickAction({
  icon: Icon,
  label,
  desc,
  accent,
  wide,
  onClick,
}: {
  icon: LucideIcon
  label: string
  desc: string
  accent: string
  wide?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={wide ? 'lg-surface col-span-2 lg-press' : 'lg-surface lg-press'}
      style={{
        ...panelStyle,
        minHeight: 96,
        padding: 14,
        display: 'flex',
        flexDirection: wide ? 'row' : 'column',
        alignItems: wide ? 'center' : 'flex-start',
        gap: wide ? 12 : 10,
        textAlign: 'left',
      }}
    >
      <span style={iconTileStyle(accent)}><Icon size={17} /></span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.25 }}>
          {label}
        </span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 13, lineHeight: 1.3, color: 'var(--lg-text-3)' }}>
          {desc}
        </span>
      </span>
    </button>
  )
}

function InsightCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  onClick,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  accent: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="lg-surface lg-press"
      style={{
        ...panelStyle,
        minWidth: 0,
        minHeight: 112,
        padding: '12px 12px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        textAlign: 'left',
      }}
    >
      <Icon size={18} color={accent} aria-hidden="true" />
      <span style={{ marginTop: 10, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      {/* Darf umbrechen: drei Spalten sind am iPhone SE nur ~90 px breit */}
      <span style={{ marginTop: 6, fontSize: 13, fontWeight: 600, lineHeight: 1.25, color: 'var(--lg-text-2)', overflowWrap: 'anywhere', hyphens: 'auto' }}>
        {label}
      </span>
      <span style={{ marginTop: 2, fontSize: 12, lineHeight: 1.25, color: 'var(--lg-text-3)', overflowWrap: 'anywhere', hyphens: 'auto' }}>
        {hint}
      </span>
    </button>
  )
}

// Mitwachsendes Countdown-Format:
//  >= 10h  -> "22h"
//  >= 1h   -> "9h59min"
//  >= 1min -> "59min23sek"
//  < 1min  -> "23sek"
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h >= 10) return `${h}h`
  if (h >= 1) return `${h}h${m}min`
  if (m >= 1) return `${m}min${s}sek`
  return `${s}sek`
}

function msUntilTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const target = new Date()
  target.setHours(h, m, 0, 0)
  return target.getTime() - Date.now()
}

// Höhe einer Einnahmen-Zeile (für das vertikale Karussell-Snapping).
const INTAKE_ROW_H = 52

// Text, der nur DANN horizontal durchläuft, wenn er nicht in eine Zeile passt
// (sonst statisch). So bleibt der gesamte Zeileninhalt lesbar.
function MarqueeText({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const wrap = wrapRef.current, inner = innerRef.current
    if (!wrap || !inner) return
    let anim: Animation | null = null
    const setup = () => {
      anim?.cancel()
      const overflow = inner.scrollWidth - wrap.clientWidth
      if (overflow <= 4) { inner.style.transform = 'translateX(0)'; return }   // passt → statisch
      const holdStart = 2200, holdEnd = 1200            // Pausen (still stehen)
      const moveOut = Math.max(1800, overflow * 35)     // langsam durchlaufen
      const moveBack = Math.max(700, overflow * 14)     // zügig zurück
      const total = holdStart + moveOut + holdEnd + moveBack
      anim = inner.animate(
        [
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: holdStart / total },
          { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut) / total },
          { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut + holdEnd) / total },
          { transform: 'translateX(0)', offset: 1 },
        ],
        { duration: total, iterations: Infinity, easing: 'linear' },
      )
    }
    setup()
    const ro = new ResizeObserver(setup)
    ro.observe(wrap); ro.observe(inner)
    return () => { anim?.cancel(); ro.disconnect() }
    // Inhalt pro Zeile ist stabil (Row ist gekeyed) → nur einmal aufsetzen,
    // sonst würde der 1-Sekunden-Timer-Tick die Animation ständig neu starten.
  }, [])
  return (
    <span ref={wrapRef} style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', ...style }}>
      <span ref={innerRef} style={{ display: 'inline-block', willChange: 'transform' }}>
        {children}
      </span>
    </span>
  )
}

function HomeIntakeConfirmSheet({
  intake,
  onClose,
  onTaken,
  onSkipped,
  onInjection,
}: {
  intake: TodayIntake
  onClose: () => void
  onTaken: () => void
  onSkipped: () => void
  onInjection?: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <button
        type="button"
        aria-label="Bestätigung schließen"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/70"
      />
      <div data-app-modal role="dialog" aria-modal="true" className="fixed inset-x-2 bottom-2 z-[60] rounded-[34px] p-5 shadow-[0_-16px_48px_rgba(0,0,0,0.55)]" style={homeSheetStyle}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-cyan-300">Anstehende Einnahme</p>
            <h2 className="mt-1 text-[20px] font-bold leading-tight text-white">Wie möchtest du bestätigen?</h2>
            <p className="mt-1 truncate text-[15px] text-slate-300">
              {[intake.substance, intake.dose].filter(Boolean).join(' · ')} · {intake.time}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-app-back-close
            aria-label={String(t('close'))}
            className="lg-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-300" style={{ background: 'var(--lg-fill)' }}
          >
            <XCircle size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onTaken} className="lg-press flex min-h-12 items-center justify-center gap-2 rounded-full px-3 text-[15px] font-semibold" style={takenStyle}>
              <CheckCircle2 size={16} aria-hidden="true" /> Eingenommen
            </button>
            <button type="button" onClick={onSkipped} className="btn-danger min-h-12">
              <XCircle size={16} aria-hidden="true" /> Übersprungen
            </button>
          </div>
          {onInjection && (
            <button type="button" onClick={onInjection} className="btn-secondary min-h-12">
              <Syringe size={16} aria-hidden="true" /> Mit Injektion bestätigen
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function HomeIntakeTimeSheet({
  intake,
  timeValue,
  onBack,
  onClose,
  onNow,
  onTimeChange,
  onSave,
}: {
  intake: TodayIntake
  timeValue: string
  onBack: () => void
  onClose: () => void
  onNow: () => void
  onTimeChange: (value: string) => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <button
        type="button"
        aria-label="Zeitformular schließen"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/70"
      />
      <div data-app-modal data-app-back-dirty-on-interaction role="dialog" aria-modal="true" className="fixed inset-x-2 bottom-2 z-[60] rounded-[34px] p-5 shadow-[0_-16px_48px_rgba(0,0,0,0.55)]" style={homeSheetStyle}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-emerald-300">Einnahme bestätigen</p>
            <h2 className="mt-1 text-[20px] font-bold leading-tight text-white">Wann hast du tatsächlich eingenommen?</h2>
            <p className="mt-1 truncate text-[15px] text-slate-300">
              {[intake.substance, intake.dose].filter(Boolean).join(' · ')} · geplant {intake.time}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={String(t('close'))}
            className="lg-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-300" style={{ background: 'var(--lg-fill)' }}
          >
            <XCircle size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="text-[13px] font-semibold text-slate-400" htmlFor="home-intake-confirm-time">
            Uhrzeit
          </label>
          <button
            type="button"
            onClick={onNow}
            className="lg-press flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold text-sky-300" style={{ background: 'var(--lg-fill)' }}
          >
            <Clock3 size={13} aria-hidden="true" /> Jetzt
          </button>
        </div>
        <input
          id="home-intake-confirm-time"
          type="time"
          value={timeValue}
          onChange={event => onTimeChange(event.target.value)}
          className="input mb-4 font-semibold"
          style={{ colorScheme: 'dark' }}
        />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onBack} data-app-back-close className="btn-secondary min-h-12">
            Zurück
          </button>
          <button type="button" onClick={onSave} className="btn-primary min-h-12">
            <CheckCircle2 size={16} aria-hidden="true" /> Speichern
          </button>
        </div>
      </div>
    </>
  )
}

// Eine kompakte, einzeilige Einnahmen-Zeile mit Live-Timer (Countdown bis zur
// Einnahme, danach „Jetzt fällig").
function IntakeRow({
  time,
  substance,
  dose,
  onClick,
}: {
  time: string
  substance: string | null
  dose?: string | null
  onClick: () => void
}) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(() => msUntilTime(time))
  useEffect(() => {
    const id = setInterval(() => setRemaining(msUntilTime(time)), 1000)
    return () => clearInterval(id)
  }, [time])

  const due = remaining <= 0
  const c = due ? 'var(--lg-warn)' : 'var(--accent)'

  return (
    <button
      type="button"
      onClick={onClick}
      className="lg-press"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: INTAKE_ROW_H, textAlign: 'left', cursor: 'pointer',
        padding: '0 2px', border: 0, background: 'none',
      }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
        background: due ? 'color-mix(in srgb, var(--lg-warn) 18%, transparent)' : 'var(--accent-weak)', color: c,
      }}>
        {due ? <Bell size={15} className="pulse-soft" /> : <Clock3 size={15} />}
      </span>
      <MarqueeText style={{ flex: 1, minWidth: 0, fontSize: 17, color: 'var(--text)' }}>
        {[substance, dose].filter(Boolean).join(' · ') || t('stat_next_intake', { defaultValue: 'Nächste Einnahme' })}
        <span style={{ color: 'var(--lg-text-3)' }}>{` · ${t('home_at_time', { defaultValue: 'um' })} ${time}`}</span>
      </MarqueeText>
      {due ? (
        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: c }}>
          <span className="pulse-soft" style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block' }} />
          {t('home_due_label', { defaultValue: 'Jetzt fällig' })}
        </span>
      ) : (
        <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 600, color: 'var(--lg-text-2)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtCountdown(remaining)}
        </span>
      )}
    </button>
  )
}

// Vertikales Einzeiler-Karussell: eine Einnahme im Fokus, Nachbarn oben/unten
// lugen hervor und faden aus. Vertikal scroll-/wischbar mit Snap.
function TodayIntakeCarousel({ intakes, onItemClick }: { intakes: TodayIntake[]; onItemClick: (intake: TodayIntake) => void }) {
  if (intakes.length <= 1) {
    return intakes.length === 1
      ? <IntakeRow time={intakes[0].time} substance={intakes[0].substance} dose={intakes[0].dose} onClick={() => onItemClick(intakes[0])} />
      : null
  }
  const height = INTAKE_ROW_H * 2.5   // Fokus + Andeutung der Nachbarn
  const padBlock = (height - INTAKE_ROW_H) / 2
  return (
    <div
      className="no-scrollbar"
      style={{
        height, overflowY: 'auto', scrollSnapType: 'y mandatory',
        display: 'flex', flexDirection: 'column', gap: 4,
        paddingBlock: padBlock,
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
      }}
    >
      {intakes.map((it, i) => (
        <div key={`${it.stackItemId}-${it.min}-${i}`} style={{ scrollSnapAlign: 'center', flexShrink: 0 }}>
          <IntakeRow time={it.time} substance={it.substance} dose={it.dose} onClick={() => onItemClick(it)} />
        </div>
      ))}
    </div>
  )
}

function FeatureCard({
  icon: Icon,
  label,
  desc,
  cta,
  metric,
  accent,
  onClick,
}: {
  icon: LucideIcon
  label: string
  desc: string
  cta: string
  metric: string
  accent: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="lg-surface lg-press"
      style={{
        ...panelStyle,
        flex: '0 0 74%',
        maxWidth: 300,
        scrollSnapAlign: 'start',
        padding: 16,
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={iconTileStyle(accent)}><Icon size={17} /></span>
        <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--lg-fill)', color: 'var(--lg-text-2)', fontSize: 12, fontWeight: 600 }}>
          {metric}
        </span>
      </span>
      <span style={{ display: 'block', fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>
        {label}
      </span>
      <span style={{ display: 'block', marginTop: 4, fontSize: 13, lineHeight: 1.4, color: 'var(--lg-text-3)' }}>
        {desc}
      </span>
      <span style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 15, fontWeight: 600 }}>
        {cta} <ChevronRight size={16} />
      </span>
    </button>
  )
}

/** Eine Zeile der gruppierten Liste „Alle Tools" — wie eine Zeile der iOS-Einstellungen. */
function TileButton({
  icon: Icon,
  label,
  desc,
  color,
  onClick,
}: {
  icon: LucideIcon
  label: string
  desc: string
  color: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="lg-row">
      <span style={iconTileStyle(color)}><Icon size={17} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 17, color: 'var(--text)' }}>{label}</span>
        <span style={{ ...ellipsis, marginTop: 1, fontSize: 13, color: 'var(--lg-text-3)' }}>{desc}</span>
      </span>
      <ChevronRight size={18} color="var(--lg-text-4)" aria-hidden="true" style={{ flexShrink: 0 }} />
    </button>
  )
}
