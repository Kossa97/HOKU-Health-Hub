// Typen und Hilfen der My-Stack-Seite — aus MyStackPage.tsx ausgelagert,
// damit die Seite selbst nur noch Zustand und Darstellung traegt.
import { type ReactNode } from 'react'
import { Sunrise, Sun, Moon, Clock, type LucideIcon } from 'lucide-react'
import { format, isValid, parseISO, addDays } from 'date-fns'
import { scheduleForDay, type ScheduleSegment } from '../../../lib/intakeSchedule'
import { expiryDaysLeft } from '../../../lib/peptideExpiry'
import { anbruchArt, behaelterGroesse, vialBuchtUeberBestand, vorratTeile } from '../lib/bestand'
import { getDosageForm } from '../lib/dosageForms'
import { type LoadedStackItem } from '../services/stackItems'
import type {
  IntakePlanDraft,
  IntakeSlotDraft,
  RoutineGroup,
  StackItem,
  SubstanceCatalogEntry,
} from '../types'
import { rhythmFromStorage } from '../lib/intakeRhythm'
import { versionRhythm } from '../lib/planCard'
import { type SortAbility } from '../lib/stackSort'
import {
  localDateTimeKey,
  type CyclePlanVersion,
  type PlanChangeKind,
  type CycleTimeline,
  type PlanScheduleSnapshot,
} from '../../../lib/planTimeline'
import type { PlanChangeSubmission } from '../lib/wizardState'

export interface InventoryItem {
  id: string; user_id: string; name: string
  batch_number: string | null; batch_source: string | null; batch_file_url: string | null
  vials_count: number; vials_initial: number | null; mg_per_vial: number; created_at: string
  pk_profile_id: string | null
}
// ─── Peptid-Typen ─────────────────────────────────────────────────────────────
export interface Peptide extends StackItem {
  name: string; default_method: string
  vial_amount_mg: number | null; vial_amount_unit: string | null
  reconstitution_ml: number | null
  syringe_type: string | null; notes: string | null
  vials_in_stock: number | null; vials_initial: number | null
  reconstitution_date: string | null; expiry_days: number | null
  batch_number: string | null; batch_source: string | null; batch_file_url: string | null
  inventory_item_id: string | null
  pk_profile_id: string | null
  archived: boolean
  archived_at: string | null
}
export interface Cycle {
  id: string; stack_item_id: string; name: string
  dose: number | null; unit: string | null; method: string
  frequency: string; x_days_interval: number | null
  schedule_days: string[] | null
  start_date: string; end_date: string | null; active: boolean
  intake_time: string | null; intake_time_custom: string | null
  schedule_history: ScheduleSegment[] | null
  reminder: string | null
  created_at: string
}
export interface Escalation {
  id: string; cycle_id: string
  increase_amount: number; unit: string
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string | null; start_after_days: number | null
  notes: string | null
}
export interface EscalationForm {
  increase_amount: string; unit: string
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string; start_after_days: string; notes: string
}
export const emptyEscalationForm = (unit: string): EscalationForm => ({
  increase_amount: '', unit,
  start_type: 'after_weeks', start_date: format(new Date(), 'yyyy-MM-dd'),
  start_after_days: '2', notes: '',
})

export type InfoRow = {
  label: string
  value?: string
  valueNode?: ReactNode
  wide?: boolean
}
// ─── Konstanten ───────────────────────────────────────────────────────────────
export const UNITS   = ['mcg','mg','IU','ml','nmol']

export type PeptideSortKey =
  | 'active_name'
  | 'created_desc' | 'created_asc'
  | 'name_asc' | 'name_desc'
  | 'expiry_asc' | 'expiry_desc'
  | 'fill_asc' | 'fill_desc'
  | 'recon_asc' | 'recon_desc'
  | 'stock_asc' | 'stock_desc'

export const MY_STACK_DETAIL_HISTORY_KEY = 'myStackDetailId'

export function historyStateRecord(state: unknown): Record<string, unknown> {
  return state !== null && typeof state === 'object' && !Array.isArray(state)
    ? state as Record<string, unknown>
    : {}
}

