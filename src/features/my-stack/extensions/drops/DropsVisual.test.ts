import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DropsVisual } from './DropsVisual'

const render = (props: Partial<Parameters<typeof DropsVisual>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(DropsVisual, {
      name: 'Vitamin D3',
      amount: 1000,
      unit: 'IU / drop',
      color: '#f0b357',
      ...props,
    }),
  )

describe('DropsVisual', () => {
  it('meldet sich als Tropfen-Renderer', () => {
    expect(render()).toContain('data-drops-detail="root"')
  })

  it('fasst Sauger, Kappe und Pipette zu einem Objekt zusammen', () => {
    // An einer echten Flasche ist das ein abnehmbares Teil: beim Aufschrauben
    // kommt die Pipette mit heraus.
    const source = readFileSync(new URL('./DropsVisual.tsx', import.meta.url), 'utf8')
    const gruppe = source.match(/data-drops-detail="dropper"[\s\S]*?cap-light[\s\S]*?<\/g>/)?.[0] ?? ''
    expect(gruppe).toContain('data-drops-detail="pipette"')
    expect(gruppe).toContain('data-drops-detail="cap"')
    // Die Pipette steht vor der Kappe im Quelltext, damit die Kappe ihr
    // oberes Ende ueberdeckt und dort keine Fuge entsteht.
    expect(gruppe.indexOf('"pipette"')).toBeLessThan(gruppe.indexOf('"cap"'))
  })

  it('zeichnet Kappe, Glas und Pipette', () => {
    const html = render()
    expect(html).toContain('data-drops-detail="cap"')
    expect(html).toContain('data-drops-detail="cap-ribs"')
    expect(html).toContain('data-drops-detail="dome-light"')
    expect(html).toContain('data-drops-detail="glass"')
    expect(html).toContain('data-drops-detail="pipette"')
  })

  it('beschneidet die Fluessigkeit an der Innenkontur, nie an der aeusseren', () => {
    // Sonst fehlt der Glasboden und die Fluessigkeit klebt an der Aussenwand.
    const source = readFileSync(new URL('./DropsVisual.tsx', import.meta.url), 'utf8')
    const fenster = source.slice(source.indexOf('<LiquidCanvas'), source.indexOf('/>', source.indexOf('<LiquidCanvas')))
    expect(fenster).toContain('clipPath={DROPS_INNER_PATH}')
    expect(fenster).not.toContain('OUTER')
  })

  it('beschneidet jedes wandernde Licht auf das Glas', () => {
    // Derselbe Fehler wie beim Tabletten-Glanz: unbeschnitten malt es daneben.
    // Beide beweglichen Lichter — Schein und Glanzband — liegen in derselben
    // beschnittenen Gruppe, die vor der Fluessigkeit endet.
    const source = readFileSync(new URL('./DropsVisual.tsx', import.meta.url), 'utf8')
    const gruppe = source.match(/outerClip\)`\}>[\s\S]*?<\/g>/)?.[0] ?? ''
    expect(gruppe).toContain('data-drops-detail="bloom"')
    expect(gruppe).toContain('data-drops-detail="sweep"')
    expect(render({ lightOffset: 1 })).toMatch(/data-drops-detail="sweep"[^>]*translate\(14/)
    expect(render({ lightOffset: -1 })).toMatch(/data-drops-detail="sweep"[^>]*translate\(-14/)
    expect(render({ lightOffset: 1 })).toMatch(/data-drops-detail="bloom"[^>]*translate\(9/)
  })

  it('baut den Kopf aus Sauger und Kappe, nicht aus einem Stueck', () => {
    // Die Vorlage zeigt zwei Teile aus zwei Materialien mit einer Naht
    // dazwischen. Das ist die Umkehr des einteiligen Gussstuecks.
    const html = render({ color: '#a3e635' })
    expect(html).toContain('data-drops-detail="teat"')
    expect(html).toContain('data-drops-detail="cap"')
    // Die Kappe traegt die Eintragsfarbe, der Sauger sein Material: sonst
    // waere der Zweiteiler wieder ein einfarbiges Stueck.
    expect(html).toMatch(/data-drops-detail="cap"[^>]*fill="#a3e635"/)
    expect(html).not.toMatch(/data-drops-detail="teat"[^>]*fill="#a3e635"/)
  })

  it('zeichnet den Sauger vor der Kappe, damit sie die Naht deckt', () => {
    const source = readFileSync(new URL('./DropsVisual.tsx', import.meta.url), 'utf8')
    expect(source.indexOf('data-drops-detail="teat"'))
      .toBeLessThan(source.indexOf('data-drops-detail="cap"'))
  })

  it('zeichnet die Wandstaerke vor der Kappe, damit sie darunter endet', () => {
    // Stuende sie danach, malte sie ihre Linienenden auf die Kappe.
    const source = readFileSync(new URL('./DropsVisual.tsx', import.meta.url), 'utf8')
    expect(source.indexOf('data-drops-detail="inner-contour"'))
      .toBeLessThan(source.indexOf('data-drops-detail="dropper"'))
    // Sie ist wieder die geschlossene Kontur: ohne Hals ist ihre Oberkante
    // echte Schulter und darf gezeichnet werden.
    expect(source).toContain('href={`#${uid}-inner`}')
  })

  it('zeigt keinen Fuellstand in Prozent', () => {
    const html = render()
    expect(html).not.toContain('data-fill-pct')
    expect(html).not.toContain('%</')
  })

  it('laesst die Mengenzeile weg, wenn keine Menge bekannt ist', () => {
    const ohne = render({ amount: null, unit: null })
    expect(ohne).toContain('Vitamin D3')
    expect(ohne).not.toContain('IU / drop')
    // Mit Menge steht sie da.
    expect(render()).toContain('1000 IU / drop')
  })

  it('traegt ein Etikettband und laesst es abschalten', () => {
    expect(render()).toContain('data-drops-detail="label"')
    expect(render({ showLabel: false })).not.toContain('data-drops-detail="label"')
  })

  it('schreibt die Etikettschrift mit Schattenkante', () => {
    // Ohne Farbe erbt sie die Seitenfarbe und verschwindet im Glas — genau
    // das war beim ersten Durchgang der Fall.
    expect(render()).toMatch(/vial-label-marquee[^>]*/)
    expect(render()).toContain('text-white')
  })

  it('haelt die im Spec festgelegten Groessen ein', () => {
    expect(render({ size: 'large' })).toContain('h-[365px]')
    expect(render({ size: 'large' })).toContain('w-[96.6px]')
    expect(render({ size: 'carousel' })).toContain('h-[146.7px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[186.4px]')
    expect(render({ size: 'compact' })).toContain('h-[110px]')
    expect(render({ size: 'mini' })).toContain('h-[60px]')
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Tropfen')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-drops-focus="0.42"')
    expect(html).toContain('data-drops-light-offset="-0.35"')
  })
})
