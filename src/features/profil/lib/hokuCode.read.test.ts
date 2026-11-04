// @vitest-environment node
/**
 * Lesetest des Hoku-Codes (Spec 2c, 4.3): SVG mit resvg rastern, mit ZXing
 * (zxing-wasm, derselbe Leser wie im Substanz-Scanner) dekodieren; der Inhalt
 * muss exakt die Adresse sein. Dazu ein Abdruck der Matrix für eine feste
 * Adresse, damit ein Wechsel oder Update der QR-Bibliothek auffällt.
 *
 * Größen in CSS-px wie im Sheet (124) und im Vollbild (300), gerastert mit 2x
 * wie auf einem Handy; „halbe Auflösung“ ist das Vollbild mit 1x.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Resvg } from '@resvg/resvg-js'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import { beforeAll, describe, expect, it } from 'vitest'
import { BENUTZERNAME } from '../../auth/lib/pruefung'
import {
  HOKU_CODE_CUTOUT_SHARE, hokuCodeAddress, hokuCodeCutoutRadius, hokuCodeMatrix, hokuCodeSvg, hokuCodeUrl,
} from './hokuCode'

const SHEET_BG = '#1f2023' // dunkles Sheet (Soft Dark): der Code bringt sein Hell selbst mit
const FULL_BG = '#ffffff'

interface Raster {
  /** Kantenlänge des Bildes in Bildpunkten. */
  px: number
  background: string
  /** Drehung in Grad um die Mitte. */
  rotate?: number
  /** Weichzeichnung (Gauß, Standardabweichung in Bildpunkten). */
  blur?: number
}

function rasterize(url: string, { px, background, rotate = 0, blur = 0 }: Raster): Uint8Array {
  const code = hokuCodeSvg(url, { size: px })
  const c = px / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">`
    + (blur ? `<defs><filter id="weich" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs>` : '')
    + `<rect width="${px}" height="${px}" fill="${background}"/>`
    + `<g${blur ? ' filter="url(#weich)"' : ''}><g transform="rotate(${rotate} ${c} ${c})">${code}</g></g>`
    + '</svg>'
  return new Resvg(svg, { fitTo: { mode: 'original' }, background }).render().asPng()
}

/** ZXing ohne `tryHarder`: strenger als der Standard; Rastern und Lesen sind deterministisch. */
async function decode(png: Uint8Array): Promise<string[]> {
  const results = await readBarcodes(png, { formats: ['QRCode'], tryHarder: false, maxNumberOfSymbols: 1 })
  return results.filter(r => r.isValid).map(r => r.text)
}

const SHORTEST = 'abc'
const LONGEST = 'a'.repeat(20)
const SPECIAL = 'mara_k.2026'

const RASTERS: Record<string, Raster> = {
  'Sheet 124 px (2x), dunkler Grund': { px: 248, background: SHEET_BG },
  'Vollbild 300 px (2x)': { px: 600, background: FULL_BG },
  'Vollbild halbe Auflösung (1x)': { px: 300, background: FULL_BG },
  'Vollbild weichgezeichnet': { px: 600, background: FULL_BG, blur: 2.5 },
  'Vollbild halbe Auflösung weichgezeichnet': { px: 300, background: FULL_BG, blur: 1.2 },
  'Vollbild +10° gedreht': { px: 600, background: FULL_BG, rotate: 10 },
  'Vollbild −10° gedreht': { px: 600, background: FULL_BG, rotate: -10 },
  'Sheet +10° gedreht': { px: 248, background: SHEET_BG, rotate: 10 },
  'Sheet −10° gedreht': { px: 248, background: SHEET_BG, rotate: -10 },
}

beforeAll(async () => {
  const wasm = readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'))
  await prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) }, fireImmediately: true })
})

describe('Hoku-Code wird gelesen', () => {
  it('die Testnamen sind erlaubte Nicknames (kürzester, längster, mit Punkt/Unterstrich/Ziffern)', () => {
    for (const name of [SHORTEST, LONGEST, SPECIAL]) expect(BENUTZERNAME.test(name), name).toBe(true)
    expect(BENUTZERNAME.test(SHORTEST.slice(1))).toBe(false)
    expect(BENUTZERNAME.test(`${LONGEST}a`)).toBe(false)
  })

  for (const name of ['mara', SHORTEST, LONGEST, SPECIAL]) {
    const url = hokuCodeUrl(name)
    for (const [label, raster] of Object.entries(RASTERS)) {
      it(`@${name}: ${label}`, async () => {
        expect(await decode(rasterize(url, raster))).toEqual([url])
      })
    }
  }
})

