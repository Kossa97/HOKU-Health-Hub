import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROGRESS_SETTINGS, PREVIOUS_STARTS_MAX, parseProgressSettings, settingsRow, withDirection, withNewStart, withRestoredStart,
} from './progressSettings'

describe('progress_settings', () => {
  it('parst nur Gueltiges: Tage, bekannte Richtungen, bekannte Abzeichen', () => {
    const s = parseProgressSettings({
      start_on: '2026-03-14',
      previous_starts: ['2026-01-01', 'x', '2026-02-30', '2026-01-01'],
      directions: { weight: 'down', markers_in_range: 'down', unbekannt: 'up' },
      baselines: { steps: { source: 'before' } },
      history: [{ week: '2026-03-16', total: 4, areas: { koerper: 2 } }],
      earned_badges: { streak_7: '2026-03-21', hack: '2026-03-21', streak_30: 'gestern' },
    })
    expect(s).toEqual({
      startOn: '2026-03-14',
      previousStarts: ['2026-01-01'],
      directions: { weight: 'down' },
      baselines: { steps: { source: 'before' } },
      history: [{ week: '2026-03-16', total: 4, areas: { koerper: 2 } }],
      earnedBadges: { streak_7: '2026-03-21' },
    })
    expect(parseProgressSettings(null)).toEqual(EMPTY_PROGRESS_SETTINGS)
  })

  it('neuer Start: der bisherige (auch der implizite) wird wieder waehlbar', () => {
    const s = { ...EMPTY_PROGRESS_SETTINGS, startOn: null }
    const neu = withNewStart(s, '2026-11-02', '2026-03-14')
    expect(neu).toMatchObject({ startOn: '2026-11-02', previousStarts: ['2026-03-14'] })
    const zurueck = withRestoredStart(neu, '2026-03-14', '2026-11-02')
    expect(zurueck).toMatchObject({ startOn: '2026-03-14', previousStarts: ['2026-11-02'] })
    expect(withRestoredStart(neu, '2025-01-01', '2026-11-02')).toBe(neu)
  })

  it('hoechstens 50 fruehere Starts, keine Doppelten', () => {
    const viele = Array.from({ length: 60 }, (_, i) => `2025-01-${String((i % 28) + 1).padStart(2, '0')}`)
    const s = withNewStart({ ...EMPTY_PROGRESS_SETTINGS, previousStarts: viele }, '2026-11-02', '2026-03-14')
    expect(s.previousStarts.length).toBeLessThanOrEqual(PREVIOUS_STARTS_MAX)
    expect(new Set(s.previousStarts).size).toBe(s.previousStarts.length)
    expect(s.previousStarts[0]).toBe('2026-03-14')
  })

  it('Standardrichtung wird nicht gespeichert; Schreibform nur mit den uebergebenen Teilen', () => {
    expect(withDirection({ weight: 'up' }, 'weight', 'off', 'off')).toEqual({})
    expect(withDirection({}, 'body_fat', 'off', 'down')).toEqual({ body_fat: 'off' })
    expect(settingsRow({ startOn: '2026-11-02', earnedBadges: { streak_7: '2026-03-21' } }))
      .toEqual({ start_on: '2026-11-02', earned_badges: { streak_7: '2026-03-21' } })
  })
})
