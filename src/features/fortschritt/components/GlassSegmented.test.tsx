// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlassSegmented } from './GlassSegmented'

afterEach(cleanup)

describe('GlassSegmented', () => {
  it('zeigt die Auswahl und meldet Wechsel; gesperrte Segmente erklären sich statt zu wechseln', () => {
    const onChange = vi.fn()
    const { getByRole } = render(
      <GlassSegmented
        ariaLabel="Messwert"
        value="weight"
        onChange={onChange}
        options={[
          { key: 'weight', label: 'Gewicht' },
          { key: 'fat', label: 'KFA' },
          { key: 'tsh', label: 'TSH', denyReason: 'Mindestens zwei Werte' },
        ]}
      />,
    )
    expect(getByRole('button', { name: 'Gewicht' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(getByRole('button', { name: 'KFA' }))
    expect(onChange).toHaveBeenCalledWith('fat')
    const locked = getByRole('button', { name: 'TSH' })
    expect(locked.getAttribute('aria-disabled')).toBe('true')
    expect(locked.getAttribute('data-deny-reason')).toBe('Mindestens zwei Werte')
    fireEvent.click(locked)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
