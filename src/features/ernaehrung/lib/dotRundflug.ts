/**
 * Dots Rundflug im Kalorientracker: Er kommt vom linken Rand, hält an der Kugel und an jedem
 * Mond (von links nach rechts), sagt je Halt, was dort offen ist, und fliegt an seinen Platz;
 * dort sagt er alles zusammen. Wieder nach zwei Stunden — oder beim dritten Öffnen seit dem letzten Mal.
 *
 * Hier nur Rechnung (Bahn, Texte, Abstand); die Seite verbindet sie mit Dot und der Kugel
 * (`hooks/useDotRundflug.ts`). Entschieden am Live-Mockup, Variante B (Nutzer 29.10.2026).
 */
import type { Rundflug } from '../../dot/engine/dotEngine'
import type { DotTextKey } from '../../dot/texte'
import type { MacroKey } from './orb'
import type { Goals, Nutrients } from './nutrition'

export interface Punkt { x: number; y: number }
export interface Koerper extends Punkt { r: number }
export interface Lage { main: Koerper; moons: Partial<Record<MacroKey, Koerper>> }

/** Zeiten in Sekunden: herein, je Weg zum nächsten Halt, je Halt, an den Platz. */
export const RF_ZEIT = { herein: 0.85, weg: 0.6, halt: 1.05, heim: 0.85 }
/** Nach so langer Zeit fliegt er wieder (Nutzer: „im Abstand von 2 h“) … */
export const RF_ABSTAND_MS = 2 * 60 * 60 * 1000
/** … und zusätzlich bei jedem dritten Hineinnavigieren seit dem letzten Rundflug (Nutzer 30.10.2026). */
export const RF_JEDES = 3
const SPEICHER = 'tyd.dot.rundflug.v1'

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut3 = (t: number) => 1 - (1 - t) ** 3

/** Gespeichert: wann zuletzt geflogen, wie oft seitdem hineinnavigiert (früher nur die Zeit als Zahl). */
function lies(): { t: number; n: number } | null {
  const roh = localStorage.getItem(SPEICHER)
  if (!roh) return null
  const alt = Number(roh)
  if (Number.isFinite(alt)) return { t: alt, n: 0 }
  const v = JSON.parse(roh) as { t?: unknown; n?: unknown }
  return { t: Number(v.t) || 0, n: Number(v.n) || 0 }
}

/** Ist ein Rundflug fällig? Ohne Speicher (privates Fenster) ja. */
export function rundflugFaellig(jetzt: number): boolean {
  try {
    const s = lies()
    return !s || s.t <= 0 || jetzt - s.t >= RF_ABSTAND_MS || s.t > jetzt || s.n >= RF_JEDES
  } catch {
    return true
  }
}

/** Einmal je Hineinnavigieren in den Kalorientracker (heute). */
export function zaehleBesuch() {
  try {
    const s = lies()
    if (s) localStorage.setItem(SPEICHER, JSON.stringify({ t: s.t, n: s.n + 1 }))
  } catch { /* kein Speicher */ }
}

export function merkeRundflug(jetzt: number) {
  try { localStorage.setItem(SPEICHER, JSON.stringify({ t: jetzt, n: 0 })) } catch { /* kein Speicher */ }
}

/**
 * Wo er an Halt `i` steht: 0 = links vorn an der Kugel; danach außen neben dem Mond,
 * auf der Linie von der Kugelmitte durch den Mond (so verdeckt er ihn nicht).
 */
export function haltPunkt(i: number, lage: Lage, order: MacroKey[], rand: { l: number; r: number }): Punkt {
  const { main } = lage
  const mo = i > 0 ? lage.moons[order[i - 1]] : undefined
  if (!mo) return { x: main.x - main.r * 1.08, y: main.y + main.r * 0.42 }
  const dx = mo.x - main.x, dy = mo.y - main.y, d = Math.hypot(dx, dy) || 1
  const a = mo.r + 38, x = mo.x + (dx / d) * a
  const innen = (v: number) => Math.min(rand.r - 44, Math.max(rand.l + 44, v))
  if (Math.abs(innen(x) - x) < 1) return { x, y: mo.y + (dy / d) * a + 12 }
  // Außen ist kein Platz (Mond nah am Rand): unter den Mond
  return { x: innen(mo.x), y: mo.y + mo.r + 34 }
}

type Abschnitt = { t0: number; t1: number; art: 'herein' | 'weg' | 'halt' | 'heim'; i: number }

/** Ablauf: herein, Halt 0, (Weg, Halt) je Mond, an den Platz. */
export function rundflugPlan(monde: number): { abschnitte: Abschnitt[]; dauer: number } {
  const abschnitte: Abschnitt[] = []
  let t = 0
  const add = (art: Abschnitt['art'], d: number, i: number) => { abschnitte.push({ t0: t, t1: t + d, art, i }); t += d }
  add('herein', RF_ZEIT.herein, 0)
  for (let i = 0; i <= monde; i++) {
    if (i > 0) add('weg', RF_ZEIT.weg, i)
    add('halt', RF_ZEIT.halt, i)
  }
  add('heim', RF_ZEIT.heim, monde)
  return { abschnitte, dauer: t }
}

/**
 * Die Bahn. `lage()` liefert die Kugel live (die Monde kreisen weiter); fehlt sie (Seite weg),
 * gilt die letzte. `beiHalt(i)` kommt einmal je Halt, wenn er dort ankommt.
 */
