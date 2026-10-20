import type {
  DosageFormKey,
  IntakePlanDraft,
  IntakeSlotDraft,
  InventoryDraft,
  RoutineGroup,
  StackCategory,
  StackItem,
  StackItemDraft,
  StackItemIngredient,
  StackItemSetupDraft,
  SubstanceCatalogEntry,
  TrackingLevel,
} from '../types'
import type { PlanChangeKind, PlanScheduleSnapshot } from '../../../lib/planTimeline'
import { format } from 'date-fns'
import { buildDuplicateFingerprint } from './duplicateFingerprint'
import { powderVialIngredientsForEdit } from './vialStrength'
import {
  defaultIntakeUnitFor,
  defaultMethodFor,
  getIntakePlanUnitSuggestions,
  showsColor,
  strengthBasisDefault,
} from './dosageForms'
import { WEEKDAY_KEYS, emptyRhythm, isOnDemandRhythm } from './intakeRhythm'
import type { Kombinationsbestandteil } from './kombination'
import { trackingCapabilities } from './trackingDepth'
import { validateIntakePlan, validateStackItemDraft } from './validation'
import { sameSchedule, type LaterPlanStep } from './planAdoption'
import type { AltSpalten } from './produktAngaben'

export type WizardStep =
  | 'substance'
  | 'ingredients'
  | 'dosage_form'
  | 'color'
  | 'strength'
  | 'tracking_level'
  | 'plan'
  | 'review'

export type WizardSaveMode = 'create' | 'update' | 'duplicate'

export type PlanEditTarget =
  | { cycleId: string; versionId: null; mode: 'new_change' }
  | { cycleId: string; versionId: string; mode: 'replace_future' }

export interface PlanEffectiveDraft {
  kind: 'now' | 'date'
  localDate: string | null
}

export interface PlanEditContext {
  target: PlanEditTarget
  snapshot: IntakePlanDraft
  /**
   * Die Art, wenn sich nur Mengen aendern. Aendert sich mehr — Zeiten, Tage,
   * Rhythmus, Anwendung —, wird beim Speichern 'schedule' daraus
   * (`changeKindFor`).
   */
  changeKind: Exclude<PlanChangeKind, 'initial'>
  timeZone: string
  initialEffective?: PlanEffectiveDraft
  /**
   * Der Einstieg. 'add_step' ist dasselbe Formular wie 'adjust', nur mit
   * einem Tag hinter der letzten Stufe vorbelegt; 'edit_future' bearbeitet
   * eine geplante Stufe selbst.
   */
  purpose?: 'adjust' | 'add_step' | 'edit_future'
  minEffectiveDate?: string
  /** Letzter Tag, an dem eine Stufe noch beginnen kann (festes Zyklusende). */
  maxEffectiveDate?: string | null
  /**
   * Tage, an denen schon eine Stufe beginnt (ohne die gerade bearbeitete).
   * Eine zweite am selben Tag lehnt die Datenbank ab.
   */
  takenEffectiveDates?: string[]
  /**
   * Womit `changeKindFor` vergleicht: die Stufe DAVOR. Fehlt sie, der
   * Ausgangsstand des Editors (`snapshot`).
   */
  baseline?: IntakePlanDraft
  /**
   * Die geplanten Stufen dieses Zyklus. Liegen welche hinter dem gewaehlten
   * Tag, zeigt der Assistent sie vor dem Speichern zum Pruefen (siehe
   * `buildReview`).
   */
  laterSteps?: LaterPlanStep[]
  /** Der Plan, der jetzt gilt. Fehlt er, ist es `snapshot`. */
  current?: IntakePlanDraft
}

/** Was mit einer geplanten Stufe passiert, nachdem der Plan gespeichert ist. */
export type LaterStepChange =
  | { kind: 'remove'; versionId: string }
  | {
    kind: 'replace'
    versionId: string
    effectiveLocalDate: string
    schedule: PlanScheduleSnapshot
    changeKind: Exclude<PlanChangeKind, 'initial'>
  }

/**
 * Die Kennung einer Aenderung an einer geplanten Stufe — mit allem, was
 * gespeichert wird. Aendert man nach einem Fehler noch etwas, ist es eine
 * neue Aenderung mit neuem Schluessel, keine Wiederholung der alten.
 */
export function laterChangeIdentity(change: LaterStepChange): string {
  return change.kind === 'remove'
    ? `remove:${change.versionId}`
    : `replace:${change.versionId}:${change.effectiveLocalDate}:${change.changeKind}:${JSON.stringify(change.schedule)}`
}

