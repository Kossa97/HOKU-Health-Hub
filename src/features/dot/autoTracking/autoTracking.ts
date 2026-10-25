/**
 * Dot trägt automatisch ein (Pro).
 *
 * Ist an einer Substanz oder an einem Bündel der Schalter an, gilt jede
 * geplante Einnahme als genommen, sobald ihre Zeit (plus Puffer) vorbei ist.
 * Bestätigt wird auf genau demselben Weg wie mit dem Haken im Kalender:
 * `confirm_intake_group`, danach der Bestand. Dot markiert seine Einträge
 * (`dose_logs.auto_logged`), damit das Protokoll ehrlich bleibt.
 *
 * Nachgetragen wird nur, was NACH dem Einschalten geplant war, und höchstens
 * `MAX_TAGE` zurück. Entscheidungen des Nutzers (bestätigt, übersprungen,
 * vergessen) gewinnen immer: Dot füllt nur Lücken.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { dotStore } from '../dotStore'
import { collectOpenTimelineIntakes, type IntakeLog, type ResolvedTimelineIntake } from '../../../lib/intakeSchedule'
import { isInjectableMethod } from '../../../lib/injectionDeepLink'
import { localDateTimeKey, type CycleTimeline } from '../../../lib/planTimeline'
import { loadCycleTimelines } from '../../my-stack/services/planLifecycle'
import { applyInventoryConfirmation } from '../../my-stack/services/stackInventory'
import type { TrackingLevel } from '../../my-stack/types'
import { buildConfirmationEntry, routineGroupFromMinutes, type RoutineConfirmationEntry } from '../../routines/intakeGroups'
import { buildIntakeRpcEntries, type SavedDoseLog } from '../../routines/services/intakeConfirmation'
import { ladeVormerkungen, setzeVormerkung } from './vormerkungen'

type AutoLog = SavedDoseLog & { auto_logged?: boolean }

/** So lange nach der geplanten Zeit wartet Dot, ob der Nutzer selbst einträgt. */
export const PUFFER_MIN = 30
/** Weiter zurück trägt Dot nichts nach. */
export const MAX_TAGE = 14
/** Ereignis an die Seiten: Dot hat eingetragen (detail: { anzahl }). */
export const AUTO_EREIGNIS = 'tyd:dot-auto-eingetragen'

const PAKET = 20

/** Je Substanz: seit wann Dot einträgt (früheste Quelle: eigener Schalter oder ein Bündel). */
export type AutoKarte = Map<string, number>

export function autoKarte(
  items: readonly { id: string; auto_log_since?: string | null }[],
  buendel: readonly { stack_item_ids: readonly string[]; auto_log_since?: string | null }[],
): AutoKarte {
  const karte: AutoKarte = new Map()
  const merke = (id: string, seit: string | null | undefined) => {
    const t = seit ? Date.parse(seit) : NaN
    if (!Number.isFinite(t)) return
    const bisher = karte.get(id)
    if (bisher === undefined || t < bisher) karte.set(id, t)
  }
  for (const item of items) merke(item.id, item.auto_log_since)
  for (const b of buendel) for (const id of b.stack_item_ids) merke(id, b.auto_log_since)
  return karte
}

/** Trägt Dot diese Einnahme ein? (Die automatische „Verpasst"-Markierung lässt sie dann aus.) */
export function istAutoGetrackt(karte: AutoKarte, stackItemId: string, scheduledAt: string): boolean {
  const seit = karte.get(stackItemId)
  return seit !== undefined && Date.parse(scheduledAt) >= seit
}

/**
 * Für die automatische „Verpasst"-Markierung: diese Einnahme trägt Dot ein,
 * sie wird also (noch) nicht als verpasst markiert. Nur solange Dot das auch
 * kann — mit Pro (ist der Zugang noch nicht geladen, wird nur aufgeschoben)
 * und innerhalb von `MAX_TAGE`. Alles andere markiert die Rückschau wie immer.
 */
export function dotTraegtEin(karte: AutoKarte, stackItemId: string, scheduledAt: string, jetzt: Date, stand = dotStore.stand()): boolean {
  if (stand.geladen && !stand.darfRaus) return false
  if (Date.parse(scheduledAt) < jetzt.getTime() - MAX_TAGE * 86_400_000) return false
  return istAutoGetrackt(karte, stackItemId, scheduledAt)
}

/**
 * Die offenen Einnahmen, die Dot jetzt eintragen darf: Substanz mit Schalter,
 * geplant nach dem Einschalten, Zeit plus Puffer vorbei, höchstens `maxTage` zurück.
 */
