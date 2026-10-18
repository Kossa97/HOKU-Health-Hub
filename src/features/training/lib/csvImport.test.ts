import { describe, expect, it } from 'vitest'
import type { TrainingSession } from '../types'
import {
  detectDelimiter,
  detectFormat,
  parseCsv,
  parseWorkoutCsv,
  toCsv,
  UNKNOWN_EXERCISE_PREFIX,
} from './csvImport'

// Die Tests laufen mit TZ=Europe/Berlin (vitest.config.ts). Mitte Oktober 2026
// gilt Sommerzeit (UTC+2), 18:02 lokal ist also 16:02Z.

const CATALOG: Record<string, string> = {
  'bench press (barbell)': 'bench_press_barbell',
  'incline bench press (dumbbell)': 'incline_bench_press_dumbbell',
  'pull up': 'pull_up',
  'pull up (weighted)': 'pull_up',
  'triceps pushdown': 'triceps_pushdown_cable',
  'plank': 'plank',
  'squat (barbell)': 'squat_barbell',
  'running': 'run',
  'treadmill': 'run',
  'deadlift (barbell)': 'deadlift_barbell',
  'rowing machine': 'row_erg',
}
const resolveExercise = (name: string) => CATALOG[name.trim().toLowerCase()] ?? null
const NAMES: Record<string, string> = {
  bench_press_barbell: 'Bench Press (Barbell)',
  incline_bench_press_dumbbell: 'Incline Bench Press (Dumbbell)',
  pull_up: 'Pull Up',
  triceps_pushdown_cable: 'Triceps Pushdown',
  plank: 'Plank',
  squat_barbell: 'Squat (Barbell)',
  run: 'Running',
  deadlift_barbell: 'Deadlift (Barbell)',
  row_erg: 'Rowing Machine',
}
const nameOf = (id: string) =>
  id.startsWith(UNKNOWN_EXERCISE_PREFIX) ? id.slice(UNKNOWN_EXERCISE_PREFIX.length) : NAMES[id] ?? id

/** Realistischer Hevy-Export (kg) mit BOM und CRLF. */
const HEVY_KG = '﻿' + [
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
  '"Push Day, schwer","15 Oct 2026, 18:02","15 Oct 2026, 19:10","Gut geschlafen.',
  'Schulter etwas steif.",Bench Press (Barbell),,"Griff eng, Pause unten",0,warmup,40,10,,,',
  '"Push Day, schwer","15 Oct 2026, 18:02","15 Oct 2026, 19:10","Gut geschlafen.',
  'Schulter etwas steif.",Bench Press (Barbell),,"Griff eng, Pause unten",1,normal,80,8,,,8',
  '"Push Day, schwer","15 Oct 2026, 18:02","15 Oct 2026, 19:10","Gut geschlafen.',
  'Schulter etwas steif.",Bench Press (Barbell),,"Griff eng, Pause unten",2,normal,82.5,6,,,9.5',
  '"Push Day, schwer","15 Oct 2026, 18:02","15 Oct 2026, 19:10","Gut geschlafen.',
  'Schulter etwas steif.",Bench Press (Barbell),,"Griff eng, Pause unten",3,dropset,60,10,,,',
  '"Push Day, schwer","15 Oct 2026, 18:02","15 Oct 2026, 19:10","Gut geschlafen.',
  'Schulter etwas steif.",Incline Bench Press (Dumbbell),0,,0,normal,26,10,,,',
  '"Push Day, schwer","15 Oct 2026, 18:02","15 Oct 2026, 19:10","Gut geschlafen.',
  'Schulter etwas steif.",Triceps Pushdown,0,,0,failure,25,12,,,10',
  '"Push Day, schwer","15 Oct 2026, 18:02","15 Oct 2026, 19:10","Gut geschlafen.',
  'Schulter etwas steif.",Pull Up,,,0,normal,,12,,,',
  '"Push Day, schwer","15 Oct 2026, 18:02","15 Oct 2026, 19:10","Gut geschlafen.',
  'Schulter etwas steif.",Plank,,,0,normal,,,,60,',
  '"Push Day, schwer","15 Oct 2026, 18:02","15 Oct 2026, 19:10","Gut geschlafen.',
  'Schulter etwas steif.","Landmine Press, einarmig",,,0,normal,20,10,,,',
  'Lauf am Kanal,"16 Oct 2026, 07:15","16 Oct 2026, 07:48",,Running,,,0,normal,,,5.02,1980,',
  '',
].join('\r\n')

