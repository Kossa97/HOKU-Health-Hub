// @vitest-environment jsdom
import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppBackNavigation } from './AppBackNavigation'

function LocationProbe() {
  return <output aria-label="location">{useLocation().pathname}</output>
}

function TestApp({ modal = false }: { modal?: boolean }) {
  const [open, setOpen] = useState(modal)

  return (
    <AppBackNavigation>
      <LocationProbe />
      {open && (
        <div data-app-modal>
          <label>
            Name
            <input aria-label="Name" defaultValue="" />
          </label>
          <button type="button" data-app-back-close onClick={() => setOpen(false)}>
            Schließen
          </button>
        </div>
      )}
      <Routes>
        <Route path="/first" element={<p>First</p>} />
        <Route path="/second" element={<p>Second</p>} />
      </Routes>
    </AppBackNavigation>
  )
}

function ButtonOnlyModalApp() {
  const [open, setOpen] = useState(true)

  return (
    <AppBackNavigation>
      <LocationProbe />
      {open && (
        <div data-app-modal data-app-back-dirty-on-interaction>
          <button type="button">Auswahl ändern</button>
          <button type="button" data-app-back-close onClick={() => setOpen(false)}>Schließen</button>
        </div>
      )}
      <Routes><Route path="/second" element={<p>Second</p>} /></Routes>
    </AppBackNavigation>
  )
}

function RoleOnlyModalApp() {
  const [open, setOpen] = useState(true)

  return (
    <AppBackNavigation>
      <LocationProbe />
      {open && (
        <div role="dialog" aria-modal="true">
          <input aria-label="Menge" defaultValue="" />
          <button type="button" data-app-back-close onClick={() => setOpen(false)}>Schließen</button>
        </div>
      )}
      <Routes><Route path="/second" element={<p>Second</p>} /></Routes>
    </AppBackNavigation>
  )
}

function renderAtSecond(modal = false) {
  return render(
    <MemoryRouter initialEntries={['/first', '/second']} initialIndex={1}>
      <TestApp modal={modal} />
    </MemoryRouter>,
  )
}

function swipe(startX: number, endX: number, startY = 160, endY = 166) {
  fireEvent.pointerDown(window, { pointerId: 1, pointerType: 'touch', clientX: startX, clientY: startY })
  fireEvent.pointerMove(window, { pointerId: 1, pointerType: 'touch', clientX: endX, clientY: endY })
  fireEvent.pointerUp(window, { pointerId: 1, pointerType: 'touch', clientX: endX, clientY: endY })
}

function PageCloseApp({ onClose }: { onClose: () => void }) {
  return (
    <AppBackNavigation>
      <LocationProbe />
      <button type="button" data-app-page-close onClick={onClose}>Schließen</button>
      <Routes><Route path="/ernaehrung" element={<p>Ernährung</p>} /></Routes>
    </AppBackNavigation>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('app-wide edge swipe back', () => {
  it('navigates back after a deliberate right swipe starting at the left edge', () => {
    renderAtSecond()

    swipe(12, 104)

    expect(screen.getByLabelText('location').textContent).toBe('/first')
  })

  it('leaves horizontal content gestures alone when they start outside the edge', () => {
    renderAtSecond()

    swipe(48, 160)

    expect(screen.getByLabelText('location').textContent).toBe('/second')
  })

  it('leaves vertical scrolling alone even when it starts at the edge', () => {
    renderAtSecond()

    swipe(12, 58, 80, 190)

    expect(screen.getByLabelText('location').textContent).toBe('/second')
  })

  it('triggers the page close control of a page without tab bar, even without history', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter initialEntries={['/ernaehrung']}>
        <PageCloseApp onClose={onClose} />
      </MemoryRouter>,
    )

    swipe(12, 104)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes the top app window before changing the route', () => {
    renderAtSecond(true)

    swipe(12, 104)

    expect(screen.queryByText('Schließen')).toBeNull()
    expect(screen.getByLabelText('location').textContent).toBe('/second')
  })

  it('asks before discarding edited form values', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAtSecond(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Geändert' } })

    swipe(12, 104)

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Schließen')).not.toBeNull()
    expect(screen.getByLabelText('location').textContent).toBe('/second')
  })

  it('also protects unsaved button-only selections that opt into dirty tracking', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(
      <MemoryRouter initialEntries={['/second']}>
        <ButtonOnlyModalApp />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Auswahl ändern' }))

    swipe(12, 104)

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Schließen')).not.toBeNull()
  })

  it('leaves the question to a modal that confirms by itself', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const close = vi.fn()
    render(
      <MemoryRouter initialEntries={['/second']}>
        <AppBackNavigation>
          <div data-app-modal data-app-back-self-confirm>
            <input aria-label="Notiz" defaultValue="" />
            <button type="button" data-app-back-close onClick={close}>Schließen</button>
          </div>
        </AppBackNavigation>
      </MemoryRouter>,
    )
    fireEvent.input(screen.getByLabelText('Notiz'), { target: { value: 'x' } })

    swipe(12, 104)

    expect(confirm).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('tracks edited fields in semantic dialogs without a wrapper attribute', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(
      <MemoryRouter initialEntries={['/second']}>
        <RoleOnlyModalApp />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Menge' }), { target: { value: '1' } })

    swipe(12, 104)

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Schließen')).not.toBeNull()
  })
})
