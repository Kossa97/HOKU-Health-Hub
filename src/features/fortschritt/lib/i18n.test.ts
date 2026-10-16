import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const featureDir = resolve('src/features/fortschritt')
const locale = (code: string) =>
  JSON.parse(readFileSync(resolve(`src/i18n/locales/${code}.json`), 'utf8')) as Record<string, string>

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

/** Statisch genutzte Schlüssel plus die per Template gebauten. */
function usedKeys(): string[] {
  const keys = new Set<string>()
  for (const file of sourceFiles(featureDir)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/'(fortschritt_[a-z0-9_]+)'/g)) keys.add(match[1])
  }
  for (const chip of ['30t', '90t', '6m', '1j', 'alles']) keys.add(`fortschritt_range_${chip}`)
  for (const size of ['small', 'medium', 'large']) keys.add(`fortschritt_grid_${size}`)
  return [...keys].sort()
}

describe('Fortschritt i18n', () => {
  it.each(['de', 'en'])('hat jeden genutzten Schlüssel in %s', code => {
    const messages = locale(code)
    const keys = usedKeys()

    expect(keys.length).toBeGreaterThan(50)
    for (const key of keys) {
      expect(messages[key], `${code}.${key}`).toEqual(expect.any(String))
      expect(messages[key].trim(), `${code}.${key}`).not.toBe('')
    }
  })

  it('übersetzt Englisch wirklich und kopiert nicht das Deutsche', () => {
    const de = locale('de')
    const en = locale('en')
    const same = usedKeys().filter(key => de[key] === en[key])

    // Abkürzungen und Eigennamen sind in beiden Sprachen gleich.
    expect(same).toEqual([
      'fortschritt_metric_libido',
      'fortschritt_range_6m',
    ])
  })

  it('hat keine festen deutschen Texte mehr in den genutzten Komponenten', () => {
    const dead = ['ActiveSubstancesSection.tsx', 'PlaceholderTab.tsx']
    for (const file of sourceFiles(join(featureDir, 'components'))) {
      if (dead.some(name => file.endsWith(name))) continue
      const code = readFileSync(file, 'utf8')
        .split('\n')
        .filter(line => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
        .join('\n')
      expect(code, file).not.toMatch(/[ÄÖÜäöüß]/)
    }
  })
})
