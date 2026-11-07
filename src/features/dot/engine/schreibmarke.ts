/**
 * Wo steht die Schreibmarke (der blinkende Strich) in einem Textfeld, in Bildschirm-px?
 * Hoku schaut beim Schreiben genau dorthin (Nutzer 02.11.2026). Für Eingabefelder gibt
 * es dafür keine Schnittstelle: ein unsichtbarer Spiegel mit denselben Schriftmaßen
 * misst den Text bis zur Marke.
 */

const TEXT_TYPEN = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'number'])

/** Felder, in die man schreibt; Passwörter zählen nicht (dort schaut Hoku nicht hin). */
export function istSchreibfeld(el: unknown): el is HTMLInputElement | HTMLTextAreaElement | HTMLElement {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) return TEXT_TYPEN.has(el.type.toLowerCase()) && !el.readOnly && !el.disabled
  return el instanceof HTMLElement && el.isContentEditable === true
}

const STILE = [
  'boxSizing', 'width', 'height', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch',
  'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize', 'direction',
] as const

let spiegel: HTMLDivElement | null = null

/** Die Marke in Bildschirm-px (Mitte der Zeile) oder null, wenn sie sich nicht bestimmen lässt. */
export function schreibmarke(el: HTMLElement): { x: number; y: number } | null {
  const r = el.getBoundingClientRect()
  if (!r.width && !r.height) return null
  const inRahmen = (x: number, y: number) => ({ x: Math.min(r.right, Math.max(r.left, x)), y: Math.min(r.bottom, Math.max(r.top, y)) })

  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    const sel = window.getSelection()
    if (sel && sel.rangeCount && el.contains(sel.focusNode)) {
      const rr = sel.getRangeAt(0).getClientRects()[0]
      if (rr) return inRahmen(rr.left, rr.top + rr.height / 2)
    }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  // E-Mail- und Zahlenfelder kennen keine Auswahl: dann steht die Marke am Ende
  let pos = el.value.length
  try { if (el.selectionStart != null) pos = el.selectionStart } catch { /* keine Auswahl */ }
  const cs = getComputedStyle(el)
  const s = (spiegel ??= document.createElement('div'))
  if (!s.isConnected) {
    s.setAttribute('aria-hidden', 'true')
    s.style.cssText = 'position:absolute;top:0;left:-9999px;visibility:hidden;overflow:hidden;pointer-events:none'
    document.body.appendChild(s)
  }
  for (const k of STILE) s.style[k] = cs[k]
  const flach = el instanceof HTMLInputElement
  s.style.whiteSpace = flach ? 'pre' : 'pre-wrap'
  s.style.overflowWrap = flach ? 'normal' : 'break-word'
  s.textContent = el.value.slice(0, pos)
  const marke = document.createElement('span')
  marke.textContent = '​'
  s.appendChild(marke)
  const zeile = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2 || 16
  // ein einzeiliges Feld zentriert seine Zeile senkrecht
  const y = flach ? r.top + r.height / 2 : r.top + marke.offsetTop - el.scrollTop + zeile / 2
  const x = r.left + marke.offsetLeft - el.scrollLeft
  s.textContent = ''
  return inRahmen(x, y)
}

/** Räumt den Spiegel weg (wenn Hoku geht). */
export function schreibmarkeAufraeumen() {
  spiegel?.remove()
  spiegel = null
}
