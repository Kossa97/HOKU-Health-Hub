/**
 * Dots Gesten auf der Anmeldung, ganz aus seinen 460 Punkten im Raum.
 *
 * Aus dem Gesten-Mockup (Artefakt „Dots Gesten fürs Login"), Auswahl des Nutzers
 * 28.10.2026: Begrüßung D1 (ein Arm winkt) und D4 (beide Arme winken) im Wechsel, die
 * Arme dick und ohne Hand (Version 8, F1/F3), Herz C (Herz in Dot),
 * Fehler A und C (Kugel schüttelt sich, X aus Balken; das flache X macht die Engine),
 * Kein Netz B (Dot sucht), Erfolg A (Haken zeichnet sich und wird grün).
 *
 * Jede Geste schreibt je Punkt Lage (Einheit: Dots Radius, y nach unten, z zum
 * Betrachter), Licht und Rosa-Anteil für den Zeitpunkt t seit ihrem Beginn.
 */
import { TAU, clamp01 } from './geometry'
import { herzSchlag } from './formen'

export type DotForm = 'hand' | 'heart' | 'cross' | 'wifi' | 'haken'
export const GESTE_N = 460
export interface GestenBild { P: Float32Array; L: Float32Array; H: Float32Array }
/** Begrüßung: D1 ein Arm, D4 beide Arme. */
export type Gruss = 'einArm' | 'beideArme'
/**
 * Fehler: „Heute" das flache X, A die Kugel schüttelt sich, C ein X aus zwei runden Balken im Raum.
 * Das flache X zeichnet die Engine aus seiner Abtastung (`kreuzFlach`), die beiden anderen stehen hier.
 */
export type Fehler = 'heute' | 'kugel' | 'balken'
export const FEHLER: readonly Fehler[] = ['heute', 'kugel', 'balken']
/** Nächster Fehler: zufällig, aber nie zweimal derselbe hintereinander (Nutzer 28.10.2026). */
export function naechsterFehler(letzte: Fehler | null, zufall: () => number = Math.random): Fehler {
  const andere = FEHLER.filter(v => v !== letzte)
  return andere[Math.min(andere.length - 1, Math.floor(zufall() * andere.length))]
}
/** Welche Variante einer Geste läuft; `fehler` null = noch keiner gezeigt. */
export interface GestenWahl { gruss: Gruss; fehler: Fehler | null }
/** So lange dauert die Begrüßung, bis die Arme wieder in Dot stecken (s). */
export const GRUSS_DAUER = 3.9
/** Ab hier ist der Haken gezeichnet und färbt sich grün (s), so lange dauert das. */
export const HAKEN_GRUEN = { ab: 0.55, dauer: 0.45 }

const N = GESTE_N
// Fester Zufall je Form: jede sieht in jeder Sitzung gleich aus, egal welche zuerst gebaut wird
const zufall = (s: number) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
const weich = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x) }
const hinaus = (x: number) => { x = clamp01(x) - 1; return 1 + 2.70158 * x * x * x + 1.70158 * x * x }
const misch = (a: number, b: number, r: number) => a + (b - a) * r
const wachsen = (t: number, ein: number, aus: number) => t > aus ? 1 - weich((t - aus) / 0.55) : hinaus(t / ein)
// Bildausschnitt: aus der Kugel-Lage in den der Geste und zurück
const rein = (t: number) => weich(t / 0.45) * (1 - weich((t - 3.45) / 0.45))

function fib(n: number, r: number) {
  const a = new Float32Array(n * 3), ga = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, q = Math.sqrt(1 - y * y), th = ga * i
    a[i * 3] = Math.cos(th) * q * r; a[i * 3 + 1] = y * r; a[i * 3 + 2] = Math.sin(th) * q * r
  }
  return a
}
interface Drehung { roll?: number; yaw?: number; pitch?: number; s?: number; tx?: number; ty?: number }
// Rollen (Bildebene), dann Gieren (um die Senkrechte), dann Nicken
function drehe(src: Float32Array, dst: Float32Array, o: Drehung) {
  const cr = Math.cos(o.roll || 0), sr = Math.sin(o.roll || 0), cy = Math.cos(o.yaw || 0), sy = Math.sin(o.yaw || 0)
  const cp = Math.cos(o.pitch || 0), sp = Math.sin(o.pitch || 0), s = o.s || 1, tx = o.tx || 0, ty = o.ty || 0
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i], y = src[i + 1], z = src[i + 2]
    const x1 = x * cr - y * sr, y1 = x * sr + y * cr
    const x2 = x1 * cy + z * sy, z2 = -x1 * sy + z * cy
    dst[i] = x2 * s + tx; dst[i + 1] = (y1 * cp - z2 * sp) * s + ty; dst[i + 2] = (y1 * sp + z2 * cp) * s
  }
}
const KUGEL = fib(N, 1)
const KUGEL_FEST = new Float32Array(N * 3)
drehe(KUGEL, KUGEL_FEST, { pitch: 0.3 })

