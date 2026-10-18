/**
 * Der Lichtreflex auf der Kante (Erscheinungsbild „Satin") folgt beim
 * Berühren dem Finger.
 *
 * Beim Scrollen wandert er von selbst: eine scrollgetriebene Animation in
 * liquid-glass.css lässt ihn über die Kante gleiten, als stünde eine Lampe
 * über dem Bildschirm. Liegt ein Finger auf einer Karte, übernimmt diese
 * Stelle — die Karte bekommt `data-reflex-touch` und `--rx` (waagerechte
 * Lage in Prozent, an den Rundungen begrenzt). Nach dem Loslassen gleitet er
 * zurück an seinen Platz.
 */
const KARTE = '.lg-surface, .card, .lg-group'
const RAND_PROZENT = 18

let aktiv: HTMLElement | null = null

function karteUnter(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(KARTE) : null
}

function folgen(karte: HTMLElement, clientX: number) {
  const box = karte.getBoundingClientRect()
  if (box.width === 0) return
  const prozent = ((clientX - box.left) / box.width) * 100
  const begrenzt = Math.min(100 - RAND_PROZENT, Math.max(RAND_PROZENT, prozent))
  karte.style.setProperty('--rx', `${begrenzt.toFixed(1)}%`)
}

function loslassen() {
  if (!aktiv) return
  delete aktiv.dataset.reflexTouch
  aktiv = null
}

export function installReflex(): () => void {
  const onDown = (event: PointerEvent) => {
    if (document.documentElement.getAttribute('data-look') !== 'satin') return
    const karte = karteUnter(event.target)
    if (!karte) return
    loslassen()
    aktiv = karte
    folgen(karte, event.clientX)
    karte.dataset.reflexTouch = 'true'
  }
  const onMove = (event: PointerEvent) => {
    if (aktiv) folgen(aktiv, event.clientX)
  }
  document.addEventListener('pointerdown', onDown, { passive: true })
  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerup', loslassen, { passive: true })
  document.addEventListener('pointercancel', loslassen, { passive: true })
  return () => {
    document.removeEventListener('pointerdown', onDown)
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', loslassen)
    document.removeEventListener('pointercancel', loslassen)
  }
}
