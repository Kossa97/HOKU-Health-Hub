import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Texte von Dot — eigener kleiner Namensraum wie beim Workout-Tracker.
 *
 * Gepflegt werden nur Deutsch und Englisch (CLAUDE.md, „Sprachen beim
 * Start"). Jede andere Oberflächensprache bekommt Englisch; die zwölf großen
 * Locale-Dateien bleiben unangetastet. Ein Test hält fest, dass beide
 * Tabellen dieselben Schlüssel und Platzhalter haben.
 */

const de = {
  // Logo und Figur
  logo_drinnen: 'Dot rufen',
  logo_draussen: 'Dot nach Hause schicken',
  logo_gesperrt: 'Dot, dein KI-Coach (Pro)',
  figur: 'Dot, dein KI-Coach. Antippen zum Reden, ziehen zum Verschieben.',
  gesperrt_titel: 'Dot kommt mit Pro heraus',
  gesperrt_text: 'Dot wohnt in deiner Leiste. Mit Pro kommt er heraus, beantwortet Fragen zu deinem Stack und erinnert dich an das, was heute ansteht.',
  gesperrt_ok: 'Verstanden',

  // Sprechblasen
  wach: 'Oh! Bin wach.',
  kitzeln: 'Hihi, das kitzelt!',
  schwindel: 'Uff … alles dreht sich.',
  tschuess: 'Bis gleich!',
  da_bin: 'Da bin ich. Tipp mich an, dann reden wir.',
  gruss_morgen: 'Guten Morgen!',
  gruss_tag: 'Hallo!',
  gruss_abend: 'Guten Abend!',
  gruss_nacht: 'Noch wach?',
  naechste: 'Um {{zeit}} ist {{substanz}} dran.',
  naechste_menge: 'Um {{zeit}} ist {{substanz}} dran, {{menge}}.',
  alles_erledigt: 'Für heute ist alles eingetragen.',
  nichts_geplant: 'Heute ist nichts geplant.',
  uhr_bis: 'Es ist {{uhr}}. In {{dauer}} ist {{substanz}} dran.',
  uhr_offen: 'Es ist {{uhr}}. Heute sind noch {{anzahl}} Einnahmen offen.',
  uhr_offen_one: 'Es ist {{uhr}}. Heute ist noch eine Einnahme offen.',
  uhr_erledigt: 'Es ist {{uhr}}. Für heute hast du alles eingetragen.',
  uhr_verpasst: 'Es ist {{uhr}}. {{substanz}} um {{zeit}} ist noch nicht eingetragen.',
  std: 'Std.',
  min: 'Min.',

  // Chat
  chat_titel: 'Dot',
  chat_schliessen: 'Chat schließen',
  chat_leeren: 'Verlauf leeren',
  chat_platzhalter: 'Frag Dot …',
  chat_senden: 'Senden',
  chat_intro: 'Hi, ich bin Dot. Ich kenne deinen Stack und deinen Plan für heute und erkläre dir deine Blutwerte. Dosierungen empfehle ich nicht, das gehört in ärztliche Hand.',
  chat_intro_stack: 'Du bist in deinem Stack. Frag mich, was heute ansteht oder wie lange dein Bestand reicht.',
  chat_intro_kalender: 'Ich sehe, was geplant war und was eingetragen ist. Frag mich nach Lücken.',
  chat_intro_ernaehrung: 'Frag mich zu deiner Ernährung heute.',
  chat_denkt: 'Dot denkt nach …',
  chat_fehler: 'Das hat nicht geklappt. Versuch es gleich noch einmal.',
  chat_offline: 'Ohne Internet kann ich nicht antworten.',
  chat_grenze: 'Für heute habe ich genug geredet. Morgen bin ich wieder für dich da.',
  chat_kein_zugang: 'Den Chat mit Dot gibt es mit Pro.',
  chip_heute: 'Was steht heute an?',
  chip_verpasst: 'Was habe ich diese Woche verpasst?',
  chip_naechste: 'Wann ist meine nächste Einnahme?',
  chip_blutwerte: 'Erklär mir meine letzten Blutwerte',
  chip_bestand: 'Wie lange reicht mein Bestand?',
  chip_ernaehrung: 'Wie sieht meine Ernährung heute aus?',
  chip_heim: 'Geh in dein Haus',
  heim_antwort: 'Bis später. Tipp auf mein Logo in der Leiste, wenn du mich brauchst.',
  hinweis_unten: 'Dot ist eine KI und kann sich irren. Keine Diagnose, keine Dosisempfehlung.',

  // Einwilligung (Art. 9 DSGVO, Apple 5.1.2(i))
  einw_titel: 'Bevor wir reden',
  einw_text: 'Damit Dot antworten kann, schickt die App deine Frage und eine Zusammenfassung deiner Daten an Anthropic (Claude), einen KI-Anbieter in den USA: deinen Stack, deinen Einnahmeplan der letzten Tage, deine letzten Blutwerte und deine heutige Ernährung (Kalorien und Makros). Das sind Gesundheitsdaten.',
  einw_punkt_1: 'TYD speichert deine Fragen nicht auf dem Server, nur wie viele es heute waren (für das Tageslimit).',
  einw_punkt_2: 'Den Verlauf speichert die App nur auf diesem Gerät.',
  einw_punkt_3: 'Du kannst die Einwilligung jederzeit im Chat widerrufen.',
  einw_ja: 'Einverstanden',
  einw_nein: 'Nicht jetzt',
  einw_widerrufen: 'Einwilligung widerrufen',
  einw_widerrufen_fertig: 'Einwilligung widerrufen. Dot schickt nichts mehr an Anthropic.',
  einw_fehler: 'Konnte nicht gespeichert werden. Bitte noch einmal versuchen.',

  // Dot trägt automatisch ein (Pro)
  auto_eingetragen: 'Ich habe {{anzahl}} Einnahmen für dich eingetragen. Sag mir, wenn etwas anders war.',
  auto_eingetragen_one: 'Ich habe eine Einnahme für dich eingetragen. Sag mir, wenn etwas anders war.',
  auto_titel: 'Dot trägt automatisch ein',
  auto_text: 'Geplante Einnahmen gelten als genommen, sobald ihre Zeit 30 Minuten vorbei ist. Du sagst Dot nur, was anders war.',
  auto_text_buendel: 'Gilt für alle Substanzen in diesem Bündel. Geplante Einnahmen gelten als genommen, sobald ihre Zeit 30 Minuten vorbei ist.',
  auto_pro: 'Mit Pro',
  auto_marke: 'automatisch',
  auto_fehler: 'Konnte nicht gespeichert werden. Bitte noch einmal versuchen.',
  auto_ueber_buendel: 'Läuft auch über dein Bündel „{{name}}“: solange es an ist, trägt Dot hier ein.',

  // Eintragen per Satz (Karten im Chat)
  melde_genommen: '{{substanz}}, {{wann}}: als genommen eingetragen ({{uhrzeit}}).',
  melde_vergessen: '{{substanz}}, {{wann}}: als vergessen eingetragen.',
  melde_vorgemerkt: '{{substanz}}, {{wann}}: ich trage sie um {{uhrzeit}} als genommen ein.',
  melde_selbst: '{{substanz}}, {{wann}}: notiert. Hak sie um {{uhrzeit}} selbst ab, automatisch trage ich nur mit dem Schalter an der Substanz ein.',
  melde_schon_genommen: '{{substanz}}, {{wann}}: war schon als genommen eingetragen.',
  melde_schon_vergessen: '{{substanz}}, {{wann}}: war schon als vergessen eingetragen.',
  melde_fehler: '{{substanz}}, {{wann}}: konnte ich nicht eintragen. Bitte im Kalender.',
  melde_unbekannt: 'Diese Einnahme finde ich gerade nicht. Sag es mir bitte noch einmal.',
  melde_heute: 'heute',
  melde_gestern: 'gestern',
  melde_zurueck: 'Rückgängig',
  melde_zurueck_fertig: 'Rückgängig gemacht.',
  melde_zurueck_fehler: 'Rückgängig ging nicht. Bitte im Kalender.',
  melde_zurueck_veraendert: 'Das hat sich inzwischen geändert, ich lasse es so. Bitte im Kalender prüfen.',
}

const en: Record<keyof typeof de, string> = {
  logo_drinnen: 'Call Dot',
  logo_draussen: 'Send Dot home',
  logo_gesperrt: 'Dot, your AI coach (Pro)',
  figur: 'Dot, your AI coach. Tap to talk, drag to move.',
  gesperrt_titel: 'Dot comes out with Pro',
  gesperrt_text: 'Dot lives in your tab bar. With Pro he comes out, answers questions about your stack and reminds you of what is due today.',
  gesperrt_ok: 'Got it',

  wach: 'Oh! I’m awake.',
  kitzeln: 'Hehe, that tickles!',
  schwindel: 'Whoa … everything is spinning.',
  tschuess: 'See you soon!',
  da_bin: 'Here I am. Tap me and we’ll talk.',
  gruss_morgen: 'Good morning!',
  gruss_tag: 'Hello!',
  gruss_abend: 'Good evening!',
  gruss_nacht: 'Still up?',
  naechste: '{{substanz}} is due at {{zeit}}.',
  naechste_menge: '{{substanz}} is due at {{zeit}}, {{menge}}.',
  alles_erledigt: 'Everything for today is logged.',
  nichts_geplant: 'Nothing is planned for today.',
  uhr_bis: 'It’s {{uhr}}. {{substanz}} is due in {{dauer}}.',
  uhr_offen: 'It’s {{uhr}}. {{anzahl}} intakes are still open today.',
  uhr_offen_one: 'It’s {{uhr}}. One intake is still open today.',
  uhr_erledigt: 'It’s {{uhr}}. You’ve logged everything for today.',
  uhr_verpasst: 'It’s {{uhr}}. {{substanz}} at {{zeit}} isn’t logged yet.',
  std: 'h',
  min: 'min',

  chat_titel: 'Dot',
  chat_schliessen: 'Close chat',
  chat_leeren: 'Clear history',
  chat_platzhalter: 'Ask Dot …',
  chat_senden: 'Send',
  chat_intro: 'Hi, I’m Dot. I know your stack and today’s plan, and I can explain your blood values. I don’t recommend doses — that belongs with your doctor.',
  chat_intro_stack: 'You’re in your stack. Ask me what’s due today or how long your supply lasts.',
  chat_intro_kalender: 'I can see what was planned and what was logged. Ask me about gaps.',
  chat_intro_ernaehrung: 'Ask me about your nutrition today.',
  chat_denkt: 'Dot is thinking …',
  chat_fehler: 'That didn’t work. Please try again in a moment.',
  chat_offline: 'I can’t answer without an internet connection.',
  chat_grenze: 'That’s enough talking for today. I’ll be back for you tomorrow.',
  chat_kein_zugang: 'Chatting with Dot comes with Pro.',
  chip_heute: 'What’s due today?',
  chip_verpasst: 'What did I miss this week?',
  chip_naechste: 'When is my next intake?',
  chip_blutwerte: 'Explain my latest blood values',
  chip_bestand: 'How long will my supply last?',
  chip_ernaehrung: 'How is my nutrition today?',
  chip_heim: 'Go to your house',
  heim_antwort: 'See you later. Tap my logo in the tab bar when you need me.',
  hinweis_unten: 'Dot is an AI and can be wrong. No diagnosis, no dose recommendations.',

  einw_titel: 'Before we talk',
  einw_text: 'To answer, the app sends your question and a summary of your data to Anthropic (Claude), an AI provider in the USA: your stack, your intake plan for the last few days, your latest blood values and today’s nutrition (calories and macros). This is health data.',
  einw_punkt_1: 'TYD doesn’t store your questions on the server, only how many you asked today (for the daily limit).',
  einw_punkt_2: 'The app keeps the chat history on this device only.',
  einw_punkt_3: 'You can withdraw your consent in the chat at any time.',
  einw_ja: 'I agree',
  einw_nein: 'Not now',
  einw_widerrufen: 'Withdraw consent',
  einw_widerrufen_fertig: 'Consent withdrawn. Dot no longer sends anything to Anthropic.',
  einw_fehler: 'Could not be saved. Please try again.',

  auto_eingetragen: 'I logged {{anzahl}} intakes for you. Tell me if anything was different.',
  auto_eingetragen_one: 'I logged one intake for you. Tell me if anything was different.',
  auto_titel: 'Dot logs automatically',
  auto_text: 'Planned intakes count as taken once their time is 30 minutes past. You only tell Dot what was different.',
  auto_text_buendel: 'Applies to every substance in this bundle. Planned intakes count as taken once their time is 30 minutes past.',
  auto_pro: 'With Pro',
  auto_marke: 'automatic',
  auto_fehler: 'Could not be saved. Please try again.',
  auto_ueber_buendel: 'Also on through your bundle “{{name}}”: while it is on, Dot logs this one.',

  // Logging by sentence (cards in the chat)
  melde_genommen: '{{substanz}}, {{wann}}: logged as taken ({{uhrzeit}}).',
  melde_vergessen: '{{substanz}}, {{wann}}: logged as forgotten.',
  melde_vorgemerkt: '{{substanz}}, {{wann}}: I will log it as taken at {{uhrzeit}}.',
  melde_selbst: '{{substanz}}, {{wann}}: noted. Tick it off yourself at {{uhrzeit}}; I only log automatically with the switch on the substance.',
  melde_schon_genommen: '{{substanz}}, {{wann}}: was already logged as taken.',
  melde_schon_vergessen: '{{substanz}}, {{wann}}: was already logged as forgotten.',
  melde_fehler: '{{substanz}}, {{wann}}: I could not log that. Please use the calendar.',
  melde_unbekannt: 'I cannot find that intake right now. Please tell me again.',
  melde_heute: 'today',
  melde_gestern: 'yesterday',
  melde_zurueck: 'Undo',
  melde_zurueck_fertig: 'Undone.',
  melde_zurueck_fehler: 'Undo did not work. Please use the calendar.',
  melde_zurueck_veraendert: 'That has changed since, so I am leaving it. Please check the calendar.',
}

export const DOT_TEXTE = { de, en }
export type DotTextKey = keyof typeof de
export type DotSprache = 'de' | 'en'

export const dotSprache = (language: string | undefined): DotSprache =>
  (language ?? '').toLowerCase().startsWith('de') ? 'de' : 'en'

export function dotText(lang: DotSprache, key: DotTextKey, vars?: Record<string, string | number>): string {
  const table = DOT_TEXTE[lang] as Record<string, string>
  const einzahl = vars?.anzahl === 1 ? table[`${key}_one`] : undefined
  const roh = einzahl ?? table[key] ?? DOT_TEXTE.en[key] ?? key
  return vars ? roh.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, n: string) => (n in vars ? String(vars[n]) : m)) : roh
}

export function useDotText() {
  const { i18n } = useTranslation()
  // Ohne i18n-Instanz (Tests mit gemocktem useTranslation) gilt Englisch
  const lang = dotSprache(i18n?.resolvedLanguage ?? i18n?.language)
  const dt = useCallback((key: DotTextKey, vars?: Record<string, string | number>) => dotText(lang, key, vars), [lang])
  return { dt, lang }
}