/* ── Punkte gleichmäßig auf Flächen ─────────────────────────────────────── */
// Am weitesten entfernten Kandidaten wählen, bis n Stück; nach Höhe sortiert
function auswahl(kand: Float32Array, marke: number[] | null, n: number) {
  const M = kand.length / 3, d = new Float32Array(M).fill(1e9), aus: number[][] = []
  let cur = 0
  for (let k = 0; k < n; k++) {
    const x = kand[cur * 3], y = kand[cur * 3 + 1], z = kand[cur * 3 + 2]
    aus.push([x, y, z, marke ? marke[cur] : 0])
    let best = -1, bi = 0
    for (let m = 0; m < M; m++) {
      const dx = kand[m * 3] - x, dy = kand[m * 3 + 1] - y, dz = kand[m * 3 + 2] - z, dd = dx * dx + dy * dy + dz * dz
      if (dd < d[m]) d[m] = dd
      if (d[m] > best) { best = d[m]; bi = m }
    }
    cur = bi
  }
  aus.sort((a, b) => b[1] - a[1] || Math.atan2(a[2], a[0]) - Math.atan2(b[2], b[0]))
  const p = new Float32Array(n * 3), m = new Int16Array(n)
  aus.forEach((q, i) => { p[i * 3] = q[0]; p[i * 3 + 1] = q[1]; p[i * 3 + 2] = q[2]; m[i] = q[3] })
  return { p, m }
}
function richtung(rnd: () => number) { const z = rnd() * 2 - 1, a = rnd() * TAU, q = Math.sqrt(1 - z * z); return [Math.cos(a) * q, Math.sin(a) * q, z] }
type V3 = [number, number, number]
function segAbstand(p: number[], a: V3, b: V3) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], l = abx * abx + aby * aby + abz * abz
  const t = l ? clamp01(((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / l) : 0
  return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t, p[2] - a[2] - abz * t)
}
// Runde Balken (Kapseln), ohne Punkte, die in einem anderen Balken liegen
function kapselPunkte(teile: { a: V3; b: V3; r: number }[], n: number) {
  const fl = teile.map(k => TAU * k.r * Math.hypot(k.b[0] - k.a[0], k.b[1] - k.a[1], k.b[2] - k.a[2]) + 2 * TAU * k.r * k.r)
  const summe = fl.reduce((a, b) => a + b, 0), kand: number[] = [], marke: number[] = [], rnd = zufall(11)
  while (kand.length < 3600 * 3) {
    let w = rnd() * summe, j = 0
    while (w > fl[j] && j < teile.length - 1) { w -= fl[j]; j++ }
    const k = teile[j], t = rnd(), u = richtung(rnd)
    const p = [k.a[0] + (k.b[0] - k.a[0]) * t + u[0] * k.r, k.a[1] + (k.b[1] - k.a[1]) * t + u[1] * k.r, k.a[2] + (k.b[2] - k.a[2]) * t + u[2] * k.r]
    if (teile.some((o, oi) => oi !== j && segAbstand(p, o.a, o.b) - o.r < -0.012)) continue
    kand.push(p[0], p[1], p[2]); marke.push(j)
  }
  return auswahl(new Float32Array(kand), marke, n)
}

/* ── Begrüßung: Arme ohne Hand ──────────────────────────────────────────────
   Ein Kegelarm (Nutzer 28.10.2026: dick, ohne Hand): an der Schulter breit, zur runden
   Spitze schmaler. Eine Kappe seiner Haut an der Schulter liefert die Punkte; die übrige
   Haut rückt gleichmäßig nach. */
