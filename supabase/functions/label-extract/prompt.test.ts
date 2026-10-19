import { describe, expect, it } from 'vitest'
import { DOSAGE_FORMS as APP_FORMEN } from '../../../src/features/my-stack/lib/dosageForms'
import { ETIKETT_EINWILLIGUNG_AB } from '../../../src/features/blutwerte/lib/aiConsent'
import {
  DOSAGE_FORMS, LABEL_CONSENT_SINCE, LABEL_SCHEMA, MAX_NAMES, RateLimiter,
  buildPrompt, cleanNames, consentCoversLabels, extractJson, sanitizeLabel,
} from './prompt'

describe('Abgleich mit der App', () => {
  it('kennt dieselben Darreichungsformen und denselben Einwilligungs-Stichtag', () => {
    expect([...DOSAGE_FORMS]).toEqual(APP_FORMEN.map(form => form.key))
    expect(LABEL_CONSENT_SINCE).toBe(ETIKETT_EINWILLIGUNG_AB)
  })
})

describe('consentCoversLabels', () => {
  it('nur eine Einwilligung ab dem Etikett-Text zaehlt', () => {
    expect(consentCoversLabels(null)).toBe(false)
    expect(consentCoversLabels('2026-10-01T08:00:00.000Z')).toBe(false)
    expect(consentCoversLabels(LABEL_CONSENT_SINCE)).toBe(true)
    expect(consentCoversLabels('2026-11-02T08:00:00+00:00')).toBe(true)
  })
})

describe('buildPrompt', () => {
  it('nennt die Katalognamen als Schreibweise und verbietet Personendaten', () => {
    const prompt = buildPrompt(['BPC-157', 'Vitamin D3'])
    expect(prompt).toContain('BPC-157, Vitamin D3')
    expect(prompt).toMatch(/niemals Namen, Geburtsdaten oder Adressen/)
  })
})

describe('cleanNames', () => {
  it('nimmt nur Text, ohne Leerzeilen und Dubletten, und kappt die Liste', () => {
    expect(cleanNames(['BPC-157', ' BPC-157 ', '', 3, 'Vitamin\nD3'])).toEqual(['BPC-157', 'Vitamin D3'])
    expect(cleanNames(Array.from({ length: MAX_NAMES + 5 }, (_, i) => `S${i}`))).toHaveLength(MAX_NAMES)
    expect(cleanNames(['x'.repeat(81)])).toEqual([])
    expect(cleanNames('BPC-157')).toBeNull()
  })
})

describe('LABEL_SCHEMA', () => {
  it('verlangt jedes Feld und verbietet weitere (Vorgabe fuer structured outputs)', () => {
    expect(LABEL_SCHEMA.additionalProperties).toBe(false)
    expect([...LABEL_SCHEMA.required].sort()).toEqual(Object.keys(LABEL_SCHEMA.properties).sort())
    const item = LABEL_SCHEMA.properties.ingredients.items
    expect(item.additionalProperties).toBe(false)
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort())
  })
})

describe('sanitizeLabel', () => {
  const vial = {
    found: true, name: 'BPC-157', brand: 'Lab X', dosage_form: 'vial',
    ingredients: [{ name: null, amount: 5, unit: 'mg', per_amount: null, per_unit: null }],
  }

  it('uebernimmt ein gueltiges Etikett', () => {
    expect(sanitizeLabel(vial)).toEqual({
      name: 'BPC-157', brand: 'Lab X', dosage_form: 'vial',
      ingredients: [{ name: null, amount: 5, unit: 'mg', per_amount: null, per_unit: null }],
    })
  })

  it('ohne Fund oder Namen kein Etikett', () => {
    expect(sanitizeLabel({ ...vial, found: false })).toBeNull()
    expect(sanitizeLabel({ ...vial, name: '  ' })).toBeNull()
    expect(sanitizeLabel(null)).toBeNull()
  })

  it('verwirft unbekannte Formen und Einheiten und unmoegliche Mengen', () => {
    const label = sanitizeLabel({
      ...vial,
      dosage_form: 'syringe',
      ingredients: [
        { name: 'A', amount: 5, unit: '%', per_amount: null, per_unit: null },
        { name: 'B', amount: -1, unit: 'mg', per_amount: null, per_unit: null },
        { name: 'C', amount: 250, unit: 'mg', per_amount: 0, per_unit: 'ml' },
        { name: 'D', amount: 10, unit: 'mg', per_amount: 3, per_unit: 'litre' },
      ],
    })!
    expect(label.dosage_form).toBeNull()
    expect(label.ingredients).toEqual([
      // Bezug ohne brauchbare Zahl heisst „je 1".
      { name: 'C', amount: 250, unit: 'mg', per_amount: 1, per_unit: 'ml' },
      { name: 'D', amount: 10, unit: 'mg', per_amount: null, per_unit: null },
    ])
  })

  it('liest die Antwort auch aus einem Codeblock', () => {
    expect(sanitizeLabel(extractJson('```json\n' + JSON.stringify(vial) + '\n```'))?.name).toBe('BPC-157')
  })
})

describe('RateLimiter', () => {
  it('sperrt nach dem Limit und gibt nach dem Fenster wieder frei', () => {
    let now = 0
    const limiter = new RateLimiter(2, 1000, () => now)
    expect(limiter.take('u')).toBe(true)
    expect(limiter.take('u')).toBe(true)
    expect(limiter.take('u')).toBe(false)
    expect(limiter.take('v')).toBe(true)
    now = 1001
    expect(limiter.take('u')).toBe(true)
  })
  it('allows prueft, ohne zu zaehlen', () => {
    const limiter = new RateLimiter(1, 1000, () => 0)
    expect(limiter.allows('u')).toBe(true)
    expect(limiter.allows('u')).toBe(true)
    expect(limiter.take('u')).toBe(true)
    expect(limiter.allows('u')).toBe(false)
  })
})
