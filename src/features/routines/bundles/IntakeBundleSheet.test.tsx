// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IntakeBundleSheet } from './IntakeBundleSheet'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

const items = [
  { id: 'a', display_name: 'Vitamin D' },
  { id: 'b', display_name: 'Omega 3' },
]

afterEach(cleanup)

describe('IntakeBundleSheet', () => {
  it('saves only with a name and at least one substance', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IntakeBundleSheet stackItems={items} onClose={vi.fn()} onSave={onSave} />)
    const save = screen.getByRole('button', { name: /Bündel speichern/ })
    expect((save as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morgen' } })
    expect((save as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByLabelText('Omega 3'))
    expect((save as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ name: 'Morgen', stackItemIds: ['b'] }))
  })

  it('drops archived substances from an existing bundle and asks before deleting', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(
      <IntakeBundleSheet
        bundle={{ id: 'x', name: 'Abend', stack_item_ids: ['a', 'gone'], sort_order: 0, created_at: '' }}
        stackItems={items}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    )
    expect((screen.getByLabelText('Vitamin D') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Bündel löschen/ }))
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Wirklich löschen/ }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce())
  })
})
