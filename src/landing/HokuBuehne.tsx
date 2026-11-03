import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createDot, type DotApi, type DotForm } from '../features/dot/engine/dotEngine'
import '../features/dot/dot.css'
import { hokuStimme, landingText, type LandingSprache, type LandingTextKey } from './texte'

/**
 * Hoku auf der Landing Page: dieselbe Engine wie in der App, im Modus der
 * Anmeldung (`loginBuehne`): er steht auf einer Bühne, lässt sich ziehen und
 * werfen und kehrt dorthin zurück. Die Bühne ist hier ein fester, unsichtbarer
 * Rahmen, den diese Datei Bild für Bild einem Anker auf der Seite nachführt —
 * so „fliegt" Hoku von Abschnitt zu Abschnitt, und seine Größe folgt der
 * Höhe des Rahmens (die Engine nimmt 26 % der Bühnenhöhe, höchstens 66 px).
 *
 * Abtauchen in eine Handy-Vorschau: der Rahmen schrumpft auf das Logo in der
 * Leiste der Vorschau, Hoku wird klein, die Engine verlässt die Bühne, und im
 * Rahmen klingelt ein zweiter Hoku (derselbe Code, eigenes Fenster) heraus.
 * Auftauchen geht den Weg zurück.
 */

export interface HandyGriff {
  /** Mitte seines Logos in der Leiste, in Bildschirm-Pixeln. */
  logoPunkt(): { x: number; y: number }
  /** Den Hoku im Rahmen rufen bzw. heimschicken. */
  rein(): void
  raus(): void
}

export type Ziel = { art: 'anker'; el: HTMLElement } | { art: 'handy'; griff: HandyGriff; el: HTMLElement }

export interface BuehnenApi {
  dot(): DotApi | null
  /** Die Engine steht (ändert sich einmal; wer es braucht, rendert dann neu). */
  bereit: boolean
  /** Wohin Hoku jetzt gehört; die Bühne folgt, er fliegt. */
  zielSetzen(ziel: Ziel | null): void
  sag(key: LandingTextKey, ms?: number): void
  zeige(form: DotForm | null): void
  schreibe(key: LandingTextKey, ms: number): Promise<void>
  /** Hoku ist gerade im Handy (oder unterwegs dorthin). */
  istDrin(): boolean
}

const Kontext = createContext<BuehnenApi | null>(null)
export const useBuehne = () => useContext(Kontext)

const FLUG_MS = 1100
const TAUCH_MS = 420
const AUFTAUCH_MS = 1150
const ZIEL_GROESSE = 44
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

interface Rahmen { x: number; y: number; w: number; h: number }
const rahmenVon = (el: HTMLElement): Rahmen => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } }
const punktRahmen = (p: { x: number; y: number }): Rahmen => ({ x: p.x - ZIEL_GROESSE / 2, y: p.y - ZIEL_GROESSE / 2, w: ZIEL_GROESSE, h: ZIEL_GROESSE })

