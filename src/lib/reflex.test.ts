// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installReflex } from './reflex'

let abbauen: () => void
let karte: HTMLElement

beforeEach(() => {
  abbauen = installReflex()
  karte = document.createElement('div')
  karte.className = 'lg-surface'
  karte.innerHTML = '<span>Inhalt</span>'
  karte.getBoundingClientRect = () => ({ left: 100, width: 200, top: 0, right: 300, bottom: 50, height: 50, x: 100, y: 0, toJSON: () => ({}) })
  document.body.appendChild(karte)
})
afterEach(() => {
  abbauen()
  karte.remove()
  document.documentElement.removeAttribute('data-look')
})

function zeiger(typ: string, ziel: EventTarget, clientX: number) {
  const event = new MouseEvent(typ, { bubbles: true, clientX }) as unknown as PointerEvent
  ziel.dispatchEvent(event)
}

describe('Lichtreflex (Satin)', () => {
  it('folgt dem Finger auf der Karte und bleibt von den Rundungen weg', () => {
    document.documentElement.setAttribute('data-look', 'satin')
    zeiger('pointerdown', karte.querySelector('span')!, 250)
    expect(karte.dataset.reflexTouch).toBe('true')
    expect(karte.style.getPropertyValue('--rx')).toBe('75.0%')
    zeiger('pointermove', document, 110)
    expect(karte.style.getPropertyValue('--rx')).toBe('18.0%')
    zeiger('pointerup', document, 110)
    expect(karte.dataset.reflexTouch).toBeUndefined()
  })

  it('tut in den anderen Erscheinungsbildern nichts', () => {
    document.documentElement.setAttribute('data-look', 'schwarz')
    zeiger('pointerdown', karte, 250)
    expect(karte.dataset.reflexTouch).toBeUndefined()
  })
})
