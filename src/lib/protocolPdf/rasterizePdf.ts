// Rastert das fertige PDF seitenweise zu Bildern fuer die Live-Vorschau.
// Ein iframe zeigt auf iOS nur Seite 1, ohne Blaettern und abgeschnitten —
// pdf.js zeichnet dagegen jede Seite selbst. Es wird erst hier nachgeladen:
// nur wer den PDF-Generator oeffnet, laedt es.

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let pdfjsPromise: Promise<PdfJs> | null = null

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  }).catch(err => {
    // Beim naechsten Versuch neu laden (z. B. nach kurzem Netzausfall).
    pdfjsPromise = null
    throw err
  })
  return pdfjsPromise
}

export interface RasterPage {
  url: string
  /** Seitenmasse in PDF-Punkten — fuer das Seitenverhaeltnis. */
  width: number
  height: number
}

export function revokeRasterPages(pages: readonly RasterPage[]) {
  for (const p of pages) URL.revokeObjectURL(p.url)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9)
  })
}

/**
 * Zeichnet alle Seiten in `pixelWidth` Breite. `firstIndex` kommt zuerst dran
 * (die Seite, die gerade zu sehen ist). Liefert `null`, wenn `signal`
 * abbricht — dann ist schon eine neuere Fassung unterwegs; eine Seite, die
 * gerade gezeichnet wird, bricht sofort mit ab.
 * Die Bilder sind beim Zurueckgeben schon dekodiert: der Tausch blitzt nicht.
 */
export async function rasterizePdf(
  bytes: ArrayBuffer,
  pixelWidth: number,
  firstIndex: number,
  signal: AbortSignal,
): Promise<RasterPage[] | null> {
  const isStale = () => signal.aborted
  const pdfjs = await loadPdfJs()
  if (isStale()) return null

  // pdf.js uebergibt den Puffer an den Worker — eine Kopie, damit der
  // Aufrufer seinen behaelt.
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) })
  const pages: (RasterPage | undefined)[] = []
  try {
    const doc = await task.promise
    const count = doc.numPages
    const start = Math.min(Math.max(firstIndex, 0), count - 1)
    const order = [start, ...Array.from({ length: count }, (_, i) => i).filter(i => i !== start)]

    for (const index of order) {
      if (isStale()) return null
      const page = await doc.getPage(index + 1)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: pixelWidth / base.width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const render = page.render({ canvas, viewport })
      const cancel = () => render.cancel()
      signal.addEventListener('abort', cancel)
      try {
        await render.promise
      } catch (err) {
        if (isStale()) return null
        throw err
      } finally {
        signal.removeEventListener('abort', cancel)
      }
      const blob = await canvasToBlob(canvas)
      // iOS gibt Canvas-Speicher sonst erst spaet frei.
      canvas.width = 0
      canvas.height = 0
      page.cleanup()
      pages[index] = { url: URL.createObjectURL(blob), width: base.width, height: base.height }
    }

    const done = pages.filter((p): p is RasterPage => p != null)
    await Promise.all(done.map(p => {
      const img = new Image()
      img.src = p.url
      return img.decode().catch(() => undefined)
    }))
    if (isStale()) return null
    return done
  } catch (err) {
    revokeRasterPages(pages.filter((p): p is RasterPage => p != null))
    throw err
  } finally {
    if (isStale()) revokeRasterPages(pages.filter((p): p is RasterPage => p != null))
    void task.destroy()
  }
}
