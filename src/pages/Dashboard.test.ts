// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { createElement, type ComponentType } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FEATURES } from '../config/features'
import { Dashboard, buildDashboardRoutineIntake } from './Dashboard'

/**
 * Der Weg in die Gruppenbestaetigung: das Bündel. Jeder Test-Client bekommt
 * eines mit allen Substanzen der Fixture (siehe `createDashboardClient`).
 * Diese Faelle pruefen, was danach zur Datenbank geht.
 */
/** Der gewaehlte Tag, abgelesen an der gedrueckten Tageszelle. */
function gewaehlterTag() {
  return document.querySelector('[data-calendar-date][aria-pressed="true"]')?.getAttribute('data-calendar-date') ?? null
}

/** Klappt die (erste) protokollierte Einnahme auf; ihre Aktionen stehen erst danach da. */
async function protokollZeileOeffnen() {
  await waitFor(() => expect(document.querySelector('[data-log-row] button[aria-expanded]')).toBeTruthy())
  fireEvent.click(document.querySelector('[data-log-row] button[aria-expanded]') as HTMLElement)
}

const BUENDEL_KNOPF = /^Alle Substanzen\s*\d+ bestätigen$/
async function gruppenBestaetigungOeffnen() {
  fireEvent.click(await screen.findByRole('button', { name: BUENDEL_KNOPF }))
}

const pageMocks = vi.hoisted(() => {
  const emptyQuery = () => {
    const query: Record<string, unknown> = {}
    for (const method of ['eq', 'gte', 'lte', 'order', 'limit', 'single']) {
      query[method] = vi.fn(() => query)
    }
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (
      Promise.resolve({ data: [], error: null }).then(resolve, reject)
    )
    return query
  }
  return {
    user: { id: 'user-1' },
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(emptyQuery),
        insert: vi.fn(emptyQuery),
        update: vi.fn(emptyQuery),
        delete: vi.fn(emptyQuery),
      })),
      rpc: vi.fn(async () => ({ data: [], error: null })),
    },
    toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  }
})

vi.mock('../lib/supabase', () => ({ supabase: pageMocks.supabase }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: pageMocks.user }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string; [name: string]: string | number | undefined }) => (
    (options?.defaultValue ?? key).replace(/{{(\w+)}}/g, (_, name: string) => String(options?.[name] ?? ''))
  ) }),
}))
vi.mock('react-hot-toast', () => ({ default: pageMocks.toast }))

interface RecordedMutation {
  table: string
  kind: 'insert' | 'update' | 'delete'
  values: unknown
}

function resolvedQuery(data: unknown, error: { message: string } | null = null, applyFilters = false, gate?: Promise<void>) {
  const query: Record<string, unknown> = {}
  const filters: Array<{ method: string; column: string; value: unknown }> = []
  // `select` gehoert dazu, weil ein Insert sein Ergebnis zurueckliest
  // (`.insert(...).select('id').single()`) — ohne das lief die Kette ins Leere
  // und warf eine unbehandelte Ablehnung neben dem gruenen Test.
  for (const method of ['eq', 'gte', 'lt', 'lte', 'in', 'order', 'limit', 'single', 'select']) {
    query[method] = vi.fn((column: string, value: unknown) => {
      filters.push({ method, column, value })
      return query
    })
  }
  // `or` nimmt EINEN Ausdruck statt Spalte und Wert. Der Mock filtert damit
  // echt, sonst bewiesen die Abdeckungstests nichts mehr: sie pruefen, dass
  // der gewaehlte Tag auch beim Bloettern in einen fernen Monat mitgeladen
  // wird -- ein `or`, das alles durchlaesst, wuerde das immer bestehen.
  query.or = vi.fn((ausdruck: string) => {
    filters.push({ method: 'or', column: 'routine_slot_key', value: ausdruck })
    return query
  })
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
    const result = applyFilters && Array.isArray(data) ? data.filter(row => filters.every(filter => {
      if (filter.column === 'logged_at') {
        const time = Date.parse(row.logged_at)
        const bound = Date.parse(String(filter.value))
        if (filter.method === 'gte') return time >= bound
        if (filter.method === 'lte') return time <= bound
        if (filter.method === 'lt') return time < bound
      }
      if (filter.column === 'routine_slot_key' && filter.method === 'in') {
        return (filter.value as string[]).includes(row.routine_slot_key)
      }
      if (filter.method === 'or') {
        // `and(routine_slot_key.gte."A",routine_slot_key.lt."B"),and(...)`
        const bereiche = [...String(filter.value).matchAll(
          /and\(routine_slot_key\.gte\."([^"]+)",routine_slot_key\.lt\."([^"]+)"\)/g,
        )]
        if (bereiche.length === 0) return true
        const schluessel = String(row.routine_slot_key ?? '')
        return bereiche.some(([, von, bis]) => schluessel >= von && schluessel < bis)
      }
      return true
    })) : data
    return Promise.resolve(gate).then(() => ({ data: result, error })).then(resolve, reject)
  }
  return query
}

/**
 * Faengt einer der `or`-Ausdruecke diesen Slot-Schluessel?
 *
 * Bildet nach, was PostgREST mit der Bedingung tut -- damit die
 * Abdeckungstests weiter das pruefen, was sie vorher geprueft haben.
 */
function faengtSchluessel(bereiche: string[], schluessel: string): boolean {
  return bereiche.some(ausdruck => [...ausdruck.matchAll(
    /routine_slot_key\.gte\."([^"]+)",routine_slot_key\.lt\."([^"]+)"/g,
  )].some(([, von, bis]) => schluessel >= von && schluessel < bis))
}

/**
 * Die Standard-Antwort auf `confirm_intake_group`, wie die echte RPC sie
 * gibt: `returns setof dose_logs`, die volle Zeile.
 *
 * Erst stand hier immer `{ id: 'saved-log-1' }`, egal was gesendet wurde --
 * damit konnte kein Test hier je pruefen, ob eine bestehende Zeile
 * WIEDERVERWENDET (ihre id bleibt) oder eine neue ANGELEGT wird (neue id).
 * Die RPC upsertet auf `(user_id, routine_slot_key)`: kommt `dose_log_id`
 * mit, bleibt die id dieselbe; sonst bekommt die Zeile eine neue.
 */
function echteGespeicherteZeile(
  params: unknown,
  naechsteNeueId: () => string,
): { data: Array<Record<string, unknown>>; error: null } {
  const entries = (params as { p_entries: Array<Record<string, unknown>> }).p_entries
  return {
    data: entries.map(entry => ({
      id: (entry.dose_log_id as string | null) ?? naechsteNeueId(),
      stack_item_id: entry.stack_item_id,
      dose: entry.dose,
      unit: entry.unit,
      method: entry.method,
      logged_at: entry.logged_at,
      notes: null,
      taken: entry.taken,
      cycle_id: entry.cycle_id,
      plan_version_id: entry.plan_version_id,
      routine_slot_key: entry.slot_key,
    })),
    error: null,
  }
}

function createDashboardClient(
  fixtures: Record<string, unknown[]>,
  rpcImplementation?: (name: string, params: unknown) => Promise<{
    data: unknown
    error: { message: string } | null
  }>,
  options: { errors?: Record<string, { message: string } | null>; filterLogs?: boolean; logReadGate?: Promise<void> } = {},
) {
  // Eine neue id je synthetisierter Zeile -- ueber ALLE Aufrufe dieses
  // Clients hinweg, nicht neu bei jedem einzelnen RPC-Aufruf. Zwei
  // Bestaetigungen nacheinander sollen zwei verschiedene Zeilen ergeben,
  // genau wie `gen_random_uuid()` es in der echten Datenbank taete -- sonst
  // ueberschreibt die zweite Bestaetigung im lokalen Bild die erste.
  let neueIdZaehler = 0
  const naechsteNeueId = () => `saved-log-${++neueIdZaehler}`
  const aufgeloesteRpcImplementation = rpcImplementation ?? (async (name, params) => (
    name === 'confirm_intake_group'
      ? echteGespeicherteZeile(params, naechsteNeueId)
      : { data: [{ id: 'saved-log-1' }], error: null }
  ))
  const selectCounts = new Map<string, number>()
  const selectCalls: Array<{ table: string; columns: string }> = []
  const mutations: RecordedMutation[] = []
  const logQueries: ReturnType<typeof resolvedQuery>[] = []
  const rpc = vi.fn(aufgeloesteRpcImplementation)
  // Ein Bündel mit allen Substanzen: der Sammelweg im Kalender.
  const buendel = fixtures.intake_bundles ?? [{
    id: 'bundle-all',
    name: 'Alle Substanzen',
    stack_item_ids: (fixtures.stack_items ?? []).map(item => (item as { id: string }).id),
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
  }]
  const from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      selectCounts.set(table, (selectCounts.get(table) ?? 0) + 1)
      selectCalls.push({ table, columns })
      const query = resolvedQuery(table === 'intake_bundles' ? buendel : fixtures[table] ?? [], options.errors?.[table] ?? null,
        table === 'dose_logs' && options.filterLogs, table === 'dose_logs' ? options.logReadGate : undefined)
      if (table === 'dose_logs') logQueries.push(query)
      return query
    }),
    insert: vi.fn((values: unknown) => {
      mutations.push({ table, kind: 'insert', values })
      return resolvedQuery(null)
    }),
    update: vi.fn((values: unknown) => {
      mutations.push({ table, kind: 'update', values })
      return resolvedQuery(null)
    }),
    delete: vi.fn(() => {
      mutations.push({ table, kind: 'delete', values: null })
      return resolvedQuery(null)
    }),
  }))
  return { from, rpc, selectCounts, selectCalls, mutations, logQueries }
}

function intakeOnlyCycle() {
  return {
    id: 'cycle-1',
    name: 'Vitamin D3',
    stack_item_id: 'stack-1',
    dose: 100,
    unit: 'mcg',
    method: 'Oral',
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: null,
    start_date: '2020-01-01',
    end_date: null,
    active: true,
    intake_time: 'morgens',
    intake_time_custom: null,
    schedule_history: null,
    stack_items: { display_name: 'Vitamin D3', tracking_level: 'intake_only' },
  }
}

function onDemandCycle() {
  return {
    ...intakeOnlyCycle(),
    id: 'cycle-2',
    name: 'Ibuprofen',
    stack_item_id: 'stack-2',
    frequency: 'Bei Bedarf',
    stack_items: { display_name: 'Ibuprofen', tracking_level: 'intake_only' },
  }
}

function LocationProbe() {
  const location = useLocation()
  return createElement('output', { 'data-testid': 'location' }, location.pathname + location.search)
}

function renderDashboard(client: ReturnType<typeof createDashboardClient>) {
  const TestDashboard = Dashboard as ComponentType<{ dashboardDataClient: unknown }>
  return render(createElement(MemoryRouter, null, createElement(TestDashboard, { dashboardDataClient: client }), createElement(LocationProbe)))
}

