import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler, { MAX_EXISTING, MAX_NAME } from './peptide-ai.js'

const USER_ID = '11111111-2222-3333-4444-555555555555'

function req({ method = 'POST', auth = 'Bearer tok', body = { action: 'create', name: 'BPC-157' } } = {}) {
  return { method, headers: auth === null ? {} : { authorization: auth }, body }
}

function res() {
  const r = { statusCode: 200, headers: {}, body: undefined }
  r.setHeader = (k, v) => { r.headers[k] = v; return r }
  r.end = (b) => { r.body = b === undefined ? undefined : JSON.parse(b); return r }
  return r
}

function antwort(body, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

describe('api/peptide-ai', () => {
  const fetchMock = vi.fn()
  const env = { ...process.env }

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    process.env.SUPABASE_URL = 'https://x.supabase.co'
    process.env.SUPABASE_SERVICE_KEY = 'service'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    process.env = { ...env }
  })

  // Reihenfolge der Aufrufe: auth/v1/user → profiles → Anthropic
  function alsAdmin(isAdmin = true) {
    fetchMock
      .mockResolvedValueOnce(antwort({ id: USER_ID }))
      .mockResolvedValueOnce(antwort([{ is_admin: isAdmin }]))
  }

  it('lehnt ohne Token mit 401 ab und ruft nichts auf', async () => {
    const r = res()
    await handler(req({ auth: null }), r)
    expect(r.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lehnt ein ungültiges Token mit 401 ab, ohne Anthropic zu rufen', async () => {
    fetchMock.mockResolvedValueOnce(antwort({ msg: 'bad jwt' }, false, 401))
    const r = res()
    await handler(req(), r)
    expect(r.statusCode).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('lehnt angemeldete Nicht-Admins mit 403 ab, ohne Anthropic zu rufen', async () => {
    alsAdmin(false)
    const r = res()
    await handler(req(), r)
    expect(r.statusCode).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('anthropic'))).toBe(false)
  })

  it('setzt keinen CORS-Header', async () => {
    const r = res()
    await handler(req({ auth: null }), r)
    expect(r.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('weist zu lange Namen und zu große Profile ab', async () => {
    alsAdmin()
    const r = res()
    await handler(req({ body: { action: 'create', name: 'x'.repeat(MAX_NAME + 1) } }), r)
    expect(r.statusCode).toBe(400)

    alsAdmin()
    const r2 = res()
    await handler(req({ body: { action: 'update', existing: { tldr: 'x'.repeat(MAX_EXISTING) } } }), r2)
    expect(r2.statusCode).toBe(400)
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('anthropic'))).toBe(false)
  })

  it('gibt Anthropic-Fehler nicht an den Client weiter', async () => {
    alsAdmin()
    fetchMock.mockResolvedValueOnce(antwort({ error: 'interner Text' }, false, 529))
    const r = res()
    await handler(req(), r)
    expect(r.statusCode).toBe(502)
    expect(JSON.stringify(r.body)).not.toContain('interner Text')
  })

  it('liefert für Admins das Ergebnis', async () => {
    alsAdmin()
    fetchMock.mockResolvedValueOnce(antwort({ content: [{ text: 'Hier: {"name":"BPC-157"}' }] }))
    const r = res()
    await handler(req(), r)
    expect(r.statusCode).toBe(200)
    expect(r.body).toEqual({ result: { name: 'BPC-157' } })
    const [, profilAufruf] = fetchMock.mock.calls
    expect(String(profilAufruf[0])).toContain(`id=eq.${USER_ID}`)
    expect(r.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('meldet einen Supabase-Ausfall als 503, nicht als abgelaufene Sitzung', async () => {
    fetchMock.mockResolvedValueOnce(antwort({}, false, 500))
    const r = res()
    await handler(req(), r)
    expect(r.statusCode).toBe(503)
  })

  it('weist unbekannte Aktionen und zu große Bodies ab', async () => {
    alsAdmin()
    const r = res()
    await handler(req({ body: { action: 'loeschen' } }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.error).toBe('invalid_action')

    alsAdmin()
    const r2 = res()
    await handler(req({ body: JSON.stringify({ action: 'create', name: 'ä'.repeat(40_000) }) }), r2)
    expect(r2.statusCode).toBe(413)
  })

  it('behandelt kaputtes JSON in der KI-Antwort als 502', async () => {
    alsAdmin()
    fetchMock.mockResolvedValueOnce(antwort({ content: [{ text: '{"a":1} Hinweis: {siehe oben}' }] }))
    const r = res()
    await handler(req(), r)
    expect(r.statusCode).toBe(502)
    expect(r.body.error).toBe('ai_no_json')
  })
})
