// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { readSharedDay, writeSharedDay } from './sharedDay'

describe('sharedDay', () => {
  beforeEach(() => sessionStorage.clear())

  it('merkt sich einen anderen Tag als heute für den gleichen Tag', () => {
    writeSharedDay('2026-10-12', '2026-10-19')
    expect(readSharedDay('2026-10-19')).toBe('2026-10-12')
  })

  it('heute wird nicht gespeichert und löscht eine alte Wahl', () => {
    writeSharedDay('2026-10-12', '2026-10-19')
    writeSharedDay('2026-10-19', '2026-10-19')
    expect(readSharedDay('2026-10-19')).toBeNull()
  })

  it('nach Mitternacht gilt die Wahl nicht mehr', () => {
    writeSharedDay('2026-10-12', '2026-10-19')
    expect(readSharedDay('2026-10-20')).toBeNull()
  })

  it('kaputte Werte werden ignoriert', () => {
    sessionStorage.setItem('tyd.sharedDay', '{"day":"gestern","on":"2026-10-19"}')
    expect(readSharedDay('2026-10-19')).toBeNull()
    sessionStorage.setItem('tyd.sharedDay', 'kein json')
    expect(readSharedDay('2026-10-19')).toBeNull()
  })
})
