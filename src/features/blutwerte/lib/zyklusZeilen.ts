import type { CycleTimeline } from '../../../lib/planTimeline'
import { cyclePeriod, localDay } from '../../my-stack/lib/planCard'

/**
 * Zyklen aus My Stack als Spuren unter dem Verlauf eines Markers:
 * je Substanz eine Zeile, darin ihre Zyklen als Abschnitte, auf derselben
 * Zeitachse wie das Diagramm. Pausen sind Luecken. Nur zur Orientierung —
 * die App zeigt Zeitraeume, keine Wirkung.
 */

export interface ZyklusAbschnitt {
  key: string
  /** Erster Tag (yyyy-MM-dd). */
  von: string
  /** Letzter Tag; null = laeuft noch. */
  bis: string | null
  /** Erster Tag des ganzen Zyklus — auch wenn der Abschnitt nach einer Pause beginnt. */
  zyklusVon: string
  /** Lage auf der Achse, 0–1, bereits auf das Fenster zugeschnitten. */
  start: number
  ende: number
}

export interface ZyklusZeile {
  stackItemId: string
  substanz: string
  /** Farbplatz 0–4: fest je Substanz, im selben Fenster nie doppelt. */
  farbe: number
  abschnitte: ZyklusAbschnitt[]
}

export const MAX_ZEILEN = 5
// Fuenf Plaetze: mehr unterscheidbare Farben gibt es ohne Gruen/Rot nicht.
const FARBEN = 5
export const TAG_MS = 24 * 60 * 60 * 1000

// ── Gemeinsame Zeitachse fuer Diagramm und Zeilen ────────────────────────────
// Ein Kalendertag ist seine UTC-Mitternacht; das Fenster reicht vom Beginn des
// ersten bis zum Ende des letzten Tags (Ende exklusiv). Diagramm und Zeilen
// rechnen beide hiermit — sonst laufen sie auseinander.

export const tagMs = (tag: string) => Date.parse(`${tag}T00:00:00Z`)
export const msTag = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function achse(fenster: { von: string; bis: string }): [number, number] {
  return [tagMs(fenster.von), tagMs(fenster.bis) + TAG_MS]
}

/** Etwa `anzahl` Ticks auf ganzen Tagen (UTC-Mitternacht) innerhalb der Achse. */
export function achsenTicks([start, ende]: [number, number], anzahl = 4): number[] {
  const tage = Math.max(1, Math.round((ende - start) / TAG_MS))
  const schritt = Math.max(1, Math.ceil(tage / anzahl))
  const ticks: number[] = []
  for (let tag = 0; tag < tage; tag += schritt) ticks.push(start + tag * TAG_MS)
  return ticks
}

// ─────────────────────────────────────────────────────────────────────────────

/** [start, ende) minus Pausen — die uebrigen Stuecke. */
function ohnePausen(start: number, ende: number, pausen: [number, number][]): [number, number][] {
  let stuecke: [number, number][] = [[start, ende]]
  for (const [pStart, pEnde] of pausen) {
    if (pEnde <= pStart) continue // am selben Tag pausiert und fortgesetzt: keine Luecke
    stuecke = stuecke.flatMap(([a, b]): [number, number][] => {
      if (pEnde <= a || pStart >= b) return [[a, b]]
      const rest: [number, number][] = []
      if (pStart > a) rest.push([a, pStart])
      if (pEnde < b) rest.push([pEnde, b])
      return rest
    })
  }
  return stuecke
}

/**
 * @param fenster erster und letzter Tag der Diagramm-Achse (yyyy-MM-dd)
 * @param heute   heutiger Tag — Ende laufender Zyklen und offener Pausen
 * @returns die Zeilen (hoechstens MAX_ZEILEN) und wie viele weitere es gaebe
 */
