import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Texte der Hoku-Erkenntnisse — eigener kleiner Namensraum wie `../texte.ts`.
 *
 * Gepflegt werden nur Deutsch und Englisch (CLAUDE.md, „Sprachen beim
 * Start"). Jede andere Oberflächensprache bekommt Englisch; die Locale-Dateien
 * bleiben unangetastet. Ein Test hält fest, dass beide Tabellen dieselben
 * Schlüssel und Platzhalter haben. Texte, die Hoku über einen Fund sagt,
 * prüft zusätzlich der Regelwächter (`_shared/erkenntnisse/waechter.ts`).
 */

const de = {
  // Einwilligung (Sheet)
  einw_titel: 'Hoku sucht Muster in deinen Daten',
  einw_punkt_1: 'Tagebuch, Schlaf, Training und Ernährung werden jede Nacht ausgewertet, auf Servern in der EU.',
  einw_punkt_2: 'Hoku zeigt Zusammenhänge mit Beleg. Er nennt keine Dosis, rät zu nichts und stellt keine Diagnose.',
  einw_punkt_3: 'Nur du siehst deine Funde.',
  einw_punkt_4: 'Widerruf jederzeit auf der Seite Erkenntnisse. Deine Funde werden dann gelöscht.',
  einw_haken: 'Ich willige ein, dass meine Gesundheitsdaten dafür ausgewertet werden (Art. 9 DSGVO).',
  einw_ja: 'Einverstanden',
  einw_nein: 'Nicht jetzt',
  einw_fehler: 'Konnte nicht gespeichert werden. Bitte versuch es noch einmal.',
}

const en: Record<keyof typeof de, string> = {
  einw_titel: 'Hoku looks for patterns in your data',
  einw_punkt_1: 'Diary, sleep, training and nutrition are analysed every night, on servers in the EU.',
  einw_punkt_2: 'Hoku shows connections with the evidence. It names no dosage, advises nothing and makes no diagnosis.',
  einw_punkt_3: 'Only you see your findings.',
  einw_punkt_4: 'Withdraw at any time on the Insights page. Your findings are then deleted.',
  einw_haken: 'I consent to my health data being analysed for this (Art. 9 GDPR).',
  einw_ja: 'I agree',
  einw_nein: 'Not now',
  einw_fehler: 'Could not be saved. Please try again.',
}

export const TEXTE = { de, en }
export type ErkenntnisseTextKey = keyof typeof de
export type ErkenntnisseSprache = 'de' | 'en'

export const erkenntnisseSprache = (language: string | undefined): ErkenntnisseSprache =>
  language?.toLowerCase().startsWith('de') ? 'de' : 'en'

export function erkenntnisseText(lang: ErkenntnisseSprache, key: ErkenntnisseTextKey, vars?: Record<string, string | number>): string {
  const roh = TEXTE[lang][key] ?? TEXTE.en[key] ?? key
  return vars ? roh.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, n: string) => (n in vars ? String(vars[n]) : m)) : roh
}

export function useErkenntnisseTexte() {
  const { i18n } = useTranslation()
  // Ohne i18n-Instanz (Tests mit gemocktem useTranslation) gilt Englisch
  const lang = erkenntnisseSprache(i18n?.resolvedLanguage ?? i18n?.language)
  const et = useCallback((key: ErkenntnisseTextKey, vars?: Record<string, string | number>) => erkenntnisseText(lang, key, vars), [lang])
  return { et, lang }
}
