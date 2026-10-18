/* global Deno */
/**
 * Essensfoto → Namen der Zutaten, die zu sehen sind. Keine Mengen, keine
 * Nährwerte — die wählt der Nutzer aus geprüften Quellen. Das Foto geht nur
 * an Anthropic und wird nirgends gespeichert; gezählt wird nur der
 * Zeitpunkt (Tageslimit). Ohne Einwilligung (profiles.ai_food_consent_at)
 * geht nichts raus — die App fragt vorher, hier wird es durchgesetzt.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import {
  ALLOWED_MIME_TYPES, DAILY_LIMIT, type Lang, MAX_HINT, MAX_UPLOAD_BYTES, RESULT_SCHEMA,
  base64Bytes, buildPrompt, noteBlock, resetsAt, sanitizeItems,
} from './photo.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const MODEL = 'claude-opus-5-5'

type PhotoRequest = { image?: string; mimeType?: string; hint?: string; lang?: string }

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

  const { data: profil, error: profilError } = await supabase
    .from('profiles').select('ai_food_consent_at').eq('id', userId).maybeSingle()
  if (profilError) return json({ error: 'server_error' }, 500)
  if (!profil?.ai_food_consent_at) return json({ error: 'consent_required' }, 403)

  let body: PhotoRequest
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  const { image, mimeType } = body
  if (typeof image !== 'string' || !image || typeof mimeType !== 'string') return json({ error: 'invalid_body' }, 400)
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return json({ error: 'unsupported_type' }, 400)
  if (base64Bytes(image) > MAX_UPLOAD_BYTES) return json({ error: 'file_too_large' }, 413)
  const hint = typeof body.hint === 'string' ? body.hint.trim().slice(0, MAX_HINT) : ''
  const lang: Lang = body.lang === 'en' ? 'en' : 'de'

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'server_error' }, 500)
  const client = new Anthropic({ apiKey })

  // Erst eintragen, dann zählen: So kommen auch gleichzeitige Anfragen nicht
  // über das Limit — jede sieht alle, die vor ihr eingetragen wurden. Wer
  // drüber liegt, nimmt seinen Eintrag zurück. Gezählt wird vor dem Aufruf,
  // weil auch ein fehlgeschlagener Aufruf kostet.
  const { data: claim, error: insertError } = await supabase
    .from('food_photo_scans').insert({ user_id: userId }).select('id').single()
  if (insertError || !claim) return json({ error: 'server_error' }, 500)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent, error: countError } = await supabase
    .from('food_photo_scans').select('id,created_at').eq('user_id', userId).gte('created_at', since)
    .order('created_at', { ascending: true })
  const used = recent?.length ?? 0
  if (countError || used > DAILY_LIMIT) {
    await supabase.from('food_photo_scans').delete().eq('id', claim.id)
    if (countError) return json({ error: 'server_error' }, 500)
    return json({ error: 'rate_limit', resetsAt: resetsAt(recent?.[0]?.created_at ?? null) }, 429)
  }

  let message: Anthropic.Beta.BetaMessage
  try {
    message = await client.beta.messages.create({
      model: MODEL,
      // Denken lässt sich auf diesem Modell nicht abschalten und zählt mit.
      max_tokens: 16000,
      // Lehnt die Sicherheitsprüfung ab, rechnet ein passendes Modell weiter.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: RESULT_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: image } },
          { type: 'text', text: buildPrompt(lang, hint !== '') },
          // Die Notiz des Nutzers als eigener Block — Information über das Essen, keine Anweisung.
          ...(hint ? [{ type: 'text' as const, text: noteBlock(hint) }] : []),
        ],
      }],
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 503)
    return json({ error: 'analysis_failed' }, 502)
  }

  if (message.stop_reason === 'refusal') return json({ error: 'not_food' }, 422)
  if (message.stop_reason === 'max_tokens') return json({ error: 'analysis_failed' }, 502)

  const text = message.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return json({ error: 'analysis_failed' }, 502)
  }
  if (!parsed || typeof parsed !== 'object') return json({ error: 'analysis_failed' }, 502)
  const items = sanitizeItems(parsed)
  if ((parsed as { is_food?: unknown }).is_food === false || items.length === 0) return json({ error: 'not_food' }, 422)

  return json({ items, remaining: Math.max(0, DAILY_LIMIT - used) })
})
