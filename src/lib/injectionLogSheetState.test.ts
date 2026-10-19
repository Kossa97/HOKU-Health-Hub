import { describe, expect, it } from 'vitest'
import {
  replaceTimeInLocalDateTime,
} from './injectionLogSheetState'

describe('replaceTimeInLocalDateTime', () => {
  it('changes only the time and preserves the selected intake day', () => {
    expect(replaceTimeInLocalDateTime('2026-06-24T20:00', '18:35')).toBe(
      '2026-06-24T18:35',
    )
  })
})
