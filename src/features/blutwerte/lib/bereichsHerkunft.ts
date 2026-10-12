import type { EffectiveRange } from './bloodwork'

type T = (key: string, options?: Record<string, unknown>) => string

/**
 * Woher der gezeigte Bereich stammt, kurz für die Klammer hinter dem Bereich:
 * „Labor“, „Männer, 40–49 J.“ oder „allgemein“. null ohne Bereich.
 */
export function bereichsHerkunft(range: EffectiveRange, t: T): string | null {
  if (range.source === 'lab') return t('bw_lab_source')
  if (range.source !== 'catalog') return null
  const g = range.gruppe
  if (!g) return t('bw_range_general')
  const teile: string[] = []
  if (g.sex) teile.push(t(g.sex === 'male' ? 'bw_range_men' : 'bw_range_women'))
  if (g.ageMin != null && g.ageMax != null) teile.push(t('bw_range_age', { min: g.ageMin, max: g.ageMax }))
  else if (g.ageMin != null && g.ageMin > 18) teile.push(t('bw_range_age_from', { min: g.ageMin }))
  if (g.menopause) teile.push(t(g.menopause === 'pre' ? 'bw_range_premeno' : 'bw_range_postmeno'))
  return teile.length ? teile.join(', ') : t('bw_range_general')
}
