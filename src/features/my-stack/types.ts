import type {
  PlanChangeKind,
  PlanEffectiveKind,
  PlanScheduleSnapshot,
} from '../../lib/planTimeline'

// `other` ist kein Fach, sondern das Eingestaendnis, dass keines passt.
// Es traegt deshalb auch keine Aussage: wo die Kategorie das Formular steuert
// (siehe `strengthShapeFor`), verhaelt es sich wie „noch nicht gewaehlt".
export type StackCategory =
  | 'peptide' | 'medication' | 'hormone' | 'supplement' | 'vitamin' | 'other'
export type ConfigurationStatus = 'complete' | 'needs_review'
export type TrackingLevel = 'intake_only' | 'with_amount' | 'complete'
export type RoutineGroup = 'morning' | 'midday' | 'evening'

export type DosageFormKey =
  | 'vial' | 'ampoule' | 'pen' | 'tablet' | 'capsule' | 'drops'
  | 'powder' | 'nasal_spray' | 'spray' | 'gel' | 'patch' | 'tube' | 'other'
// Womit EINE Einnahme gezaehlt wird — nicht, was im Schrank steht. Aus einer
// Ampulle und einem Vial wird mit der Spritze aufgezogen, ein Spray gibt
// Spruehstoesse ab, ein Gel wird angewendet. Der Schluessel wird gespeichert,
// das Wort dazu kommt aus der Uebersetzung (`my_stack_intake_unit_*`).
export type IntakeUnitKey =
  | 'syringe' | 'dose' | 'tablet' | 'capsule' | 'drop'
  | 'portion' | 'spray' | 'application' | 'patch' | 'unit'

// Wie die Staerke einer Form ueberhaupt zustande kommt. Der Schritt fragt
// ueberall dieselben zwei Zahlen ab (Wirkstoffmenge pro Produktmenge) — was
// sie BEDEUTEN, ist je Form verschieden:
//   per_unit      500 mg stecken in EINER Tablette. Die Produktmenge ist 1.
//   per_volume    250 mg auf 1 ml. Die Konzentration steht auf dem Etikett.
//   reconstituted 10 mg Pulver, aufgeloest in 2 ml — die Rekonstitution. Die
//                 zweite Zahl gibt der Nutzer erst beim Anmischen selbst.
//   per_mass      50 mg in 1 g Gel.
//   free          unbekannte Form, keine Annahme.
export type StrengthShape =
  | 'per_unit' | 'per_volume' | 'reconstituted' | 'per_mass' | 'free'

export type DosageFormCapability =
  | 'countable' | 'divisible' | 'liquid' | 'injectable' | 'reconstitutable'
  | 'concentration_based' | 'inventory_capable'

export interface SubstanceCatalogEntry {
  id: string
  canonical_name: string
  aliases: string[]
  default_category: StackCategory
  suggested_units: string[]
  suggested_dosage_forms: DosageFormKey[]
  pk_profile_id: string | null
  /** Eingebettet aus `pk_profiles`: fuer welche Routen das Profil gilt. */
  pk_profiles?: { routes?: string[] | null } | null
  active: boolean
  // Ein Kombipraeparat nennt hier die kanonischen Namen seiner Bestandteile —
  // „CJC-1295 ohne DAC + Ipamorelin" also die beiden Peptide. Leer oder
  // fehlend heisst: eine einzelne Substanz. Optional, weil aeltere Abfragen
  // (etwa der eingebettete Katalog an `stack_item_ingredients`) die Spalte
  // nicht mitlesen.
  component_names?: string[] | null
}

export interface StackItemIngredient {
  id?: string
  stack_item_id?: string
  catalog_substance_id: string | null
  custom_name: string
  amount_value: number | null
  amount_unit: string | null
  basis_value: number | null
  basis_unit: string | null
  position: number
}

export interface StackItemInventory {
  /** Fehlt nur in alten Testdaten; aus der Datenbank kommt sie immer. */
  id?: string
  enabled: boolean
  package_quantity: number | null
  package_unit: string | null
  remaining_quantity: number | null
  batch_number: string | null
  expires_at: string | null
  batch_source?: string | null
  batch_file_url?: string | null
  /** Angebrochener Behaelter: angemischt bzw. geoeffnet am (`YYYY-MM-DD`). */
  opened_at?: string | null
  /** Haltbar nach Anbruch, in Tagen. */
  use_within_days?: number | null
  /** Vial: die zugefuegte Fluessigkeit in ml. */
  reconstitution_ml?: number | null
}

export interface StackItem {
  id: string
  user_id: string
  display_name: string
  category: StackCategory
  dosage_form: DosageFormKey
  brand: string | null
  color_hex: string | null
  notes: string | null
  configuration_status: ConfigurationStatus
  archived: boolean
  tracking_level: TrackingLevel
  pk_profile_method: string | null
  archived_at: string | null
  /** Seit wann Dot die Einnahmen automatisch einträgt (Pro); null = aus. */
  auto_log_since?: string | null
  created_at: string
  updated_at: string
  ingredients: StackItemIngredient[]
  inventory?: StackItemInventory | null
}

export interface StackItemDraft {
  id?: string
  // Der Katalogeintrag, aus dem der Entwurf stammt. Bei einer EINZELNEN
  // Substanz steht dieselbe id auch an der ersten Zutat — bei einem
  // Kombipraeparat nicht: dort tragen die Zutaten die ids der BESTANDTEILE,
  // und ohne dieses Feld liesse sich nicht mehr sagen, was gewaehlt wurde.
  // Nur fuer das Formular; gespeichert wird es nicht.
  catalogEntryId?: string | null
  displayName: string
  category: StackCategory | null
  trackingLevel: TrackingLevel
  dosageForm: DosageFormKey | null
  brand: string
  colorHex: string
  notes: string
  ingredients: StackItemIngredient[]
}

