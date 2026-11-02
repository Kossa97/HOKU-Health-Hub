import type { KatalogEintrag } from './katalog.ts'
import { seed, permutationsTest, zufall } from './statistik.ts'
import type { Fund, Tag, Training } from './typen.ts'
import { lokalerTag, tagePlus } from './zeit.ts'

const MIN_TAGE_JE_GRUPPE = 8
const LAEUFE = 2000

export interface Kandidat {
  fund: Omit<Fund, 'datenlage'>
  p: number
  nMin: number
}

function mittel(werte: number[]): number {
  return werte.reduce((s, x) => s + x, 0) / werte.length
}

function runde(x: number, einheit: KatalogEintrag['einheit']): number {
  return einheit === 'punkte' ? Math.round(x * 10) / 10 : Math.round(x)
}

/**
 * Katalog-Vergleich (H1, E2, W1): Messwert an Tag D + Versatz, getrennt nach der
 * Gruppe an Tag D. Gibt nur einen Kandidaten zurück, wenn beide Gruppen mindestens
 * 8 Tage haben und der Unterschied den Mindesteffekt erreicht.
 */
export function vergleiche(e: KatalogEintrag, tage: Tag[]): Kandidat | null {
  let a: number[] = []
  let b: number[] = []
  for (let i = 0; i < tage.length; i++) {
    const gruppe = e.gruppe(tage[i])
    if (gruppe == null) continue
    const messtag = tage[i + e.versatzTage]
    if (!messtag) continue
    const wert = messtag[e.messwert]
    if (wert == null) continue
    ;(gruppe === 'a' ? a : b).push(wert)
  }
  if (a.length < MIN_TAGE_JE_GRUPPE || b.length < MIN_TAGE_JE_GRUPPE) return null

  let namen = e.gruppen
  let mittelA = mittel(a)
  let mittelB = mittel(b)
  if (e.besser === 'hoeher' && mittelA < mittelB) {
    ;[a, b] = [b, a]
    ;[mittelA, mittelB] = [mittelB, mittelA]
    namen = { a: e.gruppen.b, b: e.gruppen.a }
  }
  const differenz = mittelA - mittelB
  if (Math.abs(differenz) < e.minEffekt) return null
  // Gezeigt werden die gerundeten Mittel: die Differenz im Satz muss zu ihnen passen
  const gerundetA = runde(mittelA, e.einheit)
  const gerundetB = runde(mittelB, e.einheit)

  const zeitraum = { von: tage[0].datum, bis: tage[tage.length - 1].datum }
  const schluessel = `${e.id}:${namen.a}`
  const werte: Fund['werte'] = {
    gruppe_a: namen.a,
    gruppe_b: namen.b,
    mittel_a: gerundetA,
    mittel_b: gerundetB,
    n_a: a.length,
    n_b: b.length,
    differenz: runde(gerundetA - gerundetB, e.einheit),
    einheit: e.einheit,
  }
  if (e.grenze !== undefined) werte.grenze = e.grenze

  return {
    fund: {
      id: e.id,
      schluessel,
      bezug: null,
      richtung: 'neutral',
      staerke: Math.min(1, Math.abs(differenz) / (3 * e.minEffekt)),
      zeitraum,
      werte,
    },
    p: permutationsTest(a, b, LAEUFE, zufall(seed(schluessel + zeitraum.bis))),
    nMin: Math.min(a.length, b.length),
  }
}

const MARKEN = [7, 14, 30, 60, 100, 365]

/**
 * T7: Tagebuch-Serie, die am letzten Tag endet und in den letzten 7 Tagen eine Marke erreicht hat.
 * Der Schlüssel trägt den ersten Tag der Serie: eine spätere Serie mit derselben Marke ist ein
 * neuer Fund. Dafür muss `tage` den Beginn jeder meldbaren Serie enthalten (größte Marke + 7 Tage).
 */
