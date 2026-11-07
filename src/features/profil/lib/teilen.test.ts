// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { kopiereText, teileLink } from './teilen'

const URL_ = 'https://hokuhealth.app/u/mara'

function setzeNavigator(werte: { share?: unknown; clipboard?: unknown }) {
  Object.defineProperty(navigator, 'share', { value: werte.share, configurable: true, writable: true })
  Object.defineProperty(navigator, 'clipboard', { value: werte.clipboard, configurable: true, writable: true })
}

function setzeExecCommand(ergebnis: boolean | Error) {
  const fn = vi.fn(() => {
    if (ergebnis instanceof Error) throw ergebnis
    return ergebnis
  })
  Object.defineProperty(document, 'execCommand', { value: fn, configurable: true, writable: true })
  return fn
}

afterEach(() => {
  setzeNavigator({})
  vi.restoreAllMocks()
})

describe('kopiereText', () => {
  it('nimmt die Zwischenablage', async () => {
    const writeText = vi.fn(async () => {})
    setzeNavigator({ clipboard: { writeText } })
    const exec = setzeExecCommand(true)
    await expect(kopiereText(URL_)).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith(URL_)
    expect(exec).not.toHaveBeenCalled()
  })

  it('fällt bei verweigerter Zwischenablage auf die Textauswahl zurück und räumt auf', async () => {
    setzeNavigator({ clipboard: { writeText: vi.fn(async () => { throw new DOMException('nein', 'NotAllowedError') }) } })
    const exec = setzeExecCommand(true)
    await expect(kopiereText(URL_)).resolves.toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('ohne Zwischenablage und ohne execCommand: false', async () => {
    setzeNavigator({})
    setzeExecCommand(new Error('nicht unterstützt'))
    await expect(kopiereText(URL_)).resolves.toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
  })
})

describe('teileLink', () => {
  it('teilt über den Systemdialog', async () => {
    const share = vi.fn(async () => {})
    setzeNavigator({ share })
    await expect(teileLink({ title: 'Mara', url: URL_ })).resolves.toBe('geteilt')
    expect(share).toHaveBeenCalledWith({ title: 'Mara', url: URL_ })
  })

  it('Abbrechen ist kein Fehler und kopiert nicht', async () => {
    const writeText = vi.fn(async () => {})
    setzeNavigator({ share: vi.fn(async () => { throw new DOMException('weg', 'AbortError') }), clipboard: { writeText } })
    await expect(teileLink({ title: 'Mara', url: URL_ })).resolves.toBe('abgebrochen')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('ohne Systemdialog oder wenn er scheitert: kopieren', async () => {
    const writeText = vi.fn(async () => {})
    setzeNavigator({ clipboard: { writeText } })
    await expect(teileLink({ title: 'Mara', url: URL_ })).resolves.toBe('kopiert')
    setzeNavigator({ share: vi.fn(async () => { throw new DOMException('nein', 'NotAllowedError') }), clipboard: { writeText } })
    await expect(teileLink({ title: 'Mara', url: URL_ })).resolves.toBe('kopiert')
    expect(writeText).toHaveBeenCalledTimes(2)
  })

  it('kopieren scheitert auch: fehler', async () => {
    setzeNavigator({})
    setzeExecCommand(false)
    await expect(teileLink({ title: 'Mara', url: URL_ })).resolves.toBe('fehler')
  })
})
