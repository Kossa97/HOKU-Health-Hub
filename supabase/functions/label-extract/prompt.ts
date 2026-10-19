/**
 * Etikett-Scan: Prompt, Antwortschema und Pruefung der Antwort. Ohne
 * Deno-APIs, damit Vitest es testen kann.
 *
 * Das Modell liest nur, was auf dem Etikett steht. Welcher Katalogeintrag
 * gemeint ist und wie die Staerke in den Assistenten kommt, entscheidet die
 * App (`src/features/my-stack/lib/substanzScan.ts`) — nicht das Modell.
 */

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Ab hier nennt der Einwilligungstext der App auch Etikettfotos. Eine aeltere
 * `ai_import_consent_at` galt nur Befunden und reicht fuer den Scan nicht.
 * Gleicher Wert wie `ETIKETT_EINWILLIGUNG_AB` in der App (aiConsent.ts).
 */
export const LABEL_CONSENT_SINCE = '2026-10-19T00:00:00.000Z'

export function consentCoversLabels(consentAt: string | null | undefined): boolean {
  return !!consentAt && Date.parse(consentAt) >= Date.parse(LABEL_CONSENT_SINCE)
}

/** Die App schickt ein JPEG mit hoechstens 1568 px Kante — meist unter 1 MB. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** Katalognamen, die als Schreibweise mitgehen. Mehr wird abgeschnitten. */
export const MAX_NAMES = 800
const MAX_NAME_LENGTH = 80

export const DOSAGE_FORMS = [
  'vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops', 'powder',
  'nasal_spray', 'spray', 'gel', 'patch', 'tube', 'other',
] as const
export type DosageForm = typeof DOSAGE_FORMS[number]

export const AMOUNT_UNITS = ['mcg', 'mg', 'g', 'IU', 'ml'] as const
export const PER_UNITS = [
  'ml', 'g', 'tablet', 'capsule', 'drop', 'spray', 'patch', 'dose', 'vial', 'ampoule', 'portion', 'application',
] as const

export interface LabelIngredient {
  name: string | null
  amount: number
  unit: typeof AMOUNT_UNITS[number]
  per_amount: number | null
  per_unit: typeof PER_UNITS[number] | null
}

export interface Label {
  name: string
  brand: string | null
  dosage_form: DosageForm | null
  ingredients: LabelIngredient[]
}

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] })

/** JSON-Schema fuer `output_config.format` — das Modell muss genau so antworten. */
export const LABEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['found', 'name', 'brand', 'dosage_form', 'ingredients'],
  properties: {
    found: { type: 'boolean' },
    name: nullable({ type: 'string' }),
    brand: nullable({ type: 'string' }),
    dosage_form: nullable({ type: 'string', enum: [...DOSAGE_FORMS] }),
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'amount', 'unit', 'per_amount', 'per_unit'],
        properties: {
          name: nullable({ type: 'string' }),
          amount: { type: 'number' },
          unit: { type: 'string', enum: [...AMOUNT_UNITS] },
          per_amount: nullable({ type: 'number' }),
          per_unit: nullable({ type: 'string', enum: [...PER_UNITS] }),
        },
      },
    },
  },
} as const

/** Ungefaehre dekodierte Groesse eines base64-Strings in Bytes. */
export function base64Bytes(base64: string): number {
  const len = base64.length
  if (len === 0) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((len * 3) / 4) - padding
}

/** Katalognamen aus der Anfrage: nur Text, gekuerzt, ohne Zeilenumbrueche. */
export function cleanNames(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const names = raw
    .filter((n): n is string => typeof n === 'string')
    .map(n => n.replace(/\s+/g, ' ').trim())
    .filter(n => n.length > 0 && n.length <= MAX_NAME_LENGTH)
  return [...new Set(names)].slice(0, MAX_NAMES)
}

