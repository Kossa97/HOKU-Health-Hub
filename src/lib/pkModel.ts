/**
 * Ein-Kompartiment-Modell mit Resorption erster Ordnung (Bateman-Funktion).
 *
 * Die einzige Stelle, an der die Formel steht. Vorher lag sie dreimal im Code
 * (Live-Spiegel, Verlauf, manuelle Simulation) — eine Korrektur an einer
 * Stelle haette die drei Kurven auseinanderlaufen lassen.
 *
 *   C(t) = F · D · ka / (ka − ke) · (e^(−ke·t) − e^(−ka·t))
 *
 * Konzentration ohne Verteilungsvolumen: die Kurven werden auf ihren Peak
 * normiert, absolute Werte zeigt die App bewusst nicht.
 */

export interface PkRates {
  /** Eliminationskonstante (1/h) */
  ke: number
  /** Resorptionskonstante (1/h) */
  ka: number
}

/** Unterhalb dieses Abstands gilt ka = ke (Grenzfall der Formel). */
const RATE_EPSILON = 1e-8

/** Zeit des Peaks einer Einzeldosis: tmax = ln(ka/ke) / (ka − ke). */
export function tmaxForRates({ ke, ka }: PkRates): number {
  if (Math.abs(ka - ke) < RATE_EPSILON) return 1 / ke
  return Math.log(ka / ke) / (ka - ke)
}

/**
 * Loest tmax = ln(ka/ke) / (ka − ke) nach ka.
 *
 * Frueher galt `ka = ln2 / tmax` — das behandelt tmax wie eine
 * Resorptions-Halbwertszeit, und der Peak der Kurve lag dann deutlich spaeter
 * als das tmax im Profil (t½ 165 h, tmax 56 h → Peak bei 132 h; t½ 2 h,
 * tmax 0,5 h → Peak bei 1,3 h).
 *
 * tmax ist in ka streng fallend (von ∞ fuer ka → 0 bis 0 fuer ka → ∞),
 * deshalb gibt es genau eine Loesung. Ist tmax laenger als 1/ke, liegt sie
 * unter ke ("Flip-Flop"-Kinetik, typisch fuer Depotpraeparate).
 */
export function absorptionRateForTmax(tmaxHours: number, ke: number): number {
  const atEqual = 1 / ke
  if (Math.abs(tmaxHours - atEqual) < 1e-9 * atEqual) return ke

  // Bisektion auf log(ka): eine Seite ist ke, die andere wird so lange
  // verdoppelt bzw. halbiert, bis tmax eingeschlossen ist.
  let lo: number
  let hi: number
  if (tmaxHours < atEqual) {
    lo = ke
    hi = ke * 2
    while (tmaxForRates({ ke, ka: hi }) > tmaxHours) hi *= 2
  } else {
    hi = ke
    lo = ke / 2
    while (tmaxForRates({ ke, ka: lo }) < tmaxHours) lo /= 2
  }
  for (let i = 0; i < 100; i++) {
    const mid = Math.sqrt(lo * hi)
    // fallend: zu grosses tmax heisst ka zu klein
    if (tmaxForRates({ ke, ka: mid }) > tmaxHours) lo = mid
    else hi = mid
    if (hi / lo - 1 < 1e-12) break
  }
  return Math.sqrt(lo * hi)
}

/** ke und ka aus Halbwertszeit und tmax; null bei unbrauchbaren Werten. */
export function pkRates(halfLifeHours: number, tmaxHours: number): PkRates | null {
  if (!(halfLifeHours > 0) || !(tmaxHours > 0)) return null
  if (!Number.isFinite(halfLifeHours) || !Number.isFinite(tmaxHours)) return null
  const ke = Math.LN2 / halfLifeHours
  return { ke, ka: absorptionRateForTmax(tmaxHours, ke) }
}

/** Beitrag einer Dosis `hoursSinceDose` Stunden nach der Gabe. */
export function singleDoseLevel(
  amount: number,
  bioavailability: number,
  hoursSinceDose: number,
  { ke, ka }: PkRates,
): number {
  if (hoursSinceDose <= 0) return 0
  const scaled = amount * bioavailability
  if (Math.abs(ka - ke) < RATE_EPSILON) {
    return scaled * ka * hoursSinceDose * Math.exp(-ke * hoursSinceDose)
  }
  return Math.max(0, scaled * (ka / (ka - ke)) * (Math.exp(-ke * hoursSinceDose) - Math.exp(-ka * hoursSinceDose)))
}

/** Anteil, der in einer Stunde abgebaut wird: 1 − e^(−ke), nicht ke selbst. */
export function fractionEliminatedPerHour(halfLifeHours: number): number {
  return 1 - Math.pow(0.5, 1 / halfLifeHours)
}
