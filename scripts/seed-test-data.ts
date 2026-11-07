/**
 * TYD — 6-Jahres-Testdatensatz (rückwirkend bis heute)
 * Ausführen: SEED_EMAIL=… SEED_PASSWORD=… npm run seed:test
 */
import { addDays, addMonths, format, parseISO } from 'date-fns'
import { supabase } from '../src/lib/supabase'

// Zugangsdaten nie ins Repo: SEED_EMAIL=… SEED_PASSWORD=… npm run seed:test
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
if (!EMAIL || !PASSWORD) {
  console.error('❌ SEED_EMAIL und SEED_PASSWORD setzen')
  process.exit(1)
}
const BATCH_SIZE = 500

const TODAY = new Date()
const END_STR = format(TODAY, 'yyyy-MM-dd')
const START = new Date(TODAY)
START.setFullYear(START.getFullYear() - 6)
const START_STR = format(START, 'yyyy-MM-dd')

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function dStr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function eachDay(startStr: string, endStr: string): string[] {
  const days: string[] = []
  let d = parseISO(startStr)
  const end = parseISO(endStr)
  while (d <= end) {
    days.push(dStr(d))
    d = addDays(d, 1)
  }
  return days
}

function pseudo(seed: number): number {
  return ((seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function fail(msg: string): never {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

async function batchInsert<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  label: string,
): Promise<number> {
  if (!rows.length) return 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) fail(`${label} (Batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`)
  }
  return rows.length
}

async function batchUpsertDaily(
  rows: Array<{
    user_id: string
    log_date: string
    energie: number
    schlaf: number
    libido: number
  }>,
): Promise<number> {
  if (!rows.length) return 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('daily_logs')
      .upsert(chunk, { onConflict: 'user_id,log_date', ignoreDuplicates: true })
    if (error) fail(`daily_logs (Batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`)
  }
  return rows.length
}

const WDAY: Record<number, string> = {
  0: 'So', 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa',
}

interface CycleRow {
  user_id: string
  stack_item_id: string
  name: string
  dose: number
  unit: string
  method: string
  frequency: string
  schedule_days: string[]
  x_days_interval: number | null
  start_date: string
  end_date: string | null
  active: boolean
  intake_time: string
  reminder: string
}

interface StackItemDef {
  name: string
  pkNames: string[]
  inventory: {
    batch_number: string
    batch_source: string
    vials_initial: number
    vials_count: number
    mg_per_vial: number
  }
  stackItem: {
    default_dose: number
    default_unit: string
    default_method: string
    vial_amount_mg: number
    reconstitution_ml: number
    expiry_days: number
    notes: string
  }
  cycleTemplate: {
    dose: number
    unit: string
    method: string
    frequency: string
    schedule_days: string[]
    intake_time: string
    reminder: string
  }
  cycleWeeksRange: [number, number]
  pauseWeeksRange: [number, number]
}

