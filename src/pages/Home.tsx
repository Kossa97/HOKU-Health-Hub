import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FEATURES } from '../config/features'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays, FlaskConical, Archive, Calculator,
  BookHeart, Star, HelpCircle, User, ChevronRight,
  Microscope, Library, Droplets, Heart, FileText, type LucideIcon,
  Activity, ArrowUpRight, CheckCircle2, ClipboardList,
  Clock3, Package, ShieldCheck, Sparkles,
  Syringe, TrendingUp, Bell, XCircle, RotateCcw,
  Dumbbell, Dna, Zap, Moon, Brain, Bandage, HeartPulse, Lightbulb, Leaf, Bone, Utensils,
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
  bg: string
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
  { icon: CalendarDays, labelKey: 'tile_kalender',    descKey: 'tile_kalender_desc',    path: '/kalender',             color: '#00ccf5', bg: 'rgba(0,204,245,0.10)'          },
  { icon: Syringe,      labelKey: 'tile_injektionen', descKey: 'tile_injektionen_desc', path: '/injektionen',          color: '#10b981', bg: 'rgba(16,185,129,0.10)'         },
  { icon: Archive,      labelKey: 'tile_lager',       descKey: 'tile_lager_desc',       path: '/my-stack?tab=inventar', color: '#00ccf5', bg: 'rgba(0,204,245,0.10)'         },
  { icon: FlaskConical, labelKey: 'tile_peptide',     descKey: 'tile_peptide_desc',     path: '/my-stack',             color: '#22d3ee', bg: 'rgba(34,211,238,0.10)'         },
  { icon: Calculator,   labelKey: 'tile_rechner',     descKey: 'tile_rechner_desc',     path: '/rechner',              color: '#3b82f6', bg: 'rgba(59,130,246,0.10)'         },
  { icon: Droplets,     labelKey: 'tile_blutwerte',   descKey: 'tile_blutwerte_desc',   path: '/blutwerte',            color: '#f43f5e', bg: 'rgba(244,63,94,0.10)', label: 'Blutwerte', desc: 'Laborwerte erfassen' },
  { icon: Heart,        labelKey: 'tile_health',      descKey: 'tile_health_desc',      path: '/health',               color: '#f43f5e', bg: 'rgba(244,63,94,0.10)'          },
  { icon: FileText,     labelKey: 'tile_protokoll',   descKey: 'tile_protokoll_desc',   path: '/protokoll',            color: '#00ccf5', bg: 'rgba(0,204,245,0.10)', label: 'PDF-Generator', desc: 'Report mit Live-Vorschau' },
  { icon: Microscope,   labelKey: 'tile_lab',         descKey: 'tile_lab_desc',         path: '/lab',                  color: '#00ccf5', bg: 'rgba(0,204,245,0.10)'          },
  { icon: Library,      labelKey: 'tile_bibliothek',  descKey: 'tile_bibliothek_desc',  path: '/lab/peptipedia',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)'         },
  { icon: Utensils,     labelKey: 'tile_ernaehrung',  descKey: 'tile_ernaehrung_desc',  path: '/ernaehrung',           color: '#f59e0b', bg: 'rgba(245,158,11,0.10)'         },
  { icon: BookHeart,    labelKey: 'tile_tagebuch',    descKey: 'tile_tagebuch_desc',    path: '/tagebuch',             color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)'         },
  { icon: Star,         labelKey: 'tile_bewertungen', descKey: 'tile_bewertungen_desc', path: '/bewertungen',          color: '#f59e0b', bg: 'rgba(245,158,11,0.10)'         },
  { icon: HelpCircle,   labelKey: 'tile_faq',         descKey: 'tile_faq_desc',         path: '/faq',                  color: '#10b981', bg: 'rgba(16,185,129,0.10)'         },
  { icon: User,         labelKey: 'tile_profil',      descKey: 'tile_profil_desc',      path: '/profil',               color: '#f43f5e', bg: 'rgba(244,63,94,0.10)'          },
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
  gap: 18,
  paddingBottom: 8,
}

const panelStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--card-border)',
  borderRadius: 24,
  boxShadow: 'var(--shadow-card)',
  position: 'relative',
  overflow: 'hidden',
}

