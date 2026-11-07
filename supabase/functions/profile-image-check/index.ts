/* global Deno */
/**
 * Bild-Check für Profil- und Titelbild (siehe check.ts). Die App ruft die
 * Funktion nach dem Hochladen und beim Öffnen des eigenen Profils mit
 * `{ kind: 'avatar' | 'cover' }`. Welches Bild geprüft wird, steht in
 * `profiles` (gelesen mit Dienstrechten) — nie in der Anfrage.
 *
 * Freigegeben → Status `approved` und die Objekt-ID der geprüften Datei; andere
 * dürfen genau diese Datei laden (Storage-Policy). Die id wird vor dem
 * Herunterladen gelesen; liegt beim Freigeben unter dem Namen eine andere
 * Datei, bleibt der Status `pending`.
 * Abgelehnt → Datei gelöscht, Pfad leer, Status `rejected` (die App zeigt den
 * Hinweis). Fehler jeder Art → Status bleibt `pending`, die App fragt später
 * wieder. Höchstens 20 Prüfungen je Nutzer und 24 Stunden; gezählt wird nur
 * der Zeitpunkt.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import {
  BUCKET, DAILY_LIMIT, MAX_IMAGE_BYTES, RESULT_SCHEMA,
  approveParams, buildPrompt, decide, parseKind, parseObjectId, resetsAt, shouldCheck, sniffImage, toBase64,
  type MediaStatus,
} from './check.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Ja/Nein auf einem Bild: Haiku reicht, wenig Denkaufwand (wie food-photo).
// Haiku hat keinen Server-Fallback bei Ablehnung — die gilt hier als „nicht zeigbar“.
const MODEL = 'claude-haiku-5-5'

/** Fehler beim Prüfen: nichts ändern, die App fragt beim nächsten Öffnen wieder. */
const offen = () => json({ status: 'pending' satisfies MediaStatus })

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  const kind = parseKind(body)
  if (!kind) return json({ error: 'invalid_body' }, 400)
  const pfadSpalte = `${kind}_path`
  const statusSpalte = `${kind}_status`

  const { data: profil, error: profilError } = await supabase
    .from('profiles').select(`${pfadSpalte}, ${statusSpalte}`).eq('id', userId).maybeSingle()
  if (profilError) return json({ error: 'server_error' }, 500)
  const zeile = (profil ?? {}) as Record<string, unknown>
  const pfad = zeile[pfadSpalte]
  const status = zeile[statusSpalte]
  // Nichts zu prüfen (kein Bild, schon geprüft): den Stand zurückgeben.
  if (!shouldCheck(pfad, status)) return json({ status: typeof status === 'string' ? status : null })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'server_error', status: 'pending' }, 500)

  // Nur Bilder des Nutzers selbst (erster Pfadteil = Nutzer-ID, wie die Storage-Policies).
  if (pfad.split('/')[0] !== userId) return offen()
  // Erst die id der Datei, dann der Inhalt: Ersetzt der Nutzer die Datei
  // dazwischen, passt die id beim Freigeben nicht mehr.
  const { data: idDaten, error: idFehler } = await supabase.rpc('profile_media_object_id', { p_name: pfad })
  const objektId = parseObjectId(idDaten)
  if (idFehler || !objektId) return offen()
  const { data: datei, error: ladeFehler } = await supabase.storage.from(BUCKET).download(pfad)
  if (ladeFehler || !datei) return offen()
  const bytes = new Uint8Array(await datei.arrayBuffer())
  const format = sniffImage(bytes)

  let neu: MediaStatus
  if (!format || bytes.length > MAX_IMAGE_BYTES) {
    // Kein Bild oder zu groß: so lässt es sich anderen ohnehin nicht zeigen.
    neu = 'rejected'
  } else {
    // Erst eintragen, dann zählen: auch gleichzeitige Anfragen kommen nicht über
    // das Limit. Wer drüber liegt, nimmt seinen Eintrag zurück (wie food-photo).
    const { data: claim, error: insertError } = await supabase
      .from('profile_image_checks').insert({ user_id: userId }).select('id').single()
    if (insertError || !claim) return json({ error: 'server_error', status: 'pending' }, 500)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recent, error: countError } = await supabase
      .from('profile_image_checks').select('id,created_at').eq('user_id', userId).gte('created_at', since)
      .order('created_at', { ascending: true })
    if (countError || (recent?.length ?? 0) > DAILY_LIMIT) {
      await supabase.from('profile_image_checks').delete().eq('id', claim.id)
      if (countError) return json({ error: 'server_error', status: 'pending' }, 500)
      return json({ error: 'rate_limit', status: 'pending', resetsAt: resetsAt(recent?.[0]?.created_at ?? null) }, 429)
    }

    const client = new Anthropic({ apiKey })
    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: RESULT_SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: format, data: toBase64(bytes) } },
            { type: 'text', text: buildPrompt(kind) },
          ],
        }],
      })
      const text = message.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
      neu = decide(message.stop_reason, text)
    } catch {
      return offen()
    }
  }

  if (neu === 'pending') return offen()

  if (neu === 'approved') {
    // In einem Schritt in der Datenbank: noch derselbe Pfad, noch pending und
    // unter dem Namen noch die geprüfte Datei — sonst wird nichts freigegeben.
    const { data: frei, error: freiFehler } = await supabase
      .rpc('profile_media_approve', approveParams(userId, kind, pfad, objektId))
    if (freiFehler || frei !== true) return offen()
    return json({ status: neu })
  }

  // Nur setzen, wenn noch dasselbe Bild hinterlegt ist (der Nutzer kann
  // inzwischen ein neues hochgeladen haben). Die Dienstrolle übergeht der
  // Trigger protect_profile_media_status nicht.
  const { data: geaendert, error: setzFehler } = await supabase
    .from('profiles').update({ [pfadSpalte]: null, [statusSpalte]: 'rejected' })
    .eq('id', userId).eq(pfadSpalte, pfad).eq(statusSpalte, 'pending').select('id')
  if (setzFehler) return offen()
  if (!geaendert?.length) return json({ status: 'pending' })

  // Pfad ist schon leer; scheitert das Löschen, bleibt die Datei unsichtbar
  // (die Storage-Policy gibt nur hinterlegte, freigegebene Dateien heraus).
  await supabase.storage.from(BUCKET).remove([pfad])
  return json({ status: neu })
})
