import { randomUUID } from 'node:crypto'
import type { Page, Route } from '@playwright/test'
import { SUBSTANCE_CATALOG } from '../../scripts/substance-catalog-source.mjs'
import { TERMS_VERSION } from '../../src/features/compliance/lib/consent'
import { consentCoversLabels } from '../../supabase/functions/label-extract/prompt'

/**
 * Nachgebildetes Supabase fuer die Geraetetests.
 *
 * Die App spricht mit Supabase ueber PostgREST (`/rest/v1/<tabelle>`,
 * `/rest/v1/rpc/<name>`) und Auth (`/auth/v1/...`). Hier liegt dafuer ein
 * kleiner Speicher im Testprozess: Tabellen als Zeilenlisten, dazu die
 * Beziehungen, die die App einbettet (`ingredients:stack_item_ingredients(...)`),
 * und die RPCs fuer My Stack und Einnahmen — so weit nachgebaut, wie die
 * App ihr Ergebnis liest. Keine echte Datenbank, keine echten Daten.
 *
 * Was die App anfragt und der Speicher nicht kennt, landet in `unhandled` —
 * der Test prueft am Ende, dass die Liste leer ist, damit nichts still
 * danebengeht.
 */

/** Wirft ein RPC-Handler das, antwortet der Mock wie Postgres mit einer Fehlermeldung — ein erwarteter Fehler, kein Loch im Mock. */
export class RpcError extends Error {}

export const SUPABASE_ORIGIN = 'https://xcskcojakolphtbuqfbw.supabase.co'
const STORAGE_KEY = 'sb-xcskcojakolphtbuqfbw-auth-token'

export const TEST_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'e2e@example.test',
}

type Row = Record<string, unknown>

interface CatalogSourceEntry {
  name: string
  aliases: string[]
  category: string
  dosageForms: string[]
  units: string[]
  components?: string[]
}

interface Relation {
  table: string
  /** 'many': Kinder zeigen per `foreign` auf `local` der Elternzeile. 'one': die Elternzeile zeigt per `local` auf `foreign` des Kinds. */
  kind: 'many' | 'one' | 'single-child'
  local: string
  foreign: string
}

// Nur die Beziehungen, die die App tatsaechlich einbettet.
const RELATIONS: Record<string, Record<string, Relation>> = {
  stack_items: {
    stack_item_ingredients: { table: 'stack_item_ingredients', kind: 'many', local: 'id', foreign: 'stack_item_id' },
    // Eindeutig pro Eintrag: PostgREST liefert ein Objekt, kein Array.
    stack_item_inventory: { table: 'stack_item_inventory', kind: 'single-child', local: 'id', foreign: 'stack_item_id' },
    cycle_migration_conflicts: { table: 'cycle_migration_conflicts', kind: 'many', local: 'id', foreign: 'stack_item_id' },
  },
  stack_item_ingredients: {
    substance_catalog: { table: 'substance_catalog', kind: 'one', local: 'catalog_substance_id', foreign: 'id' },
  },
  substance_catalog: {
    pk_profiles: { table: 'pk_profiles', kind: 'one', local: 'pk_profile_id', foreign: 'id' },
  },
  reviews: {
    stack_items: { table: 'stack_items', kind: 'one', local: 'stack_item_id', foreign: 'id' },
  },
  effects: {
    stack_items: { table: 'stack_items', kind: 'one', local: 'stack_item_id', foreign: 'id' },
    dose_logs: { table: 'dose_logs', kind: 'one', local: 'dose_log_id', foreign: 'id' },
  },
  cycles: {
    stack_items: { table: 'stack_items', kind: 'one', local: 'stack_item_id', foreign: 'id' },
    cycle_plan_versions: { table: 'cycle_plan_versions', kind: 'many', local: 'id', foreign: 'cycle_id' },
    cycle_pause_periods: { table: 'cycle_pause_periods', kind: 'many', local: 'id', foreign: 'cycle_id' },
  },
  dose_logs: {
    stack_items: { table: 'stack_items', kind: 'one', local: 'stack_item_id', foreign: 'id' },
  },
}

interface SelectField {
  alias: string
  table?: string
  children?: SelectField[]
}

/** `*, inventory:stack_item_inventory(id, enabled), ingredients:stack_item_ingredients(*, substance_catalog(id))` */
function parseSelect(select: string): SelectField[] {
  const fields: SelectField[] = []
  let i = 0
  const text = select.replace(/\s+/g, '')
  while (i < text.length) {
    let token = ''
    while (i < text.length && text[i] !== ',' && text[i] !== '(') token += text[i++]
    if (text[i] === '(') {
      let depth = 1
      let inner = ''
      i++
      while (i < text.length && depth > 0) {
        if (text[i] === '(') depth++
        if (text[i] === ')') depth--
        if (depth > 0) inner += text[i]
        i++
      }
      const [alias, table] = token.includes(':') ? token.split(':') : [token, token]
      if (table.includes('!')) throw new Error(`Einbettung mit Hinweis ${table} nicht nachgebildet`)
      fields.push({ alias, table, children: parseSelect(inner) })
    } else if (token) {
      fields.push({ alias: token })
    }
    if (text[i] === ',') i++
  }
  return fields
}

function toNumberish(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  return value
}

/**
 * `or=(a.eq.1,b.ilike."%x,y%")` in `[spalte, filter]`-Paare zerlegen — Kommas
 * in Klammern (`in.(…)`) und in Anfuehrungszeichen trennen nicht. Werte in
 * Anfuehrungszeichen kommen ohne sie und unmaskiert zurueck.
 */
function splitLogic(filter: string): Array<[string, string]> {
  const inner = filter.replace(/^\(|\)$/g, '')
  const parts: string[] = []
  let depth = 0
  let quoted = false
  let current = ''
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i]
    if (quoted && char === '\\') { current += char + inner[++i]; continue }
    if (char === '"') quoted = !quoted
    else if (!quoted && char === '(') depth++
    else if (!quoted && char === ')') depth--
    else if (!quoted && depth === 0 && char === ',') { parts.push(current); current = ''; continue }
    current += char
  }
  parts.push(current)
  return parts.map(part => {
    const dot = part.indexOf('.')
    const column = part.slice(0, dot)
    const rest = part.slice(dot + 1)
    const opDot = rest.indexOf('.')
    const value = rest.slice(opDot + 1)
    const plain = value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1).replace(/\\(.)/g, '$1')
      : value
    return [column, `${rest.slice(0, opDot)}.${plain}`]
  })
}