// Jede Gruppe sagt, welche Angabe sie braucht. Fehlt sie im offenen Reiter,
// wird die Gruppe nicht angeboten — eine Sortierung, die nichts bewegt, sieht
// aus wie ein Fehler.
export const PEPTIDE_SORT_GROUPS: { labelKey: string; options: PeptideSortKey[]; needs?: SortAbility }[] = [
  { labelKey: 'my_stack_sort_group_created', options: ['created_desc', 'created_asc'] },
  { labelKey: 'sort_group_name', options: ['name_asc', 'name_desc'] },
  { labelKey: 'sort_group_expiry', options: ['expiry_asc', 'expiry_desc'], needs: 'expiry' },
  { labelKey: 'sort_group_fill', options: ['fill_asc', 'fill_desc'], needs: 'fill' },
  { labelKey: 'sort_group_recon', options: ['recon_asc', 'recon_desc'], needs: 'recon' },
  { labelKey: 'sort_group_stock', options: ['stock_asc', 'stock_desc'], needs: 'stock' },
]

export const SORT_OPTION_LABEL_KEYS: Record<PeptideSortKey, string> = {
  active_name: 'sort_option_active_name',
  created_desc: 'my_stack_sort_created_desc',
  created_asc: 'my_stack_sort_created_asc',
  name_asc: 'sort_option_name_asc',
  name_desc: 'sort_option_name_desc',
  expiry_asc: 'sort_option_expiry_asc',
  expiry_desc: 'sort_option_expiry_desc',
  fill_asc: 'sort_option_fill_asc',
  fill_desc: 'sort_option_fill_desc',
  recon_asc: 'sort_option_recon_asc',
  recon_desc: 'sort_option_recon_desc',
  stock_asc: 'sort_option_stock_asc',
  stock_desc: 'sort_option_stock_desc',
}

export const NO_TIMELINES: CycleTimeline[] = []
export const vialCarouselItemWidth = 'min(17rem, 70vw)'
/** Der Platz der „Neu"-Kachel im Karussell, vor der ersten Substanz. */
export const ADD_SLOT = -1
export const vialCarouselItemGap = '0.75rem'

export function asPeptide(item: LoadedStackItem): Peptide {
  const legacy = item as LoadedStackItem & Partial<Peptide>
  const peptide: Peptide = {
    ...legacy,
    name: item.display_name,
    // Keine erfundene Methode: leer heisst „nicht gesetzt", nicht „Andere".
    default_method: legacy.default_method ?? '',
    vial_amount_mg: legacy.vial_amount_mg ?? null,
    vial_amount_unit: legacy.vial_amount_unit ?? null,
    reconstitution_ml: legacy.reconstitution_ml ?? null,
    syringe_type: legacy.syringe_type ?? null,
    vials_in_stock: legacy.vials_in_stock ?? null,
    vials_initial: legacy.vials_initial ?? null,
    reconstitution_date: legacy.reconstitution_date ?? null,
    expiry_days: legacy.expiry_days ?? null,
    batch_number: legacy.batch_number ?? null,
    batch_source: legacy.batch_source ?? null,
    batch_file_url: legacy.batch_file_url ?? null,
    inventory_item_id: legacy.inventory_item_id ?? null,
    pk_profile_id: legacy.pk_profile_id ?? null,
  }
  return withVialInventory(peptide)
}

/**
 * Fuehrt ein Vial seinen Bestand im neuen Modell (`stack_item_inventory` in
 * Vials), sind die Altspalten eingefroren: die Datenbank bucht nur noch dort
 * ab. Liste, Vial-Grafik, Sortierung und Haltbarkeitshinweis lesen weiter die
 * Altnamen — hier bekommen sie die Werte aus dem Bestand.
 *
 * `vials_in_stock` zaehlt dann ALLE Vials (der Nachkommateil ist das
 * angemischte), `vials_initial` die Packungsgroesse; `getVialFillPct` rechnet
 * damit wie bisher. Die Lager-Verknuepfung (`inventory_items`) entfaellt —
 * ihre ungeoeffneten Vials stecken im Bestand.
 */
