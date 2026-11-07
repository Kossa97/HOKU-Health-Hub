import { describe, expect, it } from 'vitest'
import { abgleich, istSonntagLauf, sichtbarAb, waehleWoche } from './auswahl.ts'
import type { Gespeichert } from './auswahl.ts'
import type { Datenlage, Fund, Richtung } from './typen.ts'

function fund(schluessel: string, o: Partial<Fund> = {}): Fund {
  return {
    id: 'H1', schluessel, bezug: null, richtung: 'neutral', datenlage: 'hinweis', staerke: 0.5,
    zeitraum: { von: '2026-10-01', bis: '2026-10-31' }, werte: {}, ...o,
  }
}

function g(schluessel: string, o: Partial<Gespeichert> = {}): Gespeichert {
  return {
    id: `id-${schluessel}`, schluessel, datenlage: 'hinweis', gueltig: true,
    gemeldet_datenlage: null, ausgeblendet: false, ...o,
  }
}

type Spec = { staerke?: number; richtung?: Richtung; datenlage?: Datenlage }
type Gesp = Partial<Gespeichert>

// Kandidat mit id `id-<name>`; Fund-Felder und Gespeichert-Felder getrennt übergeben.
function k(name: string, gesp: Gesp & Spec = {}) {
  const { staerke, richtung, datenlage, ...rest } = gesp
  const f = fund(name, {
    ...(staerke !== undefined ? { staerke } : {}),
    ...(richtung ? { richtung } : {}),
    ...(datenlage ? { datenlage } : {}),
  })
  return { id: `id-${name}`, fund: f, gespeichert: g(name, rest) }
}

describe('erkenntnisse: abgleich', () => {
  it('fügt neue Funde ein und aktualisiert vorhandene', () => {
    const r = abgleich([g('H1:vor_grenze')], [fund('H1:vor_grenze'), fund('T7:tagebuch:14')])
    expect(r.einfuegen.map((f) => f.schluessel)).toEqual(['T7:tagebuch:14'])
    expect(r.aktualisieren.map((a) => a.id)).toEqual(['id-H1:vor_grenze'])
    expect(r.ungueltig).toEqual([])
  })

  it('markiert nicht mehr gefundene, gültige Zeilen als ungültig', () => {
    expect(abgleich([g('E2:trainingstag')], []).ungueltig).toEqual(['id-E2:trainingstag'])
  })

  it('listet bereits ungültige Zeilen nicht erneut', () => {
    expect(abgleich([g('E2:trainingstag', { gueltig: false })], []).ungueltig).toEqual([])
  })

  it('aktualisiert auch ungültige Zeilen, die wieder auftauchen', () => {
    const r = abgleich([g('A', { gueltig: false })], [fund('A')])
    expect(r.aktualisieren).toEqual([{ id: 'id-A', fund: fund('A') }])
    expect(r.einfuegen).toEqual([])
  })

  it('behält die Reihenfolge von neu bzw. alt', () => {
    const r = abgleich([g('X'), g('B'), g('A')], [fund('N2'), fund('A'), fund('N1'), fund('B')])
    expect(r.einfuegen.map((f) => f.schluessel)).toEqual(['N2', 'N1'])
    expect(r.aktualisieren.map((a) => a.id)).toEqual(['id-A', 'id-B'])
    expect(r.ungueltig).toEqual(['id-X'])
    expect(abgleich([g('Z'), g('Y'), g('W')], []).ungueltig).toEqual(['id-Z', 'id-Y', 'id-W'])
  })
})

