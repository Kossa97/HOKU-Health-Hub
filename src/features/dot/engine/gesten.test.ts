import { describe, expect, it } from 'vitest'
import { FEHLER, FORM_DAUER, GESTE_N, GRUSS_DAUER, HAKEN_ENDE, HAKEN_GRUEN, gestenBild, naechsterFehler, type DotForm, type Fehler, type GestenBild, type GestenWahl, type Gruss, type Netz } from './gesten'

const bild = (): GestenBild => ({ P: new Float32Array(GESTE_N * 3), L: new Float32Array(GESTE_N), H: new Float32Array(GESTE_N) })
// Abstand jedes Punkts von Dots Mitte (Einheit: sein Radius)
const abstaende = (b: GestenBild) => Array.from({ length: GESTE_N }, (_, i) => Math.hypot(b.P[i * 3], b.P[i * 3 + 1], b.P[i * 3 + 2]))

describe('Dot: Gesten', () => {
  it('Haken wächst aus Dot, nur seine Punkte werden grün, dann sinkt er zurück', () => {
    const w = { gruss: 'einArm' as Gruss, fehler: null, netz: 'sucht' as Netz }
    const anfang = bild(); gestenBild('haken', 0, w, anfang)
    for (const d of abstaende(anfang)) expect(d).toBeLessThan(1.05)
    const steht = bild(); gestenBild('haken', HAKEN_GRUEN.ab + HAKEN_GRUEN.dauer, w, steht)
    // ein großer Teil der Punkte hat seinen Platz auf der Kugel verlassen und steht als Haken vor ihm
    const bewegt = Array.from({ length: GESTE_N }, (_, i) => Math.hypot(steht.P[i * 3] - anfang.P[i * 3], steht.P[i * 3 + 1] - anfang.P[i * 3 + 1], steht.P[i * 3 + 2] - anfang.P[i * 3 + 2]))
    expect(bewegt.filter(d => d > 0.3).length).toBeGreaterThan(GESTE_N * 0.3)
    const gruen = Array.from(steht.H).filter(h => h > 0.5).length
    expect(gruen).toBeGreaterThan(GESTE_N * 0.3)
    expect(gruen).toBeLessThan(GESTE_N * 0.7)
    const ende = bild(); gestenBild('haken', HAKEN_ENDE, w, ende)
    for (const d of abstaende(ende)) expect(d).toBeLessThan(1.05)
    expect(Array.from(ende.H).every(h => h < 0.05)).toBe(true)
  })

  it('X (heute) wächst aus Dot, nur das X wird rot, beide Balken gleich dicht', () => {
    const w = { gruss: 'einArm' as Gruss, fehler: 'heute' as Fehler, netz: 'sucht' as Netz }
    const b = bild(); gestenBild('cross', 0.7, w, b)
    const rot: number[] = []
    for (let i = 0; i < GESTE_N; i++) if (b.H[i] > 0.5) rot.push(i)
    expect(rot.length).toBeGreaterThan(GESTE_N * 0.3)
    expect(rot.length).toBeLessThan(GESTE_N * 0.7)
    // Balken von oben links nach unten rechts gegen den anderen: höchstens 15 % Unterschied
    const fallend = rot.filter(i => b.P[i * 3] * b.P[i * 3 + 1] > 0).length, steigend = rot.length - fallend
    expect(Math.abs(fallend - steigend) / rot.length).toBeLessThan(0.15)
  })

  it('jede Geste liefert zu jeder Zeit endliche Lagen, Licht und Rosa', () => {
    const formen: DotForm[] = ['hand', 'heart', 'cross', 'wifi', 'haken']
    for (const f of formen) for (const g of ['einArm', 'beideArme'] as Gruss[]) for (const fe of ['kugel', 'balken'] as Fehler[]) for (const ne of ['boegen', 'sucht'] as Netz[]) for (let t = 0; t <= 4; t += 0.25) {
      const b = bild()
      gestenBild(f, t, { gruss: g, fehler: fe, netz: ne }, b)
      expect(b.P.every(Number.isFinite), `${f} ${g} ${t}`).toBe(true)
      expect(b.L.every(v => Number.isFinite(v) && v >= 0), `${f} ${g} ${t}`).toBe(true)
      expect(b.H.every(v => v >= 0 && v <= 1), `${f} ${g} ${t}`).toBe(true)
    }
  })

  it('Begrüßung: Dot beginnt und endet als geschlossene Kugel', () => {
    for (const g of ['einArm', 'beideArme'] as Gruss[]) for (const t of [0, GRUSS_DAUER]) {
      const b = bild()
      gestenBild('hand', t, { gruss: g, fehler: 'kugel', netz: 'sucht' }, b)
      for (const d of abstaende(b)) expect(d).toBeCloseTo(1, 2)
    }
  })

  it('Begrüßung: beim Winken steht der Arm weit aus Dot heraus, bei beiden Armen auf beiden Seiten', () => {
    const ein = bild(), beide = bild()
    gestenBild('hand', 1.5, { gruss: 'einArm', fehler: 'kugel', netz: 'sucht' }, ein)
    gestenBild('hand', 1.5, { gruss: 'beideArme', fehler: 'kugel', netz: 'sucht' }, beide)
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
      gestenBild('hand', t, { gruss: 'einArm', fehler: null, netz: 'sucht' }, b)
      for (let i = 0; i < GESTE_N; i++) hoechste = Math.min(hoechste, b.P[i * 3 + 1])
    }
    expect(hoechste).toBeLessThan(0.36 - 0.74 + 0.05)
  })

  it('Herz: ein Teil der Punkte ist rosa, die Kontur leuchtet am hellsten', () => {
    const b = bild()
    gestenBild('heart', 0.5, { gruss: 'einArm', fehler: 'kugel', netz: 'sucht' }, b)
    expect(b.H.filter(v => v >= 0.85).length).toBeGreaterThan(150)
    expect(Math.max(...b.L)).toBeGreaterThan(1.8)
  })

  it('Fehler C: ein X aus zwei Balken, die Kugel-Variante bleibt rund', () => {
    const x = bild(), kugel = bild()
    gestenBild('cross', 0, { gruss: 'einArm', fehler: 'balken', netz: 'sucht' }, x)
    gestenBild('cross', 0, { gruss: 'einArm', fehler: 'kugel', netz: 'sucht' }, kugel)
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

  it('neue Emotes: endlich, im Rahmen, Farbe 0…1; die mit fester Dauer enden als Kugel', () => {
    const faelle: [DotForm, Partial<GestenWahl>][] = [
      ['freude', { freude: 'huepfen' }], ['freude', { freude: 'strecken' }], ['freude', { freude: 'funken' }],
      ['warten', { warten: 'welle' }], ['warten', { warten: 'wolken' }], ['augen', {}],
      ['sanduhr', {}], ['brief', {}], ['nicken', {}], ['schuetteln', {}],
    ]
    for (const [f, w] of faelle) {
      const wahl: GestenWahl = { gruss: 'einArm', fehler: null, netz: 'sucht', ...w }
      for (let t = 0; t <= 5; t += 0.1) {
        const b = bild()
        gestenBild(f, t, wahl, b)
        expect(b.P.every(Number.isFinite), `${f} ${t}`).toBe(true)
        expect(b.L.every(v => Number.isFinite(v) && v >= 0), `${f} ${t}`).toBe(true)
        expect(b.H.every(v => v >= 0 && v <= 1), `${f} ${t}`).toBe(true)
        // der Brief fliegt aus dem Bild, alles andere bleibt bei Hoku
        const grenze = f === 'brief' ? 7 : 3.2
        for (let i = 0; i < GESTE_N; i++) expect(Math.hypot(b.P[i * 3], b.P[i * 3 + 1]), `${f} ${t}`).toBeLessThan(grenze)
      }
      const dauer = FORM_DAUER[f]
      if (dauer === undefined) continue
      const ende = bild()
      gestenBild(f, dauer, wahl, ende)
      // am Ende wieder eine geschlossene Kugel um seine Mitte
      for (const d of abstaende(ende)) expect(Math.abs(d - 1), `${f} Ende`).toBeLessThan(0.05)
    }
  })

  it('Augen zuhalten: helle Hände liegen vor seinem Gesicht, die Kugel tritt zurück', () => {
    const b = bild()
    gestenBild('augen', 1.2, { gruss: 'einArm', fehler: null, netz: 'sucht' }, b)
    // wo der Punkt nach der Perspektive der Engine erscheint (fern 3.4)
    const s = (i: number) => 3.4 / (3.4 - b.P[i * 3 + 2])
    const haende = Array.from({ length: GESTE_N }, (_, i) => i)
      .filter(i => b.L[i] > 0.5 && Math.abs(b.P[i * 3] * s(i)) < 0.6 && b.P[i * 3 + 1] * s(i) > -0.8 && b.P[i * 3 + 1] * s(i) < 0.1)
    expect(haende.length).toBeGreaterThan(15)
    expect(Array.from(b.L).filter(l => l < 0.3).length).toBeGreaterThan(GESTE_N * 0.3)
  })

  it('Nicken färbt ganz Hoku, Kopfschütteln auch', () => {
    for (const f of ['nicken', 'schuetteln'] as DotForm[]) {
      const b = bild()
      gestenBild(f, 0.6, { gruss: 'einArm', fehler: null, netz: 'sucht' }, b)
      expect(Array.from(b.H).filter(h => h > 0.5).length, f).toBeGreaterThan(GESTE_N * 0.8)
    }
  })

  it('Kein Netz A: das Suchlicht läuft über die Bögen nach außen, der Schrägstrich leuchtet ruhig', () => {
    const frueh = bild(), spaet = bild()
    gestenBild('wifi', 0.1, { gruss: 'einArm', fehler: null, netz: 'boegen' }, frueh)
    gestenBild('wifi', 0.9, { gruss: 'einArm', fehler: null, netz: 'boegen' }, spaet)
    // das hellste Licht liegt anfangs nah am Punkt des WLANs, später weiter außen
    const hellsterAbstand = (b: GestenBild) => {
      let best = 0, d = 0
      for (let i = 0; i < GESTE_N; i++) if (b.L[i] > best && Math.abs(b.L[i] - 1.05) > 1e-4) { best = b.L[i]; d = Math.hypot(b.P[i * 3], b.P[i * 3 + 1] - 0.6) }
      return d
    }
    expect(hellsterAbstand(spaet)).toBeGreaterThan(hellsterAbstand(frueh) + 0.4)
    expect(frueh.L.filter(v => Math.abs(v - 1.05) < 1e-4).length).toBeGreaterThan(30)
  })
})
