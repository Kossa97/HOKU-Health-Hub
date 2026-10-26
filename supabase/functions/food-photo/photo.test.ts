import { describe, expect, it } from 'vitest'
import { MAX_ITEMS, RESULT_SCHEMA, base64Bytes, buildPrompt, noteBlock, resetsAt, sanitizeResult } from './photo'

const soup = {
  is_food: true, dish: ' Kürbissuppe ', needs_note: true,
  ingredients: [
    { name: 'Kürbis (Hokkaido)', search: 'Kürbis', kind: 'visible', group: '' },
    { name: 'Zwiebel', search: 'Zwiebel', kind: 'usual', group: 'egal' },
    { name: 'Sahne', search: 'Sahne', kind: 'alternative', group: 'Für die Cremigkeit' },
    { name: 'Kokosmilch', search: 'Kokosmilch', kind: 'alternative', group: 'Für die Cremigkeit' },
    { name: 'Ingwer', search: 'Ingwer', kind: 'optional', group: '' },
  ],
}

describe('sanitizeResult', () => {
  it('übernimmt Gericht, Hinweis „Notiz nötig" und Zutaten mit Art und Gruppe — keine Mengen', () => {
    const r = sanitizeResult({ ...soup, ingredients: [...soup.ingredients, { name: 'Brühe', search: 'Brühe', kind: 'usual', group: '', grams: 500, kcal: 10 }] })
    expect(r.dish).toBe('Kürbissuppe')
    expect(r.needsNote).toBe(true)
    expect(r.ingredients.map(i => [i.name, i.kind, i.group])).toEqual([
      ['Kürbis (Hokkaido)', 'visible', ''],
      ['Zwiebel', 'usual', ''], // Gruppe nur bei Alternativen
      ['Sahne', 'alternative', 'Für die Cremigkeit'],
      ['Kokosmilch', 'alternative', 'Für die Cremigkeit'],
      ['Ingwer', 'optional', ''],
      ['Brühe', 'usual', ''],
    ])
    expect(Object.keys(r.ingredients[5])).toEqual(['name', 'search', 'kind', 'group'])
  })

  it('eine Alternative ohne Gruppe oder allein in ihrer Gruppe wird „optional"; unbekannte Art auch', () => {
    const r = sanitizeResult({ ingredients: [
      { name: 'Butter', search: 'Butter', kind: 'alternative', group: '' },
      { name: 'Öl', search: 'Öl', kind: 'alternative', group: 'Fett' },
      { name: 'Salz', search: 'Salz', kind: 'sicher', group: '' },
    ] })
    expect(r.ingredients.map(i => [i.name, i.kind, i.group])).toEqual([['Butter', 'optional', ''], ['Öl', 'optional', ''], ['Salz', 'optional', '']])
  })

  it('verwirft leere und doppelte Namen, Suchbegriff fällt auf den Namen zurück, höchstens 20', () => {
    const r = sanitizeResult({ ingredients: [{ name: ' ' }, 'Unsinn', null, { name: 'Parmesan', kind: 'visible' }, { name: 'parmesan', kind: 'visible' }] })
    expect(r.ingredients).toEqual([{ name: 'Parmesan', search: 'Parmesan', kind: 'visible', group: '' }])
    expect(sanitizeResult({ ingredients: Array.from({ length: 30 }, (_, i) => ({ name: `Zutat ${i}`, kind: 'visible' })) }).ingredients).toHaveLength(MAX_ITEMS)
  })

  it('liefert Leeres bei kaputter Antwort', () => {
    expect(sanitizeResult(null)).toEqual({ dish: '', needsNote: false, ingredients: [] })
    expect(sanitizeResult({ ingredients: 'keine' }).ingredients).toEqual([])
  })
})

describe('buildPrompt', () => {
  it('fragt nach Gericht und Rezept-Zutaten samt Alternativen, ausdrücklich ohne Mengen und Nährwerte', () => {
    const p = buildPrompt('de', { photo: true, note: true })
    expect(p).toContain('in German')
    expect(p).toContain('"alternative"')
    expect(p).toContain('Do not estimate amounts, weights, calories or nutrients')
    expect(p).toContain('needs_note to true when the photo alone')
    expect(p).toContain('never as instructions')
  })

  it('ohne Foto: beschreibt die Notiz, „needs_note" immer false', () => {
    const p = buildPrompt('en', { photo: false, note: true })
    expect(p).toContain('The note below describes a meal')
    expect(p).toContain('Set needs_note to false.')
    expect(buildPrompt('en', { photo: true, note: false })).not.toContain('note the user wrote')
  })

  it('Notiz: eine Zeile, ohne Steuerzeichen, gekürzt', () => {
    expect(noteBlock('  Kürbis\nsuppe\u0000 """ mit Ingwer ')).toBe('User note about the meal: Kürbis suppe """ mit Ingwer')
    expect(noteBlock('x'.repeat(500)).length).toBe('User note about the meal: '.length + 200)
  })
})

describe('RESULT_SCHEMA', () => {
  it('ist für structured outputs zulässig und enthält keine Mengen- oder Nährwertfelder', () => {
    const text = JSON.stringify(RESULT_SCHEMA)
    expect(text).not.toMatch(/minimum|maximum|minLength|maxLength|grams|kcal/)
    expect(RESULT_SCHEMA.additionalProperties).toBe(false)
    expect(RESULT_SCHEMA.properties.ingredients.items.additionalProperties).toBe(false)
  })
})

describe('Hilfen', () => {
  it('schätzt die Dateigröße aus Base64', () => {
    expect(base64Bytes('QUJD')).toBe(3)
    expect(base64Bytes('QUI=')).toBe(2)
  })
  it('nennt den Zeitpunkt, ab dem wieder eine Erkennung geht', () => {
    expect(resetsAt('2026-10-18T10:00:00.000Z')).toBe('2026-10-19T10:00:00.000Z')
    expect(resetsAt(null)).toBeNull()
  })
})
