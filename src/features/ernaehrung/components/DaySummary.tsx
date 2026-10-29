import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Target, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type OrbLayout, fitOrb, gramText, orbLayout } from '../lib/orb'
import { orbPalette } from '../lib/orbDraw'
import { type OrbFocus, OrbEngine } from '../lib/orbEngine'
import { clearOrbBuehne, setOrbBuehne, takeOrbOrigin, takeOrbTarget, useOrbPreview } from '../lib/orbBridge'
import { soundsWanted, unlockAudio } from '../lib/orbFeedback'
import { ZONE_BELOW as BELOW, ZONE_MAX, trackZone, usePrefersReducedMotion } from '../lib/orbZone'
import type { Goals, Nutrients } from '../lib/nutrition'
import { MACRO_COLORS, MACRO_NAME, MUTED } from '../styles'

/**
 * Tagesübersicht als Kalorien-Kugel, fest oben auf der Seite: Alles andere
 * (Woche, Mahlzeiten, Formulare) läuft darunter; sie bleibt beim Scrollen gleich
 * groß im Hintergrund. 1 Punkt = 1 kcal, von unten gefüllt, Makros als Monde
 * (1 Punkt = 1 g); über dem Ziel eine Hülle in derselben Farbe, ohne Wertung.
 * Seitlich wischen dreht, ein Mond (oder sein Eintrag darunter) lässt sich
 * antippen. Kommt etwas dazu, fliegen Punkte in die Kugel — aus der Essens-Kugel,
 * aus der eingetragen wurde; wird etwas entfernt, fallen sie unten heraus.
 */