/** Hevy mit lb/Meilen (US-Konto); hier ohne BOM, nur LF. */
const HEVY_LBS = [
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe',
  'Leg Day,"3 Oct 2026, 09:00","3 Oct 2026, 10:01",,Squat (Barbell),,,0,warmup,135,5,,,',
  'Leg Day,"3 Oct 2026, 09:00","3 Oct 2026, 10:01",,Squat (Barbell),,,1,normal,225,5,,,8',
  'Leg Day,"3 Oct 2026, 09:00","3 Oct 2026, 10:01",,Treadmill,,,0,normal,,,1.5,900,',
].join('\n')

/** Strong mit Semikolon, Dezimalkomma, W/D/F, Rest Timer und Notiz mit Zeilenumbruch. */
const STRONG_SEMICOLON = [
  'Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE',
  '2026-10-12 17:30:12;Oberkörper A;1h 5m;Bench Press (Barbell);W;40;10;0;0;;"Kurz, aber gut.";',
  '2026-10-12 17:30:12;Oberkörper A;1h 5m;Bench Press (Barbell);Rest Timer;0;0;0;120;;"Kurz, aber gut.";',
  '2026-10-12 17:30:12;Oberkörper A;1h 5m;Bench Press (Barbell);1;82,5;5;0;0;"Ellbogen;',
  'nicht ganz durch";"Kurz, aber gut.";8',
  '2026-10-12 17:30:12;Oberkörper A;1h 5m;Bench Press (Barbell);2;82,5;5;0;0;;"Kurz, aber gut.";8,5',
  '2026-10-12 17:30:12;Oberkörper A;1h 5m;Bench Press (Barbell);D;60;8;0;0;;"Kurz, aber gut.";',
  '2026-10-12 17:30:12;Oberkörper A;1h 5m;Pull Up;1;0;10;0;0;;"Kurz, aber gut.";',
  '2026-10-12 17:30:12;Oberkörper A;1h 5m;Pull Up;F;0;7;0;0;;"Kurz, aber gut.";',
  '2026-10-12 17:30:12;Oberkörper A;1h 5m;Face Pull, Seil;1;15;15;0;0;;"Kurz, aber gut.";',
  '2026-10-14 06:45:00;Rudern;25m;Rowing Machine;1;0;0;5000;1500;;;',
].join('\r\n')

/** Strong mit Komma (Standard in den USA), Gewicht in lbs, leere Felder. */
const STRONG_COMMA_LBS = [
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
  '2026-09-30 18:00:00,Evening Workout,48m,Deadlift (Barbell),1,315,5,,,,,',
  '2026-09-30 18:00:00,Evening Workout,48m,Deadlift (Barbell),2,315,5,,,,,',
].join('\n')

/** Neueres Strong-Layout: alle Felder in Anfuehrungszeichen, Einheiten im Spaltennamen. */
const STRONG_NEW_LAYOUT = [
  '"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"',
  '"1";"2026-04-29 12:00:00";"Chest and Triceps";"600";"Bench Press (Barbell)";"1";"100.0";"10";"";"";"";"";""',
  '"1";"2026-04-29 12:00:00";"Chest and Triceps";"600";"Bench Press (Barbell)";"2";"100.0";"10";"";"";"";"";""',
].join('\n')

