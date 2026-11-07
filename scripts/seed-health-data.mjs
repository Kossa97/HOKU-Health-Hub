// TYD — Gesundheitsdaten (Blutwerte + Gewicht, 6 Monate)
// Ausführen: SEED_EMAIL=… SEED_PASSWORD=… node scripts/seed-health-data.mjs
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xcskcojakolphtbuqfbw.supabase.co'
const SUPABASE_KEY = 'sb_publishable_yeAVlq8miTc20FLsPqKCwQ_xAGKHLV1'

// Zugangsdaten nie ins Repo: SEED_EMAIL=… SEED_PASSWORD=… node scripts/seed-health-data.mjs
const EMAIL = process.env.SEED_EMAIL
const PASSWORD = process.env.SEED_PASSWORD
if (!EMAIL || !PASSWORD) { console.error('❌ SEED_EMAIL und SEED_PASSWORD setzen'); process.exit(1) }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const { data: { user }, error: loginErr } = await sb.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
})
if (loginErr) { console.error('❌ Login:', loginErr.message); process.exit(1) }
const uid = user.id
console.log('✓ Eingeloggt:', uid)

// ─── Bestehende Daten löschen ────────────────────────────────────────────────
console.log('🗑  Lösche bestehende Gesundheitsdaten...')
const { error: bwDel } = await sb.from('bloodwork').delete().eq('user_id', uid)
if (bwDel) console.warn('  bloodwork:', bwDel.message)
const { error: wlDel } = await sb.from('weight_logs').delete().eq('user_id', uid)
if (wlDel) console.warn('  weight_logs:', wlDel.message)
console.log('✓ Bereinigt')

// ─── Blutwerte ────────────────────────────────────────────────────────────────
// 3 Bluttests: Baseline (Nov), Zwischenkontrolle (Feb), Aktuell (Mai)
// Zeigt deutliche Verbesserungen durch Semaglutid + GH-Peptide

