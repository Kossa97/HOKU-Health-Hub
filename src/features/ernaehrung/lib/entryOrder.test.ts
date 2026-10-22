import { describe, expect, it } from 'vitest'
import type { LogEntry } from './nutrition'
import { byEntryOrder, entryKey, keyAt, renumber } from './entryOrder'

const e = (id: string, createdAt: string, sortKey: number | null = null) =>
  ({ id, createdAt, sortKey } as LogEntry)

const a = e('a', '2026-10-22T07:00:00Z')
const b = e('b', '2026-10-22T08:00:00Z')
const c = e('c', '2026-10-22T09:00:00Z')

describe('entryKey / byEntryOrder', () => {
  it('ohne eigenen Wert zählt der Zeitpunkt', () => {
    expect(entryKey(a)).toBe(Date.parse('2026-10-22T07:00:00Z'))
    expect([c, a, b].sort(byEntryOrder).map(x => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('ein verschobener Eintrag steht zwischen seinen Nachbarn', () => {
    const moved = e('c', '2026-10-22T09:00:00Z', (entryKey(a) + entryKey(b)) / 2)
    expect([a, b, moved].sort(byEntryOrder).map(x => x.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('keyAt', () => {
  it('Mitte zwischen den Nachbarn', () => {
    expect(keyAt([a, b], 1)).toBe((entryKey(a) + entryKey(b)) / 2)
  })

  it('ganz oben und ganz unten: eine Sekunde Abstand', () => {
    expect(keyAt([a, b], 0)).toBe(entryKey(a) - 1000)
    expect(keyAt([a, b], 2)).toBe(entryKey(b) + 1000)
    expect(keyAt([a, b], 99)).toBe(entryKey(b) + 1000)
  })

  it('leere Mahlzeit: jetzt', () => {
    expect(keyAt([], 0, 123)).toBe(123)
  })

  it('kein Platz zwischen gleich alten Einträgen (in einem Rutsch eingetragen): null', () => {
    const x = e('x', '2026-10-22T07:00:00Z')
    const y = e('y', '2026-10-22T07:00:00Z')
    expect(keyAt([x, y], 1)).toBeNull()
  })
})

describe('renumber', () => {
  it('verteilt die Mahlzeit neu, mit dem verschobenen Eintrag an seinem Platz', () => {
    const x = e('x', '2026-10-22T07:00:00Z')
    const y = e('y', '2026-10-22T07:00:00Z')
    const z = e('z', '2026-10-22T07:00:00Z')
    const base = Date.parse('2026-10-22T07:00:00Z')
    expect(renumber([x, y], z, 1)).toEqual([
      { id: 'x', sortKey: base }, { id: 'z', sortKey: base + 1000 }, { id: 'y', sortKey: base + 2000 },
    ])
  })
})
