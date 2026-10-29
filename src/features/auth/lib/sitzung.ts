import { lies, schreib } from './speicher'

/**
 * „Angemeldet bleiben" (docs/login/UEBERGABE.md 3.3): ist es aus, gilt die
 * Sitzung nur bis zum nächsten App-Start. Ein App-Start ist ein neuer
 * Lauf ohne Markierung im sessionStorage — Neuladen im selben Lauf behält
 * die Sitzung, ein geschlossener Tab bzw. beendete Home-Bildschirm-App nicht.
 * Registrieren (und später Apple, Google, Face ID) bleibt immer angemeldet.
 */

const BLEIBEN = 'tyd.angemeldetBleiben'
const LAUF = 'tyd.appLaeuft'

export function merkeAngemeldetBleiben(bleiben: boolean) {
  schreib(BLEIBEN, bleiben ? null : '0')
  schreib(LAUF, '1', 'sitzung')
}

/**
 * Einmal beim Start: muss die gemerkte Sitzung weg? Setzt zugleich die
 * Markierung für diesen Lauf und vergisst den Wunsch, wenn er greift.
 */
export function abmeldenBeimStart(): boolean {
  const neuerLauf = !lies(LAUF, 'sitzung')
  schreib(LAUF, '1', 'sitzung')
  if (!neuerLauf || lies(BLEIBEN) !== '0') return false
  schreib(BLEIBEN, null)
  return true
}