function withVialInventory(p: Peptide): Peptide {
  const inv = p.inventory
  if (anbruchArt(p.dosage_form) !== 'vial' || !inv || !vialBuchtUeberBestand(inv, p.ingredients)) return p
  return {
    ...p,
    vials_in_stock: inv.enabled ? inv.remaining_quantity : null,
    vials_initial: inv.enabled ? inv.package_quantity : null,
    reconstitution_date: inv.opened_at ?? null,
    expiry_days: inv.use_within_days ?? null,
    reconstitution_ml: inv.reconstitution_ml ?? p.reconstitution_ml,
    batch_number: inv.batch_number,
    batch_source: inv.batch_source ?? null,
    batch_file_url: inv.batch_file_url ?? null,
    inventory_item_id: null,
  }
}


/** Rest im aktuellen Vial in % — gleiche Logik wie die Vial-Anzeige in der Liste. */
export function getVialFillPct(p: Peptide): number | null {
  const stock = p.vials_in_stock ?? 0
  if ((p.vials_initial ?? 0) <= 0 && stock <= 0) return null
  if (stock <= 0) return 0
  return stock % 1 === 0 ? 100 : (stock % 1) * 100
}

/**
 * Wie voll der angebrochene Behaelter ist, 0–100 — oder null, wenn das nichts
 * aussagt. Beim Vial wie bisher; bei Spray, Nasenspray und Tropfflasche aus
 * dem gefuehrten Bestand: der geoeffnete Behaelter, sonst ein voller (bzw.
 * was vom letzten noch da ist), leer bei 0.
 */
export function fuellstandFuer(p: Peptide): number | null {
  // Ob die Grafik einen Pegel hat, sagt die Form selbst (`hasMeaningfulFill`).
  if (!getDosageForm(p.dosage_form).stageForm?.hasMeaningfulFill) return null
  if (anbruchArt(p.dosage_form) === 'vial') return getVialFillPct(p)
  const inventory = p.inventory
  const groesse = inventory?.enabled ? behaelterGroesse(inventory) : null
  if (!inventory || !groesse) return null
  const teile = vorratTeile(inventory)
  if (teile.rest <= 0) return 0
  if (teile.angebrochenAnteil != null) return teile.angebrochenAnteil * 100
  return Math.min(1, teile.rest / groesse) * 100
}

/** Ob unter dem Objekt auf der Buehne ein Fuellstand steht: mit Pegel, und beim Vial immer. */
export function zeigtPegel(p: Peptide): boolean {
  return fuellstandFuer(p) !== null || anbruchArt(p.dosage_form) === 'vial'
}

function compareNullableNum(a: number | null | undefined, b: number | null | undefined, asc: boolean): number {
  const av = a ?? null
  const bv = b ?? null
  if (av === null && bv === null) return 0
  if (av === null) return 1
  if (bv === null) return -1
  const diff = av - bv
  return asc ? diff : -diff
}

function compareNullableDate(a: string | null | undefined, b: string | null | undefined, asc: boolean): number {
  const av = a || null
  const bv = b || null
  if (!av && !bv) return 0
  if (!av) return 1
  if (!bv) return -1
  const diff = av.localeCompare(bv)
  return asc ? diff : -diff
}

export function sortPeptides(list: Peptide[], sortBy: PeptideSortKey, activeIds: Set<string>): Peptide[] {
  return [...list].sort((a, b) => {
    switch (sortBy) {
      case 'active_name': {
        // Default order: active peptides first (alphabetically), then inactive ones (alphabetically).
        const rank = (p: Peptide) => (activeIds.has(p.id) ? 0 : 1)
        return rank(a) - rank(b) || a.name.localeCompare(b.name)
      }
      // `created_at` kann bei alten Zeilen fehlen — dann hinten einsortieren,
      // statt die ganze Liste durcheinanderzubringen.
      case 'created_desc': return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      case 'created_asc': return (a.created_at ?? '').localeCompare(b.created_at ?? '')
      case 'name_asc': return a.name.localeCompare(b.name)
      case 'name_desc': return b.name.localeCompare(a.name)
      case 'expiry_asc': return compareNullableNum(expiryDaysLeft(a), expiryDaysLeft(b), true)
      case 'expiry_desc': return compareNullableNum(expiryDaysLeft(a), expiryDaysLeft(b), false)
      case 'fill_asc': return compareNullableNum(fuellstandFuer(a), fuellstandFuer(b), true)
      case 'fill_desc': return compareNullableNum(fuellstandFuer(a), fuellstandFuer(b), false)
      case 'recon_asc': return compareNullableDate(a.reconstitution_date, b.reconstitution_date, true)
      case 'recon_desc': return compareNullableDate(a.reconstitution_date, b.reconstitution_date, false)
      case 'stock_asc': return compareNullableNum(a.vials_in_stock, b.vials_in_stock, true)
      case 'stock_desc': return compareNullableNum(a.vials_in_stock, b.vials_in_stock, false)
      default: return 0
    }
  })
}

