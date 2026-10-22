import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  ExternalLink,
  Info,
  LoaderCircle,
  Plus,
  Save,
  X,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { findDuplicate, planScheduleSnapshot, stackItemProblems, stackItemSetupProblems } from '../services/stackItems'
import { localDateTimeKey, type PlanScheduleSnapshot } from '../../../lib/planTimeline'
import type { IntakePlanDraft, StackItem, StackItemSetupDraft, SubstanceCatalogEntry } from '../types'
import {
  changeKindFor,
  didIdentityChange,
  editSections,
  firstInvalidField,
  initialWizardState,
  wizardReducer,
  wizardSteps,
  zutatenAusDemKatalog,
  type EditSection,
  type WizardSaveMode,
  type WizardStep,
  type PlanChangeSubmission,
  type PlanEditContext,
  type PlanEffectiveDraft,
  type LaterStepChange,
  istPulverVial,
} from '../lib/wizardState'
import { bestandteileAufloesen } from '../lib/kombination'
import { buildReview, carryOverReview, planBaseAt, reviewedSnapshot, reviewStepChanged, stepsAround, type LaterPlanStep, type ReviewStep } from '../lib/planAdoption'
import { formatLocalDay, laterLocalDay, shiftLocalDay } from '../lib/localDays'
import { fuehrendeMenge, inWochenfolge, rhythmSummary, rhythmText } from '../lib/intakeRhythm'
import { weekdayLabel } from '../lib/planLabels'
import { validateIntakePlan, validateStackItemDraft } from '../lib/validation'
import { evaluatePkReadiness, pkRouteAccepted, pkRouteStatus, toPkMilligrams } from '../lib/pkReadiness'
import { DOSAGE_FORMS, isStageRenderable, showsColor } from '../lib/dosageForms'
import { methodLabel } from '../../../lib/intakeMethods'
import { DosageFormPreview } from './DosageFormPreview'
import { IngredientEditor } from './IngredientEditor'
import { IntakePlanEditor } from './IntakePlanEditor'
import { PlannedStepsReview, type ReviewStepErrors } from './PlannedStepsReview'
import { ProductInventorySection } from './ProductInventorySection'
import { useSloshEngine } from '../../../components/SloshContext'
import { FormUndFarbe } from './FormUndFarbe'
import { HaltbarkeitAngaben } from './HaltbarkeitAngaben'
import { StrengthEditor } from './StrengthEditor'
import { SubstanceSearch } from './SubstanceSearch'
import { SubstanzScanner } from './SubstanzScanner'
import { scanAktionen, type ScanVorschlag } from '../lib/substanzScan'
import { reportError } from '../../../lib/monitoring'
import { aufbrauchenBis, gueltigeFluessigkeit, gueltigeHaltbarkeit, haltbarkeitArt } from '../lib/bestand'

/**
 * Der Plan, der am Stichtag bisher gilt (`planBaseAt`). Null, solange bei
 * „ab Datum" noch kein Tag gewaehlt ist.
 */
function planBaseFor(context: PlanEditContext, effective: PlanEffectiveDraft): IntakePlanDraft | null {
  const boundary = effective.kind === 'date' ? effective.localDate : null
  if (effective.kind === 'date' && !boundary) return null
  const editedVersion = context.target.mode === 'replace_future' ? context.target.versionId : null
  return planBaseAt({
    laterSteps: context.laterSteps ?? [],
    boundary,
    current: context.current ?? context.snapshot,
    editing: editedVersion
      ? {
        versionId: editedVersion,
        originalDate: context.initialEffective?.kind === 'date' ? context.initialEffective.localDate : null,
        draft: context.snapshot,
      }
      : null,
  })
}

/** Derselbe Plan ohne die Anwendung — die setzt der Editor bei nur einer erlaubten selbst. */
function samePlanIgnoringMethod(left: IntakePlanDraft, right: IntakePlanDraft): boolean {
  return JSON.stringify({ ...left, method: '', id: undefined }) === JSON.stringify({ ...right, method: '', id: undefined })
}


/**
 * Was der gewaehlte Tag fuer die Stufen bedeutet — immer gesagt, damit
 * niemand unbemerkt in eine laufende oder geplante Stufe schneidet.
 */
function planNoteTexts(input: {
  t: (key: string, options?: Record<string, unknown>) => unknown
  language: string
  editingPlannedStep: boolean
  boundary: string | null
  around: { before: LaterPlanStep | null; after: LaterPlanStep[] }
}): string[] {
  const { t, language, boundary, around } = input
  const notes: string[] = []
  if (!input.editingPlannedStep) {
    if (!boundary) {
      notes.push(String(t('my_stack_plan_note_current_ends', {
        defaultValue: 'Die jetzige Stufe endet heute. Im Verlauf bleibt sie erhalten.',
      })))
    } else if (around.before) {
      notes.push(String(t('my_stack_plan_note_inside_planned', {
        defaultValue: 'Du änderst in einer bereits geplanten Stufe (ab {{start}}). Sie gilt dann nur bis {{end}}.',
        start: formatLocalDay(around.before.effectiveLocalDate, language),
        end: formatLocalDay(shiftLocalDay(boundary, -1), language),
      })))
    } else {
      notes.push(String(t('my_stack_plan_note_current_until', {
        defaultValue: 'Die jetzige Stufe gilt noch bis {{date}}.',
        date: formatLocalDay(shiftLocalDay(boundary, -1), language),
      })))
    }
  }
  const next = around.after[0]
  if (next) {
    notes.push(around.after.length === 1
      ? String(t('my_stack_plan_note_planned_one', {
        defaultValue: 'Ab {{date}} ist schon eine Stufe geplant. Du siehst sie vor dem Speichern und kannst sie anpassen.',
        date: formatLocalDay(next.effectiveLocalDate, language),
      }))
      : String(t('my_stack_plan_note_planned_many', {
        defaultValue: 'Ab {{date}} sind schon {{n}} Stufen geplant. Du siehst sie vor dem Speichern und kannst sie anpassen.',
        date: formatLocalDay(next.effectiveLocalDate, language),
        n: around.after.length,
      })))
  }
  return notes
}

interface StackItemWizardBaseProps {
  catalogEntries: SubstanceCatalogEntry[]
  existingItems: StackItem[]
  existingItem?: StackItem
  initialColorHex?: string
  catalogUnavailable?: boolean
  onClose: () => void
  onSave: (
    draft: StackItemSetupDraft,
    mode: WizardSaveMode,
    idempotencyKey: string,
  ) => Promise<void>
  onOpenExisting: (item: StackItem) => void
  /**
   * Womit der Assistent geoeffnet wird.
   *
   * `pk` fragt nur, was einem Blutspiegel noch fehlt. `plan` ist der
   * Einnahmeplan eines bestehenden Eintrags — er hat das alte Zyklusformular
   * abgeloest, damit es nur EINEN Weg gibt, der einen Zyklus schreibt.
   */
  intent?: 'pk' | 'plan'
  metadataOnly?: boolean
}

export type StackItemWizardProps = StackItemWizardBaseProps & (
  | {
      existingPlan?: StackItemSetupDraft['plan']
      planEditContext?: never
      onSavePlanChange?: never
    }
  | {
      existingPlan?: never
      planEditContext: PlanEditContext
      onSavePlanChange: (submission: PlanChangeSubmission) => Promise<void>
    }
)

/** Routen des ersten Profils unter den Zutaten — dasselbe, das die Kurve prueft. */
function ersteProfilRouten(item: StackItem, catalogEntries: SubstanceCatalogEntry[]): string[] {
  const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]))
  return [...item.ingredients]
    .sort((a, b) => a.position - b.position)
    .map(ingredient => ingredient.catalog_substance_id ? catalogById.get(ingredient.catalog_substance_id) : undefined)
    .find(entry => entry?.pk_profile_id)?.pk_profiles?.routes ?? []
}

function pkIntentSteps(
  item: StackItem,
  plan: StackItemSetupDraft['plan'] | undefined,
  iuPerMg: number | null = null,
  pkRoutes: readonly string[] = [],
): WizardStep[] {
  const steps: WizardStep[] = []
  // Ohne Staerke (Tiefe unter „gruendlich") geht es ueber die
  // Zusammensetzung: dort steht „Doch angeben" — und der Assistent startet
  // fuer „PK vervollstaendigen" ohnehin gruendlich (siehe unten).
  const strengthMissing = item.tracking_level !== 'complete' || item.ingredients.some(ingredient => (
    ingredient.amount_value == null
    || !Number.isFinite(ingredient.amount_value)
    || ingredient.amount_value <= 0
    || !ingredient.amount_unit?.trim()
    || ingredient.basis_value == null
    || !Number.isFinite(ingredient.basis_value)
    || ingredient.basis_value <= 0
    || !ingredient.basis_unit?.trim()
  ))
  if (strengthMissing) steps.push('strength')
  const methodMatches = pkRouteAccepted(pkRouteStatus(plan?.method, item.pk_profile_method, pkRoutes))
  const planNeedsAttention = !methodMatches
    || fuehrendeMenge(plan?.slots ?? []) == null
    || !plan?.unit?.trim()
    || !plan.slots.some(slot => slot.time?.trim())
    || (() => {
        const menge = fuehrendeMenge(plan.slots)
        return menge != null && plan.unit != null && toPkMilligrams(menge, plan.unit, iuPerMg) == null
      })()
  if (planNeedsAttention) steps.push('plan')
  return steps.length ? steps : ['plan']
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const STEP_LABELS: Record<WizardStep, { key: string; defaultValue: string }> = {
  substance: { key: 'my_stack_step_substance', defaultValue: 'Substanz' },
  ingredients: { key: 'my_stack_step_ingredients', defaultValue: 'Inhaltsstoffe' },
  strength: { key: 'my_stack_edit_section_composition', defaultValue: 'Zusammensetzung' },
  plan: { key: 'my_stack_step_plan', defaultValue: 'Einnahmeplan' },
  review: { key: 'my_stack_step_review', defaultValue: 'Zusammenfassung' },
}

/** Der Grund eines fehlgeschlagenen Speicherns, kurz — fuer die technische Zeile. */
function fehlerText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return String(error)
}

