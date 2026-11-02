/**
 * Meldungen, mit denen Browser eine Anfrage melden, die das Netz nie erreicht
 * hat (kein Netz, Verbindung abgebrochen) — Chrome, Safari, Firefox, so wie
 * fetch sie wirft. Auch die Fehlerbehandlung (monitoring.ts) nutzt diese
 * Liste, damit beide dasselbe als Netzfehler werten.
 */
export const NETWORK_FAILURE_MESSAGES: readonly RegExp[] = [
  /^Failed to fetch$/,
  /^Load failed$/,
  /^NetworkError when attempting to fetch resource\.?$/,
]

/** supabase-js reicht den fetch-Fehler weiter, teils mit „TypeError: " davor. */
export function isNetworkFailureMessage(message: string | undefined | null): boolean {
  const text = (message ?? '').replace(/^TypeError:\s*/, '').trim()
  return NETWORK_FAILURE_MESSAGES.some(pattern => pattern.test(text))
}
