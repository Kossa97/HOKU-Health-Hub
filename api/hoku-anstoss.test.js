import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './hoku-anstoss.js'

function req(auth) {
  return { method: 'GET', headers: auth === undefined ? {} : { authorization: auth } }
}

function res() {
  const r = { statusCode: 200, headers: {}, body: undefined }
  r.setHeader = (k, v) => { r.headers[k] = v; return r }
  r.status = (c) => { r.statusCode = c; return r }
  r.end = (b) => { r.body = b === undefined ? undefined : JSON.parse(b); return r }
  return r
}

function antwort(body, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

describe('api/hoku-anstoss', () => {
  const fetchMock = vi.fn()
  const env = { ...process.env }

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    process.env.CRON_SECRET = 'cron'
    process.env.SUPABASE_URL = 'https://x.supabase.co'
    process.env.HOKU_ANSTOSS_SECRET = 'geheim'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...env }
  })

  it('lehnt ohne richtiges Cron-Secret mit 401 ab und ruft nichts auf', async () => {
    const r = res()
    await handler(req('Bearer falsch'), r)
    expect(r.statusCode).toBe(401)
    const r2 = res()
    await handler(req(undefined), r2)
    expect(r2.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lehnt ab, wenn CRON_SECRET nicht gesetzt ist', async () => {
    delete process.env.CRON_SECRET
    const r = res()
    await handler(req('Bearer '), r)
    expect(r.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('meldet 500, wenn das Anstoß-Secret oder die URL fehlt', async () => {
    delete process.env.HOKU_ANSTOSS_SECRET
    const r = res()
    await handler(req('Bearer cron'), r)
    expect(r.statusCode).toBe(500)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('folgt weiter bis null und zählt', async () => {
    fetchMock
      .mockResolvedValueOnce(antwort({ bearbeitet: 50, weiter: 'a' }))
      .mockResolvedValueOnce(antwort({ bearbeitet: 50, weiter: 'b' }))
      .mockResolvedValueOnce(antwort({ bearbeitet: 7, weiter: null }))
    const r = res()
    await handler(req('Bearer cron'), r)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(r.statusCode).toBe(200)
    expect(r.body).toEqual({ aufrufe: 3, bearbeitet: 107 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://x.supabase.co/functions/v1/erkenntnisse')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'x-hoku-secret': 'geheim', 'x-region': 'eu-west-1', 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({})
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ nach: 'a' })
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ nach: 'b' })
  })

  it('ruft höchstens 20-mal auf', async () => {
    fetchMock.mockResolvedValue(antwort({ bearbeitet: 1, weiter: 'immer' }))
    const r = res()
    await handler(req('Bearer cron'), r)
    expect(fetchMock).toHaveBeenCalledTimes(20)
    expect(r.statusCode).toBe(200)
    expect(r.body).toEqual({ aufrufe: 20, bearbeitet: 20 })
  })

  it('hält bei einem fehlgeschlagenen Aufruf an und gibt nur Zähler zurück', async () => {
    fetchMock
      .mockResolvedValueOnce(antwort({ bearbeitet: 50, weiter: 'a' }))
      .mockResolvedValueOnce(antwort({ error: 'geheime Einzelheiten' }, false, 500))
    const r = res()
    await handler(req('Bearer cron'), r)
    expect(r.statusCode).toBe(502)
    expect(r.body).toEqual({ aufrufe: 2, bearbeitet: 50 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('hält auch bei einem Netzwerkfehler an', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    const r = res()
    await handler(req('Bearer cron'), r)
    expect(r.statusCode).toBe(502)
    expect(r.body).toEqual({ aufrufe: 1, bearbeitet: 0 })
  })

  it('wertet eine Antwort ohne brauchbare Zahlen als Fehler', async () => {
    fetchMock.mockResolvedValueOnce(antwort({ irgendwas: 1 }))
    const r = res()
    await handler(req('Bearer cron'), r)
    expect(r.statusCode).toBe(502)
    expect(r.body).toEqual({ aufrufe: 1, bearbeitet: 0 })
  })
})
