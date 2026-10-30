import type { RoutineExercise, RoutineSet, TrainingRoutine } from '../types'

/**
 * Vorlagen fuer Trainingsplaene: ein Tipp legt einen Ordner (Plan) mit seinen
 * Routinen an, danach ist alles normal editierbar. Nur Uebungen aus dem
 * Katalog (`data/exercises.ts`), geprueft in `plans.test.ts`.
 *
 * Satzschema: Grunduebungen 3 × 6–10 mit 90 s Pause, Isolationsuebungen
 * 3 × 10–15 mit 60 s. Gewichte stehen keine drin — die kommen vom Nutzer
 * bzw. ab der zweiten Einheit vom Vorschlag.
 *
 * Hyrox hat eine eigene Vorlage (`data/hyrox.ts`), weil sie Gewichte je
 * Division braucht.
 */

export interface PlanDay {
  name: { de: string; en: string }
  /** 1 = Montag … 7 = Sonntag. */
  weekdays: number[]
  exercises: RoutineExercise[]
}

export interface TrainingPlan {
  id: 'fullbody_3' | 'upper_lower_4' | 'ppl_6'
  name: { de: string; en: string }
  days: PlanDay[]
}

const sets = (count: number, repsMin: number, repsMax: number): RoutineSet[] =>
  Array.from({ length: count }, () => ({ type: 'normal', repsMin, repsMax }))

/** Grunduebung: 3 × 6–10, 90 s Pause. */
const compound = (exerciseId: string): RoutineExercise => ({ exerciseId, restS: 90, sets: sets(3, 6, 10) })

/** Isolationsuebung: 3 × 10–15, 60 s Pause. */
const accessory = (exerciseId: string): RoutineExercise => ({ exerciseId, restS: 60, sets: sets(3, 10, 15) })

