/* global Deno */
/**
 * Send Email Hook: Supabase Auth schickt jede Mail hierher, die Function verschickt sie über
 * Resend — auf Deutsch oder Englisch, mit Code statt Link (docs/registrierung/PLAN.md).
 *
 * Secrets (Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY          Resend-Schlüssel, nur Senden, nur Domain hokuhealth.app
 *   SEND_EMAIL_HOOK_SECRET  aus Authentication → Hooks (Form „v1,whsec_…")
 *   MAIL_FROM               optional, Standard „Hoku <hallo@hokuhealth.app>"
 *   MAIL_REPLY_TO           optional, wohin Antworten gehen
 *   OTP_MINUTEN             optional, Standard 15 (muss zur Einstellung „Email OTP Expiration" passen)
 *   APP_URL                 optional, Standard https://hokuhealth.app
 *
 * Ohne JWT-Prüfung bereitstellen (Supabase Auth ruft auf, geschützt über die Signatur):
 *   supabase functions deploy auth-mail --no-verify-jwt
 */
import { pruefeSignatur } from './signatur.ts'
import { planeMails } from './logik.ts'
import { LOGO } from './vorlagen.ts'

/** Supabase bricht den Hook nach 5 s ab; Resend bekommt höchstens so lange. */
const RESEND_LIMIT_MS = 4000

const fehler = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return fehler(405, 'method_not_allowed')

  const body = await request.text()
  const signatur = await pruefeSignatur(Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '', {
    id: request.headers.get('webhook-id'),
    zeit: request.headers.get('webhook-timestamp'),
    signatur: request.headers.get('webhook-signature'),
  }, body)
  if (signatur) return fehler(401, `signature_${signatur}`)

  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return fehler(400, 'payload')
  }

  const minuten = Number(Deno.env.get('OTP_MINUTEN') ?? '15')
  const appUrl = (Deno.env.get('APP_URL') ?? 'https://hokuhealth.app').replace(/\/+$/, '')
  const plan = planeMails(payload, {
    minuten: Number.isFinite(minuten) && minuten > 0 ? Math.round(minuten) : 15,
    appUrl,
    jetzt: new Date(),
  })
  if (typeof plan === 'string') return fehler(400, plan)

  const schluessel = Deno.env.get('RESEND_API_KEY') ?? ''
  if (!schluessel) return fehler(500, 'resend_key_missing')
  const from = Deno.env.get('MAIL_FROM') ?? 'Hoku <hallo@hokuhealth.app>'
  const replyTo = Deno.env.get('MAIL_REPLY_TO') ?? ''
  const webhookId = request.headers.get('webhook-id') ?? crypto.randomUUID()
  // Logo eingebettet (cid:), damit es auch Outlook ohne Klick zeigt; Resend holt die Datei selbst
  const logo = { filename: LOGO.datei, path: `${appUrl}${LOGO.pfad}`, content_type: 'image/png', content_id: LOGO.cid }

  // Beide Mails einer Adressänderung gleichzeitig, jede mit Zeitlimit: Supabase wartet auf den
  // Hook nur wenige Sekunden. Läuft er ab, meldet die App einen Fehler, obwohl die Mail noch
  // kommen könnte — deshalb lieber selbst abbrechen und sauber scheitern.
  const ergebnisse = await Promise.all(plan.map(({ an, mail }, i) =>
    fetch('https://api.resend.com/emails', {
      signal: AbortSignal.timeout(RESEND_LIMIT_MS),
      method: 'POST',
      headers: {
        Authorization: `Bearer ${schluessel}`,
        'Content-Type': 'application/json',
        // Ruft Supabase nach einem Fehler noch einmal auf, geht dieselbe Mail nicht doppelt raus
        'Idempotency-Key': `${webhookId}-${i}`,
      },
      body: JSON.stringify({
        from,
        to: [an],
        subject: mail.betreff,
        html: mail.html,
        text: mail.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        attachments: [logo],
      }),
    }).catch(() => null)))
  const kaputt = ergebnisse.find(antwort => !antwort?.ok)
  // Nur Status, kein Inhalt: in Resend-Fehlern steht die Empfängeradresse
  if (kaputt !== undefined) return fehler(502, `resend_${kaputt?.status ?? 'netz'}`)

  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
