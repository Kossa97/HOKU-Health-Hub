import { buildDuplicateFingerprint } from '../lib/duplicateFingerprint'
import { powderVialForSave } from '../lib/vialStrength'
import { fuehrendeMenge, rhythmToStorage } from '../lib/intakeRhythm'
import { validateIntakePlan, validateStackItemDraft } from '../lib/validation'
import {
  localDateTimeKey,
  type CyclePlanVersion,
  type PlanChangeKind,
  type PlanScheduleSnapshot,
} from '../../../lib/planTimeline'
import type { PlanEditTarget, PlanEffectiveDraft } from '../lib/wizardState'
import {
  createPlanVersion,
  replaceFuturePlanVersion,
  type PlanRpcClient,
} from './planLifecycle'
import type {
  DosageFormKey,
  IntakePlanDraft,
  StackCategory,
  StackItem,
  StackItemDraft,
  StackItemIngredient,
  StackItemSetupDraft,
  SubstanceCatalogEntry,
  TrackingLevel,
} from '../types'

interface ServiceError {
  message: string
}

export type SavedStackItemRow = Omit<StackItem, 'ingredients'>

export interface LoadedStackItemIngredient extends StackItemIngredient {
  substance_catalog: SubstanceCatalogEntry | null
}

export type LoadedStackItem = SavedStackItemRow & {
  ingredients: LoadedStackItemIngredient[]
}

interface StackItemQueryResult {
  data: LoadedStackItem[] | null
  error: ServiceError | null
}

interface StackItemMutationResult {
  error: ServiceError | null
}

interface StackItemArchiveUpdate {
  archived: boolean
  archived_at: string | null
}

interface StackItemReconstitutionUpdate {
  reconstitution_date: string
  vials_in_stock: number
  vials_initial: number
}

interface StackItemAutoLogUpdate {
  auto_log_since: string | null
}

interface SaveStackItemIngredient {
  catalog_substance_id: string | null
  custom_name: string
  amount_value: number | null
  amount_unit: string | null
  basis_value: number | null
  basis_unit: string | null
  position: number
}

export interface SaveStackItemRpcParams {
  p_item: {
    id: string | null
    display_name: string
    category: StackCategory
    tracking_level: TrackingLevel
    dosage_form: DosageFormKey
    brand: string | null
    color_hex: string | null
    notes: string | null
    pk_profile_method: string | null
    inventory?: {
      enabled: boolean
      package_quantity: number | null
      package_unit: string | null
      remaining_quantity: number | null
      batch_number: string | null
      expires_at: string | null
    }
  }
  p_ingredients: SaveStackItemIngredient[]
}

interface SaveIntakePlanParams {
  timezone?: string
  id: string | null
  name: string
  dose: number | null
  unit: string | null
  method: string
  frequency: string
  x_days_interval: number | null
  /** 'day' | 'week' | 'month' — nur bei „Alle X Tage" gesetzt. */
  interval_unit: string | null
  /** Wechselzyklus: X Tage an, Y Tage aus. */
  cycle_on_days: number | null
  cycle_off_days: number | null
  schedule_days: string[]
  start_date: string
  end_date: string | null
  /**
  * Die Tageszeiten der Einnahmezeitpunkte, kommagetrennt — „morgens,abends"
  * bei „2x taeglich". `resolveScheduleSlots` liest sie genau so.
  */
  intake_time: string
  /** Die genauen Uhrzeiten in derselben Reihenfolge; leer = Standardzeit. */
  intake_time_custom: string | null
  /** Die Mengen in derselben Reihenfolge; leer = die Menge des Zyklus. */
  slot_doses: string | null
  /**
   * Die Wochentage je Zeitpunkt, mit `|` getrennt: „Mo|Mi,Mo" heisst morgens
   * an Mo und Mi, abends nur an Mo. Leer = an jedem Tag des Rhythmus.
   */
  slot_days: string | null
  reminder: string
}

export interface SaveStackItemSetupRpcParams extends SaveStackItemRpcParams {
  p_plan: SaveIntakePlanParams
  p_idempotency_key: string
}

