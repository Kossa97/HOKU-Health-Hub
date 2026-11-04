import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { HealthDailyRow } from '../../wearables/lib/healthDaily'
import {
  HISTORY_MAX_WEEKS, PROGRESS_AREAS, PROGRESS_COUNT_MAX, PROGRESS_METRIC_IDS, addDays, adherenceValue, allowedDirections, areaOf, bloodValue, bodyValue,
  buildProgressValues, changePercent, computeProgress, defaultDirection, directionSource, e1rmValues, effectiveDirection,
  isMetricId, parseBaselines, parseDirections, parseHistory, progressHistory, progressSnapshot, scoreProgress, wearableValue,
  wearableDays, weekOf, withHistory, workoutsValue,
  type DatedValue, type ProgressInput, type ProgressValueInput,
} from './progressScore'

const counts = { status: 'counts' } as const
const v = (id: ProgressValueInput['id'], start: number, now: number): ProgressValueInput => ({ id, start, now, baseline: counts })

describe('Formel (Spec Abschnitt 1)', () => {
  it('runter: 120 → 100 kg = +16,67 %', () => {
    expect(changePercent('down', 120, 100)).toBeCloseTo(16.667, 3)
  })

  it('hoch: Kreuzheben e1RM 120 → 142 kg = +18,3 %', () => {
    expect(changePercent('up', 120, 142)).toBeCloseTo(18.333, 3)
  })

  it('Prozentwerte rechnen ebenso relativ: KFA 19,4 → 15,8 % = +18,6 %', () => {
    expect(changePercent('down', 19.4, 15.8)).toBeCloseTo(18.557, 3)
    expect(Math.round(changePercent('down', 19.4, 15.8)! * 10) / 10).toBe(18.6)
  })

  it('schlechter wird negativ', () => {
    expect(changePercent('down', 100, 110)).toBeCloseTo(-10)
    expect(changePercent('up', 100, 90)).toBeCloseTo(-10)
  })

  it('kein Deckel und keine Untergrenze fuer kleine Startwerte', () => {
    expect(changePercent('up', 1, 5)).toBeCloseTo(400)
    expect(changePercent('up', 0.5, 3)).toBeCloseTo(500)
  })

  it('Startwert 0 laesst sich bei runter/hoch nicht teilen', () => {
    expect(changePercent('up', 0, 3)).toBeNull()
    expect(changePercent('down', -1, 3)).toBeNull()
  })

  it('aus zaehlt nicht', () => {
    expect(changePercent('off', 120, 100)).toBeNull()
  })

  describe('Anteilswerte: Luecke zum Ziel geschlossen', () => {
    it('Marker 12/24 → 19/24 = +58,3 %', () => {
      expect(changePercent('range', 12 / 24, 19 / 24)).toBeCloseTo(58.333, 3)
    })

    it('Schlaf 2/28 → 14/28 Naechte = +46,2 % (relativ waeren es +600 %)', () => {
      expect(changePercent('range', 2 / 28, 14 / 28)).toBeCloseTo(46.154, 3)
      expect(changePercent('up', 2 / 28, 14 / 28)).toBeCloseTo(600)
    })

    it('Start 0 %: ohne Division durch null, Anteil jetzt = geschlossene Luecke', () => {
      expect(changePercent('range', 0, 0.5)).toBeCloseTo(50)
      expect(changePercent('range', 0, 0)).toBe(0)
      expect(changePercent('range', 0, 1)).toBeCloseTo(100)
    })

    it('Start 100 % und gleich geblieben = 0 %', () => {
      expect(changePercent('range', 1, 1)).toBe(0)
    })

    it('schlechter: Anteil des Erreichten verloren, nie unter −100 %', () => {
      expect(changePercent('range', 1, 0.9)).toBeCloseTo(-10)
      expect(changePercent('range', 0.5, 0)).toBeCloseTo(-100)
      expect(changePercent('range', 0.8, 0)).toBeCloseTo(-100)
      expect(changePercent('range', 0.8, 0.6)).toBeCloseTo(-25)
    })

    it('Anteile ausserhalb 0…1 zaehlen nicht', () => {
      expect(changePercent('range', 1.2, 0.5)).toBeNull()
      expect(changePercent('range', 0.5, -0.1)).toBeNull()
    })
  })
})