// Ringe entlang des Arms, je Ring vier Punkte; Längen von Ober- und Unterarm und dem Ende, das beim Winken nachschwingt
const ARM = { ringe: 20, je: 4, ober: 0.5, unter: 0.62, ende: 0.42, schulter: 0.13, spitze: 0.075 }
const ARM_M = ARM.ringe * ARM.je, LOCH = Math.cos(0.17)
// Kurve: 25 Stützstellen bis zum Handgelenk, 8 für das Ende
const BZ = new Float32Array(33 * 2), LANG = new Float32Array(33)
// Radius ab Schulter (u 0) bis zur Spitze (u 1); das letzte Sechstel läuft rund zu wie eine Kuppe
const armRadius = (u: number) => misch(ARM.schulter, ARM.spitze, u) * (u < 0.84 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.84) / 0.16, 2))))

/** Ein Arm: Seite (−1 links, +1 rechts), Oberarm, Unterarm und Richtung seines Endes (Winkel im Bild). */
interface Arm { s: number; a1: number; a2: number; b: number; ziel: Float32Array }
const neuerArm = (s: number): Arm => ({ s, a1: 0, a2: 0, b: 0, ziel: new Float32Array(ARM_M * 3) })
interface Kappe { wer: Int16Array; cA: number; ax: number }
// Die Punkte, die der Schulter am nächsten liegen, werden Arm (Wurzel zuerst); bei zwei Armen auch die gegenüber
function kappe(ax: number, zwei: boolean): Kappe {
  const idx = Array.from({ length: N }, (_, i) => i).sort((p, q) => (KUGEL_FEST[q * 3] - KUGEL_FEST[p * 3]) * ax)
  const wer = new Int16Array(N).fill(-1)
  for (let j = 0; j < ARM_M; j++) { wer[idx[j]] = j; if (zwei) wer[idx[N - 1 - j]] = ARM_M + j }
  return { wer, ax, cA: ((KUGEL_FEST[idx[ARM_M - 1] * 3] + KUGEL_FEST[idx[ARM_M] * 3]) / 2) * ax }
}
interface Rahmen { g: number; neig: number; sc: number; ox?: number; oy: number; sx?: number; sy?: number }
// Winkel im Bild (0 nach außen, negativ nach oben) gelten für den rechten Arm und werden links gespiegelt; zwei Arme sitzen gegenüber
function armeBild(kp: Kappe, arme: Arm[], k: Rahmen, out: GestenBild) {
  const g = Math.max(0, k.g), gl = clamp01(g * 1.3), gk = Math.min(1, g), zwei = arme.length > 1
  for (const a of arme) {
    const Sx = 0.96, l1 = ARM.ober * g, l2 = ARM.unter * g, e = ARM.ende * g
    const Cx = Sx + Math.cos(a.a1) * l1, Cy = Math.sin(a.a1) * l1, Wx = Cx + Math.cos(a.a2) * l2, Wy = Cy + Math.sin(a.a2) * l2
    // Gummiarm: weiche Kurve über den Ellbogen; danach läuft er weiter, erst in Richtung des Unterarms, dann in Richtung b
    const Qx = Wx + (Math.cos(a.a2) * e) / 2, Qy = Wy + (Math.sin(a.a2) * e) / 2, Ex = Qx + (Math.cos(a.b) * e) / 2, Ey = Qy + (Math.sin(a.b) * e) / 2
    for (let j = 0; j <= 32; j++) {
      if (j <= 24) {
        const tau = j / 24, u1 = 1 - tau
        BZ[j * 2] = u1 * u1 * Sx + 2 * u1 * tau * Cx + tau * tau * Wx; BZ[j * 2 + 1] = 2 * u1 * tau * Cy + tau * tau * Wy
      } else {
        const tau = (j - 24) / 8, u1 = 1 - tau
        BZ[j * 2] = u1 * u1 * Wx + 2 * u1 * tau * Qx + tau * tau * Ex; BZ[j * 2 + 1] = u1 * u1 * Wy + 2 * u1 * tau * Qy + tau * tau * Ey
      }
      LANG[j] = j ? LANG[j - 1] + Math.hypot(BZ[j * 2] - BZ[j * 2 - 2], BZ[j * 2 + 1] - BZ[j * 2 - 1]) : 0
    }
    // nach Bogenlänge in Ringen besetzt, jeder Ring quer zum Arm und zum nächsten versetzt, damit er rund wirkt
    for (let j = 0; j < ARM.ringe; j++) {
      const bis = ((j + 0.5) / ARM.ringe) * LANG[32]
      let b = 0
      while (b < 31 && LANG[b + 1] < bis) b++
      const fr = (bis - LANG[b]) / (LANG[b + 1] - LANG[b] || 1)
      const px = BZ[b * 2] + (BZ[b * 2 + 2] - BZ[b * 2]) * fr, py = BZ[b * 2 + 1] + (BZ[b * 2 + 3] - BZ[b * 2 + 1]) * fr
      const tx = BZ[b * 2 + 2] - BZ[b * 2], ty = BZ[b * 2 + 3] - BZ[b * 2 + 1], tl = Math.hypot(tx, ty) || 1
      // Radius an derselben Stelle wie die Lage; so endet die Kuppe klein, aber nicht in einem Punkt
      const rad = armRadius((j + 0.5) / ARM.ringe) * g, z0 = 0.1 + (0.2 * j) / ARM.ringe
      for (let q = 0; q < ARM.je; q++) {
        const ph = (q / ARM.je + (j % 2) / (2 * ARM.je)) * TAU, o = (j * ARM.je + q) * 3, cq = Math.cos(ph) * rad
        a.ziel[o] = a.s * (px - (ty / tl) * cq); a.ziel[o + 1] = py + (tx / tl) * cq; a.ziel[o + 2] = z0 + Math.sin(ph) * rad
      }
    }
  }
  const cl = Math.cos(k.neig), sl = Math.sin(k.neig), sx = k.sx ?? 1, sy = k.sy ?? 1, { P, L, H } = out
  for (let i = 0; i < N; i++) {
    const q = i * 3, w = kp.wer[i]
    let x = KUGEL_FEST[q], y = KUGEL_FEST[q + 1], z = KUGEL_FEST[q + 2]
    if (w >= 0) {
      const a = arme[(w / ARM_M) | 0], o = (w % ARM_M) * 3
      x += (a.ziel[o] - x) * gl; y += (a.ziel[o + 1] - y) * gl; z += (a.ziel[o + 2] - z) * gl
    } else {
      // Haut rückt nach, gleichmäßig: entlang der Schulterachse linear in der Höhe, so bleibt die Dichte überall gleich
      const c = x * kp.ax, c2 = zwei ? (c * LOCH) / kp.cA : -1 + ((c + 1) * (LOCH + 1)) / (kp.cA + 1), cg = c + (c2 - c) * gk
      const f = Math.sqrt(Math.max(0, 1 - cg * cg) / Math.max(1e-6, 1 - c * c))
      x = kp.ax * cg; y *= f; z *= f
    }
    x *= sx; y *= sy
    P[q] = (x * cl - y * sl) * k.sc + (k.ox ?? 0); P[q + 1] = (x * sl + y * cl) * k.sc + k.oy; P[q + 2] = z * k.sc; L[i] = 1; H[i] = 0
  }
}

