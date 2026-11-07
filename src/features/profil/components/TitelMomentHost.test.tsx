// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../dot/dotStore', () => ({ useDotStand: () => ({ modus: 'house' }) }))
vi.mock('./TitelMoment', () => ({ TitelMoment: () => <div data-app-modal data-test-moment /> }))

import { TitelMomentHost } from './TitelMomentHost'
import { titleMomentStore } from '../lib/titleMomentStore'

afterEach(() => { cleanup(); document.body.innerHTML = '' })

describe('TitelMomentHost', () => {
  it('wartet, solange ein anderer Dialog offen ist (z. B. der Hoku-Chat), dann erscheint der Moment und bleibt', async () => {
    const chat = document.createElement('section')
    chat.setAttribute('data-app-modal', '')
    document.body.appendChild(chat)
    render(<TitelMomentHost />)
    act(() => titleMomentStore.announce('u1', { kind: 'rank', id: 'rank_1' }))
    await new Promise(r => setTimeout(r, 30))
    expect(document.querySelector('[data-test-moment]')).toBeNull()

    act(() => chat.remove())
    await waitFor(() => expect(document.querySelector('[data-test-moment]')).not.toBeNull())
    // Er selbst trägt data-app-modal: das blendet ihn nicht wieder aus
    await new Promise(r => setTimeout(r, 30))
    expect(document.querySelector('[data-test-moment]')).not.toBeNull()
    act(() => titleMomentStore.dismiss(titleMomentStore.get()!.seq))
  })

  it('ohne offenen Dialog sofort', async () => {
    render(<TitelMomentHost />)
    act(() => titleMomentStore.announce('u1', { kind: 'rank', id: 'rank_2' }))
    await waitFor(() => expect(document.querySelector('[data-test-moment]')).not.toBeNull())
    act(() => titleMomentStore.dismiss(titleMomentStore.get()!.seq))
  })
})