// Alles am Plan ausser den Mengen (`SCHEDULE_FIELDS`). Aendert sich davon
// nichts, ist die Aenderung eine Dosisaenderung (oder Titrationsstufe), sonst
// eine Planaenderung.
export function changeKindFor(
  before: PlanScheduleSnapshot,
  after: PlanScheduleSnapshot,
  doseOnlyKind: Exclude<PlanChangeKind, 'initial'>,
): Exclude<PlanChangeKind, 'initial'> {
  return sameSchedule(before, after) ? doseOnlyKind : 'schedule'
}

export interface PlanChangeSubmission {
  target: PlanEditTarget
  snapshot: PlanScheduleSnapshot
  effective: PlanEffectiveDraft
  changeKind: Exclude<PlanChangeKind, 'initial'>
  timeZone: string
  /** Die geprueften geplanten Stufen — nur die, an denen sich etwas aendert. */
  laterChanges?: LaterStepChange[]
}

export interface WizardState {
  step: WizardStep
  draft: StackItemSetupDraft
  original: StackItem | null
  saveMode: WizardSaveMode
}

// Die Schrittliste folgt der Faehigkeiten-Tabelle, statt die Stufe noch
// einmal beim Namen zu nennen. Nur so bleibt eine Regel eine Regel: wer
// productStrength einer Stufe gibt, bekommt die Schritte dazu automatisch.
/**
 * Haengt JEDE Zutat an einer Katalogsubstanz?
 *
 * Gefragt wird die `catalog_substance_id` an der Zutat und nicht
 * `draft.catalogEntryId`: letzteres ist ausdruecklich nur fuer das Formular da
 * und wird nicht gespeichert (siehe `StackItemDraft`). Beim Bearbeiten eines
 * bestehenden Eintrags saehe sonst jeder Katalogeintrag wieder manuell aus.
 *
 * Ein Kombipraeparat, bei dem sich ein Bestandteil nicht aufloesen liess,
 * faellt hier durch — `bestandteileAufloesen` laesst ihn als benannte Zeile
 * ohne id stehen, und dann soll man ihn geradeziehen koennen.
 */
export function zutatenAusDemKatalog(ingredients: readonly StackItemIngredient[]): boolean {
  return ingredients.length > 0 && ingredients.every(zutat => Boolean(zutat.catalog_substance_id))
}

export function wizardSteps(state: WizardState): WizardStep[] {
  // Die Farbe wird ausschliesslich von der Buehnengrafik gezeigt. Pflaster
  // und Tube zeigen sie bewusst nicht (hautfarben, Aluminium), `other` hat gar
  // keine Grafik — dort ging die Wahl ins Leere: man zog an der Flaeche, und
  // nichts nahm die Farbe an. Ein Schritt, dessen Antwort nirgends ankommt,
  // wird nicht gestellt. Solange keine Form feststeht, bleibt er drin: er
  // kommt ohnehin erst nach dem Formschritt.
  const farbeZeigtSich = state.draft.dosageForm === null || showsColor(state.draft.dosageForm)
  const gemeinsam: WizardStep[] = farbeZeigtSich
    ? ['substance', 'dosage_form', 'color', 'tracking_level']
    : ['substance', 'dosage_form', 'tracking_level']

  // Frueher stand hier ein Sonderfall fuer „Tiefe noch nicht gewaehlt": dann
  // war die Schrittzahl offen. Seit der Entwurf mit „Gruendlich" startet,
  // steht immer eine Tiefe fest — und damit auch, welche Schritte folgen.
  const kann = trackingCapabilities(state.draft.trackingLevel)
  // Der Zutatenschritt fragt nur nach NAMEN — die Mengen stehen im Schritt
  // danach, und der zeigt ohnehin je Zutat eine eigene Karte mit ihrem Namen
  // als Ueberschrift. Haengt jede Zutat an einer Katalogsubstanz, sind die
  // Namen also schon entschieden: bei einem Kombipraeparat hat der
  // Katalogeintrag sie mitgebracht, bei einer einzelnen Substanz ist es der
  // Eintrag selbst. Dann bestaetigt der Schritt nur noch, was feststeht — und
  // die Pruefung dort kann gar nicht mehr ausschlagen (`validateIngredient`
  // verlangt einen Namen nur ohne Katalog-id).
  const wirkstoffSchritte: WizardStep[] = kann.productStrength
    ? (zutatenAusDemKatalog(state.draft.ingredients) ? ['strength'] : ['ingredients', 'strength'])
    : []

  return [...gemeinsam, ...wirkstoffSchritte, 'plan', 'review']
}

/** Abschnitte der Bearbeiten-Uebersicht. */
export type EditSectionId = 'substance' | 'form' | 'tracking' | 'composition' | 'product'

