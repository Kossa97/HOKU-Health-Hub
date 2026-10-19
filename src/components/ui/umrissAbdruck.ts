// Der Umriss einer Seite, abgenommen von der Seite selbst.
//
// Hat eine Seite fertig geladen, wird ihr sichtbarer Teil vermessen: Karten,
// Knöpfe, Bilder, Textzeilen — nur Kästen, kein Inhalt. Beim nächsten Laden
// zeichnet die Silhouette genau diese Kästen (Silhouette.tsx). So folgt der
// Umriss jeder Änderung von selbst: einer neuen Karte im Code ebenso wie dem
// eigenen Stack. Die handgezeichneten Umrisse gelten nur, solange es auf
// diesem Gerät noch keinen Abdruck gibt.
//
// Eine Seite kann mitreden, muss aber nicht:
// - `data-umriss-form="pen"` auf einem Element: dort steht der Umriss dieser
//   Bühnenform statt eines Kastens (FORM_UMRISSE).
// - `data-umriss-aus` auf einem Element: es und alles darin bleiben draußen.
// - `data-umriss-nicht-merken` irgendwo auf der Seite (etwa an einer
//   Fehlermeldung): dieser Stand wird nicht gemerkt, der vorige bleibt.
import { useEffect, type RefObject } from 'react'
import { FORM_UMRISSE, type BuehnenForm } from '../../features/my-stack/stage/formUmrisse'

/** Fläche (Karte), fester Platzhalter (Knopf, Chip, Bild), Textzeile, Bühnenform. */
export type KastenArt = 'k' | 'p' | 't' | 'f'
/** x, y, Breite, Höhe, Eckradius, Art, Form (nur bei 'f') */
export type Kasten = [number, number, number, number, number, KastenArt, BuehnenForm?]

export interface Abdruck {
  v: 1
  /** Fensterbreite beim Abnehmen — passt sie nicht mehr, gilt der Abdruck nicht. */
  breite: number
  /** Breite des Inhalts darin; auf sie bezieht sich das Strecken. */
  inhalt: number
  kaesten: Kasten[]
  /** Wann abgenommen — die ältesten fallen weg, wenn es zu viele werden. */
  zeit?: number
}

const PRAEFIX = 'tyd_umriss:'
const MAX_KAESTEN = 240
// Seiten mit eigenem Namen im Pfad (ein Eintrag der Peptipedia) brächten
// sonst je Eintrag einen Abdruck mit
const MAX_SEITEN = 30
// Bis zu dieser Größe sind Grafiken Symbole; sie gehören zum Knopf oder Kreis, in dem sie sitzen.
const SYMBOL = 40
// Bis zu dieser Höhe ist eine Fläche ein Knopf, Chip oder Feld — ein Platzhalter
// in einem Stück. Darüber eine Karte, in der weitere Formen liegen.
const KOMPAKT = 56

/** Ein Abdruck je Seite; Kennungen in Pfaden zählen nicht (eine Studie wie die andere). */
export function abdruckSchluessel(pfad: string): string {
  const p = pfad.replace(/\/+$/, '') || '/'
  return p.split('/').map(teil => (/^[0-9a-f-]{16,}$/i.test(teil) || /^\d+$/.test(teil) ? ':id' : teil)).join('/')
}

const sichtbareFarbe = (farbe: string) => {
  const m = farbe.match(/rgba?\(([^)]+)\)/)
  if (!m) return farbe !== 'transparent' && farbe !== ''
  const teile = m[1].split(/[\s,/]+/).filter(Boolean)
  return teile.length < 4 || parseFloat(teile[3]) > 0.02
}

const radius = (stil: CSSStyleDeclaration, h: number) =>
  Math.min(Math.round(parseFloat(stil.borderTopLeftRadius) || 0), Math.round(h / 2))

type Rechteck = { l: number; t: number; r: number; b: number }

const schneide = (a: Rechteck, b: Rechteck): Rechteck =>
  ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) })

