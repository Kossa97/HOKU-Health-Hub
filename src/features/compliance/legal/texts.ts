/**
 * Rechtstexte: Datenschutzerklaerung, Impressum, Nutzungsbedingungen.
 *
 * ENTWURF. Die Gliederung folgt dem, was die Stores und die DSGVO verlangen,
 * und beschreibt die App so, wie sie gebaut ist (Dienste, Regionen, Daten).
 * Alles in [[doppelten eckigen Klammern]] muss der Betreiber ausfuellen; die
 * Seite hebt es hervor und zeigt oben einen Entwurfshinweis, solange noch
 * eine Luecke drin ist. Vor dem Start rechtlich pruefen lassen.
 *
 * Nur Deutsch und Englisch (Start-Sprachen); andere Sprachen sehen Englisch.
 */

export type LegalPageKey = 'datenschutz' | 'impressum' | 'nutzungsbedingungen'
export type LegalLang = 'de' | 'en'

export interface LegalSection {
  heading: string
  paragraphs: string[]
}

export interface LegalDoc {
  title: string
  updated: string
  sections: LegalSection[]
}

const STAND_DE = 'Stand: Oktober 2026'
const STAND_EN = 'Last updated: October 2026'

const DATENSCHUTZ_DE: LegalDoc = {
  title: 'Datenschutzerklärung',
  updated: STAND_DE,
  sections: [
    {
      heading: '1. Verantwortlicher',
      paragraphs: [
        'Verantwortlich für die Verarbeitung deiner Daten in TYD — Track Your Dose ist: [[Vor- und Nachname bzw. Firma]], [[Straße und Hausnummer]], [[PLZ und Ort]], [[Land]]. E-Mail: [[Kontakt-E-Mail]].',
      ],
    },
    {
      heading: '2. Welche Daten wir verarbeiten',
      paragraphs: [
        'Konto: E-Mail-Adresse, Passwort (nur verschlüsselt gespeichert), Nutzername, freiwillig Anzeigename und Profiltext, Sprache und Einstellungen, Zeitpunkt deiner Zustimmung zu diesen Bedingungen und deiner Altersbestätigung.',
        'Gesundheitsdaten, die du selbst einträgst: Substanzen in deinem Stack, Einnahmepläne und -protokolle, Bestand, Blutwerte und Befunde, Gewicht und Körpermaße, Ernährung (Mahlzeiten, Lebensmittel und Gerichte, Wasser, Ernährungsziele), Fortschrittsfotos, Tagebuch und deine Erfahrungen. Das sind besondere Kategorien personenbezogener Daten nach Art. 9 DSGVO.',
        'Technische Daten: Fehlerberichte bei Abstürzen (ohne Gesundheitsdaten und ohne IP-Adresse, siehe Abschnitt 5) und, wenn du Erinnerungen einschaltest, die Push-Adresse deines Geräts.',
        'Kamera: Wenn du einen Barcode scannst, erkennt dein Gerät die Ziffern selbst — das Kamerabild wird dabei weder übertragen noch gespeichert. Fotos für die Erkennung von Mahlzeiten verlassen das Gerät nur, wenn du diese Funktion nutzt (siehe Abschnitt 5).',
      ],
    },
    {
      heading: '3. Zwecke und Rechtsgrundlagen',
      paragraphs: [
        'Wir verarbeiten deine Daten nur, um dir die Funktionen der App bereitzustellen: Tracking, Erinnerungen, Auswertungen, Export und — wenn du es einschaltest — dein öffentliches Profil.',
        'Rechtsgrundlage für Kontodaten ist die Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO). Gesundheitsdaten verarbeiten wir auf Grundlage deiner ausdrücklichen Einwilligung (Art. 9 Abs. 2 lit. a DSGVO), die du bei der Registrierung erteilst. Du kannst sie jederzeit widerrufen, indem du dein Konto löschst; die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt.',
        'Keine Werbung, kein Tracking, kein Verkauf von Daten. An einen KI-Dienst geht nur dann etwas, wenn du den Befund-Import oder die Erkennung von Mahlzeiten nutzt und dem jeweils vorher gesondert zustimmst (Art. 9 Abs. 2 lit. a DSGVO, siehe Abschnitt 5). Beide Einwilligungen kannst du im Profil jederzeit widerrufen.',
      ],
    },
    {
      heading: '4. Apple Health und Health Connect',
      paragraphs: [
        'Wenn du es erlaubst, liest die App aus Apple Health (iOS) bzw. Health Connect (Android) Gewicht, Schritte, Aktivität und Herzfrequenz, um sie neben deinen Einträgen anzuzeigen. Die App schreibt nichts dorthin.',
        'Diese Daten werden nicht für Werbung, nicht für Marketing und nicht zur Profilbildung verwendet und nicht an Dritte weitergegeben. Du kannst die Erlaubnis jederzeit in den Einstellungen deines Geräts entziehen.',
      ],
    },
    {
      heading: '5. Empfänger und Dienstleister',
      paragraphs: [
        'Supabase (Datenbank, Anmeldung, Dateispeicher) — Supabase Inc., Rechenzentrum in der EU (Irland). Hier liegen dein Konto und alle deine Einträge.',
        'Vercel (Auslieferung der App und Server-Funktionen für Erinnerungen) — Vercel Inc., USA. [[Region der Server-Funktionen eintragen]]. Datenübermittlung auf Grundlage des EU-US Data Privacy Framework bzw. von Standardvertragsklauseln.',
        'Sentry (Fehlerberichte) — Functional Software Inc., Speicherort EU (Deutschland). Vor dem Senden werden alle Nutzerinhalte entfernt; die IP-Adresse wird nicht gespeichert.',
        'Anthropic (KI-Auswertung von Laborbefunden, optional) — Anthropic, PBC, USA. Nur wenn du einen Befund importierst und eingewilligt hast: Das Foto bzw. PDF wird zur Auswertung übertragen, zurück kommen nur die erkannten Laborwerte. Auf dem Befund können auch Name, Geburtsdatum und Anschrift stehen — die App empfiehlt, sie vorher abzudecken. TYD speichert die Datei nicht. [[Speicherdauer und Nutzung bei Anthropic laut Vertrag eintragen; Grundlage der Übermittlung in die USA (EU-US Data Privacy Framework oder Standardvertragsklauseln) prüfen]]',
        'Anthropic (KI-Erkennung von Mahlzeiten, optional) — derselbe Dienst. Nur wenn du „Essen fotografieren" nutzt und dafür gesondert eingewilligt hast: Das Foto (verkleinert) und/oder deine Notiz zum Gericht werden übertragen, zurück kommen nur der Name des Gerichts und mögliche Zutaten — keine Mengen und keine Nährwerte; die wählst du selbst aus der Lebensmitteldatenbank. TYD speichert weder Foto noch Notiz, sondern nur den Zeitpunkt der Anfrage (für das Tageslimit). Achte darauf, dass keine Personen auf dem Foto sind. Für Speicherdauer bei Anthropic und Übermittlungsgrundlage gilt dasselbe wie beim Befund-Import.',
        'Open Food Facts (Lebensmitteldatenbank) — Open Food Facts, gemeinnütziger Verein, Frankreich. Wenn du einen Barcode scannst oder nach Markenprodukten suchst, fragt unser Server die Datenbank ab — nur mit dem Barcode bzw. dem Suchbegriff, ohne deine IP-Adresse oder Kontodaten. Open Food Facts erfährt nicht, wer sucht. Was du einträgst, bleibt bei uns.',
        'Push-Dienste — wenn du Erinnerungen einschaltest, stellt der Push-Dienst deines Betriebssystems bzw. Browsers (Apple, Google oder Mozilla) die Benachrichtigung zu. Die Nachricht enthält den Namen der Substanz, die Menge und den Zeitpunkt — sie kann auf dem Sperrbildschirm sichtbar sein.',
        'Mit allen Dienstleistern bestehen Verträge zur Auftragsverarbeitung (Art. 28 DSGVO). [[Prüfen und bestätigen]]',
      ],
    },
    {
      heading: '6. Öffentliches Profil',
      paragraphs: [
        'Dein Profil ist privat. Schaltest du es öffentlich, sind unter /u/<Nutzername> nur dein Nutzername, dein Anzeigename, dein Profiltext und die Erfahrungen zu sehen, die du einzeln freigegeben hast — mit Substanzname und Monat, nie mit Dosis, Zyklus, genauem Datum, Alter oder Geschlecht.',
        'Öffentliche Erfahrungen und Profile können von angemeldeten Nutzern gemeldet werden. Gemeldete Inhalte sieht nur die Moderation.',
      ],
    },
    {
      heading: '7. Speicherdauer und Löschung',
      paragraphs: [
        'Wir speichern deine Daten, solange dein Konto besteht. Unter Profil → Konto löschen löschst du dein Konto mit allen Einträgen, Fotos und Dokumenten sofort und endgültig. Fehlerberichte werden nach [[Aufbewahrungsdauer bei Sentry, z. B. 90 Tagen]] gelöscht.',
      ],
    },
    {
      heading: '8. Deine Rechte',
      paragraphs: [
        'Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO) sowie auf Widerruf deiner Einwilligung. Viele Daten kannst du in der App selbst einsehen, ändern, als PDF exportieren und löschen. Für alles andere: [[Kontakt-E-Mail]].',
        'Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, etwa bei der für uns zuständigen: [[zuständige Aufsichtsbehörde]].',
      ],
    },
    {
      heading: '9. Mindestalter',
      paragraphs: ['Die App richtet sich ausschließlich an Erwachsene ab 18 Jahren.'],
    },
  ],
}

