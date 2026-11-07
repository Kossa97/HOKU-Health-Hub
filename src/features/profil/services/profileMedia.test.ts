// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Fake-Client: protokolliert alle Aufrufe in Reihenfolge.
const log: string[] = []
const state = { altPfad: null as string | null, zeilen: 1, updateFehler: null as string | null, uploadFehler: null as string | null }

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (tabelle: string) => ({
      select: (spalte: string) => ({
        eq: () => ({
          maybeSingle: async () => {
            log.push(`select ${tabelle}.${spalte}`)
            return { data: state.altPfad ? { [spalte]: state.altPfad } : null, error: null }
          },
        }),
      }),
      update: (werte: Record<string, unknown>) => ({
        eq: () => ({
          select: async () => {
            log.push(`update ${tabelle} ${JSON.stringify(werte)}`)
            if (state.updateFehler) return { data: null, error: { message: state.updateFehler } }
            return { data: Array.from({ length: state.zeilen }, () => ({ id: 'u1' })), error: null }
          },
        }),
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (pfad: string, _blob: Blob, opts: Record<string, unknown>) => {
          log.push(`upload ${bucket} ${pfad} ${JSON.stringify(opts)}`)
          return { error: state.uploadFehler ? { message: state.uploadFehler } : null }
        },
        remove: async (pfade: string[]) => {
          log.push(`remove ${bucket} ${pfade.join(',')}`)
          return { error: null }
        },
        createSignedUrl: async (pfad: string, sek: number) => {
          log.push(`sign ${bucket} ${pfad} ${sek}`)
          return pfad === 'kaputt' ? { data: null, error: { message: 'x' } } : { data: { signedUrl: `https://signiert/${pfad}` }, error: null }
        },
      }),
    },
  },
}))
vi.mock('../../../lib/monitoring', () => ({ reportError: vi.fn() }))

import { BildZuGrossError, prepareImage, removeProfileMedia, signedMediaUrl, targetSize, uploadProfileMedia } from './profileMedia'

describe('targetSize', () => {
  it('Profilbild: mittiger Quadrat-Zuschnitt, 512 Pixel', () => {
    expect(targetSize(4000, 3000, 'avatar')).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000, outW: 512, outH: 512 })
    expect(targetSize(3000, 4000, 'avatar')).toEqual({ sx: 0, sy: 500, sw: 3000, sh: 3000, outW: 512, outH: 512 })
  })

  it('Profilbild: nie hochskalieren', () => {
    expect(targetSize(300, 300, 'avatar')).toEqual({ sx: 0, sy: 0, sw: 300, sh: 300, outW: 300, outH: 300 })
    expect(targetSize(400, 200, 'avatar')).toEqual({ sx: 100, sy: 0, sw: 200, sh: 200, outW: 200, outH: 200 })
  })

  it('Titelbild: mittiger 3:1-Zuschnitt, 1500x500', () => {
    expect(targetSize(3000, 3000, 'cover')).toEqual({ sx: 0, sy: 1000, sw: 3000, sh: 1000, outW: 1500, outH: 500 })
    // schon breiter als 3:1: Seiten abschneiden
    expect(targetSize(6000, 1000, 'cover')).toEqual({ sx: 1500, sy: 0, sw: 3000, sh: 1000, outW: 1500, outH: 500 })
    // genau 3:1
    expect(targetSize(4500, 1500, 'cover')).toEqual({ sx: 0, sy: 0, sw: 4500, sh: 1500, outW: 1500, outH: 500 })
  })

  it('Titelbild: nie hochskalieren', () => {
    expect(targetSize(600, 600, 'cover')).toEqual({ sx: 0, sy: 200, sw: 600, sh: 200, outW: 600, outH: 200 })
  })

  it('Hochformat-Titelbild bleibt 3:1', () => {
    const z = targetSize(1000, 4000, 'cover')
    expect(z.sw).toBe(1000)
    expect(z.sh).toBe(333)
    expect(z.sy).toBe(1833)
    expect(z.outW / z.outH).toBeCloseTo(3, 1)
  })

  it('liefert nur ganze Zahlen', () => {
    for (const kind of ['avatar', 'cover'] as const) {
      const z = targetSize(1001, 777, kind)
      for (const wert of Object.values(z)) expect(Number.isInteger(wert)).toBe(true)
    }
  })
})

