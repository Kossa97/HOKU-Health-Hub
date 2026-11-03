/**
 * Texte der Landing Page — eigener kleiner Namensraum wie bei Hoku
 * (`features/dot/texte.ts`): nur Deutsch und Englisch (CLAUDE.md), die
 * Locale-Dateien der App bleiben unangetastet.
 */

export type LandingSprache = 'de' | 'en'

const de = {
  // Kopf und Fuß
  app_oeffnen: 'App öffnen',
  sprache: 'Sprache',
  datenschutz: 'Datenschutz',
  impressum: 'Impressum',
  nutzung: 'Nutzungsbedingungen',
  fuss_hinweis: 'HOKU ist ein persönliches Tracking-Werkzeug. Keine medizinische Beratung, keine Dosis-Empfehlungen, keine Diagnosen.',
  bald_ios: 'Bald im App Store',
  bald_android: 'Bald bei Google Play',

  // Hero
  hero_eyebrow: 'HEALTH HUB',
  hero_titel: 'Dein Health Hub.\nMit Hoku.',
  hero_text: 'Stack, Einnahmen, Ernährung, Tagebuch, Training und Blutwerte an einem Ort. Und ein kleiner Begleiter, der mitdenkt.',
  hero_cta: 'Web-App öffnen',
  hero_cta2: 'Hoku kennenlernen',
  hero_scroll: 'Scroll runter',

  // Hoku stellt sich vor
  hoku_eyebrow: 'Das ist Hoku',
  hoku_titel: 'Er lebt in deiner App.',
  hoku_text: 'Hoku wohnt in der Leiste, kommt heraus, wenn du ihn rufst, und du kannst ihn überall hinschieben. Er schaut, hört zu, freut sich mit. Und er weiß, was heute ansteht.',
  hoku_k1_titel: 'Er schaut dich an',
  hoku_k1_text: 'Hoku hat ein Auge. Er folgt deinem Finger, blinzelt und sieht weg, wenn du dein Passwort tippst.',
  hoku_k1_knopf: 'Hallo sagen',
  hoku_k2_titel: 'Er kennt deinen Tag',
  hoku_k2_text: 'Wann ist die nächste Einnahme? Was fehlt noch beim Essen? Hoku sagt es dir, bevor du fragst.',
  hoku_k2_knopf: 'Was steht an?',
  hoku_k3_titel: 'Er freut sich mit',
  hoku_k3_text: 'Alles eingetragen? Dann zeigt Hoku es dir. Kleine Gesten, kein Konfetti.',
  hoku_k3_knopf: 'Zeig mal',

  // Hoku spricht (Sprechblasen auf der Seite)
  h_hey: 'Hey, ich bin\nHoku!',
  h_willkommen: 'Willkommen\nim Health Hub',
  h_scroll: 'Scroll runter, ich zeig dir die App.',
  h_hallo: 'Hallo! Schön, dass du da bist.',
  h_tag: 'Um 8 Uhr ist BPC-157 dran. Das Frühstück fehlt noch.',
  h_freude: 'Alles drin für heute!',
  h_tipp: 'Du kannst mich ziehen und werfen. Trau dich.',
  h_kitzeln: 'Hihi, das kitzelt!',
  h_schwindel: 'Uff … alles dreht sich.',
  h_wach: 'Oh! Bin wach.',
  h_tschuess: 'Bis gleich!',
  h_da_bin: 'Da bin ich.',
  h_tauche: 'Komm, ich zeig dir das von innen.',
  h_zurueck: 'Und wieder draußen.',
  h_angetippt_1: 'In der App öffnet sich hier mein Chat.',
  h_angetippt_2: 'Frag mich, was du willst. Dosis-Empfehlungen gebe ich keine.',
  h_angetippt_3: 'Ich bin aus 460 Punkten. Zähl nach.',

  // Features
  features_eyebrow: 'Die App',
  features_titel: 'Probier es aus.',
  features_text: 'Die Vorschauen sind echt: tippe hinein, Hoku taucht mit ein.',
  f_heute_eyebrow: 'Heute',
  f_heute_titel: 'Dein Tag auf einen Blick.',
  f_heute_text: 'Was heute fällig ist, steht oben. Ein Tipp, und die ganze Routine ist eingetragen. Der Bestand rechnet mit.',
  f_heute_tipp: 'Tipp auf „Alle als eingenommen markieren“.',
  f_kalorien_eyebrow: 'Ernährung',
  f_kalorien_titel: 'Ein Punkt, eine Kalorie.',
  f_kalorien_text: 'Die Kugel füllt sich mit jedem Eintrag. Eiweiß, Kohlenhydrate und Fett kreisen als Monde darum. Barcode, Foto oder Suche.',
  f_kalorien_tipp: 'Tipp auf „Hinzufügen“ und sieh die Punkte fliegen.',
  f_tagebuch_eyebrow: 'Tagebuch',
  f_tagebuch_titel: 'Wirkung oder Nebenwirkung?',
  f_tagebuch_text: 'Chips statt Fließtext. Stärke und Dauer in zwei Tipps, verknüpft mit der Einnahme davor. Geht auch ohne Internet.',
  f_tagebuch_tipp: 'Tipp auf „Neu“ und wähl ein paar Chips.',
  mehr_eyebrow: 'Und mehr',
  mehr_titel: 'Alles an einem Ort.',
  mehr_injektionen: 'Injektionstracker',
  mehr_injektionen_text: 'Einstichstellen auf einem 3D-Körper, Rotation im Blick.',
  mehr_training: 'Training',
  mehr_training_text: 'Pläne, Workouts, Übungen. Hoku schlägt dir einen Plan vor.',
  mehr_blutwerte: 'Blutwerte',
  mehr_blutwerte_text: 'Befund fotografieren, Werte im Verlauf, Referenzbereiche.',
  mehr_blutspiegel: 'Blutspiegel',
  mehr_blutspiegel_text: 'Wie viel ist gerade im Körper? Live aus deinen Einnahmen.',
  mehr_peptipedia: 'Peptipedia',
  mehr_peptipedia_text: 'Nachschlagewerk zu Substanzen und Studien.',
  mehr_rechner: 'Rechner',
  mehr_rechner_text: 'Rekonstitution, Einheiten, Spritzenmarkierung.',
  mehr_bald: 'Vorschau folgt',

  // Schluss
  cta_titel: 'Bereit für Hoku?',
  cta_text: 'Die Web-App gibt es jetzt. iPhone und Android folgen.',
  cta_knopf: 'Web-App öffnen',
}

