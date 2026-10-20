import { type Ref, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { DayTotals } from '../lib/dayRings'
import type { Goals } from '../lib/nutrition'
import { orbLayout } from '../lib/orb'
import { orbPalette } from '../lib/orbDraw'
import { OrbEngine, clearSettled, markSettled } from '../lib/orbEngine'

/** Höhe der Kugel im Blatt; auf kleinen Geräten niedriger, damit „Hinzufügen" sichtbar bleibt. */
const HEIGHT = 'clamp(132px, 22vh, 184px)'

export interface PortionOrbHandle {
  /** Vorschau einrasten lassen (Aufleuchten, Haptik, Ton); löst auf, wenn man es gesehen hat. */
  settle: () => Promise<void>
  /** Speichern gescheitert: zurück zur Vorschau. */
  revert: () => void
}

/**
 * Kompakte Kalorien-Kugel mit Monden oben im Portions-Blatt: der Tag, wie er
 * ist, und — pulsierend — was diese Portion dazubringt. Beim Ändern der Menge
 * wandert die Vorschau mit. „Hinzufügen" lässt sie hier einrasten; die
 * Tagesübersicht dahinter fliegt dann nicht noch einmal.
 */
export function PortionOrb({ day, goals, add, handle }: {
  day: DayTotals
  goals: Goals
  /** Werte der Portion; null, solange die Menge ungültig ist. */
  add: DayTotals | null
  handle: Ref<PortionOrbHandle>
}) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<OrbEngine | null>(null)
  const before = useMemo(() => orbLayout(day, goals), [day, goals])
  const after = useMemo(() => add && orbLayout({
    kcal: day.kcal + add.kcal, protein: day.protein + add.protein, carbs: day.carbs + add.carbs, fat: day.fat + add.fat,
  }, goals), [day, add, goals])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const size = () => {
      const h = canvas.clientHeight
      engine.resize(canvas.clientWidth, h, h / 2)
    }
    const engine = new OrbEngine(canvas, { reduce, onFocus: () => {}, radius: Math.min(48, canvas.clientHeight * 0.26) })
    engineRef.current = engine
    engine.setPalette(orbPalette(canvas.parentElement ?? document.documentElement))
    size()
    const ro = new ResizeObserver(size)
    ro.observe(canvas)
    engine.start()
    return () => {
      ro.disconnect()
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setLayout(before)
    engine.setPreview(after)
  }, [before, after])

  useImperativeHandle(handle, () => ({
    settle: async () => {
      const engine = engineRef.current
      if (!engine || !after) return
      markSettled()
      await engine.settle()
    },
    revert: () => {
      clearSettled()
      engineRef.current?.setLayout(before)
      engineRef.current?.setPreview(after)
    },
  }), [before, after])

  const value = after ?? before
  const aria = goals.hideKcal
    ? t('nutr_orb_preview_protein', { value: Math.round(day.protein + (add?.protein ?? 0)), goal: goals.proteinG })
    : t('nutr_orb_preview', { value: Math.round(day.kcal + (add?.kcal ?? 0)), goal: goals.kcal })

  return (
    <canvas ref={canvasRef} role="img" aria-label={aria} data-orb-n={value.main.n}
      className="-mx-2 -mt-1 mb-1 block w-[calc(100%+16px)] select-none" style={{ height: HEIGHT }} />
  )
}
