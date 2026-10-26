import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { MarkerSummary, Trend } from '../lib/bloodwork'
import { GREEN, MUTED, RED } from '../styles'

export const TrendIcon = ({ trend, size = 16 }: { trend: Trend; size?: number }) => {
  if (trend === 'up') return <TrendingUp size={size} />
  if (trend === 'down') return <TrendingDown size={size} />
  if (trend === 'same') return <Minus size={size} />
  return null
}

/**
 * Farbe der Veraenderung: der Befund des neuesten Werts, nicht die Richtung —
 * dieselbe Regel wie die Plaketten der Uebersicht. Ein Anstieg ist nicht von
 * sich aus gut oder schlecht; entscheidend ist, wo der Wert jetzt liegt.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const trendColor = (summary: MarkerSummary): string => {
  if (summary.trend === null || summary.trend === 'same') return MUTED
  if (summary.inRange === true) return GREEN
  if (summary.inRange === false) return RED
  return MUTED
}
