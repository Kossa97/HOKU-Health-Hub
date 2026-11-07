// TYD — Test-Datensatz (6 Monate rückwirkend, alle Features)
// Ausführen: SEED_EMAIL=… SEED_PASSWORD=… node scripts/seed-test-data.mjs
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://xcskcojakolphtbuqfbw.supabase.co'
const SUPABASE_KEY  = 'sb_publishable_yeAVlq8miTc20FLsPqKCwQ_xAGKHLV1'
// Zugangsdaten nie ins Repo: SEED_EMAIL=… SEED_PASSWORD=… node scripts/…
const EMAIL         = process.env.SEED_EMAIL
const PASSWORD      = process.env.SEED_PASSWORD
if (!EMAIL || !PASSWORD) { console.error('❌ SEED_EMAIL und SEED_PASSWORD setzen'); process.exit(1) }
const TODAY         = '2026-05-22' // Logs bis gestern

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Einloggen ───────────────────────────────────────────────────────────────
const { data: { user }, error: loginErr } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (loginErr) { console.error('❌ Login fehlgeschlagen:', loginErr.message); process.exit(1) }
const uid = user.id
console.log('✓ Eingeloggt:', uid)

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function dStr(d) { return d.toISOString().split('T')[0] }

function eachDay(startStr, endStr) {
  const days = []
  const d = new Date(startStr + 'T00:00:00Z')
  const end = new Date(endStr + 'T00:00:00Z')
  while (d <= end) { days.push(dStr(d)); d.setUTCDate(d.getUTCDate() + 1) }
  return days
}

