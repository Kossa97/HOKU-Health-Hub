import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = () => readFileSync(new URL('./useFortschrittData.ts', import.meta.url), 'utf8')

const TABLES = ['cycles', 'stack_items', 'daily_logs', 'weight_logs', 'bloodwork', 'progress_photos', 'dose_logs'] as const

describe('useFortschrittData pagination', () => {
  it('lädt daily_logs seitenweise statt nur die ersten 1000 Zeilen', () => {
    const hook = source()

    expect(hook).toContain("import { collectPagedRows } from '../lib/pagination'")
    expect(hook).toContain('collectPagedRows((from, to) =>')
    expect(hook).toContain('.range(from, to)')
  })

  it.each(TABLES)('lädt %s seitenweise', table => {
    const hook = source()
    const at = hook.indexOf(`.from('${table}')`)

    expect(at, table).toBeGreaterThan(-1)
    // Jede Abfrage steckt in collectPagedRows und endet mit .range(from, to).
    const before = hook.lastIndexOf('collectPagedRows((from, to) =>', at)
    expect(before, table).toBeGreaterThan(-1)
    expect(hook.slice(before, at)).not.toContain('.from(')
    const end = hook.indexOf('.range(from, to)', at)
    expect(end, table).toBeGreaterThan(at)
    expect(hook.slice(at + 1, end)).not.toContain('.from(')
  })

  it('fragt jede Tabelle nur einmal ab', () => {
    const hook = source()
    for (const table of TABLES) {
      expect(hook.split(`.from('${table}')`).length - 1, table).toBe(1)
    }
  })
})
