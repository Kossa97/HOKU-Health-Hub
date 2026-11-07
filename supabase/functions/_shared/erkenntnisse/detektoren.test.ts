import { describe, expect, it } from 'vitest'
import { KATALOG } from './katalog.ts'
import { UNTERSTUETZT, kraftRekorde, tagebuchSerie, vergleiche } from './detektoren.ts'
import { tagePlus } from './zeit.ts'
import type { Tag, Training } from './typen.ts'

const START = '2026-09-01'

function tag(datum: string, teil: Partial<Tag> = {}): Tag {
  return { datum, schlafMin: null, energie: null, proteinG: null, trainingsStunden: [], tagebuch: false, ...teil }
}

/** n aufeinanderfolgende Tage ab START; `teil(i)` liefert die Felder von Tag i. */
function reihe(n: number, teil: (i: number) => Partial<Tag>): Tag[] {
  return Array.from({ length: n }, (_, i) => tag(tagePlus(START, i), teil(i)))
}

/** Trainingstag (Index 2k) mit Startstunde, Schlaf am Folgetag (Index 2k+1). */
function schlafNachTraining(stunden: number[], schlaf: number[]): Tag[] {
  return reihe(stunden.length * 2, (i) => {
    const k = Math.floor(i / 2)
    return i % 2 === 0 ? { trainingsStunden: [stunden[k]] } : { schlafMin: schlaf[k] }
  })
}

const H1 = KATALOG.find((e) => e.id === 'H1')!
const E2 = KATALOG.find((e) => e.id === 'E2')!
const W1 = KATALOG.find((e) => e.id === 'W1')!

describe('erkenntnisse: Katalog', () => {
  it('enthält H1, E2, W1 mit den Werten der Spec', () => {
    expect(KATALOG.map((e) => e.id)).toEqual(['H1', 'E2', 'W1'])
    expect(H1).toMatchObject({ messwert: 'schlafMin', versatzTage: 1, minEffekt: 15, einheit: 'min', besser: 'hoeher', grenze: 21, gruppen: { a: 'vor_grenze', b: 'ab_grenze' } })
    expect(E2).toMatchObject({ messwert: 'proteinG', versatzTage: 0, minEffekt: 15, einheit: 'g', besser: null, gruppen: { a: 'trainingstag', b: 'ruhetag' } })
    expect(W1).toMatchObject({ messwert: 'energie', versatzTage: 0, minEffekt: 0.8, einheit: 'punkte', besser: 'hoeher', grenze: 7, gruppen: { a: 'schlaf_ab_grenze', b: 'schlaf_unter_grenze' } })
  })

  it('H1 gruppiert nur Trainingstage: alle vor 21 Uhr = a, mindestens eine ab 21 Uhr = b', () => {
    expect(H1.gruppe(tag('2026-09-01'))).toBeNull()
    expect(H1.gruppe(tag('2026-09-01', { trainingsStunden: [18] }))).toBe('a')
    expect(H1.gruppe(tag('2026-09-01', { trainingsStunden: [9, 20] }))).toBe('a')
    expect(H1.gruppe(tag('2026-09-01', { trainingsStunden: [9, 21] }))).toBe('b')
    expect(H1.gruppe(tag('2026-09-01', { trainingsStunden: [23] }))).toBe('b')
  })

  it('E2 trennt Trainings- und Ruhetag, W1 trennt bei 420 Minuten Schlaf', () => {
    expect(E2.gruppe(tag('2026-09-01', { trainingsStunden: [7] }))).toBe('a')
    expect(E2.gruppe(tag('2026-09-01'))).toBe('b')
    expect(W1.gruppe(tag('2026-09-01', { schlafMin: 420 }))).toBe('a')
    expect(W1.gruppe(tag('2026-09-01', { schlafMin: 419 }))).toBe('b')
    expect(W1.gruppe(tag('2026-09-01'))).toBeNull()
  })
})

