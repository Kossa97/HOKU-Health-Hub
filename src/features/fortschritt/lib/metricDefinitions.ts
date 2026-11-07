import type { MetricKey } from '../types'
import { isWellnessMetricKey } from '../constants'
import { METRIC_COLORS } from './colors'
import { MEASUREMENT_SITES, measurementMetricKey } from './measurements'

export interface MetricDefinition {
  key: MetricKey
  label: string
  unit: string
  color: string
  isLab: boolean
}

const BASE_METRICS: MetricDefinition[] = [
  { key: 'weight', label: 'Gewicht', unit: 'kg', color: METRIC_COLORS.weight, isLab: false },
  { key: 'body_fat', label: 'Körperfett', unit: '%', color: METRIC_COLORS.body_fat, isLab: false },
  { key: 'muscle_mass', label: 'Muskelmasse', unit: 'kg', color: METRIC_COLORS.muscle_mass, isLab: false },
]

export function buildAvailableMetrics(
  pointCounts: Map<string, number>,
  labMarkers: string[],
  labUnits: Map<string, string>,
): MetricDefinition[] {
  const metrics = BASE_METRICS.filter(m => (pointCounts.get(m.key) ?? 0) > 0)
  for (const site of MEASUREMENT_SITES) {
    const key = measurementMetricKey(site)
    if ((pointCounts.get(key) ?? 0) === 0) continue
    metrics.push({ key, label: site, unit: 'cm', color: METRIC_COLORS.umfang, isLab: false })
  }
  for (const marker of labMarkers) {
    if ((pointCounts.get(marker) ?? 0) === 0) continue
    metrics.push({
      key: marker,
      label: marker,
      unit: labUnits.get(marker) ?? '',
      color: METRIC_COLORS[marker] ?? '#8b5cf6',
      isLab: true,
    })
  }
  return metrics
}

export function normalizeMetricKey(key?: MetricKey): MetricKey {
  if (!key || key === 'Gewicht') return 'weight'
  if (key === 'Körperfett' || key === 'KFA') return 'body_fat'
  if (key === 'Muskelmasse') return 'muscle_mass'
  if (isWellnessMetricKey(key)) return 'weight'
  return key
}
