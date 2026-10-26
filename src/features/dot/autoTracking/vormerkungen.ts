/**
 * „Tesa heute erst um 22 Uhr": Dot merkt sich auf diesem Gerät die neue Zeit
 * eines Platzes, und das automatische Eintragen wartet bis dahin. Danach trägt
 * es mit genau dieser Zeit ein und vergisst die Vormerkung. Entscheidet der
 * Nutzer den Platz selbst, fällt sie weg; älter als `TAGE` zählt sie nicht.
 *
 * Nur auf diesem Gerät: wer auf einem anderen Gerät öffnet, sieht die
 * Einnahme offen und hakt sie dort ab.
 */

const schluessel = (userId: string) => `tyd.dot.vormerkungen.${userId}`
/** So weit zurück wie das automatische Eintragen (`MAX_TAGE`). */
const TAGE = 14

/** Je Platz (routine_slot_key): ab wann Dot ihn als genommen einträgt (ms). */
export function ladeVormerkungen(userId: string, jetzt = Date.now()): Map<string, number> {
  try {
    const roh = JSON.parse(localStorage.getItem(schluessel(userId)) || '{}') as Record<string, unknown>
    return new Map(Object.entries(roh).flatMap(([k, v]) => (
      typeof v === 'number' && v > jetzt - TAGE * 86_400_000 ? [[k, v] as [string, number]] : []
    )))
  } catch { return new Map() }
}

/** Setzt (ms) oder löscht (null) die Vormerkung eines Platzes. false: ging nicht (kein Speicher). */
export function setzeVormerkung(userId: string, slotKey: string, um: number | null): boolean {
  const karte = ladeVormerkungen(userId)
  if (um === null && !karte.has(slotKey)) return true
  if (um === null) karte.delete(slotKey)
  else karte.set(slotKey, um)
  try {
    localStorage.setItem(schluessel(userId), JSON.stringify(Object.fromEntries(karte)))
    return um === null || ladeVormerkungen(userId).get(slotKey) === um
  } catch { return false }
}
