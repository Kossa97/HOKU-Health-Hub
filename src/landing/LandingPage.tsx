import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowDown, BookOpen, Calculator, Droplets, Dumbbell, PersonStanding } from 'lucide-react'
import { HokuBuehne, useBuehne, type HandyGriff, type Ziel } from './HokuBuehne'
import { PhoneFrame, type VorschauScreen } from './PhoneFrame'
import { erkenneSprache, landingText, merkeSprache, type LandingSprache, type LandingTextKey } from './texte'

/**
 * Aufbau der Landing Page. Jeder Abschnitt hat einen Anker (`data-ld-anker`),
 * an dem Hoku steht, solange der Abschnitt das Bild bestimmt; Abschnitte mit
 * Handy-Vorschau lassen ihn hineintauchen (HokuBuehne.tsx).
 */
const APP_URL = 'https://hokuhealth.app'
const FEATURES: { screen: VorschauScreen; eyebrow: LandingTextKey; titel: LandingTextKey; text: LandingTextKey; tipp: LandingTextKey }[] = [
  { screen: 'heute', eyebrow: 'f_heute_eyebrow', titel: 'f_heute_titel', text: 'f_heute_text', tipp: 'f_heute_tipp' },
  { screen: 'kalorien', eyebrow: 'f_kalorien_eyebrow', titel: 'f_kalorien_titel', text: 'f_kalorien_text', tipp: 'f_kalorien_tipp' },
  { screen: 'tagebuch', eyebrow: 'f_tagebuch_eyebrow', titel: 'f_tagebuch_titel', text: 'f_tagebuch_text', tipp: 'f_tagebuch_tipp' },
]
const MEHR: { Icon: typeof Activity; titel: LandingTextKey; text: LandingTextKey }[] = [
  { Icon: PersonStanding, titel: 'mehr_injektionen', text: 'mehr_injektionen_text' },
  { Icon: Dumbbell, titel: 'mehr_training', text: 'mehr_training_text' },
  { Icon: Droplets, titel: 'mehr_blutwerte', text: 'mehr_blutwerte_text' },
  { Icon: Activity, titel: 'mehr_blutspiegel', text: 'mehr_blutspiegel_text' },
  { Icon: BookOpen, titel: 'mehr_peptipedia', text: 'mehr_peptipedia_text' },
  { Icon: Calculator, titel: 'mehr_rechner', text: 'mehr_rechner_text' },
]

export function LandingPage() {
  const [lang, setLang] = useState<LandingSprache>(() => erkenneSprache())
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const wechsle = (l: LandingSprache) => { setLang(l); merkeSprache(l) }
  return <HokuBuehne lang={lang} kinder={<Seite lang={lang} wechsle={wechsle} />} />
}