const STACK_ITEM_DEFS: StackItemDef[] = [
  {
    name: 'BPC-157',
    pkNames: ['BPC-157'],
    inventory: { batch_number: 'BPC-2020-01', batch_source: 'Swiss Chems', vials_initial: 12, vials_count: 3, mg_per_vial: 5 },
    stackItem: {
      default_dose: 250, default_unit: 'mcg', default_method: 'Subkutan',
      vial_amount_mg: 5, reconstitution_ml: 2, expiry_days: 28,
      notes: 'Heilungspeptid — Gelenke, Darm, Sehnen.',
    },
    cycleTemplate: {
      dose: 250, unit: 'mcg', method: 'Subkutan', frequency: 'Täglich',
      schedule_days: [], intake_time: 'morgens', reminder: 'on_time',
    },
    cycleWeeksRange: [6, 10],
    pauseWeeksRange: [2, 3],
  },
  {
    name: 'TB-500',
    pkNames: ['TB-500'],
    inventory: { batch_number: 'TB-2020-02', batch_source: 'Peptide Sciences', vials_initial: 10, vials_count: 2, mg_per_vial: 5 },
    stackItem: {
      default_dose: 2500, default_unit: 'mcg', default_method: 'Subkutan',
      vial_amount_mg: 5, reconstitution_ml: 1, expiry_days: 28,
      notes: 'Regeneration & Reparatur.',
    },
    cycleTemplate: {
      dose: 2500, unit: 'mcg', method: 'Subkutan', frequency: 'Wochentage wählen',
      schedule_days: ['Mo', 'Do'], intake_time: 'abends', reminder: '2h',
    },
    cycleWeeksRange: [5, 9],
    pauseWeeksRange: [2, 4],
  },
  {
    name: 'Ipamorelin',
    pkNames: ['Ipamorelin'],
    inventory: { batch_number: 'IPA-2021-01', batch_source: 'Core Peptides', vials_initial: 10, vials_count: 4, mg_per_vial: 2 },
    stackItem: {
      default_dose: 200, default_unit: 'mcg', default_method: 'Subkutan',
      vial_amount_mg: 2, reconstitution_ml: 2, expiry_days: 28,
      notes: 'GH-Sekretagog — abends.',
    },
    cycleTemplate: {
      dose: 200, unit: 'mcg', method: 'Subkutan', frequency: 'Täglich',
      schedule_days: [], intake_time: 'abends', reminder: '2h',
    },
    cycleWeeksRange: [8, 12],
    pauseWeeksRange: [2, 3],
  },
  {
    name: 'CJC-1295 DAC',
    pkNames: ['CJC-1295 DAC', 'CJC-1295 with DAC'],
    inventory: { batch_number: 'CJC-2021-02', batch_source: 'Core Peptides', vials_initial: 8, vials_count: 3, mg_per_vial: 2 },
    stackItem: {
      default_dose: 200, default_unit: 'mcg', default_method: 'Subkutan',
      vial_amount_mg: 2, reconstitution_ml: 2, expiry_days: 28,
      notes: 'Lang wirksames GH-Peptid — kombiniert mit Ipamorelin.',
    },
    cycleTemplate: {
      dose: 200, unit: 'mcg', method: 'Subkutan', frequency: 'Wöchentlich',
      schedule_days: [], intake_time: 'abends', reminder: '1day',
    },
    cycleWeeksRange: [4, 8],
    pauseWeeksRange: [3, 4],
  },
  {
    name: 'Semaglutide',
    pkNames: ['Semaglutide', 'Semaglutid'],
    inventory: { batch_number: 'SEMA-2022-01', batch_source: 'Swiss Chems', vials_initial: 6, vials_count: 2, mg_per_vial: 3 },
    stackItem: {
      default_dose: 250, default_unit: 'mcg', default_method: 'Subkutan',
      vial_amount_mg: 3, reconstitution_ml: 1.5, expiry_days: 28,
      notes: 'GLP-1 — Gewichtsmanagement, wöchentlich.',
    },
    cycleTemplate: {
      dose: 250, unit: 'mcg', method: 'Subkutan', frequency: 'Wöchentlich',
      schedule_days: [], intake_time: 'morgens', reminder: '1day',
    },
    cycleWeeksRange: [10, 12],
    pauseWeeksRange: [3, 4],
  },
]

function findPkId(
  profiles: Array<{ id: string; name: string; aliases: string[] }>,
  names: string[],
): string | null {
  for (const lookup of names) {
    const key = lookup.toLowerCase()
    const hit = profiles.find(
      p => p.name.toLowerCase() === key
        || p.aliases.some(a => a.toLowerCase() === key),
    )
    if (hit) return hit.id
  }
  return null
}

function cycleAppliesToDay(cycle: Pick<CycleRow, 'start_date' | 'end_date' | 'frequency' | 'schedule_days'>, dateStr: string): boolean {
  const day = parseISO(dateStr)
  const start = parseISO(cycle.start_date)
  const end = cycle.end_date ? parseISO(cycle.end_date) : null
  if (day < start) return false
  if (end && day > end) return false
  const diff = Math.round((day.getTime() - start.getTime()) / 86_400_000)
  const wd = WDAY[day.getDay()]
  const sd = cycle.schedule_days ?? []
  const f = cycle.frequency
  if (f === 'Täglich') return sd.length ? sd.includes(wd) : true
  if (f === 'Jeden 2. Tag') return diff % 2 === 0
  if (f === '5 Tage an / 2 aus') return diff % 7 < 5
  if (f === 'Mo-Fr') return day.getDay() >= 1 && day.getDay() <= 5
  if (f === 'Wöchentlich') return diff % 7 === 0
  if (f === 'Wochentage wählen') return sd.includes(wd)
  return false
}

