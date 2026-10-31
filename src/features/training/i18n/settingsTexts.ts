/** Texte fuer den Bereich settings. Nur de/en. */

const de = {
  settings_title: 'Trainingseinstellungen',
  settings_save_error: 'Einstellung konnte nicht gespeichert werden.',

  // Allgemein
  settings_section_general: 'Allgemein',
  settings_unit: 'Gewichtseinheit',
  settings_rest: 'Standardpause',
  settings_rest_off: 'Aus',
  settings_rest_hint: 'Startet nach jedem abgehakten Satz. Je Übung änderbar.',
  settings_weekly_goal: 'Wochenziel',
  settings_weekly_goal_hint: '{{count}} Trainings pro Woche',
  settings_weekly_goal_hint_one: '1 Training pro Woche',
  settings_bar: 'Stangengewicht',
  settings_bar_hint: 'Für den Scheibenrechner.',
  settings_bar_invalid: 'Bitte ein Gewicht zwischen 0 und 50 kg eingeben.',
  settings_plates: 'Verfügbare Scheiben',
  settings_plates_hint: 'Antippen zum An- oder Abwählen. Der Scheibenrechner nutzt nur diese.',

  // Gesundheitsdaten
  settings_section_health: 'Apple Health / Health Connect',
  settings_health_toggle: 'Daten von der Uhr übernehmen',
  settings_health_hint_ios: 'Liest Workouts, Schlaf und Ruhepuls aus Apple Health. Die App schreibt nichts zurück.',
  settings_health_hint_android: 'Health Connect liefert derzeit nur den Ruhepuls für deine Bereitschaft. Workouts und Schlaf kann die App dort noch nicht lesen.',
  settings_health_web: 'Nur in der App für iPhone und Android verfügbar.',
  settings_health_unavailable: 'Apple Health bzw. Health Connect ist auf diesem Gerät nicht verfügbar.',
  settings_health_denied: 'Zugriff wurde nicht erteilt. Du kannst ihn in den Systemeinstellungen freigeben.',
  settings_health_sync: 'Jetzt synchronisieren',
  settings_health_syncing: 'Synchronisiert …',
  settings_health_sync_result: '{{created}} neu, {{enriched}} ergänzt',
  settings_health_sync_error: 'Synchronisieren fehlgeschlagen.',
  health_import_paused: 'Der Import ist pausiert: Für Daten aus Apple Health bzw. Health Connect fehlt deine Einwilligung.',
  settings_health_consent_give: 'Einwilligung erteilen',

  // GLP-1
  settings_section_glp1: 'GLP-1-Ansicht',
  settings_glp1_hint: 'Zeigt, ob du beim Abnehmen deine Kraft hältst, und wie dein Training um den Injektionstag läuft.',
  settings_glp1_auto: 'Automatisch',
  settings_glp1_on: 'An',
  settings_glp1_off: 'Aus',
  settings_glp1_detected: 'Im Stack erkannt: {{names}}. Die Ansicht ist an.',
  settings_glp1_not_detected: 'Kein GLP-1-Eintrag im Stack erkannt. Die Ansicht ist aus.',

  // Import
  settings_section_import: 'Import aus Hevy oder Strong',
  settings_import_hint: 'Wähle den CSV-Export aus der App. Bereits importierte Trainings werden übersprungen.',
  settings_import_choose: 'CSV-Datei wählen',
  settings_import_read_error: 'Die Datei konnte nicht gelesen werden.',
  settings_import_too_large: 'Die Datei ist zu groß (höchstens 20 MB).',
  settings_import_unknown_format: 'Diese Datei erkennen wir nicht. Erwartet wird ein CSV-Export aus Hevy oder Strong.',
  settings_import_detected: 'Erkannt: Export aus {{format}}',
  settings_import_strong_unit: 'In welcher Einheit hast du in Strong gewogen?',
  settings_import_sessions: '{{count}} Trainings',
  settings_import_sessions_one: '1 Training',
  settings_import_range: 'Zeitraum: {{from}} bis {{to}}',
  settings_import_unknown: '{{count}} Übungen kennen wir nicht. Sie werden als eigene Übungen angelegt:',
  settings_import_unknown_one: '1 Übung kennen wir nicht. Sie wird als eigene Übung angelegt:',
  settings_import_issues: '{{count}} Zeilen oder Werte konnten nicht gelesen werden und werden übersprungen.',
  settings_import_issues_one: '1 Zeile oder Wert konnte nicht gelesen werden und wird übersprungen.',
  settings_import_empty: 'In der Datei wurden keine Trainings gefunden.',
  settings_import_confirm: 'Importieren',
  settings_import_running: 'Importiert …',
  settings_import_discard: 'Verwerfen',
  settings_import_done: '{{count}} Trainings importiert (Duplikate übersprungen).',
  settings_import_done_one: '1 Training importiert (Duplikate übersprungen).',
  settings_import_error: 'Import fehlgeschlagen. Bitte erneut versuchen.',

  // Export
  settings_section_export: 'Export',
  settings_export_hint: 'Deine Daten gehören dir. Der Export ist eine CSV-Datei im Hevy-Format. Du kannst sie in einer Tabellenkalkulation öffnen oder hier wieder einlesen.',
  settings_export_button: 'Als CSV exportieren',
  settings_export_empty: 'Noch keine Trainings zum Exportieren.',
  settings_export_error: 'Export fehlgeschlagen.',

  // Datenschutz
  settings_section_privacy: 'Privatsphäre',
  settings_privacy_text: 'Dein Training ist privat. Es gibt keinen Social-Feed, keine Follower und keine Ranglisten. Nur du siehst deine Einheiten.',
}

