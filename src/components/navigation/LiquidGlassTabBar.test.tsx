// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiquidGlassTabBar, type GlassTabItem } from './LiquidGlassTabBar'
import { SLOT_ATTR, pillenBreite } from './tabBarGeometry'

function masse(reiter: Record<string, { links: number; breite: number }>, kapsel = 360) {
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get(this: HTMLElement) { return reiter[this.getAttribute(SLOT_ATTR) ?? '']?.links ?? 0 },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      const eigen = reiter[this.getAttribute(SLOT_ATTR) ?? '']
      return eigen ? eigen.breite : kapsel
    },
  })
}

const eintraege = (ids: string[]): GlassTabItem[] => ids.map(id => ({
  id,
  label: id,
  art: id === 'plus' ? 'aktion' : 'tab',
  icon: <svg data-icon={id} />,
  render: ({ className, children, ...rest }) => (
    id === 'plus'
      ? <button key={id} type="button" className={className} data-tyd-center {...rest}>{children}</button>
      : <a key={id} href={`/${id}`} className={className} {...rest}>{children}</a>
  ),
}))

const pille = () => document.querySelector('[data-tyd-pill]') as HTMLElement
const leiste = () => document.querySelector('.tyd-tabbar') as HTMLElement
const reiter = (id: string) => document.querySelector(`[${SLOT_ATTR}="${id}"]`) as HTMLElement

/** Ein Zeigerereignis, wie es ein Finger auslöst. jsdom kennt PointerEvent nicht. */
function zeiger(art: string, ziel: HTMLElement, clientX: number) {
  const e = new MouseEvent(art, { bubbles: true, cancelable: true, clientX }) as MouseEvent & {
    pointerId: number
  }
  Object.defineProperty(e, 'pointerId', { value: 1 })
  // In `act`, damit React die Zustandsänderung fertig einarbeitet, bevor der
  // Test ins DOM schaut.
  act(() => { ziel.dispatchEvent(e) })
}