export const FREQ_KEYS: Record<string,string> = {
  'Täglich':'freq_taeglich','2x täglich':'freq_2x','3x täglich':'freq_3x',
  'Jeden 2. Tag':'freq_jeden2',
  '5 Tage an / 2 aus':'freq_5an2aus','Mo-Fr':'freq_mofr','Wöchentlich':'freq_woechentlich',
  'Alle X Tage':'freq_alle_x','Wochentage wählen':'freq_wochentage',
  'Bei Bedarf':'freq_bei_bedarf',
}
export const INTAKE_TIME_CONFIG = {
  morgens: { labelKey: 'morgens', icon: Sunrise },
  mittags: { labelKey: 'mittags', icon: Sun },
  abends:  { labelKey: 'abends',  icon: Moon },
  custom:  { labelKey: 'uhrzeit_label', icon: Clock },
} as const
const ROUTINE_GROUP_TO_INTAKE_TIME = {
  morning: 'morgens',
  midday: 'mittags',
  evening: 'abends',
} as const
const INTAKE_TIME_TO_ROUTINE_GROUP: Record<string, RoutineGroup> = Object.fromEntries(
  Object.entries(ROUTINE_GROUP_TO_INTAKE_TIME).map(([group, intakeTime]) => [intakeTime, group]),
) as Record<string, RoutineGroup>
export const REMINDER_OPTIONS = [
  { value: '1day',    labelKey: 'reminder_1day' },
  { value: '2h',      labelKey: 'reminder_2h' },
  { value: 'on_time', labelKey: 'reminder_on_time' },
]

/**
 * Was die Zyklus-Ansichten der Seite (Listenkarte, Zyklus-Verwaltung) zum
 * Anzeigen und Bearbeiten eines Zyklus brauchen — einmal in der Seite gebaut
 * und als ein Buendel gereicht statt als zwei Dutzend Einzel-Props.
 */
export interface CycleView {
  cyclesOf: (pid: string) => Cycle[]
  escalationsOf: (cid: string) => Escalation[]
  openNewCycle: (p: Peptide) => void
  dismissZyklusBtn: () => void
  openEditCycle: (p: Peptide, cycleId: string, versionId?: string, changeKind?: Exclude<PlanChangeKind, 'initial'>) => void
  removeCycle: (id: string) => Promise<void>
  toggleCycleActive: (c: Cycle) => Promise<void>
  endCycle: (c: Cycle) => Promise<void>
  currentQuantityLabel: (c: Cycle, day?: Date) => string
  scheduledQuantityLabel: (c: Cycle, day: Date) => string
  freqLabel: (c: Cycle) => string
  intakeLabel: (c: Cycle) => string | null
  reminderLabel: (c: Cycle) => string | null
  plannedQuantityRows: (c: Cycle) => ReactNode
  planStufenListe: (c: Cycle) => ReactNode
  doseAdjustmentIcon: (c: Cycle, e: Escalation) => LucideIcon
  escalationQuantityLabel: (c: Cycle, e: Escalation) => string
  escalationIsActive: (c: Cycle, e: Escalation) => boolean
  escLabel: (e: Escalation) => string
  openEditEsc: (c: Cycle, e: Escalation) => void
  removeEsc: (id: string) => Promise<void>
  openNewEsc: (c: Cycle) => void
}

/**
 * Ein Merker im Browser-Speicher („nicht mehr fragen"). Ist der Speicher
 * gesperrt (privater Modus, blockierte Website-Daten), wirft schon das Lesen —
 * dann gilt der Merker als nicht gesetzt, und es wird eben wieder gefragt.
 */
