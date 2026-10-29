/**
 * Wann Hoku sich auf der Anmeldung von selbst meldet (Spec 2026-10-29, Hoku führt).
 *
 * Reine Zeitlogik ohne Uhr und DOM: Die Seite hält je Ansicht eine Stille fest
 * (seit wann nichts passiert ist, wie viele Hinweise schon kamen, ob er geklopft hat)
 * und fragt regelmäßig, was jetzt fällig ist. Jede Eingabe beginnt eine neue Stille.
 */
import type { DotTextKey } from '../../dot/texte'
import type { LoginFeld, RegFeld } from './pruefung'

export type HinweisZiel = 'start-anmelden' | 'start-registrieren' | LoginFeld | RegFeld | 'absenden'
export type HinweisSchritt = { art: 'hinweis'; ziel: HinweisZiel; text: DotTextKey } | { art: 'klopfen' }
export interface Stille { ansicht: 'start' | 'login' | 'register'; seit: number; gezeigt: number; geklopft: boolean }

/** Startseite: zwei Hinweise nach 6 und 12 s; Formulare: einer nach 10 s; Klopfen nach 30 s (ms ab Beginn der Stille). */
export const HINWEIS_MS = { start: [6000, 12000], form: 10000, klopfen: 30000 }

const LOGIN_TEXT: Partial<Record<HinweisZiel, DotTextKey>> = {
  kennung: 'login_tipp_email', passwort: 'login_tipp_passwort', absenden: 'login_tipp_anmelden',
}
const REG_TEXT: Partial<Record<HinweisZiel, DotTextKey>> = {
  benutzer: 'login_tipp_name', email: 'login_tipp_reg_email', passwort: 'login_tipp_reg_passwort',
  passwort2: 'login_tipp_passwort2', zustimmung: 'login_tipp_zustimmung', absenden: 'login_tipp_konto',
}

/** Was jetzt fällig ist, oder null. `leer` ist das Ziel im Formular (erstes leeres Feld oder der Absende-Knopf). */
export function faellig(s: Stille, jetzt: number, leer: HinweisZiel | null): HinweisSchritt | null {
  const dauer = jetzt - s.seit
  if (s.ansicht === 'start') {
    if (s.gezeigt === 0 && dauer >= HINWEIS_MS.start[0]) return { art: 'hinweis', ziel: 'start-anmelden', text: 'login_start_anmelden' }
    if (s.gezeigt === 1 && dauer >= HINWEIS_MS.start[1]) return { art: 'hinweis', ziel: 'start-registrieren', text: 'login_start_registrieren' }
  } else if (s.gezeigt === 0 && dauer >= HINWEIS_MS.form && leer) {
    const text = (s.ansicht === 'login' ? LOGIN_TEXT : REG_TEXT)[leer]
    if (text) return { art: 'hinweis', ziel: leer, text }
  }
  if (!s.geklopft && dauer >= HINWEIS_MS.klopfen) return { art: 'klopfen' }
  return null
}

/** Erstes leeres Feld in Lesereihenfolge, sonst der Absende-Knopf. */
export function erstesLeeres(gefuellt: Partial<Record<LoginFeld | RegFeld, boolean>>, reihenfolge: (LoginFeld | RegFeld)[]): HinweisZiel {
  return reihenfolge.find(f => !gefuellt[f]) ?? 'absenden'
}
