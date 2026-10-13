import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

const HOUR = 3_600_000
const DAY = 24 * HOUR

// ── Formatierung ─────────────────────────────────────────────────────────

export function useBlutspiegelFormat() {
  const { t, i18n } = useTranslation()
  const lang = i18n?.language ?? 'de'
  return useMemo(() => {
    const pct = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    const whole = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 })
    const hourFmt = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' })
    const dayFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
    const scrubFmt = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    return {
      t,
      pct: (v: number) => pct.format(v),
      num: (v: number) => whole.format(v),
      // Erst runden, dann das Vorzeichen: sonst entsteht „−0,0“.
      signed: (v: number) => {
        const gerundet = Math.round(v * 10) / 10
        return gerundet === 0 ? pct.format(0) : `${gerundet > 0 ? '+' : '−'}${pct.format(Math.abs(gerundet))}`
      },
      tick: (ts: number, step: number) => (step < DAY ? hourFmt : dayFmt).format(ts),
      scrub: (ts: number) => scrubFmt.format(ts),
    }
  }, [t, lang])
}

/** „vor 3h" / „in 2T" */
export function formatOffset(diffMs: number | null, t: TFunction): string {
  if (diffMs == null) return '—'
  const absH = Math.abs(diffMs) / HOUR
  const value = absH < 1
    ? t('pk_duration_under_hour')
    : absH < 24
      ? t('pk_duration_hours', { count: Math.round(absH) })
      : t('pk_duration_days', { count: Math.round(absH / 24) })
  return diffMs < 0 ? t('pk_peak_past', { value }) : t('pk_peak_future', { value })
}
