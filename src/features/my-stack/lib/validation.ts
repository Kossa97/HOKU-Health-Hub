import type {
  IntakePlanDraft,
  IntakeRhythm,
  StackItemDraft,
  StackItemIngredient,
  TrackingLevel,
} from '../types'
import { MAX_INTAKE_SLOTS } from './intakeFrequency'
import { CYCLE_BOUNDS, INTERVAL_BOUNDS, isOnDemandRhythm } from './intakeRhythm'
import { trackingCapabilities } from './trackingDepth'

export interface IngredientValidationErrors {
  name?: string
  amountValue?: string
  amountUnit?: string
  basisValue?: string
  basisUnit?: string
}

export interface StackItemDraftValidationErrors {
  dosageForm?: string
  ingredients?: IngredientValidationErrors[]
}

export interface IntakePlanValidationErrors {
  name?: string
  dose?: string
  unit?: string
  method?: string
  /** Die Form des Rhythmus selbst — heute immer gesetzt, also nie ein Fehler. */
  frequency?: string
  /** 'interval': der Abstand fehlt oder liegt ausserhalb seiner Einheit. */
  xDaysInterval?: string
  /** 'weekdays': kein Tag gewaehlt. 'cycle': an/aus unbrauchbar. */
  scheduleDays?: string
  startDate?: string
  endDate?: string
  /** Ein Eintrag je fehlerhaftem Einnahmezeitpunkt, in derselben Reihenfolge. */
  slots?: string[]
  /**
   * Die fehlende Menge je Zeitpunkt. `dose` sagt nur DASS eine fehlt — bei
   * drei Einnahmen am Tag half das niemandem, denn der Hinweis stand unten
   * bei der Einheit und nicht an der Karte, in der die Zahl fehlte.
   */
  doses?: string[]
}

export const MIN_EVERY_X_DAYS = 2
export const MAX_EVERY_X_DAYS = 30
export const VALID_SCHEDULE_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

export function validateRecurrence(
  frequency: string,
  xDaysInterval: number | null,
  scheduleDays: string[],
): Pick<IntakePlanValidationErrors, 'xDaysInterval' | 'scheduleDays'> {
  if (
    frequency === 'Alle X Tage'
    && (
      xDaysInterval == null
      || !Number.isFinite(xDaysInterval)
      || !Number.isInteger(xDaysInterval)
      || xDaysInterval < MIN_EVERY_X_DAYS
      || xDaysInterval > MAX_EVERY_X_DAYS
    )
  ) return { xDaysInterval: 'invalid_interval' }

  if (frequency === 'Wochentage wählen') {
    const validDays = new Set<string>(VALID_SCHEDULE_DAYS)
    if (
      scheduleDays.length === 0
      || scheduleDays.some(day => !validDays.has(day))
      || new Set(scheduleDays).size !== scheduleDays.length
    ) return { scheduleDays: 'invalid_weekdays' }
  }

  return {}
}

/**
 * Der Rhythmus des Assistenten. `validateRecurrence` darueber prueft dasselbe
 * fuer die aeltere Zyklusmaske, die noch mit Frequenztexten arbeitet.
 */
export function validateRhythm(
  rhythm: IntakeRhythm,
): Pick<IntakePlanValidationErrors, 'xDaysInterval' | 'scheduleDays'> {
  if (rhythm.kind === 'interval') {
    const grenzen = INTERVAL_BOUNDS[rhythm.intervalUnit]
    const n = rhythm.intervalValue
    if (
      n == null || !Number.isFinite(n) || !Number.isInteger(n)
      || n < grenzen.min || n > grenzen.max
    ) return { xDaysInterval: 'invalid_interval' }
  }

  if (rhythm.kind === 'cycle') {
    // „X Tage an, Y Tage aus" — null an beiden Stellen waere kein Wechsel,
    // sondern eine Pause ohne Ende oder ein Dauerplan mit Umweg.
    const gueltig = (wert: number | null) => (
      wert != null && Number.isFinite(wert) && Number.isInteger(wert)
      && wert >= CYCLE_BOUNDS.min && wert <= CYCLE_BOUNDS.max
    )
    if (!gueltig(rhythm.onDays) || !gueltig(rhythm.offDays)) {
      return { scheduleDays: 'invalid_cycle' }
    }
  }

  if (rhythm.kind === 'weekdays') {
    const validDays = new Set<string>(VALID_SCHEDULE_DAYS)
    if (
      rhythm.weekdays.length === 0
      || rhythm.weekdays.some(day => !validDays.has(day))
      || new Set(rhythm.weekdays).size !== rhythm.weekdays.length
    ) return { scheduleDays: 'invalid_weekdays' }
  }

  return {}
}

function validateIngredient(
  ingredient: StackItemIngredient,
  level: TrackingLevel,
): IngredientValidationErrors {
  const errors: IngredientValidationErrors = {}
  const catalogSubstanceId = ingredient.catalog_substance_id?.trim()

  if (!catalogSubstanceId && !(ingredient.custom_name ?? '').trim()) errors.name = 'required'
  if (trackingCapabilities(level).productStrength) {
    if (
      ingredient.amount_value === null
      || !Number.isFinite(ingredient.amount_value)
      || ingredient.amount_value <= 0
    ) errors.amountValue = 'required_for_complete'
    if (!ingredient.amount_unit?.trim()) errors.amountUnit = 'required_for_complete'
    if (
      ingredient.basis_value === null
      || !Number.isFinite(ingredient.basis_value)
      || ingredient.basis_value <= 0
    ) errors.basisValue = 'required_for_complete'
    if (!ingredient.basis_unit?.trim()) errors.basisUnit = 'required_for_complete'
  }

  return errors
}