describe('Werte und Richtungen (Spec Abschnitt 2)', () => {
  it('Bereiche der Werte', () => {
    expect(areaOf('weight')).toBe('koerper')
    expect(areaOf('circ_waist')).toBe('koerper')
    expect(areaOf('markers_in_range')).toBe('blut')
    expect(areaOf('workouts_per_week')).toBe('training')
    expect(areaOf('e1rm:deadlift_barbell')).toBe('training')
    expect(areaOf('adherence')).toBe('einnahmen')
    for (const id of ['steps', 'active_kcal', 'vo2max', 'resting_hr', 'bp_sys', 'sleep_nights', 'hrv'] as const) {
      expect(areaOf(id)).toBe('erholung')
    }
  })

  it('feste Richtungen', () => {
    expect(defaultDirection('body_fat', [])).toBe('down')
    expect(defaultDirection('muscle_mass', [])).toBe('up')
    expect(defaultDirection('workouts_per_week', [])).toBe('up')
    expect(defaultDirection('e1rm:bench_press_barbell', [])).toBe('up')
    expect(defaultDirection('adherence', [])).toBe('up')
    expect(defaultDirection('steps', [])).toBe('up')
    expect(defaultDirection('active_kcal', [])).toBe('up')
    expect(defaultDirection('vo2max', [])).toBe('up')
    expect(defaultDirection('hrv', [])).toBe('up')
    expect(defaultDirection('resting_hr', [])).toBe('down')
    expect(defaultDirection('bp_sys', [])).toBe('down')
    expect(directionSource('body_fat')).toBe('fixed')
  })

  it('Zielbereich fuer Blut und Schlaf', () => {
    expect(defaultDirection('markers_in_range', ['fettabbau'])).toBe('range')
    expect(defaultDirection('sleep_nights', [])).toBe('range')
    expect(directionSource('sleep_nights')).toBe('range')
  })

  it('Gewicht aus den Ziel-Tags: Fettabbau runter, Muskelaufbau hoch, Recomp/beides/sonst aus', () => {
    expect(defaultDirection('weight', ['fettabbau'])).toBe('down')
    expect(defaultDirection('weight', ['muskelaufbau', 'kraft'])).toBe('up')
    expect(defaultDirection('weight', ['recomp'])).toBe('off')
    expect(defaultDirection('weight', ['fettabbau', 'recomp'])).toBe('off')
    expect(defaultDirection('weight', ['fettabbau', 'muskelaufbau'])).toBe('off')
    expect(defaultDirection('weight', ['schlaf'])).toBe('off')
    expect(defaultDirection('weight', [])).toBe('off')
    expect(directionSource('weight')).toBe('goals')
  })

  it('Umfaenge: Taille/Bauch/Huefte runter; Oberarm/Brust/Oberschenkel/Wade je nach Ziel; Hals/Unterarm aus', () => {
    for (const id of ['circ_waist', 'circ_belly', 'circ_hips'] as const) {
      expect(defaultDirection(id, ['muskelaufbau'])).toBe('down')
    }
    for (const id of ['circ_upper_arm', 'circ_chest', 'circ_thigh', 'circ_calf'] as const) {
      expect(defaultDirection(id, ['muskelaufbau'])).toBe('up')
      expect(defaultDirection(id, ['kraft'])).toBe('up')
      expect(defaultDirection(id, ['fettabbau'])).toBe('down')
      expect(defaultDirection(id, [])).toBe('down')
    }
    expect(defaultDirection('circ_neck', ['muskelaufbau'])).toBe('off')
    expect(defaultDirection('circ_forearm', [])).toBe('off')
  })

  it('Ueberschreiben und Ausschliessen; Unerlaubtes zaehlt nicht', () => {
    expect(effectiveDirection('weight', ['recomp'], { weight: 'down' })).toBe('down')
    expect(effectiveDirection('body_fat', [], { body_fat: 'off' })).toBe('off')
    expect(effectiveDirection('markers_in_range', [], { markers_in_range: 'off' })).toBe('off')
    expect(effectiveDirection('markers_in_range', [], { markers_in_range: 'up' })).toBe('range')
    expect(effectiveDirection('weight', ['fettabbau'], { weight: 'range' })).toBe('down')
    expect(allowedDirections('sleep_nights')).toEqual(['range', 'off'])
    expect(allowedDirections('steps')).toEqual(['down', 'up', 'off'])
  })

  it('parseDirections behaelt nur bekannte Werte mit erlaubter Richtung', () => {
    expect(parseDirections({
      weight: 'down', nose: 'up', steps: 'range', sleep_nights: 'off', 'e1rm:squat_barbell': 'off',
      'e1rm:custom:0f8fad5b-d9cb-469f-a165-70867728950e': 'up', 'e1rm:../x': 'up', body_fat: 5,
    })).toEqual({
      weight: 'down', sleep_nights: 'off', 'e1rm:squat_barbell': 'off', 'e1rm:custom:0f8fad5b-d9cb-469f-a165-70867728950e': 'up',
    })
    expect(parseDirections(['weight'])).toEqual({})
    expect(parseDirections(null)).toEqual({})
  })

  it('Wert-IDs stimmen mit progress_metric_ok in der Migration ueberein', () => {
    const sql = readFileSync(resolve(__dirname, '../../../../supabase-profil-p2b-fortschritt.sql'), 'utf8')
    const body = sql.match(/function public\.progress_metric_ok[\s\S]*?\$\$([\s\S]*?)\$\$;/)![1]
    const ids = [...body.matchAll(/'([a-z_0-9]+)'/g)].map(m => m[1]).filter(x => !['range', 'off', 'down', 'up'].includes(x))
    expect([...ids].sort()).toEqual([...PROGRESS_METRIC_IDS].sort())
    expect(body).toContain("'^e1rm:([a-z0-9_]{1,64}|custom:[0-9a-f-]{36})$'")
    expect(isMetricId('e1rm:custom:0f8fad5b-d9cb-469f-a165-70867728950e')).toBe(true)
    expect(isMetricId('e1rm:Bench')).toBe(false)
  })
})

