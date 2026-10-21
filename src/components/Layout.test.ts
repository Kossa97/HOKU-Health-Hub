import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { routeLayoutMode } from './layoutMode'

describe('Layout injection tracker fullscreen route', () => {
  it('hides global bottom navigation on the injection tracker route', () => {
    const source = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8')

    expect(routeLayoutMode('/injektionen')).toEqual({
      lockViewport: true,
      hideBottomNav: true,
      hideTabBar: true,
    })
    expect(source).toContain('{!hideTabBar && (')
    // Kein schwebender FAQ-Knopf mehr: die FAQ steht im Profil
    expect(source).not.toContain('aria-label="FAQ"')
  })
  it('does not add extra vertical padding on the fullscreen injection route', () => {
    const source = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8')

    expect(source).toContain("hideBottomNav ? 'h-dvh px-0 pt-0 overflow-hidden overscroll-none'")
    expect(source).toMatch(/paddingBottom:\s*hideBottomNav\s*\? 0/)
  })
})

describe('Layout Ernährung ohne Leiste', () => {
  it('blendet nur die Leiste aus; die Seite scrollt normal und hat unten etwas Luft', () => {
    expect(routeLayoutMode('/ernaehrung')).toEqual({
      lockViewport: false,
      hideBottomNav: false,
      hideTabBar: true,
    })
    const source = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8')
    expect(source).toContain("hideTabBar\n              ? 'calc(1rem + env(safe-area-inset-bottom))'")
  })
})

describe('Layout viewport ownership', () => {
  it('gives the calculator its own scrolling area', () => {
    expect(routeLayoutMode('/rechner')).toEqual({
      lockViewport: true,
      hideBottomNav: false,
      hideTabBar: false,
    })
  })
  it('locks My Stack to the app viewport without hiding its bottom navigation', () => {
    const source = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8')

    expect(routeLayoutMode('/my-stack')).toEqual({
      lockViewport: true,
      hideBottomNav: false,
      hideTabBar: false,
    })
    expect(routeLayoutMode('/kalender').lockViewport).toBe(false)

    // The body already owns the iPhone safe-area. A locked `100dvh` frame
    // would add that inset to its own height again and place the carousel
    // baseline behind the fixed bottom navigation.
    expect(source).toMatch(/height:\s*lockViewport\s*\? 'calc\(100dvh - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\)\)'/)
    expect(source).toMatch(/:\s*lockViewport\s*\? 'var\(--bottom-nav-height\)'/)
    expect(source).not.toContain("lockViewport ? 'h-dvh overflow-y-hidden'")
  })
})