// D1: ein Arm wächst aus der Seite, geht schräg nach oben und winkt; sein Ende schwingt nach
const EIN = { kp: null as Kappe | null, arm: neuerArm(-1) }
function einArm(t: number, out: GestenBild) {
  const r = hinaus((t - 0.25) / 0.55) * (1 - weich((t - 2.85) / 0.45)), ak = clamp01((t - 0.7) / 0.3) * clamp01((2.95 - t) / 0.3)
  const ph = TAU * 1.6 * (t - 0.7), w = Math.sin(ph) * ak, e = rein(t), a = EIN.arm
  a.a1 = misch(0.55, -0.2, r) - 0.06 * w; a.a2 = misch(1.25, -1.0, r) + 0.38 * w
  a.b = a.a2 - 0.1 * r + 0.3 * Math.sin(ph - 0.9) * ak
  EIN.kp ??= kappe(a.s, false)
  armeBild(EIN.kp, [a], { g: wachsen(t, 0.45, 3.3), neig: (-0.05 * r - 0.02 * w) * e, sc: misch(1, 0.74, e), ox: 0.4 * e, oy: 0.36 * e }, out)
}
// D4: beide Arme gehen schräg nach oben und winken im Gleichtakt in dieselbe Richtung; Dot hüpft dazu
const BEIDE = { kp: null as Kappe | null, arme: [neuerArm(-1), neuerArm(1)] }
function beideArme(t: number, out: GestenBild) {
  const r = hinaus((t - 0.25) / 0.55) * (1 - weich((t - 2.85) / 0.45)), ak = clamp01((t - 0.7) / 0.3) * clamp01((2.95 - t) / 0.3)
  const ph = TAU * 1.5 * (t - 0.7), w = Math.sin(ph) * ak, e = rein(t)
  for (const a of BEIDE.arme) {
    const ww = w * a.s // gespiegelt, damit beide Arme in dieselbe Richtung schwingen
    a.a1 = misch(0.55, -0.3, r) - 0.06 * ww; a.a2 = misch(1.25, -1.0, r) + 0.36 * ww
    a.b = a.a2 - 0.1 * r + 0.3 * a.s * Math.sin(ph - 0.9) * ak
  }
  const hop = Math.pow(Math.abs(Math.sin(ph / 2)), 0.8) * ak, sq = (1 - hop) * 0.06 * ak
  BEIDE.kp ??= kappe(-1, true)
  armeBild(BEIDE.kp, BEIDE.arme, { g: wachsen(t, 0.45, 3.3), neig: 0.03 * w * e, sx: 1 + sq, sy: 1 - sq, sc: misch(1, 0.64, e), oy: (0.42 - 0.14 * hop + 0.06 * sq) * e }, out)
}

