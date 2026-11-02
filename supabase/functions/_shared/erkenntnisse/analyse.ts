import { baueTage } from './tage.ts'
import { KATALOG } from './katalog.ts'
import { kraftRekorde, tagebuchSerie, vergleiche } from './detektoren.ts'
import type { Kandidat } from './detektoren.ts'
import { benjaminiHochberg } from './statistik.ts'
import type { Fund, Rohdaten } from './typen.ts'
import { tagePlus } from './zeit.ts'

const FENSTER_TAGE = 90
// Größte T7-Marke (365) plus die 7 Tage, in denen sie gemeldet wird: der Beginn jeder meldbaren
// Serie liegt im Fenster, ihr Schlüssel wandert nicht mit. Die Edge Function lädt passend dazu.
export const SERIE_TAGE = 372
const Q_DEUTLICH = 0.05
const Q_HINWEIS = 0.1
const MIN_TAGE_DEUTLICH = 12

/**
 * Nächtlicher Lauf: alle Detektoren über die letzten 90 abgeschlossenen Tage (bis gestern).
 * `roh.trainings` darf die ganze Geschichte sein (R4 vergleicht damit), H1 und E2 schneidet `baueTage`.
 * `ausschliessen`: Übungs-IDs, die R4 nicht bewertet (eigene Übungen mit Unterstützung).
 */
export function analysiere(roh: Rohdaten, zone: string, heute: string, ausschliessen?: ReadonlySet<string>): Fund[] {
  const bis = tagePlus(heute, -1)
  const von = tagePlus(heute, -FENSTER_TAGE)
  const tage = baueTage(roh, zone, von, bis)

  const kandidaten = KATALOG.map((e) => vergleiche(e, tage)).filter((k): k is Kandidat => k !== null)
  const q = benjaminiHochberg(kandidaten.map((k) => k.p))

  const funde: Fund[] = []
  kandidaten.forEach((k, i) => {
    if (q[i] <= Q_DEUTLICH && k.nMin >= MIN_TAGE_DEUTLICH) funde.push({ ...k.fund, datenlage: 'deutlich' })
    else if (q[i] <= Q_HINWEIS) funde.push({ ...k.fund, datenlage: 'hinweis' })
  })

  // T7 braucht eine längere Reihe: die Marken 100 und 365 liegen jenseits der 90 Tage
  const serie = tagebuchSerie(baueTage(roh, zone, tagePlus(heute, -SERIE_TAGE), bis))
  if (serie) funde.push(serie)
  funde.push(...kraftRekorde(roh.trainings, zone, bis, ausschliessen))
  return funde
}
