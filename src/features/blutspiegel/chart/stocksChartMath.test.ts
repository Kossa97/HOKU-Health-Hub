import { describe, expect, it } from 'vitest'
import {
  indexAtOrBefore,
  levelAt,
  niceYDomain,
  rangeBounds,
  timeStep,
  timeTicks,
  visibleSlice,
  yDomainFor,
  zoneRuns,
  zoneRunsStepped,
  limitsAt,
  aenderungSeit,
} from './stocksChartMath'

const H = 3_600_000
const D = 24 * H
const NOW = new Date('2026-10-07T12:00:00').getTime()

describe('stocksChartMath', () => {
  it('endet jeden Zeitraum bei jetzt und beginnt nicht vor dem Verlauf', () => {
    expect(rangeBounds('1d', NOW, NOW - 30 * D)).toEqual({ start: NOW - D, end: NOW })
    expect(rangeBounds('1w', NOW, NOW - 3 * D)).toEqual({ start: NOW - 3 * D, end: NOW })
    expect(rangeBounds('cycle', NOW, NOW - 40 * D)).toEqual({ start: NOW - 40 * D, end: NOW })
    // Verlauf erst seit Minuten: mindestens eine Stunde Fenster
    expect(rangeBounds('1m', NOW, NOW - 60_000).start).toBe(NOW - H)
  })

  it('findet und interpoliert Punkte', () => {
    const pts = [{ ts: 0, level: 0 }, { ts: 10, level: 100 }, { ts: 20, level: 50 }]
    expect(indexAtOrBefore(pts, -1)).toBe(-1)
    expect(indexAtOrBefore(pts, 15)).toBe(1)
    expect(levelAt(pts, 5)).toBe(50)
    expect(levelAt(pts, 25)).toBeNull()
    expect(visibleSlice(pts, 12, 14)).toEqual([pts[1], pts[2]])
  })

  it('skaliert Y auf den sichtbaren Ausschnitt mit runden Schritten', () => {
    const d = niceYDomain(62, 81)
    expect(d.lo).toBeLessThanOrEqual(62)
    expect(d.hi).toBeGreaterThanOrEqual(81)
    expect(d.lo).toBeGreaterThan(40)
    expect(d.ticks[0]).toBe(d.lo)
    expect(d.ticks[d.ticks.length - 1]).toBe(d.hi)
    expect(niceYDomain(0, 0.3).lo).toBe(0)
    // nie ueber 100, wenn der Spiegel 100 nicht ueberschreitet
    expect(niceYDomain(0, 100).hi).toBe(100)
    expect(niceYDomain(20, 99).hi).toBe(100)
    // flache Kurve wird nicht zum Gebirge
    const flat = niceYDomain(50, 50.1)
    expect(flat.hi - flat.lo).toBeGreaterThanOrEqual(2)
  })

  it('nimmt fuer Y nur den sichtbaren Ausschnitt', () => {
    const pts = [{ ts: 0, level: 100 }, { ts: 10 * H, level: 40 }, { ts: 20 * H, level: 30 }]
    const d = yDomainFor(pts, 12 * H, 20 * H)
    expect(d.hi).toBeLessThan(60)
  })

  it('legt Zeit-Ticks auf lokale Stunden bzw. Mitternacht', () => {
    expect(timeStep(NOW - D, NOW, 360)).toBe(6 * H)
    const ticks = timeTicks(NOW - D, NOW, 6 * H)
    expect(ticks.every(t => new Date(t).getHours() % 6 === 0 && new Date(t).getMinutes() === 0)).toBe(true)
    const days = timeTicks(NOW - 7 * D, NOW, D)
    expect(days).toHaveLength(7)
    expect(days.every(t => new Date(t).getHours() === 0)).toBe(true)
  })
})

describe('yDomainFor mit Optionen', () => {
  it('nimmt Zusatzwerte auf und deckelt Laborwerte nicht bei 100', () => {
    const pts = [{ ts: 0, level: 60 }, { ts: 10, level: 90 }]
    const d = yDomainFor(pts, 0, 10, { include: [40, 120], percentCap: false, minSpan: 9 })
    expect(d.lo).toBeLessThanOrEqual(40)
    expect(d.hi).toBeGreaterThanOrEqual(120)
    const capped = yDomainFor(pts, 0, 10)
    expect(capped.hi).toBeLessThanOrEqual(100)
  })
  it('kleine Werte bekommen feine Schritte', () => {
    const d = yDomainFor([{ ts: 0, level: 1.2 }, { ts: 10, level: 2.4 }], 0, 10, { percentCap: false, minSpan: 0.24 })
    expect(d.hi - d.lo).toBeLessThan(5)
  })
})

