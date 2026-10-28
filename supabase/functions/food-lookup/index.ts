/* global Deno */
// Lebensmittel aus Open Food Facts — per Barcode oder Suche. Mit `kind: 'item'`
// nur Name und Marke eines Produkts (Substanz-Scan in My Stack).
// Läuft über uns, nicht direkt aus dem Browser: OFF verlangt einen eigenen
// User-Agent, die Antwort wird verschlankt und zwischengespeichert, und OFF
// sieht weder IP noch Suchbegriffe einzelner Nutzer.
//
// Grenzen: OFF erlaubt je IP 15 Produktabrufe und 10 Suchen pro Minute — und
// alle Aufrufe hier teilen sich die IP der Funktion. Deshalb nur angemeldete
// Nutzer (echte Sitzung, nicht bloß der öffentliche Schlüssel), eine Grenze je
// Nutzer und eine Bremse für Abrufe, die nicht aus dem Zwischenspeicher kommen.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  type OffFood,
  type OffItem,
  RateLimiter,
  TtlCache,
  USER_AGENT,
  itemUrl,
  normalizeBarcode,
  normalizeQuery,
  parseItemResponse,
  parseProductResponse,
  parseSearchResponse,
  productUrl,
  searchUrl,
} from './off.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const productCache = new TtlCache<OffFood | null>(24 * 60 * 60 * 1000)
const itemCache = new TtlCache<OffItem | null>(24 * 60 * 60 * 1000)
const searchCache = new TtlCache<OffFood[]>(60 * 60 * 1000)
const perUser = new RateLimiter(30, 60 * 1000)
// Unter den OFF-Grenzen bleiben (15 bzw. 10 je Minute), mit Abstand.
const upstreamProducts = new RateLimiter(12, 60 * 1000)
const upstreamSearches = new RateLimiter(8, 60 * 1000)

class UpstreamError extends Error {}

async function fetchOff(url: string): Promise<unknown | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: ctrl.signal })
    if (res.status === 404) return null
    if (!res.ok) throw new UpstreamError(`off_${res.status}`)
    return await res.json()
  } catch (error) {
    if (error instanceof UpstreamError) throw error
    throw new UpstreamError('off_unreachable')
  } finally {
    clearTimeout(timer)
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'unauthorized' }, 401)
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '')
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
  if (!perUser.take(userData.user.id)) return json({ error: 'rate_limited' }, 429)

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const lang = body.lang === 'en' ? 'en' : 'de'

  try {
    if (body.barcode !== undefined) {
      const barcode = normalizeBarcode(body.barcode)
      if (!barcode) return json({ error: 'invalid_barcode' }, 400)
      // My Stack: Substanz per Barcode. Nur Name und Marke, ohne Nährwerte.
      if (body.kind === 'item') {
        const key = `${lang}:${barcode}`
        let item = itemCache.get(key)
        if (item === undefined) {
          if (!upstreamProducts.take('all')) return json({ error: 'rate_limited' }, 429)
          item = parseItemResponse(await fetchOff(itemUrl(barcode)), lang)
          itemCache.set(key, item)
        }
        return json({ item })
      }
      const key = `${lang}:${barcode}`
      let product = productCache.get(key)
      if (product === undefined) {
        if (!upstreamProducts.take('all')) return json({ error: 'rate_limited' }, 429)
        product = parseProductResponse(await fetchOff(productUrl(barcode)), lang)
        productCache.set(key, product)
      }
      return json({ product })
    }

    const query = normalizeQuery(body.query)
    if (!query) return json({ error: 'invalid_query' }, 400)
    const key = `${lang}:${query.toLowerCase()}`
    let results = searchCache.get(key)
    if (results === undefined) {
      if (!upstreamSearches.take('all')) return json({ error: 'rate_limited' }, 429)
      results = parseSearchResponse(await fetchOff(searchUrl(query, lang)), lang)
      searchCache.set(key, results)
    }
    return json({ results })
  } catch (error) {
    // Keine Nutzereingaben ins Log.
    console.error('food-lookup upstream error:', error instanceof Error ? error.message : 'unknown')
    return json({ error: 'upstream_unavailable' }, 503)
  }
})