function buildPlannedCycles(
  uid: string,
  stackItemId: string,
  def: StackItemDef,
  seedBase: number,
): CycleRow[] {
  const cycles: CycleRow[] = []
  let cursor = parseISO(START_STR)
  const endLimit = parseISO(END_STR)
  let idx = 0
  let seed = seedBase

  while (cursor < endLimit) {
    seed += 17
    const weeksOn =
      def.cycleWeeksRange[0]
      + Math.floor(pseudo(seed) * (def.cycleWeeksRange[1] - def.cycleWeeksRange[0] + 1))
    const weeksPause =
      def.pauseWeeksRange[0]
      + Math.floor(pseudo(seed + 3) * (def.pauseWeeksRange[1] - def.pauseWeeksRange[0] + 1))

    const startDate = dStr(cursor)
    const cycleEnd = addDays(cursor, weeksOn * 7 - 1)
    const cappedEnd = cycleEnd > endLimit ? endLimit : cycleEnd
    const endDateStr = dStr(cappedEnd)
    const isLast = addDays(cappedEnd, weeksPause * 7 + 1) >= endLimit

    cycles.push({
      user_id: uid,
      stack_item_id: stackItemId,
      name: `${def.name} · Zyklus ${idx + 1}`,
      dose: def.cycleTemplate.dose,
      unit: def.cycleTemplate.unit,
      method: def.cycleTemplate.method,
      frequency: def.cycleTemplate.frequency,
      schedule_days: [...def.cycleTemplate.schedule_days],
      x_days_interval: null,
      start_date: startDate,
      end_date: isLast ? null : endDateStr,
      active: isLast,
      intake_time: def.cycleTemplate.intake_time,
      reminder: def.cycleTemplate.reminder,
    })

    idx++
    cursor = addDays(cappedEnd, weeksPause * 7 + 1)
    if (isLast) break
  }

  return cycles
}

function buildDoseLogsForCycle(
  uid: string,
  cycle: CycleRow,
  stackItemId: string,
  existingKeys: Set<string>,
): Array<Record<string, unknown>> {
  const logs: Array<Record<string, unknown>> = []
  const endStr = cycle.end_date ?? END_STR
  const timeKey = cycle.intake_time.split(',')[0]
  const hour = timeKey === 'abends' ? 20 : timeKey === 'mittags' ? 12 : 8
  let seed = stackItemId.charCodeAt(0) * 31 + cycle.start_date.replace(/-/g, '').length

  for (const dateStr of eachDay(cycle.start_date, endStr)) {
    seed++
    if (!cycleAppliesToDay(cycle, dateStr)) continue

    const key = `${stackItemId}|${dateStr}`
    if (existingKeys.has(key)) continue

    const r = pseudo(seed + 500)
    let taken: boolean | null
    if (r < 0.85) taken = true
    else if (r < 0.95) taken = false
    else taken = null

    const min = Math.floor(pseudo(seed + 900) * 45)
    logs.push({
      user_id: uid,
      stack_item_id: stackItemId,
      dose: cycle.dose,
      unit: cycle.unit,
      method: cycle.method,
      logged_at: `${dateStr}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000Z`,
      taken,
    })
    existingKeys.add(key)
  }

  return logs
}

