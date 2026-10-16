import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('FotosCard period placeholder', () => {
  test('renders the outside-period label as a single scrolling line', () => {
    const source = readSource('./FotosCard.tsx')

    expect(source).toContain('PhotoPeriodMarquee')
    expect(source).toContain("<PhotoPeriodMarquee>{t('fortschritt_photo_outside_label')}</PhotoPeriodMarquee>")
    expect(source).toContain('whiteSpace: \'nowrap\'')
  })
})