const bloodworkEntries = [
  // ── Bluttest 1: 2025-11-25 — Baseline (vor intensivem Protokoll) ──────────
  { tested_at: '2025-11-25', marker: 'IGF-1',       value: 182,  unit: 'ng/mL',   notes: 'Baseline vor GH-Peptid-Protokoll' },
  { tested_at: '2025-11-25', marker: 'Testosteron',  value: 378,  unit: 'ng/dL',   notes: null },
  { tested_at: '2025-11-25', marker: 'Östradiol',    value: 22,   unit: 'pg/mL',   notes: null },
  { tested_at: '2025-11-25', marker: 'SHBG',         value: 28,   unit: 'nmol/L',  notes: null },
  { tested_at: '2025-11-25', marker: 'LH',           value: 4.2,  unit: 'mIU/mL',  notes: null },
  { tested_at: '2025-11-25', marker: 'FSH',          value: 3.1,  unit: 'mIU/mL',  notes: null },
  { tested_at: '2025-11-25', marker: 'TSH',          value: 2.1,  unit: 'mIU/mL',  notes: null },
  { tested_at: '2025-11-25', marker: 'CRP',          value: 2.8,  unit: 'mg/L',    notes: 'Leicht erhöht — chronische Entzündung' },
  { tested_at: '2025-11-25', marker: 'Vitamin D',    value: 24,   unit: 'ng/mL',   notes: 'Insuffizienz — Supplementierung gestartet' },
  { tested_at: '2025-11-25', marker: 'Ferritin',     value: 85,   unit: 'ng/mL',   notes: null },
  { tested_at: '2025-11-25', marker: 'Hämoglobin',   value: 15.2, unit: 'g/dL',    notes: null },
  { tested_at: '2025-11-25', marker: 'Hematokrit',   value: 44,   unit: '%',       notes: null },
  { tested_at: '2025-11-25', marker: 'GH',           value: 0.8,  unit: 'ng/mL',   notes: 'Basalwert nüchtern' },
  { tested_at: '2025-11-25', marker: 'Kortisol',     value: 14.2, unit: 'µg/dL',   notes: 'Morgens 8 Uhr' },
  { tested_at: '2025-11-25', marker: 'Insulin',      value: 8.5,  unit: 'µIU/mL',  notes: 'Nüchtern' },

  // ── Bluttest 2: 2026-02-22 — Zwischenkontrolle (nach 3 Monaten) ──────────
  { tested_at: '2026-02-22', marker: 'IGF-1',       value: 248,  unit: 'ng/mL',   notes: 'Anstieg durch Ipamorelin + CJC-1295' },
  { tested_at: '2026-02-22', marker: 'Testosteron',  value: 425,  unit: 'ng/dL',   notes: null },
  { tested_at: '2026-02-22', marker: 'Östradiol',    value: 24,   unit: 'pg/mL',   notes: null },
  { tested_at: '2026-02-22', marker: 'SHBG',         value: 31,   unit: 'nmol/L',  notes: null },
  { tested_at: '2026-02-22', marker: 'LH',           value: 3.9,  unit: 'mIU/mL',  notes: null },
  { tested_at: '2026-02-22', marker: 'FSH',          value: 2.8,  unit: 'mIU/mL',  notes: null },
  { tested_at: '2026-02-22', marker: 'TSH',          value: 2.0,  unit: 'mIU/mL',  notes: null },
  { tested_at: '2026-02-22', marker: 'CRP',          value: 1.1,  unit: 'mg/L',    notes: 'Deutlich verbessert — Entzündungsmarker normalisiert' },
  { tested_at: '2026-02-22', marker: 'Vitamin D',    value: 38,   unit: 'ng/mL',   notes: 'Supplementierung wirkt, Ziel >40' },
  { tested_at: '2026-02-22', marker: 'Ferritin',     value: 92,   unit: 'ng/mL',   notes: null },
  { tested_at: '2026-02-22', marker: 'Hämoglobin',   value: 15.6, unit: 'g/dL',    notes: null },
  { tested_at: '2026-02-22', marker: 'Hematokrit',   value: 46,   unit: '%',       notes: null },
  { tested_at: '2026-02-22', marker: 'GH',           value: 1.4,  unit: 'ng/mL',   notes: 'Erhöht durch GH-Sekretagogen' },
  { tested_at: '2026-02-22', marker: 'Kortisol',     value: 12.8, unit: 'µg/dL',   notes: null },
  { tested_at: '2026-02-22', marker: 'Insulin',      value: 7.2,  unit: 'µIU/mL',  notes: 'Verbesserung durch Semaglutid + Gewichtsverlust' },

  // ── Bluttest 3: 2026-05-20 — Aktuell (nach 6 Monaten) ────────────────────
  { tested_at: '2026-05-20', marker: 'IGF-1',       value: 289,  unit: 'ng/mL',   notes: 'Kontinuierlicher Anstieg — im oberen Normbereich' },
  { tested_at: '2026-05-20', marker: 'Testosteron',  value: 468,  unit: 'ng/dL',   notes: null },
  { tested_at: '2026-05-20', marker: 'Östradiol',    value: 25,   unit: 'pg/mL',   notes: null },
  { tested_at: '2026-05-20', marker: 'SHBG',         value: 34,   unit: 'nmol/L',  notes: null },
  { tested_at: '2026-05-20', marker: 'LH',           value: 3.6,  unit: 'mIU/mL',  notes: null },
  { tested_at: '2026-05-20', marker: 'FSH',          value: 2.5,  unit: 'mIU/mL',  notes: null },
  { tested_at: '2026-05-20', marker: 'TSH',          value: 1.9,  unit: 'mIU/mL',  notes: null },
  { tested_at: '2026-05-20', marker: 'CRP',          value: 0.7,  unit: 'mg/L',    notes: 'Exzellent — sehr niedrige systemische Entzündung' },
  { tested_at: '2026-05-20', marker: 'Vitamin D',    value: 52,   unit: 'ng/mL',   notes: 'Optimaler Bereich erreicht' },
  { tested_at: '2026-05-20', marker: 'Ferritin',     value: 98,   unit: 'ng/mL',   notes: null },
  { tested_at: '2026-05-20', marker: 'Hämoglobin',   value: 15.8, unit: 'g/dL',    notes: null },
  { tested_at: '2026-05-20', marker: 'Hematokrit',   value: 47,   unit: '%',       notes: null },
  { tested_at: '2026-05-20', marker: 'GH',           value: 1.8,  unit: 'ng/mL',   notes: null },
  { tested_at: '2026-05-20', marker: 'Kortisol',     value: 11.5, unit: 'µg/dL',   notes: null },
  { tested_at: '2026-05-20', marker: 'Insulin',      value: 5.8,  unit: 'µIU/mL',  notes: 'Sehr gut — Insulinsensitivität deutlich verbessert' },
]

