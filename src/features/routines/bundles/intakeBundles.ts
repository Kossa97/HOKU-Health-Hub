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
}

export const BUNDLE_NAME_MAX = 60

/**
 * Die offenen Einnahmen, die ein Tipp auf das Bündel bestaetigt.
 *
 * Je Substanz genau EINE — die frueheste offene des Tages. Wer eine Substanz
 * morgens und abends nimmt und morgens sein „Morgen-Bündel" bestaetigt, hat
 * damit nicht auch die Abenddosis genommen. Beim naechsten Tipp ist dann die
 * naechste dran.
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
    insert(row: { user_id: string; name: string; stack_item_ids: string[]; sort_order: number }): {
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

const COLUMNS = 'id, name, stack_item_ids, sort_order, created_at'

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
  draft: { id?: string; name: string; stackItemIds: string[]; sortOrder: number },
): Promise<IntakeBundle> {
  const name = normalizeBundleName(draft.name)
  const stack_item_ids = [...new Set(draft.stackItemIds)]
  if (!name) throw new Error('Bundle name is empty')
  if (stack_item_ids.length === 0) throw new Error('Bundle has no items')
  const { data, error } = draft.id
    ? await client.from('intake_bundles')
      .update({ name, stack_item_ids, updated_at: new Date().toISOString() })
      .eq('id', draft.id).eq('user_id', userId)
      .select(COLUMNS).single()
    : await client.from('intake_bundles')
      .insert({ user_id: userId, name, stack_item_ids, sort_order: draft.sortOrder })
      .select(COLUMNS).single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('intake_bundles returned no row')
  return data
}

export async function deleteIntakeBundle(client: IntakeBundleClient, userId: string, id: string): Promise<void> {
  const { error } = await client.from('intake_bundles').delete().eq('id', id).eq('user_id', userId)
  if (error) throw new Error(error.message)
}
