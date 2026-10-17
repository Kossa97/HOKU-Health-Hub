/**
 * Umgebungslicht der Fortschritt-Seite — die Rechnung, ohne React.
 *
 * Die Lichter liegen fest am Bildschirm (scrollen nicht mit). Jedes gehört zu
 * einer Karte und gleitet per Feder hinter ihr her: beim Scrollen mit leichter
 * Verzögerung, beim Ablesen hinter dem Finger, beim Wischen hinter der Karte.
 * Verlässt eine Karte den Bildschirm, verblasst ihr Licht.
 *
 * Leistung: geschrieben wird direkt in style.transform/opacity (kein React-
 * Render pro Frame), die Farbe wechselt über background-color (Compositor),
 * die Weichheit kommt aus einer festen Radial-Maske statt aus filter: blur.
 * Die Schleife schläft, sobald alle Federn ruhen.
 */

export interface LightSpec {
  color: string
  /** 0 = aus, 1 = volle Stärke */
  intensity: number
  /** Ankerpunkt innerhalb der Karte, 0..1 */
  anchorX: number
  anchorY: number
  /** Durchmesser in px */
  size?: number
}

interface Spring { x: number; y: number; vx: number; vy: number; o: number; vo: number }

interface Light {
  el: () => HTMLElement | null
  spec: LightSpec
  node: HTMLDivElement
  s: Spring
  placed: boolean
  color: string
  observed: HTMLElement | null
}

export const DEFAULT_LIGHT_SIZE = 380
/** Feder nach Apple-Art: Antwortzeit und Dämpfung statt Masse/Steifigkeit */
const RESPONSE = 0.6
const DAMPING = 0.9
const OMEGA = (2 * Math.PI) / RESPONSE
const K = OMEGA * OMEGA
const C = 2 * DAMPING * OMEGA

/** Höchstens so viele Aufblüh-Effekte gleichzeitig; schnelles Tippen stapelt sonst Ebenen */
const MAX_PULSES = 3

