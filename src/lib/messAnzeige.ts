/**
 * Prüfanzeige fürs Gerät, nur über die Adresse: ?messen=an
 *
 * Zeigt oben links, wie flüssig die App gerade läuft, damit sich am iPhone
 * Seiten vergleichen lassen (Home gegen MyStack), ohne Entwicklerwerkzeuge:
 *   Bilder  Bilder pro Sekunde (Takt von requestAnimationFrame)
 *   Ruck    Anteil der Bilder, die länger als 20 ms gebraucht haben
 *   Skript  Rechenzeit aller Bild-Schleifen (Hoku, Licht, Leiste) in ms je Sekunde
 *   max     längstes Bild der letzten Sekunde in ms
 *   Stufe   Hokus automatische Qualität (0 voll, 1 weniger Auflösung, 2 dazu 60 Bilder/s)
 * Viel Ruck bei wenig Skript heißt: die Grafik (GPU) kommt nicht hinterher.
 * Viel Skript heißt: der Rechenkern ist ausgelastet.
 */
export function installMessAnzeige(): void {
  const original = window.requestAnimationFrame.bind(window)
  let skript = 0
  // Jede Bild-Schleife misst, wie lange ihr Aufruf dauert
  window.requestAnimationFrame = (cb: FrameRequestCallback) => original((t) => {
    const a = performance.now()
    try { cb(t) } finally { skript += performance.now() - a }
  })

  const feld = document.createElement('div')
  feld.setAttribute('aria-hidden', 'true')
  feld.style.cssText = 'position:fixed;left:8px;top:calc(env(safe-area-inset-top) + 8px);z-index:2147483647;pointer-events:none;'
    + 'font:600 11px/1.35 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.72);padding:6px 8px;border-radius:8px;white-space:pre'
  const setze = () => { if (!feld.isConnected) document.body.appendChild(feld) }
  if (document.body) setze(); else document.addEventListener('DOMContentLoaded', setze, { once: true })

  let bilder = 0, ruck = 0, max = 0, letztes = 0, start = performance.now()
  const takt = (t: number) => {
    if (letztes) {
      const d = t - letztes
      if (d > 20) ruck++
      if (d > max) max = d
    }
    letztes = t; bilder++
    const vergangen = t - start
    if (vergangen >= 1000) {
      const fps = Math.round(bilder * 1000 / vergangen)
      const anteil = Math.round(ruck / Math.max(1, bilder) * 100)
      feld.textContent = `${location.pathname}\nBilder ${fps}/s\nRuck   ${anteil} %\nSkript ${Math.round(skript * 1000 / vergangen)} ms/s\nmax    ${Math.round(max)} ms\nStufe  ${document.documentElement.dataset.hokuStufe ?? '0'}`
      bilder = 0; ruck = 0; max = 0; skript = 0; start = t
    }
    original(takt)
  }
  original(takt)
}
