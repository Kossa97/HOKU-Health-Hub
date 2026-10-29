/**
 * Texte fuer Logger v2 (Vorschlag, Pause, Rueckgaengig) und Routine-Editor v2
 * (Ordner, Wdh.-Bereich, Saetze je Muskel, Plan-Vorlagen). Nur de/en.
 *
 * Die `progress_*`-Schluessel sind die Begruendungen aus `lib/progression.ts`;
 * ihre Platzhalter (`weight`, `next`, `inc`) bekommen von der Oberflaeche
 * bereits formatierte Gewichte.
 */

const de = {
  // Vorschlag (lib/progression.ts)
  suggestion: 'Vorschlag',
  suggestion_apply: 'Übernehmen',
  suggestion_hide: 'Ausblenden',
  progress_up: 'Letztes Mal {{sets}} × {{reps}} @ {{weight}} geschafft → heute {{next}}',
  progress_jump_too_big: '+{{inc}} wäre ein zu großer Sprung → erst {{reps}} Wdh. bei {{weight}}',
  progress_reps_up: 'Noch nicht alle Sätze bei {{reps}} Wdh. → Gewicht halten, Wdh. steigern',
  progress_reps_only: 'Alle Sätze geschafft → heute {{sets}} × {{reps}} Wdh.',
  progress_back_off: 'Letztes Mal Wdh. verfehlt → etwas leichter: {{weight}}',
  progress_hold: 'Wie letztes Mal: {{sets}} × {{reps}} @ {{weight}}',
  progress_hold_reps: 'Wie letztes Mal: {{sets}} × {{reps}} Wdh.',
  progress_from_template: 'Startwerte aus der Routine',

  // Pause und Satzfolge
  next_set: 'Nächster Satz',
  rest_then_set: 'Pause · dann Satz {{set}}',
  rest_continue: 'Weiter',
  banner_rest: 'Pause {{clock}} · dann Satz {{set}}',
  rest_notify_title: 'Pause vorbei',
  rest_notify_body: '{{exercise}} · Satz {{set}} · {{target}}',
  rest_sound: 'Ton am Pausenende',
  rest_notify: 'Benachrichtigung am Pausenende',

  // Entfernen mit Rueckgaengig, Tausch, Sicherung
  undo: 'Rückgängig',
  set_removed: 'Satz entfernt',
  exercise_removed: 'Übung entfernt',
  exercise_replaced: 'Übung getauscht',
  replace_exercise: 'Übung tauschen',
  saved_on_device: 'Auf dem Gerät gesichert',

  // Abschluss: Routine nachziehen (lib/routineDiff.ts)
  update_routine_question: 'Änderungen in die Routine übernehmen?',
  update_routine_hint: '{{changes}}',
  diff_added: '{{name}} hinzugefügt',
  diff_removed: '{{name}} entfernt',
  diff_reordered: 'Reihenfolge geändert',
  diff_sets: '{{name}}: {{from}} → {{to}} Sätze',
  save_hint: 'Jeder Satz lag schon auf dem Gerät. Jetzt wird die Einheit in dein Konto geschrieben.',
  saved_routine_updated: 'Gespeichert · Routine aktualisiert',
  routine_update_error: 'Gespeichert, aber die Routine konnte nicht aktualisiert werden.',

  // Routine-Editor
  routine_folder: 'Plan',
  routine_folder_none: 'Ohne Plan',
  routine_folder_placeholder: 'z. B. Push/Pull/Beine',
  reps_range: 'Wdh.',
  reps_min: 'von',
  reps_max: 'bis',
  target_weight: 'Zielgewicht',
  target_rpe: 'Ziel-RPE',
  sets_per_muscle: 'Sätze je Muskel',
  sets_per_muscle_week: 'pro Woche, alle Routinen im Plan',
  sets_guide: 'Richtwert 10–20 Sätze pro Woche',
  weekly_sets: '{{count}} Sätze/Woche',
  drag_handle: 'Verschieben',

  // Plaene und Vorlagen (data/plans.ts)
  plan_next: 'Als Nächstes',
  plan_templates: 'Vorlagen',
  plan_template_hint: 'Legt einen Plan mit Routinen an, alles lässt sich ändern.',
  plan_created: 'Plan angelegt',
  plan_fullbody_3: 'Ganzkörper 3×',
  plan_upper_lower_4: 'Ober-/Unterkörper 4×',
  plan_ppl_6: 'Push/Pull/Beine 6×',

  // Raeder fuer Gewicht und Wdh. (live/SetWheelSheet.tsx)
  wheel_same_as_last: 'Wie letztes Mal',
  wheel_save: 'Übernehmen',
  wheel_save_done: 'Übernehmen und abhaken',
  wheel_decimals: 'Nachkomma',
}

