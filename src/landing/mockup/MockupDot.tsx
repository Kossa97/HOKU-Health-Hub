import { useEffect, useRef } from 'react'
import { createDot, type DotApi } from '../../features/dot/engine/dotEngine'
import { dotStore } from '../../features/dot/dotStore'
import { useDotText } from '../../features/dot/texte'
import '../../features/dot/dot.css'

/**
 * Hoku in der Vorschau: dieselbe Engine und dieselbe Leiste wie in der App
 * (`DotLayer.tsx` ohne Konto, Kontext und Chat). Er wohnt in der Leiste; die
 * Landing Page ruft ihn über `postMessage` heraus („rein") und heim („raus").
 */
const leisteFinden = () => {
  const kapsel = document.querySelector<HTMLElement>('.tyd-tabdock .tyd-tabbar')
  const logo = document.querySelector<HTMLElement>('.tyd-tabdock [data-tyd-slot="dot"]')
  if (!kapsel || !logo) return null
  return {
    kapsel, logo,
    plus: document.querySelector<HTMLElement>('.tyd-tabdock .tyd-tabdock-action'),
    spalt: document.querySelector<HTMLElement>('.tyd-tabdock .tyd-dot-spalt'),
  }
}

export function MockupDot({ gruss, beiAntippen, beiBereit }: { gruss: () => string; beiAntippen: (dot: DotApi) => void; beiBereit: (dot: DotApi) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const glCanvas = useRef<HTMLCanvasElement>(null)
  const hit = useRef<HTMLButtonElement>(null)
  const blase = useRef<HTMLDivElement>(null)
  const api = useRef<DotApi | null>(null)
  const { dt } = useDotText()
  const dtRef = useRef(dt)
  useEffect(() => { dtRef.current = dt }, [dt])
  const grussRef = useRef(gruss); useEffect(() => { grussRef.current = gruss }, [gruss])
  const tippRef = useRef(beiAntippen); useEffect(() => { tippRef.current = beiAntippen }, [beiAntippen])
  const bereitRef = useRef(beiBereit); useEffect(() => { bereitRef.current = beiBereit }, [beiBereit])

  useEffect(() => {
    if (api.current || !canvas.current || !glCanvas.current || !hit.current || !blase.current) return
    const weniger = matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = (k: Parameters<typeof dt>[0]) => dtRef.current(k)
    const uhr = () => { const j = new Date(); return `${j.getHours()}:${String(j.getMinutes()).padStart(2, '0')}` }
    const neu = api.current = createDot({
      canvas: canvas.current, glCanvas: glCanvas.current, hit: hit.current, blase: blase.current, weniger,
      leiste: leisteFinden,
      texte: {
        wach: () => t('wach'), kitzeln: () => t('kitzeln'), schwindel: () => t('schwindel'), tschuess: () => t('tschuess'),
        daBin: () => t('da_bin'), gruss: () => grussRef.current(), uhr: () => uhr(),
      },
      beiAntippen: () => tippRef.current(neu),
      beiZustand: z => dotStore.melde(z),
    })
    dotStore.verbinde(neu, null)
    dotStore.setZugang(true, true)
    dotStore.setApp({ mitLeiste: true, schnellzugriff: false })
    neu.setSeite({ leiste: true, kamera: false, darfRaus: true })
    bereitRef.current(neu)
    return () => { neu.zerstoeren(); api.current = null; dotStore.verbinde(null, null) }
  }, [])

  // Blätter: er tritt zurück
  useEffect(() => {
    const pruefe = () => api.current?.setZurueck(!!document.querySelector('[data-app-modal]'))
    const beob = new MutationObserver(pruefe)
    beob.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-app-modal'] })
    return () => beob.disconnect()
  }, [])

  return (
    <div className="tyd-dot-ebene" data-buehne="false">
      <canvas ref={canvas} className="tyd-dot-flaeche" />
      <canvas ref={glCanvas} className="tyd-dot-flaeche" />
      <button ref={hit} type="button" className="tyd-dot-treffer" aria-label={dt('figur')} hidden />
      <div ref={blase} className="tyd-dot-blase" role="status" />
    </div>
  )
}
