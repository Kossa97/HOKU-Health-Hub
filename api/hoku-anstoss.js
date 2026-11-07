// api/hoku-anstoss.js — Vercel Cron (täglich 02:00 UTC, siehe vercel.json).
// Stößt die Edge Function `erkenntnisse` an und folgt ihrer Seitenführung (`weiter`),
// höchstens MAX_AUFRUFE-mal. Gibt nur Zähler zurück, nie Inhalte.

const MAX_AUFRUFE = 20

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  const antworten = (status, body) => res.status(status).end(JSON.stringify(body))

  const cronSecret = (req.headers['authorization'] ?? '').replace('Bearer ', '')
  // Ohne gesetztes CRON_SECRET kommt niemand durch: dieser Aufruf löst Schreibzugriffe aus.
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return antworten(401, { error: 'Unauthorized' })
  }

  const { SUPABASE_URL, HOKU_ANSTOSS_SECRET } = process.env
  const missing = [!SUPABASE_URL && 'SUPABASE_URL', !HOKU_ANSTOSS_SECRET && 'HOKU_ANSTOSS_SECRET'].filter(Boolean)
  if (missing.length) return antworten(500, { error: `Missing: ${missing.join(', ')}` })

  let aufrufe = 0
  let bearbeitet = 0
  let nach = null
  while (aufrufe < MAX_AUFRUFE) {
    aufrufe += 1
    let daten
    try {
      const antwort = await fetch(`${SUPABASE_URL}/functions/v1/erkenntnisse`, {
        method: 'POST',
        headers: { 'x-hoku-secret': HOKU_ANSTOSS_SECRET, 'x-region': 'eu-west-1', 'Content-Type': 'application/json' },
        body: JSON.stringify(nach ? { nach } : {}),
      })
      if (!antwort.ok) return antworten(502, { aufrufe, bearbeitet })
      daten = await antwort.json()
    } catch {
      return antworten(502, { aufrufe, bearbeitet })
    }
    if (typeof daten?.bearbeitet !== 'number' || !(daten.weiter === null || typeof daten.weiter === 'string')) {
      return antworten(502, { aufrufe, bearbeitet })
    }
    bearbeitet += daten.bearbeitet
    if (daten.weiter === null) break
    nach = daten.weiter
  }
  return antworten(200, { aufrufe, bearbeitet })
}