const en: typeof de = {
  app_oeffnen: 'Open app',
  sprache: 'Language',
  datenschutz: 'Privacy',
  impressum: 'Imprint',
  nutzung: 'Terms',
  fuss_hinweis: 'HOKU is a personal tracking tool. No medical advice, no dosing recommendations, no diagnoses.',
  bald_ios: 'Coming to the App Store',
  bald_android: 'Coming to Google Play',

  hero_eyebrow: 'HEALTH HUB',
  hero_titel: 'Your health hub.\nWith Hoku.',
  hero_text: 'Stack, intakes, nutrition, diary, training and blood work in one place. And a small companion who thinks along.',
  hero_cta: 'Open web app',
  hero_cta2: 'Meet Hoku',
  hero_scroll: 'Scroll down',

  hoku_eyebrow: 'This is Hoku',
  hoku_titel: 'He lives in your app.',
  hoku_text: 'Hoku lives in the tab bar, comes out when you call him, and you can push him anywhere. He looks, listens, cheers with you. And he knows what is up today.',
  hoku_k1_titel: 'He looks at you',
  hoku_k1_text: 'Hoku has an eye. He follows your finger, blinks, and looks away while you type your password.',
  hoku_k1_knopf: 'Say hi',
  hoku_k2_titel: 'He knows your day',
  hoku_k2_text: 'When is the next intake? What is missing from lunch? Hoku tells you before you ask.',
  hoku_k2_knopf: "What's up?",
  hoku_k3_titel: 'He cheers with you',
  hoku_k3_text: 'Everything logged? Hoku shows it. Small gestures, no confetti.',
  hoku_k3_knopf: 'Show me',

  h_hey: "Hey, I'm\nHoku!",
  h_willkommen: 'Welcome to\nthe Health Hub',
  h_scroll: "Scroll down, I'll show you the app.",
  h_hallo: 'Hi! Good to have you here.',
  h_tag: 'BPC-157 is due at 8. Breakfast is still missing.',
  h_freude: 'All done for today!',
  h_tipp: 'You can drag and throw me. Go ahead.',
  h_kitzeln: 'Hihi, that tickles!',
  h_schwindel: 'Whoa … everything is spinning.',
  h_wach: "Oh! I'm awake.",
  h_tschuess: 'See you!',
  h_da_bin: 'Here I am.',
  h_tauche: "Come on, I'll show you from the inside.",
  h_zurueck: 'And back out.',
  h_angetippt_1: 'In the app, this opens my chat.',
  h_angetippt_2: "Ask me anything. I don't give dosing advice.",
  h_angetippt_3: "I'm made of 460 dots. Count them.",

  features_eyebrow: 'The app',
  features_titel: 'Try it.',
  features_text: 'The previews are real: tap inside, Hoku dives in with you.',
  f_heute_eyebrow: 'Today',
  f_heute_titel: 'Your day at a glance.',
  f_heute_text: "What's due today sits on top. One tap and the whole routine is logged. Your stock keeps count.",
  f_heute_tipp: 'Tap "Mark all as taken".',
  f_kalorien_eyebrow: 'Nutrition',
  f_kalorien_titel: 'One dot, one calorie.',
  f_kalorien_text: 'The sphere fills with every entry. Protein, carbs and fat orbit it as moons. Barcode, photo or search.',
  f_kalorien_tipp: 'Tap "Add" and watch the dots fly.',
  f_tagebuch_eyebrow: 'Diary',
  f_tagebuch_titel: 'Effect or side effect?',
  f_tagebuch_text: 'Chips instead of prose. Intensity and duration in two taps, linked to the intake before. Works offline too.',
  f_tagebuch_tipp: 'Tap "New" and pick a few chips.',
  mehr_eyebrow: 'And more',
  mehr_titel: 'Everything in one place.',
  mehr_injektionen: 'Injection tracker',
  mehr_injektionen_text: 'Injection sites on a 3D body, rotation in view.',
  mehr_training: 'Training',
  mehr_training_text: 'Plans, workouts, exercises. Hoku drafts a plan for you.',
  mehr_blutwerte: 'Blood work',
  mehr_blutwerte_text: 'Photograph a lab report, values over time, reference ranges.',
  mehr_blutspiegel: 'Blood levels',
  mehr_blutspiegel_text: 'How much is in your body right now? Live from your intakes.',
  mehr_peptipedia: 'Peptipedia',
  mehr_peptipedia_text: 'Reference on substances and studies.',
  mehr_rechner: 'Calculator',
  mehr_rechner_text: 'Reconstitution, units, syringe marks.',
  mehr_bald: 'Preview coming',

  cta_titel: 'Ready for Hoku?',
  cta_text: 'The web app is live now. iPhone and Android follow.',
  cta_knopf: 'Open web app',
}

