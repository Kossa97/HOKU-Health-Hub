/* global Deno */
/**
 * Hoku-Erkenntnisse, nächtlicher Lauf (Teil 1). Wird nur vom Anstoß
 * (api/hoku-anstoss.js) mit dem Secret HOKU_ANSTOSS_SECRET gerufen, nie von
 * der App: verify_jwt ist aus, die Prüfung macht der Header x-hoku-secret.
 *
 * Je Aufruf bis zu 50 Profile mit Einwilligung (nach id sortiert, ab `nach`).
 * Je Nutzer: Daten laden → analysieren → mit den gespeicherten Funden
 * abgleichen → schreiben; sonntags (lokal) zusätzlich das Wochen-Update.
 * Gelogen wird nur der Präfix der Nutzer-ID und ein Fehlercode, nie Daten.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hatZugang } from '../coach/prompt.ts'
import { analysiere } from '../_shared/erkenntnisse/analyse.ts'
import { abgleich, istSonntagLauf, sichtbarAb, waehleWoche } from '../_shared/erkenntnisse/auswahl.ts'
import type { Gespeichert } from '../_shared/erkenntnisse/auswahl.ts'
import type { Fund } from '../_shared/erkenntnisse/typen.ts'
import { lokalerTag, tagePlus } from '../_shared/erkenntnisse/zeit.ts'
import { alsGespeichert, baueKandidaten, tageMitDaten, zuRohdaten } from './laden.ts'
import type { FundZeile } from './laden.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const PROFILE_JE_AUFRUF = 50
const SEITE = 1000
const MAX_SEITEN = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Db = SupabaseClient
type Antwort = { data: unknown[] | null; error: { code?: string } | null }

interface Profil {
  id: string
  erkenntnisse_consent_at: string | null
  hoku_zeitzone: string | null
  pro_until: string | null
  is_admin: boolean | null
}

/** Fehler aus der Datenbank: trägt nur den Code, nie Zeilen oder Meldungstexte (die können Daten enthalten). */
class DbFehler extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'DbFehler'
  }
}

function fehlercode(e: unknown): string {
  if (e instanceof DbFehler) return e.code
  return e instanceof Error ? e.name : 'unbekannt'
}

function pruefe(antwort: { error: { code?: string } | null }): void {
  if (antwort.error) throw new DbFehler(antwort.error.code ?? 'db')
}

/**
 * Die Datenbank (Trigger hoku_nur_mit_einwilligung) lehnt Inserts ohne Einwilligung ab:
 * SQLSTATE P0001, Meldung 'hoku_ohne_einwilligung'. Das heißt "Widerruf mitten im Lauf",
 * kein Fehler: dieser Nutzer wird still übersprungen.
 */
function ohneEinwilligung(error: { code?: string; message?: string } | null): boolean {
  return error?.code === 'P0001' && (error.message ?? '').includes('hoku_ohne_einwilligung')
}

/** Liest alle Zeilen einer Abfrage seitenweise (PostgREST kappt bei 1000). */
async function leseAlle(seite: (von: number, bis: number) => PromiseLike<Antwort>): Promise<unknown[]> {
  const alle: unknown[] = []
  for (let i = 0; i < MAX_SEITEN; i++) {
    const antwort = await seite(i * SEITE, (i + 1) * SEITE - 1)
    pruefe(antwort)
    const zeilen = antwort.data ?? []
    alle.push(...zeilen)
    if (zeilen.length < SEITE) break
  }
  return alle
}

async function hatEinwilligung(db: Db, userId: string): Promise<boolean> {
  const antwort = await db.from('profiles').select('erkenntnisse_consent_at').eq('id', userId).maybeSingle()
  pruefe(antwort)
  return Boolean((antwort.data as { erkenntnisse_consent_at: string | null } | null)?.erkenntnisse_consent_at)
}

