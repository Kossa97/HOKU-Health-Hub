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

  // Vorlagen der Funde (vorlagen.ts). Satz und Beleg prüft der Regelwächter:
  // jede Zahl muss aus `werte` stammen, den Pflichtsatz hängt vorlagen.ts an.
  h1_titel: 'Schlaf und Trainingszeit',
  h1_satz_vor: 'Wenn du vor {{grenze}} Uhr trainierst, schläfst du in der Nacht danach im Schnitt {{differenz}} min länger.',
  h1_satz_ab: 'Wenn du ab {{grenze}} Uhr trainierst, schläfst du in der Nacht danach im Schnitt {{differenz}} min länger.',
  h1_beleg: '{{n_a}} gegen {{n_b}} Trainingstage, {{mittel_a}} gegen {{mittel_b}} min.',
  e2_titel: 'Protein an Trainingstagen',
  e2_satz_mehr: 'An Trainingstagen isst du im Schnitt {{differenz}} g mehr Protein als an Ruhetagen.',
  e2_satz_weniger: 'An Trainingstagen isst du im Schnitt {{differenz}} g weniger Protein als an Ruhetagen.',
  e2_beleg: '{{n_training}} Trainingstage gegen {{n_ruhe}} Ruhetage, im Schnitt {{mittel_training}} gegen {{mittel_ruhe}} g.',
  w1_titel: 'Energie und Schlaf',
  w1_satz_ab: 'Nach Nächten ab {{grenze}} h trägst du im Schnitt {{differenz}} Punkte mehr Energie ein.',
  w1_satz_unter: 'Nach Nächten unter {{grenze}} h trägst du im Schnitt {{differenz}} Punkte mehr Energie ein.',
  w1_beleg: '{{n_a}} gegen {{n_b}} Tage, im Schnitt {{mittel_a}} gegen {{mittel_b}} Punkte.',
  t7_titel: 'Tagebuch-Serie',
  t7_satz: '{{tage}} Tage am Stück Tagebuch geführt.',
  t7_beleg: 'Gezählt wird jeder Tag mit einem Eintrag im Tagebuch.',
  r4_titel: 'Neuer Rekord',
  r4_satz: 'Neuer Rekord bei {{uebung}}: geschätzt {{kg}} kg (vorher {{vorher}} kg).',
  r4_beleg: 'Geschätztes Maximum für eine Wiederholung, berechnet aus Gewicht und Wiederholungen deiner Sätze.',

  // Seite und Karten
  seite_titel: 'Erkenntnisse',
  laden_fehler: 'Erkenntnisse konnten nicht geladen werden.',
  aktion_fehler: 'Das hat nicht geklappt. Bitte versuch es noch einmal.',
  erneut: 'Erneut versuchen',
  ohne_einw_text: 'Hoku kann jede Nacht in deinen Daten nach Mustern suchen und dir jede Woche zeigen, was ihm aufgefallen ist. Dafür braucht er deine Einwilligung.',
  ohne_einw_knopf: 'Einwilligung ansehen',
  woche_kopf: 'Wochen-Update',
  woche_tage: '{{tage}} Tage mit Daten',
  woche_leer: 'Diese Woche nichts Neues. {{tage}} Tage deiner Daten sind eingeflossen.',
  keine_woche: 'Noch kein Wochen-Update da.',
  alle_funde: 'Alle Funde',
  keine_funde: 'Noch keine Funde.',
  datenlage_deutlich: 'Deutlich',
  datenlage_hinweis: 'Hinweis',
  fund_mehr: 'Wie kommst du darauf?',
  detail_zeitraum: 'Zeitraum',
  nicht_hilfreich: 'Nicht hilfreich',
  schliessen: 'Schließen',
  widerruf_knopf: 'Einwilligung widerrufen',
  widerruf_titel: 'Einwilligung widerrufen?',
  widerruf_text: 'Hoku wertet deine Daten dann nicht mehr aus. Deine Funde und Wochen-Updates werden gelöscht.',
  widerruf_ja: 'Widerrufen',
  abbrechen: 'Abbrechen',
  home_kopf: 'Wochen-Update',
  home_karte: 'Dein Wochen-Update ist da',
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

  h1_titel: 'Sleep and training time',
  h1_satz_vor: 'When you train before {{grenze}}h, you sleep {{differenz}} min longer on average the night after.',
  h1_satz_ab: 'When you train from {{grenze}}h onwards, you sleep {{differenz}} min longer on average the night after.',
  h1_beleg: '{{n_a}} vs. {{n_b}} training days, {{mittel_a}} vs. {{mittel_b}} min.',
  e2_titel: 'Protein on training days',
  e2_satz_mehr: 'On training days you eat {{differenz}} g more protein on average than on rest days.',
  e2_satz_weniger: 'On training days you eat {{differenz}} g less protein on average than on rest days.',
  e2_beleg: '{{n_training}} training days vs. {{n_ruhe}} rest days, {{mittel_training}} vs. {{mittel_ruhe}} g on average.',
  w1_titel: 'Energy and sleep',
  w1_satz_ab: 'After nights of {{grenze}} h or more, you log {{differenz}} points more energy on average.',
  w1_satz_unter: 'After nights under {{grenze}} h, you log {{differenz}} points more energy on average.',
  w1_beleg: '{{n_a}} vs. {{n_b}} days, {{mittel_a}} vs. {{mittel_b}} points on average.',
  t7_titel: 'Diary streak',
  t7_satz: 'You kept your diary {{tage}} days in a row.',
  t7_beleg: 'Every day with a diary entry counts.',
  r4_titel: 'New record',
  r4_satz: 'New record in {{uebung}}: an estimated {{kg}} kg (previously {{vorher}} kg).',
  r4_beleg: 'Estimated maximum for a single rep, calculated from the weight and reps of your sets.',

  seite_titel: 'Insights',
  laden_fehler: 'Insights could not be loaded.',
  aktion_fehler: 'That did not work. Please try again.',
  erneut: 'Try again',
  ohne_einw_text: 'Hoku can look for patterns in your data every night and show you each week what stood out. For that it needs your consent.',
  ohne_einw_knopf: 'Review consent',
  woche_kopf: 'Weekly update',
  woche_tage: '{{tage}} days with data',
  woche_leer: 'Nothing new this week. {{tage}} days of your data went into it.',
  keine_woche: 'No weekly update yet.',
  alle_funde: 'All findings',
  keine_funde: 'No findings yet.',
  datenlage_deutlich: 'Clear',
  datenlage_hinweis: 'Hint',
  fund_mehr: 'How do you know?',
  detail_zeitraum: 'Period',
  nicht_hilfreich: 'Not helpful',
  schliessen: 'Close',
  widerruf_knopf: 'Withdraw consent',
  widerruf_titel: 'Withdraw consent?',
  widerruf_text: 'Hoku will then stop analysing your data. Your findings and weekly updates will be deleted.',
  widerruf_ja: 'Withdraw',
  abbrechen: 'Cancel',
  home_kopf: 'Weekly update',
  home_karte: 'Your weekly update is here',
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
