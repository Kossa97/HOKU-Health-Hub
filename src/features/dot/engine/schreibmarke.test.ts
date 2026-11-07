// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { istSchreibfeld, schreibmarke, schreibmarkeAufraeumen } from './schreibmarke'

const feld = (html: string) => {
  document.body.innerHTML = html
  const el = document.body.firstElementChild as HTMLElement
  el.getBoundingClientRect = () => ({ left: 20, top: 100, right: 220, bottom: 140, width: 200, height: 40, x: 20, y: 100, toJSON: () => ({}) })
  return el
}

describe('Schreibmarke', () => {
  afterEach(() => { schreibmarkeAufraeumen(); document.body.innerHTML = '' })

  it('zählt Text-, E-Mail- und Suchfelder und Textbereiche (Bearbeitbares misst jsdom nicht), aber kein Passwort, keinen Schalter, nichts Gesperrtes', () => {
    for (const html of ['<input>', '<input type="email">', '<input type="search">', '<textarea></textarea>'])
      expect(istSchreibfeld(feld(html)), html).toBe(true)
    for (const html of ['<input type="password">', '<input type="checkbox">', '<input readonly>', '<textarea disabled></textarea>', '<button>x</button>'])
      expect(istSchreibfeld(feld(html)), html).toBe(false)
    expect(istSchreibfeld(null)).toBe(false)
  })

  it('liegt im Feld, einzeilig auf halber Höhe, auch ohne Auswahl (E-Mail)', () => {
    for (const html of ['<input value="hallo">', '<input type="email" value="a@b.de">']) {
      const m = schreibmarke(feld(html))!
      expect(m.x).toBeGreaterThanOrEqual(20); expect(m.x).toBeLessThanOrEqual(220)
      expect(m.y).toBe(120)
    }
  })

  it('ohne Größe keine Marke', () => {
    const el = feld('<input>')
    el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) })
    expect(schreibmarke(el)).toBeNull()
  })
})
