// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const signedMediaUrl = vi.fn(async (pfad: string) => `https://signiert/${pfad}`)
const uploadProfileMedia = vi.fn(async (_u: string, kind: string, _f: File) => `u1/${kind}-neu.jpg`)
const removeProfileMedia = vi.fn(async (_u: string, _k: string, _p: string): Promise<void> => undefined)
const checkProfileMedia = vi.fn(async (_k: string): Promise<string | null> => 'approved')
const { BildZuGrossError } = vi.hoisted(() => ({ BildZuGrossError: class extends Error {} }))
vi.mock('../services/profileMedia', () => ({
  BildZuGrossError,
  signedMediaUrl: (p: string) => signedMediaUrl(p),
  uploadProfileMedia: (u: string, k: string, f: File) => uploadProfileMedia(u, k, f),
  removeProfileMedia: (u: string, k: string, p: string) => removeProfileMedia(u, k, p),
  checkProfileMedia: (k: string) => checkProfileMedia(k),
}))
const toastError = vi.fn()
vi.mock('react-hot-toast', () => ({ default: { error: (m: string) => toastError(m), success: vi.fn() } }))

import { ProfilBilder } from './ProfilBilder'

beforeEach(() => {
  signedMediaUrl.mockClear(); uploadProfileMedia.mockClear(); removeProfileMedia.mockClear(); toastError.mockClear()
  checkProfileMedia.mockReset(); checkProfileMedia.mockResolvedValue('approved')
})
afterEach(cleanup)

function renderBilder(over: Partial<Omit<Parameters<typeof ProfilBilder>[0], 'onChange'>> = {}) {
  const props = { userId: 'u1', avatarPath: null, coverPath: null, ...over, onChange: vi.fn() }
  return { props, ...render(<ProfilBilder {...props}><p>Name und Mail</p></ProfilBilder>) }
}