describe('erkenntnisse: vergleiche', () => {
  const tageH1 = schlafNachTraining([...Array(10).fill(18), ...Array(10).fill(22)], [...Array(10).fill(470), ...Array(10).fill(420)])

  it('H1: früh trainieren, danach länger schlafen', () => {
    const k = vergleiche(H1, tageH1)!
    expect(k.fund.id).toBe('H1')
    expect(k.fund.werte).toMatchObject({ gruppe_a: 'vor_grenze', gruppe_b: 'ab_grenze', mittel_a: 470, mittel_b: 420, differenz: 50, einheit: 'min', grenze: 21, n_a: 10, n_b: 10 })
    expect(k.fund.schluessel).toBe('H1:vor_grenze')
    expect(k.fund.richtung).toBe('neutral')
    expect(k.fund.bezug).toBeNull()
    expect(k.fund.staerke).toBe(1) // 50 / (3 * 15) > 1, gedeckelt
    expect(k.fund.zeitraum).toEqual({ von: '2026-09-01', bis: tagePlus(START, 39) })
    expect(k.nMin).toBe(10)
    expect(k.p).toBeGreaterThan(0)
    expect(k.p).toBeLessThan(0.01)
  })

  it('H1 umgekehrt: späte Einheiten schlafen länger, dann ist a die Gruppe ab 21 Uhr', () => {
    const umgekehrt = schlafNachTraining([...Array(10).fill(18), ...Array(10).fill(22)], [...Array(10).fill(420), ...Array(10).fill(470)])
    const k = vergleiche(H1, umgekehrt)!
    expect(k.fund.schluessel).toBe('H1:ab_grenze')
    expect(k.fund.werte).toMatchObject({ gruppe_a: 'ab_grenze', gruppe_b: 'vor_grenze', mittel_a: 470, mittel_b: 420, differenz: 50, n_a: 10, n_b: 10 })
  })

  it('kein Fund bei 7 Tagen in einer Gruppe oder bei zu kleinem Unterschied', () => {
    const nur7 = schlafNachTraining([...Array(10).fill(18), ...Array(7).fill(22)], [...Array(10).fill(470), ...Array(7).fill(420)])
    expect(vergleiche(H1, nur7)).toBeNull()
    const klein = schlafNachTraining([...Array(10).fill(18), ...Array(10).fill(22)], [...Array(10).fill(430), ...Array(10).fill(420)])
    expect(vergleiche(H1, klein)).toBeNull()
  })

  it('genau 8 Tage je Gruppe und genau der Mindesteffekt reichen', () => {
    const grenzfall = schlafNachTraining([...Array(8).fill(18), ...Array(8).fill(22)], [...Array(8).fill(435), ...Array(8).fill(420)])
    expect(vergleiche(H1, grenzfall)).not.toBeNull()
  })

  it('der Folgetag nach dem Zeitraum zählt nicht: ein Trainingstag am letzten Tag fällt weg', () => {
    const stunden = [...Array(8).fill(18), ...Array(8).fill(22)]
    const schlaf = [...Array(8).fill(470), ...Array(8).fill(420)]
    const ok = schlafNachTraining(stunden, schlaf)
    expect(vergleiche(H1, ok)!.fund.werte).toMatchObject({ n_a: 8, n_b: 8 })
    const letzter = ok[ok.length - 1].datum
    const mitLetztemTraining = [...ok, tag(tagePlus(letzter, 1), { trainingsStunden: [22] })]
    expect(vergleiche(H1, mitLetztemTraining)!.fund.werte).toMatchObject({ n_a: 8, n_b: 8 })
  })

  it('Tage ohne Messwert oder ohne Gruppe zählen nicht', () => {
    const luecken = schlafNachTraining([...Array(10).fill(18), ...Array(10).fill(22)], [...Array(10).fill(470), ...Array(10).fill(420)])
    luecken[1] = { ...luecken[1], schlafMin: null } // ein a-Tag verliert den Messwert
    expect(vergleiche(H1, luecken)!.fund.werte).toMatchObject({ n_a: 9, n_b: 10 })
  })

  it('E2: Protein an Trainings- vs Ruhetagen, keine Wertung, Differenz behält ihr Vorzeichen', () => {
    const mehr = reihe(20, (i) => (i % 2 === 0 ? { trainingsStunden: [8], proteinG: 150 } : { proteinG: 120 }))
    const k = vergleiche(E2, mehr)!
    expect(k.fund.schluessel).toBe('E2:trainingstag')
    expect(k.fund.werte).toMatchObject({ gruppe_a: 'trainingstag', gruppe_b: 'ruhetag', mittel_a: 150, mittel_b: 120, differenz: 30, einheit: 'g', n_a: 10, n_b: 10 })
    expect(k.fund.werte).not.toHaveProperty('grenze')
    expect(k.fund.staerke).toBeCloseTo(30 / 45, 10)

    const weniger = reihe(20, (i) => (i % 2 === 0 ? { trainingsStunden: [8], proteinG: 100 } : { proteinG: 130 }))
    const k2 = vergleiche(E2, weniger)!
    expect(k2.fund.schluessel).toBe('E2:trainingstag')
    expect(k2.fund.werte).toMatchObject({ gruppe_a: 'trainingstag', mittel_a: 100, mittel_b: 130, differenz: -30 })
  })

  it('E2: Tage ohne Proteinangabe zählen nicht', () => {
    const t = reihe(20, (i) => (i % 2 === 0 ? { trainingsStunden: [8], proteinG: i < 4 ? null : 150 } : { proteinG: 120 }))
    expect(vergleiche(E2, t)!.fund.werte).toMatchObject({ n_a: 8, n_b: 10 })
  })

  it('W1: Energie nach gutem vs schlechtem Schlaf, punkte auf 0,1 gerundet', () => {
    const t = reihe(16, (i) => (i < 8 ? { schlafMin: 480, energie: i === 0 ? 9 : 8 } : { schlafMin: 360, energie: 6 }))
    const k = vergleiche(W1, t)!
    expect(k.fund.schluessel).toBe('W1:schlaf_ab_grenze')
    expect(k.fund.werte).toMatchObject({ mittel_a: 8.1, mittel_b: 6, differenz: 2.1, einheit: 'punkte', grenze: 7, n_a: 8, n_b: 8 })
  })

  it('Differenz aus den gerundeten Mitteln: Satz und Beleg passen zusammen', () => {
    // 430,6 gegen 380,4 min: ungerundet 50,2 -> 50, gezeigt werden aber 431 und 380
    const schlaf = [...Array(6).fill(431), ...Array(4).fill(430), ...Array(4).fill(381), ...Array(6).fill(380)]
    const k = vergleiche(H1, schlafNachTraining([...Array(10).fill(18), ...Array(10).fill(22)], schlaf))!
    expect(k.fund.werte).toMatchObject({ mittel_a: 431, mittel_b: 380, differenz: 51 })
  })

  it('ist bei gleichen Daten reproduzierbar', () => {
    expect(vergleiche(H1, tageH1)).toEqual(vergleiche(H1, tageH1))
  })

  it('leere Tage geben null', () => {
    expect(vergleiche(H1, [])).toBeNull()
  })
})

