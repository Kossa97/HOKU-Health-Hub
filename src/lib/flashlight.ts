/**
 * Taschenlampen-Kante (Erscheinungsbild „Schwarz").
 *
 * Ein Licht steht vor dem Bildschirm, als hielte man eine Taschenlampe auf
 * das Handy. Jede Glaskante glänzt dort, wo sie zum Licht zeigt: Karten unter
 * dem Licht oben, Karten darüber unten, direkt darunter rundum und leiser.
 * Beim Scrollen gleiten die Karten am festen Licht vorbei, der Glanz wandert
 * um die Kante. Mit Bewegungssensor wandert das Licht beim Kippen.
 *
 * Gerechnet wird nur für sichtbare Karten und nur, wenn sich etwas bewegt
 * hat (Scrollen, Größe, Kippen, neue Karten). Das Ergebnis steht als
 * CSS-Variablen an der Karte; gezeichnet wird in liquid-glass.css.
 */

export interface Rect { left: number; top: number; width: number; height: number }
export interface Point { x: number; y: number }
export interface EdgeLight {
  /** Richtung zum Licht, 0° = oben, im Uhrzeigersinn */
  angle: number
  /** Wie weit der Glanz um die Kante reicht (Grad) */
  spread: number
  /** Helligkeit des Glanzes, 0–1 */
  intensity: number
  /** Wo die Fläche einen Hauch Licht fängt, in Prozent der Karte */
  glow: Point
}

const KARTE = '.lg-surface, .card, .lg-group'
/** Ruhelage des Lichts: Mitte, etwas über der Bildschirmhälfte */
export const LIGHT_REST: Point = { x: 0.5, y: 0.42 }
const TILT_KEY = 'tyd_tilt'
/** Wie weit das Licht beim Kippen wandert (Anteil des Bildschirms je Seite) */
const TILT_RANGE: Point = { x: 0.4, y: 0.34 }
/** Kippwinkel, der das Licht an den Rand bringt (Grad) */
const TILT_FULL = 30

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Der Glanz einer Kante für eine Karte und ein Licht (beides in Bildschirm-Pixeln). */
export function edgeLight(card: Rect, light: Point, viewport: { width: number; height: number }): EdgeLight {
  const cx = card.left + card.width / 2
  const cy = card.top + card.height / 2
  const dx = light.x - cx
  const dy = light.y - cy
  // Wie weit das Licht außerhalb der Karte steht, relativ zur halben Bildschirmgröße
  const ox = Math.max(0, Math.abs(dx) - card.width / 2) / (viewport.width / 2)
  const oy = Math.max(0, Math.abs(dy) - card.height / 2) / (viewport.height / 2)
  const near = 1 - Math.min(1, Math.hypot(ox, oy) * 3)
  const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
  return {
    angle,
    // Licht über der Karte: Glanz rundum und leiser; weit weg: schmal und kräftig
    spread: 70 + near * 110,
    intensity: 0.95 - near * 0.45,
    glow: {
      x: clamp(((light.x - card.left) / card.width) * 100, 0, 100),
      y: clamp(((light.y - card.top) / card.height) * 100, 0, 100),
    },
  }
}

/**
 * Ob das Licht dem Kippen folgen soll. Ohne Wahl: an, wo der Browser nicht
 * fragt; auf dem iPhone erst nach dem Freigeben im Profil.
 */
export function tiltWanted(): boolean {
  try {
    const stored = localStorage.getItem(TILT_KEY)
    if (stored === 'on') return true
    if (stored === 'off') return false
  } catch {
    // ohne Speicher wie ohne Wahl
  }
  return !tiltNeedsPermission()
}

export function setTiltWanted(on: boolean): void {
  try {
    localStorage.setItem(TILT_KEY, on ? 'on' : 'off')
  } catch {
    // Ohne Speicher gilt die Wahl bis zum Neuladen.
  }
  window.dispatchEvent(new Event('tyd-tilt-change'))
}

type OrientationPermission = { requestPermission?: () => Promise<'granted' | 'denied'> }

/** Ob der Browser vor dem Bewegungssensor fragt (iPhone/iPad). */
export function tiltNeedsPermission(): boolean {
  return typeof DeviceOrientationEvent !== 'undefined'
    && typeof (DeviceOrientationEvent as unknown as OrientationPermission).requestPermission === 'function'
}

/** Fragt (nur auf Geräten, die das verlangen) nach dem Bewegungssensor. Muss aus einem Tippen kommen. */
export async function requestTilt(): Promise<boolean> {
  if (!tiltNeedsPermission()) return true
  try {
    const result = await (DeviceOrientationEvent as unknown as OrientationPermission).requestPermission!()
    return result === 'granted'
  } catch {
    return false
  }
}

