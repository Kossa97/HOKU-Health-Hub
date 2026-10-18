// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProgressPhotoEntry } from '../../types'

vi.mock('../../../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))

const { FotosCard } = await import('./FotosCard')

afterEach(cleanup)

const photo = (id: string, taken_at: string, weight_kg: number | null): ProgressPhotoEntry => ({
  id, taken_at, weight_kg, photo_url: `${id}.jpg`, display_url: `https://example.test/${id}.jpg`, notes: null,
})
const range = { from: '2026-01-01', to: '2026-03-01' }

describe('FotosCard', () => {
  it('vergleicht erstes und letztes Foto im Zeitraum mit einem verschiebbaren Regler', () => {
    const photos = [photo('mid', '2026-02-01', 85), photo('last', '2026-02-25', 83), photo('first', '2026-01-05', 87), photo('old', '2025-06-01', 90)]
    const { getByRole, getAllByRole } = render(<FotosCard photos={photos} range={range} onChange={() => {}} />)
    const imgs = getAllByRole('img')
    expect(imgs.map(i => i.getAttribute('src'))).toEqual(['https://example.test/first.jpg', 'https://example.test/last.jpg'])
    const slider = getByRole('slider')
    expect(slider.getAttribute('aria-valuenow')).toBe('50')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider.getAttribute('aria-valuenow')).toBe('55')
  })

  it('Antippen öffnet das Foto der angetippten Seite, Ziehen verschiebt nur die Linie', () => {
    const photos = [photo('first', '2026-01-05', 87), photo('last', '2026-02-25', 83)]
    const { container, getByRole } = render(<FotosCard photos={photos} range={range} onChange={() => {}} />)
    const box = container.querySelector('.fg-compare') as HTMLElement
    box.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 400, right: 300, bottom: 400, x: 0, y: 0, toJSON: () => ({}) })

    fireEvent.pointerDown(box, { clientX: 60, pointerId: 1 })
    fireEvent.pointerMove(box, { clientX: 120, pointerId: 1 })
    fireEvent.pointerUp(box, { clientX: 120, pointerId: 1 })
    expect(getByRole('slider').getAttribute('aria-valuenow')).toBe('40')
    expect(container.ownerDocument.querySelector('.fs-sheet')).toBeNull()

    fireEvent.pointerDown(box, { clientX: 250, pointerId: 2 })
    fireEvent.pointerUp(box, { clientX: 251, pointerId: 2 })
    expect(container.ownerDocument.querySelector('.fs-sheet')).not.toBeNull()
    expect(getByRole('slider').getAttribute('aria-valuenow')).toBe('40')
  })

  it('ein Foto im Zeitraum: kein Vergleich, das Foto selbst', () => {
    const { queryByRole, getAllByRole } = render(<FotosCard photos={[photo('a', '2026-01-10', null)]} range={range} onChange={() => {}} />)
    expect(queryByRole('slider')).toBeNull()
    expect(getAllByRole('img')).toHaveLength(1)
  })

  it('ohne Fotos lädt ein Knopf zum Hinzufügen ein', () => {
    const { getAllByRole } = render(<FotosCard photos={[]} range={range} onChange={() => {}} />)
    expect(getAllByRole('button', { name: 'fortschritt_photo_add' })).toHaveLength(2)
  })
})
