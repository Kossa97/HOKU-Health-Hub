import type { RoutineIntake } from '../intakeGroups'

/**
 * Ein selbst zusammengestelltes Bündel („Morgen-Stack", „Vor dem Training").
 *
 * Es haelt nur fest, WELCHE Substanzen zusammengehoeren. Was an einem Tag
 * davon offen ist, ergibt sich erst aus dem Plan — siehe `bundleDueIntakes`.
 */
export interface IntakeBundle {
  id: string
  name: string
  stack_item_ids: string[]
  sort_order: number
  created_at: string
  /** Seit wann Dot die Einnahmen des Bündels automatisch einträgt (Pro); null = aus. */
  auto_log_since?: string | null
}

export const BUNDLE_NAME_MAX = 60
/** Ab so vielen offenen Einnahmen einer Tageszeit steht ein Bündel als Bündel da. */
export const BUNDLE_MIN_DUE = 2

/**
 * Die offenen Einnahmen, die ein Tipp auf das Bündel bestaetigt.
 *
 * Je Substanz genau EINE — die frueheste der uebergebenen offenen. Der
 * Kalender uebergibt die einer Tageszeit (`bundlesForPeriod`): wer eine
 * Substanz morgens und abends nimmt und morgens bestaetigt, hat damit nicht
 * auch die Abenddosis genommen — die steht abends in ihrem eigenen Teil.
 *
 * Die Reihenfolge folgt dem Bündel, nicht der Uhr: so steht es auch im Blatt.
 */
export function bundleDueIntakes(
  bundle: Pick<IntakeBundle, 'stack_item_ids'>,
  dueIntakes: readonly RoutineIntake[],
): RoutineIntake[] {
  const earliestByItem = new Map<string, RoutineIntake>()
  for (const intake of dueIntakes) {
    const current = earliestByItem.get(intake.stackItemId)
    if (!current || intake.scheduledAt < current.scheduledAt) {
      earliestByItem.set(intake.stackItemId, intake)
    }
  }
  return [...new Set(bundle.stack_item_ids)]
    .map(id => earliestByItem.get(id))
    .filter((intake): intake is RoutineIntake => Boolean(intake))
}

/**
 * Die Bündel einer Tageszeit: jedes nimmt sich je Substanz die frueheste offene
 * Einnahme DIESER Tageszeit. Was ein Bündel genommen hat, steht dort nicht noch
 * einmal einzeln (`vergeben`).
 *
 * Ein Bündel erscheint nur, wenn an diesem Tag in dieser Tageszeit mindestens
 * ZWEI seiner Substanzen geplant sind (`geplant`) — sonst stehen sie einzeln
 * da. So gilt ein Sonntags-Bündel (Magnesium täglich, Melatonin nur sonntags)
 * von selbst nur sonntags, und es folgt dem Plan, ohne eigene Wochentage.
 * Gezählt wird das Geplante, nicht das Offene: ist eine der beiden schon
 * bestätigt, bleibt das Bündel mit der übrigen stehen, statt sich mitten am
 * Tag aufzulösen. Ohne `geplant` zählen die offenen.
 *
 * Stehen an einem Tag zwei solche Bündel da und teilen sich eine Substanz,
 * werden sie EINE Karte (`alle`): „GHK-Cu mit Testosteron" und „GHK-Cu mit
 * Retatrutid" heißt, an Tagen mit allen dreien nimmt man alle drei zusammen.
 * Gespeichert bleibt jedes Bündel, wie es ist; an anderen Tagen steht jedes
 * für sich. `bundle` ist das erste der Gruppe (Reihenfolge der Liste).
 */
export function bundlesForPeriod<B>(
  bundles: readonly { bundle: B; itemIds: readonly string[] }[],
  periodIntakes: readonly RoutineIntake[],
  /** Die an diesem Tag in dieser Tageszeit geplanten Substanzen, auch die schon bestätigten. */
  geplant?: ReadonlySet<string>,
): { entries: { bundle: B; alle: B[]; intakes: RoutineIntake[]; anzahl: number }[]; vergeben: Set<string> } {
  const offen = new Set(periodIntakes.map(intake => intake.stackItemId))
  // Die Bündel, die heute hier als Bündel dastehen, zu Gruppen über gemeinsame
  // Substanzen zusammengefasst — in der Reihenfolge ihres ersten Bündels.
  const gruppen: { alle: B[]; mitglieder: string[] }[] = []
  for (const { bundle, itemIds } of bundles) {
    const mitglieder = [...new Set(itemIds)].filter(id => (geplant ? geplant.has(id) : offen.has(id)))
    if (mitglieder.length < BUNDLE_MIN_DUE) continue
    const beruehrt = gruppen.filter(gruppe => gruppe.mitglieder.some(id => mitglieder.includes(id)))
    const ziel = beruehrt[0] ?? { alle: [], mitglieder: [] }
    if (!beruehrt.length) gruppen.push(ziel)
    for (const andere of beruehrt.slice(1)) {
      ziel.alle.push(...andere.alle)
      ziel.mitglieder.push(...andere.mitglieder.filter(id => !ziel.mitglieder.includes(id)))
      gruppen.splice(gruppen.indexOf(andere), 1)
    }
    ziel.alle.push(bundle)
    ziel.mitglieder.push(...mitglieder.filter(id => !ziel.mitglieder.includes(id)))
  }
  const vergeben = new Set<string>()
  const entries: { bundle: B; alle: B[]; intakes: RoutineIntake[]; anzahl: number }[] = []
  for (const { alle, mitglieder } of gruppen) {
    const frei = periodIntakes.filter(intake => !vergeben.has(intake.key))
    const intakes = bundleDueIntakes({ stack_item_ids: mitglieder }, frei)
    if (intakes.length === 0) continue
    for (const intake of intakes) vergeben.add(intake.key)
    entries.push({ bundle: alle[0], alle, intakes, anzahl: mitglieder.length })
  }
  return { entries, vergeben }
}