describe('parseCsv', () => {
  it('versteht Anfuehrungszeichen, verdoppelte Quotes, Zeilenumbrueche und CRLF', () => {
    const recs = parseCsv('a,b,c\r\n"x, y","sagt ""hi""","zwei\r\nZeilen"\r\n\r\n1,,3\r\n')
    expect(recs.map((r) => r.fields)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'sagt "hi"', 'zwei\nZeilen'],
      ['1', '', '3'],
    ])
    expect(recs.map((r) => r.line)).toEqual([1, 2, 5])
  })

  it('entfernt BOM, versteht reines CR und letzte Zeile ohne Umbruch', () => {
    expect(parseCsv('﻿a;b\r1;2').map((r) => r.fields)).toEqual([['a', 'b'], ['1', '2']])
  })

  it('behaelt leere Felder am Zeilenende', () => {
    expect(parseCsv('a,b,c\n1,,\n').map((r) => r.fields)).toEqual([['a', 'b', 'c'], ['1', '', '']])
  })

  it('erkennt das Trennzeichen nur ausserhalb von Anfuehrungszeichen', () => {
    expect(detectDelimiter('"a,b,c";d;e\n1;2;3')).toBe(';')
    expect(detectDelimiter('a,b,"c;d;e;f"\n')).toBe(',')
  })
})

describe('detectFormat', () => {
  it('erkennt Hevy (kg und lb) und Strong (alle Layouts)', () => {
    expect(detectFormat(HEVY_KG)).toBe('hevy')
    expect(detectFormat(HEVY_LBS)).toBe('hevy')
    expect(detectFormat(STRONG_SEMICOLON)).toBe('strong')
    expect(detectFormat(STRONG_COMMA_LBS)).toBe('strong')
    expect(detectFormat(STRONG_NEW_LAYOUT)).toBe('strong')
  })

  it('liefert null fuer fremde oder leere Dateien', () => {
    expect(detectFormat('Datum,Gewicht\n2026-10-01,80')).toBeNull()
    expect(detectFormat('')).toBeNull()
  })
})

