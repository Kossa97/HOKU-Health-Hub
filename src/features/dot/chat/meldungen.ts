/**
 * Dot trägt per Satz ein: „GHK heute vergessen", „Tesa erst um 22 Uhr",
 * „BPC gerade genommen". Claude erkennt die Meldung (Werkzeug
 * `einnahmen_melden` in der Edge Function `coach`), ausgeführt wird sie hier
 * mit der Sitzung des Nutzers — auf denselben Wegen wie im Kalender:
 * `confirm_intake_group` zum Entscheiden, Wieder-Öffnen vor jedem Umentscheiden
 * (die RPC lässt ein Ja nicht direkt zum Nein werden), der Bestand wie nach
 * dem Haken. Jede Meldung lässt sich einmal rückgängig machen.
 *
 * „Später heute" schreibt nichts: Dot merkt sich auf dem Gerät die neue Zeit,
 * und das automatische Eintragen wartet bis dahin (`autoTracking/vormerkungen.ts`).
 * Ohne Schalter an der Substanz trägt Dot dann nicht ein, das bleibt beim Haken.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { AUTO_MISSED_NOTE, type ResolvedTimelineIntake } from '../../../lib/intakeSchedule'
import { localSlotInstant } from '../../../lib/planTimeline'
import { applyInventoryConfirmation, reverseInventoryConfirmation } from '../../my-stack/services/stackInventory'
import { buildIntakeRpcEntries, type SavedDoseLog } from '../../routines/services/intakeConfirmation'
import { autoEintraege, brauchtBestand, istAutoGetrackt, ladeAutoKarte, type AutoItem, type AutoKarte } from '../autoTracking/autoTracking'
import { setzeVormerkung } from '../autoTracking/vormerkungen'

export type MeldungArt = 'genommen' | 'vergessen' | 'spaeter'
export interface Meldung { ref: string; art: MeldungArt; uhrzeit: string | null }

type Client = SupabaseClient

/** Was gerade für diesen Platz im Protokoll steht. */
export interface Eintrag { id: string; taken: boolean | null; notes: string | null; logged_at: string; auto_logged?: boolean | null }

export type MeldungStatus =
  | 'genommen' | 'vergessen' | 'vorgemerkt' | 'selbst'
  | 'schon_genommen' | 'schon_vergessen' | 'fehler'

export interface MeldungErgebnis {
  status: MeldungStatus
  substanz: string
  /** Lokale Uhrzeit „HH:MM", zu der eingetragen bzw. vorgemerkt wurde. */
  uhrzeit: string | null
  rueckgaengig: (() => Promise<void>) | null
}

// ── Bausteine, wie im Kalender ──────────────────────────────────────────────

/** Bestand mit Rückbuchung: wie `Dashboard.tsx` (Vial oder vollständig getrackt). */
const bucheZurueck = (item: AutoItem) => item.dosage_form === 'vial' || item.tracking_level === 'complete'

/** Der entscheidende Eintrag für einen Platz: genommen vor ausgelassen vor offen. */
export function entscheidenderEintrag(zeilen: readonly Eintrag[]): Eintrag | null {
  return zeilen.find(z => z.taken === true) ?? zeilen.find(z => z.taken === false) ?? zeilen[0] ?? null
}

async function ladeEintrag(client: Client, userId: string, slotKey: string): Promise<Eintrag | null> {
  const { data, error } = await client.from('dose_logs')
    .select('id, taken, notes, logged_at, auto_logged').eq('user_id', userId).eq('routine_slot_key', slotKey)
  if (error) throw new Error(error.message)
  return entscheidenderEintrag((data ?? []) as Eintrag[])
}

async function ladeItem(client: Client, userId: string, id: string): Promise<AutoItem | null> {
  const { data, error } = await client.from('stack_items')
    .select('id, display_name, tracking_level, dosage_form, archived').eq('user_id', userId).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  const item = data as (AutoItem & { archived?: boolean | null }) | null
  return item && !item.archived ? item : null
}

/** Wieder öffnen (taken null), mit Rückbuchung des Bestands, wenn es einen gab. */
async function oeffne(client: Client, eintrag: Eintrag, item: AutoItem) {
  if (eintrag.taken === true && bucheZurueck(item)) {
    await reverseInventoryConfirmation(client as never, eintrag.id, 'undo')
    return
  }
  const aenderung = eintrag.notes === AUTO_MISSED_NOTE ? { taken: null, notes: null } : { taken: null }
  const { error } = await client.from('dose_logs').update(aenderung).eq('id', eintrag.id)
  if (error) throw new Error(error.message)
}