/**
 * Nur die Substanzen, die es noch gibt. Archivierte oder geloeschte fallen
 * heraus, ohne dass das Bündel dafuer angefasst werden muss.
 */
export function liveBundleItemIds(
  bundle: Pick<IntakeBundle, 'stack_item_ids'>,
  knownStackItemIds: { has(id: string): boolean },
): string[] {
  return [...new Set(bundle.stack_item_ids)].filter(id => knownStackItemIds.has(id))
}

export function normalizeBundleName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, BUNDLE_NAME_MAX)
}

interface ServiceError { message: string }
type Result<T> = PromiseLike<{ data: T | null; error: ServiceError | null }>

/** Der Ausschnitt des Supabase-Clients, den die Bündel brauchen. */
export interface IntakeBundleClient {
  from(table: 'intake_bundles'): {
    select(columns: string): {
      eq(column: 'user_id', value: string): {
        order(column: 'sort_order', options: { ascending: boolean }): {
          order(column: 'created_at', options: { ascending: boolean }): Result<IntakeBundle[]>
        }
      }
    }
    insert(row: { id?: string; user_id: string; name: string; stack_item_ids: string[]; sort_order: number }): {
      select(columns: string): { single(): Result<IntakeBundle> }
    }
    update(row: { name: string; stack_item_ids: string[]; updated_at: string }): {
      eq(column: 'id', value: string): {
        eq(column: 'user_id', value: string): {
          select(columns: string): { single(): Result<IntakeBundle> }
        }
      }
    }
    delete(): {
      eq(column: 'id', value: string): {
        eq(column: 'user_id', value: string): PromiseLike<{ error: ServiceError | null }>
      }
    }
  }
}

const COLUMNS = 'id, name, stack_item_ids, sort_order, created_at, auto_log_since'

export async function loadIntakeBundles(client: IntakeBundleClient, userId: string): Promise<IntakeBundle[]> {
  const { data, error } = await client.from('intake_bundles').select(COLUMNS)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function saveIntakeBundle(
  client: IntakeBundleClient,
  userId: string,
  /** `neu` mit `id`: ein aufgelöstes Bündel mit seiner alten id wieder anlegen. */
  draft: { id?: string; neu?: boolean; name: string; stackItemIds: string[]; sortOrder: number },
): Promise<IntakeBundle> {
  const name = normalizeBundleName(draft.name)
  const stack_item_ids = [...new Set(draft.stackItemIds)]
  if (!name) throw new Error('Bundle name is empty')
  if (stack_item_ids.length === 0) throw new Error('Bundle has no items')
  const { data, error } = draft.id && !draft.neu
    ? await client.from('intake_bundles')
      .update({ name, stack_item_ids, updated_at: new Date().toISOString() })
      .eq('id', draft.id).eq('user_id', userId)
      .select(COLUMNS).single()
    : await client.from('intake_bundles')
      .insert({ ...(draft.id ? { id: draft.id } : {}), user_id: userId, name, stack_item_ids, sort_order: draft.sortOrder })
      .select(COLUMNS).single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('intake_bundles returned no row')
  return data
}

/** Dot trägt die Einnahmen des Bündels automatisch ein (seit `seit`), oder nicht mehr (null). */
export async function setIntakeBundleAutoLog(
  client: IntakeBundleAutoClient,
  userId: string,
  id: string,
  seit: string | null,
): Promise<void> {
  const { error } = await client.from('intake_bundles').update({ auto_log_since: seit }).eq('id', id).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export interface IntakeBundleAutoClient {
  from(table: 'intake_bundles'): {
    update(row: { auto_log_since: string | null }): {
      eq(column: 'id', value: string): { eq(column: 'user_id', value: string): PromiseLike<{ error: ServiceError | null }> }
    }
  }
}

export async function deleteIntakeBundle(client: IntakeBundleClient, userId: string, id: string): Promise<void> {
  const { error } = await client.from('intake_bundles').delete().eq('id', id).eq('user_id', userId)
  if (error) throw new Error(error.message)
}
