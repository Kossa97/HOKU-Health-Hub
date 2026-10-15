import type { RoutineConfirmationEntry } from '../intakeGroups'
import { hasTrackedQuantity } from '../quantityPresentation'
import { istSlotSchluessel, slotSchluesselFuerZeitpunkt } from '../lib/slotKey'

interface ServiceError {
  message: string
}

/**
 * Die Zeile, die `confirm_intake_group` tatsaechlich geschrieben hat.
 *
 * Die RPC gibt `setof dose_logs` zurueck -- die volle Zeile, nicht nur die
 * id. Bis hierher wurde das auf `row.id` zusammengestrichen, und jeder
 * Aufrufer holte sich den Rest per erneutem Rundgang durch den ganzen
 * sichtbaren Monat. Die Zeile stand die ganze Zeit schon da.
 *
 * Nur `id` ist Pflicht, der Rest optional: ein Test, der nur `{ id }`
 * zurueckgibt, bleibt gueltig, und ein Aufrufer, der nur die id braucht
 * (`Home.tsx`, `injectionPersistence.ts`), muss nichts extra angeben.
 */
export interface SavedDoseLog {
  id: string
  stack_item_id?: string
  dose?: number | null
  unit?: string | null
  method?: string
  logged_at?: string
  notes?: string | null
  taken?: boolean | null
  cycle_id?: string | null
  plan_version_id?: string | null
  routine_slot_key?: string | null
}

interface ConfirmIntakeGroupRpcEntry {
  cycle_id: string
  plan_version_id: string | null
  timezone: string
  dose_log_id: string | null
  slot_key: string
  stack_item_id: string
  dose: number | null
  unit: string | null
  method: string
  logged_at: string
  taken: boolean
}

interface ConfirmIntakeGroupRpcParams {
  p_entries: ConfirmIntakeGroupRpcEntry[]
}

export interface IntakeConfirmationClient {
  rpc(
    name: 'confirm_intake_group',
    params: ConfirmIntakeGroupRpcParams,
  ): PromiseLike<{ data: SavedDoseLog[] | null; error: ServiceError | null }>
}

export type QuantifiedConfirmationEntry = RoutineConfirmationEntry & {
  actualDose: number
  actualUnit: string
}

export function quantifiedVialEntries(
  entries: RoutineConfirmationEntry[],
  vialStackItemIds: ReadonlySet<string>,
): QuantifiedConfirmationEntry[] {
  return entries.filter((entry): entry is QuantifiedConfirmationEntry => (
    entry.selected
    && vialStackItemIds.has(entry.stackItemId)
    && hasTrackedQuantity({ dose: entry.actualDose, unit: entry.actualUnit })
  ))
}

/** Die Eintraege, wie `confirm_intake_group` sie erwartet (auch fuer
 * `confirm_intake_with_injection`, das sie unveraendert weiterreicht). */
export function buildIntakeRpcEntries(
  entries: RoutineConfirmationEntry[],
  taken: boolean,
) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  return entries
    .filter(entry => entry.selected)
    .map(entry => ({
      cycle_id: entry.cycleId,
      plan_version_id: entry.planVersionId,
      timezone,
      dose_log_id: entry.pendingLogId,
      // Der Schluessel kommt aus der Planung, wenn es eine gibt.
      //
      // Unter der Zeitleiste IST `key` der Slot-Schluessel -- er traegt die
      // geplante Wanduhr, und die ist unabhaengig davon, wo das Geraet
      // gerade steht. Genau das soll hier ankommen: wer unterwegs bestaetigt,
      // trifft denselben Platz wie zu Hause.
      //
      // Der alte Zweig in `Home.tsx` (ohne Planversionen) baut dagegen ein
      // Kuerzel aus Zyklus und Minute -- `cycle-1-480`. Das ist kein
      // Schluessel, also wird er dort aus dem Zeitpunkt gebaut. Der Fall
      // stirbt mit dem alten Zweig; bis dahin darf er nicht mitgerissen
      // werden.
      slot_key: istSlotSchluessel(entry.key, entry.cycleId)
        ? entry.key
        : slotSchluesselFuerZeitpunkt(entry.cycleId, entry.scheduledAt, timezone),
      stack_item_id: entry.stackItemId,
      dose: entry.trackingLevel === 'intake_only' ? null : entry.actualDose,
      unit: entry.trackingLevel === 'intake_only' ? null : entry.actualUnit,
      method: entry.method,
      logged_at: entry.actualLoggedAt ?? entry.scheduledAt,
      taken,
    }))
}

async function decideIntakeGroup(
  client: IntakeConfirmationClient,
  entries: RoutineConfirmationEntry[],
  taken: boolean,
): Promise<SavedDoseLog[]> {
  const p_entries = buildIntakeRpcEntries(entries, taken)
  const { data, error } = await client.rpc('confirm_intake_group', { p_entries })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('confirm_intake_group returned no data')
  return data
}

export function confirmIntakeGroup(
  client: IntakeConfirmationClient,
  entries: RoutineConfirmationEntry[],
): Promise<SavedDoseLog[]> {
  return decideIntakeGroup(client, entries, true)
}

export function skipIntakeGroup(
  client: IntakeConfirmationClient,
  entries: RoutineConfirmationEntry[],
): Promise<SavedDoseLog[]> {
  return decideIntakeGroup(client, entries, false)
}

export async function skipIntakeGroupsInBatches(
  client: IntakeConfirmationClient,
  entries: RoutineConfirmationEntry[],
  batchSize = 20,
): Promise<SavedDoseLog[]> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('Batch size must be a positive integer')
  }

  const selectedEntries = entries.filter(entry => entry.selected)
  const saved: SavedDoseLog[] = []
  for (let start = 0; start < selectedEntries.length; start += batchSize) {
    saved.push(...await skipIntakeGroup(client, selectedEntries.slice(start, start + batchSize)))
  }
  return saved
}
