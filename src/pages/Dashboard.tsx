import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { FEATURES } from '../config/features'
import { useAuth } from '../context/AuthContext'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, startOfWeek, endOfWeek, isSameMonth, addDays,
  parseISO, startOfDay,
} from 'date-fns'
import {
  AlertTriangle, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock,
  Layers, Moon, Pencil, Pin, Plus, RotateCcw, Sun, Sunrise, Syringe, X, XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { getStackItemColor } from '../features/my-stack/lib/colors'
import { getDateLocale } from '../i18n/dateLocales'
import {
  collectOpenTimelineIntakes,
  cycleAppliesToDay,
  effectiveSlotQuantity,
  resolveScheduleSlots,
  resolveTimelineIntakesForDay,
  scheduleForDay,
  AUTO_MISSED_NOTE,
  type IntakeLog,
  type ResolvedRoutineGroup,
  type ScheduleSegment,
} from '../lib/intakeSchedule'
import { loadCycleTimelines } from '../features/my-stack/services/planLifecycle'
import { localDateTimeKey, resolveCycleAt, resolveCycleAtLocalSlot, type CycleTimeline } from '../lib/planTimeline'
import { isOnDemand } from '../features/my-stack/lib/intakeFrequency'
import { debitPeptideStockForDoseById } from '../features/my-stack/extensions/peptide/vialStock'
import { formatTrackedQuantity, hasTrackedQuantity } from '../features/routines/quantityPresentation'
import { dosePlanCapabilities } from '../features/my-stack/lib/dosePlan'
import {
  buildConfirmationEntry,
  groupRoutineIntakes,
  routineGroupFromMinutes,
  type RoutineConfirmationEntry,
  type RoutineGroupModel,
  type RoutineIntake,
} from '../features/routines/intakeGroups'
import { confirmIntakeGroup, quantifiedVialEntries, skipIntakeGroup, type IntakeConfirmationClient, type SavedDoseLog } from '../features/routines/services/intakeConfirmation'
import { slotKeyBereiche } from '../features/routines/lib/slotKeyRange'
import { slotSchluesselFuerZeitpunkt } from '../features/routines/lib/slotKey'
import { RoutineConfirmationSheet } from '../features/routines/components/RoutineConfirmationSheet'
import {
  bundleDueIntakes,
  deleteIntakeBundle,
  liveBundleItemIds,
  loadIntakeBundles,
  saveIntakeBundle,
  type IntakeBundle,
  type IntakeBundleClient,
} from '../features/routines/bundles/intakeBundles'
import { IntakeBundleSheet } from '../features/routines/bundles/IntakeBundleSheet'
import {
  applyInventoryConfirmation,
  InventoryConfirmationError,
  reverseInventoryConfirmation,
} from '../features/my-stack/services/stackInventory'
import { buildInjectionTrackerUrl, isInjectableMethod } from '../lib/injectionDeepLink'
import { GlassPanel, PageShell } from '../components/ui/DesignSystem'
import { denyProps } from '../lib/denyFeedback'

interface DoseLog {
  id: string
  stack_item_id: string
  dose: number | null
  unit: string | null
  method: string
  logged_at: string
  notes: string | null
  taken: boolean | null
  stack_items: { display_name: string }
  cycle_id?: string | null
  plan_version_id?: string | null
  routine_slot_key?: string | null
}

interface Cycle {
  id: string
  name: string
  stack_item_id: string
  dose: number | null
  unit: string | null
  method: string
  frequency: string
  x_days_interval: number | null
  interval_unit: string | null
  cycle_on_days: number | null
  cycle_off_days: number | null
  slot_doses: string | null
  slot_days: string | null
  schedule_days: string[] | null
  start_date: string
  end_date: string | null
  active: boolean
  intake_time: string | null
  intake_time_custom: string | null
  schedule_history: ScheduleSegment[] | null
  stack_items: { display_name: string; tracking_level: 'intake_only' | 'with_amount' | 'complete' }
  planVersionId?: string | null
}

interface StackItem {
  id: string; display_name: string; default_method: string
  dosage_form: string | null
  tracking_level: 'intake_only' | 'with_amount' | 'complete'
  vial_amount_mg: number | null; reconstitution_ml: number | null
  vials_in_stock: number | null; vials_initial: number | null
  reconstitution_date: string | null; expiry_days: number | null
}

interface Escalation {
  id: string
  cycle_id: string
  increase_amount: number
  unit: string
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string | null
  start_after_days: number | null
}

interface DashboardRoutineIntakeInput {
  key: string
  cycleId: string
  planVersionId?: string | null
  pendingLogId: string | null
  stackItemId: string
  stackItemName: string
  trackingLevel: Cycle['stack_items']['tracking_level']
  routineGroup: ResolvedRoutineGroup
  minutes: number
  scheduledAt: string
  dose: number | null
  unit: string | null
  method: string
}

export function buildDashboardRoutineIntake(input: DashboardRoutineIntakeInput): RoutineIntake {
  const intakeOnly = input.trackingLevel === 'intake_only'
  return {
    key: input.key,
    cycleId: input.cycleId,
    planVersionId: input.planVersionId ?? null,
    pendingLogId: input.pendingLogId,
    stackItemId: input.stackItemId,
    stackItemName: input.stackItemName,
    trackingLevel: input.trackingLevel,
    group: input.routineGroup,
    scheduledAt: input.scheduledAt,
    dose: intakeOnly ? null : input.dose,
    unit: intakeOnly ? null : input.unit,
    method: input.method,
    injectable: isInjectableMethod(input.method),
  }
}

interface DashboardQuantity {
  dose: number | null
  unit: string | null
}

function resolveDashboardCycleQuantity(
  cycle: Cycle,
  day: Date,
  escalations: Escalation[],
  slotDose: number | null = null,
): DashboardQuantity {
  if (cycle.stack_items?.tracking_level === 'intake_only') return { dose: null, unit: null }
  // `slotDose` ist die eigene Menge EINES Zeitpunkts — ohne sie gaelte bei
  // „morgens 1000, abends 500" an beiden Karten dieselbe Zahl.
  return effectiveSlotQuantity(cycle, day, escalations, slotDose) ?? { dose: null, unit: null }
}

function cycleIntakeMinutes(c: Cycle, day: Date): number {
  return resolveScheduleSlots(scheduleForDay(c, day), day)[0]?.minutes ?? 25 * 60
}

interface DaySlot {
  key: string
  minutes: number
  time: string
  groupKey: IntakeGroupKey
  routineGroup: ResolvedRoutineGroup
  /** Eigene Menge dieses Zeitpunkts; null heisst: die des Zyklus gilt. */
  dose: number | null
}

// Expand a cycle's intake times into individual day-slots for a given day (segment-resolved).
function cycleSlots(c: Cycle, day: Date): DaySlot[] {
  const seg = scheduleForDay(c, day)
  // MIT dem Tag: ein Zeitpunkt kann nur an bestimmten Wochentagen liegen.
  const out: DaySlot[] = resolveScheduleSlots(seg, day).map(slot => ({
    key: slot.key === 'custom' ? slot.time : slot.key,
    minutes: slot.minutes,
    time: slot.time,
    groupKey: slot.routineGroup === 'morning'
      ? 'morgens' as const
      : slot.routineGroup === 'midday'
        ? 'mittags' as const
        : 'abends' as const,
    routineGroup: slot.routineGroup,
    dose: slot.dose,
  }))
  if (out.length === 0) out.push({ key: 'later', minutes: 25 * 60, time: '', groupKey: 'later', routineGroup: 'morning', dose: null })
  return out
}

// Timestamp on a given day at the slot's planned minute (defaults to noon for "later").
function slotTimestamp(day: Date, minutes: number): string {
  const d = new Date(day)
  const safe = minutes >= 24 * 60 ? 12 * 60 : minutes
  d.setHours(Math.floor(safe / 60), safe % 60, 0, 0)
  return d.toISOString()
}

function dashboardCycleFromTimeline(
  timeline: CycleTimeline,
  version: CycleTimeline['versions'][number],
  stackItem: StackItem | undefined,
  timeZone: string,
): Cycle {
  return {
    id: timeline.cycle.id,
    name: stackItem?.display_name ?? '',
    stack_item_id: timeline.cycle.stack_item_id,
    dose: version.dose,
    unit: version.unit,
    method: version.method,
    frequency: version.frequency,
    x_days_interval: version.x_days_interval,
    interval_unit: version.interval_unit,
    cycle_on_days: version.cycle_on_days,
    cycle_off_days: version.cycle_off_days,
    slot_doses: version.slot_doses,
    slot_days: version.slot_days,
    schedule_days: version.schedule_days,
    start_date: localDateTimeKey(new Date(timeline.cycle.started_at), timeZone).slice(0, 10),
    end_date: timeline.cycle.ended_at
      ? localDateTimeKey(new Date(timeline.cycle.ended_at), timeZone).slice(0, 10)
      : null,
    active: timeline.cycle.ended_at === null,
    intake_time: version.intake_time,
    intake_time_custom: version.intake_time_custom,
    schedule_history: null,
    stack_items: {
      display_name: stackItem?.display_name ?? '',
      tracking_level: stackItem?.tracking_level ?? 'intake_only',
    },
    planVersionId: version.id,
  }
}

type IntakeGroupKey = 'morgens' | 'mittags' | 'abends' | 'custom' | 'later'

type PeriodKey = 'morgens' | 'mittags' | 'abends'

const PERIOD_ORDER: PeriodKey[] = ['morgens', 'mittags', 'abends']
const PERIOD_TO_ROUTINE_GROUP = {
  morgens: 'morning',
  mittags: 'midday',
  abends: 'evening',
} as const

function intakeGroupMeta(key: IntakeGroupKey, t: (key: string) => string): { icon: LucideIcon; label: string } {
  if (key === 'morgens') return { icon: Sunrise, label: t('morgens') }
  if (key === 'mittags') return { icon: Sun, label: t('mittags') }
  if (key === 'abends') return { icon: Moon, label: t('abends') }
  if (key === 'custom') return { icon: Clock, label: t('uhrzeit_label') }
  return { icon: Pin, label: t('ausstehend') }
}

function timeLabel(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const date = new Date(dateStr)
  const h    = date.getHours()
  const time = format(date, 'HH:mm')
  if (h >= 5  && h < 12) return t('morgens_uhr', { time })
  if (h >= 12 && h < 18) return t('mittags_uhr', { time })
  if (h >= 18)            return t('abends_uhr', { time })
  return `${time} Uhr`
}

function cycleLogTimestamp(cycle: Cycle, day: Date): string {
  const date = new Date(day)
  const minutes = cycleIntakeMinutes(cycle, day)
  const safeMinutes = minutes >= 24 * 60 ? 12 * 60 : minutes
  date.setHours(Math.floor(safeMinutes / 60), safeMinutes % 60, 0, 0)
  return date.toISOString()
}

// Minimum horizontal swipe distance to trigger month change
const SWIPE_THRESHOLD = 80

interface DashboardProps {
  dashboardDataClient?: typeof supabase
}

export function Dashboard({ dashboardDataClient = supabase }: DashboardProps = {}) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const locale = getDateLocale()
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [logs, setLogs] = useState<DoseLog[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [timelines, setTimelines] = useState<CycleTimeline[]>([])
  const [timelineLoadState, setTimelineLoadState] = useState<'loading' | 'ready' | 'error'>(
    FEATURES.planTimelineV2 ? 'loading' : 'ready',
  )
  const [timelinePeriod, setTimelinePeriod] = useState('')
  const [timezoneReviewStackItemIds, setTimezoneReviewStackItemIds] = useState<string[]>([])
  const timelineRequest = useRef(0)
  const routineCommitted = useRef(false)
  const [stackItems, setStackItems] = useState<StackItem[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])

  const [selectedDay, setSelectedDay] = useState<Date>(new Date())
  const timelineSelection = FEATURES.planTimelineV2 ? format(selectedDay, 'yyyy-MM-dd') : ''

  // Der Ausschnitt, den die Abfrage wirklich liest -- als Text, nicht als
  // `Date`.
  //
  // `currentDate` und `selectedDay` sind Objekte, und jedes `setCurrentDate`
  // legt ein neues an, auch wenn es denselben Tag meint. Das allein reichte,
  // um `loadLogSnapshot` neu zu erzeugen, und damit lief der ganze Ladevorgang
  // noch einmal: Zyklen, Substanzen, Dosen, Slots. Zu sehen war das beim
  // Ausklappen des Kalenders -- der Monat war laengst geladen, trotzdem
  // standen die Tage wieder leer, bis die Runde zurueckkam.
  //
  // Diese drei Zeichenketten aendern sich nur, wenn sich der gelesene Bereich
  // aendert. Derselbe Monat, ein anderer Tag darin: alles bleibt gleich.
  const fensterStart = format(startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const fensterEnde = format(addDays(endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }), 1), 'yyyy-MM-dd')
  // Der ausgewaehlte Tag kostet nur dann eine eigene Abfrage, wenn er
  // ausserhalb des Rasters liegt. ISO-Daten vergleichen sich als Text
  // chronologisch, gleiche Breite vorausgesetzt -- die haben sie.
  const tagAusserhalbDesRasters = timelineSelection
    && (timelineSelection < fensterStart || timelineSelection >= fensterEnde)
    ? timelineSelection
    : ''
  const monatsSchluessel = format(currentDate, 'yyyy-MM')
  const timelineContext = `${fensterStart}|${fensterEnde}|${tagAusserhalbDesRasters}`
  const latestLogLoader = useRef<(() => Promise<void>) | null>(null)
  // Welches Fenster gerade sichtbar ist -- fuer den Wettlauf zwischen einer
  // laufenden Bestaetigung und einer Monatsnavigation. `confirmCycleDose`
  // faengt `timelineContext` beim Start in seiner Closure; laeuft die RPC
  // lange und wechselt der Nutzer inzwischen den Monat, waere ein direktes
  // Einfuegen der zurueckgegebenen Zeile in `logs` ein fremdes Fenster in der
  // Liste -- ein Juli-Log mitten im November. Der Ref haelt fest, was JETZT
  // sichtbar ist, damit die Bestaetigung das beim Zurueckkommen erkennt und
  // stattdessen neu laedt.
  const sichtbaresFenster = useRef(timelineContext)
  useLayoutEffect(() => { sichtbaresFenster.current = timelineContext })

  // Einnahme-Bestätigungs-Sheet
  interface ConfirmSheet { cycle?: Cycle; log?: DoseLog; slotDose?: number | null; scheduledAt?: string; slotKey?: string }
  const [confirmSheet, setConfirmSheet] = useState<ConfirmSheet | null>(null)
  const [routineGroupSheet, setRoutineGroupSheet] = useState<RoutineGroupModel | null>(null)
  const [bundles, setBundles] = useState<IntakeBundle[]>([])
  // undefined = zu, null = neues Bündel, sonst das Bündel in Bearbeitung.
  const [bundleSheet, setBundleSheet] = useState<IntakeBundle | null | undefined>(undefined)
  const [bundleBusyId, setBundleBusyId] = useState<string | null>(null)
  // Sperre gegen Doppeltipp: der State kommt erst mit dem naechsten Render an.
  const bundleBusyRef = useRef(false)
  const [confirmTime, setConfirmTime]   = useState('')
  // Menge im selben Sheet wie die Uhrzeit -- vorher brauchte es dafuer den
  // Umweg ueber „Einmalige Dosisaenderung", ein zweites, groesseres Sheet.
  // `confirmUnit` ist zugleich das Signal, ob die Substanz ueberhaupt eine
  // Menge fuehrt (`null` heisst: Intake-Only, kein Feld noetig).
  const [confirmDoseText, setConfirmDoseText] = useState('')
  const [confirmUnit, setConfirmUnit] = useState<string | null>(null)
  const confirmDoseWert = confirmDoseText.trim() === '' ? null : Number(confirmDoseText)
  // Dieselbe Regel wie im Gruppen-Sheet: eine Menge ist entweder unveraendert
  // (kein Feld -- `confirmUnit` null) oder eine positive Zahl. Alles
  // dazwischen (leer, null, 0, negativ) blockiert den Bestaetigen-Knopf,
  // statt eine ungueltige Menge an die RPC zu schicken.
  const confirmDoseUngueltig = confirmUnit != null
    && (confirmDoseWert == null || !Number.isFinite(confirmDoseWert) || confirmDoseWert <= 0)
  const [completedExpanded, setCompletedExpanded] = useState(false)
  const [unloggedExpanded, setUnloggedExpanded] = useState(false)
  /** Welche Einnahme aufgeklappt ist.
   *
   *  `voreingestellt` heisst: die erste offene. So steht beim Oeffnen der
   *  Seite ohne Zutun da, was als Naechstes ansteht. `slot` ist eine
   *  angetippte; `keiner` heisst, der Nutzer hat die aufgeklappte wieder
   *  zugetippt. */
  type Aufgeklappt =
    | { art: 'voreingestellt' }
    | { art: 'slot'; key: string; gruppe: string }
    | { art: 'keiner' }
  const [aufgeklappt, setAufgeklappt] = useState<Aufgeklappt>({ art: 'voreingestellt' })
  const [inventoryRetryIds, setInventoryRetryIds] = useState<string[]>([])
  const [monatOffen, setMonatOffen] = useState(false)
  const monatsKnopf = useRef<HTMLButtonElement>(null)
  const monatsBlatt = useRef<HTMLDivElement>(null)

  // Horizontal swipe state
  const calendarSwipeStart = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  // Ein Wisch endet auf einer Tageszelle und loest dort ein `click` aus. Ohne
  // diesen Merker waehlte das Blaettern den Tag unter dem Finger aus.
  //
  // Er wird verzoegert geloescht, nicht sofort: der `click` kommt NACH
  // `pointerup`, muesste also noch geschluckt werden. Bliebe der Merker aber
  // bis zur naechsten Zeigergeste stehen, verschluckte er danach jedes Enter
  // und jeden VoiceOver-Doppeltipp — also genau den Weg, den die Zelle neu
  // bekommen hat.
  const wurdeGewischt = useRef(false)
  const wischMerkerTimer = useRef<number | null>(null)
  const merkeWisch = () => {
    wurdeGewischt.current = true
    if (wischMerkerTimer.current !== null) window.clearTimeout(wischMerkerTimer.current)
  }
  const wischMerkerLoesen = () => {
    if (wischMerkerTimer.current !== null) window.clearTimeout(wischMerkerTimer.current)
    wischMerkerTimer.current = window.setTimeout(() => {
      wurdeGewischt.current = false
      wischMerkerTimer.current = null
    }, 0)
  }
  useEffect(() => () => {
    if (wischMerkerTimer.current !== null) window.clearTimeout(wischMerkerTimer.current)
  }, [])
  const [calendarDragX, setCalendarDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [peekDir, setPeekDir] = useState<-1 | 0 | 1>(0)

  const changeMonth = useCallback((delta: number) => {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }, [])

  const changeWeek = useCallback((delta: number) => {
    setSelectedDay(prev => {
      const next = new Date(prev)
      next.setDate(next.getDate() + delta * 7)
      setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1))
      return next
    })
  }, [])

  const selectCalendarDay = useCallback((day: Date) => {
    setSelectedDay(day)
    if (day.getMonth() !== currentDate.getMonth() || day.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(day.getFullYear(), day.getMonth(), 1))
    }
    // Einen Tag zu waehlen heisst, ihn sehen zu wollen. Das Blatt liegt aber
    // ueber dem Tagesbereich, also macht es Platz.
    setMonatOffen(false)
  }, [currentDate])

  // Im Blatt darf man Monate durchblaettern, ohne einen Tag zu waehlen.
  // `currentDate` steht danach auf einem Monat, den niemand mehr ansieht — und
  // der Ladebereich haengt daran. Der Streifen zeigte dann „0 von N
  // bestaetigt" fuer Tage, an denen alles bestaetigt war: eine falsche Auskunft
  // ueber Gesundheitsdaten, auf der Hauptflaeche.
  //
  // Als eigener Effekt, damit es fuer alle vier Wege nach draussen gilt:
  // Kreuz, Hintergrund, Escape und die Tagesauswahl.
  useEffect(() => {
    if (monatOffen) return
    setCurrentDate(current => (
      current.getMonth() === selectedDay.getMonth()
        && current.getFullYear() === selectedDay.getFullYear()
        ? current
        : new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1)
    ))
  }, [monatOffen, selectedDay])

  // Befund: `aria-modal` allein macht keinen Dialog. Escape muss am Dokument
  // haengen (das Blatt selbst bekommt keinen Fokus), und der Fokus muss hinein
  // und danach zurueck auf den Knopf.
  useEffect(() => {
    if (!monatOffen) return
    const vorher = document.activeElement as HTMLElement | null
    // Den Knopf JETZT festhalten, nicht erst beim Aufraeumen nachschlagen.
    const knopf = monatsKnopf.current
    monatsBlatt.current?.focus()
    const beiTaste = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setMonatOffen(false)
      }
    }
    document.addEventListener('keydown', beiTaste)
    return () => {
      document.removeEventListener('keydown', beiTaste)
      ;(knopf ?? vorher)?.focus()
    }
  }, [monatOffen])

  const handleCalendarPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    calendarSwipeStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    wurdeGewischt.current = false
    setIsDragging(true)
  }

  const handleCalendarPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = calendarSwipeStart.current
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    // Only track if horizontal movement is meaningful and dominant
    if (Math.abs(deltaX) < 6) return
    if (Math.abs(deltaY) > Math.abs(deltaX) * 0.8) return
    merkeWisch()
    setCalendarDragX(deltaX)
    const dir = (deltaX < 0 ? 1 : -1) as -1 | 1
    if (peekDir !== dir) setPeekDir(dir)
  }

  const handleCalendarPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = calendarSwipeStart.current
    calendarSwipeStart.current = null
    setIsDragging(false)
    setCalendarDragX(0)
    setPeekDir(0)
    wischMerkerLoesen()
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y

    // Die Tagesauswahl haengt am `onClick` der Zelle, nicht mehr hier. Ein
    // `<button>` ohne `onClick` ist fuer Tastatur und Screenreader kein Knopf:
    // Enter und der VoiceOver-Doppeltipp senden `click`, nie `pointerup`.

    // Swipe: require horizontal dominance + minimum distance
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (monatOffen) changeMonth(deltaX < 0 ? 1 : -1)
      else changeWeek(deltaX < 0 ? 1 : -1)
    }
  }

  const handleCalendarPointerCancel = () => {
    calendarSwipeStart.current = null
    wischMerkerLoesen()
    setIsDragging(false)
    setCalendarDragX(0)
    setPeekDir(0)
  }

  const loadLogSnapshot = useCallback(async function loadSnapshot(): Promise<void> {
    if (!user) return
    if (FEATURES.planTimelineV2) {
      if (latestLogLoader.current !== loadSnapshot) return
      const request = ++timelineRequest.current
      const isCurrent = () => request === timelineRequest.current && latestLogLoader.current === loadSnapshot
      setTimelineLoadState('loading')
      setConfirmSheet(null)
      if (!routineCommitted.current) setRoutineGroupSheet(null)
      try {
        const [loadedTimelines, itemsResult, timezoneReviewResult] = await Promise.all([
          loadCycleTimelines(dashboardDataClient as never, user.id),
          dashboardDataClient.from('stack_items').select('*').eq('user_id', user.id).eq('archived', false).order('display_name'),
          dashboardDataClient.from('cycles').select('stack_item_id, timezone_review_required')
            .eq('user_id', user.id).eq('timezone_review_required', true),
        ])
        if (!isCurrent()) return
        if (itemsResult.error) throw itemsResult.error
        if (timezoneReviewResult.error) throw timezoneReviewResult.error
        const rangeStart = parseISO(fensterStart)
        const rangeEnd = parseISO(fensterEnde)
        const ranges = [{ start: rangeStart, end: rangeEnd }]
        if (tagAusserhalbDesRasters) {
          const selectionStart = parseISO(tagAusserhalbDesRasters)
          ranges.push({ start: selectionStart, end: addDays(selectionStart, 1) })
        }
        const columns = 'id, stack_item_id, dose, unit, method, logged_at, notes, taken, cycle_id, plan_version_id, routine_slot_key, stack_items(display_name)'
        const byId = new Map<string, DoseLog>()
        // Nebeneinander, nicht nacheinander: die Zeitbereiche wissen nichts
        // voneinander, gewartet wurde trotzdem der Reihe nach.
        const rangeResults = await Promise.all(ranges.map(range =>
          dashboardDataClient.from('dose_logs').select(columns)
            .eq('user_id', user.id).gte('logged_at', range.start.toISOString()).lt('logged_at', range.end.toISOString())
            .order('logged_at', { ascending: true }),
        ))
        if (!isCurrent()) return
        for (const result of rangeResults) {
          if (result.error) throw result.error
          for (const log of (result.data ?? []) as unknown as DoseLog[]) byId.set(log.id, log)
        }
        // Die Slots dieses Fensters werden ueber ihren SCHLUESSELBEREICH
        // gesucht, nicht mehr aufgezaehlt.
        //
        // Vorher entstanden hier bis zu hundert Schluessel je Abfrage, als
        // Liste in der Adresse -- siebentausend Zeichen, und mit jedem
        // angezeigten Tag eine andere. Der Browser fuehrt seinen
        // Preflight-Cache je Adresse, also war jede Anfrage eine neue
        // Verhandlung: 2751 verschiedene Adressen auf 3031 Anfragen, davon
        // 2383 mit eigenem Preflight davor. Jetzt haengt die Adresse nur noch
        // an den Zyklus-ids und am Fenster, und beide bleiben gleich, solange
        // man denselben Monat ansieht.
        //
        // Warum der Bereich dieselbe Menge trifft, steht in `slotKeyRange.ts`.
        // Die Grenzen sind lokale Tage, weil der Schluessel die Wanduhr traegt.
        //
        // Ein Tag Luft an beiden Enden: den brauchte frueher die Zeitzone, weil
        // ein lokaler Tag ueber die aus Instants gebaute Fenstergrenze
        // hinausragen konnte. Der Grund ist weg, die Luft bleibt -- Zeilen aus
        // der Zeit vor der Umstellung tragen einen Schluessel, der aus der
        // Zeitzone des Zyklus zurueckgerechnet wurde, und der kann bei jemandem,
        // der unterwegs bestaetigt hat, einen Tag daneben liegen.
        const slotFenster = ranges.map(range => ({
          start: format(addDays(range.start, -1), 'yyyy-MM-dd'),
          end: format(addDays(range.end, 1), 'yyyy-MM-dd'),
        }))
        const cycleIds = [...new Set(loadedTimelines.map(timeline => timeline.cycle.id))]
        const slotResults = await Promise.all(
          slotKeyBereiche(cycleIds, slotFenster).map(bereich =>
            dashboardDataClient.from('dose_logs').select(columns)
              .eq('user_id', user.id).or(bereich),
          ),
        )
        if (!isCurrent()) return
        for (const result of slotResults) {
          if (result.error) throw result.error
          for (const log of (result.data ?? []) as unknown as DoseLog[]) byId.set(log.id, log)
        }
        if (!isCurrent()) return
        setTimelines(loadedTimelines)
        setCycles([])
        setStackItems(itemsResult.data ?? [])
        const visibleStackItemIds = new Set((itemsResult.data ?? []).map(item => item.id))
        setTimezoneReviewStackItemIds([...new Set((timezoneReviewResult.data ?? [])
          .filter(row => row.timezone_review_required === true && visibleStackItemIds.has(row.stack_item_id))
          .map(row => row.stack_item_id))])
        setLogs([...byId.values()])
        setTimelinePeriod(timelineContext)
        setTimelineLoadState('ready')
      } catch {
        if (!isCurrent()) return
        setTimelines([])
        setLogs([])
        setTimezoneReviewStackItemIds([])
        setTimelineLoadState('error')
      }
      return
    }
    const today = new Date()
    const monthStart = parseISO(`${monatsSchluessel}-01`)
    const monthEnd = endOfMonth(monthStart)
    const rangeStart = monthStart < today ? monthStart : today
    const rangeEnd = monthEnd > today ? monthEnd : today
    const start = format(rangeStart, 'yyyy-MM-dd')
    const end = format(rangeEnd, 'yyyy-MM-dd')
    const { data } = await dashboardDataClient
      .from('dose_logs')
      .select(FEATURES.planTimelineV2
        ? 'id, stack_item_id, dose, unit, method, logged_at, notes, taken, cycle_id, plan_version_id, routine_slot_key, stack_items(display_name)'
        : '*, stack_items(display_name)')
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lte('logged_at', end + 'T23:59:59')
      .order('logged_at', { ascending: true })
    if (data) setLogs(data as unknown as DoseLog[])
  }, [dashboardDataClient, user, fensterStart, fensterEnde, tagAusserhalbDesRasters, monatsSchluessel, timelineContext])

  useLayoutEffect(() => {
    latestLogLoader.current = loadLogSnapshot
    return () => { latestLogLoader.current = null; timelineRequest.current += 1 }
  }, [loadLogSnapshot])

  // In-flight confirmations can outlive their render; always refresh the latest scope.
  const loadLogs = useCallback(async () => {
    await latestLogLoader.current?.()
  }, [])

  const loadCycles = useCallback(async () => {
    if (!user) return
    if (FEATURES.planTimelineV2) return
    const { data } = await dashboardDataClient
      .from('cycles')
      .select('*, stack_items(display_name, tracking_level)')
      .eq('user_id', user.id)
      .eq('active', true)
    if (data) {
      setCycles(data as Cycle[])
      setTimelines([])
    }
  }, [dashboardDataClient, user])

  const loadStackItems = useCallback(async () => {
    if (!user) return
    if (FEATURES.planTimelineV2) return
    const { data } = await dashboardDataClient.from('stack_items').select('*').eq('user_id', user.id).eq('archived', false).order('display_name')
    if (data) setStackItems(data)
  }, [dashboardDataClient, user])

  // Bündel sind Einstellungen, keine Tagesdaten: einmal je Nutzer laden.
  // Fehlt die Tabelle noch (Migration nicht eingespielt), bleibt die Liste
  // leer, und der Kalender funktioniert wie bisher.
  const bundleClient = dashboardDataClient as unknown as IntakeBundleClient
  useEffect(() => {
    if (!user) return
    let cancelled = false
    loadIntakeBundles(bundleClient, user.id)
      .then(rows => { if (!cancelled) setBundles(rows) })
      .catch(() => { if (!cancelled) setBundles([]) })
    return () => { cancelled = true }
  }, [bundleClient, user])

  const loadEscalations = useCallback(async () => {
    if (!user) return
    if (FEATURES.planTimelineV2) {
      setEscalations([])
      return
    }
    const { data } = await dashboardDataClient.from('dose_escalations').select('*').eq('user_id', user.id)
    if (data) setEscalations(data as Escalation[])
  }, [dashboardDataClient, user])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        void loadLogs()
        void loadCycles()
      }
    })
    return () => { cancelled = true; timelineRequest.current += 1 }
  }, [loadCycles, loadLogs, loadLogSnapshot])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        void loadStackItems()
        void loadEscalations()
      }
    })
    return () => { cancelled = true }
  }, [loadEscalations, loadStackItems])

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
  })

  const weekStart = startOfWeek(selectedDay, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedDay, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const streifenTage = weekDays

  const weekTitle = isSameMonth(weekStart, weekEnd)
    ? `${format(weekStart, 'd.', { locale })}–${format(weekEnd, 'd. MMMM yyyy', { locale })}`
    : `${format(weekStart, 'd. MMM', { locale })} – ${format(weekEnd, 'd. MMM yyyy', { locale })}`
  const monthTitle = format(currentDate, 'MMMM yyyy', { locale })
  // Zwei Titel statt einem: der Streifen nennt die Woche, das Blatt den Monat.

  // Peek month/week (adjacent period shown while swiping)
  const peekDate = peekDir !== 0
    ? monatOffen
      ? new Date(currentDate.getFullYear(), currentDate.getMonth() + peekDir, 1)
      : addDays(selectedDay, peekDir * 7)
    : null
  const peekCalendarDays = peekDate
    ? monatOffen
      ? eachDayOfInterval({
          start: startOfWeek(startOfMonth(peekDate), { weekStartsOn: 1 }),
          end: endOfWeek(endOfMonth(peekDate), { weekStartsOn: 1 }),
        })
      : eachDayOfInterval({
          start: startOfWeek(peekDate, { weekStartsOn: 1 }),
          end: endOfWeek(peekDate, { weekStartsOn: 1 }),
        })
    : []

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const timelineReady = timelineLoadState === 'ready' && timelinePeriod === timelineContext
  const stackItemById = new Map(stackItems.map(item => [item.id, item]))
  const timelineOccurrencesForDay = (day: Date) => {
    if (!timelineReady) return []
    const localDate = localDateTimeKey(day, timeZone).slice(0, 10)
    return timelines.flatMap(timeline => (
      resolveTimelineIntakesForDay(timeline, localDate, timeZone)
    ))
  }
  const logsForDay = (day: Date) => FEATURES.planTimelineV2 && !timelineReady
    ? [] : logs.filter(l => isSameDay(new Date(l.logged_at), day))

  // Der Stand eines Tages: wie viele Slots geplant sind, wie viele davon
  // genommen wurden, wie viele noch offen sind.
  //
  // JE SLOT, nicht je Substanz. Vorher fragte die Zelle „gibt es zu dieser
  // Substanz eine genommene Dosis?" — bei „morgens und abends" stand der Tag
  // damit schon nach der Morgendosis auf gruen.
  //
  // Gemerkt, nicht bei jedem Rendern neu: `matchTimelineLogs` sortiert je Tag
  // die ganze Logliste, und `setCalendarDragX` feuert bei jeder Zeigerbewegung.
  // Ohne das Merken sortierte ein Wisch die Logs zweiundvierzigmal pro Bild.
  interface TagesStand { geplant: number; genommen: number; offen: number }
  const wochenStartSchluessel = format(weekStart, 'yyyy-MM-dd')
  const tagesStand = useMemo(() => {
    const stand = new Map<string, TagesStand>()
    if (!FEATURES.planTimelineV2 || !timelineReady) return stand
    // Nur die wirklich gezeigten Tage. Die Vorschau beim Wischen bekommt
    // keinen Balken: ihre Logs liegen ausserhalb des geladenen Fensters, ein
    // Balken waere geraten.
    const tage = [
      // Der Streifen ist immer da.
      ...eachDayOfInterval({
        start: parseISO(wochenStartSchluessel),
        end: addDays(parseISO(wochenStartSchluessel), 6),
      }),
      // Das Monatsraster nur, solange das Blatt offen ist.
      ...(monatOffen
        ? eachDayOfInterval({ start: parseISO(fensterStart), end: addDays(parseISO(fensterEnde), -1) })
        : []),
    ]
    for (const day of tage) {
      const tag = localDateTimeKey(day, timeZone).slice(0, 10)
      if (stand.has(tag)) continue
      const geplant = timelines.flatMap(timeline => (
        resolveTimelineIntakesForDay(timeline, tag, timeZone)
      ))
      if (geplant.length === 0) {
        stand.set(tag, { geplant: 0, genommen: 0, offen: 0 })
        continue
      }
      const schluessel = new Set(geplant.map(intake => intake.routineSlotKey))
      const substanzen = new Set(geplant.map(intake => intake.stackItemId))
      // Zeilen von vor der Umstellung tragen keinen Slot-Schluessel.
      // `matchTimelineLogs` faengt sie ueber Substanz und lokalen Tag — hier
      // gilt dieselbe Regel, sonst zeigte ein damals vollstaendig bestaetigter
      // Tag einen leeren Balken.
      const genommen = Math.min(geplant.length, logs.filter(log => {
        if (log.taken !== true) return false
        if (log.routine_slot_key) return schluessel.has(log.routine_slot_key)
        return substanzen.has(log.stack_item_id)
          && localDateTimeKey(new Date(log.logged_at), timeZone).slice(0, 10) === tag
      }).length)
      const offen = collectOpenTimelineIntakes(timelines, logs as IntakeLog[], day, timeZone).length
      stand.set(tag, { geplant: geplant.length, genommen, offen })
    }
    return stand
  }, [monatOffen, fensterStart, fensterEnde, wochenStartSchluessel, timelines, logs, timeZone, timelineReady])

  const cyclesForDay = (day: Date) => {
    if (!FEATURES.planTimelineV2) return cycles.filter(c => cycleAppliesToDay(c, day))
    return timelineOccurrencesForDay(day).flatMap(intake => {
      const timeline = timelines.find(candidate => candidate.cycle.id === intake.cycleId)
      const version = timeline?.versions.find(candidate => candidate.id === intake.planVersionId)
      if (!timeline || !version) return []
      return [dashboardCycleFromTimeline(
        timeline, version, stackItemById.get(intake.stackItemId), timeZone,
      )]
    })
  }
  // „Bei Bedarf" ist kein Plan: `cycleAppliesToDay` gibt fuer diese Frequenz
  // NIE true zurueck, damit nichts faellig wird und nichts als verpasst gilt.
  // Genau deshalb taucht so ein Zyklus in keiner Tagesliste auf — und liesse
  // sich ohne diese Liste hier gar nicht eintragen. Ein Schmerzmittel hat
  // keinen Plan, nur eine Historie.
  const onDemandCyclesForDay = (day: Date) => {
    if (!FEATURES.planTimelineV2) {
      return cycles.filter(cycle => {
        if (!isOnDemand(cycle.frequency)) return false
        const tag = format(day, 'yyyy-MM-dd')
        if (tag < cycle.start_date) return false
        return !cycle.end_date || tag <= cycle.end_date
      })
    }
    if (!timelineReady) return []
    return timelines.flatMap(timeline => {
      // Offer manual access if any part of this day contains an active PRN
      // interval. Submission re-resolves the user's chosen exact timestamp.
      const dayStart = startOfDay(day)
      const dayEnd = addDays(dayStart, 1)
      const boundaries = [dayStart, new Date(timeline.cycle.started_at),
        ...timeline.versions.flatMap(version => version.effective_at ? [new Date(version.effective_at)] : []),
        ...timeline.pauses.flatMap(pause => pause.ends_at ? [new Date(pause.ends_at)] : [])]
      const resolved = boundaries.filter(at => at >= dayStart && at < dayEnd)
        .map(at => resolveCycleAt(timeline, at, timeZone))
        .find(at => at.status === 'active' && at.planVersion && isOnDemand(at.planVersion.frequency))
      if (!resolved?.planVersion) return []
      return [dashboardCycleFromTimeline(
        timeline,
        resolved.planVersion,
        stackItemById.get(timeline.cycle.stack_item_id),
        timeZone,
      )]
    })
  }

  const selLogs     = logsForDay(selectedDay)
  const selCycles   = cyclesForDay(selectedDay)
  const selOnDemand = onDemandCyclesForDay(selectedDay)
  const selectedLocalDate = localDateTimeKey(selectedDay, timeZone).slice(0, 10)
  const selectedPause = FEATURES.planTimelineV2 && timelineReady
    ? timelines.flatMap(timeline => {
        const start = resolveCycleAtLocalSlot(timeline, selectedLocalDate, 0, timeZone)
        const end = resolveCycleAtLocalSlot(timeline, selectedLocalDate, 24 * 60 - 1, timeZone)
        return start.status === 'paused' && end.status === 'paused' && start.pause?.id === end.pause?.id
          ? [start.pause]
          : []
      })[0] ?? null
    : null
  const selectedPauseRange = selectedPause
    ? `${localDateTimeKey(new Date(selectedPause.paused_at), timeZone).slice(0, 10)} – ${
        selectedPause.ends_at
          ? localDateTimeKey(new Date(selectedPause.ends_at), timeZone).slice(0, 10)
          : t('my_stack_plan_pause_until_optional', { defaultValue: 'offen' })
      }`
    : null
  const isTodaySelected = isToday(selectedDay)
  // Vergangener Tag (vor heute): nicht bestätigte Slots gelten als „verpasst".
  const isPastSelected = format(selectedDay, 'yyyy-MM-dd') < format(new Date(), 'yyyy-MM-dd')
  const selectedDayTitle = isTodaySelected
    ? t('heutige_einnahmen')
    : format(selectedDay, 'EEEE, d. MMMM', { locale })
  // Wieder oeffnen darf man nur, was danach auch wieder auftaucht.
  //
  // `taken = null` nimmt die Zeile aus „Bereits protokolliert" heraus. Steht
  // ihr Slot nicht im Tagesplan — bei Bedarf genommen, Substanz geloescht,
  // Zyklus nicht mehr aufloesbar —, erscheint sie danach auch nicht als
  // faellig: unsichtbar und nicht mehr loeschbar, denn der Loeschknopf sitzt
  // nur an protokollierten Zeilen.
  const geplanteSchluesselHeute = new Set(
    timelineOccurrencesForDay(selectedDay).map(intake => intake.routineSlotKey),
  )
  const kannWiederGeoeffnetWerden = (log: DoseLog) => (
    !FEATURES.planTimelineV2
    || Boolean(log.routine_slot_key && geplanteSchluesselHeute.has(log.routine_slot_key))
  )
  const decidedLogsSorted = selLogs.filter(log => log.taken !== null)
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
  const loggedLogs = decidedLogsSorted.filter(log => log.taken === true)
  const unloggedLogs = decidedLogsSorted.filter(log => log.taken === false)

  // Per-slot due list: expand each cycle into its individual intake slots, then drop the
  // slots already covered (in time order) by decided logs (taken !== null) for that stack item.
  // Reset logs (taken === null) keep a slot "due" and are reused on confirm to avoid duplicates.
  interface DueSlot { key: string; cycle: Cycle; planVersionId: string | null; scheduledAt: string; minutes: number; time: string; groupKey: IntakeGroupKey; routineGroup: ResolvedRoutineGroup; dose: number | null; pendingLog?: DoseLog }
  const dueSlots: DueSlot[] = []
  let totalDaySlots = 0
  if (FEATURES.planTimelineV2) {
    const planned = timelineOccurrencesForDay(selectedDay)
    const open = collectOpenTimelineIntakes(
      timelineReady ? timelines : [], logs as IntakeLog[], selectedDay, timeZone,
    )
    totalDaySlots = planned.length
    for (const intake of open) {
      const timeline = timelines.find(candidate => candidate.cycle.id === intake.cycleId)
      const version = timeline?.versions.find(candidate => candidate.id === intake.planVersionId)
      if (!timeline || !version) continue
      const cycle = dashboardCycleFromTimeline(
        timeline, version, stackItemById.get(intake.stackItemId), timeZone,
      )
      dueSlots.push({
        key: intake.routineSlotKey,
        cycle,
        planVersionId: intake.planVersionId,
        scheduledAt: intake.scheduledAt,
        minutes: intake.minutes,
        time: intake.time,
        groupKey: intake.routineGroup === 'morning'
          ? 'morgens'
          : intake.routineGroup === 'midday' ? 'mittags' : 'abends',
        routineGroup: intake.routineGroup,
        dose: intake.dose,
        pendingLog: intake.pendingLogId
          ? logs.find(log => log.id === intake.pendingLogId)
          : undefined,
      })
    }
  } else {
    const decidedByStackItem = new Map<string, number>()
    const pendingByStackItem = new Map<string, DoseLog[]>()
    for (const log of selLogs) {
      if (log.taken !== null) decidedByStackItem.set(log.stack_item_id, (decidedByStackItem.get(log.stack_item_id) ?? 0) + 1)
      else { const arr = pendingByStackItem.get(log.stack_item_id) ?? []; arr.push(log); pendingByStackItem.set(log.stack_item_id, arr) }
    }
    const slotsByStackItem = new Map<string, DueSlot[]>()
    for (const cycle of selCycles) {
      for (const slot of cycleSlots(cycle, selectedDay)) {
        const arr = slotsByStackItem.get(cycle.stack_item_id) ?? []
        arr.push({
          key: `${cycle.id}-${slot.minutes}`,
          cycle,
          planVersionId: null,
          scheduledAt: slotTimestamp(selectedDay, slot.minutes),
          minutes: slot.minutes,
          time: slot.time,
          groupKey: slot.groupKey,
          routineGroup: slot.routineGroup,
          dose: slot.dose,
        })
        slotsByStackItem.set(cycle.stack_item_id, arr)
      }
    }
    for (const [stackItemId, slots] of slotsByStackItem) {
      totalDaySlots += slots.length
      const ordered = [...slots].sort((a, b) => a.minutes - b.minutes)
      const decided = decidedByStackItem.get(stackItemId) ?? 0
      const pendings = [...(pendingByStackItem.get(stackItemId) ?? [])]
      ordered.slice(decided).forEach(slot => {
        slot.pendingLog = pendings.shift()
        dueSlots.push(slot)
      })
    }
  }
  const completedDaySlots = totalDaySlots - dueSlots.length
  // Fuer die Bilanz und die Quittung gilt dieselbe Rechnung wie in der
  // Tageszelle: bestaetigt heisst GENOMMEN. Eine bewusst ausgelassene Einnahme
  // ist entschieden, aber nicht genommen — sonst behauptete der Held „4 von 4
  // bestaetigt" fuer einen Tag, an dem eine ausgelassen wurde.
  const standHeute = tagesStand.get(selectedLocalDate)
  const genommeneSlots = FEATURES.planTimelineV2 && standHeute
    ? standHeute.genommen
    : completedDaySlots
  const incompletePastDay = isPastSelected && totalDaySlots > 0 && genommeneSlots < totalDaySlots
  const dueSlotByKey = new Map(dueSlots.map(slot => [slot.key, slot]))
  const dueRoutineGroups = groupRoutineIntakes(dueSlots.map(slot => {
    const trackingLevel = slot.cycle.stack_items?.tracking_level ?? 'complete'
    return buildDashboardRoutineIntake({
      key: slot.key,
      cycleId: slot.cycle.id,
      planVersionId: slot.planVersionId,
      pendingLogId: slot.pendingLog?.id ?? null,
      stackItemId: slot.cycle.stack_item_id,
      stackItemName: slot.cycle.stack_items?.display_name ?? '',
      trackingLevel,
      routineGroup: slot.routineGroup,
      minutes: slot.minutes,
      scheduledAt: FEATURES.planTimelineV2 ? slot.scheduledAt : slot.pendingLog?.logged_at ?? slot.scheduledAt,
      ...resolveDashboardCycleQuantity(slot.cycle, selectedDay, escalations, slot.dose),
      method: slot.cycle.method,
    })
  }))
  const dueRoutineGroupByKey = new Map(dueRoutineGroups.map(group => [group.key, group]))
  const dueIntakes = dueRoutineGroups.flatMap(group => group.items)
  const bundleRows = bundles.map(bundle => {
    const itemIds = liveBundleItemIds(bundle, stackItemById)
    return { bundle, itemIds, open: bundleDueIntakes({ stack_item_ids: itemIds }, dueIntakes) }
  })
  const duePeriodCarousels = PERIOD_ORDER.map(key => {
    const routineGroup = dueRoutineGroupByKey.get(PERIOD_TO_ROUTINE_GROUP[key]) ?? null
    return {
      key,
      ...intakeGroupMeta(key, t),
      routineGroup,
      slots: routineGroup?.items.map(item => dueSlotByKey.get(item.key)).filter((slot): slot is DueSlot => Boolean(slot)) ?? [],
    }
  })
  // Statt Reitern: die Tageszeiten in ihrer natuerlichen Reihenfolge, und die
  // erste, in der noch etwas offen ist, wird der Held. Was danach kommt, steht
  // darunter als „Spaeter heute".
  //
  // Reiter hatten drei Nachteile auf einmal: sie versteckten zwei Drittel des
  // Tages, sie brauchten einen Tap, bevor man ueberhaupt sah was ansteht, und
  // nach einem Ladevorgang stand der aktive Reiter gern auf einer leeren
  // Tageszeit.
  const offeneGruppen = duePeriodCarousels.filter(periode => periode.slots.length > 0)
  // Jede offene Einnahme kann die grosse Ansicht bekommen — aber nur eine auf
  // einmal, und nur auf Antippen. Voreingestellt ist die erste offene; tippt
  // man eine andere an, wandert die grosse Ansicht dorthin und die bisherige
  // wird zur Zeile.
  const alleOffenenSlots = offeneGruppen.flatMap(gruppe => (
    gruppe.slots.map(slot => ({ slot, gruppe }))
  ))
  const offenerSlot: string | null = aufgeklappt.art === 'keiner'
    ? null
    : aufgeklappt.art === 'voreingestellt'
      ? alleOffenenSlots[0]?.slot.key ?? null
      // Ist die angetippte entschieden, ruecken wir in derselben Tageszeit
      // weiter statt zuzuklappen: „durchgehen" soll durch ALLE gehen.
      : alleOffenenSlots.find(eintrag => eintrag.slot.key === aufgeklappt.key)?.slot.key
        ?? alleOffenenSlots.find(eintrag => eintrag.gruppe.key === aufgeklappt.gruppe)?.slot.key
        // Ist auch die Tageszeit abgearbeitet, geht es bei der naechsten
        // offenen weiter. Ohne das klappte die ganze Liste zu, obwohl abends
        // noch etwas anstand.
        ?? alleOffenenSlots[0]?.slot.key
        ?? null

  useEffect(() => {
    setAufgeklappt({ art: 'voreingestellt' })
  }, [selectedDay])

  useEffect(() => {
    if (location.hash !== '#due-intakes') return
    const dateParam = new URLSearchParams(location.search).get('date')
    const parsed = dateParam ? parseISO(dateParam) : null
    const target = parsed && !isNaN(parsed.getTime()) ? parsed : new Date()
    setSelectedDay(target)
    setCurrentDate(new Date(target.getFullYear(), target.getMonth(), 1))
  }, [location.hash, location.search])

  useEffect(() => {
    if (location.hash !== '#due-intakes') return
    const scrollToDue = () => {
      document.getElementById('due-intakes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const timer = window.setTimeout(scrollToDue, 150)
    return () => window.clearTimeout(timer)
  }, [location.hash, location.search, dueSlots.length, selCycles.length, logs.length])

  const applyGenericInventory = async (doseLogId: string, showPageRetry = true) => {
    try {
      await applyInventoryConfirmation(dashboardDataClient, doseLogId)
      if (showPageRetry) {
        setInventoryRetryIds(current => current.filter(id => id !== doseLogId))
      }
      return true
    } catch {
      if (showPageRetry) {
        setInventoryRetryIds(current => current.includes(doseLogId) ? current : [...current, doseLogId])
        toast.error(t('inventory_update_failed', { defaultValue: 'Bestand konnte nicht aktualisiert werden' }))
      }
      return false
    }
  }

  // Lokale Patches statt vollem Nachladen.
  //
  // Jede Bestaetigung, jedes Ueberspringen, jedes Wiederoeffnen und jedes
  // Loeschen liess bisher `loadLogs()` laufen -- und das laedt Zeitleisten,
  // Bestandsliste, Zeitzonen-Review und jede Zeile im sichtbaren Fenster neu,
  // fuer eine einzige Zeile, die sich geaendert hat. Die drei Helfer hier
  // schreiben stattdessen genau das in `logs`, was gerade erfolgreich in die
  // Datenbank ging -- nie mehr, nie geraten:
  //
  // - Ein direktes `.update(...)`/`.delete()` spiegelt exakt das Objekt, das
  //   gerade an die Datenbank ging (`patcheLog`/`entferneLog`).
  // - `reverse_inventory_confirmation` setzt laut Definition nur `taken`
  //   (`skip` -> false, sonst null) und ruehrt `notes` nie an -- das steht so
  //   in `supabase-my-stack-tracking-depth.sql`, nicht geraten.
  // - `confirm_intake_group` gibt die volle Zeile ohnehin zurueck
  //   (`returns setof dose_logs`); die wurde bisher auf die id
  //   zusammengestrichen (`uebernehmeGespeicherteZeile`).
  const entferneLog = (id: string) => setLogs(current => current.filter(l => l.id !== id))

  const patcheLog = (id: string, aenderung: Partial<DoseLog>) => (
    setLogs(current => current.map(l => l.id === id ? { ...l, ...aenderung } : l))
  )

  const uebernehmeGespeicherteZeile = (row: SavedDoseLog) => {
    const stackItem = row.stack_item_id ? stackItemById.get(row.stack_item_id) : undefined
    // `?? vorherige` heisst hier: das Feld FEHLT in der Antwort (echte
    // Zeilen der RPC haben es immer, ein schmaler Test-Mock manchmal nicht).
    // Das ist etwas anderes als `null`, und `??` unterscheidet das nicht --
    // ein `in row`-Test davor tut es. Ohne den waere ein echtes `dose: null`
    // (Intake-Only-Substanz, gerade so von der RPC bestaetigt) durch den
    // alten Wert ueberschrieben worden, statt geloescht zu werden.
    const feld = <K extends keyof SavedDoseLog>(schluessel: K, altwert: DoseLog[K]): DoseLog[K] => (
      schluessel in row ? (row[schluessel] as DoseLog[K] ?? null as DoseLog[K]) : altwert
    )
    setLogs(current => {
      const index = current.findIndex(l => l.id === row.id)
      const vorherige = index === -1 ? undefined : current[index]
      const naechste: DoseLog = {
        id: row.id,
        stack_item_id: row.stack_item_id ?? vorherige?.stack_item_id ?? '',
        dose: feld('dose', vorherige?.dose ?? null),
        unit: feld('unit', vorherige?.unit ?? null),
        method: row.method ?? vorherige?.method ?? '',
        logged_at: row.logged_at ?? vorherige?.logged_at ?? '',
        notes: feld('notes', vorherige?.notes ?? null),
        taken: feld('taken', vorherige?.taken ?? null),
        stack_items: { display_name: stackItem?.display_name ?? vorherige?.stack_items?.display_name ?? '' },
        cycle_id: feld('cycle_id', vorherige?.cycle_id ?? null),
        plan_version_id: feld('plan_version_id', vorherige?.plan_version_id ?? null),
        routine_slot_key: feld('routine_slot_key', vorherige?.routine_slot_key ?? null),
      }
      if (index === -1) return [...current, naechste]
      const kopie = [...current]
      kopie[index] = naechste
      return kopie
    })
  }

  const deleteLog = async (log: DoseLog) => {
    if (!confirm(t('eintrag_loeschen'))) return
    const stackItem = stackItems.find(item => item.id === log.stack_item_id)
    const reversesInventory = log.taken === true
      && (stackItem?.dosage_form === 'vial' || stackItem?.tracking_level === 'complete')
    if (reversesInventory) {
      try {
        await reverseInventoryConfirmation(dashboardDataClient, log.id, 'delete')
      } catch {
        return toast.error(t('error'))
      }
    } else {
      const { error } = await dashboardDataClient.from('dose_logs').delete().eq('id', log.id)
      if (error) return toast.error(t('error'))
    }
    // `loadStackItems()` ist unter der Zeitleiste ein Leerlauf (die
    // Funktion kehrt sofort zurueck, siehe ihre eigene Definition) -- hier
    // trotzdem drin, weil sie das nur ist, SOLANGE der Rollout-Schalter
    // steht. Kippt er zurueck, greift sie wieder wie vor dieser Aenderung,
    // ohne dass hier etwas nachgezogen werden muesste.
    toast.success(t('deleted')); entferneLog(log.id); loadStackItems()
  }

  const confirmDose = async (log: DoseLog, taken: boolean, loggedAt?: string, quantity?: DashboardQuantity) => {
    const previousTaken = log.taken
    const stackItem = stackItems.find(item => item.id === log.stack_item_id)
    const update: Record<string, unknown> = { taken }
    if (taken && loggedAt) update.logged_at = loggedAt
    if (quantity) {
      update.dose = quantity.dose
      update.unit = quantity.unit
    }
    const reversesInventory = previousTaken === true
      && taken !== true
      && (stackItem?.dosage_form === 'vial' || stackItem?.tracking_level === 'complete')
    if (reversesInventory) {
      try {
        await reverseInventoryConfirmation(dashboardDataClient, log.id, 'skip')
      } catch {
        return toast.error(t('error'))
      }
    } else {
      const { error } = await dashboardDataClient.from('dose_logs').update(update).eq('id', log.id)
      if (error) return toast.error(t('error'))
    }
    const confirmedQuantity = quantity ?? log
    if (previousTaken !== true && taken === true && hasTrackedQuantity(confirmedQuantity)) {
      if (stackItem?.dosage_form === 'vial') {
        await applyGenericInventory(log.id)
      } else if (stackItem?.tracking_level === 'complete') {
        await applyGenericInventory(log.id)
      }
    }
    // Der `reverseInventory`-Zweig oben schreibt nur `taken` (siehe die
    // Erklaerung bei den Helfern) -- `update` traegt dort ungenutzte Werte,
    // die nie an die Datenbank gingen und hier auch nicht ins lokale Bild
    // duerfen.
    patcheLog(log.id, (reversesInventory ? { taken: false } : update) as Partial<DoseLog>)
    loadStackItems()
    if (taken) toast.success(t('einnahme_bestaetigt'))
    else toast(t('einnahme_uebersp_toast'), { icon: '⏭️' })
  }

  const undoDose = async (log: DoseLog) => {
    const stackItem = stackItems.find(item => item.id === log.stack_item_id)
    const reversesInventory = log.taken === true
      && (stackItem?.dosage_form === 'vial' || stackItem?.tracking_level === 'complete')
    if (reversesInventory) {
      try {
        await reverseInventoryConfirmation(dashboardDataClient, log.id, 'undo')
      } catch {
        return toast.error(t('error'))
      }
    } else {
      // Eine vom Auto-Miss eingetragene Zeile traegt `auto-missed`. Bleibt die
      // Notiz stehen, heisst die Einnahme nach einem bewussten Auslassen
      // weiterhin „Verpasst" — und `injectionPersistence` haelt sie weiter
      // fuer offen. Nur dieser Zweig kann das treffen: eine auto-verpasste
      // Zeile hat `taken === false` und bucht deshalb keinen Bestand zurueck.
      const { error } = await dashboardDataClient.from('dose_logs')
        .update(log.notes === AUTO_MISSED_NOTE ? { taken: null, notes: null } : { taken: null })
        .eq('id', log.id)
      if (error) return toast.error(t('error'))
    }
    // Der Bestandshinweis gehoerte zu einer Bestaetigung, die es nicht mehr
    // gibt. Blieb er stehen, lief jeder weitere Versuch in den
    // `taken is true`-Filter der RPC und schlug fehl.
    setInventoryRetryIds(current => current.filter(id => id !== log.id))
    patcheLog(log.id, reversesInventory
      ? { taken: null }
      : (log.notes === AUTO_MISSED_NOTE ? { taken: null, notes: null } : { taken: null }))
    loadStackItems()
    toast.success(t('dose_reopen_success', { defaultValue: 'Einnahme wieder geöffnet' }))
  }

  const confirmCycleDose = async (cycle: Cycle, taken: boolean, loggedAt?: string, slotDose: number | null = null, occurrenceAt?: string, pendingLog?: DoseLog, geplanterSchluessel?: string, tatsaechlicheMenge?: number | null) => {
    if (!user) return
    if (FEATURES.planTimelineV2 && !timelineReady) throw new Error('Timeline is not current')
    let quantity = resolveDashboardCycleQuantity(cycle, selectedDay, escalations, slotDose)
    const actualLoggedAt = loggedAt ?? cycleLogTimestamp(cycle, selectedDay)
    const scheduledAt = occurrenceAt ?? actualLoggedAt
    // Kommt die Einnahme aus einem geplanten Slot, traegt sie dessen
    // Schluessel schon -- und der ist die geplante Minute. Ihn hier aus dem
    // Zeitpunkt nachzurechnen faellt genau an der Zeitumstellung auseinander:
    // ein geplanter 02:30-Slot landet am 29.03. auf 03:00, und aus dem
    // Zeitpunkt zurueckgelesen hiesse er dann `@03:00`. Damit passte er auf
    // keinen Plantag mehr -- und kollidierte mit einem tatsaechlich
    // geplanten 03:00-Slot. Ohne Slot (Bei Bedarf) gibt es nichts zu erben,
    // dort ist der Zeitpunkt der Platz.
    const slotSchluessel = geplanterSchluessel ?? slotSchluesselFuerZeitpunkt(cycle.id, scheduledAt, timeZone)
    if (FEATURES.planTimelineV2 && !taken) {
      const timeline = timelines.find(item => item.cycle.id === cycle.id)
      const resolved = timeline && resolveCycleAt(timeline, new Date(actualLoggedAt), timeZone)
      const entry = buildConfirmationEntry(buildDashboardRoutineIntake({
        key: slotSchluessel,
        cycleId: cycle.id,
        planVersionId: pendingLog?.plan_version_id ?? resolved?.planVersion?.id ?? cycle.planVersionId ?? null,
        pendingLogId: pendingLog?.id ?? null,
        stackItemId: cycle.stack_item_id,
        stackItemName: cycle.stack_items.display_name,
        trackingLevel: cycle.stack_items.tracking_level,
        routineGroup: routineGroupFromMinutes(new Date(scheduledAt).getHours() * 60 + new Date(scheduledAt).getMinutes()),
        minutes: 0,
        scheduledAt,
        dose: quantity.dose,
        unit: quantity.unit,
        method: cycle.method,
      }))
      let uebersprungeneZeile: SavedDoseLog | undefined
      try {
        [uebersprungeneZeile] = await skipIntakeGroup(
          dashboardDataClient as unknown as IntakeConfirmationClient,
          [{ ...entry, actualLoggedAt }],
        )
      } catch {
        toast.error(t('fehler_speichern'))
        return
      }
      if (uebersprungeneZeile) {
        if (sichtbaresFenster.current === timelineContext) uebernehmeGespeicherteZeile(uebersprungeneZeile)
        else await loadLogs()
      }
      loadStackItems()
      toast(t('einnahme_uebersp_toast'), { icon: '⏭️' })
      return
    }
    if (FEATURES.planTimelineV2 && taken) {
      const timeline = timelines.find(item => item.cycle.id === cycle.id)
      const resolved = timeline && resolveCycleAt(timeline, new Date(actualLoggedAt), timeZone)
      if (!resolved?.planVersion || resolved.status !== 'active') throw new Error('Intake timestamp is not active')
      if (isOnDemand(cycle.frequency)) {
        if (!isOnDemand(resolved.planVersion.frequency)) throw new Error('Timestamp is not a PRN plan')
        cycle = dashboardCycleFromTimeline(timeline!, resolved.planVersion, stackItemById.get(cycle.stack_item_id), timeZone)
        quantity = resolveDashboardCycleQuantity(cycle, selectedDay, [], null)
      }
      const geplanteEintragung = buildConfirmationEntry(buildDashboardRoutineIntake({
        key: slotSchluessel,
        cycleId: cycle.id,
        planVersionId: resolved.planVersion.id,
        pendingLogId: pendingLog?.id ?? null,
        stackItemId: cycle.stack_item_id,
        stackItemName: cycle.stack_items.display_name,
        trackingLevel: cycle.stack_items.tracking_level,
        routineGroup: routineGroupFromMinutes(new Date(scheduledAt).getHours() * 60 + new Date(scheduledAt).getMinutes()),
        minutes: 0,
        scheduledAt,
        dose: quantity.dose,
        unit: quantity.unit,
        method: cycle.method,
      }))
      // Nicht ueber `buildOneOffActualDose` (das Gruppen-Sheet benutzt es
      // fuer dieselbe Abweichung): das verlangt zusaetzlich, dass die
      // GEPLANTE Basismenge selbst positiv ist. Bei Bei-Bedarf-Substanzen
      // loest der PRN-Zweig oben `cycle`/`quantity` gerade erst neu auf --
      // ohne gesetzte Menge auf der getroffenen Planversion waere das ein
      // Fehlschlag, obwohl der Nutzer hier eine gueltige eigene Menge
      // eingegeben hat. Positivitaet der Eingabe ist schon im Sheet
      // geprueft (`confirmDoseUngueltig` sperrt sonst den Knopf); die
      // Einheit kommt bewusst aus `quantity.unit` -- derselben Quelle, aus
      // der `geplanteEintragung` seine eigene Einheit hat, statt aus dem
      // (zu diesem Zeitpunkt womoeglich veralteten) Sheet-Zustand -- ein
      // Mismatch kann damit nicht entstehen. Ohne Abweichung bleibt die
      // geplante Menge stehen.
      const eintragung = tatsaechlicheMenge != null && quantity.unit
        ? { ...geplanteEintragung, actualDose: tatsaechlicheMenge, actualUnit: quantity.unit }
        : geplanteEintragung
      const [gespeicherteZeile] = await confirmIntakeGroup(
        dashboardDataClient as unknown as IntakeConfirmationClient,
        [{ ...eintragung, actualLoggedAt }],
      )
      const doseLogId = gespeicherteZeile?.id
      const stackItem = stackItems.find(item => item.id === cycle.stack_item_id)
      if (doseLogId && (stackItem?.dosage_form === 'vial' || stackItem?.tracking_level === 'complete')) {
        await applyGenericInventory(doseLogId)
      }
      if (gespeicherteZeile) {
        if (sichtbaresFenster.current === timelineContext) uebernehmeGespeicherteZeile(gespeicherteZeile)
        else await loadLogs()
      }
      loadStackItems()
      toast.success(t('einnahme_bestaetigt'))
      return
    }
    const { data: savedLog, error } = await dashboardDataClient.from('dose_logs').insert({
      user_id: user.id,
      stack_item_id: cycle.stack_item_id,
      dose: quantity.dose,
      unit: quantity.unit,
      method: cycle.method,
      logged_at: scheduledAt,
      taken,
      ...(FEATURES.planTimelineV2 ? {
        cycle_id: cycle.id,
        plan_version_id: cycle.planVersionId ?? null,
        routine_slot_key: slotSchluessel,
      } : {}),
    }).select('id').single()
    if (error) return toast.error(t('fehler_speichern'))
    const stackItem = stackItems.find(item => item.id === cycle.stack_item_id)
    if (taken && hasTrackedQuantity(quantity)) {
      if (stackItem?.dosage_form === 'vial') {
        if (savedLog?.id) await applyGenericInventory(savedLog.id)
      } else if (
        cycle.stack_items?.tracking_level === 'complete'
        && savedLog?.id
      ) {
        await applyGenericInventory(savedLog.id)
      }
    }
    loadLogs(); loadStackItems()
    if (taken) toast.success(t('einnahme_bestaetigt'))
    else toast(t('einnahme_uebersp_toast'), { icon: '⏭️' })
  }

  // ── Bestätigungs-Sheet ───────────────────────────────────────────────────
  const openConfirmSheet = (cycle?: Cycle, log?: DoseLog, slotTime?: string, slotDose: number | null = null, scheduledAt?: string, slotKey?: string) => {
    let defaultTime: string
    if (cycle && slotTime) {
      defaultTime = slotTime
    } else if (cycle) {
      const intakeMin = cycleIntakeMinutes(cycle, selectedDay)
      const safe = intakeMin >= 24 * 60 ? 12 * 60 : intakeMin
      defaultTime = `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`
    } else if (log) {
      const d = new Date(log.logged_at)
      defaultTime = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    } else {
      const now = new Date()
      defaultTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    }
    setConfirmTime(defaultTime)
    // Vorausgefuellt mit der geplanten Menge dieses Slots -- derselbe
    // Resolver, den `confirmCycleDose` selbst benutzt, damit hier steht,
    // was tatsaechlich gilt (Eskalation, Slot-eigene Menge), nicht geraten.
    //
    // Nur unter der Zeitleiste: `handleConfirmSheet` reicht die Menge nur in
    // ihrem V2-Zweig an `confirmCycleDose` weiter. Zeigte das Feld auch im
    // alten Zweig, saehe der Nutzer eine editierbare Menge, deren Eingabe
    // beim Bestaetigen still verworfen wuerde -- stattdessen bleibt das Feld
    // dort unsichtbar, wie vor dieser Aenderung.
    if (FEATURES.planTimelineV2 && cycle && dosePlanCapabilities(cycle.stack_items.tracking_level).oneOff) {
      const geplant = resolveDashboardCycleQuantity(cycle, selectedDay, escalations, slotDose)
      setConfirmDoseText(geplant.dose != null ? String(geplant.dose) : '')
      setConfirmUnit(geplant.unit)
    } else {
      setConfirmDoseText('')
      setConfirmUnit(null)
    }
    setConfirmSheet({ cycle, log, slotDose, scheduledAt, slotKey })
  }

  const openInjectionTrackerForSlot = (slot: DueSlot) => {
    const returnTo = `/kalender?date=${format(selectedDay, 'yyyy-MM-dd')}#due-intakes`
    const url = buildInjectionTrackerUrl({
      doseLogId: FEATURES.planTimelineV2 ? null : slot.pendingLog?.id ?? null,
      cycleId: slot.cycle.id,
      scheduledAt: FEATURES.planTimelineV2 ? slot.scheduledAt : slot.pendingLog?.logged_at ?? slot.scheduledAt,
      returnTo,
    })
    navigate(FEATURES.planTimelineV2 && slot.pendingLog
      ? `${url}&doseLogId=${encodeURIComponent(slot.pendingLog.id)}` : url)
  }

  const handleConfirmSheet = async () => {
    if (!confirmSheet) return
    if (FEATURES.planTimelineV2) {
      if (!timelineReady) return
      if (confirmDoseUngueltig) return
      try {
        const [hours, minutes] = confirmTime.split(':').map(Number)
        const actualAt = new Date(selectedDay)
        actualAt.setHours(hours, minutes, 0, 0)
        if (confirmSheet.cycle) {
          await confirmCycleDose(confirmSheet.cycle, true, actualAt.toISOString(),
            confirmSheet.slotDose ?? null, confirmSheet.scheduledAt, confirmSheet.log, confirmSheet.slotKey,
            confirmUnit != null ? confirmDoseWert : null)
        } else if (confirmSheet.log) {
          await confirmDose(confirmSheet.log, true, actualAt.toISOString())
        }
        setConfirmSheet(null)
      } catch {
        toast.error(t('fehler_speichern', { defaultValue: 'Fehler beim Speichern' }))
      }
      return
    }
    const [h, m] = confirmTime.split(':').map(Number)
    if (confirmSheet.cycle) {
      const day = new Date(selectedDay)
      day.setHours(h, m, 0, 0)
      if (confirmSheet.log) await confirmDose(
        confirmSheet.log,
        true,
        day.toISOString(),
        resolveDashboardCycleQuantity(confirmSheet.cycle, selectedDay, escalations, confirmSheet.slotDose ?? null),
      )
      else                  await confirmCycleDose(
        confirmSheet.cycle,
        true,
        FEATURES.planTimelineV2 && confirmSheet.scheduledAt
          ? confirmSheet.scheduledAt
          : day.toISOString(),
        confirmSheet.slotDose ?? null,
      )
    } else if (confirmSheet.log) {
      const logDate = new Date(confirmSheet.log.logged_at)
      logDate.setHours(h, m, 0, 0)
      await confirmDose(confirmSheet.log, true, logDate.toISOString())
    }
    setConfirmSheet(null)
  }

  const confirmRoutineGroup = async (entries: RoutineConfirmationEntry[]): Promise<string[]> => {
    if (FEATURES.planTimelineV2 && !timelineReady) throw new Error('Timeline is not current')
    const saved = await confirmIntakeGroup(
      dashboardDataClient as unknown as IntakeConfirmationClient,
      entries,
    )
    routineCommitted.current = true
    return saved.map(row => row.id)
  }

  /**
   * Ein Tipp auf das Bündel: je Substanz die naechste offene Einnahme, mit der
   * geplanten Menge, ueber dieselbe RPC wie die Tageszeit-Gruppe.
   *
   * Zwei Faelle gehen stattdessen ins bekannte Bestaetigungsblatt, mit genau
   * diesen Einnahmen: fehlt einer die Menge, die sie braucht, wird nicht
   * geraten; und ist eine Injektion dabei, bietet nur das Blatt danach an,
   * die Injektionsstelle zu ergaenzen.
   */
  const confirmBundle = async (bundle: IntakeBundle, items: RoutineIntake[]) => {
    if (items.length === 0 || bundleBusyRef.current) return
    const entries = items.map(buildConfirmationEntry)
    const needsReview = entries.some(entry => entry.injectable || (
      entry.trackingLevel !== 'intake_only'
      && !(entry.actualDose != null && Number.isFinite(entry.actualDose) && entry.actualDose > 0 && entry.actualUnit?.trim())
    ))
    if (needsReview) {
      routineCommitted.current = false
      setRoutineGroupSheet({ key: items[0].group, items, label: bundle.name })
      return
    }
    bundleBusyRef.current = true
    setBundleBusyId(bundle.id)
    try {
      let savedLogIds: string[]
      try {
        savedLogIds = await confirmRoutineGroup(entries)
      } catch {
        toast.error(t('fehler_speichern', { defaultValue: 'Fehler beim Speichern' }))
        return
      }
      // Ab hier ist gespeichert. Was danach scheitert, ist kein Speicherfehler.
      try {
        await afterRoutineGroupConfirmed(entries, savedLogIds)
      } catch (error) {
        if (error instanceof InventoryConfirmationError) {
          toast.error(t('inventory_committed_retry', { defaultValue: 'Die Einnahme ist gespeichert, aber der Bestand wurde nicht aktualisiert.' }))
        } else {
          toast.success(t('einnahme_bestaetigt', { defaultValue: 'Einnahme bestätigt' }))
        }
      }
    } finally {
      bundleBusyRef.current = false
      setBundleBusyId(null)
    }
  }

  const saveBundle = async (draft: { name: string; stackItemIds: string[] }) => {
    if (!user || bundleSheet === undefined) return
    const saved = await saveIntakeBundle(bundleClient, user.id, {
      id: bundleSheet?.id,
      name: draft.name,
      stackItemIds: draft.stackItemIds,
      sortOrder: bundleSheet?.sort_order ?? bundles.reduce((max, bundle) => Math.max(max, bundle.sort_order + 1), 0),
    })
    setBundles(current => bundleSheet
      ? current.map(bundle => bundle.id === saved.id ? saved : bundle)
      : [...current, saved])
    setBundleSheet(undefined)
  }

  const removeBundle = async () => {
    if (!user || !bundleSheet) return
    const id = bundleSheet.id
    await deleteIntakeBundle(bundleClient, user.id, id)
    setBundles(current => current.filter(bundle => bundle.id !== id))
    setBundleSheet(undefined)
  }

  const afterRoutineGroupConfirmed = async (
    entries: RoutineConfirmationEntry[],
    savedLogIds: string[],
  ) => {
    const vialStackItemIds = new Set(
      stackItems.filter(item => item.dosage_form === 'vial').map(item => item.id),
    )
    const selectedEntries = entries.filter(entry => entry.selected)
    const confirmedEntries = selectedEntries.map((entry, index) => ({
      entry,
      doseLogId: savedLogIds[index],
    })).filter(item => Boolean(item.doseLogId))
    const stockUpdates = user
      ? quantifiedVialEntries(entries, vialStackItemIds).map(async entry => {
          const doseLogId = confirmedEntries.find(item => item.entry.key === entry.key)?.doseLogId
          if (!doseLogId) return
          await debitPeptideStockForDoseById(dashboardDataClient, doseLogId)
        })
      : []
    const genericEntries = confirmedEntries.filter(({ entry }) => (
      entry.trackingLevel === 'complete'
      && !vialStackItemIds.has(entry.stackItemId)
    ))
    const [stockResults, inventoryResults] = await Promise.all([
      Promise.allSettled(stockUpdates),
      Promise.allSettled(genericEntries.map(({ doseLogId }) => (
        applyGenericInventory(doseLogId, false)
      ))),
    ])
    // `loadStackItems()` ist unter der Zeitleiste ein Leerlauf (siehe die
    // Funktion selbst); diese Zeile war hier immer schon wirkungslos.
    // `loadLogs()` bleibt: eine Gruppenbestaetigung kann mehrere Zeilen auf
    // einmal aendern, und die Einzelpatches oben decken nur den
    // Ein-Slot-Weg ab.
    await loadLogs()
    toast.success(t('einnahme_bestaetigt', { defaultValue: 'Einnahme bestätigt' }))
    const failedVialIds = quantifiedVialEntries(entries, vialStackItemIds)
      .map(entry => confirmedEntries.find(item => item.entry.key === entry.key)?.doseLogId)
      .filter((doseLogId, index): doseLogId is string => (
        Boolean(doseLogId) && stockResults[index].status === 'rejected'
      ))
    const failedInventoryIds = genericEntries
      .filter((_, index) => (
        inventoryResults[index].status === 'rejected'
        || inventoryResults[index].value === false
      ))
      .map(item => item.doseLogId)
    const failedDoseLogIds = [...failedVialIds, ...failedInventoryIds]
    if (failedDoseLogIds.length > 0) {
      throw new InventoryConfirmationError(failedDoseLogIds)
    }
  }

  const openRoutineInjection = (entry: RoutineIntake, doseLogId: string) => {
    const returnTo = `/kalender?date=${format(selectedDay, 'yyyy-MM-dd')}#due-intakes`
    navigate(buildInjectionTrackerUrl({
      doseLogId,
      cycleId: entry.cycleId,
      scheduledAt: entry.scheduledAt,
      returnTo,
    }))
  }

  const snoozeDose = (log: DoseLog, minutes: number) => {
    const time = minutes < 60 ? `${minutes} min` : `${minutes / 60} h`
    toast(t('erinnerung_toast', { time }), { icon: '⏰' })
    setTimeout(() => {
      toast(
        t('dose_nicht_best', { name: log.stack_items?.display_name, dose: log.dose, unit: log.unit }),
        { icon: <Syringe size={18} />, duration: 10000 }
      )
    }, minutes * 60 * 1000)
  }

  // ── Day cell renderer ─────────────────────────────────────────────────────
  const today = new Date()
  interface ZellenOptionen {
    day: Date
    /** Der Monat, gegen den „gehoert dieser Tag dazu?" geprueft wird. */
    monatsBezug: Date
    key: number
    /** Vorschau beim Wischen: nicht anklickbar, ohne Balken. */
    vorschau?: boolean
    /** Im Streifen steht der Wochentag in der Zelle; im Monatsblatt ueber dem Raster. */
    mitWochentag?: boolean
    /** Der Onboarding-Anker fuer „heute" darf es nur einmal geben. */
    ohneAnker?: boolean
  }
  const renderDayCell = ({ day, monatsBezug, key, vorschau = false, mitWochentag = false, ohneAnker = false }: ZellenOptionen) => {
    const isPeek = vorschau
    const inMonth = mitWochentag || day.getMonth() === monatsBezug.getMonth()
    const isSelected = !isPeek && isSameDay(day, selectedDay)
    const isTodayDay = isToday(day)
    // Tag-genau vergleichen (nicht mit Uhrzeit) — sonst gilt „morgen" < 24h als heute/vergangen.
    const dayKey = format(day, 'yyyy-MM-dd')
    const todayKey = format(today, 'yyyy-MM-dd')
    const isPastDay = dayKey < todayKey

    // Fuelltage des Vor-/Folgemonats bleiben neutral: ihre Logs liegen
    // ausserhalb des geladenen Fensters, ein Balken waere geraten.
    const stand = !isPeek && inMonth ? tagesStand.get(dayKey) : undefined
    const geplant = stand?.geplant ?? 0
    const anteil = geplant > 0 ? stand!.genommen / geplant : 0
    const vollstaendig = geplant > 0 && stand!.genommen === geplant
    // Ein vergangener Tag, an dem noch etwas unentschieden ist. Bewusst
    // ausgelassene Einnahmen zaehlen NICHT hierher — das war eine Entscheidung
    // des Nutzers, kein Versaeumnis.
    const offenVergangen = isPastDay && (stand?.offen ?? 0) > 0

    // Drei Bedeutungen, drei Spuren — und keine davon rot. Rot hiesse
    // „etwas ist schiefgegangen"; ein Protokoll stellt das nicht fest.
    const spurFarbe = geplant === 0 || vollstaendig
      ? 'transparent'
      // Vergangen und noch unentschieden: sichtbar, aber warnfrei. Vorher war
      // das ein 14%-Weiss und damit von „nichts geplant" kaum zu unterscheiden.
      : offenVergangen ? 'rgba(245,158,11,0.32)'
      // Vergangen und entschieden, aber nicht genommen — bewusst ausgelassen.
      : isPastDay ? 'rgba(255,255,255,0.16)'
      // Heute oder kuenftig: steht noch an.
      : 'var(--accent-weak)'

    const beschriftung = geplant === 0
      ? format(day, 'd. MMMM', { locale })
      : t('calendar_day_status', {
          defaultValue: '{{datum}}, {{genommen}} von {{geplant}} bestätigt',
          datum: format(day, 'd. MMMM', { locale }),
          genommen: stand!.genommen,
          geplant,
        })

    return (
      <button
        key={key}
        type="button"
        data-calendar-date={!isPeek ? dayKey : undefined}
        {...(isTodayDay && !isPeek && !ohneAnker ? { 'data-ob': 'ob-cal-today' } : {})}
        aria-label={beschriftung}
        aria-pressed={!isPeek ? isSelected : undefined}
        aria-current={isTodayDay && !isPeek ? 'date' : undefined}
        tabIndex={isPeek ? -1 : undefined}
        onClick={() => {
          // Ein Wisch endet mit einem `click` auf der Zelle unter dem Finger.
          if (wurdeGewischt.current) return
          selectCalendarDay(new Date(day.getFullYear(), day.getMonth(), day.getDate()))
        }}
        className={[
          'relative flex flex-col items-center gap-1.5 border-r border-b last:border-r-0 transition-all duration-150 select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300',
          !inMonth ? 'opacity-20' : '',
          isPeek ? 'pointer-events-none' : '',
        ].filter(Boolean).join(' ')}
        style={{
          padding: '9px 0 8px',
          minHeight: 52,
          borderColor: 'var(--border)',
          background: isSelected
            ? 'linear-gradient(145deg, rgba(0,190,240,0.85), rgba(0,120,210,0.75))'
            : 'transparent',
          boxShadow: isSelected
            ? 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 16px rgba(0,200,240,0.25)'
            : undefined,
        }}
      >
        {/* Heute-Ring */}
        {isTodayDay && !isSelected && (
          <span
            className="absolute inset-0.5 rounded-xl pointer-events-none"
            style={{ boxShadow: '0 0 0 1.5px rgba(0,204,245,0.60), 0 0 6px rgba(0,204,245,0.12)' }}
          />
        )}

        {mitWochentag && (
          <span className={`text-[9.5px] font-bold uppercase leading-none tracking-[0.06em] ${
            isSelected ? 'text-white/80' : isTodayDay ? 'text-sky-300' : 'text-slate-500'
          }`}>
            {format(day, 'EEEEEE', { locale })}
          </span>
        )}

        <span className={`text-sm font-black leading-none ${
          isSelected ? 'text-white' :
          isTodayDay ? 'text-sky-400' :
          inMonth ? 'text-slate-200' : 'text-slate-600'
        }`}>
          {format(day, 'd')}
        </span>

        {/* Der Balken IST die Legende: halb gefuellt heisst halb erledigt.
            Deshalb gibt es darunter keine mehr. */}
        <span
          aria-hidden="true"
          className="block h-[3px] w-[18px] rounded-full overflow-hidden shrink-0"
          style={{ background: isSelected && geplant > 0 ? 'rgba(255,255,255,0.28)' : spurFarbe }}
        >
          {anteil > 0 && (
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.round(anteil * 100)}%`,
                background: isSelected ? 'rgba(255,255,255,0.95)' : '#10b981',
                boxShadow: isSelected ? undefined : '0 0 4px #10b98155',
              }}
            />
          )}
        </span>
      </button>
    )
  }

  /**
   * Eine offene Einnahme — zugeklappt eine Zeile, aufgeklappt die grosse
   * Ansicht. Beides AN DERSELBEN STELLE: wer nach unten gescrollt hat und
   * antippt, bekommt sie dort geoeffnet, ohne dass die Seite springt.
   *
   * Die Hoehe wird ueber `max-height` bewegt statt ueber `height: auto`, das
   * sich nicht animieren laesst. Die Schranke ist grosszuegig gewaehlt, aber
   * nicht beliebig: zu viel Luft laesst das Zuklappen traege wirken.
   */
  const renderEinnahme = (
    slot: DueSlot,
    periode: { icon: LucideIcon; label: string; key: string; routineGroup: RoutineGroupModel | null },
    offen: boolean,
  ) => {
    const c = slot.cycle
    const { dose, unit } = resolveDashboardCycleQuantity(c, selectedDay, escalations, slot.dose)
    const mengeText = formatTrackedQuantity(dose, unit, String(t('quantity_not_tracked', { defaultValue: 'Menge nicht getrackt' })))
    const farbe = getStackItemColor(stackItems.findIndex(item => item.id === c.stack_item_id))
    const PeriodenIcon = periode.icon
    // Nur DIESE Einnahme vorlegen — die Gruppe traegt die ganze Tageszeit,
    // jeder Eintrag vorausgewaehlt.
    const nurDiese = periode.routineGroup
      ? { ...periode.routineGroup, items: periode.routineGroup.items.filter(item => item.key === slot.key) }
      : null
    const zweitKnopf = 'flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-slate-300 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300'

    return (
      <div
        key={slot.key}
        data-due-row={slot.key}
        data-due-open={offen ? 'true' : undefined}
        className="overflow-hidden rounded-2xl border transition-colors duration-200"
        style={{
          borderColor: offen ? 'var(--accent-border)' : 'var(--border)',
          background: offen
            ? 'linear-gradient(160deg, rgba(0,204,245,0.09), var(--surface) 62%)'
            : 'var(--surface)',
        }}
      >
        <div className="flex items-center gap-2 pr-2">
          <button
            type="button"
            data-due-item={slot.key}
            aria-expanded={offen}
            onClick={() => setAufgeklappt(offen
              ? { art: 'keiner' }
              : { art: 'slot', key: slot.key, gruppe: periode.key })}
            className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300"
          >
            <span
              className="shrink-0 rounded-full transition-all duration-200"
              style={{
                width: offen ? 10 : 8,
                height: offen ? 10 : 8,
                background: farbe,
                boxShadow: offen ? `0 0 12px ${farbe}80` : undefined,
              }}
            />
            <span className="min-w-0 flex-1">
              {/* Aufgeklappt nennt die Zeile IHRE Uhrzeit. Die Kopfzeile der
                  Tageszeit kann das nicht: „morgens" fasst alles vor zwoelf
                  zusammen, also auch 06:00 und 11:00 im selben Block. */}
              {offen && (
                <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-sky-300">
                  <PeriodenIcon size={12} aria-hidden="true" />
                  {slot.time || periode.label}
                </span>
              )}
              <span className={offen
                ? 'block text-2xl font-black leading-tight tracking-[-0.035em] text-white [overflow-wrap:anywhere]'
                : 'block truncate text-sm font-semibold text-white'}>
                {c.stack_items?.display_name}
              </span>
              <span className={offen
                ? 'mt-1 block text-base font-semibold text-slate-200'
                : 'mt-0.5 flex items-center gap-1.5 text-xs text-slate-400'}>
                {!offen && <PeriodenIcon size={11} className="shrink-0" aria-hidden="true" />}
                {/* Eine Zeichenkette in EINEM Element: sonst greift `truncate`
                    nicht und die Trennpunkte bekommen doppelten Abstand. */}
                <span className="truncate">
                  {offen ? `${mengeText} · ${c.method}` : `${slot.time || periode.label} · ${mengeText} · ${c.method}`}
                </span>
              </span>
            </span>
            {!offen && (
              <span role="presentation" className="shrink-0 text-slate-500">
                <ChevronDown size={16} aria-hidden="true" />
              </span>
            )}
          </button>
          {/* Das gruene Haekchen ist der schnelle Weg fuer den Normalfall:
              bestaetigen, ohne etwas zu aendern — ein Tap statt zwei.
              Aufgeklappt waere es doppelt, dort steht „Eingenommen" gross. */}
          {!offen && (
            <button
              type="button"
              aria-label={`${c.stack_items?.display_name} ${String(t('eingenommen'))}`}
              onClick={() => openConfirmSheet(c, slot.pendingLog ?? undefined, slot.time || undefined, slot.dose, slot.scheduledAt, slot.key)}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/[0.14] text-emerald-300 transition-colors hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <Check size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        <div
          data-due-panel
          className="overflow-hidden transition-[max-height,opacity] duration-300 ease-out motion-reduce:transition-none"
          style={{ maxHeight: offen ? 420 : 0, opacity: offen ? 1 : 0 }}
          aria-hidden={!offen}
        >
          <div className="space-y-2 px-3 pb-3">
            <button
              type="button"
              tabIndex={offen ? undefined : -1}
              onClick={() => openConfirmSheet(c, slot.pendingLog ?? undefined, slot.time || undefined, slot.dose, slot.scheduledAt, slot.key)}
              className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.17] text-base font-extrabold text-emerald-300 transition-colors hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <Check size={19} aria-hidden="true" />
              {isPastSelected ? t('dose_mark_taken', { defaultValue: 'Doch eingenommen' }) : t('eingenommen')}
            </button>

            <button
              type="button"
              tabIndex={offen ? undefined : -1}
              onClick={() => {
                routineCommitted.current = false
                if (nurDiese?.items.length) setRoutineGroupSheet(nurDiese)
              }}
              className={zweitKnopf}
            >
              {t('due_dose_override', { defaultValue: 'Einmalige Dosisänderung' })}
            </button>

            <button
              type="button"
              tabIndex={offen ? undefined : -1}
              onClick={() => FEATURES.planTimelineV2
                ? confirmCycleDose(c, false, slot.pendingLog?.logged_at ?? slot.scheduledAt, slot.dose, slot.scheduledAt, slot.pendingLog ?? undefined, slot.key)
                : slot.pendingLog
                  ? confirmDose(slot.pendingLog, false, undefined, resolveDashboardCycleQuantity(c, selectedDay, escalations, slot.dose))
                  : confirmCycleDose(c, false, slot.scheduledAt, slot.dose, slot.scheduledAt, undefined, slot.key)}
              className={zweitKnopf}
            >
              {t('uebersprungen')}
            </button>

            {isInjectableMethod(c.method) && (
              <button
                type="button"
                tabIndex={offen ? undefined : -1}
                onClick={() => openInjectionTrackerForSlot(slot)}
                className={zweitKnopf}
              >
                <Syringe size={15} aria-hidden="true" />
                {t('due_confirm_with_injection', { defaultValue: 'Mit Injektion tracken' })}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderConfirmedLog = (log: DoseLog) => (
    <div key={log.id} className={`px-3 py-2.5 border rounded-xl transition-colors ${
      log.taken === true
        ? 'bg-emerald-500/5 border-emerald-500/20'
        : log.taken === false
          ? 'bg-red-500/5 border-red-500/20'
          : 'bg-sky-500/5 border-sky-500/15'
    }`}>
      <div className="flex items-center gap-3">
        <Syringe size={14} className={`shrink-0 ${
          log.taken === true ? 'text-emerald-400' :
          log.taken === false ? 'text-red-400' : 'text-sky-400'
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white text-sm">{log.stack_items?.display_name ?? t('geloeschte_substanz')}</span>
            <span className={`text-xs font-semibold ${
              log.taken === true ? 'text-emerald-400' :
              log.taken === false ? 'text-red-400' : 'text-sky-400'
            }`}>{formatTrackedQuantity(log.dose, log.unit, String(t('quantity_not_tracked', { defaultValue: 'Menge nicht getrackt' })))}</span>
            <span className="text-slate-500 text-xs">{log.method}</span>
            {log.taken === true && (
              <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-medium">
                <Check size={11} /> {t('eingenommen')}
              </span>
            )}
            {log.taken === false && (
              <span className="flex items-center gap-0.5 text-red-400 text-xs font-medium">
                <XCircle size={11} /> {log.notes === AUTO_MISSED_NOTE
                  ? t('verpasst', { defaultValue: 'Verpasst' })
                  : t('uebersprungen')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-slate-500 text-xs">{timeLabel(log.logged_at, t)}</span>
            {log.notes && log.notes !== AUTO_MISSED_NOTE && <span className="text-slate-600 text-xs truncate">· {log.notes}</span>}
          </div>
        </div>
        {(!FEATURES.planTimelineV2 || log.taken === null) && <button aria-label={t('eintrag_loeschen')} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors shrink-0"
          onClick={() => deleteLog(log)}>
          <X size={13} />
        </button>}
      </div>

      {log.taken === null && (
        <div className="flex gap-2 mt-2 ml-[26px]">
          <button
            onClick={() => openConfirmSheet(undefined, log)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors">
            <Check size={11} /> {t('eingenommen')}
          </button>
          <button
            onClick={() => confirmDose(log, false)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors">
            <XCircle size={11} /> {t('uebersprungen')}
          </button>
        </div>
      )}

      {/* Eine entschiedene Einnahme laesst sich wieder oeffnen.
          NUR oeffnen — nicht an Ort und Stelle umschreiben: unter
          `planTimelineV2` laeuft jede Entscheidung ueber
          `confirm_intake_group`, das Herkunft und Lebenszyklus prueft. Ein
          direktes „doch eingenommen" umginge diese Pruefung.
          `reverse_inventory_confirmation('undo')` setzt `taken` auf null und
          bucht den Bestand in einer Transaktion zurueck; Zyklus, Planversion,
          Slot-Schluessel und Menge bleiben unberuehrt. Damit steht die Zeile
          wieder genau so da, wie die RPC eine offene Einnahme erwartet — und
          sie taucht oben wieder als faellig auf. */}
      {log.taken !== null && kannWiederGeoeffnetWerden(log) && (
        <div className="flex gap-2 mt-2 ml-[26px]">
          {!FEATURES.planTimelineV2 && log.taken === false && (
            <button
              onClick={() => openConfirmSheet(undefined, log)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors">
              <Check size={11} /> {t('dose_mark_taken', { defaultValue: 'Doch eingenommen' })}
            </button>
          )}
          <button
            type="button"
            onClick={() => undoDose(log)}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-600/50 bg-slate-700/60 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
            <RotateCcw size={12} aria-hidden="true" /> {t('dose_reopen', { defaultValue: 'Wieder öffnen' })}
          </button>
        </div>
      )}

      {log.taken === false && (
        <div className="mt-2 ml-[26px]">
          <p className="text-slate-500 text-xs mb-1.5 flex items-center gap-1">
            <Bell size={10} /> {t('erinnere_nochmal')}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {[15, 30, 60, 120].map(min => (
              <button
                key={min}
                onClick={() => snoozeDose(log, min)}
                className="text-xs px-2 py-0.5 rounded-lg bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-600/60 transition-colors">
                {min < 60 ? `${min} min` : `${min / 60} h`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
    <PageShell>
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="shrink-0 text-sky-400" />
        <h2 className="font-semibold text-white">{t('nav_kalender')}</h2>
      </div>

      {inventoryRetryIds.length > 0 && (
        <div role="alert" className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm font-bold text-amber-200">
          <p>{t('inventory_committed_retry', { defaultValue: 'Die Einnahme ist gespeichert, aber der Bestand wurde nicht aktualisiert.' })}</p>
          <button
            type="button"
            onClick={() => void Promise.all(inventoryRetryIds.map(id => applyGenericInventory(id)))}
            className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/15 px-3 text-sm font-black text-amber-100 transition-colors hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <RotateCcw size={15} aria-hidden="true" /> {t('inventory_retry', { defaultValue: 'Bestand erneut versuchen' })}
          </button>
        </div>
      )}

      {/* ── Kalender ──────────────────────────────────────────────────────── */}
      <div data-ob="calendar-main" data-ob-self>
        {/* Der Streifen traegt keinen eigenen Rahmen mehr. Er ist Navigation,
            nicht Inhalt — der Tag darunter ist der Inhalt. */}
        <div className="flex flex-col gap-2">

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => changeWeek(-1)}
                aria-label={t('prev_week', { defaultValue: 'Vorherige Woche' })}
                className="shrink-0 rounded-xl p-1.5 text-sky-400 transition-colors hover:bg-sky-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="truncate text-[15px] font-black tracking-[-0.03em] text-white">
                {weekTitle}
              </h2>
              <button
                type="button"
                onClick={() => changeWeek(1)}
                aria-label={t('next_week', { defaultValue: 'Nächste Woche' })}
                className="shrink-0 rounded-xl p-1.5 text-sky-400 transition-colors hover:bg-sky-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {/* „Heute" nur, wenn man nicht schon dort ist. Vorher stand der
                  Knopf zweimal auf der Seite, einmal hier und einmal im Tag. */}
              {!isTodaySelected && (
                <button
                  type="button"
                  className="rounded-xl border px-2.5 py-1.5 text-xs font-bold text-sky-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  onClick={() => { setSelectedDay(new Date()); setCurrentDate(new Date()) }}
                  style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-weak)' }}
                >
                  {t('heute_link')}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCurrentDate(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1))
                  setMonatOffen(true)
                }}
                ref={monatsKnopf}
                aria-label={t('calendar_open_month', { defaultValue: 'Monatsübersicht öffnen' })}
                aria-haspopup="dialog"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <CalendarDays size={17} />
              </button>
            </div>
          </div>

          <div
            className="relative overflow-hidden"
            style={{ touchAction: 'pan-y', cursor: isDragging ? 'grabbing' : 'default' }}
            onPointerDown={handleCalendarPointerDown}
            onPointerMove={handleCalendarPointerMove}
            onPointerUp={handleCalendarPointerUp}
            onPointerCancel={handleCalendarPointerCancel}
          >
            <div
              className="grid select-none grid-cols-7 gap-1"
              style={{
                // Wischt man IM Blatt, rutschte sonst der Streifen dahinter mit.
                transform: `translateX(${monatOffen ? 0 : calendarDragX}px)`,
                transition: isDragging && !monatOffen ? 'none' : 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
                willChange: 'transform',
              }}
            >
              {streifenTage.map((day, i) => renderDayCell({
                day, monatsBezug: selectedDay, key: i, mitWochentag: true,
              }))}
            </div>

            {peekDir !== 0 && !monatOffen && (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 grid select-none grid-cols-7 gap-1"
                style={{
                  transform: `translateX(calc(${peekDir === 1 ? '100%' : '-100%'} + ${calendarDragX}px))`,
                  transition: isDragging ? 'none' : 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
                  willChange: 'transform',
                }}
              >
                {peekCalendarDays.map((day, i) => renderDayCell({
                  day, monatsBezug: peekDate!, key: i, vorschau: true, mitWochentag: true,
                }))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Monatsblatt ───────────────────────────────────────────────────
          Der Monat bleibt ein vollwertiger Kalender — er ist nur nicht mehr
          das Erste, was man sieht. */}
      {monatOffen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setMonatOffen(false)}
            aria-hidden="true"
          />
          <div
            ref={monatsBlatt}
            role="dialog"
            aria-modal="true"
            aria-label={monthTitle}
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border border-b-0 px-4 pb-8 pt-3 focus:outline-none"
            style={{ borderColor: 'var(--accent-border)', background: 'var(--surface)', boxShadow: '0 -12px 48px rgba(0,0,0,0.8)' }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />

            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="truncate text-lg font-black tracking-[-0.03em] text-white">{monthTitle}</h2>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  aria-label={t('prev_month', { defaultValue: 'Vorheriger Monat' })}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-sky-400 transition-colors hover:bg-sky-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  aria-label={t('next_month', { defaultValue: 'Nächster Monat' })}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-sky-400 transition-colors hover:bg-sky-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setMonatOffen(false)}
                  data-app-back-close
                  aria-label={t('close', { defaultValue: 'Schließen' })}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7">
              {[t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat'), t('sun')].map(d => (
                <div key={d} className="pb-2 text-center text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-500">{d}</div>
              ))}
            </div>

            <div
              className="relative overflow-hidden"
              style={{ touchAction: 'pan-y' }}
              onPointerDown={handleCalendarPointerDown}
              onPointerMove={handleCalendarPointerMove}
              onPointerUp={handleCalendarPointerUp}
              onPointerCancel={handleCalendarPointerCancel}
            >
              <div
                className="grid select-none grid-cols-7 gap-1"
                style={{
                  transform: `translateX(${calendarDragX}px)`,
                  transition: isDragging ? 'none' : 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                {calendarDays.map((day, i) => renderDayCell({
                  day, monatsBezug: currentDate, key: i, ohneAnker: true,
                }))}
              </div>

              {peekDir !== 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 grid select-none grid-cols-7 gap-1"
                  style={{
                    transform: `translateX(calc(${peekDir === 1 ? '100%' : '-100%'} + ${calendarDragX}px))`,
                    transition: isDragging ? 'none' : 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  {peekCalendarDays.map((day, i) => renderDayCell({
                    day, monatsBezug: peekDate!, key: i, vorschau: true, ohneAnker: true,
                  }))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Tages-Panel ───────────────────────────────────────────────────── */}
      <div id="due-intakes">
      <GlassPanel accent="#00ccf5" padding="md">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardList size={17} color="#00ccf5" />
            <h2 className="text-base font-extrabold text-white leading-tight truncate">
              {selectedDayTitle}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 tabular-nums">
              {format(selectedDay, 'dd.MM.yyyy')}
            </span>
          </div>
        </div>

        {FEATURES.planTimelineV2 && !timelineReady && (
          <div role={timelineLoadState === 'error' ? 'alert' : 'status'} className="mb-3 text-sm text-slate-400">
            {timelineLoadState === 'error' ? <>
              <p>{t('my_stack_plan_load_error', { defaultValue: 'Die Einnahmepläne konnten nicht geladen werden. Deine übrigen Daten bleiben verfügbar.' })}</p>
              <button type="button" className="mt-2 min-h-11 text-sky-400" onClick={() => void loadLogs()}>
                {t('routine_confirmation_retry', { defaultValue: 'Erneut versuchen' })}
              </button>
            </> : t('loading', { defaultValue: 'Lädt…' })}
          </div>
        )}
        {FEATURES.planTimelineV2 && timelineReady && timezoneReviewStackItemIds.length > 0 && (
          <div role="alert" className="mb-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5 text-amber-100">
                  {t('my_stack_calendar_timezone_review', { defaultValue: 'Existing intake plans still need a time zone confirmation. They will not appear in the calendar until then.' })}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/my-stack?review=timezone&stackItem=${encodeURIComponent(timezoneReviewStackItemIds[0])}`)}
                  className="mt-2 min-h-11 cursor-pointer rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-200 transition-colors hover:bg-amber-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  {t('my_stack_calendar_timezone_review_action', { defaultValue: 'Confirm time zone in My Stack' })}
                </button>
              </div>
            </div>
          </div>
        )}
        {selectedPause && (
          <div className="mb-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.07] px-3 py-2.5">
            <p className="text-sm font-bold text-sky-200">
              <span>{t('my_stack_plan_status_paused', { defaultValue: 'Plan pausiert' })}</span>
              {selectedPauseRange && <span className="font-normal text-sky-300/70"> · {selectedPauseRange}</span>}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {t('my_stack_plan_pause_neutral', { defaultValue: 'Während der Pause ist keine Einnahme fällig.' })}
            </p>
          </div>
        )}

        {/* ── Die Bilanz eines vergangenen Tages ────────────────────────
            Kein Eintrag, sondern eine Auskunft ueber den Tag — deshalb steht
            sie ueber der Liste und nicht darin. */}
        {isPastSelected && dueSlots.length > 0 && (
          <div
            data-due-balance
            className="mb-3 rounded-2xl border p-4"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-xl font-black tracking-[-0.03em] text-white">
                {t('calendar_day_balance', {
                  defaultValue: '{{genommen}} von {{geplant}} bestätigt',
                  genommen: genommeneSlots, geplant: totalDaySlots,
                })}
              </h3>
              <span className="shrink-0 text-xs font-semibold text-slate-400 tabular-nums">
                {t('due_open_count', { defaultValue: '{{n}} offen', n: dueSlots.length })}
              </span>
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
              <span
                className="block h-full rounded-full bg-emerald-500"
                style={{ width: totalDaySlots > 0 ? `${Math.round((genommeneSlots / totalDaySlots) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        )}

        {/* Keine offenen Slots: den Tag nach bestätigten Einnahmen bewerten. */}
        {dueSlots.length === 0 && totalDaySlots > 0 && (!FEATURES.planTimelineV2 || timelineReady) && (
          <div
            data-due-receipt
            className="mb-3 flex flex-col items-center gap-2.5 rounded-2xl border p-6 text-center"
            style={incompletePastDay
              ? { borderColor: 'rgba(239,68,68,0.35)', background: 'linear-gradient(160deg, rgba(239,68,68,0.12), var(--surface) 62%)' }
              : { borderColor: 'rgba(16,185,129,0.24)', background: 'linear-gradient(160deg, rgba(16,185,129,0.10), var(--surface) 62%)' }}
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-full ${incompletePastDay ? 'bg-red-500/15' : 'bg-emerald-500/15'}`}>
              {incompletePastDay
                ? <X size={24} className="text-red-300" aria-hidden="true" />
                : <Check size={24} className="text-emerald-300" aria-hidden="true" />}
            </span>
            <h3 className="text-xl font-black tracking-[-0.035em] text-white">
              {incompletePastDay
                ? t('calendar_day_incomplete', { defaultValue: 'Dieser Tag ist nicht vollständig protokolliert.' })
                : genommeneSlots === totalDaySlots
                ? t('all_intakes_done', { defaultValue: 'Alle geplanten Einnahmen sind bestätigt.' })
                : t('all_intakes_logged', { defaultValue: 'Für diesen Tag ist alles protokolliert.' })}
            </h3>
            <p className="text-sm text-slate-400">
              {t('calendar_day_balance', {
                defaultValue: '{{genommen}} von {{geplant}} bestätigt',
                genommen: genommeneSlots, geplant: totalDaySlots,
              })}
            </p>
          </div>
        )}

        {/* ── Eigene Bündel ──────────────────────────────────────────────
            Selbst zusammengestellte Gruppen, mit einem Tipp bestaetigt. Sie
            stehen ueber der Tagesliste, weil sie sie abkuerzen. */}
        {(!FEATURES.planTimelineV2 || timelineReady) && (bundleRows.length > 0 || stackItems.length > 1) && (
          <section data-intake-bundles aria-labelledby="intake-bundles-title" className="mb-3 space-y-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <h3 id="intake-bundles-title" className="flex min-w-0 items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-sky-300">
                <Layers size={14} aria-hidden="true" />
                <span className="truncate">{t('bundle_section_title', { defaultValue: 'Meine Bündel' })}</span>
              </h3>
              <button
                type="button"
                onClick={() => setBundleSheet(null)}
                className="flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[11px] font-extrabold text-slate-200 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <Plus size={13} aria-hidden="true" />
                {t('bundle_new', { defaultValue: 'Bündel' })}
              </button>
            </div>
            {bundleRows.map(({ bundle, itemIds, open }) => {
              const busy = bundleBusyId === bundle.id
              const done = open.length === 0
              return (
                <div key={bundle.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    disabled={done || Boolean(bundleBusyId)}
                    aria-busy={busy || undefined}
                    onClick={() => void confirmBundle(bundle, open)}
                    className={`flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl border px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-default ${done
                      ? 'border-white/10 bg-white/[0.03]'
                      : 'border-emerald-500/30 bg-emerald-500/[0.12] hover:bg-emerald-500/20'}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${done ? 'bg-white/[0.06] text-slate-400' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      <Check size={17} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-white">{bundle.name}</span>
                      <span className={`block truncate text-xs font-semibold ${done ? 'text-slate-500' : 'text-emerald-300'}`}>
                        {itemIds.length === 0
                          ? t('bundle_no_items', { defaultValue: 'Keine Substanzen mehr im Bündel' })
                          : done
                          ? t('bundle_nothing_open', { defaultValue: 'Nichts offen' })
                          : busy
                          ? t('bundle_confirming', { defaultValue: 'Wird bestätigt …' })
                          : t('bundle_confirm_open', { defaultValue: '{{n}} bestätigen', n: open.length })}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={String(t('bundle_edit_label', { defaultValue: '{{name}} bearbeiten', name: bundle.name }))}
                    onClick={() => setBundleSheet(bundle)}
                    className="flex w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
            {bundleRows.length === 0 && (
              <p className="px-1 text-xs text-slate-400">
                {t('bundle_empty_hint', { defaultValue: 'Fasse Substanzen, die du zusammen nimmst, zu einem Bündel zusammen und bestätige sie mit einem Tipp.' })}
              </p>
            )}
          </section>
        )}

        {/* ── Die offenen Einnahmen ──────────────────────────────────────
            Eine Liste in Tagesordnung. Genau eine ist aufgeklappt — zuerst
            die naechste anstehende, danach die, die man antippt. Aufgeklappt
            wird AN ORT UND STELLE, damit nichts springt. */}
        {offeneGruppen.map(gruppe => (
          <div key={gruppe.key} className="mb-3 space-y-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="flex min-w-0 items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-sky-300">
                {(() => { const Ic = gruppe.icon; return <Ic size={14} aria-hidden="true" /> })()}
                <span className="truncate">{gruppe.label}</span>
              </p>
              {/* Ab zwei Einnahmen im selben Zeitfenster lohnt der Sammelweg:
                  sonst druecke man denselben Knopf zehnmal. */}
              {gruppe.slots.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    routineCommitted.current = false
                    if (gruppe.routineGroup) setRoutineGroupSheet(gruppe.routineGroup)
                  }}
                  className="flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.12] px-3 text-[11px] font-extrabold text-emerald-300 transition-colors hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <Check size={13} aria-hidden="true" />
                  {t('routine_confirmation_confirm_all', { defaultValue: 'Alle als eingenommen markieren' })}
                </button>
              )}
            </div>
            {gruppe.slots.map(slot => renderEinnahme(slot, gruppe, slot.key === offenerSlot))}
          </div>
        ))}

        {/* Bestätigte und nicht bestätigte Einnahmen getrennt ausklappen. */}
        {loggedLogs.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setCompletedExpanded(expanded => !expanded)}
              aria-expanded={completedExpanded}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5 text-left transition-colors hover:bg-emerald-500/10"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-300/80">
                  {t('completed_intakes_title', { defaultValue: 'Bereits protokolliert' })}
                </p>
                <p className="text-xs text-slate-500">
                  {t('completed_intakes_hint', { defaultValue: 'Bestätigte Einnahmen.' })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300">
                  {loggedLogs.length}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-emerald-300/80 transition-transform duration-200 ${completedExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </button>
            {completedExpanded && (
              <div className="space-y-2">
                {loggedLogs.map(log => renderConfirmedLog(log))}
              </div>
            )}
          </div>
        )}
        {unloggedLogs.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setUnloggedExpanded(expanded => !expanded)}
              aria-expanded={unloggedExpanded}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-left transition-colors hover:bg-red-500/10"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-red-300/80">
                  {t('unlogged_intakes_title', { defaultValue: 'Nicht protokolliert' })}
                </p>
                <p className="text-xs text-slate-500">
                  {t('unlogged_intakes_hint', { defaultValue: 'Übersprungene und verpasste Einnahmen.' })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-bold text-red-300">
                  {unloggedLogs.length}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-red-300/80 transition-transform duration-200 ${unloggedExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </button>
            {unloggedExpanded && (
              <div className="space-y-2">
                {unloggedLogs.map(log => renderConfirmedLog(log))}
              </div>
            )}
          </div>
        )}
        {loggedLogs.length === 0 && unloggedLogs.length === 0 && dueSlots.length === 0 && selCycles.length === 0 && selOnDemand.length === 0 && !selectedPause
          && timezoneReviewStackItemIds.length === 0 && (!FEATURES.planTimelineV2 || timelineReady) ? (
          <p className="text-slate-600 text-sm text-center py-4">
            {isTodaySelected ? t('noch_nichts_heute') : t('kein_eintrag_tag')}
          </p>
        ) : null}

        {/* Was bei Bedarf genommen wird, steht unter dem Plan, nicht darin:
            nichts davon ist faellig, es gibt nichts abzuhaken. Der Knopf traegt
            eine Einnahme ein, die stattgefunden hat. */}
        {selOnDemand.length > 0 && (
          <div data-on-demand-section className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {t('freq_bei_bedarf', { defaultValue: 'Bei Bedarf' })}
            </p>
            {selOnDemand.map(cycle => {
              const bereits = selLogs.filter(
                log => log.stack_item_id === cycle.stack_item_id && log.taken === true,
              ).length
              return (
                <div
                  key={cycle.id}
                  data-on-demand-cycle={cycle.id}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">
                    {cycle.stack_items?.display_name ?? cycle.name}
                    {bereits > 0 && (
                      <span data-on-demand-count className="ml-2 text-xs font-normal text-slate-400">
                        {`×${bereits}`}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => FEATURES.planTimelineV2
                      ? openConfirmSheet(cycle, undefined, format(new Date(), 'HH:mm'))
                      : void confirmCycleDose(cycle, true, new Date().toISOString())}
                    className="min-h-11 shrink-0 cursor-pointer rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-2 text-sm font-semibold text-emerald-200 transition-colors duration-200 hover:bg-emerald-400/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 motion-reduce:transition-none"
                  >
                    {t('eingenommen', { defaultValue: 'Eingenommen' })}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </GlassPanel>
      </div>

    </PageShell>

      {routineGroupSheet && (
        <RoutineConfirmationSheet
          group={routineGroupSheet}
          onClose={() => setRoutineGroupSheet(null)}
          onConfirm={confirmRoutineGroup}
          onAfterConfirm={afterRoutineGroupConfirmed}
          onAddInjection={openRoutineInjection}
        />
      )}

      {bundleSheet !== undefined && (
        <IntakeBundleSheet
          bundle={bundleSheet}
          stackItems={stackItems}
          onClose={() => setBundleSheet(undefined)}
          onSave={saveBundle}
          onDelete={bundleSheet ? removeBundle : undefined}
        />
      )}

      {/* ── Einnahme-Zeitpunkt-Sheet ──────────────────────────────────────── */}
      {confirmSheet && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setConfirmSheet(null)} />
          <div
            data-app-modal
            data-app-back-dirty-on-interaction
            role="dialog"
            aria-modal="true"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border border-white/10 pb-10"
            style={{ background: 'var(--surface)' }}
          >
            <div style={{ padding: '20px 18px 0' }}>
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
              <div className="flex items-center gap-2 mb-1">
                <Check size={15} className="text-emerald-400" />
                <h2 className="text-base font-black text-white">{t('confirm_sheet_title', { defaultValue: 'Einnahme bestätigen' })}</h2>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                {t('confirm_sheet_hint', { defaultValue: 'Wann hast du tatsächlich eingenommen? Vorausgefüllt mit der geplanten Zykluszeit.' })}
              </p>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-500">
                  {t('confirm_sheet_time_label', { defaultValue: 'Uhrzeit' })}
                </label>
                <button
                  type="button"
                  onClick={() => setConfirmTime(format(new Date(), 'HH:mm'))}
                  className="flex items-center gap-1.5 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[0.65rem] font-bold text-sky-400 transition-colors hover:bg-sky-500/20"
                >
                  <Clock size={11} />
                  {t('confirm_time_now', { defaultValue: 'Jetzt' })}
                </button>
              </div>
              <input
                type="time"
                value={confirmTime}
                onChange={e => setConfirmTime(e.target.value)}
                className={`w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white outline-none focus:border-sky-500/50 transition-colors ${confirmUnit != null ? 'mb-4' : 'mb-5'}`}
                style={{ background: 'var(--surface-input)', colorScheme: 'dark' }}
              />
              {confirmUnit != null && (
                <>
                  {/* Dieselbe Menge, dieselbe Uhrzeit, dasselbe Sheet -- vorher
                      brauchte eine Aenderung an beidem zwei separate Wege:
                      „Eingenommen" fuer die Uhrzeit, „Einmalige
                      Dosisaenderung" fuer die Menge, mit dem groesseren
                      Gruppen-Sheet dahinter. */}
                  <label className="mb-2 block text-[0.6rem] font-bold uppercase tracking-widest text-slate-500">
                    {t('confirm_sheet_dose_label', { defaultValue: 'Menge' })}
                  </label>
                  <div className="mb-5 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      aria-label={String(t('confirm_sheet_dose_label', { defaultValue: 'Menge' }))}
                      value={confirmDoseText}
                      onChange={e => setConfirmDoseText(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white outline-none focus:border-sky-500/50 transition-colors"
                      style={{ background: 'var(--surface-input)', colorScheme: 'dark' }}
                    />
                    <span className="text-sm font-bold text-slate-300">{confirmUnit}</span>
                  </div>
                </>
              )}
              <div className="flex gap-3">
                <button onClick={() => setConfirmSheet(null)} data-app-back-close className="btn-secondary flex-1">
                  {t('cancel', { defaultValue: 'Abbrechen' })}
                </button>
                <button
                  onClick={() => { if (!confirmDoseUngueltig) void handleConfirmSheet() }}
                  {...denyProps(confirmDoseUngueltig)}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Check size={14} /> {t('eingenommen', { defaultValue: 'Eingenommen' })}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