function isOnAnyCycle(dateStr: string, cycles: CycleRow[]): boolean {
  return cycles.some(c => cycleAppliesToDay(c, dateStr))
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📅 Zeitraum: ${START_STR} → ${END_STR} (6 Jahre)\n`)

  const { data: authData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (loginErr) fail(`Login: ${loginErr.message}`)

  const uid = authData.user!.id
  console.log(`✓ Eingeloggt als ${EMAIL}`)
  console.log(`  user_id: ${uid}\n`)

  const { data: pkRows, error: pkErr } = await supabase
    .from('pk_profiles')
    .select('id, name, aliases')
  if (pkErr) fail(`pk_profiles laden: ${pkErr.message}`)

  const pkProfiles = (pkRows ?? []) as Array<{ id: string; name: string; aliases: string[] }>

  // ── Inventar & Stack-Objekte (nur wenn noch nicht vorhanden) ─────────────────────
  const { data: existingInv } = await supabase
    .from('inventory_items')
    .select('id, name')
    .eq('user_id', uid)

  const { data: existingStackItems } = await supabase
    .from('stack_items')
    .select('id, display_name, inventory_item_id')
    .eq('user_id', uid)

  const invByName = new Map((existingInv ?? []).map(i => [i.name, i.id]))
  const stackItemByName = new Map((existingStackItems ?? []).map(item => [item.display_name, item.id]))

  let invCreated = 0
  let stackItemCreated = 0

  for (const def of STACK_ITEM_DEFS) {
    const pkId = findPkId(pkProfiles, def.pkNames)

    if (!invByName.has(def.name)) {
      const { data: invRow, error: invInsErr } = await supabase
        .from('inventory_items')
        .insert({
          user_id: uid,
          name: def.name,
          batch_number: def.inventory.batch_number,
          batch_source: def.inventory.batch_source,
          vials_count: def.inventory.vials_count,
          vials_initial: def.inventory.vials_initial,
          mg_per_vial: def.inventory.mg_per_vial,
          pk_profile_id: pkId,
        })
        .select('id')
        .single()
      if (invInsErr) fail(`Inventar ${def.name}: ${invInsErr.message}`)
      invByName.set(def.name, invRow!.id)
      invCreated++
    }

    if (!stackItemByName.has(def.name)) {
      const invId = invByName.get(def.name)!
      const reconstDate = dStr(addDays(TODAY, -14 - stackItemCreated * 3))
      const { data: stackItemRow, error: stackItemSaveErr } = await supabase
        .rpc('save_stack_item', {
          p_item: {
            id: null,
            display_name: def.name,
            category: 'peptide',
            dosage_form: 'vial',
            brand: null,
            color_hex: null,
            notes: def.stackItem.notes,
          },
          p_ingredients: [{
            catalog_substance_id: null,
            custom_name: def.name,
            amount_value: def.stackItem.vial_amount_mg,
            amount_unit: 'mg',
            basis_value: 1,
            basis_unit: 'vial',
            position: 0,
          }],
        })
      if (stackItemSaveErr || !stackItemRow) {
        fail(`Stack-Objekt ${def.name}: ${stackItemSaveErr?.message ?? 'No data returned'}`)
      }

      const stackItemId = (stackItemRow as { id: string }).id
      const { error: stackItemUpdateErr } = await supabase
        .from('stack_items')
        .update({
          display_name: def.name,
          default_unit: def.stackItem.default_unit,
          default_dose: def.stackItem.default_dose,
          default_method: def.stackItem.default_method,
          vial_amount_mg: def.stackItem.vial_amount_mg,
          reconstitution_ml: def.stackItem.reconstitution_ml,
          syringe_type: '1:100',
          vials_in_stock: def.inventory.vials_count,
          vials_initial: def.inventory.vials_initial,
          reconstitution_date: reconstDate,
          expiry_days: def.stackItem.expiry_days,
          batch_number: def.inventory.batch_number,
          batch_source: def.inventory.batch_source,
          inventory_item_id: invId,
          pk_profile_id: pkId,
        })
        .eq('id', stackItemId)
      if (stackItemUpdateErr) fail(`Stack-Objekt ${def.name}: ${stackItemUpdateErr.message}`)

      stackItemByName.set(def.name, stackItemId)
      stackItemCreated++
    }
  }

  if (invCreated > 0) console.log(`✅ Inventar angelegt (${invCreated} neue Posten)`)
  else console.log('✓ Inventar bereits vorhanden — übersprungen')

  if (stackItemCreated > 0) console.log(`✅ Substanzen angelegt (${stackItemCreated} neue)`)
  else console.log('✓ Substanzen bereits vorhanden — übersprungen')

  // ── Zyklen ───────────────────────────────────────────────────────────────
  const { data: existingCycles } = await supabase
    .from('cycles')
    .select('id, stack_item_id, start_date')
    .eq('user_id', uid)

  const existingCycleKeys = new Set(
    (existingCycles ?? []).map(c => `${c.stack_item_id}|${c.start_date}`),
  )

  const cyclesToInsert: CycleRow[] = []
  for (let i = 0; i < STACK_ITEM_DEFS.length; i++) {
    const def = STACK_ITEM_DEFS[i]
    const stackItemId = stackItemByName.get(def.name)
    if (!stackItemId) continue
    const planned = buildPlannedCycles(uid, stackItemId, def, 1000 + i * 137)
    for (const c of planned) {
      const key = `${c.stack_item_id}|${c.start_date}`
      if (!existingCycleKeys.has(key)) {
        cyclesToInsert.push(c)
        existingCycleKeys.add(key)
      }
    }
  }

  const cyclesInserted = await batchInsert('cycles', cyclesToInsert, 'Zyklen')
  if (cyclesInserted > 0) console.log(`✅ Zyklen eingefügt (${cyclesInserted})`)
  else console.log('✓ Zyklen bereits vollständig — keine neuen')

  const { data: allCycles } = await supabase
    .from('cycles')
    .select('*')
    .eq('user_id', uid)

  const cycleRows = ((allCycles ?? []) as CycleRow[]).filter(c => {
    const end = c.end_date ?? END_STR
    return c.start_date <= END_STR && end >= START_STR
  })

  // ── dose_logs ────────────────────────────────────────────────────────────
  const { data: existingLogs } = await supabase
    .from('dose_logs')
    .select('stack_item_id, logged_at')
    .eq('user_id', uid)
    .gte('logged_at', `${START_STR}T00:00:00Z`)
    .lte('logged_at', `${END_STR}T23:59:59Z`)

  const doseLogKeys = new Set(
    (existingLogs ?? []).map(l => `${l.stack_item_id}|${String(l.logged_at).slice(0, 10)}`),
  )

  const allDoseLogs: Array<Record<string, unknown>> = []
  for (const cycle of cycleRows) {
    allDoseLogs.push(...buildDoseLogsForCycle(uid, cycle, cycle.stack_item_id, doseLogKeys))
  }

  const doseCount = await batchInsert('dose_logs', allDoseLogs, 'dose_logs')
  console.log(`✅ ${doseCount} dose_logs eingefügt`)

  // ── daily_logs ───────────────────────────────────────────────────────────
  const { data: existingDaily } = await supabase
    .from('daily_logs')
    .select('log_date')
    .eq('user_id', uid)
    .gte('log_date', START_STR)
    .lte('log_date', END_STR)

  const existingDailyDates = new Set((existingDaily ?? []).map(d => d.log_date))

  const dailyRows: Array<{
    user_id: string
    log_date: string
    energie: number
    schlaf: number
    libido: number
  }> = []

  let daySeed = 42
  for (const dateStr of eachDay(START_STR, END_STR)) {
    if (existingDailyDates.has(dateStr)) continue
    daySeed++
    const onCycle = isOnAnyCycle(dateStr, cycleRows)
    const base = onCycle ? 3.6 : 2.8
    const spread = onCycle ? 1.2 : 1.0
    dailyRows.push({
      user_id: uid,
      log_date: dateStr,
      energie: clamp(base + (pseudo(daySeed) - 0.5) * spread * 2, 2, 5),
      schlaf: clamp(base + (pseudo(daySeed + 11) - 0.5) * spread * 2, 2, 5),
      libido: clamp(base + (pseudo(daySeed + 23) - 0.5) * spread * 1.6, 2, 5),
    })
  }

  const dailyCount = await batchUpsertDaily(dailyRows)
  if (dailyCount > 0) console.log(`✅ ${dailyCount} daily_logs eingefügt`)
  else console.log('✓ daily_logs bereits vollständig')

  // ── Blutwerte (alle 2–3 Monate) ──────────────────────────────────────────
  const { data: existingBw } = await supabase
    .from('bloodwork')
    .select('tested_at')
    .eq('user_id', uid)

  const existingBwDates = new Set((existingBw ?? []).map(b => b.tested_at))

  const bloodMarkers = [
    { marker: 'IGF-1', unit: 'ng/mL', base: 175, trend: 1.08 },
    { marker: 'Testosteron', unit: 'ng/dL', base: 380, trend: 1.02 },
    { marker: 'CRP', unit: 'mg/L', base: 2.5, trend: 0.92 },
    { marker: 'Vitamin D', unit: 'ng/mL', base: 22, trend: 1.05 },
    { marker: 'Insulin', unit: 'µIU/mL', base: 9.0, trend: 0.95 },
  ]

  const bloodRows: Array<Record<string, unknown>> = []
  let panelIdx = 0
  for (let d = parseISO(START_STR); d <= TODAY; d = addMonths(d, 2 + Math.floor(pseudo(panelIdx) * 2))) {
    panelIdx++
    const testedAt = dStr(d)
    if (existingBwDates.has(testedAt)) continue
    const progress = panelIdx / 30
    for (const m of bloodMarkers) {
      const value = Math.round(m.base * Math.pow(m.trend, progress) * 10) / 10
      bloodRows.push({
        user_id: uid,
        tested_at: testedAt,
        marker: m.marker,
        value,
        unit: m.unit,
        notes: panelIdx === 1 ? 'Baseline' : null,
      })
    }
    existingBwDates.add(testedAt)
  }

  const bwCount = await batchInsert('bloodwork', bloodRows, 'bloodwork')
  if (bwCount > 0) console.log(`✅ ${bwCount} Blutwert-Einträge eingefügt`)
  else console.log('✓ Blutwerte bereits vorhanden')

  // ── Gewicht (alle 2–3 Monate) ────────────────────────────────────────────
  const { data: existingWl } = await supabase
    .from('weight_logs')
    .select('logged_at')
    .eq('user_id', uid)

  const existingWlDates = new Set(
    (existingWl ?? []).map(w => String(w.logged_at).slice(0, 10)),
  )

  const weightStart = 92
  const weightEnd = 81
  const weightRows: Array<Record<string, unknown>> = []
  let wIdx = 0
  for (let d = parseISO(START_STR); d <= TODAY; d = addMonths(d, 2 + Math.floor(pseudo(wIdx + 50) * 2))) {
    const loggedAt = dStr(d)
    if (existingWlDates.has(loggedAt)) { wIdx++; continue }
    wIdx++
    const t = wIdx / 28
    const eased = t < 0.2 ? t * 0.4 : 0.08 + (t - 0.2) * 1.1
    const w = Math.round((weightStart - Math.min(eased, 1) * (weightStart - weightEnd)) * 10) / 10
    weightRows.push({
      user_id: uid,
      logged_at: `${loggedAt}T08:00:00.000Z`,
      weight_kg: w,
      notes: wIdx === 1 ? 'Startgewicht' : null,
    })
    existingWlDates.add(loggedAt)
  }

  const wlCount = await batchInsert('weight_logs', weightRows, 'weight_logs')
  if (wlCount > 0) console.log(`✅ ${wlCount} weight_logs eingefügt`)
  else console.log('✓ Gewichts-Logs bereits vorhanden')

  console.log('\n🎉 6-Jahres-Testdatensatz abgeschlossen')
  console.log(`   → ${STACK_ITEM_DEFS.length} Substanzen (Inventar + PK-Verknüpfung)`)
  console.log(`   → ${cycleRows.length} Zyklen im Zeitraum`)
  console.log(`   → ${doseCount} Dosis-Logs`)
  console.log(`   → daily_logs, Blutwerte & Gewicht ergänzt`)
}

main().catch(err => {
  console.error('❌ Unerwarteter Fehler:', err instanceof Error ? err.message : err)
  process.exit(1)
})
