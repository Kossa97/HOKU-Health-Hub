import { useSyncExternalStore } from 'react'

/**
 * Störung und Offline-Betrieb.
 *
 * Fallen Supabase oder andere Dienste aus (oder hat das Gerät kein Netz),
 * soll die App weiterlaufen: Seiten zeigen die zuletzt geladenen Daten,
 * Speichern scheitert mit einer Meldung statt eines weißen Bildschirms.
 *
 * Dafür läuft jede Anfrage an einen Dienst durch `dienstFetch`:
 * - Lesen (GET auf /rest/v1/) wird bei Erfolg je Nutzer im Cache Storage
 *   abgelegt und bei Netzfehler von dort beantwortet.
 * - Der Schalter „Störung simulieren“ lässt jede Dienst-Anfrage scheitern
 *   wie bei einem echten Ausfall (TypeError wie bei fehlendem Netz).
 *
 * Dienst = andere Herkunft (Supabase, PubMed, …) oder /api/ der eigenen
 * Seite. Programmteile und Bilder der App selbst bleiben unberührt — die
 * liefert bei einem echten Ausfall weiter Vercel bzw. der Service Worker.
 */

const SCHALTER_KEY = 'tyd_stoerung'
const CACHE_NAME = 'tyd-offline-daten-v1'
const NUTZER_PARAM = '__tyd_u'

export type Verbindung = 'online' | 'offline'

interface Zustand {
  simuliert: boolean
  verbindung: Verbindung
  /** Mindestens eine Antwort seit dem letzten Netzfehler kam aus dem Cache. */
  ausCache: boolean
}

function leseSchalter(): boolean {
  try { return localStorage.getItem(SCHALTER_KEY) === '1' } catch { return false }
}

let zustand: Zustand = {
  simuliert: leseSchalter(),
  verbindung: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online',
  ausCache: false,
}
const hoerer = new Set<() => void>()

function setze(teil: Partial<Zustand>) {
  const neu = { ...zustand, ...teil }
  if (neu.simuliert === zustand.simuliert && neu.verbindung === zustand.verbindung && neu.ausCache === zustand.ausCache) return
  zustand = neu
  for (const h of hoerer) h()
}

function abonniere(h: () => void) {
  hoerer.add(h)
  return () => { hoerer.delete(h) }
}

export function stoerungsZustand(): Zustand {
  return zustand
}

export function useStoerung(): Zustand {
  return useSyncExternalStore(abonniere, stoerungsZustand, stoerungsZustand)
}

export function istStoerungSimuliert(): boolean {
  return zustand.simuliert
}

export function setzeStoerungSimuliert(an: boolean): void {
  try {
    if (an) localStorage.setItem(SCHALTER_KEY, '1')
    else localStorage.removeItem(SCHALTER_KEY)
  } catch {
    // Ohne Speicher gilt der Schalter nur bis zum Neuladen
  }
  setze({ simuliert: an, ...(an ? {} : { verbindung: 'online' as const, ausCache: false }) })
}

// ── Anfragen ────────────────────────────────────────────────────────────────

function anfrageUrl(input: RequestInfo | URL): URL | null {
  try {
    const roh = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return new URL(roh, typeof location !== 'undefined' ? location.href : 'http://localhost/')
  } catch {
    return null
  }
}

export function istDienstAnfrage(url: URL | null): boolean {
  if (!url) return false
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const eigeneHerkunft = typeof location !== 'undefined' ? location.origin : ''
  if (url.origin !== eigeneHerkunft) return true
  // /ncbi/: PubMed über den Proxy der Entwicklung (vite.config.ts)
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/ncbi/')
}

/**
 * Nur Supabase und /api/ bestimmen den Verbindungszustand — ein vom
 * Werbeblocker geschluckter Sentry-Bericht oder ein Fehler bei PubMed
 * macht die App nicht „offline".
 */
function istKernDienst(url: URL): boolean {
  if (typeof location !== 'undefined' && url.origin === location.origin) return url.pathname.startsWith('/api/')
  return /^\/(rest|auth|storage|functions)\/v1\//.test(url.pathname)
}

/** Antworten, mit denen ein ausgefallener Dienst (bzw. Cloudflare davor) antwortet. */
function istAusfallAntwort(antwort: Response): boolean {
  return antwort.status === 502 || antwort.status === 503 || antwort.status === 504 || (antwort.status >= 520 && antwort.status <= 527)
}

function methodeVon(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
}

function kopfVon(input: RequestInfo | URL, init: RequestInit | undefined, name: string): string | null {
  if (init?.headers) return new Headers(init.headers).get(name)
  if (typeof input === 'object' && 'headers' in input) return input.headers.get(name)
  return null
}

/** Nutzer-ID aus dem Zugangs-Token (nur lesen, nicht prüfen — das macht der Server). */
export function nutzerAusToken(authorization: string | null): string | null {
  const token = authorization?.replace(/^Bearer\s+/i, '')
  const teil = token?.split('.')[1]
  if (!teil) return null
  try {
    const json = atob(teil.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(teil.length / 4) * 4, '='))
    const sub = (JSON.parse(json) as { sub?: unknown }).sub
    return typeof sub === 'string' && sub ? sub : null
  } catch {
    return null
  }
}

