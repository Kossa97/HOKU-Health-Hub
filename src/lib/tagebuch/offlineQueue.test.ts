// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAllQueues, discardFailed, enqueue, flushQueue, isNetworkError, newEntryId, queueCounts, readQueue, type PendingEntry,
} from './offlineQueue'

const row = (id: string, felder: Partial<PendingEntry['entry']> = {}, userId = 'u1'): PendingEntry => ({
  id, user_id: userId,
  entry: { description: id, occurred_at: '2026-10-06T08:00:00.000Z', stack_item_id: null, dose_log_id: null, notes: null, ...felder },
  chips: [{ symptom_key: 'energy', custom_label: null, kind: 'effect', severity: 3, duration_minutes: null, ongoing: false }],
})
const netz = { message: 'TypeError: Failed to fetch' }

describe('Tagebuch offline (v2)', () => {
  beforeEach(() => localStorage.clear())

  it('erkennt Netzfehler, nicht aber Datenbankfehler oder fehlende Programmteile', () => {
    expect(isNetworkError(netz, true)).toBe(true)
    expect(isNetworkError({ message: 'Load failed' }, true)).toBe(true)
    expect(isNetworkError({ message: 'diary_title_required', code: '22023' }, true)).toBe(false)
    expect(isNetworkError({ message: 'Failed to fetch dynamically imported module: x.js' }, true)).toBe(false)
    expect(isNetworkError({ message: 'egal' }, false)).toBe(true)
  })

  it('haelt Eintraege je Nutzer, ohne Doppelte; kaputte Speicherstaende werden ignoriert', () => {
    enqueue(row('a')); enqueue(row('a', { description: 'neu' })); enqueue(row('b', {}, 'u2'))
    expect(readQueue('u1').map(r => r.entry.description)).toEqual(['neu'])
    expect(readQueue('u2')).toHaveLength(1)
    localStorage.setItem('tyd_tagebuch_offline_u3', '[{"id":1},"x",null]')
    expect(readQueue('u3')).toEqual([])
  })

  it('sendet der Reihe nach und bricht beim Netzfehler ab', async () => {
    enqueue(row('a')); enqueue(row('b')); enqueue(row('c'))
    const gesendet: string[] = []
    const result = await flushQueue('u1', async r => {
      if (r.id === 'b') return { error: netz }
      gesendet.push(r.id); return { error: null }
    })
    expect(gesendet).toEqual(['a'])
    expect(result).toEqual({ sent: 1, waiting: 2, failed: 0 })
  })

  it('passt die Einnahme nicht mehr, geht der Eintrag nur ohne sie raus — die Substanz bleibt', async () => {
    enqueue(row('a', { stack_item_id: 's', dose_log_id: 'd' }))
    const versuche: Array<[string | null, string | null]> = []
    const result = await flushQueue('u1', async r => {
      versuche.push([r.entry.stack_item_id, r.entry.dose_log_id])
      return { error: r.entry.dose_log_id ? { message: 'effect_dose_log_other_substance', code: '23514' } : null }
    })
    expect(versuche).toEqual([['s', 'd'], ['s', null]])
    expect(result).toEqual({ sent: 1, waiting: 0, failed: 0 })
  })

  it('vorübergehender Serverfehler: Eintrag bleibt unveraendert, Lauf stoppt', async () => {
    enqueue(row('a', { stack_item_id: 's' })); enqueue(row('b'))
    const result = await flushQueue('u1', async () => ({ error: { message: 'upstream request timeout' } }))
    expect(result).toEqual({ sent: 0, waiting: 2, failed: 0 })
    expect(readQueue('u1')[0].entry.stack_item_id).toBe('s')
  })

  it('endgueltig gescheitert: markiert, nie still verworfen, nicht erneut gesendet; Verwerfen raeumt auf', async () => {
    enqueue(row('a')); enqueue(row('b'))
    const gesendet: string[] = []
    const send = async (r: PendingEntry) => {
      gesendet.push(r.id)
      return { error: r.id === 'a' ? { message: 'diary_chips_required', code: '22023' } : null }
    }
    expect(await flushQueue('u1', send)).toEqual({ sent: 1, waiting: 0, failed: 1 })
    await flushQueue('u1', send)
    expect(gesendet).toEqual(['a', 'b'])
    expect(queueCounts('u1')).toEqual({ waiting: 0, failed: 1 })
    discardFailed('u1')
    expect(readQueue('u1')).toEqual([])
  })

  it('Abmelden loescht alle gemerkten Eintraege des Geraets, sonst nichts', () => {
    enqueue(row('a')); enqueue(row('b', {}, 'u2'))
    localStorage.setItem('anderes', 'bleibt')
    clearAllQueues()
    expect(readQueue('u1')).toEqual([])
    expect(readQueue('u2')).toEqual([])
    expect(localStorage.getItem('anderes')).toBe('bleibt')
  })
  it('neue id ist eine UUID v4 – auch ohne crypto.randomUUID', () => {
    const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    expect(newEntryId()).toMatch(v4)
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try { expect(newEntryId()).toMatch(v4) } finally { Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true }) }
  })
})