export function validateStackItemDraft(draft: StackItemDraft): StackItemDraftValidationErrors {
  const errors: StackItemDraftValidationErrors = {}

  if (!draft.dosageForm) errors.dosageForm = 'required'

  if (draft.ingredients.length === 0) {
    errors.ingredients = [{ name: 'required' }]
  } else {
    const ingredientErrors = draft.ingredients.map(ingredient => validateIngredient(ingredient, draft.trackingLevel))
    if (ingredientErrors.some(row => Object.keys(row).length > 0)) errors.ingredients = ingredientErrors
  }

  return errors
}

export function validateIntakePlan(
  plan: IntakePlanDraft,
  level: TrackingLevel,
): IntakePlanValidationErrors {
  const errors: IntakePlanValidationErrors = {}
  if (!plan.name.trim()) errors.name = 'required'
  if (!plan.method.trim()) errors.method = 'required'
  Object.assign(errors, validateRhythm(plan.rhythm))
  if (!plan.startDate.trim()) errors.startDate = 'required'

  // Ein Ende VOR dem Start ist keine Kur, sondern ein Tippfehler. Leer bleibt
  // erlaubt: das ist der Dauerfall und der haeufigere.
  const ende = plan.endDate?.trim() ?? ''
  if (ende && plan.startDate.trim() && ende < plan.startDate.trim()) errors.endDate = 'before_start'

  // „Bei Bedarf" hat keinen geplanten Zeitpunkt — dort nach einer Tageszeit zu
  // fragen waere eine Pflichtangabe ohne Bedeutung. Jede andere Frequenz
  // braucht mindestens einen; wie viele es werden, entscheidet der Nutzer.
  if (!isOnDemandRhythm(plan.rhythm)) {
    const slotFehler: string[] = plan.slots.map(slot => (slot.routineGroup ? '' : 'required'))
    if (plan.slots.length === 0) slotFehler.push('required')
    // Vier Einnahmen an EINEM Tag sind die Grenze, nicht vier im ganzen Plan:
    // „montags dreimal, freitags zweimal" sind fuenf Zeitpunkte und trotzdem
    // an keinem Tag zu viele.
    const jeTag = new Map<string, number>()
    plan.slots.forEach((slot, index) => {
      const tage = slot.weekdays.length > 0 ? slot.weekdays : ['*']
      tage.forEach(tag => {
        const anzahl = (jeTag.get(tag) ?? 0) + 1
        jeTag.set(tag, anzahl)
        if (anzahl > MAX_INTAKE_SLOTS) slotFehler[index] = 'too_many'
      })
    })

    // Zwei Zeitpunkte, die sich in nichts unterscheiden, sind einer. Dieselbe
    // Tageszeit zweimal ist erlaubt — aber dann mit verschiedenen Uhrzeiten
    // oder an verschiedenen Tagen, sonst weiss weder die App noch der Nutzer,
    // welcher welcher ist.
    const gesehen = new Set<string>()
    plan.slots.forEach((slot, index) => {
      const schluessel = `${slot.routineGroup}|${slot.time ?? ''}|${[...slot.weekdays].sort().join('+')}`
      if (gesehen.has(schluessel)) slotFehler[index] = 'duplicate'
      gesehen.add(schluessel)
    })

    // Ein Zeitpunkt darf nur an Tagen liegen, die der Rhythmus auch auswaehlt,
    // und ein gewaehlter Tag ohne jede Einnahme ist ein Tag, an dem nichts
    // passiert — dann gehoert er nicht in die Auswahl.
    if (plan.rhythm.kind === 'weekdays' && plan.rhythm.weekdays.length > 0) {
      const gewaehlt = new Set(plan.rhythm.weekdays)
      plan.slots.forEach((slot, index) => {
        if (slot.weekdays.some(tag => !gewaehlt.has(tag))) slotFehler[index] = 'unknown_day'
      })
      const abgedeckt = new Set(
        plan.slots.flatMap(slot => (slot.weekdays.length > 0 ? slot.weekdays : [...gewaehlt])),
      )
      const ohneEinnahme = plan.rhythm.weekdays.filter(tag => !abgedeckt.has(tag))
      if (ohneEinnahme.length > 0) errors.scheduleDays = 'day_without_intake'
    }

    if (slotFehler.some(Boolean)) errors.slots = slotFehler
  }
  if (trackingCapabilities(level).quantity) {
    // Die Menge steht je Einnahmezeitpunkt — „morgens 1000, abends 500". Fehlt
    // sie an EINEM Zeitpunkt, ist der Plan unvollstaendig, nicht nur knapp.
    // Auch „Bei Bedarf" braucht sie: dort ist es die Menge je Einnahme.
    const mengenFehler = plan.slots.map(slot => (
      slot.dose == null || !Number.isFinite(slot.dose) || slot.dose <= 0 ? 'required' : ''
    ))
    if (plan.slots.length === 0 || mengenFehler.some(Boolean)) errors.dose = 'required'
    if (mengenFehler.some(Boolean)) errors.doses = mengenFehler
    if (!plan.unit?.trim()) errors.unit = 'required'
  }
  return errors
}
