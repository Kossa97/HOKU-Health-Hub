// src/lib/injectionLogEdit.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
vi.mock('../config/features', () => ({ FEATURES: { planTimelineV2: false } }))
import {
  buildInjectionUpdatePayload,
  deleteInjectionLog,
  isInjectionLogNotFoundError,
  updateInjectionLog,
  type InjectionLogEdit,
} from './injectionPersistence'
import { parseInjectionDose } from './injectionLogSheetState'

const edit: InjectionLogEdit = {
  notes: '  links etwas gerötet  ',
  substanceLabel: ' BPC-157 ',
  dose: 250,
  unit: 'mcg',
  method: 'Subkutan',
  loggedAt: '2026-09-27T07:00:00.000Z',
}

/** Zeichnet die Kette from().update/delete().eq().eq().select() auf. */
function fakeSupabase(result: { data: unknown[] | null; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = []
  const chain = {
    update: (payload: unknown) => { calls.push(['update', payload]); return chain },
    delete: () => { calls.push(['delete']); return chain },
    eq: (column: string, value: unknown) => { calls.push(['eq', column, value]); return chain },
    select: (columns: string) => { calls.push(['select', columns]); return Promise.resolve(result) },
  }
  const supabase = { from: (table: string) => { calls.push(['from', table]); return chain } } as unknown as SupabaseClient
  return { supabase, calls }
}

describe('buildInjectionUpdatePayload', () => {
  it('aendert bei einer manuellen Injektion alle Angaben, getrimmt', () => {
    expect(buildInjectionUpdatePayload({ dose_log_id: null }, edit)).toEqual({
      notes: 'links etwas gerötet',
      substance_label: 'BPC-157',
      dose: 250,
      unit: 'mcg',
      method: 'Subkutan',
      logged_at: '2026-09-27T07:00:00.000Z',
    })
  })

  it('aendert bei einer an eine Einnahme gebundenen Injektion nur die Notiz', () => {
    expect(buildInjectionUpdatePayload({ dose_log_id: 'd1' }, edit)).toEqual({ notes: 'links etwas gerötet' })
  })

  it('speichert leere Texte als null', () => {
    expect(buildInjectionUpdatePayload({ dose_log_id: null }, { ...edit, notes: '   ', substanceLabel: '' }))
      .toMatchObject({ notes: null, substance_label: null })
  })

  it('fasst Position und Stelle nie an', () => {
    const payload = buildInjectionUpdatePayload({ dose_log_id: null }, edit)
    for (const key of ['position', 'normal', 'body_region', 'body_side', 'site', 'model_version', 'user_id', 'dose_log_id']) {
      expect(payload).not.toHaveProperty(key)
    }
  })
})

describe('updateInjectionLog / deleteInjectionLog', () => {
  it('aendert nur die eigene Zeile mit dieser ID', async () => {
    const { supabase, calls } = fakeSupabase({ data: [{ id: 'l1' }], error: null })
    await updateInjectionLog(supabase, 'u1', { id: 'l1', dose_log_id: 'd1' }, edit)
    expect(calls).toEqual([
      ['from', 'injection_logs'],
      ['update', { notes: 'links etwas gerötet' }],
      ['eq', 'id', 'l1'],
      ['eq', 'user_id', 'u1'],
      ['select', 'id'],
    ])
  })

  it('loescht nur die eigene Zeile mit dieser ID', async () => {
    const { supabase, calls } = fakeSupabase({ data: [{ id: 'l1' }], error: null })
    await deleteInjectionLog(supabase, 'u1', 'l1')
    expect(calls).toEqual([
      ['from', 'injection_logs'],
      ['delete'],
      ['eq', 'id', 'l1'],
      ['eq', 'user_id', 'u1'],
      ['select', 'id'],
    ])
  })

  it('meldet einen Fehler, wenn keine Zeile betroffen war, statt still Erfolg', async () => {
    await expect(updateInjectionLog(fakeSupabase({ data: [], error: null }).supabase, 'u1', { id: 'x', dose_log_id: null }, edit))
      .rejects.toSatisfy(isInjectionLogNotFoundError)
    await expect(deleteInjectionLog(fakeSupabase({ data: null, error: null }).supabase, 'u1', 'x'))
      .rejects.toSatisfy(isInjectionLogNotFoundError)
  })

  it('reicht Datenbankfehler weiter', async () => {
    const error = { code: '42501', message: 'permission denied' }
    await expect(deleteInjectionLog(fakeSupabase({ data: null, error }).supabase, 'u1', 'l1')).rejects.toBe(error)
    expect(isInjectionLogNotFoundError(error)).toBe(false)
  })
})

describe('parseInjectionDose', () => {
  it.each([
    ['', null],
    ['  ', null],
    ['250', 250],
    ['0,5', 0.5],
    ['0', 0],
    ['.5', 0.5],
    ['-1', undefined],
    ['abc', undefined],
    ['0x10', undefined],
    ['1e3', undefined],
    ['1,2,3', undefined],
  ])('%j -> %j', (input, expected) => {
    expect(parseInjectionDose(input)).toBe(expected)
  })
})