function Seite({ lang, wechsle }: { lang: LandingSprache; wechsle: (l: LandingSprache) => void }) {
  const t = useCallback((k: LandingTextKey) => landingText(lang, k), [lang])
  const buehne = useBuehne()!
  const handys = useRef(new Map<VorschauScreen, HandyGriff>())
  const seite = useRef<HTMLDivElement>(null)
  const weniger = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  // „Scroll runter" nur ganz oben; sobald gescrollt ist, blendet der Hinweis aus
  const [gescrollt, setGescrollt] = useState(false)
  useEffect(() => {
    const pruefe = () => setGescrollt(window.scrollY > 60)
    pruefe(); window.addEventListener('scroll', pruefe, { passive: true })
    return () => window.removeEventListener('scroll', pruefe)
  }, [])

  // Welcher Abschnitt bestimmt das Bild? Der mit dem größten sichtbaren Anteil; Handys zählen
  // erst, wenn sie gut halb zu sehen sind, sonst springt er zu früh hinein
  useEffect(() => {
    const root = seite.current
    if (!root) return
    let raf = 0
    const pruefe = () => {
      raf = 0
      const H = window.innerHeight
      let bester: { el: HTMLElement; wert: number } | null = null
      root.querySelectorAll<HTMLElement>('[data-ld-abschnitt]').forEach(el => {
        const r = el.getBoundingClientRect()
        const sichtbar = Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0))
        const wert = sichtbar / Math.min(r.height, H)
        if (!bester || wert > bester.wert + 0.05) bester = { el, wert }
      })
      if (!bester) return
      const { el } = bester as { el: HTMLElement }
      const screen = el.dataset.ldHandy as VorschauScreen | undefined
      if (screen) {
        const griff = handys.current.get(screen), rahmen = el.querySelector<HTMLElement>('.ld-handy')
        const r = rahmen?.getBoundingClientRect()
        const handySichtbar = r ? Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)) / r.height : 0
        if (griff && rahmen && handySichtbar > 0.55) { buehne.zielSetzen({ art: 'handy', griff, el: rahmen } as Ziel); return }
      }
      const anker = el.querySelector<HTMLElement>('[data-ld-anker]')
      if (anker) buehne.zielSetzen({ art: 'anker', el: anker })
    }
    const plane = () => { if (!raf) raf = requestAnimationFrame(pruefe) }
    pruefe()
    window.addEventListener('scroll', plane, { passive: true })
    window.addEventListener('resize', plane)
    return () => { window.removeEventListener('scroll', plane); window.removeEventListener('resize', plane); cancelAnimationFrame(raf) }
  }, [buehne])

  // Auftritt im Hero: Eröffnung, winken, „Hey, ich bin Hoku!", Herz — wie auf der Anmeldung
  const begruesst = useRef(false)
  useEffect(() => {
    const d = buehne.dot()
    if (!buehne.bereit || !d || begruesst.current) return
    begruesst.current = true
    let aktiv = true
    const warte = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms))
    void (async () => {
      await warte(150)
      if (weniger) { buehne.sag('h_scroll', 5000); return }
      const dauer = d.eroeffnung()
      await warte(dauer ? dauer * 1000 - 300 : 600)
      if (!aktiv) return
      d.zeigeForm('hand'); await warte(1300); if (!aktiv) return
      d.zeigeForm(null)
      await buehne.schreibe('h_hey', 2300); if (!aktiv) return
      d.zeigeForm('heart'); await warte(1400); if (!aktiv) return
      d.zeigeForm(null)
      await warte(4500); if (!aktiv || buehne.istDrin()) return
      buehne.sag('h_scroll', 4200)
      await warte(9000); if (!aktiv || buehne.istDrin()) return
      buehne.sag('h_tipp', 4200)
    })()
    return () => { aktiv = false }
  }, [buehne, weniger])

  const geste = async (art: 'hallo' | 'tag' | 'freude') => {
    const d = buehne.dot()
    if (!d || buehne.istDrin()) return
    if (art === 'hallo') { d.zeigeForm('hand'); buehne.sag('h_hallo', 3000); window.setTimeout(() => d.zeigeForm(null), 1400) }
    if (art === 'tag') { d.setStimmung('think'); window.setTimeout(() => { d.setStimmung('speak'); buehne.sag('h_tag', 4200) }, 900); window.setTimeout(() => d.setStimmung('idle'), 3200) }
    if (art === 'freude') { d.zeigeForm('freude'); buehne.sag('h_freude', 2800); window.setTimeout(() => d.zeigeForm(null), 1800) }
  }

  return (
    <div ref={seite}>
      <header className="ld-kopf">
        <a className="ld-wortmarke" href="#top" aria-label="HOKU">
          <img src={`${import.meta.env.BASE_URL}icons/hoku-fav-organisch-v3-48.png`} alt="" width={28} height={28} />
          <span>HOKU</span>
        </a>
        <div className="ld-kopf-rechts">
          <div className="ld-sprache" role="group" aria-label={t('sprache')}>
            {(['de', 'en'] as const).map(l => (
              <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => wechsle(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <a className="ld-knopf" data-art="klein" href={APP_URL}>{t('app_oeffnen')}</a>
        </div>
      </header>

      <main id="top">
        <section className="ld-abschnitt ld-hero" data-ld-abschnitt>
          <div>
            <div className="ld-hero-marke" aria-hidden="true">
              <span className="ld-hoku">HOKU</span>
              <span className="ld-hub">{t('hero_eyebrow')}</span>
            </div>
            <h1>{t('hero_titel')}</h1>
            <p className="ld-text">{t('hero_text')}</p>
            <div className="ld-hero-knoepfe">
              <a className="ld-knopf" data-art="haupt" href={APP_URL}>{t('hero_cta')}</a>
              <a className="ld-knopf" data-art="glas" href="#hoku">{t('hero_cta2')}</a>
            </div>
          </div>
          <div className="ld-hero-buehne"><div className="ld-anker" data-ld-anker style={{ position: 'absolute', inset: '0 0 10% 0' }} /></div>
          <div className="ld-hero-scroll" aria-hidden="true" data-aus={gescrollt ? 'true' : undefined}><span>{t('hero_scroll')}</span><ArrowDown size={16} /></div>
        </section>

        <section className="ld-abschnitt" id="hoku" data-ld-abschnitt>
          <div className="ld-hoku-kopf">
            <div>
              <p className="ld-eyebrow">{t('hoku_eyebrow')}</p>
              <h2 className="ld-h2">{t('hoku_titel')}</h2>
              <p className="ld-text">{t('hoku_text')}</p>
            </div>
            <div className="ld-hoku-buehne"><div className="ld-anker" data-ld-anker style={{ height: '100%' }} /></div>
          </div>
          <div className="ld-hoku-karten">
            {([['hoku_k1', 'hallo'], ['hoku_k2', 'tag'], ['hoku_k3', 'freude']] as const).map(([k, art]) => (
              <div key={k} className="lg-surface lg-flat ld-karte">
                <h3>{t(`${k}_titel`)}</h3>
                <p>{t(`${k}_text`)}</p>
                <button type="button" className="ld-knopf" data-art="glas" onClick={() => void geste(art)}>{t(`${k}_knopf`)}</button>
              </div>
            ))}
          </div>
        </section>

        <section className="ld-abschnitt" style={{ paddingBottom: 0 }}>
          <p className="ld-eyebrow">{t('features_eyebrow')}</p>
          <h2 className="ld-h2">{t('features_titel')}</h2>
          <p className="ld-text">{t('features_text')}</p>
        </section>
        {FEATURES.map((f, i) => (
          <section key={f.screen} className="ld-abschnitt ld-feature" data-ld-abschnitt data-ld-handy={f.screen} data-seite={i % 2 ? 'links' : 'rechts'}>
            <div className="ld-feature-text">
              <p className="ld-eyebrow">{t(f.eyebrow)}</p>
              <h2 className="ld-h2">{t(f.titel)}</h2>
              <p className="ld-text">{t(f.text)}</p>
              <p className="ld-tipp">{t(f.tipp)}</p>
              {/* Steht das Handy noch nicht gut im Bild, wartet Hoku hier neben dem Text */}
              <div className="ld-anker ld-feature-anker" data-ld-anker />
            </div>
            <div className="ld-feature-handy">
              <div>
                <PhoneFrame screen={f.screen} lang={lang} titel={t(f.titel)} ref={g => { if (g) handys.current.set(f.screen, g); else handys.current.delete(f.screen) }} />
              </div>
            </div>
          </section>
        ))}

        <section className="ld-abschnitt" data-ld-abschnitt>
          <p className="ld-eyebrow">{t('mehr_eyebrow')}</p>
          <h2 className="ld-h2">{t('mehr_titel')}</h2>
          <div className="ld-mehr-raster">
            {MEHR.map(m => (
              <div key={m.titel} className="lg-surface lg-flat ld-mehr-karte">
                <m.Icon size={22} />
                <h3>{t(m.titel)}</h3>
                <p>{t(m.text)}</p>
                <small>{t('mehr_bald')}</small>
              </div>
            ))}
          </div>
          <div className="ld-anker" data-ld-anker style={{ position: 'absolute', right: 'var(--ld-rand)', top: 80, width: 160, height: 160 }} />
        </section>

        <section className="ld-abschnitt ld-cta" data-ld-abschnitt>
          <div className="ld-cta-buehne"><div className="ld-anker" data-ld-anker style={{ height: '100%', margin: '0 auto', width: 240 }} /></div>
          <h2 className="ld-h2">{t('cta_titel')}</h2>
          <p className="ld-text">{t('cta_text')}</p>
          <div className="ld-hero-knoepfe" style={{ justifyContent: 'center' }}>
            <a className="ld-knopf" data-art="haupt" href={APP_URL}>{t('cta_knopf')}</a>
          </div>
          <div className="ld-stores" aria-hidden="true">
            <span className="ld-store"> {t('bald_ios')}</span>
            <span className="ld-store">▶ {t('bald_android')}</span>
          </div>
        </section>
      </main>

      <footer className="ld-fuss">
        <nav>
          <a href={`${APP_URL}/datenschutz`}>{t('datenschutz')}</a>
          <a href={`${APP_URL}/impressum`}>{t('impressum')}</a>
          <a href={`${APP_URL}/nutzungsbedingungen`}>{t('nutzung')}</a>
        </nav>
        <p>{t('fuss_hinweis')}</p>
      </footer>
    </div>
  )
}