export function DaySummary({ total, goals, date, ready, onOpenGoals, onClose }: {
  total: Nutrients
  goals: Goals
  date: string
  /** Tag geladen? Vorher zählt der Stand nicht als Ausgangspunkt — sonst flöge beim Laden der ganze Tag ein. */
  ready: boolean
  onOpenGoals: () => void
  /** Seite schließen (oben links; die Zurück-Geste löst denselben Knopf aus). */
  onClose: () => void
}) {
  const { t } = useTranslation()
  const reduce = usePrefersReducedMotion()
  const zoneRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<OrbEngine | null>(null)
  const [fx, setFx] = useState<HTMLCanvasElement | null>(null)
  const [focus, setFocus] = useState<OrbFocus | null>(null)
  const add = useOrbPreview()

  const { kcal, protein, carbs, fat } = total
  const layout = useMemo(() => orbLayout({ kcal, protein, carbs, fat }, goals), [kcal, protein, carbs, fat, goals])
  const layoutRef = useRef(layout)
  /** Breite und Höhe der Zone (CSS-Pixel) und die Anpassung der Kugel daran. */
  const zoneSize = useRef({ w: 390, h: ZONE_MAX, fit: () => {} })
  // Andere Ziele → andere Mondgrößen → Kugel neu einpassen.
  useEffect(() => { layoutRef.current = layout; zoneSize.current.fit() }, [layout])
  const previewLayout = useMemo(
    () => (add ? orbLayout({ kcal: kcal + add.kcal, protein: protein + add.protein, carbs: carbs + add.carbs, fat: fat + add.fat }, goals) : null),
    [add, kcal, protein, carbs, fat, goals],
  )
  const prev = useRef<{ date: string; goals: string; layout: OrbLayout } | null>(null)
  const goalsKey = `${goals.kcal}|${goals.proteinG}|${goals.carbsG}|${goals.fatG}|${goals.hideKcal}`

  // Kugel anlegen; Größe, Scrollen und Farben verfolgen.
  useEffect(() => {
    const canvas = canvasRef.current
    const zone = zoneRef.current
    if (!canvas || !zone) return
    const engine = new OrbEngine(canvas, { reduce, onFocus: setFocus })
    engineRef.current = engine
    const palette = () => engine.setPalette(orbPalette(zone))
    palette()
    // Scrollen: Zone und Kugel schrumpfen bis auf 80 %.
    // Größe und Lage aus dem Platz: so groß wie möglich, ohne dass ein Mond aus dem Bild läuft (fitOrb).
    const stage = zoneSize.current
    stage.fit = () => {
      const { R, cy } = fitOrb(layoutRef.current, stage.w, stage.h)
      engine.setStage(cy, R)
    }
    const untrack = trackZone(zone, canvas,
      w => { stage.w = w; engine.resize(w, ZONE_MAX + BELOW, ZONE_MAX * 0.4) },
      h => { stage.h = h; stage.fit() })
    // Akzentfarbe oder Aussehen gewechselt.
    const mo = new MutationObserver(palette)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-look', 'data-theme'] })
    engine.start()
    const buehne = { koerper: () => engine.koerper(), fokus: (key: Parameters<OrbEngine['focus']>[0]) => engine.focus(key, true) }
    setOrbBuehne(buehne)
    // Töne: Browser spielen erst nach einer Geste — beim ersten Tippen freischalten
    // (pointerdown zählt bei Touch nicht als Geste, touchend und click schon).
    const unlock = () => { if (soundsWanted()) unlockAudio() }
    document.addEventListener('touchend', unlock, { capture: true, passive: true })
    document.addEventListener('click', unlock, { capture: true, passive: true })
    return () => {
      document.removeEventListener('touchend', unlock, { capture: true })
      document.removeEventListener('click', unlock, { capture: true })
      clearOrbBuehne(buehne)
      untrack()
      mo.disconnect()
      engine.destroy()
      engineRef.current = null
    }
    // Einmal je Einhängen; Bewegung und Daten gehen unten hinein.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { engineRef.current?.setReduce(reduce) }, [reduce])
  useEffect(() => { engineRef.current?.setFx(fx) }, [fx])

  // Neue Werte: am selben Tag mit denselben Zielen fliegen die Punkte, sonst springt die Kugel still um.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    if (!ready) {
      engine.setLayout(layout)
      prev.current = null
      return
    }
    const p = prev.current
    if (p && p.date === date && p.goals === goalsKey) {
      engine.release(p.layout, layout, takeOrbTarget())
      engine.launch(takeOrbOrigin() ?? { x: window.innerWidth / 2, y: window.innerHeight - 80 }, p.layout, layout)
    } else if (p) {
      engine.cancelFlights()
    }
    engine.setLayout(layout)
    prev.current = { date, goals: goalsKey, layout }
  }, [layout, date, goalsKey, ready])

  // Vorschau aus dem offenen Formular (Portion, Schnelleintrag): die neuen Punkte pulsieren.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const same = previewLayout && previewLayout.main.n === layout.main.n && previewLayout.moons.length === layout.moons.length
    engine.setPreview(same ? previewLayout : null)
  }, [previewLayout, layout])

  const shown = add ? { kcal: kcal + add.kcal, protein: protein + add.protein, carbs: carbs + add.carbs, fat: fat + add.fat } : total
  const bigValue = goals.hideKcal ? Math.round(shown.protein) : Math.round(shown.kcal)
  const plus = add ? Math.round(goals.hideKcal ? add.protein : add.kcal) : 0
  const aria = goals.hideKcal
    ? t('nutr_protein_aria', { value: Math.round(protein), goal: goals.proteinG })
    : t('nutr_kcal_aria', { value: Math.round(kcal), goal: goals.kcal })
  // Alle Makros in der Zeile, auch mit Ziel 0 g — dann ohne Mond und nicht antippbar.
  const macros = (goals.hideKcal ? ['carbs', 'fat'] as const : ['protein', 'carbs', 'fat'] as const).map(key => ({
    key, value: shown[key], goal: key === 'protein' ? goals.proteinG : key === 'carbs' ? goals.carbsG : goals.fatG,
    moon: layout.moons.some(m => m.key === key),
  }))
  const focused = focus ? macros.find(m => m.key === focus.key) : undefined
  const g = (v: number) => Math.round(v)
  // Sehr große Werte: eine Spur kleiner, damit die Zeile nie umbricht.
  const digits = macros.reduce((s, m) => s + String(g(m.value)).length + String(m.goal).length, 0)

  return (
    <>
      {/* Platzhalter im Fluss: der Inhalt beginnt unter der Zone. */}
      <div aria-hidden="true" style={{ height: ZONE_MAX }} />
      <section ref={zoneRef} aria-label={t('nutr_summary')} data-nutr-zone
        className="fixed inset-x-0 z-[30] mx-auto max-w-lg bg-[var(--c-bg)] px-3 shadow-[0_6px_12px_4px_var(--c-bg)]"
        style={{ top: 'env(safe-area-inset-top, 0px)', height: ZONE_MAX }}>
        <canvas ref={canvasRef} role="img" aria-label={aria}
          className="pointer-events-none absolute inset-x-0 top-0 z-0 block w-full select-none"
          style={{ height: ZONE_MAX + BELOW }} />
        {/* Gesten auf der Kugel; die Zeichenfläche selbst lässt Taps auf die Formulare darunter durch. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 bottom-[76px] z-[1] cursor-grab touch-pan-y"
          onPointerDown={e => engineRef.current?.pointerDown(e.nativeEvent)}
          onPointerMove={e => engineRef.current?.pointerMove(e.nativeEvent)}
          onPointerUp={e => engineRef.current?.pointerUp(e.nativeEvent)}
          onPointerCancel={() => engineRef.current?.pointerCancel()} />
        {/* Ohne Leiste: oben links schließen (die Zurück-Geste löst denselben Knopf aus). */}
        <div className="absolute left-1 top-1 z-[2]">
          <button type="button" data-app-page-close onClick={onClose} aria-label={t('nutr_close_page')}
            className="lg-icon-btn !text-[var(--lg-text-2)]">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--lg-fill)]"><X size={17} aria-hidden="true" /></span>
          </button>
        </div>
        {/* Eigener Rahmen: .lg-glass setzt position: relative. */}
        <div className="absolute right-3 top-1.5 z-[2]">
          <button type="button" onClick={onOpenGoals}
            className="lg-glass lg-press flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-[var(--lg-text)]">
            <Target size={14} aria-hidden="true" />{t('nutr_goals')}
          </button>
        </div>
        <div role="status" aria-live="polite" className="pointer-events-none absolute left-0 top-0 z-[3] h-0 w-0 overflow-visible">
          {focus && focused && !focus.still && (
            <div ref={el => engineRef.current?.setLabel(el)} className="absolute flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-[12px] border border-[var(--lg-separator)] bg-[var(--lg-surface-2)] px-2.5 py-1.5 text-[13px] font-medium tabular-nums text-[var(--lg-text)] shadow-[0_4px_14px_rgba(0,0,0,0.3)]"
              style={{ left: focus.x, top: focus.y, transform: 'translate(-50%, calc(-100% - 10px))' }}>
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: MACRO_COLORS[focus.key] }} />
              {t(MACRO_NAME[focus.key])} {gramText(focused.value, focused.goal)}
            </div>
          )}
        </div>

        {/* Zwei Zeilen: Zahl mit Ziel, darunter die Makros über die ganze Breite. */}
        <div className="absolute inset-x-0 bottom-1 z-[2] flex flex-col items-center px-4">
          <p className="pointer-events-none flex items-baseline gap-1.5">
            <span className="text-[28px] font-bold leading-none tabular-nums text-[var(--lg-text)]">{bigValue}</span>
            <span className={`text-[14px] tabular-nums ${MUTED}`}>
              {t('nutr_slash_goal', { goal: goals.hideKcal ? goals.proteinG : goals.kcal, unit: goals.hideKcal ? 'g' : 'kcal' })}
            </span>
            {plus > 0 && <span className="text-[13px] font-semibold tabular-nums text-[var(--accent)]">+{plus}</span>}
          </p>
          <div className={`mt-1.5 flex w-full justify-between gap-2 ${digits > 18 ? 'text-[clamp(9px,2.8vw,11px)]' : 'text-[clamp(10px,3.1vw,12px)]'}`}>
            {macros.map(m => (
              <button key={m.key} type="button" aria-pressed={focus?.key === m.key} disabled={!m.moon}
                aria-label={`${t(MACRO_NAME[m.key])} ${gramText(m.value, m.goal)}`}
                onClick={() => engineRef.current?.focus(focus?.key === m.key ? null : m.key)}
                className="flex min-h-8 items-center gap-1.5 whitespace-nowrap tabular-nums text-[var(--lg-text-2)]">
                <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: MACRO_COLORS[m.key] }} />
                {m.key === 'carbs' ? (
                  // Schmale Geräte (iPhone SE): „Kohlenh.“, sonst passt die Zeile nicht.
                  <><span className="max-[359px]:hidden">{t(MACRO_NAME.carbs)}</span><span className="min-[360px]:hidden">{t('nutr_carbs_short')}</span></>
                ) : t(MACRO_NAME[m.key])} <b className="font-semibold text-[var(--lg-text)]">{g(m.value)}/{m.goal}g</b>
              </button>
            ))}
          </div>
        </div>
      </section>
      {typeof document !== 'undefined' && createPortal(
        <canvas ref={setFx} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />,
        document.body,
      )}
    </>
  )
}
