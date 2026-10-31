// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const signedMediaUrl = vi.fn(async (pfad: string) => `https://signiert/${pfad}`)
const uploadProfileMedia = vi.fn(async (_u: string, kind: string, _f: File) => `u1/${kind}-neu.jpg`)
const removeProfileMedia = vi.fn(async (_u: string, _k: string, _p: string): Promise<void> => undefined)
const { BildZuGrossError } = vi.hoisted(() => ({ BildZuGrossError: class extends Error {} }))
vi.mock('../services/profileMedia', () => ({
  BildZuGrossError,
  signedMediaUrl: (p: string) => signedMediaUrl(p),
  uploadProfileMedia: (u: string, k: string, f: File) => uploadProfileMedia(u, k, f),
  removeProfileMedia: (u: string, k: string, p: string) => removeProfileMedia(u, k, p),
}))
const toastError = vi.fn()
vi.mock('react-hot-toast', () => ({ default: { error: (m: string) => toastError(m), success: vi.fn() } }))

import { ProfilBilder } from './ProfilBilder'

beforeEach(() => {
  signedMediaUrl.mockClear(); uploadProfileMedia.mockClear(); removeProfileMedia.mockClear(); toastError.mockClear()
})
afterEach(cleanup)

function renderBilder(over: Partial<Parameters<typeof ProfilBilder>[0]> = {}) {
  const props = { userId: 'u1', avatarPath: null, coverPath: null, onChange: vi.fn(), ...over }
  return { props, ...render(<ProfilBilder {...props}><p>Name und Mail</p></ProfilBilder>) }
}

describe('ProfilBilder', () => {
  it('ohne Bilder: Platzhalter, kein <img>, Privat-Hinweis und Kinder', () => {
    const { container, getByText } = renderBilder()
    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(signedMediaUrl).not.toHaveBeenCalled()
    expect(getByText('profil_bilder_privat')).toBeTruthy()
    expect(getByText('Name und Mail')).toBeTruthy()
  })

  it('mit Pfaden: holt signierte URLs und zeigt beide Bilder', async () => {
    const { container } = renderBilder({ avatarPath: 'u1/avatar-1.jpg', coverPath: 'u1/cover-1.jpg' })
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2))
    const quellen = Array.from(container.querySelectorAll('img')).map(i => i.getAttribute('src'))
    expect(quellen).toContain('https://signiert/u1/avatar-1.jpg')
    expect(quellen).toContain('https://signiert/u1/cover-1.jpg')
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

  it('gewaehlte Datei wird hochgeladen und der neue Pfad gemeldet', async () => {
    const { container, props } = renderBilder()
    const eingabe = container.querySelector<HTMLInputElement>('input[data-media-input="avatar"]')!
    const datei = new File(['x'], 'a.png', { type: 'image/png' })
    fireEvent.change(eingabe, { target: { files: [datei] } })
    await waitFor(() => expect(props.onChange).toHaveBeenCalledWith('avatar', 'u1/avatar-neu.jpg'))
    expect(uploadProfileMedia).toHaveBeenCalledWith('u1', 'avatar', datei)
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
    await waitFor(() => expect(props.onChange).toHaveBeenCalledWith('avatar', null))
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
