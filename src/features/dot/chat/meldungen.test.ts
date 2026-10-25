import { describe, expect, it } from 'vitest'
import type { ResolvedTimelineIntake } from '../../../lib/intakeSchedule'
import { entscheidenderEintrag, plane, zeitpunkt, type Eintrag } from './meldungen'

const TZ = 'Europe/Berlin'
// 24.10.2026, 20:00 Berlin geplant (UTC+2)
const intake = {
  localDate: '2026-10-24', scheduledAt: '2026-10-24T18:00:00.000Z', routineSlotKey: 'c1@2026-10-24T20:00',
} as ResolvedTimelineIntake
const genommen: Eintrag = { id: 'l1', taken: true, notes: null, logged_at: intake.scheduledAt }
const um = (iso: string) => new Date(iso)

describe('Dot: Meldungen per Satz', () => {
  it('Uhrzeit am Tag der Einnahme, in der Zeitzone des Nutzers', () => {
    expect(zeitpunkt(intake, '22:00', TZ).toISOString()).toBe('2026-10-24T20:00:00.000Z')
  })

  it('„vergessen": auch eine schon genommene (von Dot) wird umentschieden; doppelt nicht', () => {
    const jetzt = um('2026-10-24T19:00:00Z')
    expect(plane({ art: 'vergessen', uhrzeit: null, intake, eintrag: genommen, jetzt, timeZone: TZ, auto: true })).toEqual({ tun: 'auslassen' })
    expect(plane({ art: 'vergessen', uhrzeit: null, intake, eintrag: { ...genommen, taken: false }, jetzt, timeZone: TZ, auto: true }))
      .toEqual({ tun: 'nichts', status: 'schon_vergessen' })
  })

  it('„genommen": zur genannten Zeit, sonst geplant, vor der geplanten Zeit jetzt', () => {
    const spaet = um('2026-10-24T19:30:00Z')
    expect(plane({ art: 'genommen', uhrzeit: '20:40', intake, eintrag: null, jetzt: spaet, timeZone: TZ, auto: false }))
      .toEqual({ tun: 'nehmen', um: um('2026-10-24T18:40:00Z') })
    expect(plane({ art: 'genommen', uhrzeit: null, intake, eintrag: null, jetzt: spaet, timeZone: TZ, auto: false }))
      .toEqual({ tun: 'nehmen', um: um(intake.scheduledAt) })
    const frueh = um('2026-10-24T15:00:00Z')
    expect(plane({ art: 'genommen', uhrzeit: null, intake, eintrag: null, jetzt: frueh, timeZone: TZ, auto: false }))
      .toEqual({ tun: 'nehmen', um: frueh })
    expect(plane({ art: 'genommen', uhrzeit: null, intake, eintrag: genommen, jetzt: spaet, timeZone: TZ, auto: false }))
      .toEqual({ tun: 'nichts', status: 'schon_genommen' })
  })

  it('„erst um 22 Uhr": mit Schalter vormerken, ohne selbst abhaken; schon vorbei heißt genommen', () => {
    const jetzt = um('2026-10-24T18:45:00Z')
    expect(plane({ art: 'spaeter', uhrzeit: '22:00', intake, eintrag: genommen, jetzt, timeZone: TZ, auto: true }))
      .toEqual({ tun: 'vormerken', um: um('2026-10-24T20:00:00Z') })
    expect(plane({ art: 'spaeter', uhrzeit: '22:00', intake, eintrag: null, jetzt, timeZone: TZ, auto: false }))
      .toEqual({ tun: 'selbst', um: um('2026-10-24T20:00:00Z') })
    expect(plane({ art: 'spaeter', uhrzeit: '20:30', intake, eintrag: null, jetzt, timeZone: TZ, auto: true }))
      .toEqual({ tun: 'nehmen', um: um('2026-10-24T18:30:00Z') })
  })

  it('„erst um 0:30" für eine Einnahme um 23 Uhr meint die Nacht danach', () => {
    const spaet = { localDate: '2026-10-24', scheduledAt: '2026-10-24T21:00:00.000Z', routineSlotKey: 'c1@2026-10-24T23:00' } as ResolvedTimelineIntake
    expect(plane({ art: 'spaeter', uhrzeit: '00:30', intake: spaet, eintrag: null, jetzt: um('2026-10-24T20:00:00Z'), timeZone: TZ, auto: true }))
      .toEqual({ tun: 'vormerken', um: um('2026-10-24T22:30:00Z') })
  })

  it('der entscheidende Eintrag: genommen vor ausgelassen vor offen', () => {
    const offen: Eintrag = { ...genommen, id: 'o', taken: null }
    const aus: Eintrag = { ...genommen, id: 'a', taken: false }
    expect(entscheidenderEintrag([offen, aus, genommen])?.id).toBe('l1')
    expect(entscheidenderEintrag([offen, aus])?.id).toBe('a')
    expect(entscheidenderEintrag([offen])?.id).toBe('o')
    expect(entscheidenderEintrag([])).toBeNull()
  })
})
