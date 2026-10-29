/* global Deno */
/**
 * Anmelden mit Benutzername (docs/login/UEBERGABE.md 3.3). Supabase meldet
 * nur per E-Mail an: die Function schlägt die E-Mail zum Namen serverseitig
 * nach (supabase-login-name.sql) und meldet damit an. Zurück gehen nur die
 * Tokens der Sitzung, nie eine E-Mail-Adresse. Ein unbekannter Name bekommt
 * dieselbe Antwort wie ein falsches Passwort. Je Name höchstens 10
 * Fehlversuche in 15 Minuten; eine gelungene Anmeldung setzt den Zähler zurück
 * (supabase-login-name-fehlversuche.sql).
 *
 * Ohne JWT-Prüfung bereitstellen (wer sich anmeldet, hat noch keine Sitzung):
 *   supabase functions deploy login-name --no-verify-jwt
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { FALSCH, pruefeEingabe } from './logik.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const ohneSitzung = { auth: { persistSession: false, autoRefreshToken: false } }

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: FALSCH }, 401)
  }
  const eingabe = pruefeEingabe(body)
  if (!eingabe) return json({ error: FALSCH }, 401)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', ohneSitzung)

  const { data: erlaubt, error: limitFehler } = await admin.rpc('login_name_versuch', { p_name: eingabe.name })
  if (limitFehler) return json({ error: 'server_error' }, 500)
  if (!erlaubt) return json({ error: 'too_many' }, 429)

  // Gezählt wird nur, was scheitert: unbekannter Name oder falsches Passwort
  const falsch = async () => {
    await admin.rpc('login_name_fehlversuch', { p_name: eingabe.name })
    return json({ error: FALSCH }, 401)
  }

  const { data: email, error: suchFehler } = await admin.rpc('email_fuer_benutzername', { p_name: eingabe.name })
  if (suchFehler) return json({ error: 'server_error' }, 500)
  if (typeof email !== 'string' || !email) return falsch()

  const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', ohneSitzung)
  const { data, error } = await client.auth.signInWithPassword({ email, password: eingabe.passwort })
  if (error || !data.session) return falsch()
  await admin.rpc('login_name_erfolg', { p_name: eingabe.name })
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
})
