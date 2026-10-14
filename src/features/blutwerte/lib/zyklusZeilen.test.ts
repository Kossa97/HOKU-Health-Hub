import { describe, expect, it } from 'vitest'
import type { CycleTimeline } from '../../../lib/planTimeline'
import { MAX_ZEILEN, achse, achsenTicks, aktiveZyklen, msTag, tagMs, zyklusZeilen } from './zyklusZeilen'

const timeZone = 'Europe/Berlin'

/** Ende exklusiv wie in der Datenbank: `ende` ist der Tag nach dem letzten. */
function zyklus(id: string, stackItemId: string, start: string, ende: string | null): CycleTimeline {
  return {
    cycle: {
      id, stack_item_id: stackItemId,
      started_at: `${start}T00:00:00.000Z`, start_local_date: start,
      ended_at: ende ? `${ende}T00:00:00.000Z` : null, end_local_date: ende,
    },
    versions: [],
    pauses: [],
  }
}

const namen = new Map([['bpc', 'BPC-157'], ['tb', 'TB-500'], ['sema', 'Semaglutid']])
// 100 Tage: 2026-01-01 bis 2026-04-10
const fenster = { von: '2026-01-01', bis: '2026-04-10' }

describe('Zyklen als Zeitstreifen', () => {
  it('legt Zyklen einer Substanz in eine Zeile, zugeschnitten aufs Fenster', () => {
    const { zeilen, weitere } = zyklusZeilen([
      zyklus('c1', 'bpc', '2025-12-01', '2026-01-11'),
      zyklus('c2', 'bpc', '2026-03-12', null),
    ], namen, fenster, '2026-04-10', timeZone)

    expect(weitere).toBe(0)
    expect(zeilen).toHaveLength(1)
    const [z] = zeilen
    expect(z.substanz).toBe('BPC-157')
    expect(z.abschnitte.map(a => [a.von, a.bis])).toEqual([['2025-12-01', '2026-01-10'], ['2026-03-12', null]])
    // vor dem Fenster begonnen: bei 0 abgeschnitten; 10 Tage im Fenster
    expect(z.abschnitte[0].start).toBe(0)
    expect(z.abschnitte[0].ende).toBeCloseTo(0.1)
    // laeuft bis heute = Fensterende
    expect(z.abschnitte[1].start).toBeCloseTo(0.7)
    expect(z.abschnitte[1].ende).toBe(1)
  })

  it('laesst Zyklen ausserhalb des Fensters weg', () => {
    const { zeilen } = zyklusZeilen([zyklus('c1', 'tb', '2025-01-01', '2025-02-01')], namen, fenster, '2026-04-10', timeZone)
    expect(zeilen).toEqual([])
  })

  it('Farbe folgt der Substanz, nicht der Reihenfolge im Fenster', () => {
    const timelines = [
      zyklus('alt', 'sema', '2025-06-01', '2025-07-01'),
      zyklus('c1', 'tb', '2026-02-01', '2026-03-01'),
      zyklus('c2', 'bpc', '2026-01-05', '2026-01-20'),
    ]
    const { zeilen } = zyklusZeilen(timelines, namen, fenster, '2026-04-10', timeZone)
    // Plaetze nach erstem Start ueberhaupt: sema 0, bpc 1, tb 2. sema ist nicht
    // im Fenster — die anderen behalten trotzdem ihre Plaetze statt aufzuruecken.
    expect(zeilen.map(z => [z.substanz, z.farbe])).toEqual([['BPC-157', 1], ['TB-500', 2]])
  })

  it('zeigt hoechstens fuenf Zeilen und zaehlt den Rest', () => {
    const viele = Array.from({ length: 7 }, (_, i) => zyklus(`c${i}`, `s${i}`, `2026-02-0${i + 1}`, '2026-03-01'))
    const { zeilen, weitere } = zyklusZeilen(viele, new Map(), fenster, '2026-04-10', timeZone)
    expect(zeilen).toHaveLength(MAX_ZEILEN)
    expect(weitere).toBe(2)
    expect(zeilen[0].substanz).toBe('—')
  })

  it('ab der sechsten Substanz wiederholen sich die Farbplaetze, statt grau zu werden', () => {
    // s0 begann zuerst (alter Zyklus ausserhalb des Fensters), s5 als sechste.
    const timelines = [
      ...Array.from({ length: 5 }, (_, i) => zyklus(`alt${i}`, `s${i}`, `2025-0${i + 1}-01`, `2025-0${i + 1}-10`)),
      zyklus('neu', 's5', '2026-02-01', '2026-03-01'),
    ]
    const { zeilen } = zyklusZeilen(timelines, new Map(), fenster, '2026-04-10', timeZone)
    expect(zeilen.map(z => [z.stackItemId, z.farbe])).toEqual([['s5', 0]])
  })

  it('teilen sich zwei sichtbare Substanzen den Platz, weicht die spaetere aus', () => {
    const timelines = [
      ...Array.from({ length: 6 }, (_, i) => zyklus(`alt${i}`, `s${i}`, `2025-0${i + 1}-01`, `2025-0${i + 1}-10`)),
      zyklus('a', 's0', '2026-01-10', '2026-02-01'),
      zyklus('b', 's6', '2026-02-01', '2026-03-01'),
    ]
    const { zeilen } = zyklusZeilen(timelines, new Map(), fenster, '2026-04-10', timeZone)
    expect(zeilen.map(z => [z.stackItemId, z.farbe])).toEqual([['s0', 0], ['s6', 1]])
  })

  it('am selben Tag pausiert und fortgesetzt: keine Luecke', () => {
    const z = zyklus('c1', 'bpc', '2026-02-01', '2026-03-01')
    z.pauses = [{ id: 'p1', cycle_id: 'c1', paused_at: '2026-02-10T07:00:00.000Z', ends_at: '2026-02-10T19:00:00.000Z' }]
    const { zeilen } = zyklusZeilen([z], namen, fenster, '2026-04-10', timeZone)
    expect(zeilen[0].abschnitte.map(a => [a.von, a.bis])).toEqual([['2026-02-01', '2026-02-28']])
  })

  it('Pausentage gelten in der Zeitzone des Zyklus, nicht des Geraets', () => {
    const z = zyklus('c1', 'bpc', '2026-02-01', '2026-03-01')
    z.cycle.lifecycle_timezone = 'America/New_York'
    // 22:00 in New York = 04:00 am Folgetag in Berlin
    z.pauses = [{ id: 'p1', cycle_id: 'c1', paused_at: '2026-02-11T03:00:00.000Z', ends_at: '2026-02-15T15:00:00.000Z' }]
    const { zeilen } = zyklusZeilen([z], namen, fenster, '2026-04-10', timeZone)
    expect(zeilen[0].abschnitte.map(a => [a.von, a.bis])).toEqual([['2026-02-01', '2026-02-09'], ['2026-02-15', '2026-02-28']])
  })

  it('Pausen sind Luecken; nur das Stueck bis heute laeuft', () => {
    const offen = zyklus('c1', 'bpc', '2026-02-01', null)
    offen.pauses = [{ id: 'p1', cycle_id: 'c1', paused_at: '2026-02-10T08:00:00.000Z', ends_at: '2026-02-15T08:00:00.000Z' }]
    const { zeilen } = zyklusZeilen([offen], namen, fenster, '2026-04-10', timeZone)
    expect(zeilen[0].abschnitte.map(a => [a.von, a.bis])).toEqual([['2026-02-01', '2026-02-09'], ['2026-02-15', null]])
  })

  it('eine noch offene Pause reicht bis heute', () => {
    const pausiert = zyklus('c1', 'bpc', '2026-02-01', null)
    pausiert.pauses = [{ id: 'p1', cycle_id: 'c1', paused_at: '2026-03-01T08:00:00.000Z', ends_at: null }]
    const { zeilen } = zyklusZeilen([pausiert], namen, fenster, '2026-04-10', timeZone)
    expect(zeilen[0].abschnitte.map(a => [a.von, a.bis])).toEqual([['2026-02-01', '2026-02-28']])
  })

  it('Achse und Ticks liegen auf ganzen Tagen, Ende einschliesslich des letzten Tags', () => {
    const [start, ende] = achse(fenster)
    expect(msTag(start)).toBe('2026-01-01')
    expect((ende - start) / 86_400_000).toBe(100)
    const ticks = achsenTicks([start, ende])
    expect(ticks.map(msTag)).toEqual(['2026-01-01', '2026-01-26', '2026-02-20', '2026-03-17'])
    // Einzelner Tag: trotzdem eine Achse mit Breite.
    const [a, b] = achse({ von: '2026-05-05', bis: '2026-05-05' })
    expect(b).toBeGreaterThan(a)
    expect(achsenTicks([a, b]).map(msTag)).toEqual(['2026-05-05'])
  })

  it('am Starttag beendet: ein Tag, nicht rueckwaerts', () => {
    const { zeilen } = zyklusZeilen([zyklus('c1', 'bpc', '2026-02-10', '2026-02-10')], namen, fenster, '2026-04-10', timeZone)
    const [a] = zeilen[0].abschnitte
    expect(a.bis).toBe('2026-02-10')
    expect(a.ende).toBeGreaterThan(a.start)
  })
})