/* ── Herz C: ein Herz aus eigenen Punkten wölbt sich aus Dot ───────────────── */
const HERZ_OY = 0.04, HERZ_S = 0.6
let herzKugel: { p: Float32Array; teil: Int8Array; e: Float32Array } | null = null
// Kugel ohne die Herzfläche, dazu ein Herz aus eigenen Punkten (Kontur und Füllung) auf der Vorderseite
function baueHerzKugel() {
  const kontur = 70, fuellung = 140, K = N - kontur - fuellung, rnd = zufall(7)
  const kurve = (u: number) => [16 * Math.pow(Math.sin(u), 3) / 17 * HERZ_S, -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) / 17 * HERZ_S + HERZ_OY]
  const rand = Array.from({ length: 240 }, (_, i) => kurve((i / 240) * TAU))
  const innen = (x: number, y: number) => {
    let c = false
    for (let a = 0, b = rand.length - 1; a < rand.length; b = a++) {
      if ((rand[a][1] > y) !== (rand[b][1] > y) && x < ((rand[b][0] - rand[a][0]) * (y - rand[a][1])) / (rand[b][1] - rand[a][1]) + rand[a][0]) c = !c
    }
    return c
  }
  const randAbstand = (x: number, y: number) => rand.reduce((m, q) => Math.min(m, Math.hypot(x - q[0], y - q[1])), 9)
  const liste: { x: number; y: number; z: number; teil: number; e: number }[] = []
  for (let i = 0; i < kontur; i++) { const q = kurve((i / kontur) * TAU); liste.push({ x: q[0], y: q[1], z: 0, teil: 2, e: 0 }) }
  const kand: number[] = []
  while (kand.length < 1800 * 3) {
    const x = (rnd() * 2 - 1) * HERZ_S * 1.1, y = (rnd() * 2 - 1) * HERZ_S * 1.1
    if (innen(x, y) && randAbstand(x, y) > 0.045) kand.push(x, y, 0)
  }
  const f = auswahl(new Float32Array(kand), null, fuellung)
  for (let i = 0; i < fuellung; i++) liste.push({ x: f.p[i * 3], y: f.p[i * 3 + 1], z: 0, teil: 1, e: randAbstand(f.p[i * 3], f.p[i * 3 + 1]) })
  let kugelTeil: number[][] = []
  for (let n = K; n < K * 2 && kugelTeil.length < K; n += 4) {
    const kk = fib(n, 1)
    kugelTeil = []
    for (let i = 0; i < n; i++) {
      const vorn = kk[i * 3 + 2] > 0 && (innen(kk[i * 3], kk[i * 3 + 1]) || randAbstand(kk[i * 3], kk[i * 3 + 1]) < 0.09)
      if (!vorn) kugelTeil.push([kk[i * 3], kk[i * 3 + 1], kk[i * 3 + 2]])
    }
  }
  for (let i = 0; i < K; i++) { const p = kugelTeil[Math.floor((i * kugelTeil.length) / K)]; liste.push({ x: p[0], y: p[1], z: p[2], teil: 0, e: 0 }) }
  liste.sort((a, b) => b.y - a.y)
  const o = { p: new Float32Array(N * 3), teil: new Int8Array(N), e: new Float32Array(N) }
  liste.forEach((q, j) => { o.p[j * 3] = q.x; o.p[j * 3 + 1] = q.y; o.p[j * 3 + 2] = q.z; o.teil[j] = q.teil; o.e[j] = q.e })
  return o
}
const TMP = new Float32Array(N * 3)
function herz(t: number, out: GestenBild) {
  const K = (herzKugel ??= baueHerzKugel()), b = herzSchlag(t, 72), { L, H } = out
  // Zeit seit dem letzten Schlag: von dort läuft eine Lichtwelle über die Kugel
  const periode = 60 / 72, ph = t < 0.45 ? -1 : ((t - 0.45) / periode) % 1, seit = ph < 0 ? 9 : ph * periode
  const welleR = seit * 2.4, welleA = clamp01(1 - seit / 0.75), pochen = 1 + 0.14 * b, wulst = 1 + 0.8 * b
  for (let i = 0; i < N; i++) {
    const j = i * 3, teil = K.teil[i]
    if (teil === 0) {
      const s = 1 + 0.025 * b
      TMP[j] = K.p[j] * s; TMP[j + 1] = K.p[j + 1] * s; TMP[j + 2] = K.p[j + 2] * s
      // Winkelabstand zur Herzmitte vorne
      const ang = Math.acos(Math.max(-1, Math.min(1, (K.p[j + 1] * HERZ_OY + K.p[j + 2]) / Math.hypot(HERZ_OY, 1))))
      const w = Math.exp(-Math.pow(ang - 0.5 - welleR, 2) / 0.04) * welleA
      L[i] = 0.55 + 0.85 * w; H[i] = 0.12 + 0.5 * w
    } else {
      // Herz pocht um seine Mitte und wölbt sich aus der Kugel, die Kontur leuchtet am hellsten
      const x = K.p[j] * pochen, y = HERZ_OY + (K.p[j + 1] - HERZ_OY) * pochen, z = Math.sqrt(Math.max(0.05, 1 - x * x - y * y))
      const w2 = teil === 2 ? 0.05 : 0.17 * Math.min(1, K.e[i] / 0.16), r = 1 + w2 * wulst
      TMP[j] = x * r; TMP[j + 1] = y * r; TMP[j + 2] = z * r
      L[i] = teil === 2 ? 1.9 + 0.7 * b : 1.2 + 0.6 * b; H[i] = teil === 2 ? 1 : 0.85
    }
  }
  drehe(TMP, out.P, { yaw: 0.22 * Math.sin(0.5 * t), pitch: 0.06 })
}