export interface StackItemRpcClient {
  rpc(
    name: 'save_stack_item',
    params: SaveStackItemRpcParams,
  ): PromiseLike<{ data: SavedStackItemRow | null; error: ServiceError | null }>
}

export interface StackItemSetupRpcClient {
  rpc(
    name: 'save_stack_item_with_plan',
    params: SaveStackItemSetupRpcParams,
  ): PromiseLike<{ data: SavedStackItemRow | null; error: ServiceError | null }>
}

export interface RemovePlanSegmentRpcParams {
  p_cycle_id: string
  p_effective_from: string
}

export interface PlanSegmentRpcClient {
  rpc(
    name: 'remove_plan_segment',
    params: RemovePlanSegmentRpcParams,
  ): PromiseLike<{ data: unknown; error: ServiceError | null }>
}

export interface StackItemQueryClient {
  from(table: 'stack_items'): {
    select(columns: string): {
      eq(column: 'archived', value: boolean): {
        order(
          column: 'created_at',
          options: { ascending: false },
        ): PromiseLike<StackItemQueryResult>
      }
    }
  }
}

export interface StackItemMutationClient {
  from(table: 'stack_items'): {
    update(values: StackItemArchiveUpdate | StackItemReconstitutionUpdate | StackItemAutoLogUpdate): {
      eq(column: 'id', value: string): PromiseLike<StackItemMutationResult>
    }
    delete(): {
      eq(column: 'id', value: string): PromiseLike<StackItemMutationResult>
    }
  }
}

const STACK_ITEM_INVENTORY_COLUMNS = `
  inventory:stack_item_inventory(
    id,
    enabled,
    package_quantity,
    package_unit,
    remaining_quantity,
    batch_number,
    expires_at,
    batch_source,
    batch_file_url,
    opened_at,
    use_within_days,
    reconstitution_ml
  )
`

const STACK_ITEM_INGREDIENT_FIELDS = `
    id,
    stack_item_id,
    catalog_substance_id,
    custom_name,
    amount_value,
    amount_unit,
    basis_value,
    basis_unit,
    position
`

const STACK_ITEM_INGREDIENT_CATALOG_COLUMNS = `
    substance_catalog(
      id,
      canonical_name,
      aliases,
      default_category,
      suggested_units,
      suggested_dosage_forms,
      pk_profile_id,
      active
    )
`

function stackItemIngredientColumns(includeCatalog: boolean): string {
  return `
    ingredients:stack_item_ingredients(
      ${STACK_ITEM_INGREDIENT_FIELDS}${includeCatalog ? `,${STACK_ITEM_INGREDIENT_CATALOG_COLUMNS}` : ''}
    )
  `
}

export function stackItemColumns(options: { includeInventory: boolean; includeIngredientCatalog: boolean }): string {
  return `
    *,
    ${options.includeInventory ? `${STACK_ITEM_INVENTORY_COLUMNS},` : ''}
    ${stackItemIngredientColumns(options.includeIngredientCatalog)}
  `
}

function throwIfError(error: ServiceError | null): void {
  if (error) throw new Error(error.message)
}

function nullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

function ingredientForSave(ingredient: StackItemIngredient): SaveStackItemIngredient {
  return {
    catalog_substance_id: nullableText(ingredient.catalog_substance_id ?? ''),
    custom_name: (ingredient.custom_name ?? '').trim(),
    amount_value: ingredient.amount_value,
    amount_unit: nullableText(ingredient.amount_unit ?? ''),
    basis_value: ingredient.basis_value,
    basis_unit: nullableText(ingredient.basis_unit ?? ''),
    position: ingredient.position,
  }
}

/**
 * Den Bestand schickt nur das Anlegen mit; ohne Angabe laesst
 * `save_stack_item` ihn in Ruhe. Sonst ueberschriebe jedes Bearbeiten den Rest
 * mit dem Stand von beim Oeffnen — oder schaltete ihn unterhalb von
 * „Gruendlich" ganz ab. Beim Bearbeiten gehen die Mengen ueber „Bestand
 * aendern", die Angaben zur Packung getrennt (`saveInventoryDetails`).
 */