/** Die Inhaltskante von <main>: von hier aus zählen alle Koordinaten eines Abdrucks. */
export function inhaltsUrsprung(wurzel: Element): { x: number; y: number } {
  const stil = getComputedStyle(wurzel)
  const kante = wurzel.getBoundingClientRect()
  return { x: kante.left + (parseFloat(stil.paddingLeft) || 0), y: kante.top + (parseFloat(stil.paddingTop) || 0) }
}

/**
 * Was von einem Abdruck ab einer Stelle der Seite folgt, auf diese Stelle
 * bezogen — für die Silhouette eines Abschnitts, der mitten in der Seite lädt.
 */
export function abdruckAb(abdruck: Abdruck, dx: number, dy: number): Abdruck | null {
  const kaesten = abdruck.kaesten
    .filter(([, y]) => y >= dy - 2)
    .map(([x, y, ...rest]): Kasten => [x - dx, y - dy, ...rest])
  return kaesten.length ? { ...abdruck, kaesten } : null
}

/**
 * Vermisst den sichtbaren Teil von `wurzel` (dem Seitenbereich in <main>).
 * Koordinaten relativ zur Inhaltskante der Wurzel, wie bei einer Silhouette,
 * die an derselben Stelle steht.
 */
export function nimmAbdruck(wurzel: HTMLElement): Abdruck | null {
  const fenster = { w: window.innerWidth, h: window.innerHeight }
  const wurzelKante = wurzel.getBoundingClientRect()
  const ursprung = inhaltsUrsprung(wurzel)
  // Was beim Öffnen (ganz oben) im Bild steht — auch wenn schon gescrollt wurde.
  // Seiten mit eigener Scrollfläche: deren Versatz wird beim Abstieg addiert.
  const gescrollt = window.scrollY + wurzel.scrollTop
  // Koordinaten der Seite oben, im Fenster gemessen: Inhalt (y) plus Versatz
  const oben = ursprung.y + gescrollt
  const sichtHoehe = fenster.h - oben
  const kaesten: Kasten[] = []

  // Alle Rechtecke so, wie sie ungescrollt stünden: gemessen plus `versatz`,
  // die Summe der Scrollstände der Scrollflächen darüber.
  const ablegen = (q: Rechteck, clip: Rechteck, r: number, art: KastenArt, form?: BuehnenForm) => {
    const s = schneide(q, clip)
    const x = Math.round(s.l - ursprung.x)
    const y = Math.round(s.t - ursprung.y)
    const w = Math.round(s.r - s.l)
    const h = Math.round(s.b - s.t)
    if (w < 4 || h < 4 || y >= sichtHoehe || y + h <= -gescrollt) return
    kaesten.push(form ? [x, y, w, h, r, art, form] : [x, y, w, h, r, art])
  }

  const textZeilen = (el: Element, stil: CSSStyleDeclaration, clip: Rechteck, versatz: number) => {
    if (!sichtbareFarbe(stil.color)) return
    const schrift = parseFloat(stil.fontSize) || 14
    const balken = Math.max(6, Math.round(schrift * 0.7))
    const zeilen = new Map<number, Rechteck>()
    for (const knoten of Array.from(el.childNodes)) {
      if (knoten.nodeType !== Node.TEXT_NODE || !knoten.textContent?.trim()) continue
      const bereich = document.createRange()
      bereich.selectNodeContents(knoten)
      if (typeof bereich.getClientRects !== 'function') return
      for (const r of Array.from(bereich.getClientRects())) {
        if (r.width < 1) continue
        const mitte = Math.round((r.top + r.bottom) / 2 / 4)
        const z = zeilen.get(mitte)
        zeilen.set(mitte, z ? { l: Math.min(z.l, r.left), t: z.t, r: Math.max(z.r, r.right), b: z.b } : { l: r.left, t: r.top, r: r.right, b: r.bottom })
      }
    }
    for (const z of zeilen.values()) {
      const t = (z.t + z.b) / 2 - balken / 2
      ablegen({ l: z.l, t: t + versatz, r: z.r, b: t + versatz + balken }, clip, Math.round(balken / 2.6), 't')
    }
  }

  const besuche = (el: Element, clip: Rechteck, versatz: number) => {
    if (kaesten.length >= MAX_KAESTEN) return
    const stil = getComputedStyle(el)
    if (stil.display === 'none' || stil.visibility === 'hidden' || parseFloat(stil.opacity) === 0) return
    if (el !== wurzel && stil.position === 'fixed') return
    if (el.matches('[data-silhouette], [data-umriss-aus], .lg-skel')) return
    const q = el.getBoundingClientRect()
    const rq: Rechteck = { l: q.left, t: q.top + versatz, r: q.right, b: q.bottom + versatz }
    if (q.width === 0 && q.height === 0 && stil.display !== 'contents') return
    // Unterhalb des Sichtbaren muss nichts mehr vermessen werden
    if (rq.t - ursprung.y >= sichtHoehe) return

    const form = (el as HTMLElement).dataset?.umrissForm as BuehnenForm | undefined
    if (form && Object.hasOwn(FORM_UMRISSE, form)) return ablegen(rq, clip, 0, 'f', form)

    if (el instanceof SVGSVGElement || ['IMG', 'CANVAS', 'VIDEO', 'PICTURE'].includes(el.tagName)) {
      if (Math.max(q.width, q.height) > SYMBOL) ablegen(rq, clip, radius(stil, q.height), 'p')
      return
    }
    if (el instanceof SVGElement) return

    const flaeche = q.width >= 4 && q.height >= 4 && !stil.filter.includes('blur') && (
      sichtbareFarbe(stil.backgroundColor)
      || stil.backgroundImage !== 'none'
      || (stil.borderTopStyle !== 'none' && (parseFloat(stil.borderTopWidth) || 0) > 0 && sichtbareFarbe(stil.borderTopColor))
      || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
    )
    if (flaeche && q.height <= KOMPAKT) return ablegen(rq, clip, radius(stil, q.height), 'p')
    if (flaeche && q.width >= 12) ablegen(rq, clip, radius(stil, q.height), 'k')

    textZeilen(el, stil, clip, versatz)
    const kappt = stil.overflowX !== 'visible' || stil.overflowY !== 'visible'
    const innen = kappt ? schneide(clip, rq) : clip
    // Ihr Inhalt rückt beim Öffnen an den Anfang zurück
    const tiefer = el !== wurzel && kappt ? versatz + el.scrollTop : versatz
    for (const kind of Array.from(el.children)) besuche(kind, innen, tiefer)
  }

  besuche(wurzel, { l: 0, t: -Infinity, r: fenster.w, b: Infinity }, 0)
  // Die Wurzel selbst ist keine Karte
  const ohneWurzel = kaesten.filter(([x, y, w]) => !(x <= 0 && y <= 0 && w >= wurzelKante.width - 1))
  const inhalt = Math.round(wurzel.clientWidth - (ursprung.x - wurzelKante.left) - (parseFloat(getComputedStyle(wurzel).paddingRight) || 0))
  return ohneWurzel.length ? { v: 1, breite: fenster.w, inhalt, kaesten: ohneWurzel, zeit: Date.now() } : null
}

