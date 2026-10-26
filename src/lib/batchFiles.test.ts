import { describe, expect, it, vi } from 'vitest'
import { batchDateiPfad, istAdresse, signiereBatchDateien, type BatchSignClient } from './batchFiles'

const BASIS = 'https://xyz.supabase.co/storage/v1/object'
const U = '00000000-0000-4000-8000-000000000001'

describe('Pfad im Speicher batch-files', () => {
  it('liest alte oeffentliche URLs, signierte Links und reine Pfade', () => {
    expect(batchDateiPfad(`${BASIS}/public/batch-files/${U}/1730.pdf`)).toBe(`${U}/1730.pdf`)
    expect(batchDateiPfad(`${BASIS}/public/batch-files/progress/${U}/a%20b.jpg`)).toBe(`progress/${U}/a b.jpg`)
    expect(batchDateiPfad(`${BASIS}/sign/batch-files/${U}/1730.pdf?token=abc`)).toBe(`${U}/1730.pdf`)
    expect(batchDateiPfad(`${U}/1730.pdf`)).toBe(`${U}/1730.pdf`)
    expect(batchDateiPfad(`/${U}/1730.pdf`)).toBe(`${U}/1730.pdf`)
    expect(batchDateiPfad(`progress/${U}/1.jpg`)).toBe(`progress/${U}/1.jpg`)
  })

  it('kennt fremde Adressen, fremde Texte und Leeres nicht', () => {
    expect(batchDateiPfad('https://example.com/zertifikat.pdf')).toBeNull()
    expect(batchDateiPfad(`${BASIS}/public/progress-photos/${U}/a.jpg`)).toBeNull()
    // ohne Schema getippt — kein Ablageort der App, also nicht signieren
    expect(batchDateiPfad('www.labor.de/coa.pdf')).toBeNull()
    expect(batchDateiPfad(`${U}/`)).toBeNull()
    expect(batchDateiPfad('')).toBeNull()
    expect(batchDateiPfad(null)).toBeNull()
  })

  it('erkennt Adressen unabhaengig von der Schreibweise', () => {
    expect(istAdresse('HTTPS://x.de/a')).toBe(true)
    expect(istAdresse(`${U}/a.jpg`)).toBe(false)
  })
})

describe('signierte Links', () => {
  function client(antwort: Array<{ path: string; signedUrl: string | null }>) {
    const createSignedUrls = vi.fn(async () => ({ data: antwort.map(e => ({ ...e, error: null })), error: null }))
    const from = vi.fn(() => ({ createSignedUrls }))
    return { client: { storage: { from } } as unknown as BatchSignClient, from, createSignedUrls }
  }

  it('signiert jeden Pfad einmal, auch wenn alt und neu darauf zeigen', async () => {
    const { client: c, from, createSignedUrls } = client([{ path: `${U}/a.pdf`, signedUrl: 'https://signiert/a' }])
    const alt = `${BASIS}/public/batch-files/${U}/a.pdf`
    const links = await signiereBatchDateien(c, [alt, `${U}/a.pdf`, 'https://example.com/x.pdf'])
    expect(from).toHaveBeenCalledWith('batch-files')
    expect(createSignedUrls).toHaveBeenCalledWith([`${U}/a.pdf`], 3600)
    expect(links.get(alt)).toBe('https://signiert/a')
    expect(links.get(`${U}/a.pdf`)).toBe('https://signiert/a')
    expect(links.get('https://example.com/x.pdf')).toBe('https://example.com/x.pdf')
  })

  it('laesst Dateien weg, die es nicht mehr gibt; fragt ohne Pfade nicht', async () => {
    const { client: c, createSignedUrls } = client([{ path: `${U}/weg.pdf`, signedUrl: null }])
    expect((await signiereBatchDateien(c, [`${U}/weg.pdf`])).size).toBe(0)
    createSignedUrls.mockClear()
    await signiereBatchDateien(c, [])
    expect(createSignedUrls).not.toHaveBeenCalled()
  })

  it('wirft bei einem Fehler des Speichers', async () => {
    const from = vi.fn(() => ({ createSignedUrls: vi.fn(async () => ({ data: null, error: { message: 'kaputt' } })) }))
    await expect(signiereBatchDateien({ storage: { from } } as unknown as BatchSignClient, [`${U}/a.pdf`])).rejects.toThrow('kaputt')
  })
})