export function tagebuchSerie(tage: Tag[]): Fund | null {
  let laenge = 0
  while (laenge < tage.length && tage[tage.length - 1 - laenge].tagebuch) laenge++
  const marke = [...MARKEN].reverse().find((m) => m <= laenge)
  if (marke === undefined || laenge - marke > 6) return null
  const von = tage[tage.length - laenge].datum
  return {
    id: 'T7',
    schluessel: `T7:tagebuch:${marke}:${von}`,
    bezug: null,
    richtung: 'positiv',
    datenlage: 'deutlich',
    staerke: 0.6,
    zeitraum: { von, bis: tage[tage.length - 1].datum },
    werte: { tage: marke },
  }
}

/** Geschätztes Einer-Maximum (Epley, 1–12 Wiederholungen). Gleiche Formel wie `estimateOneRepMax` der App. */
export function einRM(weightKg: number | null | undefined, reps: number | null | undefined): number | null {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0 || reps > 12) return null
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

function aufHalbeKg(x: number): number {
  return Math.round(x * 2) / 2
}

/**
 * Katalogübungen mit Erfassung `assisted_reps` (Gewicht = Hilfe, mehr ist leichter). Gleiche Liste wie
 * im Übungskatalog der App, gepinnt in `unterstuetzt.test.ts`.
 */
export const UNTERSTUETZT: readonly string[] = ['chest_dip_assisted', 'pull_up_assisted']

/**
 * R4: neues bestes geschätztes Einer-Maximum je Übung in den letzten 7 Tagen (bis einschließlich `bis`).
 * `trainings` ist die ganze Geschichte: „vorher“ heißt alle Einheiten davor, wie in der App.
 * Übungen mit Unterstützung (`UNTERSTUETZT` und `ausschliessen`, z. B. eigene) zählen nicht.
 */
export function kraftRekorde(trainings: Training[], zone: string, bis: string, ausschliessen: ReadonlySet<string> = new Set()): Fund[] {
  const von = tagePlus(bis, -6)
  const je = new Map<string, { davor: number | null; einheitenDavor: number; jetzt: number | null }>()

  for (const training of trainings) {
    const tag = lokalerTag(training.startedAt, zone)
    if (tag > bis) continue
    const bestJeUebung = new Map<string, number>()
    for (const ex of training.exercises) {
      if (ausschliessen.has(ex.exerciseId) || UNTERSTUETZT.includes(ex.exerciseId)) continue
      for (const satz of ex.sets) {
        if (satz.type === 'warmup') continue
        const wert = einRM(satz.weightKg, satz.reps)
        if (wert == null) continue
        const bisher = bestJeUebung.get(ex.exerciseId)
        if (bisher === undefined || wert > bisher) bestJeUebung.set(ex.exerciseId, wert)
      }
    }
    for (const [id, wert] of bestJeUebung) {
      const stand = je.get(id) ?? { davor: null, einheitenDavor: 0, jetzt: null }
      if (tag < von) {
        stand.einheitenDavor++
        if (stand.davor === null || wert > stand.davor) stand.davor = wert
      } else if (stand.jetzt === null || wert > stand.jetzt) {
        stand.jetzt = wert
      }
      je.set(id, stand)
    }
  }

  const funde: Fund[] = []
  for (const id of [...je.keys()].sort()) {
    const { davor, einheitenDavor, jetzt } = je.get(id)!
    if (jetzt === null || davor === null || einheitenDavor < 3 || jetzt <= davor) continue
    const kg = aufHalbeKg(jetzt)
    const vorher = aufHalbeKg(davor)
    if (kg <= vorher) continue // gerundet kein sichtbarer Rekord
    funde.push({
      id: 'R4',
      schluessel: `R4:${id}:${kg}`,
      bezug: id,
      richtung: 'positiv',
      datenlage: 'deutlich',
      staerke: 0.7,
      zeitraum: { von, bis },
      werte: { kg, vorher },
    })
  }
  return funde
}