// jsdom kann keine Bilder dekodieren und kein Canvas zeichnen — die Browser-Teile
// werden hier ersetzt; geprueft wird die Logik drumherum (Zuschnitt, Qualitaetsstufen).
// `quelle` ist die Groesse, die der Probe-<img> meldet (null: nicht ermittelbar).
function canvasAttrappe(groessen: number[], quelle: { w: number; h: number } | null = { w: 4000, h: 3000 }) {
  const zeichnungen: unknown[][] = []
  const qualitaeten: (number | undefined)[] = []
  const dims: { width: number; height: number }[] = []
  let aufruf = 0
  const bitmap = vi.fn(async (_datei: Blob, opts?: { resizeWidth?: number; resizeHeight?: number }) => {
    if (!quelle) throw new Error('decode')
    return { width: opts?.resizeWidth ?? quelle.w, height: opts?.resizeHeight ?? quelle.h, close: vi.fn() }
  })
  vi.stubGlobal('createImageBitmap', bitmap)
  vi.stubGlobal('Image', class {
    naturalWidth = quelle?.w ?? 0
    naturalHeight = quelle?.h ?? 0
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_: string) { queueMicrotask(() => (quelle ? this.onload : this.onerror)?.()) }
  })
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({
    drawImage: (...args: unknown[]) => { zeichnungen.push(args) },
  })) as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback, _typ?: string, q?: unknown) {
    qualitaeten.push(q as number | undefined)
    dims.push({ width: this.width, height: this.height })
    const groesse = groessen[Math.min(aufruf++, groessen.length - 1)]
    cb(new Blob([new Uint8Array(groesse)], { type: 'image/jpeg' }))
  })
  return { zeichnungen, qualitaeten, dims, bitmap }
}

const png = () => new File(['x'], 'a.png', { type: 'image/png' })