function stepForInvalidField(field: string): WizardStep {
  if (field === 'displayName' || field === 'category') return 'substance'
  if (field === 'dosageForm') return 'substance'
  // Haltbarkeit und Fluessigkeit stehen in der Zusammensetzung, der Bestand im Ueberblick.
  if (field === 'trackingLevel' || ['inventory.openedAt', 'inventory.useWithinDays', 'inventory.expiresAt', 'inventory.reconstitutionMl'].includes(field)) return 'strength'
  if (field === 'inventory' || field.startsWith('inventory.')) return 'review'
  if (field.startsWith('plan.')) return 'plan'
  if (field.endsWith('.name')) return 'ingredients'
  return 'strength'
}

function nextLocalDate(timeZone: string, now = new Date()): string {
  return shiftLocalDay(localDateTimeKey(now, timeZone).slice(0, 10), 1)
}

export function StackItemWizard({
  catalogEntries,
  existingItems,
  existingItem,
  existingPlan,
  catalogUnavailable = false,
  initialColorHex = '',
  onClose,
  onSave,
  onSavePlanChange,
  onOpenExisting,
  planEditContext,
  intent,
  metadataOnly = false,
}: StackItemWizardProps) {
  const { t, i18n } = useTranslation()
  const selectedPlan = planEditContext?.snapshot ?? existingPlan
  // „Bearbeiten": eine Uebersicht statt noch einmal aller Schritte. Jede
  // Zeile oeffnet ihren Abschnitt, „Fertig" fuehrt zurueck, gespeichert wird
  // einmal auf der Uebersicht. Der Plan gehoert nicht dazu — der hat
  // „Plan aendern".
  const editOverview = metadataOnly && Boolean(existingItem) && !planEditContext && !intent
  // Die Schritte fuer „PK vervollstaendigen" — einmal beim Oeffnen bestimmt.
  const [pkIntentStepList] = useState<WizardStep[] | null>(() => (
    intent === 'pk' && existingItem
      ? pkIntentSteps(existingItem, selectedPlan, null, ersteProfilRouten(existingItem, catalogEntries))
      : null
  ))
  const [state, dispatch] = useReducer(
    wizardReducer,
    undefined,
    () => {
      const initial = initialWizardState(existingItem, initialColorHex, selectedPlan)
      if (intent === 'plan') initial.step = 'plan'
      if (editOverview) initial.step = 'review'
      if (pkIntentStepList) {
        initial.step = pkIntentStepList[0]
        // Das PK-Profil braucht die Staerke — wer es vervollstaendigt, trackt gruendlich.
        initial.draft = { ...initial.draft, trackingLevel: 'complete' }
      }
      return initial
    },
  )
  const [pkProfileMethod, setPkProfileMethod] = useState(existingItem?.pk_profile_method ?? null)
  const [pkIntentError, setPkIntentError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  // Eine Physik-Engine fuer die Buehne: ohne sie steht die Form still — kein
  // Schwappen, kein Rollen.
  const sloshEngine = useSloshEngine()
  // Eigene Substanz: erst nach „Als eigene Substanz hinzufuegen" (oder beim
  // Bearbeiten einer solchen) fragt die Seite nach Kategorie und Form.
  // Getippter Text allein waehlt nichts.
  const [eigeneBestaetigt, setEigeneBestaetigt] = useState(() => !state.draft.catalogEntryId
    && !(state.draft.ingredients.length === 1 && state.draft.ingredients[0].catalog_substance_id)
    && Boolean(state.draft.category))
  // Scannen gibt es nur beim Neuanlegen: beim Bearbeiten wuerde ein Scan die
  // Identitaet des Eintrags austauschen, statt sie zu pruefen.
  const [scanOffen, setScanOffen] = useState(false)
  const scanErlaubt = !existingItem && !planEditContext

  function scanUebernehmen(vorschlag: ScanVorschlag): void {
    for (const aktion of scanAktionen(vorschlag, catalogEntries, initialColorHex)) dispatch(aktion)
    setEigeneBestaetigt(!vorschlag.entry)
    setShowErrors(false)
    setScanOffen(false)
  }
  const [identityChoiceMade, setIdentityChoiceMade] = useState(false)
  const [identityChoiceError, setIdentityChoiceError] = useState(false)
  const [duplicateCandidate, setDuplicateCandidate] = useState<StackItem | null>(null)
  // „Geplante Aenderungen": liegen hinter dem gewaehlten Tag schon Stufen,
  // zeigt der Assistent sie vor dem Speichern — null heisst, noch im Formular.
  const [review, setReview] = useState<ReviewStep[] | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewErrors, setReviewErrors] = useState<Record<string, ReviewStepErrors>>({})
  // Womit „Stufe hinzufuegen" zuletzt vorbelegt hat. Solange der Plan noch
  // so aussieht, folgt die Vorbelegung dem gewaehlten Tag.
  const [planPrefill, setPlanPrefill] = useState<IntakePlanDraft | null>(() => (planEditContext ? state.draft.plan : null))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveErrorDetail, setSaveErrorDetail] = useState<string | null>(null)
  const [planEffective, setPlanEffective] = useState<PlanEffectiveDraft>(() => (
    planEditContext?.target.mode === 'replace_future'
      ? {
          kind: 'date',
          localDate: [
            planEditContext.initialEffective?.kind === 'date'
              ? planEditContext.initialEffective.localDate
              : null,
            planEditContext.snapshot.startDate,
          ].find(candidate => candidate && candidate >= nextLocalDate(planEditContext.timeZone))
            ?? nextLocalDate(planEditContext.timeZone),
        }
      : planEditContext?.initialEffective ?? { kind: 'now', localDate: null }
  ))
  const [setupIdempotencyKey] = useState(() => globalThis.crypto.randomUUID())
  const earliestEffectiveDate = planEditContext
    ? laterLocalDay(nextLocalDate(planEditContext.timeZone), planEditContext.minEffectiveDate ?? '')
    : null
  const latestEffectiveDate = planEditContext?.maxEffectiveDate ?? null
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const duplicateActionRef = useRef<HTMLButtonElement>(null)

  const steps = intent === 'plan'
    ? (['plan'] as WizardStep[])
    : intent === 'pk' && pkIntentStepList
    ? pkIntentStepList
    : wizardSteps(state)
  const currentStepIndex = steps.indexOf(state.step)
  const sections = editOverview ? editSections(steps) : []
  const currentSection = sections.find(section => section.steps.includes(state.step)) ?? null
  const sectionStepIndex = currentSection ? currentSection.steps.indexOf(state.step) : -1
  // Auch ohne Abschnitt ist ein Schritt beim Bearbeiten der letzte: faellt er
  // unterwegs aus den Schritten (letzte eigene Zutat entfernt), fuehrt
  // „Fertig" trotzdem zur Uebersicht und nicht auf Schritt eins.
  const lastInSection = editOverview && state.step !== 'review'
    && (currentSection === null || sectionStepIndex === currentSection.steps.length - 1)
  const validationErrors = showErrors ? validateStackItemDraft(state.draft) : {}
  const planValidationErrors = showErrors
    ? validateIntakePlan(state.draft.plan, state.draft.trackingLevel)
    : {}
  const catalogNames = useMemo(() => Object.fromEntries(
    catalogEntries.map(entry => [entry.id, entry.canonical_name]),
  ), [catalogEntries])
  const matchingEntries = useMemo(() => {
    const normalizedQuery = state.draft.displayName.trim().toLocaleLowerCase()
    if (!normalizedQuery) return []

    return catalogEntries.filter(entry => (
      entry.canonical_name.toLocaleLowerCase().includes(normalizedQuery)
      || entry.aliases.some(alias => alias.toLocaleLowerCase().includes(normalizedQuery))
    ))
  }, [catalogEntries, state.draft.displayName])
  // Der gewaehlte Katalogeintrag. Bei einem Kombipraeparat steht er NICHT an
  // den Zutaten — die tragen die ids der Bestandteile —, sondern im Entwurf.
  // Ohne diesen Vorrang zeigte der Substanzschritt nach der Wahl von
  // „Dymista" den ersten Bestandteil an, also Fluticason.
  const selectedCatalogEntry = useMemo(() => {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]))
    const gewaehlt = state.draft.catalogEntryId
      ? catalogById.get(state.draft.catalogEntryId)
      : undefined
    if (gewaehlt) return gewaehlt
    // Gespeicherte Eintraege tragen die Wahl nicht mit. Ein Name aus dem
    // Katalog ist dieser Eintrag (auch ein Kombipraeparat); sonst die einzige
    // Zutat. Bei mehreren ist es ein eigenes Produkt, dessen Zutaten am
    // Katalog haengen — etwa ein gescannter „Zink Komplex" mit Zink und
    // Vitamin C —, nicht sein erster Wirkstoff.
    // Geloest ist geloest: ohne Verknuepfung an den Zutaten zaehlt der Name nicht.
    const name = state.draft.ingredients.some(ingredient => ingredient.catalog_substance_id)
      ? state.draft.displayName.trim().toLocaleLowerCase()
      : ''
    const nachName = name ? catalogEntries.find(entry => entry.canonical_name.toLocaleLowerCase() === name) : undefined
    // Nur wenn die Zutaten dazu passen: ein Kombipraeparat, oder alle Zeilen
    // sind dieser Eintrag. Ein „Zink" mit Zink und Vitamin C ist ein eigenes Produkt.
    const passt = nachName && (nachName.component_names?.length
      || state.draft.ingredients.every(ingredient => ingredient.catalog_substance_id === nachName.id))
    if (nachName && passt) return nachName
    const [einzige, ...weitere] = state.draft.ingredients
    return einzige?.catalog_substance_id && weitere.length === 0 ? catalogById.get(einzige.catalog_substance_id) : undefined
  }, [catalogEntries, state.draft.catalogEntryId, state.draft.ingredients, state.draft.displayName])
  // Steht fest, was es ist? Ein Katalogeintrag — oder eine bestaetigte eigene
  // Substanz mit Namen und Kategorie. Erst dann zeigt die Seite Form und Buehne.
  const eigeneFeststeht = eigeneBestaetigt && Boolean(state.draft.displayName.trim())
  const identitaetFeststeht = Boolean(selectedCatalogEntry) || (eigeneFeststeht && Boolean(state.draft.category))
  const selectedPkCatalogEntry = useMemo(() => {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]))
    return [...state.draft.ingredients]
      .sort((a, b) => a.position - b.position)
      .map(ingredient => ingredient.catalog_substance_id
        ? catalogById.get(ingredient.catalog_substance_id)
        : undefined)
      .find((entry): entry is SubstanceCatalogEntry => Boolean(entry?.pk_profile_id))
  }, [catalogEntries, state.draft.ingredients])
  // Fuer welche Routen das Profil gilt. Nennt es welche, entscheiden sie
  // ohne Haekchen; nur ohne Angabe im Profil bestaetigt der Nutzer selbst.
  // Gespeichert wird nur diese ausdrueckliche Bestaetigung.
  const pkRoutes = selectedPkCatalogEntry?.pk_profiles?.routes ?? []
  const planMethod = state.draft.plan.method.trim()
  const pkRoute = pkRouteStatus(planMethod, pkProfileMethod, pkRoutes)
  const identityChanged = Boolean(state.original && didIdentityChange(state.original, state.draft))

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    dialogRef.current?.querySelector<HTMLElement>('[data-step-autofocus]')?.focus()

    return () => returnFocusRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!duplicateCandidate) return
    requestAnimationFrame(() => {
      duplicateActionRef.current?.focus()
    })
  }, [duplicateCandidate])

  function focusField(field: string): void {
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)?.focus()
    })
  }

  /**
   * Zu einem fehlenden Feld fuehren. Liegt sein Schritt in diesem Ablauf,
   * springt der Assistent hin; sonst (etwa Wirkstaerke im Modus
   * „Einnahmeplan") sagt er, wo bei der Substanz etwas fehlt — statt auf
   * einen Schritt zu springen, den es hier nicht gibt.
   */
  function zeigeFehlendesFeld(field: string): void {
    const step = stepForInvalidField(field)
    if (steps.includes(step)) {
      setShowErrors(true)
      if (state.step !== step) dispatch({ type: 'step_selected', step })
      focusField(field)
      return
    }
    zeigeFehlendenBereich(t(STEP_LABELS[step].key, { defaultValue: STEP_LABELS[step].defaultValue }))
  }

  function zeigeFehlendenBereich(area: unknown): void {
    setSaveError(String(t('my_stack_save_item_incomplete', {
      defaultValue: 'Bei der Substanz fehlen Angaben ({{area}}). Ergänze sie über „Bearbeiten“ und speichere dann erneut.',
      area,
    })))
  }

  // Anmischen (Datum, Haltbarkeit) steht beim Vial unter dem Loesungsmittel
  // im Schritt „Staerke" — sonst, ohne diesen Schritt, beim Produkt.
  // Nur beim Pulver-Vial: dort steht das Loesungsmittel im Schritt „Staerke".
  // Uebersprungen steht die Fluessigkeit nicht in der Zusammensetzung — dann
  // beim Bearbeiten unter Produkt.
  const anmischenImStaerkeSchritt = istPulverVial(state.draft) && steps.includes('strength')
    && state.draft.trackingLevel === 'complete'

  function selectStep(step: WizardStep): void {
    dispatch({ type: 'step_selected', step })
    setShowErrors(false)
    setSaveError(null)
    setSaveErrorDetail(null)
    setDuplicateCandidate(null)
    setPkIntentError(null)
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-step-autofocus]')?.focus()
    })
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (saving) event.stopPropagation()
      else onClose()
      return
    }

    if (event.key === 'Tab') {
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  function handleContinue(): void {
    // Weiter mit getipptem Namen ohne Wahl: dann ist es die eigene Substanz —
    // die Kategorie erscheint und wird als Naechstes verlangt.
    if (state.step === 'substance' && !selectedCatalogEntry && state.draft.displayName.trim() && !eigeneBestaetigt) {
      setEigeneBestaetigt(true)
      // Ist die Kategorie schon da (etwa nach dem Loesen vom Katalog), geht es
      // trotzdem nicht im selben Tipp weiter: erst Kategorie und Form sehen.
      if (state.draft.category) return
    }
    const invalidField = firstInvalidField(state, !metadataOnly)
    if (invalidField) {
      setShowErrors(true)
      focusField(invalidField)
      return
    }

    if (editOverview) {
      const nextInSection = currentSection?.steps[sectionStepIndex + 1]
      if (nextInSection) selectStep(nextInSection)
      else backToOverview(currentSection)
      return
    }

    const nextStep = steps[currentStepIndex + 1]
    if (nextStep) selectStep(nextStep)
    else if (intent === 'pk' || intent === 'plan') void handleSave()
  }

  function backToOverview(section: EditSection | null): void {
    selectStep('review')
    if (!section) return
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(`[data-edit-section="${section.id}"]`)?.focus()
    })
  }

  function handleBack(): void {
    if (saving) return
    // Von „Geplante Aenderungen" zurueck ins Formular.
    // Was man dort getan hat, bleibt fuer das naechste „Weiter".
    if (reviewOpen) {
      setReviewOpen(false)
      setReviewErrors({})
      return
    }
    if (editOverview) {
      const previousInSection = currentSection?.steps[sectionStepIndex - 1]
      if (state.step === 'review') onClose()
      else if (previousInSection) selectStep(previousInSection)
      else backToOverview(currentSection)
      return
    }
    const previousStep = steps[currentStepIndex - 1]
    if (previousStep) selectStep(previousStep)
    else onClose()
  }

  function chooseSaveMode(mode: Extract<WizardSaveMode, 'update' | 'duplicate'>): void {
    dispatch({ type: 'save_mode_selected', mode })
    setIdentityChoiceMade(true)
    setIdentityChoiceError(false)
  }

  // Was an einem gewaehlten Stichtag nicht geht — vor dem Speichern gesagt,
  // statt als allgemeiner Fehler aus der Datenbank.
  function effectiveDateProblem(
    localDate: string | null,
    earliest: string | null = earliestEffectiveDate,
    isTaken: (day: string) => boolean = day => Boolean(planEditContext?.takenEffectiveDates?.includes(day)),
  ): string | null {
    const language = i18n?.language || 'de'
    if (!localDate) {
      return String(t('my_stack_plan_effective_required', { defaultValue: 'Wähle ein Datum.' }))
    }
    if (earliest && localDate < earliest) {
      return String(t('my_stack_plan_effective_too_early', {
        defaultValue: 'Wähle ein Datum ab dem {{date}}.',
        date: formatLocalDay(earliest, language),
      }))
    }
    if (latestEffectiveDate && localDate > latestEffectiveDate) {
      return String(t('my_stack_plan_effective_too_late', {
        defaultValue: 'Der Zyklus endet am {{date}}. Wähle ein früheres Datum.',
        date: formatLocalDay(latestEffectiveDate, language),
      }))
    }
    if (isTaken(localDate)) {
      return String(t('my_stack_plan_effective_taken', {
        defaultValue: 'An diesem Tag beginnt schon eine Stufe. Wähle einen anderen Tag.',
      }))
    }
    return null
  }

  // Die geplanten Stufen um den gewaehlten Tag. `before` gilt dort bisher,
  // `after` beginnt danach und kommt auf die Seite „Geplante Aenderungen".
  const planBoundary = planEffective.kind === 'date' ? planEffective.localDate : null
  const boundaryPending = planEffective.kind === 'date' && !planBoundary
  const editingPlannedStep = planEditContext?.target.mode === 'replace_future'
  const plannedAround = planEditContext?.laterSteps?.length && !boundaryPending
    ? stepsAround({
      laterSteps: planEditContext.laterSteps,
      boundary: planBoundary,
      exceptVersionId: planEditContext.target.versionId,
    })
    : { before: null, after: [] }
  // Der Plan, der am gewaehlten Tag bisher gegolten haette.
  const planBefore = planEditContext ? planBaseFor(planEditContext, planEffective) : null

  // Neuer Stichtag. Bei „Stufe hinzufuegen" folgt die Vorbelegung dem Tag,
  // solange man am Plan noch nichts geaendert hat: ab sofort die Mengen von
  // jetzt, an einem Tag dazwischen die der Stufe davor.
  function chooseEffective(next: PlanEffectiveDraft): void {
    setPlanEffective(next)
    if (!planEditContext || planEditContext.purpose !== 'add_step') return
    if (planPrefill && !samePlanIgnoringMethod(state.draft.plan, planPrefill)) return
    const plan = planBaseFor(planEditContext, next)
    if (!plan) return
    dispatch({ type: 'plan_replaced', plan })
    setPlanPrefill(plan)
  }

  // Was der gewaehlte Tag fuer die Stufen bedeutet — immer gesagt, damit
  // niemand unbemerkt in eine laufende oder geplante Stufe schneidet.
  const planNotes = planEditContext && !boundaryPending
    ? planNoteTexts({ t, language: i18n?.language || 'de', editingPlannedStep, boundary: planBoundary, around: plannedAround })
    : []

  // Wo „Beginnt am" auf der Seite „Geplante Aenderungen" hin darf.
  const reviewMinDate = planEditContext
    ? laterLocalDay(nextLocalDate(planEditContext.timeZone), planBoundary ? shiftLocalDay(planBoundary, 1) : '')
    : ''

  // Ein Tag, an dem eine andere Stufe beginnt oder bis eben begann. Nur ein
  // Tag, den eine entfernte Stufe frei macht, ist wieder frei.
  function reviewDateProblem(step: ReviewStep, all: readonly ReviewStep[]): string | undefined {
    return effectiveDateProblem(step.date || null, reviewMinDate, day => all.some(other => (
      other.versionId !== step.versionId && !other.removed && (other.date === day || other.originalDate === day)
    ))) ?? undefined
  }

  async function handleSave(allowDuplicate = false): Promise<void> {
    if (saving) return
    setSaveError(null)
    setSaveErrorDetail(null)
    // Erst der offene Schritt, dann der ganze Eintrag — wie ihn der
    // Speicherdienst prueft. Im Modus „Einnahmeplan" sieht der Assistent die
    // Substanz-Schritte nicht; fehlte dort etwas, kam frueher nur „konnte
    // nicht gespeichert werden".
    const invalidField = firstInvalidField(state, !metadataOnly)
      ?? (planEditContext ? null : firstInvalidField({ ...state, step: 'review' }, !metadataOnly))
    if (invalidField) {
      zeigeFehlendesFeld(invalidField)
      return
    }

    if (intent === 'pk') {
      const linkedProfileId = selectedPkCatalogEntry?.pk_profile_id ?? null
      const readiness = evaluatePkReadiness({
        trackingLevel: state.draft.trackingLevel,
        pkProfileId: linkedProfileId,
        pkProfileMethod,
        pkProfileRoutes: pkRoutes,
        method: state.draft.plan.method,
        dose: fuehrendeMenge(state.draft.plan.slots),
        unit: state.draft.plan.unit,
        // Die PK-Kurve braucht EINEN Startzeitpunkt. Bei mehreren Einnahmen
        // am Tag ist das die erste mit gesetzter Uhrzeit.
        scheduledAt: state.draft.plan.slots.find(slot => slot.time?.trim())?.time ?? null,
      })
      if (readiness.status !== 'ready') {
        const field = readiness.status === 'unsupported'
          ? readiness.reason === 'unit_conversion' ? 'plan.unit'
            : readiness.reason === 'route' ? 'plan.method' : 'pkProfileMethod'
          : readiness.missing[0] === 'complete_tracking' ? 'trackingLevel'
            : readiness.missing[0] === 'dose' ? 'plan.dose'
              : readiness.missing[0] === 'unit' ? 'plan.unit'
                : readiness.missing[0] === 'time' ? 'plan.slots.0.routineGroup'
                  : state.draft.plan.method.trim() ? 'pkProfileMethod' : 'plan.method'
        setPkIntentError(String(readiness.status === 'unsupported' && readiness.reason === 'route'
          ? t('my_stack_pk_route_mismatch_save')
          : t('my_stack_pk_requirements_missing', {
              defaultValue: 'Vervollständige und bestätige alle PK-Angaben, bevor du speicherst.',
            })))
        focusField(field)
        return
      }
    }

    // Angaben zur Packung, die die Datenbank ablehnen wuerde — vorher sagen.
    // Auch beim Anlegen: seit Anmischen und Haltbarkeit dort gefragt werden.
    if (!planEditContext) {
      const field = !gueltigeFluessigkeit(state.draft.inventory.reconstitutionMl)
        ? 'inventory.reconstitutionMl'
        : !gueltigeHaltbarkeit(state.draft.inventory.useWithinDays) ? 'inventory.useWithinDays' : null
      if (field) {
        // Die Haltbarkeit steht in der Zusammensetzung, die Fluessigkeit beim
        // Pulver-Vial auch; beim Bearbeiten einer fertigen Loesung unter Produkt.
        const schritt: WizardStep = field === 'inventory.useWithinDays' || anmischenImStaerkeSchritt ? 'strength' : 'plan'
        if (state.step !== schritt && steps.includes(schritt)) selectStep(schritt)
        setSaveError(String(t(field === 'inventory.reconstitutionMl' ? 'my_stack_stock_liquid_invalid' : 'my_stack_stock_days_invalid')))
        // Beim Pulver-Vial ist die Fluessigkeit der Bezug der Zutat.
        focusField(field === 'inventory.reconstitutionMl' && anmischenImStaerkeSchritt ? 'ingredients.0.basisValue' : field)
        return
      }
    }

    // Was der Assistent nicht als Feld kennt, prueft der Dienst trotzdem —
    // etwa einen unvollstaendigen Bestand. Dieselbe Pruefung, vorher.
    if (!planEditContext) {
      const draftToCheck = { ...state.draft, pkProfileMethod }
      const probleme = metadataOnly ? stackItemProblems(draftToCheck) : stackItemSetupProblems(draftToCheck)
      if (probleme.length > 0) {
        zeigeFehlendenBereich(probleme.includes('inventory')
          ? t('my_stack_inventory_summary', { defaultValue: 'Bestand' })
          : probleme.join(', '))
        return
      }
    }

    if (identityChanged && !identityChoiceMade) {
      setIdentityChoiceError(true)
      focusField('saveMode')
      return
    }

    const draftWithPkMethod = { ...state.draft, pkProfileMethod }
    const duplicate = findDuplicate(existingItems, draftWithPkMethod)
    if (duplicate && !allowDuplicate) {
      setDuplicateCandidate(duplicate)
      setSaveError(null)
      return
    }

    const mode: WizardSaveMode = allowDuplicate
      ? 'duplicate'
      : identityChanged ? state.saveMode : state.original ? 'update' : 'create'
    const draftForSave = mode === 'duplicate'
      ? { ...draftWithPkMethod, id: undefined, plan: { ...state.draft.plan, id: undefined } }
      : draftWithPkMethod

    const effectiveDateError = planEditContext && planEffective.kind === 'date'
      ? effectiveDateProblem(planEffective.localDate)
      : null
    if (effectiveDateError) {
      setSaveError(effectiveDateError)
      return
    }

    // Liegen hinter dem Tag schon Stufen, erst die Seite „Geplante
    // Aenderungen" — gespeichert wird dort mit „Bestaetigen".
    if (planEditContext && planBefore && !reviewOpen && plannedAround.after.length > 0) {
      const fresh = buildReview({
        base: planScheduleSnapshot(planBefore, draftForSave.trackingLevel),
        changed: planScheduleSnapshot(draftForSave.plan, draftForSave.trackingLevel),
        after: plannedAround.after,
      })
      setReview(review ? carryOverReview(review, fresh) : fresh)
      setReviewOpen(true)
      setReviewErrors({})
      setSaveError(null)
      focusField('planReview')
      return
    }

    const mainSnapshot = planScheduleSnapshot(draftForSave.plan, draftForSave.trackingLevel)
    const laterChanges: LaterStepChange[] = []
    if (review && reviewOpen) {
      const errors: Record<string, ReviewStepErrors> = {}
      const kept: { step: ReviewStep; snapshot: PlanScheduleSnapshot }[] = []
      for (const step of review) {
        if (step.removed) {
          laterChanges.push({ kind: 'remove', versionId: step.versionId })
          continue
        }
        const date = reviewDateProblem(step, review)
        const snapshot = reviewedSnapshot(step)
        if (date || !snapshot) {
          errors[step.versionId] = {
            date,
            amount: snapshot ? undefined : String(t('my_stack_plan_review_amount_invalid', {
              defaultValue: 'Gib für jede Einnahme eine Menge größer als 0 ein.',
            })),
          }
        } else {
          kept.push({ step, snapshot })
        }
      }
      setReviewErrors(errors)
      if (Object.keys(errors).length > 0) return
      // Jede Stufe wird an der davor gemessen: der neue Plan, dann die
      // geplanten in ihrer (neuen) Reihenfolge.
      let previous = mainSnapshot
      // Auch eine unveraenderte Stufe wird neu geschrieben, wenn sich ihre
      // Art gegenueber der neuen Stufe davor aendert (Dosis oder Plan).
      for (const { step, snapshot } of kept.sort((left, right) => left.step.date.localeCompare(right.step.date))) {
        const changeKind = changeKindFor(previous, snapshot, step.changeKind === 'titration' ? 'titration' : 'dose')
        if (reviewStepChanged(step, snapshot) || changeKind !== step.changeKind) {
          laterChanges.push({
            kind: 'replace',
            versionId: step.versionId,
            effectiveLocalDate: step.date,
            schedule: snapshot,
            changeKind,
          })
        }
        previous = snapshot
      }
    }

    setSaving(true)
    setSaveError(null)
    setSaveErrorDetail(null)
    try {
      if (planEditContext) {
        if (!onSavePlanChange) throw new Error('Plan change handler is required')
        await onSavePlanChange({
          target: planEditContext.target,
          snapshot: mainSnapshot,
          effective: planEffective,
          changeKind: changeKindFor(
            planScheduleSnapshot(
              editingPlannedStep ? planEditContext.baseline ?? planEditContext.snapshot : planBefore ?? planEditContext.snapshot,
              draftForSave.trackingLevel,
            ),
            mainSnapshot,
            planEditContext.changeKind,
          ),
          timeZone: planEditContext.timeZone,
          laterChanges,
        })
      } else {
        await onSave(draftForSave, mode, setupIdempotencyKey)
      }
      onClose()
    } catch (error) {
      // Den Grund nicht verschlucken: in der Konsole ganz, in der Meldung als
      // kleine technische Zeile. Sonst bleibt nur „konnte nicht gespeichert
      // werden", und niemand kann sagen, woran es lag.
      console.error('[StackItemWizard] Speichern fehlgeschlagen', error)
      reportError(error, planEditContext ? 'stack-item-wizard.plan-change' : 'stack-item-wizard.save')
      setSaveError(String(t('my_stack_save_error', {
        defaultValue: 'Speichern ist fehlgeschlagen. Deine Eingaben bleiben erhalten. Bitte versuche es erneut.',
      })))
      setSaveErrorDetail(fehlerText(error))
    } finally {
      setSaving(false)
    }
  }

  function ingredientName(ingredient: StackItemSetupDraft['ingredients'][number], index: number): string {
    const fallback = String(t(`my_stack_ingredient_${index + 1}`))
    return ingredient.catalog_substance_id
      ? catalogNames[ingredient.catalog_substance_id] ?? fallback
      : ingredient.custom_name || fallback
  }

  /** „5 mg / 1 ml" — ohne haengenden Schraegstrich, wenn etwas fehlt. */
  function ingredientStrength(ingredient: StackItemSetupDraft['ingredients'][number]): string {
    const menge = ingredient.amount_value != null && ingredient.amount_unit
      ? `${ingredient.amount_value} ${ingredient.amount_unit}`
      : ''
    const basis = ingredient.basis_value != null && ingredient.basis_unit
      ? `${ingredient.basis_value} ${ingredient.basis_unit}`
      : ''
    return menge && basis ? `${menge} / ${basis}` : menge
  }

  /** „Angebrochen am 20.10. · haltbar bis 17.11." — oder leer, wenn nichts eingetragen ist. */
  function haltbarkeitZeile(): string {
    const { dosageForm, category, inventory } = state.draft
    const sprache = i18n?.language || 'de'
    const art = haltbarkeitArt(dosageForm, category)
    const bis = art ? aufbrauchenBis(inventory.openedAt, inventory.useWithinDays, inventory.expiresAt) : null
    return [
      art && inventory.openedAt ? `${t(`my_stack_shelf_opened_${art}`)} ${formatLocalDay(inventory.openedAt, sprache)}` : '',
      art && !bis && inventory.useWithinDays != null
        ? `${t(`my_stack_shelf_within_${art}`)} ${t('my_stack_stock_days_multiple', { n: inventory.useWithinDays })}`
        : '',
      bis ? `${t('my_stack_shelf_use_by')} ${formatLocalDay(bis, sprache)}` : '',
      !bis && inventory.expiresAt ? `${t('my_stack_shelf_expiry')} ${formatLocalDay(inventory.expiresAt, sprache)}` : '',
    ].filter(Boolean).join(' · ')
  }

  function editSectionLabel(section: EditSection): string {
    switch (section.id) {
      case 'substance': return String(t('my_stack_step_substance', { defaultValue: 'Substanz' }))
      case 'composition': return String(t('my_stack_edit_section_composition', { defaultValue: 'Zusammensetzung' }))
      case 'product': return String(t('my_stack_edit_section_product', { defaultValue: 'Produkt & Notizen' }))
    }
  }

  function editSectionValue(section: EditSection) {
    const { draft } = state
    switch (section.id) {
      case 'substance':
        // Form und Farbe waehlt man auf derselben Seite — sie stehen hier mit.
        return (
          <>
            <span className="block break-words text-sm font-semibold text-slate-100">{draft.displayName}</span>
            <span className="flex items-center gap-2 text-sm text-slate-400">
              {showsColor(draft.dosageForm ?? 'other') && draft.colorHex && (
                <span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: draft.colorHex }} />
              )}
              {[draft.category ? t(`stack_category_${draft.category}`) : '', draft.dosageForm ? t(`dosage_form_${draft.dosageForm}`) : '']
                .filter(Boolean).join(' · ')}
            </span>
          </>
        )
      case 'composition': {
        // Die Haltbarkeit gehoert zur Zusammensetzung — auch in der
        // Uebersicht, sonst sucht man sie unter „Produkt".
        const haltbarkeit = haltbarkeitZeile()
        return (
          <>
            {draft.ingredients.map((ingredient, index) => {
              const name = ingredientName(ingredient, index)
              const staerke = ingredientStrength(ingredient)
              return (
                <span key={ingredient.position} className="block break-words text-sm font-semibold text-slate-100">
                  {draft.ingredients.length > 1 && staerke ? `${name} · ${staerke}` : staerke || name}
                </span>
              )
            })}
            {draft.trackingLevel !== 'complete' && (
              <span className="block text-sm text-slate-400">{t('my_stack_strength_skipped_title')}</span>
            )}
            {haltbarkeit && (
              <span data-edit-summary-haltbarkeit className="block break-words text-sm text-slate-400">{haltbarkeit}</span>
            )}
          </>
        )
      }
      case 'product': {
        const angaben = [
          draft.brand.trim(),
          draft.inventory.batchNumber.trim()
            ? `${t('my_stack_stock_batch', { defaultValue: 'Charge' })} ${draft.inventory.batchNumber.trim()}`
            : '',
        ].filter(Boolean)
        const notiz = draft.notes.trim()
        if (angaben.length === 0 && !notiz) {
          return <span className="block text-sm text-slate-500">{t('my_stack_edit_product_empty', { defaultValue: 'Noch keine Angaben' })}</span>
        }
        return (
          <>
            {angaben.length > 0 && <span className="block break-words text-sm font-semibold text-slate-100">{angaben.join(' · ')}</span>}
            {notiz && <span className="line-clamp-2 break-words text-sm text-slate-400">{notiz}</span>}
          </>
        )
      }
    }
  }

  function renderEditOverview() {
    return (
      <ul data-edit-overview className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
        {sections.map(section => (
          <li key={section.id}>
            <button
              type="button"
              data-edit-section={section.id}
              onClick={() => selectStep(section.steps[0])}
              className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 motion-reduce:transition-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{editSectionLabel(section)}</span>
                <span className="mt-1 block">{editSectionValue(section)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-sky-300">
                {t('my_stack_edit_change', { defaultValue: 'Ändern' })}
                <ChevronRight aria-hidden="true" size={16} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  function renderStep() {
    switch (state.step) {
      case 'substance': {
        // Form und Farbe stehen unter dem Treffer, sobald feststeht, WAS es
        // ist: ein Katalogeintrag oder ein eigener Name mit Kategorie.
        const identitaet = identitaetFeststeht
        return (
          <div className="space-y-6">
          <SubstanceSearch
            query={state.draft.displayName}
            entries={matchingEntries}
            allEntries={catalogEntries}
            category={state.draft.category}
            selectedEntry={selectedCatalogEntry ?? null}
            catalogUnavailable={catalogUnavailable}
            nameError={showErrors && !state.draft.displayName.trim()}
            categoryError={showErrors && !state.draft.category}
            onQueryChange={value => {
              dispatch({ type: 'custom_started', name: value })
              setShowErrors(false)
            }}
            onSelect={entry => {
              dispatch({
                type: 'catalog_selected',
                entry,
                components: bestandteileAufloesen(entry, catalogEntries),
              })
              // Die erste Form, die der Katalog kennt, ist vorausgewaehlt —
              // alle anderen stehen trotzdem in der Reihe.
              // Eine schon gewaehlte, ebenfalls empfohlene Form bleibt.
              const vorschlaege = (entry.suggested_dosage_forms ?? []).filter(form => DOSAGE_FORMS.some(bekannt => bekannt.key === form))
              const empfohlen = state.draft.dosageForm && vorschlaege.includes(state.draft.dosageForm) ? null : vorschlaege[0]
              if (empfohlen) {
                dispatch({ type: 'dosage_form_selected', dosageForm: empfohlen, catalogSuggestedUnits: entry.suggested_units })
              }
              setEigeneBestaetigt(false)
              setShowErrors(false)
            }}
            onAddCustom={name => {
              dispatch({ type: 'custom_started', name })
              setEigeneBestaetigt(true)
              setShowErrors(false)
            }}
            onDetach={() => {
              // Nach dem Loesen steht wieder die Suche da, mit dem Namen —
              // eigene Substanz wird es erst auf ausdruecklichen Wunsch.
              setEigeneBestaetigt(false)
              dispatch({ type: 'catalog_detached' })
            }}
            customConfirmed={eigeneFeststeht}
            onUndoCustom={() => setEigeneBestaetigt(false)}
            onCategoryChange={category => dispatch({ type: 'category_selected', category })}
            question={editOverview
              ? String(t('my_stack_edit_substance_question', { defaultValue: 'Welche Substanz ist es?' }))
              : undefined}
            onScan={scanErlaubt ? () => setScanOffen(true) : undefined}
          />
          {identitaet && (
            <FormUndFarbe
              key={selectedCatalogEntry?.id ?? 'eigen'}
              value={state.draft.dosageForm}
              suggestedForms={selectedCatalogEntry?.suggested_dosage_forms ?? []}
              colorHex={state.draft.colorHex}
              displayName={state.draft.displayName}
              error={showErrors && Boolean(validationErrors.dosageForm)}
              onSelect={dosageForm => {
                dispatch({
                  type: 'dosage_form_selected',
                  dosageForm,
                  catalogSuggestedUnits: selectedCatalogEntry?.suggested_units,
                })
                setShowErrors(false)
              }}
              onColorChange={colorHex => dispatch({ type: 'details_changed', changes: { colorHex } })}
            />
          )}
          </div>
        )
      }
      case 'ingredients':
        return (
          <IngredientEditor
            ingredients={state.draft.ingredients}
            catalogNames={catalogNames}
            catalogEntries={catalogEntries}
            errors={validationErrors.ingredients}
            onIngredientChange={(index, changes) => dispatch({ type: 'ingredient_changed', index, changes })}
            onAddIngredient={() => dispatch({ type: 'ingredient_added' })}
            onRemoveIngredient={index => dispatch({ type: 'ingredient_removed', index })}
          />
        )
      case 'strength':
        return state.draft.dosageForm ? (
          <div className="space-y-4">
            {state.draft.trackingLevel !== 'complete' ? (
              <div data-strength-skipped className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-white">{t('my_stack_strength_skipped_title')}</span>{' '}
                  {/* Aeltere Eintraege haken nur ab — dort wird auch keine Menge gefuehrt. */}
                  {state.draft.trackingLevel === 'intake_only'
                    ? t('my_stack_tracking_intake_only_subtitle', { defaultValue: 'Nur Einnahme' })
                    : t('my_stack_strength_skipped_text')}
                </p>
                <button
                  type="button"
                  data-strength-unskip
                  onClick={() => dispatch({ type: 'tracking_level_selected', trackingLevel: 'complete' })}
                  className="min-h-11 text-sm font-semibold text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  {t('my_stack_strength_unskip')}
                </button>
              </div>
            ) : (
            <>
            {state.draft.ingredients.map((ingredient, index) => (
              <StrengthEditor
                key={`${ingredient.position}-${ingredient.catalog_substance_id ?? 'custom'}`}
                dosageForm={state.draft.dosageForm!}
                category={state.draft.category}
                ingredient={ingredient}
                ingredientIndex={index}
                ingredientName={ingredient.catalog_substance_id
                  ? catalogNames[ingredient.catalog_substance_id]
                  : ingredient.custom_name}
                errors={validationErrors.ingredients?.[index]}
                onChange={changes => dispatch({ type: 'ingredient_changed', index, changes })}
              />
            ))}
            {/* Die Tuer steht genau dort, wo der Zutatenschritt fehlt.
                Wer manuell anlegt, geht ohnehin durch ihn und hat den Knopf
                dort; wer einen Katalogeintrag gewaehlt hat, saesse ohne das
                hier fest, sobald sein Produkt ein Blend ist, den der Katalog
                nicht kennt. Der Knopf legt die Zeile an UND geht in den
                Schritt, denn der Name laesst sich nur dort eintragen — und
                die leere Zeile bringt ihn gerade zurueck. */}
            {zutatenAusDemKatalog(state.draft.ingredients) && (
              <button
                type="button"
                data-wizard-action="add-ingredient"
                onClick={() => {
                  dispatch({ type: 'ingredient_added' })
                  dispatch({ type: 'step_selected', step: 'ingredients' })
                }}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-sm font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white"
              >
                <Plus size={15} />
                {t('my_stack_strength_add_ingredient', { defaultValue: 'Weiterer Wirkstoff' })}
              </button>
            )}
            {/* Wer die Staerke nicht kennt, trackt mit Menge — frueher eine
                eigene Frage nach der Tracking-Tiefe. */}
            <button
              type="button"
              data-strength-skip
              onClick={() => {
                dispatch({ type: 'tracking_level_selected', trackingLevel: 'with_amount' })
                setShowErrors(false)
              }}
              className="min-h-11 text-sm font-semibold text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {t('my_stack_strength_skip')}
            </button>
            </>
            )}
            <HaltbarkeitAngaben
              dosageForm={state.draft.dosageForm}
              category={state.draft.category}
              inventory={state.draft.inventory}
              onChange={changes => dispatch({ type: 'inventory_changed', changes })}
            />
          </div>
        ) : null
      case 'plan':
        return state.draft.dosageForm ? (
          <div className="space-y-5">
            {planEditContext && (
              <fieldset className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <legend className="px-1 text-sm font-semibold text-slate-200">
                  {t('my_stack_plan_effective_title', { defaultValue: 'Gültig ab' })}
                </legend>
                {planEditContext.target.mode === 'new_change' && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-3 text-sm font-semibold text-slate-200">
                      <input
                        type="radio"
                        name="plan-effective-kind"
                        checked={planEffective.kind === 'now'}
                        onChange={() => chooseEffective({ kind: 'now', localDate: null })}
                        className="h-5 w-5 accent-sky-400"
                      />
                      {t('my_stack_plan_effective_now', { defaultValue: 'Ab sofort' })}
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-3 text-sm font-semibold text-slate-200">
                      <input
                        type="radio"
                        name="plan-effective-kind"
                        checked={planEffective.kind === 'date'}
                        onChange={() => chooseEffective({
                          kind: 'date',
                          localDate: planEffective.localDate ?? earliestEffectiveDate,
                        })}
                        className="h-5 w-5 accent-sky-400"
                      />
                      {t('my_stack_plan_effective_date', { defaultValue: 'Ab Datum' })}
                    </label>
                  </div>
                )}
                {(planEditContext.target.mode === 'replace_future' || planEffective.kind === 'date') && (
                  <input
                    type="date"
                    aria-label={String(t('my_stack_plan_effective_date', { defaultValue: 'Ab Datum' }))}
                    value={planEffective.localDate ?? ''}
                    min={earliestEffectiveDate ?? undefined}
                    max={latestEffectiveDate ?? undefined}
                    onChange={event => chooseEffective({
                      kind: 'date',
                      localDate: event.target.value || null,
                    })}
                    required
                    className="input mt-3 min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  />
                )}
                {planNotes.length > 0 && (
                  <div data-plan-notes className="mt-3 space-y-2">
                    {planNotes.map(note => (
                      <p key={note} className="flex items-start gap-2 rounded-xl bg-sky-400/[0.07] px-3 py-2.5 text-sm leading-relaxed text-sky-100">
                        <Info aria-hidden="true" className="mt-0.5 shrink-0 text-sky-300" size={16} />
                        {note}
                      </p>
                    ))}
                  </div>
                )}
              </fieldset>
            )}
            {!metadataOnly && <IntakePlanEditor
              scheduleOnly={Boolean(planEditContext)}
              compactSchedule={Boolean(planEditContext)}
              trackingLevel={state.draft.trackingLevel}
              plan={state.draft.plan}
              dosageForm={state.draft.dosageForm}
              catalogEntry={selectedCatalogEntry}
              errors={planValidationErrors}
              onChange={changes => {
                dispatch({ type: 'plan_changed', changes })
                setPkIntentError(null)
              }}
            />}
            {!planEditContext && state.draft.trackingLevel === 'complete' && selectedPkCatalogEntry?.pk_profile_id && (
              <fieldset
                data-field="pkProfileMethod"
                tabIndex={-1}
                className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <legend className="px-1 text-sm font-semibold text-sky-100">
                  {pkRoutes.length
                    ? t('my_stack_pk_route_title')
                    : t('my_stack_pk_method_title', { defaultValue: 'PK-Route bestätigen' })}
                </legend>
                {pkRoute === 'covered' ? (
                  <p className="mt-2 text-sm leading-relaxed text-slate-200" data-pk-route="covered">
                    {t('my_stack_pk_route_covered', { method: methodLabel(t, planMethod) })}
                  </p>
                ) : pkRoute === 'mismatch' ? (
                  <p className="mt-2 text-sm leading-relaxed text-amber-200" data-pk-route="mismatch">
                    {t('my_stack_pk_route_mismatch', {
                      method: methodLabel(t, planMethod),
                      routes: pkRoutes.map(route => methodLabel(t, route)).join(' / '),
                    })}
                  </p>
                ) : (
                <label className="mt-2 flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-200">
                  <input
                    type="checkbox"
                    aria-label={String(t('my_stack_pk_method_confirm', { defaultValue: 'PK-Route bestätigen' }))}
                    checked={Boolean(
                      state.draft.plan.method.trim()
                      && pkProfileMethod?.trim().toLocaleLowerCase()
                        === state.draft.plan.method.trim().toLocaleLowerCase(),
                    )}
                    disabled={!state.draft.plan.method.trim()}
                    onChange={event => {
                      setPkProfileMethod(event.target.checked ? state.draft.plan.method.trim() : null)
                      setPkIntentError(null)
                    }}
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span>
                    {state.draft.plan.method.trim()
                      ? t('my_stack_pk_method_confirm_copy', {
                          defaultValue: 'Ich bestätige {{method}} als Route für das verknüpfte PK-Profil.',
                          method: methodLabel(t, state.draft.plan.method),
                        })
                      : t('my_stack_pk_method_choose_first', {
                          defaultValue: 'Wähle zuerst eine Route im Einnahmeplan.',
                        })}
                  </span>
                </label>
                )}
                {pkIntentError && (
                  <p role="alert" className="mt-2 text-sm text-rose-300">{pkIntentError}</p>
                )}
              </fieldset>
            )}

            {/* Beim Anlegen stehen Marke und Bestand im Ueberblick.
                Beim Bearbeiten die Marke und die Angaben zur Packung
                (Charge, Anmischen, Haltbarkeit) — die Mengen aendert
                „Bestand aendern" im Vollbild.
                Wer nur den Plan aendert (Stufe hinzufuegen, Plan anpassen),
                sieht weder Produkt noch Notizen — die gehoeren zur Substanz,
                nicht zu einer Dosisstufe; gespeichert wird dort ohnehin nur
                der Plan. */}
            {!planEditContext && existingItem && (
            <ProductInventorySection
              showInventory={false}
              haltbarkeitAnderswo
              anmischenAnderswo={anmischenImStaerkeSchritt}
              brand={state.draft.brand}
              inventory={state.draft.inventory}
              dosageForm={state.draft.dosageForm}
              category={state.draft.category}
              onBrandChange={brand => dispatch({ type: 'details_changed', changes: { brand } })}
              onInventoryChange={changes => dispatch({ type: 'inventory_changed', changes })}
            />
            )}

            {!planEditContext && (
            <div>
              <label htmlFor="stack-notes" className="mb-2 block text-sm font-semibold text-slate-200">
                {t('my_stack_notes_optional', { defaultValue: 'Notizen (optional)' })}
              </label>
              <textarea
                id="stack-notes"
                rows={4}
                value={state.draft.notes}
                onChange={event => dispatch({ type: 'details_changed', changes: { notes: event.target.value } })}
                className="input min-h-11 w-full resize-y text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
            </div>
            )}
          </div>
        ) : null
      case 'review': {
        const haltbarkeit = haltbarkeitZeile()
        return (
          <div className="space-y-5">
            {identityChanged && (
              <fieldset
                data-field="saveMode"
                tabIndex={-1}
                aria-invalid={identityChoiceError || undefined}
                aria-describedby={identityChoiceError ? 'stack-save-mode-error' : undefined}
                className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-4"
              >
                <legend className="px-1 text-sm font-semibold text-sky-100">
                  {t('my_stack_identity_changed', { defaultValue: 'Wie möchtest du mit der geänderten Variante fortfahren?' })}
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={identityChoiceMade && state.saveMode === 'update'}
                    onClick={() => chooseSaveMode('update')}
                    className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200 transition-colors duration-200 hover:border-sky-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
                  >
                    {t('my_stack_update_existing', { defaultValue: 'Bestehenden Eintrag ändern' })}
                  </button>
                  <button
                    type="button"
                    aria-pressed={identityChoiceMade && state.saveMode === 'duplicate'}
                    onClick={() => chooseSaveMode('duplicate')}
                    className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200 transition-colors duration-200 hover:border-sky-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
                  >
                    {t('my_stack_create_variant', { defaultValue: 'Als neue Variante anlegen' })}
                  </button>
                </div>
                {identityChoiceError && (
                  <p id="stack-save-mode-error" role="alert" className="mt-3 text-sm text-rose-300">
                    {t('my_stack_variant_choice_required', { defaultValue: 'Bitte wähle, wie die Variante gespeichert werden soll.' })}
                  </p>
                )}
              </fieldset>
            )}

            {editOverview ? renderEditOverview() : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <h3 className="font-semibold text-white">{state.draft.displayName}</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_category', { defaultValue: 'Kategorie' })}</dt>
                  <dd className="font-medium text-slate-200">{state.draft.category && t(`stack_category_${state.draft.category}`)}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_daily_behavior', { defaultValue: 'Im Alltag' })}</dt>
                  <dd className="text-right font-medium text-slate-200">
                    {state.draft.trackingLevel === 'intake_only'
                      ? t('my_stack_daily_intake_only', { defaultValue: 'Einnahme abhaken' })
                      : state.draft.trackingLevel === 'with_amount'
                        ? t('my_stack_daily_with_amount', { defaultValue: 'Einnahme und Menge festhalten' })
                        : t('my_stack_daily_complete', { defaultValue: 'Einnahme und Menge mit Produktkontext festhalten' })}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' })}</dt>
                  <dd className="font-medium text-slate-200">{state.draft.dosageForm && t(`dosage_form_${state.draft.dosageForm}`)}</dd>
                </div>
                {!metadataOnly && <>{state.draft.plan.method && (
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('methode')}</dt>
                  <dd data-review-method className="font-medium text-slate-200">{methodLabel(t, state.draft.plan.method)}</dd>
                </div>
                )}
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_plan_rhythm', { defaultValue: 'An welchen Tagen?' })}</dt>
                  <dd data-review-rhythm className="font-medium text-slate-200">{rhythmText(rhythmSummary(state.draft.plan.rhythm), t)}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{planEditContext
                    ? t('my_stack_plan_effective', { defaultValue: 'Gültig ab' })
                    : t('my_stack_plan_end_date', { defaultValue: 'Ende (optional)' })}</dt>
                  <dd data-review-end-date className="font-medium text-slate-200">
                    {planEditContext
                      ? planEffective.kind === 'now' ? t('my_stack_plan_effective_now', { defaultValue: 'Ab sofort' }) : planEffective.localDate
                      : state.draft.plan.endDate || t('my_stack_plan_end_open', { defaultValue: 'Offen' })}
                  </dd>
                </div>
                {/* Je Einnahmezeitpunkt eine Zeile. Vorher stand hier eine
                    einzige Tageszeit — bei „2x taeglich" hiesse das, die
                    Haelfte des Plans in der Zusammenfassung zu verschweigen. */}
                {state.draft.plan.slots.length === 0 ? (
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-slate-400">{t('my_stack_plan_routine_group', { defaultValue: 'Tageszeit' })}</dt>
                    <dd className="font-medium text-slate-200">{rhythmText(rhythmSummary(state.draft.plan.rhythm), t)}</dd>
                  </div>
                ) : state.draft.plan.slots.map((slot, index) => (
                  <div key={index} data-review-slot={index} className="flex flex-wrap justify-between gap-2">
                    <dt className="text-slate-400">
                      {/* An bestimmten Wochentagen sagt der Tag mehr als die
                          Nummer: „Mo" statt „Einnahme 1". */}
                      {state.draft.plan.rhythm.kind === 'weekdays' && slot.weekdays.length > 0
                        ? inWochenfolge(slot.weekdays).map(tag => weekdayLabel(tag, i18n?.language || 'de')).join(', ')
                        : state.draft.plan.slots.length > 1
                          ? t('einnahme_nr', { defaultValue: `Einnahme ${index + 1}`, n: index + 1 })
                          : t('my_stack_plan_routine_group', { defaultValue: 'Tageszeit' })}
                    </dt>
                    <dd className="font-medium text-slate-200">
                      {slot.routineGroup === 'morning'
                        ? t('my_stack_routine_morning', { defaultValue: 'Morgens' })
                        : slot.routineGroup === 'midday'
                          ? t('my_stack_routine_midday', { defaultValue: 'Mittags' })
                          : t('my_stack_routine_evening', { defaultValue: 'Abends' })}
                      {slot.time ? ` · ${slot.time}` : ''}
                      {state.draft.trackingLevel !== 'intake_only' && slot.dose != null
                        ? ` · ${slot.dose} ${state.draft.plan.unit ?? ''}`.trimEnd()
                        : ''}
                    </dd>
                  </div>
                ))}
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_plan_quantity_summary', { defaultValue: 'Menge' })}</dt>
                  <dd className="font-medium text-slate-200">
                    {state.draft.trackingLevel === 'intake_only'
                      ? t('my_stack_quantity_not_tracked', { defaultValue: 'Menge wird nicht getrackt' })
                      : `${fuehrendeMenge(state.draft.plan.slots) ?? ''} ${state.draft.plan.unit ?? ''}`.trim()}
                  </dd>
                </div>
                </>}
                {state.draft.trackingLevel === 'complete' && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-slate-400">{t('my_stack_pk_status', { defaultValue: 'PK-Status' })}</dt>
                    <dd className="text-right font-medium text-slate-200">
                      {selectedPkCatalogEntry?.pk_profile_id
                        ? t('my_stack_pk_available', { defaultValue: 'PK-Profil verfügbar; Kurve abhängig von vollständigen Angaben' })
                        : t('my_stack_pk_unavailable', { defaultValue: 'Kein PK-Profil hinterlegt' })}
                    </dd>
                  </div>
                )}
                {state.draft.brand.trim() && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-slate-400">{t('my_stack_brand', { defaultValue: 'Marke' })}</dt>
                    <dd className="break-words font-medium text-slate-200">{state.draft.brand}</dd>
                  </div>
                )}
                {state.draft.inventory.enabled && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-slate-400">
                      {t('my_stack_inventory_summary', { defaultValue: 'Bestand' })}
                    </dt>
                    <dd className="font-medium text-slate-200">
                      {state.draft.inventory.remainingQuantity} {state.draft.inventory.packageUnit}
                    </dd>
                  </div>
                )}
                {state.draft.trackingLevel === 'complete' && state.draft.ingredients.map((ingredient, index) => (
                  <div key={ingredient.position} className="border-t border-white/10 pt-3">
                    <dt className="text-slate-400">{ingredientName(ingredient, index)}</dt>
                    <dd className="mt-1 break-words font-medium text-slate-200">{ingredientStrength(ingredient)}</dd>
                  </div>
                ))}
                {haltbarkeit && (
                  <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-3">
                    <dt className="text-slate-400">{t('my_stack_shelf_life', { defaultValue: 'Haltbarkeit' })}</dt>
                    <dd data-review-haltbarkeit className="text-right font-medium text-slate-200">{haltbarkeit}</dd>
                  </div>
                )}
              </dl>
            </div>
            )}

            {/* Beim Anlegen: Marke und Bestand hier, offen — wer Vorraete
                fuehrt, schaltet es mit einem Tipp an. Ob jemand Vorraete
                fuehrt, hat mit der Messgenauigkeit nichts zu tun. */}
            {!existingItem && !planEditContext && !editOverview && (
              <ProductInventorySection
                haltbarkeitAnderswo
                anfangsOffen
                // Bestand bucht nur mit Staerke ab (`apply_inventory_confirmation`)
                // und wird auch nur dann gespeichert — ohne sie ein Hinweis
                // statt Feldern, die beim Speichern still wegfielen.
                bestandOhneStaerke={state.draft.trackingLevel !== 'complete'}
                brand={state.draft.brand}
                inventory={state.draft.inventory}
                dosageForm={state.draft.dosageForm}
                category={state.draft.category}
                onBrandChange={brand => dispatch({ type: 'details_changed', changes: { brand } })}
                onInventoryChange={changes => dispatch({ type: 'inventory_changed', changes })}
              />
            )}

            {duplicateCandidate && (
              <div role="alert" className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-300" size={19} />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-amber-100">
                      {t('my_stack_duplicate_found', { defaultValue: 'Diese Variante ist bereits in My Stack.' })}
                    </h3>
                    <p className="mt-1 break-words text-sm text-amber-100/80">{duplicateCandidate.display_name}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <button
                    ref={duplicateActionRef}
                    type="button"
                    onClick={() => {
                      if (saving) return
                      onOpenExisting(duplicateCandidate)
                      onClose()
                    }}
                    disabled={saving}
                    className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                  >
                    <ExternalLink aria-hidden="true" size={18} />
                    {t('my_stack_open_existing', { defaultValue: 'Bestehenden Eintrag öffnen' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave(true)}
                    disabled={saving}
                    className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-semibold text-slate-200 transition-colors duration-200 hover:border-sky-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                  >
                    {t('my_stack_add_separately', { defaultValue: 'Trotzdem separat hinzufügen' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (!saving) setDuplicateCandidate(null) }}
                    disabled={saving}
                    className="min-h-11 cursor-pointer rounded-xl px-4 py-3 font-semibold text-slate-400 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                  >
                    {t('cancel', { defaultValue: 'Abbrechen' })}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      }
    }
  }

  // Auf der Substanzseite erst, wenn feststeht, was es ist.
  const buehneZeigen = Boolean(state.draft.dosageForm && isStageRenderable(state.draft.dosageForm))
    && (state.step !== 'substance' || identitaetFeststeht)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/80 p-0 sm:items-center sm:p-3" data-app-modal data-app-back-dirty-on-interaction>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stack-item-wizard-title"
        aria-describedby="stack-item-wizard-description"
        onKeyDown={handleDialogKeyDown}
        className="lg-backdrop flex h-[100dvh] max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-1.5rem)] sm:max-w-2xl sm:rounded-[28px] sm:bg-[#1c1c1e]"
      >
        <header className="shrink-0 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--lg-text-3)]">
                {t('my_stack_title', { defaultValue: 'My Stack' })}
              </p>
              <h2 id="stack-item-wizard-title" className="mt-0.5 text-[24px] font-bold leading-[30px] tracking-[0.01em] text-[var(--lg-text)]">
                {planEditContext?.purpose === 'add_step'
                  ? t('my_stack_plan_add_step', { defaultValue: 'Stufe hinzufügen' })
                  : planEditContext?.purpose === 'adjust'
                    ? t('my_stack_plan_adjust_schedule', { defaultValue: 'Plan anpassen' })
                    : existingItem
                      ? t('my_stack_edit_item', { defaultValue: 'Eintrag bearbeiten' })
                      : t('my_stack_add_item', { defaultValue: 'Substanz hinzufügen' })}
              </h2>
              <p id="stack-item-wizard-description" className="mt-1 text-[15px] leading-relaxed text-[var(--lg-text-2)]">
                {editOverview && state.step === 'review'
                  ? t('my_stack_edit_overview_hint', { defaultValue: 'Was möchtest du ändern?' })
                  : currentSection?.id === 'product'
                    ? editSectionLabel(currentSection)
                    : t(STEP_LABELS[state.step].key, { defaultValue: STEP_LABELS[state.step].defaultValue })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { if (!saving) onClose() }}
              data-app-back-close
              disabled={saving}
              aria-label={String(t('close', { defaultValue: 'Schließen' }))}
              className="lg-glass lg-icon-btn lg-press min-h-11 min-w-11 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>

          {/* Wie viele Schritte es werden, haengt an der Tracking-Tiefe:
              sechs oder acht. Frueher war die Zahl anfangs offen (ein blasses
              Restfeld hinter den bekannten Schritten), weil die Tiefe noch
              nicht gewaehlt war und der Balken sonst VOLL aussah — 3 von 3 —
              und nach der Wahl auf 3 von 8 zuruecksprang. Seit der Entwurf
              mit „Gruendlich" startet, steht die Zahl von Anfang an fest.
              Stellt jemand auf eine flachere Stufe zurueck, wird der Balken
              voller, nicht leerer — die harmlose Richtung. */}
          {/* Beim Bearbeiten gibt es keinen Weg von vorn nach hinten — die
              Abschnitte werden einzeln geoeffnet. */}
          {!editOverview && <div
            className="mt-4 flex items-center gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuenow={currentStepIndex + 1}
            aria-valuemax={steps.length}
          >
            {steps.map((step, index) => (
              <span
                key={step}
                className={`h-[5px] flex-1 rounded-full transition-colors duration-300 ${index <= currentStepIndex ? 'bg-[var(--accent)]' : 'bg-white/[0.14]'}`}
              />
            ))}
          </div>}
        </header>

        {/* Die Buehne: ist eine Form gewaehlt, steht sie oben mittig — in fester
            Groesse auf jeder Seite, mit ihrer eigenen Bewegung (Schwappen,
            Rollen). Darunter laeuft der Inhalt weich aus statt an einer Kante
            (wie unter der Kugel im Kalorientracker); die Maske liegt auf dem
            Inhalt, damit es auf jedem Erscheinungsbild passt. Formen ohne
            Grafik (`other`) bekommen keine Buehne. */}
        {buehneZeigen && (
          <section data-wizard-stage aria-label={String(t('my_stack_preview', { defaultValue: 'Vorschau' }))} className="pointer-events-none flex h-44 shrink-0 flex-col items-center justify-end gap-1 px-4 pb-2">
            <span key={state.draft.dosageForm} className="stack-reveal flex min-h-0 flex-1 items-end justify-center" style={{ zoom: 1.55 }}>
              <DosageFormPreview
                dosageForm={state.draft.dosageForm!}
                colorHex={state.draft.colorHex}
                size="mini"
                showLabel={false}
                sloshEngine={sloshEngine}
              />
            </span>
            <span className="max-w-full truncate text-sm font-semibold text-white">
              {state.step === 'substance'
                ? t(`dosage_form_${state.draft.dosageForm}`)
                : state.draft.displayName.trim() || t('my_stack_this_substance', { defaultValue: 'diese Substanz' })}
            </span>
          </section>
        )}

        <main
          className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6"
          style={buehneZeigen ? { maskImage: 'linear-gradient(to bottom, transparent 0, #000 28px)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 28px)' } : undefined}
          data-step-autofocus
          tabIndex={-1}
        >
          {review && reviewOpen && planEditContext ? (
            <PlannedStepsReview
              steps={review}
              newPlan={planScheduleSnapshot(state.draft.plan, state.draft.trackingLevel)}
              boundary={planBoundary}
              minDate={reviewMinDate}
              maxDate={latestEffectiveDate}
              errors={reviewErrors}
              language={i18n?.language || 'de'}
              t={t}
              onChange={(versionId, changes) => setReview(current => current?.map(step => (
                step.versionId === versionId ? { ...step, ...changes } : step
              )) ?? null)}
            />
          ) : renderStep()}
          {saveError && (
            <div role="alert" className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] p-4 text-sm text-rose-100">
              <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
              <div className="min-w-0">
                <p>{saveError}</p>
                {saveErrorDetail && (
                  <p data-save-error-detail className="mt-1.5 break-words font-mono text-[11px] leading-snug text-rose-200/70">
                    {saveErrorDetail}
                  </p>
                )}
              </div>
            </div>
          )}
        </main>

        <footer className="flex shrink-0 gap-3 border-t border-[var(--lg-separator)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
          {/* Auf der Bearbeiten-Uebersicht gibt es kein Zurueck: dort liegen
              alle Aenderungen bis zum Speichern, und ein Pfeil, der schliesst,
              wuerde sie wortlos verwerfen. Schliessen bleibt oben am X. */}
          {!(editOverview && state.step === 'review') && <button
            type="button"
            onClick={handleBack}
            disabled={saving}
            className="lg-btn lg-glass lg-btn-glass min-h-11 min-w-12 !px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50 sm:!px-5"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            <span className="hidden sm:inline">
              {!editOverview && currentStepIndex === 0 && !reviewOpen ? t('cancel', { defaultValue: 'Abbrechen' }) : t('back', { defaultValue: 'Zurück' })}
            </span>
          </button>}

          {state.step === 'review' || ((intent === 'pk' || intent === 'plan') && currentStepIndex === steps.length - 1) ? (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || Boolean(duplicateCandidate)}
              className="lg-btn lg-btn-primary min-h-11 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={18} />
              ) : (
                <Save aria-hidden="true" size={18} />
              )}
              {saving
                ? t('loading', { defaultValue: 'Speichert …' })
                : reviewOpen
                  ? t('my_stack_plan_review_confirm', { defaultValue: 'Bestätigen' })
                  : plannedAround.after.length > 0
                    ? t('continue', { defaultValue: 'Weiter' })
                    : t('save', { defaultValue: 'Speichern' })}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleContinue}
              disabled={saving}
              className="lg-btn lg-btn-primary min-h-11 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {currentStepIndex === steps.length - 2 || lastInSection ? <Check aria-hidden="true" size={18} /> : <ArrowRight aria-hidden="true" size={18} />}
              {lastInSection ? t('my_stack_edit_done', { defaultValue: 'Fertig' }) : t('continue', { defaultValue: 'Weiter' })}
            </button>
          )}
        </footer>
      </div>
      {/* Neben dem Dialog, nicht darin: sonst finge die Tab-Schleife des
          Assistenten den Fokus des Sheets ein. */}
      {scanOffen && (
        <SubstanzScanner
          katalog={catalogEntries}
          onUebernehmen={scanUebernehmen}
          onClose={() => setScanOffen(false)}
        />
      )}
    </div>
  )
}
