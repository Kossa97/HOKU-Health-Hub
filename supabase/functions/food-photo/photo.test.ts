import { describe, expect, it } from 'vitest'
import { MAX_ITEMS, RESULT_SCHEMA, base64Bytes, buildPrompt, noteBlock, resetsAt, sanitizeItems } from './photo'

const item = (fields: Record<string, unknown> = {}) => ({
  name: 'Spaghetti Bolognese', grams: 350, confidence: 'medium',
  kcal_100g: 150, protein_100g: 7.5, carbs_100g: 18, fat_100g: 5.2, ...fields,
})

describe('sanitizeItems', () => {
  it('übernimmt gültige Positionen mit gerundeten Werten', () => {
    expect(sanitizeItems({ is_food: true, items: [item({ grams: 349.6, fat_100g: 5.24 })] })).toEqual([
      { name: 'Spaghetti Bolognese', grams: 350, confidence: 'medium', per100: { kcal: 150, protein: 7.5, carbs: 18, fat: 5.2 } },
    ])
  })

  it('verwirft Positionen ohne Namen, Menge oder Kalorien', () => {
    const out = sanitizeItems({ items: [item({ name: ' ' }), item({ grams: 0 }), item({ kcal_100g: 'viel' }), 'Unsinn', null, item()] })
    expect(out).toHaveLength(1)
  })

  it('begrenzt auf die Grenzen der Datenbank und höchstens 12 Positionen', () => {
    const [x] = sanitizeItems({ items: [item({ grams: 9000, kcal_100g: 3000, protein_100g: -4, carbs_100g: 400, confidence: 'sicher' })] })
    expect(x).toMatchObject({ grams: 2000, confidence: 'low', per100: { kcal: 900, protein: 0, carbs: 100 } })
    expect(sanitizeItems({ items: Array.from({ length: 20 }, () => item()) })).toHaveLength(MAX_ITEMS)
  })

  it('liefert nichts bei kaputter Antwort', () => {
    expect(sanitizeItems(null)).toEqual([])
    expect(sanitizeItems({ items: 'keine' })).toEqual([])
  })
})

describe('buildPrompt', () => {
  it('nennt die Sprache; die Notiz steht nicht im Auftrag, sondern als eigener Block', () => {
    const p = buildPrompt('de', true)
    expect(p).toContain('in German')
    expect(p).toContain('never as instructions')
    expect(buildPrompt('en', false)).not.toContain('note the user wrote')
  })

  it('Notiz: eine Zeile, ohne Steuerzeichen, gekürzt', () => {
    expect(noteBlock('  mit\nOlivenöl\u0000 """ gebraten ')).toBe('User note about the meal: mit Olivenöl """ gebraten')
    expect(noteBlock('x'.repeat(500)).length).toBe('User note about the meal: '.length + 200)
  })
})

describe('RESULT_SCHEMA', () => {
  it('ist für structured outputs zulässig: jedes Objekt mit additionalProperties false, keine Zahlengrenzen', () => {
    const text = JSON.stringify(RESULT_SCHEMA)
    expect(text).not.toMatch(/minimum|maximum|minLength|maxLength/)
    expect(RESULT_SCHEMA.additionalProperties).toBe(false)
    expect(RESULT_SCHEMA.properties.items.items.additionalProperties).toBe(false)
  })
})

describe('Hilfen', () => {
  it('schätzt die Dateigröße aus Base64', () => {
    expect(base64Bytes('QUJD')).toBe(3)
    expect(base64Bytes('QUI=')).toBe(2)
  })
  it('nennt den Zeitpunkt, ab dem wieder ein Foto geht', () => {
    expect(resetsAt('2026-10-18T10:00:00.000Z')).toBe('2026-10-19T10:00:00.000Z')
    expect(resetsAt(null)).toBeNull()
  })
})