export type LandingTextKey = keyof typeof de
export const LANDING_TEXTE = { de, en } as const

export function landingSprache(roh: string | null | undefined): LandingSprache {
  return (roh ?? '').toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function landingText(lang: LandingSprache, key: LandingTextKey): string {
  return LANDING_TEXTE[lang][key] ?? LANDING_TEXTE.en[key] ?? key
}

/** Sprache aus Adresse (`?lang=`), gespeicherter Wahl oder Browser. */
export function erkenneSprache(): LandingSprache {
  const url = new URL(window.location.href).searchParams.get('lang')
  if (url) return landingSprache(url)
  try {
    const gespeichert = localStorage.getItem('hoku.landing.lang')
    if (gespeichert) return landingSprache(gespeichert)
  } catch { /* kein Speicher */ }
  return landingSprache(navigator.language)
}

export function merkeSprache(lang: LandingSprache) {
  try { localStorage.setItem('hoku.landing.lang', lang) } catch { /* kein Speicher */ }
}

/** Texte in Hokus Stimme für die Engine (Sprechblasen, die sie selbst auslöst). */
export function hokuStimme(lang: () => LandingSprache) {
  const t = (k: LandingTextKey) => landingText(lang(), k)
  return {
    wach: () => t('h_wach'),
    kitzeln: () => t('h_kitzeln'),
    schwindel: () => t('h_schwindel'),
    tschuess: () => t('h_tschuess'),
    daBin: () => t('h_da_bin'),
    gruss: () => t('h_hallo'),
    uhr: () => t('h_tag'),
  }
}
