// Zeit- und Kalenderrechnung. Zonen laufen über Intl, nie über die Prozesszeitzone.
// Kalendertage (YYYY-MM-DD) werden intern in UTC gerechnet und sind zonenunabhängig.

const formate = new Map<string, Intl.DateTimeFormat>()

function teile(iso: string, zone: string): Record<string, string> {
  let f = formate.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    })
    formate.set(zone, f)
  }
  const werte: Record<string, string> = {}
  for (const t of f.formatToParts(new Date(iso))) werte[t.type] = t.value
  return werte
}

/** Lokaler Kalendertag eines Zeitpunkts, z. B. '2026-11-01'. */
export function lokalerTag(iso: string, zone: string): string {
  const t = teile(iso, zone)
  return `${t.year}-${t.month}-${t.day}`
}

/** Lokale Stunde 0..23 eines Zeitpunkts. */
export function lokaleStunde(iso: string, zone: string): number {
  return Number(teile(iso, zone).hour)
}

function alsUtc(datum: string): Date {
  return new Date(`${datum}T00:00:00Z`)
}

/** Kalendertag um n Tage verschoben (n darf negativ sein). */
export function tagePlus(datum: string, n: number): string {
  const d = alsUtc(datum)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Alle Tage von `von` bis `bis`, beide inklusive, aufsteigend. */
export function tageZwischen(von: string, bis: string): string[] {
  const tage: string[] = []
  for (let t = von; t <= bis; t = tagePlus(t, 1)) tage.push(t)
  return tage
}

/** Wochentag eines Kalendertags, 0 = Sonntag. */
export function wochentag(datum: string): number {
  return alsUtc(datum).getUTCDay()
}
