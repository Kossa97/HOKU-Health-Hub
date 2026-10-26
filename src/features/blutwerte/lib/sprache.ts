import i18next from 'i18next'

/**
 * Die aktive Sprache fuer Anzeige-Hilfen ausserhalb von React (Format,
 * Markername, Sortierung). Ohne initialisiertes i18n (Unit-Tests) gilt
 * Deutsch — die Sprache der Katalogschluessel.
 */
export const aktiveSprache = (): string => i18next.resolvedLanguage ?? i18next.language ?? 'de'

export const istDeutsch = (sprache: string = aktiveSprache()): boolean => sprache.toLowerCase().startsWith('de')

/** Ein Text aus den Locale-Dateien; ohne i18n der deutsche Ersatz. */
export function uebersetze(key: string, ersatzDeutsch: string, werte: Record<string, unknown> = {}): string {
  return i18next.isInitialized ? i18next.t(key, werte) : ersatzDeutsch
}