describe('parseWorkoutCsv – Hevy', () => {
  const result = parseWorkoutCsv(HEVY_KG, { resolveExercise })

  it('liest beide Einheiten ohne Fehler', () => {
    expect(result.errors).toEqual([])
    expect(result.sessions).toHaveLength(2)
  })

  it('setzt Kopfdaten, Notiz mit Zeilenumbruch und Dauer', () => {
    const [push] = result.sessions
    expect(push).toMatchObject({
      kind: 'strength',
      title: 'Push Day, schwer',
      startedAt: '2026-10-15T16:02:00.000Z',
      endedAt: '2026-10-15T17:10:00.000Z',
      durationS: 68 * 60,
      notes: 'Gut geschlafen.\nSchulter etwas steif.',
      source: 'import_hevy',
      externalId: 'hevy:2026-10-15T18:02:00|Push Day, schwer',
      routineId: null,
      kcal: null,
    })
  })

  it('uebernimmt Satztypen, Gewichte, RPE, Supersatz und Uebungsnotiz', () => {
    const [push] = result.sessions
    const bench = push.exercises[0]
    expect(bench.exerciseId).toBe('bench_press_barbell')
    expect(bench.notes).toBe('Griff eng, Pause unten')
    expect(bench.supersetGroup).toBeNull()
    expect(bench.sets.map((s) => s.type)).toEqual(['warmup', 'normal', 'normal', 'drop'])
    expect(bench.sets[2]).toEqual({
      type: 'normal', weightKg: 82.5, reps: 6, durationS: null, distanceM: null, rpe: 9.5, done: true,
    })
    expect(push.exercises[1]).toMatchObject({ exerciseId: 'incline_bench_press_dumbbell', supersetGroup: 0 })
    expect(push.exercises[2]).toMatchObject({ exerciseId: 'triceps_pushdown_cable', supersetGroup: 0 })
    expect(push.exercises[2].sets[0].type).toBe('failure')
  })

  it('laesst leere Felder leer (Klimmzug ohne Gewicht, Plank nur Zeit)', () => {
    const [push] = result.sessions
    expect(push.exercises[3].sets[0]).toMatchObject({ weightKg: null, reps: 12 })
    expect(push.exercises[4].sets[0]).toMatchObject({ weightKg: null, reps: null, durationS: 60 })
  })

  it('markiert unbekannte Uebungen (auch mit Komma im Namen)', () => {
    expect(result.unknownExercises).toEqual(['Landmine Press, einarmig'])
    expect(result.sessions[0].exercises[5].exerciseId).toBe('unknown:Landmine Press, einarmig')
  })

  it('macht aus einer reinen Cardio-Einheit kind "other" mit Strecke', () => {
    const run = result.sessions[1]
    expect(run).toMatchObject({ kind: 'other', title: 'Lauf am Kanal', distanceM: 5020, durationS: 33 * 60 })
    expect(run.exercises[0].sets[0]).toMatchObject({ distanceM: 5020, durationS: 1980 })
  })

  it('rechnet lb und Meilen in kg und Meter um', () => {
    const r = parseWorkoutCsv(HEVY_LBS, { resolveExercise })
    expect(r.errors).toEqual([])
    const [leg] = r.sessions
    expect(leg.kind).toBe('strength')
    expect(leg.exercises[0].sets.map((s) => s.weightKg)).toEqual([61.235, 102.058])
    expect(leg.exercises[0].sets[0].type).toBe('warmup')
    expect(leg.exercises[1].sets[0].distanceM).toBe(2414.02)
  })

  it('erzeugt dieselbe externalId bei wiederholtem Import', () => {
    const again = parseWorkoutCsv(HEVY_KG, { resolveExercise })
    expect(again.sessions.map((s) => s.externalId)).toEqual(result.sessions.map((s) => s.externalId))
    expect(new Set(result.sessions.map((s) => s.externalId)).size).toBe(2)
  })

  it('trennt dieselbe Uebung zweimal in einer Einheit an set_index', () => {
    const csv = [
      'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
      'A,"1 Oct 2026, 10:00","1 Oct 2026, 11:00",,Bench Press (Barbell),,,0,normal,60,10,,,',
      'A,"1 Oct 2026, 10:00","1 Oct 2026, 11:00",,Bench Press (Barbell),,,1,normal,60,10,,,',
      'A,"1 Oct 2026, 10:00","1 Oct 2026, 11:00",,Bench Press (Barbell),,,0,normal,50,12,,,',
    ].join('\n')
    const [s] = parseWorkoutCsv(csv, { resolveExercise }).sessions
    expect(s.exercises.map((e) => e.sets.length)).toEqual([2, 1])
  })

  it('meldet unlesbare Zeilen mit Zeilennummer und liest den Rest', () => {
    const csv = [
      'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
      'A,gestern,,,Bench Press (Barbell),,,0,normal,60,10,,,',
      'A,"1 Oct 2026, 10:00","1 Oct 2026, 11:00",,Bench Press (Barbell),,,0,normal,sechzig,10,,,',
    ].join('\n')
    const r = parseWorkoutCsv(csv, { resolveExercise })
    expect(r.errors).toHaveLength(2)
    expect(r.errors[0]).toMatch(/^Zeile 2:/)
    expect(r.errors[1]).toMatch(/^Zeile 3:.*sechzig/)
    expect(r.sessions).toHaveLength(1)
    expect(r.sessions[0].exercises[0].sets[0]).toMatchObject({ weightKg: null, reps: 10 })
  })
})