async function ladeFunde(db: Db, userId: string): Promise<FundZeile[]> {
  const antwort = await db
    .from('hoku_funde')
    .select('id, schluessel, fund, datenlage, gueltig, gemeldet_datenlage, ausgeblendet_am')
    .eq('user_id', userId)
  pruefe(antwort)
  return (antwort.data ?? []) as FundZeile[]
}

/** true, wenn der Nutzer analysiert wurde; false, wenn übersprungen (kein Zugang, keine Zone, Widerruf). */
async function verarbeite(db: Db, profil: Profil, jetzt: Date): Promise<boolean> {
  const userId = profil.id
  const zone = profil.hoku_zeitzone
  if (!zone || !hatZugang(profil, jetzt)) return false

  let heute: string
  try {
    heute = lokalerTag(jetzt.toISOString(), zone)
  } catch {
    return false // Zone, die Intl nicht kennt
  }

  // daily_logs und effects: 366-Tage-Reihe für T7; alles andere 90 Tage plus Puffer.
  // Zeitstempel mit einem Tag Spielraum, geschnitten wird in analysiere nach lokalem Tag.
  const ab = tagePlus(heute, -91)
  const abLang = tagePlus(heute, -367)
  const abZeit = `${tagePlus(ab, -1)}T00:00:00Z`
  const abZeitLang = `${tagePlus(abLang, -1)}T00:00:00Z`

  const [health, daily, effects, food, training] = await Promise.all([
    leseAlle((von, bis) => db.from('health_daily').select('day, sleep_min').eq('user_id', userId).gte('day', ab).order('day').range(von, bis)),
    leseAlle((von, bis) => db.from('daily_logs').select('log_date, energie').eq('user_id', userId).gte('log_date', abLang).order('log_date').order('id').range(von, bis)),
    leseAlle((von, bis) => db.from('effects').select('occurred_at').eq('user_id', userId).gte('occurred_at', abZeitLang).order('occurred_at').order('id').range(von, bis)),
    leseAlle((von, bis) => db.from('food_logs').select('log_date, protein_g, source').eq('user_id', userId).gte('log_date', ab).order('log_date').order('id').range(von, bis)),
    leseAlle((von, bis) => db.from('training_sessions').select('started_at, kind, exercises').eq('user_id', userId).gte('started_at', abZeit).order('started_at').order('id').range(von, bis)),
  ])

  const roh = zuRohdaten({ health, daily, effects, food, training })

  // Defensiv: zwei Funde mit demselben Schlüssel würden beim Einfügen an unique (user_id, schluessel)
  // scheitern und den ganzen Nutzer kippen. Der erste gewinnt.
  const gesehen = new Set<string>()
  const funde: Fund[] = analysiere(roh, zone, heute).filter((f) => {
    if (gesehen.has(f.schluessel)) return false
    gesehen.add(f.schluessel)
    return true
  })

  const bisher = (await ladeFunde(db, userId)).map(alsGespeichert).filter((g): g is Gespeichert => g !== null)
  const { einfuegen, aktualisieren, ungueltig } = abgleich(bisher, funde)

  // Widerruf während des Laufs: direkt vor dem Schreiben noch einmal lesen
  if (!(await hatEinwilligung(db, userId))) return false

  const jetztIso = jetzt.toISOString()
  if (einfuegen.length > 0) {
    const eingefuegt = await db.from('hoku_funde').insert(einfuegen.map((f) => ({ user_id: userId, schluessel: f.schluessel, fund: f, datenlage: f.datenlage })))
    if (ohneEinwilligung(eingefuegt.error)) return false // Widerruf zwischen Prüfung und Insert: nichts mehr schreiben
    pruefe(eingefuegt)
  }
  for (const { id, fund } of aktualisieren) {
    pruefe(await db.from('hoku_funde')
      .update({ fund, datenlage: fund.datenlage, gueltig: true, aktualisiert_am: jetztIso })
      .eq('id', id).eq('user_id', userId))
  }
  if (ungueltig.length > 0) {
    pruefe(await db.from('hoku_funde').update({ gueltig: false }).in('id', ungueltig).eq('user_id', userId))
  }

  if (istSonntagLauf(heute)) await wochenUpdate(db, userId, zone, heute, roh)
  return true
}

