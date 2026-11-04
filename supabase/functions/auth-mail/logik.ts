/**
 * Vom Hook-Aufruf zu den Mails: wer bekommt was, in welcher Sprache. Rein, ohne Netz.
 * Aufbau des Aufrufs: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
 */
import { codeMail, gueltigBis, hinweisMail, type CodeArt, type HinweisArt, type Mail, type Sprache } from './vorlagen.ts'

export interface Versand {
  an: string
  mail: Mail
}

export interface Einstellungen {
  /** Gültigkeit der Codes in Minuten, wie im Dashboard (Email OTP Expiration) */
  minuten: number
  appUrl: string
  jetzt: Date
}

interface HookUser {
  email?: unknown
  new_email?: unknown
  user_metadata?: unknown
}

interface HookEmail {
  token?: unknown
  token_hash?: unknown
  token_new?: unknown
  email_action_type?: unknown
  old_email?: unknown
  provider?: unknown
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const istCode = (v: string) => /^\d{6,10}$/.test(v)

/**
 * Sprache aus den Konto-Metadaten (`sprache`, beim Registrieren gesetzt). Ältere Konten haben
 * keine: sie sind vor dem Start entstanden und deutsch.
 */
export function spracheVon(meta: unknown): Sprache {
  const s = meta && typeof meta === 'object' ? (meta as Record<string, unknown>).sprache : undefined
  if (typeof s === 'string' && s.toLowerCase().startsWith('en')) return 'en'
  return 'de'
}

const zeitzoneVon = (meta: unknown) =>
  meta && typeof meta === 'object' ? (meta as Record<string, unknown>).zeitzone : undefined

const ANBIETER: Record<string, string> = { apple: 'Apple', google: 'Google', email: 'E-Mail' }

const HINWEISE: Record<string, HinweisArt> = {
  password_changed_notification: 'passwort_geaendert',
  email_changed_notification: 'email_geaendert',
  identity_linked_notification: 'anmeldung_verknuepft',
  identity_unlinked_notification: 'anmeldung_entfernt',
  phone_changed_notification: 'konto_geaendert',
  mfa_factor_enrolled_notification: 'konto_geaendert',
  mfa_factor_unenrolled_notification: 'konto_geaendert',
}

const CODES: Record<string, CodeArt> = {
  signup: 'signup',
  invite: 'signup',
  recovery: 'recovery',
  reauthentication: 'reauthentication',
  magiclink: 'anmelden',
  email: 'anmelden',
}

/**
 * Knopf „In Hoku öffnen" (nur Registrieren und Passwort vergessen): die App öffnet sich über
 * diese Adresse (Universal Link / App Link, sonst die Web-App) und bestätigt mit `token_hash`
 * selbst — dasselbe wie der Code, nur ohne Tippen. Gegenstück: `linkAusAdresse` in der App.
 */
export function appLink(appUrl: string, art: CodeArt, tokenHash: string): string | null {
  if (art !== 'signup' && art !== 'recovery') return null
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(tokenHash)) return null
  return `${appUrl.replace(/\/+$/, '')}/auth?bestaetigen=${tokenHash}&art=${art}`
}

/** Liste der Mails, oder ein Fehlertext, wenn der Aufruf unbrauchbar ist. */
export function planeMails(payload: unknown, e: Einstellungen): Versand[] | string {
  if (!payload || typeof payload !== 'object') return 'payload'
  const { user, email_data } = payload as { user?: HookUser; email_data?: HookEmail }
  if (!user || !email_data) return 'payload'
  const art = text(email_data.email_action_type)
  const sprache = spracheVon(user.user_metadata)
  const bis = gueltigBis(e.jetzt, e.minuten, zeitzoneVon(user.user_metadata), sprache)
  const email = text(user.email)
  const code = (a: CodeArt, an: string, token: string, link: string | null = null): Versand | string =>
    !an ? 'empfaenger' : !istCode(token) ? 'token'
      : { an, mail: codeMail({ art: a, sprache, code: token, minuten: e.minuten, bis, appUrl: e.appUrl, link }) }

  if (art === 'email_change') {
    // Achtung, Supabase: `token` gehört zur bisherigen Adresse, `token_new` zur neuen.
    // Mit „Secure email change" kommen beide, sonst nur der neue.
    const neu = text(user.new_email)
    const tokenAlt = text(email_data.token), tokenNeu = text(email_data.token_new)
    const mails: Versand[] = []
    if (tokenAlt && tokenNeu) {
      const alt = code('email_change_alt', email, tokenAlt)
      if (typeof alt === 'string') return alt
      mails.push(alt)
    }
    const zielCode = tokenNeu || tokenAlt
    const ziel = code('email_change_neu', neu, zielCode)
    if (typeof ziel === 'string') return ziel
    mails.push(ziel)
    return mails
  }

  const codeArt = CODES[art]
  if (codeArt) {
    const v = code(codeArt, email, text(email_data.token), appLink(e.appUrl, codeArt, text(email_data.token_hash)))
    return typeof v === 'string' ? v : [v]
  }

  const hinweis = HINWEISE[art]
  if (hinweis) {
    // Nach einer Adressänderung geht der Hinweis an die alte Adresse
    const an = hinweis === 'email_geaendert' ? text(email_data.old_email) || email : email
    if (!an) return 'empfaenger'
    const p = text(email_data.provider).toLowerCase()
    return [{ an, mail: hinweisMail({ art: hinweis, sprache, anbieter: ANBIETER[p] ?? '', appUrl: e.appUrl }) }]
  }

  return 'art'
}
