import {
  useEffect, useLayoutEffect, useRef, useState,
  type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react'
import { SLOT_ATTR, freieLage, pillenBreite, platzBei } from './tabBarGeometry'
import { haengeGlasKante } from '../../lib/glasKante'

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
}: LiquidGlassTabBarProps) {
  const kapselRef = useRef<HTMLElement | null>(null)
  const [pille, setPille] = useState<PilleLage | null>(null)
  /** Liegt gerade ein Finger auf der Leiste? Traegt Vergroesserung und Blase. */
  const [gedrueckt, setGedrueckt] = useState(false)
  /**
   * Der Platz, der dem Finger gerade am naechsten liegt. Er bestimmt NICHT,
   * wo die Pille steht — solange der Finger liegt, steht sie beim Finger —,
   * sondern nur, was beim Loslassen passiert und wo es klickt.
   */
  const [vorschau, setVorschau] = useState<string | null>(null)

  const vorschauRef = useRef<string | null>(null)
  const ziehtRef = useRef(false)
  const gewandertRef = useRef(false)
  const klickSchluckenRef = useRef(false)
  /** Breite der Pille waehrend eines Zugs — fest, damit sie nicht zuckt. */
  const zugBreiteRef = useRef(0)
  /** Masse aller Plaetze, zuletzt gemessen. */
  const plaetzeRef = useRef<PlatzMass[]>([])

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
  }, [activeId, items])

  /** Wo die Pille steht, wenn sie auf einem Platz eingerastet ist. */
  function lageVon(id: string | null, kapselBreite: number): PilleLage | null {
    const platz = id ? plaetzeRef.current.find(p => p.id === id) : undefined
    if (!platz || !kapselBreite) return null
    const breite = pillenBreite(platz.breite)
    return { links: platz.links + (platz.breite - breite) / 2, breite, kapselBreite, frei: false }
  }

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
    ziehtRef.current = true
    gewandertRef.current = false
    zugBreiteRef.current = pillenBreite(auf.offsetWidth)
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
    setPille({ links, breite, kapselBreite: kapsel.offsetWidth, frei: true })

    const naechster = platzBei(plaetzeRef.current, x)
    if (!naechster || naechster === vorschauRef.current) return
    gewandertRef.current = true
    setzeVorschau(naechster)
    onPreviewChange?.(naechster)
  }

  const beiZeigerAuf = () => {
    if (!ziehtRef.current) return
    ziehtRef.current = false
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
    setGedrueckt(false)
    setzeVorschau(null)
    const kapsel = kapselRef.current
    if (kapsel) setPille(lageVon(activeId, kapsel.offsetWidth))
  }

  const beiKlick = (e: ReactMouseEvent<HTMLElement>) => {
    if (!klickSchluckenRef.current) return
    e.preventDefault()
    e.stopPropagation()
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

  return (
    <nav
      ref={kapselRef}
      aria-label={ariaLabel}
      className="tyd-tabbar flex items-stretch"
      data-gedrueckt={gedrueckt ? 'true' : 'false'}
      style={{ ['--tyd-glint' as string]: schimmer }}
      onPointerDown={beiZeigerAb}
      onPointerMove={beiZeigerBewegung}
      onPointerUp={beiZeigerAuf}
      onPointerCancel={beiZeigerAbbruch}
      onClickCapture={beiKlick}
    >
      <div
        className="tyd-tabbar-pill"
        data-tyd-pill
        data-gehalten={gedrueckt ? 'true' : 'false'}
        data-frei={pille?.frei ? 'true' : 'false'}
        data-ohne-ziel={pille ? 'false' : 'true'}
        data-linse={gedrueckt && pille ? 'true' : undefined}
        aria-hidden="true"
        style={pille
          ? { width: pille.breite, transform: `translateX(${pille.links}px)`, ['--pill-x' as string]: `${pille.links}px` }
          : undefined}
      >
        {/*
          Linse (Idee aus Glisse): Gehalten wird die Pille zur Glaslinse. In ihr
          liegt eine Kopie der Symbole, genau über den echten, und wird um die
          Mitte der Pille vergrößert — wie Glas, das die Leiste darunter bricht.
          Die Kopie läuft der Pille entgegen, damit sie stehen bleibt, während
          die Pille wandert. Nur solange ein Finger liegt.
        */}
        {gedrueckt && pille && (
          <div className="tyd-tabbar-linse" style={{ width: pille.kapselBreite, transform: `translateX(${-pille.links}px)` }}>
            <div className="tyd-tabbar-linse-zoom" style={{ transformOrigin: `${pille.links + pille.breite / 2}px 50%` }}>
              {plaetzeRef.current.map(p => {
                const item = items.find(i => i.id === p.id)
                if (!item) return null
                return (
                  <span key={p.id} className="tyd-tabbar-linse-platz" data-tyd-nah={p.id === vorschau ? 'true' : undefined} style={{ left: p.links, width: p.breite }}>
                    {item.icon}
                  </span>
                )
              })}
            </div>
          </div>
        )}
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