/** Ganz entfernen (der Platz war vorher leer). */
async function entferne(client: Client, eintrag: Eintrag, item: AutoItem) {
  if (eintrag.taken === true && bucheZurueck(item)) {
    await reverseInventoryConfirmation(client as never, eintrag.id, 'delete')
    return
  }
  const { error } = await client.from('dose_logs').delete().eq('id', eintrag.id)
  if (error) throw new Error(error.message)
}

/**
 * Entscheiden über `confirm_intake_group`, danach der Bestand wie nach dem Haken.
 * `auto`: beim Wiederherstellen eines Eintrags, den Dot automatisch gemacht hatte —
 * dann wieder mit Markierung (`confirm_intake_group_auto`).
 */
async function entscheide(
  client: Client, intake: ResolvedTimelineIntake, item: AutoItem,
  taken: boolean, loggedAt: string, offenId: string | null, auto = false,
): Promise<SavedDoseLog> {
  const [eintrag] = autoEintraege([intake], new Map([[item.id, item]]))
  if (!eintrag) throw new Error('menge_fehlt')
  const { data, error } = await client.rpc(auto && taken ? 'confirm_intake_group_auto' : 'confirm_intake_group', {
    p_entries: buildIntakeRpcEntries([{ ...eintrag, pendingLogId: offenId, actualLoggedAt: taken ? loggedAt : intake.scheduledAt }], taken),
  })
  if (error) throw new Error(error.message)
  const zeile = ((data ?? []) as SavedDoseLog[])[0]
  if (!zeile) throw new Error('keine_zeile')
  if (taken && brauchtBestand(item, zeile)) {
    // Wiederholbar: die Datenbank bucht je Eintrag nur einmal
    try { await applyInventoryConfirmation(client as never, zeile.id) } catch (e) { console.error('[Dot] Bestand:', e) }
  }
  return zeile
}

/** „HH:MM" am Tag der Einnahme als Zeitpunkt. */
export function zeitpunkt(intake: ResolvedTimelineIntake, uhrzeit: string, timeZone: string): Date {
  const [h, m] = uhrzeit.split(':').map(Number)
  return localSlotInstant(intake.localDate, h * 60 + m, timeZone)
}

const hhmm = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)

/**
 * Was eine Meldung bewirkt — rein, damit sie sich ohne Datenbank prüfen lässt.
 * `genommen` ohne Uhrzeit heißt: zur geplanten Zeit, liegt die noch vor uns, jetzt.
 */
export function plane(p: {
  art: MeldungArt
  uhrzeit: string | null
  intake: ResolvedTimelineIntake
  eintrag: Eintrag | null
  jetzt: Date
  timeZone: string
  auto: boolean
}): { tun: 'nehmen'; um: Date } | { tun: 'auslassen' } | { tun: 'vormerken'; um: Date } | { tun: 'selbst'; um: Date } | { tun: 'nichts'; status: MeldungStatus } {
  const geplant = new Date(p.intake.scheduledAt)
  if (p.art === 'vergessen') return p.eintrag?.taken === false ? { tun: 'nichts', status: 'schon_vergessen' } : { tun: 'auslassen' }
  let um = p.uhrzeit ? zeitpunkt(p.intake, p.uhrzeit, p.timeZone) : (geplant > p.jetzt ? p.jetzt : geplant)
  // „Erst um 0:30" für 23 Uhr meint die Nacht danach, nicht den Morgen davor
  if (p.art === 'spaeter' && um < geplant) um = new Date(um.getTime() + 86_400_000)
  // Eine Zeit in der Zukunft ist „später", wie auch immer sie gemeint war
  if (um > p.jetzt) return p.auto ? { tun: 'vormerken', um } : { tun: 'selbst', um }
  if (p.art === 'spaeter' && !p.uhrzeit) return { tun: 'nichts', status: 'fehler' }
  if (p.eintrag?.taken === true) return { tun: 'nichts', status: 'schon_genommen' }
  return { tun: 'nehmen', um }
}

/** Die Karte gilt nicht mehr: der Platz wurde seitdem anders entschieden. */
export class Veraendert extends Error {}

/** Stellt den Stand vor der Meldung wieder her: leer, offen oder entschieden. */
async function stelleHer(client: Client, intake: ResolvedTimelineIntake, item: AutoItem, vorher: Eintrag | null, aktuell: Eintrag | null) {
  if (!aktuell) return
  if (!vorher) return entferne(client, aktuell, item)
  if (aktuell.taken != null) await oeffne(client, aktuell, item)
  if (vorher.taken != null) await entscheide(client, intake, item, vorher.taken, vorher.logged_at, aktuell.id, vorher.auto_logged === true)
}

