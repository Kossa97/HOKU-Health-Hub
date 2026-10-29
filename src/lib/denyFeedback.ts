import toast from 'react-hot-toast'

/**
 * „Geht gerade nicht": ein Knopf, der im Moment nichts tun kann, bleibt
 * klickbar und antwortet mit einem kurzen roten Rahmen, der wackelt — statt
 * stumm zu bleiben wie ein `disabled`-Knopf. Vorbild ist die Abschnittswahl
 * im PDF-Generator.
 *
 * So wird ein Knopf gesperrt: `aria-disabled="true"` statt `disabled`, und
 * wenn der Grund nicht offensichtlich ist, `data-deny-reason` — der steht
 * dann als Hinweis oben. `denyProps()` setzt beides.
 *
 * `disabled` bleibt fuer Sperren, die gleich wieder vorbei sind (waehrend
 * gespeichert wird): dort gibt es nichts zu erklaeren.
 */

const DENY_SELECTOR = [
  'button[aria-disabled="true"]',
  'a[aria-disabled="true"]',
  '[role="button"][aria-disabled="true"]',
  '[role="tab"][aria-disabled="true"]',
  '[role="option"][aria-disabled="true"]',
  '[role="menuitem"][aria-disabled="true"]',
].join(',')

/** So lange steht der Rahmen — die Animation selbst dauert 0,48 s. */
const DENY_MS = 650

const timers = new WeakMap<Element, number>()

export function denyProps(locked: boolean, reason?: string) {
  return locked
    ? { 'aria-disabled': true as const, 'data-deny-reason': reason || undefined }
    : { 'aria-disabled': undefined, 'data-deny-reason': undefined }
}

/**
 * Setzt `data-deny` und nimmt es wieder weg. Ein Attribut statt einer Klasse:
 * React verwaltet es nicht und wirft es bei einem Re-Render nicht weg.
 */
export function flashDeny(el: HTMLElement): void {
  const previous = timers.get(el)
  if (previous !== undefined) window.clearTimeout(previous)
  el.removeAttribute('data-deny')
  // Einmal Layout lesen, damit die Animation beim zweiten Klick neu startet.
  void el.offsetWidth
  el.setAttribute('data-deny', '')
  timers.set(el, window.setTimeout(() => {
    el.removeAttribute('data-deny')
    timers.delete(el)
  }, DENY_MS))
}

function showReason(reason: string): void {
  // Gleiche id: mehrfaches Tippen stapelt keine Hinweise.
  toast(reason, { id: `deny:${reason}`, duration: 2800 })
}

/**
 * Faengt Klicks auf gesperrte Knoepfe ab, bevor React sie sieht: der Knopf
 * loest seine Aktion nicht aus, zeigt aber, dass er gerade nicht geht.
 * Tastatur (Enter, Leertaste) erzeugt denselben Klick und wird mit erfasst.
 */
export function installDenyFeedback(
  target: Document = document,
  notify: (reason: string) => void = showReason,
): () => void {
  const onClick = (event: MouseEvent) => {
    const origin = event.target
    if (!(origin instanceof Element)) return
    const el = origin.closest<HTMLElement>(DENY_SELECTOR)
    if (!el) return
    event.preventDefault()
    // Auch andere Klick-Lauscher am Dokument (etwa die Zurueck-Navigation)
    // sollen den Klick nicht sehen — ein disabled-Knopf loeste gar keinen aus.
    // Das greift, weil dieser Lauscher als erster eingehaengt wird (main.tsx).
    event.stopImmediatePropagation()
    flashDeny(el)
    const reason = el.getAttribute('data-deny-reason')
    if (reason) notify(reason)
  }
  target.addEventListener('click', onClick, true)
  return () => target.removeEventListener('click', onClick, true)
}
