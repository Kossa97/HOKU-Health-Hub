import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { HandyGriff } from './HokuBuehne'
import type { LandingSprache } from './texte'

/**
 * Ein Handy-Rahmen mit einer echten Vorschau der App darin: ein eigenes
 * Fenster (`landing-mockup.html`), weil Hokus Engine und die Leiste mit dem
 * Fenster rechnen (innerWidth, feste Ebenen). Die Vorschau hat 390 × 760 px
 * und wird auf die verfügbare Breite skaliert.
 *
 * Nachrichten: die Seite sagt dem Fenster „rein"/„raus" (Hoku klingeln bzw.
 * heimschicken) und die Sprache; das Fenster meldet „bereit".
 */

export const HANDY_B = 390
export const HANDY_H = 760
/** Leiste wie in der App (index.css): Abstand 16, Lücke 10 zum Plus (56), Kapsel 56 hoch, 10 über dem Rand. */
const DOCK = { rand: 16, luecke: 10, plus: 56, kapsel: 56, unten: 10 }

export type VorschauScreen = 'heute' | 'kalorien' | 'tagebuch'

export const PhoneFrame = forwardRef<HandyGriff, { screen: VorschauScreen; lang: LandingSprache; titel: string }>(function PhoneFrame({ screen, lang, titel }, ref) {
  const huelle = useRef<HTMLDivElement>(null)
  const iframe = useRef<HTMLIFrameElement>(null)
  const [bereit, setBereit] = useState(false)
  const [skala, setSkala] = useState(0.8)

  // Breite des Platzes → Maßstab
  useEffect(() => {
    const el = huelle.current?.parentElement
    if (!el) return
    const messe = () => setSkala(Math.min(1, el.clientWidth / HANDY_B))
    messe()
    const ro = new ResizeObserver(messe)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sende = (nachricht: Record<string, unknown>) => {
    iframe.current?.contentWindow?.postMessage({ hoku: true, ...nachricht }, '*')
  }
  useEffect(() => {
    const beiNachricht = (e: MessageEvent) => {
      if (e.source !== iframe.current?.contentWindow) return
      const d = e.data as { hoku?: boolean; art?: string }
      if (!d?.hoku) return
      if (d.art === 'bereit') { setBereit(true); sende({ art: 'sprache', lang }) }
    }
    window.addEventListener('message', beiNachricht)
    return () => window.removeEventListener('message', beiNachricht)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Sprache geht beim Bereit-Signal mit; Wechsel unten
  }, [])
  useEffect(() => { if (bereit) sende({ art: 'sprache', lang }) }, [bereit, lang])

  useImperativeHandle(ref, () => ({
    logoPunkt() {
      const r = huelle.current?.getBoundingClientRect()
      if (!r) return { x: 0, y: 0 }
      const s = r.width / HANDY_B
      const kapselBreite = HANDY_B - 2 * DOCK.rand - DOCK.luecke - DOCK.plus
      return { x: r.left + (DOCK.rand + kapselBreite / 2) * s, y: r.top + (HANDY_H - DOCK.unten - DOCK.kapsel / 2) * s }
    },
    rein: () => sende({ art: 'rein' }),
    raus: () => sende({ art: 'raus' }),
  }), [])

  const src = `./landing-mockup.html?screen=${screen}&lang=${lang}`
  return (
    <div ref={huelle} className="ld-handy" style={{ width: HANDY_B * skala, height: HANDY_H * skala }} data-bereit={bereit ? 'true' : 'false'}>
      <div className="ld-handy-schirm" style={{ transform: `scale(${skala})` }}>
        <iframe ref={iframe} title={titel} src={src} width={HANDY_B} height={HANDY_H} loading="lazy" />
      </div>
    </div>
  )
})