const en: Record<keyof typeof de, string> = {
  suggestion: 'Suggestion',
  suggestion_apply: 'Apply',
  suggestion_hide: 'Hide',
  progress_up: 'Last time {{sets}} × {{reps}} @ {{weight}} done → today {{next}}',
  progress_jump_too_big: '+{{inc}} would be too big a jump → {{reps}} reps at {{weight}} first',
  progress_reps_up: 'Not all sets at {{reps}} reps yet → keep the weight, add reps',
  progress_reps_only: 'All sets done → today {{sets}} × {{reps}} reps',
  progress_back_off: 'Missed reps last time → a bit lighter: {{weight}}',
  progress_hold: 'Same as last time: {{sets}} × {{reps}} @ {{weight}}',
  progress_hold_reps: 'Same as last time: {{sets}} × {{reps}} reps',
  progress_from_template: 'Starting values from the routine',

  next_set: 'Next set',
  rest_then_set: 'Rest · then set {{set}}',
  rest_continue: 'Continue',
  banner_rest: 'Rest {{clock}} · then set {{set}}',
  rest_notify_title: 'Rest over',
  rest_notify_body: '{{exercise}} · Set {{set}} · {{target}}',
  rest_sound: 'Sound when rest ends',
  rest_notify: 'Notification when rest ends',

  undo: 'Undo',
  set_removed: 'Set removed',
  exercise_removed: 'Exercise removed',
  exercise_replaced: 'Exercise replaced',
  replace_exercise: 'Replace exercise',
  saved_on_device: 'Saved on this device',

  update_routine_question: 'Update the routine with these changes?',
  update_routine_hint: '{{changes}}',
  diff_added: '{{name}} added',
  diff_removed: '{{name}} removed',
  diff_reordered: 'Order changed',
  diff_sets: '{{name}}: {{from}} → {{to}} sets',
  save_hint: 'Every set was already saved on this device. Now the workout is written to your account.',
  saved_routine_updated: 'Saved · routine updated',
  routine_update_error: 'Saved, but the routine could not be updated.',

  routine_folder: 'Plan',
  routine_folder_none: 'No plan',
  routine_folder_placeholder: 'e.g. Push/Pull/Legs',
  reps_range: 'Reps',
  reps_min: 'from',
  reps_max: 'to',
  target_weight: 'Target weight',
  target_rpe: 'Target RPE',
  sets_per_muscle: 'Sets per muscle',
  sets_per_muscle_week: 'per week, all routines in the plan',
  sets_guide: 'Guideline 10–20 sets per week',
  weekly_sets: '{{count}} sets/week',
  drag_handle: 'Move',

  plan_next: 'Up next',
  plan_templates: 'Templates',
  plan_template_hint: 'Creates a plan with routines; everything can be changed.',
  plan_created: 'Plan created',
  plan_fullbody_3: 'Full Body 3×',
  plan_upper_lower_4: 'Upper/Lower 4×',
  plan_ppl_6: 'Push/Pull/Legs 6×',

  // Wheels for weight and reps (live/SetWheelSheet.tsx)
  wheel_same_as_last: 'Same as last',
  wheel_save: 'Apply',
  wheel_save_done: 'Apply and mark done',
  wheel_decimals: 'decimals',
}

export const LIVE_TEXTS = { de, en }
