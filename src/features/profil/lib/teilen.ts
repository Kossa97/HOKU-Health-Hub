/**
 * Teilen und Kopieren für das Sheet „Profil teilen“ (Spec 2c, 4.4).
 *
 * Im Projekt gibt es kein Capacitor-Plugin fürs Teilen; `navigator.share` gibt
 * es in Safari, Chrome auf Android und den WebViews der App. Fehlt es, wird
 * kopiert. Kopieren nimmt die Zwischenablage und fällt in älteren oder
 * gesperrten Umgebungen (kein sicherer Kontext, Berechtigung verweigert) auf
 * eine unsichtbare Textauswahl mit `execCommand('copy')` zurück.
 */

/** Unsichtbares Textfeld auswählen und kopieren; `true`, wenn der Browser es meldet. */
function kopiereUeberAuswahl(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false
  const feld = document.createElement('textarea')
  feld.value = text
  feld.setAttribute('readonly', '')
  feld.setAttribute('aria-hidden', 'true')
  // 16 px: sonst zoomt iOS beim Fokus kurz in die Seite
  feld.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none'
  const vorher = document.activeElement instanceof HTMLElement ? document.activeElement : null
  document.body.appendChild(feld)
  try {
    feld.select()
    feld.setSelectionRange(0, text.length) // iOS wählt mit select() allein nichts aus
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    feld.remove()
    vorher?.focus({ preventScroll: true })
  }
}

export async function kopiereText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // weiter mit der Textauswahl
  }
  return kopiereUeberAuswahl(text)
}

export type TeilenErgebnis = 'geteilt' | 'kopiert' | 'abgebrochen' | 'fehler'

/** Systemdialog „Teilen“, sonst Kopieren. Abbrechen im Dialog ist kein Fehler. */
export async function teileLink({ title, url }: { title: string; url: string }): Promise<TeilenErgebnis> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
      return 'geteilt'
    } catch (error) {
      if ((error as Error | null)?.name === 'AbortError') return 'abgebrochen'
      // z. B. NotAllowedError ohne Nutzergeste: dann wenigstens kopieren
    }
  }
  return (await kopiereText(url)) ? 'kopiert' : 'fehler'
}