export function installFlashlight(): () => void {
  const visible = new Set<HTMLElement>()
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  let light: Point = { ...LIGHT_REST }
  let target: Point = { ...LIGHT_REST }
  let neutral: { beta: number; gamma: number } | null = null
  let frame = 0
  let dirty = true
  const geschrieben = new WeakMap<HTMLElement, string>()

  const active = () => document.documentElement.getAttribute('data-look') === 'schwarz'

  const draw = () => {
    frame = 0
    if (!active()) return
    // Das Licht folgt dem Kippen weich statt ruckartig
    const ease = reduceMotion?.matches ? 1 : 0.18
    light = { x: light.x + (target.x - light.x) * ease, y: light.y + (target.y - light.y) * ease }
    const settling = Math.abs(target.x - light.x) > 0.001 || Math.abs(target.y - light.y) > 0.001
    if (!dirty && !settling) return
    dirty = false
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const point = { x: light.x * viewport.width, y: light.y * viewport.height }
    for (const card of visible) {
      const r = card.getBoundingClientRect()
      if (r.width === 0) continue
      const edge = edgeLight(r, point, viewport)
      const winkel = `${edge.angle.toFixed(1)}deg`
      const werte = `${winkel}|${edge.spread.toFixed(0)}|${edge.intensity.toFixed(2)}|${edge.glow.x.toFixed(0)}|${edge.glow.y.toFixed(0)}`
      // Unveraendert nicht neu schreiben: die Variablen erben, jedes Setzen
      // berechnet den Stil der ganzen Karte samt Inhalt neu. Hat jemand den
      // Inline-Stil ersetzt, fehlt der Winkel — dann doch schreiben.
      if (geschrieben.get(card) === werte && card.style.getPropertyValue('--la') === winkel) continue
      geschrieben.set(card, werte)
      card.style.setProperty('--la', winkel)
      card.style.setProperty('--lw', `${edge.spread.toFixed(0)}deg`)
      card.style.setProperty('--li', edge.intensity.toFixed(2))
      card.style.setProperty('--gx', `${edge.glow.x.toFixed(0)}%`)
      card.style.setProperty('--gy', `${edge.glow.y.toFixed(0)}%`)
    }
    if (settling) schedule()
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw)
  }
  const touch = () => {
    dirty = true
    schedule()
  }

  // Nur sichtbare Karten rechnen
  const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    for (const entry of entries) {
      const card = entry.target as HTMLElement
      if (entry.isIntersecting) visible.add(card)
      else visible.delete(card)
    }
    touch()
  }, { rootMargin: '80px' })
  const observed = new WeakSet<Element>()
  const collect = () => {
    for (const card of document.querySelectorAll<HTMLElement>(KARTE)) {
      if (observed.has(card)) continue
      observed.add(card)
      if (io) io.observe(card)
      else visible.add(card)
    }
    for (const card of visible) if (!card.isConnected) visible.delete(card)
    touch()
  }
  let collectFrame = 0
  const mo = new MutationObserver(() => {
    if (collectFrame) return
    collectFrame = requestAnimationFrame(() => { collectFrame = 0; collect() })
  })
  mo.observe(document.body, { childList: true, subtree: true })
  // Wechsel des Erscheinungsbilds
  const lookObserver = new MutationObserver(touch)
  lookObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-look'] })

  // Kippen: relativ zur Haltung beim Start, die Ruhelage passt sich langsam an
  const onOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta == null || event.gamma == null || reduceMotion?.matches || !tiltWanted()) return
    if (!neutral) neutral = { beta: event.beta, gamma: event.gamma }
    neutral = {
      beta: neutral.beta + (event.beta - neutral.beta) * 0.004,
      gamma: neutral.gamma + (event.gamma - neutral.gamma) * 0.004,
    }
    const tx = clamp((event.gamma - neutral.gamma) / TILT_FULL, -1, 1)
    const ty = clamp((event.beta - neutral.beta) / TILT_FULL, -1, 1)
    // Kippt man das Handy nach rechts, wandert das Licht nach links (es bleibt im Raum stehen)
    target = { x: LIGHT_REST.x - tx * TILT_RANGE.x, y: LIGHT_REST.y - ty * TILT_RANGE.y }
    schedule()
  }
  const onTiltChange = () => {
    if (!tiltWanted()) {
      target = { ...LIGHT_REST }
      neutral = null
      schedule()
    }
  }

  // Scrollt nur ein Bereich, in dem keine Karte liegt (das Karussell, eine
  // Reiterleiste), bewegt sich keine Karte: nichts zu rechnen. Sonst laese das
  // Licht bei jedem Wisch-Bild die Lage aller Karten neu — mitten im Bild, in
  // dem das Vial schon gezeichnet hat, also mit erzwungenem Layout.
  const onScroll = (event: Event) => {
    const quelle = event.target
    if (quelle instanceof Element) {
      let betroffen = false
      // Die scrollende Karte selbst bewegt sich nicht — nur, was in ihr liegt.
      for (const card of visible) if (card !== quelle && quelle.contains(card)) { betroffen = true; break }
      if (!betroffen) return
    }
    touch()
  }
  window.addEventListener('scroll', onScroll, { capture: true, passive: true })
  window.addEventListener('resize', touch, { passive: true })
  window.addEventListener('deviceorientation', onOrientation)
  window.addEventListener('tyd-tilt-change', onTiltChange)
  collect()

  return () => {
    if (frame) cancelAnimationFrame(frame)
    if (collectFrame) cancelAnimationFrame(collectFrame)
    io?.disconnect()
    mo.disconnect()
    lookObserver.disconnect()
    window.removeEventListener('scroll', onScroll, { capture: true })
    window.removeEventListener('resize', touch)
    window.removeEventListener('deviceorientation', onOrientation)
    window.removeEventListener('tyd-tilt-change', onTiltChange)
  }
}