export interface EditSection {
  id: EditSectionId
  /** Die Schritte des Abschnitts, in Reihenfolge — nur die, die es gerade gibt. */
  steps: WizardStep[]
}

const EDIT_SECTION_STEPS: ReadonlyArray<readonly [EditSectionId, readonly WizardStep[]]> = [
  ['substance', ['substance']],
  ['form', ['dosage_form', 'color']],
  ['tracking', ['tracking_level']],
  ['composition', ['ingredients', 'strength']],
  ['product', ['plan']],
]

/**
 * „Bearbeiten" fuehrt nicht noch einmal durch alle Schritte, sondern zeigt
 * eine Uebersicht. Jede Zeile oeffnet einen Abschnitt aus einem oder zwei
 * Schritten; Farbe gehoert zur Form, die Zutaten zur Staerke. Ob es sie gibt,
 * haengt wie beim Anlegen an Form und Tracking-Tiefe.
 */
export function editSections(steps: readonly WizardStep[]): EditSection[] {
  return EDIT_SECTION_STEPS
    .map(([id, members]) => ({ id, steps: members.filter(step => steps.includes(step)) }))
    .filter(section => section.steps.length > 0)
}

type IngredientChanges = Partial<Omit<StackItemIngredient, 'position'>>

export type WizardAction =
  | { type: 'step_selected'; step: WizardStep }
  | {
      type: 'catalog_selected'
      entry: SubstanceCatalogEntry
      /**
       * Die aufgeloesten Bestandteile, wenn der Eintrag ein Kombipraeparat ist
       * (`bestandteileAufloesen`). Leer oder fehlend heisst: eine einzelne
       * Substanz, und es entsteht eine Zutat wie bisher.
       */
      components?: readonly Kombinationsbestandteil[]
    }
  | { type: 'custom_started'; name: string }
  | { type: 'catalog_detached' }
  | { type: 'display_name_changed'; displayName: string }
  | { type: 'category_selected'; category: StackCategory }
  | { type: 'ingredient_added' }
  | { type: 'ingredient_changed'; index: number; changes: IngredientChanges }
  | { type: 'ingredient_removed'; index: number }
  | {
      type: 'dosage_form_selected'
      dosageForm: DosageFormKey
      catalogSuggestedUnits?: readonly string[]
    }
  | { type: 'tracking_level_selected'; trackingLevel: TrackingLevel }
  | { type: 'details_changed'; changes: Partial<Pick<StackItemDraft, 'brand' | 'colorHex' | 'notes'>> }
  | { type: 'inventory_changed'; changes: Partial<InventoryDraft> }
  | { type: 'plan_changed'; changes: Partial<IntakePlanDraft> }
  /** Den ganzen Plan neu vorbelegen (Id des Zyklus bleibt). */
  | { type: 'plan_replaced'; plan: IntakePlanDraft }
  | { type: 'save_mode_selected'; mode: Extract<WizardSaveMode, 'update' | 'duplicate'> }
  /**
   * Leerer Entwurf, gleicher Schritt — vor einem Scan. Der Scan ersetzt den
   * Eintrag; Reste eines frueheren Scans (Marke, Form, Zeilen) blieben sonst
   * stehen und mischten zwei Produkte.
   */
  | { type: 'draft_restarted'; colorHex: string }

function emptyIngredient(position: number): StackItemIngredient {
  return {
    catalog_substance_id: null,
    custom_name: '',
    amount_value: null,
    amount_unit: null,
    basis_value: null,
    basis_unit: null,
    position,
  }
}

// Die Vorbelegung der Produktmenge kommt aus der Form (siehe
// `strengthBasisDefault`): eine Kapsel traegt ihre Staerke „pro 1 Kapsel", eine
// Ampulle „pro 1 ml" — beides steht so auf der Packung. Beim Pulver-Vial
// bleibt die Zahl leer, denn wie viel Loesungsmittel zugegeben wird,
// entscheidet der Nutzer beim Anmischen.
function basisVorbelegung(
  dosageForm: DosageFormKey | null,
  category: StackCategory | null,
): Pick<StackItemIngredient, 'basis_value' | 'basis_unit'> {
  if (!dosageForm) return { basis_value: null, basis_unit: null }
  const vorgabe = strengthBasisDefault(dosageForm, category)
  return { basis_value: vorgabe.value, basis_unit: vorgabe.unit }
}

