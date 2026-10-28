import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CORE_TEXTS } from './coreTexts'
import { EDITOR_TEXTS } from './editorTexts'
import { LIVE_TEXTS } from './liveTexts'
import { PROGRESS_TEXTS } from './progressTexts'
import { SETTINGS_TEXTS } from './settingsTexts'

/**
 * Texte des Workout-Trackers — eigener kleiner Namensraum wie bei der FAQ.
 *
 * Gepflegt werden nur Deutsch und Englisch (CLAUDE.md, „Sprachen beim
 * Start"). Jede andere Oberflaechensprache bekommt Englisch; die zwoelf
 * grossen Locale-Dateien bleiben dadurch unangetastet. Kommt eine Sprache
 * dazu, bekommt sie hier eine eigene Tabelle, nachdem jemand mit der Sprache
 * drueber gelesen hat.
 *
 * Die Texte liegen in mehreren Dateien je Bereich, damit Aenderungen an einem
 * Bereich nicht in derselben riesigen Datei landen. Jede Datei liefert
 * `{ de, en }` mit gleichen Schluesseln; ein Test haelt das fest.
 */

export const TRAINING_TEXTS = {
  de: { ...CORE_TEXTS.de, ...PROGRESS_TEXTS.de, ...SETTINGS_TEXTS.de, ...LIVE_TEXTS.de, ...EDITOR_TEXTS.de },
  en: { ...CORE_TEXTS.en, ...PROGRESS_TEXTS.en, ...SETTINGS_TEXTS.en, ...LIVE_TEXTS.en, ...EDITOR_TEXTS.en },
}

export type TrainingTextKey = keyof typeof TRAINING_TEXTS.de
export type TrainingLang = 'de' | 'en'

export function trainingLang(language: string | undefined): TrainingLang {
  return (language ?? '').toLowerCase().startsWith('de') ? 'de' : 'en'
}

/** `{{name}}` im Text durch Werte ersetzen. */
export function formatText(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match)
}

/** Einzahl: gibt es zu `x` einen Schluessel `x_one`, gilt er bei `count === 1`. */
export function trainingText(lang: TrainingLang, key: TrainingTextKey, vars?: Record<string, string | number>): string {
  const table = TRAINING_TEXTS[lang] as Record<string, string>
  const singular = vars?.count === 1 ? table[`${key}_one`] : undefined
  return formatText(singular ?? TRAINING_TEXTS[lang][key] ?? TRAINING_TEXTS.en[key] ?? key, vars)
}

export function useTrainingText() {
  const { i18n } = useTranslation()
  const lang = trainingLang(i18n.resolvedLanguage ?? i18n.language)
  const tt = useCallback(
    (key: TrainingTextKey, vars?: Record<string, string | number>) => trainingText(lang, key, vars),
    [lang],
  )
  /** BCP-47 fuer Datums- und Zahlenformate: die echte Oberflaechensprache. */
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'de'
  return { tt, lang, locale }
}