describe('parseWorkoutCsv – Strong', () => {
  it('liest Semikolon-Export mit Dezimalkomma, W/D/F und Rest Timer', () => {
    const r = parseWorkoutCsv(STRONG_SEMICOLON, { resolveExercise })
    expect(r.errors).toEqual([])
    expect(r.sessions).toHaveLength(2)
    const [upper, row] = r.sessions
    expect(upper).toMatchObject({
      kind: 'strength',
      title: 'Oberkörper A',
      startedAt: '2026-10-12T15:30:12.000Z',
      durationS: 65 * 60,
      endedAt: '2026-10-12T16:35:12.000Z',
      notes: 'Kurz, aber gut.',
      source: 'import_strong',
      externalId: 'strong:2026-10-12T17:30:12|Oberkörper A',
    })
    const bench = upper.exercises[0]
    expect(bench.restS).toBe(120)
    expect(bench.notes).toBe('Ellbogen;\nnicht ganz durch')
    expect(bench.sets.map((s) => [s.type, s.weightKg, s.reps, s.rpe])).toEqual([
      ['warmup', 40, 10, null],
      ['normal', 82.5, 5, 8],
      ['normal', 82.5, 5, 8.5],
      ['drop', 60, 8, null],
    ])
    // Strong schreibt 0 fuer leere Felder.
    expect(bench.sets[0]).toMatchObject({ distanceM: null, durationS: null })
    const pullUp = upper.exercises[1]
    expect(pullUp.sets.map((s) => [s.type, s.weightKg, s.reps])).toEqual([
      ['normal', null, 10],
      ['failure', null, 7],
    ])
    expect(upper.exercises[2].exerciseId).toBe('unknown:Face Pull, Seil')
    expect(r.unknownExercises).toEqual(['Face Pull, Seil'])

    expect(row).toMatchObject({ kind: 'other', durationS: 25 * 60, distanceM: 5000 })
    expect(row.exercises[0].sets[0]).toMatchObject({ distanceM: 5000, durationS: 1500, weightKg: null, reps: null })
  })

  it('rechnet mit weightUnit "lb" in kg um, Standard ist kg', () => {
    const lb = parseWorkoutCsv(STRONG_COMMA_LBS, { resolveExercise, weightUnit: 'lb' })
    expect(lb.errors).toEqual([])
    expect(lb.sessions[0].exercises[0].sets.map((s) => s.weightKg)).toEqual([142.882, 142.882])
    expect(lb.sessions[0].durationS).toBe(48 * 60)
    const kg = parseWorkoutCsv(STRONG_COMMA_LBS, { resolveExercise })
    expect(kg.sessions[0].exercises[0].sets[0].weightKg).toBe(315)
  })

  it('versteht das neuere Layout mit Einheiten im Spaltennamen', () => {
    const r = parseWorkoutCsv(STRONG_NEW_LAYOUT, { resolveExercise, weightUnit: 'lb' })
    expect(r.errors).toEqual([])
    const [s] = r.sessions
    expect(s.durationS).toBe(600)
    // `Weight (kg)` gilt auch, wenn die Option etwas anderes sagt.
    expect(s.exercises[0].sets.map((x) => x.weightKg)).toEqual([100, 100])
  })

  it('beachtet eine Spalte "Weight Unit" je Zeile', () => {
    const csv = [
      'Date,Workout Name,Exercise Name,Set Order,Weight,Weight Unit,Reps,RPE,Distance,Distance Unit,Seconds,Notes,Workout Notes,Workout Duration',
      '2026-10-01 08:00:00,Mix,Squat (Barbell),1,100,lbs,5,,,,,,,30m',
      '2026-10-01 08:00:00,Mix,Running,1,,,,,2,km,600,,,30m',
    ].join('\n')
    const r = parseWorkoutCsv(csv, { resolveExercise, weightUnit: 'kg' })
    expect(r.errors).toEqual([])
    expect(r.sessions[0].exercises[0].sets[0].weightKg).toBe(45.359)
    expect(r.sessions[0].exercises[1].sets[0].distanceM).toBe(2000)
    expect(r.sessions[0].durationS).toBe(1800)
  })
})

describe('parseWorkoutCsv – Fehlerfaelle', () => {
  it('lehnt fremde Formate ab', () => {
    const r = parseWorkoutCsv('Datum;Gewicht\n2026-10-01;80', { resolveExercise })
    expect(r.sessions).toEqual([])
    expect(r.errors).toHaveLength(1)
  })

  it('meldet eine leere Datei', () => {
    expect(parseWorkoutCsv('﻿\r\n', { resolveExercise }).errors).toHaveLength(1)
  })
})

