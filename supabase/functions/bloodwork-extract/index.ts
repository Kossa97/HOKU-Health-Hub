/* global Deno */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  ALLOWED_MIME_TYPES,
  IMPORT_LIMIT,
  MAX_UPLOAD_BYTES,
  RATE_WINDOW_DAYS,
  base64Bytes,
  buildPrompt,
  extractJson,
  resetsAt,
} from './prompt.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

type ExtractRequest = {
  file?: string
  mimeType?: string
  markerNames?: string[]
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

  // Ohne ausdrueckliche Einwilligung (profiles.ai_import_consent_at) geht keine
  // Datei an Anthropic — Apple 5.1.2(i), Art. 9 DSGVO. Die App fragt vorher;
  // hier wird es durchgesetzt, auch fuer alte App-Versionen.
  const { data: profil, error: profilError } = await supabase
    .from('profiles')
    .select('ai_import_consent_at')
    .eq('id', userId)
    .maybeSingle()
  if (profilError) return json({ error: 'server_error' }, 500)
  if (!profil?.ai_import_consent_at) return json({ error: 'consent_required' }, 403)

  let body: ExtractRequest
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const { file, mimeType, markerNames } = body
  if (!file || !mimeType) return json({ error: 'invalid_body' }, 400)
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return json({ error: 'unsupported_type' }, 400)
  if (!Array.isArray(markerNames) || markerNames.length === 0) return json({ error: 'invalid_body' }, 400)
  if (base64Bytes(file) > MAX_UPLOAD_BYTES) return json({ error: 'file_too_large' }, 413)

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - RATE_WINDOW_DAYS)

  const { data: recent, error: countError } = await supabase
    .from('bloodwork_reports')
    .select('created_at')
    .eq('user_id', userId)
    .eq('source', 'import')
    .gte('created_at', windowStart.toISOString())
    .order('created_at', { ascending: true })

  if (countError) return json({ error: 'server_error' }, 500)

  if ((recent?.length ?? 0) >= IMPORT_LIMIT) {
    return json({ error: 'rate_limit', resetsAt: resetsAt(recent?.[0]?.created_at ?? null) }, 429)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'server_error' }, 500)

  const documentBlock =
    mimeType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: file } }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [
        { role: 'user', content: [documentBlock, { type: 'text', text: buildPrompt(markerNames) }] },
      ],
    }),
  })

  if (!response.ok) return json({ error: 'extraction_failed' }, 502)

  const payload = await response.json()
  const text: string = payload?.content?.[0]?.text ?? ''
  const parsed = extractJson(text)

  if (!parsed || typeof parsed !== 'object') return json({ error: 'extraction_failed' }, 422)

  const result = parsed as { tested_at?: unknown; values?: unknown }
  if (!result.tested_at || !Array.isArray(result.values) || result.values.length === 0) {
    return json({ error: 'no_bloodwork_found' }, 422)
  }

  // matched serverseitig setzen, damit das Modell es nicht erfinden kann
  const known = new Set(markerNames.map(n => n.toLowerCase()))
  const values = (result.values as Array<Record<string, unknown>>).map(v => ({
    ...v,
    matched: typeof v.marker === 'string' && known.has(v.marker.trim().toLowerCase()),
  }))

  return json({ ...result, values })
})
