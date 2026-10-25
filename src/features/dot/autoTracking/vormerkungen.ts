/**
 * „Tesa heute erst um 22 Uhr": Dot merkt sich auf diesem Gerät die neue Zeit
 * eines Platzes, und das automatische Eintragen wartet bis dahin. Danach trägt
 * es mit genau dieser Zeit ein und vergisst die Vormerkung. Älter als zwei
 * Tage zählt nicht mehr.
 */

const schluessel = (userId: string) => `tyd.dot.vormerkungen.${userId}`
const TAGE = 2

/** Je Platz (routine_slot_key): ab wann Dot ihn als genommen einträgt (ms). */
export function ladeVormerkungen(userId: string, jetzt = Date.now()): Map<string, number> {
  try {
    const roh = JSON.parse(localStorage.getItem(schluessel(userId)) || '{}') as Record<string, unknown>
    return new Map(Object.entries(roh).flatMap(([k, v]) => (
      typeof v === 'number' && v > jetzt - TAGE * 86_400_000 ? [[k, v] as [string, number]] : []
    )))
  } catch { return new Map() }
}

/** Setzt (ms) oder löscht (null) die Vormerkung eines Platzes. */
export function setzeVormerkung(userId: string, slotKey: string, um: number | null) {
  const karte = ladeVormerkungen(userId)
  if (um === null) karte.delete(slotKey)
  else karte.set(slotKey, um)
  try { localStorage.setItem(schluessel(userId), JSON.stringify(Object.fromEntries(karte))) } catch { /* kein Speicher */ }
}
