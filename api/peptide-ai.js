// api/peptide-ai.js — Vercel Serverless Function
//
// Nur für Admins: erstellt oder überarbeitet Einträge der Peptid-Bibliothek mit
// Claude. Ohne Prüfung wäre das ein offener Zugang zum Anthropic-Schlüssel des
// Betreibers (Security-Audit 2026-11). Deshalb: Supabase-Token verifizieren,
// is_admin aus der Datenbank lesen, Eingaben begrenzen, kein CORS (die Seite
// ruft same-origin auf), und nach außen nur feste Fehlercodes.

// Grenzen für die Eingabe: ein Name ist kurz, ein bestehendes Profil ein paar KB.
export const MAX_NAME = 100
export const MAX_EXISTING = 20_000
// Vor dem Parsen: mehr als das ist nie ein legitimer Aufruf.
const MAX_BODY = 64_000

// Immer JSON zurückgeben, niemals HTML-Fehlerseite
function sendJSON(res, status, obj) {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = status
    res.end(JSON.stringify(obj))
  }
}

class BodyTooLarge extends Error {}

// Body lesen — Fallback falls req.body nicht automatisch geparst wird.
// Die Grenze zählt Bytes, und nach dem Abbruch wird nichts mehr gesammelt.
async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body !== 'string') return req.body
    if (Buffer.byteLength(req.body) > MAX_BODY) throw new BodyTooLarge()
    return JSON.parse(req.body)
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0
    let fertig = false
    req.on('data', (chunk) => {
      if (fertig) return
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buf.length
      if (bytes > MAX_BODY) {
        fertig = true
        reject(new BodyTooLarge())
        req.destroy?.()
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => {
      if (fertig) return
      fertig = true
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { resolve({}) }
    })
    req.on('error', () => { if (!fertig) { fertig = true; resolve({}) } })
  })
}

function bearer(req) {
  const h = req.headers?.authorization ?? req.headers?.Authorization
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return null
  const t = h.slice(7).trim()
  return t || null
}

// Token bei Supabase prüfen und is_admin mit dem Service-Key lesen.
// Rückgabe: 'ok' | 'unauthorized' | 'forbidden' | 'error'
async function adminCheck(token, url, serviceKey) {
  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  })
  // Nur 401/403 heißt „Token ungültig“; 429 und 5xx sind ein Ausfall bei Supabase
  if (userRes.status === 401 || userRes.status === 403) return 'unauthorized'
  if (!userRes.ok) {
    console.error('peptide-ai: auth/v1/user', userRes.status)
    return 'error'
  }
  const user = await userRes.json()
  if (typeof user?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id)) return 'unauthorized'

  const profRes = await fetch(
    `${url}/rest/v1/profiles?id=eq.${user.id}&select=is_admin`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
  )
  if (!profRes.ok) {
    console.error('peptide-ai: profiles', profRes.status)
    return 'error'
  }
  const rows = await profRes.json()
  return Array.isArray(rows) && rows[0]?.is_admin === true ? 'ok' : 'forbidden'
}

function buildCreatePrompt(name) {
  return `Du bist ein wissenschaftlicher Forschungsassistent. Erstelle ein umfassendes, wissenschaftlich korrektes Forschungsprofil für das Peptid: ${name}

WICHTIG — NAMENSKORREKTUR:
Der Nutzer hat möglicherweise den Namen falsch geschrieben oder unvollständig eingegeben.
Erkenne das Peptid anhand des eingegebenen Namens und verwende IMMER den korrekten offiziellen Namen.
Beispiele: "Retatrutid" → "Retatrutide", "BPC157" → "BPC-157", "Tirzepatide" → "Tirzepatid"

PFLICHTREGELN:
- Alle Texte auf DEUTSCH (außer pubmed_query und tags)
- Neutrale wissenschaftliche Sprache, KEINE Therapieempfehlungen
- Dosierungen NUR aus veröffentlichten Studien (nicht "empfohlen")
- Formulierungen: "wurde untersucht für", "in Studien beobachtet", "potenzielle Effekte"
- Ehrliche Evidenzbewertung, nicht übertreiben

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt, ohne Text davor oder danach:

{
  "slug": "kleinbuchstaben-bindestrich",
  "name": "Korrekter offizieller Kurzname",
  "full_name": "Vollständiger wissenschaftlicher Name oder null",
  "category": "heilung",
  "tldr": "1-2 Sätze neutrale Zusammenfassung.",
  "mechanism": "Detaillierter Wirkmechanismus: Rezeptoren, Signalwege.",
  "benefits": ["Forschungsbereich 1", "Forschungsbereich 2"],
  "research_dosage": "Dosierungen aus publizierten Studien mit Spezies und Route.",
  "half_life": "Halbwertszeit.",
  "administration": ["Verabreichungsweg 1"],
  "research_status": "preclinical",
  "side_effects": ["Berichtete Nebenwirkung 1"],
  "contraindications": ["Kontraindikation 1"],
  "evidence_human": "none",
  "evidence_animal": "none",
  "evidence_clinical": "none",
  "evidence_score": 1,
  "research_gaps": ["Wissenslücke 1", "Wissenslücke 2"],
  "pubmed_query": "english pubmed query",
  "tags": ["Tag1", "Tag2", "Tag3"]
}

category: heilung | wachstumshormon | nootropikum | stoffwechsel | anti_aging | sexualgesundheit
research_status: preclinical | phase_1 | phase_2 | approved
evidence_human: none | limited | moderate | strong
evidence_animal: none | limited | moderate | strong
evidence_clinical: none | sparse | moderate | extensive
evidence_score: Ganzzahl 1-10
tags: 3-6 kurze Schlagwörter auf Deutsch, z.B. ["GLP-1", "Gewichtsverlust", "Zugelassen", "Muskelaufbau"]`
}

