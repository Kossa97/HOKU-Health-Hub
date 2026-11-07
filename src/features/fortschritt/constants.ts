export const METRIC_THRESHOLDS = {
  weight_kg: 0.3,
  wellness: 0.5,
  body_fat_pct: 0.3,
  lab_relative: 0.05,
} as const

export const MIN_POINTS_FOR_TREND = 3
export const MIN_POINTS_FOR_SPARKLINE = 3
export const MIN_POINTS_FOR_DELTA = 2
export const MAX_TOP_CHANGES = 4
export const MAX_VISIBLE_SUBSTANCES = 5

export const WELLNESS_FIELDS = ['energie', 'schlaf', 'wohlbefinden', 'libido'] as const

/** Privater Storage-Bucket für Fortschrittsfotos — Zugriff nur über signierte URLs */
export const PHOTO_BUCKET = 'progress-photos'
export const SIGNED_URL_TTL_SECONDS = 60 * 60

/** Nur objektive Metriken im Verlauf-Chart — Wellness-Vergleich läuft über Substanz-Fokus */
export const CHART_METRIC_KEYS = ['weight', 'body_fat', 'muscle_mass'] as const

export function isWellnessMetricKey(key: string): boolean {
  return (WELLNESS_FIELDS as readonly string[]).includes(key)
}

export function isChartMetricKey(key: string): boolean {
  return !isWellnessMetricKey(key)
}
