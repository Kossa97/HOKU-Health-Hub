import { describe, expect, it } from 'vitest'
import type { Fund, FundId } from '../../../../supabase/functions/_shared/erkenntnisse/typen.ts'
import { FUND_IDS, liesFund, ordneFunde } from './erkenntnisseService'

const gut = (): Record<string, unknown> => ({
  id: 'H1', schluessel: 'H1:vor_grenze', bezug: null, richtung: 'neutral', datenlage: 'hinweis',
  staerke: 0.5, zeitraum: { von: '2026-10-01', bis: '2026-10-28' }, werte: {},
})

const ohne = (feld: string) => { const o = gut(); delete o[feld]; return o }

describe('Erkenntnisse: liesFund', () => {
  it('nimmt einen gültigen Fund an, auch mit Bezug und Werten', () => {
    expect(liesFund(gut())?.id).toBe('H1')
    const f = liesFund({ ...gut(), id: 'R4', bezug: 'bench', richtung: 'positiv', datenlage: 'deutlich', werte: { n: 12, einheit: 'kg' } })
    expect(f).toMatchObject({ id: 'R4', bezug: 'bench', werte: { n: 12, einheit: 'kg' } })
  })

  it('nimmt alle fünf Fund-IDs an', () => {
    for (const id of ['H1', 'E2', 'W1', 'T7', 'R4']) expect(liesFund({ ...gut(), id })?.id).toBe(id)
  })

  it('lehnt unbekannte ID, null und Nicht-Objekte ab', () => {
    expect(liesFund({ id: 'X9' })).toBeNull()
    expect(liesFund({ ...gut(), id: 'X9' })).toBeNull()
    expect(liesFund(null)).toBeNull()
    expect(liesFund(undefined)).toBeNull()
    expect(liesFund('H1')).toBeNull()
    expect(liesFund([])).toBeNull()
  })

  it('lehnt falsche Typen ab', () => {
    expect(liesFund({ ...gut(), schluessel: 3 })).toBeNull()
    expect(liesFund({ ...gut(), bezug: 4 })).toBeNull()
    expect(liesFund({ ...gut(), richtung: 'schlecht' })).toBeNull()
    expect(liesFund({ ...gut(), datenlage: 'sicher' })).toBeNull()
    expect(liesFund({ ...gut(), staerke: '0.5' })).toBeNull()
    expect(liesFund({ ...gut(), staerke: Number.NaN })).toBeNull()
    expect(liesFund({ ...gut(), staerke: Infinity })).toBeNull()
  })

  it('lehnt fehlende oder kaputte Felder ab', () => {
    expect(liesFund(ohne('werte'))).toBeNull()
    expect(liesFund(ohne('bezug'))).toBeNull()
    expect(liesFund({ ...gut(), zeitraum: null })).toBeNull()
    expect(liesFund({ ...gut(), zeitraum: { von: 'a' } })).toBeNull()
    expect(liesFund({ ...gut(), zeitraum: { von: 1, bis: 2 } })).toBeNull()
    expect(liesFund({ ...gut(), werte: null })).toBeNull()
    expect(liesFund({ ...gut(), werte: [1, 2] })).toBeNull()
  })

  it('werte: nur Zahlen und Texte, keine Objekte, Listen, Booleans oder NaN', () => {
    expect(liesFund({ ...gut(), werte: { a: { b: 1 } } })).toBeNull()
    expect(liesFund({ ...gut(), werte: { a: [1] } })).toBeNull()
    expect(liesFund({ ...gut(), werte: { a: true } })).toBeNull()
    expect(liesFund({ ...gut(), werte: { a: null } })).toBeNull()
    expect(liesFund({ ...gut(), werte: { a: Number.NaN } })).toBeNull()
  })
})

describe('Erkenntnisse: FUND_IDS', () => {
  it('stimmt mit dem Typ FundId überein', () => {
    // Jede Zeile hier ist eine FundId (sonst Typfehler); die Prüfung unten fängt Fehlendes.
    const alle = ['H1', 'E2', 'W1', 'T7', 'R4'] as const satisfies readonly FundId[]
    expect([...FUND_IDS].sort()).toEqual([...alle].sort())
    // Umgekehrt: fehlt eine FundId in dieser Tabelle, ist das ein Typfehler.
    const abgedeckt: Record<FundId, true> = { H1: true, E2: true, W1: true, T7: true, R4: true }
    expect(Object.keys(abgedeckt).sort()).toEqual([...FUND_IDS].sort())
  })
})

describe('Erkenntnisse: ordneFunde', () => {
  const zeile = (id: string, fund: unknown, datenlage = 'hinweis') => ({ id, fund, datenlage })
  const fundMit = (id: FundId): Fund => liesFund({ ...gut(), id })!

  it('behält die Reihenfolge der fund_ids, überspringt fehlende und ungültige', () => {
    const zeilen = [zeile('b', gut()), zeile('a', { ...gut(), id: 'E2' }), zeile('c', { id: 'X9' })]
    const r = ordneFunde(['a', 'fehlt', 'c', 'b'], zeilen)
    expect(r.map(x => x.id)).toEqual(['a', 'b'])
    expect(r[0].fund.id).toBe('E2')
    expect(r[1].fund).toEqual(fundMit('H1'))
  })

  it('Datenlage kommt aus der Spalte der Zeile', () => {
    expect(ordneFunde(['a'], [zeile('a', gut(), 'deutlich')])[0].datenlage).toBe('deutlich')
    expect(ordneFunde(['a'], [zeile('a', gut(), 'hinweis')])[0].datenlage).toBe('hinweis')
  })
})
