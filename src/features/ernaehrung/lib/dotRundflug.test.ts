import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dotText } from '../../dot/texte'
import { DEFAULT_GOALS } from './nutrition'
import { RF_ABSTAND_MS, RF_ZEIT, haltPunkt, merkeRundflug, rundflugBahn, rundflugFaellig, rundflugPlan, rundflugTexte, type Lage } from './dotRundflug'

const lage: Lage = {
  main: { x: 195, y: 130, r: 90 },
  moons: { fat: { x: 60, y: 100, r: 16 }, protein: { x: 330, y: 140, r: 18 }, carbs: { x: 230, y: 210, r: 20 } },
}
const order = ['fat', 'carbs', 'protein'] as const
const dt = (k: Parameters<typeof dotText>[1], v?: Record<string, string | number>) => dotText('de', k, v)

describe('rundflugBahn', () => {
  const halte: number[] = []
  let fertig = 0
  const bahn = rundflugBahn({
    start: { x: -46, y: 110 }, lage: () => lage, platz: () => ({ x: 352, y: 450 }), rand: { l: 0, r: 390 },
    order: [...order], beiHalt: i => halte.push(i), fertig: () => { fertig++ },
  })

  it('beginnt am linken Rand und endet an seinem Platz', () => {
    expect(bahn.pos(0)).toMatchObject({ x: -46, y: 110, depth: 1 })
    const ende = bahn.pos(bahn.dauer)
    expect(ende.x).toBeCloseTo(352)
    expect(ende.y).toBeCloseTo(450)
  })

  it('hält an Kugel und jedem Mond, in dieser Reihenfolge, je einmal', () => {
    for (let t = 0; t <= bahn.dauer; t += 1 / 60) bahn.pos(t)
    expect(halte).toEqual([0, 1, 2, 3])
    // Mitten im ersten Mond-Halt steht er neben dem Fett-Mond
    const { abschnitte } = rundflugPlan(3)
    const h1 = abschnitte.find(a => a.art === 'halt' && a.i === 1)!
    const p = bahn.pos((h1.t0 + h1.t1) / 2)
    const soll = haltPunkt(1, lage, [...order], { l: 0, r: 390 })
    expect(Math.hypot(p.x - soll.x, p.y - soll.y)).toBeLessThan(3)
    expect(fertig).toBe(0) // fertig ruft die Engine nach der Landung
  })

  it('springt nirgends (höchstens 40 px je Bild bei 60 Hz)', () => {
    let vorher = bahn.pos(0)
    for (let t = 1 / 60; t <= bahn.dauer; t += 1 / 60) {
      const p = bahn.pos(t)
      expect(Math.hypot(p.x - vorher.x, p.y - vorher.y)).toBeLessThan(40)
      vorher = p
    }
  })

  it('Dauer: herein, vier Halte, drei Wege, an den Platz', () => {
    expect(bahn.dauer).toBeCloseTo(RF_ZEIT.herein + 4 * RF_ZEIT.halt + 3 * RF_ZEIT.weg + RF_ZEIT.heim)
  })
})

describe('haltPunkt', () => {
  it('neben dem Mond, von der Kugel weg, nie am Bildschirmrand', () => {
    const p = haltPunkt(3, lage, [...order], { l: 0, r: 390 })
    expect(p.x).toBeLessThanOrEqual(390 - 44)
    const mo = lage.moons.protein!
    expect(Math.hypot(p.x - mo.x, p.y - mo.y)).toBeGreaterThan(mo.r + 20)
  })
})

describe('rundflugTexte', () => {
  const ziel = DEFAULT_GOALS // 2000 kcal, 110 / 230 / 65 g

  it('mittags: was je Körper offen ist, und alles zusammen', () => {
    const T = rundflugTexte({ kcal: 1160, protein: 62, carbs: 140, fat: 38 }, ziel, dt)
    expect(T.kugel).toBe('Noch 840 kcal frei.')
    expect(T.makro('protein')).toBe('Eiweiß: noch 48 g.')
    expect(T.summe).toBe('Noch offen: 840 kcal · 48 g Eiweiß · 90 g Kohlenhydrate · 27 g Fett.')
    expect(T.erledigt).toBe(false)
  })

  it('morgens noch nichts, abends alles, über dem Ziel ohne Wertung', () => {
    expect(rundflugTexte({ kcal: 0, protein: 0, carbs: 0, fat: 0 }, ziel, dt).summe).toBe('Heute ist noch alles offen.')
    const fertig = rundflugTexte({ kcal: 1990, protein: 108, carbs: 225, fat: 64 }, ziel, dt)
    expect(fertig.summe).toBe('Alles erledigt für heute!')
    expect(fertig.erledigt).toBe(true)
    expect(fertig.makro('fat')).toBe('Fett geschafft.')
    const mehr = rundflugTexte({ kcal: 2260, protein: 112, carbs: 268, fat: 84 }, ziel, dt)
    expect(mehr.kugel).toBe('260 kcal über dem Ziel.')
    expect(mehr.makro('fat')).toBe('Fett: 19 g drüber.')
    expect(mehr.summe).toBe('Heute ist alles drin, etwas mehr als geplant. Kein Problem.')
  })

  it('Kalorien ausgeblendet: die Kugel ist Eiweiß, keine kcal im Satz', () => {
    const T = rundflugTexte({ kcal: 900, protein: 40, carbs: 100, fat: 30 }, { ...ziel, hideKcal: true }, dt)
    expect(T.kugel).toBe('Eiweiß: noch 70 g.')
    expect(T.summe).not.toContain('kcal')
  })
})

describe('rundflugFaellig', () => {
  beforeEach(() => {
    const m = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } })
  })

  it('das erste Mal ja, danach erst wieder nach zwei Stunden', () => {
    const t = Date.parse('2026-10-29T12:00:00Z')
    expect(rundflugFaellig(t)).toBe(true)
    merkeRundflug(t)
    expect(rundflugFaellig(t + RF_ABSTAND_MS - 1000)).toBe(false)
    expect(rundflugFaellig(t + RF_ABSTAND_MS)).toBe(true)
  })

  it('Uhr zurückgestellt (gemerkte Zeit in der Zukunft): fällig', () => {
    const t = Date.parse('2026-10-29T12:00:00Z')
    merkeRundflug(t)
    expect(rundflugFaellig(t - 60_000)).toBe(true)
  })
})
