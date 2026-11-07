import { describe, expect, it } from 'vitest'
import { isMissingColumn } from './dbErrors'

describe('isMissingColumn', () => {
  it('erkennt fehlende Spalten beim Lesen und beim Schreiben', () => {
    expect(isMissingColumn({ code: '42703', message: 'column x does not exist' })).toBe(true)
    expect(isMissingColumn({ code: 'PGRST204', message: "Could not find the 'x' column" })).toBe(true)
  })

  it('nimmt andere Fehler und Leeres nicht dafuer', () => {
    expect(isMissingColumn({ code: '42P01' })).toBe(false)
    expect(isMissingColumn(null)).toBe(false)
    expect(isMissingColumn(undefined)).toBe(false)
    expect(isMissingColumn('42703')).toBe(false)
  })
})
