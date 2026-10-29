/**
 * Dot, der KI-Coach als Punktwolke — die Engine.
 *
 * Ohne React: ein weicher Körper (96 Randpunkte mit Formgedächtnis), der an
 * Wänden flach zerfließt, in der Tab-Leiste wohnt (Eingang über seinem Logo),
 * herausklettert, hineingeworfen wird, beim Navigieren ausweicht und um die
 * Uhr fliegt. Gezeichnet werden die Punkte in einem WebGL-Auftrag, Licht und
 * Funken auf einer Canvas-2D-Fläche darunter.
 *
 * Entstanden im Mockup `docs/ki-coach/mockup.html`; Entscheidungen und
 * Messwerte in `memory/projects/ki-coach.md`. Weichheit ist fest „Gelee".
 */
import {
  FERN, TAU, clamp, clamp01, easeIO, easeOut3, eckenAbstand, gummi, leistenAbstand, projektion,
  kastenAbstand, rahmenAbstand, rahmenPunkt, ueberlappt, winkelAbstand,
  type Abstand, type Flaeche, type Kapsel, type Knopf,
} from './geometry'
import { FORM_R, HAND_GELENK, SL0, SL1, WIFI_O, formen, herzPhase, herzSchlag, ladeSchrift, textForm, type DotForm } from './formen'

export type { DotForm } from './formen'

export type DotModus = 'house' | 'exit' | 'home' | 'enter' | 'stage' | 'away' | 'gather' | 'orbit' | 'login' | 'portal'
export type DotStimmung = 'idle' | 'think' | 'speak' | 'joy' | 'listen'

/**
 * Ein Rundflug, den eine Seite vorgibt (Kalorientracker: einmal um die Kugel). Die Seite kennt
 * die Bahn, die Engine fliegt sie und landet danach an seinem Platz (`platz()` am Ende der Bahn).
 */
export interface Rundflug {
  /** Dauer in Sekunden. */
  dauer: number
  /** Lage zum Zeitpunkt t (s), Bildschirm-px; `depth` 1 = vorn (volle Größe), −1 = hinten. */
  pos(t: number): { x: number; y: number; depth: number }
  /** Gelandet (auch nach dem Abkürzen); nicht, wenn etwas anderes ihn unterbrach. */
  fertig?(): void
  /** Etwas anderes hat ihn herausgeholt (Chat, Kamera, Zugang weg). */
  abgebrochen?(): void
}

export interface DotTexte {
  wach(): string
  kitzeln(): string
  schwindel(): string
  tschuess(): string
  daBin(): string
  gruss(): string
  uhr(): string
}

export interface DotLeiste {
  kapsel: HTMLElement
  plus: HTMLElement | null
  logo: HTMLElement
  spalt: HTMLElement | null
}

export interface DotHost {
  canvas: HTMLCanvasElement
  glCanvas: HTMLCanvasElement
  hit: HTMLButtonElement
  blase: HTMLElement
  leiste(): DotLeiste | null
  texte: DotTexte
  weniger: boolean
  beiAntippen(): void
  beiZustand?(z: { modus: DotModus; drinnen: boolean; stoss: boolean }): void
}

export interface DotApi {
  modus(): DotModus
  klingeln(art?: string): boolean
  heimgehen(art?: string): void
  logoTipp(darfRaus: boolean): 'raus' | 'rein' | 'gesperrt' | 'nichts'
  setSeite(s: { leiste: boolean; kamera: boolean; darfRaus: boolean; richtung?: number }): void
  setZurueck(an: boolean): void
  setTastatur(px: number): void
  oeffneBuehne(el: HTMLElement): void
  schliesseBuehne(): void
  setStimmung(s: DotStimmung): void
  /** Hand, Herz, X oder Kein-Netz aus seinen Punkten; `null` = zurück zur Stimmung. */
  zeigeForm(f: DotForm | null): void
  /** Text aus seinen Punkten (Zeilen durch Zeilenumbruch getrennt); `null` = zurück zur Stimmung. */
  zeigeText(text: string | null): void
  /** Schrift laden und Texte vorab abtasten, damit sie ohne Ruckler erscheinen. */
  bereiteTexte(texte: string[]): Promise<void>
  /** Eröffnung auf der Anmeldung: Partikel vom Display-Rand sammeln sich zu Dot. Dauer in Sekunden, 0 = keine. */
  eroeffnung(): number
  /**
   * Erfolg der Anmeldung: sein Ring wächst zum Display-Umriss (das Portal; innerhalb
   * wird `[data-dot-portal]` sichtbar), die Punkte finden langsam zu ihm zurück und
   * er fliegt in seinen Platz in der Leiste. `false` = keine Animation (weniger Bewegung).
   */
  erfolg(): boolean
  /** Anmeldung: Dot steht auf dieser Bühne, lässt sich ziehen und werfen und kehrt zurück. */
  loginBuehne(el: HTMLElement): void
  /** Die Anmeldung ist vorbei: still ins Haus (der Flug in die Leiste folgt mit dem Erfolg). */
  verlasseLogin(): void
  /** Auf der Anmeldung: um so viele Pixel zum Formular hin neigen. */
  setNeigung(px: number): void
  stimme(v: number): void
  sag(text: string, ms?: number): void
  /** Wo er gerade ist und wo sein Platz ist (Bildschirm-px). */
  lage(): { x: number; y: number }
  platz(): { x: number; y: number }
  /** Rundflug starten; `false`, wenn er gerade nicht kann (weniger Bewegung, Chat, Kamera …). */
  rundflug(r: Rundflug): boolean
  /** Rundflug abkürzen: von hier in `sek` Sekunden an seinen Platz. */
  rundflugAbkuerzen(sek: number): void
  /** Gleich kommt ein Rundflug: so lange nicht von selbst herauskommen (er kommt dann vom Rand). */
  rundflugKommt(ms: number): void
  neuVermessen(): void
  zerstoeren(): void
}

/* ── Werte ─────────────────────────────────────────────────────────────── */

const TARGETS: Record<DotStimmung, { spin: number; bright: number; glow: number; hue: number }> = {
  idle: { spin: 0.16, bright: 0.85, glow: 0.4, hue: 0.45 },
  think: { spin: 0.9, bright: 0.95, glow: 0.6, hue: 0.8 },
  speak: { spin: 0.28, bright: 1, glow: 0.65, hue: 0.4 },
  listen: { spin: 0.2, bright: 0.9, glow: 0.5, hue: 0.3 },
  joy: { spin: 0.5, bright: 1.1, glow: 0.9, hue: 0.25 },
}
const SHAPE: Record<DotStimmung, string> = { idle: 'sphere', think: 'rings', speak: 'wave', joy: 'check', listen: 'circle' }
const CYAN = [110, 230, 255], VIOLET = [175, 135, 255], PINK = [255, 120, 200]
// Fehlerfarben der App: --lg-bad und --lg-warn
const BAD = [255, 69, 58], WARN = [255, 159, 10]

// Kugel frei schwebend (Nutzer 27.10.2026). Klebt er an der Wand, gelten die
// bisherigen ruhigen Werte; dazwischen im Maß, in dem er sich anlegt (B.flat).
const KUGEL = { drehung: 0.6, atmen: 2.5, licht: 2.5, puls: 2.5 }
// Werte aus dem Login-Mockup (docs/login/UEBERGABE.md, Abschnitt 2)
const FORM_LOOK: Record<DotForm, { bright: number; glow: number; hue: number }> = {
  hand: { bright: 0.95, glow: 0.45, hue: 0.45 },
  heart: { bright: 1, glow: 0.5, hue: 0.62 },
  cross: { bright: 0.95, glow: 0.8, hue: 0.45 },
  wifi: { bright: 0.95, glow: 0.8, hue: 0.45 },
}
const HAND = { freq: 1.44, ausschlag: 19 }
const HERZ = { bpm: 72, schlag: 0.3, licht: 1.5 }
const SCHUETTELN = { start: 0.35, dauer: 0.8, staerke: 24, schwingungen: 3.5 }
// Anmeldung: Ziehen und Werfen wie im Mockup (Rückkehr nach 450 ms Ruhe,
// Abprall 0,42 am Rand, Wurf höchstens 2600 px/s)
const LOGIN = { warten: 0.45, abprall: 0.42, maxWurf: 2600, rueckK: 16.2, reibung: 0.993 }
// Formwechsel als Feder je Punkt (Mockup „trans"): Tempo, Nachschwingen, Staffel, Wirbel
const FEDER = { tempo: 1, nachschwingen: 0.6, staffel: 0.35, wirbel: 1 }
// Schrift: Gitterabstand 5,5, Punktgröße 1,6 statt 4,3; Lichtlauf 100 %, Flackern 40 %
const TEXT = { dichte: 5.5, groesse: 1.6 / 4.3, licht: 1, funkeln: 0.4 }
// Eröffnung: Dauer 1, Wirbel 1, Punktgröße 2 statt 4,3 solange die Partikel fliegen
const EROEFFNUNG = { dauer: 1, wirbel: 1, groesse: 2 / 4.3 }
// Erfolg (Mockup „portalheim"): Zeiten in ms bei Tempo 1, durch das Tempo geteilt.
// Vorlauf bis das Portal wächst, Portal, Ruhe am Rand, Zusammenfinden, Heimflug.
const ERFOLG = { tempo: 0.6, vorlauf: 300, portal: 900, ruhe: 350, sammeln: 1900, flug: 900, logoR: 13, rahmenR: 48 }
const VARIANTEN = ['strudel', 'galaxie', 'implosion', 'regen'] as const
type Variante = (typeof VARIANTEN)[number]
/** Freigabe-Fenster (a0, a1), Gesamtlänge und Wirbelkraft je Variante. */
function variante(v: Variante, d = EROEFFNUNG.dauer) {
  if (v === 'galaxie') return { a0: 1.0 * d, a1: 1.2 * d, len: 4.2 * d, sw: 0.02 }
  if (v === 'implosion') return { a0: 0, a1: 0.3 * d, len: 2.0 * d, sw: 0 }
  if (v === 'regen') return { a0: 0.55 * d, a1: 0.8 * d, len: 3.2 * d, sw: 0.006 }
  return { a0: 0.7 * d, a1: 0.9 * d, len: 3.4 * d, sw: 0.012 }
}

/** Weichheit „Gelee" (im Mockup s = 1), fest. */
const P = (() => {
  const s = 1, K = 150 - 105 * s
  return {
    rest: 0.92 - 0.1 * s, restFlat: 0.3 - 0.1 * s, kw: 3000 - 2000 * s, K, T: 420,
    C: 2 * Math.sqrt(K) * (0.14 - 0.07 * s), Cv: 14, G: 0.0011 + 0.0016 * s, V: 0.0022 + 0.003 * s,
    thr: 0.2 - 0.12 * s, plastic: 1.5 + 5 * s, yieldR: 0.4 + 1.4 * s, regen: 0.9 - 0.45 * s,
    diff: 3 + 4 * s, breath: 0.006 + 0.014 * s, sagMul: 0.6 + s * 0.6,
  }
})()

const RK = 96
const DOT_R = 28
const PUNKTE = 460
// Für Schrift und Eröffnung trägt jeder Punkt fünf Kinder, die sonst unsichtbar in ihm sitzen
const KINDER = 5
const ALLE = PUNKTE * (1 + KINDER)
const ORBIT_T = 1.9
const IDLE = 25
const SPEICHER = 'tyd.dot.platz.v1'
const DRAUSSEN = 'tyd.dot.draussen'

// Zurück-Wischen der App (AppBackNavigation): Start in den linken 24 px
const RAND_ZURUECK = 24
// Rufen: dreimal schnell auf dieselbe Stelle
const RUF = { tippMs: 220, abstandMs: 260, px: 28 }

const EXITS = ['climb', 'pop', 'peek', 'stream'], ENTERS = ['suck', 'dive', 'dissolve', 'wave']
const THROWS = ['suck', 'splat', 'rim', 'bounce', 'swirl']

type DockX = 'left' | 'right' | null
type DockY = 'top' | 'nav' | 'bottom' | null
interface Wand extends Abstand {
  id: string
  sdf?: boolean
  fn?: (x: number, y: number) => Abstand
  dock?: number
  pull?: number
  T?: number
  L?: number
  hc?: number
}
interface Punkt { i: number; u: number; x: number; y: number; z: number; s: number; k: number; par: number }
interface Funke { x: number; y: number; vx: number; vy: number; t: number; life: number }