describe('LiquidGlassTabBar', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {} unobserve() {} disconnect() {}
    })
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  const bauen = (
    activeId: string | null,
    haken: { onSelect?: (id: string) => void; onPreviewChange?: (id: string) => void } = {},
  ) => render(
    <LiquidGlassTabBar
      items={eintraege(['home', 'my-stack', 'plus', 'kalender', 'profil'])}
      activeId={activeId}
      ariaLabel="Navigation"
      {...haken}
    />,
  )

  /** Damit `setPointerCapture` in jsdom nicht auf die Nase fällt. */
  const zeigerfaehig = (el: HTMLElement) => {
    el.setPointerCapture = () => {}
    el.releasePointerCapture = () => {}
    el.hasPointerCapture = () => true
  }

  it('legt die Pille mittig auf den aktiven Reiter, gemessen statt gerechnet', () => {
    // Die Plätze sind unterschiedlich breit — eine Formel aus „Kapselbreite
    // durch Anzahl" träfe daneben. Die Pille ist schmaler als ein Platz und
    // sitzt in seiner Mitte: sie umfasst das Symbol, sie malt nicht das Fach
    // aus. 82 + (96 − 46) / 2 = 107.
    masse({ home: { links: 8, breite: 70 }, 'my-stack': { links: 82, breite: 96 } })
    bauen('my-stack')

    // pillenBreite(96) = 64; links = 82 + (96 − 64) / 2 = 98
    expect(pille().style.transform).toBe('translateX(98px)')
    expect(pille().style.width).toBe(`${pillenBreite(96)}px`)
  })

  it('blendet die Pille aus, wo kein Reiter gilt', () => {
    // Auf „/faq" ist man in keinem Reiter — dann gehört dorthin auch keine
    // Pille, statt sie willkürlich unter „Home" zu parken.
    masse({ home: { links: 8, breite: 70 } })
    bauen(null)

    expect(pille().dataset.ohneZiel).toBe('true')
  })

  it('führt die mittlere Schaltfläche als vollwertigen Platz mit', () => {
    masse({ home: { links: 8, breite: 70 } })
    bauen('home')

    const kinder = [...leiste().children].slice(1)   // ohne die Pille
    expect(kinder.map(k => k.getAttribute(SLOT_ATTR)))
      .toEqual(['home', 'my-stack', 'plus', 'kalender', 'profil'])
  })

  it('setzt den aktiven Reiter als aktuelle Seite, für Vorlesung und Farbe', () => {
    masse({ kalender: { links: 200, breite: 80 } })
    bauen('kalender')

    const aktiv = document.querySelector('[aria-current="page"]')
    expect(aktiv?.getAttribute(SLOT_ATTR)).toBe('kalender')
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })

  it('führt den Schimmer im Glas der Pille nach', () => {
    // Der räumliche Anteil: Apple holt ihn aus echter Brechung, wir deuten ihn
    // mit einem Lichtfleck an, der dort sitzt, wo die Pille steht.
    masse({ 'my-stack': { links: 82, breite: 96 } }, 360)
    bauen('my-stack')

    // (82 + 96/2) / 360 = 36,11 %
    expect(leiste().style.getPropertyValue('--tyd-glint')).toBe('36.11111111111111%')
  })

  it('lässt die Pille am Finger hängen, ohne unterwegs einzurasten', () => {
    // Vorher sprang sie von Platz zu Platz; das fühlte sich an wie ein
    // Schalter, nicht wie etwas, das man in der Hand hat. Jetzt sitzt sie
    // mittig unter der Fingerspitze — auch dort, wo gar kein Platz ist.
    masse({
      home: { links: 8, breite: 70 },
      'my-stack': { links: 82, breite: 90 },
      kalender: { links: 200, breite: 80 },
      profil: { links: 284, breite: 68 },
    })
    bauen('home')
    zeigerfaehig(leiste())
    leiste().getBoundingClientRect = () => ({ left: 0, top: 0, right: 360, bottom: 62, width: 360, height: 62, x: 0, y: 0, toJSON: () => ({}) })

    zeiger('pointerdown', reiter('home'), 40)
    expect(pille().dataset.gehalten).toBe('true')

    // Breite bleibt die des Platzes, auf dem der Finger aufsetzte:
    // pillenBreite(70) = 58. Bei x = 240 also 240 − 29 = 211 …
    zeiger('pointermove', leiste(), 240)
    expect(pille().style.transform).toBe('translateX(211px)')
    expect(pille().dataset.frei).toBe('true')

    // … und bei x = 250 zehn Pixel weiter, nicht wieder auf 211 gerastet.
    zeiger('pointermove', leiste(), 250)
    expect(pille().style.transform).toBe('translateX(221px)')
  })

  it('öffnet beim Loslassen den Reiter unter dem Finger', () => {
    const geoeffnet: string[] = []
    masse({
      home: { links: 8, breite: 70 },
      kalender: { links: 200, breite: 80 },
    })
    bauen('home', { onSelect: id => geoeffnet.push(id) })
    zeigerfaehig(leiste())
    leiste().getBoundingClientRect = () => ({ left: 0, top: 0, right: 360, bottom: 62, width: 360, height: 62, x: 0, y: 0, toJSON: () => ({}) })

    zeiger('pointerdown', reiter('home'), 40)
    zeiger('pointermove', leiste(), 240)
    zeiger('pointerup', leiste(), 240)

    expect(geoeffnet).toEqual(['kalender'])
  })

  it('lässt einen einfachen Tipp der Verknüpfung selbst', () => {
    // Ohne Wandern gibt es kein `onSelect`: dann macht die Verknüpfung ihre
    // Arbeit, samt allem, was ein Browser an einer Verknüpfung kann.
    const geoeffnet: string[] = []
    masse({ home: { links: 8, breite: 70 } })
    bauen('home', { onSelect: id => geoeffnet.push(id) })
    zeigerfaehig(leiste())

    zeiger('pointerdown', reiter('home'), 40)
    zeiger('pointerup', leiste(), 40)

    expect(geoeffnet).toEqual([])
  })

  it('öffnet nach einem Tipp nur den angetippten Platz, nicht die überglittenen', () => {
    // Gemeldet auf dem iPhone: Tipp von Profil auf Home öffnete unterwegs
    // Kalender, Hoku und My Stack. Nur der Platz unter dem Finger zählt, einmal.
    masse({ home: { links: 8, breite: 70 }, kalender: { links: 160, breite: 70 } })
    bauen('profil')
    zeigerfaehig(leiste())
    const klick = (id: string, detail = 1) => {
      const e = new MouseEvent('click', { bubbles: true, cancelable: true, detail })
      act(() => { reiter(id).dispatchEvent(e) })
      return e.defaultPrevented
    }

    zeiger('pointerdown', reiter('home'), 40)
    zeiger('pointerup', leiste(), 40)

    expect(klick('kalender')).toBe(true)
    expect(klick('plus')).toBe(true)
    expect(klick('home')).toBe(false)
    expect(klick('home')).toBe(true)
    // Tastatur und Vorlesung klicken ohne Finger: das bleibt erlaubt
    expect(klick('kalender', 0)).toBe(false)
  })

  it('laesst einen Tipp ohne Pointer-Capture beim eigentlichen Link', () => {
    masse({ home: { links: 8, breite: 70 } })
    bauen('home')
    const link = reiter('home')
    const linkCapture = vi.fn()
    const navCapture = vi.fn()
    link.setPointerCapture = linkCapture
    leiste().setPointerCapture = navCapture

    zeiger('pointerdown', link, 40)

    expect(linkCapture).not.toHaveBeenCalled()
    expect(navCapture).not.toHaveBeenCalled()
  })

  it('lässt sich auch auf die mittlere Schaltfläche schieben und loslassen', () => {
    // Sie führt zu keiner Seite, ist aber ein Ort wie jeder andere: wer auf
    // ihr loslässt, löst sie aus. Vorher übersprang die Pille sie, und das
    // fühlte sich an wie ein Loch in der Leiste.
    const ausgeloest: string[] = []
    // Alle fünf Plätze vermessen: ein Platz ohne Maße fiele auf die
    // Kapselbreite zurück und läge dann bei jeder Stelle „am nächsten".
    masse({
      home: { links: 8, breite: 64 },
      'my-stack': { links: 76, breite: 64 },
      plus: { links: 148, breite: 64 },
      kalender: { links: 216, breite: 64 },
      profil: { links: 284, breite: 64 },
    })
    bauen('home', { onSelect: id => ausgeloest.push(id) })
    zeigerfaehig(leiste())
    leiste().getBoundingClientRect = () => ({ left: 0, top: 0, right: 360, bottom: 56, width: 360, height: 56, x: 0, y: 0, toJSON: () => ({}) })

    zeiger('pointerdown', reiter('home'), 40)
    zeiger('pointermove', leiste(), 180)          // über dem „+" (Mitte 180)
    expect(pille().dataset.gehalten).toBe('true')
    // Frei am Finger: pillenBreite(64) = 52, also 180 − 26 = 154
    expect(pille().style.transform).toBe('translateX(154px)')

    zeiger('pointerup', leiste(), 180)
    expect(ausgeloest).toEqual(['plus'])
  })

  it('rastet erst beim Loslassen ein, und dann auf den nächsten Platz', () => {
    // Das ist die Gegenprobe zum freien Ziehen: währenddessen sitzt die Pille
    // beim Finger, danach genau mittig auf einem Platz — und ohne `frei`, also
    // weich angefahren.
    masse({
      home: { links: 8, breite: 64 },
      'my-stack': { links: 76, breite: 64 },
      plus: { links: 148, breite: 64 },
      kalender: { links: 216, breite: 64 },
      profil: { links: 284, breite: 64 },
    })
    bauen('home')
    zeigerfaehig(leiste())
    leiste().getBoundingClientRect = () => ({ left: 0, top: 0, right: 360, bottom: 56, width: 360, height: 56, x: 0, y: 0, toJSON: () => ({}) })

    zeiger('pointerdown', reiter('home'), 40)
    zeiger('pointermove', leiste(), 230)          // zwischen „kalender" (248) und „plus"
    expect(pille().style.transform).toBe('translateX(204px)')   // frei: 230 − 26

    zeiger('pointerup', leiste(), 230)
    // Eingerastet auf „kalender": 216 + (64 − 52) / 2 = 222
    expect(pille().style.transform).toBe('translateX(222px)')
    expect(pille().dataset.frei).toBe('false')
    expect(pille().dataset.gehalten).toBe('false')
  })

  it('gibt der mittleren Schaltfläche kein aria-current', () => {
    // Eine Aktion ist nie „die aktuelle Seite" — sie führt zu keiner.
    masse({ plus: { links: 150, breite: 60 } })
    bauen('plus')

    expect(document.querySelector('[aria-current="page"]')).toBeNull()
  })

  it('meldet jeden Reiter, über den der Finger gleitet', () => {
    // Für den Klick am Gerät — ein Tick je Reiter, wie am Rad einer Uhr.
    const gestreift: string[] = []
    masse({
      home: { links: 8, breite: 70 },
      'my-stack': { links: 82, breite: 90 },
      kalender: { links: 200, breite: 80 },
    })
    bauen('home', { onPreviewChange: id => gestreift.push(id) })
    zeigerfaehig(leiste())
    leiste().getBoundingClientRect = () => ({ left: 0, top: 0, right: 360, bottom: 62, width: 360, height: 62, x: 0, y: 0, toJSON: () => ({}) })

    zeiger('pointerdown', reiter('home'), 40)
    zeiger('pointermove', leiste(), 128)
    zeiger('pointermove', leiste(), 240)

    expect(gestreift).toEqual(['my-stack', 'kalender'])
  })

  it('hält die vorgelesene Seite an der echten Route, nicht am Finger', () => {
    // Was vorgelesen wird, darf nicht von einer Geste abhängen, die noch
    // läuft: `aria-current` bleibt auf der Seite, auf der man wirklich ist.
    masse({ home: { links: 8, breite: 70 }, kalender: { links: 200, breite: 80 } })
    bauen('home')
    zeigerfaehig(leiste())
    leiste().getBoundingClientRect = () => ({ left: 0, top: 0, right: 360, bottom: 62, width: 360, height: 62, x: 0, y: 0, toJSON: () => ({}) })

    zeiger('pointerdown', reiter('home'), 40)
    zeiger('pointermove', leiste(), 240)

    expect(document.querySelector('[aria-current="page"]')?.getAttribute(SLOT_ATTR)).toBe('home')
  })

  it('trägt eine Beschriftung für die Vorlesung', () => {
    masse({ home: { links: 8, breite: 70 } })
    bauen('home')

    expect(leiste().getAttribute("aria-label")).toBe("Navigation")
    expect(leiste().tagName).toBe('NAV')
  })
})
