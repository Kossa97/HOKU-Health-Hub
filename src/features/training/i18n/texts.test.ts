import { describe, expect, it } from 'vitest'
import { CORE_TEXTS } from './coreTexts'
import { EDITOR_TEXTS } from './editorTexts'
import { LIVE_TEXTS } from './liveTexts'
import { PROGRESS_TEXTS } from './progressTexts'
import { SETTINGS_TEXTS } from './settingsTexts'
import { TRAINING_TEXTS, trainingText } from '.'

const tokens = (value: string) => [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]).sort()

describe('Trainingstexte', () => {
  it.each([['core', CORE_TEXTS], ['progress', PROGRESS_TEXTS], ['settings', SETTINGS_TEXTS], ['live', LIVE_TEXTS], ['editor', EDITOR_TEXTS]] as const)(
    '%s: de und en haben dieselben Schluessel und Platzhalter, nichts ist leer',
    (_, texts) => {
      expect(Object.keys(texts.en).sort()).toEqual(Object.keys(texts.de).sort())
      for (const key of Object.keys(texts.de) as Array<keyof typeof texts.de>) {
        expect(String(texts.de[key]).trim(), `de.${String(key)}`).not.toBe('')
        expect(String(texts.en[key]).trim(), `en.${String(key)}`).not.toBe('')
        expect(tokens(String(texts.en[key])), String(key)).toEqual(tokens(String(texts.de[key])))
      }
    },
  )

  it('ueberschneidet sich nicht zwischen den Bereichen', () => {
    const all = [CORE_TEXTS.de, PROGRESS_TEXTS.de, SETTINGS_TEXTS.de, LIVE_TEXTS.de, EDITOR_TEXTS.de].flatMap(t => Object.keys(t))
    expect(new Set(all).size).toBe(all.length)
    expect(Object.keys(TRAINING_TEXTS.de)).toHaveLength(all.length)
  })

  it('nimmt bei count 1 die Einzahl', () => {
    expect(trainingText('de', 'exercises_count', { count: 1 })).toBe('1 Übung')
    expect(trainingText('de', 'exercises_count', { count: 3 })).toBe('3 Übungen')
    expect(trainingText('en', 'session_records', { count: 1 })).toBe('1 record')
  })
})