function inventoryForSave(draft: StackItemDraft | StackItemSetupDraft): StackItemSetupDraft['inventory'] | undefined {
  if (draft.id || !('inventory' in draft)) return undefined
  return draft.inventory
}

function itemParams(
  draft: StackItemDraft,
  pkProfileMethod: string | null = null,
  inventory?: StackItemSetupDraft['inventory'],
): SaveStackItemRpcParams['p_item'] {
  return {
    id: draft.id ?? null,
    display_name: draft.displayName.trim(),
    category: draft.category as StackCategory,
    tracking_level: draft.trackingLevel,
    dosage_form: draft.dosageForm as DosageFormKey,
    brand: nullableText(draft.brand),
    color_hex: nullableText(draft.colorHex),
    notes: nullableText(draft.notes),
    pk_profile_method: nullableText(pkProfileMethod ?? ''),
    ...(inventory ? {
      inventory: {
        enabled: draft.trackingLevel === 'complete' && inventory.enabled,
        package_quantity: draft.trackingLevel === 'complete' && inventory.enabled
          ? inventory.packageQuantity
          : null,
        package_unit: draft.trackingLevel === 'complete' && inventory.enabled
          ? nullableText(inventory.packageUnit ?? '')
          : null,
        remaining_quantity: draft.trackingLevel === 'complete' && inventory.enabled
          ? inventory.remainingQuantity
          : null,
        batch_number: draft.trackingLevel === 'complete' && inventory.enabled
          ? nullableText(inventory.batchNumber)
          : null,
        expires_at: draft.trackingLevel === 'complete' && inventory.enabled
          ? inventory.expiresAt
          : null,
      },
    } : {}),
  }
}

const ROUTINE_INTAKE_TIME = {
  morning: 'morgens',
  midday: 'mittags',
  evening: 'abends',
} as const

/** Liegt mindestens ein Zeitpunkt nur an bestimmten Tagen? */
function hatEigeneTage(slots: readonly { weekdays: string[] }[]): boolean {
  return slots.some(slot => slot.weekdays.length > 0)
}

/** Tragen die Zeitpunkte verschiedene Mengen, oder ueberall dieselbe? */
function hatEigeneMengen(slots: readonly { dose: number | null }[]): boolean {
  return new Set(slots.map(slot => slot.dose)).size > 1
}

function planParams(
  plan: IntakePlanDraft,
  trackingLevel: TrackingLevel,
): SaveIntakePlanParams {
  // „Bei Bedarf" hat keinen geplanten Zeitpunkt. Die Tabelle verlangt trotzdem
  // eine Tageszeit; sie bedeutet dort nichts, denn `cycleAppliesToDay` plant
  // fuer diese Frequenz keinen Tag.
  const beiBedarf = plan.rhythm.kind === 'on_demand'
  return {
    id: plan.id ?? null,
    name: plan.name.trim(),
    // `cycles.dose` ist EINE Zahl und bleibt es — sie traegt die fuehrende
    // Menge, damit alles, was den Zyklus liest, weiter funktioniert. Die
    // Mengen der weiteren Zeitpunkte stehen daneben in `slot_doses`.
    dose: trackingLevel === 'intake_only' ? null : fuehrendeMenge(plan.slots),
    unit: trackingLevel === 'intake_only' ? null : nullableText(plan.unit ?? ''),
    method: plan.method.trim(),
    ...rhythmToStorage(plan.rhythm),
    start_date: plan.startDate.trim(),
    end_date: nullableText(plan.endDate ?? ''),
    // „Bei Bedarf" hat keinen geplanten Zeitpunkt. Die Tabelle verlangt
    // trotzdem eine Tageszeit — sie bleibt bei 'morgens' und bedeutet dort
    // nichts, denn `cycleAppliesToDay` plant fuer diese Frequenz keinen Tag.
    intake_time: beiBedarf || plan.slots.length === 0
      ? ROUTINE_INTAKE_TIME.morning
      : plan.slots.map(slot => ROUTINE_INTAKE_TIME[slot.routineGroup]).join(','),
    intake_time_custom: beiBedarf ? null : nullableText(
      plan.slots.some(slot => slot.time?.trim())
        ? plan.slots.map(slot => slot.time?.trim() ?? '').join(',')
        : '',
    ),
    // Nur wenn sich die Mengen ueberhaupt unterscheiden — bei einem Plan mit
    // einer einzigen Zahl bleibt die Spalte leer, wie bei jedem Zyklus zuvor.
    slot_doses: beiBedarf || trackingLevel === 'intake_only' || !hatEigeneMengen(plan.slots)
      ? null
      : plan.slots.map(slot => (slot.dose == null ? '' : String(slot.dose))).join(','),
    // Nur wenn sich die Zeitpunkte ueberhaupt nach Tagen unterscheiden. Ein
    // Plan, in dem alle an allen Tagen liegen, laesst die Spalte leer — wie
    // jeder Zyklus vor dieser Runde.
    slot_days: beiBedarf || !hatEigeneTage(plan.slots)
      ? null
      : plan.slots.map(slot => slot.weekdays.join('|')).join(','),
    reminder: plan.reminders.map(value => value.trim()).filter(Boolean).join(',') || 'none',
  }
}

