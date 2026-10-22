import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cacheSchluessel, dienstFetch, istDienstAnfrage, nutzerAusToken,
  setzeAngemeldetenNutzer, setzeStoerungSimuliert, stoerungsZustand, vergissOfflineDaten,
} from './stoerung'

const SUPABASE = 'https://projekt.supabase.co'

function token(sub: string) {
  const teil = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${teil({ alg: 'HS256' })}.${teil({ sub })}.signatur`
}

/** Wie viele Antworten gemerkt sind (dieselbe IndexedDB, die die App nutzt). */
function anzahl(): Promise<number> {
  return new Promise((resolve, reject) => {
    const offen = indexedDB.open('tyd-offline-daten', 1)
    offen.onsuccess = () => {
      const zaehlen = offen.result.transaction('antworten').objectStore('antworten').count()
      zaehlen.onsuccess = () => { offen.result.close(); resolve(zaehlen.result) }
      zaehlen.onerror = () => reject(zaehlen.error)
    }
    offen.onerror = () => reject(offen.error)
  })
}

const leseKopf = (nutzer: string) => ({ headers: new Headers({ Authorization: `Bearer ${token(nutzer)}`, Accept: 'application/json' }) })
// IndexedDB schreibt nach der Antwort im Hintergrund
const warte = () => new Promise(r => setTimeout(r, 30))

describe('Störung und Offline-Lesecache', () => {
  let netz: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    await vergissOfflineDaten()
    netz = vi.fn()
    vi.stubGlobal('location', { origin: 'https://app.test', href: 'https://app.test/' })
    vi.stubGlobal('fetch', netz)
    setzeStoerungSimuliert(false)
    setzeAngemeldetenNutzer(null)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('zählt fremde Herkunft und /api/ als Dienst, eigene Programmteile nicht', () => {
    expect(istDienstAnfrage(new URL(`${SUPABASE}/rest/v1/stack_items`))).toBe(true)
    expect(istDienstAnfrage(new URL('https://app.test/api/peptide-ai'))).toBe(true)
    expect(istDienstAnfrage(new URL('https://app.test/assets/Home-abc.js'))).toBe(false)
    expect(istDienstAnfrage(new URL('data:text/plain,x'))).toBe(false)
    expect(istDienstAnfrage(null)).toBe(false)
  })

  it('liest die Nutzer-ID aus dem Token und merkt ohne Nutzer nichts', () => {
    expect(nutzerAusToken(`Bearer ${token('nutzer-1')}`)).toBe('nutzer-1')
    expect(nutzerAusToken('Bearer kaputt')).toBeNull()
    expect(nutzerAusToken(null)).toBeNull()
    expect(cacheSchluessel(new URL(`${SUPABASE}/rest/v1/x`), null, null, null)).toBeNull()
    // Gleiche URL, anderes Accept (.single()) → andere Antwort
    const url = new URL(`${SUPABASE}/rest/v1/x?select=*`)
    expect(cacheSchluessel(url, 'a', 'application/json', null))
      .not.toBe(cacheSchluessel(url, 'a', 'application/vnd.pgrst.object+json', null))
  })

  it('beantwortet Lesen ohne Netz mit der zuletzt geladenen Antwort — nur für denselben Nutzer', async () => {
    const url = `${SUPABASE}/rest/v1/stack_items?select=*`
    netz.mockResolvedValueOnce(new Response('[{"id":1}]', { status: 200 }))
    await (await dienstFetch(url, leseKopf('nutzer-1'))).json()
    await warte()

    netz.mockRejectedValue(new TypeError('Failed to fetch'))
    const offline = await dienstFetch(url, leseKopf('nutzer-1'))
    expect(await offline.json()).toEqual([{ id: 1 }])
    expect(stoerungsZustand()).toMatchObject({ verbindung: 'offline', ausCache: true })

    await expect(dienstFetch(url, leseKopf('nutzer-2'))).rejects.toThrow('Failed to fetch')
  })

  it('merkt weder Fehlerantworten noch Schreibzugriffe', async () => {
    const url = `${SUPABASE}/rest/v1/stack_items`
    netz.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await dienstFetch(url, leseKopf('nutzer-1'))
    netz.mockResolvedValueOnce(new Response('{}', { status: 201 }))
    await dienstFetch(url, { ...leseKopf('nutzer-1'), method: 'POST', body: '{}' })
    await warte()
    expect(await anzahl()).toBe(0)
  })

  it('simuliert den Ausfall für jeden Dienst, lässt eigene Programmteile durch', async () => {
    const url = `${SUPABASE}/rest/v1/stack_items?select=*`
    netz.mockResolvedValueOnce(new Response('[1]', { status: 200 }))
    await dienstFetch(url, leseKopf('nutzer-1'))
    await warte()

    setzeStoerungSimuliert(true)
    netz.mockResolvedValue(new Response('ok'))
    // Lesen: aus dem Cache, ohne das Netz zu fragen
    expect(await (await dienstFetch(url, leseKopf('nutzer-1'))).json()).toEqual([1])
    await expect(dienstFetch(`${SUPABASE}/auth/v1/token`, { method: 'POST' })).rejects.toBeInstanceOf(TypeError)
    await expect(dienstFetch('/api/vapid-public')).rejects.toBeInstanceOf(TypeError)
    expect(netz).toHaveBeenCalledTimes(1)

    expect(await (await dienstFetch('/assets/Home-abc.js')).text()).toBe('ok')

    setzeStoerungSimuliert(false)
    expect(stoerungsZustand()).toMatchObject({ simuliert: false, verbindung: 'online' })
  })

  it('wertet Abbrechen nicht als Störung', async () => {
    netz.mockRejectedValue(new DOMException('abgebrochen', 'AbortError'))
    await expect(dienstFetch(`${SUPABASE}/rest/v1/x`, leseKopf('nutzer-1'))).rejects.toThrow('abgebrochen')
    expect(stoerungsZustand().verbindung).toBe('online')
  })

  it('vergisst beim Abmelden alle gemerkten Daten', async () => {
    netz.mockResolvedValueOnce(new Response('[1]', { status: 200 }))
    await dienstFetch(`${SUPABASE}/rest/v1/x`, leseKopf('nutzer-1'))
    await warte()
    expect(await anzahl()).toBe(1)
    await vergissOfflineDaten()
    expect(await anzahl()).toBe(0)
  })

  it('fängt einen Ausfall hinter Cloudflare (503/522) wie fehlendes Netz ab', async () => {
    const url = `${SUPABASE}/rest/v1/stack_items?select=*`
    netz.mockResolvedValueOnce(new Response('[1]', { status: 200 }))
    await dienstFetch(url, leseKopf('nutzer-1'))
    await warte()

    netz.mockResolvedValueOnce(new Response('', { status: 522 }))
    expect(await (await dienstFetch(url, leseKopf('nutzer-1'))).json()).toEqual([1])
    expect(stoerungsZustand().verbindung).toBe('offline')
    // Ohne Gemerktes kommt die Fehlerantwort durch
    netz.mockResolvedValueOnce(new Response('', { status: 503 }))
    expect((await dienstFetch(`${SUPABASE}/rest/v1/andere`, leseKopf('nutzer-1'))).status).toBe(503)
  })

  it('lässt einen gescheiterten Fremddienst (Sentry, PubMed) die App nicht offline melden', async () => {
    netz.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(dienstFetch('https://o1.ingest.de.sentry.io/api/1/envelope/', { method: 'POST' })).rejects.toThrow()
    expect(stoerungsZustand().verbindung).toBe('online')
  })

  it('liest bei abgelaufenem Token (nur öffentlicher Schlüssel) für den Angemeldeten, merkt aber nichts', async () => {
    const url = `${SUPABASE}/rest/v1/stack_items?select=*`
    netz.mockResolvedValueOnce(new Response('[1]', { status: 200 }))
    await dienstFetch(url, leseKopf('nutzer-1'))
    await warte()

    const oeffentlich = { headers: new Headers({ Authorization: 'Bearer sb_publishable_x', Accept: 'application/json' }) }
    netz.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(dienstFetch(url, oeffentlich)).rejects.toThrow()
    setzeAngemeldetenNutzer('nutzer-1')
    netz.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await (await dienstFetch(url, oeffentlich)).json()).toEqual([1])

    netz.mockResolvedValueOnce(new Response('[]', { status: 200 }))
    await dienstFetch(`${SUPABASE}/rest/v1/neu`, oeffentlich)
    await warte()
    expect(await anzahl()).toBe(1)
  })

  it('merkt nichts mehr, was vor dem Abmelden losging', async () => {
    let antworte!: (r: Response) => void
    netz.mockReturnValueOnce(new Promise<Response>(r => { antworte = r }))
    const laeuft = dienstFetch(`${SUPABASE}/rest/v1/daily_logs`, leseKopf('nutzer-1'))
    await vergissOfflineDaten()
    antworte(new Response('[1]', { status: 200 }))
    await laeuft
    await warte()
    expect(await anzahl()).toBe(0)
  })

  it('hält höchstens 400 Antworten vor und wirft die ältesten zuerst raus', async () => {
    netz.mockImplementation(async () => new Response('[1]', { status: 200 }))
    for (let i = 0; i < 405; i++) await dienstFetch(`${SUPABASE}/rest/v1/x?i=${i}`, leseKopf('nutzer-1'))
    await vi.waitFor(async () => expect(await anzahl()).toBe(400))

    netz.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(dienstFetch(`${SUPABASE}/rest/v1/x?i=0`, leseKopf('nutzer-1'))).rejects.toThrow()
    expect(await (await dienstFetch(`${SUPABASE}/rest/v1/x?i=404`, leseKopf('nutzer-1'))).json()).toEqual([1])
  })
})
