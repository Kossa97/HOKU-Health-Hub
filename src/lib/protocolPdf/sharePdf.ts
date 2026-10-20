// Das fertige PDF weitergeben: auf Touch-Geraeten ueber das Teilen-Menue des
// Systems (Mail, Nachrichten, In Dateien sichern, Drucken), sonst als Download.
// `a[download]` klappt in der installierten App bzw. im WebView nicht.

/** `retry`: das Teilen-Menü ging nicht auf (meist: Geste abgelaufen) — nochmal tippen. */
export type PdfHandoff = 'shared' | 'downloaded' | 'cancelled' | 'retry'

function pdfFile(blob: Blob, name: string): File | null {
  return typeof File === 'function' ? new File([blob], name, { type: 'application/pdf' }) : null
}

/** Ob der Knopf „Teilen" heissen darf (und nicht „Herunterladen"). */
export function canSharePdf(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  if (!coarse) return false
  const probe = pdfFile(new Blob([], { type: 'application/pdf' }), 'probe.pdf')
  return probe != null && navigator.canShare({ files: [probe] })
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Teilt oder laedt herunter. Abbrechen im Teilen-Menue ist kein Fehler.
 * Geht das Teilen-Menue nicht auf (iOS: die Geste ist beim Erstellen
 * abgelaufen), gibt es `retry` — ein Download klappt dort ja gerade nicht.
 */
export async function handOffPdf(blob: Blob, name: string): Promise<PdfHandoff> {
  const file = pdfFile(blob, name)
  if (file && canSharePdf()) {
    try {
      await navigator.share({ files: [file], title: name })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      return 'retry'
    }
  }
  download(blob, name)
  return 'downloaded'
}
