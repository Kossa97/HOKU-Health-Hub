/**
 * MET-Werte je Art der Einheit, fuer den Kalorien-Schaetzwert, wenn weder Uhr
 * noch Nutzer einen Verbrauch liefern:  kcal ≈ MET × kg Koerpergewicht × Stunden.
 *
 * Quelle: Herrmann SD, Willis EA, Ainsworth BE et al. „2024 Adult Compendium of
 * Physical Activities: A third update of the energy costs of human activities.“
 * J Sport Health Sci 2024;13(1):6–12, doi:10.1016/j.jshs.2023.10.010,
 * Listen unter https://pacompendium.com.
 *
 * Je Art ist ein typischer Eintrag gewaehlt (leicht / mittel / hart), Werte auf
 * eine Nachkommastelle wie im Compendium. Arten ohne eigenen Eintrag (Hyrox,
 * Sport allgemein, Sonstiges) sind aus verwandten Eintraegen abgeleitet und
 * unten so gekennzeichnet. Es bleibt ein Schaetzwert: Abweichungen von ±20 %
 * gegenueber Messung sind normal.
 */
import type { SessionKind } from '../types'

interface MetRange {
  light: number
  moderate: number
  vigorous: number
}

const MET_RANGE_BY_KIND: Record<SessionKind, MetRange> = {
  // Krafttraining: leichte/moderate Anstrengung 3.5; Kraft-/Bodybuilding, hart 6.0.
  strength: { light: 3.0, moderate: 3.5, vigorous: 6.0 },
  // Laufen: Jogging allgemein 7.0; ~9,7 km/h 9.8; ~11,3 km/h 11.0.
  run: { light: 7.0, moderate: 9.8, vigorous: 11.0 },
  // Radfahren: Freizeit < 16 km/h 4.0; allgemein 7.5; 22–25 km/h zuegig 10.0.
  cycle: { light: 4.0, moderate: 7.5, vigorous: 10.0 },
  // Schwimmen: Freistil langsam 5.8 (mittel), locker/Brust gemaechlich 4.8, Freistil schnell 9.8.
  swim: { light: 4.8, moderate: 5.8, vigorous: 9.8 },
  // Rudergeraet: leicht 4.8; ~100 W moderat 7.0; ~150 W hart 8.5.
  row: { light: 4.8, moderate: 7.0, vigorous: 8.5 },
  // Gehen: ~4 km/h 3.0; ~5 km/h 3.5; ~6,4 km/h zuegig 5.0.
  walk: { light: 3.0, moderate: 3.5, vigorous: 5.0 },
  // Wandern: Gelaende normal 5.3; querfeldein 6.0; bergauf mit Gepaeck 7.8.
  hike: { light: 5.3, moderate: 6.0, vigorous: 7.8 },
  // Zirkeltraining: moderat 4.3; allgemein mit wenig Pause, hart 8.0.
  hiit: { light: 4.3, moderate: 8.0, vigorous: 9.0 },
  // Hyrox: kein eigener Eintrag. Abgeleitet: halb Laufen (9.8), halb Zirkel (8.0).
  hyrox: { light: 6.5, moderate: 8.5, vigorous: 10.0 },
  // Yoga: Dehnen mild 2.3 (leicht); Hatha 2.5; Power-Yoga 4.0.
  yoga: { light: 2.3, moderate: 2.5, vigorous: 4.0 },
  // Mobility/Dehnen: mild 2.3; Pilates allgemein 3.0 als harte Variante.
  mobility: { light: 2.0, moderate: 2.3, vigorous: 3.0 },
  // Sport allgemein: abgeleitet aus Ballsport-Freizeit (Basketball 6.5, Fussball locker 7.0, Tennis Doppel 4.5).
  sport: { light: 4.5, moderate: 6.0, vigorous: 8.0 },
  // Sonstiges: abgeleitet, entspricht moderater Alltagsbewegung/Gymnastik.
  other: { light: 3.0, moderate: 4.0, vigorous: 6.0 },
}

/** MET bei mittlerer Anstrengung je Art der Einheit. */
export const MET_BY_KIND: Record<SessionKind, number> = Object.fromEntries(
  Object.entries(MET_RANGE_BY_KIND).map(([kind, range]) => [kind, range.moderate]),
) as Record<SessionKind, number>

/**
 * MET passend zur gefuehlten Anstrengung der Einheit (RPE 1–10).
 * Grob in drei Stufen: bis 4 leicht, 5–7 mittel, ab 8 hart.
 * Ohne RPE (null) gilt der mittlere Wert.
 */
export function metForIntensity(kind: SessionKind, rpe: number | null): number {
  const range = MET_RANGE_BY_KIND[kind] ?? MET_RANGE_BY_KIND.other
  if (rpe == null || !Number.isFinite(rpe)) return range.moderate
  if (rpe <= 4) return range.light
  if (rpe >= 8) return range.vigorous
  return range.moderate
}