export function readLocalFlag(key: string): boolean {
  try { return Boolean(localStorage.getItem(key)) } catch { return false }
}
export function writeLocalFlag(key: string): void {
  try { localStorage.setItem(key, '1') } catch { /* ohne Speicher: beim naechsten Mal wieder fragen */ }
}

/** Die Haltbarkeit als Text: noch n Tage, noch 1 Tag, heute, abgelaufen. */
export function expiryText(t: (key: string, options?: Record<string, unknown>) => string, days: number): string {
  if (days > 1) return t('haltbar_noch_n', { n: days })
  if (days === 1) return t('haltbar_noch_1')
  if (days === 0) return t('my_stack_expires_today')
  return t('abgelaufen_warn')
}

/**
 * Die Zeitleisten, die eine Substanz zeigt. Muss sie ueberprueft werden
 * (`needs_review`), nur die, um die es dabei geht: laufende, kuenftige und
 * solche mit offener Zeitzonen-Frage — nicht die laengst beendeten.
 */
export function presentedTimelines(p: Peptide, timelines: CycleTimeline[], now = new Date()): CycleTimeline[] {
  if (p.configuration_status !== 'needs_review') return timelines
  return timelines.filter(timeline => (
    timeline.cycle.timezone_review_required
    || timeline.cycle.ended_at === null
    || new Date(timeline.cycle.ended_at) > now
  ))
}

export function parseStoredDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = parseISO(value)
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value ? parsed : null
}

export function mergeCatalogEntries(
  current: SubstanceCatalogEntry[],
  additions: SubstanceCatalogEntry[],
): SubstanceCatalogEntry[] {
  const entriesById = new Map(current.map(entry => [entry.id, entry]))
  additions.forEach(entry => entriesById.set(entry.id, entry))
  return [...entriesById.values()]
}

function escalationFormStartDate(cycle: Cycle, form: EscalationForm): Date | null {
  if (form.start_type === 'date') return parseStoredDay(form.start_date)
  const offset = Number(form.start_after_days)
  if (!Number.isFinite(offset) || !Number.isInteger(offset) || offset <= 0) return null
  return addDays(parseISO(cycle.start_date), offset * (form.start_type === 'after_weeks' ? 7 : 1))
}

export function withEffectiveEscalationUnit(cycle: Cycle, form: EscalationForm): EscalationForm {
  const start = escalationFormStartDate(cycle, form)
  return { ...form, unit: start ? scheduleForDay(cycle, start).unit ?? '' : '' }
}

export function cycleAsIntakePlanDraft(cycle: Cycle, day: Date): IntakePlanDraft {
  const segment = scheduleForDay(cycle, day)
  // Jeder Einnahmezeitpunkt, nicht nur der erste. Vorher nahm der Assistent
  // `…split(',').find(Boolean)` — beim Bearbeiten eines „2x taeglich"-Zyklus
  // fiel die zweite Einnahme damit still weg, und Speichern loeschte sie.
  const slotKeys = (segment.intake_time ?? '').split(',').map(key => key.trim()).filter(Boolean)
  const slotTimes = (segment.intake_time_custom ?? '').split(',').map(time => time.trim())
  // Die Mengen je Zeitpunkt. Steht dort nichts, gilt ueberall die eine Menge
  // des Zyklus — so war es bei jedem Plan vor dieser Runde.
  const slotDoses = (segment.slot_doses ?? '').split(',').map(wert => wert.trim())
  // Leer heisst „an jedem Tag" — so stand es in jedem Plan vor dieser Runde.
  const slotDays = (segment.slot_days ?? '').split(',')
  const slots: IntakeSlotDraft[] = slotKeys.map((key, index) => {
    const eigene = Number(slotDoses[index])
    return {
      routineGroup: INTAKE_TIME_TO_ROUTINE_GROUP[key] ?? 'morning',
      time: slotTimes[index] || null,
      dose: (slotDoses[index] ?? '') !== '' && Number.isFinite(eigene) ? eigene : segment.dose,
      weekdays: (slotDays[index] ?? '').split('|').map(tag => tag.trim()).filter(Boolean),
    }
  })
  return {
    id: cycle.id,
    name: cycle.name,
    unit: segment.unit,
    method: cycle.method,
    // Alte Frequenztexte werden auf die vier Formen abgebildet — „Wöchentlich"
    // ist ein Abstand von einer Woche, „Mo-Fr" sind fuenf Wochentage. Sie
    // bedeuten dasselbe, und ein bestehender Zyklus verliert beim Oeffnen
    // nichts. Die Tageszahl der alten „2x taeglich" steckt in den
    // Einnahmezeitpunkten, nicht im Rhythmus.
    rhythm: rhythmFromStorage(segment),
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: cycle.end_date,
    slots: slots.length > 0
      ? slots
      : [{ routineGroup: 'morning' as const, time: null, dose: segment.dose, weekdays: [] }],
    reminders: cycle.reminder && cycle.reminder !== 'none'
      ? cycle.reminder.split(',').filter(Boolean)
      : [],
  }
}