describe('ProfilBilder', () => {
  it('ohne Bilder: Platzhalter, kein <img>, Prüf-Hinweis und Kinder', () => {
    const { container, getByText } = renderBilder()
    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(signedMediaUrl).not.toHaveBeenCalled()
    expect(getByText('profil_bilder_pruefung')).toBeTruthy()
    expect(getByText('Name und Mail')).toBeTruthy()
  })

  it('mit Pfaden: holt signierte URLs und zeigt beide Bilder', async () => {
    const { container } = renderBilder({ avatarPath: 'u1/avatar-1.jpg', coverPath: 'u1/cover-1.jpg' })
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2))
    const quellen = Array.from(container.querySelectorAll('img')).map(i => i.getAttribute('src'))
    expect(quellen).toContain('https://signiert/u1/avatar-1.jpg')
    expect(quellen).toContain('https://signiert/u1/cover-1.jpg')
  })

  it('neues Bild: das alte bleibt sichtbar, bis die neue URL da ist; ohne Pfad wieder Platzhalter', async () => {
    const { container, rerender } = renderBilder({ avatarPath: 'u1/avatar-1.jpg' })
    const avatarSrc = () => container.querySelector('[data-media-open="avatar"] img')?.getAttribute('src') ?? null
    await waitFor(() => expect(avatarSrc()).toBe('https://signiert/u1/avatar-1.jpg'))

    let loese!: (url: string) => void
    signedMediaUrl.mockImplementationOnce(() => new Promise<string>(resolve => { loese = resolve }))
    rerender(<ProfilBilder userId="u1" avatarPath="u1/avatar-2.jpg" coverPath={null} onChange={vi.fn()}><p>Name und Mail</p></ProfilBilder>)
    expect(avatarSrc()).toBe('https://signiert/u1/avatar-1.jpg')
    loese('https://signiert/u1/avatar-2.jpg')
    await waitFor(() => expect(avatarSrc()).toBe('https://signiert/u1/avatar-2.jpg'))

    rerender(<ProfilBilder userId="u1" avatarPath={null} coverPath={null} onChange={vi.fn()}><p>Name und Mail</p></ProfilBilder>)
    expect(avatarSrc()).toBeNull()

    // Danach ein neues Bild: bis zu seiner URL Platzhalter, nicht das entfernte.
    signedMediaUrl.mockImplementationOnce(() => new Promise<string>(resolve => { loese = resolve }))
    rerender(<ProfilBilder userId="u1" avatarPath="u1/avatar-3.jpg" coverPath={null} onChange={vi.fn()}><p>Name und Mail</p></ProfilBilder>)
    expect(avatarSrc()).toBeNull()
    loese('https://signiert/u1/avatar-3.jpg')
    await waitFor(() => expect(avatarSrc()).toBe('https://signiert/u1/avatar-3.jpg'))
  })

  it('ohne Bild oeffnet Tippen sofort die Dateiauswahl', () => {
    const { getByRole, container } = renderBilder()
    const eingabe = container.querySelector<HTMLInputElement>('input[data-media-input="avatar"]')!
    const klick = vi.spyOn(eingabe, 'click')
    fireEvent.click(getByRole('button', { name: 'profil_profilbild' }))
    expect(klick).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('mit Bild: Menue mit Aendern und Entfernen', () => {
    const { getByRole, queryByRole } = renderBilder({ avatarPath: 'u1/avatar-1.jpg' })
    fireEvent.click(getByRole('button', { name: 'profil_profilbild' }))
    expect(getByRole('dialog')).toBeTruthy()
    expect(getByRole('button', { name: 'profil_bild_aendern' })).toBeTruthy()
    expect(getByRole('button', { name: 'entfernen' })).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'cancel' }))
    expect(queryByRole('dialog')).toBeNull()
  })

  it('Aendern im Menue oeffnet die Dateiauswahl des richtigen Bildes', () => {
    const { getByRole, container } = renderBilder({ coverPath: 'u1/cover-1.jpg' })
    const eingabe = container.querySelector<HTMLInputElement>('input[data-media-input="cover"]')!
    const klick = vi.spyOn(eingabe, 'click')
    fireEvent.click(getByRole('button', { name: 'profil_titelbild' }))
    fireEvent.click(getByRole('button', { name: 'profil_bild_aendern' }))
    expect(klick).toHaveBeenCalledTimes(1)
  })

  it('gewaehlte Datei wird hochgeladen, als „wird geprüft“ gemeldet und dann geprüft', async () => {
    const { container, props } = renderBilder()
    const eingabe = container.querySelector<HTMLInputElement>('input[data-media-input="avatar"]')!
    const datei = new File(['x'], 'a.png', { type: 'image/png' })
    fireEvent.change(eingabe, { target: { files: [datei] } })
    await waitFor(() => expect(props.onChange).toHaveBeenCalledWith('avatar', 'u1/avatar-neu.jpg', 'approved'))
    expect(props.onChange.mock.calls).toEqual([
      ['avatar', 'u1/avatar-neu.jpg', 'pending'],
      ['avatar', 'u1/avatar-neu.jpg', 'approved'],
    ])
    expect(uploadProfileMedia).toHaveBeenCalledWith('u1', 'avatar', datei)
    expect(checkProfileMedia).toHaveBeenCalledWith('avatar')
  })

  it('Prüfung lehnt ab: Pfad null und Status rejected', async () => {
    checkProfileMedia.mockResolvedValueOnce('rejected')
    const { container, props } = renderBilder()
    fireEvent.change(container.querySelector('input[data-media-input="cover"]')!, { target: { files: [new File(['x'], 'a.png')] } })
    await waitFor(() => expect(props.onChange).toHaveBeenLastCalledWith('cover', null, 'rejected'))
  })

  it('Prüfung scheitert: es bleibt bei „wird geprüft“, keine weitere Meldung', async () => {
    checkProfileMedia.mockResolvedValueOnce('pending')
    const { container, props } = renderBilder()
    fireEvent.change(container.querySelector('input[data-media-input="avatar"]')!, { target: { files: [new File(['x'], 'a.png')] } })
    await waitFor(() => expect(checkProfileMedia).toHaveBeenCalled())
    await Promise.resolve()
    expect(props.onChange.mock.calls).toEqual([['avatar', 'u1/avatar-neu.jpg', 'pending']])
  })

  it('Status pending: „wird geprüft“ am Bild; abgelehnt: Hinweis mit „Anderes wählen“', () => {
    const { container, rerender, getByText } = renderBilder({ avatarPath: 'u1/avatar-1.jpg', avatarStatus: 'pending', coverPath: 'u1/cover-1.jpg', coverStatus: 'approved' })
    expect(container.querySelector('[data-media-pending="avatar"]')?.textContent).toBe('profil_bild_wird_geprueft')
    expect(container.querySelector('[data-media-pending="cover"]')).toBeNull()
    expect(container.querySelector('[data-media-rejected]')).toBeNull()

    rerender(<ProfilBilder userId="u1" avatarPath={null} avatarStatus="rejected" coverPath={null} onChange={vi.fn()} />)
    expect(container.querySelector('[data-media-pending]')).toBeNull()
    expect(getByText('profil_bild_abgelehnt')).toBeTruthy()
    const eingabe = container.querySelector<HTMLInputElement>('input[data-media-input="avatar"]')!
    const klick = vi.spyOn(eingabe, 'click')
    fireEvent.click(container.querySelector('[data-media-choose-other]')!)
    expect(klick).toHaveBeenCalledTimes(1)
  })

  it('Upload scheitert: Toast, keine Aenderung nach oben', async () => {
    uploadProfileMedia.mockRejectedValueOnce(new Error('x'))
    const { container, props } = renderBilder()
    fireEvent.change(container.querySelector('input[data-media-input="cover"]')!, { target: { files: [new File(['x'], 'a.png')] } })
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('profil_bild_fehler'))
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it('Datei zu gross: eigener Text', async () => {
    uploadProfileMedia.mockRejectedValueOnce(new BildZuGrossError())
    const { container, props } = renderBilder()
    fireEvent.change(container.querySelector('input[data-media-input="avatar"]')!, { target: { files: [new File(['x'], 'a.png')] } })
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('profil_bild_zu_gross'))
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it('Entfernen loescht Datei und Pfad und meldet null', async () => {
    const { getByRole, props } = renderBilder({ avatarPath: 'u1/avatar-1.jpg' })
    fireEvent.click(getByRole('button', { name: 'profil_profilbild' }))
    fireEvent.click(getByRole('button', { name: 'entfernen' }))
    await waitFor(() => expect(props.onChange).toHaveBeenCalledWith('avatar', null, null))
    expect(removeProfileMedia).toHaveBeenCalledWith('u1', 'avatar', 'u1/avatar-1.jpg')
  })

  it('Entfernen scheitert: Toast, Bild bleibt', async () => {
    removeProfileMedia.mockRejectedValueOnce(new Error('x'))
    const { getByRole, props } = renderBilder({ avatarPath: 'u1/avatar-1.jpg' })
    fireEvent.click(getByRole('button', { name: 'profil_profilbild' }))
    fireEvent.click(getByRole('button', { name: 'entfernen' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('profil_bild_fehler'))
    expect(props.onChange).not.toHaveBeenCalled()
  })
})
