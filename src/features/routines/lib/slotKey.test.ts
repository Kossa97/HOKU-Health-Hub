import { describe, expect, it } from 'vitest'
import { resolveTimelineIntakesForDay } from '../../../lib/intakeSchedule'
import { istSlotSchluessel, planTagAusSchluessel, slotSchluessel, slotSchluesselFuerZeitpunkt, slotSchluesselGrenze } from './slotKey'

const ZYKLUS = '11111111-1111-4111-8111-111111111111'

describe('slotSchluessel', () => {
  it('traegt die Wanduhr in fester Breite', () => {
    expect(slotSchluessel(ZYKLUS, '2026-09-22', 8 * 60)).toBe(`${ZYKLUS}@2026-09-22T08:00`)
    expect(slotSchluessel(ZYKLUS, '2026-09-22', 0)).toBe(`${ZYKLUS}@2026-09-22T00:00`)
    expect(slotSchluessel(ZYKLUS, '2026-09-22', 23 * 60 + 59)).toBe(`${ZYKLUS}@2026-09-22T23:59`)
  })

  it('bleibt lexikografisch chronologisch', () => {
    // Darauf beruht die Bereichssuche in `slotKeyRange.ts`: ohne feste Breite
    // stuende `2026-09-22T9:00` hinter `2026-09-22T10:00`.
    const sortiert = [
      slotSchluessel(ZYKLUS, '2026-09-22', 9 * 60),
      slotSchluessel(ZYKLUS, '2026-09-22', 10 * 60),
      slotSchluessel(ZYKLUS, '2026-09-23', 0),
    ]
    expect([...sortiert].sort()).toEqual(sortiert)
  })

  it('weist zurueck, was keine Wanduhr ist', () => {
    expect(() => slotSchluessel(ZYKLUS, '2026-09-22T08:00:00Z', 0)).toThrow(/lokales Datum/)
    expect(() => slotSchluessel(ZYKLUS, '22.09.2026', 0)).toThrow(/lokales Datum/)
    expect(() => slotSchluessel(ZYKLUS, '2026-09-22', 1440)).toThrow(/Minute des Tages/)
    expect(() => slotSchluessel(ZYKLUS, '2026-09-22', -1)).toThrow(/Minute des Tages/)
    expect(() => slotSchluessel(ZYKLUS, '2026-09-22', 8.5)).toThrow(/Minute des Tages/)
  })
})

describe('slotSchluesselFuerZeitpunkt', () => {
  it('liest den Zeitpunkt in die uebergebene Zeitzone', () => {
    const zeitpunkt = '2026-09-22T06:00:00Z'
    expect(slotSchluesselFuerZeitpunkt(ZYKLUS, zeitpunkt, 'Europe/Berlin')).toBe(`${ZYKLUS}@2026-09-22T08:00`)
    expect(slotSchluesselFuerZeitpunkt(ZYKLUS, zeitpunkt, 'Asia/Tokyo')).toBe(`${ZYKLUS}@2026-09-22T15:00`)
    expect(slotSchluesselFuerZeitpunkt(ZYKLUS, zeitpunkt, 'UTC')).toBe(`${ZYKLUS}@2026-09-22T06:00`)
  })
})

describe('istSlotSchluessel', () => {
  it('nimmt an, was zu diesem Zyklus gehoert und eine Wanduhr traegt', () => {
    expect(istSlotSchluessel(`${ZYKLUS}@2026-09-22T08:00`, ZYKLUS)).toBe(true)
  })

  it('weist zurueck, was erfunden ist', () => {
    expect(istSlotSchluessel(null, ZYKLUS)).toBe(false)
    expect(istSlotSchluessel(undefined, ZYKLUS)).toBe(false)
    expect(istSlotSchluessel('', ZYKLUS)).toBe(false)
    expect(istSlotSchluessel(ZYKLUS, ZYKLUS)).toBe(false)
    expect(istSlotSchluessel(`${ZYKLUS}@2026-09-22`, ZYKLUS)).toBe(false)
    expect(istSlotSchluessel(`${ZYKLUS}@2026-09-22T06:00:00.000Z`, ZYKLUS)).toBe(false)
    // Fremder Zyklus, gueltiges Format.
    expect(istSlotSchluessel(`22222222-2222-4222-8222-222222222222@2026-09-22T08:00`, ZYKLUS)).toBe(false)
  })

  it('nimmt den Schluessel an, der unterwegs bestaetigt wurde', () => {
    // Genau der Fall, an dem die alte Pruefung scheiterte: sie verglich den
    // Schluessel gegen den aus der Geraetezeitzone gerechneten Zeitpunkt.
    expect(istSlotSchluessel(slotSchluessel(ZYKLUS, '2026-09-22', 8 * 60), ZYKLUS)).toBe(true)
  })
})

