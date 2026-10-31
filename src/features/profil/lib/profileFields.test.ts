import { describe, expect, it } from 'vitest'
import { bioVollstaendig } from '../../blutwerte/lib/bioProfile'
import { GOAL_TAGS, countryOptions, genderSymbol, geschlechtFelder, isCountryCode, isProfileGender } from './profileFields'

describe('geschlechtFelder', () => {
  it('weiblich und maennlich setzen auch bio_sex', () => {
    expect(geschlechtFelder('female')).toEqual({ profile_gender: 'female', bio_sex: 'female' })
    expect(geschlechtFelder('male')).toEqual({ profile_gender: 'male', bio_sex: 'male' })
  })

  it('divers laesst bio_sex weg', () => {
    const felder = geschlechtFelder('diverse')
    expect(felder).toEqual({ profile_gender: 'diverse' })
    expect('bio_sex' in felder).toBe(false)
  })

  it('keine Angabe laesst bio_sex weg', () => {
    const felder = geschlechtFelder(null)
    expect(felder).toEqual({ profile_gender: null })
    expect('bio_sex' in felder).toBe(false)
  })

  it('ohne bio_sex bleibt der Blutwerte-Hinweis sichtbar (zeigeBioHinweis = nicht vollstaendig)', () => {
    expect(bioVollstaendig({ birthDate: '1990-01-01', sex: null })).toBe(false)
  })
})

describe('genderSymbol', () => {
  it('liefert die drei Zeichen, bei keiner Angabe nichts', () => {
    expect(genderSymbol('male')).toBe('♂')
    expect(genderSymbol('female')).toBe('♀')
    expect(genderSymbol('diverse')).toBe('⚧')
    expect(genderSymbol(null)).toBeNull()
  })
})

describe('isProfileGender', () => {
  it('erkennt nur gueltige Werte', () => {
    expect(isProfileGender('diverse')).toBe(true)
    expect(isProfileGender('x')).toBe(false)
    expect(isProfileGender(null)).toBe(false)
    expect(isProfileGender(undefined)).toBe(false)
  })
})

describe('Laender', () => {
  it('countryOptions(de) enthaelt Deutschland mit Flagge', () => {
    expect(countryOptions('de')).toContainEqual({ code: 'DE', name: 'Deutschland', flag: '🇩🇪' })
  })

  it('ist nach Name sortiert und hat nur zweistellige Grossbuchstaben-Codes', () => {
    const liste = countryOptions('en')
    const namen = liste.map(l => l.name)
    expect(namen).toEqual([...namen].sort((a, b) => a.localeCompare(b, 'en')))
    expect(liste.every(l => /^[A-Z]{2}$/.test(l.code))).toBe(true)
    expect(new Set(liste.map(l => l.code)).size).toBe(liste.length)
  })

  it('isCountryCode verlangt Grossbuchstaben', () => {
    expect(isCountryCode('DE')).toBe(true)
    expect(isCountryCode('de')).toBe(false)
    expect(isCountryCode('DEU')).toBe(false)
  })
})

describe('GOAL_TAGS', () => {
  it('hat die neun Ziele in fester Reihenfolge', () => {
    expect(GOAL_TAGS).toEqual(['fettabbau', 'muskelaufbau', 'recomp', 'kraft', 'ausdauer', 'longevity', 'blutwerte', 'schlaf', 'wohlbefinden'])
  })
})
