import { TEST_USER, type MockSupabase } from './mockSupabase'

/**
 * Ausgangsdaten fuer den Gesamtfortschritt (Profil 2b): Eva mit Daten in allen
 * fuenf Bereichen seit dem 14.03.2026 (heute ist der 28.09.2026, fixtures.ts).
 */
export const START = '2026-03-14'

const day = (from: string, n: number) => {
  const d = new Date(`${from}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function session(mock: MockSupabase, on: string, kg: number) {
  mock.insert('training_sessions', {
    user_id: TEST_USER.id, kind: 'strength', title: 'Ganzkörper', started_at: `${on}T16:00:00.000Z`, ended_at: `${on}T17:00:00.000Z`,
    duration_s: 3600, distance_m: null, kcal: null, avg_hr: null, rpe: null, notes: null, routine_id: null, source: 'manual', external_id: null,
    exercises: [{ exerciseId: 'deadlift', sets: [{ type: 'normal', weightKg: kg, reps: 1, done: true }] }],
  })
}

/** Eva mit Daten in allen fünf Bereichen seit dem 14.03.2026. */
export function evaMitFortschritt(mock: MockSupabase, settings: Record<string, unknown> = {}) {
  const profil = mock.table('profiles').find(row => row.id === TEST_USER.id)!
  Object.assign(profil, { username: 'e2e', display_name: 'Eva', goals: ['fettabbau'], field_visibility: {} })
  mock.insert('progress_settings', {
    user_id: TEST_USER.id, start_on: START, previous_starts: [], directions: {}, baselines: {}, history: [],
    earned_badges: { streak_7: '2026-03-21', first_pr: '2026-04-10' }, ...settings,
  })
  // Körper: Gewicht runter (Ziel Fettabbau), Körperfett runter
  for (const [d, kg] of [[START, 84.2], ['2026-04-10', 83.5], ['2026-09-10', 81.4], ['2026-09-25', 80.6]] as const) {
    mock.insert('weight_logs', { user_id: TEST_USER.id, logged_at: `${d}T07:00:00.000Z`, weight_kg: kg })
  }
  for (const [d, pct] of [[START, 19.4], ['2026-04-15', 18.5], ['2026-09-20', 15.8]] as const) {
    mock.insert('daily_logs', { user_id: TEST_USER.id, log_date: d, body_fat_pct: pct, muscle_mass_kg: null })
  }
  // Blut: 2 von 4 → 3 von 4 im Bereich
  const blut = (marker: string, value: number, tested_at: string, min: number, max: number) =>
    mock.insert('bloodwork', { user_id: TEST_USER.id, marker, value, unit: 'mg/dl', tested_at, ref_min: min, ref_max: max, notes: null, report_id: null })
  for (const [d, werte] of [['2026-03-20', [130, 300, 80, 250]], ['2026-06-20', [95, 300, 80, 180]]] as const) {
    blut('Glukose', werte[0], d, 70, 99)
    blut('Triglyceride', werte[1], d, 0, 150)
    blut('HDL', werte[2], d, 40, 100)
    blut('LDL', werte[3], d, 0, 200)
  }
  // Training: e1RM Kreuzheben 120 → 142, in den letzten vier Wochen öfter
  ;[0, 7, 14, 21].forEach((n, i) => session(mock, day('2026-03-20', n), 120 + i * 3))
  ;[0, 3, 7, 10, 14, 17, 21, 24].forEach((n, i) => session(mock, day('2026-09-01', n), 134 + i))
  // Einnahmen: am Anfang jeder fünfte Tag ausgelassen, zuletzt alles bestätigt
  const item = mock.insert('stack_items', { user_id: TEST_USER.id, display_name: 'Vitamin D', category: 'supplement', archived: false })
  for (let n = 0; n <= 197; n++) {
    const d = day(START, n)
    mock.insert('dose_logs', { user_id: TEST_USER.id, stack_item_id: item.id, logged_at: `${d}T08:00:00.000Z`, taken: n < 28 ? n % 5 !== 0 : true, auto_logged: false })
  }
  // Erholung: Schritte und Ruhepuls aus Apple Health
  for (let n = 0; n < 198; n++) {
    mock.insert('health_daily', {
      user_id: TEST_USER.id, day: day(START, n), steps: n < 28 ? 6000 : 9000, resting_hr: n < 28 ? 61 : 55,
      sleep_min: null, active_kcal: null, spo2_pct: null, resp_rate: null, bp_sys: null, bp_dia: null,
    })
  }
  return profil
}

