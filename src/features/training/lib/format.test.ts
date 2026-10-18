import { describe, expect, it } from 'vitest'
import { formatClock, formatVolume, parseClock, parseDecimal, parseStopwatchDigits, stopwatchDigits } from './format'

describe('format', () => {
  it('liest Zeiten wie an der Mikrowelle', () => {
    expect(parseStopwatchDigits('45')).toBe(45)
    expect(parseStopwatchDigits('130')).toBe(90)
    expect(parseStopwatchDigits('10500')).toBe(3900)
    expect(parseStopwatchDigits('1:30')).toBe(90)
    expect(parseStopwatchDigits('')).toBeNull()
    expect(stopwatchDigits(90)).toBe('130')
    expect(stopwatchDigits(3900)).toBe('10500')
    expect(parseStopwatchDigits(stopwatchDigits(754))).toBe(754)
  })

  it('formatiert Uhrzeit und Volumen', () => {
    expect(formatClock(45)).toBe('0:45')
    expect(formatClock(3723)).toBe('1:02:03')
    expect(formatVolume(12345, 'kg', 'de')).toBe('12,3 t')
    expect(formatVolume(950, 'kg', 'en')).toBe('950 kg')
  })

  it('liest Komma und Punkt', () => {
    expect(parseDecimal('82,5')).toBe(82.5)
    expect(parseDecimal('82.5')).toBe(82.5)
    expect(parseDecimal(' ')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseClock('1:30')).toBe(90)
  })
})