export function faelligeAutoEinnahmen(p: {
  timelines: readonly CycleTimeline[]
  logs: readonly IntakeLog[]
  karte: AutoKarte
  jetzt: Date
  timeZone: string
  pufferMin?: number
  maxTage?: number
  /** „Erst um 22 Uhr": je Platz die neue Zeit (ms); bis dahin wartet Dot, dann trägt er auch Wiedergeöffnetes ein. */
  vormerkungen?: ReadonlyMap<string, number>
}): ResolvedTimelineIntake[] {
  if (p.karte.size === 0) return []
  const grenze = p.jetzt.getTime() - (p.pufferMin ?? PUFFER_MIN) * 60_000
  const fruehestens = Math.max(Math.min(...p.karte.values()), p.jetzt.getTime() - (p.maxTage ?? MAX_TAGE) * 86_400_000)
  const timelines = p.timelines.filter(t => p.karte.has(t.cycle.stack_item_id))
  const tage = new Set<string>()
  const faellig: ResolvedTimelineIntake[] = []
  // Ein Tag Reserve auf beiden Seiten: lokale Tage und UTC-Tage liegen verschoben
  const logs = p.logs as IntakeLog[]
  for (let t = fruehestens - 86_400_000; t <= p.jetzt.getTime() + 86_400_000; t += 86_400_000) {
    const tag = localDateTimeKey(new Date(t), p.timeZone).slice(0, 10)
    if (tage.has(tag)) continue
    tage.add(tag)
    for (const intake of collectOpenTimelineIntakes(timelines, logs, new Date(t), p.timeZone)) {
      const zeit = Date.parse(intake.scheduledAt)
      if (zeit < fruehestens) continue
      if (!istAutoGetrackt(p.karte, intake.stackItemId, intake.scheduledAt)) continue
      const vorgemerkt = p.vormerkungen?.get(intake.routineSlotKey)
      if (vorgemerkt !== undefined) {
        // Der Nutzer hat Dot die Zeit selbst gesagt: ab dann, ohne Puffer
        if (vorgemerkt <= p.jetzt.getTime()) faellig.push(intake)
        continue
      }
      if (zeit > grenze) continue
      // Wieder geöffnet (taken null): das hat der Nutzer in der Hand, Dot füllt es nicht erneut
      if (intake.pendingLogId) continue
      faellig.push(intake)
    }
  }
  return faellig.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}

export interface AutoItem { id: string; display_name?: string | null; tracking_level?: string | null; dosage_form?: string | null }

/** Die Einträge für `confirm_intake_group`, wie der Haken sie baut (Zeitpunkt = geplante Zeit). */
export function autoEintraege(faellig: readonly ResolvedTimelineIntake[], items: ReadonlyMap<string, AutoItem>): RoutineConfirmationEntry[] {
  return faellig.flatMap(intake => {
    const item = items.get(intake.stackItemId)
    if (!item) return []
    const trackingLevel = (item.tracking_level ?? 'intake_only') as TrackingLevel
    const intakeOnly = trackingLevel === 'intake_only'
    // Ohne geplante Menge kann eine Einnahme mit Menge nicht bestätigt werden; die bleibt offen
    if (!intakeOnly && (intake.dose === null || !intake.unit)) return []
    return [{
      ...buildConfirmationEntry({
        key: intake.routineSlotKey,
        cycleId: intake.cycleId,
        planVersionId: intake.planVersionId,
        pendingLogId: intake.pendingLogId,
        stackItemId: intake.stackItemId,
        stackItemName: String(item.display_name ?? ''),
        trackingLevel,
        group: routineGroupFromMinutes(intake.minutes),
        scheduledAt: intake.scheduledAt,
        dose: intakeOnly ? null : intake.dose,
        unit: intakeOnly ? null : intake.unit,
        method: intake.method ?? '',
        injectable: isInjectableMethod(intake.method),
      }),
      actualLoggedAt: intake.scheduledAt,
    }]
  })
}

/** Bucht den Bestand ab, wie nach dem Haken: Vial mit Menge oder vollständig getrackt. */
export function brauchtBestand(item: AutoItem | undefined, log: SavedDoseLog): boolean {
  if (!item || log.taken !== true) return false
  return (item.dosage_form === 'vial' && log.dose != null) || item.tracking_level === 'complete'
}

type Client = SupabaseClient