export function planScheduleSnapshot(
  plan: IntakePlanDraft,
  trackingLevel: TrackingLevel,
): PlanScheduleSnapshot {
  const params = planParams(plan, trackingLevel)
  return {
    frequency: params.frequency,
    x_days_interval: params.x_days_interval,
    interval_unit: params.interval_unit,
    cycle_on_days: params.cycle_on_days,
    cycle_off_days: params.cycle_off_days,
    schedule_days: params.schedule_days,
    intake_time: params.intake_time,
    intake_time_custom: params.intake_time_custom,
    slot_doses: params.slot_doses,
    slot_days: params.slot_days,
    dose: params.dose,
    unit: params.unit,
    method: params.method,
  }
}

export interface SavePlanChangeOptions {
  changeKind: Exclude<PlanChangeKind, 'initial'>
  idempotencyKey: string
  timeZone: string
}

export async function savePlanChange(
  client: PlanRpcClient,
  target: PlanEditTarget,
  snapshot: PlanScheduleSnapshot,
  effective: PlanEffectiveDraft,
  options: SavePlanChangeOptions,
): Promise<CyclePlanVersion> {
  if (target.mode === 'new_change' && effective.kind === 'date'
    && (!effective.localDate || effective.localDate <= localDateTimeKey(new Date(), options.timeZone).slice(0, 10))) {
    throw new Error('Plan changes require a future local date or now')
  }
  if (target.mode === 'replace_future') {
    const localDate = effective.kind === 'date' ? effective.localDate : null
    const parsedDate = localDate && /^\d{4}-\d{2}-\d{2}$/.test(localDate)
      ? new Date(`${localDate}T00:00:00.000Z`)
      : null
    const validDate = parsedDate
      && !Number.isNaN(parsedDate.getTime())
      && parsedDate.toISOString().slice(0, 10) === localDate
    const today = localDateTimeKey(new Date(), options.timeZone).slice(0, 10)
    if (!validDate || localDate <= today) {
      throw new Error('Future plan replacement requires a future local date')
    }
  }

  const boundary = effective.kind === 'now'
    ? {
        effectiveKind: 'instant' as const,
        effectiveAt: new Date().toISOString(),
        effectiveLocalDate: null,
      }
    : {
        effectiveKind: 'local_date' as const,
        effectiveAt: null,
        effectiveLocalDate: effective.localDate ?? '',
      }

  if (effective.kind === 'date' && !effective.localDate) {
    throw new Error('Plan effective date is required')
  }

  if (target.mode === 'replace_future') {
    if (!target.versionId) throw new Error('Future plan version id is required')
    return replaceFuturePlanVersion(client, {
      versionId: target.versionId,
      ...boundary,
      changeKind: options.changeKind,
      schedule: snapshot,
      timeZone: options.timeZone,
      idempotencyKey: options.idempotencyKey,
    })
  }

  return createPlanVersion(client, {
    cycleId: target.cycleId,
    ...boundary,
    changeKind: options.changeKind,
    schedule: snapshot,
    timeZone: options.timeZone,
    effectiveNow: effective.kind === 'now',
    idempotencyKey: options.idempotencyKey,
  })
}

