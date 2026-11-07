import type { Rohdaten, Tag } from './typen.ts'
import { lokaleStunde, lokalerTag, tageZwischen } from './zeit.ts'

/** Ein Tag je Datum von `von` bis `bis` (inklusive), aufsteigend. Lücken bleiben null. */
export function baueTage(roh: Rohdaten, zone: string, von: string, bis: string): Tag[] {
  const tage = new Map<string, Tag>()
  for (const datum of tageZwischen(von, bis)) {
    tage.set(datum, { datum, schlafMin: null, energie: null, proteinG: null, trainingsStunden: [], tagebuch: false })
  }

  for (const h of roh.health) {
    const t = tage.get(h.day)
    if (t) t.schlafMin = h.sleep_min
  }
  for (const l of roh.tagebuch) {
    const t = tage.get(l.log_date)
    if (!t) continue
    t.energie = l.energie
    t.tagebuch = true
  }
  for (const e of roh.effekte) {
    const t = tage.get(lokalerTag(e.occurred_at, zone))
    if (t) t.tagebuch = true
  }
  // Schnelleinträge tragen keine Menge: zählen nicht als Proteinangabe
  for (const e of roh.essen) {
    if (e.source === 'quick') continue
    const t = tage.get(e.log_date)
    if (t) t.proteinG = (t.proteinG ?? 0) + e.protein_g
  }
  for (const tr of [...roh.trainings].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))) {
    const t = tage.get(lokalerTag(tr.startedAt, zone))
    if (t) t.trainingsStunden.push(lokaleStunde(tr.startedAt, zone))
  }

  return [...tage.values()]
}