export class AmbientEngine {
  private layer: HTMLElement | null = null
  private lights = new Map<string, Light>()
  private frame = 0
  private last = 0
  private pulses: Animation[] = []
  /** Karten ändern ihre Größe (Bilder geladen, Ring aufgeklappt): Lichter neu ausrichten */
  private resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.wake())
  /** Einmal gelesen, nicht in jedem Frame */
  private motionQuery = typeof window === 'undefined' ? null : window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null
  private reducedMotion() { return this.motionQuery?.matches === true }

  /** Hängt die Licht-Ebene ein und hört auf Scrollen, Größe, Sichtbarkeit. */
  attach(layer: HTMLElement): () => void {
    this.layer = layer
    for (const light of this.lights.values()) layer.appendChild(light.node)
    const onVisible = () => { if (document.visibilityState === 'visible') this.wake() }
    window.addEventListener('scroll', this.wake, { passive: true })
    window.addEventListener('resize', this.wake)
    document.addEventListener('visibilitychange', onVisible)
    this.wake()
    return () => {
      window.removeEventListener('scroll', this.wake)
      window.removeEventListener('resize', this.wake)
      document.removeEventListener('visibilitychange', onVisible)
      cancelAnimationFrame(this.frame)
      this.frame = 0
      this.resize?.disconnect()
      for (const light of this.lights.values()) light.observed = null
      this.layer = null
    }
  }

  register(id: string, el: () => HTMLElement | null): void {
    if (this.lights.has(id)) return
    const node = document.createElement('div')
    node.className = 'fg-light'
    this.layer?.appendChild(node)
    this.lights.set(id, {
      el,
      node,
      spec: { color: 'transparent', intensity: 0, anchorX: 0.5, anchorY: 0.5 },
      s: { x: 0, y: 0, vx: 0, vy: 0, o: 0, vo: 0 },
      placed: false,
      color: '',
      observed: null,
    })
    this.wake()
  }

  unregister(id: string): void {
    const light = this.lights.get(id)
    if (!light) return
    if (light.observed) this.resize?.unobserve(light.observed)
    light.node.remove()
    this.lights.delete(id)
  }

  update(id: string, spec: LightSpec): void {
    const light = this.lights.get(id)
    if (!light) return
    light.spec = spec
    const size = spec.size ?? DEFAULT_LIGHT_SIZE
    light.node.style.width = `${size}px`
    light.node.style.height = `${size}px`
    if (light.color !== spec.color) {
      light.color = spec.color
      light.node.style.backgroundColor = spec.color
    }
    this.wake()
  }

  /** Kurzes Aufblühen einer Farbe an einer Stelle (Chip an, Ring auf). */
  pulse(color: string, el: HTMLElement | null, anchorX = 0.5, anchorY = 0.5): void {
    if (!this.layer || !el || this.reducedMotion() || typeof Element.prototype.animate !== 'function') return
    if (this.pulses.length >= MAX_PULSES) this.pulses.shift()?.cancel()
    const rect = el.getBoundingClientRect()
    const size = 300
    const x = rect.left + anchorX * rect.width - size / 2
    const y = rect.top + anchorY * rect.height - size / 2
    const node = document.createElement('div')
    node.className = 'fg-light'
    node.style.width = `${size}px`
    node.style.height = `${size}px`
    node.style.backgroundColor = color
    this.layer.appendChild(node)
    // Aufblühen und verklingen: nur transform und opacity, läuft auf dem Compositor
    const animation = node.animate([
      { opacity: 0, transform: `translate3d(${x}px, ${y}px, 0) scale(0.55)` },
      { opacity: 0.75, transform: `translate3d(${x}px, ${y}px, 0) scale(1)`, offset: 0.3 },
      { opacity: 0, transform: `translate3d(${x}px, ${y}px, 0) scale(1.35)` },
    ], { duration: 1100, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
    this.pulses.push(animation)
    const done = () => {
      node.remove()
      this.pulses = this.pulses.filter(a => a !== animation)
    }
    animation.onfinish = done
    animation.oncancel = done
  }

  /** Ziel eines Lichts in Bildschirm-Koordinaten und seine Helligkeit. */
  private target(light: Light) {
    const el = light.el()
    if (!el) return null
    if (light.observed !== el) {
      if (light.observed) this.resize?.unobserve(light.observed)
      this.resize?.observe(el)
      light.observed = el
    }
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight
    // Anteil der Karte im Bild: steuert, wie hell ihr Licht ist
    const visible = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0))
    const ratio = rect.height > 0 ? Math.min(1, visible / Math.min(rect.height, vh * 0.6)) : 0
    const eased = ratio * ratio * (3 - 2 * ratio)
    return {
      x: rect.left + light.spec.anchorX * rect.width,
      // Außerhalb des Bildes am Rand parken statt weit wegzufliegen
      y: Math.max(-vh * 0.25, Math.min(vh * 1.25, rect.top + light.spec.anchorY * rect.height)),
      o: light.spec.intensity * eased,
    }
  }

  private paint(light: Light) {
    const size = light.spec.size ?? DEFAULT_LIGHT_SIZE
    const scale = 0.8 + 0.3 * Math.min(1, light.s.o / 0.6)
    light.node.style.transform = `translate3d(${(light.s.x - size / 2).toFixed(1)}px, ${(light.s.y - size / 2).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`
    light.node.style.opacity = light.s.o.toFixed(3)
  }

  /** Ein Frame: Federn einen Schritt Richtung Ziel; schläft ein, wenn alle ruhen. */
  step = (now: number): void => {
    this.frame = 0
    const dt = Math.min(1 / 30, this.last ? (now - this.last) / 1000 : 1 / 60)
    this.last = now
    const instant = this.reducedMotion()
    let moving = false

    for (const light of this.lights.values()) {
      const t = this.target(light)
      if (!t) continue
      const s = light.s
      if (!light.placed || instant) {
        // Erstes Bild: an den Platz, dann einblenden. Reduzierte Bewegung: sofort.
        s.x = t.x; s.y = t.y; s.vx = 0; s.vy = 0
        if (instant) { s.o = t.o; s.vo = 0 }
        light.placed = true
      }
      if (!instant) {
        s.vx += (-K * (s.x - t.x) - C * s.vx) * dt
        s.vy += (-K * (s.y - t.y) - C * s.vy) * dt
        s.vo += (-K * (s.o - t.o) - C * s.vo) * dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.o = Math.max(0, Math.min(1, s.o + s.vo * dt))
        if (
          Math.abs(s.x - t.x) > 0.5 || Math.abs(s.y - t.y) > 0.5 || Math.abs(s.vx) > 1 || Math.abs(s.vy) > 1
          || Math.abs(s.o - t.o) > 0.004 || Math.abs(s.vo) > 0.01
        ) moving = true
      }
      this.paint(light)
    }

    if (moving) this.frame = requestAnimationFrame(this.step)
    else this.last = 0
  }

  wake = (): void => {
    if (!this.frame) this.frame = requestAnimationFrame(this.step)
  }
}
