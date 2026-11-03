// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DotLogo } from './DotLogo'

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute('data-look')
})

describe('Hokus gewähltes Nav-Symbol „Etwas dichter“', () => {
  it('zeigt die freigegebene Partikelgeometrie mit ausgesparter Pupille als direkt eingebetteten Vektor', () => {
    const source = readFileSync('docs/logo/hoku/branding/hoku-nav-etwas-dichter.svg', 'utf8')
    const reference = new DOMParser().parseFromString(source, 'image/svg+xml')
    const { container } = render(<DotLogo />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThan(50)
    expect(container.querySelector('image')).toBeNull()
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 30 30')
    const geometry = (nodes: NodeListOf<Element>) => Array.from(nodes, circle => ['cx', 'cy', 'r', 'opacity'].map(key => Number(circle.getAttribute(key))))
    expect(geometry(circles)).toEqual(geometry(reference.querySelectorAll('circle')))
    for (const circle of circles) {
      const x = Number(circle.getAttribute('cx')), y = Number(circle.getAttribute('cy'))
      expect(Math.hypot(x - 16.5, y - 13.6) - Number(circle.getAttribute('r'))).toBeGreaterThan(3.5)
    }
  })

  it('erbt die Symbolfarbe der Navigation unabhängig von Hokus Profilfarbe und dem App-Design', () => {
    localStorage.setItem('tyd.hoku.farbe', 'sonne')
    document.documentElement.setAttribute('data-look', 'instrument')
    const { container } = render(<DotLogo />)
    expect(container.querySelectorAll('[fill="currentColor"]').length).toBeGreaterThan(50)
    expect(container.querySelector('filter, linearGradient, image')).toBeNull()
    expect(container.querySelector('[fill^="rgb"], [fill^="#"], [color]')).toBeNull()
  })
})