describe('niceYDomain mit negativen Werten', () => {
  it('Laborwerte duerfen unter 0, der Spiegel nicht', () => {
    expect(niceYDomain(-3, 1, 4, { percentCap: false }).lo).toBeLessThanOrEqual(-3)
    expect(niceYDomain(-3, 1).lo).toBe(0)
  })
})

describe('zoneRuns', () => {
  const p = (ts: number, level: number) => ({ ts, level })

  it('teilt genau an der Grenze und fasst gleiche Lage zusammen', () => {
    // 500, 620, 740 im Bereich 349–1110, dann 1310 darüber
    const runs = zoneRuns([p(0, 500), p(10, 620), p(20, 740), p(30, 1310)], 349, 1110)
    expect(runs).toHaveLength(2)
    expect(runs[0]).toMatchObject({ from: -Infinity, inside: true })
    expect(runs[0].to).toBeCloseTo(20 + (1110 - 740) / (1310 - 740) * 10)
    expect(runs[1]).toMatchObject({ from: runs[0].to, to: Infinity, inside: false })
  })

  it('kreuzt ein Stück beide Grenzen, gibt es drei Abschnitte', () => {
    const runs = zoneRuns([p(0, 0), p(100, 200)], 50, 150)
    expect(runs.map(r => r.inside)).toEqual([false, true, false])
    expect(runs[1].from).toBeCloseTo(25)
    expect(runs[1].to).toBeCloseTo(75)
  })

  it('einseitige Grenze, ein Punkt, keine Punkte', () => {
    expect(zoneRuns([p(0, 30), p(10, 70)], 40, null).map(r => r.inside)).toEqual([false, true])
    expect(zoneRuns([p(0, 5)], 1, 3)).toEqual([{ from: -Infinity, to: Infinity, inside: false }])
    expect(zoneRuns([], 1, 3)).toEqual([])
  })
})

describe('zoneRunsStepped', () => {
  const p = (ts: number, level: number) => ({ ts, level })

  it('wechselt den Bereich zum Zeitpunkt des Schritts', () => {
    // Wert 450 durchgehend; bis t=50 gilt 110–510 (im Bereich), danach 110–370 (darueber)
    const runs = zoneRunsStepped([p(0, 450), p(100, 450)], [{ from: 0, lo: 110, hi: 510 }, { from: 50, lo: 110, hi: 370 }])
    expect(runs).toEqual([
      { from: -Infinity, to: 50, zone: 'inside' },
      { from: 50, to: Infinity, zone: 'outside' },
    ])
  })

  it('gleiche Lage ueber Schritte hinweg wird zusammengefasst; ohne Grenzen „none“', () => {
    const runs = zoneRunsStepped([p(0, 5), p(100, 5)], [
      { from: 0, lo: 1, hi: 10 }, { from: 30, lo: 2, hi: 9 }, { from: 60, lo: null, hi: null },
    ])
    expect(runs).toEqual([
      { from: -Infinity, to: 60, zone: 'inside' },
      { from: 60, to: Infinity, zone: 'none' },
    ])
  })

  it('limitsAt nimmt den letzten Schritt bis ts, davor den ersten', () => {
    const steps = [{ from: 10, lo: 1, hi: 2 }, { from: 20, lo: 3, hi: 4 }]
    expect(limitsAt(steps, 5)).toEqual(steps[0])
    expect(limitsAt(steps, 25)).toEqual(steps[1])
    expect(limitsAt([], 25)).toBeNull()
  })
})

describe('aenderungSeit', () => {
  const p = (ts: number, level: number) => ({ ts, level })
  it('vom Wert zum Startzeitpunkt bis zum letzten Punkt', () => {
    expect(aenderungSeit([p(0, 10), p(100, 30)], 50)).toBeCloseTo(10)
  })
  it('beginnt der Verlauf später, zählt sein Anfang; ohne Punkte nichts', () => {
    expect(aenderungSeit([p(100, 10), p(200, 4)], 0)).toBe(-6)
    expect(aenderungSeit([], 0)).toBeNull()
    expect(aenderungSeit([p(5, 3)], 0)).toBeNull()
  })
})