// Deterministisches Pseudo-Zufall damit Daten natürlich aussehen
function pseudo(seed) { return ((seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff }

function cycleAppliesToDay(cycle, dateStr) {
  const WDAY = { 0:'So', 1:'Mo', 2:'Di', 3:'Mi', 4:'Do', 5:'Fr', 6:'Sa' }
  const day = new Date(dateStr + 'T00:00:00Z')
  const start = new Date(cycle.start_date + 'T00:00:00Z')
  const end = cycle.end_date ? new Date(cycle.end_date + 'T00:00:00Z') : null
  if (day < start) return false
  if (end && day > end) return false
  const diff = Math.round((day - start) / 86400000)
  const wd = WDAY[day.getUTCDay()]
  const sd = cycle.schedule_days ?? []
  const f = cycle.frequency
  if (f === 'Täglich')           return sd.length ? sd.includes(wd) : true
  if (f === 'Jeden 2. Tag')      return diff % 2 === 0
  if (f === '5 Tage an / 2 aus') return diff % 7 < 5
  if (f === 'Mo-Fr')             return day.getUTCDay() >= 1 && day.getUTCDay() <= 5
  if (f === 'Wöchentlich')       return diff % 7 === 0
  if (f === 'Wochentage wählen') return sd.includes(wd)
  return false
}

function effectiveDose(baseDose, escalations, dateStr, cycleStart) {
  const day = new Date(dateStr + 'T00:00:00Z')
  const start = new Date(cycleStart + 'T00:00:00Z')
  const diff = Math.round((day - start) / 86400000)
  let dose = baseDose
  for (const e of escalations) {
    if (e.start_type === 'after_days' && diff >= e.start_after_days) dose += e.increase_amount
    else if (e.start_type === 'date' && day >= new Date(e.start_date + 'T00:00:00Z')) dose += e.increase_amount
  }
  return dose
}

function buildLogs(cycle, cycleEscalations, stackItemId, takenRate = 0.88) {
  const endStr = cycle.end_date ?? TODAY
  const logs = []
  let seed = stackItemId.charCodeAt(0) * 31 + cycle.start_date.replace(/-/g,'') * 1
  const timeKey = (cycle.intake_time ?? 'morgens').split(',')[0]
  const hour = timeKey === 'abends' ? 19 : timeKey === 'mittags' ? 12 : 8
  for (const dateStr of eachDay(cycle.start_date, endStr)) {
    seed++
    if (!cycleAppliesToDay(cycle, dateStr)) continue
    const p0 = pseudo(seed)
    const p1 = pseudo(seed + 1000)
    if (p0 < 0.04) continue // 4% kein Eintrag
    const taken = p1 < takenRate
    const min = Math.floor(pseudo(seed + 2000) * 45)
    const dose = effectiveDose(cycle.dose, cycleEscalations, dateStr, cycle.start_date)
    logs.push({
      user_id: uid, stack_item_id: stackItemId,
      dose, unit: cycle.unit, method: cycle.method,
      logged_at: `${dateStr}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00Z`,
      taken,
    })
  }
  return logs
}

// ─── Bestehende Daten löschen ────────────────────────────────────────────────
console.log('🗑  Lösche bestehende Daten...')
await sb.from('dose_escalations').delete().eq('user_id', uid)
await sb.from('dose_logs').delete().eq('user_id', uid)
await sb.from('effects').delete().eq('user_id', uid)
await sb.from('reviews').delete().eq('user_id', uid)
await sb.from('cycles').delete().eq('user_id', uid)
await sb.from('stack_items').delete().eq('user_id', uid)
// inventory_items könnte FK-Fehler geben wenn Stack-Objekte noch referenzieren → deshalb danach
const { error: invDelErr } = await sb.from('inventory_items').delete().eq('user_id', uid)
if (invDelErr) console.warn('  inventory_items löschen:', invDelErr.message)
console.log('✓ Bereinigt')

// ─── Profil ───────────────────────────────────────────────────────────────────
await sb.from('profiles').upsert({
  id: uid,
  display_name: 'Max Testmann',
  age: 32, weight_kg: 82.5, height_cm: 181.0, gender: 'männlich',
  notes: 'Test-Account — TYD App-Entwicklung. Kein echtes Protokoll.',
  is_public: true, public_bio: 'Biohacker. Fokus auf Regeneration & Performance.',
  share_peptide: true, share_kalender: true,
  share_tagebuch: true, share_bewertungen: true,
}, { onConflict: 'id', ignoreDuplicates: false })
console.log('✓ Profil')

// ─── Inventar ─────────────────────────────────────────────────────────────────
const { data: inv, error: invErr } = await sb.from('inventory_items').insert([
  { user_id: uid, name: 'BPC-157',    batch_number: 'BPC2025-001', batch_source: 'Swiss Chems',       vials_count: 2, vials_initial: 10, mg_per_vial: 5, created_at: '2025-11-20T10:00:00Z' },
  { user_id: uid, name: 'TB-500',     batch_number: 'TB2025-001',  batch_source: 'Peptide Sciences',  vials_count: 2, vials_initial:  8, mg_per_vial: 5, created_at: '2025-11-20T10:00:00Z' },
  { user_id: uid, name: 'Ipamorelin', batch_number: 'IPA2026-001', batch_source: 'Core Peptides',     vials_count: 4, vials_initial: 10, mg_per_vial: 2, created_at: '2026-01-20T10:00:00Z' },
  { user_id: uid, name: 'CJC-1295',   batch_number: 'CJC2026-001', batch_source: 'Core Peptides',     vials_count: 5, vials_initial:  8, mg_per_vial: 2, created_at: '2026-01-20T10:00:00Z' },
  { user_id: uid, name: 'Semaglutid', batch_number: 'SEMA2025-001',batch_source: 'Swiss Chems',       vials_count: 2, vials_initial:  5, mg_per_vial: 3, created_at: '2025-11-28T10:00:00Z' },
  { user_id: uid, name: 'Selank',     batch_number: 'SEL2026-001', batch_source: 'Peptide Sciences',  vials_count: 5, vials_initial:  6, mg_per_vial: 5, created_at: '2026-03-20T10:00:00Z' },
]).select()
if (invErr) { console.error('❌ Inventar:', invErr.message); process.exit(1) }
const INV = Object.fromEntries(inv.map(i => [i.name, i.id]))
console.log('✓ Inventar (6 Posten)')

// ─── Stack-Objekte ──────────────────────────────────────────────────────────────────
const stackItemSeeds = [
  {
    display_name: 'BPC-157', category: 'peptide', dosage_form: 'vial',
    amount_value: 5, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial',
    default_unit: 'mcg', default_dose: 250, default_method: 'Subkutan',
    vial_amount_mg: 5, reconstitution_ml: 2, syringe_type: '1:100',
    vials_in_stock: 2, vials_initial: 8,
    reconstitution_date: '2026-05-10', expiry_days: 28,
    batch_number: 'BPC2025-001', batch_source: 'Swiss Chems',
    inventory_item_id: INV['BPC-157'],
    notes: 'Heilungspeptid — Gelenke, Darm, Sehnen.',
  },
  {
    display_name: 'TB-500', category: 'peptide', dosage_form: 'vial',
    amount_value: 5, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial',
    default_unit: 'mcg', default_dose: 2500, default_method: 'Subkutan',
    vial_amount_mg: 5, reconstitution_ml: 1, syringe_type: '1:100',
    vials_in_stock: 2, vials_initial: 6,
    reconstitution_date: '2026-05-01', expiry_days: 28,
    batch_number: 'TB2025-001', batch_source: 'Peptide Sciences',
    inventory_item_id: INV['TB-500'],
    notes: 'Muscle Repair & Ausdauer.',
  },
  {
    display_name: 'Ipamorelin', category: 'peptide', dosage_form: 'vial',
    amount_value: 2, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial',
    default_unit: 'mcg', default_dose: 100, default_method: 'Subkutan',
    vial_amount_mg: 2, reconstitution_ml: 2, syringe_type: '1:100',
    vials_in_stock: 4, vials_initial: 8,
    reconstitution_date: '2026-05-15', expiry_days: 28,
    batch_number: 'IPA2026-001', batch_source: 'Core Peptides',
    inventory_item_id: INV['Ipamorelin'],
    notes: 'GH-Sekretagog — abends vor dem Schlafen.',
  },
  {
    display_name: 'CJC-1295', category: 'peptide', dosage_form: 'vial',
    amount_value: 2, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial',
    default_unit: 'mcg', default_dose: 100, default_method: 'Subkutan',
    vial_amount_mg: 2, reconstitution_ml: 2, syringe_type: '1:100',
    vials_in_stock: 5, vials_initial: 7,
    reconstitution_date: '2026-05-15', expiry_days: 28,
    batch_number: 'CJC2026-001', batch_source: 'Core Peptides',
    inventory_item_id: INV['CJC-1295'],
    notes: 'Immer mit Ipamorelin kombiniert.',
  },
  {
    display_name: 'Semaglutid', category: 'peptide', dosage_form: 'vial',
    amount_value: 3, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial',
    default_unit: 'mcg', default_dose: 750, default_method: 'Subkutan',
    vial_amount_mg: 3, reconstitution_ml: 1.5, syringe_type: '1:100',
    vials_in_stock: 2, vials_initial: 4,
    reconstitution_date: '2026-04-20', expiry_days: 28,
    batch_number: 'SEMA2025-001', batch_source: 'Swiss Chems',
    inventory_item_id: INV['Semaglutid'],
    notes: 'GLP-1 — wöchentlich montags, Dosis eskaliert.',
  },
  {
    display_name: 'Selank', category: 'peptide', dosage_form: 'nasal_spray',
    amount_value: 250, amount_unit: 'mcg', basis_value: 1, basis_unit: 'spray',
    default_unit: 'mcg', default_dose: 250, default_method: 'Nasal',
    vial_amount_mg: 5, reconstitution_ml: 5, syringe_type: '1:100',
    vials_in_stock: 5, vials_initial: 6,
    reconstitution_date: '2026-03-20', expiry_days: 90,
    batch_number: 'SEL2026-001', batch_source: 'Peptide Sciences',
    inventory_item_id: INV['Selank'],
    notes: 'Nootropikum — nasal, morgens.',
  },
 ]

const stackItems = []
for (const seed of stackItemSeeds) {
  const {
    display_name, category, dosage_form, notes,
    amount_value, amount_unit, basis_value, basis_unit,
    ...trackingFields
  } = seed
  const { data: stackItem, error: stackItemSaveErr } = await sb.rpc('save_stack_item', {
    p_item: {
      id: null,
      display_name,
      category,
      dosage_form,
      brand: null,
      color_hex: null,
      notes,
    },
    p_ingredients: [{
      catalog_substance_id: null,
      custom_name: display_name,
      amount_value,
      amount_unit,
      basis_value,
      basis_unit,
      position: 0,
    }],
  })
  if (stackItemSaveErr || !stackItem) {
    console.error('❌ Stack-Objekt:', stackItemSaveErr?.message ?? 'No data returned')
    process.exit(1)
  }

  const { error: stackItemUpdateErr } = await sb
    .from('stack_items')
    .update(trackingFields)
    .eq('id', stackItem.id)
  if (stackItemUpdateErr) { console.error('❌ Stack-Objekt:', stackItemUpdateErr.message); process.exit(1) }
  stackItems.push(stackItem)
}

const STACK_ITEM_IDS = Object.fromEntries(stackItems.map(item => [item.display_name, item.id]))
console.log('✓ Substanzen (6 Stück)')

// ─── Zyklen ───────────────────────────────────────────────────────────────────
const cyclesData = [
  // Abgeschlossene Zyklen (6 Monate Heilungsphase)
  {
    user_id: uid, stack_item_id: STACK_ITEM_IDS['BPC-157'],
    name: 'Heilungszyklus', dose: 250, unit: 'mcg', method: 'Subkutan',
    frequency: 'Täglich', schedule_days: [], start_date: '2025-11-23', end_date: '2026-02-20', active: false,
    intake_time: 'morgens', reminder: 'on_time',
  },
  {
    user_id: uid, stack_item_id: STACK_ITEM_IDS['TB-500'],
    name: 'Reparatur-Protokoll', dose: 2500, unit: 'mcg', method: 'Subkutan',
    frequency: 'Wochentage wählen', schedule_days: ['Mo','Do'], start_date: '2025-11-23', end_date: '2026-02-20', active: false,
    intake_time: 'abends', reminder: '2h',
  },
  // Aktive Zyklen
  {
    user_id: uid, stack_item_id: STACK_ITEM_IDS['BPC-157'],
    name: 'Maintenance', dose: 250, unit: 'mcg', method: 'Subkutan',
    frequency: 'Täglich', schedule_days: [], start_date: '2026-02-21', end_date: null, active: true,
    intake_time: 'morgens', reminder: 'on_time',
  },
  {
    user_id: uid, stack_item_id: STACK_ITEM_IDS['Ipamorelin'],
    name: 'Nacht-Stack', dose: 100, unit: 'mcg', method: 'Subkutan',
    frequency: 'Täglich', schedule_days: [], start_date: '2026-01-23', end_date: null, active: true,
    intake_time: 'abends', reminder: '2h',
  },
  {
    user_id: uid, stack_item_id: STACK_ITEM_IDS['CJC-1295'],
    name: 'GH-Stack', dose: 100, unit: 'mcg', method: 'Subkutan',
    frequency: 'Täglich', schedule_days: [], start_date: '2026-01-23', end_date: null, active: true,
    intake_time: 'abends', reminder: '2h',
  },
  {
    user_id: uid, stack_item_id: STACK_ITEM_IDS['Semaglutid'],
    name: 'Gewichtsprotokoll', dose: 250, unit: 'mcg', method: 'Subkutan',
    frequency: 'Wöchentlich', schedule_days: [], start_date: '2025-12-01', end_date: null, active: true,
    intake_time: 'morgens', reminder: '1day',
  },
  {
    user_id: uid, stack_item_id: STACK_ITEM_IDS['Selank'],
    name: 'Fokus-Protokoll', dose: 250, unit: 'mcg', method: 'Nasal',
    frequency: 'Täglich', schedule_days: [], start_date: '2026-03-23', end_date: null, active: true,
    intake_time: 'morgens', reminder: 'none',
  },
]

const { data: cycs, error: cycErr } = await sb.from('cycles').insert(cyclesData).select()
if (cycErr) { console.error('❌ Zyklen:', cycErr.message); process.exit(1) }
const CYC = Object.fromEntries(cycs.map(c => [c.name, c]))
console.log('✓ Zyklen (7 Stück)')

// ─── Dosis-Eskalationen (Semaglutid) ─────────────────────────────────────────
const semaId = CYC['Gewichtsprotokoll'].id
const { error: escErr } = await sb.from('dose_escalations').insert([
  { user_id: uid, cycle_id: semaId, increase_amount: 250, unit: 'mcg', start_type: 'after_days', start_after_days: 28, notes: 'Auftitrierung auf 500 mcg' },
  { user_id: uid, cycle_id: semaId, increase_amount: 250, unit: 'mcg', start_type: 'after_days', start_after_days: 56, notes: 'Auftitrierung auf 750 mcg' },
])
if (escErr) console.warn('⚠ Eskalationen:', escErr.message)
else console.log('✓ Dosis-Eskalationen (Semaglutid)')

// ─── Dosis-Logs generieren ────────────────────────────────────────────────────
const semaEsc = [
  { start_type: 'after_days', start_after_days: 28, increase_amount: 250 },
  { start_type: 'after_days', start_after_days: 56, increase_amount: 250 },
]

const allLogs = [
  ...buildLogs(CYC['Heilungszyklus'],      [],      STACK_ITEM_IDS['BPC-157']),
  ...buildLogs(CYC['Reparatur-Protokoll'], [],      STACK_ITEM_IDS['TB-500']),
  ...buildLogs(CYC['Maintenance'],         [],      STACK_ITEM_IDS['BPC-157']),
  ...buildLogs(CYC['Nacht-Stack'],         [],      STACK_ITEM_IDS['Ipamorelin']),
  ...buildLogs(CYC['GH-Stack'],            [],      STACK_ITEM_IDS['CJC-1295']),
  ...buildLogs(CYC['Gewichtsprotokoll'],   semaEsc, STACK_ITEM_IDS['Semaglutid'], 0.92),
  ...buildLogs(CYC['Fokus-Protokoll'],     [],      STACK_ITEM_IDS['Selank'], 0.85),
]

// Supabase in Chunks à 200 einfügen
const CHUNK = 200
for (let i = 0; i < allLogs.length; i += CHUNK) {
  const { error: logErr } = await sb.from('dose_logs').insert(allLogs.slice(i, i + CHUNK))
  if (logErr) { console.error('❌ dose_logs chunk:', logErr.message); process.exit(1) }
}
console.log(`✓ Dosis-Logs (${allLogs.length} Einträge)`)

// ─── Tagebuch-Einträge (Effects) ──────────────────────────────────────────────
const effectsData = [
  // BPC-157 Heilungsphase
  { occurred_at: '2025-11-28T09:15:00Z', stack_item_id: STACK_ITEM_IDS['BPC-157'], type: 'side_effect', description: 'Leichte Rötung an der Einstichstelle', severity: 2, status: 'abgeklungen', duration: '2 Stunden', notes: 'Normal bei Neustart.' },
  { occurred_at: '2025-12-05T08:30:00Z', stack_item_id: STACK_ITEM_IDS['BPC-157'], type: 'effect',      description: 'Knieschmerzen deutlich reduziert', severity: 4, status: 'anhaltend', duration: 'dauerhaft', notes: 'Bereits nach 2 Wochen merkbar.' },
  { occurred_at: '2025-12-15T08:00:00Z', stack_item_id: STACK_ITEM_IDS['BPC-157'], type: 'effect',      description: 'Verbesserte Gelenkbeweglichkeit', severity: 4, status: 'anhaltend', notes: 'Schulter deutlich besser.' },
  { occurred_at: '2026-01-04T08:20:00Z', stack_item_id: STACK_ITEM_IDS['BPC-157'], type: 'effect',      description: 'Schnellere Wundheilung', severity: 5, status: 'eingetreten', duration: 'dauerhaft', notes: 'Kleine Schnittwunde in 3 Tagen verheilt.' },
  { occurred_at: '2026-01-20T08:00:00Z', stack_item_id: STACK_ITEM_IDS['BPC-157'], type: 'effect',      description: 'Verbesserter Darm — kein Blähungsgefühl mehr', severity: 3, status: 'anhaltend' },

  // TB-500
  { occurred_at: '2025-11-27T20:30:00Z', stack_item_id: STACK_ITEM_IDS['TB-500'], type: 'side_effect', description: 'Müdigkeit ca. 1 Stunde nach Injektion', severity: 2, status: 'abgeklungen', duration: '1 Stunde' },
  { occurred_at: '2025-12-08T08:00:00Z', stack_item_id: STACK_ITEM_IDS['TB-500'], type: 'effect',      description: 'Muskelkater nach Training stark reduziert', severity: 4, status: 'anhaltend', notes: 'DOMs fast verschwunden.' },
  { occurred_at: '2025-12-22T08:00:00Z', stack_item_id: STACK_ITEM_IDS['TB-500'], type: 'effect',      description: 'Verbesserte Ausdauer beim Laufen', severity: 3, status: 'anhaltend' },
  { occurred_at: '2026-01-10T08:00:00Z', stack_item_id: STACK_ITEM_IDS['TB-500'], type: 'effect',      description: 'Schultersehne deutlich weniger schmerzhaft', severity: 5, status: 'anhaltend', duration: 'dauerhaft' },

  // Ipamorelin + CJC-1295
  { occurred_at: '2026-01-25T21:00:00Z', stack_item_id: STACK_ITEM_IDS['Ipamorelin'], type: 'side_effect', description: 'Kribbeln/Flush kurz nach Injektion', severity: 1, status: 'abgeklungen', duration: '10 Minuten', notes: 'GH-Release typisch.' },
  { occurred_at: '2026-01-30T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Ipamorelin'], type: 'effect',      description: 'Tiefer, erholsamer Schlaf', severity: 5, status: 'anhaltend', duration: 'dauerhaft', notes: 'Beste Schlafqualität seit Jahren.' },
  { occurred_at: '2026-02-05T08:30:00Z', stack_item_id: STACK_ITEM_IDS['Ipamorelin'], type: 'effect',      description: 'Lebhafte Träume', severity: 2, status: 'anhaltend' },
  { occurred_at: '2026-02-10T08:00:00Z', stack_item_id: STACK_ITEM_IDS['CJC-1295'],   type: 'side_effect', description: 'Leichte Wassereinlagerungen an Händen', severity: 2, status: 'abgeklungen', duration: '3 Wochen', notes: 'Verschwand nach 3 Wochen.' },
  { occurred_at: '2026-02-18T08:00:00Z', stack_item_id: STACK_ITEM_IDS['CJC-1295'],   type: 'effect',      description: 'Verbesserte Muskelregeneration', severity: 4, status: 'anhaltend' },
  { occurred_at: '2026-03-01T08:00:00Z', stack_item_id: STACK_ITEM_IDS['CJC-1295'],   type: 'effect',      description: 'Muscle Fullness — Muskeln fühlen sich voller an', severity: 3, status: 'anhaltend' },
  { occurred_at: '2026-03-15T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Ipamorelin'], type: 'effect',      description: 'Hautqualität deutlich verbessert', severity: 3, status: 'anhaltend', notes: 'Haut wirkt straffer.' },
  { occurred_at: '2026-04-10T20:30:00Z', stack_item_id: STACK_ITEM_IDS['Ipamorelin'], type: 'effect',      description: 'Weniger Körperfett bei gleichem Gewicht', severity: 4, status: 'anhaltend' },

  // Semaglutid
  { occurred_at: '2025-12-08T09:00:00Z', stack_item_id: STACK_ITEM_IDS['Semaglutid'], type: 'side_effect', description: 'Übelkeit in den ersten 2 Wochen', severity: 3, status: 'abgeklungen', duration: '2 Wochen', notes: 'Nach Dosisanpassung verschwunden.' },
  { occurred_at: '2025-12-08T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Semaglutid'], type: 'side_effect', description: 'Appetitlosigkeit — fast kein Hunger', severity: 2, status: 'anhaltend', duration: 'dauerhaft' },
  { occurred_at: '2025-12-22T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Semaglutid'], type: 'effect',      description: 'Gewichtsverlust −2 kg in 3 Wochen', severity: 5, status: 'eingetreten' },
  { occurred_at: '2026-01-15T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Semaglutid'], type: 'effect',      description: 'Deutlich weniger Heißhungerattacken', severity: 4, status: 'anhaltend', notes: 'Besonders auf Süßes.' },
  { occurred_at: '2026-02-10T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Semaglutid'], type: 'effect',      description: 'Gewichtsverlust −5 kg gesamt', severity: 5, status: 'eingetreten' },
  { occurred_at: '2026-02-15T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Semaglutid'], type: 'side_effect', description: 'Leichter Haarausfall', severity: 2, status: 'abgeklungen', duration: '4 Wochen', notes: 'Temporär durch Kaloriendefizit.' },
  { occurred_at: '2026-03-10T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Semaglutid'], type: 'effect',      description: 'Blutdruck normalisiert', severity: 4, status: 'anhaltend' },
  { occurred_at: '2026-04-20T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Semaglutid'], type: 'effect',      description: 'Gewichtsverlust −8 kg gesamt seit Start', severity: 5, status: 'eingetreten' },

  // Selank
  { occurred_at: '2026-03-25T09:00:00Z', stack_item_id: STACK_ITEM_IDS['Selank'], type: 'effect', description: 'Angstreduktion — ruhigeres Gemüt', severity: 4, status: 'anhaltend', duration: 'dauerhaft' },
  { occurred_at: '2026-04-01T08:30:00Z', stack_item_id: STACK_ITEM_IDS['Selank'], type: 'effect', description: 'Verbesserte Konzentrationsfähigkeit', severity: 4, status: 'anhaltend' },
  { occurred_at: '2026-04-08T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Selank'], type: 'effect', description: 'Bessere Stimmungslage', severity: 3, status: 'anhaltend', notes: 'Subtil aber merkbar.' },
  { occurred_at: '2026-04-20T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Selank'], type: 'effect', description: 'Produktivität am Arbeitsplatz gestiegen', severity: 3, status: 'anhaltend' },
  { occurred_at: '2026-05-05T08:00:00Z', stack_item_id: STACK_ITEM_IDS['Selank'], type: 'side_effect', description: 'Leichte Trockenheit der Nasenschleimhaut', severity: 1, status: 'anhaltend', notes: 'Durch Salzwasser-Spray behandelt.' },
]