describe('prepareImage', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('fordert die EXIF-Drehung ausdruecklich an; kleine Quelle wird nicht verkleinert dekodiert', async () => {
    const { zeichnungen, qualitaeten, dims, bitmap } = canvasAttrappe([100_000], { w: 800, h: 600 })
    const datei = png()
    const blob = await prepareImage(datei, 'avatar')
    expect(bitmap).toHaveBeenCalledTimes(1)
    expect(bitmap).toHaveBeenCalledWith(datei, { imageOrientation: 'from-image' })
    expect(blob.size).toBe(100_000)
    expect(qualitaeten).toEqual([0.82])
    expect(dims).toEqual([{ width: 512, height: 512 }])
    // 800x600: mittiger Quadrat-Zuschnitt aus den echten Bitmap-Massen
    expect(zeichnungen[0].slice(1)).toEqual([100, 0, 600, 600, 0, 0, 512, 512])
  })

  it('riesige Quelle: verkleinert dekodieren (mit Reserve) und Zuschnitt aus den Bitmap-Massen', async () => {
    const { zeichnungen, dims, bitmap } = canvasAttrappe([100_000], { w: 8000, h: 6000 })
    await prepareImage(png(), 'avatar')
    // 6000 Quellpixel je 512 Ausgabepixel -> Skala 2/11,72 = 0,1707 -> 1365x1024
    expect(bitmap).toHaveBeenCalledWith(expect.anything(), {
      imageOrientation: 'from-image', resizeWidth: 1365, resizeHeight: 1024, resizeQuality: 'high',
    })
    // Zuschnitt rechnet auf dem verkleinerten Bitmap: Quadrat 1024, mittig; Ausgabe bleibt voll 512
    expect(zeichnungen[0].slice(1)).toEqual([170, 0, 1024, 1024, 0, 0, 512, 512])
    expect(dims).toEqual([{ width: 512, height: 512 }])
  })

  it('riesiges Titelbild: bleibt nach dem Verkleinern gross genug fuer 1500x500', async () => {
    const { zeichnungen, dims, bitmap } = canvasAttrappe([100_000], { w: 9000, h: 3000 })
    await prepareImage(png(), 'cover')
    expect(bitmap).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ resizeWidth: 3000, resizeHeight: 1000 }))
    expect(zeichnungen[0].slice(1)).toEqual([0, 0, 3000, 1000, 0, 0, 1500, 500])
    expect(dims).toEqual([{ width: 1500, height: 500 }])
  })

  it('Resize-Optionen nicht unterstuetzt: faellt auf volles Dekodieren zurueck', async () => {
    const { bitmap, zeichnungen } = canvasAttrappe([100_000], { w: 8000, h: 6000 })
    bitmap.mockImplementationOnce(async () => { throw new Error('resize') })
    await prepareImage(png(), 'avatar')
    expect(bitmap).toHaveBeenCalledTimes(2)
    expect(bitmap.mock.calls[1][1]).toEqual({ imageOrientation: 'from-image' })
    expect(zeichnungen[0].slice(1)).toEqual([1000, 0, 6000, 6000, 0, 0, 512, 512])
  })

  it('Groesse nicht ermittelbar: normal dekodieren statt zu haengen', async () => {
    const { bitmap } = canvasAttrappe([100_000], { w: 800, h: 600 })
    vi.stubGlobal('Image', class {
      onerror: (() => void) | null = null
      set src(_: string) { queueMicrotask(() => this.onerror?.()) }
    })
    await prepareImage(png(), 'avatar')
    expect(bitmap).toHaveBeenCalledWith(expect.anything(), { imageOrientation: 'from-image' })
  })

  it('Datei ueber 25 MB: eigener Fehler, nichts wird dekodiert', async () => {
    const { bitmap } = canvasAttrappe([100_000])
    const gross = png()
    Object.defineProperty(gross, 'size', { value: 25 * 1024 * 1024 + 1 })
    await expect(prepareImage(gross, 'avatar')).rejects.toBeInstanceOf(BildZuGrossError)
    expect(bitmap).not.toHaveBeenCalled()
    const grenze = png()
    Object.defineProperty(grenze, 'size', { value: 25 * 1024 * 1024 })
    await expect(prepareImage(grenze, 'avatar')).resolves.toBeInstanceOf(Blob)
  })

  it('senkt die Qualitaet in 0,1-Schritten, bis das Bild unter 500 KB liegt', async () => {
    const { qualitaeten } = canvasAttrappe([900_000, 700_000, 450_000])
    const blob = await prepareImage(new File(['x'], 'a.jpg', { type: 'image/jpeg' }), 'cover')
    expect(blob.size).toBe(450_000)
    expect(qualitaeten.map(q => Math.round((q ?? 0) * 100))).toEqual([82, 72, 62])
  })

  it('geht nie unter Qualitaet 0,5 und gibt dann das kleinste Ergebnis her', async () => {
    const { qualitaeten } = canvasAttrappe([900_000])
    const blob = await prepareImage(new File(['x'], 'a.jpg', { type: 'image/jpeg' }), 'cover')
    expect(blob.size).toBe(900_000)
    expect(Math.min(...qualitaeten.map(q => q ?? 0))).toBeCloseTo(0.5, 5)
    expect(qualitaeten.length).toBeLessThanOrEqual(5)
  })

  it('wirft, wenn das Bild nicht lesbar ist', async () => {
    canvasAttrappe([100_000], null)
    await expect(prepareImage(new File(['x'], 'a.txt'), 'avatar')).rejects.toThrow()
  })
})