/**
 * Cache-Schlüssel einer Leseanfrage. Gleiche URL mit anderem `Accept`
 * (`.single()`) oder `Prefer` (Zählen) ist eine andere Antwort; ohne
 * angemeldeten Nutzer wird nichts gemerkt — Daten fremder Konten dürfen
 * offline nie auftauchen.
 */
export function cacheSchluessel(url: URL, nutzer: string | null, accept: string | null, prefer: string | null): string | null {
  if (!nutzer) return null
  const k = new URL(url.href)
  k.searchParams.set(NUTZER_PARAM, nutzer)
  if (accept) k.searchParams.set('__tyd_a', accept)
  if (prefer) k.searchParams.set('__tyd_p', prefer)
  return k.href
}

function istLesbar(url: URL, methode: string): boolean {
  return methode === 'GET' && url.pathname.includes('/rest/v1/')
}

const MAX_EINTRAEGE = 400

async function oeffneCache(): Promise<Cache | null> {
  try {
    if (typeof caches === 'undefined') return null
    return await caches.open(CACHE_NAME)
  } catch {
    return null
  }
}

/**
 * Wer angemeldet ist (AuthContext). Läuft das Token offline ab, schickt
 * supabase-js statt des Tokens nur den öffentlichen Schlüssel — gelesen wird
 * dann für diesen Nutzer. Gemerkt wird nur, was mit Token kam.
 */
let angemeldet: string | null = null
// Steigt beim Abmelden: Antworten, die davor losgingen, werden nicht mehr gemerkt.
let generation = 0

export function setzeAngemeldetenNutzer(nutzer: string | null): void {
  angemeldet = nutzer
}

async function merke(schluessel: string, antwort: Response, gen: number): Promise<void> {
  const cache = await oeffneCache()
  if (!cache || gen !== generation) return
  await cache.put(schluessel, antwort)
  // Ältestes zuerst; ein erneutes put hängt den Eintrag hinten an
  const schluesselListe = await cache.keys()
  for (const alt of schluesselListe.slice(0, Math.max(0, schluesselListe.length - MAX_EINTRAEGE))) {
    await cache.delete(alt)
  }
}

async function ausDemCache(schluessel: string | null): Promise<Response | undefined> {
  if (!schluessel) return undefined
  const gemerkt = await (await oeffneCache())?.match(schluessel).catch(() => undefined)
  if (gemerkt) setze({ ausCache: true })
  return gemerkt ?? undefined
}

let echtesFetch: typeof fetch | null = null

function basisFetch(): typeof fetch {
  return echtesFetch ?? globalThis.fetch
}

function simulierterAusfall(): TypeError {
  return new TypeError('Failed to fetch (Störung simuliert)')
}

/** Fetch für alle Dienste; ab `installStoerungsFetch` ist es `window.fetch`. */
export async function dienstFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = anfrageUrl(input)
  if (!url || !istDienstAnfrage(url)) return basisFetch()(input, init)

  const kern = istKernDienst(url)
  const lesbar = istLesbar(url, methodeVon(input, init))
  const tokenNutzer = lesbar ? nutzerAusToken(kopfVon(input, init, 'authorization')) : null
  const schluesselFuer = (nutzer: string | null) =>
    lesbar ? cacheSchluessel(url, nutzer, kopfVon(input, init, 'accept'), kopfVon(input, init, 'prefer')) : null
  const merkSchluessel = schluesselFuer(tokenNutzer)
  const leseSchluessel = schluesselFuer(tokenNutzer ?? angemeldet)
  const gen = generation

  let antwort: Response
  try {
    if (zustand.simuliert) throw simulierterAusfall()
    antwort = await basisFetch()(input, init)
  } catch (fehler) {
    // Abgebrochen (Seite verlassen) ist keine Störung
    if (fehler instanceof DOMException && fehler.name === 'AbortError') throw fehler
    if (kern) setze({ verbindung: 'offline' })
    const gemerkt = await ausDemCache(leseSchluessel)
    if (gemerkt) return gemerkt
    throw fehler
  }

  if (kern && istAusfallAntwort(antwort)) {
    // Dienst da, aber ausgefallen (Supabase hinter Cloudflare: 502/503/52x)
    setze({ verbindung: 'offline' })
    return (await ausDemCache(leseSchluessel)) ?? antwort
  }
  if (kern) setze({ verbindung: 'online', ausCache: false })
  if (merkSchluessel && antwort.ok) void merke(merkSchluessel, antwort.clone(), gen).catch(() => {})
  return antwort
}

/**
 * Ersetzt `window.fetch`, damit auch Anfragen ohne Supabase-Client
 * (/api/, PubMed, Open Food Facts) den Schalter sehen. Einmal beim Start.
 */
export function installStoerungsFetch(): void {
  if (echtesFetch || typeof window === 'undefined') return
  echtesFetch = window.fetch.bind(window)
  window.fetch = dienstFetch
  window.addEventListener('online', () => setze({ verbindung: 'online' }))
  window.addEventListener('offline', () => setze({ verbindung: 'offline' }))
}

/** Beim Abmelden: gemerkte Daten vom Gerät nehmen. */
export async function vergissOfflineDaten(): Promise<void> {
  generation += 1
  angemeldet = null
  try {
    if (typeof caches !== 'undefined') await caches.delete(CACHE_NAME)
  } catch {
    // Nichts gemerkt, nichts zu vergessen
  }
}
