/**
 * Das Modell der Bottom-Navigation — ohne React, ohne Router, ohne Optik.
 *
 * Warum getrennt: die Web-Fassung ist eine Nachbildung von Apples
 * Liquid-Glass-Tab-Bar. Im nativen iOS-Build soll spaeter die ECHTE `UITabBar`
 * an ihre Stelle treten koennen. Was beide brauchen, ist dasselbe: welche
 * Reiter es gibt, wohin sie fuehren, welcher gerade gilt. Das steht hier und
 * nur hier; ausgetauscht wird dann allein die Darstellung.
 */

export type TabId = 'home' | 'my-stack' | 'kalender' | 'profil'

export interface TabDefinition {
  id: TabId
  /** Ziel im Router. Zugleich der Pfad, an dem der Reiter als aktiv gilt. */
  route: string
  /** Schluessel fuer die Beschriftung, oder null fuer einen festen Namen. */
  labelKey: string | null
  /** Beschriftung, wenn kein Schluessel greift (Eigennamen werden nicht uebersetzt). */
  fallbackLabel: string
  /** Anker fuer das Onboarding. Fehlt er, zeigt kein Schritt auf den Reiter. */
  obKey?: string
}

/**
 * Die Reihenfolge ist die Reihenfolge auf dem Schirm. Der Plus-Knopf steht
 * NICHT hier: er ist kein Reiter, sondern oeffnet das Schnellzugriff-Menue,
 * fuehrt zu keiner Route und sitzt deshalb neben der Kapsel.
 */
export const TAB_ITEMS: readonly TabDefinition[] = [
  { id: 'home',     route: '/',         labelKey: 'nav_home',     fallbackLabel: 'Home',     obKey: 'nav-home' },
  { id: 'my-stack', route: '/my-stack', labelKey: null,           fallbackLabel: 'My Stack', obKey: 'nav-peptide' },
  { id: 'kalender', route: '/kalender', labelKey: 'nav_kalender', fallbackLabel: 'Kalender', obKey: 'nav-kalender' },
  { id: 'profil',   route: '/profil',   labelKey: 'nav_profil',   fallbackLabel: 'Profil' },
] as const

/**
 * Welcher Reiter gilt gerade?
 *
 * Genauer Pfadvergleich und kein `startsWith`: „/" waere sonst auf jeder Seite
 * aktiv. Unterseiten, die zu keinem Reiter gehoeren (etwa „/faq" oder
 * „/rechner"), lassen die Leiste bewusst ohne aktiven Reiter — dort gehoert
 * keine Pille hin, denn man ist nirgends in der Hauptnavigation.
 */
export function resolveActiveTabId(pathname: string): TabId | null {
  return TAB_ITEMS.find(tab => tab.route === pathname)?.id ?? null
}

/** Position eines Reiters im Streifen, fuer Messungen und Tests. */
export function tabIndex(id: TabId): number {
  return TAB_ITEMS.findIndex(tab => tab.id === id)
}