describe('Zusammenrechnen', () => {
  it('Mittel je Bereich, dann Mittel der Bereiche; Bereich ohne zaehlende Werte faellt heraus', () => {
    const r = scoreProgress([
      v('body_fat', 20, 18), // +10
      v('muscle_mass', 40, 44), // +10
      v('adherence', 80, 100), // +25
      { id: 'markers_in_range', start: 0.5, now: null, baseline: { status: 'collecting', have: 1, need: 2, unit: 'reports' } },
    ], [])
    expect(r.areas.koerper).toBeCloseTo(10)
    expect(r.areas.einnahmen).toBeCloseTo(25)
    expect(r.areas.blut).toBeNull()
    expect(r.areas.training).toBeNull()
    expect(r.areaCount).toBe(2)
    expect(r.total).toBeCloseTo(17.5)
  })

  it('jeder Bereich zaehlt gleich, egal wie viele Werte er hat', () => {
    const r = scoreProgress([v('body_fat', 20, 18), v('muscle_mass', 40, 44), v('circ_waist', 100, 90), v('adherence', 50, 100)], [])
    expect(r.total).toBeCloseTo((10 + 100) / 2)
  })

  it('ausgeschlossene Werte zaehlen nicht; ohne Werte gibt es kein Gesamt', () => {
    const r = scoreProgress([v('body_fat', 20, 18)], [], { body_fat: 'off' })
    expect(r.values[0].change).toBeNull()
    expect(r.total).toBeNull()
    expect(r.areaCount).toBe(0)
  })

  it('Richtung aendern rechnet sofort neu', () => {
    expect(scoreProgress([v('weight', 120, 100)], ['fettabbau']).total).toBeCloseTo(16.667, 3)
    expect(scoreProgress([v('weight', 120, 100)], ['fettabbau'], { weight: 'up' }).total).toBeCloseTo(-16.667, 3)
  })

  it('kein Deckel im Gesamt', () => {
    expect(scoreProgress([v('steps', 1000, 5000), v('adherence', 10, 90)], []).total).toBeCloseTo(600)
  })

  it('Maras Daten aus dem Varianten-Mockup ergeben +28,35 % (Mockup zeigt +28,3 % aus gerundeten Bereichen)', () => {
    const r = scoreProgress([
      v('weight', 84.2, 81.0),
      v('body_fat', 19.4, 15.8),
      v('muscle_mass', 37.5, 38.9),
      v('circ_waist', 89, 84),
      v('circ_upper_arm', 36.5, 37.5),
      { ...v('markers_in_range', 12 / 24, 19 / 24), startOf: { n: 12, of: 24 }, nowOf: { n: 19, of: 24 } },
      v('workouts_per_week', 2.0, 3.6),
      v('e1rm:deadlift_barbell', 120, 142),
      v('e1rm:squat_barbell', 100, 118),
      v('e1rm:bench_press_barbell', 85, 97),
      v('adherence', 81, 94),
      v('steps', 6140, 9840),
      v('resting_hr', 61, 54),
      v('sleep_nights', 2 / 28, 14 / 28),
      v('vo2max', 41, 46),
      v('bp_sys', 128, 121),
      { id: 'hrv', start: null, now: null, baseline: { status: 'collecting', have: 9, need: 14, unit: 'days' } },
    ], ['recomp', 'kraft'])
    const byId = Object.fromEntries(r.values.map(x => [x.id, x]))
    expect(byId.weight.direction).toBe('off')
    expect(byId.circ_waist.direction).toBe('down')
    expect(byId.circ_upper_arm.direction).toBe('up')
    expect(byId.hrv.change).toBeNull()
    expect(r.areas.koerper).toBeCloseTo(7.662, 3)
    expect(r.areas.blut).toBeCloseTo(58.333, 3)
    expect(r.areas.training).toBeCloseTo(32.613, 3)
    expect(r.areas.einnahmen).toBeCloseTo(16.049, 3)
    expect(r.areas.erholung).toBeCloseTo(27.111, 3)
    expect(r.areaCount).toBe(5)
    expect(r.total).toBeCloseTo(28.354, 3)
    expect(Math.floor(r.total! * 10) / 10).toBe(28.3)
    expect(progressSnapshot(r, '2026-03-14')).toEqual({
      total: 28.4, since: '2026-03-14',
      areas: { koerper: 7.7, blut: 58.3, training: 32.6, einnahmen: 16, erholung: 27.1 },
      // Gewicht (Richtung aus) und HRV (sammelt noch) zaehlen nicht mit
      counts: { koerper: 4, blut: 1, training: 4, einnahmen: 1, erholung: 5 },
    })
  })
})

