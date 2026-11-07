// Auswahl und Abgleich: was die Nacht gefunden hat gegen das Gespeicherte halten,
// und sonntags 3–5 Funde fürs Wochen-Update wählen. Reines TypeScript.

import { wochentag } from './zeit.ts'
import type { Datenlage, Fund } from './typen.ts'

export interface Gespeichert {
  id: string
  schluessel: string
  datenlage: Datenlage
  gueltig: boolean
  gemeldet_datenlage: Datenlage | null
  ausgeblendet: boolean
}

export function abgleich(
  alt: Gespeichert[],
  neu: Fund[],
): { einfuegen: Fund[]; aktualisieren: { id: string; fund: Fund }[]; ungueltig: string[] } {
  const idJeSchluessel = new Map(alt.map((a) => [a.schluessel, a.id]))
  const gefunden = new Set(neu.map((f) => f.schluessel))
  const einfuegen: Fund[] = []
  const aktualisieren: { id: string; fund: Fund }[] = []
  for (const fund of neu) {
    const id = idJeSchluessel.get(fund.schluessel)
    if (id === undefined) einfuegen.push(fund)
    else aktualisieren.push({ id, fund })
  }
  const ungueltig = alt.filter((a) => a.gueltig && !gefunden.has(a.schluessel)).map((a) => a.id)
  return { einfuegen, aktualisieren, ungueltig }
}

const MAX_WOCHE = 5
const MAX_KRITISCH = 2

type Kandidat = { id: string; fund: Fund; gespeichert: Gespeichert }

function zulaessig({ fund, gespeichert }: Kandidat): boolean {
  if (!gespeichert.gueltig || gespeichert.ausgeblendet) return false
  const gemeldet = gespeichert.gemeldet_datenlage
  return gemeldet === null || (gemeldet === 'hinweis' && fund.datenlage === 'deutlich')
}

export function waehleWoche(kandidaten: Kandidat[]): string[] {
  const sortiert = kandidaten
    .filter(zulaessig)
    .sort((a, b) => b.fund.staerke - a.fund.staerke || (a.fund.schluessel < b.fund.schluessel ? -1 : a.fund.schluessel > b.fund.schluessel ? 1 : 0))

  const gewaehlt: Kandidat[] = []
  let kritisch = 0
  for (const kand of sortiert) {
    if (gewaehlt.length >= MAX_WOCHE) break
    if (kand.fund.richtung === 'kritisch') {
      if (kritisch >= MAX_KRITISCH) continue
      kritisch++
    }
    gewaehlt.push(kand)
  }

  if (!gewaehlt.some((k) => k.fund.richtung === 'positiv')) {
    const positiv = sortiert.find((k) => k.fund.richtung === 'positiv')
    if (positiv) {
      if (gewaehlt.length >= MAX_WOCHE) gewaehlt[gewaehlt.length - 1] = positiv
      else gewaehlt.push(positiv)
    }
  }
  return gewaehlt.map((k) => k.id)
}

export function istSonntagLauf(heute: string): boolean {
  return wochentag(heute) === 0
}

const wandUhren = new Map<string, Intl.DateTimeFormat>()

/** Zonenversatz in ms zu UTC am Zeitpunkt `ms` (Ost positiv). */
function zonenversatz(ms: number, zone: string): number {
  let f = wandUhren.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    })
    wandUhren.set(zone, f)
  }
  const t: Record<string, number> = {}
  for (const p of f.formatToParts(new Date(ms))) if (p.type !== 'literal') t[p.type] = Number(p.value)
  const wand = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second)
  return wand - Math.floor(ms / 1000) * 1000
}

/** Der Zeitpunkt, an dem die Wanduhr in `zone` am Tag `heute` 19:00 zeigt (ISO, UTC). */
export function sichtbarAb(heute: string, zone: string): string {
  const wand = new Date(`${heute}T19:00:00Z`).getTime()
  // Zweimal nachziehen: der Versatz hängt vom Zeitpunkt ab (Sommer-/Winterzeit).
  let ms = wand - zonenversatz(wand, zone)
  ms = wand - zonenversatz(ms, zone)
  return new Date(ms).toISOString()
}
