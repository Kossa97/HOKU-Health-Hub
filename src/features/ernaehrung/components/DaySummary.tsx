import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { type MacroKey, type OrbLayout, gramText, orbLayout } from '../lib/orb'
import { orbPalette } from '../lib/orbDraw'
import { type OrbFocus, OrbEngine } from '../lib/orbEngine'
import { soundsWanted, unlockAudio } from '../lib/orbFeedback'
import type { Goals, Nutrients } from '../lib/nutrition'
import { CARD, MACRO_COLORS, MUTED } from '../styles'

/** Höhe des Platzes für die Kugel; die Zeichenfläche ragt darüber hinaus (siehe unten). */
const BOX = 316
/** So weit reicht die Zeichenfläche unter den Platz — Monde und Hüllen schweben frei über Zahl und Legende. */
const BELOW = 120
/** Innenabstand der Karte (p-4): die Zeichenfläche reicht bis an ihre Ränder. */
const PAD = 16

const MACRO_NAME: Record<MacroKey, string> = { protein: 'nutr_protein', carbs: 'nutr_carbs', fat: 'nutr_fat' }

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduce(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduce
}

/**
 * Tagesübersicht als Kalorien-Kugel: 1 Punkt = 1 kcal, von unten gefüllt,
 * Makros als Monde (1 Punkt = 1 g). Über dem Ziel eine Hülle in derselben
 * Farbe, ohne Wertung. Seitlich wischen dreht, ein Mond (oder sein Eintrag
 * in der Legende) lässt sich antippen. Kommt etwas dazu, fliegen Punkte in die
 * Kugel; wird etwas entfernt, fallen sie unten heraus.
 */
