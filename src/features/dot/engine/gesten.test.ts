import { describe, expect, it } from 'vitest'
import { GESTE_N, GRUSS_DAUER, gestenBild, type DotForm, type GestenBild, type Gruss } from './gesten'

const bild = (): GestenBild => ({ P: new Float32Array(GESTE_N * 3), L: new Float32Array(GESTE_N), H: new Float32Array(GESTE_N) })
// Abstand jedes Punkts von Dots Mitte (Einheit: sein Radius)
const abstaende = (b: GestenBild) => Array.from({ length: GESTE_N }, (_, i) => Math.hypot(b.P[i * 3], b.P[i * 3 + 1], b.P[i * 3 + 2]))

describe('Dot: Gesten', () => {
  it('jede Geste liefert zu jeder Zeit endliche Lagen, Licht und Rosa', () => {
    const formen: DotForm[] = ['hand', 'heart', 'cross', 'wifi', 'haken']
    for (const f of formen) for (const g of ['einArm', 'beideArme'] as Gruss[]) for (let t = 0; t <= 4; t += 0.25) {
      const b = bild()
      gestenBild(f, t, g, b)
      expect(b.P.every(Number.isFinite), `${f} ${g} ${t}`).toBe(true)
      expect(b.L.every(v => Number.isFinite(v) && v >= 0), `${f} ${g} ${t}`).toBe(true)
      expect(b.H.every(v => v >= 0 && v <= 1), `${f} ${g} ${t}`).toBe(true)
    }
  })

  it('Begrüßung: Dot beginnt und endet als geschlossene Kugel', () => {
    for (const g of ['einArm', 'beideArme'] as Gruss[]) for (const t of [0, GRUSS_DAUER]) {
      const b = bild()
      gestenBild('hand', t, g, b)
      for (const d of abstaende(b)) expect(d).toBeCloseTo(1, 2)
    }
  })

  it('Begrüßung: beim Winken stehen Arm und Hand weit aus Dot heraus, bei beiden Armen auf beiden Seiten', () => {
    const ein = bild(), beide = bild()
    gestenBild('hand', 1.5, 'einArm', ein)
    gestenBild('hand', 1.5, 'beideArme', beide)
    // Punkte, die seitlich weiter als 1,3 Radien von Dots Mitte stehen (Mitte und Maßstab je Variante)
    const draussen = (b: GestenBild, mx: number, sc: number, seite: number) => Array.from({ length: GESTE_N }, (_, i) => i).filter(i => (b.P[i * 3] - mx) * seite > 1.3 * sc).length
    // ein Arm: links (vom Betrachter aus), Dot rückt dafür nach rechts; beide Hände schwingen gerade zur selben Seite
    expect(draussen(ein, 0.4, 0.74, -1)).toBeGreaterThan(40)
    expect(draussen(ein, 0.4, 0.74, 1)).toBe(0)
    expect(draussen(beide, 0, 0.64, -1)).toBeGreaterThan(20)
    expect(draussen(beide, 0, 0.64, 1)).toBeGreaterThan(20)
    // die Hand ist oben: höher als Dots Scheitel
    expect(Math.min(...Array.from({ length: GESTE_N }, (_, i) => ein.P[i * 3 + 1]))).toBeLessThan(0.36 - 0.74 - 0.2)
  })

  it('Herz: ein Teil der Punkte ist rosa, die Kontur leuchtet am hellsten', () => {
    const b = bild()
    gestenBild('heart', 0.5, 'einArm', b)
    expect(b.H.filter(v => v >= 0.85).length).toBeGreaterThan(150)
    expect(Math.max(...b.L)).toBeGreaterThan(1.8)
  })

  it('Haken: zeichnet sich in einem Zug, am Anfang ist er fast dunkel', () => {
    const anfang = bild(), fertig = bild()
    gestenBild('haken', 0.05, 'einArm', anfang)
    gestenBild('haken', 0.6, 'einArm', fertig)
    const hell = (b: GestenBild) => b.L.filter(v => v >= 1).length
    expect(hell(anfang)).toBeLessThan(GESTE_N * 0.2)
    expect(hell(fertig)).toBe(GESTE_N)
  })
})