describe('Speicher und Profilzeile', () => {
  beforeEach(() => {
    log.length = 0
    state.altPfad = null; state.zeilen = 1; state.updateFehler = null; state.uploadFehler = null
    canvasAttrappe([100_000])
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  const datei = () => new File(['x'], 'a.png', { type: 'image/png' })

  it('laedt hoch, setzt den Pfad und loescht die alte Datei erst danach', async () => {
    state.altPfad = 'u1/avatar-1.jpg'
    const pfad = await uploadProfileMedia('u1', 'avatar', datei())
    expect(pfad).toBe('u1/avatar-1700000000000.jpg')
    expect(log).toEqual([
      'select profiles.avatar_path',
      'upload profile-media u1/avatar-1700000000000.jpg {"contentType":"image/jpeg","upsert":false}',
      'update profiles {"avatar_path":"u1/avatar-1700000000000.jpg"}',
      'remove profile-media u1/avatar-1.jpg',
    ])
  })

  it('ohne alte Datei wird nichts geloescht; Titelbild schreibt cover_path', async () => {
    const pfad = await uploadProfileMedia('u1', 'cover', datei())
    expect(pfad).toBe('u1/cover-1700000000000.jpg')
    expect(log.some(z => z.startsWith('remove'))).toBe(false)
    expect(log).toContain('update profiles {"cover_path":"u1/cover-1700000000000.jpg"}')
  })

  it('Upload scheitert: Profilzeile bleibt unberuehrt, Fehler geht nach oben', async () => {
    state.uploadFehler = 'zu gross'
    await expect(uploadProfileMedia('u1', 'avatar', datei())).rejects.toThrow('zu gross')
    expect(log.some(z => z.startsWith('update'))).toBe(false)
  })

  it('Update scheitert: neue Datei wird wieder entfernt, alte bleibt', async () => {
    state.altPfad = 'u1/avatar-1.jpg'; state.updateFehler = 'rls'
    await expect(uploadProfileMedia('u1', 'avatar', datei())).rejects.toThrow('rls')
    expect(log.at(-1)).toBe('remove profile-media u1/avatar-1700000000000.jpg')
    expect(log).not.toContain('remove profile-media u1/avatar-1.jpg')
  })

  it('Update trifft keine Zeile: wie ein Fehler behandelt, neue Datei weg', async () => {
    state.zeilen = 0; state.altPfad = 'u1/avatar-1.jpg'
    await expect(uploadProfileMedia('u1', 'avatar', datei())).rejects.toThrow()
    expect(log.at(-1)).toBe('remove profile-media u1/avatar-1700000000000.jpg')
  })

  it('Entfernen: erst Pfad auf null, dann Datei loeschen', async () => {
    await removeProfileMedia('u1', 'cover', 'u1/cover-1.jpg')
    expect(log).toEqual(['update profiles {"cover_path":null}', 'remove profile-media u1/cover-1.jpg'])
  })

  it('Entfernen: scheitert die Zeile, bleibt die Datei', async () => {
    state.updateFehler = 'rls'
    await expect(removeProfileMedia('u1', 'cover', 'u1/cover-1.jpg')).rejects.toThrow('rls')
    expect(log.some(z => z.startsWith('remove'))).toBe(false)
  })

  it('Entfernen trifft keine Zeile: wie ein Fehler, Datei bleibt', async () => {
    state.zeilen = 0
    await expect(removeProfileMedia('u1', 'cover', 'u1/cover-1.jpg')).rejects.toThrow()
    expect(log.some(z => z.startsWith('remove'))).toBe(false)
  })

  it('signierte URL: eine Stunde gueltig, bei Fehler null', async () => {
    expect(await signedMediaUrl('u1/a.jpg')).toBe('https://signiert/u1/a.jpg')
    expect(log).toContain('sign profile-media u1/a.jpg 3600')
    expect(await signedMediaUrl('kaputt')).toBeNull()
  })
})