const en: Record<keyof typeof de, string> = {
  settings_title: 'Training settings',
  settings_save_error: 'Could not save the setting.',

  // General
  settings_section_general: 'General',
  settings_unit: 'Weight unit',
  settings_rest: 'Default rest',
  settings_rest_off: 'Off',
  settings_rest_hint: 'Starts after every completed set. Can be changed per exercise.',
  settings_weekly_goal: 'Weekly goal',
  settings_weekly_goal_hint: '{{count}} workouts per week',
  settings_weekly_goal_hint_one: '1 workout per week',
  settings_bar: 'Bar weight',
  settings_bar_hint: 'Used by the plate calculator.',
  settings_bar_invalid: 'Please enter a weight between 0 and 50 kg.',
  settings_plates: 'Available plates',
  settings_plates_hint: 'Tap to turn on or off. The plate calculator only uses these.',

  // Health data
  settings_section_health: 'Apple Health / Health Connect',
  settings_health_toggle: 'Use data from your watch',
  settings_health_hint_ios: 'Reads workouts, sleep and resting heart rate from Apple Health. The app never writes anything back.',
  settings_health_hint_android: 'Health Connect currently only provides your resting heart rate for readiness. The app cannot read workouts or sleep there yet.',
  settings_health_web: 'Only available in the iPhone and Android app.',
  settings_health_unavailable: 'Apple Health or Health Connect is not available on this device.',
  settings_health_denied: 'Access was not granted. You can allow it in your system settings.',
  settings_health_sync: 'Sync now',
  settings_health_syncing: 'Syncing …',
  settings_health_sync_result: '{{created}} new, {{enriched}} updated',
  settings_health_sync_error: 'Sync failed.',
  health_import_paused: 'Import is paused: your consent for data from Apple Health or Health Connect is missing.',
  settings_health_consent_give: 'Give consent',

  // GLP-1
  settings_section_glp1: 'GLP-1 view',
  settings_glp1_hint: 'Shows whether you keep your strength while losing weight, and how your training goes around injection day.',
  settings_glp1_auto: 'Automatic',
  settings_glp1_on: 'On',
  settings_glp1_off: 'Off',
  settings_glp1_detected: 'Found in your stack: {{names}}. The view is on.',
  settings_glp1_not_detected: 'No GLP-1 entry found in your stack. The view is off.',

  // Import
  settings_section_import: 'Import from Hevy or Strong',
  settings_import_hint: 'Choose the CSV export from the app. Workouts you already imported are skipped.',
  settings_import_choose: 'Choose CSV file',
  settings_import_read_error: 'The file could not be read.',
  settings_import_too_large: 'The file is too large (20 MB max).',
  settings_import_unknown_format: 'We don’t recognise this file. Please use a CSV export from Hevy or Strong.',
  settings_import_detected: 'Detected: {{format}} export',
  settings_import_strong_unit: 'Which weight unit did you use in Strong?',
  settings_import_sessions: '{{count}} workouts',
  settings_import_sessions_one: '1 workout',
  settings_import_range: 'From {{from}} to {{to}}',
  settings_import_unknown: 'We don’t know {{count}} exercises. They will be added as your own exercises:',
  settings_import_unknown_one: 'We don’t know 1 exercise. It will be added as your own exercise:',
  settings_import_issues: '{{count}} rows or values could not be read and will be skipped.',
  settings_import_issues_one: '1 row or value could not be read and will be skipped.',
  settings_import_empty: 'No workouts found in this file.',
  settings_import_confirm: 'Import',
  settings_import_running: 'Importing …',
  settings_import_discard: 'Discard',
  settings_import_done: '{{count}} workouts imported (duplicates skipped).',
  settings_import_done_one: '1 workout imported (duplicates skipped).',
  settings_import_error: 'Import failed. Please try again.',

  // Export
  settings_section_export: 'Export',
  settings_export_hint: 'Your data belongs to you. The export is a CSV file in Hevy format. Open it in a spreadsheet or import it here again.',
  settings_export_button: 'Export as CSV',
  settings_export_empty: 'No workouts to export yet.',
  settings_export_error: 'Export failed.',

  // Privacy
  settings_section_privacy: 'Privacy',
  settings_privacy_text: 'Your training is private. There is no social feed, no followers and no leaderboards. Only you can see your workouts.',
}

export const SETTINGS_TEXTS = { de, en }
