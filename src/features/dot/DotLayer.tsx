import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { TAB_ITEMS } from '../../components/navigation/tabModel'
import { createDot, warDraussen, type DotApi } from './engine/dotEngine'
import { dauerText } from './engine/geometry'
import { dotStore, useDotStand } from './dotStore'
import { localDateTimeKey } from '../../lib/planTimeline'
import { heuteOffen, kontextVonHeute, ladeDotKontext, type DotKontext } from './lib/dotKontext'
import { useDotZugang } from './lib/zugang'
import { useDotText } from './texte'
import { CoachPanel, type DotSeite } from './chat/CoachPanel'
import './dot.css'

/**
 * Dots Ebene über der App: eine Zeichenfläche über allem, seine
 * Trefferfläche, seine Sprechblase und das Chatfenster. Hier kommt zusammen,
 * was die Engine über die App wissen muss: welche Seite gerade gilt (mit oder
 * ohne Leiste, Kamera), ob ein Blatt offen ist, wie hoch die Tastatur ist und
 * ob er heraus darf.
 */

export interface DotLayerProps {
  pathname: string
  mitLeiste: boolean
  schnellzugriffOffen: boolean
}

function seiteVon(pathname: string): DotSeite {
  if (pathname === '/') return 'home'
  if (pathname === '/my-stack') return 'my-stack'
  if (pathname === '/kalender') return 'kalender'
  if (pathname === '/ernaehrung') return 'ernaehrung'
  return 'sonst'
}

const leisteFinden = () => {
  const kapsel = document.querySelector<HTMLElement>('.tyd-tabdock .tyd-tabbar')
  const logo = document.querySelector<HTMLElement>('.tyd-tabdock [data-tyd-slot="dot"]')
  if (!kapsel || !logo) return null
  return {
    kapsel,
    logo,
    plus: document.querySelector<HTMLElement>('.tyd-tabdock .tyd-tabdock-action'),
    spalt: document.querySelector<HTMLElement>('.tyd-tabdock .tyd-dot-spalt'),
  }
}

