import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = () => readFileSync(new URL('../../index.css', import.meta.url), 'utf8')
const wert = (name: string) => {
  const treffer = css().match(new RegExp(`--${name}:\\s*([0-9]+)px`))
  return treffer ? Number(treffer[1]) : null
}

describe('Maße der Bottom-Navigation', () => {
  it('reserviert genau so viel Platz, wie die Kapsel samt Abstand belegt', () => {
    // Sieben Stellen rechnen mit `--bottom-nav-height`: Inhaltspolster,
    // FAQ-Knopf, Schnellzugriff, Onboarding (zweimal), `onboardingPlacement`
    // und die My-Stack-Bühne. Stimmt die Summe nicht, verdeckt die Leiste
    // Inhalt oder es bleibt ein toter Streifen darunter.
    expect(wert('bottom-nav-capsule')! + wert('bottom-nav-gap')!)
      .toBe(wert('bottom-nav-height'))
  })

  it('hält die Höhe als glatte Zahl, nicht als Rechnung', () => {
    // `onboardingPlacement.ts` liest sie mit `parseInt`, und eigene
    // Eigenschaften werden nicht ausgerechnet: `parseInt('calc(62px + 12px)')`
    // wäre NaN und die Einblendungen säßen falsch.
    expect(css()).toMatch(/--bottom-nav-height:\s*\d+px/)
    const platzierung = readFileSync(new URL('../onboardingPlacement.ts', import.meta.url), 'utf8')
    expect(platzierung).toContain("getPropertyValue('--bottom-nav-height')")
  })

  it('lässt der Kapsel Abstand zur Sicherheitszone und zu den Rändern', () => {
    expect(css()).toContain('bottom: calc(env(safe-area-inset-bottom) + var(--bottom-nav-gap))')
    expect(css()).toContain('left: max(var(--bottom-nav-inset), env(safe-area-inset-left))')
    expect(css()).toContain('right: max(var(--bottom-nav-inset), env(safe-area-inset-right))')
  })

  it('bleibt flacher als die Höhe, mit der My Stack eingestellt wurde', () => {
    // `MyStackPage` rechnet mit festen 90 px für die Leiste, damit die Bühne
    // bei jedem Umbau gleich groß bleibt und nur höher rutscht. Das trägt nur,
    // solange die Leiste nicht höher wird als 90 — sonst verdeckte sie den
    // unteren Rand der Bühne.
    expect(wert('bottom-nav-height')).toBeLessThanOrEqual(90)
  })

  it('bleibt über dem Ladebildschirm stehen', () => {
    // Die Leiste ist Gerüst der App, kein Seiteninhalt: wer auf eine Seite
    // wechselt, die noch lädt, soll nicht das Gefühl haben, die App sei weg.
    // Vorher lag `LabLoader` mit z-50 darüber und sie verschwand.
    //
    // Die Ordnung am unteren Rand: 39 FAQ-Knopf, 40 Ladebildschirm, 41 diese
    // Leiste, 45/46 Schnellzugriff, 50 Dialoge. Dialoge dürfen die Leiste
    // verdecken — ein Dialog ist kein Ladezustand.
    const loader = readFileSync(new URL('../LabLoader.tsx', import.meta.url), 'utf8')

    expect(css()).toMatch(/\.tyd-tabbar\s*\{[\s\S]*?z-index:\s*41;/)
    const klassen = loader.match(/className=\{`fixed[^`]*`/)![0]
    expect(klassen).toContain('z-40')
    expect(klassen).not.toContain('z-50')
  })

  it('gibt jedem Reiter mindestens 44 px für den Finger', () => {
    expect(css()).toMatch(/\.tyd-tabbar-item\s*\{[^}]*min-height:\s*44px/)
  })

  it('nimmt die Wege heraus, wenn jemand Bewegung abbestellt hat', () => {
    // Die Datei hat mehrere solche Blöcke; gemeint ist der der Leiste.
    const block = css().slice(css().lastIndexOf('@media (prefers-reduced-motion: reduce)'))
    // Bis zur schließenden Klammer des Blocks zählen
    let tiefe = 0
    let ende = block.length
    for (let i = 0; i < block.length; i++) {
      if (block[i] === '{') tiefe++
      else if (block[i] === '}' && --tiefe === 0) { ende = i + 1; break }
    }
    const bis = block.slice(0, ende)

    expect(bis).toContain('.tyd-tabbar-pill')
    // Auch das Anheben beim Drücken und das Aufblähen der Blase.
    expect(bis).toContain(".tyd-tabbar[data-gedrueckt='true'] { transform: none; }")
    expect(bis).toContain(".tyd-tabbar-pill[data-gehalten='true'] { scale: 1; }")
  })

  it('rundet die Pille konzentrisch zur Kapsel, statt eine Zahl zu raten', () => {
    // Außen die halbe Kapselhöhe, innen dieselbe Rundung minus dem Einzug —
    // so laufen beide Kurven parallel. Ein fester Wert (oder 999px) träfe nur
    // zufällig und liefe auseinander, sobald sich Höhe oder Einzug ändern.
    expect(css()).toContain('border-radius: calc(var(--bottom-nav-capsule) / 2 - var(--bottom-nav-pill-inset))')
    expect(css()).toContain('top: var(--bottom-nav-pill-inset)')
    expect(css()).toContain('bottom: var(--bottom-nav-pill-inset)')
  })

  it('hebt die Leiste unter dem Finger ganz leicht an', () => {
    // Dieselbe Geste wie bei Apple: nicht „Knopf gedrückt", sondern „Material
    // antwortet". Über `transform`, damit nichts neu umbrochen wird.
    expect(css()).toContain(".tyd-tabbar[data-gedrueckt='true'] { transform: scale(1.025); }")
    expect(css()).toContain('transform-origin: bottom center')
  })

  it('lässt die Pille am Finger nicht nachfedern', () => {
    // Frei heißt: sie hängt am Finger. Ein Nachfahren auf `transform` ließe
    // sie der Bewegung hinterherlaufen wie an einem Gummi — aus „ich halte
    // sie" würde „ich zerre sie". Farbe und Größe dürfen weich bleiben.
    const frei = css().slice(css().indexOf(".tyd-tabbar-pill[data-frei='true']"))
    expect(frei.slice(0, 220)).toContain('transition: background')
    expect(frei.slice(0, 220)).not.toContain('transform')
  })

  it('bleibt brauchbar, wo Unschärfe oder Masken fehlen', () => {
    // Progressive Verbesserung: ohne `backdrop-filter` trägt die dünne Füllung
    // nichts, dann wird die Kapsel deckend. Ohne Masken gibt es statt des
    // Lichtrands einen schlichten Rand — nie gar keine Kante.
    expect(css()).toContain('@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))')
    expect(css()).toContain('@supports not ((mask-composite: exclude) or (-webkit-mask-composite: xor))')
  })
})