/**
 * Die Einnahmezeitpunkte nach einem FREQUENZWECHSEL. Die Frequenz sagt nur,
 * an welchen Tagen etwas ansteht — wie oft am Tag, entscheidet der Nutzer
 * daneben. Deshalb wird hier nichts abgeschnitten: „Bei Bedarf" laesst keinen
 * Zeitpunkt uebrig, jede geplante Frequenz mindestens einen, und die alten
 * Tagesfrequenzen („2x taeglich") bringen ihre Zahl noch mit, damit ein
 * bestehender Zyklus beim Laden nicht die Haelfte verliert.
 */
function slotsFuerRhythmus(plan: IntakePlanDraft): IntakeSlotDraft[] {
  // Auch „Bei Bedarf" behaelt EINEN Zeitpunkt: er traegt die Menge, die man
  // eintraegt, wenn man das Mittel genommen hat. Tageszeit und Uhrzeit
  // bedeuten dort nichts und werden nicht gezeigt.
  if (isOnDemandRhythm(plan.rhythm)) {
    const erster = plan.slots[0]
    return [erster ? { ...erster, weekdays: [] } : naechsterSlot([])]
  }

  // Bei „Wochentage waehlen" gehoert jeder Zeitpunkt GENAU EINEM Tag. Das ist
  // die Form, in der das Formular ihn zeigt — ein Reiter je Tag —, und die
  // Form, in der `slot_days` ihn speichert. Ein Zeitpunkt ohne Tag hiess
  // „an allen": er wird dann auf alle gewaehlten Tage vervielfacht.
  if (plan.rhythm.kind === 'weekdays' && plan.rhythm.weekdays.length > 0) {
    return slotsJeTag(plan.slots, plan.rhythm.weekdays)
  }

  // Jede andere Form kennt keine einzelnen Tage: ein „nur montags" waere dort
  // eine Angabe, die nirgends ankommt.
  const slots: IntakeSlotDraft[] = plan.slots.map(slot => ({ ...slot, weekdays: [] }))
  if (slots.length === 0) slots.push(naechsterSlot(slots))
  return slots
}

/**
 * Die Zeitpunkte nach Tagen sortiert, je Zeitpunkt genau ein Tag.
 *
 * Ein Tag, fuer den nichts dasteht, ist gerade erst dazugekommen — er
 * uebernimmt das Muster des ersten Tages, der schon eines hat. Drei Tage
 * anzuwaehlen soll nicht heissen, dreimal von vorn zu tippen.
 */
function slotsJeTag(
  slots: readonly IntakeSlotDraft[],
  weekdays: readonly string[],
): IntakeSlotDraft[] {
  const gewaehlt = WEEKDAY_KEYS.filter(tag => weekdays.includes(tag))
  const jeTag = new Map<string, IntakeSlotDraft[]>(
    gewaehlt.map(tag => [tag, slots
      .filter(slot => slot.weekdays.length === 0 || slot.weekdays.includes(tag))
      .map(slot => ({ ...slot, weekdays: [tag] }))]),
  )
  const vorlage = gewaehlt.map(tag => jeTag.get(tag) ?? []).find(tagesSlots => tagesSlots.length > 0)
  return gewaehlt.flatMap(tag => {
    const tagesSlots = jeTag.get(tag) ?? []
    if (tagesSlots.length > 0) return tagesSlots
    return (vorlage ?? [naechsterSlot([])]).map(slot => ({ ...slot, weekdays: [tag] }))
  })
}

/**
 * Ein weiterer Zeitpunkt. Er startet auf der Tageszeit, die noch frei ist —
 * zweimal „morgens" ist selten gemeint, und wo doch (zwei Abenddosen), setzt
 * man die Uhrzeiten von Hand.
 */
export function naechsterSlot(
  slots: readonly IntakeSlotDraft[],
  weekdays: readonly string[] = [],
): IntakeSlotDraft {
  const reihenfolge: RoutineGroup[] = ['morning', 'midday', 'evening']
  const belegt = new Set(slots.map(slot => slot.routineGroup))
  return {
    routineGroup: reihenfolge.find(gruppe => !belegt.has(gruppe)) ?? 'evening',
    time: null,
    // Die Menge des ersten Zeitpunkts als Vorschlag: meist ist sie ueberall
    // gleich, und wo nicht, aendert man genau die eine Zahl.
    dose: slots[0]?.dose ?? null,
    // Der Tag, an dem er entsteht: im Formular der offene Reiter. Leer heisst
    // „der Rhythmus kennt keine einzelnen Tage" — taeglich, im Abstand, im
    // Wechsel.
    weekdays: [...weekdays],
  }
}

/**
 * Ein leerer Plan. Steht die Darreichungsform schon fest — beim Bearbeiten
 * eines bestehenden Eintrags tut sie das —, bringt sie Route und Einheit
 * gleich mit. Sonst blieben beide leer, und die Route ist seit sie aus der
 * Form folgt gar kein sichtbares Feld mehr: der Schritt haette lautlos
 * blockiert.
 */
