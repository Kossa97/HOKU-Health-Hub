import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CENTER_ACTION_INDEX, TAB_ITEMS, resolveActiveTabId, tabIndex } from './tabModel'

describe('tabModel', () => {
  it('schickt keinen Reiter auf eine Route, die es nicht gibt', () => {
    // Jeder Reiter muss auf eine wirklich registrierte Route zeigen. Sonst
    // landet ein Tap auf der Catch-all-Route und der Reiter wird nie aktiv.
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8')
    const vorhanden = new Set(
      [...app.matchAll(/path="([^"*:]+)"/g)].map(treffer => '/' + treffer[1].replace(/^\//, '')),
    )
    vorhanden.add('/')

    for (const tab of TAB_ITEMS) {
      expect(vorhanden, `Reiter „${tab.fallbackLabel}" zeigt auf ${tab.route}`).toContain(tab.route)
    }
  })

  it('führt die vier Reiter in der Reihenfolge, in der sie auf dem Schirm stehen', () => {
    expect(TAB_ITEMS.map(t => t.id)).toEqual(['home', 'my-stack', 'kalender', 'profil'])
    expect(TAB_ITEMS.map(t => t.route)).toEqual(['/', '/my-stack', '/kalender', '/profil'])
  })

  it('schiebt die mittlere Schaltfläche zwischen zwei und zwei', () => {
    // Sie ist kein Reiter — sie führt zu keiner Route, sondern öffnet den
    // Schnellzugriff. Deshalb steht sie nicht in der Liste, sondern als Index.
    expect(CENTER_ACTION_INDEX).toBe(2)
    expect(TAB_ITEMS.length - CENTER_ACTION_INDEX).toBe(2)
  })

  it('erkennt den aktiven Reiter am genauen Pfad', () => {
    expect(resolveActiveTabId('/')).toBe('home')
    expect(resolveActiveTabId('/my-stack')).toBe('my-stack')
    expect(resolveActiveTabId('/kalender')).toBe('kalender')
    expect(resolveActiveTabId('/profil')).toBe('profil')
  })

  it('lässt Seiten ohne eigenen Reiter ohne aktiven Reiter', () => {
    // Kein `startsWith`: „/" wäre sonst überall aktiv, und auf „/faq" stünde
    // die Pille unter „Home", obwohl man dort gar nicht ist.
    expect(resolveActiveTabId('/faq')).toBeNull()
    expect(resolveActiveTabId('/rechner')).toBeNull()
    expect(resolveActiveTabId('/my-stack/irgendwas')).toBeNull()
  })

  it('findet die Position eines Reiters', () => {
    expect(tabIndex('home')).toBe(0)
    expect(tabIndex('profil')).toBe(3)
  })
})