function buildUpdatePrompt(existing) {
  return `Du bist ein wissenschaftlicher Forschungsassistent. Aktualisiere und verbessere dieses Peptid-Forschungsprofil.

BESTEHENDES PROFIL:
${JSON.stringify(existing, null, 2)}

PFLICHTREGELN:
- Alle Texte auf DEUTSCH
- Neutrale wissenschaftliche Sprache ohne Therapieempfehlungen
- Verbessere Formulierungen wo nötig

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt:

{
  "tldr": "...",
  "mechanism": "...",
  "benefits": [...],
  "research_dosage": "...",
  "half_life": "...",
  "administration": [...],
  "research_status": "...",
  "side_effects": [...],
  "contraindications": [...],
  "evidence_human": "none|limited|moderate|strong",
  "evidence_animal": "none|limited|moderate|strong",
  "evidence_clinical": "none|sparse|moderate|extensive",
  "evidence_score": 1,
  "research_gaps": [...],
  "tags": ["Tag1", "Tag2"]
}

tags: 3-6 kurze Schlagwörter auf Deutsch`
}

export default async function handler(req, res) {
  // Alles in einem großen try-catch — garantiert JSON zurück
  try {
    if (req.method !== 'POST') {
      sendJSON(res, 405, { error: 'method_not_allowed' })
      return
    }

    const token = bearer(req)
    if (!token) {
      sendJSON(res, 401, { error: 'unauthorized' })
      return
    }

    // ANTHROPIC_API_KEY statt VITE_-Prefix: VITE_-Variablen landen im Client-Bundle,
    // sobald sie irgendwo per import.meta.env referenziert werden. Fallback auf den
    // alten Namen, bis die Vercel-Env-Variable umbenannt ist.
    const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_KEY
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
    if (!apiKey || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('peptide-ai: Env fehlt', {
        anthropic: !!apiKey, url: !!SUPABASE_URL, service: !!SUPABASE_SERVICE_KEY,
      })
      sendJSON(res, 500, { error: 'server_config' })
      return
    }

    const check = await adminCheck(token, SUPABASE_URL, SUPABASE_SERVICE_KEY)
    if (check !== 'ok') {
      const status = check === 'unauthorized' ? 401 : check === 'forbidden' ? 403 : 503
      sendJSON(res, status, { error: check })
      return
    }

    let body
    try {
      body = await readBody(req)
    } catch (err) {
      sendJSON(res, err instanceof BodyTooLarge ? 413 : 400, {
        error: err instanceof BodyTooLarge ? 'too_large' : 'bad_request',
      })
      return
    }
    const action   = body?.action
    const name     = body?.name
    const existing = body?.existing

    let prompt
    if (action === 'create') {
      if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME) {
        sendJSON(res, 400, { error: 'invalid_name' })
        return
      }
      prompt = buildCreatePrompt(name.trim())
    } else if (action === 'update') {
      if (!existing || typeof existing !== 'object' || Array.isArray(existing)
        || JSON.stringify(existing).length > MAX_EXISTING) {
        sendJSON(res, 400, { error: 'invalid_existing' })
        return
      }
      prompt = buildUpdatePrompt(existing)
    } else {
      sendJSON(res, 400, { error: 'invalid_action' })
      return
    }

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const detail = await aiRes.text()
      console.error('peptide-ai: Anthropic', aiRes.status, detail.slice(0, 300))
      sendJSON(res, 502, { error: 'ai_failed' })
      return
    }

    const aiData = await aiRes.json()
    const text = (aiData.content?.[0]?.text) ?? ''
    const match = text.match(/\{[\s\S]*\}/)

    if (!match) {
      console.error('peptide-ai: kein JSON in der Antwort', text.slice(0, 300))
      sendJSON(res, 502, { error: 'ai_no_json' })
      return
    }

    let result
    try {
      result = JSON.parse(match[0])
    } catch {
      console.error('peptide-ai: JSON in der Antwort kaputt', match[0].slice(0, 300))
      sendJSON(res, 502, { error: 'ai_no_json' })
      return
    }
    sendJSON(res, 200, { result })

  } catch (err) {
    console.error('peptide-ai:', err)
    sendJSON(res, 500, { error: 'internal' })
  }
}