describe('toCsv', () => {
  it('schreibt das Hevy-Format mit Quoting', () => {
    const { sessions } = parseWorkoutCsv(HEVY_KG, { resolveExercise })
    const csv = toCsv(sessions, nameOf)
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
    )
    expect(lines[1]).toBe(
      '"Push Day, schwer","15 Oct 2026, 18:02","15 Oct 2026, 19:10","Gut geschlafen.',
    )
    expect(csv).toContain('Bench Press (Barbell),,"Griff eng, Pause unten",3,dropset,60,10,,,')
    expect(csv).toContain('Lauf am Kanal,"16 Oct 2026, 07:15","16 Oct 2026, 07:48",,Running,,,0,normal,,,5.02,1980,')
    expect(detectFormat(csv)).toBe('hevy')
  })

  it('Rundreise: Import → Export → Import ergibt dieselben Einheiten', () => {
    for (const source of [HEVY_KG, HEVY_LBS]) {
      const first = parseWorkoutCsv(source, { resolveExercise })
      const second = parseWorkoutCsv(toCsv(first.sessions, nameOf), { resolveExercise })
      expect(second.errors).toEqual([])
      expect(second.unknownExercises).toEqual(first.unknownExercises)
      expect(second.sessions).toEqual(first.sessions)
    }
  })

  it('Rundreise aus Strong: Saetze, Notizen und Dauer bleiben erhalten', () => {
    const first = parseWorkoutCsv(STRONG_SEMICOLON, { resolveExercise })
    const second = parseWorkoutCsv(toCsv(first.sessions, nameOf), { resolveExercise })
    expect(second.errors).toEqual([])
    const strip = (s: (typeof first.sessions)[number]) => ({
      ...s,
      // Hevy kennt keine Pause und kuerzt auf Minuten; Quelle wechselt auf Hevy.
      startedAt: s.startedAt.slice(0, 16),
      endedAt: s.endedAt?.slice(0, 16),
      durationS: null,
      source: null,
      externalId: null,
      exercises: s.exercises.map((e) => ({ ...e, restS: null })),
    })
    expect(second.sessions.map(strip)).toEqual(first.sessions.map(strip))
  })

  it('Rundreise eigener Einheiten: Lauf ohne Uebungen und Uebung ohne Satz', () => {
    const own: TrainingSession[] = [
      {
        id: 'a',
        kind: 'strength',
        title: 'Ganzkörper "leicht"',
        startedAt: '2026-10-17T08:00:00.000Z',
        endedAt: '2026-10-17T09:00:00.000Z',
        durationS: 3600,
        distanceM: null,
        kcal: null,
        avgHr: null,
        rpe: null,
        notes: null,
        routineId: null,
        source: 'manual',
        externalId: null,
        exercises: [
          { exerciseId: 'squat_barbell', supersetGroup: null, restS: null, notes: null, sets: [
            { type: 'normal', weightKg: 61.235, reps: 5, durationS: null, distanceM: null, rpe: 7, done: true },
          ] },
          { exerciseId: 'custom:1234', supersetGroup: 1, restS: null, notes: ' Platz , frei ', sets: [] },
        ],
      },
      {
        id: 'b',
        kind: 'run',
        title: 'Morgenlauf',
        startedAt: '2026-10-18T05:30:00.000Z',
        endedAt: null,
        durationS: 1800,
        distanceM: 5432.1,
        kcal: 320,
        avgHr: 150,
        rpe: 6,
        notes: null,
        routineId: null,
        source: 'healthkit',
        externalId: 'hk-1',
        exercises: [],
      },
    ]
    const names = (id: string) => (id === 'custom:1234' ? 'Mein Ding' : nameOf(id))
    const back = parseWorkoutCsv(toCsv(own, names), { resolveExercise })
    expect(back.errors).toEqual([])
    expect(back.unknownExercises).toEqual(['Mein Ding'])
    const [gym, run] = back.sessions
    expect(gym.title).toBe('Ganzkörper "leicht"')
    expect(gym.exercises[0].sets[0]).toEqual(own[0].exercises[0].sets[0])
    expect(gym.exercises[1]).toMatchObject({ exerciseId: 'unknown:Mein Ding', supersetGroup: 1, notes: 'Platz , frei', sets: [] })
    expect(run).toMatchObject({
      kind: 'other',
      startedAt: '2026-10-18T05:30:00.000Z',
      endedAt: '2026-10-18T06:00:00.000Z',
      durationS: 1800,
      distanceM: 5432.1,
      exercises: [],
    })
  })
})