const DATENSCHUTZ_EN: LegalDoc = {
  title: 'Privacy Policy',
  updated: STAND_EN,
  sections: [
    {
      heading: '1. Controller',
      paragraphs: [
        'The controller responsible for processing your data in TYD — Track Your Dose is: [[full name or company]], [[street and number]], [[postcode and city]], [[country]]. Email: [[contact email]].',
      ],
    },
    {
      heading: '2. What data we process',
      paragraphs: [
        'Account: email address, password (stored only in encrypted form), username, optionally display name and bio, language and settings, and when you accepted these terms and confirmed your age.',
        'Health data you enter yourself: substances in your stack, schedules and intake logs, inventory, blood values and lab reports, weight and body measurements, nutrition (meals, foods and recipes, water, nutrition goals), progress photos, journal and your experiences. These are special categories of personal data under Art. 9 GDPR.',
        'Technical data: crash reports (without health data and without IP address, see section 5) and, if you turn on reminders, your device\'s push address.',
        'Camera: when you scan a barcode, your device reads the digits itself — the camera image is neither sent nor stored. Photos for meal recognition only leave your device if you use that feature (see section 5).',
      ],
    },
    {
      heading: '3. Purposes and legal bases',
      paragraphs: [
        'We process your data only to provide the app\'s features: tracking, reminders, insights, export and — if you turn it on — your public profile.',
        'The legal basis for account data is performance of the user agreement (Art. 6(1)(b) GDPR). We process health data based on your explicit consent (Art. 9(2)(a) GDPR), which you give when you register. You can withdraw it at any time by deleting your account; this does not affect the lawfulness of processing before withdrawal.',
        'No advertising, no tracking, no sale of data. Data goes to an AI service only if you use the lab report import or meal recognition and give separate consent for each beforehand (Art. 9(2)(a) GDPR, see section 5). You can withdraw either consent in your profile at any time.',
      ],
    },
    {
      heading: '4. Apple Health and Health Connect',
      paragraphs: [
        'If you allow it, the app reads weight, steps, activity and heart rate from Apple Health (iOS) or Health Connect (Android) to show them next to your entries. The app does not write anything there.',
        'This data is not used for advertising, marketing or profiling and is not shared with third parties. You can revoke access at any time in your device settings.',
      ],
    },
    {
      heading: '5. Recipients and service providers',
      paragraphs: [
        'Supabase (database, sign-in, file storage) — Supabase Inc., data centre in the EU (Ireland). Your account and all your entries are stored here.',
        'Vercel (app delivery and server functions for reminders) — Vercel Inc., USA. [[enter region of server functions]]. Transfers are based on the EU-US Data Privacy Framework or standard contractual clauses.',
        'Sentry (crash reports) — Functional Software Inc., storage in the EU (Germany). All user content is removed before sending; IP addresses are not stored.',
        'Anthropic (AI reading of lab reports, optional) — Anthropic, PBC, USA. Only if you import a lab report and have consented: the photo or PDF is sent for reading, and only the recognised lab values come back. A lab report may also show your name, date of birth and address — the app recommends covering them first. TYD does not store the file. [[enter retention and use at Anthropic according to the contract; check the basis for the transfer to the USA (EU-US Data Privacy Framework or standard contractual clauses)]]',
        'Anthropic (AI meal recognition, optional) — the same provider. Only if you use "Snap your meal" and have given separate consent for it: the photo (downscaled) and/or your note about the dish are sent, and only the name of the dish and possible ingredients come back — no amounts and no nutrition values; you choose those yourself from the food database. TYD stores neither the photo nor the note, only the time of the request (for the daily limit). Make sure no people are in the photo. Retention at Anthropic and the basis for the transfer are the same as for the lab report import.',
        'Open Food Facts (food database) — Open Food Facts, non-profit association, France. When you scan a barcode or search for branded products, our server queries the database — only with the barcode or search term, without your IP address or account data. Open Food Facts does not learn who is searching. What you log stays with us.',
        'Push services — if you turn on reminders, your operating system\'s or browser\'s push service (Apple, Google or Mozilla) delivers the notification. It contains the substance name, amount and time — it may be visible on your lock screen.',
        'Data processing agreements (Art. 28 GDPR) are in place with all providers. [[check and confirm]]',
      ],
    },
    {
      heading: '6. Public profile',
      paragraphs: [
        'Your profile is private. If you make it public, /u/<username> shows only your username, display name, bio and the experiences you have shared one by one — with substance name and month, never with dose, cycle, exact date, age or gender.',
        'Public experiences and profiles can be reported by signed-in users. Reported content is visible to moderators only.',
      ],
    },
    {
      heading: '7. Retention and deletion',
      paragraphs: [
        'We keep your data as long as your account exists. Under Profile → Delete account you delete your account with all entries, photos and documents immediately and permanently. Crash reports are deleted after [[Sentry retention period, e.g. 90 days]].',
      ],
    },
    {
      heading: '8. Your rights',
      paragraphs: [
        'You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), data portability (Art. 20) and objection (Art. 21 GDPR), and to withdraw your consent. You can view, change, export as PDF and delete much of your data in the app yourself. For anything else: [[contact email]].',
        'You can lodge a complaint with a data protection authority, for example the one responsible for us: [[competent supervisory authority]].',
      ],
    },
    {
      heading: '9. Minimum age',
      paragraphs: ['The app is intended exclusively for adults aged 18 and over.'],
    },
  ],
}

