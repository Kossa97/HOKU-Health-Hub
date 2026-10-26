import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

describe('Barcode-Leser: Pakete passen zusammen', () => {
  it('zxing-wasm ist exakt in der Version gepinnt, die barcode-detector erwartet', () => {
    const app = json('package.json')
    const detector = json('node_modules/barcode-detector/package.json')
    expect(app.dependencies['barcode-detector']).toMatch(/^\d+\.\d+\.\d+$/)
    expect(app.dependencies['zxing-wasm']).toBe(detector.dependencies['zxing-wasm'])
  })
})
