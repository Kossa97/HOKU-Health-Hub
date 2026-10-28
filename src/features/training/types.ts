/**
 * Der Vertrag des Workout-Trackers.
 *
 * Eine Einheit (`TrainingSession`) ist fuer JEDE Art von Training dieselbe:
 * Krafttraining hat Uebungen mit Saetzen, ein Lauf hat Dauer und Strecke, ein
 * Hyrox-Training hat beides. So liegen Kraft und Ausdauer in einem Verlauf —
 * genau das, was Hevy (nur Kraft) und Strava (nur Ausdauer) getrennt halten.
 *
 * Die Saetze stecken als JSON in der Einheit und nicht in einer eigenen
 * Tabelle: eine Einheit wird als Ganzes gespeichert (ein Schreibvorgang, nie
 * halb), und ausgewertet wird ohnehin in der App.
 */

/** Art der Einheit. Bestimmt Symbol, Farbe und den Kalorien-Schaetzwert. */
export type SessionKind =
  | 'strength'
  | 'run'
  | 'cycle'
  | 'swim'
  | 'row'
  | 'walk'
  | 'hike'
  | 'hiit'
  | 'hyrox'
  | 'yoga'
  | 'mobility'
  | 'sport'
  | 'other'

export const SESSION_KINDS: readonly SessionKind[] = [
  'strength', 'run', 'cycle', 'swim', 'row', 'walk', 'hike',
  'hiit', 'hyrox', 'yoga', 'mobility', 'sport', 'other',
] as const

/** Woher eine Einheit stammt. Importierte werden ueber `externalId` nicht doppelt angelegt. */
export type SessionSource =
  | 'manual'
  | 'live'
  | 'healthkit'
  | 'health_connect'
  | 'import_hevy'
  | 'import_strong'

/**
 * Was bei einer Uebung erfasst wird. Danach richten sich die Spalten im
 * Logger und welche Auswertung (e1RM, Pace, Zeit) Sinn ergibt.
 */
export type TrackingMode =
  | 'weight_reps'       // Bankdruecken: kg × Wdh.
  | 'bodyweight_reps'   // Klimmzug: Wdh., optional Zusatzgewicht
  | 'assisted_reps'     // Klimmzug mit Unterstuetzung: kg Hilfe × Wdh.
  | 'reps'              // Burpees: nur Wdh.
  | 'duration'          // Plank: Zeit
  | 'weight_duration'   // Farmer's Walk auf Zeit
  | 'distance_duration' // Rudern 1000 m, Lauf 1 km
  | 'weight_distance'   // Schlittenschieben 50 m mit kg

export type Equipment =
  | 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable'
  | 'bodyweight' | 'band' | 'smith' | 'ez_bar' | 'trap_bar'
  | 'cardio_machine' | 'sled' | 'medicine_ball' | 'other'

export type MuscleGroup =
  | 'chest' | 'upper_back' | 'lats' | 'lower_back' | 'traps'
  | 'front_delts' | 'side_delts' | 'rear_delts'
  | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'abductors' | 'calves'
  | 'cardio' | 'full_body'

export type ExerciseCategory =
  | 'strength' | 'cardio' | 'hyrox' | 'mobility' | 'plyometric'

/** Eine Uebung aus dem mitgelieferten Katalog (Code, nicht Datenbank). */
export interface CatalogExercise {
  /** Stabile Kennung, z. B. `bench_press_barbell`. Nie umbenennen: Saetze verweisen darauf. */
  id: string
  name: { de: string; en: string }
  /** Weitere Namen fuer Suche und CSV-Import (Hevy/Strong-Schreibweisen). */
  aliases?: string[]
  category: ExerciseCategory
  equipment: Equipment
  tracking: TrackingMode
  primary: MuscleGroup[]
  secondary: MuscleGroup[]
}

/** Eigene Uebung des Nutzers. Kennung im Satz: `custom:<uuid>`. */
export interface CustomExercise {
  id: string
  name: string
  category: ExerciseCategory
  equipment: Equipment
  tracking: TrackingMode
  primary: MuscleGroup[]
  secondary: MuscleGroup[]
}

export type SetType = 'warmup' | 'normal' | 'drop' | 'failure'