describe('erkenntnisse: waehleWoche', () => {
  const sechsNeutraleUndEinPositiver = [
    ...['a', 'b', 'c', 'd', 'e', 'f'].map((n, i) => k(n, { staerke: 0.9 - i * 0.1 })),
    k('positiv', { richtung: 'positiv', staerke: 0.1 }),
  ]

  it('nimmt höchstens 5 und holt einen positiven Fund auf den letzten Platz', () => {
    const r = waehleWoche(sechsNeutraleUndEinPositiver)
    expect(r).toHaveLength(5)
    expect(r).toContain('id-positiv')
    expect(r).toEqual(['id-a', 'id-b', 'id-c', 'id-d', 'id-positiv'])
  })

  it('hängt den positiven Fund an, wenn noch Platz ist', () => {
    const r = waehleWoche([
      k('a', { staerke: 0.9 }), k('b', { staerke: 0.8 }), k('c', { staerke: 0.7 }),
      k('p', { richtung: 'positiv', staerke: 0.1 }),
    ])
    expect(r).toEqual(['id-a', 'id-b', 'id-c', 'id-p'])
  })

  it('lässt einen positiven Fund unter den Gewählten an seinem Platz', () => {
    const r = waehleWoche([k('a', { staerke: 0.9 }), k('p', { richtung: 'positiv', staerke: 0.8 }), k('b', { staerke: 0.7 })])
    expect(r).toEqual(['id-a', 'id-p', 'id-b'])
  })

  it('nimmt den stärksten positiven Kandidaten', () => {
    const r = waehleWoche([
      ...['a', 'b', 'c', 'd', 'e'].map((n, i) => k(n, { staerke: 0.9 - i * 0.1 })),
      k('p1', { richtung: 'positiv', staerke: 0.2 }),
      k('p2', { richtung: 'positiv', staerke: 0.3 }),
    ])
    expect(r).toEqual(['id-a', 'id-b', 'id-c', 'id-d', 'id-p2'])
  })

  it('nimmt höchstens zwei kritische', () => {
    const vierKritische = ['a', 'b', 'c', 'd'].map((n, i) => k(n, { richtung: 'kritisch', staerke: 0.9 - i * 0.1 }))
    expect(waehleWoche(vierKritische).length).toBe(2)
    expect(waehleWoche(vierKritische)).toEqual(['id-a', 'id-b'])
  })

  it('überspringt weitere kritische und füllt mit anderen auf', () => {
    const r = waehleWoche([
      k('k1', { richtung: 'kritisch', staerke: 0.9 }), k('k2', { richtung: 'kritisch', staerke: 0.8 }),
      k('k3', { richtung: 'kritisch', staerke: 0.7 }), k('n1', { staerke: 0.1 }),
    ])
    expect(r).toEqual(['id-k1', 'id-k2', 'id-n1'])
  })

  it('hält die Kritisch-Grenze auch nach dem Positiv-Tausch ein', () => {
    const r = waehleWoche([
      k('k1', { richtung: 'kritisch', staerke: 0.9 }), k('k2', { richtung: 'kritisch', staerke: 0.8 }),
      k('k3', { richtung: 'kritisch', staerke: 0.7 }),
      k('n1', { staerke: 0.6 }), k('n2', { staerke: 0.5 }), k('n3', { staerke: 0.4 }),
      k('p', { richtung: 'positiv', staerke: 0.1 }),
    ])
    expect(r).toEqual(['id-k1', 'id-k2', 'id-n1', 'id-n2', 'id-p'])
    expect(r.filter((id) => id.startsWith('id-k')).length).toBeLessThanOrEqual(2)
  })

  it('sortiert gleiche Stärke nach Schlüssel', () => {
    expect(waehleWoche([k('b', { staerke: 0.5 }), k('a', { staerke: 0.5 })])).toEqual(['id-a', 'id-b'])
  })

  it('gibt bei weniger als drei Kandidaten alle zurück', () => {
    expect(waehleWoche([k('a'), k('b')])).toEqual(['id-a', 'id-b'])
    expect(waehleWoche([])).toEqual([])
  })

  it('wiederholt schon gemeldete Funde nicht', () => {
    expect(waehleWoche([k('H1', { gemeldet_datenlage: 'deutlich' })])).toEqual([])
    expect(waehleWoche([k('H1', { gemeldet_datenlage: 'hinweis' })])).toEqual([])
  })

  it('meldet erneut, wenn die Datenlage von Hinweis auf deutlich steigt', () => {
    expect(waehleWoche([k('H1', { gemeldet_datenlage: 'hinweis', datenlage: 'deutlich' })])).toEqual(['id-H1'])
  })

  it('vergleicht mit der aktuellen Datenlage des Funds, nicht der gespeicherten', () => {
    const kand = { id: 'id-H1', fund: fund('H1', { datenlage: 'deutlich' }), gespeichert: g('H1', { datenlage: 'hinweis', gemeldet_datenlage: 'hinweis' }) }
    expect(waehleWoche([kand])).toEqual(['id-H1'])
    const kand2 = { id: 'id-H1', fund: fund('H1', { datenlage: 'hinweis' }), gespeichert: g('H1', { datenlage: 'deutlich', gemeldet_datenlage: 'hinweis' }) }
    expect(waehleWoche([kand2])).toEqual([])
  })

  it('überspringt ausgeblendete und ungültige', () => {
    expect(waehleWoche([k('H1', { ausgeblendet: true })])).toEqual([])
    expect(waehleWoche([k('H1', { gueltig: false })])).toEqual([])
  })

  it('zieht nur zulässige positive Kandidaten heran', () => {
    const r = waehleWoche([
      ...['a', 'b', 'c', 'd', 'e'].map((n, i) => k(n, { staerke: 0.9 - i * 0.1 })),
      k('p', { richtung: 'positiv', staerke: 0.9, ausgeblendet: true }),
    ])
    expect(r).toEqual(['id-a', 'id-b', 'id-c', 'id-d', 'id-e'])
  })
})

describe('erkenntnisse: Sonntagslauf und Sichtbarkeit', () => {
  it('erkennt den lokalen Sonntag', () => {
    expect(istSonntagLauf('2026-11-01')).toBe(true)
    expect(istSonntagLauf('2026-11-02')).toBe(false)
  })

  it('rechnet 19:00 lokal in einen Zeitpunkt um (Winterzeit)', () => {
    expect(sichtbarAb('2026-11-01', 'Europe/Berlin')).toBe('2026-11-01T18:00:00.000Z')
  })

  it('beachtet die Sommerzeit', () => {
    expect(sichtbarAb('2026-07-05', 'Europe/Berlin')).toBe('2026-07-05T17:00:00.000Z')
  })

  it('beachtet die Zeitumstellung am selben Tag', () => {
    // Berlin: 2026-10-25 endet die Sommerzeit um 03:00; 19:00 liegt schon in der Winterzeit
    expect(sichtbarAb('2026-10-25', 'Europe/Berlin')).toBe('2026-10-25T18:00:00.000Z')
    // New York: 2026-11-01 endet die Sommerzeit um 02:00
    expect(sichtbarAb('2026-11-01', 'America/New_York')).toBe('2026-11-02T00:00:00.000Z')
  })

  it('funktioniert für andere Zonen', () => {
    expect(sichtbarAb('2026-07-05', 'America/New_York')).toBe('2026-07-05T23:00:00.000Z')
    expect(sichtbarAb('2026-07-05', 'Asia/Kolkata')).toBe('2026-07-05T13:30:00.000Z')
  })
})
