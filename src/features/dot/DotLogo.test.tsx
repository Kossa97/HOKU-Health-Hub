// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { DotLogo } from './DotLogo'
import { setzeFarbWahl } from './lib/hokuFarbe'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.setAttribute('data-look', 'schwarz')
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Hokus neues Leistenzeichen', () => {
  it('zeigt im Standarddesign das freigestellte neue Hoku-Motiv', () => {
    const { container } = render(<DotLogo />)
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/icons/hoku-dunkel-symbol-128.png')
    expect(container.querySelector('image')?.getAttribute('filter')).toBeNull()
  })

  it('behält das neue Motiv bei und folgt einer Änderung der Profilfarbe', () => {
    const { container } = render(<DotLogo />)
    const tones = () => Array.from(container.querySelectorAll('feFuncR, feFuncG, feFuncB')).map(e => e.getAttribute('tableValues')).join('|')
    act(() => setzeFarbWahl('minze'))
    const mint = tones()
    expect(mint).not.toBe('')
    act(() => setzeFarbWahl('sonne'))
    expect(tones()).not.toBe(mint)
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/icons/hoku-dunkel-symbol-128.png')
  })

  it('folgt bei automatischer Farbe dem Design, während eine eigene Wahl erhalten bleibt', async () => {
    const { container } = render(<DotLogo />)
    const tones = () => Array.from(container.querySelectorAll('feFuncR, feFuncG, feFuncB')).map(e => e.getAttribute('tableValues')).join('|')
    document.documentElement.setAttribute('data-look', 'satin')
    await waitFor(() => expect(tones()).not.toBe(''))
    act(() => setzeFarbWahl('sonne'))
    const sun = tones()
    await act(async () => { document.documentElement.setAttribute('data-look', 'instrument') })
    expect(tones()).toBe(sun)
  })

  it('erhält auch die wählbare Cyan-Violett-Stimmung auf der neuen Silhouette', () => {
    localStorage.setItem('tyd.hoku.farbe', 'heute')
    const { container } = render(<DotLogo />)
    expect(container.querySelector('mask image')?.getAttribute('href')).toBe('/icons/hoku-dunkel-symbol-128.png')
    expect(container.querySelectorAll('linearGradient stop')).toHaveLength(3)
  })
})
