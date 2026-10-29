/* global Deno */
/**
 * Dot, der KI-Coach (siehe prompt.ts). Prüft Anmeldung, Zugang (Pro oder
 * Tester), Einwilligung (profiles.coach_consent_at) und Tageslimit, dann
 * fragt Claude. Meldungen zu Einnahmen („vergessen", „erst um 22 Uhr") und
 * vorbereitete Substanzen gibt sie geprüft an die App weiter, die sie
 * ausführt bzw. zum Bestätigen öffnet. Frage, Antwort und Nutzerdaten werden
 * nirgends gespeichert; gezählt wird nur die Zahl der Fragen je Tag (coach_usage).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import { DAILY_LIMIT, SYSTEM_PROMPT, WERKZEUGE, hatZugang, pruefeAnfrage, pruefeAnlagen, pruefeMeldungen, rahmen } from './prompt.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Das aktuelle Opus mit wenig Denkaufwand: Chat-Antworten sind kurz, aber sie
// berühren Gesundheitsdaten und harte Grenzen (keine Dosis, keine Diagnose).
// Lehnt das Modell ab, springt serverseitig das passende Ersatzmodell ein.
const MODEL = 'claude-opus-5-5'

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
  const user = userData.user

  const { data: profil, error: profilError } = await supabase
    .from('profiles').select('coach_consent_at, pro_until, is_admin').eq('id', user.id).maybeSingle()
  if (profilError) return json({ error: 'server_error' }, 500)
  if (!hatZugang(profil)) return json({ error: 'no_access' }, 403)
  if (!profil?.coach_consent_at) return json({ error: 'consent_required' }, 403)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  const anfrage = pruefeAnfrage(body)
  if (!anfrage) return json({ error: 'invalid_body' }, 400)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'server_error' }, 500)

  // Gezählt wird vor dem Aufruf, weil auch ein fehlgeschlagener kostet.
  // Die Datenbank zählt atomar hoch und gibt null zurück, wenn das Limit erreicht ist.
  const { data: zaehler, error: zaehlFehler } = await supabase.rpc('coach_zaehlen', { p_user: user.id, p_limit: DAILY_LIMIT })
  if (zaehlFehler) return json({ error: 'server_error' }, 500)
  if (zaehler === null) return json({ error: 'limit_reached' }, 429)

  const verlauf: Anthropic.Beta.BetaMessageParam[] = anfrage.nachrichten.map((n, i) => {
    const letzte = i === anfrage.nachrichten.length - 1
    if (n.rolle === 'dot') return { role: 'assistant', content: n.text }
    // Die aktuelle Frage bekommt Seite, Sprache und Nutzerdaten davor
    return letzte
      ? { role: 'user', content: [{ type: 'text', text: rahmen(anfrage) }, { type: 'text', text: n.text }] }
      : { role: 'user', content: n.text }
  })

  const client = new Anthropic({ apiKey })
  let message: Anthropic.Beta.BetaMessage
  try {
    message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      // Die App führt Meldungen selbst aus; ein zweiter Rundgang mit dem
      // Ergebnis ist nicht nötig, die Bestätigung schreibt die App
      tools: WERKZEUGE as unknown as Anthropic.Beta.BetaTool[],
      tool_choice: { type: 'auto' },
      messages: verlauf,
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 503)
    if (error instanceof Anthropic.APIError) return json({ error: 'server_error' }, 502)
    return json({ error: 'server_error' }, 502)
  }

  if (message.stop_reason === 'refusal') return json({ error: 'refused' }, 422)
  const antwort = message.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('').trim()
  const meldungen = pruefeMeldungen(message.content)
  const anlagen = pruefeAnlagen(message.content)
  if (!antwort && meldungen.length === 0 && anlagen.length === 0) return json({ error: 'server_error' }, 502)

  return json({ antwort, meldungen, anlagen, verbleibend: Math.max(0, DAILY_LIMIT - Number(zaehler)) })
})