// ─── Baseline-Regeln ────────────────────────────────────────────────────────

const START = '2026-03-14'
const pts = (...xs: [number, number][]): DatedValue[] => xs.map(([d, value]) => ({ day: addDays(START, d), value }))

describe('Baseline: Koerperwerte (erste Messung + zweite mindestens 14 Tage spaeter)', () => {
  it('ohne Messung seit dem Start: erscheint nicht', () => {
    expect(bodyValue('weight', pts([-3, 90]), START, addDays(START, 40)).baseline).toEqual({ status: 'none' })
  })

  it('zweite Messung nach 13 Tagen: sammelt 13 von 14 Tagen', () => {
    const r = bodyValue('weight', pts([0, 120], [13, 118]), START, addDays(START, 13))
    expect(r.baseline).toEqual({ status: 'collecting', have: 13, need: 14, unit: 'days' })
    expect(r.start).toBe(120)
  })

  it('nach 14 Tagen zaehlt der Wert; jetzt = Mittel der letzten 28 Tage ohne Startmessung', () => {
    const r = bodyValue('weight', pts([0, 120], [14, 110], [40, 102], [50, 98]), START, addDays(START, 50))
    expect(r.baseline).toEqual({ status: 'counts' })
    expect(r.start).toBe(120)
    expect(r.now).toBe(100)
  })

  it('keine Messung in den letzten 28 Tagen: die letzte zaehlt', () => {
    const r = bodyValue('weight', pts([0, 120], [20, 100]), START, addDays(START, 90))
    expect(r.now).toBe(100)
  })

  it('Messungen nach heute zaehlen nicht', () => {
    expect(bodyValue('weight', pts([0, 120], [20, 100]), START, addDays(START, 10)).baseline.status).toBe('collecting')
  })
})

