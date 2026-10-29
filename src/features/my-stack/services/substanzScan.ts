/**
 * Substanz-Scan: Barcode ueber `food-lookup` (Open Food Facts, nur Name und
 * Marke), Etikettfoto ueber `label-extract` (Anthropic, mit Einwilligung).
 */
import { supabase } from '../../../lib/supabase'
import { EINWILLIGUNG_FEHLT } from '../../blutwerte/lib/aiConsent'
import { parseBarcodeProdukt, parseEtikett, type BarcodeProdukt, type Etikett } from '../lib/substanzScan'

/** `code` ist der Fehlercode der Funktion, `schluessel` der Text fuer den Nutzer. */
export class ScanFehler extends Error {
  readonly code: string | null
  readonly schluessel: string
  constructor(code: string | null, schluessel: string) {
    super(code ?? 'scan_failed')
    this.code = code
    this.schluessel = schluessel
  }
}

async function fehlerCode(response: Response | undefined): Promise<string | null> {
  try {
    const body = await response?.clone().json()
    return typeof body?.error === 'string' ? body.error : null
  } catch {
    return null
  }
}

/** `null` = Open Food Facts kennt den Barcode nicht. */
export async function sucheBarcode(barcode: string, lang: 'de' | 'en'): Promise<BarcodeProdukt | null> {
  const { data, error } = await supabase.functions.invoke('food-lookup', { body: { barcode, lang, kind: 'item' } })
  if (error || !data || typeof data !== 'object') throw new ScanFehler(null, 'my_stack_scan_err_lookup')
  return parseBarcodeProdukt(data)
}

/**
 * Etikett auslesen. `names` sind die Katalognamen — das Modell schreibt einen
 * erkannten Namen dann genau so, und der Abgleich in der App trifft sicherer.
 */
export async function liesEtikett(base64: string, mimeType: string, names: string[]): Promise<Etikett> {
  const { data, error, response } = await supabase.functions.invoke('label-extract', {
    body: { file: base64, mimeType, names },
  })
  if (error) {
    const code = await fehlerCode(response)
    if (code === EINWILLIGUNG_FEHLT) throw new ScanFehler(code, 'ai_consent_required')
    if (response?.status === 429 || code === 'rate_limit') throw new ScanFehler(code, 'my_stack_scan_err_limit')
    if (code === 'no_label_found') throw new ScanFehler(code, 'my_stack_scan_no_label')
    throw new ScanFehler(code, 'my_stack_scan_err')
  }
  const etikett = parseEtikett(data)
  if (!etikett) throw new ScanFehler('no_label_found', 'my_stack_scan_no_label')
  return etikett
}