function emptyPlan(name: string, dosageForm: DosageFormKey | null = null): IntakePlanDraft {
  return {
    name,
    unit: dosageForm ? defaultIntakeUnitFor(dosageForm) : null,
    method: dosageForm ? defaultMethodFor(dosageForm) : '',
    rhythm: emptyRhythm(),
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: null,
    slots: [{ routineGroup: 'morning', time: null, dose: null, weekdays: [] }],
    reminders: [],
  }
}

/**
 * Die Angaben zur Packung so vorbelegt, wie die Detailansicht sie zeigt
 * (`produktAngaben`): zuerst der Bestand, sonst die stillstehende Altspalte.
 * Gespeichert wird in den Bestand — so steht danach dort, was man sah.
 */
function packungsAngaben(existing: StackItem): Pick<
  InventoryDraft,
  'batchNumber' | 'batchSource' | 'batchFileUrl' | 'reconstitutionMl' | 'openedAt' | 'useWithinDays'
> {
  const inv = existing.inventory
  const alt = existing as StackItem & AltSpalten
  return {
    batchNumber: inv?.batch_number ?? alt.batch_number ?? '',
    batchSource: inv?.batch_source ?? alt.batch_source ?? '',
    batchFileUrl: inv?.batch_file_url ?? alt.batch_file_url ?? null,
    reconstitutionMl: inv?.reconstitution_ml ?? alt.reconstitution_ml ?? null,
    openedAt: inv?.opened_at ?? alt.reconstitution_date ?? null,
    useWithinDays: inv?.use_within_days ?? alt.expiry_days ?? null,
  }
}

function emptyInventory(): InventoryDraft {
  return {
    enabled: false,
    packageQuantity: null,
    packageUnit: null,
    remainingQuantity: null,
    brand: '',
    batchNumber: '',
    expiresAt: null,
  }
}

function draftFromStackItem(
  existing: StackItem,
  existingPlan?: IntakePlanDraft,
): StackItemSetupDraft {
  return {
    id: existing.id,
    displayName: existing.display_name,
    trackingLevel: existing.tracking_level,
    category: existing.category,
    dosageForm: existing.dosage_form,
    brand: existing.brand ?? '',
    colorHex: existing.color_hex ?? '',
    notes: existing.notes ?? '',
    ingredients: powderVialIngredientsForEdit(existing),
    plan: existingPlan
      ? geladenerPlan(existingPlan)
      : emptyPlan(existing.display_name, existing.dosage_form),
    inventory: existing.inventory
      ? {
          enabled: existing.inventory.enabled,
          packageQuantity: existing.inventory.package_quantity,
          packageUnit: existing.inventory.package_unit,
          remainingQuantity: existing.inventory.remaining_quantity,
          brand: '',
          expiresAt: existing.inventory.expires_at,
          ...packungsAngaben(existing),
        }
      : { ...emptyInventory(), ...packungsAngaben(existing) },
    pkProfileMethod: existing.pk_profile_method,
  }
}

/**
 * Ein gespeicherter Plan, wie ihn der Entwurf braucht.
 *
 * Die Zeitpunkte laufen durch dieselbe Normalisierung wie bei einem
 * Rhythmuswechsel. Ein Plan aus der Zeit vor den Tagesreitern traegt seine
 * Zeitpunkte ohne Tag — „an allen" —; beim Oeffnen wuerde derselbe Zeitpunkt
 * dann in jedem Reiter stehen und sich ueberall zugleich aendern. Vervielfacht
 * gehoert er jedem Tag einzeln, so wie ein neu angelegter Plan.
 */
function geladenerPlan(gespeichert: IntakePlanDraft): IntakePlanDraft {
  const plan: IntakePlanDraft = {
    ...gespeichert,
    rhythm: { ...gespeichert.rhythm, weekdays: [...gespeichert.rhythm.weekdays] },
    slots: gespeichert.slots.map(slot => ({ ...slot, weekdays: [...slot.weekdays] })),
    reminders: [...gespeichert.reminders],
    startDate: format(new Date(), 'yyyy-MM-dd'),
  }
  return { ...plan, slots: slotsFuerRhythmus(plan) }
}