export function createDot(host: DotHost): DotApi {
  const { canvas, glCanvas, hit, blase, texte } = host
  const weniger = host.weniger
  const ctx = canvas.getContext('2d')!

  /* ── Weicher Rand ─────────────────────────────────────────────────────── */
  const U = new Float32Array(RK), UR = new Float32Array(RK), WV = new Float32Array(RK), M = new Float32Array(RK)
  const HEAL = new Float32Array(RK), SH = new Float32Array(RK)
  // Zug am Griffpunkt: wie weit jede Stelle beim Ziehen nachhängt (siehe `zug`)
  const PULL = new Float32Array(RK)
  const KF = new Float32Array(RK), GF = new Float32Array(RK), DX = new Float32Array(RK), DY = new Float32Array(RK)
  const CL = new Uint8Array(RK)
  const PH = Array.from({ length: 8 }, () => Math.random() * TAU)
  for (let k = 0; k < RK; k++) {
    const th = (k / RK) * TAU
    DX[k] = Math.cos(th); DY[k] = Math.sin(th)
    KF[k] = 1 + 0.22 * Math.sin(2 * th + PH[0]) + 0.14 * Math.sin(3 * th + PH[1]) + 0.08 * Math.sin(5 * th + PH[2])
    GF[k] = 1 + 0.25 * Math.sin(2 * th + PH[3]) + 0.15 * Math.sin(4 * th + PH[4])
  }

  /* ── Geometrie der Umgebung ───────────────────────────────────────────── */
  let W = 0, H = 0, dpr = 1, CR = 0, TAB = 0, CAPX = 0, OBEN = 0
  let ENT = { x: window.innerWidth / 2, w: 44 }
  let CAP: Kapsel = { l: 0, r: 0, t: 0, b: 0 }
  let PLUS: Knopf | null = null
  let CLK: { x: number; y: number; w: number; h: number } | null = null
  // Die Mitte der Statusleiste (Kamera-Insel oder Notch) bis zu ihrer Unterkante: ein Körper
  let INSEL: { l: number; r: number; t: number; b: number } | null = null
  let leiste: DotLeiste | null = null
  const NAV = { on: true, kb: 0, kbT: 0, cam: false, darfRaus: false }
  const navOn = () => NAV.on && !!leiste && NAV.kb < 1 && !NAV.kbT
  const ueberTastatur = () => NAV.kb > 0.5 || NAV.kbT > 0
  const bounds = () => ({ l: 4, t: 4, r: W - 4, b: H - 6 - NAV.kb })
  const cornerSdf = (x: number, y: number) => eckenAbstand(x, y, bounds(), CR, ueberTastatur())
  const frameSdf = (x: number, y: number) => rahmenAbstand(x, y, bounds(), CR, ueberTastatur())
  const inselSdf = (x: number, y: number) => INSEL ? kastenAbstand(x, y, INSEL, 18) : FERN
  const obstacle = (x: number, y: number) => leistenAbstand(x, y, CAP, PLUS)

  const sonde = document.createElement('div')
  sonde.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
  document.body.appendChild(sonde)

  function vermessen() {
    W = window.innerWidth; H = window.innerHeight; dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    glResize()
    const cs = getComputedStyle(sonde)
    const oben = parseFloat(cs.paddingTop) || 0, unten = parseFloat(cs.paddingBottom) || 0
    // Moderne iPhones haben runde Bildschirmecken (erkennbar am Streifen unten);
    // ein Browserfenster ist eckig.
    CR = unten > 0 ? 44 : 0
    OBEN = oben
    // Kamera-Insel (Abstand oben ab 51 px, 126 px breit) oder Notch (breiter); die
    // Wand reicht in voller Höhe der Statusleiste, links (Uhr) und rechts bleibt frei
    const iw = oben >= 51 ? 126 : oben > 30 ? 200 : 0
    INSEL = iw ? { l: W / 2 - iw / 2 - 6, r: W / 2 + iw / 2 + 6, t: -80, b: oben } : null
    // Die Uhr der Statusleiste sitzt links neben der Kamera-Insel. Ohne Insel
    // (kein Abstand oben) gibt es keine Uhr im Bild.
    CLK = oben > 30 ? { x: Math.max(40, (W / 2 - 64) / 2 + 6), y: oben * 0.5, w: 46, h: 18 } : null
    const l = host.leiste()
    if (l && l.kapsel.isConnected) {
      leiste = l
      const cr = l.kapsel.getBoundingClientRect()
      TAB = cr.top; CAPX = cr.left
      CAP = { l: cr.left, r: cr.right, t: cr.top, b: cr.bottom }
      const pr = l.plus?.getBoundingClientRect()
      PLUS = pr ? { x: pr.left + pr.width / 2, y: pr.top + pr.height / 2, rad: pr.width / 2 } : null
      const lr = l.logo.getBoundingClientRect()
      ENT = { x: lr.left + lr.width / 2, w: Math.min(46, lr.width - 8) }
    } else {
      // Ohne Leiste liegt sein Eingang am unteren Bildschirmrand, dort, wo sonst die Leiste ist
      leiste = null
      TAB = H + 4
    }
  }

  /* ── Zustand ──────────────────────────────────────────────────────────── */
  const fib = (n: number): Punkt[] => {
    const pts: Punkt[] = [], ga = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = ga * i
      pts.push({ i, u: i / n, x: Math.cos(th) * r, y, z: Math.sin(th) * r, s: Math.random() * TAU, k: Math.random(), par: i })
    }
    return pts
  }
  const punkte = () => {
    const pts = fib(PUNKTE)
    for (let i = PUNKTE; i < ALLE; i++) {
      const q = pts[i % PUNKTE]
      pts.push({ i, u: i / ALLE, x: q.x, y: q.y, z: q.z, s: Math.random() * TAU, k: Math.random(), par: q.i })
    }
    return pts
  }

  const B = {
    x: 0, y: 0, vx: 0, vy: 0, r: DOT_R, rv: 0, size: DOT_R,
    lx: 0, ly: 0, lvx: 0, lvy: 0, ax: 0, ay: 0, fax: 0, fay: 0, kx: 0,
    dock: { x: 'right' as DockX, y: 'nav' as DockY }, along: { x: 0, y: 0 }, squeezed: false,
    mode: 'house' as DotModus, lastThrow: '', rimA: 0, exitKind: 'climb', enterKind: 'suck', lastExit: '', lastEnter: '',
    popped: false, splashed: false, lean: 0, holdX: 0, holdY: 0, waveAt: -1, flat: 0,
    drag: null as null | {
      rand: boolean
      ox: number; oy: number; sx: number; sy: number; t0: number; moved: number
      hist: { x: number; y: number; t: number }[]; trail: { x: number; y: number; t: number }[]
      rev: number[]; sx0: number; dizzy?: boolean
    },
    idleT: 0, mood: 'awake' as 'awake' | 'yawning' | 'asleep', sleepAmt: 0, yawnT: -1, waveT: -1, waveSide: 1,
    giggleT: -1, dizzyT: -1, gcool: 0, zz: [] as { t: number; s: number }[], rufe: [] as { x: number; y: number; t: number }[], zzT: 0, peek: 0, greeted: false,
    door: 0, doorFlash: 0, script: 0, te: 0, near: 0, contact: {} as Record<string, boolean>, sag: 0,
    flash: 0, navFlash: 0, inselFlash: 0, sparks: [] as Funke[],
    state: 'idle' as DotStimmung, cur: { ...TARGETS.idle }, voice: 0, joyT: 9, poke: 9, rot: 0,
    pts: punkte(), shape: 'sphere', trans: 9, swirl: 0, erstes: true,
    text: null as string | null, textF: null as Float32Array | null, kinderAn: false, kinderBis: 0,
    intro: { an: false, t0: 0, v: 'strudel' as Variante },
    // Erfolg: Phase, Start der Phase, Fortschritt des Rahmens, Flugbahn; kMul macht die Federn weich
    portal: null as null | { phase: 'rahmen' | 'rand' | 'sammeln' | 'flug'; t0: number; fe: number; r0: number; flug?: { sx: number; sy: number; ex: number; ey: number } },
    kMul: 1,
    orbit: null as null | { x0: number; y0: number; a: number; b: number; th0: number; total: number; depth: number },
    tour: null as null | { r: Rundflug; ab: null | { t0: number; x: number; y: number; d: number } }, tourBald: 0,
    orbitCool: 0, herkunft: null as null | { x: number; y: number; t: number },
    pref: null as null | { dock: { x: DockX; y: DockY }; along: { x: number; y: number } },
    displaced: false, autoOut: false, thin: 0, thinT: 0, recede: 0, recedeT: 0,
    pan: null as null | { w: Wand; T: number; base: number; lo: number; hi: number }, panId: '',
    stage: null as HTMLElement | null,
    form: null as DotForm | null, formT: 0, tint: 0, warm: false, kugel: 1, shakeX: 0,
    login: { phase: 'ruhe' as 'ruhe' | 'frei' | 'zurueck', still: 0, neigung: 0, n: 0 },
  }
  // Je Punkt, in Dots Formraum (Einheit: sein Radius, Mitte 0): Lage Q und Tempo V
  // (pro 1/60 s, wie im Mockup), Ziel T, Ziel beim letzten Wechsel O, Verzögerung DEL.
  // Für die Eröffnung: Freigabe REL und Startpunkt S auf dem Display-Rand.
  const QX = new Float32Array(ALLE), QY = new Float32Array(ALLE), QZ = new Float32Array(ALLE)
  const VX = new Float32Array(ALLE), VY = new Float32Array(ALLE)
  const TX = new Float32Array(ALLE), TY = new Float32Array(ALLE), TZ = new Float32Array(ALLE)
  const OX = new Float32Array(ALLE), OY = new Float32Array(ALLE), OZ = new Float32Array(ALLE)
  const DEL = new Float32Array(ALLE), LICHT = new Float32Array(ALLE).fill(1), SZ = new Float32Array(ALLE).fill(1)
  const KR = Float32Array.from({ length: ALLE }, Math.random), DR = Float32Array.from({ length: ALLE }, Math.random)
  const REL = new Float32Array(ALLE), SX = new Float32Array(ALLE), SY = new Float32Array(ALLE), RAUS = new Uint8Array(ALLE)

  function speichern() {
    B.pref = { dock: { ...B.dock }, along: { ...B.along } }; B.displaced = false
    try { localStorage.setItem(SPEICHER, JSON.stringify({ dock: B.dock, along: B.along })) } catch { /* kein Speicher */ }
  }
  try {
    const s = JSON.parse(localStorage.getItem(SPEICHER) || 'null')
    if (s && s.dock && s.along) { B.dock = s.dock; B.along = s.along }
  } catch { /* kein Speicher */ }
  B.pref = { dock: { ...B.dock }, along: { ...B.along } }
  const merkeDraussen = (ja: boolean) => { try { localStorage.setItem(DRAUSSEN, ja ? '1' : '0') } catch { /* kein Speicher */ } }

  const melde = (stoss = false) => host.beiZustand?.({ modus: B.mode, drinnen: B.mode === 'house', stoss })
  const homeish = () => B.mode === 'home' || B.mode === 'away' || B.mode === 'gather'

  function walls(): Wand[] {
    const b = bounds()
    const ws: Wand[] = [
      { id: 'left', d: B.x - b.l, nx: 1, ny: 0 },
      { id: 'right', d: b.r - B.x, nx: -1, ny: 0 },
      { id: 'top', d: B.y - b.t, nx: 0, ny: 1 },
      { id: 'bottom', d: b.b - B.y, nx: 0, ny: -1 },
    ]
    if (navOn()) ws.push({ id: 'nav', sdf: true, fn: obstacle, ...obstacle(B.x, B.y) })
    if (INSEL) ws.push({ id: 'insel', sdf: true, fn: inselSdf, ...inselSdf(B.x, B.y) })
    if (CR > 0) ws.push({ id: 'corner', sdf: true, fn: cornerSdf, ...cornerSdf(B.x, B.y) })
    return ws
  }
  function dockY(): DockY {
    const y = B.dock.y
    if (y === 'nav' && !navOn()) return 'bottom'
    if (y === 'bottom' && navOn() && !B.squeezed) return 'nav'
    return y
  }
  const docked = (id: string) => B.dock.x === id || dockY() === id
  const restNow = () => P.rest + (P.restFlat - P.rest) * B.flat
  const atEntrance = (x: number, r: number) => navOn() && Math.abs(x - ENT.x) < ENT.w / 2 + r * 0.45

  // Die Bühne (Chat oder Anmeldung) wird einmal pro Bild gemessen; Physik und Zeichnen lesen diesen Wert
  let BUEHNE: DOMRect | null = null
  const messeBuehne = () => { BUEHNE = B.stage?.isConnected ? B.stage.getBoundingClientRect() : null }
  function stageCenter() {
    const s = BUEHNE
    return s ? { x: s.left + s.width / 2, y: s.top + s.height / 2 } : { x: W / 2, y: H * 0.3 }
  }
  function homeTarget() {
    const b = bounds(), r = B.size, rest = restNow()
    let x = B.dock.x === 'left' ? b.l + r * rest : B.dock.x === 'right' ? b.r - r * rest : clamp(B.along.x, b.l + r, b.r - r)
    const floor = B.squeezed || !navOn() ? b.b : TAB, dy = dockY()
    let y = dy === 'top' ? b.t + r * rest : dy === 'nav' ? TAB - r * rest : dy === 'bottom' ? b.b - r * rest : clamp(B.along.y, b.t + r, floor - r)
    // nicht in die Mitte der Statusleiste: oben zur Seite, sonst darunter
    if (INSEL) {
      const k = inselSdf(x, y), m = dy === 'top' ? r * rest : r
      if (k.d < m) {
        if (dy === 'top') x = x < W / 2 ? INSEL.l - m : INSEL.r + m
        else y = Math.max(y, INSEL.b + m)
      }
    }
    return { x, y }
  }
  function target() {
    if (B.mode === 'stage') return stageCenter()
    if (B.mode === 'enter') {
      const kind = B.enterKind, te = B.te
      if (kind === 'dissolve') return { x: B.holdX, y: B.holdY }
      if (kind === 'dive' && te < 0.28) return { x: B.holdX + (ENT.x - B.holdX) * 0.3, y: Math.min(B.holdY, TAB - B.r * 1.6) - 55 }
      if (kind === 'wave' && (B.waveAt < 0 || te < B.waveAt + 1.3)) return { x: ENT.x, y: TAB - B.r * 0.95 }
      if (kind === 'splat' && te < 0.32) return { x: ENT.x, y: TAB - B.r * 0.3 }
      if (kind === 'rim' && te < 1.0) return { x: ENT.x + B.rimA * Math.exp(-te * 2.6) * Math.cos(te * 11), y: TAB - B.r * 0.72 }
      if (kind === 'bounce' && te < 0.34) return { x: ENT.x, y: TAB - B.r * 2.3 }
      if (kind === 'swirl') return { x: ENT.x, y: TAB - B.r * 0.9 }
      return { x: ENT.x, y: TAB + B.r * 1.4 }
    }
    return homeTarget()
  }
  function radiusTarget() {
    if (B.mode === 'stage') return 46
    if (B.mode === 'portal') return B.r
    if (B.mode === 'login') return BUEHNE ? Math.min(66, BUEHNE.height * 0.26) : 46
    if (B.mode === 'enter') return B.size * 0.8
    if (B.mode === 'orbit' && B.tour && B.orbit) return B.size * (0.8 + 0.2 * B.orbit.depth)
    if (B.mode === 'orbit' && B.orbit) return B.size * (0.42 + 0.1 * B.orbit.depth)
    return B.size * (1 - 0.14 * B.recede)
  }

  /* ── Rand ─────────────────────────────────────────────────────────────── */
  function ringStep(h: number, ax: number, ay: number, t: number, ws: Wand[]) {
    const r = B.r, vs = Math.hypot(B.vx, B.vy), ux = vs > 1 ? B.vx / vs : 0, uy = vs > 1 ? B.vy / vs : 0
    for (let k = 0; k < RK; k++) {
      const kp = (k + 1) % RK, km = (k + RK - 1) % RK, th = (k / RK) * TAU
      let f = -(DX[k] * ax + DY[k] * ay) * P.G * GF[k]
      const al = DX[k] * ux + DY[k] * uy
      f += vs * P.V * (al * al - 0.5)
      const sag = B.sag * Math.pow(Math.max(0, DY[k]), 2)
      const breath = weniger ? 0 : P.breath * (Math.sin(2 * th + t * 0.9 + PH[5]) + 0.7 * Math.sin(3 * th - t * 1.3 + PH[6]) + 0.4 * Math.sin(5 * th + t * 2.1 + PH[7]))
      const acc = -P.K * (1 + 2.5 * B.script) * KF[k] * (U[k] - M[k] - sag - breath - SH[k] - PULL[k]) + P.T * (U[km] + U[kp] - 2 * U[k]) - P.C * WV[k] + P.Cv * (WV[km] + WV[kp] - 2 * WV[k]) + f
      WV[k] += acc * h
    }
    for (let k = 0; k < RK; k++) { U[k] = clamp(U[k] + WV[k] * h, -0.92, 3.4); CL[k] = 0 }
    let contact = false
    for (const w of ws) {
      if (w.d > r * 2.2) continue
      if (w.sdf && w.fn) {
        for (let k = 0; k < RK; k++) {
          const maxT = r * (1 + U[k]); let tt = 0, hitT = -1
          for (let it = 0; it < 16 && tt < maxT; it++) { const o = w.fn(B.x + DX[k] * tt, B.y + DY[k] * tt); if (o.d < 0.4) { hitT = tt; break } tt += Math.max(o.d, 0.6) }
          if (hitT >= 0) { const mu = hitT / r - 1; if (U[k] > mu) { U[k] = Math.max(-0.92, mu); if (WV[k] > 0) WV[k] *= -0.1; CL[k] = 1; contact = true } }
        }
        continue
      }
      for (let k = 0; k < RK; k++) {
        const c = -(DX[k] * w.nx + DY[k] * w.ny); if (c < 0.06) continue
        const maxU = w.d / (r * c) - 1
        if (U[k] > maxU) { U[k] = maxU; if (WV[k] > 0) WV[k] *= -0.1; CL[k] = 1; contact = true }
      }
    }
    // Fläche bleibt gleich: sanft als Kraft auf die freien Stellen
    let sum = 0, free = 0
    for (let k = 0; k < RK; k++) { sum += (1 + U[k]) * (1 + U[k]); if (!CL[k]) free += 1 + U[k] }
    if (free > 0) {
      const dd = (RK - sum) / (2 * free)
      for (let k = 0; k < RK; k++) if (!CL[k]) { WV[k] += dd * 60 * h * (1 - 0.85 * B.flat); U[k] += dd * 0.06 * (1 - 0.85 * B.flat) }
    }
    // Formgedächtnis: Ecken prägen sich ein, Ruhe heilt
    const calm = Math.pow(1 - clamp01(vs / 380), 2) * (contact ? 0.12 : 1) * (B.drag ? 0.5 : 1)
    for (let k = 0; k < RK; k++) {
      // Das Nachhängen beim Ziehen ist elastisch: es prägt sich nicht ein
      const e = U[k] - M[k] - PULL[k]
      if (CL[k]) M[k] += e * P.yieldR * h
      else if (e < -P.thr) M[k] += (e + P.thr) * P.plastic * h
    }
    for (let k = 0; k < RK; k++) {
      const kp = (k + 1) % RK, km = (k + RK - 1) % RK
      const dm = (-M[k] * P.regen + P.diff * (M[km] + M[kp] - 2 * M[k])) * calm * h
      M[k] = clamp(M[k] + dm, -0.5, 0.6)
      HEAL[k] = Math.max(HEAL[k] * Math.exp(-h * 3), Math.min(1, (Math.abs(dm) / h) * 6))
    }
  }

  /* ── Zug am Griffpunkt ────────────────────────────────────────────────── */
  // Beim Ziehen folgt die Stelle unter dem Finger sofort, der Rest hängt nach:
  // je weiter vom Griff und je schneller gezogen, desto mehr. Gegriffen in der
  // Mitte wird er zum Ei nach hinten; oben gegriffen und nach unten gezogen
  // staucht sich der untere Teil hoch, unten gegriffen zieht sich der obere lang.
  // Losgelassen fällt der Zug weg und der Rand federt zurück (Nachwabbeln).
  const ZUG_TRAEGHEIT = 0.055 // s: so lange hängt die dem Griff gegenüberliegende Stelle nach
  function zug(dt: number) {
    const D = B.drag
    const r = Math.max(B.r, 1)
    let vx = 0, vy = 0, gx = 0, gy = 0
    if (D && !weniger && D.moved >= 4) {
      // Steht der Finger, hängt nichts mehr nach
      if (performance.now() - D.hist[D.hist.length - 1].t < 60) { vx = B.vx; vy = B.vy }
      const gl = Math.hypot(D.ox, D.oy), s = gl > r ? r / gl : 1
      gx = D.ox * s; gy = D.oy * s
    }
    const a = 1 - Math.exp(-dt * 16)
    for (let k = 0; k < RK; k++) {
      if (!D) { PULL[k] = 0; continue }
      const w = clamp01(Math.hypot(DX[k] * r - gx, DY[k] * r - gy) / (2 * r))
      const ziel = clamp(-(vx * DX[k] + vy * DY[k]) * ZUG_TRAEGHEIT * w / r, -0.5, 1.2)
      PULL[k] += (ziel - PULL[k]) * a
    }
  }

  /* ── Loslassen, Aufprall ──────────────────────────────────────────────── */
  function release(vx: number, vy: number) {
    // von hier geworfen: nach dem Flug um die Uhr kommt er ungefähr hierher zurück
    B.herkunft = { x: B.x, y: B.y, t: performance.now() }
    const b = bounds(), r = B.size, speed = Math.hypot(vx, vy)
    const nav = navOn(), under = nav && B.y > TAB - r * 0.3
    B.squeezed = under
    const floor = nav && !under ? TAB : b.b, floorId: DockY = nav && !under ? 'nav' : 'bottom'
    B.thinT = 0; B.autoOut = false
    let px = B.x + projektion(vx), py = B.y + projektion(vy)
    // in den Eingang geworfen: Bahn trifft die Kante dort, oder im Lichtschein losgelassen
    if (nav && !under && vy > 180) {
      const tH = (TAB - r * 0.5 - B.y) / vy, xH = B.x + vx * tH
      if (tH > 0 && tH < 0.6 && Math.abs(xH - ENT.x) < ENT.w / 2 + r * 0.8) { B.vx = vx; B.vy = vy; goHome(pickThrow(vx, vy, xH)); return }
    }
    if (nav && !under && vy > -60 && Math.abs(B.x - ENT.x) < ENT.w / 2 + r * 0.35 && B.y > TAB - 95 - r) { B.vx = vx; B.vy = Math.max(vy, 200); goHome('suck'); return }
    if (speed > 1500) {
      let t = Infinity
      if (vx < 0) t = Math.min(t, (b.l + r - B.x) / vx)
      if (vx > 0) t = Math.min(t, (b.r - r - B.x) / vx)
      if (vy < 0) t = Math.min(t, (b.t + r - B.y) / vy)
      if (vy > 0) t = Math.min(t, (floor - r - B.y) / vy)
      if (isFinite(t) && t > 0) { px = B.x + vx * t; py = B.y + vy * t }
    }
    px = clamp(px, b.l + r, b.r - r); py = under ? B.y : clamp(py, b.t + r, floor - r)
    const snap = Math.max(34, r * 0.9)
    const dl = px - b.l - r, dr = b.r - r - px, dt = py - b.t - r, db = under ? 0 : floor - r - py
    let dx: DockX = Math.min(dl, dr) < snap ? (dl < dr ? 'left' : 'right') : null
    let dy: DockY = Math.min(dt, db) < snap ? (dt < db ? 'top' : floorId) : null
    if (dx && dy && !(Math.min(dl, dr) < snap * 0.6 && Math.min(dt, db) < snap * 0.6)) { if (Math.min(dl, dr) < Math.min(dt, db)) dy = null; else dx = null }
    // unter der Mitte der Statusleiste ist deren Unterkante die Decke: dort bleibt er
    if (INSEL && dy === 'top' && px > INSEL.l - r * 0.5 && px < INSEL.r + r * 0.5) { dy = null; py = INSEL.b + r }
    if (speed < 300 && !dx && !dy) { px = B.x; py = B.y }
    B.dock = { x: dx, y: dy }; B.along = { x: px, y: py }
    B.vx = vx; B.vy = vy
    speichern()
  }

  function impact(w: Wand, speed: number) {
    if (B.mode !== 'home') return
    if (w.id === 'nav' && speed > 150 && atEntrance(B.x, B.r) && B.y < TAB && !B.drag) { goHome(pickThrow(B.vx, B.vy, B.x)); return }
    if (speed < 70) return
    const nx = w.nx, ny = w.ny
    B.flash = Math.min(0.8, B.flash + speed / 2600)
    if (w.id === 'nav') B.navFlash = Math.min(1, B.navFlash + speed / 1500)
    if (w.id === 'insel') B.inselFlash = Math.min(1, B.inselFlash + speed / 1500)
    if (weniger) return
    const n = Math.min(28, (speed / 55) | 0), cx = B.x - nx * w.d, cy = B.y - ny * w.d
    for (let i = 0; i < n; i++) {
      const out = (0.15 + Math.random() * 0.4) * speed * 0.45, tan = (Math.random() - 0.5) * speed * 0.7
      B.sparks.push({ x: cx + -ny * (Math.random() - 0.5) * B.r, y: cy + nx * (Math.random() - 0.5) * B.r, vx: nx * out - ny * tan, vy: ny * out + nx * tan, t: 0, life: 0.35 + Math.random() * 0.4 })
    }
  }

  /* ── Physik je Bild ───────────────────────────────────────────────────── */
  function physics(dt: number, t: number) {
    const steps = Math.max(1, Math.ceil(dt * 120)), h = dt / steps, home = homeish()
    NAV.kb += (NAV.kbT - NAV.kb) * (1 - Math.exp(-dt * 16)); if (!NAV.kbT && NAV.kb < 0.5) NAV.kb = 0
    B.thin += (B.thinT - B.thin) * (1 - Math.exp(-dt * (B.thinT > B.thin ? 2.2 : 5)))
    B.recede += (B.recedeT - B.recede) * (1 - Math.exp(-dt * 8))
    if (!NAV.on && B.mode === 'home' && !B.drag && B.idleT > 6 && (B.dock.x || B.dock.y)) B.thinT = 1
    if (B.mode === 'away' || B.mode === 'gather') {
      B.te += dt
      if (B.mode === 'gather' && B.te > 1) { B.mode = 'home'; B.contact = {}; zeigeTreffer(); melde() }
    }
    const dockedNow = home && !B.drag && (B.dock.x || B.dock.y) && walls().some(w => docked(w.id) && w.d < B.r * 1.15)
    // Links wird er nur halb so flat: sein Körper ragt so aus der Randzone des
    // Zurück-Wischens (24 px) heraus und lässt sich dort greifen
    const flatT = dockedNow ? (B.state === 'idle' && !B.form && !B.text ? 1 : 0.35) * (B.dock.x === 'left' ? 0.45 : 1) : 0
    B.flat += (flatT - B.flat) * (1 - Math.exp(-dt * (flatT > B.flat ? 1.4 : 5)))
    const sagT = home && !B.drag ? (B.dock.y === 'top' ? 0.22 : B.dock.x && !B.dock.y ? 0.09 : 0) * P.sagMul : 0
    B.sag += (sagT - B.sag) * (1 - Math.exp(-dt * 3))
    zug(dt)
    if (B.mode === 'exit') climb(dt)
    B.orbitCool = Math.max(0, B.orbitCool - dt)
    if (B.mode === 'home' && !B.drag && !B.orbitCool && nearClock(B.x, B.y, B.r * 0.75)) startOrbit()
    // Etwas anderes hat ihn aus dem Rundflug geholt (Chat, Zugang weg): der Rundflug ist vorbei
    if (B.tour && B.mode !== 'orbit') { const r = B.tour.r; B.tour = null; r.abgebrochen?.() }
    if (B.mode === 'orbit') { if (B.tour) tourStep(dt); else orbitStep(dt) }
    if (B.mode === 'login' && !B.drag) loginStep(dt)
    if (B.mode === 'portal') portalSchritt(dt)
    if (B.squeezed && !NAV.kbT && B.y < TAB - B.r * 0.5) B.squeezed = false
    moods(dt)
    shapeScript(dt)
    const scripted = !!B.drag || B.mode === 'exit' || B.mode === 'house' || B.mode === 'orbit' || B.mode === 'login' || B.mode === 'portal'
    if (scripted && dt > 0) {
      const vx = (B.x - B.lx) / dt, vy = (B.y - B.ly) / dt
      B.ax += (clamp((vx - B.lvx) / dt, -30000, 30000) - B.ax) * 0.4
      B.ay += (clamp((vy - B.lvy) / dt, -30000, 30000) - B.ay) * 0.4
      B.lvx = vx; B.lvy = vy
    }
    for (let s = 0; s < steps; s++) {
      const pvx = B.vx, pvy = B.vy
      if (!scripted) {
        const T = target()
        const k = home ? 90 : B.mode === 'enter' ? enterK() : 120, c = 2 * Math.sqrt(k) * (weniger ? 1 : 0.85)
        let ax = k * (T.x - B.x) - c * B.vx, ay = k * (T.y - B.y) - c * B.vy
        if (home) for (const w of walls()) {
          const rest = (docked(w.id) ? restNow() : 1) * B.r, vn = B.vx * w.nx + B.vy * w.ny
          if (w.d < rest) {
            if (!B.contact[w.id]) { B.contact[w.id] = true; impact(w, -vn) }
            const pen = rest - w.d, cw = 2 * Math.sqrt(P.kw) * 0.95, f = P.kw * pen - cw * vn
            ax += w.nx * f; ay += w.ny * f
          } else if (w.d > rest + 1.5) B.contact[w.id] = false
        }
        B.vx += ax * h; B.vy += ay * h; B.x += B.vx * h; B.y += B.vy * h
        if (home) for (const w of walls()) {
          const min = B.r * (w.id === 'nav' && !B.squeezed ? 0.6 : 0.2)
          if (w.d < min) {
            B.x += w.nx * (min - w.d); B.y += w.ny * (min - w.d)
            const vn = B.vx * w.nx + B.vy * w.ny
            if (vn < 0) { B.vx -= vn * w.nx; B.vy -= vn * w.ny }
          }
        }
      }
      const rt = radiusTarget(), kr = 200, cr = 2 * Math.sqrt(kr) * (weniger ? 1 : 0.8)
      B.rv += (kr * (rt - B.r) - cr * B.rv) * h; B.r += B.rv * h
      let ax = B.ax, ay = B.ay
      if (!scripted) { ax = clamp((B.vx - pvx) / h, -40000, 40000); ay = clamp((B.vy - pvy) / h, -40000, 40000) }
      const lp = 1 - Math.exp(-h / 0.03)
      B.fax += (ax - B.fax) * lp; B.fay += (ay - B.fay) * lp
      ringStep(h, weniger ? 0 : B.fax + B.kx, weniger ? 0 : B.fay, t, home ? walls() : loginFrei() ? loginWaende() : [])
    }
    if (!scripted) { B.ax *= 0.5; B.ay *= 0.5 }
    B.kx *= Math.exp(-dt * 14)
    B.lx = B.x; B.ly = B.y
    if (!scripted) { B.lvx = B.vx; B.lvy = B.vy }
    B.flash *= Math.exp(-dt * 4); B.navFlash *= Math.exp(-dt * 3); B.inselFlash *= Math.exp(-dt * 3)
    const doorT = B.mode === 'house' ? 0 : B.mode === 'exit' ? (B.te > 0.05 ? 1 : 0) : 1
    B.door += (doorT - B.door) * (1 - Math.exp(-dt * (doorT > B.door ? 7 : 5)))
    B.doorFlash *= Math.exp(-dt * 2.5)
    const nearT = B.mode === 'home' || B.mode === 'enter' ? clamp01(1 - (Math.hypot(B.x - ENT.x, B.y - TAB) - B.r) / 140) : 0
    B.near += (nearT - B.near) * (1 - Math.exp(-dt * 6))
    if (B.mode === 'enter') {
      const kind = B.enterKind, te = B.te
      if (kind === 'wave' && B.waveAt < 0 && (te > 1.1 || (Math.hypot(B.x - ENT.x, B.y - (TAB - B.r * 0.95)) < B.r * 0.3 && te > 0.4))) {
        B.waveAt = te; B.waveT = 0; B.waveSide = ENT.x < W / 2 ? 1 : -1; sag(texte.tschuess(), 1300)
      }
      if (kind === 'dive' && !B.splashed && B.y > TAB - B.r * 0.4 && te > 0.28) { B.splashed = true; burst(false) }
      if (kind === 'bounce' && !B.splashed && B.y > TAB - B.r * 0.4 && te > 0.34) { B.splashed = true; burst(false) }
      if (kind === 'splat' && !B.splashed && B.y > TAB - B.r * 0.6) { B.splashed = true; burst(false); B.navFlash = 1 }
    }
    if (B.mode === 'enter' && (B.enterKind === 'dissolve' ? B.te > 1.35 : B.enterKind === 'swirl' ? B.te > 1.5 : B.y > TAB + B.r * 0.95)) {
      B.mode = 'house'; merkeDraussen(false); melde(true)
    }
  }

  /* ── Anmeldung ────────────────────────────────────────────────────────── */
  // Gezogen oder geworfen bleibt er ganz im Display: unter der Statusleiste,
  // über der Tastatur; die Mitte hält einen vollen Radius Abstand, gegen den
  // Rand gedrückt plattet er sich ab. In Ruhe gehört er zur Bühne und scrollt
  // mit ihr, auch aus dem Bild (die Registrierung ist länger als ein Bildschirm).
  const loginFrei = () => B.mode === 'login' && (!!B.drag || B.login.phase === 'frei')
  const loginGrenzen = () => { const b = bounds(); return { ...b, t: b.t + OBEN } }
  function loginWaende(): Wand[] {
    const b = loginGrenzen()
    const ws: Wand[] = [
      { id: 'left', d: B.x - b.l, nx: 1, ny: 0 },
      { id: 'right', d: b.r - B.x, nx: -1, ny: 0 },
      { id: 'top', d: B.y - b.t, nx: 0, ny: 1 },
      { id: 'bottom', d: b.b - B.y, nx: 0, ny: -1 },
    ]
    if (CR > 0) ws.push({ id: 'corner', sdf: true, fn: cornerSdf, ...cornerSdf(B.x, B.y) })
    return ws
  }
  function loginZiel() {
    const S = stageCenter()
    return { x: S.x, y: S.y + B.login.n }
  }
  function loginStep(dt: number) {
    const L = B.login
    // die Neigung zum Formular weich, das Scrollen der Seite sofort
    L.n += (L.neigung - L.n) * (1 - Math.exp(-dt * 10))
    const Z = loginZiel()
    // In Ruhe ist er Teil der Seite: Scrollen und Layoutsprünge tragen ihn mit,
    // ohne Trägheit (sonst würde jeder Sprung den weichen Rand aufschaukeln)
    if (L.phase === 'ruhe') { B.x = B.lx = Z.x; B.y = B.ly = Z.y; B.vx = B.vy = B.lvx = B.lvy = 0; return }
    if (L.phase === 'zurueck') {
      const k = LOGIN.rueckK, c = 2 * Math.sqrt(k) * 1.05
      B.vx += ((Z.x - B.x) * k - B.vx * c) * dt; B.vy += ((Z.y - B.y) * k - B.vy * c) * dt
    } else {
      const f = Math.pow(LOGIN.reibung, dt * 60); B.vx *= f; B.vy *= f
    }
    B.x += B.vx * dt; B.y += B.vy * dt
    if (L.phase === 'frei') loginAbprall()
    const sp = Math.hypot(B.vx, B.vy)
    if (L.phase === 'frei') {
      if (sp < 14) { L.still += dt; if (L.still > LOGIN.warten) { L.phase = 'zurueck'; L.still = 0 } } else L.still = 0
    } else if (Math.hypot(Z.x - B.x, Z.y - B.y) < 0.4 && sp < 2) L.phase = 'ruhe'
  }
  // Geworfen prallt er am Rand ab; auf dem Rückweg zur Bühne nicht (sie kann aus dem Bild gescrollt sein)
  function loginAbprall() {
    const b = loginGrenzen(), r = B.r + 2
    const prall = (v: number) => { B.flash = Math.min(0.8, B.flash + Math.abs(v) / 2600); return -v * LOGIN.abprall }
    if (B.x < b.l + r) { B.x = b.l + r; if (B.vx < 0) B.vx = prall(B.vx) } else if (B.x > b.r - r) { B.x = b.r - r; if (B.vx > 0) B.vx = prall(B.vx) }
    if (B.y < b.t + r) { B.y = b.t + r; if (B.vy < 0) B.vy = prall(B.vy) } else if (B.y > b.b - r) { B.y = b.b - r; if (B.vy > 0) B.vy = prall(B.vy) }
  }
  function loginZiehen(fx: number, fy: number) {
    const b = loginGrenzen(), r = B.r + 2
    const lx = b.l + r, hx = b.r - r, ly = b.t + r, hy = b.b - r
    B.x = fx < lx ? lx - gummi(lx - fx, r) : fx > hx ? hx + gummi(fx - hx, r) : fx
    B.y = fy < ly ? ly - gummi(ly - fy, r) : fy > hy ? hy + gummi(fy - hy, r) : fy
  }
  function loginBetreten(el: HTMLElement) {
    B.stage = el; messeBuehne()
    if (B.mode === 'login') return
    B.mode = 'login'; B.drag = null; B.flat = 0; B.thinT = 0; B.recedeT = 0
    B.mood = 'awake'; B.sleepAmt = 0; B.yawnT = -1; B.waveT = -1; B.giggleT = -1; B.dizzyT = -1
    const Z = loginZiel()
    B.x = B.lx = Z.x; B.y = B.ly = Z.y; B.vx = B.vy = B.lvx = B.lvy = 0
    // wächst auf der Bühne auf; die Eröffnung aus den Partikeln folgt später
    B.r = B.size * 0.3; B.rv = 0
    B.login = { phase: 'ruhe', still: 0, neigung: B.login.neigung, n: B.login.neigung }
    setState('idle'); arbeitet = false
    versteckeBlase(); zeigeTreffer(); melde(); laufen()
  }
  function loginVerlassen() {
    if (B.mode !== 'login') return
    B.mode = 'house'; B.stage = null; B.drag = null; B.login.neigung = 0
    setState('idle'); versteckeTreffer(); versteckeBlase(); melde(); laufen()
  }

  /* ── Rundflug (von einer Seite vorgegeben) ─────────────────────────────── */
  function startTour(r: Rundflug) {
    if (weniger || (B.mode !== 'home' && B.mode !== 'house') || B.drag || NAV.cam || !NAV.darfRaus) return false
    const p = r.pos(0)
    // Aus dem Haus auf einer Seite ohne Leiste: danach liegt er als Streifen am Rand wie sonst
    // beim Hineinnavigieren, und geht mit der Leiste wieder ins Haus
    if (B.mode === 'house' && !navOn()) { toStrip(); B.autoOut = true }
    B.tourBald = 0
    B.tour = { r, ab: null }
    B.orbit = { x0: p.x, y0: p.y, a: 0, b: 0, th0: 0, total: 0, depth: p.depth }
    B.x = p.x; B.y = p.y; B.vx = 0; B.vy = 0
    B.mode = 'orbit'; B.te = 0; versteckeTreffer(); wake(true); melde(); laufen()
    return true
  }
  function tourStep(dt: number) {
    const T = B.tour!
    B.te += dt
    let x: number, y: number, depth = 1, fertig: boolean
    if (T.ab) {
      // abgekürzt: von der Stelle, an der er war, an seinen Platz
      const q = clamp01((B.te - T.ab.t0) / T.ab.d), e = easeIO(q), h = homeTarget()
      x = T.ab.x + (h.x - T.ab.x) * e; y = T.ab.y + (h.y - T.ab.y) * e; fertig = q >= 1
    } else {
      const p = T.r.pos(Math.min(B.te, T.r.dauer))
      x = p.x; y = p.y; depth = p.depth; fertig = B.te >= T.r.dauer
    }
    if (B.orbit) B.orbit.depth = depth
    B.vx = (x - B.x) / Math.max(dt, 1e-3); B.vy = (y - B.y) / Math.max(dt, 1e-3); B.x = x; B.y = y
    if (fertig) {
      B.tour = null
      B.mode = 'home'; B.contact = {}; zeigeTreffer(); B.orbitCool = 2; B.idleT = 0
      // mit etwas Schwung landen, den Rest macht die Feder
      B.vx *= 0.6; B.vy *= 0.6
      melde(); T.r.fertig?.()
    }
  }

  /* ── Uhr ──────────────────────────────────────────────────────────────── */
  const nearClock = (x: number, y: number, pad: number) =>
    !!CLK && Math.abs(x - CLK.x) < CLK.w / 2 + pad && Math.abs(y - CLK.y) < CLK.h / 2 + pad
  function startOrbit() {
    if (!CLK) return
    const a = CLK.w / 2 + 16, b = 11, th0 = Math.atan2((B.y - CLK.y) / b, (B.x - CLK.x) / a)
    const cross = (B.x - CLK.x) * B.vy - (B.y - CLK.y) * B.vx, dir = cross >= 0 ? 1 : -1
    const rest = (((dir * (0 - th0)) % TAU) + TAU) % TAU
    B.orbit = { x0: B.x, y0: B.y, a, b, th0, total: dir * (TAU + rest), depth: 0 }
    B.mode = 'orbit'; B.te = 0; versteckeTreffer(); wake(true); versteckeBlase(); melde()
  }
  function orbitStep(dt: number) {
    const O = B.orbit
    if (!O || !CLK) { B.mode = 'home'; return }
    B.te += dt
    const q = clamp01(B.te / ORBIT_T), th = O.th0 + O.total * easeIO(q), mix = easeOut3(clamp01(B.te / 0.35))
    const ex = CLK.x + O.a * Math.cos(th), ey = CLK.y + 2 + O.b * Math.sin(th)
    const x = O.x0 + (ex - O.x0) * mix, y = O.y0 + (ey - O.y0) * mix
    O.depth = Math.sin(th) * mix
    B.vx = (x - B.x) / Math.max(dt, 1e-3); B.vy = (y - B.y) / Math.max(dt, 1e-3); B.x = x; B.y = y
    if (q >= 1) {
      // zurück, ungefähr dorthin, von wo er geworfen wurde; lag das schon an der
      // Uhr (nur herangeschoben), dann unter die Uhr
      // (nur frisch: ein alter Wurf zählt nicht, wenn er später anders hinkam)
      const h = B.herkunft, zurueck = h && performance.now() - h.t < 5000 && !nearClock(h.x, h.y, B.size * 2)
      const hx = zurueck ? h.x : CLK.x, hy = zurueck ? h.y : Math.max(OBEN, CLK.y + CLK.h) + B.size + 10
      B.herkunft = null
      B.mode = 'home'; B.contact = {}; zeigeTreffer(); B.orbitCool = 2; B.idleT = 0
      B.dock = { x: null, y: null }; B.along = { x: hx, y: hy }; speichern()
      // mit Schwung losfliegen, den Rest macht die Feder
      B.vx = (hx - B.x) * 1.6; B.vy = (hy - B.y) * 1.6
      sag(texte.uhr(), 4200); melde()
    }
  }

  /* ── Persönlichkeit ───────────────────────────────────────────────────── */
  let arbeitet = false
  function moods(dt: number) {
    const home = B.mode === 'home'
    if (home && !B.drag) B.idleT += dt; else B.idleT = 0
    if (home && !B.drag && B.mood === 'awake' && B.idleT > IDLE && B.giggleT < 0 && B.dizzyT < 0 && B.waveT < 0 && !arbeitet) { B.yawnT = 0; B.mood = 'yawning' }
    if (B.yawnT >= 0) { B.yawnT += dt; if (B.yawnT > 2.4) { B.yawnT = -1; B.mood = 'asleep' } }
    B.sleepAmt += ((B.mood === 'asleep' ? 1 : B.yawnT >= 0 ? 0.4 : 0) - B.sleepAmt) * (1 - Math.exp(-dt * (B.mood === 'asleep' ? 0.8 : 6)))
    if (B.waveT >= 0) { B.waveT += dt; if (B.waveT > 1.5) B.waveT = -1 }
    if (B.giggleT >= 0) {
      B.giggleT += dt
      if (!weniger) for (let k = 0; k < RK; k++) WV[k] += (Math.random() - 0.5) * 9 * Math.min(1, dt * 60) * (1 - B.giggleT / 1.4)
      if (B.giggleT > 1.4) B.giggleT = -1
    }
    if (B.dizzyT >= 0) { B.dizzyT += dt; if (B.dizzyT > 3.2) B.dizzyT = -1 }
    B.gcool = Math.max(0, B.gcool - dt)
    B.peek *= Math.exp(-dt * 3)
    if (B.mood === 'asleep' && home && !weniger) { B.zzT += dt; if (B.zzT > 1.2) { B.zzT = 0; B.zz.push({ t: 0, s: B.x > W / 2 ? -1 : 1 }) } }
    for (const z of B.zz) z.t += dt
    B.zz = B.zz.filter(z => z.t < 2.2)
  }
  let blasenTimer = 0
  function sag(text: string, ms = 2600) {
    if (!text) return
    blase.textContent = text; blase.dataset.zeigen = 'true'
    window.clearTimeout(blasenTimer)
    blasenTimer = window.setTimeout(versteckeBlase, ms)
  }
  function versteckeBlase() { delete blase.dataset.zeigen }
  function placeBubble() {
    if (blase.dataset.zeigen !== 'true') return
    if (B.mode !== 'home' && !B.tour) { versteckeBlase(); return }
    const bw = blase.offsetWidth, bh = blase.offsetHeight
    const above = B.y - B.r - 14 - bh > Math.max(56, OBEN + 8)
    const x = clamp(B.x - bw / 2, 12, W - bw - 12), y = above ? B.y - B.r - 14 - bh : B.y + B.r + 14
    blase.style.transformOrigin = `${(B.x - x).toFixed(0)}px ${above ? '100%' : '0%'}`
    blase.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
  }
  function wake(silent: boolean) {
    B.idleT = 0
    if (B.mood === 'asleep' || B.yawnT >= 0) {
      B.mood = 'awake'; B.yawnT = -1
      if (!weniger) for (let k = 0; k < RK; k++) WV[k] += (Math.random() - 0.5) * 2.5
      B.poke = 0
      if (!silent) sag(texte.wach(), 1500)
    }
  }
  function greet() {
    if (B.mode !== 'home') return
    wake(true); B.waveT = 0; B.waveSide = B.x < W / 2 ? 1 : -1; sag(texte.gruss(), 3600)
  }
  function giggle() {
    if (B.mode !== 'home') return
    wake(true); B.giggleT = 0; B.gcool = 3; B.flash = Math.min(0.8, B.flash + 0.4); sag(texte.kitzeln(), 1800)
  }
  function startDizzy() {
    if (B.mode !== 'home') return
    wake(true); B.dizzyT = 0; sag(texte.schwindel(), 2400)
  }

  /* ── Haus: herauskommen, hineingehen ──────────────────────────────────── */
  function enterK() {
    const kind = B.enterKind, te = B.te
    if (kind === 'dive') return te < 0.28 ? 110 : 260
    if (kind === 'wave') return B.waveAt >= 0 && te > B.waveAt + 1.3 ? 30 : 150
    if (kind === 'splat') return te < 0.32 ? 260 : 45
    if (kind === 'rim') return te < 1.0 ? 170 : 200
    if (kind === 'bounce') return te < 0.34 ? 120 : 280
    return 150
  }
  function pickThrow(vx: number, vy: number, xHit: number) {
    const sp = Math.hypot(vx, vy), off = Math.abs(xHit - ENT.x)
    let c = sp < 700 ? ['suck', 'rim', 'swirl'] : sp > 1400 ? ['splat', 'bounce', 'swirl', 'suck'] : THROWS.slice()
    if (off > ENT.w * 0.3) c.push('rim', 'rim')
    c = c.filter(k => k !== B.lastThrow)
    const k = c[(Math.random() * c.length) | 0] || 'suck'
    B.lastThrow = k
    return k
  }
  const pickKind = (list: string[], last: string, forced?: string) => {
    if (forced) return forced
    const c = list.filter(k => k !== last)
    return c[(Math.random() * c.length) | 0]
  }
  function burst(up: boolean) {
    B.doorFlash = 1; B.navFlash = 1; B.flash = Math.min(0.8, B.flash + 0.4)
    if (weniger) return
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 140 + Math.random() * 260
      B.sparks.push({ x: ENT.x + (Math.random() - 0.5) * ENT.w * 0.8, y: TAB - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * (up ? 1.2 : 0.8), t: 0, life: 0.4 + Math.random() * 0.35 })
    }
  }
  function landed(vx: number, vy: number) {
    B.mode = 'home'; B.contact = {}; zeigeTreffer(); B.idleT = 0; B.lean = 0
    B.vx = vx; B.vy = vy; B.lvx = vx; B.lvy = vy
    merkeDraussen(true); melde()
    if (!B.greeted) { B.greeted = true; grussT = window.setTimeout(greet, 900) }
  }
  function climb(dt: number) {
    B.te += dt
    const te = B.te, r = B.size, kind = B.exitKind
    B.r = r
    let y: number, x = ENT.x
    if (kind === 'stream') {
      const T = homeTarget(); B.x = T.x; B.y = T.y; B.vx = B.vy = 0
      if (te > 1.5) landed(0, 0)
      return
    }
    if (kind === 'climb') {
      if (te < 0.32) y = TAB + r * 1.1
      else if (te < 0.95) y = TAB + r * 1.1 - r * 1.45 * easeOut3((te - 0.32) / 0.63)
      else if (te < 1.5) y = TAB - r * 0.35 - r * 0.6 * easeIO((te - 0.95) / 0.55)
      else { const T = homeTarget(); landed((T.x - B.x) * 0.9, -520); return }
      if (te > 0.32) x += Math.sin(te * 9) * r * 0.04
    } else if (kind === 'pop') {
      if (te < 0.3) y = TAB + r * 1.1
      else if (te < 1.05) y = TAB + r * 1.1 - r * 1.25 * Math.pow((te - 0.3) / 0.75, 1.7)
      else if (te < 1.17) { y = TAB - r * 0.15 - r * 0.95 * easeOut3((te - 1.05) / 0.12); if (!B.popped) { B.popped = true; burst(true) } }
      else { const T = homeTarget(); landed((T.x - B.x) * 1.1, -720); return }
    } else {
      if (te < 0.3) y = TAB + r * 1.1
      else if (te < 0.8) y = TAB + r * 1.1 - r * 1.2 * easeOut3((te - 0.3) / 0.5)
      else if (te < 2.0) { y = TAB - r * 0.1; const lt = (te - 0.8) / 1.2; B.lean = Math.sin(lt * Math.PI * 2) * Math.sin(lt * Math.PI); x += r * 0.3 * B.lean }
      else if (te < 2.25) { y = TAB - r * 0.1 + r * 0.2 * Math.sin((Math.PI * (te - 2.0)) / 0.25); B.lean = 0 }
      else { const T = homeTarget(); landed((T.x - B.x) * 1.7, -980); return }
    }
    B.vx = (x - B.x) / Math.max(dt, 1e-3); B.vy = (y - B.y) / Math.max(dt, 1e-3)
    B.x = x; B.y = y
  }
  function goHome(kind?: string) {
    if (B.mode !== 'home') return
    if (!navOn()) { B.autoOut = true; return }
    B.enterKind = pickKind(ENTERS, B.lastEnter, kind); B.lastEnter = B.enterKind
    B.mode = 'enter'; B.te = 0; versteckeTreffer(); B.contact = {}; B.doorFlash = 1
    B.holdX = B.x; B.holdY = B.y; B.splashed = false; B.waveAt = -1
    if (B.enterKind === 'suck' && B.vy < 250) B.vy = 250
    if (B.enterKind === 'dive') B.vy = Math.min(B.vy, -260)
    if (B.enterKind === 'dissolve') { B.vx = B.vy = 0 }
    if (B.enterKind === 'rim') B.rimA = clamp(B.x - ENT.x, -B.r, B.r) || B.r * 0.6 * (Math.random() < 0.5 ? -1 : 1)
    if (B.enterKind === 'bounce') { B.vy = -clamp(Math.abs(B.vy) * 0.45, 380, 700); B.vx *= 0.4 }
    melde(); laufen()
  }
  // Beim Herauskommen fliegt er an eine zufällige freie Stelle: frei schwebend
  // oder an einer Seite, nicht in Ausweichzonen und weg vom letzten Platz. Ein
  // gespeicherter Platz, an dem er feststeckte, kehrt so nicht wieder.
  function zufallsPlatz(): { dock: { x: DockX; y: DockY }; along: { x: number; y: number } } {
    const b = bounds(), r = B.size, Z = zonen(), floor = navOn() ? TAB : b.b
    const yLo = b.t + r * 1.5, yHi = Math.max(yLo, floor - r * 3.2), alt = spotFor(B.dock, B.along)
    for (let i = 0; i < 24; i++) {
      const s = Math.random(), dock = { x: (s < 0.2 ? 'left' : s < 0.4 ? 'right' : null) as DockX, y: null as DockY }
      const along = { x: b.l + r * 1.5 + Math.random() * Math.max(0, b.r - b.l - r * 3), y: yLo + Math.random() * (yHi - yLo) }
      const p = spotFor(dock, along)
      if (ueberlappt(p, Z)) continue
      if (i < 16 && Math.hypot(p.x - alt.x, p.y - alt.y) < Math.min(W, H) * 0.3) continue
      return { dock, along }
    }
    return { dock: { x: 'right', y: null }, along: { x: b.r - r, y: (yLo + yHi) / 2 } }
  }
  function ring(kind?: string) {
    if (B.mode !== 'house') return false
    vermessen()
    // auf Seiten ohne Leiste legt er sich als Streifen an den Rand (toStrip), sonst zufällig
    if (!B.autoOut) { const p = zufallsPlatz(); B.dock = p.dock; B.along = p.along; B.squeezed = false; speichern() }
    B.exitKind = pickKind(EXITS, B.lastExit, kind); B.lastExit = B.exitKind; B.popped = false; B.lean = 0
    B.mode = 'exit'; B.te = 0
    B.x = ENT.x; B.y = TAB + B.size * 1.1; B.lx = B.x; B.ly = B.y; B.vx = B.vy = B.lvx = B.lvy = 0; B.r = B.size; B.doorFlash = 1
    WV.fill(0)
    melde(); laufen()
    return true
  }

  /* ── Formen aus dem Drehbuch ──────────────────────────────────────────── */
  function shapeScript(dt: number) {
    let grip = 0, stretch = 0, suck = 0, squeeze = 0, popOut = 0, duck = 0, hop = 0, dive = 0, splatF = 0, teeter = 0, swirlF = 0
    if (B.mode === 'exit') {
      const te = B.te, kind = B.exitKind
      if (kind === 'climb') {
        grip = te < 0.6 ? 0 : te < 0.85 ? (te - 0.6) / 0.25 : te < 1.38 ? 1 : Math.max(0, 1 - (te - 1.38) / 0.12)
        stretch = te > 0.95 && te < 1.5 ? Math.sin((Math.PI * (te - 0.95)) / 0.55) : 0
      } else if (kind === 'pop') {
        squeeze = te > 0.3 && te < 1.05 ? Math.min(1, (te - 0.3) / 0.25) : 0
        popOut = te >= 1.05 && te < 1.4 ? Math.sin((Math.PI * (te - 1.05)) / 0.35) : 0
      } else if (kind === 'peek') duck = te > 2.0 && te < 2.25 ? Math.sin((Math.PI * (te - 2.0)) / 0.25) : 0
    }
    if (B.mode === 'enter') {
      B.te += dt
      const te = B.te, kind = B.enterKind
      if (kind === 'suck') suck = clamp01(te / 0.22)
      if (kind === 'dive') { hop = te < 0.28 ? Math.sin((Math.PI * te) / 0.28) : 0; dive = te >= 0.28 ? Math.min(1, (te - 0.28) / 0.12) : 0 }
      if (kind === 'wave') suck = B.waveAt >= 0 && te > B.waveAt + 1.3 ? 0.6 : 0
      if (kind === 'splat') { splatF = te < 0.32 ? Math.min(1, te / 0.08) : Math.max(0, 1 - (te - 0.32) / 0.35); suck = te > 0.32 ? Math.min(1, (te - 0.32) / 0.3) : 0 }
      if (kind === 'rim') { teeter = te < 1.0 ? Math.exp(-te * 2.6) * Math.cos(te * 11) * Math.sign(B.rimA) : 0; suck = te > 1.0 ? Math.min(1, (te - 1.0) / 0.15) : 0 }
      if (kind === 'bounce') { hop = te < 0.34 ? Math.sin((Math.PI * te) / 0.34) : 0; dive = te >= 0.34 ? Math.min(1, (te - 0.34) / 0.1) : 0 }
      if (kind === 'swirl') swirlF = Math.min(1, te * 3)
    }
    const yawn = B.yawnT >= 0 ? B.yawnT / 2.4 : -1
    const inhale = yawn >= 0 ? (yawn < 0.45 ? easeIO(yawn / 0.45) : yawn < 0.62 ? 1 : Math.max(0, 1 - (yawn - 0.62) / 0.2)) : 0
    const exhale = yawn >= 0.62 ? Math.sin(Math.PI * clamp01((yawn - 0.62) / 0.38)) : 0
    const wave = B.waveT >= 0 ? Math.sin(Math.PI * clamp01(B.waveT / 1.5)) : 0
    const waveTh = (B.waveSide > 0 ? -0.75 : Math.PI + 0.75) + 0.4 * Math.sin(B.waveT * 13) * B.waveSide
    const dizzy = B.dizzyT >= 0 ? Math.min(1, B.dizzyT * 4) * clamp01((3.2 - B.dizzyT) / 0.8) : 0
    const tNow = performance.now() / 1000, breathe = B.sleepAmt * Math.sin(tNow * 1.25)
    const on = grip + stretch + suck + wave + squeeze + popOut + duck + hop + dive + splatF + Math.abs(teeter) + swirlF + Math.abs(B.lean) > 0.001 ? 1 : 0
    const wl = homeish() ? walls() : []
    const rr0 = B.r, bb = bounds()
    for (const w of wl) {
      w.dock = docked(w.id) ? B.flat : 0
      w.pull = docked(w.id) || w.id === 'corner' || (w.id === 'nav' && B.squeezed) ? 0 : clamp01(1 - (w.d - rr0) / 34)
      if (w.dock > 0.001) {
        // links dicker (siehe flatT): greifbar neben der Randzone des Zurück-Wischens
        let T = rr0 * ((w.id === 'left' ? 0.85 : 0.5) - 0.32 * B.thin)
        if (B.squeezed && navOn() && w.id === 'bottom') T = Math.min(T, Math.max(4, obstacle(B.x, bb.b).d * 0.92))
        w.T = T; w.L = clamp((0.8 * rr0 * rr0) / T, rr0 * 1.3, rr0 * (4.2 - 1.6 * B.thin)); w.hc = Math.min(w.d, T * 0.6)
      }
    }
    let domes = wl.filter(w => (w.dock ?? 0) > 0.001)
    const dyc = dockY()
    if (CR > 0 && domes.length && B.dock.x && (dyc === 'top' || dyc === 'bottom')) {
      const f = frameSdf(B.x, B.y), d0 = domes[0]
      domes = [{ id: 'frame', sdf: true, fn: frameSdf, ...f, dock: B.flat, T: d0.T, L: (d0.L ?? 0) * 1.15, hc: Math.min(f.d, (d0.T ?? 0) * 0.6) }]
    }
    B.pan = null
    if (!domes.length) B.panId = ''
    if (domes.length) {
      // Hauptwand mit Hysterese: in der Ecke kippte die Wahl sonst hin und her (Zucken)
      let w = domes.slice().sort((a, b) => a.d - b.d)[0]
      const keep = B.panId ? domes.find(o => o.id === B.panId) : undefined
      if (keep && keep !== w && keep.d < w.d + rr0 * 0.35) w = keep
      B.panId = w.id
      const tx = -w.ny, ty = w.nx, L = w.L ?? 0
      let lo = -L, hi = L
      for (const o of domes) if (o !== w) {
        const pr = tx * o.nx + ty * o.ny; if (Math.abs(pr) < 0.5) continue
        const aw = -o.d / pr
        if (pr > 0) lo = Math.max(lo, aw + 2); else hi = Math.min(hi, aw - 2)
      }
      if (hi - lo < 2 * L) { if (lo > -L) hi = Math.min(hi === L ? lo + 2 * L : hi, lo + 2 * L); else lo = Math.max(lo, hi - 2 * L) }
      B.pan = { w, T: w.T ?? 0, base: Math.max(0, w.d - 0.5), lo, hi }
    }
    const inDome = (w: Wand, px: number, py: number) => {
      const a = px * -w.ny + py * w.nx, hh = (w.hc ?? 0) + px * w.nx + py * w.ny
      if (hh < 0) return 1
      const q = Math.abs(a) / ((w.L ?? 1) * (1 + 0.06 * Math.sin(tNow * 0.4 + PH[3]))); if (q >= 1) return 0
      const top = (w.T ?? 0) * Math.cbrt(1 - q * q * q) * (1 + 0.14 * Math.sin((a / rr0) * 2.2 + tNow * 0.5 + PH[2]) + 0.07 * Math.sin((a / rr0) * 4.3 - tNow * 0.8 + PH[6]))
      return hh <= top ? 2 : 0
    }
    const domeAt = (k: number, tt: number) => {
      let inside = 0
      for (const w of domes) { const r = inDome(w, DX[k] * tt, DY[k] * tt); if (r === 1) return 1; if (r) inside = 2 }
      return inside
    }
    const domeLen = (k: number) => {
      let tt = 0, last = 0
      const st = rr0 * 0.14
      for (let n = 0; n < 40; n++) {
        tt += st
        const r = domeAt(k, tt)
        if (r !== 2) {
          let lo = last, hi = tt
          for (let j = 0; j < 4; j++) { const m = (lo + hi) / 2; if (domeAt(k, m) === 2) lo = m; else hi = m }
          return r === 1 ? hi : lo
        }
        last = tt
      }
      return last
    }
    B.script += (on - B.script) * (1 - Math.exp(-dt * 10))
    const kk = 1 - Math.exp(-dt * 14)
    for (let i = 0; i < RK; i++) {
      const dx = DX[i], dy = DY[i], th = (i / RK) * TAU
      let v = 0
      if (grip) {
        const dL = winkelAbstand(th, Math.PI / 2 + 1.05), dR = winkelAbstand(th, Math.PI / 2 - 1.05)
        v += grip * 0.62 * (Math.exp(-((dL / 0.3) ** 2)) + Math.exp(-((dR / 0.3) ** 2))) - grip * 0.18 * Math.pow(Math.max(0, dy), 6)
      }
      if (stretch) v += stretch * (0.34 * Math.pow(Math.max(0, -dy), 2) - 0.12 * dx * dx)
      if (suck) v += suck * (0.55 * Math.pow(Math.max(0, dy), 3) - 0.2 * dx * dx)
      if (squeeze) v += squeeze * (0.5 * Math.pow(Math.max(0, -dy), 2) + 0.3 * Math.pow(Math.max(0, dy), 2) - 0.45 * dx * dx)
      if (popOut) v += popOut * (0.28 * dx * dx - 0.2 * dy * dy)
      if (duck) v += duck * (0.25 * dx * dx - 0.18 * Math.pow(Math.max(0, -dy), 2))
      if (B.lean && B.mode === 'exit') v += 0.24 * Math.abs(B.lean) * Math.pow(Math.max(0, dx * Math.sign(B.lean)), 2)
      if (hop) v += hop * (0.22 * dx * dx - 0.2 * dy * dy)
      if (splatF) v += splatF * (0.9 * dx * dx - 0.55 * dy * dy)
      if (teeter) v += 0.3 * teeter * dx + 0.12 * Math.abs(teeter) * dy * dy
      if (swirlF) v += swirlF * 0.22 * Math.cos(th * 2 - tNow * 14)
      if (dive) v += dive * (0.6 * Math.pow(Math.max(0, dy), 2) + 0.15 * Math.pow(Math.max(0, -dy), 2) - 0.32 * dx * dx)
      if (inhale) v += inhale * (0.3 * Math.pow(Math.max(0, -dy), 2) - 0.09 * dx * dx)
      if (exhale) v += exhale * (0.12 * dx * dx - 0.1 * Math.pow(Math.max(0, -dy), 2))
      if (wave) v += wave * 0.5 * Math.exp(-((winkelAbstand(th, waveTh) / 0.3) ** 2))
      if (dizzy) v += dizzy * 0.16 * Math.cos(th * 2 - tNow * 5)
      for (const w of wl) if ((w.pull ?? 0) > 0.001) { const c = -(dx * w.nx + dy * w.ny); v += (w.pull ?? 0) * 0.42 * Math.pow(Math.max(0, c), 4) }
      if (domes.length) v += (domeLen(i) / rr0 - 1 - v) * B.flat
      if (B.peek) v += 0.16 * Math.abs(B.peek) * Math.pow(Math.max(0, dy * Math.sign(B.peek)), 2)
      if (B.sleepAmt) v += B.sleepAmt * (0.06 * Math.pow(Math.max(0, dy), 2) + 0.04 * breathe * Math.max(0, -dy))
      SH[i] += (v - SH[i]) * (inhale || exhale || B.sleepAmt ? 1 - Math.exp(-dt * 6) : kk)
    }
  }

  /* ── Zeichnen ─────────────────────────────────────────────────────────── */
  function drawBeam(t: number) {
    const open = B.door, ow = ENT.w * easeOut3(clamp01(open))
    const spalt = leiste?.spalt
    if (spalt) {
      spalt.style.width = ow.toFixed(1) + 'px'
      spalt.style.transform = `translateX(${(ENT.x - CAPX - ow / 2).toFixed(1)}px)`
    }
    // Der Strahl gehört zur Leiste: über dem Chat (Bühne) und unter einem Blatt
    // oder Dialog (er tritt zurück) liegt die Zeichenfläche über dem Fenster
    const frei = B.mode === 'stage' ? 0 : 1 - B.recede
    if (open < 0.01 || !navOn() || frei < 0.02) return
    const a = frei * clamp01(open * (0.75 + 0.08 * Math.sin(t * 2.1) + 0.3 * B.near) + B.doorFlash * 0.35)
    const ex = ENT.x, bh = (26 + 14 * B.near + 10 * B.doorFlash) * open
    ctx.globalCompositeOperation = 'lighter'
    ctx.save(); ctx.translate(ex, TAB); ctx.scale(ow * 0.62 + 4, bh)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    g.addColorStop(0, `rgba(110,220,255,${(0.16 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(110,220,255,0)')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, Math.PI, TAU); ctx.fill(); ctx.restore()
    if (ow > 4) for (let i = 0; i < 5; i++) {
      const u = (i + 0.5) / 5 - 0.5, x = ex + u * ow * 0.8 + Math.sin(t * 0.9 + i * 2.3) * 1.5
      const len = bh * (0.9 + 0.5 * Math.sin(t * 1.3 + i * 1.7)), lean = u * 6
      const gr = ctx.createLinearGradient(0, TAB, 0, TAB - len)
      gr.addColorStop(0, `rgba(170,240,255,${(0.2 * a).toFixed(3)})`); gr.addColorStop(1, 'rgba(170,240,255,0)')
      ctx.strokeStyle = gr; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, TAB - 0.5); ctx.lineTo(x + lean, TAB - len); ctx.stroke()
    }
    ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(200,245,255,${(0.55 * a).toFixed(3)})`
    for (const sd of [-1, 1]) {
      const x0 = ex + (sd * ow) / 2
      ctx.beginPath(); ctx.moveTo(x0 + sd * 7, TAB + 0.3); ctx.quadraticCurveTo(x0 + sd * 1.5, TAB + 0.3, x0, TAB - 2.2 * open); ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
  // Die Mitte der Statusleiste leuchtet an der Berührstelle, wie die Leiste unten
  function drawInselGlow() {
    if (B.mode !== 'home' || !INSEL) return
    const o = inselSdf(B.x, B.y), prox = clamp01(1 - (o.d - B.r * 0.55) / (B.r * 1.1))
    const a = Math.min(1, prox * 0.5 + B.inselFlash * 0.6); if (a < 0.02) return
    const sx = B.x - o.nx * o.d, sy = B.y - o.ny * o.d, R = B.r * 1.7, K = INSEL
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (const [lw, k] of [[6, 0.2], [1.3, 0.85]]) {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R)
      g.addColorStop(0, `rgba(160,238,255,${(k * a).toFixed(3)})`); g.addColorStop(0.55, `rgba(140,170,255,${(k * a * 0.3).toFixed(3)})`); g.addColorStop(1, 'rgba(140,170,255,0)')
      ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(K.l + 0.5, K.t, K.r - K.l - 1, K.b - K.t - 0.5, 18)
      else ctx.rect(K.l + 0.5, K.t, K.r - K.l - 1, K.b - K.t - 0.5)
      ctx.stroke()
    }
    ctx.restore()
  }
  function drawRimGlow() {
    if (!(B.mode === 'home' || B.mode === 'enter') || !navOn()) return
    const o = obstacle(B.x, B.y), prox = clamp01(1 - (o.d - B.r * 0.55) / (B.r * 1.1))
    const a = Math.min(1, prox * 0.5 + B.navFlash * 0.6); if (a < 0.02) return
    const sx = B.x - o.nx * o.d, sy = B.y - o.ny * o.d, R = B.r * 1.7, rad = (CAP.b - CAP.t) / 2
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (const [lw, k] of [[6, 0.2], [1.3, 0.85]]) {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R)
      g.addColorStop(0, `rgba(160,238,255,${(k * a).toFixed(3)})`); g.addColorStop(0.55, `rgba(140,170,255,${(k * a * 0.3).toFixed(3)})`); g.addColorStop(1, 'rgba(140,170,255,0)')
      ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(CAP.l + 0.5, CAP.t + 0.5, CAP.r - CAP.l - 1, CAP.b - CAP.t - 1, rad)
      else ctx.rect(CAP.l + 0.5, CAP.t + 0.5, CAP.r - CAP.l - 1, CAP.b - CAP.t - 1)
      if (PLUS) { ctx.moveTo(PLUS.x + PLUS.rad - 0.5, PLUS.y); ctx.arc(PLUS.x, PLUS.y, PLUS.rad - 0.5, 0, TAU) }
      ctx.stroke()
    }
    ctx.restore()
  }

  // Punkte auf der Grafikkarte: ein Auftrag für alle, sonst Canvas 2D
  const SURF = { a0: 0, da: 1, v: new Float32Array(64 * 4) }
  let ROT_C = 1, ROT_S = 0
  const CB = [0, 0, 0]
  function dotColorInto(X: number, Y: number, hue: number, heal: number) {
    const m = clamp01((X - Y) * 0.32 + 0.5 + (hue - 0.5) * 0.7)
    let r = CYAN[0] + (VIOLET[0] - CYAN[0]) * m, g = CYAN[1] + (VIOLET[1] - CYAN[1]) * m, b = CYAN[2] + (VIOLET[2] - CYAN[2]) * m
    if (Y > 0.55) { const q = Math.min(1, (Y - 0.55) * 1.4); r += (PINK[0] - r) * q; g += (PINK[1] - g) * q; b += (PINK[2] - b) * q }
    if (heal > 0.01) { const q = Math.min(0.7, heal); r += (225 - r) * q; g += (250 - g) * q; b += (255 - b) * q }
    CB[0] = r; CB[1] = g; CB[2] = b
    return CB
  }
  let GL: WebGLRenderingContext | null = null
  let GLU: { r: WebGLUniformLocation | null; d: WebGLUniformLocation | null; k: WebGLUniformLocation | null } | null = null
  // je Punkt höchstens zwei Einträge: der Punkt und sein Schweif
  const GLD = new Float32Array(ALLE * 2 * 7)
  function glInit(): WebGLRenderingContext | null {
    const gl = glCanvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
    if (!gl) return null
    const sh = (t: number, src: string) => {
      const x = gl.createShader(t); if (!x) return null
      gl.shaderSource(x, src); gl.compileShader(x)
      return gl.getShaderParameter(x, gl.COMPILE_STATUS) ? x : null
    }
    const vs = sh(gl.VERTEX_SHADER, 'attribute vec2 aP; attribute float aS; attribute vec4 aC; uniform vec2 uR; uniform float uD; varying vec4 vC; void main(){ vec2 p = aP / uR * 2.0 - 1.0; gl_Position = vec4(p.x, -p.y, 0.0, 1.0); gl_PointSize = aS * uD; vC = aC; }')
    const fs = sh(gl.FRAGMENT_SHADER, 'precision mediump float; varying vec4 vC; uniform float uK; void main(){ if (gl_FragCoord.y < uK) discard; float d = length(gl_PointCoord - 0.5) * 2.0; float a = d < 0.42 ? 1.0 : (d < 0.62 ? mix(0.95, 0.4, (d - 0.42) / 0.2) : max(0.0, 0.4 * (1.0 - (d - 0.62) / 0.38))); a *= vC.a; gl_FragColor = vec4(vC.rgb * a, a); }')
    if (!vs || !fs) return null
    const pr = gl.createProgram(); if (!pr) return null
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr)
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null
    gl.useProgram(pr); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    const at = (n: string, size: number, off: number) => { const l = gl.getAttribLocation(pr, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 28, off) }
    at('aP', 2, 0); at('aS', 1, 8); at('aC', 4, 12)
    GLU = { r: gl.getUniformLocation(pr, 'uR'), d: gl.getUniformLocation(pr, 'uD'), k: gl.getUniformLocation(pr, 'uK') }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.clearColor(0, 0, 0, 0)
    return gl
  }
  const kontextWeg = (e: Event) => { e.preventDefault(); GL = null }
  glCanvas.addEventListener('webglcontextlost', kontextWeg)
  function glResize() {
    if (!GL) return
    glCanvas.width = Math.round(W * dpr); glCanvas.height = Math.round(H * dpr); GL.viewport(0, 0, glCanvas.width, glCanvas.height)
  }
  function glDraw(n: number, clipY: number) {
    const gl = GL
    if (!gl || !GLU) return
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (!n) return
    gl.uniform2f(GLU.r, W, H); gl.uniform1f(GLU.d, dpr); gl.uniform1f(GLU.k, clipY < 0 ? -1 : (H - clipY) * dpr)
    gl.bufferData(gl.ARRAY_BUFFER, GLD.subarray(0, n * 7), gl.DYNAMIC_DRAW); gl.drawArrays(gl.POINTS, 0, n)
  }
  try { GL = glInit() } catch { GL = null }
  if (!GL) glCanvas.style.display = 'none'

  const spriteCache = new Map<number, HTMLCanvasElement>()
  function sprite(c: number[]) {
    const key = ((c[0] >> 3) << 10) | ((c[1] >> 3) << 5) | (c[2] >> 3)
    let sp = spriteCache.get(key)
    if (!sp) {
      const S = 32, col = `${(key >> 10) << 3},${((key >> 5) & 31) << 3},${(key & 31) << 3}`
      sp = document.createElement('canvas'); sp.width = sp.height = S
      const g = sp.getContext('2d')!, gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
      gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(0.42, `rgba(${col},0.95)`); gr.addColorStop(0.62, `rgba(${col},0.4)`); gr.addColorStop(1, `rgba(${col},0)`)
      g.fillStyle = gr; g.fillRect(0, 0, S, S); spriteCache.set(key, sp)
    }
    return sp
  }

  function setState(s: DotStimmung) {
    if (s === 'joy') B.joyT = 0
    B.state = s; B.shape = SHAPE[s]; B.form = null; B.text = null; B.textF = null
    wechsel()
  }
  function setForm(f: DotForm | null) {
    if (f) formen(PUNKTE)
    B.shape = f ?? SHAPE[B.state]; B.form = f; B.text = null; B.textF = null; B.formT = 0
    wechsel()
  }
  function setText(text: string | null) {
    if (text && !B.kinderAn) { kinderAnsetzen(); B.kinderAn = true }
    B.text = text; B.textF = text ? textForm(text, ALLE, TEXT.dichte) : null
    B.shape = text ? 'text' : SHAPE[B.state]; B.form = null; B.formT = 0
    wechsel()
  }
  /** Neues Ziel: jeder Punkt startet gestaffelt von dort, wo sein altes Ziel lag. */
  function wechsel() {
    const tf = B.textF
    for (let i = 0; i < ALLE; i++) {
      OX[i] = TX[i]; OY[i] = TY[i]; OZ[i] = TZ[i]
      const k = B.pts[i].k
      // Schrift entsteht aus der Mitte nach außen
      DEL[i] = tf ? k * 0.12 + (Math.abs(tf[i * 3]) / 150) * 0.4 : k * FEDER.staffel
    }
    B.trans = 0; B.swirl = weniger ? 0 : 1
  }
  /** Kinder sitzen unsichtbar in ihren Eltern, bevor sie heraustreten. */
  function kinderAnsetzen() {
    for (let i = PUNKTE; i < ALLE; i++) {
      const q = B.pts[i].par
      QX[i] = TX[i] = OX[i] = QX[q]; QY[i] = TY[i] = OY[i] = QY[q]
      QZ[i] = TZ[i] = OZ[i] = 0; VX[i] = VY[i] = 0; SZ[i] = SZ[q]
    }
  }
  /** Kinder rechnen nur, solange Schrift oder Eröffnung läuft (und kurz danach, bis sie verblasst sind). */
  function kinderAktiv() {
    const jetzt = performance.now()
    if (B.shape === 'text' || B.intro.an) { B.kinderAn = true; B.kinderBis = jetzt + 1500; return true }
    if (B.kinderAn && jetzt < B.kinderBis) return true
    B.kinderAn = false
    return false
  }
  // Ziel eines Punkts: x, y (Formraum), z (Sichtbarkeit), Licht. Ein festes Feld statt
  // eines neuen Arrays je Punkt und Bild (bei Schrift und Eröffnung 2760 Punkte).
  const ZIEL = [0, 0, 0, 1]
  const ziel = (x: number, y: number, z: number, licht = 1) => { ZIEL[0] = x; ZIEL[1] = y; ZIEL[2] = z; ZIEL[3] = licht; return ZIEL }
  let TEXT_SC = 1
  function shapeTarget(p: Punkt, t: number): number[] {
    const v = clamp01(B.voice), n = PUNKTE
    switch (B.shape) {
      case 'rings': {
        const ringI = p.i % 2, th = p.u * TAU * 2 + t * (ringI ? 2.4 : -1.9), rr = 1 + (p.k - 0.5) * 0.08
        const x = Math.cos(th) * rr, y = Math.sin(th) * rr * Math.cos(1.15), z = Math.sin(th) * rr * Math.sin(1.15)
        const g = ringI ? 0.55 : -0.55
        return ziel(x * Math.cos(g) - y * Math.sin(g), x * Math.sin(g) + y * Math.cos(g), 0.25 + (0.75 * (z + 1)) / 2)
      }
      case 'wave': {
        const band = p.i % 3, u = Math.floor(p.i / 3) / (n / 3), x = (u * 2 - 1) * 1.3, env = Math.exp(-x * x * 1.4)
        const y = env * (0.14 + 0.6 * v) * [1, 0.7, 0.45][band] * Math.sin(x * 5.5 + t * 7 + band * 2.1) + (p.k - 0.5) * 0.03
        return ziel(x, y, 0.9 - band * 0.15)
      }
      case 'check': {
        const L1 = 0.566, L2 = 1.13, s = p.u * (L1 + L2), j = (p.k - 0.5) * 0.12, j2 = Math.sin(p.s) * 0.03
        let x: number, y: number
        if (s < L1) { const q = s / L1; x = -0.55 + 0.4 * q + j * 0.7; y = 0.4 * q - j * 0.7 }
        else { const q = (s - L1) / L2; x = -0.15 + 0.77 * q + j * 0.55; y = 0.4 - 0.82 * q + j * 0.83 }
        return ziel(x + j2, y - 0.02 + j2, 1)
      }
      case 'circle': {
        const th = p.u * TAU + t * 0.4, rr = 1 + 0.06 * Math.sin(th * 8 + t * 6) + (p.k - 0.5) * 0.05
        return ziel(Math.cos(th) * rr, Math.sin(th) * rr, 0.85)
      }
      case 'hand': {
        // winkt: dreht um das Handgelenk, rollt dabei leicht
        const f = formen(PUNKTE).hand, j = p.i * 3, te = weniger ? 0 : B.formT, hw = TAU * HAND.freq
        const wave = ((HAND.ausschlag * Math.PI) / 180) * Math.sin(hw * te) * clamp01(te * 1.6)
        const x0 = f[j] * (0.9 + 0.1 * Math.cos(hw * 0.5 * te)), dy = f[j + 1] - HAND_GELENK, c = Math.cos(wave), s = Math.sin(wave)
        const x = x0 * c - dy * s + Math.sin(t * 1.3 + p.s) * 0.4
        const y = x0 * s + dy * c + HAND_GELENK + Math.cos(t * 1.1 + p.s * 1.7) * 0.4
        return ziel(x / FORM_R, y / FORM_R, f[j + 2] < 0 ? 0 : 0.55 + 0.45 * f[j + 2])
      }
      case 'heart': {
        // schlägt lub-dub; bei jedem Schlag läuft Licht vom Kern zum Rand
        const F = formen(PUNKTE), f = F.heart, j = p.i * 3, te = weniger ? 0 : B.formT
        const bs = 1 + HERZ.schlag * herzSchlag(te, HERZ.bpm), hq = Math.hypot(f[j], f[j + 1] - 8) / F.herzMax
        const ph = herzPhase(te, HERZ.bpm), rp = ph >= 0 ? ph / 0.54 : -1
        const licht = rp >= 0 && rp <= 1.2 ? 1 + HERZ.licht * Math.exp(-Math.pow((hq - rp) / 0.1, 2)) : 1
        return ziel((f[j] * bs) / FORM_R, (f[j + 1] * bs) / FORM_R, f[j + 2] < 0 ? 0 : 0.6 + 0.4 * (1 - hq * hq), licht)
      }
      case 'cross': {
        const f = formen(PUNKTE).cross, j = p.i * 3
        return ziel(f[j] / FORM_R, f[j + 1] / FORM_R, f[j + 2] < 0 ? 0 : 0.6 + 0.4 * f[j + 2])
      }
      case 'wifi': {
        const f = formen(PUNKTE).wifi, j = p.i * 3, te = B.formT, x = f[j], y = f[j + 1]
        let z = f[j + 2] < 0 ? 0 : 0.6 + 0.4 * f[j + 2], licht = 1
        const sdx = SL1[0] - SL0[0], sdy = SL1[1] - SL0[1], sl = Math.hypot(sdx, sdy)
        const proj = ((x - SL0[0]) * sdx + (y - SL0[1]) * sdy) / (sl * sl), quer = Math.abs((x - SL0[0]) * sdy - (y - SL0[1]) * sdx) / sl
        if (quer < 10 && proj > -0.05 && proj < 1.05) {
          // der Schrägstrich zeichnet sich von oben links nach unten rechts, wenn die Suche gescheitert ist
          z *= clamp01((te - 1.0 - proj * 0.35) / 0.12); licht = 1.25
        } else {
          // Suche: Licht läuft zweimal durch die Bögen nach außen, dann etwas dunkler
          const wd = Math.hypot(x, y - WIFI_O), idx = wd < 20 ? 0 : wd < 50 ? 1 : wd < 82 ? 2 : 3, ph = te * 2.4 - idx * 0.32
          if (te < 1.15 && ph > 0) licht = 1 + 1.1 * Math.pow(Math.max(0, Math.sin(ph * Math.PI)), 4)
          z *= 1 - 0.4 * clamp01((te - 1.1) / 0.4)
        }
        return ziel(x / FORM_R, y / FORM_R, z, licht)
      }
      case 'frame': {
        // Portal: sein Ring aus 460 Punkten wächst vom Kreis zum Umriss des Displays
        const P0 = B.portal, fe = P0 ? P0.fe : 0, R0 = P0 ? P0.r0 : B.r, ins = 5 * fe
        const L = B.x - R0 + (ins - (B.x - R0)) * fe, T = B.y - R0 + (ins - (B.y - R0)) * fe
        const Rr = B.x + R0 + (W - ins - (B.x + R0)) * fe, Bt = B.y + R0 + (H - ins - (B.y + R0)) * fe
        const rad = R0 + (ERFOLG.rahmenR - ins - R0) * fe
        const [x, y] = rahmenPunkt({ l: L, t: T, r: Rr, b: Bt }, rad, p.i / PUNKTE)
        return ziel((x - B.x) / B.r, (y - B.y) / B.r, 0.9)
      }
      case 'text': {
        // Lichtlauf von links nach rechts, leises Flackern, die Punkte zittern kaum
        const f = B.textF, j = p.i * 3
        if (!f) return ziel(0, 0, 0)
        const x0 = f[j] * TEXT_SC, y0 = f[j + 1] * TEXT_SC
        const licht = 1 + TEXT.licht * Math.max(0, Math.sin(t * 2.2 - x0 * 0.028)) + TEXT.funkeln * Math.sin(t * 3.1 + p.s * 4)
        const x = x0 + Math.sin(t * 1.3 + p.s) * 0.4, y = y0 + Math.cos(t * 1.1 + p.s * 1.7) * 0.4
        return ziel(x / B.r, y / B.r, f[j + 2] < 0 ? 0 : 0.55 + 0.45 * f[j + 2], licht)
      }
      default: {
        const X = p.x * ROT_C + p.z * ROT_S, Z0 = -p.x * ROT_S + p.z * ROT_C, ct = Math.cos(0.38), st = Math.sin(0.38)
        const Y = p.y * ct - Z0 * st, Z = p.y * st + Z0 * ct, f = (Z + 1) / 2
        // frei schwebend atmet jeder Punkt und ein Lichtschein zieht über die Kugel
        const kq = weniger ? 0 : B.kugel, atmen = KUGEL.atmen * kq, licht = KUGEL.licht * kq
        const rj = 1 + atmen * (0.022 * Math.sin(t * 2.1 + p.s) + 0.012 * Math.sin(t * 3.7 + p.s * 2.3))
        return ziel(X * rj, Y * rj, 0.1 + 0.85 * f * f, 1 + 0.18 * licht * Math.max(0, Math.sin(t * 0.9 + X * 1.6 + Y * 0.8)) * f)
      }
    }
  }

  /**
   * Feder je Punkt (Mockup „physics"): jeder Punkt läuft seinem Ziel mit eigener
   * Steifigkeit und Dämpfung nach, nach einem Wechsel kurz verwirbelt. Gerechnet
   * im Formraum: zieht man Dot, bewegt sich die Wolke als Ganzes mit.
   */
  function federSchritt(dt: number, t: number, anzahl: number) {
    const te = B.trans, f = Math.min(dt * 60, 3), schritte = Math.max(1, Math.ceil(f / 1.2)), h = f / schritte
    B.swirl *= Math.pow(0.955, f)
    const sw0 = B.swirl > 0.01 ? B.swirl * 0.028 * FEDER.wirbel : 0
    const tempo2 = FEDER.tempo * FEDER.tempo, dBase = 0.58 + 0.24 * FEDER.nachschwingen
    const I = B.intro, iv = variante(I.v), ti = I.an ? (performance.now() - I.t0) / 1000 : 99
    if (I.an && ti > iv.len) I.an = false
    const fadeAt = Math.max(iv.a0 + iv.a1 - 0.2, 0.5 * EROEFFNUNG.dauer)
    const sparse = B.shape !== 'text'
    const groesse = I.an && ti < iv.len - 1.1 * EROEFFNUNG.dauer ? EROEFFNUNG.groesse : B.shape === 'text' ? TEXT.groesse : B.shape === 'frame' ? 3 / 4.3 : 1
    const zA = 1 - Math.pow(0.86, f), sA = 1 - Math.pow(0.9, f), R = Math.max(B.r, 1)
    // nach dem Portal sehr weiche Federn, die sich zurück auf normal steigern
    B.kMul += (1 - B.kMul) * Math.min(1, 0.005 * f)
    const sofort = weniger || B.erstes
    B.erstes = false
    for (let i = 0; i < anzahl; i++) {
      const p = B.pts[i], kind = i >= PUNKTE
      if (I.an && ti < REL[i]) {
        // noch nicht freigegeben: liegt unsichtbar auf dem Display-Rand
        QX[i] = TX[i] = (SX[i] - B.x) / R; QY[i] = TY[i] = (SY[i] - B.y) / R; QZ[i] = TZ[i] = 0
        VX[i] = VY[i] = 0; LICHT[i] = 1
        continue
      }
      let tx: number, ty: number, tz: number, licht = 1
      if (kind && sparse) {
        // Kinder folgen ihren Eltern; sichtbar nur während der Eröffnung, dann verblassen sie
        const q = p.par
        tx = TX[q] + ((p.k - 0.5) * 1.5) / R; ty = TY[q] + (Math.sin(p.s) * 0.75) / R
        tz = I.an ? 0.75 * Math.max(0, 1 - (ti - REL[i] - fadeAt) / 0.6) : 0
      } else {
        const z = shapeTarget(p, t)
        tx = z[0]; ty = z[1]; tz = z[2]; licht = z[3]
        if (te < DEL[i]) { tx = OX[i]; ty = OY[i]; tz = OZ[i] }
      }
      TX[i] = tx; TY[i] = ty; TZ[i] = tz; LICHT[i] = licht
      SZ[i] += (groesse - SZ[i]) * sA
      if (sofort) { QX[i] = tx; QY[i] = ty; QZ[i] = tz; VX[i] = VY[i] = 0; continue }
      let kf = 1, sw = sw0, grav = 0
      if (I.an) {
        if (!RAUS[i]) {
          // Startschwung je Variante: einwärts, fallend oder tangential
          RAUS[i] = 1
          const rl = Math.hypot(QX[i], QY[i]) || 1, ux = QX[i] / rl, uy = QY[i] / rl
          if (I.v === 'implosion') { VX[i] = (-ux * 3) / R; VY[i] = (-uy * 3) / R }
          else if (I.v === 'regen') { VX[i] = ((Math.random() - 0.5) * 0.6) / R; VY[i] = (1.2 + Math.random()) / R }
          else { const tv = ((I.v === 'galaxie' ? 10 : 7) * EROEFFNUNG.wirbel) / R; VX[i] = -uy * tv; VY[i] = ux * tv }
        }
        const q = clamp01((ti - REL[i] - iv.a0) / iv.a1)
        kf = I.v === 'implosion' ? 0.45 + 0.55 * q : 0.12 + 0.88 * q
        sw = Math.max(sw, iv.sw * EROEFFNUNG.wirbel * (1 - q))
        if (I.v === 'regen') grav = (0.2 * (1 - q)) / R
      }
      const k = (0.1 + 0.07 * KR[i]) * tempo2 * kf * B.kMul, dh = Math.pow(Math.min(0.9, dBase + (DR[i] - 0.5) * 0.1), h)
      for (let n = 0; n < schritte; n++) {
        const dx = tx - QX[i], dy = ty - QY[i]
        let ax = dx * k, ay = dy * k + grav
        if (sw) { ax -= dy * sw; ay += dx * sw }
        VX[i] = (VX[i] + ax * h) * dh; VY[i] = (VY[i] + ay * h) * dh
        QX[i] += VX[i] * h; QY[i] += VY[i] * h
      }
      QZ[i] += (tz - QZ[i]) * zA
    }
  }
  /* ── Erfolg: Portal und Heimweg ───────────────────────────────────────── */
  const portalFlaeche = () => document.querySelector<HTMLElement>('[data-dot-portal]')
  function erfolg(): boolean {
    if (weniger || B.mode !== 'login') return false
    B.mode = 'portal'; B.drag = null; B.stage = null
    B.portal = { phase: 'rahmen', t0: performance.now(), fe: 0, r0: B.r }
    B.state = 'idle'; B.shape = 'frame'; B.form = null; B.text = null; B.textF = null
    wechsel()
    versteckeTreffer(); versteckeBlase(); melde(); laufen()
    return true
  }
  function portalSchritt(dt: number) {
    const P0 = B.portal
    if (!P0) return
    const tp = ERFOLG.tempo, jetzt = performance.now(), te = jetzt - P0.t0
    B.vx = B.vy = 0
    if (P0.phase === 'rahmen') {
      // Innerhalb genau dieser Form wird die App sichtbar
      const fe = easeIO(clamp01((te - ERFOLG.vorlauf / tp) / (ERFOLG.portal / tp)))
      P0.fe = fe
      const R0 = P0.r0, el = portalFlaeche()
      if (el) {
        const l = (B.x - R0) * (1 - fe), t = (B.y - R0) * (1 - fe), r = (W - B.x - R0) * (1 - fe), b = (H - B.y - R0) * (1 - fe), rad = R0 + (ERFOLG.rahmenR - R0) * fe
        el.style.clipPath = fe >= 1 ? 'none' : `inset(${t.toFixed(1)}px ${r.toFixed(1)}px ${b.toFixed(1)}px ${l.toFixed(1)}px round ${rad.toFixed(1)}px)`
      }
      if (fe >= 1) { P0.phase = 'rand'; P0.t0 = jetzt }
    } else if (P0.phase === 'rand' && te > ERFOLG.ruhe / tp) {
      // Die Kugeln bleiben kurz am Rand, dann finden sie langsam zu Dot zusammen
      setState('idle')
      for (let i = 0; i < PUNKTE; i++) DEL[i] = B.pts[i].k * 0.5
      B.kMul = 0.05; P0.phase = 'sammeln'; P0.t0 = jetzt
    } else if (P0.phase === 'sammeln' && te > ERFOLG.sammeln / tp) {
      vermessen()
      const l = host.leiste()
      if (!l || !l.logo.isConnected) { portalEnde(false); return }
      const lr = l.logo.getBoundingClientRect()
      P0.flug = { sx: B.x, sy: B.y, ex: lr.left + lr.width / 2, ey: lr.top + lr.height / 2 }
      P0.phase = 'flug'; P0.t0 = jetzt
    } else if (P0.phase === 'flug' && P0.flug) {
      // Bogen in den Platz in der Leiste, dabei auf Logo-Größe schrumpfen
      const F = P0.flug, u = clamp01(te / (ERFOLG.flug / tp)), e = easeIO(u)
      const mx = (F.sx + F.ex) / 2 + (F.ex - F.sx) * 0.15, my = Math.min(F.sy, F.ey) + (F.ey - F.sy) * 0.18 - 40
      B.x = (1 - e) * (1 - e) * F.sx + 2 * (1 - e) * e * mx + e * e * F.ex
      B.y = (1 - e) * (1 - e) * F.sy + 2 * (1 - e) * e * my + e * e * F.ey
      B.r = P0.r0 + (ERFOLG.logoR - P0.r0) * e; B.rv = 0
      if (u >= 1) portalEnde(true)
    }
    void dt
  }
  /** Er ist drinnen: das Logo hüpft (Stoß), die Tür ist zu. */
  function portalEnde(gelandet: boolean) {
    const el = portalFlaeche()
    if (el) el.style.clipPath = ''
    B.portal = null; B.kMul = 1; B.mode = 'house'; B.door = 0; B.r = B.size; B.rv = 0
    setState('idle'); merkeDraussen(false); versteckeTreffer(); melde(gelandet)
  }

  /** Eröffnung: die Partikel liegen auf dem Display-Rand (links, oben, rechts) und sammeln sich zu Dot. */
  function eroeffnung(): number {
    if (weniger || B.mode !== 'login') return 0
    const pool = VARIANTEN.filter(v => v !== B.intro.v), v = pool[(Math.random() * pool.length) | 0]
    const iv = variante(v), d = EROEFFNUNG.dauer
    messeBuehne()
    setState('idle')
    B.r = radiusTarget(); B.rv = 0
    const b = loginGrenzen(), rad = Math.max(CR, 48) - 4, unten = b.b - rad, Z = loginZiel(), R = B.r
    for (let i = 0; i < ALLE; i++) {
      // Regen nur oben, die anderen links, oben und rechts, nie unten, wo das Formular steht
      let x = 0, y = 0
      for (let n = 0; n < 30; n++) {
        [x, y] = rahmenPunkt(b, rad, Math.random())
        if (v === 'regen' ? y <= b.t + rad * 0.5 : y <= unten) break
      }
      const ang = (Math.atan2(y - Z.y, x - Z.x) / TAU + 1.625) % 1
      REL[i] = v === 'regen' ? Math.random() * 0.9 * d
        : v === 'implosion' ? Math.random() * 0.25 * d
          : v === 'galaxie' ? ((ang * 3) % 1) * 0.9 * d + Math.random() * 0.15 * d
            : ang * 1.1 * d + Math.random() * 0.25 * d
      SX[i] = x; SY[i] = y; RAUS[i] = 0
      QX[i] = TX[i] = (x - B.x) / R; QY[i] = TY[i] = (y - B.y) / R; QZ[i] = TZ[i] = 0; VX[i] = VY[i] = 0
    }
    B.intro = { an: true, t0: performance.now(), v }
    B.kinderAn = true; B.kinderBis = performance.now() + 1500
    return iv.len
  }

  function render(t: number, dt: number) {
    const st = TARGETS[B.state], tg = B.form ? { ...FORM_LOOK[B.form], spin: st.spin } : st, cur = B.cur, k = 1 - Math.exp(-dt * 6)
    B.kugel = 1 - B.flat
    const spin = B.state === 'idle' ? st.spin + (KUGEL.drehung - st.spin) * B.kugel : tg.spin
    cur.spin += (spin - cur.spin) * k; cur.bright += (tg.bright - cur.bright) * k
    cur.glow += (tg.glow - cur.glow) * k; cur.hue += (tg.hue - cur.hue) * k
    B.joyT += dt; B.poke += dt; B.trans += dt; B.formT += dt
    // Fehler: Farbe blendet zu Rot (X) bzw. Orange (kein Netz) und zurück
    const fehler = B.form === 'cross' || B.form === 'wifi'
    if (fehler) B.warm = B.form === 'wifi'
    B.tint += ((fehler ? 1 : 0) - B.tint) * Math.min(1, 7.2 * dt)
    // X: gedämpftes Schütteln zur Seite wie das iOS-Passwortfeld
    const su = (B.formT - SCHUETTELN.start) / SCHUETTELN.dauer
    B.shakeX = B.form === 'cross' && !weniger && su > 0 && su < 1 ? SCHUETTELN.staerke * Math.exp(-su * 3.2) * Math.sin(su * TAU * SCHUETTELN.schwingungen) : 0
    if (B.state === 'joy' && B.joyT > 1.9 && B.mode !== 'portal') setState('idle')
    B.voice *= Math.exp(-dt * 3)
    const sleeping = B.mode === 'house'
    if (!weniger) B.rot += cur.spin * dt * (sleeping ? 0.4 : 1) * (1 - 0.7 * B.sleepAmt) * (B.dizzyT >= 0 ? 3 : 1)
    const lp = 1 - Math.exp(-dt / 0.025)
    for (let i = 0; i < RK; i++) UR[i] += (U[i] - UR[i]) * lp

    ctx.clearRect(0, 0, W, H)
    drawBeam(t)
    const m = weniger ? 0 : 1, pk = B.poke
    const pulse = 1 + m * (0.018 * (1 + (KUGEL.puls - 1) * B.kugel) * Math.sin(t * 1.6) + (pk < 0.6 ? -Math.exp(-pk * 8) * Math.cos(pk * 22) * 0.07 : 0) + (B.joyT < 1.3 ? Math.exp(-B.joyT * 4.2) * Math.sin(B.joyT * 13) * 0.12 : 0))
    const dz = B.dizzyT >= 0 && !weniger ? Math.min(1, B.dizzyT * 4) * clamp01((3.2 - B.dizzyT) / 0.8) : 0
    const r = B.r * pulse, cx = B.x + B.shakeX + dz * Math.cos(t * 5.5) * B.r * 0.12, cy = B.y + dz * Math.sin(t * 5.5) * B.r * 0.08
    const bright = (cur.bright + B.flash * 0.6) * (1 - 0.4 * B.sleepAmt) * (1 - 0.25 * B.thin) * (1 - 0.3 * B.recede) * (B.mode === 'orbit' && B.orbit ? 0.75 + 0.25 * B.orbit.depth : 1) + (B.giggleT >= 0 ? 0.15 * Math.sin(t * 40) : 0)
    const hueShift = dz * 0.5 * Math.sin(t * 3)

    drawRimGlow(); drawInselGlow()

    const swirling = B.mode === 'enter' && B.enterKind === 'swirl'
    const streaming = (B.mode === 'exit' && B.exitKind === 'stream') || (B.mode === 'enter' && B.enterKind === 'dissolve')
    const away = B.mode === 'away', gather = B.mode === 'gather', scatter = away || gather
    const hidden = sleeping || (B.mode === 'exit' && B.te < (B.exitKind === 'stream' ? 0.22 : 0.3)) || (away && B.te > 0.95)
    const clipped = B.mode === 'enter' || B.mode === 'exit'
    if (clipped) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, TAB); ctx.clip() }

    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2)
    const tc = B.warm ? WARN : BAD, ti = B.tint, mix = (a: number, b: number) => (a + (b - a) * ti) | 0
    const glow = cur.glow * (B.form === 'heart' && !weniger ? 1 + 1.2 * herzSchlag(B.formT, HERZ.bpm) : 1)
    g.addColorStop(0, `rgba(${mix(70, tc[0])},${mix(170, tc[1])},${mix(255, tc[2])},${0.18 * glow * (1 + ti * 0.4)})`)
    g.addColorStop(0.5, `rgba(${mix(150, tc[0])},${mix(110, tc[1] * 0.85)},${mix(255, tc[2] + 50)},${0.08 * glow})`); g.addColorStop(1, 'rgba(0,0,0,0)')
    const glowA = scatter ? (away ? clamp01(1 - B.te / 0.5) : clamp01((B.te - 0.35) / 0.6)) : swirling ? clamp01(1 - B.te / 1.1) : !streaming ? 1 : B.mode === 'exit' ? clamp01((B.te - 0.6) / 0.8) : clamp01(1 - B.te / 0.9)
    ctx.fillStyle = g
    if (!hidden && glowA > 0.01 && B.shape !== 'frame') {
      // um Schrift breit und flach, um die Hand hoch
      const gsx = B.shape === 'text' ? 2.1 : B.form === 'hand' ? 1.05 : 1, gsy = B.shape === 'text' ? 0.85 : B.form === 'hand' ? 1.35 : 1
      ctx.save(); ctx.translate(cx, cy); ctx.scale(gsx, gsy); ctx.translate(-cx, -cy)
      ctx.globalAlpha = glowA; ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4)
      ctx.restore(); ctx.globalAlpha = 1
    }

    let nPts = 0
    ROT_C = Math.cos(B.rot); ROT_S = Math.sin(B.rot)
    const pan = B.pan
    if (pan && pan.w.sdf && pan.w.fn && B.flat > 0.01) {
      const w = pan.w, fn = pan.w.fn, tx = -w.ny, ty = w.nx, half = (pan.hi - pan.lo) / 2, mid = (pan.lo + pan.hi) / 2
      SURF.a0 = mid - half * 1.6; SURF.da = (half * 3.2) / 63
      for (let i = 0; i < 64; i++) {
        const a = SURF.a0 + i * SURF.da
        let qx = B.x - w.nx * pan.base + tx * a, qy = B.y - w.ny * pan.base + ty * a
        for (let it = 0; it < 2; it++) { const o = fn(qx, qy); qx -= o.nx * o.d; qy -= o.ny * o.d }
        const o = fn(qx, qy), j = i * 4
        SURF.v[j] = qx; SURF.v[j + 1] = qy; SURF.v[j + 2] = o.nx; SURF.v[j + 3] = o.ny
      }
    }
    const dotR = clamp(B.r * 0.034, 0.75, 1.75), tt = weniger ? 0 : t
    const buehne = B.mode === 'login' ? BUEHNE : null
    TEXT_SC = buehne ? Math.min(buehne.width / 340, buehne.height / 280, 1.15) : B.r / FORM_R
    const anzahl = kinderAktiv() ? ALLE : PUNKTE
    federSchritt(dt, tt, anzahl)
    const imDisplay = loginFrei() || B.intro.an, cp = [0, 0, 0]
    ctx.globalCompositeOperation = 'lighter'
    if (!hidden) for (let i = 0; i < anzahl; i++) {
      // unsichtbar (Kinder in ihren Eltern, ungenutzte Formpunkte): nichts zu zeichnen
      if (QZ[i] < 0.004 && TZ[i] <= 0) continue
      const p = B.pts[i]
      cp[0] = QX[i]; cp[1] = QY[i]; cp[2] = QZ[i]
      const th = Math.atan2(cp[1], cp[0]), rho = Math.hypot(cp[0], cp[1])
      const rf = ((th / TAU + 1) % 1) * RK, ri = rf | 0, rq = rf - ri, rj = (ri + 1) % RK, ra = ri % RK
      const ur = UR[ra] * (1 - rq) + UR[rj] * rq, s = B.shape === 'frame' ? 1 : 1 + ur
      let dx = cp[0] * r * s, dy = cp[1] * r * s
      if (pan && B.flat > 0.01) {
        const w = pan.w, tx = -w.ny, ty = w.nx, mid = (pan.lo + pan.hi) / 2, half = (pan.hi - pan.lo) / 2
        // Punkte nah der Mitte haben keine stabile Richtung: dort kein Wackel-Anteil (sonst zucken sie)
        const dev = clamp(ur - (SH[ra] * (1 - rq) + SH[rj] * rq), -0.5, 0.5) * Math.min(1, rho / 0.35)
        const u = cp[0] * tx + cp[1] * ty, vv = cp[0] * w.nx + cp[1] * w.ny
        const a = (mid + clamp(u, -1.25, 1.25) * half) * (1 + 0.25 * dev), qa = Math.min(1, Math.abs(a - mid) / half)
        const top = pan.T * Math.cbrt(1 - qa * qa * qa) * (1 + 0.14 * Math.sin((a / B.r) * 2.2 + t * 0.5 + PH[2]) + 0.07 * Math.sin((a / B.r) * 4.3 - t * 0.8 + PH[6])) * (1 + dev)
        const hg = (top * (clamp(vv, -1, 1) + 1)) / 2
        let px = -w.nx * pan.base + tx * a + w.nx * hg, py = -w.ny * pan.base + ty * a + w.ny * hg
        if (w.sdf) {
          const f = clamp((a - SURF.a0) / SURF.da, 0, 63), i0 = Math.min(62, f | 0), q2 = f - i0, S = SURF.v, j = i0 * 4
          const sxp = S[j] + (S[j + 4] - S[j]) * q2, syp = S[j + 1] + (S[j + 5] - S[j + 1]) * q2
          const snx = S[j + 2] + (S[j + 6] - S[j + 2]) * q2, sny = S[j + 3] + (S[j + 7] - S[j + 3]) * q2
          px = sxp + snx * hg - B.x; py = syp + sny * hg - B.y
        }
        dx += (px * pulse - dx) * B.flat; dy += (py * pulse - dy) * B.flat
      }
      const heal = B.flat > 0.99 ? 0 : (HEAL[ra] * (1 - rq) + HEAL[rj] * rq) * Math.min(1, rho) * 0.5 * (1 - B.flat)
      const dens = clamp(0.3 + 0.7 * s, 0.3, 1) * (1 - B.flat) + B.flat
      // auf dem Rahmen läuft die Farbe über das Display: oben links Cyan, Violett, unten Pink
      const c = B.shape === 'frame' && B.portal && B.portal.fe > 0.02
        ? dotColorInto((cx + cp[0] * r - W / 2) / (W / 2), ((cy + cp[1] * r - H / 2) / (H / 2)) * 1.1, cur.hue + hueShift, heal)
        : dotColorInto(cp[0], cp[1], cur.hue + hueShift, heal)
      if (ti > 0.01) {
        // Fehlerrot der App, unten rechts etwas rosiger (Orange: wärmer)
        const mm = clamp01((cp[0] - cp[1]) * 0.3 + 0.5)
        c[0] += (tc[0] - c[0]) * ti; c[1] += (tc[1] - (B.warm ? 30 : 20) * mm - c[1]) * ti; c[2] += (tc[2] + (B.warm ? 10 : 40) * mm - c[2]) * ti
      }
      const licht = LICHT[i]
      let alpha = clamp01(cp[2] * (bright + heal) * dens * licht)
      let X = cx + dx, Y = cy + dy, aMul = 1
      if (streaming) {
        const sx = ENT.x + (p.k - 0.5) * ENT.w * 0.8, sy = TAB + 2
        let qi = B.mode === 'exit' ? clamp01((B.te - 0.25 - p.k * 0.6) / 0.6) : 1 - clamp01((B.te - p.k * 0.6) / 0.55)
        if (qi <= 0.001) continue
        qi = B.mode === 'exit' ? easeOut3(qi) : 1 - easeOut3(1 - qi)
        const mx = (sx + X) / 2 + (p.s - Math.PI) * 5, my = Math.min(sy, Y) - 40 - p.k * 50
        const u1 = 1 - qi
        X = u1 * u1 * sx + 2 * u1 * qi * mx + qi * qi * X; Y = u1 * u1 * sy + 2 * u1 * qi * my + qi * qi * Y
        aMul = 0.6 + 0.4 * qi
      }
      if (swirling) {
        const ex = ENT.x, ey = TAB - 3, u = clamp01((B.te - 0.15 - p.k * 0.55) / 0.75)
        if (u >= 0.999) continue
        const vx0 = X - ex, vy0 = Y - ey, R0 = Math.hypot(vx0, vy0), A = Math.atan2(vy0, vx0) + easeIO(u) * Math.PI * 3.2
        const Rr = R0 * Math.pow(1 - u, 1.3)
        X = ex + Math.cos(A) * Rr; Y = ey + Math.sin(A) * Rr * 0.7 + u * u * 8
        aMul = 1 - 0.4 * u
      }
      if (scatter) {
        const u = away ? clamp01((B.te - p.k * 0.3) / 0.55) : 1 - clamp01((B.te - p.k * 0.35) / 0.6)
        if (u >= 0.999) continue
        const e = away ? u * u : u * u * (3 - 2 * u), d = (34 + 70 * p.k) * e
        X += (X - cx) * 0.9 * e + Math.cos(p.s) * d; Y += (Y - cy) * 0.9 * e + Math.sin(p.s) * d * 0.8 - 26 * e
        aMul = 1 - u
      }
      if (aMul !== 1) alpha = clamp01(alpha * aMul + (streaming ? 0.25 : 0))
      // schnelle Punkte werden etwas größer und ziehen einen Schweif
      const sp = (Math.abs(VX[i]) + Math.abs(VY[i])) * r
      const sz = dotR * (0.55 + 0.6 * cp[2]) * 3 * SZ[i] * (1 + Math.min(sp * 0.05, 0.6))
      if ((B.mode === 'home' || imDisplay) && CR > 0) { const oc = cornerSdf(X, Y); if (oc.d < 0) { X -= oc.nx * oc.d; Y -= oc.ny * oc.d } }
      // Auf der Anmeldung verlässt kein Punkt das Display
      if (imDisplay) { const lb = loginGrenzen(); X = clamp(X, lb.l, lb.r); Y = clamp(Y, lb.t, lb.b) }
      if (GL) {
        const o = nPts * 7
        GLD[o] = X; GLD[o + 1] = Y; GLD[o + 2] = sz; GLD[o + 3] = c[0] / 255; GLD[o + 4] = c[1] / 255; GLD[o + 5] = c[2] / 255; GLD[o + 6] = alpha
        nPts++
        if (sp > 1.4 && aMul === 1) {
          const o2 = nPts * 7
          GLD[o2] = X - VX[i] * r * 0.7; GLD[o2 + 1] = Y - VY[i] * r * 0.7; GLD[o2 + 2] = sz * 0.85
          GLD[o2 + 3] = GLD[o + 3]; GLD[o2 + 4] = GLD[o + 4]; GLD[o2 + 5] = GLD[o + 5]; GLD[o2 + 6] = alpha * 0.4
          nPts++
        }
      } else { ctx.globalAlpha = alpha; ctx.drawImage(sprite(c), X - sz / 2, Y - sz / 2, sz, sz) }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
    if (clipped) ctx.restore()
    if (GL) glDraw(nPts, clipped ? TAB : -1)

    ctx.globalCompositeOperation = 'lighter'
    for (const s of B.sparks) {
      s.t += dt; s.vy += 900 * dt; s.vx *= Math.exp(-dt * 2); s.x += s.vx * dt; s.y += s.vy * dt
      const q = s.t / s.life
      if (q >= 1 || s.y > TAB) { s.t = s.life; continue }
      ctx.fillStyle = `rgba(170,240,255,${(1 - q).toFixed(3)})`
      ctx.beginPath(); ctx.arc(s.x, s.y, dotR * 1.3 * (1 - q * 0.5), 0, TAU); ctx.fill()
    }
    // Ruf: ein Ring, wo getippt wurde
    for (const z of B.rufe) {
      z.t += dt
      const q = clamp01(z.t / 0.55); if (q >= 1) continue
      ctx.strokeStyle = `rgba(160,238,255,${(0.7 * (1 - q)).toFixed(3)})`; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(z.x, z.y, 6 + 26 * easeOut3(q), 0, TAU); ctx.stroke()
    }
    B.rufe = B.rufe.filter(z => z.t < 0.55)
    B.sparks = B.sparks.filter(s => s.t < s.life)
    for (const z of B.zz) {
      const q = z.t / 2.2, a = Math.sin(Math.PI * q) * 0.7
      for (let j = 0; j < 3; j++) {
        const qq = clamp01(q * 1.3 - j * 0.12); if (qq <= 0) continue
        ctx.fillStyle = `rgba(190,230,255,${(a * (0.5 + j * 0.25)).toFixed(3)})`
        ctx.beginPath(); ctx.arc(B.x + z.s * (B.r * 0.7 + qq * 26 + j * 6), B.y - B.r * 0.7 - qq * 34 - j * 7, 1 + j * 0.7, 0, TAU); ctx.fill()
      }
    }
    ctx.globalCompositeOperation = 'source-over'
    placeBubble()
    // Trefferfläche folgt dem Umriss: flach an der Wand nimmt er nur flach Fingertipps an
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (let i = 0; i < RK; i += 4) {
      const rr = B.r * (1 + UR[i]), px = B.x + DX[i] * rr, py = B.y + DY[i] * rr
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
    }
    const pad = 10
    // an der linken Wand nach innen großzügiger: dort greift man ihn neben der Randzone
    if (B.dock.x === 'left' && B.mode === 'home') x1 += 14
    hit.style.width = (x1 - x0 + 2 * pad).toFixed(1) + 'px'; hit.style.height = (y1 - y0 + 2 * pad).toFixed(1) + 'px'
    hit.style.borderRadius = Math.min(x1 - x0, y1 - y0) / 2 + pad + 'px'
    hit.style.transform = `translate(${(x0 - pad).toFixed(1)}px, ${(y0 - pad).toFixed(1)}px)`
  }

  /* ── Gesten ───────────────────────────────────────────────────────────── */
  const zeigeTreffer = () => { hit.hidden = false }
  const versteckeTreffer = () => { hit.hidden = true }
  let zeiger: number | null = null
  function dragTo(fx: number, fy: number) {
    const b = bounds(), r = B.r, nav = navOn()
    const lx = b.l + r, hx = b.r - r, ly = b.t + r, hy = b.b - r
    const wasAbove = B.y < TAB
    const x = fx < lx ? lx - gummi(lx - fx, r) : fx > hx ? hx + gummi(fx - hx, r) : fx
    const y = fy < ly ? ly - gummi(ly - fy, r) : fy > hy ? hy + gummi(fy - hy, r) : fy
    if (nav && wasAbove && atEntrance(x, r) && fy - (TAB - r) > r * 0.7) { endDrag(); B.vy = Math.max(B.vy, 400); goHome('suck'); return }
    // Die Leiste ist ein Körper: in kleinen Schritten von der alten zur neuen Lage
    let qx = B.x, qy = B.y
    for (let it = 0; it < 24; it++) {
      const ddx = x - qx, ddy = y - qy, L = Math.hypot(ddx, ddy); if (L < 0.4) break
      const allow = r * (0.2 + 0.8 * clamp01(1 - L / (1.2 * r)))
      const st = Math.min(2.5, L); qx += (ddx / L) * st; qy += (ddy / L) * st
      if (nav) { const o = obstacle(qx, qy); if (o.d < allow) { qx += o.nx * (allow - o.d); qy += o.ny * (allow - o.d) } }
      qx = clamp(qx, b.l + r * 0.2, b.r - r * 0.2); qy = clamp(qy, b.t + r * 0.2, b.b - r * 0.2)
      if (nav) { const o2 = obstacle(qx, qy); if (o2.d < r * 0.2) { qx += o2.nx * (r * 0.2 - o2.d); qy += o2.ny * (r * 0.2 - o2.d) } }
      if (CR > 0) { const oc = cornerSdf(qx, qy); if (oc.d < r * 0.2) { qx += oc.nx * (r * 0.2 - oc.d); qy += oc.ny * (r * 0.2 - oc.d) } }
      if (INSEL) { const oi = inselSdf(qx, qy); if (oi.d < r * 0.2) { qx += oi.nx * (r * 0.2 - oi.d); qy += oi.ny * (r * 0.2 - oi.d) } }
    }
    B.x = qx; B.y = qy
  }
  function endDrag() {
    if (zeiger !== null) { try { hit.releasePointerCapture(zeiger) } catch { /* schon frei */ } }
    zeiger = null; B.drag = null
    // Der nachhängende Teil schnellt nach: ein kleiner Stoß zum Zug, dann federt der Rand aus
    if (!weniger) for (let k = 0; k < RK; k++) WV[k] -= PULL[k] * 3
  }
  const beiAb = (e: PointerEvent) => {
    if ((B.mode !== 'home' && B.mode !== 'login') || zeiger !== null) return
    e.preventDefault()
    try { hit.setPointerCapture(e.pointerId) } catch { /* ohne Fang */ }
    zeiger = e.pointerId
    const now = performance.now()
    B.drag = { rand: e.pointerType !== 'mouse' && e.clientX <= RAND_ZURUECK, ox: e.clientX - B.x, oy: e.clientY - B.y, sx: e.clientX, sy: e.clientY, t0: now, moved: 0, hist: [{ x: B.x, y: B.y, t: now }], trail: [{ x: e.clientX, y: e.clientY, t: now }], rev: [], sx0: 0 }
    B.vx = 0; B.vy = 0; B.poke = 0; wake(false); laufen()
  }
  const beiBewegung = (e: PointerEvent) => {
    const D = B.drag
    if (!D || e.pointerId !== zeiger) return
    const now = performance.now()
    D.moved = Math.max(D.moved, Math.hypot(e.clientX - D.sx, e.clientY - D.sy))
    // Am linken Rand begonnen: nach rechts gewischt ist das „Zurück" der App, Dot
    // lässt los. Nach oben/unten gezogen oder kurz gehalten gehört der Finger Dot.
    if (D.rand) {
      const dx = e.clientX - D.sx, dy = Math.abs(e.clientY - D.sy)
      if (dx > 10 && dx > dy * 1.25) { endDrag(); return }
      if (dy > 10 || now - D.t0 > 220) D.rand = false
      else return
    }
    if (D.moved < 4) return
    if (B.mode === 'login') {
      // Wer ihn greift, beendet eine gezeigte Form
      if (B.form || B.text) setState(B.state)
      loginZiehen(e.clientX - D.ox, e.clientY - D.oy)
    } else dragTo(e.clientX - D.ox, e.clientY - D.oy)
    if (!B.drag) return
    // Richtungswechsel: schnell auf kleinem Raum = Kitzeln, weit und wild = Schütteln
    const tr = D.trail, lastP = tr[tr.length - 1], ddx = e.clientX - lastP.x
    tr.push({ x: e.clientX, y: e.clientY, t: now })
    while (tr.length && now - tr[0].t > 1100) tr.shift()
    if (Math.abs(ddx) > 3) { const sg = Math.sign(ddx); if (D.sx0 && sg !== D.sx0) D.rev.push(now); D.sx0 = sg }
    D.rev = D.rev.filter(tt => now - tt < 1000)
    const xs = tr.map(q => q.x), ys = tr.map(q => q.y)
    const rx = Math.max(...xs) - Math.min(...xs), ry = Math.max(...ys) - Math.min(...ys)
    if (D.rev.length >= 4 && rx < 80 && ry < 80 && B.gcool === 0 && B.giggleT < 0) giggle()
    if (D.rev.length >= 4 && Math.max(rx, ry) > 130) D.dizzy = true
    D.hist.push({ x: B.x, y: B.y, t: now })
    while (D.hist.length > 6) D.hist.shift()
    const h0 = D.hist[0], dtv = Math.max(8, now - h0.t) / 1000
    B.vx = (B.x - h0.x) / dtv; B.vy = (B.y - h0.y) / dtv
  }
  const beiAuf = (e: PointerEvent) => {
    if (e.pointerId !== zeiger) return
    // Was Dot gehört, löst kein Zurück-Wischen aus (die App hört auf window)
    e.stopPropagation()
    const D = B.drag
    endDrag()
    if (!D) return
    const now = performance.now()
    if (D.moved < 8 && now - D.t0 < 350) {
      if (B.mode === 'login') { B.poke = 0; return }
      if (B.thin > 0.5) fetchDot(); else host.beiAntippen(); return
    }
    const last = D.hist[D.hist.length - 1], stale = now - last.t > 90
    if (B.mode === 'login') {
      const vx = stale ? 0 : B.vx, vy = stale ? 0 : B.vy, sp = Math.hypot(vx, vy), k = sp > LOGIN.maxWurf ? LOGIN.maxWurf / sp : 1
      B.vx = vx * k; B.vy = vy * k; B.login.phase = 'frei'; B.login.still = 0
      return
    }
    release(stale ? 0 : B.vx, stale ? 0 : B.vy)
    if (D.dizzy && B.mode === 'home') startDizzy()
  }
  const beiAbbruch = (e: PointerEvent) => {
    if (e.pointerId !== zeiger) return
    const D = B.drag; endDrag()
    if (D && B.mode === 'login') { B.login.phase = 'zurueck'; return }
    if (D) release(0, 0)
  }
  const beiTaste = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (B.thin > 0.5) fetchDot(); else host.beiAntippen()
  }
  hit.addEventListener('pointerdown', beiAb)
  hit.addEventListener('pointermove', beiBewegung)
  hit.addEventListener('pointerup', beiAuf)
  hit.addEventListener('pointercancel', beiAbbruch)
  hit.addEventListener('keydown', beiTaste)
  /* ── Rufen: dreimal schnell auf dieselbe Stelle ────────────────────────── */
  let tipps: { x: number; y: number; t: number }[] = [], tippAb: { id: number; x: number; y: number; t: number } | null = null
  const rufAb = (e: PointerEvent) => {
    tippAb = e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null
  }
  const rufAuf = (e: PointerEvent) => {
    const a = tippAb; tippAb = null
    if (!a || a.id !== e.pointerId) return
    const now = performance.now()
    if (now - a.t > RUF.tippMs || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 10) { tipps = []; return }
    const last = tipps[tipps.length - 1]
    if (last && (now - last.t > RUF.abstandMs || Math.hypot(a.x - tipps[0].x, a.y - tipps[0].y) > RUF.px)) tipps = []
    tipps.push({ x: a.x, y: a.y, t: now })
    if (tipps.length < 3) return
    const p = tipps[0]; tipps = []
    rufen(p.x, p.y)
  }
  function rufen(x: number, y: number) {
    if (B.mode !== 'home' || B.drag || NAV.cam || B.recedeT > 0) return
    if (navOn() && y > TAB - 4) return
    // Dreifachtippen markiert unter iOS sonst einen Absatz
    try { window.getSelection()?.removeAllRanges() } catch { /* ohne Auswahl */ }
    const b = bounds(), r = B.size, floor = navOn() ? TAB : b.b
    B.herkunft = { x: B.x, y: B.y, t: performance.now() }
    B.dock = { x: null, y: null }; B.along = { x: clamp(x, b.l + r, b.r - r), y: clamp(y, b.t + r, floor - r) }
    B.squeezed = false; B.thinT = 0; B.idleT = 0; speichern()
    B.rufe.push({ x, y, t: 0 })
    wake(true); laufen()
  }
  window.addEventListener('pointerdown', rufAb, { capture: true, passive: true })
  window.addEventListener('pointerup', rufAuf, { capture: true, passive: true })
  function fetchDot() {
    B.thinT = 0; B.idleT = 0; wake(true)
    if (!weniger) for (let k = 0; k < RK; k++) WV[k] += (Math.random() - 0.5) * 3
    sag(texte.daBin(), 2200)
  }

  /* ── Navigation ───────────────────────────────────────────────────────── */
  function toStrip() {
    const side: DockX = B.dock.x || (B.x < W / 2 ? 'left' : 'right')
    B.dock = { x: side, y: null }
    B.along = { x: B.x, y: clamp(B.mode === 'house' ? H * 0.5 : B.y, H * 0.3, H * 0.6) }
    B.squeezed = false; B.thinT = 1; B.displaced = true
  }
  function zonen(): Flaeche[] {
    const z: Flaeche[] = []
    document.querySelectorAll<HTMLElement>('[data-dot-avoid]').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width && r.height && r.bottom > 0 && r.top < H) z.push({ l: r.left - 8, r: r.right + 8, t: r.top - 8, b: r.bottom + 8 })
    })
    return z
  }
  function spotFor(d: { x: DockX; y: DockY }, a: { x: number; y: number }) {
    const keep = { dock: B.dock, along: B.along }
    B.dock = d; B.along = a
    const T = homeTarget(), dy = dockY()
    B.dock = keep.dock; B.along = keep.along
    const r = B.size, hx = d.x && !dy ? r * 0.9 : r * 1.75, hy = dy && !d.x ? r * 0.9 : r * 1.75
    return { x: T.x, y: T.y, l: T.x - hx, r: T.x + hx, t: T.y - hy, b: T.y + hy }
  }
  function ausweichen() {
    if (B.mode !== 'home' || B.drag) return
    const Z = zonen(), cur = spotFor(B.dock, B.along)
    if (!ueberlappt(cur, Z)) return
    const b = bounds(), r = B.size, dy = dockY(), c: { dock: { x: DockX; y: DockY }; along: { x: number; y: number } }[] = []
    if (B.dock.x || !dy) for (let y = b.t + r; y <= b.b - r; y += 6) c.push({ dock: { x: B.dock.x, y: null }, along: { x: cur.x, y } })
    if (dy) for (let x = b.l + r; x <= b.r - r; x += 6) c.push({ dock: { x: null, y: B.dock.y }, along: { x, y: cur.y } })
    let best: (typeof c)[number] | null = null, bd = Infinity
    for (const k of c) {
      const s = spotFor(k.dock, k.along)
      if (ueberlappt(s, Z)) continue
      const d = Math.hypot(s.x - cur.x, s.y - cur.y)
      if (d < bd) { bd = d; best = k }
    }
    if (best) { B.dock = best.dock; B.along = best.along; B.displaced = true }
  }
  let syncT = 0, ausweichT = 0, heimT = 0, grussT = 0
  function sync() {
    window.clearTimeout(syncT)
    if (B.mode === 'portal') return
    if (B.mode === 'exit' || B.mode === 'enter' || B.mode === 'orbit' || B.mode === 'gather' || (B.mode === 'away' && B.te < 0.95)) {
      syncT = window.setTimeout(sync, 150); return
    }
    if (NAV.cam) {
      if (B.mode === 'home') { B.mode = 'away'; B.te = 0; versteckeTreffer(); versteckeBlase(); melde(); laufen() }
      return
    }
    if (B.mode === 'away') { B.mode = 'gather'; B.te = 0; laufen(); syncT = window.setTimeout(sync, 1050); return }
    vermessen()
    if (!navOn()) {
      // Seite ohne Leiste: ist er zu Hause (und darf heraus), kommt er beim Hineinnavigieren
      // heraus — dort, wo die Leiste war, vom unteren Rand — und legt sich als Streifen an den Rand
      if (B.mode === 'house' && NAV.darfRaus) {
        // Ein Rundflug ist angekündigt: er kommt mit ihm vom Rand, nicht hier von unten
        const warte = B.tourBald - performance.now()
        if (warte > 0) { syncT = window.setTimeout(sync, warte + 50); return }
        toStrip(); B.autoOut = true
        ring(pickKind(['pop', 'stream', 'climb'], B.lastExit))
        return
      }
      if (B.mode === 'home' && !B.displaced) toStrip()
      return
    }
    if (B.mode !== 'home') return
    B.thinT = 0
    if (B.displaced && B.pref && !B.squeezed) { B.dock = { ...B.pref.dock }; B.along = { ...B.pref.along }; B.displaced = false }
    if (B.autoOut) {
      B.autoOut = false
      heimT = window.setTimeout(() => { if (navOn() && B.mode === 'home' && !B.drag) goHome() }, 420)
      return
    }
    window.clearTimeout(ausweichT)
    ausweichT = window.setTimeout(ausweichen, 360)
  }

  /* ── Schleife ─────────────────────────────────────────────────────────── */
  let raf = 0, last = 0, laeuft = false, zerstoert = false
  function laufen() {
    if (laeuft || zerstoert || document.hidden) return
    laeuft = true; last = performance.now()
    raf = requestAnimationFrame(schritt)
  }
  function schritt(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    messeBuehne()
    physics(dt, now / 1000)
    render(now / 1000, dt)
    // Drinnen und Tür zu: nichts mehr zu tun, bis jemand klingelt
    if (B.mode === 'house' && B.door < 0.005 && !B.sparks.length) {
      laeuft = false
      ctx.clearRect(0, 0, W, H)
      if (GL) glDraw(0, -1)
      drawBeam(now / 1000)
      return
    }
    raf = requestAnimationFrame(schritt)
  }
  const beiSicht = () => {
    if (document.hidden) { cancelAnimationFrame(raf); laeuft = false } else laufen()
  }
  document.addEventListener('visibilitychange', beiSicht)
  const beiGroesse = () => { vermessen(); laufen() }
  window.addEventListener('resize', beiGroesse)

  /* ── Start ────────────────────────────────────────────────────────────── */
  vermessen()
  B.x = ENT.x; B.y = TAB + B.size * 1.2; B.r = B.size
  versteckeTreffer()
  melde()

  return {
    modus: () => B.mode,
    klingeln: (art?: string) => {
      wake(true)
      if (NAV.cam) return false
      return ring(art)
    },
    heimgehen: (art?: string) => goHome(art),
    logoTipp: (darfRaus: boolean) => {
      NAV.darfRaus = darfRaus
      if (B.mode === 'house') return darfRaus ? (ring() ? 'raus' : 'nichts') : 'gesperrt'
      if (B.mode === 'home') { wake(true); goHome(); return 'rein' }
      return 'nichts'
    },
    setSeite: ({ leiste: mitLeiste, kamera, darfRaus, richtung = 0 }) => {
      const kameraVorher = NAV.cam
      NAV.darfRaus = darfRaus; NAV.cam = kamera; NAV.on = mitLeiste
      // Er bleibt stehen, die Seite wechselt unter ihm: nur die Trägheit lässt ihn nachwabbeln
      if (B.mode === 'home' && !weniger && kameraVorher === kamera && richtung) { B.kx = -Math.sign(richtung) * 5200; B.vx -= Math.sign(richtung) * 70; wake(true) }
      if (!darfRaus && B.mode !== 'house' && B.mode !== 'enter' && B.mode !== 'portal') {
        // Zugang weg (z. B. Abo beendet): zurück ins Haus, ohne Theater
        B.mode = 'house'; versteckeTreffer(); versteckeBlase(); merkeDraussen(false); melde()
      }
      laufen()
      window.setTimeout(sync, 0)
    },
    setZurueck: an => { B.recedeT = an ? 1 : 0; hit.style.pointerEvents = an ? 'none' : ''; if (B.mode !== 'house') laufen() },
    setTastatur: px => { NAV.kbT = px > 80 ? px : 0; if (B.mode !== 'house') laufen() },
    oeffneBuehne: el => {
      B.stage = el; messeBuehne()
      if (B.mode !== 'home') return
      B.mode = 'stage'; versteckeTreffer(); versteckeBlase(); wake(true); melde(); laufen()
    },
    schliesseBuehne: () => {
      B.stage = null
      if (B.mode !== 'stage') return
      B.mode = 'home'; B.contact = {}; zeigeTreffer(); setState('idle'); arbeitet = false; melde(); laufen()
    },
    setStimmung: s => { arbeitet = s === 'think' || s === 'speak'; if (B.state !== s || B.form) setState(s); laufen() },
    zeigeForm: f => { if (B.form !== f) setForm(f); laufen() },
    zeigeText: text => { if (B.text !== text) setText(text); laufen() },
    bereiteTexte: async liste => { await ladeSchrift(); for (const t of liste) textForm(t, ALLE, TEXT.dichte) },
    eroeffnung: () => { const d = eroeffnung(); laufen(); return d },
    loginBuehne: el => loginBetreten(el),
    verlasseLogin: () => loginVerlassen(),
    setNeigung: px => { B.login.neigung = px },
    erfolg: () => erfolg(),
    stimme: v => { B.voice = Math.min(1, B.voice + v) },
    sag: (text, ms) => { sag(text, ms); laufen() },
    lage: () => ({ x: B.x, y: B.y }),
    platz: () => homeTarget(),
    rundflug: r => startTour(r),
    rundflugKommt: ms => { B.tourBald = performance.now() + ms },
    rundflugAbkuerzen: sek => { const T = B.tour; if (T && !T.ab) T.ab = { t0: B.te, x: B.x, y: B.y, d: Math.max(0.05, sek) } },
    neuVermessen: () => { vermessen(); laufen() },
    zerstoeren: () => {
      zerstoert = true
      { const el = portalFlaeche(); if (el && B.portal) el.style.clipPath = '' }
      cancelAnimationFrame(raf); laeuft = false
      for (const t of [syncT, ausweichT, heimT, grussT, blasenTimer]) window.clearTimeout(t)
      document.removeEventListener('visibilitychange', beiSicht)
      window.removeEventListener('resize', beiGroesse)
      hit.removeEventListener('pointerdown', beiAb)
      hit.removeEventListener('pointermove', beiBewegung)
      hit.removeEventListener('pointerup', beiAuf)
      hit.removeEventListener('pointercancel', beiAbbruch)
      hit.removeEventListener('keydown', beiTaste)
      window.removeEventListener('pointerdown', rufAb, true)
      window.removeEventListener('pointerup', rufAuf, true)
      glCanvas.removeEventListener('webglcontextlost', kontextWeg)
      sonde.remove()
    },
  }
}

/** War Dot beim letzten Mal draußen? Dann kommt er beim Start wieder heraus. */
export function warDraussen() {
  try { return localStorage.getItem(DRAUSSEN) === '1' } catch { return false }
}
