// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { abmeldenBeimStart, merkeAngemeldetBleiben } from './sitzung'

const neuerStart = () => sessionStorage.clear()

describe('Angemeldet bleiben', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('an (Standard): kein Abmelden beim nächsten Start', () => {
    merkeAngemeldetBleiben(true)
    neuerStart()
    expect(abmeldenBeimStart()).toBe(false)
  })

  it('aus: Neuladen im selben Lauf behält die Sitzung, der nächste Start meldet ab — einmal', () => {
    merkeAngemeldetBleiben(false)
    expect(abmeldenBeimStart()).toBe(false)
    neuerStart()
    expect(abmeldenBeimStart()).toBe(true)
    neuerStart()
    expect(abmeldenBeimStart()).toBe(false)
  })

  it('wieder an: der frühere Wunsch ist vergessen', () => {
    merkeAngemeldetBleiben(false)
    merkeAngemeldetBleiben(true)
    neuerStart()
    expect(abmeldenBeimStart()).toBe(false)
  })
})