const labelStyle: CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 800,
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
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
  marginBottom: 10,
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
      <section style={{ ...panelStyle, padding: 18 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 88% 10%, rgba(0,204,245,0.22), transparent 32%), radial-gradient(circle at 8% 88%, rgba(139,92,246,0.18), transparent 34%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...labelStyle, color: 'var(--accent)', marginBottom: 7 }}>
                {dateStr}
              </p>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.045em', color: 'var(--text)', lineHeight: 1.04 }}>
                {greeting}
              </h1>
            </div>

            <button
              onClick={() => navigate('/profil')}
              aria-label={String(t('tile_profil'))}
              style={{
                width: 42,
                height: 42,
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.045)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--accent)',
              }}
            >
              <User size={18} />
            </button>
          </div>

          <HeroStat
            icon={Activity}
            label={String(t('home_completion', { defaultValue: 'Heute erledigt' }))}
            value={`${completionLevel}%`}
            hint={`${overview.loggedToday}/${plannedToday} ${t('home_completion_unit', { defaultValue: 'Einnahmen geloggt' })}`}
            accent="#8b5cf6"
          />

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
          {todayIntakes.length === 0 && (!FEATURES.planTimelineV2 || timelineLoadState === 'ready') && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 18,
              background: todayDone ? 'rgba(16,185,129,0.10)' : 'var(--accent-weak)',
              border: todayDone ? '1px solid rgba(16,185,129,0.22)' : '1px solid var(--accent-border)',
            }}>
              <ShieldCheck size={18} color={todayDone ? '#10b981' : 'var(--accent)'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
                  {statusLabel}
                </p>
                <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {t('home_status_hint', { defaultValue: 'Schnellzugriff auf die wichtigsten Schritte.' })}
                </p>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          )}
        </div>
      </section>

      <InjectionTrackerHero
        pins={injectionHero.pins}
        onOpen={() => navigate('/injektionen')}
      />

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

      {homeRoutineGroups.length > 0 && (
        <section style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <p style={labelStyle}>{t('home_upcoming_intakes', { defaultValue: 'Anstehende Einnahmen' })}</p>
            <p style={{ ...labelStyle, fontSize: '0.55rem' }}>{t('home_due_in', { defaultValue: 'fällig in:' })}</p>
          </div>
          <div className="space-y-4">
            {homeRoutineGroups.map(group => {
              const groupLabel = t(ROUTINE_GROUP_LABELS[group.key].key, ROUTINE_GROUP_LABELS[group.key])
              const groupIntakes = group.items
                .map(item => todayIntakeByKey.get(item.key))
                .filter((intake): intake is TodayIntake => Boolean(intake))
              return (
                <div key={group.key} className="space-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-cyan-300">
                      {groupLabel}
                    </p>
                    <button
                      type="button"
                      aria-label={`${t('routine_confirmation_confirm_all', { defaultValue: 'Alle als eingenommen markieren' })} – ${groupLabel}`}
                      onClick={() => { homeRoutineCommitted.current = false; setSelectedHomeRoutine(group) }}
                      className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/15 px-3 text-xs font-black text-emerald-300 transition-colors hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                    >
                      <CheckCircle2 size={14} aria-hidden="true" /> {t('routine_confirmation_confirm_all', { defaultValue: 'Alle als eingenommen markieren' })}
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

      <section>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 8 }}>
          {t('pk_live_title')}
        </p>
        <BlutspiegelView variant="compact" />
        <p className="disclaimer" style={{ marginTop: 8 }}>{t('pk_sim_disclaimer')}</p>
      </section>

      <ExpiryWarningBanners alerts={expiryAlerts} />

      <section>
        <div style={sectionHeaderStyle}>
          <div>
            <p style={labelStyle}>{t('home_quick_actions', { defaultValue: 'Quick Actions' })}</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text)', marginTop: 2 }}>
              {t('home_quick_title', { defaultValue: 'Direkt loslegen' })}
            </h2>
          </div>
          <Sparkles size={18} color="var(--accent)" />
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

      <section>
        <div style={sectionHeaderStyle}>
          <div>
            <p style={labelStyle}>{t('home_overview', { defaultValue: 'Übersicht' })}</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text)', marginTop: 2 }}>
              {t('home_overview_title', { defaultValue: 'Heute im Blick' })}
            </h2>
          </div>
          <button
            onClick={() => navigate('/kalender')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontSize: '0.72rem', fontWeight: 750 }}
          >
            {t('today')} <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
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
            accent="#22d3ee"
            onClick={() => navigate('/my-stack')}
          />
          <InsightCard
            icon={Package}
            label={String(t('stat_vials'))}
            value={String(overview.inventoryVials)}
            hint={overview.lowStock > 0
              ? String(t('home_low_stock', { defaultValue: '{{count}} niedrig', count: overview.lowStock }))
              : String(t('home_stock_ok', { defaultValue: 'Vorrat erfasst' }))}
            accent={overview.lowStock > 0 ? '#f59e0b' : '#10b981'}
            onClick={() => navigate('/my-stack?tab=inventar')}
          />
        </div>
      </section>

      <section style={{ ...panelStyle, padding: 14 }}>
        <div style={{ position: 'absolute', top: -34, right: -28, width: 120, height: 120, borderRadius: '50%', background: 'var(--accent-weak)', filter: 'blur(20px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            {(() => { const StudyIcon = todayStudy.icon; return <StudyIcon size={22} color="var(--accent)" /> })()}
            <div>
              <p style={{ ...labelStyle, color: 'var(--accent)' }}>{t('stat_study')}</p>
              <p style={{ fontSize: '0.86rem', fontWeight: 850, color: 'var(--text)', lineHeight: 1.25 }}>
                {t('home_daily_research', { defaultValue: 'Daily Research' })}
              </p>
            </div>
          </div>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.45 }}>
            {todayStudy.title}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
              {todayStudy.source}
            </p>
            <button
              onClick={() => navigate('/lab')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontSize: '0.68rem', fontWeight: 800 }}
            >
              {t('lab_snapshot_discover', { defaultValue: 'Entdecken' })} <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </section>

      <section>
        <div style={sectionHeaderStyle}>
          <div>
            <p style={labelStyle}>{t('home_features', { defaultValue: 'Features' })}</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text)', marginTop: 2 }}>
              {t('home_features_title', { defaultValue: 'Mehr aus deinen Daten machen' })}
            </h2>
          </div>
          <ClipboardList size={18} color="var(--text-muted)" />
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
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

      <section>
        <div style={sectionHeaderStyle}>
          <div>
            <p style={labelStyle}>{t('sections')}</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text)', marginTop: 2 }}>
              {t('home_all_tools', { defaultValue: 'Alle Tools' })}
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3" data-ob="home-tiles">
          {TILE_DEFS.map((tile, index) => {
            const stretchLast = TILE_DEFS.length % 2 === 1 && index === TILE_DEFS.length - 1
            return (
              <TileButton
                key={tile.labelKey}
                icon={tile.icon}
                label={String(t(tile.labelKey, { defaultValue: tile.label ?? tile.labelKey }))}
                desc={String(t(tile.descKey, { defaultValue: tile.desc ?? tile.descKey }))}
                color={tile.color}
                bg={tile.bg}
                wide={stretchLast}
                onClick={() => navigate(tile.path)}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

function HeroStat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  hint: string
  accent: string
}) {
  return (
    <div style={{
      background: 'var(--surface-input)',
      border: '1px solid var(--border)',
      borderRadius: 18,
      padding: '11px 9px',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, color: 'var(--text-muted)' }}>
        <Icon size={13} color={accent} />
        <p style={{ fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </p>
      </div>
      <p style={{ fontSize: typeof value === 'string' && value.length > 4 ? '1.03rem' : '1.34rem', fontWeight: 900, letterSpacing: '-0.04em', color: accent, lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {hint}
      </p>
    </div>
  )
}

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
      className={wide ? 'col-span-2 motion-press' : 'motion-press'}
      style={{
        minHeight: 104,
        padding: '12px 9px',
        borderRadius: 20,
        border: `1px solid ${accent}33`,
        background: `linear-gradient(155deg, ${accent}20, var(--surface))`,
        display: 'flex',
        flexDirection: wide ? 'row' : 'column',
        alignItems: wide ? 'center' : 'flex-start',
        gap: wide ? 12 : 9,
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        width: 34,
        height: 34,
        borderRadius: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${accent}1f`,
        color: accent,
        boxShadow: `0 0 20px ${accent}22`,
      }}>
        <Icon size={16} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 850, color: 'var(--text)', lineHeight: 1.15 }}>
          {label}
        </p>
        <p style={{ fontSize: '0.59rem', color: 'var(--text-dim)', lineHeight: 1.3, marginTop: 3 }}>
          {desc}
        </p>
      </div>
      <div style={{ position: 'absolute', right: -18, bottom: -18, width: 62, height: 62, borderRadius: '50%', background: accent, opacity: 0.08, filter: 'blur(12px)' }} />
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
      style={{
        ...panelStyle,
        padding: 14,
        textAlign: 'left',
        minHeight: 112,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, position: 'relative' }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accent,
          background: `${accent}17`,
          border: `1px solid ${accent}24`,
        }}>
          <Icon size={17} />
        </div>
        <ChevronRight size={15} color="var(--text-muted)" />
      </div>
      <p style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1, marginTop: 14 }}>
        {value}
      </p>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 750, marginTop: 5 }}>
        {label}
      </p>
      <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 2 }}>
        {hint}
      </p>
      <div style={{ position: 'absolute', right: -24, bottom: -28, width: 86, height: 86, borderRadius: '50%', background: accent, opacity: 0.06, filter: 'blur(16px)' }} />
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
const INTAKE_ROW_H = 46

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
  return (
    <>
      <button
        type="button"
        aria-label="Bestätigung schließen"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/70"
      />
      <div data-app-modal role="dialog" aria-modal="true" className="fixed inset-x-3 bottom-3 z-[60] rounded-3xl border border-white/10 bg-[var(--surface)] p-4 shadow-[0_-16px_48px_rgba(0,0,0,0.55)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-cyan-300">Anstehende Einnahme</p>
            <h2 className="mt-1 text-lg font-black text-white">Wie möchtest du bestätigen?</h2>
            <p className="mt-1 truncate text-sm font-semibold text-slate-300">
              {[intake.substance, intake.dose].filter(Boolean).join(' · ')} · {intake.time}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-app-back-close
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400"
          >
            <XCircle size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onTaken} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/15 px-3 text-sm font-black text-emerald-300">
              <CheckCircle2 size={16} aria-hidden="true" /> Eingenommen
            </button>
            <button type="button" onClick={onSkipped} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/15 px-3 text-sm font-black text-red-300">
              <XCircle size={16} aria-hidden="true" /> Übersprungen
            </button>
          </div>
          {onInjection && (
            <button type="button" onClick={onInjection} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/15 px-3 text-sm font-black text-sky-300">
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
  return (
    <>
      <button
        type="button"
        aria-label="Zeitformular schließen"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/70"
      />
      <div data-app-modal data-app-back-dirty-on-interaction role="dialog" aria-modal="true" className="fixed inset-x-3 bottom-3 z-[60] rounded-3xl border border-white/10 bg-[var(--surface)] p-4 shadow-[0_-16px_48px_rgba(0,0,0,0.55)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-emerald-300">Einnahme bestätigen</p>
            <h2 className="mt-1 text-lg font-black text-white">Wann hast du tatsächlich eingenommen?</h2>
            <p className="mt-1 truncate text-sm font-semibold text-slate-300">
              {[intake.substance, intake.dose].filter(Boolean).join(' · ')} · geplant {intake.time}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400"
          >
            <XCircle size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-slate-500" htmlFor="home-intake-confirm-time">
            Uhrzeit
          </label>
          <button
            type="button"
            onClick={onNow}
            className="flex items-center gap-1.5 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-1.5 text-xs font-black text-sky-300"
          >
            <Clock3 size={13} aria-hidden="true" /> Jetzt
          </button>
        </div>
        <input
          id="home-intake-confirm-time"
          type="time"
          value={timeValue}
          onChange={event => onTimeChange(event.target.value)}
          className="mb-4 w-full rounded-2xl border border-white/10 px-4 py-3 text-base font-black text-white outline-none focus:border-sky-500/50"
          style={{ background: 'var(--surface-input)', colorScheme: 'dark' }}
        />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onBack} data-app-back-close className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-slate-300">
            Zurück
          </button>
          <button type="button" onClick={onSave} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/15 px-3 text-sm font-black text-emerald-300">
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
  const c       = due ? '#f59e0b' : 'var(--accent)'
  const cWeak   = due ? 'rgba(245,158,11,0.12)' : 'var(--accent-weak)'
  const cBorder = due ? 'rgba(245,158,11,0.34)' : 'var(--accent-border)'

  return (
    <button
      type="button"
      onClick={onClick}
      className="motion-press"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: INTAKE_ROW_H, textAlign: 'left', cursor: 'pointer',
        padding: '0 12px', borderRadius: 14,
        background: cWeak, border: `1px solid ${cBorder}`,
      }}
    >
      {due
        ? <Bell size={16} className="pulse-soft" color={c} style={{ flexShrink: 0 }} />
        : <Clock3 size={16} color={c} style={{ flexShrink: 0 }} />}
      <MarqueeText style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
        {[substance, dose].filter(Boolean).join(' · ') || t('stat_next_intake', { defaultValue: 'Nächste Einnahme' })}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{` · ${t('home_at_time', { defaultValue: 'um' })} ${time}`}</span>
      </MarqueeText>
      {due ? (
        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 850, color: c }}>
          <span className="pulse-soft" style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block' }} />
          {t('home_due_label', { defaultValue: 'Jetzt fällig' })}
        </span>
      ) : (
        <span style={{ flexShrink: 0, fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '0.02em' }}>
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
        display: 'flex', flexDirection: 'column', gap: 6,
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
      style={{
        ...panelStyle,
        minWidth: 226,
        padding: 14,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16, position: 'relative' }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${accent}18`,
          color: accent,
          border: `1px solid ${accent}24`,
        }}>
          <Icon size={18} />
        </div>
        <span style={{
          padding: '3px 8px',
          borderRadius: 999,
          background: `${accent}14`,
          border: `1px solid ${accent}24`,
          color: accent,
          fontSize: '0.58rem',
          fontWeight: 850,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {metric}
        </span>
      </div>
      <p style={{ fontSize: '0.9rem', fontWeight: 850, color: 'var(--text)', marginBottom: 5, position: 'relative' }}>
        {label}
      </p>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.45, position: 'relative' }}>
        {desc}
      </p>
      <div style={{ marginTop: 13, display: 'inline-flex', alignItems: 'center', gap: 5, color: accent, fontSize: '0.66rem', fontWeight: 850, position: 'relative' }}>
        {cta} <ArrowUpRight size={12} />
      </div>
    </button>
  )
}

function TileButton({
  icon: Icon,
  label,
  desc,
  color,
  bg,
  wide,
  onClick,
}: {
  icon: LucideIcon
  label: string
  desc: string
  color: string
  bg: string
  wide?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={wide ? 'col-span-2 motion-press' : 'motion-press'}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        padding: wide ? '14px 16px' : '15px 13px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        alignItems: wide ? 'center' : 'flex-start',
        flexDirection: wide ? 'row' : 'column',
        gap: wide ? 13 : 0,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div style={{
        width: 42,
        height: 42,
        borderRadius: 15,
        background: bg,
        border: `1px solid ${color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: wide ? 0 : 12,
        flexShrink: 0,
        color,
      }}>
        <Icon size={18} />
      </div>

      <div style={{ flex: wide ? 1 : undefined, minWidth: 0, position: 'relative' }}>
        <p style={{ fontSize: '0.86rem', fontWeight: 820, color: 'var(--text)', marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</p>
      </div>

      {wide && <ChevronRight size={16} color="var(--accent)" style={{ flexShrink: 0 }} />}

      <div style={{
        position: 'absolute',
        bottom: -24,
        right: -24,
        width: 88,
        height: 88,
        borderRadius: '50%',
        background: color,
        opacity: 0.055,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />
    </button>
  )
}
