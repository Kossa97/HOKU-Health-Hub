import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NutrientStatus } from '../lib/nutrientTargets'
import { bestFoodFor } from '../services/foodCatalog'

/**
 * Hokus Satz zu den Lücken: die zwei größten beim Namen, dazu ein Alltagslebensmittel,
 * das sie mit einer Portion gut füllt („Vitamin D und Jod fehlen dir heute noch.
 * Hering würde beides gut füllen.“). Leer, solange es keine Lücken gibt.
 */
export function useGapTip(gaps: readonly NutrientStatus[]): string {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'de'
  const top = gaps.slice(0, 2)
  const key = top.map(s => `${s.def.id}:${Math.round(s.target - s.value)}`).join('|')
  const [tip, setTip] = useState<{ key: string; food: string | null; covers: string[] } | null>(null)

  useEffect(() => {
    if (!key) return
    let off = false
    const rest = Object.fromEntries(top.map(s => [s.def.id, Math.max(0, s.target - s.value)]))
    bestFoodFor(rest, lang)
      .then(r => { if (!off) setTip({ key, food: r?.name ?? null, covers: r?.covers ?? [] }) })
      .catch(() => { if (!off) setTip({ key, food: null, covers: [] }) })
    return () => { off = true }
  }, [key, lang]) // eslint-disable-line react-hooks/exhaustive-deps -- `top` ist durch `key` beschrieben

  if (!top.length) return ''
  const names = top.map(s => t(`nutr_n_${s.def.id}`))
  const first = top.length === 1 ? t('nutr_hoku_gap_one', { a: names[0] }) : t('nutr_hoku_gap_two', { a: names[0], b: names[1] })
  const now = tip && tip.key === key ? tip : null
  if (!now?.food || !now.covers.length) return first
  const second = top.length > 1 && now.covers.length > 1
    ? t('nutr_hoku_tip_both', { food: now.food })
    : t('nutr_hoku_tip_one', { food: now.food, name: t(`nutr_n_${now.covers[0]}`) })
  return `${first} ${second}`
}