function matches(row: Row, column: string, filter: string): boolean {
  const dot = filter.indexOf('.')
  let op = filter.slice(0, dot)
  let value = filter.slice(dot + 1)
  let negate = false
  if (op === 'not') {
    negate = true
    const rest = value
    const nextDot = rest.indexOf('.')
    op = rest.slice(0, nextDot)
    value = rest.slice(nextDot + 1)
  }
  const cell = row[column]
  const result = (() => {
    switch (op) {
      case 'eq': return String(cell) === value
      case 'neq': return String(cell) !== value
      case 'is': return value === 'null' ? cell == null : cell === toNumberish(value)
      case 'in': {
        const list = value.replace(/^\(|\)$/g, '').split(',').map(entry => entry.replace(/^"|"$/g, ''))
        return list.includes(String(cell))
      }
      case 'gt': return compare(cell, value) > 0
      case 'gte': return compare(cell, value) >= 0
      case 'lt': return compare(cell, value) < 0
      case 'lte': return compare(cell, value) <= 0
      case 'ilike': {
        const pattern = new RegExp(`^${value.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*')}$`, 'i')
        return pattern.test(String(cell ?? ''))
      }
      default: throw new Error(`Filter ${op} nicht nachgebildet`)
    }
  })()
  return negate ? !result : result
}

/** Wie Postgres: Zahlen als Zahlen, alles andere als Text (ISO-Daten sortieren so richtig). */
function compare(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  const isInstant = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  if (isInstant(left) && isInstant(right)) return new Date(String(left)).getTime() - new Date(String(right)).getTime()
  const a = Number(left)
  const b = Number(right)
  if (typeof left !== 'boolean' && left !== '' && right !== '' && Number.isFinite(a) && Number.isFinite(b)) return a - b
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0
}

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

