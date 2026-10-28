import { describe, expect, it } from 'vitest'
import { FEHLER, GESTE_N, GRUSS_DAUER, gestenBild, naechsterFehler, type DotForm, type Fehler, type GestenBild, type Gruss } from './gesten'

const bild = (): GestenBild => ({ P: new Float32Array(GESTE_N * 3), L: new Float32Array(GESTE_N), H: new Float32Array(GESTE_N) })
// Abstand jedes Punkts von Dots Mitte (Einheit: sein Radius)
const abstaende = (b: GestenBild) => Array.from({ length: GESTE_N }, (_, i) => Math.hypot(b.P[i * 3], b.P[i * 3 + 1], b.P[i * 3 + 2]))

describe('Dot: Gesten', () => {
  it('jede Geste liefert zu jeder Zeit endliche Lagen, Licht und Rosa', () => {
    const formen: DotForm[] = ['hand', 'heart', 'cross', 'wifi', 'haken']
    for (const f of formen) for (const g of ['einArm', 'beideArme'] as Gruss[]) for (const fe of ['kugel', 'balken'] as Fehler[]) for (let t = 0; t <= 4; t += 0.25) {
      const b = bild()
      gestenBild(f, t, { gruss: g, fehler: fe }, b)
      expect(b.P.every(Number.isFinite), `${f} ${g} ${t}`).toBe(true)
      expect(b.L.every(v => Number.isFinite(v) && v >= 0), `${f} ${g} ${t}`).toBe(true)
      expect(b.H.every(v => v >= 0 && v <= 1), `${f} ${g} ${t}`).toBe(true)
    }
  })

  it('Begrüßung: Dot beginnt und endet als geschlossene Kugel', () => {
    for (const g of ['einArm', 'beideArme'] as Gruss[]) for (const t of [0, GRUSS_DAUER]) {
      const b = bild()
      gestenBild('hand', t, { gruss: g, fehler: 'kugel' }, b)
      for (const d of abstaende(b)) expect(d).toBeCloseTo(1, 2)
    }
  })

  it('Begrüßung: beim Winken steht der Arm weit aus Dot heraus, bei beiden Armen auf beiden Seiten', () => {
    const ein = bild(), beide = bild()
    gestenBild('hand', 1.5, { gruss: 'einArm', fehler: 'kugel' }, ein)
    gestenBild('hand', 1.5, { gruss: 'beideArme', fehler: 'kugel' }, beide)
    // Punkte, die seitlich weiter als 1,3 Radien von Dots Mitte stehen (Mitte und Maßstab je Variante)
    const draussen = (b: GestenBild, mx: number, sc: number, seite: number) => Array.from({ length: GESTE_N }, (_, i) => i).filter(i => (b.P[i * 3] - mx) * seite > 1.3 * sc).length
    // ein Arm: links (vom Betrachter aus), Dot rückt dafür nach rechts; beide Hände schwingen gerade zur selben Seite
    expect(draussen(ein, 0.4, 0.74, -1)).toBeGreaterThan(40)
    expect(draussen(ein, 0.4, 0.74, 1)).toBe(0)
    expect(draussen(beide, 0, 0.64, -1)).toBeGreaterThan(20)
    expect(draussen(beide, 0, 0.64, 1)).toBeGreaterThan(20)
    // beim Winken reicht das Ende des Arms bis auf Höhe von Dots Scheitel (Mitte 0,36, Radius 0,74)
    let hoechste = 9
    for (let t = 1; t <= 2.5; t += 0.05) {
      const b = bild()
      gestenBild('hand', t, { gruss: 'einArm', fehler: null }, b)
      for (let i = 0; i < GESTE_N; i++) hoechste = Math.min(hoechste, b.P[i * 3 + 1])
    }
    expect(hoechste).toBeLessThan(0.36 - 0.74 + 0.05)
  })

  it('Herz: ein Teil der Punkte ist rosa, die Kontur leuchtet am hellsten', () => {
    const b = bild()
    gestenBild('heart', 0.5, { gruss: 'einArm', fehler: 'kugel' }, b)
    expect(b.H.filter(v => v >= 0.85).length).toBeGreaterThan(150)
    expect(Math.max(...b.L)).toBeGreaterThan(1.8)
  })

  it('Haken: zeichnet sich in einem Zug, am Anfang ist er fast dunkel', () => {
    const anfang = bild(), fertig = bild()
    gestenBild('haken', 0.05, { gruss: 'einArm', fehler: 'kugel' }, anfang)
    gestenBild('haken', 0.6, { gruss: 'einArm', fehler: 'kugel' }, fertig)
    const hell = (b: GestenBild) => b.L.filter(v => v >= 1).length
    expect(hell(anfang)).toBeLessThan(GESTE_N * 0.2)
    expect(hell(fertig)).toBe(GESTE_N)
  })

  it('Fehler C: ein X aus zwei Balken, die Kugel-Variante bleibt rund', () => {
    const x = bild(), kugel = bild()
    gestenBild('cross', 0, { gruss: 'einArm', fehler: 'balken' }, x)
    gestenBild('cross', 0, { gruss: 'einArm', fehler: 'kugel' }, kugel)
    // die Arme des X reichen weiter hinaus als die Kugel
    expect(Math.max(...abstaende(x))).toBeGreaterThan(1.2)
    for (const d of abstaende(kugel)) expect(d).toBeCloseTo(0.92, 2)
  })

  it('Fehler: alle drei kommen vor, nie zweimal derselbe hintereinander, auch der erste ist frei', () => {
    let letzte: Fehler | null = null
    const gesehen = new Set<Fehler>()
    let s = 3
    const zufall = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
    for (let i = 0; i < 200; i++) {
      const n = naechsterFehler(letzte, zufall)
      expect(n).not.toBe(letzte)
      gesehen.add(n); letzte = n
    }
    expect([...gesehen].sort()).toEqual([...FEHLER].sort())
    // der erste Fehler kann jede Variante sein, auch bei Zufall am Rand
    expect(naechsterFehler(null, () => 0)).toBe('heute')
    expect(naechsterFehler(null, () => 0.999999)).toBe('balken')
    expect(naechsterFehler('balken', () => 0.999999)).toBe('kugel')
  })
})