export const TRAINING_PLANS: readonly TrainingPlan[] = [
  {
    id: 'fullbody_3',
    name: { de: 'Ganzkörper 3×', en: 'Full Body 3×' },
    days: [
      {
        name: { de: 'Ganzkörper A', en: 'Full Body A' },
        weekdays: [1],
        exercises: [
          compound('squat_barbell'),
          compound('bench_press_barbell'),
          compound('bent_over_row_barbell'),
          accessory('lateral_raise_dumbbell'),
          accessory('bicep_curl_dumbbell'),
          accessory('triceps_pushdown'),
        ],
      },
      {
        name: { de: 'Ganzkörper B', en: 'Full Body B' },
        weekdays: [3],
        exercises: [
          compound('deadlift_barbell'),
          compound('overhead_press_barbell'),
          compound('lat_pulldown_cable'),
          accessory('lying_leg_curl_machine'),
          accessory('face_pull'),
          accessory('cable_crunch'),
        ],
      },
      {
        name: { de: 'Ganzkörper C', en: 'Full Body C' },
        weekdays: [5],
        exercises: [
          compound('leg_press_machine'),
          compound('incline_bench_press_dumbbell'),
          compound('seated_cable_row'),
          accessory('romanian_deadlift_dumbbell'),
          accessory('lateral_raise_cable'),
          accessory('hammer_curl_dumbbell'),
        ],
      },
    ],
  },
  {
    id: 'upper_lower_4',
    name: { de: 'Ober-/Unterkörper 4×', en: 'Upper/Lower 4×' },
    days: [
      {
        name: { de: 'Oberkörper A', en: 'Upper A' },
        weekdays: [1],
        exercises: [
          compound('bench_press_barbell'),
          compound('bent_over_row_barbell'),
          compound('overhead_press_dumbbell'),
          compound('lat_pulldown_cable'),
          accessory('lateral_raise_dumbbell'),
          accessory('triceps_pushdown'),
          accessory('bicep_curl_dumbbell'),
        ],
      },
      {
        name: { de: 'Unterkörper A', en: 'Lower A' },
        weekdays: [2],
        exercises: [
          compound('squat_barbell'),
          compound('romanian_deadlift_barbell'),
          compound('leg_press_machine'),
          accessory('lying_leg_curl_machine'),
          accessory('standing_calf_raise_machine'),
          accessory('cable_crunch'),
        ],
      },
      {
        name: { de: 'Oberkörper B', en: 'Upper B' },
        weekdays: [4],
        exercises: [
          compound('incline_bench_press_dumbbell'),
          compound('pull_up'),
          compound('seated_cable_row'),
          accessory('pec_deck'),
          accessory('face_pull'),
          accessory('skullcrusher_ez'),
          accessory('hammer_curl_dumbbell'),
        ],
      },
      {
        name: { de: 'Unterkörper B', en: 'Lower B' },
        weekdays: [5],
        exercises: [
          compound('deadlift_barbell'),
          compound('hack_squat_machine'),
          compound('bulgarian_split_squat'),
          accessory('leg_extension_machine'),
          accessory('seated_calf_raise'),
          accessory('hanging_knee_raise'),
        ],
      },
    ],
  },
  {
    id: 'ppl_6',
    name: { de: 'Push/Pull/Beine 6×', en: 'Push/Pull/Legs 6×' },
    days: [
      {
        name: { de: 'Push A', en: 'Push A' },
        weekdays: [1],
        exercises: [
          compound('bench_press_barbell'),
          compound('overhead_press_dumbbell'),
          compound('incline_bench_press_dumbbell'),
          accessory('lateral_raise_dumbbell'),
          accessory('triceps_pushdown'),
          accessory('overhead_triceps_extension_cable'),
        ],
      },
      {
        name: { de: 'Pull A', en: 'Pull A' },
        weekdays: [2],
        exercises: [
          compound('bent_over_row_barbell'),
          compound('lat_pulldown_cable'),
          compound('seated_cable_row'),
          accessory('face_pull'),
          accessory('bicep_curl_barbell'),
          accessory('hammer_curl_dumbbell'),
        ],
      },
      {
        name: { de: 'Beine A', en: 'Legs A' },
        weekdays: [3],
        exercises: [
          compound('squat_barbell'),
          compound('romanian_deadlift_barbell'),
          compound('leg_press_machine'),
          accessory('lying_leg_curl_machine'),
          accessory('standing_calf_raise_machine'),
          accessory('cable_crunch'),
        ],
      },
      {
        name: { de: 'Push B', en: 'Push B' },
        weekdays: [4],
        exercises: [
          compound('overhead_press_barbell'),
          compound('incline_bench_press_barbell'),
          compound('chest_press_machine'),
          accessory('cable_fly'),
          accessory('lateral_raise_cable'),
          accessory('skullcrusher_ez'),
        ],
      },
      {
        name: { de: 'Pull B', en: 'Pull B' },
        weekdays: [5],
        exercises: [
          compound('pull_up'),
          compound('t_bar_row'),
          compound('lat_pulldown_close_grip'),
          accessory('reverse_fly_machine'),
          accessory('preacher_curl_ez'),
          accessory('bicep_curl_cable'),
        ],
      },
      {
        name: { de: 'Beine B', en: 'Legs B' },
        weekdays: [6],
        exercises: [
          compound('deadlift_barbell'),
          compound('hack_squat_machine'),
          compound('bulgarian_split_squat'),
          accessory('leg_extension_machine'),
          accessory('seated_leg_curl_machine'),
          accessory('seated_calf_raise'),
        ],
      },
    ],
  },
]

/**
 * Die Routinen eines Plans, bereit zum Speichern. Der Ordner heisst wie der
 * Plan; `sortOrder` zaehlt ab `firstSortOrder` weiter, damit die neuen
 * Routinen hinter den bestehenden landen.
 */
export function createPlanRoutines(plan: TrainingPlan, lang: 'de' | 'en', firstSortOrder = 0): Array<Omit<TrainingRoutine, 'id'>> {
  return plan.days.map((day, i) => ({
    name: day.name[lang],
    kind: 'strength',
    exercises: structuredClone(day.exercises),
    weekdays: [...day.weekdays],
    sortOrder: firstSortOrder + i,
    folder: plan.name[lang],
  }))
}