export function merkeAbdruck(pfad: string, abdruck: Abdruck): void {
  try {
    const schluessel = PRAEFIX + abdruckSchluessel(pfad)
    localStorage.setItem(schluessel, JSON.stringify(abdruck))
    const andere = Object.keys(localStorage).filter(k => k.startsWith(PRAEFIX) && k !== schluessel)
    if (andere.length < MAX_SEITEN) return
    const alter = (k: string) => { try { return (JSON.parse(localStorage.getItem(k) ?? '{}') as Abdruck).zeit ?? 0 } catch { return 0 } }
    andere.sort((a, b) => alter(a) - alter(b)).slice(0, andere.length - MAX_SEITEN + 1).forEach(k => localStorage.removeItem(k))
  } catch {
    // Voll oder gesperrt: dann bleibt der handgezeichnete Umriss
  }
}

/** Der Abdruck dieser Seite — nur, wenn er zur jetzigen Fensterbreite passt. */
export function leseAbdruck(pfad: string): Abdruck | null {
  try {
    const roh: unknown = JSON.parse(localStorage.getItem(PRAEFIX + abdruckSchluessel(pfad)) ?? 'null')
    if (!roh || typeof roh !== 'object') return null
    const { v, breite, inhalt, kaesten, zeit } = roh as Partial<Abdruck>
    if (v !== 1 || typeof breite !== 'number' || typeof inhalt !== 'number' || !Array.isArray(kaesten) || !kaesten.length) return null
    if (Math.abs(breite - window.innerWidth) > 24) return null
    const gueltig = kaesten.every(k => Array.isArray(k) && k.slice(0, 5).every(n => typeof n === 'number')
      && ['k', 'p', 't', 'f'].includes(k[5]) && (k[5] !== 'f' || Object.hasOwn(FORM_UMRISSE, k[6] ?? '')))
    return gueltig ? { v, breite, inhalt, kaesten, zeit } : null
  } catch {
    return null
  }
}