describe('slotSchluesselGrenze', () => {
  it('ist der Tagesanfang', () => {
    expect(slotSchluesselGrenze(ZYKLUS, '2026-09-22')).toBe(`${ZYKLUS}@2026-09-22T00:00`)
  })
})

describe('geplante Minute gegen aufgeloeste', () => {
  it('weicht an der Zeitumstellung voneinander ab', () => {
    // Warum ein Aufrufer, der einen geplanten Slot hat, dessen Schluessel
    // durchreichen MUSS statt ihn aus dem Zeitpunkt nachzurechnen.
    //
    // Am 29.03.2026 springt Berlin von 02:00 auf 03:00. Ein geplanter
    // 02:30-Slot bekommt deshalb den Zeitpunkt 01:00Z -- lokal 03:00. Aus
    // diesem Zeitpunkt zurueckgelesen hiesse der Platz `@03:00`; geplant ist
    // er aber `@02:30`. Der erste passt auf keinen Plantag mehr und
    // kollidiert mit einem tatsaechlich geplanten 03:00-Slot.
    const geplant = slotSchluessel(ZYKLUS, '2026-03-29', 2 * 60 + 30)
    const ausDemZeitpunkt = slotSchluesselFuerZeitpunkt(ZYKLUS, '2026-03-29T01:00:00.000Z', 'Europe/Berlin')

    expect(geplant).toBe(`${ZYKLUS}@2026-03-29T02:30`)
    expect(ausDemZeitpunkt).toBe(`${ZYKLUS}@2026-03-29T03:00`)
    expect(ausDemZeitpunkt).not.toBe(geplant)
  })

  it('stimmt an jedem gewoehnlichen Tag ueberein', () => {
    // Deshalb faellt der Unterschied im Alltag nicht auf -- und deshalb ist
    // er als Fehler so langlebig.
    const geplant = slotSchluessel(ZYKLUS, '2026-09-22', 8 * 60)
    expect(slotSchluesselFuerZeitpunkt(ZYKLUS, '2026-09-22T06:00:00.000Z', 'Europe/Berlin')).toBe(geplant)
  })
})

describe('der Schluessel reist mit', () => {
  /**
   * Der Grund fuer das ganze Format. Derselbe Plan, derselbe Dienstag, zwei
   * Aufenthaltsorte -- frueher ergab das zwei verschiedene Schluessel, also
   * zwei Zeilen fuer denselben Platz: der Dienstag stand wieder offen da, und
   * die bestaetigte Zeile liess sich nicht einmal wieder oeffnen, weil sie in
   * keiner Tagesplanung mehr vorkam.
   */
  const zeitplan = {
    cycle: {
      id: ZYKLUS,
      stack_item_id: 'stack-1',
      started_at: '2026-09-01T00:00:00Z',
      ended_at: null,
    },
    versions: [{
      id: 'version-1',
      cycle_id: ZYKLUS,
      effective_kind: 'local_date',
      effective_at: null,
      effective_local_date: '2026-09-01',
      change_kind: 'initial',
      frequency: 'Täglich',
      x_days_interval: null,
      interval_unit: null,
      cycle_on_days: null,
      cycle_off_days: null,
      schedule_days: [],
      intake_time: 'morgens',
      intake_time_custom: '08:00',
      slot_doses: null,
      slot_days: null,
      dose: 1,
      unit: 'mg',
      method: 'Oral',
    }],
    pauses: [],
  }

  it('ergibt denselben Schluessel in Berlin und in Tokio', () => {
    const berlin = resolveTimelineIntakesForDay(zeitplan as never, '2026-09-22', 'Europe/Berlin')
    const tokio = resolveTimelineIntakesForDay(zeitplan as never, '2026-09-22', 'Asia/Tokyo')

    expect(berlin).toHaveLength(1)
    expect(tokio).toHaveLength(1)
    expect(berlin[0]!.routineSlotKey).toBe(`${ZYKLUS}@2026-09-22T08:00`)
    expect(tokio[0]!.routineSlotKey).toBe(berlin[0]!.routineSlotKey)

    // Der Zeitpunkt verschiebt sich sehr wohl -- nur die Identitaet nicht.
    expect(tokio[0]!.scheduledAt).not.toBe(berlin[0]!.scheduledAt)
  })
})

describe('planTagAusSchluessel', () => {
  it('liest den Tag im Plan, nicht den der Einnahme', () => {
    expect(planTagAusSchluessel(`${ZYKLUS}@2026-10-29T20:00`)).toBe('2026-10-29')
  })

  it('gibt null ohne gueltigen Schluessel (alte Zeilen, bei Bedarf)', () => {
    expect(planTagAusSchluessel(null)).toBeNull()
    expect(planTagAusSchluessel('')).toBeNull()
    expect(planTagAusSchluessel(ZYKLUS)).toBeNull()
    expect(planTagAusSchluessel(`${ZYKLUS}@2026-09-22T06:00:00.000Z`)).toBeNull()
  })
})
