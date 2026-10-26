import type { WeightUnit } from '../types'
import { toDisplayWeight } from './stats'

/** Anzeige-Formate des Workout-Trackers. Gerechnet wird immer in kg, m, s. */

export function formatNumber(value: number, locale: string, maxFraction = 1): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: maxFraction }).format(value)
}

export function formatWeight(kg: number, unit: WeightUnit, locale: string): string {
  return `${formatNumber(toDisplayWeight(kg, unit), locale, 2)} ${unit}`
}

/** Volumen: ab 10.000 als „12,3 t" bzw. „27.1k lb". */
export function formatVolume(kg: number, unit: WeightUnit, locale: string): string {
  const value = toDisplayWeight(kg, unit)
  if (unit === 'kg' && value >= 10000) return `${formatNumber(value / 1000, locale, 1)} t`
  if (unit === 'lb' && value >= 10000) return `${formatNumber(value / 1000, locale, 1)}k lb`
  return `${formatNumber(value, locale, 0)} ${unit}`
}

/** 0:45 · 12:05 · 1:02:03 */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** 45 min · 1 h 05 min */
export function formatDuration(totalSeconds: number, minLabel: string): string {
  const minutes = Math.round(totalSeconds / 60)
  if (minutes < 60) return `${minutes} ${minLabel}`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} ${minLabel}`
}

export function formatDistance(meters: number, locale: string): string {
  if (meters < 1000) return `${formatNumber(meters, locale, 0)} m`
  return `${formatNumber(meters / 1000, locale, 2)} km`
}

export function formatDate(iso: string, locale: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(iso))
}

/** Eingabe mit Komma oder Punkt als Zahl lesen; leer → null. */
export function parseDecimal(input: string): number | null {
  const cleaned = input.trim().replace(',', '.')
  if (cleaned === '') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/**
 * Zeit wie an der Mikrowelle tippen: die Ziffern fuellen von rechts —
 * „45" = 0:45, „130" = 1:30, „10500" = 1:05:00. So reicht die Zifferntastatur,
 * die auf dem iPhone keinen Doppelpunkt hat.
 */
export function parseStopwatchDigits(input: string): number | null {
  const digits = input.replace(/\D/g, '').slice(-6)
  if (!digits) return null
  const padded = digits.padStart(6, '0')
  const h = Number(padded.slice(0, 2))
  const m = Number(padded.slice(2, 4))
  const s = Number(padded.slice(4, 6))
  return h * 3600 + m * 60 + s
}

/** Gegenstueck zu `parseStopwatchDigits`: 90 s → „130". */
export function stopwatchDigits(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return String(Number(`${h}${pad(m)}${pad(sec)}`))
}

/** „1:30", „90" oder „1:02:00" als Sekunden. */
export function parseClock(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (!trimmed.includes(':')) {
    const value = parseDecimal(trimmed)
    return value == null ? null : Math.round(value)
  }
  const parts = trimmed.split(':').map(p => Number(p))
  if (parts.some(p => !Number.isFinite(p) || p < 0)) return null
  return parts.reduce((total, part) => total * 60 + part, 0)
}