describe('erkenntnisse: Tagebuch-Serie (T7)', () => {
  const serie = (n: number, davor = 0): Tag[] => reihe(davor + n, (i) => ({ tagebuch: i >= davor }))

  it('Serie von 15 Tagen bis zum letzten Tag: Marke 14', () => {
    const f = tagebuchSerie(serie(15))!
    expect(f.werte).toEqual({ tage: 14 })
    expect(f).toMatchObject({ id: 'T7', schluessel: `T7:tagebuch:14:${START}`, bezug: null, richtung: 'positiv', datenlage: 'deutlich', staerke: 0.6 })
  })

  it('Schlüssel trägt den Beginn der Serie: eine neue Serie mit derselben Marke ist ein neuer Fund', () => {
    const erste = tagebuchSerie(serie(8))!
    const zweite = tagebuchSerie(serie(8, 30))!
    expect(erste.schluessel).toBe(`T7:tagebuch:7:${START}`)
    expect(zweite.schluessel).toBe(`T7:tagebuch:7:${tagePlus(START, 30)}`)
    // innerhalb einer Serie bleibt er gleich
    expect(tagebuchSerie(serie(9))!.schluessel).toBe(erste.schluessel)
  })

  it('zeitraum reicht vom ersten Tag der Serie bis zum letzten Tag', () => {
    const tage = serie(15, 5)
    expect(tagebuchSerie(tage)!.zeitraum).toEqual({ von: tage[5].datum, bis: tage[19].datum })
  })

  it('zu kurze Serie gibt null', () => {
    expect(tagebuchSerie(serie(6))).toBeNull()
    expect(tagebuchSerie([])).toBeNull()
  })

  it('Serie muss am letzten Tag enden', () => {
    const t = reihe(10, (i) => ({ tagebuch: i < 9 }))
    expect(tagebuchSerie(t)).toBeNull()
  })

  it('Marke 7 ab genau 7 Tagen, höchste erreichte Marke zählt', () => {
    expect(tagebuchSerie(serie(7))!.werte).toEqual({ tage: 7 })
    expect(tagebuchSerie(serie(13))!.werte).toEqual({ tage: 7 })
    expect(tagebuchSerie(serie(14))!.werte).toEqual({ tage: 14 })
  })

  it('Marke nur, wenn sie in den letzten 7 Tagen erreicht wurde', () => {
    expect(tagebuchSerie(serie(20))!.werte).toEqual({ tage: 14 }) // vor 6 Tagen erreicht
    expect(tagebuchSerie(serie(21))).toBeNull() // vor 7 Tagen erreicht
  })

  it('Serie von 40 Tagen: Marke 30 liegt 10 Tage zurück, kein Fund', () => {
    expect(tagebuchSerie(serie(40))).toBeNull()
    expect(tagebuchSerie(serie(36))!.werte).toEqual({ tage: 30 })
  })

  it('große Marken', () => {
    expect(tagebuchSerie(serie(100, 3))!.werte).toEqual({ tage: 100 })
    expect(tagebuchSerie(serie(370))!.werte).toEqual({ tage: 365 })
  })
})