export function zyklusZeilen(
  timelines: readonly CycleTimeline[],
  namen: ReadonlyMap<string, string>,
  fenster: { von: string; bis: string },
  heute: string,
  timeZone: string,
): { zeilen: ZyklusZeile[]; weitere: number } {
  const [fensterStart, fensterEnde] = achse(fenster)
  const spanne = fensterEnde - fensterStart
  if (!(spanne > 0)) return { zeilen: [], weitere: 0 }
  const heuteEnde = tagMs(heute) + TAG_MS

  // Farbe folgt der Substanz: Wunschplatz aus der Reihenfolge nach erstem
  // Start ueberhaupt, damit ein anderer Zeitraum die Farben nicht neu verteilt.
  const reihenfolge = new Map<string, number>()
  for (const timeline of timelines.slice().sort((a, b) => a.cycle.started_at.localeCompare(b.cycle.started_at))) {
    if (!reihenfolge.has(timeline.cycle.stack_item_id)) reihenfolge.set(timeline.cycle.stack_item_id, reihenfolge.size)
  }

  const proSubstanz = new Map<string, ZyklusAbschnitt[]>()
  for (const timeline of timelines) {
    // Die Tage des Zyklus gelten in seiner eigenen Zeitzone — Pausen ebenso.
    const zone = timeline.cycle.lifecycle_timezone ?? timeZone
    const { first, last } = cyclePeriod(timeline, zone)
    const letzter = last !== null && last < first ? first : last
    const startMs = tagMs(first)
    const endeMs = letzter ? tagMs(letzter) + TAG_MS : heuteEnde
    const pausen = timeline.pauses.map((pause): [number, number] => [
      tagMs(localDay(pause.paused_at, zone)),
      pause.ends_at ? tagMs(localDay(pause.ends_at, zone)) : heuteEnde,
    ])
    const stuecke = ohnePausen(startMs, endeMs, pausen)
    stuecke.forEach(([a, b], index) => {
      if (b <= fensterStart || a >= fensterEnde || b <= a) return
      // Laeuft nur, was bis heute reicht — nicht ein Stueck vor einer offenen Pause.
      const laeuft = letzter === null && b === endeMs
      const liste = proSubstanz.get(timeline.cycle.stack_item_id) ?? []
      liste.push({
        key: `${timeline.cycle.id}:${index}`,
        von: msTag(a),
        bis: laeuft ? null : msTag(b - TAG_MS),
        zyklusVon: first,
        start: Math.max(0, (a - fensterStart) / spanne),
        ende: Math.min(1, (b - fensterStart) / spanne),
      })
      proSubstanz.set(timeline.cycle.stack_item_id, liste)
    })
  }

  const alle = [...proSubstanz.entries()]
    .map(([stackItemId, abschnitte]) => ({
      stackItemId,
      substanz: namen.get(stackItemId) ?? '—',
      abschnitte: abschnitte.sort((a, b) => a.start - b.start),
    }))
    .sort((a, b) => a.abschnitte[0].start - b.abschnitte[0].start)
  const sichtbar = alle.slice(0, MAX_ZEILEN)

  // Bei mehr als fuenf Substanzen ueberhaupt teilen sich zwei denselben
  // Wunschplatz. Im Fenster stehen hoechstens fuenf Zeilen — die frueher
  // begonnene behaelt ihren Platz, die andere nimmt den naechsten freien.
  const farbe = new Map<string, number>()
  const belegt = new Set<number>()
  for (const zeile of sichtbar.slice().sort((a, b) => reihenfolge.get(a.stackItemId)! - reihenfolge.get(b.stackItemId)!)) {
    let platz = reihenfolge.get(zeile.stackItemId)! % FARBEN
    while (belegt.has(platz)) platz = (platz + 1) % FARBEN
    belegt.add(platz)
    farbe.set(zeile.stackItemId, platz)
  }

  return {
    zeilen: sichtbar.map(zeile => ({ ...zeile, farbe: farbe.get(zeile.stackItemId)! })),
    weitere: alle.length - sichtbar.length,
  }
}

/**
 * Was am Zeitpunkt `ts` laeuft: je Zeile der Abschnitt, der ihn enthaelt, und
 * die Zykluswoche (1 = erste Woche ab Zyklusbeginn). Reihenfolge wie die Zeilen.
 */
export function aktiveZyklen(
  zeilen: readonly ZyklusZeile[],
  fenster: { von: string; bis: string },
  ts: number,
): Array<{ zeile: ZyklusZeile; woche: number }> {
  const [start, ende] = achse(fenster)
  const anteil = (ts - start) / (ende - start)
  const treffer: Array<{ zeile: ZyklusZeile; woche: number }> = []
  for (const zeile of zeilen) {
    const abschnitt = zeile.abschnitte.find(a => anteil >= a.start && anteil < a.ende)
    if (!abschnitt) continue
    treffer.push({ zeile, woche: Math.floor((ts - tagMs(abschnitt.zyklusVon)) / (7 * TAG_MS)) + 1 })
  }
  return treffer
}