async function wochenUpdate(db: Db, userId: string, zone: string, heute: string, roh: ReturnType<typeof zuRohdaten>): Promise<void> {
  const vorhanden = await db.from('hoku_wochen').select('woche').eq('user_id', userId).eq('woche', heute).maybeSingle()
  pruefe(vorhanden)
  if (vorhanden.data) return

  // Nach dem Schreiben neu lesen: neue Funde haben erst jetzt ihre Ids
  const kandidaten = baueKandidaten(await ladeFunde(db, userId))
  const gewaehlt = waehleWoche(kandidaten)
  const tage = tageMitDaten(roh, zone, tagePlus(heute, -7), tagePlus(heute, -1))

  if (!(await hatEinwilligung(db, userId))) return
  const eingefuegt = await db.from('hoku_wochen').insert({
    user_id: userId, woche: heute, fund_ids: gewaehlt, tage_eingeflossen: tage, sichtbar_ab: sichtbarAb(heute, zone),
  })
  // Zettel zuerst, dann die Marke "gemeldet": scheitert das Zweite, steht der Fund eine Woche später
  // wieder zur Wahl, statt nie in einem Zettel zu landen. Doppelter Lauf (23505): nichts tun.
  if (eingefuegt.error?.code === '23505') return
  if (ohneEinwilligung(eingefuegt.error)) return // Widerruf zwischen Prüfung und Insert
  pruefe(eingefuegt)

  for (const datenlage of ['hinweis', 'deutlich'] as const) {
    const ids = kandidaten.filter((k) => gewaehlt.includes(k.id) && k.gespeichert.datenlage === datenlage).map((k) => k.id)
    if (ids.length === 0) continue
    pruefe(await db.from('hoku_funde').update({ gemeldet_am: heute, gemeldet_datenlage: datenlage }).in('id', ids).eq('user_id', userId))
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const erwartet = Deno.env.get('HOKU_ANSTOSS_SECRET')
  if (!erwartet) return json({ error: 'server_error' }, 500)
  if (request.headers.get('x-hoku-secret') !== erwartet) return json({ error: 'unauthorized' }, 401)

  let nach: string | null = null
  try {
    const body = await request.json()
    if (body && typeof body === 'object' && 'nach' in body && body.nach !== undefined && body.nach !== null) {
      if (typeof body.nach !== 'string' || !UUID.test(body.nach)) return json({ error: 'invalid_body' }, 400)
      nach = body.nach
    }
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  let abfrage = db
    .from('profiles')
    .select('id, erkenntnisse_consent_at, hoku_zeitzone, pro_until, is_admin')
    .not('erkenntnisse_consent_at', 'is', null)
    .order('id')
    .limit(PROFILE_JE_AUFRUF)
  if (nach) abfrage = abfrage.gt('id', nach)
  const { data, error } = await abfrage
  if (error) {
    console.error('erkenntnisse: Profile lesen', error.code ?? 'db')
    return json({ error: 'server_error' }, 500)
  }

  const profile = (data ?? []) as Profil[]
  const jetzt = new Date()
  let bearbeitet = 0
  for (const profil of profile) {
    try {
      if (await verarbeite(db, profil, jetzt)) bearbeitet++
    } catch (e) {
      // Ein Nutzer darf den Lauf nicht kippen. Nur Präfix und Code, nie Daten.
      console.error('erkenntnisse: Nutzer', profil.id.slice(0, 8), fehlercode(e))
    }
  }

  return json({ bearbeitet, weiter: profile.length === PROFILE_JE_AUFRUF ? profile[profile.length - 1].id : null })
})
