/* global Deno */
// Etikett einer Substanz per Foto auslesen (My Stack, „Scannen").
// Gleiche Einwilligung wie der Befund-Import (profiles.ai_import_consent_at):
// ohne sie geht kein Bild an Anthropic. Zurueck kommen nur Name, Marke,
// Darreichungsform und Staerke — das Bild wird nicht gespeichert.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  ALLOWED_MIME_TYPES,
  LABEL_SCHEMA,
  MAX_UPLOAD_BYTES,
  RateLimiter,
  base64Bytes,
  consentCoversLabels,
  buildPrompt,
  cleanNames,
  extractJson,
  sanitizeLabel,
} from './prompt.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const ANTHROPIC_MODEL = 'claude-haiku-5-5'

// Kostenschutz je Nutzer: ein Scan ist ein Foto, kein Stapel.
const perMinutes = new RateLimiter(10, 10 * 60 * 1000)
const perDay = new RateLimiter(40, 24 * 60 * 60 * 1000)

type ExtractRequest = {
  file?: string
  mimeType?: string
  names?: unknown
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

  // Wie bei bloodwork-extract: hier durchgesetzt, auch fuer alte App-Versionen.
  // Eine Einwilligung von vor dem Etikett-Text galt nur Befunden.
  const { data: profil, error: profilError } = await supabase
    .from('profiles')
    .select('ai_import_consent_at')
    .eq('id', userId)
    .maybeSingle()
  if (profilError) return json({ error: 'server_error' }, 500)
  if (!consentCoversLabels(profil?.ai_import_consent_at)) return json({ error: 'consent_required' }, 403)

  let body: ExtractRequest
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const { file, mimeType } = body
  const names = cleanNames(body.names)
  if (!file || !mimeType || !names) return json({ error: 'invalid_body' }, 400)
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return json({ error: 'unsupported_type' }, 400)
  if (base64Bytes(file) > MAX_UPLOAD_BYTES) return json({ error: 'file_too_large' }, 413)

  // Erst beide pruefen, dann zaehlen: eine Absage verbraucht keinen Platz.
  if (!perMinutes.allows(userId) || !perDay.allows(userId)) return json({ error: 'rate_limit' }, 429)
  perMinutes.take(userId)
  perDay.take(userId)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'server_error' }, 500)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8192,
      // Ablesen, nicht nachdenken: niedriger Aufwand reicht und ist schneller.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: LABEL_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: file } },
            { type: 'text', text: buildPrompt(names) },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    // Keine Nutzerdaten ins Log, nur der Status.
    console.error('label-extract upstream status:', response.status)
    return json({ error: 'extraction_failed' }, 502)
  }

  const payload = await response.json()
  // Abgelehnt oder abgeschnitten heisst nicht „kein Etikett" — sonst riete die
  // App zu einem neuen Foto, das wieder genauso endet.
  if (payload?.stop_reason === 'refusal' || payload?.stop_reason === 'max_tokens') {
    return json({ error: 'extraction_failed' }, 502)
  }
  // Die Antwort kann mit Denkbloecken beginnen — der Text steht dahinter.
  const textBlock = Array.isArray(payload?.content)
    ? payload.content.find((block: { type?: string }) => block?.type === 'text')
    : null
  const label = sanitizeLabel(extractJson(typeof textBlock?.text === 'string' ? textBlock.text : ''))
  if (!label) return json({ error: 'no_label_found' }, 422)

  return json({ label })
})