const IMPRESSUM_DE: LegalDoc = {
  title: 'Impressum',
  updated: STAND_DE,
  sections: [
    {
      heading: 'Angaben gemäß § 5 DDG',
      paragraphs: ['[[Vor- und Nachname bzw. Firma mit Rechtsform]]', '[[Straße und Hausnummer]]', '[[PLZ und Ort]]', '[[Land]]'],
    },
    {
      heading: 'Kontakt',
      paragraphs: ['E-Mail: [[Kontakt-E-Mail]]', 'Telefon: [[Telefonnummer oder zweiter schneller Kontaktweg]]'],
    },
    {
      heading: 'Weitere Angaben',
      paragraphs: [
        '[[Falls vorhanden: Registergericht und Registernummer, Umsatzsteuer-ID, vertretungsberechtigte Person — sonst diesen Absatz entfernen]]',
      ],
    },
    {
      heading: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
      paragraphs: ['[[Vor- und Nachname, Anschrift wie oben]]'],
    },
    {
      heading: 'Hinweis',
      paragraphs: [
        'TYD ist ein persönliches Tracking-Werkzeug und kein Medizinprodukt. Inhalte der App und Erfahrungen anderer Nutzer sind keine medizinische Beratung und keine Empfehlung.',
      ],
    },
  ],
}

