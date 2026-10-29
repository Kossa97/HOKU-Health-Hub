/**
 * Ein Barcode-Leser für alle Plattformen.
 *
 * Bewusst KEIN natives Plugin: ML Kit für Capacitor unterstützt auf iOS nur
 * CocoaPods, das iOS-Projekt nutzt Swift Package Manager. Stattdessen Kamera
 * über `getUserMedia` (Browser, iOS-WKWebView, Android-WebView) und
 * - die eingebaute `BarcodeDetector`-API, wo es sie gibt (Chrome/Android),
 * - sonst ZXing als WebAssembly (Safari, iOS-App). Die .wasm-Datei liefern wir
 *   selbst aus — kein fremdes CDN — und laden sie erst beim ersten Scan.
 *
 * `barcode-detector` und `zxing-wasm` sind in package.json exakt gepinnt:
 * JavaScript-Teil und .wasm müssen zusammenpassen (Test in barcodeDetector.test.ts).
 */

export const PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const
/** Arzneimittelpackungen tragen PZN, Charge und Verfall im Data-Matrix-Code (My Stack). */
export const DATA_MATRIX = 'data_matrix'

export interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}

type DetectorCtor = {
  new (options: { formats: string[] }): Detector
  getSupportedFormats?: () => Promise<string[]>
}

let fallback: Promise<DetectorCtor> | null = null

async function loadFallback(): Promise<DetectorCtor> {
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  })
  return BarcodeDetector as unknown as DetectorCtor
}

/**
 * Leser für Produkt-Barcodes (EAN/UPC), auf Wunsch auch Data Matrix.
 * Eingebaut, wenn er alle gewünschten Formate kann; sonst ZXing.
 */
export async function createDetector(mitDataMatrix = false): Promise<Detector> {
  const formats: string[] = mitDataMatrix ? [...PRODUCT_FORMATS, DATA_MATRIX] : [...PRODUCT_FORMATS]
  const native = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
  if (native?.getSupportedFormats) {
    try {
      const supported = await native.getSupportedFormats()
      if (supported.includes('ean_13') && (!mitDataMatrix || supported.includes(DATA_MATRIX))) {
        return new native({ formats: formats.filter(f => supported.includes(f)) })
      }
    } catch { /* weiter mit ZXing */ }
  }
  fallback ??= loadFallback()
  try {
    const Ctor = await fallback
    return new Ctor({ formats })
  } catch (error) {
    fallback = null // beim nächsten Versuch neu laden (etwa nach Netzfehler)
    throw error
  }
}

export function cameraAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}