/** Beim Abmelden: wer danach an diesem Gerät sitzt, sieht keine fremden Umrisse. */
export function vergissAbdruecke(): void {
  try {
    for (const schluessel of Object.keys(localStorage)) {
      if (schluessel.startsWith(PRAEFIX)) localStorage.removeItem(schluessel)
    }
  } catch {
    // Nichts gemerkt, nichts zu vergessen
  }
}

// Ruhig ist eine Seite, wenn sich so lange nichts am Aufbau geändert hat.
const RUHE = 900
// Abgenommen wird nur in den ersten Sekunden, nachdem der letzte Lader
// verschwunden ist: so lange kommen noch Daten an. Danach ändert die Person
// selbst etwas (Reiter, Suche, Aufklappen), und das soll beim nächsten Öffnen
// nicht dastehen. Lädt es gar nicht fertig, ist nach einer halben Minute Schluss.
const FENSTER = 8000
const HOECHSTENS = 30000

/**
 * Nimmt den Abdruck der Seite in `wurzel`, sobald sie geladen hat, und nimmt
 * ihn neu, wenn danach noch etwas ankommt — es gilt der letzte ruhige Stand.
 * Nicht, solange eine Silhouette oder ein Lader darin steht.
 */
export function useAbdruckNehmen(wurzel: RefObject<HTMLElement | null>, pfad: string, aktiv = true) {
  useEffect(() => {
    const el = wurzel.current
    if (!aktiv || !el || typeof MutationObserver === 'undefined') return
    const beginn = performance.now()
    let geladenSeit: number | null = null
    let zeit: ReturnType<typeof setTimeout> | undefined
    // <main> bleibt beim Seitenwechsel dasselbe Element: was noch aussteht,
    // gehört zur alten Seite und darf die neue nicht unter altem Pfad ablegen
    let beendet = false
    const nehmen = () => {
      if (beendet || el.querySelector('[data-silhouette], [aria-busy="true"]')) return
      geladenSeit ??= performance.now()
      if (el.querySelector('[data-umriss-nicht-merken]')) return
      const abdruck = nimmAbdruck(el)
      if (abdruck) merkeAbdruck(pfad, abdruck)
    }
    const vorbei = () => {
      const jetzt = performance.now()
      return jetzt - beginn > HOECHSTENS || (geladenSeit !== null && jetzt - geladenSeit > FENSTER)
    }
    const planen = () => {
      if (vorbei()) return beobachter.disconnect()
      clearTimeout(zeit)
      zeit = setTimeout(() => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(nehmen, { timeout: 500 })
        else nehmen()
      }, RUHE)
    }
    const beobachter = new MutationObserver(planen)
    beobachter.observe(el, { childList: true, subtree: true, characterData: true })
    planen()
    return () => {
      beendet = true
      beobachter.disconnect()
      clearTimeout(zeit)
    }
  }, [wurzel, pfad, aktiv])
}