function stackItemAsDraft(item: StackItem): StackItemDraft {
  return {
    id: item.id,
    displayName: item.display_name,
    trackingLevel: item.tracking_level,
    category: item.category,
    dosageForm: item.dosage_form,
    brand: item.brand ?? '',
    colorHex: item.color_hex ?? '',
    notes: item.notes ?? '',
    ingredients: item.ingredients,
  }
}

export async function loadStackItems(
  client: StackItemQueryClient,
  archived: boolean,
  options: { includeInventory?: boolean; includeIngredientCatalog?: boolean } = {},
): Promise<LoadedStackItem[]> {
  const { data, error } = await client
    .from('stack_items')
    .select(stackItemColumns({
      includeInventory: options.includeInventory !== false,
      includeIngredientCatalog: options.includeIngredientCatalog !== false,
    }))
    .eq('archived', archived)
    .order('created_at', { ascending: false })

  throwIfError(error)
  // In der Datenbank ist `custom_name` bei Katalog-Zutaten oft NULL (aeltere
  // Eintraege, Migrationen). Der Client rechnet ueberall mit Text — ein NULL
  // liess das Speichern nach dem Bearbeiten abstuerzen (JAVASCRIPT-REACT-5).
  return (data ?? []).map(item => ({
    ...item,
    ingredients: (item.ingredients ?? []).map(zutat => ({ ...zutat, custom_name: zutat.custom_name ?? '' })),
  }))
}

/**
 * Was am Eintrag fehlt, bevor er gespeichert werden darf — als Liste von
 * Namen („displayName", „item.ingredients", …). Dieselbe Pruefung nutzen
 * Dienst und Assistent: der Assistent kann so VOR dem Speichern sagen, was
 * fehlt, statt dass es hier scheitert und nur „konnte nicht gespeichert
 * werden" ankommt.
 */
export function stackItemProblems(draft: StackItemDraft): string[] {
  return [
    !draft.displayName.trim() && 'displayName',
    !draft.category && 'category',
    // `dosageForm` meldet schon validateStackItemDraft.
    ...Object.keys(validateStackItemDraft(draft)).map(key => `item.${key}`),
  ].filter((problem): problem is string => Boolean(problem))
}

/** Wie `stackItemProblems`, dazu Plan und Bestand — fuer „mit Plan speichern". */
export function stackItemSetupProblems(draft: StackItemSetupDraft): string[] {
  const invalidInventory = draft.inventory.enabled
    && (
      draft.inventory.packageQuantity == null
      || !Number.isFinite(draft.inventory.packageQuantity)
      || draft.inventory.packageQuantity <= 0
      || !draft.inventory.packageUnit?.trim()
      || draft.inventory.remainingQuantity == null
      || !Number.isFinite(draft.inventory.remainingQuantity)
      || draft.inventory.remainingQuantity < 0
    )
  return [
    ...stackItemProblems(draft),
    ...Object.keys(validateIntakePlan(draft.plan, draft.trackingLevel)).map(key => `plan.${key}`),
    ...(invalidInventory ? ['inventory'] : []),
  ]
}

export async function saveStackItem(
  client: StackItemRpcClient,
  draft: StackItemDraft | StackItemSetupDraft,
): Promise<SavedStackItemRow> {
  const probleme = stackItemProblems(draft)
  if (probleme.length > 0) {
    throw new Error(`Invalid stack item draft: ${probleme.join(', ')}`)
  }

  const params: SaveStackItemRpcParams = {
    p_item: itemParams(draft, 'pkProfileMethod' in draft ? draft.pkProfileMethod : null,
      inventoryForSave(draft)),
    p_ingredients: powderVialForSave(draft).ingredients.map(ingredientForSave),
  }

  const { data, error } = await client.rpc('save_stack_item', params)
  throwIfError(error)
  if (!data) throw new Error('save_stack_item returned no data')
  return data
}