const IMPRESSUM_EN: LegalDoc = {
  title: 'Legal notice',
  updated: STAND_EN,
  sections: [
    {
      heading: 'Information pursuant to § 5 DDG (Germany)',
      paragraphs: ['[[full name or company with legal form]]', '[[street and number]]', '[[postcode and city]]', '[[country]]'],
    },
    {
      heading: 'Contact',
      paragraphs: ['Email: [[contact email]]', 'Phone: [[phone number or second fast contact channel]]'],
    },
    {
      heading: 'Further information',
      paragraphs: [
        '[[if applicable: register court and number, VAT ID, authorised representative — otherwise remove this paragraph]]',
      ],
    },
    {
      heading: 'Responsible for content under § 18(2) MStV',
      paragraphs: ['[[full name, address as above]]'],
    },
    {
      heading: 'Note',
      paragraphs: [
        'TYD is a personal tracking tool and not a medical device. Content in the app and other users\' experiences are not medical advice and not a recommendation.',
      ],
    },
  ],
}

const BEDINGUNGEN_DE: LegalDoc = {
  title: 'Nutzungsbedingungen',
  updated: STAND_DE,
  sections: [
    {
      heading: '1. Anbieter und Geltungsbereich',
      paragraphs: [
        'Diese Bedingungen gelten für die Nutzung von TYD — Track Your Dose (App und Web) und werden mit [[Vor- und Nachname bzw. Firma]] (Angaben im Impressum) vereinbart.',
      ],
    },
    {
      heading: '2. Mindestalter',
      paragraphs: ['Du musst mindestens 18 Jahre alt sein, um TYD zu nutzen. Mit der Registrierung bestätigst du das.'],
    },
    {
      heading: '3. Kein Medizinprodukt, keine Beratung',
      paragraphs: [
        'TYD ist ein persönliches Werkzeug, um festzuhalten, was du nimmst und wie es dir geht. Es ist kein Medizinprodukt, stellt keine Diagnosen und gibt keine Behandlungs- oder Dosierungsempfehlungen.',
        'Rechner, Umrechner und die Blutspiegel-Simulation rechnen nur mit den Werten, die du eingibst, bzw. mit Durchschnittswerten aus der Literatur. Die Ergebnisse sind Rechenhilfen, keine Empfehlung, und können von der Wirklichkeit abweichen. Prüfe jede Dosis mit einer Ärztin, einem Arzt oder in der Apotheke.',
        'Du bist selbst dafür verantwortlich, dass das, was du einnimmst und einträgst, nach dem für dich geltenden Recht erlaubt ist. TYD unterstützt weder Erwerb noch Handel von Substanzen.',
      ],
    },
    {
      heading: '4. Dein Konto',
      paragraphs: [
        'Halte deine Zugangsdaten geheim. Du kannst dein Konto jederzeit unter Profil → Konto löschen endgültig löschen.',
      ],
    },
    {
      heading: '5. Öffentliche Inhalte',
      paragraphs: [
        'Wenn du Erfahrungen öffentlich teilst, gelten diese Regeln. Für anstößige oder rechtswidrige Inhalte gibt es keine Toleranz. Nicht erlaubt sind insbesondere:',
        '— Angebote, Bezugsquellen, Preise, Rabattcodes oder sonstige Hinweise auf Kauf, Verkauf oder Tausch von Substanzen;',
        '— Links, Kontaktdaten und Verweise auf Messenger oder andere Plattformen;',
        '— Dosierungsanleitungen oder Aufforderungen an andere, eine Substanz zu nehmen;',
        '— Beleidigungen, Belästigung, Hassrede, Drohungen und Inhalte, die Rechte Dritter verletzen.',
        'Ein Filter prüft öffentliche Texte vor dem Speichern. Jeder Inhalt kann gemeldet und jedes Profil blockiert werden. Gemeldete Inhalte prüfen wir innerhalb von 24 Stunden und blenden sie aus, wenn sie gegen diese Regeln verstoßen; wiederholte oder schwere Verstöße führen zur Sperrung des Kontos.',
        'Deine Inhalte bleiben deine. Du erlaubst uns, sie innerhalb von TYD so anzuzeigen, wie du sie freigegeben hast, bis du sie löschst oder die Freigabe zurücknimmst.',
      ],
    },
    {
      heading: '6. Verfügbarkeit und Haftung',
      paragraphs: [
        'Wir bemühen uns um einen störungsfreien Betrieb, können ihn aber nicht garantieren. Sichere wichtige Daten zusätzlich, etwa über den PDF-Export.',
        '[[Haftungsklausel rechtlich prüfen lassen — üblich: unbeschränkte Haftung bei Vorsatz, grober Fahrlässigkeit und Verletzung von Leben, Körper oder Gesundheit; bei leichter Fahrlässigkeit nur für wesentliche Pflichten und begrenzt auf den vorhersehbaren Schaden]]',
      ],
    },
    {
      heading: '7. Änderungen',
      paragraphs: [
        'Ändern sich diese Bedingungen wesentlich, bitten wir dich in der App erneut um Zustimmung. Ohne Zustimmung kannst du dein Konto löschen.',
      ],
    },
    {
      heading: '8. Schlussbestimmungen',
      paragraphs: ['Es gilt deutsches Recht. Zwingende Verbraucherschutzvorschriften deines Wohnsitzlandes bleiben unberührt. [[prüfen]]'],
    },
  ],
}