export function DaySummary({ total, goals, date }: { total: Nutrients; goals: Goals; date: string }) {
  const { t, i18n } = useTranslation()
  const reduce = usePrefersReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<OrbEngine | null>(null)
  const [fx, setFx] = useState<HTMLCanvasElement | null>(null)
  const [focus, setFocus] = useState<OrbFocus | null>(null)
  /** Große Kugel weggescrollt: oben schwebt die Mini-Kugel ein, die Punkte fliegen dorthin. */
  const [away, setAway] = useState(false)
  const [miniCv, setMiniCv] = useState<HTMLCanvasElement | null>(null)

  const { kcal, protein, carbs, fat } = total
  const layout = useMemo(() => orbLayout({ kcal, protein, carbs, fat }, goals), [kcal, protein, carbs, fat, goals])
  const prev = useRef<{ date: string; goals: string; layout: OrbLayout } | null>(null)
  const goalsKey = `${goals.kcal}|${goals.proteinG}|${goals.carbsG}|${goals.fatG}|${goals.hideKcal}`

  // Kugel anlegen, Größe und Sichtbarkeit verfolgen.
  useEffect(() => {
    const canvas = canvasRef.current
    const box = boxRef.current
    if (!canvas || !box) return
    const engine = new OrbEngine(canvas, { reduce, onFocus: setFocus })
    engineRef.current = engine
    const palette = () => engine.setPalette(orbPalette(box))
    palette()
    const size = () => engine.resize(box.clientWidth + 2 * PAD, BOX + PAD + BELOW, PAD + BOX / 2)
    size()
    const ro = new ResizeObserver(size)
    ro.observe(box)
    window.addEventListener('resize', size)
    // Außer Sicht (weggescrollt) steht die Schleife.
    const io = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([e]) => { engine.setVisible(e.isIntersecting); setAway(!e.isIntersecting) })
      : null
    io?.observe(canvas)
    // Akzentfarbe oder Aussehen gewechselt.
    const mo = new MutationObserver(palette)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-look', 'data-theme'] })
    engine.start()
    // Töne: Browser spielen erst nach einer Geste — beim ersten Tippen freischalten
    // (pointerdown zählt bei Touch nicht als Geste, touchend und click schon).
    const unlock = () => { if (soundsWanted()) unlockAudio() }
    document.addEventListener('touchend', unlock, { capture: true, passive: true })
    document.addEventListener('click', unlock, { capture: true, passive: true })
    return () => {
      document.removeEventListener('touchend', unlock, { capture: true })
      document.removeEventListener('click', unlock, { capture: true })
      ro.disconnect()
      io?.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', size)
      engine.destroy()
      engineRef.current = null
    }
    // Einmal je Einhängen; Bewegung und Daten gehen unten hinein.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { engineRef.current?.setReduce(reduce) }, [reduce])
  useEffect(() => { engineRef.current?.setFx(fx) }, [fx])
  useEffect(() => { engineRef.current?.setMini(miniCv) }, [miniCv])

  // Neue Werte: am selben Tag mit denselben Zielen fliegen die Punkte, sonst springt die Kugel still um.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const p = prev.current
    if (p && p.date === date && p.goals === goalsKey) {
      engine.release(p.layout, layout)
      engine.launch({ x: window.innerWidth / 2, y: window.innerHeight - 80 }, p.layout, layout)
    } else if (p) {
      engine.cancelFlights()
    }
    engine.setLayout(layout)
    prev.current = { date, goals: goalsKey, layout }
  }, [layout, date, goalsKey])

  const bigValue = goals.hideKcal ? Math.round(protein) : Math.round(kcal)
  const left = goals.kcal - Math.round(kcal)
  const aria = goals.hideKcal
    ? t('nutr_protein_aria', { value: Math.round(protein), goal: goals.proteinG })
    : t('nutr_kcal_aria', { value: Math.round(kcal), goal: goals.kcal })
  const unit = layout.main.unit
  const unitText = unit === 1 ? '1' : unit.toLocaleString(i18n.language, { maximumFractionDigits: 1 })
  // Alle Makros in der Legende, auch mit Ziel 0 g — dann ohne Mond und nicht antippbar.
  const macros = (goals.hideKcal ? ['carbs', 'fat'] as const : ['protein', 'carbs', 'fat'] as const).map(key => ({
    key, value: total[key], goal: key === 'protein' ? goals.proteinG : key === 'carbs' ? goals.carbsG : goals.fatG,
    moon: layout.moons.some(m => m.key === key),
  }))
  const focused = focus ? macros.find(m => m.key === focus.key) : undefined

  return (
    <section aria-label={t('nutr_summary')} className={`${CARD} flex flex-col items-center p-4`}>
      <div ref={boxRef} className="relative w-full" style={{ height: BOX }}>
        <canvas ref={canvasRef} role="img" aria-label={aria}
          onPointerDown={e => engineRef.current?.pointerDown(e.nativeEvent)}
          onPointerMove={e => engineRef.current?.pointerMove(e.nativeEvent)}
          onPointerUp={e => engineRef.current?.pointerUp(e.nativeEvent)}
          onPointerCancel={() => engineRef.current?.pointerCancel()}
          className="absolute z-0 block cursor-grab touch-pan-y select-none"
          style={{ left: -PAD, top: -PAD, width: `calc(100% + ${2 * PAD}px)`, height: BOX + PAD + BELOW }} />
        <div role="status" aria-live="polite" className="pointer-events-none absolute z-[3] h-0 w-0 overflow-visible" style={{ left: -PAD, top: -PAD }}>
          {focus && focused && (
            <div ref={el => engineRef.current?.setLabel(el)} className="absolute flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-[12px] border border-[var(--lg-separator)] bg-[var(--lg-surface-2)] px-2.5 py-1.5 text-[13px] font-medium tabular-nums text-[var(--lg-text)] shadow-[0_4px_14px_rgba(0,0,0,0.3)]"
              style={{ left: focus.x, top: focus.y, transform: 'translate(-50%, calc(-100% - 10px))' }}>
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: MACRO_COLORS[focus.key] }} />
              {t(MACRO_NAME[focus.key])} {gramText(focused.value, focused.goal)}
            </div>
          )}
        </div>
      </div>

      {/* Der Text liegt über der Zeichenfläche und lässt Gesten durch; nur die Legende ist tippbar. */}
      <div className="pointer-events-none relative z-[1] -mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[34px] font-bold leading-none tabular-nums text-[var(--lg-text)]">{bigValue}</span>
        <span className={`text-[15px] tabular-nums ${MUTED}`}>
          {goals.hideKcal ? t('nutr_protein_of', { goal: goals.proteinG }) : t('nutr_of_goal', { goal: goals.kcal })}
        </span>
      </div>
      {!goals.hideKcal && (
        <p className={`pointer-events-none relative z-[1] mt-1 text-[13px] tabular-nums ${MUTED}`}>
          {left >= 0 ? `${left} ${t('nutr_kcal_left')}` : `${-left} ${t('nutr_kcal_above')}`}
        </p>
      )}
      <div className="relative z-[1] mt-1 flex flex-wrap justify-center gap-x-3">
        {macros.map(m => (
          <button key={m.key} type="button" aria-pressed={focus?.key === m.key} disabled={!m.moon}
            onClick={() => engineRef.current?.focus(focus?.key === m.key ? null : m.key)}
            className="flex min-h-11 items-center gap-1.5 px-0.5 text-[13px] tabular-nums text-[var(--lg-text-2)]">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: MACRO_COLORS[m.key] }} />
            {t(m.key === 'carbs' ? 'nutr_carbs_short' : MACRO_NAME[m.key])}
            <b className="font-semibold text-[var(--lg-text)]">{gramText(m.value, m.goal)}</b>
          </button>
        ))}
      </div>
      {!goals.hideKcal && (
        <p className={`pointer-events-none relative z-[1] text-[12px] ${MUTED}`}>{t('nutr_orb_unit', { kcal: unitText })}</p>
      )}
      {typeof document !== 'undefined' && createPortal(
        <>
          {/* Mini-Kugel: wächst aus der Ecke oben rechts (200 ms, ease-out), nur solange die große außer Sicht ist. */}
          {/* Eigener fester Rahmen: .lg-glass setzt position: relative. */}
          <div className={`fixed right-4 z-[55] origin-top-right transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity ${
            away ? 'opacity-100' : 'pointer-events-none scale-[0.92] opacity-0 motion-reduce:scale-100'}`}
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
            <button type="button" aria-hidden={!away} tabIndex={away ? 0 : -1}
              aria-label={`${t('nutr_orb_mini')}: ${aria}`}
              onClick={() => boxRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })}
              className="lg-glass lg-press flex h-12 items-center gap-1.5 rounded-full pl-1 pr-3.5">
              <canvas ref={setMiniCv} aria-hidden="true" className="block h-10 w-10" />
              <span className="text-[15px] font-semibold tabular-nums text-[var(--lg-text)]">{bigValue}</span>
              <span className={`text-[13px] ${MUTED}`}>{goals.hideKcal ? 'g' : 'kcal'}</span>
            </button>
          </div>
          <canvas ref={setFx} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />
        </>,
        document.body,
      )}
    </section>
  )
}