describe('aktiveZyklen (Ablese-Schild)', () => {
  const { zeilen } = zyklusZeilen([
    zyklus('c1', 'bpc', '2025-12-01', '2026-01-11'),
    zyklus('c2', 'tb', '2026-01-05', null),
  ], namen, fenster, '2026-04-10', timeZone)
  const mittag = (tag: string) => tagMs(tag) + 12 * 60 * 60 * 1000

  it('nennt die laufenden Zyklen mit Woche ab Zyklusbeginn, auch vor dem Fenster begonnen', () => {
    // BPC seit 01.12.: 08.01. ist Tag 39 → Woche 6; TB seit 05.01. → Woche 1
    expect(aktiveZyklen(zeilen, fenster, mittag('2026-01-08')).map(({ zeile, woche }) => [zeile.substanz, woche]))
      .toEqual([['BPC-157', 6], ['TB-500', 1]])
  })

  it('der letzte Tag gehoert dazu, der Tag danach nicht', () => {
    expect(aktiveZyklen(zeilen, fenster, mittag('2026-01-10')).map(({ zeile }) => zeile.substanz)).toEqual(['BPC-157', 'TB-500'])
    expect(aktiveZyklen(zeilen, fenster, mittag('2026-01-11')).map(({ zeile }) => zeile.substanz)).toEqual(['TB-500'])
  })
})
