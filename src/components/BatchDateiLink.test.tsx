// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sign = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: () => ({ createSignedUrls: sign }) } } }))
const reportError = vi.fn()
vi.mock('../lib/monitoring', () => ({ reportError: (...args: unknown[]) => reportError(...args) }))

import { BatchDateiLink } from './BatchDateiLink'

const PFAD = '00000000-0000-4000-8000-000000000001/1730.pdf'
const MIN = 60 * 1000

function antwort(token: string) {
  return { data: [{ path: PFAD, signedUrl: `https://s/${token}`, error: null }], error: null }
}

async function warten() {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  sign.mockReset()
  reportError.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Link zu einer Datei in batch-files', () => {
  it('steht signiert im href; bis dahin Text ohne Link', async () => {
    sign.mockResolvedValueOnce(antwort('eins'))
    render(<BatchDateiLink wert={PFAD}>Zertifikat</BatchDateiLink>)
    expect(screen.queryByRole('link')).toBeNull()
    await warten()
    expect(screen.getByRole('link', { name: 'Zertifikat' }).getAttribute('href')).toBe('https://s/eins')
  })

  it('nach langer Pause im Hintergrund: beim Zurueckkehren neu signiert', async () => {
    sign.mockResolvedValueOnce(antwort('eins')).mockResolvedValueOnce(antwort('zwei'))
    render(<BatchDateiLink wert={PFAD}>Zertifikat</BatchDateiLink>)
    await warten()
    // Uhr springt (Geraet schlief), Timer hat nicht gefeuert
    vi.setSystemTime(Date.now() + 70 * MIN)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await warten()
    expect(sign).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://s/zwei')
  })

  it('abgelaufen beim Tippen: oeffnet nicht den alten Link, holt einen neuen', async () => {
    sign.mockResolvedValueOnce(antwort('eins')).mockResolvedValueOnce(antwort('zwei'))
    render(<BatchDateiLink wert={PFAD}>Zertifikat</BatchDateiLink>)
    await warten()
    vi.setSystemTime(Date.now() + 61 * MIN)
    const geoeffnet = fireEvent.click(screen.getByRole('link'))
    expect(geoeffnet).toBe(false) // preventDefault
    await warten()
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://s/zwei')
  })

  it('Fehler: gemeldet und spaeter erneut versucht', async () => {
    sign.mockResolvedValueOnce({ data: null, error: { message: 'netz' } }).mockResolvedValueOnce(antwort('eins'))
    render(<BatchDateiLink wert={PFAD}>Zertifikat</BatchDateiLink>)
    await warten()
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('link')).toBeNull()
    await act(async () => { vi.advanceTimersByTime(30 * 1000) })
    await warten()
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://s/eins')
  })

  it('Datei gibt es nicht mehr: Text ohne Link, kein Fehler', async () => {
    sign.mockResolvedValueOnce({ data: [{ path: PFAD, signedUrl: null, error: 'Object not found' }], error: null })
    render(<BatchDateiLink wert={PFAD}>Zertifikat</BatchDateiLink>)
    await warten()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Zertifikat').getAttribute('aria-disabled')).toBe('true')
    expect(reportError).not.toHaveBeenCalled()
  })
})