export interface TrainingSet {
  type: SetType
  weightKg?: number | null
  reps?: number | null
  durationS?: number | null
  distanceM?: number | null
  /** Wie schwer: RPE 6–10 in halben Schritten. */
  rpe?: number | null
  done: boolean
  /**
   * Nur im laufenden Training: der Nutzer hat Gewicht/Wdh. selbst getippt.
   * Ein Vorschlag ueberschreibt solche Saetze nie. Wird beim Speichern entfernt.
   */
  touched?: boolean
}

export interface SessionExercise {
  /** Katalog-Kennung oder `custom:<uuid>`. */
  exerciseId: string
  /** Gleiche Zahl = Supersatz. null = allein. */
  supersetGroup?: number | null
  /** Pause nach jedem Satz in Sekunden; null = Standard aus den Einstellungen. */
  restS?: number | null
  notes?: string | null
  sets: TrainingSet[]
}

export interface TrainingSession {
  id: string
  kind: SessionKind
  title: string
  startedAt: string
  endedAt: string | null
  durationS: number | null
  distanceM: number | null
  /** Verbrauch laut Uhr oder eigener Angabe. Fehlt er, schaetzt die App (MET). */
  kcal: number | null
  avgHr: number | null
  /** Gefuehlte Anstrengung der ganzen Einheit, 1–10. */
  rpe: number | null
  notes: string | null
  routineId: string | null
  exercises: SessionExercise[]
  source: SessionSource
  externalId: string | null
}

/** Vorlage fuer eine Einheit (Hevy: Routine, fin: Trainingsplan). */
export interface RoutineExercise {
  exerciseId: string
  supersetGroup?: number | null
  restS?: number | null
  notes?: string | null
  /** Vorgabe je Satz; Gewicht/Wdh. sind Startwerte, der Logger nimmt sonst die vom letzten Mal. */
  sets: RoutineSet[]
}

/**
 * Ein Satz in der Vorlage. `repsMin`/`repsMax` ist der Wdh.-Bereich der
 * Doppelprogression (z. B. 8–12), `rpe` die Zielanstrengung; `reps` bleibt
 * als einfacher Startwert aus v1 erhalten.
 */
export type RoutineSet = Pick<TrainingSet, 'type' | 'weightKg' | 'reps' | 'durationS' | 'distanceM'> & {
  repsMin?: number | null
  repsMax?: number | null
  rpe?: number | null
}

export interface TrainingRoutine {
  id: string
  name: string
  kind: SessionKind
  exercises: RoutineExercise[]
  /** Wochentage, an denen die Routine geplant ist: 1 = Montag … 7 = Sonntag. */
  weekdays: number[]
  sortOrder: number
  /** Ordner = Plan (z. B. „Push/Pull/Beine"), max. 40 Zeichen; null = ohne Plan. */
  folder: string | null
}

export const ROUTINE_FOLDER_MAX = 40

export type WeightUnit = 'kg' | 'lb'

export interface TrainingSettings {
  unit: WeightUnit
  /** Standardpause in Sekunden. */
  defaultRestS: number
  /** Ziel: Einheiten pro Woche. */
  weeklyGoal: number
  /** Gewicht der Langhantelstange in kg (Scheibenrechner). */
  barKg: number
  /** Verfuegbare Scheiben in kg (je Seite, absteigend). */
  platesKg: number[]
  /** Workouts aus Apple Health / Health Connect uebernehmen. */
  healthImport: boolean
  /** GLP-1-Ansicht: null = automatisch (wenn ein GLP-1-Wirkstoff im Stack ist). */
  glp1Mode: boolean | null
  /**
   * Kennungen geloeschter Uhr-Workouts. Ohne sie holte der naechste Abgleich
   * ein bewusst geloeschtes Workout zurueck. Nur die letzten 100 — der
   * Abgleich schaut ohnehin nur 30 Tage zurueck.
   */
  dismissedExternalIds: string[]
  /** Ton (und Vibration) am Ende der Pause. */
  restSound: boolean
  /** Systembenachrichtigung am Ende der Pause, wenn die App im Hintergrund ist. */
  restNotify: boolean
}

export const DEFAULT_TRAINING_SETTINGS: TrainingSettings = {
  unit: 'kg',
  defaultRestS: 90,
  weeklyGoal: 3,
  barKg: 20,
  platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  healthImport: false,
  glp1Mode: null,
  dismissedExternalIds: [],
  restSound: true,
  restNotify: true,
}
