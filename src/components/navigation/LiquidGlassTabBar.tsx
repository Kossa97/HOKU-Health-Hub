import {
  useEffect, useLayoutEffect, useRef, useState,
  type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react'
import { SLOT_ATTR, freieLage, pillenBreite, platzBei } from './tabBarGeometry'
import { haengeGlasKante } from '../../lib/glasKante'
import {
  BILD, FEDER_FINGER, SAEUME, endStand, linsenBild, linsenSchritt, planeWeg, ruhig, saumMaske,
  type LinsenMasse, type LinsenStand, type LinsenZiel,
} from './linsenFeder'
import { LINSE_GEAENDERT, gleitFeder } from '../../lib/linse'
import { brechungsFilter, entferneBrechung } from '../../lib/glasBrechung'

/**
 * Die Web-Fassung der Liquid-Glass-Tab-Bar.
 *
 * Hier steht AUSSCHLIESSLICH Darstellung: eine schwebende Glaskapsel, darin
 * eine Pille, die dem Finger folgt. Wohin ein Platz fuehrt, welcher gilt und
 * was beim Tippen passiert, weiss diese Datei nicht — das kommt von aussen
 * herein. Genau deshalb laesst sie sich im nativen iOS-Bau gegen Apples echte
 * `UITabBar` tauschen, ohne dass die Navigation davon etwas merkt.
 *
 * Das Glas selbst liegt in `index.css` unter `.tyd-tabbar`; dort steht auch,
 * aus welchen Schichten der Eindruck entsteht und was passiert, wenn ein
 * Browser `backdrop-filter` oder Masken nicht kann.
 */

export interface GlassTabItem {
  id: string
  label: string
  icon: ReactNode
  /**
   * `tab` fuehrt zu einer Seite und kann aktiv sein. `aktion` tut etwas —
   * sie traegt kein `aria-current`, laesst sich aber genauso anfahren.
   */
  art?: 'tab' | 'aktion'
  /**
   * Was beim Tippen gerendert wird — eine Verknuepfung oder eine
   * Schaltflaeche. Die Darstellung reicht die Eigenschaften durch, die sie
   * braucht; woher das Element kommt, ist ihr gleich.
   */
  render: (props: {
    className: string
    children: ReactNode
    'aria-current': 'page' | undefined
    'aria-label': string
    /** Gesetzt, solange der Finger ueber diesem Platz steht. */
    'data-tyd-nah': 'true' | undefined
    [SLOT_ATTR]: string
  }) => ReactNode
}

export interface LiquidGlassTabBarProps {
  /** Alle Plaetze in der Reihenfolge, in der sie auf dem Schirm stehen. */
  items: readonly GlassTabItem[]
  /** Der aktive Reiter, oder null auf einer Seite, die zu keinem gehoert. */
  activeId: string | null
  ariaLabel: string
  /**
   * Wird gerufen, wenn der Finger ueber der Leiste losgelassen wird und dabei
   * einen ANDEREN Platz erreicht hat als den, auf dem er aufgesetzt ist. Ein
   * einfacher Tipp laeuft nicht hierueber, sondern ueber das Element selbst —
   * so bleibt eine Verknuepfung eine Verknuepfung.
   */
  onSelect?: (id: string) => void
  /** Ein Platz ist unter dem Finger durchgeglitten. Fuer den Klick am Geraet. */
  onPreviewChange?: (id: string) => void
  /**
   * Was zum Rahmen der Kapsel gehört und UNTER der Linse liegen muss — Hokus
   * Tor. Die Linse zeigt den Rahmen vergrößert mit (`.tyd-tabbar-linse-tor`).
   */
  unterLinse?: ReactNode
}

interface PlatzMass {
  id: string
  links: number
  breite: number
  mitte: number
}

interface PilleLage {
  links: number
  breite: number
  kapselBreite: number
  /**
   * Frei heisst: die Pille haengt am Finger und wird NICHT weich nachgefahren.
   * Sonst liefe sie der Bewegung hinterher wie an einem Gummi.
   */
  frei: boolean
}

export function LiquidGlassTabBar({
  items,
  activeId,
  ariaLabel,
  onSelect,
  onPreviewChange,
  unterLinse,
}: LiquidGlassTabBarProps) {
  const kapselRef = useRef<HTMLElement | null>(null)
  const [pille, setPille] = useState<PilleLage | null>(null)
  /** Liegt gerade ein Finger auf der Leiste? Traegt Vergroesserung und Blase. */
  const [gedrueckt, setGedrueckt] = useState(false)
  /**
   * Am Finger: die freie Lage steht nur in einer Ref, nicht im React-Zustand.
   * Sonst zeichnete React bei JEDER Fingerbewegung die ganze Leiste samt
   * aller Kopien in der Linse neu (und setzte --tyd-glint, das der ganze
   * Baum erbt) — das kostete beim Wischen spürbar Bilder. `frei` als Zustand
   * wechselt nur einmal je Zug.
   */
  const freiLageRef = useRef<{ links: number; breite: number } | null>(null)
  const [frei, setFrei] = useState(false)
  /**
   * Der Platz, der dem Finger gerade am naechsten liegt. Er bestimmt NICHT,
   * wo die Pille steht — solange der Finger liegt, steht sie beim Finger —,
   * sondern nur, was beim Loslassen passiert und wo es klickt.
   */
  const [vorschau, setVorschau] = useState<string | null>(null)

  const vorschauRef = useRef<string | null>(null)
  /**
   * Der Platz, auf dem der Finger zuletzt aufgesetzt hat. Nur dort darf der
   * folgende Klick etwas öffnen, und nur einmal: Klicks auf Plätze, über die
   * die Linse bloß gleitet, werden geschluckt (gemeldet auf dem iPhone: beim
   * Tipp von Profil auf Home öffneten sich unterwegs Kalender, Hoku, My Stack).
   */
  const tippRef = useRef<{ platz: string | null; zeit: number; offen: boolean }>({ platz: null, zeit: 0, offen: false })
  const ziehtRef = useRef(false)
  const gewandertRef = useRef(false)
  const klickSchluckenRef = useRef(false)
  /** Breite der Pille waehrend eines Zugs — fest, damit sie nicht zuckt. */
  const zugBreiteRef = useRef(0)
  /** Masse aller Plaetze, zuletzt gemessen. */
  const plaetzeRef = useRef<PlatzMass[]>([])
  const pilleRef = useRef<HTMLDivElement | null>(null)
  const kopieRef = useRef<HTMLDivElement | null>(null)
  const glasRef = useRef<HTMLDivElement | null>(null)
  /** Abbild der Leiste in der Linse: deckt die echten Symbole ab, zeigt den Rahmen vergrößert. */
  const abbildRef = useRef<HTMLDivElement | null>(null)
  const abbildGlasRef = useRef<HTMLDivElement | null>(null)
  /** Die Ringe der Randbrechung (je eine weitere Kopie, maskiert auf den Rand) und ihre Kopien. */
  const saumRefs = useRef<(HTMLDivElement | null)[]>([])
  const saumKopieRefs = useRef<(HTMLDivElement | null)[]>([])
  /**
   * Randbrechung: aus, als Ringe (zwei maskierte Kopien, laufen ohne Skript)
   * oder nach Glisse (SVG-Filter auf der Kopie, stufenlos). --linse-rand / --linse-art.
   */
  const [brechung, setBrechung] = useState<'aus' | 'ringe' | 'glisse'>('aus')
  const mitRand = brechung === 'ringe'
  const rahmenRef = useRef<HTMLDivElement | null>(null)
  /** Der gebaute Glisse-Filter (id) und ob er gerade an der Kopie hängt. */
  const filterRef = useRef<{ id: string | null; an: boolean }>({ id: null, an: false })
  useEffect(() => () => entferneBrechung(filterRef.current.id), [])
  /** Breite der ruhenden Pille, 0 schmal … 1 so breit wie der Reiter (--linse-ruhe). */
  const ruheRef = useRef(0)
  /** Zählt Änderungen an den Linsen-Einstellungen, damit neu gemessen wird. */
  const [linsenStand, setLinsenStand] = useState(0)
  useEffect(() => {
    const neu = () => setLinsenStand(n => n + 1)
    window.addEventListener(LINSE_GEAENDERT, neu)
    return () => window.removeEventListener(LINSE_GEAENDERT, neu)
  }, [])
  const ringRef = useRef<HTMLDivElement | null>(null)
  /**
   * Die Feder der Linse. React rendert das ZIEL (Breite); Lage und Größe sind
   * reines `transform`/`opacity`, gesetzt im Layout-Effekt noch vor dem
   * Zeichnen. Am Finger rechnet die Feder Bild für Bild. Gleitet die Linse
   * allein (Tippen, Loslassen), wird ihr ganzer Weg vorab gerechnet und dem
   * Browser als Animation übergeben: die läuft weiter, auch wenn die neue
   * Seite gerade aufgebaut wird und das Skript keine Zeit hat — vorher hakte
   * genau dort die Fahrt. Jede neue Geste setzt dort an, wo die Linse gerade
   * ist (unterbrechbar). Ohne Animation (weniger Bewegung, Testumgebung) gilt
   * sofort das Ziel.
   */
  const feder = useRef<{ s: LinsenStand; start: boolean; frame: number; zuletzt: number }>({
    s: { x: 0, w: 0, t: 0, vx: 0, vw: 0, vt: 0 }, start: false, frame: 0, zuletzt: 0,
  })
  const zielRef = useRef<LinsenZiel & { frei: boolean; kapsel: number }>({ x: 0, w: 0, gehalten: false, frei: false, kapsel: 0 })
  const masseRef = useRef<LinsenMasse>({ w0: 0, h0: 0, einzug: 0, wachsen: 0, hoehe: 0, heben: 0, zoom: 1 })
  /** Die laufende Fahrt: ihr Weg, die Animationen und für welches Ziel sie gerechnet ist. */
  const fahrtRef = useRef<{ weg: LinsenStand[]; anim: Animation[]; schluessel: string } | null>(null)

  // Gerechnete Glaskante (src/lib/glasKante.ts): glänzt oben links, wo das
  // Licht hinfällt. Welche Looks sie zeigen, steht in index.css.
  useEffect(() => {
    const kapsel = kapselRef.current
    return kapsel ? haengeGlasKante(kapsel, { fase: 2.5, glanz: 0.85 }) : undefined
  }, [])

  const setzeVorschau = (id: string | null) => {
    vorschauRef.current = id
    setVorschau(id)
  }

  /**
   * Die Pille wird GEMESSEN, nicht gerechnet.
   *
   * Die Plaetze sind unterschiedlich breit, sobald eine Beschriftung laenger
   * ist oder eine Sprache mehr Platz braucht — eine Formel aus „Kapselbreite
   * durch Anzahl" traefe daneben. Gemessen wird im Layout-Effekt, also vor dem
   * ersten Anzeigen: es gibt kein Bild mit falsch sitzender Pille.
   *
   * Waehrend ein Finger liegt, haelt sich die Messung heraus — dort fuehrt der
   * Finger, nicht die Route.
   */
  useLayoutEffect(() => {
    const kapsel = kapselRef.current
    if (!kapsel) return

    const plaetze = () => [...kapsel.querySelectorAll<HTMLElement>(`[${SLOT_ATTR}]`)]

    const messen = () => {
      const ruhe = parseFloat(getComputedStyle(kapsel).getPropertyValue('--linse-ruhe'))
      ruheRef.current = Number.isFinite(ruhe) ? Math.min(1, Math.max(0, ruhe)) : 0
      const rand = parseFloat(getComputedStyle(kapsel).getPropertyValue('--linse-rand'))
      const art = parseFloat(getComputedStyle(kapsel).getPropertyValue('--linse-art'))
      setBrechung(!(Number.isFinite(rand) && rand > 0) ? 'aus' : art === 2 ? 'glisse' : 'ringe')
      plaetzeRef.current = plaetze().map(el => ({
        // Gesucht wird ueber den Attributwert und nicht ueber einen Selektor
        // mit eingesetzter Kennung: das braucht kein `CSS.escape` (das jsdom
        // gar nicht hat) und kann an keiner Kennung zerbrechen.
        id: el.getAttribute(SLOT_ATTR) ?? '',
        links: el.offsetLeft,
        breite: el.offsetWidth,
        mitte: el.offsetLeft + el.offsetWidth / 2,
      }))
      if (ziehtRef.current) return

      const naechste = lageVon(activeId, kapsel.offsetWidth)
      setPille(vorher => (gleich(vorher, naechste) ? vorher : naechste))
    }

    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(kapsel)
    for (const el of plaetze()) beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [activeId, items, linsenStand])

  /** Breite der Pille auf einem Platz: schmal (pillenBreite) bis fast so breit wie der Reiter. */
  function breiteFuer(platzBreite: number) {
    const schmal = pillenBreite(platzBreite)
    // Breit füllt sie den ganzen Reiter: die Leiste hat seitlich denselben
    // Einzug wie oben und unten, so läuft die Kapsel am äußeren Reiter parallel
    // zur Rundung der Leiste.
    const breit = Math.max(schmal, platzBreite)
    return Math.round(schmal + (breit - schmal) * ruheRef.current)
  }

  /** Wo die Pille steht, wenn sie auf einem Platz eingerastet ist. */
  function lageVon(id: string | null, kapselBreite: number): PilleLage | null {
    const platz = id ? plaetzeRef.current.find(p => p.id === id) : undefined
    if (!platz || !kapselBreite) return null
    const breite = breiteFuer(platz.breite)
    return { links: Math.round(platz.links + (platz.breite - breite) / 2), breite, kapselBreite, frei: false }
  }

  /** Liest Größe und Stärke der Linse (die --linse-* Variablen, src/lib/linse.ts). */
  const miss = (el: HTMLElement, w0: number) => {
    const css = getComputedStyle(el)
    const zahl = (name: string, ersatz: number) => {
      const n = parseFloat(css.getPropertyValue(name))
      return Number.isFinite(n) ? n : ersatz
    }
    // Das Abbild trägt das Aussehen der echten Leiste (je Look verschieden)
    const kapsel = kapselRef.current
    if (kapsel) {
      const k = getComputedStyle(kapsel)
      for (const abbild of el.querySelectorAll<HTMLElement>('.tyd-tabbar-linse-abbild-glas')) {
        // Nur Kante und Rundung: die Füllung liegt schon in der echten Leiste
        // dahinter, die die Kopie durch ihr Glas sieht — doppelt wäre sie zu dunkel.
        abbild.style.boxShadow = k.boxShadow
        abbild.style.borderRadius = k.borderTopLeftRadius
        if (abbild.parentElement) abbild.parentElement.style.borderRadius = k.borderTopLeftRadius
      }
    }
    // Rundung der Linse (--linse-rund; im eckigen Labor klein), am Ring gemessen
    const rund = ringRef.current ? parseFloat(getComputedStyle(ringRef.current).borderTopLeftRadius) || el.offsetHeight / 2 : el.offsetHeight / 2
    // Die Ringe der Randbrechung (innen, außen; Regler --linse-saum-*)
    const saeume = [
      { breite: zahl('--linse-saum-innen-breite', SAEUME[0].breite), faktor: zahl('--linse-saum-innen', SAEUME[0].faktor) },
      { breite: zahl('--linse-saum-aussen-breite', SAEUME[1].breite), faktor: zahl('--linse-saum-aussen', SAEUME[1].faktor) },
    ]
    // Maske in der Größe der ungewachsenen Pille
    saumRefs.current.forEach((saum, i) => {
      if (!saum || !w0 || !el.offsetHeight) return
      const maske = saumMaske(w0, el.offsetHeight, saeume[i].breite, rund)
      saum.style.maskImage = maske
      saum.style.setProperty('-webkit-mask-image', maske)
    })
    // Glisse: der Filter in der Größe der ungewachsenen Pille (die Kopie
    // wird mit der Pille skaliert, die Karte also mit)
    if (brechung === 'glisse' && w0 && el.offsetHeight) {
      const h0 = el.offsetHeight
      const rand = zahl('--linse-rand', 0)
      filterRef.current.id = brechungsFilter(w0, h0, {
        tiefe: Math.round(4 + 8 * rand),
        weite: rand * 0.3 * h0,
        // schlank: ohne Farbsaum je Kanal (den trägt der Glasrand)
        farbe: 0,
        rund,
        alt: filterRef.current.id,
      })
      filterRef.current.an = false
      rahmenRef.current?.style.removeProperty('filter')
    } else if (filterRef.current.id) {
      entferneBrechung(filterRef.current.id)
      filterRef.current = { id: null, an: false }
      rahmenRef.current?.style.removeProperty('filter')
    }
    masseRef.current = {
      w0, h0: el.offsetHeight, einzug: el.offsetTop,
      wachsen: zahl('--linse-wachsen', 0), hoehe: zahl('--linse-hoehe', 0),
      heben: zahl('--linse-heben', 0), zoom: zahl('--linse-zoom', 1),
      rand: zahl('--linse-rand', 0),
      raster: 1 / (window.devicePixelRatio || 1),
      verformung: zahl('--linse-verformung', 1),
      saeume,
    }
  }

  /** Schreibt einen Stand ins DOM — nur transform und opacity. */
  const zeichne = (s: LinsenStand = feder.current.s) => {
    const el = pilleRef.current
    if (!el) return
    const b = linsenBild(s, masseRef.current)
    el.style.transform = b.pille
    if (kopieRef.current) kopieRef.current.style.transform = b.kopie
    if (glasRef.current) glasRef.current.style.opacity = String(b.glas)
    if (ringRef.current) ringRef.current.style.opacity = String(b.glas)
    if (abbildRef.current) abbildRef.current.style.opacity = String(b.glas)
    saumKopieRefs.current.forEach((k, i) => { if (k) k.style.transform = b.saeume[i] })
    for (const saum of saumRefs.current) if (saum) saum.style.opacity = String(b.glas)
    if (b.linse) el.setAttribute('data-linse', 'true')
    else el.removeAttribute('data-linse')
    // Glisse nur, solange ein Finger liegt (beim Gleiten allein zu teuer)
    setzeFilter(b.linse && (zielRef.current.gehalten || zielRef.current.frei))
    // In Ruhe deckt die farbige Kopie das aktive Symbol ganz: das graue
    // Original darunter wird ausgeblendet, damit nichts doppelt flimmert.
    const ruht = !b.linse && s.vx === 0 && s.vw === 0 && !zielRef.current.frei && !fahrtRef.current
    kapselRef.current?.toggleAttribute('data-ruhig', ruht)
  }

  /** Hängt den Glisse-Filter an die Kopie, solange die Linse groß ist. */
  const setzeFilter = (an: boolean) => {
    const f = filterRef.current, rahmen = rahmenRef.current
    if (!rahmen || !f.id) return
    if (f.an === an) return
    f.an = an
    if (an) rahmen.style.filter = `url("#${f.id}")`
    else rahmen.style.removeProperty('filter')
  }

  const ohneAnimation = () =>
    typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || typeof pilleRef.current?.animate !== 'function'

  /** Hält eine laufende Fahrt an und übernimmt ihren aktuellen Stand. */
  const halteFahrt = () => {
    const fahrt = fahrtRef.current
    if (!fahrt) return
    fahrtRef.current = null
    const ms = Number(fahrt.anim[0]?.currentTime ?? 0) || 0
    const i = Math.min(fahrt.weg.length - 1, Math.max(0, Math.round(ms / (BILD * 1000))))
    feder.current.s = { ...fahrt.weg[i] }
    zeichne()
    for (const a of fahrt.anim) a.cancel()
  }

  /** Rechnet den Weg bis zur Ruhe und übergibt ihn dem Browser. */
  const starteFahrt = (schluessel: string) => {
    const z = zielRef.current, m = masseRef.current
    const weg = planeWeg(feder.current.s, z, gleitFeder(z.x - feder.current.s.x))
    const ende = weg[weg.length - 1]
    if (weg.length < 3) {
      feder.current.s = ende
      zeichne()
      return
    }
    const bilder = weg.map(s => linsenBild(s, m))
    const dauer = (weg.length - 1) * BILD * 1000
    const optionen: KeyframeAnimationOptions = { duration: dauer, easing: 'linear', fill: 'forwards' }
    const anim: Animation[] = []
    const el = pilleRef.current!
    kapselRef.current?.removeAttribute('data-ruhig')
    if (bilder.some(b => b.linse)) {
      el.setAttribute('data-linse', 'true')
      setzeFilter(z.gehalten)
    }
    anim.push(el.animate(bilder.map(b => ({ transform: b.pille })), optionen))
    if (kopieRef.current) anim.push(kopieRef.current.animate(bilder.map(b => ({ transform: b.kopie })), optionen))
    saumKopieRefs.current.forEach((k, i) => {
      if (k) anim.push(k.animate(bilder.map(b => ({ transform: b.saeume[i] })), optionen))
    })
    for (const schicht of [glasRef.current, ringRef.current, abbildRef.current, ...saumRefs.current]) {
      if (schicht) anim.push(schicht.animate(bilder.map(b => ({ opacity: b.glas })), optionen))
    }
    const fahrt = { weg, anim, schluessel }
    fahrtRef.current = fahrt
    anim[0].onfinish = () => {
      if (fahrtRef.current !== fahrt) return
      fahrtRef.current = null
      feder.current.s = ende
      zeichne()
      for (const a of anim) a.cancel()
    }
  }

  /** Am Finger: Bild für Bild, die Linse hängt eng am Finger. */
  const schritt = (jetzt: number) => {
    const f = feder.current, z = zielRef.current
    f.frame = 0
    const dt = Math.min(1 / 30, Math.max(0.001, (jetzt - (f.zuletzt || jetzt - 16)) / 1000))
    f.zuletzt = jetzt
    f.s = linsenSchritt(f.s, z, FEDER_FINGER, dt)
    if (ruhig(f.s, z)) {
      f.s = endStand(z)
      f.zuletzt = 0
      zeichne()
      return
    }
    zeichne()
    f.frame = requestAnimationFrame(schritt)
  }

  useLayoutEffect(() => {
    const el = pilleRef.current
    if (!pille || !el) return
    const z = zielRef.current
    const am = ziehtRef.current ? freiLageRef.current : null
    z.x = am ? am.links : pille.links; z.w = am ? am.breite : pille.breite; z.frei = !!am || pille.frei
    z.gehalten = gedrueckt; z.kapsel = pille.kapselBreite
    const f = feder.current
    const schluessel = `${z.x}|${z.w}|${z.gehalten}|${z.frei}|${linsenStand}|${brechung}`
    if (!f.start || ohneAnimation()) {
      f.start = true
      miss(el, pille.breite)
      halteFahrt()
      cancelAnimationFrame(f.frame); f.frame = 0
      f.s = endStand(z)
      zeichne()
      return
    }
    if (z.frei) {
      halteFahrt()
      if (masseRef.current.w0 !== pille.breite) miss(el, pille.breite)
      if (!f.frame) f.frame = requestAnimationFrame(schritt)
      return
    }
    // Gleitet allein. Läuft schon eine Fahrt zum selben Ziel, bleibt sie
    // unberührt — ein Neuzeichnen der Seite (etwa beim Seitenwechsel) darf
    // sie nicht anhalten.
    if (fahrtRef.current?.schluessel === schluessel) return
    cancelAnimationFrame(f.frame); f.frame = 0; f.zuletzt = 0
    halteFahrt()
    miss(el, pille.breite)
    starteFahrt(schluessel)
  })
  useEffect(() => () => {
    cancelAnimationFrame(feder.current.frame)
    for (const a of fahrtRef.current?.anim ?? []) a.cancel()
  }, [])

  // Der Schimmer im Glas folgt der Pille — das ist der raeumliche Anteil.
  const schimmer = pille
    ? `${((pille.links + pille.breite / 2) / pille.kapselBreite) * 100}%`
    : '50%'

  const istAktion = (id: string | null) =>
    items.find(item => item.id === id)?.art === 'aktion'

  const beiZeigerAb = (e: ReactPointerEvent<HTMLElement>) => {
    const auf = (e.target as HTMLElement).closest?.(`[${SLOT_ATTR}]`) as HTMLElement | null
    const kapsel = kapselRef.current
    if (!auf || !kapsel) return

    const id = auf.getAttribute(SLOT_ATTR)
    tippRef.current = { platz: id, zeit: performance.now(), offen: true }
    ziehtRef.current = true
    gewandertRef.current = false
    zugBreiteRef.current = breiteFuer(auf.offsetWidth)
    setGedrueckt(true)
    setzeVorschau(id)
    // Die Pille springt auf den gedrueckten Platz — von dort aus haengt sie
    // am Finger.
    const lage = lageVon(id, kapsel.offsetWidth)
    if (lage) setPille(lage)
  }

  /**
   * Waehrend der Finger liegt, rastet NICHTS ein.
   *
   * Vorher sprang die Pille von Platz zu Platz; das fuehlte sich an wie ein
   * Schalter, nicht wie etwas, das man in der Hand hat. Jetzt haengt sie an
   * der Fingerspitze und wird nur an den Kapselrand geklemmt. Wo sie
   * hingehoert, entscheidet erst das Loslassen.
   */
  const beiZeigerBewegung = (e: ReactPointerEvent<HTMLElement>) => {
    if (!ziehtRef.current) return
    const kapsel = kapselRef.current
    if (!kapsel) return

    const x = e.clientX - kapsel.getBoundingClientRect().left
    const breite = zugBreiteRef.current
    const links = freieLage(x, breite, kapsel.offsetWidth)
    folgeFinger(links, breite)

    const naechster = platzBei(plaetzeRef.current, x)
    if (!naechster || naechster === vorschauRef.current) return
    gewandertRef.current = true
    setzeVorschau(naechster)
    onPreviewChange?.(naechster)
  }

  /** Die Linse hängt am Finger: Ziel direkt setzen, Feder läuft ohne React. */
  const folgeFinger = (links: number, breite: number) => {
    freiLageRef.current = { links, breite }
    if (!frei) setFrei(true)
    const z = zielRef.current, f = feder.current, el = pilleRef.current
    z.x = links; z.w = breite; z.frei = true
    if (!el) return
    el.dataset.frei = 'true'
    if (ohneAnimation()) {
      f.s = endStand(z)
      zeichne()
      return
    }
    halteFahrt()
    if (!f.frame) f.frame = requestAnimationFrame(schritt)
  }

  const loesFinger = () => {
    freiLageRef.current = null
    setFrei(false)
  }

  const beiZeigerAuf = () => {
    if (!ziehtRef.current) return
    ziehtRef.current = false
    loesFinger()
    const ziel = vorschauRef.current
    const kapsel = kapselRef.current
    setGedrueckt(false)
    setzeVorschau(null)

    // Einrasten auf den naechsten Platz — weich, weil `frei` jetzt falsch ist.
    // Eine Aktion bleibt nicht unter der Pille stehen: sie fuehrt zu keiner
    // Seite, also gehoert die Pille dorthin zurueck, wo man wirklich ist.
    const einrastZiel = ziel && !istAktion(ziel) ? ziel : activeId
    if (kapsel) setPille(lageVon(einrastZiel, kapsel.offsetWidth))

    // Ein einfacher Tipp wird NICHT hier behandelt: dann liegt der Finger noch
    // auf demselben Platz, und das Element darunter macht seine Arbeit selbst
    // — samt allem, was ein Browser an einer Verknuepfung kann.
    if (!gewandertRef.current || !ziel) return

    // Gewandert: der Klick gehoert zum Platz, auf dem der Finger AUFGESETZT
    // hat, und fuehrt woandershin. Er wird geschluckt, und wir gehen selbst.
    klickSchluckenRef.current = true
    window.setTimeout(() => { klickSchluckenRef.current = false }, 0)
    onSelect?.(ziel)
  }

  const beiZeigerAbbruch = () => {
    if (!ziehtRef.current) return
    ziehtRef.current = false
    loesFinger()
    setGedrueckt(false)
    setzeVorschau(null)
    const kapsel = kapselRef.current
    if (kapsel) setPille(lageVon(activeId, kapsel.offsetWidth))
  }

  const beiKlick = (e: ReactMouseEvent<HTMLElement>) => {
    const schlucken = () => { e.preventDefault(); e.stopPropagation() }
    if (klickSchluckenRef.current) { schlucken(); return }
    const platz = (e.target as HTMLElement).closest?.(`[${SLOT_ATTR}]`)?.getAttribute(SLOT_ATTR) ?? null
    // Tastatur und Vorlesung klicken ohne Finger (detail 0): die gelten immer
    if (!platz || e.detail === 0) return
    const t = tippRef.current
    if (t.offen && t.platz === platz && performance.now() - t.zeit < 3000) {
      t.offen = false
      return
    }
    schlucken()
  }

  const platz = (item: GlassTabItem) => item.render({
    className: 'tyd-tabbar-item',
    // Nur Symbole, keine Unterschriften — wie in der Leiste aus iOS 26. Der
    // Name muss dann als Beschriftung mit, sonst hoert die Vorlesung nur „Link".
    'aria-label': item.label,
    [SLOT_ATTR]: item.id,
    // Immer der Platz der GEZEIGTEN Seite, nie der unter dem Finger: was
    // vorgelesen wird, darf nicht von einer Geste abhaengen, die noch laeuft.
    // Eine Aktion ist nie „die aktuelle Seite", sie fuehrt zu keiner.
    'aria-current': item.art !== 'aktion' && item.id === activeId ? 'page' : undefined,
    // Das Symbol unter der Blase leuchtet mit — so sieht man beim Ziehen, wo
    // man landet, bevor man loslaesst.
    'data-tyd-nah': item.id === vorschau ? 'true' : undefined,
    children: item.icon,
  })

  /** Die farbigen Symbole an ihren echten Plätzen (für die Kopien in der Pille). */
  const symbolKopie = () => plaetzeRef.current.map(p => {
    const item = items.find(i => i.id === p.id)
    if (!item) return null
    return (
      <span key={p.id} className="tyd-tabbar-linse-platz" style={{ left: p.links, width: p.breite }}>
        {item.icon}
      </span>
    )
  })

  return (
    <nav
      ref={kapselRef}
      aria-label={ariaLabel}
      className="tyd-tabbar flex items-stretch"
      data-gedrueckt={gedrueckt ? 'true' : 'false'}
      data-farbe-in-pille={pille ? 'true' : undefined}
      style={{ ['--tyd-glint' as string]: schimmer }}
      onPointerDown={beiZeigerAb}
      onPointerMove={beiZeigerBewegung}
      onPointerUp={beiZeigerAuf}
      onPointerCancel={beiZeigerAbbruch}
      onClickCapture={beiKlick}
    >
      {/* Die Unschärfe des Glases (index.css, „Glas der Navbar“) */}
      <span className="tyd-glas-koerper" aria-hidden="true" />
      {unterLinse}
      <div
        ref={pilleRef}
        className="tyd-tabbar-pill"
        data-tyd-pill
        data-gehalten={gedrueckt ? 'true' : 'false'}
        data-frei={frei || pille?.frei ? 'true' : 'false'}
        data-ohne-ziel={pille ? 'false' : 'true'}
        aria-hidden="true"
        style={pille ? { width: pille.breite } : undefined}
      >
        {/*
          Die Linse in Schichten: das deckende Glas, darüber die farbige Kopie
          der Symbole, oben der Farbsaum. Glas und Saum blenden mit der Größe
          der Linse ein. In der Pille liegt immer die Kopie, genau über den
          echten Symbolen, in der Farbe des aktiven Reiters — die echten bleiben
          grau. So färbt sich wie bei Apple nur der Teil eines Symbols, über dem
          die Pille gerade steht, auch während sie gleitet. Als Linse wird die
          Kopie um ihre Mitte vergrößert (Idee aus Glisse).
        */}
        <div ref={glasRef} className="tyd-tabbar-linse-glas" />
        {pille && (
          <div ref={rahmenRef} className="tyd-tabbar-linse-rahmen">
            <div ref={kopieRef} className="tyd-tabbar-linse" style={{ width: pille.kapselBreite }}>
              {/* Die Leiste selbst, samt Rahmen und Hokus Tor — in der Linse vergrößert */}
              <div ref={abbildRef} className="tyd-tabbar-linse-abbild">
                <div ref={abbildGlasRef} className="tyd-tabbar-linse-abbild-glas" />
                <span className="tyd-tabbar-linse-tor" />
                    <canvas className="tyd-dot-torbild tyd-tabbar-linse-torbild" />
              </div>
              {symbolKopie()}
            </div>
            {/* Randbrechung: dieselbe Kopie in Ringen an der Kante, kleiner
                abgebildet — dort drückt das Glas den Inhalt zusammen. */}
            {mitRand && SAEUME.map((saum, i) => (
              <div key={saum.breite} ref={el => { saumRefs.current[i] = el }} className="tyd-tabbar-linse-saum">
                <div ref={el => { saumKopieRefs.current[i] = el }} className="tyd-tabbar-linse" style={{ width: pille.kapselBreite }}>
                  <div className="tyd-tabbar-linse-abbild">
                    <div className="tyd-tabbar-linse-abbild-glas" />
                    <span className="tyd-tabbar-linse-tor" />
                    <canvas className="tyd-dot-torbild tyd-tabbar-linse-torbild" />
                  </div>
                  {symbolKopie()}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={ringRef} className="tyd-tabbar-linse-ring" />
      </div>
      {items.map(item => (
        <TabTraeger key={item.id}>{platz(item)}</TabTraeger>
      ))}
    </nav>
  )
}

function gleich(a: PilleLage | null, b: PilleLage | null) {
  if (a === null || b === null) return a === b
  return a.links === b.links && a.breite === b.breite && a.kapselBreite === b.kapselBreite
}

/** Nur ein Schluessel-Traeger: `render` liefert ein fertiges Element. */
function TabTraeger({ children }: { children: ReactNode }) {
  return <>{children}</>
}