export interface RecoverableMutation {
  key: string
  committed: boolean
}

export function planChangeSubmissionIdentity(submission: PlanChangeSubmission): string {
  const { target, effective, snapshot } = submission
  return JSON.stringify({
    target: [target.mode, target.cycleId, target.versionId],
    effective: [effective.kind, effective.localDate],
    snapshot: [
      snapshot.frequency,
      snapshot.x_days_interval,
      snapshot.interval_unit,
      snapshot.cycle_on_days,
      snapshot.cycle_off_days,
      snapshot.schedule_days,
      snapshot.intake_time,
      snapshot.intake_time_custom,
      snapshot.slot_doses,
      snapshot.slot_days,
      snapshot.dose,
      snapshot.unit,
      snapshot.method,
    ],
    changeKind: submission.changeKind,
    timeZone: submission.timeZone,
  })
}

export function versionAsIntakePlanDraft(
  timeline: CycleTimeline,
  version: CyclePlanVersion,
  timeZone: string,
): IntakePlanDraft {
  const slotKeys = version.intake_time.split(',').map(key => key.trim()).filter(Boolean)
  const slotTimes = (version.intake_time_custom ?? '').split(',').map(time => time.trim())
  const slotDoses = (version.slot_doses ?? '').split(',').map(value => value.trim())
  const slotDays = (version.slot_days ?? '').split(',')
  const slots: IntakeSlotDraft[] = slotKeys.map((key, index) => {
    const ownDose = Number(slotDoses[index])
    return {
      routineGroup: INTAKE_TIME_TO_ROUTINE_GROUP[key] ?? 'morning',
      time: slotTimes[index] || null,
      dose: (slotDoses[index] ?? '') !== '' && Number.isFinite(ownDose) ? ownDose : version.dose,
      weekdays: (slotDays[index] ?? '').split('|').map(day => day.trim()).filter(Boolean),
    }
  })
  const startDate = version.effective_kind === 'local_date'
    ? version.effective_local_date ?? localDateTimeKey(new Date(timeline.cycle.started_at), timeZone).slice(0, 10)
    : localDateTimeKey(new Date(version.effective_at ?? timeline.cycle.started_at), timeZone).slice(0, 10)

  return {
    id: version.id,
    name: 'Einnahmeplan',
    unit: version.unit,
    method: version.method,
    rhythm: versionRhythm(version),
    startDate,
    endDate: timeline.cycle.ended_at
      ? localDateTimeKey(new Date(timeline.cycle.ended_at), timeZone).slice(0, 10)
      : null,
    slots: slots.length > 0
      ? slots
      : [{ routineGroup: 'morning', time: null, dose: version.dose, weekdays: [] }],
    reminders: [],
  }
}

export function versionSnapshot(version: CyclePlanVersion): PlanScheduleSnapshot {
  return {
    frequency: version.frequency,
    x_days_interval: version.x_days_interval,
    interval_unit: version.interval_unit,
    cycle_on_days: version.cycle_on_days,
    cycle_off_days: version.cycle_off_days,
    schedule_days: version.schedule_days,
    intake_time: version.intake_time,
    intake_time_custom: version.intake_time_custom,
    slot_doses: version.slot_doses,
    slot_days: version.slot_days,
    dose: version.dose,
    unit: version.unit,
    method: version.method,
  }
}