export function initialWizardState(
  existing?: StackItem,
  initialColorHex = '',
  existingPlan?: IntakePlanDraft,
): WizardState {
  return {
    step: 'substance',
    draft: existing
      ? draftFromStackItem(existing, existingPlan)
      : {
          displayName: '',
          // Vorgewaehlt, nicht offen: „Gruendlich" ist die Stufe, aus der die
          // App das meiste machen kann (Wirkstaerke, und damit ueberhaupt ein
          // Blutspiegel). Wer weniger pflegen will, stellt im Tiefenschritt
          // zurueck — das ist der billigere Weg als eine Pflichtwahl, vor der
          // niemand weiss, was die Stufen bedeuten.
          trackingLevel: 'complete',
          category: null,
          dosageForm: null,
          brand: '',
          colorHex: initialColorHex,
          notes: '',
          ingredients: [],
          plan: emptyPlan(''),
          inventory: emptyInventory(),
          pkProfileMethod: null,
        },
    original: existing ?? null,
    saveMode: existing ? 'update' : 'create',
  }
}

/**
 * Pulver-Vial: ein Peptid, eine Zutat, Bezug „ml". Dann ist der Bezug der
 * Zutat das zugefuegte Loesungsmittel und laeuft in den Bestand mit.
 */
export function istPulverVial(draft: Pick<StackItemDraft, 'category' | 'dosageForm' | 'ingredients'>): boolean {
  return draft.category === 'peptide' && draft.dosageForm === 'vial'
    && draft.ingredients.length === 1 && draft.ingredients[0].basis_unit === 'ml'
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  const powderVial = istPulverVial(state.draft)
  switch (action.type) {
    case 'step_selected':
      return { ...state, step: action.step }
    case 'draft_restarted':
      return { ...initialWizardState(undefined, action.colorHex), step: state.step }
    case 'catalog_selected': {
      // Die Kategorie des NEUEN Eintrags, nicht die alte: sie entscheidet beim
      // Vial, ob dort ein Pulver liegt oder eine fertige Loesung.
      const basis = basisVorbelegung(state.draft.dosageForm, action.entry.default_category)
      const bestandteile = action.components ?? []

      // Ein Kombipraeparat bekommt je Bestandteil eine Zeile — das ist der
      // ganze Zweck des Eintrags. Die Zeilen tragen die ids der BESTANDTEILE,
      // nicht die des Produkts: nur so haengt jeder Wirkstoff an seinem
      // eigenen PK-Profil, und nur so laesst sich je Wirkstoff rechnen.
      // Der Name des Produkts bleibt oben stehen (`displayName`).
      const ingredients: StackItemIngredient[] = bestandteile.length > 0
        ? bestandteile.map((bestandteil, index) => ({
            ...emptyIngredient(index),
            catalog_substance_id: bestandteil.catalogId,
            custom_name: bestandteil.name,
            amount_unit: bestandteil.unit ?? action.entry.suggested_units[0] ?? null,
            ...basis,
          }))
        : [{
            ...emptyIngredient(0),
            catalog_substance_id: action.entry.id,
            amount_unit: action.entry.suggested_units[0] ?? null,
            ...basis,
          }]

      return {
        ...state,
        draft: {
          ...state.draft,
          catalogEntryId: action.entry.id,
          displayName: action.entry.canonical_name,
          category: action.entry.default_category,
          plan: { ...state.draft.plan, name: action.entry.canonical_name },
          ingredients,
        },
      }
    }
    case 'custom_started': {
      const firstIngredient = state.draft.ingredients[0]
      const wasCatalogSelection = state.draft.ingredients.length === 1
        && Boolean(firstIngredient?.catalog_substance_id)
      const isSingleCustomIdentity = state.draft.ingredients.length === 1
        && !firstIngredient?.catalog_substance_id
        && firstIngredient?.custom_name === state.draft.displayName
      const ingredients = state.draft.ingredients.length === 0 || wasCatalogSelection
        ? [{
            ...emptyIngredient(0),
            custom_name: action.name,
            ...basisVorbelegung(state.draft.dosageForm, state.draft.category),
          }]
        : isSingleCustomIdentity
          ? [{ ...firstIngredient, custom_name: action.name }]
          : state.draft.ingredients

      return {
        ...state,
        draft: {
          ...state.draft,
          catalogEntryId: null,
          displayName: action.name,
          category: wasCatalogSelection ? null : state.draft.category,
          plan: { ...state.draft.plan, name: action.name },
          ingredients,
        },
      }
    }
    // Die Katalogwahl bewusst loesen. Frueher passierte das als Nebenwirkung
    // von 'custom_started', also bei jedem Tastendruck im Suchfeld — samt
    // Kategorie, Einheit und PK-Profil, ohne dass es jemand merkte. Jetzt
    // muss man es tun wollen, und der Name bleibt: nur die Verknuepfung faellt.
    case 'catalog_detached': {
      // Ein geloestes Kombipraeparat faellt auf EINE freie Zeile zurueck. Die
      // bestehenden Zeilen sind seine Bestandteile — sie ohne das Produkt
      // stehen zu lassen hiesse, dass oben „Dymista" steht und unten trotzdem
      // Fluticason und Azelastin. Selbst hinzugefuegte Zutaten bleiben dagegen
      // unangetastet: dort traegt die erste Zeile die id des Eintrags.
      const warKombination = Boolean(state.draft.catalogEntryId)
        && state.draft.ingredients.length > 1
        && !state.draft.ingredients.some(
          zutat => zutat.catalog_substance_id === state.draft.catalogEntryId,
        )
      const freieZeile = {
        ...emptyIngredient(0),
        custom_name: state.draft.displayName,
        ...basisVorbelegung(state.draft.dosageForm, state.draft.category),
      }
      const frei = warKombination || state.draft.ingredients.length === 0
        ? [freieZeile]
        : state.draft.ingredients.map((zutat, index) => (
            index === 0
              ? { ...zutat, catalog_substance_id: null, custom_name: state.draft.displayName }
              : zutat
          ))

      return { ...state, draft: { ...state.draft, catalogEntryId: null, ingredients: frei } }
    }
    case 'display_name_changed':
      return {
        ...state,
        draft: {
          ...state.draft,
          displayName: action.displayName,
          plan: { ...state.draft.plan, name: action.displayName },
        },
      }
    case 'category_selected': {
      // Die Kategorie ist nicht nur eine Schublade: beim Vial entscheidet sie,
      // ob dort ein Pulver liegt, das aufgeloest wird, oder eine fertige
      // Loesung. Aus „Peptid" wird „Hormon" — und aus der leeren
      // Loesungsmittelzeile die vorbelegte „pro 1 ml".
      if (state.draft.category === action.category) return state
      const basis = basisVorbelegung(state.draft.dosageForm, action.category)
      return {
        ...state,
        draft: {
          ...state.draft,
          category: action.category,
          ingredients: state.draft.ingredients.map(ingredient => ({ ...ingredient, ...basis })),
        },
      }
    }
    case 'ingredient_added':
      return {
        ...state,
        draft: {
          ...state.draft,
          ingredients: [
            ...state.draft.ingredients,
            {
              ...emptyIngredient(state.draft.ingredients.length),
              ...basisVorbelegung(state.draft.dosageForm, state.draft.category),
            },
          ],
        },
      }
    case 'ingredient_changed':
      return {
        ...state,
        draft: {
          ...state.draft,
          ingredients: state.draft.ingredients.map((ingredient, index) => (
            index === action.index ? { ...ingredient, ...action.changes } : ingredient
          )),
          ...(powderVial && 'basis_value' in action.changes ? {
            inventory: { ...state.draft.inventory, reconstitutionMl: action.changes.basis_value },
          } : {}),
        },
      }
    case 'ingredient_removed':
      return {
        ...state,
        draft: {
          ...state.draft,
          ingredients: state.draft.ingredients
            .filter((_, index) => index !== action.index)
            .map((ingredient, position) => ({ ...ingredient, position })),
        },
      }
    case 'dosage_form_selected': {
      if (state.draft.dosageForm === action.dosageForm) return state

      const basis = basisVorbelegung(action.dosageForm, state.draft.category)
      const compatiblePlanUnits = getIntakePlanUnitSuggestions(
        action.dosageForm,
        action.catalogSuggestedUnits,
      )
      const currentPlanUnit = state.draft.plan.unit
      // Route und Einheit folgen fast immer aus der Form: eine Tablette wird
      // geschluckt und in mg gezaehlt. Beides stand trotzdem als leere
      // Pflichteingabe da. Vorbelegt wird nur, was der Nutzer nicht selbst
      // gesetzt hat — oder was die VORIGE Form vorbelegt hatte.
      const alteVorgabe = state.draft.dosageForm
        ? defaultMethodFor(state.draft.dosageForm)
        : ''
      const methodeFrei = !state.draft.plan.method.trim()
        || state.draft.plan.method === alteVorgabe
      return {
        ...state,
        draft: {
          ...state.draft,
          dosageForm: action.dosageForm,
          plan: {
            ...state.draft.plan,
            method: methodeFrei
              ? defaultMethodFor(action.dosageForm)
              : state.draft.plan.method,
            unit: currentPlanUnit && compatiblePlanUnits.includes(currentPlanUnit)
              ? currentPlanUnit
              : defaultIntakeUnitFor(action.dosageForm, action.catalogSuggestedUnits),
          },
          // Die Produktmenge gehoert zur FORM: aus „1 Kapsel" wird beim
          // Wechsel auf eine Ampulle „1 ml", beim Pulver-Vial eine leere
          // Zeile, die auf die Rekonstitution wartet. Eine stehengebliebene
          // alte Zahl waere eine falsche Angabe, kein geretteter Eintrag.
          ingredients: state.draft.ingredients.map(ingredient => ({
            ...ingredient,
            ...basis,
          })),
        },
      }
    }
    case 'tracking_level_selected':
      return { ...state, draft: { ...state.draft, trackingLevel: action.trackingLevel } }
    case 'details_changed':
      return { ...state, draft: { ...state.draft, ...action.changes } }
    case 'inventory_changed':
      return {
        ...state,
        draft: {
          ...state.draft,
          inventory: { ...state.draft.inventory, ...action.changes },
          ...(powderVial && 'reconstitutionMl' in action.changes ? {
            ingredients: state.draft.ingredients.map(ingredient => ({ ...ingredient, basis_value: action.changes.reconstitutionMl ?? null })),
          } : {}),
        },
      }
    case 'plan_replaced':
      return { ...state, draft: { ...state.draft, plan: { ...action.plan, id: state.draft.plan.id } } }
    case 'plan_changed': {
      const plan = { ...state.draft.plan, ...action.changes }
      // Nur ein RHYTHMUSWECHSEL fasst die Zeitpunkte an — sonst wuerde jede
      // Aenderung am Plan die selbst hinzugefuegten wieder einsammeln. Und
      // auch dann nur, wenn „Bei Bedarf" ins Spiel kommt oder daraus zurueck:
      // an welchen Tagen etwas ansteht, sagt nichts darueber, wie oft am Tag.
      const slots = action.changes.rhythm === undefined
        ? plan.slots
        : slotsFuerRhythmus(plan)
      return { ...state, draft: { ...state.draft, plan: { ...plan, slots } } }
    }
    case 'save_mode_selected':
      return { ...state, saveMode: action.mode }
  }
}