export function buildPrompt(names: string[]): string {
  return [
    'Du liest das Etikett bzw. die Verpackung eines Arzneimittels, Nahrungsergänzungsmittels oder Peptids auf einem Foto.',
    '',
    'Regeln:',
    '- Übernimm nur, was lesbar aufgedruckt ist. Nicht raten. Was unleserlich ist, setze auf null oder lass es weg.',
    '- Gib niemals Namen, Geburtsdaten oder Adressen von Personen zurück (Apothekenetiketten tragen oft Patientendaten).',
    '- name: der Wirkstoff bzw. Produktname. Steht er in der Liste unten (auch in anderer Schreibweise, z. B. "BPC 157"),',
    '  verwende exakt die Schreibweise aus der Liste. Bei einem Kombipräparat der Produktname, sonst der Wirkstoff.',
    '- brand: Hersteller oder Marke, sonst null.',
    '- dosage_form: vial = Durchstechflasche (Pulver oder Lösung), ampoule = Ampulle, pen = Fertigpen,',
    '  tablet = Tablette, capsule = Kapsel/Softgel, drops = Tropfen/Tropfflasche, powder = Pulver/Portionsbeutel,',
    '  nasal_spray = Nasenspray, spray = anderes Spray (z. B. Mundspray), gel = Gel, patch = Pflaster,',
    '  tube = Creme/Salbe in der Tube, other = sonstiges. Unklar: null.',
    '- ingredients: je Wirkstoff die Stärke. amount und unit ist die Wirkstoffmenge; per_amount und per_unit der Bezug.',
    '  Beispiele: "500 mg je Tablette" -> 500, mg, 1, tablet. "250 mg/ml" -> 250, mg, 1, ml. "10 mg/3 ml" -> 10, mg, 3, ml.',
    '  "5 mg" auf einer Durchstechflasche ohne Volumenangabe -> 5, mg, null, null. "1000 I.E. pro Tropfen" -> 1000, IU, 1, drop.',
    '  Einheiten: µg und mcg -> mcg, I.E./IE/IU -> IU. Andere Einheiten (%, mmol): Wirkstoff weglassen.',
    '  Der Packungsinhalt (z. B. "60 Kapseln", "10 ml", "30 Portionen") ist KEIN Bezug und keine Stärke.',
    '  name des Wirkstoffs wie in der Liste, falls er dort steht; bei nur einem Wirkstoff darf er null sein.',
    '- found: false, wenn auf dem Bild kein Etikett eines solchen Produkts zu erkennen ist. Dann alles andere null bzw. leer.',
    '',
    'Bekannte Schreibweisen:',
    names.join(', '),
  ].join('\n')
}

/** Holt das erste JSON-Objekt aus einer Modellantwort. */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, max) : null
}

const positive = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e7 ? v : null

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T : null

/**
 * Die Modellantwort in das Format der App bringen. `null` heisst: kein
 * Etikett erkannt. Das Schema erzwingt die Form schon — geprueft wird
 * trotzdem, denn bei einer Ablehnung oder einem Abbruch gilt es nicht.
 */
export function sanitizeLabel(raw: unknown): Label | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const name = text(r.name, 120)
  if (r.found !== true || !name) return null

  const ingredients: LabelIngredient[] = []
  for (const item of Array.isArray(r.ingredients) ? r.ingredients.slice(0, 8) : []) {
    if (!item || typeof item !== 'object') continue
    const i = item as Record<string, unknown>
    const amount = positive(i.amount)
    const unit = oneOf(AMOUNT_UNITS, i.unit)
    if (amount == null || !unit) continue
    const perAmount = positive(i.per_amount)
    const perUnit = oneOf(PER_UNITS, i.per_unit)
    ingredients.push({
      name: text(i.name, 120),
      amount,
      unit,
      // Ein Bezug nur mit Zahl UND Einheit — „pro ml" ohne Zahl hiesse 1 ml.
      per_amount: perUnit ? perAmount ?? 1 : null,
      per_unit: perUnit,
    })
  }

  return {
    name,
    brand: text(r.brand, 120),
    dosage_form: oneOf(DOSAGE_FORMS, r.dosage_form),
    ingredients,
  }
}

/**
 * Gleitendes Fenster: hoechstens `limit` Vorgaenge je `windowMs` und Schluessel.
 * Je Funktions-Instanz — ein grober Kostenschutz, kein exakter globaler Zaehler.
 * Wie in `food-lookup/off.ts`, dazu `allows`; jede Funktion wird einzeln
 * ausgeliefert.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>()
  private limit: number
  private windowMs: number
  private now: () => number
  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit
    this.windowMs = windowMs
    this.now = now
  }
  /** Waere ein Vorgang frei? Zaehlt nichts. */
  allows(key: string): boolean {
    const t = this.now()
    return (this.hits.get(key) ?? []).filter(x => x > t - this.windowMs).length < this.limit
  }
  take(key: string): boolean {
    const t = this.now()
    const recent = (this.hits.get(key) ?? []).filter(x => x > t - this.windowMs)
    if (recent.length >= this.limit) { this.hits.set(key, recent); return false }
    recent.push(t)
    this.hits.set(key, recent)
    if (this.hits.size > 5000) this.hits.delete(this.hits.keys().next().value as string)
    return true
  }
}