// EIN Einnahmezeitpunkt des Tages. „2x taeglich" hat zwei davon.
//
// Die Auswerteseite konnte mehrere Zeitpunkte von Anfang an (`intake_time`
// haelt sie kommagetrennt, `resolveScheduleSlots` loest sie auf), der Entwurf
// trug aber nur einen — und beim Bearbeiten eines bestehenden Zyklus fiel
// jeder weitere still hinten runter.
export interface IntakeSlotDraft {
  routineGroup: RoutineGroup
  /** Genaue Uhrzeit, oder null fuer die Standardzeit der Tageszeit. */
  time: string | null
  /**
   * Die Menge DIESER Einnahme. „morgens 1000 mg, abends 500 mg" ist bei
   * Levothyroxin, Insulin und Metformin der Normalfall; eine Zahl fuer den
   * ganzen Tag konnte das nicht abbilden. Die Einheit gilt fuer alle
   * Zeitpunkte gemeinsam und steht am Plan.
   */
  dose: number | null
  /**
   * An welchen Wochentagen DIESER Zeitpunkt stattfindet. Leer heisst: an
   * jedem Tag, den der Rhythmus ohnehin auswaehlt — das ist der Normalfall.
   *
   * Damit laesst sich sagen, was vorher nicht ging: montags zweimal, mittwochs
   * einmal. Ein Zeitpunkt traegt seine Tage selbst, statt dass jeder Tag seine
   * Zeitpunkte auflistet — so steht „morgens" fuer Mo und Mi in EINER Zeile
   * und nicht zweimal.
   */
  weekdays: string[]
}

/**
 * An welchen TAGEN etwas ansteht. Vier Formen decken ab, was ein Kalender
 * hergibt — siehe `lib/intakeRhythm.ts`.
 */
export type IntakeRhythmKind = 'daily' | 'weekdays' | 'interval' | 'cycle' | 'on_demand'
export type IntervalUnit = 'day' | 'week' | 'month'

export interface IntakeRhythm {
  kind: IntakeRhythmKind
  /** kind 'interval': im Abstand von N Einheiten. */
  intervalValue: number | null
  intervalUnit: IntervalUnit
  /** kind 'cycle': X Tage an, Y Tage aus, dann von vorn. */
  onDays: number | null
  offDays: number | null
  /** kind 'weekdays': 'Mo' … 'So'. */
  weekdays: string[]
}

export interface IntakePlanDraft {
  id?: string
  name: string
  /** Die Einheit gilt fuer alle Zeitpunkte; die Menge steht je Zeitpunkt. */
  unit: string | null
  method: string
  /** An welchen Tagen. Ersetzt die frueheren Felder frequency/interval/days. */
  rhythm: IntakeRhythm
  startDate: string
  /** Leer heisst: laeuft weiter. Eine Antibiotikakur hat hier ein Datum. */
  endDate: string | null
  /** Ein Eintrag je Einnahmezeitpunkt; bei „Bei Bedarf" leer. */
  slots: IntakeSlotDraft[]
  reminders: string[]
}

export interface InventoryDraft {
  enabled: boolean
  packageQuantity: number | null
  packageUnit: string | null
  remainingQuantity: number | null
  brand: string
  batchNumber: string
  expiresAt: string | null
  // Nur beim Bearbeiten eines bestehenden Eintrags: die Angaben zur Packung,
  // die die Detailansicht bei „Substanz" und „Zusammensetzung" zeigt.
  batchSource?: string
  batchFileUrl?: string | null
  /** Ein gewaehltes, noch nicht hochgeladenes Analyse-Dokument — erst beim Speichern hoch. */
  batchFile?: File | null
  reconstitutionMl?: number | null
  openedAt?: string | null
  useWithinDays?: number | null
}

export interface StackItemSetupDraft extends StackItemDraft {
  plan: IntakePlanDraft
  inventory: InventoryDraft
  pkProfileMethod: string | null
}

interface PlanMutationInput {
  /** Bleibt fuer alle Wiederholungen derselben Nutzeraktion unveraendert. */
  idempotencyKey: string
}

type PlanVersionBoundaryInput =
  | {
      effectiveKind: Extract<PlanEffectiveKind, 'instant'>
      effectiveAt: string
      effectiveLocalDate: null
    }
  | {
      effectiveKind: Extract<PlanEffectiveKind, 'local_date'>
      effectiveAt: null
      effectiveLocalDate: string
    }

export type CreatePlanVersionInput = PlanMutationInput & PlanVersionBoundaryInput & {
  cycleId: string
  changeKind: PlanChangeKind
  schedule: PlanScheduleSnapshot
  timeZone?: string
  effectiveNow?: boolean
}

export type ReplacePlanVersionInput = PlanMutationInput & PlanVersionBoundaryInput & {
  versionId: string
  changeKind: PlanChangeKind
  schedule: PlanScheduleSnapshot
  timeZone: string
}

export interface RemovePlanVersionInput extends PlanMutationInput {
  versionId: string
  timeZone: string
}

export interface PauseCycleInput extends PlanMutationInput {
  cycleId: string
  endsAt: string | null
}

export interface SetPauseEndInput extends PlanMutationInput {
  pauseId: string
  endsAt: string
}

export interface ResumeCycleInput extends PlanMutationInput {
  cycleId: string
}

export interface EndCycleInput extends PlanMutationInput {
  cycleId: string
}

export interface RestartCycleInput extends PlanMutationInput {
  sourceCycleId: string
  startedAt: string
  timeZone: string
  initialSchedule: PlanScheduleSnapshot
}
