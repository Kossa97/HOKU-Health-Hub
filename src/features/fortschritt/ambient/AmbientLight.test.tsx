// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AmbientLightProvider } from './AmbientLight'
import { useAmbientTint, type LightSlot, type Tint } from './context'

afterEach(cleanup)

function Tinter({ slot, tint }: { slot: LightSlot; tint: Tint | null }) {
  useAmbientTint(slot, tint)
  return null
}

const light = (container: HTMLElement, slot: LightSlot) =>
  container.querySelector<HTMLElement>(`.fg-light-${slot}`)!
/** Farbe und Grundhelligkeit sitzen auf der inneren Ebene */
const core = (container: HTMLElement, slot: LightSlot) => light(container, slot).firstElementChild as HTMLElement

describe('AmbientLightProvider (feste Bühne)', () => {
  it('zeigt drei Lichter in Grundfarbe', () => {
    const { container } = render(<AmbientLightProvider><div /></AmbientLightProvider>)
    expect(container.querySelectorAll('.fg-light')).toHaveLength(3)
    expect(light(container, 'middle').dataset.tinted).toBe('false')
    expect(core(container, 'middle').style.opacity).toBe('0.18')
  })

  it('färbt ein Licht, solange eine Karte es wünscht, und gibt es danach zurück', () => {
    const { container, rerender } = render(
      <AmbientLightProvider><Tinter slot="middle" tint={{ color: '#ff0000' }} /></AmbientLightProvider>,
    )
    expect(core(container, 'middle').style.backgroundColor).toBe('rgb(255, 0, 0)')
    expect(light(container, 'top').dataset.tinted).toBe('false')

    rerender(<AmbientLightProvider><Tinter slot="middle" tint={null} /></AmbientLightProvider>)
    expect(light(container, 'middle').dataset.tinted).toBe('false')
  })

  it('Farbe und Helligkeit zweier Wünsche verbinden sich; je Eigenschaft gewinnt der neueste', () => {
    const { container, rerender } = render(
      <AmbientLightProvider>
        <Tinter slot="top" tint={{ color: '#ff0000' }} />
        <Tinter slot="top" tint={{ boost: 0.1 }} />
      </AmbientLightProvider>,
    )
    expect(Number(core(container, 'top').style.opacity)).toBeCloseTo(0.28)
    // Der zweite Wunsch hellt nur auf — die Farbe des ersten bleibt
    expect(core(container, 'top').style.backgroundColor).toBe('rgb(255, 0, 0)')

    rerender(
      <AmbientLightProvider>
        <Tinter slot="top" tint={{ color: '#ff0000' }} />
        <Tinter slot="top" tint={{ color: '#00ff00' }} />
      </AmbientLightProvider>,
    )
    expect(core(container, 'top').style.backgroundColor).toBe('rgb(0, 255, 0)')
    expect(core(container, 'top').style.opacity).toBe('0.18')
  })

  it('nur Aufhellen gilt nicht als gefärbt', () => {
    const { container } = render(<AmbientLightProvider><Tinter slot="top" tint={{ boost: 0.12 }} /></AmbientLightProvider>)
    expect(light(container, 'top').dataset.tinted).toBe('false')
    expect(Number(core(container, 'top').style.opacity)).toBeCloseTo(0.3)
  })
})