export function HokuBuehne({ lang, kinder }: { lang: LandingSprache; kinder: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const glCanvas = useRef<HTMLCanvasElement>(null)
  const hit = useRef<HTMLButtonElement>(null)
  const blase = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const api = useRef<DotApi | null>(null)
  const [dot, setDot] = useState<DotApi | null>(null)
  const langRef = useRef(lang)
  useEffect(() => { langRef.current = lang }, [lang])
  const weniger = useMemo(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // Lage der Bühne, Flug und Zustand — alles außerhalb von React, je Bild gelesen
  const S = useRef({
    rahmen: null as Rahmen | null,
    zielRahmen: (): Rahmen | null => null,
    flug: null as { von: Rahmen; t0: number } | null,
    ziel: null as Ziel | null,
    zustand: 'auf' as 'auf' | 'taucht' | 'drin' | 'kommt',
    drinBei: null as HandyGriff | null,
    timer: 0,
    lauf: 0,
    antipp: 0,
  })

  // Engine anlegen, sobald die Flächen stehen
  useEffect(() => {
    if (api.current || !canvas.current || !glCanvas.current || !hit.current || !blase.current) return
    const t = (k: LandingTextKey) => landingText(langRef.current, k)
    const neu = api.current = createDot({
      canvas: canvas.current,
      glCanvas: glCanvas.current,
      hit: hit.current,
      blase: blase.current,
      weniger,
      leiste: () => null,
      texte: hokuStimme(() => langRef.current),
      beiAntippen: () => {
        const reihe: LandingTextKey[] = ['h_angetippt_1', 'h_angetippt_2', 'h_angetippt_3']
        const k = reihe[S.current.antipp++ % reihe.length]
        neu.setStimmung('speak'); neu.sag(t(k), 3200)
        window.setTimeout(() => neu.setStimmung('idle'), 1600)
      },
    })
    // Die Kinder (Seite) haben ihr Ziel schon gesetzt, bevor die Engine stand: jetzt die Bühne betreten
    if (S.current.ziel?.art === 'anker' && stage.current) neu.loginBuehne(stage.current)
    setDot(neu)
    return () => { neu.zerstoeren(); api.current = null; setDot(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal
  }, [])
  // Sprachwechsel: die Engine ruft ihre Texte je Satz ab (hokuStimme liest `langRef`); eine offene Blase schließt
  useEffect(() => { dot?.schweige() }, [dot, lang])

  // Bild für Bild: Bühne dem Ziel nachführen
  useEffect(() => {
    if (!dot || !stage.current) return
    const el = stage.current
    let raf = 0
    const schritt = (now: number) => {
      const s = S.current
      const Z = s.zielRahmen()
      if (Z) {
        let R = Z
        if (s.flug) {
          const t = Math.min(1, (now - s.flug.t0) / FLUG_MS)
          const e = ease(t), bogen = -Math.min(90, Math.hypot(Z.x - s.flug.von.x, Z.y - s.flug.von.y) * 0.18) * Math.sin(Math.PI * t)
          R = {
            x: s.flug.von.x + (Z.x - s.flug.von.x) * e,
            y: s.flug.von.y + (Z.y - s.flug.von.y) * e + bogen,
            w: s.flug.von.w + (Z.w - s.flug.von.w) * e,
            h: s.flug.von.h + (Z.h - s.flug.von.h) * e,
          }
          if (t >= 1) s.flug = null
        }
        s.rahmen = R
        el.style.transform = `translate(${R.x}px, ${R.y}px)`
        el.style.width = `${R.w}px`; el.style.height = `${R.h}px`
      }
      raf = requestAnimationFrame(schritt)
    }
    raf = requestAnimationFrame(schritt)
    return () => cancelAnimationFrame(raf)
  }, [dot])

  const ebene = useRef<HTMLDivElement>(null)
  const buehne = useMemo<BuehnenApi>(() => {
    const s = S.current
    // Drinnen (im Handy) ist die Ebene der Seite ganz aus: nichts flackert am Logo nach
    const ebeneZeigen = (an: boolean) => { if (ebene.current) ebene.current.hidden = !an }
    /** Bühne zum Ziel fliegen; `false`, wenn es keinen Flug gibt (erster Platz, weniger Bewegung). */
    const flugZu = (ziel: () => Rahmen | null) => {
      const von = s.rahmen
      s.zielRahmen = ziel
      if (von && !weniger) { s.flug = { von, t0: performance.now() }; return true }
      s.flug = null
      return false
    }
    const abgleich = () => {
      const d = api.current, z = s.ziel
      if (!d || !z || !stage.current) return
      // unterwegs (taucht / kommt): der laufende Timer ruft abgleich() am Ende erneut und liest dann das neue Ziel
      if (s.zustand === 'taucht' || s.zustand === 'kommt') return
      window.clearTimeout(s.timer)
      const lauf = ++s.lauf
      if (s.zustand === 'auf') {
        if (z.art === 'anker') { flugZu(() => rahmenVon(z.el)); return }
        d.schweige()
        if (weniger) { s.zustand = 'drin'; s.drinBei = z.griff; d.verlasseLogin(); ebeneZeigen(false); z.griff.rein(); return }
        // abtauchen: zum Logo fliegen, klein werden, dann verschwinden — und drinnen klingeln
        s.zustand = 'taucht'
        const fliegt = flugZu(() => punktRahmen(z.griff.logoPunkt()))
        s.timer = window.setTimeout(() => {
          if (lauf !== s.lauf) return
          if (s.ziel === z) { d.verlasseLogin(); ebeneZeigen(false); s.zustand = 'drin'; s.drinBei = z.griff; z.griff.rein() }
          else { s.zustand = 'auf'; abgleich() }
        }, fliegt ? FLUG_MS + TAUCH_MS : 0)
        return
      }
      if (s.zustand === 'drin') {
        const von = s.drinBei
        if (!von || (z.art === 'handy' && z.griff === von)) return
        // auftauchen: drinnen heimgehen, dann klein am Logo erscheinen und weiterfliegen
        s.zustand = 'kommt'; von.raus()
        s.timer = window.setTimeout(() => {
          if (lauf !== s.lauf) return
          s.rahmen = punktRahmen(von.logoPunkt()); s.zielRahmen = () => s.rahmen; s.flug = null
          const st = stage.current!
          st.style.transform = `translate(${s.rahmen.x}px, ${s.rahmen.y}px)`; st.style.width = st.style.height = `${ZIEL_GROESSE}px`
          ebeneZeigen(true); d.loginBuehne(st)
          s.zustand = 'auf'; s.drinBei = null
          abgleich()
        }, weniger ? 0 : AUFTAUCH_MS)
        return
      }
      // taucht / kommt: der laufende Timer ruft abgleich() erneut
    }
    return {
      dot: () => api.current,
      bereit: !!dot,
      zielSetzen: ziel => {
        // Die Seite baut ihr Ziel je Scroll-Bild neu: gleicher Anker bzw. gleiches Handy heißt gleiches Ziel
        const alt = s.ziel
        if (ziel === alt || (ziel && alt && ziel.art === alt.art && ziel.el === alt.el)) return
        s.ziel = ziel
        // Vorgänger-Bühne: beim ersten Ziel steht Hoku noch nirgends — direkt hin, ohne Flug
        if (!s.rahmen && ziel?.art === 'anker') {
          s.rahmen = rahmenVon(ziel.el); s.zielRahmen = () => rahmenVon(ziel.el)
          const st = stage.current
          if (st) { st.style.transform = `translate(${s.rahmen.x}px, ${s.rahmen.y}px)`; st.style.width = `${s.rahmen.w}px`; st.style.height = `${s.rahmen.h}px` }
          api.current?.loginBuehne(st!)
          return
        }
        abgleich()
      },
      sag: (key, ms) => { api.current?.sag(landingText(langRef.current, key), ms) },
      zeige: form => { api.current?.zeigeForm(form) },
      schreibe: async (key, ms) => {
        const d = api.current
        if (!d) return
        const text = landingText(langRef.current, key)
        await d.bereiteTexte([text])
        d.zeigeText(text)
        await new Promise(r => window.setTimeout(r, ms))
        d.zeigeText(null)
      },
      istDrin: () => s.zustand !== 'auf',
    }
  }, [weniger, dot])

  return (
    <Kontext.Provider value={buehne}>
      <div ref={stage} className="ld-buehne" aria-hidden="true" />
      {kinder}
      <div ref={ebene} className="tyd-dot-ebene" data-buehne="false">
        <canvas ref={canvas} className="tyd-dot-flaeche" />
        <canvas ref={glCanvas} className="tyd-dot-flaeche" />
        <button ref={hit} type="button" className="tyd-dot-treffer" aria-label="Hoku" hidden />
        <div ref={blase} className="tyd-dot-blase" role="status" />
      </div>
    </Kontext.Provider>
  )
}