afterEach(() => {
  cleanup()
  // Der gewählte Tag wird für die Ernährung gemerkt (sharedDay) — nicht in den nächsten Test tragen.
  sessionStorage.clear()
  ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Dashboard normalized timeline path', () => {
  it('holt die Tageslogs nebeneinander statt nacheinander', () => {
    // Die Seite lud ihre Zeitbereiche und danach die Slot-Schluessel in
    // 100er-Paeckchen -- jedes mit `await` hinter dem vorigen, obwohl keines
    // vom anderen abhaengt. Bei einem Monatsraster mit mehreren Plaenen sind
    // das schnell ein halbes Dutzend Rundreisen in Reihe. Die Paeckchen
    // bleiben (sie begrenzen die Laenge der Adresse), nur das Warten nicht.
    const quelle = readFileSync('src/pages/Dashboard.tsx', 'utf8')
    const lader = quelle.slice(
      quelle.indexOf('const byId = new Map<string, DoseLog>()'),
      quelle.indexOf('setTimelines(loadedTimelines)'),
    )

    expect(lader).toContain('await Promise.all(ranges.map(range =>')
    expect(lader).toContain('slotKeyBereiche(cycleIds, slotFenster).map(bereich =>')
    // Keine Aufzaehlung der Schluessel mehr -- die machte jede Adresse neu
    // und damit jeden Preflight unbrauchbar.
    expect(lader).not.toContain("in('routine_slot_key'")
    // Kein `await` mehr innerhalb einer Schleife in diesem Abschnitt.
    const schleifenZeilen = lader.split('\n')
    const inSchleife = schleifenZeilen.some((zeile, i) => (
      /^\s*for \(/.test(zeile)
      && schleifenZeilen.slice(i, i + 8).some(folge => /await dashboardDataClient/.test(folge))
    ))
    expect(inSchleife, 'ein `await` steckt wieder in einer Schleife').toBe(false)
  })

  it('does not call preventDefault from the calendar pointer-move handler', () => {
    const quelle = readFileSync('src/pages/Dashboard.tsx', 'utf8')
    const handler = quelle.slice(
      quelle.indexOf('const handleCalendarPointerMove'),
      quelle.indexOf('const handleCalendarPointerUp'),
    )
    expect(handler).not.toContain('preventDefault')
  })

  it('explains blocked migrated plans and links to their timezone review', async () => {
    const fixtures = startFixFixture()
    fixtures.cycles.unshift({
      ...fixtures.cycles[0],
      id: 'archived-review-cycle',
      stack_item_id: 'archived-stack-item',
      timezone_review_required: true,
    })
    fixtures.cycles[1].timezone_review_required = true
    const client = createDashboardClient(fixtures)

    renderDashboard(client)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Existing intake plans still need a time zone confirmation.')
    expect(screen.queryByText('Noch nichts für heute protokolliert')).toBeNull()
    fireEvent.click(within(alert).getByRole('button', { name: 'Confirm time zone in My Stack' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent)
      .toBe('/my-stack?review=timezone&stackItem=stack-1'))
  })

  it.each([false, true])('lässt eine entschiedene V2-Einnahme öffnen, aber nicht umschreiben (%s)', async taken => {
    // Vorher war eine entschiedene Einnahme unter V2 unveränderlich — auch
    // eine versehentlich bestätigte und alles, was der Auto-Miss rückwirkend
    // als nicht genommen eingetragen hat. In einer App, die Gesundheitsdaten
    // protokolliert, ist ein unkorrigierbares Protokoll ein Produktfehler.
    //
    // Der Weg zurück ist bewusst schmal: WIEDER ÖFFNEN, nicht umschreiben.
    // Jede Entscheidung läuft unter V2 über `confirm_intake_group`, das
    // Herkunft und Lebenszyklus prüft; ein direktes „doch eingenommen" würde
    // daran vorbeischreiben. Geöffnet steht die Zeile wieder so da, wie die
    // RPC eine offene Einnahme erwartet.
    const fixtures = startFixFixture()
    fixtures.dose_logs = [{ ...pendingLog(), taken }]
    renderDashboard(createDashboardClient(fixtures))
    fireEvent.click(await screen.findByRole('button', { name: taken ? /Bereits protokolliert/ : /Nicht protokolliert/ }))
    await screen.findByText('Vitamin D3')
    await waitFor(() => expect(screen.queryByText('Lädt…')).toBeNull())

    await protokollZeileOeffnen()
    expect(screen.getByRole('button', { name: 'Wieder öffnen' })).toBeTruthy()
    // „Doch eingenommen" gibt es nur für eine ausgelassene — und auch das
    // schreibt nicht vorbei: es öffnet erst und speichert dann über die RPC.
    if (taken) expect(screen.queryByRole('button', { name: 'Doch eingenommen' })).toBeNull()
    else expect(screen.getByRole('button', { name: 'Doch eingenommen' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'eintrag_loeschen' })).toBeNull()
  })

  it('bietet kein Wiederöffnen für eine Einnahme ohne Platz im Tagesplan', async () => {
    // „Bei Bedarf" genommen, Substanz gelöscht, Zyklus nicht mehr auflösbar:
    // solche Zeilen haben keinen geplanten Slot. `taken = null` nähme sie aus
    // „Bereits protokolliert" heraus, ohne dass sie als fällig zurückkämen —
    // unsichtbar und nicht mehr löschbar, denn der Löschknopf sitzt nur an
    // protokollierten Zeilen.
    const fixtures = startFixFixture()
    fixtures.dose_logs = [{
      ...pendingLog(), taken: true,
      routine_slot_key: 'timeline-cycle@2026-09-18T17:30',
    }]
    renderDashboard(createDashboardClient(fixtures))
    fireEvent.click(await screen.findByRole('button', { name: /Bereits protokolliert/ }))
    await waitFor(() => expect(screen.queryByText('Lädt…')).toBeNull())

    // Die Zeile steht im Protokoll — aber ohne Rückweg.
    expect(screen.getByRole('button', { name: /Bereits protokolliert/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Wieder öffnen' })).toBeNull()
    // Ohne Aktion ist die Zeile auch nicht antippbar.
    expect(document.querySelector('[data-log-row]')).toBeTruthy()
    expect(document.querySelector('[data-log-row] button')).toBeNull()
  })

  it('zeigt eine ausgelassene Einnahme als eine Zeile, Aktionen erst nach Antippen', async () => {
    // Vorher war jede ausgelassene Einnahme eine Karte mit „Wieder öffnen"
    // und vier Erinnerungsknöpfen — sechs davon füllten drei Bildschirme.
    const fixtures = startFixFixture()
    fixtures.dose_logs = [{ ...pendingLog(), taken: false }]
    renderDashboard(createDashboardClient(fixtures))
    fireEvent.click(await screen.findByRole('button', { name: /Nicht protokolliert/ }))

    const zeile = await waitFor(() => {
      const gefunden = document.querySelector('[data-log-row] button[aria-expanded]') as HTMLElement | null
      if (!gefunden) throw new Error('missing log row')
      return gefunden
    })
    expect(zeile.textContent).toContain('Vitamin D3')
    expect(zeile.textContent).toContain('uebersprungen')
    expect(zeile.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Wieder öffnen' })).toBeNull()
    expect(screen.queryByText(/15 min/)).toBeNull()

    fireEvent.click(zeile)
    expect(zeile.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Wieder öffnen' })).toBeTruthy()
    expect(screen.queryByText(/15 min/)).toBeNull()
  })

  it('räumt beim Wiederöffnen die Auto-Miss-Notiz weg', async () => {
    // Bleibt `auto-missed` stehen, heißt die Einnahme nach einem bewussten
    // Auslassen weiterhin „Verpasst".
    const fixtures = startFixFixture()
    fixtures.dose_logs = [{ ...pendingLog(), taken: false, notes: 'auto-missed' }]
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('button', { name: /Nicht protokolliert/ }))
    await protokollZeileOeffnen()
    fireEvent.click(await screen.findByRole('button', { name: 'Wieder öffnen' }))

    await waitFor(() => {
      const aufrufe = client.mutations.filter(m => m.table === 'dose_logs' && m.kind === 'update')
      expect(aufrufe.some(m => JSON.stringify(m.values).includes('"notes":null'))).toBe(true)
    })
  })

  it('bucht beim Wiederöffnen den Bestand in derselben Transaktion zurück', async () => {
    // `taken` von Hand auf null zu setzen und den Bestand separat zu
    // korrigieren, liesse bei einem Fehler dazwischen einen falschen Bestand
    // stehen. Die RPC macht beides in einem Zug.
    const fixtures = startFixFixture()
    fixtures.dose_logs = [{ ...pendingLog(), taken: true }]
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('button', { name: /Bereits protokolliert/ }))
    await protokollZeileOeffnen()
    fireEvent.click(await screen.findByRole('button', { name: 'Wieder öffnen' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('reverse_inventory_confirmation', {
      p_dose_log_id: 'pending-exact', p_action: 'undo',
    }))
  })
  it.each([
    { archived: true, configuration_status: 'complete', migration_conflicts: [] },
    { archived: false, configuration_status: 'needs_review', migration_conflicts: [] },
    { archived: false, configuration_status: 'complete', migration_conflicts: [{ resolved_at: null }] },
  ])('offers no dues for an unavailable item and resumes after resolution: %j', async item => {
    const fixtures = startFixFixture()
    Object.assign(fixtures.cycles[0].stack_items, item)
    fixtures.cycles.push({ ...fixtures.cycles[0], id: 'competing-cycle' })
    const client = createDashboardClient(fixtures)
    const page = renderDashboard(client)
    await waitFor(() => expect(client.selectCounts.get('cycles')).toBe(2))
    await waitFor(() => expect(screen.queryByText('Lädt…')).toBeNull())
    expect(screen.queryAllByRole('button', { name: 'eingenommen' })).toHaveLength(0)
    expect(screen.queryByRole('button', { name: BUENDEL_KNOPF })).toBeNull()
    page.unmount()
    vi.setSystemTime(new Date('2026-09-18T08:05:00Z'))
    const selected = normalizedCycle()
    Object.assign(selected.stack_items, { archived: false, configuration_status: 'complete', migration_conflicts: [] })
    selected.versions[0].dose = 20
    const rejected = Object.assign(normalizedCycle(), {
      id: 'competing-cycle', active: false, end_date: '2026-09-18',
      ended_at: '2026-09-18T08:00:00Z', closed_by_migration_resolution: true,
    })
    rejected.versions[0] = { ...rejected.versions[0], id: 'rejected-version', cycle_id: rejected.id, dose: 10 }
    rejected.stack_items = selected.stack_items
    fixtures.cycles = [selected, rejected]
    renderDashboard(client)
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'eingenommen' })).toHaveLength(1))
    // Menge und Methode stehen jetzt in EINER Zeichenkette, damit die Zeile
    // sauber abschneidet — deshalb Teilstring statt exaktem Text.
    expect(screen.getByText(/20 mg/)).not.toBeNull()
    expect(screen.queryByText(/10 mg/)).toBeNull()
  })

  function startFixFixture(frequency = 'Täglich', instant = '2026-09-18T14:00:00Z') {
    vi.stubEnv('TZ', 'Europe/Berlin')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(instant))
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    return {
      cycles: [normalizedCycle(frequency)], dose_logs: [] as unknown[],
      stack_items: [{ id: 'stack-1', display_name: 'Vitamin D3', default_method: 'Oral',
        dosage_form: 'capsule', tracking_level: 'complete' }],
    }
  }

  async function openSingle() {
    fireEvent.click(await screen.findByRole('button', { name: 'eingenommen' }))
  }

  function pendingLog(keyed = true) {
    return { id: 'pending-exact', stack_item_id: 'stack-1', taken: null, dose: 25, unit: 'mg',
      method: 'Oral', notes: null, stack_items: { display_name: 'Vitamin D3' },
      logged_at: '2026-09-18T07:00:00.000Z', cycle_id: keyed ? 'timeline-cycle' : null,
      plan_version_id: keyed ? 'timeline-version' : null,
      routine_slot_key: keyed ? 'timeline-cycle@2026-09-18T08:00' : null }
  }

  function browseToNovember() {
    fireEvent.click(screen.getByRole('button', { name: 'Monatsübersicht öffnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy()
    expect(gewaehlterTag()).toBe('2026-09-18')
  }

  it('lädt beim Ausklappen nicht neu, solange derselbe Monat sichtbar bleibt', async () => {
    // Das Monatsraster war schon geladen -- die Wochenansicht liest denselben
    // Bereich. Trotzdem lief beim Ausklappen der ganze Ladevorgang noch
    // einmal, weil `setCurrentDate` ein neues `Date` anlegte und damit den
    // Lader neu erzeugte. Sichtbar war das als leere Tage fuer die Dauer
    // einer Runde zum Server.
    const fixtures = startFixFixture()
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(client.logQueries.length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.getAllByRole('status')
      .some(element => element.textContent?.includes('Lädt'))).toBe(false))
    const geladen = client.logQueries.length

    fireEvent.click(screen.getByRole('button', { name: 'Monatsübersicht öffnen' }))
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy()
    await act(async () => { await Promise.resolve() })

    expect(client.logQueries.length).toBe(geladen)
    // Und es bleibt beim Ausklappen: kein Ladehinweis dazwischen.
    expect(screen.getAllByRole('status')
      .some(element => element.textContent?.includes('Lädt'))).toBe(false)
  })

  it.each(['keyed', 'legacy'])('keeps selected-day %s coverage while browsing a distant month', async kind => {
    const fixtures = startFixFixture()
    fixtures.dose_logs = [{ ...pendingLog(kind === 'keyed'), taken: true,
      logged_at: kind === 'keyed' ? '2026-07-01T06:00:00.000Z' : '2026-09-17T22:30:00.000Z' }]
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(screen.queryByRole('button', { name: BUENDEL_KNOPF })).toBeNull())
    await screen.findByText(kind === 'keyed' ? 'Alle geplanten Einnahmen sind bestätigt.' : 'Bereits protokolliert')
    const initialQueries = client.logQueries.length
    browseToNovember()
    await waitFor(() => expect(client.logQueries.length).toBeGreaterThan(initialQueries))
    await waitFor(() => expect(screen.getAllByRole('status').some(element => element.textContent?.includes('Lädt'))).toBe(false))
    expect(screen.queryByRole('button', { name: BUENDEL_KNOPF })).toBeNull()
    const queries = client.logQueries.slice(initialQueries)
    // Dieselbe Zusage wie vorher, nur anders formuliert: der gewaehlte Tag im
    // September bleibt abgedeckt, waehrend man den November ansieht. Frueher
    // stand jeder Schluessel einzeln in der Adresse; jetzt faengt ihn ein
    // Bereich, und der Test prueft genau das.
    const bereiche = queries.flatMap(query =>
      (query.or as ReturnType<typeof vi.fn>).mock.calls.map(call => call[0] as string))
    expect(faengtSchluessel(bereiche, 'timeline-cycle@2026-09-18T08:00')).toBe(true)
    expect(faengtSchluessel(bereiche, 'timeline-cycle@2026-11-18T08:00')).toBe(true)
    // Und die Adresse bleibt handhabbar.
    expect(bereiche.every(ausdruck => ausdruck.length <= 8000)).toBe(true)
    if (kind === 'legacy') {
      expect(queries.some(query => (query.gte as ReturnType<typeof vi.fn>).mock.calls
        .some(call => call[1] === '2026-09-17T22:00:00.000Z'))).toBe(true)
      expect(queries.some(query => (query.lt as ReturnType<typeof vi.fn>).mock.calls
        .some(call => call[1] === '2026-09-18T22:00:00.000Z'))).toBe(true)
    }
  })

  function zweiSlotsFixture() {
    const fixtures = startFixFixture()
    fixtures.cycles = [{
      ...normalizedCycle(),
      intake_time: 'morgens,abends',
      intake_time_custom: '08:00,20:00',
      versions: normalizedCycle().versions.map(version => ({
        ...version, intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00',
      })),
    }]
    return fixtures
  }

  function tagesBalken(tag: string) {
    const zelle = document.querySelector(`[data-calendar-date="${tag}"]`)
    const fuellung = zelle?.querySelector('span[aria-hidden="true"] > span')
    return (fuellung as HTMLElement | null)?.style.width ?? null
  }

  it('zählt den Tagesbalken je Slot, nicht je Substanz', async () => {
    // Der Fehler, den dieser Fall festhält: die Zelle fragte „gibt es zu
    // dieser Substanz eine genommene Dosis?". Bei „morgens und abends" stand
    // der Tag damit schon nach der Morgendosis auf grün — in einer App für
    // Hormone und Peptide die falscheste aller Auskünfte.
    const fixtures = zweiSlotsFixture()
    fixtures.dose_logs = [{
      ...pendingLog(), taken: true, logged_at: '2026-09-18T06:05:00.000Z',
      routine_slot_key: 'timeline-cycle@2026-09-18T08:00',
    }]
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(screen.getAllByRole('status')
      .some(element => element.textContent?.includes('Lädt'))).toBe(false))

    // Eine von zwei geplanten Einnahmen: halb, nicht voll.
    await waitFor(() => expect(tagesBalken('2026-09-18')).toBe('50%'))
  })

  it('macht die Tageszelle ohne Zeigergesten bedienbar', async () => {
    // Die Zelle war ein `<button>` ohne `onClick`; ausgewählt wurde über
    // `pointerup` am Raster. Enter und der VoiceOver-Doppeltipp senden aber
    // `click` — Tastatur und Screenreader konnten also keinen Tag wählen.
    const fixtures = startFixFixture()
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(screen.getAllByRole('status')
      .some(element => element.textContent?.includes('Lädt'))).toBe(false))

    const zelle = document.querySelector('[data-calendar-date="2026-09-19"]') as HTMLElement
    expect(zelle.tagName).toBe('BUTTON')
    expect(zelle.getAttribute('aria-label')).toBeTruthy()
    expect(zelle.getAttribute('aria-pressed')).toBe('false')

    // Nur ein `click`, keine Zeigerereignisse.
    fireEvent.click(zelle)
    expect(gewaehlterTag()).toBe('2026-09-19')
    expect(zelle.getAttribute('aria-pressed')).toBe('true')
  })

  it('lässt nach einem Wisch wieder mit der Tastatur wählen', async () => {
    // Der Merker, der den Tag unter dem wischenden Finger schützt, blieb
    // stehen. Danach verschluckte er jedes Enter und jeden
    // VoiceOver-Doppeltipp — also genau den Zugang, den die Zelle bekommen
    // hat. Er muss den unmittelbar folgenden `click` schlucken und sich
    // danach lösen.
    const fixtures = startFixFixture()
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(screen.getAllByRole('status')
      .some(element => element.textContent?.includes('Lädt'))).toBe(false))

    vi.stubGlobal('PointerEvent', MouseEvent)
    const zelle = document.querySelector('[data-calendar-date="2026-09-19"]') as HTMLElement
    fireEvent.pointerDown(zelle, { clientX: 200, clientY: 40, pointerId: 1 })
    // 20 px: genug, um als Wisch zu gelten, zu wenig zum Blaettern — auch
    // nicht ueber das Tempo (ab 24 px).
    fireEvent.pointerMove(zelle, { clientX: 180, clientY: 42, pointerId: 1 })
    fireEvent.pointerUp(zelle, { clientX: 180, clientY: 42, pointerId: 1 })

    // Der `click`, den der Wisch selbst auslöst, wird geschluckt.
    fireEvent.click(zelle)
    expect(gewaehlterTag()).not.toBe('2026-09-19')

    // Eine Runde später ist der Merker gelöst.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    fireEvent.click(zelle)
    expect(gewaehlterTag()).toBe('2026-09-19')
  })

  async function blattOeffnen(client: ReturnType<typeof createDashboardClient>) {
    renderDashboard(client)
    await waitFor(() => expect(screen.getAllByRole('status')
      .some(element => element.textContent?.includes('Lädt'))).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Monatsübersicht öffnen' }))
    return screen.getByRole('dialog')
  }

  it('schließt das Monatsblatt mit Escape und gibt den Fokus zurück', async () => {
    // `aria-modal` allein macht keinen Dialog. Der Escape-Handler hing vorher
    // an einem `div`, das nie den Fokus bekam — er lief nie.
    const client = createDashboardClient(startFixFixture(), undefined, { filterLogs: true })
    const blatt = await blattOeffnen(client)
    expect(document.activeElement).toBe(blatt)

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Der Fokus kommt im Aufräumen des Effekts zurück, also nach dem Entfernen
    // des Blatts; unter Last (CI) liegt dazwischen ein Takt.
    await waitFor(() => expect((document.activeElement as HTMLElement)?.getAttribute('aria-label'))
      .toBe('Monatsübersicht öffnen'))
  })

  it('schließt das Monatsblatt, sobald ein Tag gewählt ist', async () => {
    // Das Blatt liegt über dem Tagesbereich. Einen Tag zu wählen und ihn dann
    // verdeckt zu bekommen, ist eine Sackgasse.
    const client = createDashboardClient(startFixFixture(), undefined, { filterLogs: true })
    const blatt = await blattOeffnen(client)
    const zelle = blatt.querySelector('[data-calendar-date="2026-09-22"]') as HTMLElement
    fireEvent.click(zelle)

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(gewaehlterTag()).toBe('2026-09-22')
  })

  it('holt den Monat zurück zum gewählten Tag, wenn das Blatt ohne Auswahl zugeht', async () => {
    // Sonst hängt der Ladebereich an einem Monat, den niemand mehr ansieht —
    // und der Streifen meldet „0 von N bestätigt" für Tage, an denen alles
    // bestätigt war.
    const fixtures = startFixFixture()
    // Der Standardzyklus beginnt erst gestern — an einem Tag mitten in der
    // Woche waere dann nichts geplant und der Balken saehe so oder so leer aus.
    const basis = normalizedCycle()
    fixtures.cycles = [{
      ...basis,
      started_at: '2026-09-14T00:00:00.000Z',
      versions: basis.versions.map(version => ({ ...version, effective_local_date: '2026-09-14' })),
    }]
    fixtures.dose_logs = [{ ...pendingLog(), taken: true, logged_at: '2026-09-16T06:05:00.000Z',
      routine_slot_key: 'timeline-cycle@2026-09-16T08:00' }]
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    await blattOeffnen(client)

    fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // Der Streifen zeigt weiter die Woche des gewählten Tages — und deren
    // Logs sind geladen, nicht die eines fremden Monats.
    await waitFor(() => expect(screen.getByRole('heading', { name: /September/ })).toBeTruthy())
    await waitFor(() => expect(tagesBalken('2026-09-16')).toBe('100%'))
  })

  /** Zwei morgens, eine abends — der Fall, in dem eine leergeräumte
   *  Tageszeit die ganze Liste zuklappen ließ. */
  function morgensUndAbendsFixture() {
    const fixtures = zweiMorgensFixture()
    const basis = normalizedCycle()
    fixtures.cycles.push({
      ...basis, id: 'zyklus-abend', stack_item_id: 'stack-3', name: 'Magnesium',
      intake_time: 'abends', intake_time_custom: '20:00',
      versions: basis.versions.map(v => ({ ...v, id: 'version-abend', cycle_id: 'zyklus-abend',
        intake_time: 'abends', intake_time_custom: '20:00' })),
    })
    fixtures.stack_items.push({ id: 'stack-3', display_name: 'Magnesium', default_method: 'Oral',
      dosage_form: 'capsule', tracking_level: 'complete' })
    return fixtures
  }

  /** Drei Einnahmen morgens. Mit zweien maskiert der `slots.length === 1`-
   *  Rückfall jeden Fehler beim Weiterrücken. */
  function dreiMorgensFixture() {
    const fixtures = zweiMorgensFixture()
    const basis = normalizedCycle()
    fixtures.cycles.push({
      ...basis, id: 'zyklus-drei', stack_item_id: 'stack-3', name: 'Zink',
      versions: basis.versions.map(v => ({ ...v, id: 'version-drei', cycle_id: 'zyklus-drei' })),
    })
    fixtures.stack_items.push({ id: 'stack-3', display_name: 'Zink', default_method: 'Oral',
      dosage_form: 'capsule', tracking_level: 'complete' })
    return fixtures
  }

  function zweiMorgensFixture() {
    const fixtures = startFixFixture()
    const basis = normalizedCycle()
    fixtures.cycles = [
      basis,
      { ...basis, id: 'zyklus-zwei', stack_item_id: 'stack-2', name: 'Magnesium',
        versions: basis.versions.map(v => ({ ...v, id: 'version-zwei', cycle_id: 'zyklus-zwei' })) },
    ]
    fixtures.stack_items = [
      ...fixtures.stack_items,
      { id: 'stack-2', display_name: 'Magnesium', default_method: 'Oral',
        dosage_form: 'capsule', tracking_level: 'complete' },
    ]
    return fixtures
  }

  it('rückt nach einer Entscheidung auf die nächste offene Einnahme weiter', async () => {
    // Drei, nicht zwei: bei zweien bliebe nur eine übrig und die Voreinstellung
    // deckte jeden Fehler beim Weiterrücken zu.
    const fixtures = dreiMorgensFixture()
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(document.querySelectorAll('[data-due-row]').length).toBe(3))
    const offen = () => document.querySelector('[data-due-open]')?.getAttribute('data-due-row')

    // Eine andere antippen, damit die Voreinstellung nicht mehr greift.
    const zweite = document.querySelectorAll('[data-due-row]')[1] as HTMLElement
    fireEvent.click(zweite.querySelector('[data-due-item]') as HTMLElement)
    const angetippt = offen()
    expect(angetippt).toBe(zweite.getAttribute('data-due-row'))

    // Sie wird entschieden und fällt aus den offenen Slots.
    fixtures.dose_logs = [{ ...pendingLog(), taken: false, stack_item_id: 'stack-2',
      cycle_id: 'zyklus-zwei', plan_version_id: 'version-zwei',
      routine_slot_key: 'zyklus-zwei@2026-09-18T08:00' }]
    fireEvent.click(within(zweite).getByRole('button', { name: 'uebersprungen' }))

    // Es bleibt eine aufgeklappt, und zwar eine andere — nicht keine.
    await waitFor(() => expect(offen()).not.toBe(angetippt))
    expect(offen()).toBeTruthy()
  })

  it('geht zur nächsten Tageszeit über, wenn die angetippte leer ist', async () => {
    // Der Merker zeigte auf eine Tageszeit, in der nichts mehr offen war —
    // und die ganze Liste klappte zu, obwohl abends noch etwas anstand.
    //
    // Echte Klicks statt einer vorgetaeuschten Fixture: eine Bestaetigung
    // patcht jetzt lokal (siehe die Helfer bei `deleteLog`), ein Neuladen
    // wie frueher findet nicht mehr statt -- also muss hier auch wirklich
    // entschieden werden, was am Ende entschieden sein soll.
    const fixtures = morgensUndAbendsFixture()
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(document.querySelectorAll('[data-due-row]').length).toBe(3))

    // Die zweite morgendliche antippen und entscheiden.
    const morgens = [...document.querySelectorAll('[data-due-row]')].slice(0, 2)
    fireEvent.click(morgens[1].querySelector('[data-due-item]') as HTMLElement)
    fireEvent.click(within(morgens[1] as HTMLElement).getByRole('button', { name: 'uebersprungen' }))

    // Der Merker rueckt automatisch weiter (siehe der Test daneben) -- die
    // erste morgendliche steht jetzt offen da, ohne erneutes Antippen.
    await waitFor(() => expect(document.querySelectorAll('[data-due-row]').length).toBe(2))
    const restlicheMorgens = document.querySelector('[data-due-open]') as HTMLElement
    expect(restlicheMorgens).toBeTruthy()
    fireEvent.click(within(restlicheMorgens).getByRole('button', { name: 'uebersprungen' }))

    // Es bleibt genau eine übrig — und die steht offen da, nicht zugeklappt.
    await waitFor(() => expect(document.querySelectorAll('[data-due-row]').length).toBe(1))
    expect(document.querySelector('[data-due-open]')).toBeTruthy()
  })

  it('nennt in der aufgeklappten Einnahme ihre eigene Uhrzeit', async () => {
    // Die Kopfzeile der Tageszeit kann das nicht: „morgens" fasst alles vor
    // zwölf zusammen. Stünde dort die Zeit der ersten, zeigte eine 11:00er
    // Einnahme dem Nutzer 06:00 an — direkt über dem Bestätigen-Knopf.
    const client = createDashboardClient(startFixFixture(), undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(document.querySelector('[data-due-open]')).toBeTruthy())

    const offen = document.querySelector('[data-due-open]') as HTMLElement
    expect(within(offen).getByText('08:00')).toBeTruthy()
  })

  it('klappt eine aufgeklappte Einnahme auf erneutes Antippen wieder zu', async () => {
    const client = createDashboardClient(zweiMorgensFixture(), undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(document.querySelectorAll('[data-due-row]').length).toBe(2))

    const erste = document.querySelector('[data-due-row]') as HTMLElement
    expect(erste.getAttribute('data-due-open')).toBe('true')
    fireEvent.click(erste.querySelector('[data-due-item]') as HTMLElement)

    await waitFor(() => expect(document.querySelector('[data-due-open]')).toBeNull())
  })

  it('behält den Fokus auf der angetippten Einnahme', async () => {
    // Vorher wanderte die Zeile beim Antippen nach oben, der Knopf verschwand
    // und der Fokus fiel auf `body`. Jetzt klappt sie an Ort und Stelle auf:
    // derselbe Knopf bleibt stehen und behält den Fokus.
    const client = createDashboardClient(zweiMorgensFixture(), undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(document.querySelectorAll('[data-due-row]').length).toBe(2))

    const zweite = document.querySelectorAll('[data-due-row]')[1] as HTMLElement
    const knopf = zweite.querySelector('[data-due-item]') as HTMLElement
    knopf.focus()
    fireEvent.click(knopf)

    await waitFor(() => expect(zweite.getAttribute('data-due-open')).toBe('true'))
    expect(document.activeElement).toBe(knopf)
  })

  it('hält immer höchstens eine Einnahme aufgeklappt', async () => {
    const client = createDashboardClient(zweiMorgensFixture(), undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(document.querySelectorAll('[data-due-row]').length).toBe(2))

    // Voreingestellt ist die erste offene aufgeklappt — ohne Zutun.
    const zeilen = () => [...document.querySelectorAll('[data-due-row]')]
    expect(zeilen()[0].getAttribute('data-due-open')).toBe('true')

    fireEvent.click(zeilen()[1].querySelector('[data-due-item]') as HTMLElement)
    await waitFor(() => expect(zeilen()[1].getAttribute('data-due-open')).toBe('true'))
    expect(zeilen()[0].getAttribute('data-due-open')).toBeNull()
    expect(document.querySelectorAll('[data-due-open]').length).toBe(1)

    // Und die zugeklappte ist WIRKLICH zu, nicht nur anders beschriftet: ihre
    // Knöpfe dürfen weder sichtbar noch für Screenreader oder Tab erreichbar
    // sein. Das Attribut allein zu prüfen ließe einen Fehler in der Höhe durch.
    const feld = (zeile: Element) => zeile.querySelector('[data-due-panel]') as HTMLElement
    expect(feld(zeilen()[0]).hasAttribute('data-open')).toBe(false)
    expect(feld(zeilen()[1]).hasAttribute('data-open')).toBe(true)
    expect(feld(zeilen()[0]).getAttribute('aria-hidden')).toBe('true')
    expect(feld(zeilen()[1]).getAttribute('aria-hidden')).toBe('false')
    // Für Screenreader existiert der Knopf der zugeklappten Zeile nicht …
    expect(within(zeilen()[0] as HTMLElement)
      .queryByRole('button', { name: 'uebersprungen' })).toBeNull()
    // … und die Tab-Taste läuft nicht hinein.
    expect([...feld(zeilen()[0]).querySelectorAll('button')]
      .every(knopf => knopf.tabIndex === -1)).toBe(true)
    // In der aufgeklappten ist er da.
    expect(within(zeilen()[1] as HTMLElement)
      .getByRole('button', { name: 'uebersprungen' })).toBeTruthy()
  })

  it('zeigt in der aufgeklappten Einnahme die drei Wege damit umzugehen', async () => {
    const fixtures = startFixFixture()
    fixtures.cycles[0].versions[0].method = 'Subkutan'
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(document.querySelector('[data-due-open]')).toBeTruthy())

    const offen = document.querySelector('[data-due-open]') as HTMLElement
    expect(within(offen).getByRole('button', { name: 'eingenommen' })).toBeTruthy()
    // Die Menge aendert man im Bestaetigungsblatt; ein eigener Knopf dafuer
    // waere ein zweiter Weg zur selben Abweichung.
    expect(within(offen).queryByRole('button', { name: 'Einmalige Dosisänderung' })).toBeNull()
    expect(within(offen).getByRole('button', { name: 'uebersprungen' })).toBeTruthy()
    expect(within(offen).getByRole('button', { name: 'Mit Injektion tracken' })).toBeTruthy()
  })

  it('bestätigt gemeinsam nur über die eigenen Bündel, nicht je Tageszeit', async () => {
    // Die Tageszeit ist nur noch Ueberschrift. Der Sammelweg ist das Bündel,
    // und dessen Blatt fragt die Uhrzeit immer ab.
    const client = createDashboardClient(zweiMorgensFixture(), undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(document.querySelectorAll('[data-due-row]').length).toBe(2))
    expect(screen.queryByRole('button', { name: 'Alle als eingenommen markieren' })).toBeNull()

    await gruppenBestaetigungOeffnen()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Alle Substanzen')).toBeTruthy()
    expect((within(dialog).getByLabelText('Uhrzeit') as HTMLInputElement).value).toMatch(/^\d{2}:\d{2}$/)
  })

  it('speichert die im Bündel abgefragte Uhrzeit für alle gewählten Einnahmen', async () => {
    const client = createDashboardClient(zweiMorgensFixture(), undefined, { filterLogs: true })
    renderDashboard(client)
    await gruppenBestaetigungOeffnen()
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Uhrzeit'), { target: { value: '09:30' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eingenommen' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', expect.anything()))
    const params = client.rpc.mock.calls.find(call => call[0] === 'confirm_intake_group')![1] as {
      p_entries: Array<{ logged_at: string; slot_key: string }>
    }
    expect(params.p_entries.length).toBeGreaterThan(0)
    for (const entry of params.p_entries) {
      const zeitpunkt = new Date(entry.logged_at)
      expect([zeitpunkt.getHours(), zeitpunkt.getMinutes()]).toEqual([9, 30])
      // Die Uhrzeit aendert, wann genommen wurde — nicht, welcher Platz im Plan.
      expect(entry.slot_key).not.toContain('09:30')
    }
  })

  it('zeigt jede offene Einnahme, auch die derselben Tageszeit', async () => {
    // Im alten Modell stand eine Gruppe entweder als Karte oder aufgeklappt
    // da, und die übrigen ihrer Tageszeit konnten dabei verloren gehen. Jetzt
    // ist jede eine eigene Zeile — sichtbar, egal welche aufgeklappt ist.
    const client = createDashboardClient(dreiMorgensFixture(), undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(document.querySelectorAll('[data-due-row]').length).toBe(3))
    expect(document.querySelectorAll('[data-due-open]').length).toBe(1)
  })

  it('zählt eine ausgelassene Einnahme nicht als bestätigt', async () => {
    // Die Tageszelle zählt „bestätigt" als GENOMMEN. Die Bilanz im Helden muss
    // dasselbe sagen, sonst behauptet die Seite „2 von 2 bestätigt" für einen
    // Tag, an dem eine Einnahme bewusst ausgelassen wurde.
    const fixtures = zweiMorgensFixture()
    fixtures.dose_logs = [
      { ...pendingLog(), taken: true, routine_slot_key: 'timeline-cycle@2026-09-18T08:00' },
      { ...pendingLog(), id: 'pending-zwei', stack_item_id: 'stack-2', taken: false,
        cycle_id: 'zyklus-zwei', plan_version_id: 'version-zwei',
        routine_slot_key: 'zyklus-zwei@2026-09-18T08:00' },
    ]
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    fireEvent.click(document.querySelector('[data-calendar-date="2026-09-18"]') as HTMLElement)
    await waitFor(() => expect(screen.getAllByRole('status')
      .some(element => element.textContent?.includes('Lädt'))).toBe(false))

    // Beide entschieden, aber nur eine genommen: die Zelle zeigt halb …
    await waitFor(() => expect(tagesBalken('2026-09-18')).toBe('50%'))
    // … und die Tagesmeldung behauptet nicht, alles sei bestätigt worden.
    expect(screen.queryByText('Alle geplanten Einnahmen sind bestätigt.')).toBeNull()
    expect(screen.getByText('Für diesen Tag ist alles protokolliert.')).toBeTruthy()
    expect(screen.getByText('1 genommen · 1 übersprungen')).toBeTruthy()
  })

  it('zeigt einen Tag mit lauter ausgelassenen Einnahmen neutral, nicht grün und nicht rot', async () => {
    // Ausgelassen ist entschieden, nicht falsch — und nicht „alles bestätigt".
    // Vorher stand hier ein grüner Haken mit „0 von 2 bestätigt" (heute) oder
    // ein rotes X „nicht vollständig protokolliert" (gestern), obwohl alles
    // protokolliert war.
    const fixtures = zweiSlotsFixture()
    fixtures.dose_logs = [
      { ...pendingLog(), taken: false, routine_slot_key: 'timeline-cycle@2026-09-18T08:00' },
      { ...pendingLog(), id: 'pending-abend', taken: false, notes: 'auto-missed',
        routine_slot_key: 'timeline-cycle@2026-09-18T20:00' },
    ]
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    renderDashboard(createDashboardClient(fixtures, undefined, { filterLogs: true }))
    fireEvent.click(document.querySelector('[data-calendar-date="2026-09-18"]') as HTMLElement)

    // Verpasst hat der Auto-Miss eingetragen — dann heißt der Tag nicht
    // „alles protokolliert", aber auch nicht rot.
    const receipt = await screen.findByText('Dieser Tag ist nicht vollständig protokolliert.')
    const card = receipt.closest('[data-due-receipt]') as HTMLElement
    expect(card.textContent).toContain('0 genommen · 1 übersprungen · 1 verpasst')
    expect(card.querySelector('.lucide-check')).toBeNull()
    expect(card.getAttribute('data-tone')).toBeNull()
    expect(screen.queryByRole('button', { name: /Bereits protokolliert/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Nicht protokolliert/ }).getAttribute('data-tone')).not.toBe('bad')
  })

  it('trägt eine gestern ausgelassene Einnahme mit „Doch eingenommen" direkt nach', async () => {
    // Für einen vergangenen Tag war „Wieder öffnen" ein Umweg: die Einnahme
    // stand danach wieder als offen da und musste dort noch bestätigt werden.
    const fixtures = startFixFixture()
    fixtures.dose_logs = [{ ...pendingLog(), taken: false, notes: 'auto-missed' }]
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    fireEvent.click(document.querySelector('[data-calendar-date="2026-09-18"]') as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: /Nicht protokolliert/ }))
    await protokollZeileOeffnen()

    // Nur der direkte Weg; „Wieder öffnen" gibt es für gestern nicht mehr.
    expect(screen.queryByRole('button', { name: 'Wieder öffnen' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Doch eingenommen' }))

    // Abbrechen ändert nichts — die Einnahme bleibt ausgelassen.
    const dialog = await screen.findByRole('dialog')
    expect((within(dialog).getByLabelText('Uhrzeit') as HTMLInputElement).value).toBe('08:00')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(client.mutations.filter(m => m.table === 'dose_logs')).toHaveLength(0)

    // Bestätigen: erst öffnen (samt Auto-Miss-Notiz), dann über die RPC speichern.
    // Die Zeile ist noch aufgeklappt.
    fireEvent.click(screen.getByRole('button', { name: 'Doch eingenommen' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', expect.anything()))
    expect(client.mutations).toContainEqual({
      table: 'dose_logs', kind: 'update', values: { taken: null, notes: null },
    })
    const params = client.rpc.mock.calls.find(call => call[0] === 'confirm_intake_group')![1] as {
      p_entries: Array<{ dose_log_id: string; slot_key: string; taken: boolean }>
    }
    expect(params.p_entries).toEqual([expect.objectContaining({
      dose_log_id: 'pending-exact', slot_key: 'timeline-cycle@2026-09-18T08:00', taken: true,
    })])
  })

  it('lässt eine nachgetragene Einnahme ausgelassen, wenn das Speichern scheitert', async () => {
    const fixtures = startFixFixture()
    fixtures.dose_logs = [{ ...pendingLog(), taken: false, notes: 'auto-missed' }]
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const client = createDashboardClient(fixtures, async name => (
      name === 'confirm_intake_group'
        ? { data: null, error: { message: 'kaputt' } }
        : { data: [], error: null }
    ), { filterLogs: true })
    renderDashboard(client)
    fireEvent.click(document.querySelector('[data-calendar-date="2026-09-18"]') as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: /Nicht protokolliert/ }))
    await protokollZeileOeffnen()
    fireEvent.click(screen.getByRole('button', { name: 'Doch eingenommen' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eingenommen' }))

    await waitFor(() => expect(client.mutations.filter(m => m.table === 'dose_logs')).toHaveLength(2))
    const [geoeffnet, zurueck] = client.mutations.filter(m => m.table === 'dose_logs')
    expect(geoeffnet.values).toEqual({ taken: null, notes: null })
    // Zurück, wie es war: ausgelassen, mit der Auto-Miss-Notiz.
    expect(zurueck.values).toEqual({ taken: false, notes: 'auto-missed' })
  })

  it('trennt bestätigte und übersprungene Einnahmen in grüne und neutrale Bereiche', async () => {
    const fixtures = zweiSlotsFixture()
    fixtures.dose_logs = [
      { ...pendingLog(), taken: true, routine_slot_key: 'timeline-cycle@2026-09-18T08:00' },
      { ...pendingLog(), id: 'pending-abend', taken: false,
        routine_slot_key: 'timeline-cycle@2026-09-18T20:00' },
    ]
    renderDashboard(createDashboardClient(fixtures, undefined, { filterLogs: true }))

    const logged = await screen.findByRole('button', { name: /Bereits protokolliert/ })
    const unlogged = screen.getByRole('button', { name: /Nicht protokolliert/ })
    expect(logged.getAttribute('data-tone')).toBe('good')
    expect(unlogged.getAttribute('data-tone')).not.toBe('bad')
    expect(logged.textContent).toContain('1')
    expect(unlogged.textContent).toContain('1')

    fireEvent.click(logged)
    expect(within(logged.parentElement!).getByText('eingenommen')).toBeTruthy()
    expect(within(logged.parentElement!).queryByText('uebersprungen')).toBeNull()

    fireEvent.click(unlogged)
    expect(within(unlogged.parentElement!).getByText('uebersprungen')).toBeTruthy()
    expect(within(unlogged.parentElement!).queryByText('eingenommen')).toBeNull()
  })

  it('beantwortet einen geladenen Tag sofort und wartet nur auf einen ungeladenen', async () => {
    // Zwei Zusagen in einem Fall, weil sie zusammengehoeren.
    //
    // Der Monat wird in einem Zug geholt -- das Raster reicht von der ersten
    // bis zur letzten angezeigten Woche. Ein Tag DARIN ist also schon
    // beantwortet, und die Seite darf ihn nicht noch einmal erfragen; genau
    // das war der Grund, warum das Ausklappen und jeder Tagwechsel sich wie
    // ein Neuladen anfuehlten.
    //
    // Ein Monat, der noch NICHT geholt wurde, ist der andere Fall: dort darf
    // die Seite nichts anbieten, was auf den alten Zahlen beruht, und zeigt
    // bis zur Antwort den Ladehinweis.
    const fixtures = startFixFixture()
    const options: { filterLogs: boolean; logReadGate?: Promise<void> } = { filterLogs: true }
    const client = createDashboardClient(fixtures, undefined, options)
    renderDashboard(client)
    await screen.findByRole('button', { name: BUENDEL_KNOPF })

    const abfragen = client.logQueries.length
    const nextDay = document.querySelector('[data-calendar-date="2026-09-19"]')!
    fireEvent.click(nextDay)
    expect(gewaehlterTag()).toBe('2026-09-19')
    expect(screen.getAllByRole('status').some(element => element.textContent?.includes('Lädt'))).toBe(false)
    expect(client.logQueries.length).toBe(abfragen)

    let release!: () => void
    options.logReadGate = new Promise<void>(resolve => { release = resolve })
    fireEvent.click(screen.getByRole('button', { name: 'Monatsübersicht öffnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: BUENDEL_KNOPF })).toBeNull()
    expect(screen.getAllByRole('status').some(element => element.textContent?.includes('Lädt'))).toBe(true)
    await act(async () => { release() })
    await waitFor(() => expect(screen.getAllByRole('status')
      .some(element => element.textContent?.includes('Lädt'))).toBe(false))
    expect(client.logQueries.length).toBeGreaterThan(abfragen)
  })

  it.each(['single', 'group'])('refreshes the current union after an older %s confirmation finishes', async kind => {
    const fixtures = startFixFixture()
    let finish!: () => void
    const confirmation = new Promise<void>(resolve => { finish = resolve })
    const client = createDashboardClient(fixtures, async name => {
      if (name === 'confirm_intake_group') {
        await confirmation
        fixtures.dose_logs = [{ ...pendingLog(), taken: true, logged_at: '2026-07-01T06:00:00.000Z' }]
      }
      return { data: [{ id: 'saved-log-1' }], error: null }
    }, { filterLogs: true })
    renderDashboard(client)
    if (kind === 'single') {
      await openSingle()
      fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    } else {
      await gruppenBestaetigungOeffnen()
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eingenommen' }))
    }
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', expect.anything()))
    browseToNovember()
    await screen.findByRole('button', { name: BUENDEL_KNOPF })
    const queriesBeforeCompletion = client.logQueries.length
    await act(async () => { finish() })
    await waitFor(() => expect(client.logQueries.length).toBeGreaterThan(queriesBeforeCompletion))
    await waitFor(() => expect(screen.getAllByRole('status').some(element => element.textContent?.includes('Lädt'))).toBe(false))
    expect(await screen.findByText('Alle geplanten Einnahmen sind bestätigt.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: BUENDEL_KNOPF })).toBeNull()
    const refreshedKeys: string[] = client.logQueries.slice(queriesBeforeCompletion)
      .flatMap(query => (query.or as ReturnType<typeof vi.fn>).mock.calls.map(call => call[0] as string))
    expect(faengtSchluessel(refreshedKeys, 'timeline-cycle@2026-11-18T08:00')).toBe(true)
    expect(faengtSchluessel(refreshedKeys, 'timeline-cycle@2026-09-18T08:00')).toBe(true)
  })

  it('preserves a committed group inventory-only retry after month navigation', async () => {
    const fixtures = startFixFixture()
    let finishInventory!: () => void
    const inventory = new Promise<void>(resolve => { finishInventory = resolve })
    let inventoryAttempts = 0
    const client = createDashboardClient(fixtures, async name => {
      if (name === 'confirm_intake_group') {
        fixtures.dose_logs = [{ ...pendingLog(), taken: true, logged_at: '2026-07-01T06:00:00.000Z' }]
      }
      if (name === 'apply_inventory_confirmation' && ++inventoryAttempts === 1) {
        await inventory
        return { data: null, error: { message: 'retry inventory' } }
      }
      return { data: [{ id: 'saved-log-1' }], error: null }
    }, { filterLogs: true })
    renderDashboard(client)
    await gruppenBestaetigungOeffnen()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eingenommen' }))
    await screen.findByText('Routine gespeichert')
    browseToNovember()
    await screen.findByText('Alle geplanten Einnahmen sind bestätigt.')
    await act(async () => { finishInventory() })
    fireEvent.click(await screen.findByRole('button', { name: 'Bestand erneut versuchen' }))
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Bestand erneut versuchen' })).toBeNull())
    expect(client.rpc.mock.calls.filter(call => call[0] === 'confirm_intake_group')).toHaveLength(1)
    expect(screen.getByText('Alle geplanten Einnahmen sind bestätigt.')).toBeTruthy()
  })

  it('keeps the original 08:00 occurrence in a pending group confirmation', async () => {
    const fixtures = startFixFixture()
    fixtures.dose_logs = [pendingLog()]
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    await gruppenBestaetigungOeffnen()
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({ dose_log_id: 'pending-exact',
        slot_key: 'timeline-cycle@2026-09-18T08:00', logged_at: '2026-09-18T06:00:00.000Z' })],
    }))
  })

  it('keeps the original pending occurrence in the injection deep link', async () => {
    const fixtures = startFixFixture()
    fixtures.cycles[0].versions[0].method = 'Subkutan'
    fixtures.dose_logs = [pendingLog()]
    renderDashboard(createDashboardClient(fixtures))
    fireEvent.click(await screen.findByRole('button', { name: 'Mit Injektion tracken' }))
    const url = new URL(screen.getByTestId('location').textContent!, 'https://example.test')
    expect(url.searchParams.get('scheduledAt')).toBe('2026-09-18T06:00:00.000Z')
  })

  it('bestaetigt Zeit UND Menge in einem Sheet, ohne den Umweg ueber die Gruppe', async () => {
    // Der Punkt: vorher brauchte es fuer beide Korrekturen zwei
    // verschiedene Sheets -- „Eingenommen" fuer die Uhrzeit, „Einmalige
    // Dosisaenderung" (das groessere Gruppen-Sheet) fuer die Menge. Jetzt
    // steht das Mengenfeld direkt im Zeit-Sheet.
    const fixtures = startFixFixture()
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    await openSingle()
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '09:30' } })
    fireEvent.change(screen.getByLabelText('Menge'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({
        dose: 30, unit: 'mg', logged_at: '2026-09-18T07:30:00.000Z',
      })],
    }))
  })

  it('laesst eine ungueltige Menge nicht durch und verwirft nichts', async () => {
    const fixtures = startFixFixture()
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    await openSingle()
    fireEvent.change(screen.getByLabelText('Menge'), { target: { value: '0' } })
    const knopf = screen.getByRole('button', { name: 'Eingenommen' }) as HTMLButtonElement
    expect(knopf.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(knopf)
    expect(client.rpc).not.toHaveBeenCalled()

    // Eine leere Menge ebenso -- die Substanz traegt eine Menge, „nichts"
    // ist keine gueltige Antwort darauf.
    fireEvent.change(screen.getByLabelText('Menge'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Eingenommen' }).getAttribute('aria-disabled')).toBe('true')
  })

  it('zeigt kein Mengenfeld fuer eine Intake-Only-Substanz', async () => {
    const fixtures = startFixFixture()
    fixtures.stack_items[0]!.tracking_level = 'intake_only'
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    await openSingle()
    expect(screen.queryByLabelText('Menge')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({ dose: null, unit: null })],
    }))
  })

  it('zeigt das Mengenfeld nur unter der Zeitleiste', () => {
    // `handleConfirmSheet` reicht die Menge nur in ihrem V2-Zweig an
    // `confirmCycleDose` weiter. Fuellte `openConfirmSheet` das Feld auch
    // ausserhalb, saehe der Nutzer eine editierbare Menge, deren Eingabe
    // beim Bestaetigen still verworfen wuerde.
    const source = readFileSync('src/pages/Dashboard.tsx', 'utf8')
    const oeffnen = source.slice(
      source.indexOf('const openConfirmSheet = ('),
      source.indexOf('const openInjectionTrackerForSlot = ('),
    )
    expect(oeffnen.length).toBeGreaterThan(200)
    expect(oeffnen).toContain('if (FEATURES.planTimelineV2 && cycle && dosePlanCapabilities(')
  })

  it.each([false, true])('confirms a normalized single intake through exact RPC (pending=%s)', async pending => {
    const fixtures = startFixFixture()
    if (pending) fixtures.dose_logs = [pendingLog(false)]
    fixtures.cycles[0].versions.push({ ...fixtures.cycles[0].versions[0], id: 'afternoon-version',
      effective_kind: 'instant', effective_at: '2026-09-18T13:00:00Z', effective_local_date: null } as never)
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    await openSingle()
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '16:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({ dose_log_id: pending ? 'pending-exact' : null,
        plan_version_id: 'afternoon-version', slot_key: 'timeline-cycle@2026-09-18T08:00',
        logged_at: '2026-09-18T14:00:00.000Z' })],
    }))
    expect(client.mutations).toEqual([])
    // Der Mock spiegelt die RPC: kam `dose_log_id` mit, bleibt es dieselbe
    // Zeile (Upsert); ohne, bekommt sie eine neue id.
    expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: pending ? 'pending-exact' : 'saved-log-1',
    })
  })

  it('loescht eine bestaetigte Menge lokal, statt den alten Wert zu behalten', async () => {
    // `?? vorherige` sollte nur greifen, wenn ein Feld in der Antwort FEHLT
    // (ein schmaler Test-Mock, nie eine echte Zeile). Ein echtes `dose: null`
    // ist etwas anderes -- die Substanz ist jetzt Intake-Only, die Menge
    // zaehlt nicht mehr. Verwechselt der lokale Patch die beiden, blieb der
    // alte Wert stehen, obwohl die Datenbank ihn gerade geloescht hat.
    const fixtures = startFixFixture()
    fixtures.stack_items[0]!.tracking_level = 'intake_only'
    fixtures.dose_logs = [pendingLog()] // traegt noch die alte Menge: 25 mg
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await openSingle()
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', expect.anything()))
    await screen.findByText('Alle geplanten Einnahmen sind bestätigt.')

    fireEvent.click(screen.getByRole('button', { name: /Bereits protokolliert/ }))
    expect(screen.getByText('Menge nicht getrackt')).toBeTruthy()
    expect(screen.queryByText('25 mg')).toBeNull()
  })

  it('bestaetigt einen einzelnen Slot ohne einen weiteren dose_logs-Rundgang', async () => {
    // Der Punkt der ganzen Umstellung: eine Bestaetigung patcht lokal aus
    // der Antwort der RPC (`returns setof dose_logs`), statt den sichtbaren
    // Monat neu zu laden. Vorher loeste jede Bestaetigung mehrere parallele
    // Anfragen aus -- Zeitleisten, Bestandsliste, Zeitzonen-Review, jede
    // Zeile im Fenster -- fuer eine einzige Zeile, die sich geaendert hat.
    const fixtures = startFixFixture()
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await openSingle()
    const dosLogsAbfragenVorher = client.selectCounts.get('dose_logs') ?? 0
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', expect.anything()))
    await screen.findByText('Alle geplanten Einnahmen sind bestätigt.')
    expect(client.selectCounts.get('dose_logs')).toBe(dosLogsAbfragenVorher)
  })

  it.each([false, true])('skips a normalized single intake through the lifecycle-locked RPC (pending=%s)', async pending => {
    const fixtures = startFixFixture()
    if (pending) fixtures.dose_logs = [pendingLog()]
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('button', { name: 'uebersprungen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({
        dose_log_id: pending ? 'pending-exact' : null,
        plan_version_id: 'timeline-version',
        slot_key: 'timeline-cycle@2026-09-18T08:00',
        logged_at: pending ? '2026-09-18T07:00:00.000Z' : '2026-09-18T06:00:00.000Z',
        taken: false,
      })],
    }))
    expect(client.mutations).toEqual([])
  })

  it('surfaces a rejected pending provenance change without a legacy write', async () => {
    const fixtures = startFixFixture()
    fixtures.dose_logs = [pendingLog()]
    const client = createDashboardClient(fixtures, async () => ({ data: null, error: { message: 'Existing version mismatch' } }))
    renderDashboard(client)
    await openSingle()
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(pageMocks.toast.error).toHaveBeenCalled())
    expect(client.mutations).toEqual([])
    expect(screen.getByRole('button', { name: 'Eingenommen' })).toBeTruthy()
  })

  it.each(['start', 'resume'])('offers PRN after a 15:00 %s and resolves the submitted 16:00 version', async kind => {
    const fixtures = startFixFixture('Bei Bedarf')
    if (kind === 'start') fixtures.cycles[0].started_at = '2026-09-18T13:00:00Z'
    else fixtures.cycles[0].pauses = [{ id: 'p', cycle_id: 'timeline-cycle',
      paused_at: '2026-09-17T00:00:00Z', ends_at: '2026-09-18T13:00:00Z' }]
    fixtures.cycles[0].versions.push({ ...fixtures.cycles[0].versions[0], id: 'prn-afternoon',
      effective_kind: 'instant', effective_at: '2026-09-18T13:00:00Z', effective_local_date: null } as never)
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('button', { name: 'Eingenommen' }))
    expect(await screen.findByText('Einnahme bestätigen')).toBeTruthy()
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '16:00' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Eingenommen' }).at(-1)!)
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({ plan_version_id: 'prn-afternoon', logged_at: '2026-09-18T14:00:00.000Z' })],
    }))
  })

  it('rejects a chosen PRN minute inside a pause before issuing any write', async () => {
    const fixtures = startFixFixture('Bei Bedarf')
    fixtures.cycles[0].pauses = [{ id: 'p', cycle_id: 'timeline-cycle',
      paused_at: '2026-09-18T13:00:00Z', ends_at: '2026-09-18T15:00:00Z' }]
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('button', { name: 'Eingenommen' }))
    expect(await screen.findByText('Einnahme bestätigen')).toBeTruthy()
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '16:00' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Eingenommen' }).at(-1)!)
    await waitFor(() => expect(pageMocks.toast.error).toHaveBeenCalled())
    expect(client.rpc).not.toHaveBeenCalled()
    expect(client.mutations).toEqual([])
  })

  it('renders the Berlin spring-gap day without aborting', async () => {
    const fixtures = startFixFixture('Täglich', '2026-03-29T12:00:00Z')
    fixtures.cycles[0].versions[0].intake_time_custom = '02:30'
    renderDashboard(createDashboardClient(fixtures))
    expect(await screen.findByRole('button', { name: 'eingenommen' })).toBeTruthy()
  })

  it('shows normalized load failure instead of empty data and retries safely', async () => {
    const errors = { cycles: { message: 'timeline unavailable' } as { message: string } | null }
    const client = createDashboardClient(startFixFixture(), undefined, { errors })
    renderDashboard(client)
    expect(screen.getAllByRole('status').some(element => element.textContent?.includes('Lädt'))).toBe(true)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'eingenommen' })).toBeNull()
    errors.cycles = null
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByRole('button', { name: 'eingenommen' })).toBeTruthy()
  })

  it('removes stale Calendar confirmation actions when a refresh fails', async () => {
    // Der Ein-Slot-Weg laedt nach einer Bestaetigung nicht mehr neu (siehe
    // die Helfer bei `deleteLog`) -- diese Eigenschaft gilt jetzt nur noch
    // dort, wo tatsaechlich noch neu geladen wird: der Gruppenbestaetigung.
    const errors = { cycles: null as { message: string } | null, dose_logs: null as { message: string } | null }
    const client = createDashboardClient(startFixFixture(), async name => {
      if (name === 'confirm_intake_group') {
        errors.dose_logs = { message: 'logs unavailable' }
        return { data: [{ id: 'saved-log-1' }], error: null }
      }
      return { data: [{ id: 'saved-log-1' }], error: null }
    }, { errors })
    renderDashboard(client)
    await gruppenBestaetigungOeffnen()
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eingenommen' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'eingenommen' })).toBeNull()
    expect(screen.queryByRole('button', { name: BUENDEL_KNOPF })).toBeNull()
  })

  it('fetches keyed coverage independently when actual time moved outside the month', async () => {
    const fixtures = startFixFixture('Täglich', '2026-09-01T14:00:00Z')
    fixtures.dose_logs = [{ ...pendingLog(), taken: true,
      logged_at: '2026-08-30T21:00:00.000Z', routine_slot_key: 'timeline-cycle@2026-09-01T08:00' }]
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(screen.getByText('Alle geplanten Einnahmen sind bestätigt.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'eingenommen' })).toBeNull()
    // Die Abdeckung wird ueber den Schluesselbereich geholt, unabhaengig von
    // `logged_at` -- frueher ueber eine Aufzaehlung mit `in`.
    expect(client.logQueries.some(query => (query.or as ReturnType<typeof vi.fn>).mock.calls.length > 0)).toBe(true)
  })

  it('fetches legacy coverage from the positive-offset first local day boundary', async () => {
    const fixtures = startFixFixture('Täglich', '2026-09-01T14:00:00Z')
    fixtures.cycles[0].versions[0].intake_time_custom = '00:30'
    fixtures.dose_logs = [{ ...pendingLog(false), taken: true, logged_at: '2026-08-31T22:30:00.000Z' }]
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    expect(await screen.findByText('Bereits protokolliert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: BUENDEL_KNOPF })).toBeNull()
    expect(client.logQueries[0].gte).toHaveBeenCalledWith('logged_at', '2026-08-30T22:00:00.000Z')
    expect(client.logQueries[0].lt).toHaveBeenCalledWith('logged_at', '2026-10-04T22:00:00.000Z')
  })

  it('retries only inventory after a committed normalized pending confirmation', async () => {
    const fixtures = startFixFixture()
    fixtures.dose_logs = [pendingLog(false)]
    let inventoryAttempts = 0
    const client = createDashboardClient(fixtures, async name => {
      if (name === 'apply_inventory_confirmation' && ++inventoryAttempts === 1) {
        return { data: null, error: { message: 'retry inventory' } }
      }
      return { data: [{ id: 'pending-exact' }], error: null }
    })
    renderDashboard(client)
    await openSingle()
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Bestand erneut versuchen' }))
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    expect(client.rpc.mock.calls.filter(call => call[0] === 'confirm_intake_group')).toHaveLength(1)
    expect(client.mutations).toEqual([])
  })

  function normalizedCycle(frequency = 'Täglich', pauses: unknown[] = []) {
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const localDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')
    return {
      id: 'timeline-cycle',
      stack_item_id: 'stack-1',
      name: 'Vitamin D3',
      start_date: localDate,
      end_date: null as string | null,
      active: true,
      frequency,
      x_days_interval: null,
      interval_unit: null,
      cycle_on_days: null,
      cycle_off_days: null,
      schedule_days: null,
      intake_time: frequency === 'Bei Bedarf' ? '' : 'morgens',
      intake_time_custom: frequency === 'Bei Bedarf' ? null : '08:00',
      slot_doses: null,
      slot_days: null,
      dose: 25,
      unit: 'mg',
      method: 'Oral',
      schedule_history: null,
      stack_items: { display_name: 'Vitamin D3', tracking_level: 'complete' },
      timezone_review_required: false,
      started_at: new Date(today.getTime() - 86_400_000).toISOString(),
      ended_at: null as string | null,
      versions: [{
        id: 'timeline-version',
        cycle_id: 'timeline-cycle',
        effective_kind: 'local_date',
        effective_at: null,
        effective_local_date: localDate,
        change_kind: 'initial',
        frequency,
        x_days_interval: null,
        interval_unit: null,
        cycle_on_days: null,
        cycle_off_days: null,
        schedule_days: [],
        intake_time: frequency === 'Bei Bedarf' ? '' : 'morgens',
        intake_time_custom: frequency === 'Bei Bedarf' ? null : '08:00',
        slot_doses: null,
        slot_days: null,
        dose: 25,
        unit: 'mg',
        method: 'Oral',
      }],
      pauses,
    }
  }

  it('enables the verified timeline rollout by default', () => {
    const source = readFileSync('src/config/features.ts', 'utf8')
    expect(source).toMatch(/planTimelineV2:\s*true/)
  })

  it('uses timeline slots without dose escalations and confirms the exact version', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const client = createDashboardClient({
      cycles: [normalizedCycle()],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1', display_name: 'Vitamin D3', default_method: 'Oral',
        dosage_form: 'capsule', tracking_level: 'complete',
      }],
    })
    renderDashboard(client)

    await gruppenBestaetigungOeffnen()
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eingenommen' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({
        cycle_id: 'timeline-cycle',
        plan_version_id: 'timeline-version',
        slot_key: expect.stringMatching(/^timeline-cycle@/),
      })],
    }))
    expect(client.selectCounts.get('dose_escalations')).toBeUndefined()
    expect(client.selectCalls.find(call => call.table === 'cycles')?.columns)
      .toContain('cycle_plan_versions')
  })

  it('keeps lifecycle-valid PRN access without creating a due intake', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const client = createDashboardClient({
      cycles: [normalizedCycle('Bei Bedarf')],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1', display_name: 'Ibuprofen', default_method: 'Oral',
        dosage_form: 'tablet', tracking_level: 'intake_only',
      }],
    })
    renderDashboard(client)

    const prn = await waitFor(() => {
      const row = document.querySelector('[data-on-demand-cycle="timeline-cycle"]')
      if (!row) throw new Error('missing normalized PRN row')
      return row as HTMLElement
    })
    expect(prn.textContent).toContain('Ibuprofen')
    expect(screen.queryByRole('button', { name: BUENDEL_KNOPF })).toBeNull()
  })

  it('renders one neutral message for a fully paused selected day', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const now = new Date()
    const client = createDashboardClient({
      cycles: [normalizedCycle('Täglich', [{
        id: 'pause-1',
        cycle_id: 'timeline-cycle',
        paused_at: new Date(now.getTime() - 86_400_000).toISOString(),
        ends_at: new Date(now.getTime() + 86_400_000).toISOString(),
      }])],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1', display_name: 'Vitamin D3', default_method: 'Oral',
        dosage_form: 'capsule', tracking_level: 'complete',
      }],
    })
    renderDashboard(client)

    expect(await screen.findByText('Plan pausiert')).toBeTruthy()
    expect(screen.getAllByText('Während der Pause ist keine Einnahme fällig.')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: BUENDEL_KNOPF })).toBeNull()
  })
})