export function rundflugBahn(o: {
  start: Punkt
  lage: () => Lage | null
  platz: () => Punkt
  rand: { l: number; r: number }
  order: MacroKey[]
  beiHalt: (i: number) => void
  fertig?: () => void
  abgebrochen?: () => void
}): Rundflug {
  const { abschnitte, dauer } = rundflugPlan(o.order.length)
  // Einmal je Bild gemessen (die Kugel liest dafür ihr Layout); fehlt sie, gilt die letzte Lage
  let letzte: Lage | null = null
  const gesagt = new Set<number>()
  const halt = (i: number) => (letzte ? haltPunkt(i, letzte, o.order, o.rand) : o.start)
  return {
    dauer,
    fertig: o.fertig,
    abgebrochen: o.abgebrochen,
    pos: t => {
      letzte = o.lage() ?? letzte
      const s = abschnitte.find(a => t <= a.t1) ?? abschnitte[abschnitte.length - 1]
      const q = clamp01((t - s.t0) / (s.t1 - s.t0))
      let p: Punkt
      if (s.art === 'herein') {
        // vom Rand im flachen Bogen an die Kugel
        const h = halt(0), e = easeOut3(q)
        p = { x: o.start.x + (h.x - o.start.x) * e, y: o.start.y + (h.y - o.start.y) * e - Math.sin(Math.PI * q) * 26 }
      } else if (s.art === 'weg') {
        // zum nächsten Mond, leicht gebogen
        const a = halt(s.i - 1), b = halt(s.i), e = easeIO(q)
        const nx = -(b.y - a.y), ny = b.x - a.x, nd = Math.hypot(nx, ny) || 1, bogen = Math.sin(Math.PI * q) * 34
        p = { x: a.x + (b.x - a.x) * e + (nx / nd) * bogen, y: a.y + (b.y - a.y) * e + (ny / nd) * bogen }
      } else if (s.art === 'halt') {
        const h = halt(s.i)
        p = { x: h.x, y: h.y + Math.sin(q * Math.PI * 2) * 2.5 }
        if (!gesagt.has(s.i)) { gesagt.add(s.i); o.beiHalt(s.i) }
      } else {
        const a = halt(s.i), h = o.platz(), e = easeIO(q)
        p = { x: a.x + (h.x - a.x) * e, y: a.y + (h.y - a.y) * e + Math.sin(Math.PI * q) * 30 }
      }
      return { ...p, depth: 1 }
    },
  }
}

type Uebersetze = (key: DotTextKey, vars?: Record<string, string | number>) => string

/**
 * Was er sagt: je Halt ein Satz (Kugel, dann je Mond) und alles zusammen. Ohne Kalorien
 * (ausgeblendet) ist die Kugel Eiweiß, die Monde Kohlenhydrate und Fett — wie die Kugel selbst.
 */
export function rundflugTexte(total: Pick<Nutrients, 'kcal' | 'protein' | 'carbs' | 'fat'>, goals: Goals, dt: Uebersetze) {
  const ziel = { protein: goals.proteinG, carbs: goals.carbsG, fat: goals.fatG }
  const name = (k: MacroKey) => dt(k === 'protein' ? 'rf_protein' : k === 'carbs' ? 'rf_carbs' : 'rf_fat')
  const offenG = (k: MacroKey) => ziel[k] > 0 && ziel[k] - total[k] > ziel[k] * 0.05
  const makro = (k: MacroKey) => {
    const rest = ziel[k] - total[k]
    if (offenG(k)) return dt('rf_makro_rest', { name: name(k), g: Math.round(rest) })
    if (ziel[k] <= 0 || total[k] <= ziel[k] * 1.15) return dt('rf_makro_ok', { name: name(k) })
    return dt('rf_makro_drueber', { name: name(k), g: Math.round(-rest) })
  }
  const restK = goals.kcal - total.kcal
  const kcalOffen = !goals.hideKcal && restK > 50
  const kugel = goals.hideKcal ? makro('protein')
    : total.kcal <= 0 ? dt('rf_kcal_alle', { kcal: Math.round(goals.kcal) })
    : restK > 50 ? dt('rf_kcal_rest', { kcal: Math.round(restK) })
    : restK >= -50 ? dt('rf_kcal_ziel')
    : dt('rf_kcal_drueber', { kcal: Math.round(-restK) })
  const keys: MacroKey[] = goals.hideKcal ? ['carbs', 'fat'] : ['protein', 'carbs', 'fat']
  const posten = [
    ...(kcalOffen ? [dt('rf_posten_kcal', { kcal: Math.round(restK) })] : []),
    ...(goals.hideKcal ? (['protein', 'carbs', 'fat'] as MacroKey[]) : keys)
      .filter(offenG).map(k => dt('rf_posten_g', { g: Math.round(ziel[k] - total[k]), name: name(k) })),
  ]
  const nichts = total.kcal <= 0 && total.protein <= 0 && total.carbs <= 0 && total.fat <= 0
  const mehr = !goals.hideKcal && restK < -50
  const summe = nichts ? dt('rf_alles_offen')
    : posten.length ? dt('rf_summe', { liste: posten.join(' · ') })
    : mehr ? dt('rf_mehr')
    : dt('rf_fertig')
  // Freude nur bei „Alles erledigt“ — über dem Ziel bleibt er neutral
  return { kugel, makro, summe, erledigt: !nichts && !posten.length && !mehr }
}
