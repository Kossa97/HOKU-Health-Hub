/**
 * Texte fuer den Routine-Editor v2 (implizites Speichern, Satzzeilen,
 * Saetze je Muskel) und die Plan-Ansicht auf „Heute" (Als Naechstes,
 * Ordnergruppen, Vorlagen anlegen). Nur de/en. Was der Logger und der Editor
 * gemeinsam haben (Ordner, Wdh.-Bereich, Rueckgaengig), steht in `liveTexts`.
 */

const de = {
  // Editor: Kopf und Speichern
  editor_saves_on_close: 'Speichert beim Schließen',
  editor_close_save: 'Schließen und speichern',
  routine_default_name: 'Routine {{n}}',
  routine_delete: 'Routine löschen',
  exercise_menu: 'Mehr zu dieser Übung',

  // Editor: Plan-Chips
  folder_new: '+ Neu',
  folder_new_placeholder: 'Name des Plans',

  // Editor: Uebungszeile
  rest_change: 'Pause ändern',
  rest_seconds: '{{s}} s',
  set_type: 'Satzart',
  weight_start: '{{unit}} (Start)',
  weight_last_time: 'zuletzt',
  add_set_short: '+ Satz',
  remove_set_short: '− Satz',
  add_from_catalog: 'Übung aus dem Katalog',
  note_add: 'Notiz hinzufügen',
  note_show: 'Notiz anzeigen',

  // Saetze je Muskel
  muscle_routine_times: 'Routine · ×{{count}} pro Woche im Plan',
  muscle_sets_week: '{{sets}} · {{week}}/Wo',
  muscle_band_hint: 'Das helle Band ist der übliche Richtwert von 10–20 Sätzen pro Woche. Hilfsmuskeln zählen halb.',
  muscle_empty_editor: 'Füge Übungen hinzu, dann siehst du hier die Sätze je Muskel.',
  muscle_week_title: 'Sätze je Muskel · diese Woche',

  // Heute: Plan
  plan_next_title: 'Als Nächstes im Plan',
  plan_rotation: 'Rotation',
  plan_last: 'zuletzt {{day}}',
  plan_never: 'noch nie trainiert',
  plan_heading: 'Plan · {{name}}',
  routines_count: '{{count}} Routinen',
  routines_count_one: '1 Routine',
  plan_create_title: 'Plan anlegen',
  plan_create_hint: 'Legt den Ordner „{{name}}" mit {{count}} Routinen an. Übungen und Tage lassen sich danach ändern.',
  plan_create: 'Anlegen',
  plan_creating: 'Legt an …',
  plan_days_per_week: '{{count}}× pro Woche',
}

const en: Record<keyof typeof de, string> = {
  editor_saves_on_close: 'Saves when you close',
  editor_close_save: 'Close and save',
  routine_default_name: 'Routine {{n}}',
  routine_delete: 'Delete routine',
  exercise_menu: 'More for this exercise',

  folder_new: '+ New',
  folder_new_placeholder: 'Plan name',

  rest_change: 'Change rest',
  rest_seconds: '{{s}} s',
  set_type: 'Set type',
  weight_start: '{{unit}} (start)',
  weight_last_time: 'last',
  add_set_short: '+ Set',
  remove_set_short: '− Set',
  add_from_catalog: 'Exercise from the catalog',
  note_add: 'Add note',
  note_show: 'Show note',

  muscle_routine_times: 'Routine · ×{{count}} per week in the plan',
  muscle_sets_week: '{{sets}} · {{week}}/wk',
  muscle_band_hint: 'The light band is the usual guideline of 10–20 sets per week. Secondary muscles count half.',
  muscle_empty_editor: 'Add exercises to see sets per muscle here.',
  muscle_week_title: 'Sets per muscle · this week',

  plan_next_title: 'Up next in your plan',
  plan_rotation: 'Rotation',
  plan_last: 'last {{day}}',
  plan_never: 'not trained yet',
  plan_heading: 'Plan · {{name}}',
  routines_count: '{{count}} routines',
  routines_count_one: '1 routine',
  plan_create_title: 'Create plan',
  plan_create_hint: 'Creates the folder "{{name}}" with {{count}} routines. Exercises and days can be changed afterwards.',
  plan_create: 'Create',
  plan_creating: 'Creating …',
  plan_days_per_week: '{{count}}× per week',
}

export const EDITOR_TEXTS = { de, en }