describe('Dashboard intake confirmation actions', () => {
  it('adapts a dashboard slot to the shared group model without a fake intake-only quantity', () => {
    const intake = buildDashboardRoutineIntake({
      key: 'cycle-1-720',
      cycleId: 'cycle-1',
      pendingLogId: 'pending-1',
      stackItemId: 'stack-1',
      stackItemName: 'Vitamin D3',
      trackingLevel: 'intake_only',
      routineGroup: 'midday',
      minutes: 720,
      scheduledAt: '2026-07-29T12:00:00.000Z',
      dose: 100,
      unit: 'mcg',
      method: 'Subkutan',
    })

    expect(intake).toMatchObject({
      planVersionId: null,
      pendingLogId: 'pending-1',
      group: 'midday',
      dose: null,
      unit: null,
      injectable: true,
    })
  })

  it('bietet „Bei Bedarf" zum Eintragen an, ohne es fällig zu machen', async () => {
    // Der Haken an einer Frequenz ohne Plan: `cycleAppliesToDay` gibt für sie
    // nie true zurück — richtig so, nichts soll fällig werden oder als
    // verpasst gelten. Genau deshalb erschiene sie ohne diesen Weg NIRGENDS,
    // und man könnte ein Schmerzmittel gar nicht eintragen.
    const client = createDashboardClient({
      cycles: [onDemandCycle()],
      dose_logs: [],
      stack_items: [{ id: 'stack-2', display_name: 'Ibuprofen', dosage_form: 'tablet' }],
      dose_escalations: [],
    })
    renderDashboard(client)

    const zeile = await waitFor(() => {
      const treffer = document.querySelector('[data-on-demand-cycle="cycle-2"]')
      if (!treffer) throw new Error('keine Bei-Bedarf-Zeile')
      return treffer as HTMLElement
    })
    expect(zeile.textContent).toContain('Ibuprofen')

    // Kein „fällig", kein „verpasst": es steht keine geplante Einnahme da.
    expect(screen.queryByRole('button', { name: BUENDEL_KNOPF })).toBeNull()

    fireEvent.click(within(zeile).getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(
      client.mutations.filter(eintrag => eintrag.table === 'dose_logs' && eintrag.kind === 'insert'),
    ).toHaveLength(1))
    expect(client.mutations.find(eintrag => eintrag.kind === 'insert')?.values).toMatchObject({
      stack_item_id: 'stack-2',
      taken: true,
    })
  })

  it('confirms an intake-only group with one RPC and one post-success log reload', async () => {
    const client = createDashboardClient({
      cycles: [intakeOnlyCycle()],
      dose_logs: [],
      stack_items: [{ id: 'stack-1', display_name: 'Vitamin D3', dosage_form: 'capsule' }],
      dose_escalations: [],
    })
    renderDashboard(client)

    await gruppenBestaetigungOeffnen()
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eingenommen' }))

    expect(await within(dialog).findByText('Routine gespeichert')).toBeTruthy()
    expect(client.rpc).toHaveBeenCalledTimes(1)
    expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({ dose: null, unit: null })],
    })
    await waitFor(() => expect(client.selectCounts.get('dose_logs')).toBe(2))
    expect(client.selectCounts.get('dose_escalations')).toBe(1)
    expect(client.selectCalls.find(call => call.table === 'cycles')?.columns)
      .not.toContain('cycle_plan_versions')
  })

  it('shows and persists no quantity when confirming one pending intake-only slot', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [intakeOnlyCycle()],
      dose_logs: [{
        id: 'pending-1',
        stack_item_id: 'stack-1',
        dose: 100,
        unit: 'mcg',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: null,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{ id: 'stack-1', display_name: 'Vitamin D3', dosage_form: 'capsule' }],
      dose_escalations: [],
    })
    renderDashboard(client)

    expect(await screen.findByText(/Menge nicht getrackt/)).toBeTruthy()
    expect(screen.queryByText('100 mcg')).toBeNull()
    expect(screen.getByRole('button', { name: 'uebersprungen' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'eingenommen' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Eingenommen' }))

    await waitFor(() => expect(client.mutations).toContainEqual({
      table: 'dose_logs',
      kind: 'update',
      values: expect.objectContaining({ taken: true, dose: null, unit: null }),
    }))
    expect(client.mutations.some(mutation => mutation.table === 'stack_items')).toBe(false)
  })

  it('keeps the existing single skip action and sanitizes its intake-only quantity', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [intakeOnlyCycle()],
      dose_logs: [{
        id: 'pending-1',
        stack_item_id: 'stack-1',
        dose: 100,
        unit: 'mcg',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: null,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{ id: 'stack-1', display_name: 'Vitamin D3', dosage_form: 'capsule' }],
      dose_escalations: [],
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('button', { name: 'uebersprungen' }))

    await waitFor(() => expect(client.mutations).toContainEqual({
      table: 'dose_logs',
      kind: 'update',
      values: { taken: false, dose: null, unit: null },
    }))
  })

  it('keeps the existing single-log undo action wired', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [intakeOnlyCycle()],
      dose_logs: [{
        id: 'completed-1',
        stack_item_id: 'stack-1',
        dose: null,
        unit: null,
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: true,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{ id: 'stack-1', display_name: 'Vitamin D3', dosage_form: 'capsule' }],
      dose_escalations: [],
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('button', { name: /Bereits protokolliert/ }))
    await protokollZeileOeffnen()
    fireEvent.click(await screen.findByRole('button', { name: 'Wieder öffnen' }))

    await waitFor(() => expect(client.mutations).toContainEqual({
      table: 'dose_logs',
      kind: 'update',
      values: { taken: null },
    }))
  })

  it('atomically reverses generic inventory when undoing a completed log', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 1,
        unit: 'capsule',
        stack_items: { display_name: 'Vitamin D3', tracking_level: 'complete' },
      }],
      dose_logs: [{
        id: 'completed-generic',
        stack_item_id: 'stack-1',
        dose: 1,
        unit: 'capsule',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: true,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Vitamin D3',
        dosage_form: 'capsule',
        tracking_level: 'complete',
      }],
      dose_escalations: [],
    }, async () => ({ data: 42, error: null }))
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('button', { name: /Bereits protokolliert/ }))
    await protokollZeileOeffnen()
    fireEvent.click(await screen.findByRole('button', { name: 'Wieder öffnen' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('reverse_inventory_confirmation', {
      p_dose_log_id: 'completed-generic',
      p_action: 'undo',
    }))
    expect(client.mutations.filter(mutation => mutation.table === 'dose_logs')).toHaveLength(0)
  })

  it('atomically reverses generic inventory before deleting a completed log', async () => {
    vi.stubGlobal('confirm', () => true)
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [intakeOnlyCycle()],
      dose_logs: [{
        id: 'completed-generic',
        stack_item_id: 'stack-1',
        dose: 1,
        unit: 'capsule',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: true,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Vitamin D3',
        dosage_form: 'capsule',
        tracking_level: 'complete',
      }],
      dose_escalations: [],
    }, async () => ({ data: 42, error: null }))
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('button', { name: /Bereits protokolliert/ }))
    await protokollZeileOeffnen()
    fireEvent.click(await screen.findByRole('button', { name: 'eintrag_loeschen' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('reverse_inventory_confirmation', {
      p_dose_log_id: 'completed-generic',
      p_action: 'delete',
    }))
    expect(client.mutations.filter(mutation => mutation.table === 'dose_logs')).toHaveLength(0)
  })

  it('atomically reverses a vial ledger movement without a manual stock credit', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 5,
        unit: 'mg',
        stack_items: { display_name: 'Peptide', tracking_level: 'complete' },
      }],
      dose_logs: [{
        id: 'completed-vial',
        stack_item_id: 'stack-1',
        dose: 5,
        unit: 'mg',
        method: 'Subkutan',
        logged_at: now.toISOString(),
        notes: null,
        taken: true,
        stack_items: { display_name: 'Peptide' },
      }],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Peptide',
        dosage_form: 'vial',
        tracking_level: 'complete',
        vial_amount_mg: 10,
        reconstitution_ml: 1,
        vials_in_stock: 0,
        vials_initial: 1,
        reconstitution_date: null,
      }],
      dose_escalations: [],
    }, async () => ({ data: 0.1, error: null }))
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('button', { name: /Bereits protokolliert/ }))
    await protokollZeileOeffnen()
    fireEvent.click(await screen.findByRole('button', { name: 'Wieder öffnen' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('reverse_inventory_confirmation', {
      p_dose_log_id: 'completed-vial',
      p_action: 'undo',
    }))
    expect(client.mutations.filter(mutation => (
      mutation.table === 'dose_logs' || mutation.table === 'stack_items'
    ))).toHaveLength(0)
  })

  it('retries generic inventory without confirming an existing dose log twice', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    let inventoryAttempts = 0
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 1,
        unit: 'capsule',
        stack_items: { display_name: 'Vitamin D3', tracking_level: 'complete' },
      }],
      dose_logs: [{
        id: 'pending-1',
        stack_item_id: 'stack-1',
        dose: 1,
        unit: 'capsule',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: null,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Vitamin D3',
        dosage_form: 'capsule',
        tracking_level: 'complete',
      }],
      dose_escalations: [],
    }, async name => {
      if (name === 'apply_inventory_confirmation') {
        inventoryAttempts += 1
        return inventoryAttempts === 1
          ? { data: null, error: { message: 'inventory offline' } }
          : { data: 41, error: null }
      }
      return { data: [{ id: 'saved-log-1' }], error: null }
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('button', { name: 'eingenommen' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Eingenommen' }))

    const retry = await screen.findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(client.mutations.filter(mutation => mutation.table === 'dose_logs')).toHaveLength(1)
    expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'pending-1',
    })

    fireEvent.click(retry)
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    expect(client.mutations.filter(mutation => mutation.table === 'dose_logs')).toHaveLength(1)
  })

  it('applies vial debit through the dose-log inventory RPC without a client stock write', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 1,
        unit: 'mg',
        stack_items: { display_name: 'Peptide', tracking_level: 'complete' },
      }],
      dose_logs: [{
        id: 'pending-1',
        stack_item_id: 'stack-1',
        dose: 1,
        unit: 'mg',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: null,
        stack_items: { display_name: 'Peptide' },
      }],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Peptide',
        dosage_form: 'vial',
        tracking_level: 'complete',
        vial_amount_mg: 10,
        reconstitution_ml: 1,
        vials_in_stock: 2,
        vials_initial: 2,
        reconstitution_date: null,
      }],
      dose_escalations: [],
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('button', { name: 'eingenommen' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Eingenommen' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'pending-1',
    }))
    expect(client.mutations.some(mutation => mutation.table === 'stack_items')).toBe(false)
  })

  it('retries only vial stock after a committed dashboard group', async () => {
    let stockAttempts = 0
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 1,
        unit: 'mg',
        stack_items: { display_name: 'Peptide', tracking_level: 'complete' },
      }],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Peptide',
        dosage_form: 'vial',
        tracking_level: 'complete',
      }],
      dose_escalations: [],
    }, async name => {
      if (name === 'confirm_intake_group') return { data: [{ id: 'saved-vial-log' }], error: null }
      stockAttempts += 1
      return stockAttempts === 1
        ? { data: null, error: { message: 'vial stock offline' } }
        : { data: 0.9, error: null }
    })
    renderDashboard(client)

    await gruppenBestaetigungOeffnen()
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eingenommen' }))

    const retry = await within(dialog).findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)
    fireEvent.click(retry)
    await waitFor(() => expect(stockAttempts).toBe(2))
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)
  })

  it('retries only generic inventory after a committed group confirmation', async () => {
    let inventoryAttempts = 0
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 1,
        unit: 'capsule',
        stack_items: { display_name: 'Vitamin D3', tracking_level: 'complete' },
      }],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Vitamin D3',
        dosage_form: 'capsule',
        tracking_level: 'complete',
      }],
      dose_escalations: [],
    }, async name => {
      if (name === 'confirm_intake_group') {
        return { data: [{ id: 'saved-log-1' }], error: null }
      }
      inventoryAttempts += 1
      return inventoryAttempts === 1
        ? { data: null, error: { message: 'inventory offline' } }
        : { data: 41, error: null }
    })
    renderDashboard(client)

    await gruppenBestaetigungOeffnen()
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eingenommen' }))

    const retry = await within(dialog).findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)

    fireEvent.click(retry)
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)
  })

  it('führt die offenen Einnahmen als Held statt als Reiter mit Karussell', () => {
    const source = readFileSync('src/pages/Dashboard.tsx', 'utf8')

    // Die Tageszeiten bleiben die Ordnung; nur zeigt die Seite sie nicht mehr
    // als Reiter. Die erste, in der etwas offen ist, wird der Held — der Rest
    // steht darunter. Reiter versteckten zwei Drittel des Tages hinter einem
    // Tap, und nach einem Ladevorgang stand der aktive gern auf einer leeren
    // Tageszeit.
    expect(source).toContain("PERIOD_ORDER: PeriodKey[] = ['morgens', 'mittags', 'abends']")
    expect(source).not.toContain('role="tablist"')
    // Eine Liste, genau eine aufgeklappt — und das Aufklappen passiert dort,
    // wo die Einnahme steht, nicht auf einer Bühne oben.
    expect(source).toContain("const [aufgeklappt, setAufgeklappt] = useState<Aufgeklappt>({ art: 'voreingestellt' })")
    expect(source).toContain('slot.key === offenerSlot')
    expect(source).toContain('className="tyd-collapse"')
    expect(source).not.toContain('data-due-hero')
    expect(source).toContain('completedExpanded')
    expect(source).toContain('renderLogRow')
  })

  it('lässt den Helden so hoch sein wie sein Inhalt', () => {
    const source = readFileSync('src/pages/Dashboard.tsx', 'utf8')

    // Die feste Kartenhöhe und das Pfeil-Gerüst gab es nur, damit das
    // Karussell beim Blättern nicht sprang. Ohne Karussell kostet ein kurzer
    // Eintrag keine 188 px mehr, und ein langer Name bricht nicht heraus.
    expect(source).not.toContain('h-[188px]')
    expect(source).not.toContain('IntakePeriodCarousel')
    expect(source).not.toContain('snap-x snap-mandatory')
    expect(source).toContain('[overflow-wrap:anywhere]')
  })

  it('führt die Woche als Streifen und den Monat als Blatt darüber', () => {
    const source = readFileSync('src/pages/Dashboard.tsx', 'utf8')

    // Der Streifen ist Navigation, kein Inhalt: kein eigenes Panel, immer die
    // Woche. Der Monat liegt hinter einem Knopf statt hinter einem Ausklapper.
    expect(source).toContain('const [monatOffen, setMonatOffen] = useState(false)')
    expect(source).toContain('const streifenTage = weekDays')
    expect(source).toContain('changeWeek')
    expect(source).toContain('calendar_open_month')
    expect(source).toContain('aria-modal="true"')
  })

  it('reicht den geplanten Slot-Schluessel durch, statt ihn nachzurechnen', () => {
    const source = readFileSync('src/pages/Dashboard.tsx', 'utf8')
    const confirm = source.slice(
      source.indexOf('const confirmCycleDose = async ('),
      source.indexOf('const openConfirmSheet = ('),
    )
    expect(confirm.length).toBeGreaterThan(500)

    // Genau einmal nachrechnen -- als Rueckfall fuer Einnahmen ohne
    // geplanten Slot (Bei Bedarf). Jede weitere Stelle waere die alte
    // Fassung: ein geplanter 02:30-Slot landet am Tag der Zeitumstellung auf
    // 03:00, und aus dem Zeitpunkt zurueckgelesen hiesse er dann `@03:00` --
    // passt auf keinen Plantag und kollidiert mit einem geplanten 03:00-Slot.
    // Warum die beiden auseinanderlaufen, steht in `slotKey.test.ts`.
    expect(confirm.match(/slotSchluesselFuerZeitpunkt\(/g)).toHaveLength(1)
    expect(confirm).toContain('const slotSchluessel = geplanterSchluessel ?? slotSchluesselFuerZeitpunkt(')
    // Die drei Stellen, die den Schluessel in die Datenbank tragen, nehmen
    // den durchgereichten Wert.
    expect(confirm.match(/(key|routine_slot_key): slotSchluessel,/g)).toHaveLength(3)

    // Und die Liste gibt ihn mit: ohne das kaeme oben immer der Rueckfall an.
    expect(source).toContain('slot.dose, slot.scheduledAt, slot.key)')
  })

  it('kennt jeden Uebersetzungsschluessel der Seite in de und en', () => {
    // Ein `defaultValue` ist deutscher Text. Fehlt der Schluessel in en.json,
    // faellt i18next auf `fallbackLng: 'de'` zurueck -- die englische App
    // zeigt Deutsch, und nichts schlaegt fehl. Genau so standen `verpasst`
    // und `dose_mark_taken` monatelang in beiden Sprachdateien nicht drin.
    const source = readFileSync('src/pages/Dashboard.tsx', 'utf8')
    const de = JSON.parse(readFileSync('src/i18n/locales/de.json', 'utf8')) as Record<string, unknown>
    const en = JSON.parse(readFileSync('src/i18n/locales/en.json', 'utf8')) as Record<string, unknown>

    // Der Schluessel darf alles sein, was i18next erlaubt -- nicht nur
    // Kleinbuchstaben. Sonst rutscht `t('confirmSheetFooter')` an der
    // Pruefung vorbei, weil sie ihn gar nicht erst sieht.
    const schluessel = [...new Set([...source.matchAll(/\bt\(\s*'([^']+)'/g)].map(m => m[1]))]
    expect(schluessel.length).toBeGreaterThan(60)

    // Leer zaehlt nicht als uebersetzt: i18next liefert den leeren String
    // aus (`returnEmptyString` steht per Voreinstellung auf true) statt den
    // `defaultValue` zu nehmen -- die Ueberschrift waere dann schlicht weg.
    const fehlt = (datei: Record<string, unknown>) => schluessel.filter(key => (
      typeof datei[key] !== 'string' || (datei[key] as string).trim() === ''
    ))
    expect(fehlt(de)).toEqual([])
    expect(fehlt(en)).toEqual([])

    // Und kein `t(` mit etwas anderem als einem Literal -- ein
    // zusammengesetzter Schluessel waere hier nicht mehr nachzulesen.
    expect(source.match(/\bt\(\s*[^'\s)]/g)).toBeNull()
  })

  it('haelt das Bestaetigungs-Sheet frei von fest verdrahtetem Deutsch', () => {
    const source = readFileSync('src/pages/Dashboard.tsx', 'utf8')
    const anfang = source.indexOf('{confirmSheet && (')
    expect(anfang).toBeGreaterThan(0)
    const sheet = source.slice(anfang, source.indexOf('</>\n  )\n}', anfang))
    expect(sheet.length).toBeGreaterThan(500)

    // Keine Liste verbotener Woerter -- die faengt nur, was schon einmal
    // schiefging. Der Vertrag ist staerker und einfacher: im Sheet steht
    // ueberhaupt kein Text direkt im JSX. Alles Sichtbare kommt aus einem
    // `{t(...)}`, und ein `defaultValue` faellt nicht darunter, weil er in
    // geschweiften Klammern steht.
    const textknoten = [...sheet.matchAll(/>([^<>{}]*[A-Za-zÄÖÜäöüß][^<>{}]*)</g)]
      .map(treffer => treffer[1].trim())
      .filter(Boolean)
    expect(textknoten, 'Text steht direkt im JSX statt in einem t()').toEqual([])

    for (const key of ['confirm_sheet_title', 'confirm_sheet_hint', 'confirm_sheet_time_label', "t('cancel'", "t('eingenommen'"]) {
      expect(sheet).toContain(key)
    }
  })
})