const { error: bwErr } = await sb.from('bloodwork').insert(
  bloodworkEntries.map(e => ({ ...e, user_id: uid }))
)
if (bwErr) {
  console.error('❌ bloodwork:', bwErr.message)
  console.error('   → Tabelle existiert möglicherweise noch nicht in Supabase.')
  console.error('   → Bitte zuerst supabase-health-new.sql im Supabase SQL Editor ausführen.')
} else {
  console.log(`✓ Blutwerte (${bloodworkEntries.length} Einträge, 3 Bluttests)`)
}

// ─── Gewichtsverlauf ──────────────────────────────────────────────────────────
// Wöchentlich, von 90.2 kg (Nov 23) auf 82.5 kg (Mai 22) — realistischer Verlauf
// Semaglutid ab 1. Dez: deutlicherer Abfall ab Woche 2-3

const weightStart = 90.2
const weightEnd   = 82.5
const weeks       = 26

// Schwellenwerte für Sema-Effekt: langsamer Beginn, dann steiler
function weightAtWeek(w) {
  const t = w / (weeks - 1)  // 0..1
  // Easing: langsam, dann schneller (Sema-Wirkung setzt ein)
  const eased = t < 0.15 ? t * 0.5 : 0.075 + (t - 0.15) * 1.088
  const clamped = Math.min(eased, 1)
  // Leichtes Pseudo-Rauschen
  const noise = Math.sin(w * 2.3) * 0.15 + Math.cos(w * 3.7) * 0.1
  return Math.round((weightStart - clamped * (weightStart - weightEnd) + noise) * 10) / 10
}

const startDate = new Date('2025-11-23T00:00:00Z')

const weightLogs = Array.from({ length: weeks }, (_, i) => {
  const d = new Date(startDate)
  d.setUTCDate(d.getUTCDate() + i * 7)
  return {
    user_id: uid,
    logged_at: d.toISOString().split('T')[0],
    weight_kg: weightAtWeek(i),
  }
})

const { error: wlErr } = await sb.from('weight_logs').insert(weightLogs)
if (wlErr) {
  console.error('❌ weight_logs:', wlErr.message)
  console.error('   → Tabelle existiert möglicherweise noch nicht in Supabase.')
  console.error('   → Bitte zuerst supabase-health-new.sql im Supabase SQL Editor ausführen.')
} else {
  const first = weightLogs[0].weight_kg
  const last  = weightLogs[weightLogs.length - 1].weight_kg
  console.log(`✓ Gewichtsverlauf (${weightLogs.length} Wochen: ${first} kg → ${last} kg)`)
}

console.log('\n🎉 Gesundheitsdaten fertig!')
console.log(`   → ${bloodworkEntries.length} Blutwert-Einträge (3 Bluttests: Nov · Feb · Mai)`)
console.log(`   → ${weightLogs.length} Gewichts-Logs (wöchentlich, 6 Monate)`)
console.log('\n   → /blutwerte  zeigt alle Blutmarker mit Verlauf')
console.log('   → /health     zeigt Gewichtskurve + Gerätedaten')
console.log('   → /protokoll  generiert PDF-Report aus allen Daten')