const BEDINGUNGEN_EN: LegalDoc = {
  title: 'Terms of Use',
  updated: STAND_EN,
  sections: [
    {
      heading: '1. Provider and scope',
      paragraphs: [
        'These terms govern the use of TYD — Track Your Dose (app and web) and are agreed with [[full name or company]] (details in the legal notice).',
      ],
    },
    {
      heading: '2. Minimum age',
      paragraphs: ['You must be at least 18 years old to use TYD. By registering you confirm this.'],
    },
    {
      heading: '3. Not a medical device, no advice',
      paragraphs: [
        'TYD is a personal tool for recording what you take and how you feel. It is not a medical device, does not diagnose and does not give treatment or dosing recommendations.',
        'Calculators, converters and the blood level simulation only compute with the values you enter or with average values from the literature. The results are calculation aids, not a recommendation, and may differ from reality. Check every dose with a doctor or pharmacist.',
        'You are responsible for ensuring that what you take and record is permitted under the law that applies to you. TYD does not support buying or trading substances.',
      ],
    },
    {
      heading: '4. Your account',
      paragraphs: [
        'Keep your credentials secret. You can permanently delete your account at any time under Profile → Delete account.',
      ],
    },
    {
      heading: '5. Public content',
      paragraphs: [
        'If you share experiences publicly, these rules apply. There is no tolerance for objectionable or unlawful content. In particular, the following is not allowed:',
        '— offers, sources, prices, discount codes or any other reference to buying, selling or trading substances;',
        '— links, contact details and references to messengers or other platforms;',
        '— dosing instructions or encouraging others to take a substance;',
        '— insults, harassment, hate speech, threats and content that infringes the rights of others.',
        'A filter checks public texts before they are saved. Any content can be reported and any profile can be blocked. We review reported content within 24 hours and hide it if it breaks these rules; repeated or serious violations lead to the account being suspended.',
        'Your content remains yours. You allow us to display it within TYD as you have shared it until you delete it or stop sharing it.',
      ],
    },
    {
      heading: '6. Availability and liability',
      paragraphs: [
        'We aim for uninterrupted operation but cannot guarantee it. Keep additional copies of important data, for example via the PDF export.',
        '[[have the liability clause reviewed — customary: unlimited liability for intent, gross negligence and injury to life, body or health; for slight negligence only for essential obligations and limited to foreseeable damage]]',
      ],
    },
    {
      heading: '7. Changes',
      paragraphs: [
        'If these terms change materially, we will ask for your consent again in the app. If you do not agree, you can delete your account.',
      ],
    },
    {
      heading: '8. Final provisions',
      paragraphs: ['German law applies. Mandatory consumer protection rules of your country of residence remain unaffected. [[check]]'],
    },
  ],
}