describe('Hoku-Code Aufbau', () => {
  it('Adresse: Domain, Kleinbuchstaben, sicher kodiert', () => {
    expect(hokuCodeUrl('Mara.Lifts')).toBe('https://hokuhealth.app/u/mara.lifts')
    expect(hokuCodeUrl(' mara ')).toBe('https://hokuhealth.app/u/mara')
    expect(hokuCodeUrl('a/b?c#d')).toBe('https://hokuhealth.app/u/a%2Fb%3Fc%23d')
    expect(hokuCodeUrl('mära')).toBe('https://hokuhealth.app/u/m%C3%A4ra')
    expect(() => hokuCodeUrl('  ')).toThrow(RangeError)
    expect(hokuCodeAddress(hokuCodeUrl('mara'))).toBe('hokuhealth.app/u/mara')
  })

  it('nur druckbares ASCII in die Matrix', () => {
    expect(() => hokuCodeMatrix('https://hokuhealth.app/u/mära')).toThrow(RangeError)
    expect(() => hokuCodeMatrix('')).toThrow(RangeError)
  })

  it('deterministisch: gleiche Adresse, gleiches SVG; andere Adresse, anderes Füllmuster', () => {
    const a = hokuCodeSvg(hokuCodeUrl('mara'))
    expect(hokuCodeSvg(hokuCodeUrl('mara'))).toBe(a)
    expect(hokuCodeSvg(hokuCodeUrl('max'))).not.toBe(a)
  })

  it('immer dunkel auf hell, Adresse steht nicht als Text im SVG', () => {
    const svg = hokuCodeSvg(hokuCodeUrl('mara'), { idPrefix: 'x:1«»' })
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[^"]+">/)
    expect(svg).toContain('<circle r="')
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('fill="#16171b"')
    expect(svg).not.toContain('hokuhealth')
    expect(svg).toContain('id="x1-fill"')
    expect(svg).toContain('url(#x1-clip)')
  })

  it('Aussparung ≈ 7 % der Symbolfläche', () => {
    for (const name of [SHORTEST, LONGEST]) {
      const n = hokuCodeMatrix(hokuCodeUrl(name)).length
      const r = hokuCodeCutoutRadius(n)
      expect(Math.PI * r * r / (n * n)).toBeCloseTo(HOKU_CODE_CUTOUT_SHARE, 6)
    }
  })

  it('längster Name passt in Version 6 (41 Module), kürzester in Version 4 (33)', () => {
    expect(hokuCodeMatrix(hokuCodeUrl(LONGEST))).toHaveLength(41)
    expect(hokuCodeMatrix(hokuCodeUrl(SHORTEST))).toHaveLength(33)
  })

  it('Matrix-Abdruck für eine feste Adresse (fällt bei Bibliothekswechsel auf)', () => {
    const rows = hokuCodeMatrix('https://hokuhealth.app/u/mara').map(r => r.map(d => (d ? '#' : '.')).join(''))
    expect(rows).toEqual(MARA_MATRIX)
  })
})

// qrcode-generator 2.0.4, Fehlerkorrektur H, „https://hokuhealth.app/u/mara“
const MARA_MATRIX = [
  '#######.##.#......##.##.#.#######',
  '#.....#..##...##.#.#....#.#.....#',
  '#.###.#.#.##..#####..####.#.###.#',
  '#.###.#..#..#.....##.#.##.#.###.#',
  '#.###.#.##.#.#.#####.#....#.###.#',
  '#.....#...#.##..#.#...###.#.....#',
  '#######.#.#.#.#.#.#.#.#.#.#######',
  '........#..##.##.#....##.........',
  '.....##........#.##.#..#..#.#.#.#',
  '##..##..#....##.#..#..##.#.##....',
  '.##.#.#.##.##..###..##...#.#..##.',
  '..#......#.#..#.....#.##.#.#..#..',
  '.#.#.#######.#.#.#.#.##.#.####.#.',
  '#.#.##..#.##########.###..#...#.#',
  '.#..#.#.#.##.#.##.##..#......###.',
  '.#...#.......###.#..#.....#.#####',
  '......##.###.##.#####....#..##.##',
  '..###..#..#.#.#.###.##.#####....#',
  '...#.###.#.#.#.#....##.#....###.#',
  '..##.#.....##.##.#..#..##.#..###.',
  '#..#.##.###...##.##...#..##.##.##',
  '###.##....#..##..##.##..#.####...',
  '#.#.#.#####.##.######.#.....##.#.',
  '#..###.##..#.##.#.##..#.#...###..',
  '##.##.##.#.###.#....#..#######..#',
  '........#.####..#.####..#...##..#',
  '#######..#..##.###..#.###.#.#..#.',
  '#.....#.#..#.######.###.#...####.',
  '#.###.#.....##..#.#..##.#####..##',
  '#.###.#..#####.###...#..##.##.##.',
  '#.###.#..#.##.##.###..###...##.##',
  '#.....#....#...##....#....#..##..',
  '#######..#.##...#.#######......#.',
]