export async function saveStackItemSetup(
  client: StackItemSetupRpcClient,
  draft: StackItemSetupDraft,
  idempotencyKey: string,
): Promise<SavedStackItemRow> {
  // Welche Pruefung scheitert, steht in der Meldung: ohne das sieht man in
  // der App nur „konnte nicht gespeichert werden" und weiss nicht, warum.
  const probleme = [
    ...stackItemSetupProblems(draft),
    ...(!idempotencyKey.trim() ? ['idempotencyKey'] : []),
  ]
  if (probleme.length > 0) {
    throw new Error(`Invalid stack item setup draft: ${probleme.join(', ')}`)
  }

  const params: SaveStackItemSetupRpcParams = {
    p_item: itemParams(draft, draft.pkProfileMethod, inventoryForSave(draft)),
    p_ingredients: powderVialForSave(draft).ingredients.map(ingredientForSave),
    p_plan: { ...planParams(draft.plan, draft.trackingLevel), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    p_idempotency_key: idempotencyKey,
  }
  const { data, error } = await client.rpc('save_stack_item_with_plan', params)
  throwIfError(error)
  if (!data) throw new Error('save_stack_item_with_plan returned no data')
  return data
}

/**
 * Eine vorgemerkte Planstufe zuruecknehmen.
 *
 * Nur was noch nicht angefangen hat: eine laufende oder vergangene Stufe ist
 * eingetreten, der Kalender hat danach geplant, und bestaetigte Einnahmen
 * haengen daran. Der RPC weist beides ab — hier steht dieselbe Regel nicht
 * noch einmal, damit sie nicht auseinanderlaufen kann.
 */
export async function removePlanSegment(
  client: PlanSegmentRpcClient,
  cycleId: string,
  effectiveFrom: string,
): Promise<void> {
  const { error } = await client.rpc('remove_plan_segment', {
    p_cycle_id: cycleId,
    p_effective_from: effectiveFrom,
  })
  throwIfError(error)
}

export async function archiveStackItem(
  client: StackItemMutationClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('stack_items')
    .update({ archived: true, archived_at: new Date().toISOString() })
    .eq('id', id)

  throwIfError(error)
}

export async function restoreStackItem(
  client: StackItemMutationClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('stack_items')
    .update({ archived: false, archived_at: null })
    .eq('id', id)

  throwIfError(error)
}

/** Dot trägt die Einnahmen automatisch ein (seit `seit`), oder nicht mehr (null). */
export async function setStackItemAutoLog(
  client: StackItemMutationClient,
  id: string,
  seit: string | null,
): Promise<void> {
  const { error } = await client
    .from('stack_items')
    .update({ auto_log_since: seit })
    .eq('id', id)

  throwIfError(error)
}

export async function reconstituteStackItem(
  client: StackItemMutationClient,
  id: string,
  reconstitutionDate: string,
): Promise<void> {
  const { error } = await client
    .from('stack_items')
    .update({ reconstitution_date: reconstitutionDate, vials_in_stock: 1, vials_initial: 1 })
    .eq('id', id)

  throwIfError(error)
}

export async function deleteStackItem(
  client: StackItemMutationClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('stack_items')
    .delete()
    .eq('id', id)

  throwIfError(error)
}

export function findDuplicate(
  items: StackItem[],
  draft: StackItemDraft,
): StackItem | undefined {
  const fingerprints = [buildDuplicateFingerprint(draft), buildDuplicateFingerprint(powderVialForSave(draft))]
  return items.find(item => (
    item.id !== draft.id
    && fingerprints.includes(buildDuplicateFingerprint(stackItemAsDraft(item)))
  ))
}