function firstIngredientError(
  state: WizardState,
  fields: readonly ('name' | 'amountValue' | 'amountUnit' | 'basisValue' | 'basisUnit')[],
): string | null {
  const errors = validateStackItemDraft(state.draft).ingredients

  if (!errors) return null

  for (let index = 0; index < errors.length; index += 1) {
    for (const field of fields) {
      if (errors[index]?.[field]) return `ingredients.${index}.${field}`
    }
  }

  return null
}

export function firstInvalidField(state: WizardState, validatePlan = true): string | null {
  const errors = validateStackItemDraft(state.draft)

  if (state.step === 'substance' || state.step === 'review') {
    if (!state.draft.displayName.trim()) return 'displayName'
    if (!state.draft.category) return 'category'
  }
  if (state.step === 'ingredients' && !state.draft.displayName.trim()) return 'displayName'

  if (state.step === 'substance' || state.step === 'ingredients' || state.step === 'review') {
    const nameError = firstIngredientError(state, ['name'])
    if (nameError) return nameError
  }

  if (state.step === 'dosage_form' || state.step === 'strength' || state.step === 'review') {
    if (errors.dosageForm) return 'dosageForm'
  }

  if (
    state.step === 'strength'
    || (state.step === 'review' && state.draft.trackingLevel === 'complete')
  ) {
    const strengthError = firstIngredientError(
      state,
      ['name', 'amountValue', 'amountUnit', 'basisValue', 'basisUnit'],
    )
    if (strengthError) return strengthError
  }

  if (validatePlan && (state.step === 'plan' || state.step === 'review')) {
    const planErrors = validateIntakePlan(state.draft.plan, state.draft.trackingLevel)
    if (planErrors.name) return 'displayName'
    if (planErrors.method) return 'plan.method'
    if (planErrors.frequency) return 'plan.frequency'
    if (planErrors.xDaysInterval) return 'plan.xDaysInterval'
    if (planErrors.scheduleDays) return 'plan.scheduleDays'
    if (planErrors.startDate) return 'plan.startDate'
    if (planErrors.endDate) return 'plan.endDate'
    const fehlenderSlot = planErrors.slots?.findIndex(Boolean) ?? -1
    if (fehlenderSlot >= 0) return `plan.slots.${fehlenderSlot}.routineGroup`
    if (planErrors.dose) return 'plan.dose'
    if (planErrors.unit) return 'plan.unit'
  }

  return null
}

export function canContinue(state: WizardState): boolean {
  return firstInvalidField(state) === null
}

export function didIdentityChange(original: StackItem, draft: StackItemDraft): boolean {
  return buildDuplicateFingerprint(draftFromStackItem(original)) !== buildDuplicateFingerprint(draft)
}