describe('erkenntnisse: Kraft-Rekorde (R4)', () => {
  const ZONE = 'Europe/Berlin'
  const BIS = '2026-11-01'
  const satz = (weightKg: number, reps = 1, type?: string) => ({ weightKg, reps, ...(type ? { type } : {}) })
  const einheit = (startedAt: string, exerciseId: string, sets: ReturnType<typeof satz>[]): Training => ({
    startedAt, kind: 'strength', exercises: [{ exerciseId, sets }],
  })
  const dreiAlte = (kg: number) => ['2026-09-01', '2026-09-08', '2026-09-15'].map((d) => einheit(`${d}T17:00:00Z`, 'bank', [satz(kg)]))
  const zweiAlte = (kg: number) => dreiAlte(kg).slice(0, 2)
  const neu = (kg: number) => einheit('2026-10-30T17:00:00Z', 'bank', [satz(60, 5, 'warmup'), satz(kg)])
  const neuNurAufwaermen = (kg: number) => einheit('2026-10-30T17:00:00Z', 'bank', [satz(kg, 1, 'warmup')])

  it('Rekord mit mindestens 3 Einheiten davor', () => {
    const f = kraftRekorde([...dreiAlte(100), neu(105)], ZONE, BIS)
    expect(f).toHaveLength(1)
    expect(f[0].werte).toEqual({ kg: 105, vorher: 100 })
    expect(f[0]).toMatchObject({ id: 'R4', schluessel: 'R4:bank:105', bezug: 'bank', richtung: 'positiv', datenlage: 'deutlich', staerke: 0.7 })
    expect(f[0].zeitraum).toEqual({ von: '2026-10-26', bis: BIS })
  })

  it('nur 2 Einheiten davor: kein Fund', () => {
    expect(kraftRekorde([...zweiAlte(100), neu(105)], ZONE, BIS)).toEqual([])
  })

  it('Aufwärmsätze zählen nicht', () => {
    expect(kraftRekorde([...dreiAlte(100), neuNurAufwaermen(200)], ZONE, BIS)).toEqual([])
  })

  it('kein Fund ohne Verbesserung oder wenn die Einheit außerhalb der 7 Tage liegt', () => {
    expect(kraftRekorde([...dreiAlte(100), neu(100)], ZONE, BIS)).toEqual([])
    const zuAlt = einheit('2026-10-25T17:00:00Z', 'bank', [satz(105)]) // 25.10. liegt vor dem 26.10.
    expect(kraftRekorde([...dreiAlte(100), zuAlt], ZONE, BIS)).toEqual([])
  })

  it('Einheiten nach `bis` werden ignoriert', () => {
    const spaeter = einheit('2026-11-02T10:00:00Z', 'bank', [satz(105)])
    expect(kraftRekorde([...dreiAlte(100), spaeter], ZONE, BIS)).toEqual([])
  })

  it('der lokale Tag entscheidet über das Fenster', () => {
    // 31.10. 23:30 UTC ist in Berlin schon der 1.11. (= bis)
    const rand = einheit('2026-10-31T23:30:00Z', 'bank', [satz(105)])
    expect(kraftRekorde([...dreiAlte(100), rand], ZONE, BIS)).toHaveLength(1)
    // 25.10. 23:30 UTC ist in Berlin der 26.10. (= von)
    const vonRand = einheit('2026-10-25T23:30:00Z', 'bank', [satz(105)])
    expect(kraftRekorde([...dreiAlte(100), vonRand], ZONE, BIS)).toHaveLength(1)
  })

  it('Epley-Schätzung und Rundung auf 0,5 kg', () => {
    // 100 x 5 = 100 * (1 + 5/30) = 116.7; davor 100 x 1 = 100
    const t = einheit('2026-10-30T17:00:00Z', 'bank', [satz(100, 5)])
    expect(kraftRekorde([...dreiAlte(100), t], ZONE, BIS)[0].werte).toEqual({ kg: 116.5, vorher: 100 })
    // Sätze über 12 Wiederholungen haben keinen Schätzwert
    expect(kraftRekorde([...dreiAlte(100), einheit('2026-10-30T17:00:00Z', 'bank', [satz(200, 13)])], ZONE, BIS)).toEqual([])
  })

  it('Rundung darf keinen Rekord ohne sichtbaren Unterschied melden', () => {
    expect(kraftRekorde([...dreiAlte(100), neu(100.1)], ZONE, BIS)).toEqual([])
  })

  it('mehrere Übungen getrennt, sortiert nach Übungs-ID', () => {
    const alt = (id: string) => ['2026-09-01', '2026-09-08', '2026-09-15'].map((d) => einheit(`${d}T17:00:00Z`, id, [satz(50)]))
    const t = [...alt('squat'), ...alt('bank'), einheit('2026-10-30T17:00:00Z', 'squat', [satz(60)]), einheit('2026-10-31T17:00:00Z', 'bank', [satz(55)])]
    expect(kraftRekorde(t, ZONE, BIS).map((f) => f.bezug)).toEqual(['bank', 'squat'])
  })

  it('Übungen mit Unterstützung zählen nicht: mehr Gewicht heißt dort mehr Hilfe', () => {
    for (const id of UNTERSTUETZT) {
      const alt = ['2026-09-01', '2026-09-08', '2026-09-15'].map((d) => einheit(`${d}T17:00:00Z`, id, [satz(20, 5)]))
      expect(kraftRekorde([...alt, einheit('2026-10-30T17:00:00Z', id, [satz(40, 5)])], ZONE, BIS)).toEqual([])
    }
  })

  it('ausgeschlossene Übungen (eigene mit Unterstützung) zählen nicht, andere schon', () => {
    const alt = (id: string) => ['2026-09-01', '2026-09-08', '2026-09-15'].map((d) => einheit(`${d}T17:00:00Z`, id, [satz(20, 5)]))
    const t = [...alt('custom:abc'), ...alt('bank'), einheit('2026-10-30T17:00:00Z', 'custom:abc', [satz(40, 5)]), einheit('2026-10-30T17:00:00Z', 'bank', [satz(40, 5)])]
    expect(kraftRekorde(t, ZONE, BIS, new Set(['custom:abc'])).map((f) => f.bezug)).toEqual(['bank'])
    expect(kraftRekorde(t, ZONE, BIS).map((f) => f.bezug)).toEqual(['bank', 'custom:abc'])
  })

  it('Einheiten davor zählt je Einheit, nicht je Satz', () => {
    const eine = einheit('2026-09-01T17:00:00Z', 'bank', [satz(100), satz(100), satz(100), satz(100)])
    expect(kraftRekorde([eine, neu(105)], ZONE, BIS)).toEqual([])
  })
})