export function DotLayer({ pathname, mitLeiste, schnellzugriffOffen }: DotLayerProps) {
  const { user } = useAuth()
  const { dt } = useDotText()
  const zugang = useDotZugang()
  const stand = useDotStand()
  const canvas = useRef<HTMLCanvasElement>(null)
  const glCanvas = useRef<HTMLCanvasElement>(null)
  const hit = useRef<HTMLButtonElement>(null)
  const blase = useRef<HTMLDivElement>(null)
  const [dot, setDot] = useState<DotApi | null>(null)
  // `inhalt`: der Chat steht im DOM, solange er offen ist und noch kurz beim Schließen (Kreis zieht sich zu)
  const [chat, setChat] = useState<{ offen: boolean; inhalt: boolean; x: number; y: number }>({ offen: false, inhalt: false, x: 0, y: 0 })
  const zuT = useRef(0)
  const kontext = useRef<{ wert: DotKontext | null; zeit: number }>({ wert: null, zeit: 0 })
  const dtRef = useRef(dt)
  useEffect(() => { dtRef.current = dt }, [dt])

  // Kontext für Sprechblasen: höchstens alle 2 Minuten neu. Der Chat lädt
  // immer frisch — er soll nie eine gerade eingetragene Einnahme als offen nennen.
  const holeKontext = useCallback(async (frisch = false) => {
    if (!user) return null
    const k = kontext.current.wert
    if (!frisch && k && kontextVonHeute(k) && Date.now() - kontext.current.zeit < 120_000) return k
    const wert = await ladeDotKontext(user.id)
    kontext.current = { wert, zeit: Date.now() }
    return wert
  }, [user])
  const holeKontextFuerChat = useCallback(() => holeKontext(true), [holeKontext])
  // Für die Sprechblasen: nur ein Kontext von heute, sonst im Hintergrund neu laden
  const aktuellerKontext = useRef<() => DotKontext | null>(() => null)
  useEffect(() => {
    aktuellerKontext.current = () => {
      const k = kontext.current.wert
      if (k && kontextVonHeute(k)) {
        if (Date.now() - kontext.current.zeit > 120_000) void holeKontext().catch(() => null)
        return k
      }
      void holeKontext().catch(() => null)
      return null
    }
  }, [holeKontext])
  const jetztIn = (k: DotKontext) => localDateTimeKey(new Date(), k.zeitzone).slice(11, 16)

  // Engine einmal anlegen
  useEffect(() => {
    if (!canvas.current || !glCanvas.current || !hit.current || !blase.current) return
    const weniger = matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = (k: Parameters<typeof dt>[0], v?: Record<string, string | number>) => dtRef.current(k, v)
    const tagesgruss = () => {
      const h = new Date().getHours()
      return t(h >= 5 && h < 11 ? 'gruss_morgen' : h >= 11 && h < 17 ? 'gruss_tag' : h >= 17 && h < 22 ? 'gruss_abend' : 'gruss_nacht')
    }
    const api = createDot({
      canvas: canvas.current,
      glCanvas: glCanvas.current,
      hit: hit.current,
      blase: blase.current,
      weniger,
      leiste: leisteFinden,
      texte: {
        wach: () => t('wach'),
        kitzeln: () => t('kitzeln'),
        schwindel: () => t('schwindel'),
        tschuess: () => t('tschuess'),
        daBin: () => t('da_bin'),
        gruss: () => {
          const k = aktuellerKontext.current()
          if (!k) return tagesgruss()
          const h = heuteOffen(k, jetztIn(k))
          const rest = h.naechste
            ? t(h.naechste.menge ? 'naechste_menge' : 'naechste', { zeit: h.naechste.zeit, substanz: h.naechste.substanz, menge: h.naechste.menge ?? '' })
            : h.geplant ? t('alles_erledigt') : t('nichts_geplant')
          return `${tagesgruss()} ${rest}`
        },
        uhr: () => {
          const jetzt = new Date()
          const uhr = `${jetzt.getHours()}:${String(jetzt.getMinutes()).padStart(2, '0')}`
          const k = aktuellerKontext.current()
          if (!k) return uhr
          const h = heuteOffen(k, jetztIn(k))
          if (h.verpasst) return t('uhr_verpasst', { uhr, substanz: h.verpasst.substanz, zeit: h.verpasst.zeit })
          if (h.naechste) return t('uhr_bis', { uhr, substanz: h.naechste.substanz, dauer: dauerText(h.naechste.minuten - h.minuten, t('std'), t('min')) })
          if (h.offen) return t('uhr_offen', { uhr, anzahl: h.offen })
          return t('uhr_erledigt', { uhr })
        },
      },
      beiAntippen: () => {
        const r = hit.current?.getBoundingClientRect()
        window.clearTimeout(zuT.current)
        setChat({ offen: true, inhalt: true, x: r ? r.left + r.width / 2 : window.innerWidth / 2, y: r ? r.top + r.height / 2 : window.innerHeight / 2 })
      },
      beiZustand: z => dotStore.melde(z),
    })
    setDot(api)
    return () => { api.zerstoeren(); dotStore.verbinde(null, null); setDot(null) }
  }, [])

  // Mit dem Logo verbinden; gesperrt heißt: Hinweis auf Pro
  useEffect(() => {
    dotStore.verbinde(dot, () => toast(`${dtRef.current('gesperrt_titel')}\n${dtRef.current('gesperrt_text')}`, { duration: 4500, id: 'dot-pro' }))
  }, [dot])
  useEffect(() => { dotStore.setZugang(zugang.darfRaus, zugang.geladen) }, [zugang.darfRaus, zugang.geladen])

  // Kontext vorladen, sobald er heraus darf (für den Gruß)
  useEffect(() => { if (zugang.darfRaus) void holeKontext().catch(() => null) }, [zugang.darfRaus, holeKontext, pathname])

  // War er beim letzten Mal draußen, kommt er beim Start wieder heraus
  const gestartet = useRef(false)
  useEffect(() => {
    if (!dot || !zugang.geladen || gestartet.current) return
    gestartet.current = true
    if (zugang.darfRaus && warDraussen()) window.setTimeout(() => dot.klingeln(), 900)
  }, [dot, zugang.geladen, zugang.darfRaus])

  // Seitenwechsel: mit oder ohne Leiste, Kamera, Richtung für das Nachwabbeln
  const vorherPfad = useRef(pathname)
  useEffect(() => {
    if (!dot) return
    const ia = TAB_ITEMS.findIndex(t => t.route === vorherPfad.current), ib = TAB_ITEMS.findIndex(t => t.route === pathname)
    const richtung = vorherPfad.current === pathname ? 0 : ia >= 0 && ib >= 0 ? Math.sign(ib - ia) : 1
    vorherPfad.current = pathname
    dot.setSeite({ leiste: mitLeiste, kamera: stand.kameras > 0, darfRaus: zugang.geladen && zugang.darfRaus, richtung })
  }, [dot, pathname, mitLeiste, stand.kameras, zugang.geladen, zugang.darfRaus])

  // Blätter und Dialoge: er tritt zurück, gedimmt unter dem Schleier
  useEffect(() => {
    if (!dot) return
    const pruefe = () => {
      const offen = schnellzugriffOffen || !!document.querySelector('[data-app-modal]:not([data-dot-chat])')
      dot.setZurueck(offen)
    }
    pruefe()
    const beob = new MutationObserver(pruefe)
    beob.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-app-modal'] })
    return () => beob.disconnect()
  }, [dot, schnellzugriffOffen])

  // Tastatur: ihre Oberkante wird zum Boden, sie schiebt ihn nach oben
  useEffect(() => {
    if (!dot) return
    const vv = window.visualViewport
    if (!vv) return
    const messe = () => dot.setTastatur(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', messe)
    return () => vv.removeEventListener('resize', messe)
  }, [dot])

  const schliessen = useCallback(() => {
    setChat(c => ({ ...c, offen: false }))
    window.clearTimeout(zuT.current)
    zuT.current = window.setTimeout(() => setChat(c => (c.offen ? c : { ...c, inhalt: false })), 500)
  }, [])
  const heim = useCallback(() => {
    schliessen()
    window.setTimeout(() => dot?.heimgehen(), 480)
  }, [dot, schliessen])

  return (
    <>
      <div className="tyd-dot-ebene" data-buehne={chat.offen ? 'true' : 'false'} aria-hidden={stand.drinnen}>
        <canvas ref={canvas} className="tyd-dot-flaeche" />
        <canvas ref={glCanvas} className="tyd-dot-flaeche" />
        <button ref={hit} type="button" className="tyd-dot-treffer" aria-label={dt('figur')} hidden />
        <div ref={blase} className="tyd-dot-blase" role="status" />
      </div>
      <CoachPanel
        offen={chat.offen}
        inhalt={chat.inhalt}
        ursprung={{ x: chat.x, y: chat.y }}
        seite={seiteVon(pathname)}
        einwilligung={zugang.einwilligung}
        setEinwilligung={zugang.setEinwilligung}
        kontext={holeKontextFuerChat}
        dot={dot}
        onSchliessen={schliessen}
        onHeim={heim}
      />
    </>
  )
}