/* ── Fehler (das Schütteln zur Seite macht die Engine) ─────────────────────────
   A: Dot bleibt Kugel und dreht leicht. C: ein X aus zwei runden Balken im Raum. */
let balken: Float32Array | null = null
const baueBalken = () => kapselPunkte([{ a: [-0.92, -0.92, 0], b: [0.92, 0.92, 0], r: 0.26 }, { a: [0.92, -0.92, 0], b: [-0.92, 0.92, 0], r: 0.26 }], N).p
function fehler(t: number, art: Fehler | null, out: GestenBild) {
  if (art === 'balken') drehe((balken ??= baueBalken()), out.P, { yaw: 0.38 * Math.sin(TAU * 0.3 * t), pitch: 0.16, s: 0.95 })
  else drehe(KUGEL, out.P, { yaw: 0.2 * t + 0.38 * Math.sin(TAU * 0.3 * t), pitch: 0.16, s: 0.92 })
  out.L.fill(1); out.H.fill(0)
}

/* ── Kein Netz B: kleiner Dot sendet Schalen aus seinen Punkten nach oben ────── */
const KERN = 190, KERN_P = fib(KERN, 0.42), KERN_T = new Float32Array(KERN * 3), JE = (N - KERN) / 3
let schalen: number[][] | null = null
function sucht(t: number, out: GestenBild) {
  const { L, H } = out
  drehe(KERN_P, KERN_T, { yaw: t * 0.5, pitch: 0.3 }); TMP.set(KERN_T, 0)
  // Impulse als Schalen: Kuppeln aus Punkten nach oben, wie ein Stück von Dots Oberfläche, das nach außen wächst
  schalen ??= (() => {
    const f = fib(760, 1), d: number[][] = []
    for (let q = 0; q < 760; q++) if (f[q * 3 + 1] < -Math.cos(1.0)) d.push([f[q * 3], f[q * 3 + 1], f[q * 3 + 2]])
    return Array.from({ length: JE }, (_, q) => d[Math.floor((q * d.length) / JE)])
  })()
  for (let i = KERN; i < N; i++) {
    const j = i - KERN, schale = Math.floor(j / JE), dir = schalen[j % JE], prog = (t * 0.42 + schale / 3) % 1, R = 0.55 + prog * 1.2
    const dr = t * 0.3 + schale, c1 = Math.cos(dr), s1 = Math.sin(dr)
    TMP[i * 3] = (dir[0] * c1 + dir[2] * s1) * R; TMP[i * 3 + 1] = 0.35 + dir[1] * R; TMP[i * 3 + 2] = (-dir[0] * s1 + dir[2] * c1) * R
    L[i] = 1.25 * Math.pow(1 - prog, 1.4) * clamp01(prog / 0.08)
  }
  for (let c = 0; c < KERN; c++) { TMP[c * 3 + 1] += 0.35; L[c] = 0.9 }
  H.fill(0)
  drehe(TMP, out.P, { yaw: 0.25 * Math.sin(0.5 * t), s: 0.95, ty: -0.12 })
}

