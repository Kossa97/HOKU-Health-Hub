/**
 * Neue Tagebuch-Einträge, die ohne Netz nicht gespeichert werden konnten.
 *
 * Sie warten im Gerät (localStorage, je Nutzer) und gehen über
 * `save_diary_entry` raus, sobald die Verbindung zurück ist — auf jeder Seite
 * (useTagebuchOfflineSync hängt im Layout). Jeder Eintrag trägt eine id vom
 * Gerät: kam ein Versuch an und nur die Antwort ging verloren, legt der
 * nächste nichts doppelt an und ändert nichts (supabase-tagebuch-offline-id.sql).
 *
 * Nur neue Einträge — Bearbeiten braucht den aktuellen Stand der Datenbank und
 * meldet ohne Netz einen Fehler. Abmelden löscht die Warteschlange mit den
 * übrigen Offline-Daten (stoerung.ts → vergissOfflineDaten).
 */
import { isNetworkFailureMessage } from '../networkErrors'

export interface PendingEntry {
  /** id vom Gerät — wird zur id des Eintrags. */
  id: string
  user_id: string
  entry: {
    description: string
    occurred_at: string
    stack_item_id: string | null
    dose_log_id: string | null
    notes: string | null
  }
  chips: Record<string, unknown>[]
  /** Endgültig gescheitert (nicht am Netz): wird nicht mehr gesendet, nur angezeigt. */
  failed?: true
}

export interface SendError { message?: string; code?: string }

const PREFIX = 'tyd_tagebuch_offline_'
const key = (userId: string) => `${PREFIX}${userId}`
/** Fenster-Ereignis bei jeder Änderung — Hinweis und Liste hören darauf. */
export const QUEUE_EVENT = 'tyd-tagebuch-queue'

function storage(): Storage | null {
  try { return window.localStorage } catch { return null }
}

function announce(): void {
  try { window.dispatchEvent(new Event(QUEUE_EVENT)) } catch { /* ohne Fenster */ }
}

export function readQueue(userId: string): PendingEntry[] {
  try {
    const raw = storage()?.getItem(key(userId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? (parsed as PendingEntry[]).filter(row => row && typeof row.id === 'string' && row.user_id === userId && row.entry && Array.isArray(row.chips))
      : []
  } catch {
    return []
  }
}

function writeQueue(userId: string, rows: PendingEntry[]): void {
  const store = storage()
  if (store) {
    try {
      if (rows.length) store.setItem(key(userId), JSON.stringify(rows))
      else store.removeItem(key(userId))
    } catch { /* voll oder gesperrt */ }
  }
  announce()
}

/** UUID v4 — auch dort, wo crypto.randomUUID fehlt (http im lokalen Netz beim Entwickeln). */
export function newEntryId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function enqueue(row: PendingEntry): void {
  writeQueue(row.user_id, [...readQueue(row.user_id).filter(other => other.id !== row.id), row])
}

export function queueCounts(userId: string): { waiting: number; failed: number } {
  const rows = readQueue(userId)
  const failed = rows.filter(row => row.failed).length
  return { waiting: rows.length - failed, failed }
}

export function discardFailed(userId: string): void {
  writeQueue(userId, readQueue(userId).filter(row => !row.failed))
}

/** Beim Abmelden: alle Warteschlangen dieses Geräts — keine Gesundheitsdaten zurücklassen. */
export function clearAllQueues(): void {
  const store = storage()
  if (store) {
    try {
      for (const name of Object.keys(store)) if (name.startsWith(PREFIX)) store.removeItem(name)
    } catch { /* gesperrt */ }
  }
  announce()
}

/** Kein Netz oder die Anfrage kam nicht an — ein späterer Versuch hat Sinn. */
export function isNetworkError(error: SendError | null | undefined, online = navigator.onLine): boolean {
  return !online || isNetworkFailureMessage(error?.message)
}

/**
 * Fehler, die sich nie von selbst lösen: Verweise, die nicht (mehr) passen,
 * und Prüfungen der Datenbank. Alles andere (Zeitüberschreitung, 5xx) gilt
 * als vorübergehend — der Eintrag bleibt unverändert und kommt später dran.
 */
const PERMANENT_CODES = new Set(['42501', '23503', '23514', '23502', '23505', '22P02', '22023', 'P0002'])
function isPermanent(error: SendError): boolean {
  return PERMANENT_CODES.has(error.code ?? '') || /^(effect|diary)_/.test(error.message ?? '')
}

/** Nur den Verweis lösen, der nicht passt. */
function withoutBrokenLinks(row: PendingEntry, error: SendError): PendingEntry | null {
  const message = error.message ?? ''
  if (message.startsWith('effect_dose_log_') && row.entry.dose_log_id) {
    return { ...row, entry: { ...row.entry, dose_log_id: null } }
  }
  if ((message === 'effect_stack_item_not_owned' || error.code === '23503') && (row.entry.stack_item_id || row.entry.dose_log_id)) {
    return { ...row, entry: { ...row.entry, stack_item_id: null, dose_log_id: null } }
  }
  return null
}

/**
 * Schickt die wartenden Einträge der Reihe nach. Was klappt, verlässt die
 * Warteschlange. Netz weg oder vorübergehender Fehler: Abbruch, später weiter.
 * Passt ein Verweis nicht mehr (z. B. Substanz gelöscht), geht der Eintrag
 * ohne diesen Verweis raus. Scheitert er endgültig, wird er markiert und nie
 * still verworfen — der Nutzer sieht ihn und entscheidet.
 */
export async function flushQueue(
  userId: string,
  send: (row: PendingEntry) => Promise<{ error: SendError | null }>,
): Promise<{ sent: number; waiting: number; failed: number }> {
  let sent = 0
  for (const queued of readQueue(userId)) {
    if (queued.failed) continue
    let row = queued
    let { error } = await send(row)
    const repaired = error && isPermanent(error) ? withoutBrokenLinks(row, error) : null
    if (repaired) {
      row = repaired
      ;({ error } = await send(row))
    }
    if (error && (isNetworkError(error) || !isPermanent(error))) break
    const rest = readQueue(userId).filter(other => other.id !== queued.id)
    writeQueue(userId, error ? [...rest, { ...row, failed: true }] : rest)
    if (!error) sent += 1
  }
  return { sent, ...queueCounts(userId) }
}