/** Nested calendar ranges and flat diary searches share quoted leaf parsing. */
function logicalMatch(row: Row, kind: string, expression: string): boolean {
  const parts: string[] = []
  let depth = 0
  let quoted = false
  let start = 0
  const text = expression.startsWith('(') ? expression.slice(1, -1) : expression
  for (let i = 0; i < text.length; i++) {
    if (quoted && text[i] === '\\') { i++; continue }
    if (text[i] === '"') quoted = !quoted
    if (!quoted && text[i] === '(') depth++
    if (!quoted && text[i] === ')') depth--
    if (!quoted && depth === 0 && text[i] === ',') {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  const evaluate = (part: string): boolean => {
    const nested = /^(and|or)\((.*)\)$/.exec(part)
    if (nested) return logicalMatch(row, nested[1], nested[2])
    const dot = part.indexOf('.')
    if (dot < 1) throw new Error(`Logischer Filter ${part} nicht nachgebildet`)
    const [[column, filter]] = splitLogic(`(${part})`)
    return matches(row, column, filter)
  }
  return kind === 'or' ? parts.some(evaluate) : parts.every(evaluate)
}

export class MockSupabase {
  readonly tables = new Map<string, Row[]>()
  readonly rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = []
  readonly unhandled: string[] = []
  /** Zaehlt jede Anfrage je `METHODE pfad`. */
  readonly log: string[] = []
  private readonly rpcHandlers = new Map<string, (params: Record<string, unknown>) => unknown>()
  private readonly rpcFailures = new Map<string, string>()
  /** Die Uhr der Zeilen (`created_at`, `updated_at`) — dieselbe, die der Test dem Browser gibt. */
  private readonly now: () => Date

  constructor(options: { now?: Date } = {}) {
    const fixed = options.now
    this.now = fixed ? () => new Date(fixed) : () => new Date()
    this.registerMyStackRpcs()
    this.registerComplianceRpcs()
    this.registerIntakeRpcs()
    this.seedCatalog()
    this.seedOwnProfile()
  }

  /**
   * Das Profil des Testnutzers — mit erteilter Zustimmung, sonst stuende vor
   * jeder Seite die Zustimmungsseite. Tests, die sie sehen wollen, leeren
   * die Felder.
   */
  private seedOwnProfile(): void {
    this.insert('profiles', {
      id: TEST_USER.id,
      username: 'e2e',
      is_public: false,
      is_admin: false,
      age_confirmed_at: '2026-01-01T00:00:00.000Z',
      terms_accepted_at: '2026-01-01T00:00:00.000Z',
      terms_version: TERMS_VERSION,
    })
  }

  /** Dateien im Speicher je Bucket (`<user-id>/<name>`). */
  readonly storage = new Map<string, string[]>()

  /** Der echte Katalog aus der Quelldatei — dieselbe, aus der die SQL entsteht. */
  private seedCatalog(): void {
    for (const entry of SUBSTANCE_CATALOG as CatalogSourceEntry[]) {
      this.insert('substance_catalog', {
        canonical_name: entry.name,
        aliases: entry.aliases,
        default_category: entry.category,
        suggested_units: entry.units,
        suggested_dosage_forms: entry.dosageForms,
        pk_profile_id: null,
        component_names: entry.components ?? [],
        active: true,
      })
    }
  }

  catalogId(name: string): string {
    const entry = this.table('substance_catalog').find(row => row.canonical_name === name)
    if (!entry) throw new Error(`${name} steht nicht im Katalog`)
    return entry.id as string
  }

  table(name: string): Row[] {
    let rows = this.tables.get(name)
    if (!rows) {
      rows = []
      this.tables.set(name, rows)
    }
    return rows
  }

  insert(name: string, row: Row): Row {
    const now = this.now().toISOString()
    const full = { id: randomUUID(), created_at: now, updated_at: now, ...row }
    this.table(name).push(full)
    return full
  }

  /** Eine RPC direkt ausfuehren — um Ausgangsdaten anzulegen, ohne durch die Oberflaeche zu gehen. */
  callRpc(name: string, params: Record<string, unknown>): unknown {
    const handler = this.rpcHandlers.get(name)
    if (!handler) throw new Error(`rpc ${name} not mocked`)
    const failure = this.rpcFailures.get(name)
    if (failure !== undefined) {
      this.rpcFailures.delete(name)
      throw new RpcError(failure)
    }
    return handler(params)
  }

  /** One expected server error before mutation, followed by the normal handler. */
  failNextRpc(name: string, message: string): void {
    if (!this.rpcHandlers.has(name)) throw new Error(`rpc ${name} not mocked`)
    this.rpcFailures.set(name, message)
  }

  onRpc(name: string, handler: (params: Record<string, unknown>) => unknown): void {
    this.rpcHandlers.set(name, handler)
  }

  async install(page: Page, options: { language?: string } = {}): Promise<void> {
    const session = fakeSession(this.now())
    const language = options.language ?? 'de'
    await page.addInitScript(({ key, value, userId, lang }) => {
      // Nur beim ersten Laden: ein Neuladen im Test soll den Zustand behalten.
      if (sessionStorage.getItem('__e2e_seeded')) return
      sessionStorage.setItem('__e2e_seeded', '1')
      localStorage.setItem(key, value)
      localStorage.setItem('tyd_lang', lang)
      localStorage.setItem(`tyd_lang_picked_${userId}`, '1')
      localStorage.setItem(`_ob_done_${userId}`, '1')
      localStorage.setItem('tyd_stack_colors_migrated_v1', '1')
      localStorage.setItem('tyd_push_dismissed', 'true')
      localStorage.setItem('tyd_ios_install_shown', 'true')
    }, { key: STORAGE_KEY, value: JSON.stringify(session), userId: TEST_USER.id, lang: language })

    // Alles ausser der App selbst und dem nachgebildeten Supabase bleibt aus:
    // Schriften, Analytics, Sentry. Der Test haengt so an keinem Netz.
    await page.route(url => !isLocal(url) && url.origin !== SUPABASE_ORIGIN, route => route.abort('blockedbyclient'))
    await page.route(`${SUPABASE_ORIGIN}/**`, route => this.handle(route))
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    this.log.push(`${method} ${url.pathname}`)

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders() })
    }

    try {
      if (url.pathname.startsWith('/auth/v1/')) return await this.handleAuth(route, url)
      if (url.pathname.startsWith('/rest/v1/rpc/')) return await this.handleRpc(route, url)
      if (url.pathname.startsWith('/rest/v1/')) return await this.handleRest(route, url)
      if (url.pathname.startsWith('/storage/v1/object/')) return await this.handleStorage(route, url)
      if (url.pathname === '/functions/v1/bloodwork-extract') return await this.handleBloodworkExtract(route)
      if (url.pathname === '/functions/v1/food-lookup') return await this.handleFoodLookup(route)
      if (url.pathname === '/functions/v1/label-extract') return await this.handleLabelExtract(route)
      if (url.pathname.startsWith('/functions/v1/') || url.pathname.startsWith('/storage/v1/')) {
        this.unhandled.push(`${method} ${url.pathname}`)
        return route.fulfill({ status: 404, headers: corsHeaders(), json: { message: 'not mocked' } })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.unhandled.push(`${method} ${url.pathname}${url.search}: ${message}`)
      return route.fulfill({ status: 400, headers: corsHeaders(), json: { message, code: 'E2E' } })
    }
    this.unhandled.push(`${method} ${url.pathname}`)
    return route.fulfill({ status: 404, headers: corsHeaders(), json: { message: 'not mocked' } })
  }

  /** Aufrufe der Befund-Auswertung (die echte Funktion sendet an Anthropic). */
  readonly extractCalls: { mimeType: string }[] = []

  /**
   * Nachbild von supabase/functions/bloodwork-extract: ohne Einwilligung im
   * Profil 403 `consent_required`, sonst ein fester Beispielbefund.
   */
  private async handleBloodworkExtract(route: Route): Promise<void> {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders() })
    const profil = this.table('profiles').find(row => row.id === TEST_USER.id)
    if (!profil?.ai_import_consent_at) {
      return route.fulfill({ status: 403, headers: corsHeaders(), json: { error: 'consent_required' } })
    }
    const body = (route.request().postDataJSON() ?? {}) as { mimeType?: string }
    this.extractCalls.push({ mimeType: String(body.mimeType ?? '') })
    return route.fulfill({
      headers: corsHeaders(),
      json: {
        tested_at: '2026-09-15', lab_name: 'Testlabor',
        values: [{ marker: 'Ferritin', value: 85, unit: 'ng/ml', ref_min: 30, ref_max: 400, matched: true }],
      },
    })
  }

  /**
   * Nachbild von supabase/functions/label-extract (Etikett per Foto, My Stack):
   * ohne Einwilligung ab dem Etikett-Stichtag 403 `consent_required`, sonst
   * `labelExtract.label` —
   * `null` spielt „kein Etikett erkannt" (422) nach.
   */
  readonly labelExtract: {
    label: Row | null
    calls: { mimeType: string; names: number }[]
  } = {
    label: {
      name: 'BPC-157', brand: 'Testlabor', dosage_form: 'vial',
      ingredients: [{ name: null, amount: 5, unit: 'mg', per_amount: null, per_unit: null }],
    },
    calls: [],
  }

  private async handleLabelExtract(route: Route): Promise<void> {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders() })
    const profil = this.table('profiles').find(row => row.id === TEST_USER.id)
    if (!consentCoversLabels(profil?.ai_import_consent_at as string | null | undefined)) {
      return route.fulfill({ status: 403, headers: corsHeaders(), json: { error: 'consent_required' } })
    }
    const body = (route.request().postDataJSON() ?? {}) as { mimeType?: string; names?: unknown[] }
    this.labelExtract.calls.push({ mimeType: String(body.mimeType ?? ''), names: Array.isArray(body.names) ? body.names.length : 0 })
    if (!this.labelExtract.label) return route.fulfill({ status: 422, headers: corsHeaders(), json: { error: 'no_label_found' } })
    return route.fulfill({ headers: corsHeaders(), json: { label: this.labelExtract.label } })
  }

  /**
   * Nachbild von supabase/functions/food-lookup (Open Food Facts). Tests legen
   * Produkte und Suchtreffer im schon verschlankten Format der Funktion an;
   * `foodLookup.down` spielt „OFF nicht erreichbar" (503) nach.
   */
  readonly foodLookup: {
    products: Record<string, Row | null>
    /** `kind: 'item'` (Substanz-Scan in My Stack): nur Name, Marke, Menge. */
    items: Record<string, Row | null>
    search: Record<string, Row[]>
    down: boolean
    calls: { barcode?: string; query?: string; kind?: string }[]
  } = { products: {}, items: {}, search: {}, down: false, calls: [] }

  private async handleFoodLookup(route: Route): Promise<void> {
    const body = (route.request().postDataJSON() ?? {}) as { barcode?: string; query?: string; kind?: string }
    this.foodLookup.calls.push({ barcode: body.barcode, query: body.query, ...(body.kind ? { kind: body.kind } : {}) })
    if (this.foodLookup.down) return route.fulfill({ status: 503, headers: corsHeaders(), json: { error: 'upstream_unavailable' } })
    if (body.barcode !== undefined && body.kind === 'item') return route.fulfill({ headers: corsHeaders(), json: { item: this.foodLookup.items[body.barcode] ?? null } })
    if (body.barcode !== undefined) return route.fulfill({ headers: corsHeaders(), json: { product: this.foodLookup.products[body.barcode] ?? null } })
    const key = String(body.query ?? '').trim().toLowerCase()
    return route.fulfill({ headers: corsHeaders(), json: { results: this.foodLookup.search[key] ?? [] } })
  }

  /** Auflisten und Loeschen (Konto loeschen), signierte Links (private Buckets). */
  private async handleStorage(route: Route, url: URL): Promise<void> {
    const method = route.request().method()
    const rest = url.pathname.slice('/storage/v1/object/'.length)
    if (method === 'POST' && rest.startsWith('list/')) {
      const bucket = rest.slice('list/'.length)
      const { prefix = '', limit = 100, offset = 0 } = (route.request().postDataJSON() ?? {}) as { prefix?: string; limit?: number; offset?: number }
      const names = (this.storage.get(bucket) ?? [])
        .filter(path => path.startsWith(`${prefix}/`))
        .map(path => path.slice(prefix.length + 1))
        .slice(offset, offset + limit)
      return route.fulfill({ headers: corsHeaders(), json: names.map(name => ({ name, id: name, metadata: {} })) })
    }
    if (method === 'POST' && rest.startsWith('sign/')) {
      const bucket = rest.slice('sign/'.length)
      const { paths = [] } = (route.request().postDataJSON() ?? {}) as { paths?: string[] }
      const vorhanden = this.storage.get(bucket) ?? []
      return route.fulfill({
        headers: corsHeaders(),
        json: paths.map(path => vorhanden.includes(path)
          ? { path, signedURL: `/object/sign/${bucket}/${path}?token=e2e`, error: null }
          : { path, signedURL: null, error: 'Object not found' }),
      })
    }
    if (method === 'DELETE') {
      const bucket = rest
      const { prefixes = [] } = (route.request().postDataJSON() ?? {}) as { prefixes?: string[] }
      this.storage.set(bucket, (this.storage.get(bucket) ?? []).filter(path => !prefixes.includes(path)))
      return route.fulfill({ headers: corsHeaders(), json: prefixes.map(name => ({ name })) })
    }
    this.unhandled.push(`STORAGE ${method} ${url.pathname}`)
    return route.fulfill({ status: 404, headers: corsHeaders(), json: { message: 'not mocked' } })
  }

  private async handleAuth(route: Route, url: URL): Promise<void> {
    if (url.pathname === '/auth/v1/user') {
      return route.fulfill({ headers: corsHeaders(), json: fakeSession(this.now()).user })
    }
    if (url.pathname === '/auth/v1/logout') {
      return route.fulfill({ status: 204, headers: corsHeaders() })
    }
    if (url.pathname === '/auth/v1/token') {
      return route.fulfill({ headers: corsHeaders(), json: fakeSession(this.now()) })
    }
    this.unhandled.push(`AUTH ${url.pathname}`)
    return route.fulfill({ status: 404, headers: corsHeaders(), json: { message: 'not mocked' } })
  }

  private async handleRpc(route: Route, url: URL): Promise<void> {
    const name = url.pathname.slice('/rest/v1/rpc/'.length)
    const params = (route.request().postDataJSON() ?? {}) as Record<string, unknown>
    this.rpcCalls.push({ name, params })
    const handler = this.rpcHandlers.get(name)
    if (!handler) {
      this.unhandled.push(`RPC ${name}`)
      return route.fulfill({ status: 404, headers: corsHeaders(), json: { message: `rpc ${name} not mocked` } })
    }
    try {
      const result = this.callRpc(name, params)
      return await route.fulfill({ headers: corsHeaders(), json: result ?? null })
    } catch (error) {
      if (!(error instanceof RpcError)) throw error
      return route.fulfill({ status: 400, headers: corsHeaders(), json: { code: 'P0001', message: error.message, details: null, hint: null } })
    }
  }

  private async handleRest(route: Route, url: URL): Promise<void> {
    const request = route.request()
    const method = request.method()
    const tableName = url.pathname.slice('/rest/v1/'.length)
    const headers = request.headers()
    const wantsObject = (headers.accept ?? '').includes('vnd.pgrst.object')
    const prefer = headers.prefer ?? ''
    const filters = [...url.searchParams.entries()].filter(([key]) => !RESERVED_PARAMS.has(key))
    const rows = this.table(tableName)
    const selected = () => rows.filter(row => filters.every(([column, filter]) => {
      if (column === 'or' || column === 'and') return logicalMatch(row, column, filter)
      if (column.includes('.')) throw new Error(`Filter auf eingebettete Spalte ${column} nicht nachgebildet`)
      return matches(row, column, filter)
    }))

    const respond = (result: Row[]) => {
      const shaped = result.map(row => this.shape(tableName, row, parseSelect(url.searchParams.get('select') ?? '*')))
      const headers = prefer.includes('count=')
        ? { ...corsHeaders(), 'content-range': `${shaped.length ? `0-${shaped.length - 1}` : '*'}/${shaped.length}` }
        : corsHeaders()
      if (method === 'HEAD') return route.fulfill({ status: 200, headers })
      if (wantsObject) {
        if (shaped.length !== 1) {
          return route.fulfill({
            status: 406,
            headers: corsHeaders(),
            json: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${shaped.length} rows`, hint: null },
          })
        }
        return route.fulfill({ headers, json: shaped[0] })
      }
      return route.fulfill({ headers, json: shaped })
    }

    if (method === 'GET' || method === 'HEAD') {
      let result = selected()
      const order = url.searchParams.get('order')
      if (order) result = sortRows(result, order)
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = url.searchParams.get('limit')
      if (offset || limit) result = result.slice(offset, limit ? offset + Number(limit) : undefined)
      return respond(result)
    }

    const returnRows = prefer.includes('return=representation')
    const body = request.postDataJSON() as Row | Row[] | null

    // Nachbild des Triggers reviews_check_public_text (nur der Link-Teil).
    if (tableName === 'reviews' && (method === 'POST' || method === 'PATCH')) {
      for (const row of Array.isArray(body) ? body : [body ?? {}]) {
        const text = [row.title, row.body, row.pros, row.cons].filter(Boolean).join(' ').toLowerCase()
        if (row.is_public === true && /(https?:\/\/|www\.)/.test(text)) {
          return route.fulfill({ status: 400, headers: corsHeaders(), json: { code: 'P0001', message: 'oeffentlicher_text_link', details: null, hint: null } })
        }
      }
    }

    if (method === 'POST') {
      const incoming = Array.isArray(body) ? body : [body ?? {}]
      const saved = incoming.map(row => {
        if (prefer.includes('resolution=merge-duplicates')) {
          const conflict = (url.searchParams.get('on_conflict') ?? 'id').split(',')
          const existing = rows.find(candidate => conflict.every(column => candidate[column] === row[column]))
          if (existing) return Object.assign(existing, row, { updated_at: this.now().toISOString() })
        }
        return this.insert(tableName, { user_id: TEST_USER.id, ...row })
      })
      return returnRows ? respond(saved) : route.fulfill({ status: 201, headers: corsHeaders() })
    }

    if (method === 'PATCH') {
      const changed = selected().map(row => Object.assign(row, body, { updated_at: this.now().toISOString() }))
      return returnRows ? respond(changed) : route.fulfill({ status: 204, headers: corsHeaders() })
    }

    if (method === 'DELETE') {
      const doomed = new Set(selected())
      this.tables.set(tableName, rows.filter(row => !doomed.has(row)))
      return returnRows ? respond([...doomed]) : route.fulfill({ status: 204, headers: corsHeaders() })
    }

    throw new Error(`${method} nicht nachgebildet`)
  }

  /** Eine Zeile so zurueckgeben, wie PostgREST sie fuer `select` einbettet. */
  private shape(tableName: string, row: Row, fields: SelectField[]): Row {
    const out: Row = {}
    const all = fields.some(field => field.alias === '*' && !field.children)
    if (all) Object.assign(out, row)
    for (const field of fields) {
      if (!field.children) {
        if (field.alias !== '*') {
          const [alias, column] = field.alias.includes(':') ? field.alias.split(':') : [field.alias, field.alias]
          out[alias] = row[column.replace(/::\w+$/, '')] ?? null
        }
        continue
      }
      const relation = RELATIONS[tableName]?.[field.table!]
      if (!relation) throw new Error(`Einbettung ${tableName} -> ${field.table} nicht nachgebildet`)
      const related = this.table(relation.table)
      if (relation.kind === 'one') {
        const child = related.find(candidate => candidate[relation.foreign] === row[relation.local])
        out[field.alias] = child ? this.shape(relation.table, child, field.children) : null
      } else {
        const children = related
          .filter(candidate => candidate[relation.foreign] === row[relation.local])
          .map(child => this.shape(relation.table, child, field.children!))
        out[field.alias] = relation.kind === 'single-child' ? children[0] ?? null : children
      }
    }
    return out
  }

  // ---------------------------------------------------------------------------
  // My Stack: die RPCs, mit denen Anlegen, Bearbeiten und Planaenderung
  // speichern. Nachgebaut ist, was die App danach liest — die Pruefungen der
  // echten Funktionen (supabase-my-stack-*.sql) nicht.

  // ---------------------------------------------------------------------------
  // Store-Konformitaet (supabase-store-compliance.sql): Melden, Blockieren,
  // Moderation, Konto loeschen. Der Testnutzer ist immer der Aufrufer.

  private registerComplianceRpcs(): void {
    const profilVon = (name: unknown) => this.table('profiles')
      .find(row => String(row.username ?? '').toLowerCase() === String(name ?? '').trim().toLowerCase())
    const istAdmin = () => this.table('profiles').some(row => row.id === TEST_USER.id && row.is_admin === true)

    this.onRpc('report_public_review', params => {
      const review = this.table('reviews').find(row => row.id === params.p_review_id)
      const besitzer = review && this.table('profiles').find(row => row.id === review.user_id)
      if (!review || review.is_public !== true || review.hidden_by_moderation === true || besitzer?.is_public !== true || review.user_id === TEST_USER.id) {
        throw new RpcError('meldung_nicht_moeglich')
      }
      if (this.table('content_reports').some(row => row.review_id === review.id && row.reporter_id === TEST_USER.id)) return null
      const substanz = this.table('stack_items').find(row => row.id === review.stack_item_id)?.display_name ?? null
      this.insert('content_reports', {
        review_id: review.id, reported_user_id: review.user_id, reporter_id: TEST_USER.id,
        reason: params.p_reason, details: params.p_details ?? null, status: 'offen',
        snapshot: { art: 'erfahrung', username: besitzer?.username, substanz, title: review.title, body: review.body, pros: review.pros, cons: review.cons },
      })
      return null
    })

    this.onRpc('report_public_profile', params => {
      const ziel = profilVon(params.p_username)
      if (!ziel || ziel.is_public !== true || ziel.hidden_by_moderation === true || ziel.id === TEST_USER.id) throw new RpcError('meldung_nicht_moeglich')
      this.insert('content_reports', {
        review_id: null, reported_user_id: ziel.id, reporter_id: TEST_USER.id,
        reason: params.p_reason, details: params.p_details ?? null, status: 'offen',
        snapshot: { art: 'profil', username: ziel.username, display_name: ziel.display_name ?? null, public_bio: ziel.public_bio ?? null },
      })
      return null
    })

    this.onRpc('set_profile_block', params => {
      const ziel = profilVon(params.p_username)
      if (!ziel || ziel.id === TEST_USER.id) return null
      const rest = this.table('user_blocks').filter(row => !(row.blocker_id === TEST_USER.id && row.blocked_id === ziel.id))
      this.tables.set('user_blocks', rest)
      if (params.p_blocked) this.insert('user_blocks', { blocker_id: TEST_USER.id, blocked_id: ziel.id })
      return null
    })

    this.onRpc('my_blocked_profiles', () => this.table('user_blocks')
      .filter(row => row.blocker_id === TEST_USER.id)
      .map(row => ({ username: this.table('profiles').find(p => p.id === row.blocked_id)?.username ?? null, created_at: row.created_at })))

    this.onRpc('moderation_queue', () => {
      if (!istAdmin()) throw new RpcError('nur_admins')
      return this.table('content_reports').filter(row => row.status === 'offen').map(row => {
        const review = this.table('reviews').find(r => r.id === row.review_id)
        const snapshot = row.snapshot as Row | undefined
        return {
          report_id: row.id, reason: row.reason, details: row.details ?? null, created_at: row.created_at,
          art: snapshot?.art ?? (row.review_id ? 'erfahrung' : 'profil'),
          review_id: row.review_id ?? null, review_exists: Boolean(review),
          username: this.table('profiles').find(p => p.id === row.reported_user_id)?.username ?? snapshot?.username ?? null,
          snapshot: snapshot ?? null,
        }
      })
    })

    this.onRpc('resolve_content_report', params => {
      if (!istAdmin()) throw new RpcError('nur_admins')
      const meldung = this.table('content_reports').find(row => row.id === params.p_report_id)
      if (!meldung) throw new RpcError('meldung_unbekannt')
      if (params.p_action === 'ausblenden') {
        if (meldung.review_id) {
          const review = this.table('reviews').find(row => row.id === meldung.review_id)
          if (review) review.hidden_by_moderation = true
          for (const row of this.table('content_reports')) {
            if (row.review_id === meldung.review_id && row.status === 'offen') row.status = 'erledigt'
          }
        } else {
          const profil = this.table('profiles').find(row => row.id === meldung.reported_user_id)
          if (profil) profil.hidden_by_moderation = true
          meldung.status = 'erledigt'
        }
      } else if (params.p_action === 'ablehnen') {
        if (meldung.status === 'offen') meldung.status = 'abgelehnt'
      } else {
        throw new RpcError('aktion_unbekannt')
      }
      return null
    })

    // Die echte Funktion loescht auth.users; alles haengt per Kaskade daran.
    this.onRpc('delete_my_account', params => {
      if (params.p_nur_pruefen) return true
      for (const [name, rows] of this.tables) {
        this.tables.set(name, rows.filter(row => row.user_id !== TEST_USER.id && row.id !== TEST_USER.id))
      }
      this.log.push('ACCOUNT DELETED')
      return true
    })
  }

  private registerMyStackRpcs(): void {
    const saveItem = (item: Row, ingredients: Row[]): Row => {
      const { inventory, id, ...fields } = item as Row & { inventory?: Row }
      let saved: Row
      if (id) {
        saved = this.table('stack_items').find(row => row.id === id)!
        if (!saved) throw new Error(`stack_item ${String(id)} fehlt`)
        Object.assign(saved, fields, { updated_at: this.now().toISOString() })
        this.tables.set('stack_item_ingredients', this.table('stack_item_ingredients').filter(row => row.stack_item_id !== id))
      } else {
        saved = this.insert('stack_items', {
          user_id: TEST_USER.id,
          configuration_status: 'complete',
          archived: false,
          archived_at: null,
          ...fields,
        })
      }
      for (const ingredient of ingredients) {
        this.insert('stack_item_ingredients', { ...ingredient, stack_item_id: saved.id })
      }
      const existingInventory = this.table('stack_item_inventory').find(row => row.stack_item_id === saved.id)
      if (inventory && existingInventory) {
        Object.assign(existingInventory, inventory, { updated_at: this.now().toISOString() })
      } else if (inventory) {
        this.insert('stack_item_inventory', {
          user_id: TEST_USER.id,
          stack_item_id: saved.id,
          batch_source: null,
          batch_file_url: null,
          opened_at: null,
          use_within_days: null,
          reconstitution_ml: null,
          ...inventory,
        })
      }
      return saved
    }

    this.onRpc('save_stack_item', params => saveItem(params.p_item as Row, params.p_ingredients as Row[]))

    this.onRpc('save_stack_item_with_plan', params => {
      const plan = params.p_plan as Row
      const saved = saveItem(params.p_item as Row, params.p_ingredients as Row[])
      const { timezone, name, start_date, end_date } = plan
      const schedule = pickSchedule(plan)
      const startDate = String(start_date)
      const cycle = this.insert('cycles', {
        user_id: TEST_USER.id,
        stack_item_id: saved.id,
        name,
        start_date: startDate,
        end_date: end_date ?? null,
        active: true,
        started_at: `${startDate}T00:00:00.000Z`,
        ended_at: null,
        start_local_date: startDate,
        end_local_date: null,
        lifecycle_timezone: timezone,
        timezone_review_required: false,
        closed_by_migration_resolution: false,
        ...schedule,
      })
      this.insert('cycle_plan_versions', {
        user_id: TEST_USER.id,
        cycle_id: cycle.id,
        effective_kind: 'local_date',
        effective_at: null,
        effective_local_date: startDate,
        change_kind: 'initial',
        ...schedule,
      })
      return saved
    })

    // Nachbild von supabase-reviews-public.sql: nur oeffentliche Profile,
    // nur freigegebene Bewertungen, nur die freigegebenen Felder.
    this.onRpc('public_profile_reviews', params => {
      const name = String(params.p_username ?? '').trim().toLowerCase()
      const profil = this.table('profiles').find(row => String(row.username ?? '').toLowerCase() === name && row.is_public === true)
      if (!profil) return null
      if (profil.hidden_by_moderation === true) return null
      if (this.table('user_blocks').some(row => row.blocker_id === TEST_USER.id && row.blocked_id === profil.id)) {
        return { username: profil.username, blocked: true, own: false }
      }
      const substanz = (id: unknown) => this.table('stack_items').find(row => row.id === id)?.display_name ?? null
      return {
        username: profil.username, display_name: profil.display_name ?? null, public_bio: profil.public_bio ?? null, blocked: false,
        own: profil.id === TEST_USER.id,
        reviews: this.table('reviews')
          .filter(row => row.user_id === profil.id && row.is_public === true && row.hidden_by_moderation !== true)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .map(row => ({
            id: row.id, substanz: substanz(row.stack_item_id), rating: row.rating, title: row.title || null,
            body: row.body ?? null, pros: row.pros ?? null, cons: row.cons ?? null,
            wirkung: row.wirkung ?? null, vertraeglichkeit: row.vertraeglichkeit ?? null, wieder_nehmen: row.wieder_nehmen ?? null,
            monat: String(row.created_at).slice(0, 7),
          })),
      }
    })

    this.onRpc('end_cycle', params => {
      const cycleId = params.p_cycle_id as string
      const cycle = this.table('cycles').find(row => row.id === cycleId)
      if (cycle) Object.assign(cycle, { active: false, ended_at: this.now().toISOString() })
      return { cycle_id: cycleId }
    })

    this.onRpc('create_plan_version', params => {
      const cycleId = params.p_cycle_id as string
      const snapshot = { ...(params.p_schedule as Row) }
      delete snapshot._timezone
      delete snapshot._effective_now
      const version = this.insert('cycle_plan_versions', {
        user_id: TEST_USER.id,
        cycle_id: cycleId,
        effective_kind: params.p_effective_kind,
        effective_at: params.p_effective_at ?? null,
        effective_local_date: params.p_effective_local_date ?? null,
        change_kind: params.p_change_kind,
        ...pickSchedule(snapshot),
      })
      const cycle = this.table('cycles').find(row => row.id === cycleId)
      if (cycle) Object.assign(cycle, pickSchedule(snapshot))
      return version
    })
  }

  /** Bounded journey substitute, derived from perf-timezone-check and bestand SQL.
   * It models slot identity and inventory ledgers; it does not prove SQL, RLS,
   * concurrent transactions, or every historical inventory migration path.
   */
  private registerIntakeRpcs(): void {
    const owned = (table: string, id: unknown) => this.table(table).find(row => row.id === id && row.user_id === TEST_USER.id)
    const localTime = (instant: unknown, timezone: string): string => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date(String(instant)))
      const part = (kind: string) => parts.find(value => value.type === kind)!.value
      return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`
    }

    this.onRpc('confirm_intake_group', params => {
      const entries = params.p_entries as Row[]
      if (!Array.isArray(entries) || !entries.length) throw new RpcError('At least one intake entry is required')
      if (new Set(entries.map(entry => entry.slot_key)).size !== entries.length) throw new RpcError('Duplicate routine slot key in intake group')
      if (new Set(entries.map(entry => `${entry.cycle_id}@${new Date(String(entry.logged_at)).getTime()}`)).size !== entries.length) throw new RpcError('Duplicate cycle and logged_at in intake group')
      // Validation is separate from mutation so a rejected group writes no rows.
      const validated = entries.map(entry => {
        const cycle = owned('cycles', entry.cycle_id)
        const item = owned('stack_items', entry.stack_item_id)
        if (!cycle || !item || cycle.stack_item_id !== item.id) throw new RpcError('Intake cycle not found')
        const time = new Date(String(entry.logged_at)).getTime()
        if (!cycle.started_at || time < new Date(String(cycle.started_at)).getTime() || (cycle.ended_at && time >= new Date(String(cycle.ended_at)).getTime())) throw new RpcError('Intake falls outside cycle lifecycle')
        if (item.tracking_level === 'intake_only' && entry.dose != null) throw new RpcError('Intake-only entries cannot store a quantity')
        if (item.tracking_level !== 'intake_only' && entry.dose == null) throw new RpcError('Tracked entries require dose and unit')
        if ((entry.dose == null) !== (entry.unit == null)) throw new RpcError('Dose and unit must both be supplied or both be null')
        if (entry.dose != null && (typeof entry.dose !== 'number' || !(entry.dose > 0 && entry.dose <= 1e9))) throw new RpcError('Dose must be positive')
        const taken = entry.taken ?? true
        if (typeof taken !== 'boolean') throw new RpcError('Taken must be a boolean')
        const timezone = String(entry.timezone ?? '')
        let target: string
        try { target = localTime(entry.logged_at, timezone) } catch { throw new RpcError('Invalid timezone') }
        const versions = this.table('cycle_plan_versions').filter(version => version.cycle_id === cycle.id)
          .map(version => ({ version, effective: version.effective_kind === 'instant' ? localTime(version.effective_at, timezone) : `${version.effective_local_date}T00:00:00` }))
          .filter(version => version.effective <= target)
          .sort((a, b) => compare(b.effective, a.effective) || compare(b.version.created_at, a.version.created_at) || compare(b.version.id, a.version.id))
        const versionId = versions[0]?.version.id
        if (!versionId) throw new RpcError('Plan version not found')
        if (entry.plan_version_id && entry.plan_version_id !== versionId) throw new RpcError('Plan version does not match scheduled intake')
        if (this.table('cycle_pause_periods').some(pause => pause.cycle_id === cycle.id && new Date(String(pause.paused_at)).getTime() <= time && (!pause.ends_at || time < new Date(String(pause.ends_at)).getTime()))) throw new RpcError('Intake falls within a paused cycle')
        let saved = this.table('dose_logs').find(log => log.user_id === TEST_USER.id && log.routine_slot_key === entry.slot_key)
        if (saved) {
          if (saved.stack_item_id !== item.id || (saved.cycle_id != null && saved.cycle_id !== cycle.id) || (saved.taken != null && (saved.taken !== taken || new Date(String(saved.logged_at)).getTime() !== time || saved.cycle_id !== cycle.id || saved.plan_version_id !== versionId)) || (entry.dose_log_id && saved.id !== entry.dose_log_id)) throw new RpcError('Routine slot key belongs to another intake')
        } else if (entry.dose_log_id) {
          saved = owned('dose_logs', entry.dose_log_id)
          if (!saved || saved.stack_item_id !== item.id || saved.taken != null || (saved.cycle_id != null && saved.cycle_id !== cycle.id) || (saved.routine_slot_key != null && saved.routine_slot_key !== entry.slot_key)) throw new RpcError('Pending dose log not found')
        }
        return { saved, fields: { user_id: TEST_USER.id, stack_item_id: item.id, cycle_id: cycle.id, plan_version_id: versionId, routine_slot_key: entry.slot_key, dose: entry.dose ?? null, unit: entry.unit ?? null, method: entry.method ?? '', logged_at: entry.logged_at, taken, notes: null } }
      })
      return validated.map(({ saved, fields }) => saved ? saved.taken == null ? Object.assign(saved, fields) : saved : this.insert('dose_logs', fields))
    })

    const ingredientsFor = (item: Row) => this.table('stack_item_ingredients').filter(row => row.stack_item_id === item.id)
    const vialUsesInventory = (item: Row, inventory: Row | undefined) => {
      const ingredients = ingredientsFor(item)
      return item.dosage_form === 'vial' && inventory?.package_unit === 'vial' && ingredients.length === 1 && ingredients[0].basis_unit === 'vial' && Number(ingredients[0].amount_value) > 0 && Number(ingredients[0].basis_value) > 0
    }
    const roundVial = (quantity: number) => Math.round(quantity * 1e4) / 1e4

    this.onRpc('apply_inventory_confirmation', params => {
      const log = owned('dose_logs', params.p_dose_log_id)
      if (!log || log.taken !== true) throw new RpcError('Confirmed dose log not found')
      const item = owned('stack_items', log.stack_item_id)
      if (!item) throw new RpcError('Stack item not found')
      const inventory = this.table('stack_item_inventory').find(row => row.stack_item_id === item.id && row.user_id === TEST_USER.id)
      const vialInventory = vialUsesInventory(item, inventory)
      const legacyVial = item.dosage_form === 'vial' && !vialInventory
      if (!legacyVial && !vialInventory && item.tracking_level !== 'complete') return null
      if (!legacyVial && !inventory) return null
      if (!legacyVial && !inventory!.enabled) return inventory!.remaining_quantity
      const ledger = legacyVial ? 'vial_stock_movements' : 'stack_item_inventory_movements'
      const target = legacyVial ? item : inventory!
      const column = legacyVial ? 'vials_in_stock' : 'remaining_quantity'
      const deltaColumn = legacyVial ? 'delta_vials' : 'delta_quantity'
      const movement = this.table(ledger).find(row => row.source_dose_log_id === log.id && row.user_id === TEST_USER.id)
      const remaining = Number(target[column] ?? 0)
      if (movement?.applied) return remaining
      let delta = Number(movement?.[deltaColumn])
      if (!movement) {
        const dose = Number(log.dose)
        if (!(dose > 0 && dose <= 1e9) || !log.unit) throw new RpcError('Inventory conversion is ambiguous or unsupported')
        if (legacyVial) {
          const unit = String(log.unit).toLowerCase()
          delta = unit === 'ml' ? dose / Number(item.reconstitution_ml) : unit === 'mg' || unit === 'mcg' ? (unit === 'mcg' ? dose / 1000 : dose) / Number(item.vial_amount_mg) : NaN
        } else {
          const deltas = ingredientsFor(item).map(ingredient => {
            if (ingredient.basis_unit !== inventory!.package_unit) return NaN
            if (log.unit === ingredient.basis_unit) return dose
            if (inventory!.package_unit === 'vial' && String(log.unit).toLowerCase() === 'ml') return dose / Number(inventory!.reconstitution_ml)
            const converted = log.unit === ingredient.amount_unit ? dose : log.unit === 'mg' && ingredient.amount_unit === 'mcg' ? dose * 1000 : log.unit === 'mcg' && ingredient.amount_unit === 'mg' ? dose / 1000 : NaN
            return converted / Number(ingredient.amount_value) * Number(ingredient.basis_value)
          })
          delta = deltas.length && deltas.every(value => value === deltas[0]) ? deltas[0] : NaN
        }
      }
      if (!(delta > 0 && delta <= 1e9)) throw new RpcError('Inventory conversion is ambiguous or unsupported')
      if (movement && !legacyVial && !vialInventory && remaining < delta) throw new RpcError('Insufficient inventory for confirmation')
      const actual = Math.min(remaining, legacyVial || vialInventory ? roundVial(delta) : delta)
      if (actual <= 0 && !legacyVial) {
        if (vialInventory) return remaining
        throw new RpcError('Insufficient inventory for confirmation')
      }
      target[column] = legacyVial ? roundVial(remaining - actual) : remaining - actual
      const fields = { dose_log_id: log.id, [deltaColumn]: actual, applied: true }
      if (movement) Object.assign(movement, fields)
      else this.insert(ledger, { user_id: TEST_USER.id, ...(legacyVial ? { stack_item_id: item.id } : { inventory_id: inventory!.id }), source_dose_log_id: log.id, reversal_count: 0, last_reversed_at: null, last_reversal_action: null, ...fields })
      return target[column]
    })

    this.onRpc('reverse_inventory_confirmation', params => {
      const action = params.p_action
      if (!['undo', 'skip', 'delete'].includes(String(action))) throw new RpcError('Invalid inventory reversal action')
      const log = owned('dose_logs', params.p_dose_log_id)
      const movement = this.table('stack_item_inventory_movements').find(row => row.source_dose_log_id === params.p_dose_log_id && row.user_id === TEST_USER.id)
      const vialMovement = this.table('vial_stock_movements').find(row => row.source_dose_log_id === params.p_dose_log_id && row.user_id === TEST_USER.id)
      if (movement && vialMovement) throw new RpcError('Dose log has multiple inventory ledgers')
      if (!log && ((!movement && !vialMovement) || action !== 'delete')) throw new RpcError('Dose log not found')
      const ledger = movement ?? vialMovement
      let remaining: number | null = null
      if (ledger) {
        const item = vialMovement ? owned('stack_items', ledger.stack_item_id) : undefined
        const inventory = vialMovement ? this.table('stack_item_inventory').find(row => row.stack_item_id === item?.id && row.user_id === TEST_USER.id) : owned('stack_item_inventory', ledger.inventory_id)
        const toInventory = !vialMovement || (!!item && vialUsesInventory(item, inventory))
        const target = toInventory ? inventory : item
        if (!target) throw new RpcError(toInventory ? 'Inventory not found' : 'Stack item not found')
        const column = toInventory ? 'remaining_quantity' : 'vials_in_stock'
        remaining = Number(target[column] ?? 0)
        if (ledger.applied) {
          remaining += Number(ledger[vialMovement ? 'delta_vials' : 'delta_quantity'])
          target[column] = vialMovement ? roundVial(remaining) : remaining
          Object.assign(ledger, { applied: false, reversal_count: Number(ledger.reversal_count) + 1, last_reversed_at: this.now().toISOString(), last_reversal_action: action })
        }
      }
      if (log) {
        if (action === 'delete') this.tables.set('dose_logs', this.table('dose_logs').filter(row => row !== log))
        else log.taken = action === 'skip' ? false : null
      }
      return remaining
    })
  }
}

const SCHEDULE_COLUMNS = [
  'frequency', 'x_days_interval', 'interval_unit', 'cycle_on_days', 'cycle_off_days', 'schedule_days',
  'intake_time', 'intake_time_custom', 'slot_doses', 'slot_days', 'dose', 'unit', 'method',
] as const

function pickSchedule(source: Row): Row {
  return Object.fromEntries(SCHEDULE_COLUMNS.map(column => [column, source[column] ?? (column === 'schedule_days' ? [] : null)]))
}

function sortRows(rows: Row[], order: string): Row[] {
  const keys = order.split(',').map(part => {
    const [column, direction] = part.split('.')
    return { column, descending: direction === 'desc' }
  })
  return [...rows].sort((a, b) => {
    for (const { column, descending } of keys) {
      const order = compare(a[column], b[column])
      if (order !== 0) return order * (descending ? -1 : 1)
    }
    return 0
  })
}

function isLocal(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS',
    'access-control-expose-headers': 'content-range',
  }
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function fakeSession(now: Date) {
  const expiresAt = Math.floor(now.getTime() / 1000) + 24 * 3600
  const user = {
    id: TEST_USER.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: TEST_USER.email,
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
  }
  return {
    access_token: `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: TEST_USER.id, role: 'authenticated', exp: expiresAt })}.e2e`,
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: expiresAt,
    user,
  }
}