describe('Baseline: Blutwerte ab dem zweiten Befund', () => {
  it('ein Befund: sammelt 1 von 2', () => {
    const r = bloodValue([{ day: START, inRange: 12, of: 24 }], START, addDays(START, 30))
    expect(r.baseline).toEqual({ status: 'collecting', have: 1, need: 2, unit: 'reports' })
  })

  it('zwei Befunde: erster → letzter als Anteil', () => {
    const r = bloodValue([
      { day: addDays(START, 200), inRange: 19, of: 24 }, { day: START, inRange: 12, of: 24 }, { day: addDays(START, -5), inRange: 1, of: 24 },
    ], START, addDays(START, 230))
    expect(r.baseline).toEqual({ status: 'counts' })
    expect(r.start).toBe(0.5)
    expect(r.nowOf).toEqual({ n: 19, of: 24 })
    expect(scoreProgress([r], []).total).toBeCloseTo(58.333, 3)
  })

  it('ohne Befund seit dem Start: erscheint nicht', () => {
    expect(bloodValue([], START, START).baseline.status).toBe('none')
  })
})

describe('Baseline: e1RM ab 3 Einheiten, Top 3', () => {
  const today = addDays(START, 60)
  it('zwei Einheiten: sammelt 2 von 3', () => {
    const [r] = e1rmValues([{ exerciseId: 'squat_barbell', points: pts([1, 100], [5, 104]) }], START, today)
    expect(r.baseline).toEqual({ status: 'collecting', have: 2, need: 3, unit: 'sessions' })
  })

  it('drei Einheiten: Start = erste, jetzt = beste der letzten 28 Tage', () => {
    const [r] = e1rmValues([{ exerciseId: 'deadlift_barbell', points: pts([1, 120], [40, 142], [55, 138]) }], START, today)
    expect(r).toMatchObject({ id: 'e1rm:deadlift_barbell', start: 120, now: 142, baseline: { status: 'counts' } })
  })

  it('nur die drei Uebungen mit dem hoechsten e1RM', () => {
    const rs = e1rmValues([
      { exerciseId: 'curl_dumbbell', points: pts([1, 15], [2, 16], [3, 17]) },
      { exerciseId: 'deadlift_barbell', points: pts([1, 120]) },
      { exerciseId: 'squat_barbell', points: pts([1, 100]) },
      { exerciseId: 'bench_press_barbell', points: pts([1, 85]) },
      { exerciseId: 'Ungueltig', points: pts([1, 500]) },
    ], START, today)
    expect(rs.map(r => r.id)).toEqual(['e1rm:deadlift_barbell', 'e1rm:squat_barbell', 'e1rm:bench_press_barbell'])
  })
})