const { error: effErr } = await sb.from('effects').insert(
  effectsData.map(e => ({ ...e, user_id: uid, is_public: true }))
)
if (effErr) console.warn('⚠ Effects:', effErr.message)
else console.log(`✓ Tagebuch (${effectsData.length} Einträge)`)

// ─── Bewertungen ──────────────────────────────────────────────────────────────
const reviewsData = [
  {
    stack_item_id: STACK_ITEM_IDS['BPC-157'], rating: 5,
    title: 'Außergewöhnliche Heilungswirkung',
    body: 'Nach 6 Monaten kann ich sagen: BPC-157 ist für mich das effektivste Heilungspeptid. Knieschmerzen, die mich jahrelang beim Training behindert haben, sind verschwunden. Schultersehne ist komplett genesen. Empfehle ich jedem mit chronischen Gelenkbeschwerden.',
    pros: 'Schnelle Wirkung, vielseitig, gut verträglich, günstig',
    cons: 'Tägliche Injektionen nötig, Haltbarkeit nach Rekonstitution kurz',
    would_recommend: true,
  },
  {
    stack_item_id: STACK_ITEM_IDS['TB-500'], rating: 4,
    title: 'Solides Regenerationspeptid',
    body: 'TB-500 ergänzt BPC-157 sehr gut. Muskelkater nach intensivem Training ist erheblich reduziert. Die Sehne, die ich mir letztes Jahr gezogen hatte, ist komplett verheilt. Nur zweimal wöchentlich — sehr angenehmes Protokoll.',
    pros: 'Nur 2x/Woche, starke Regenerationswirkung',
    cons: 'Relativ teuer, hohe Dosis nötig',
    would_recommend: true,
  },
  {
    stack_item_id: STACK_ITEM_IDS['Ipamorelin'], rating: 5,
    title: 'Bester Schlaf meines Lebens',
    body: 'Ipamorelin hat meinen Schlaf revolutioniert. Tiefer, erholsamer Schlaf, mehr Träume, morgens ausgeruhter aufwachen. In Kombination mit CJC-1295 sehr synergetisch. Kein Cortisol-Anstieg wie bei GHRP-6.',
    pros: 'Bester Schlaf, kein Hunger-Stimulus, Cortisol-neutral',
    cons: 'Muss abends injiziert werden, kurze Wirkung ohne DAC',
    would_recommend: true,
  },
  {
    stack_item_id: STACK_ITEM_IDS['Semaglutid'], rating: 4,
    title: 'Sehr effektiv für Gewichtsmanagement',
    body: '8 kg in 5 Monaten ohne große Diät — einfach durch massiv reduzierten Appetit. Übelkeit in den ersten 2 Wochen war unangenehm, aber verschwand dann komplett. Bin beeindruckt. Wichtig: sicher auftitrieren.',
    pros: 'Starke Appetitreduktion, wenig Heißhunger, wöchentliche Gabe',
    cons: 'Anfängliche Übelkeit, teuer, Muskelabbau möglich',
    would_recommend: true,
  },
  {
    stack_item_id: STACK_ITEM_IDS['Selank'], rating: 4,
    title: 'Subtil aber effektiv gegen Stress',
    body: 'Selank ist kein Wundermittel, aber es hat meine Grundanspannung messbar reduziert. Konzentrierter bei der Arbeit, weniger Grübeln. Nasal sehr einfach in den Alltag zu integrieren.',
    pros: 'Keine Sedierung, nasal einfach anzuwenden, gute Verträglichkeit',
    cons: 'Wirkung subtil — braucht Zeit bis man sie bemerkt',
    would_recommend: true,
  },
]

const { error: revErr } = await sb.from('reviews').insert(
  reviewsData.map(r => ({ ...r, user_id: uid }))
)
if (revErr) console.warn('⚠ Reviews:', revErr.message)
else console.log(`✓ Bewertungen (${reviewsData.length} Stück)`)

// ─── Fertig ───────────────────────────────────────────────────────────────────
console.log('\n🎉 Test-Datensatz vollständig!')
console.log('   → 6 Substanzen mit Inventar')
console.log('   → 7 Zyklen (2 abgeschlossen, 5 aktiv)')
console.log('   → 2 Dosis-Eskalationen (Semaglutid)')
console.log(`   → ${allLogs.length} Dosis-Logs (6 Monate)`)
console.log(`   → ${effectsData.length} Tagebuch-Einträge`)
console.log(`   → ${reviewsData.length} Bewertungen`)
console.log('\n   App starten: npm run dev → http://localhost:5173')
