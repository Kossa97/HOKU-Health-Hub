import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { DishDraft } from '../lib/dishDraft'
import { dishDots, dishOrbModel } from '../lib/dishOrb'
import { macroMix } from '../lib/foodOrb'
import { dotScale } from '../lib/orb'
import { type ColorIndex, DotRenderer, drawSphere, easeInOut, mixColor, orbPalette, qAxis, qMat, qMul, qNorm, sprite } from '../lib/orbDraw'
import { DOT_MAIN, DOT_TRAIL, ORB_RADIUS, SPREAD, TRAVEL } from '../lib/orbEngine'
import { takeOrbOrigin, useOrbPreview } from '../lib/orbBridge'
import { ZONE_BELOW, ZONE_MAX, trackZone, usePrefersReducedMotion } from '../lib/orbZone'
import { type Goals, parseAmount } from '../lib/nutrition'
import { portionsValid } from '../lib/recipe'
import { MACRO_COLORS, MACRO_NAME, MUTED } from '../styles'
import { ScoreBadge } from './ScoreBadge'

interface Particle { ci: ColorIndex; sx: number; sy: number; delay: number; dur: number; t0: number; ox: number; oy: number; lift: number; side: number }

/**
 * Gericht im Vollbild: Statt Tageskugel und Monden steht oben eine Kugel für eine
 * Portion — gleicher Mechanismus, nur ein Orb statt vier. 1 Punkt = 1 kcal, gleiche
 * Punktdichte wie die Tageskugel (der zarte Kreis zeigt, wie groß ein ganzer Tag
 * wäre), Farben gemischt nach Makro-Anteil. Kommt eine Zutat dazu, fliegen ihre
 * Punkte aus ihrer Essens-Kugel herein und die Kugel wächst, wenn sie ankommen.
 * Eine aufgeklappte Zutat (`focus`) lässt ihre Punkte pulsieren.
 */