describe('Baseline: Workouts pro Woche und Adherence ab 4 Wochen', () => {
  const sessions = (...days: number[]) => days.map(d => addDays(START, d))

  it('nach 27 Tagen: sammelt 3 von 4 Wochen', () => {
    expect(workoutsValue(sessions(0, 3), START, addDays(START, 27)).baseline)
      .toEqual({ status: 'collecting', have: 3, need: 4, unit: 'weeks' })
  })

  it('ab Tag 29: Start = erste 4 Wochen, jetzt = letzte 4 Wochen', () => {
    const tage = [0, 7, 14, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
    const r = workoutsValue(sessions(...tage), START, addDays(START, 30))
    expect(r.baseline).toEqual({ status: 'counts' })
    expect(r.start).toBe(10 / 4)
    expect(r.now).toBe(12 / 4)
  })

  it('ohne Training seit dem Start: erscheint nicht', () => {
    expect(workoutsValue(sessions(-3), START, addDays(START, 40)).baseline.status).toBe('none')
  })

  it('die vier Wochen zaehlen ab dem ersten Training seit dem Start („erste Messung“)', () => {
    expect(workoutsValue(sessions(20, 25), START, addDays(START, 40)).baseline)
      .toEqual({ status: 'collecting', have: 2, need: 4, unit: 'weeks' })
    const r = workoutsValue(sessions(20, 25, 48, 50), START, addDays(START, 50))
    expect(r).toMatchObject({ start: 2 / 4, now: 3 / 4, baseline: { status: 'counts' } })
  })

  it('Adherence: erste faellige Einnahme nach Tag 28 — sammelt erst ab dort, Start nie leer', () => {
    const days = Array.from({ length: 30 }, (_, i) => ({ day: addDays(START, 40 + i), taken: 1, due: 1 }))
    expect(adherenceValue(days, START, addDays(START, 50)).baseline).toEqual({ status: 'collecting', have: 1, need: 4, unit: 'weeks' })
    expect(adherenceValue(days, START, addDays(START, 69))).toMatchObject({ start: 100, now: 100, baseline: { status: 'counts' } })
  })

  it('Adherence in %: erste 28 Tage → letzte 28 Tage', () => {
    const days = Array.from({ length: 60 }, (_, i) => ({ day: addDays(START, i), taken: i < 28 ? (i % 5 === 0 ? 0 : 1) : 1, due: 1 }))
    expect(adherenceValue(days, START, addDays(START, 20)).baseline).toEqual({ status: 'collecting', have: 2, need: 4, unit: 'weeks' })
    const r = adherenceValue(days, START, addDays(START, 59))
    expect(r.start).toBeCloseTo(22 / 28 * 100)
    expect(r.now).toBe(100)
  })
})

describe('Baseline: Wearables (60 Tage davor oder die ersten 28 Tage danach)', () => {
  const row = (d: number, x: Partial<HealthDailyRow>): HealthDailyRow => ({
    day: addDays(START, d), steps: null, resting_hr: null, sleep_min: null, active_kcal: null, spo2_pct: null, resp_rate: null, bp_sys: null, bp_dia: null, ...x,
  })
  const days = (from: number, to: number, x: (d: number) => Partial<HealthDailyRow>) =>
    Array.from({ length: to - from + 1 }, (_, i) => row(from + i, x(from + i)))

  it('mit Baseline von davor zaehlt der Wert sofort; jetzt = abgeschlossene Tage seit dem Start, ohne heute', () => {
    const rows = [...days(-20, -1, () => ({ steps: 1000 })), ...days(0, 9, () => ({ steps: 8000 })), row(10, { steps: 200 })]
    const r = wearableValue('steps', rows, { source: 'before', on: START, value: 6000, days: 41 }, START, addDays(START, 10))
    expect(r.baseline).toEqual({ status: 'counts' })
    expect(r.start).toBe(6000)
    expect(r.now).toBe(8000)
  })

  it('Baseline fuer einen anderen Start gilt nicht', () => {
    const rows = days(0, 5, () => ({ steps: 8000 }))
    const r = wearableValue('steps', rows, { source: 'before', on: '2025-01-01', value: 6000, days: 41 }, START, addDays(START, 5))
    expect(r.baseline.status).toBe('collecting')
  })

  it('zu wenig davor: sammelt bis Tag 28, zaehlt ab Tag 29 mit dem Mittel der ersten 28 Tage', () => {
    const rows = [...days(0, 27, () => ({ resting_hr: 60 })), ...days(28, 60, () => ({ resting_hr: 54 }))]
    const am = (d: number) => wearableValue('resting_hr', rows, { source: 'after_start', on: START, days: 9 }, START, addDays(START, d))
    expect(am(9).baseline).toEqual({ status: 'collecting', have: 9, need: 28, unit: 'days' })
    expect(am(27).baseline).toEqual({ status: 'collecting', have: 27, need: 28, unit: 'days' })
    expect(am(28)).toMatchObject({ start: 60, now: 60, baseline: { status: 'counts' } })
    expect(am(56)).toMatchObject({ start: 60, now: 54 })
    expect(scoreProgress([am(56)], []).total).toBeCloseTo(10)
  })

  it('28-Tage-Regel braucht mindestens 14 Tage mit Daten in diesen 28 Tagen, sonst sammelt der Wert weiter', () => {
    // 13 Tage Daten in den ersten 28, danach taeglich
    const duenn = [...days(0, 27, d => ({ steps: d % 2 === 0 && d < 26 ? 4000 : null })), ...days(28, 60, () => ({ steps: 9000 }))]
    expect(wearableDays(duenn, 'steps', START, addDays(START, 27))).toHaveLength(13)
    expect(wearableValue('steps', duenn, undefined, START, addDays(START, 50)).baseline)
      .toEqual({ status: 'collecting', have: 13, need: 14, unit: 'days' })
    const genug = [...duenn, row(26, { steps: 4000 })]
    expect(wearableValue('steps', genug, undefined, START, addDays(START, 60)))
      .toMatchObject({ start: 4000, now: 9000, baseline: { status: 'counts' } })
    // Schlaf: Naechte als Einheit
    const schlaf = days(0, 40, d => ({ sleep_min: d < 5 || d >= 28 ? 450 : null }))
    expect(wearableValue('sleep_nights', schlaf, undefined, START, addDays(START, 40)).baseline)
      .toEqual({ status: 'collecting', have: 5, need: 14, unit: 'nights' })
  })

  it('ohne gespeicherte Baseline gilt dieselbe 28-Tage-Regel (kein Rueckfall auf 7 Tage)', () => {
    const rows = days(0, 40, () => ({ steps: 5000 }))
    expect(wearableValue('steps', rows, undefined, START, addDays(START, 7)).baseline.status).toBe('collecting')
    expect(wearableValue('steps', rows, undefined, START, addDays(START, 28)).baseline.status).toBe('counts')
  })

  it('Schlaf: Anteil der Naechte mit 7–9 h, Naechte als Einheit', () => {
    const rows = days(0, 55, d => ({ sleep_min: d < 28 ? (d % 14 === 0 ? 450 : 360) : (d % 2 === 0 ? 480 : 300) }))
    expect(wearableValue('sleep_nights', rows, undefined, START, addDays(START, 3)).baseline)
      .toEqual({ status: 'collecting', have: 3, need: 28, unit: 'nights' })
    const r = wearableValue('sleep_nights', rows, undefined, START, addDays(START, 56))
    expect(r.startOf).toEqual({ n: 2, of: 28 })
    expect(r.nowOf).toEqual({ n: 14, of: 28 })
    expect(scoreProgress([r], []).total).toBeCloseTo(46.154, 3)
  })

  it('ohne Daten seit dem Start (HRV, VO2max bis 1b) erscheint der Wert nicht', () => {
    expect(wearableValue('hrv', days(0, 40, () => ({ steps: 1 })), undefined, START, addDays(START, 40)).baseline.status).toBe('none')
  })

  it('parseBaselines: nur bekannte Werte, nur fuer diesen Start', () => {
    expect(parseBaselines({
      steps: { source: 'before', on: START, value: 6140, days: 41 },
      sleep_nights: { source: 'after_start', on: START, days: 3 },
      resting_hr: { source: 'before', on: '2025-01-01', value: 61, days: 30 },
      weight: { source: 'before', on: START, value: 80, days: 30 },
      bp_sys: { source: 'before', on: START, value: 'x', days: 30 },
    }, START)).toEqual({
      steps: { source: 'before', on: START, value: 6140, days: 41 },
      sleep_nights: { source: 'after_start', on: START, days: 3 },
    })
  })
})

// ─── Alles zusammen, Schnappschuss, Wochenreihe ─────────────────────────────

const leer = (today: string): ProgressInput => ({
  today, startOn: START, goals: ['fettabbau'], weight: [], bodyFat: [], muscleMass: [], circumferences: {},
  bloodReports: [], sessionDays: [], e1rm: [], doseDays: [], healthDaily: [], baselines: {},
})

describe('buildProgressValues / computeProgress', () => {
  it('Werte ohne Daten fehlen, sammelnde erscheinen ohne zu zaehlen', () => {
    const input = { ...leer(addDays(START, 20)), weight: pts([0, 120], [10, 118]), bodyFat: pts([0, 20], [15, 19]) }
    const values = buildProgressValues(input)
    expect(values.map(x => x.id)).toEqual(['weight', 'body_fat'])
    const r = computeProgress(input)
    expect(r.values[0].change).toBeNull()
    expect(r.total).toBeCloseTo(5)
  })

  it('noch kein Wert: kein Gesamt, kein Schnappschuss', () => {
    const r = computeProgress(leer(START))
    expect(r.total).toBeNull()
    expect(progressSnapshot(r, START)).toBeUndefined()
  })

  it('Schnappschuss nur mit Bereichen, die zaehlen', () => {
    const r = scoreProgress([v('body_fat', 20, 18)], [])
    expect(progressSnapshot(r, START)).toEqual({ total: 10, areas: { koerper: 10 }, since: START, counts: { koerper: 1 } })
  })

  it('counts zaehlt je Bereich nur Werte, die eingehen (2c, Grundlage von web_value_count)', () => {
    const r = scoreProgress([
      v('body_fat', 20, 18), v('muscle_mass', 30, 31), v('weight', 80, 78),
      v('steps', 5000, 6000),
      { id: 'hrv', start: null, now: null, baseline: { status: 'collecting', have: 3, need: 14, unit: 'days' } },
    ], ['recomp'])
    // weight hat bei recomp keine Richtung, hrv sammelt noch
    expect(progressSnapshot(r, START)?.counts).toEqual({ koerper: 2, erholung: 1 })
  })
})

describe('Wochenreihe (history)', () => {
  it('Woche = Montag', () => {
    expect(weekOf('2026-03-14')).toBe('2026-03-09') // Samstag
    expect(weekOf('2026-03-16')).toBe('2026-03-16') // Montag
    expect(weekOf('2026-03-22')).toBe('2026-03-16') // Sonntag
  })

  it('je Woche seit dem Start ein Punkt, Stand am Sonntag, die laufende Woche mit heute', () => {
    const input = { ...leer('2026-04-15'), weight: pts([0, 120], [14, 114], [28, 110]) }
    const h = progressHistory(input)
    expect(h.map(e => e.week)).toEqual(['2026-03-09', '2026-03-16', '2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13'])
    expect(h[0].total).toBeNull()
    expect(h[3].total).toBe(5) // 29.03.: 114
    expect(h.at(-1)!.total).toBe(6.7) // 15.04.: Mittel(114, 110) = 112
  })

  it('hoechstens 104 Wochen', () => {
    const input = { ...leer(addDays(START, 7 * 130)), weight: pts([0, 120], [14, 114]) }
    const h = progressHistory(input)
    expect(h).toHaveLength(HISTORY_MAX_WEEKS)
    expect(h.at(-1)!.week).toBe(weekOf(input.today))
  })

  it('withHistory ersetzt dieselbe Woche, sortiert und kappt', () => {
    const e = (week: string, total: number) => ({ week, total, areas: {} })
    expect(withHistory([e('2026-03-16', 1), e('2026-03-09', 0)], [e('2026-03-16', 2)]))
      .toEqual([e('2026-03-09', 0), e('2026-03-16', 2)])
    const lang = Array.from({ length: 110 }, (_, i) => e(addDays('2024-01-01', 7 * i), i))
    const gekappt = withHistory([], lang)
    expect(gekappt).toHaveLength(104)
    expect(gekappt[0].total).toBe(6)
  })

  it('parseHistory behaelt nur gueltige Eintraege und bekannte Bereiche', () => {
    expect(parseHistory([
      { week: '2026-03-16', total: 3.5, areas: { koerper: 1, geheim: 2, blut: 'x' } },
      { week: 'gestern', total: 1 },
      { week: '2026-03-09', total: 'x' },
      7,
    ])).toEqual([
      { week: '2026-03-09', total: null, areas: {} },
      { week: '2026-03-16', total: 3.5, areas: { koerper: 1 } },
    ])
    expect(parseHistory({})).toEqual([])
  })
})

describe('Vertrag progress.counts mit supabase-profil-p2c-web.sql', () => {
  it('der Server liest dieselben Bereichsnamen und dieselbe Obergrenze', () => {
    const sql = readFileSync(resolve(__dirname, '../../../../supabase-profil-p2c-web.sql'), 'utf8')
    const fn = sql.match(/function public\.profile_web_value_count\(s jsonb\)[\s\S]*?\$\$;/)?.[0]
    expect(fn).toBeDefined()
    expect(fn).toContain("array['progress', 'counts', a.k]")
    const bereiche = fn!.match(/unnest\(array\[([^\]]*)\]\)/)?.[1].match(/'([a-z]+)'/g)?.map(x => x.slice(1, -1))
    expect(bereiche).toEqual(['koerper', 'training', 'erholung'])
    expect(bereiche!.every(b => (PROGRESS_AREAS as readonly string[]).includes(b))).toBe(true)
    expect(fn).toContain(`between 0 and ${PROGRESS_COUNT_MAX}`)
  })
})
