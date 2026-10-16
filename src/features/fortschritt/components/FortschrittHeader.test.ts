import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('FortschrittHeader', () => {
  it('shows a small centered green done label above the edit-today button', () => {
    const source = readFileSync(new URL('./FortschrittHeader.tsx', import.meta.url), 'utf8')

    expect(source).toContain("{hasTodayEntry && (")
    expect(source).toContain("t('fortschritt_done')")
    expect(source).toContain("color: '#22c55e'")
    expect(source.indexOf("t('fortschritt_done')")).toBeLessThan(source.indexOf('{button}'))
    expect(source).toContain("alignItems: 'center'")
  })
})
