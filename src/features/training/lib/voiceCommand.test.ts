import { describe, expect, it } from 'vitest'
import type { SessionExercise, TrainingSet } from '../types'
import { lastDoneBefore, normalizeSpoken, parseCommand, planSet, voiceTarget, type VoiceCommand } from './voiceCommand'

const open: TrainingSet = { type: 'normal', done: false }
const setCmd = (raw: string) => {
  const c = parseCommand(raw)
  if (c?.kind !== 'set') throw new Error(`kein Satz: ${raw} → ${JSON.stringify(c)}`)
  return c as Extract<VoiceCommand, { kind: 'set' }>
}
const plan = (raw: string, tracking: Parameters<typeof planSet>[1] = 'weight_reps', current = open, unit: 'kg' | 'lb' = 'kg') =>
  planSet(setCmd(raw), tracking, current, unit)

describe('normalizeSpoken', () => {
  it('Dezimalkomma, Zahlwörter, Einheiten', () => {
    expect(normalizeSpoken('82,5 kg × 6')).toBe('82.5 kg x 6')
    expect(normalizeSpoken('Achtzig Kilo, acht Wiederholungen.')).toBe('80 kilo 8 wiederholungen')
    expect(normalizeSpoken('zweiundzwanzig')).toBe('22')
    expect(normalizeSpoken('twenty two reps')).toBe('22 reps')
    expect(normalizeSpoken('80kg')).toBe('80 kg')
    expect(normalizeSpoken('82 Komma 5')).toBe('82.5')
  })
})

describe('parseCommand: Sätze', () => {
  it.each([
    ['80 Kilo, 8 Wiederholungen', { weightKg: 80, reps: 8 }],
    ['80 kg 8', { weightKg: 80, reps: 8 }],
    ['82,5 mal 6', { weightKg: 82.5, reps: 6 }],
    ['82.5 x 6', { weightKg: 82.5, reps: 6 }],
    ['achtzig kilo acht', { weightKg: 80, reps: 8 }],
    ['100 by 5', { weightKg: 100, reps: 5 }],
    ['60 kilos for 10 reps', { weightKg: 60, reps: 10 }],
    ['12 Wiederholungen', { reps: 12 }],
  ])('%s', (raw, patch) => {
    expect(plan(raw)).toEqual({ ok: true, patch })
  })

  it('Gewicht ohne Einheit gilt in der eingestellten Einheit', () => {
    const r = plan('185 x 5', 'weight_reps', open, 'lb')
    expect(r.ok && r.patch.weightKg).toBeCloseTo(185 / 2.2046226218, 2)
    const kg = plan('80 kg 5', 'weight_reps', open, 'lb')
    expect(kg.ok && kg.patch.weightKg).toBe(80)
  })

  it('eine Zahl allein: kleine Zahl = Wdh., große = Gewicht', () => {
    expect(plan('8', 'weight_reps', { ...open, weightKg: 80 })).toEqual({ ok: true, patch: { reps: 8 } })
    expect(plan('80', 'weight_reps', { ...open, reps: 8 })).toEqual({ ok: true, patch: { weightKg: 80 } })
    expect(plan('15', 'bodyweight_reps')).toEqual({ ok: true, patch: { reps: 15 } })
  })

  it('Zeit und Strecke', () => {
    expect(plan('60 Sekunden', 'duration')).toEqual({ ok: true, patch: { durationS: 60 } })
    expect(plan('1:30', 'duration')).toEqual({ ok: true, patch: { durationS: 90 } })
    expect(plan('2 Minuten', 'duration')).toEqual({ ok: true, patch: { durationS: 120 } })
    expect(plan('1000 meter 4:05', 'distance_duration')).toEqual({ ok: true, patch: { distanceM: 1000, durationS: 245 } })
    expect(plan('1 km 5 minuten', 'distance_duration')).toEqual({ ok: true, patch: { distanceM: 1000, durationS: 300 } })
    expect(plan('20 kg 45 sekunden', 'weight_duration')).toEqual({ ok: true, patch: { weightKg: 20, durationS: 45 } })
  })

  it('fehlender Hauptwert oder Unsinn: nichts eintragen', () => {
    expect(plan('80 kg', 'weight_reps')).toEqual({ ok: false, reason: 'missing' })
    expect(plan('800 kg 8')).toEqual({ ok: false, reason: 'implausible' })
    expect(plan('80 kg 8', 'duration')).toEqual({ ok: false, reason: 'missing' })
  })

  it('kein Satz', () => {
    expect(parseCommand('Kaffee bitte')).toBeNull()
    expect(parseCommand('')).toBeNull()
    expect(parseCommand('Satz 3 Kaffee 2')).toBeNull()
    expect(parseCommand('1 2 3')).toBeNull()
  })
})

describe('parseCommand: Befehle', () => {
  it.each([
    ['Gleich wie eben', { kind: 'same' }],
    ['nochmal', { kind: 'same' }],
    ['same again', { kind: 'same' }],
    ['Noch ein Satz', { kind: 'add_set' }],
    ['one more set', { kind: 'add_set' }],
    ['noch einen Satz hinzufügen', { kind: 'add_set' }],
    ['Pause', { kind: 'rest', seconds: null }],
    ['Pause 2 Minuten', { kind: 'rest', seconds: 120 }],
    ['Pause zwei Minuten', { kind: 'rest', seconds: 120 }],
    ['Pause 90 Sekunden', { kind: 'rest', seconds: 90 }],
    ['Pause 90', { kind: 'rest', seconds: 90 }],
    ['Pause eineinhalb Minuten', { kind: 'rest', seconds: 90 }],
    ['rest 3 minutes', { kind: 'rest', seconds: 180 }],
    ['Pause überspringen', { kind: 'skip_rest' }],
    ['skip rest', { kind: 'skip_rest' }],
    ['Nächste Übung', { kind: 'next_exercise' }],
    ['next exercise', { kind: 'next_exercise' }],
    ['Kniebeuge hinzufügen', { kind: 'add_exercise', query: 'kniebeuge' }],
    ['Füge Klimmzüge hinzu', { kind: 'add_exercise', query: 'klimmzüge' }],
    ['add the deadlift', { kind: 'add_exercise', query: 'deadlift' }],
    ['Rückgängig', { kind: 'undo' }],
    ['undo', { kind: 'undo' }],
  ])('%s', (raw, cmd) => {
    expect(parseCommand(raw)).toEqual(cmd)
  })
})

describe('voiceTarget und lastDoneBefore', () => {
  const ex = (done: boolean[]): SessionExercise => ({ exerciseId: 'x', sets: done.map((d, i) => ({ type: 'normal', done: d, reps: i + 1 })) })
  it('ab der gewählten Übung, sonst von vorn', () => {
    const list = [ex([true, false]), ex([false]), ex([true])]
    expect(voiceTarget(list)).toEqual({ index: 0, setIndex: 1 })
    expect(voiceTarget(list, 1)).toEqual({ index: 1, setIndex: 0 })
    expect(voiceTarget(list, 2)).toEqual({ index: 0, setIndex: 1 })
    expect(voiceTarget([ex([true])])).toBeNull()
  })
  it('letzter erledigter Satz vor dem Ziel', () => {
    const e = ex([true, true, false])
    expect(lastDoneBefore(e, 2)?.reps).toBe(2)
    expect(lastDoneBefore(ex([false, false]), 0)).toBeNull()
  })
})
