import type { TFunction } from 'i18next'
import { siteFromMetricKey } from './measurements'
import { markerName } from '../../blutwerte/lib/markerCatalog.en'

/** Übersetzungsschlüssel der festen Metriken; Laborwerte laufen über den Marker-Katalog. */
const METRIC_LABEL_KEYS: Record<string, string> = {
  weight: 'fortschritt_metric_weight',
  body_fat: 'fortschritt_metric_body_fat',
  body_fat_pct: 'fortschritt_metric_body_fat_short',
  muscle_mass: 'fortschritt_metric_muscle_mass',
  energie: 'fortschritt_metric_energie',
  schlaf: 'fortschritt_metric_schlaf',
  wohlbefinden: 'fortschritt_metric_wohlbefinden',
  libido: 'fortschritt_metric_libido',
}

export function metricLabel(t: TFunction, key: string, fallback: string): string {
  const site = siteFromMetricKey(key)
  if (site) return t(`umfang_${site}`)
  const labelKey = METRIC_LABEL_KEYS[key]
  return labelKey ? t(labelKey) : markerName(fallback)
}