export const LEGAL_DOCS: Record<LegalPageKey, Record<LegalLang, LegalDoc>> = {
  datenschutz: { de: DATENSCHUTZ_DE, en: DATENSCHUTZ_EN },
  impressum: { de: IMPRESSUM_DE, en: IMPRESSUM_EN },
  nutzungsbedingungen: { de: BEDINGUNGEN_DE, en: BEDINGUNGEN_EN },
}

export const LEGAL_PATHS: Record<LegalPageKey, string> = {
  datenschutz: '/datenschutz',
  impressum: '/impressum',
  nutzungsbedingungen: '/nutzungsbedingungen',
}

export function legalLang(language: string | undefined): LegalLang {
  return language?.toLowerCase().startsWith('de') ? 'de' : 'en'
}

const PLATZHALTER = /\[\[[^\]]+\]\]/

export function hatPlatzhalter(doc: LegalDoc): boolean {
  return doc.sections.some(section => section.paragraphs.some(text => PLATZHALTER.test(text)))
}

/** Zerlegt einen Absatz in Text und Platzhalter, damit die Seite sie hervorhebt. */
export function teileAbsatz(text: string): { text: string; platzhalter: boolean }[] {
  return text.split(/(\[\[[^\]]+\]\])/).filter(Boolean).map(teil => (
    teil.startsWith('[[') && teil.endsWith(']]')
      ? { text: teil.slice(2, -2), platzhalter: true }
      : { text: teil, platzhalter: false }
  ))
}