export function DishStage({ draft, goals, focus }: { draft: DishDraft; goals: Goals; focus: number | null }) {
  const { t } = useTranslation()
  const reduce = usePrefersReducedMotion()
  const zoneRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fx, setFx] = useState<HTMLCanvasElement | null>(null)
  // Portionen-Feld gerade leer oder halb getippt: mit der zuletzt gültigen Zahl weiterrechnen.
  const [lastPortions, setLastPortions] = useState(1)
  const typedPortions = parseAmount(draft.portions)
  if (portionsValid(typedPortions) && typedPortions !== lastPortions) setLastPortions(typedPortions)
  const model = useMemo(() => dishOrbModel(draft, lastPortions), [draft, lastPortions])
  const add = useOrbPreview()
  // Vorschau einer Zutat (Portions-Formular): je Portion des Gerichts.
  const plus = add ? { kcal: add.kcal / model.portions, protein: add.protein / model.portions, carbs: add.carbs / model.portions, fat: add.fat / model.portions } : null
  const p = model.portion
  const shown = plus ? { kcal: p.kcal + plus.kcal, protein: p.protein + plus.protein, carbs: p.carbs + plus.carbs, fat: p.fat + plus.fat } : p
  const goalDots = Math.max(1, dishDots(goals.kcal) || 2000)

  // Alles, was die Zeichen-Schleife braucht, ohne sie neu zu starten.
  const live = useRef({
    reduce, goalDots, focus, parts: model.parts,
    target: dishDots(p.kcal), plusDots: 0, mix: macroMix(p),
    k: reduce ? dishDots(p.kcal) : 0, growAt: 0, particles: [] as Particle[],
    fx: null as HTMLCanvasElement | null, dirty: true,
  })
  const plusDots = plus ? dishDots(p.kcal + plus.kcal) - dishDots(p.kcal) : 0
  const mix = macroMix(shown)
  useLayoutEffect(() => {
    Object.assign(live.current, { reduce, goalDots, focus, parts: model.parts, plusDots, mix, fx, dirty: true })
  })

  // Neue Zutat: Punkte fliegen aus ihrer Essens-Kugel herein; die Kugel wächst, wenn sie ankommen.
  const target = dishDots(p.kcal)
  const before = useRef(p)
  useEffect(() => {
    const st = live.current
    const was = before.current
    before.current = p
    st.target = target
    const now = performance.now()
    const grew = target - dishDots(was.kcal)
    // Immer abholen: Eine Zutat ohne Kalorien (Wasser, Salz) hinterließe sonst einen Startpunkt für den nächsten Flug.
    const origin = takeOrbOrigin()
    const from = grew > 0 ? origin : null
    if (!from || st.reduce || !st.fx) { st.growAt = now; return }
    // Farben der neuen Zutat: was dazukam.
    const mix = macroMix({ kcal: p.kcal - was.kcal, protein: p.protein - was.protein, carbs: p.carbs - was.carbs, fat: p.fat - was.fat })
    const cnt = Math.max(10, Math.min(70, Math.round(grew / 6)))
    for (let i = 0; i < cnt; i++) {
      const f = cnt > 1 ? i / (cnt - 1) : 0
      // Start auf der Fläche der Essens-Kugel, früher abfliegende von oben (dort leert sie sich zuerst).
      const r = from.r ?? 0
      const y = (-1 + 2 * Math.min(1, Math.max(0, f + (Math.random() - 0.5) * 0.25))) * r
      const w = Math.sqrt(Math.max(0, r * r - y * y))
      const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * 0.85
      st.particles.push({
        ci: mix ? mixColor(mix, Math.random()) : 1,
        sx: from.x + (Math.random() * 2 - 1) * (r ? w : 30), sy: from.y + (r ? y : (Math.random() - 0.5) * 12),
        delay: f * SPREAD + Math.random() * 40, dur: TRAVEL + Math.random() * 120, t0: now,
        ox: Math.cos(ang) * rad, oy: Math.sin(ang) * rad, lift: 90 + Math.random() * 70, side: (Math.random() - 0.5) * 120,
      })
    }
    st.growAt = now + TRAVEL * 0.8
    // Bei neuer Punktzahl oder neuer Zutat; `p` gehört dazu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, draft.items.length])

  // Zeichenfläche, Zone und Schleife — einmal je Einhängen.
  useEffect(() => {
    const canvas = canvasRef.current
    const zone = zoneRef.current
    if (!canvas || !zone) return
    const st = live.current
    const renderer = new DotRenderer(canvas)
    let sprites: HTMLCanvasElement[] = []
    const palette = () => { const rgb = orbPalette(zone); renderer.setPalette(rgb); sprites = rgb.map(sprite); st.dirty = true }
    palette()
    const mo = new MutationObserver(palette)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-look', 'data-theme'] })
    let dpr = 2, cssW = 0, centerY = ZONE_MAX * 0.4, scale = 1
    const untrack = trackZone(zone, canvas, w => {
      dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
      cssW = w
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round((ZONE_MAX + ZONE_BELOW) * dpr)
      st.dirty = true
    }, (h, sc) => { centerY = h * 0.4; scale = sc; st.dirty = true })

    let q = qMul(qAxis(1, 0, 0, 0.22), qAxis(0, 1, 0, 0.6))
    let last = 0, raf = 0, fxDirty = false
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || !renderer.mode || renderer.lost) { last = 0; return }
      const now = performance.now()
      const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0
      last = ts
      // Wachsen (oder schrumpfen) weich; neue Punkte erst, wenn der Flug ankommt.
      const goal = now >= st.growAt ? st.target : st.k
      const moving = st.k !== goal
      if (moving) {
        st.k = st.reduce ? goal : st.k + (goal - st.k) * (1 - Math.exp(-dt * 6))
        if (Math.abs(goal - st.k) < 0.5) st.k = goal
      }
      if (!st.reduce) q = qNorm(qMul(q, qAxis(0, 1, 0, dt * 0.16)))
      const k = dpr
      const cx = (cssW / 2) * k, cy = centerY * k
      const Rday = ORB_RADIUS * scale * k
      const n = Math.round(st.k) + st.plusDots
      const R = Rday * Math.sqrt(n / st.goalDots)
      if (!st.reduce || moving || st.dirty) {
        st.dirty = false
        renderer.begin()
        // Maßstab: ein ganzer Tag als zarter Kreis.
        for (let j = 0; j < 96; j++) {
          const a = (j / 96) * Math.PI * 2
          renderer.dot(0, cx + Math.cos(a) * Rday, cy + Math.sin(a) * Rday, DOT_TRAIL * k, 0.16)
        }
        if (n > 0) {
          const M = qMat(q)
          const base = Math.round(st.k)
          const part = st.focus != null ? st.parts[st.focus] : null
          const preview = st.plusDots > 0 ? { from: base, to: n, extraFrom: 0 } : null
          const focus = !preview && part && part.to > part.from ? part : null
          drawSphere(renderer, n, { filled: n, extra: 0 }, {
            M, HM: M, cx, cy, R: Math.max(k, R), px: DOT_MAIN * k * dotScale(st.goalDots) * (0.5 + 0.5 * scale),
            color: 1, mix: st.mix, now: st.reduce ? 0 : now, live: !st.reduce, preview, focus,
          })
        }
        renderer.end()
      }
      // Flüge auf der Ebene über allem, in Bildschirm-Pixeln.
      const fxc = st.fx
      const ctx = fxc?.getContext('2d')
      if (!fxc || !ctx) return
      if (!st.particles.length) {
        if (fxDirty) { ctx.clearRect(0, 0, fxc.width, fxc.height); fxDirty = false }
        return
      }
      const fw = Math.round(window.innerWidth * dpr), fh = Math.round(window.innerHeight * dpr)
      if (fxc.width !== fw) fxc.width = fw
      if (fxc.height !== fh) fxc.height = fh
      ctx.clearRect(0, 0, fw, fh)
      fxDirty = true
      const rect = canvas.getBoundingClientRect()
      // Ziel: eine Stelle in der Kugel, wie groß sie beim Ankommen ist (mindestens sichtbar).
      const Rt = Math.max(R, Rday * 0.18) / k
      const size = DOT_MAIN * dotScale(st.goalDots) * 1.3
      st.particles = st.particles.filter(pt => {
        const u = (now - pt.t0 - pt.delay) / pt.dur
        if (u >= 1) return false
        if (u < 0) return true
        const tx = rect.left + cx / k + pt.ox * Rt, ty = rect.top + cy / k + pt.oy * Rt
        const mx = (pt.sx + tx) / 2 + pt.side, my = Math.min(pt.sy, ty) - pt.lift
        for (let tr = 2; tr >= 0; tr--) {
          const e = easeInOut(Math.max(0, u - tr * 0.035))
          const x = (1 - e) ** 2 * pt.sx + 2 * (1 - e) * e * mx + e * e * tx
          const y = (1 - e) ** 2 * pt.sy + 2 * (1 - e) * e * my + e * e * ty
          const sz = (6 + (size - 6) * e) * (tr ? 0.75 : 1)
          const img = sprites[pt.ci]
          if (!img) continue
          ctx.globalAlpha = tr === 0 ? 0.95 : tr === 1 ? 0.35 : 0.15
          ctx.drawImage(img, (x - sz / 2) * dpr, (y - sz / 2) * dpr, sz * dpr, sz * dpr)
        }
        return true
      })
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      untrack()
      mo.disconnect()
      renderer.destroy()
      st.fx?.getContext('2d')?.clearRect(0, 0, st.fx.width, st.fx.height)
      st.particles = []
    }
  }, [])

  const hide = goals.hideKcal
  const big = Math.round(hide ? shown.protein : shown.kcal)
  const plusText = plus ? Math.round(hide ? plus.protein : plus.kcal) : 0
  const goal = hide ? goals.proteinG : goals.kcal
  const pct = goal > 0 ? Math.round(((hide ? shown.protein : shown.kcal) / goal) * 100) : null
  const macros = (hide ? ['carbs', 'fat'] as const : ['protein', 'carbs', 'fat'] as const)

  return (
    <>
      <div aria-hidden="true" style={{ height: ZONE_MAX }} />
      <section ref={zoneRef} aria-label={t('nutr_dish_orb_label')}
        className="fixed inset-x-0 z-[30] mx-auto max-w-lg bg-[var(--c-bg)] px-3 shadow-[0_6px_12px_4px_var(--c-bg)]"
        style={{ top: 'env(safe-area-inset-top, 0px)', height: ZONE_MAX }}>
        <canvas ref={canvasRef} role="img" aria-label={t('nutr_dish_orb_aria', { kcal: Math.round(p.kcal) })}
          className="pointer-events-none absolute inset-x-0 top-0 z-0 block w-full select-none"
          style={{ height: ZONE_MAX + ZONE_BELOW }} />
        <p className={`absolute left-3 top-3 z-[2] flex items-center gap-1.5 text-[12px] ${MUTED}`}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="1.2 2" /></svg>
          {t('nutr_dish_orb_ring')}
        </p>
        <div className="absolute inset-x-0 bottom-1 z-[2] flex flex-col items-center px-4">
          <p className="flex items-center gap-1.5">
            <span className="text-[28px] font-bold leading-none tabular-nums text-[var(--lg-text)]">{big}</span>
            <span className={`text-[14px] ${MUTED}`}>{t('nutr_dish_orb_unit', { unit: hide ? `g ${t('nutr_protein')}` : 'kcal' })}</span>
            {plusText > 0 && <span className="text-[13px] font-semibold tabular-nums text-[var(--accent)]">+{plusText}</span>}
            <ScoreBadge per100={model.per100} unit="g" />
          </p>
          <div className="mt-1.5 flex w-full justify-between gap-2 text-[12px]">
            {macros.map(m => (
              <span key={m} className="flex min-h-6 items-center gap-1.5 whitespace-nowrap tabular-nums text-[var(--lg-text-2)]">
                <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: MACRO_COLORS[m] }} />
                {t(MACRO_NAME[m])} <b className="font-semibold text-[var(--lg-text)]">{Math.round(shown[m])} g</b>
              </span>
            ))}
          </div>
          <p className={`text-[12px] tabular-nums ${MUTED}`}>
            {shown.kcal > 0 && pct != null ? t('nutr_dish_orb_share', { pct }) : t('nutr_dish_orb_empty')}
          </p>
        </div>
      </section>
      {typeof document !== 'undefined' && createPortal(
        <canvas ref={setFx} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />,
        document.body,
      )}
    </>
  )
}