/* ── Erfolg A: Haken mit Volumen zeichnet sich in einem Zug, danach läuft Licht hindurch ── */
const HA: V3 = [-0.8, 0.02, 0], HB: V3 = [-0.22, 0.6, 0], HC: V3 = [0.92, -0.64, 0]
let haken: { p: Float32Array; lauf: Float32Array } | null = null
function baueHaken() {
  const f = kapselPunkte([{ a: HA, b: HB, r: 0.17 }, { a: HB, b: HC, r: 0.17 }], N)
  const l1 = Math.hypot(HB[0] - HA[0], HB[1] - HA[1]), l2 = Math.hypot(HC[0] - HB[0], HC[1] - HB[1]), lauf = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const x = f.p[i * 3], y = f.p[i * 3 + 1]
    // die runden Enden liegen hinter Anfang und Ende des Strichs: auf 0…1 begrenzt, sonst blieben sie dunkel
    lauf[i] = clamp01(f.m[i] === 0
      ? ((x - HA[0]) * (HB[0] - HA[0]) + (y - HA[1]) * (HB[1] - HA[1])) / l1 / (l1 + l2)
      : (l1 + ((x - HB[0]) * (HC[0] - HB[0]) + (y - HB[1]) * (HC[1] - HB[1])) / l2) / (l1 + l2))
  }
  return { p: f.p, lauf }
}
function hakenBild(t: number, out: GestenBild) {
  const f = (haken ??= baueHaken())
  drehe(f.p, out.P, { yaw: 0.3 * Math.sin(TAU * 0.25 * t), pitch: 0.1, s: 0.95 })
  const prog = clamp01(t / HAKEN_GRUEN.ab), welle = ((t - HAKEN_GRUEN.ab) * 0.7) % 1.4
  for (let i = 0; i < N; i++) {
    out.L[i] = (f.lauf[i] <= prog ? 1.1 : 0.04) + (t > HAKEN_GRUEN.ab ? 0.7 * Math.exp(-Math.pow(f.lauf[i] - welle, 2) / 0.01) : 0)
    out.H[i] = 0
  }
}

/** Herz und Haken vorab bauen (Kandidaten und Auswahl dauern einige Millisekunden), damit ihr erstes Bild nicht ruckelt. */
export function gestenVorbereiten() {
  herzKugel ??= baueHerzKugel()
  haken ??= baueHaken()
  balken ??= baueBalken()
  EIN.kp ??= kappe(EIN.arm.s, false)
  BEIDE.kp ??= kappe(-1, true)
}

/** Ein Bild der Geste zum Zeitpunkt t (s seit ihrem Beginn). */
export function gestenBild(form: DotForm, t: number, v: GestenWahl, out: GestenBild) {
  if (form === 'hand') (v.gruss === 'beideArme' ? beideArme : einArm)(t, out)
  else if (form === 'heart') herz(t, out)
  else if (form === 'cross') fehler(t, v.fehler, out)
  else if (form === 'wifi') sucht(t, out)
  else hakenBild(t, out)
}

/** Bei weniger Bewegung steht jede Geste still in diesem Moment. */
export const STILL: Record<DotForm, number> = { hand: 1.3, heart: 0.3, cross: 0, wifi: 0.8, haken: 1.2 }