export async function ladeAutoKarte(client: Client, userId: string): Promise<AutoKarte> {
  const [items, buendel] = await Promise.all([
    // Wenige Zeilen je Nutzer; was aus ist (null), sortiert `autoKarte` aus
    client.from('stack_items').select('id, auto_log_since').eq('user_id', userId),
    client.from('intake_bundles').select('stack_item_ids, auto_log_since').eq('user_id', userId),
  ])
  if (items.error) throw new Error(items.error.message)
  if (buendel.error) throw new Error(buendel.error.message)
  return autoKarte(
    (items.data ?? []) as { id: string; auto_log_since: string | null }[],
    (buendel.data ?? []) as { stack_item_ids: string[]; auto_log_since: string | null }[],
  )
}

let laeuft: Promise<number> | null = null

/** Trägt alles Fällige ein. Gibt die Zahl der neuen Einträge zurück. Läuft nie doppelt. */
export function fuehreAutoTrackingAus(client: Client, userId: string, jetzt = new Date()): Promise<number> {
  if (!laeuft) laeuft = autoTracking(client, userId, jetzt).finally(() => { laeuft = null })
  return laeuft
}

async function autoTracking(client: Client, userId: string, jetzt: Date): Promise<number> {
  const karte = await ladeAutoKarte(client, userId)
  if (karte.size === 0) return 0
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const ids = [...karte.keys()]
  const ab = new Date(Math.max(Math.min(...karte.values()), jetzt.getTime() - MAX_TAGE * 86_400_000) - 2 * 86_400_000).toISOString()
  const [timelines, logs, items] = await Promise.all([
    loadCycleTimelines(client as never, userId),
    client.from('dose_logs')
      .select('id, logged_at, stack_item_id, taken, cycle_id, plan_version_id, routine_slot_key')
      .eq('user_id', userId).in('stack_item_id', ids).gte('logged_at', ab),
    client.from('stack_items')
      .select('id, display_name, tracking_level, dosage_form, archived')
      .eq('user_id', userId).in('id', ids),
  ])
  if (logs.error) throw new Error(logs.error.message)
  if (items.error) throw new Error(items.error.message)
  const itemById = new Map(((items.data ?? []) as (AutoItem & { archived?: boolean | null })[])
    .filter(item => !item.archived)
    .map(item => [item.id, item]))

  const vormerkungen = ladeVormerkungen(userId, jetzt.getTime())
  const faellig = faelligeAutoEinnahmen({ timelines, logs: (logs.data ?? []) as IntakeLog[], karte, jetzt, timeZone, vormerkungen })
  const eintraege = autoEintraege(faellig, itemById).map(eintrag => {
    const um = vormerkungen.get(eintrag.key)
    return um === undefined ? eintrag : { ...eintrag, actualLoggedAt: new Date(um).toISOString() }
  })
  if (eintraege.length === 0) return 0

  // Bestätigen und als „automatisch" markieren in einer Transaktion (supabase-auto-tracking.sql);
  // markiert wird nur, was vorher offen war
  const bestaetige = async (paket: RoutineConfirmationEntry[]): Promise<AutoLog[]> => {
    const { data, error } = await client.rpc('confirm_intake_group_auto', { p_entries: buildIntakeRpcEntries(paket, true) })
    if (error) throw new Error(error.message)
    return (data ?? []) as AutoLog[]
  }
  const gespeichert: AutoLog[] = []
  for (let i = 0; i < eintraege.length; i += PAKET) {
    const paket = eintraege.slice(i, i + PAKET)
    try {
      gespeichert.push(...await bestaetige(paket))
    } catch {
      // Ein abgelehnter Eintrag kippt das ganze Paket: dann einzeln, und was nicht geht, bleibt offen
      for (const eintrag of paket) {
        try { gespeichert.push(...await bestaetige([eintrag])) } catch { /* bleibt offen */ }
      }
    }
  }
  for (const log of gespeichert) if (log.taken === true && log.routine_slot_key && vormerkungen.has(log.routine_slot_key)) setzeVormerkung(userId, log.routine_slot_key, null)
  const neu = gespeichert.filter(log => log.taken === true && log.auto_logged === true)
  if (neu.length === 0) return 0

  for (const log of neu) {
    if (!brauchtBestand(itemById.get(log.stack_item_id ?? ''), log)) continue
    // Wiederholbar: die Datenbank bucht je Eintrag nur einmal
    try { await applyInventoryConfirmation(client as never, log.id) } catch (e) { console.error('[Dot] Bestand:', e) }
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(AUTO_EREIGNIS, { detail: { anzahl: neu.length } }))
  return neu.length
}
