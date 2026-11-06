/**
 * Automatische Qualität für Hoku (Nutzer 06.11.2026: „Qualität und Performance").
 *
 * Hoku misst an seinen eigenen Bildern, wie flüssig die App gerade läuft. Wird
 * es eng (ältere iPhones, eine Seite, die viel malt, wenig freier Speicher),
 * regelt er unauffällig herunter, wird es wieder frei, regelt er hoch, so wie
 * Spiele das tun:
 *   Stufe 0  volle Auflösung, jedes Bild
 *   Stufe 1  drei Viertel der Auflösung (die Punkte werden kaum weicher)
 *   Stufe 2  dazu bei 120 Hz nur jedes zweite Bild gezeichnet (60 Bilder/s)
 * Herunter schnell (zwei schlechte Sekunden hintereinander), hinauf langsam
 * (fünf gute), damit er nicht hin und her springt.
 */
export interface Stufe {
  /** Anteil der vollen Auflösung */
  aufloesung: number
  /** bei 120 Hz nur jedes zweite Bild zeichnen */
  halb: boolean
}

export const STUFEN: readonly Stufe[] = [
  { aufloesung: 1, halb: false },
  { aufloesung: 0.75, halb: false },
  { aufloesung: 0.75, halb: true },
]

/** Ein Bild gilt als Ruck, wenn es länger braucht (ms). */
export const RUCK_AB_MS = 20
/** Längere Lücken sind Pausen (Tab im Hintergrund, Hoku im Haus), kein Ruck. */
const PAUSE_AB_MS = 250
const FENSTER_MS = 1000
const SCHLECHT_AB = 0.15
const GUT_BIS = 0.03
const SCHLECHT_FENSTER = 2
const GUT_FENSTER = 5

export interface Qualitaet {
  readonly stufe: number
  /** Zeit seit dem letzten Bild (ms). Gibt die neue Stufe zurück, wenn sie wechselt, sonst null. */
  bild(intervallMs: number): number | null
}

export function erstelleQualitaet(start = 0): Qualitaet {
  let stufe = start
  let zeit = 0, bilder = 0, rucke = 0, schlecht = 0, gut = 0
  return {
    get stufe() { return stufe },
    bild(iv: number) {
      if (!(iv > 0) || iv > PAUSE_AB_MS) return null
      zeit += iv; bilder++
      if (iv > RUCK_AB_MS) rucke++
      if (zeit < FENSTER_MS) return null
      const anteil = rucke / bilder
      zeit = 0; bilder = 0; rucke = 0
      if (anteil > SCHLECHT_AB) { schlecht++; gut = 0 } else if (anteil < GUT_BIS) { gut++; schlecht = 0 } else { schlecht = 0; gut = 0 }
      if (schlecht >= SCHLECHT_FENSTER && stufe < STUFEN.length - 1) { stufe++; schlecht = 0; return stufe }
      if (gut >= GUT_FENSTER && stufe > 0) { stufe--; gut = 0; return stufe }
      return null
    },
  }
}