/**
 * Führt eine Meldung aus. Fehler werden zum Status, nie zur Ausnahme.
 * `karte`: wer automatisch getrackt wird; bei mehreren Meldungen einmal geladen.
 */
export async function fuehreMeldungAus(
  client: Client, userId: string, meldung: Meldung, intake: ResolvedTimelineIntake,
  karte?: AutoKarte, jetzt = new Date(),
): Promise<MeldungErgebnis> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const slot = intake.routineSlotKey
  const fehler = (substanz: string): MeldungErgebnis => ({ status: 'fehler', substanz, uhrzeit: null, rueckgaengig: null })
  let substanz = ''
  let geoeffnet = false
  let item: AutoItem | null = null
  let eintrag: Eintrag | null = null
  try {
    ;[item, eintrag] = await Promise.all([ladeItem(client, userId, intake.stackItemId), ladeEintrag(client, userId, slot)])
    if (!item) return fehler(substanz)
    substanz = String(item.display_name ?? '')
    const auto = istAutoGetrackt(karte ?? await ladeAutoKarte(client, userId), item.id, intake.scheduledAt)
    const plan = plane({ art: meldung.art, uhrzeit: meldung.uhrzeit, intake, eintrag, jetzt, timeZone, auto })
    if (plan.tun === 'nichts') return { status: plan.status, substanz, uhrzeit: null, rueckgaengig: null }
    if (plan.tun === 'selbst') return { status: 'selbst', substanz, uhrzeit: hhmm(plan.um, timeZone), rueckgaengig: null }
    // Ohne geplante Menge lässt sich nichts entscheiden; dann gar nicht erst anfassen
    if (autoEintraege([intake], new Map([[item.id, item]])).length === 0) return fehler(substanz)
    const it = item
    const vorher = eintrag

    if (plan.tun === 'vormerken') {
      // Erst vormerken, dann öffnen: dazwischen darf das automatische Eintragen nicht zuschlagen.
      // Ohne Gerätespeicher keine Vormerkung, und dann auch nichts öffnen
      if (!setzeVormerkung(userId, slot, plan.um.getTime())) return fehler(substanz)
      if (vorher?.taken != null) { geoeffnet = true; await oeffne(client, vorher, it) }
      const um = plan.um.toISOString()
      return {
        status: 'vorgemerkt', substanz, uhrzeit: hhmm(plan.um, timeZone),
        rueckgaengig: async () => {
          const aktuell = await ladeEintrag(client, userId, slot)
          // Noch offen, oder von Dot zur vorgemerkten Zeit eingetragen: das war diese Karte
          const vonDieserKarte = !aktuell || aktuell.taken == null || (aktuell.taken === true && Date.parse(aktuell.logged_at) === Date.parse(um))
          if (!vonDieserKarte) throw new Veraendert()
          setzeVormerkung(userId, slot, null)
          if (vorher?.taken != null || aktuell?.taken != null) await stelleHer(client, intake, it, vorher, aktuell)
        },
      }
    }

    setzeVormerkung(userId, slot, null)
    const nehmen = plan.tun === 'nehmen'
    if (vorher?.taken != null) { geoeffnet = true; await oeffne(client, vorher, it) }
    const zeile = await entscheide(client, intake, it, nehmen, nehmen ? plan.um.toISOString() : intake.scheduledAt, vorher?.id ?? null)
    return {
      status: nehmen ? 'genommen' : 'vergessen', substanz,
      uhrzeit: nehmen ? hhmm(plan.um, timeZone) : null,
      rueckgaengig: async () => {
        const aktuell = await ladeEintrag(client, userId, slot)
        // Nur zurücknehmen, was diese Karte geschrieben hat; seitdem Geändertes bleibt
        if (!aktuell || aktuell.id !== zeile.id || aktuell.taken !== nehmen) throw new Veraendert()
        await stelleHer(client, intake, it, vorher, aktuell)
      },
    }
  } catch (e) {
    console.error('[Dot] Meldung:', e)
    // Schon geöffnet, aber nicht neu entschieden: den alten Stand zurück, so gut es geht
    if (geoeffnet && item && eintrag) {
      try { await stelleHer(client, intake, item, eintrag, await ladeEintrag(client, userId, slot)) } catch (e2) { console.error('[Dot] Wiederherstellen:', e2) }
    }
    return fehler(substanz)
  }
}
