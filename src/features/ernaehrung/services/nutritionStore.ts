/**
 * Supabase-Zugriff der Ernährung. Wirft bei Fehlern — die Seite zeigt sie an,
 * statt still leere Listen anzuzeigen.
 */
import { supabase } from '../../../lib/supabase'
import {
  type EntrySource, type Food, type FoodUnit, type Goals, type LogEntry, type Meal, type Nutrients, type Per100,
  nutrientsFor, scaleNutrients,
} from '../lib/nutrition'
import { geschlechtAusAltangabe, parseBioProfile } from '../../blutwerte/lib/bioProfile'

type Row = Record<string, unknown>
const num = (v: unknown) => Number(v ?? 0)
const opt = (v: unknown) => (v == null ? null : Number(v))
const str = (v: unknown) => (typeof v === 'string' ? v : null)

export function rowToEntry(r: Row): LogEntry {
  return {
    id: r.id as string,
    date: r.log_date as string,
    meal: r.meal as Meal,
    itemId: str(r.food_item_id),
    source: r.source as EntrySource,
    sourceRef: str(r.source_ref),
    name: r.name as string,
    brand: str(r.brand),
    unit: (r.unit as FoodUnit) ?? 'g',
    amount: opt(r.amount),
    nutrients: {
      kcal: num(r.kcal), protein: num(r.protein_g), carbs: num(r.carbs_g), fat: num(r.fat_g),
      fiber: opt(r.fiber_g), sugar: opt(r.sugar_g), salt: opt(r.salt_g),
    },
    createdAt: r.created_at as string,
  }
}

export function rowToFood(r: Row): Food {
  return {
    itemId: r.id as string,
    source: r.source as Food['source'],
    sourceRef: str(r.source_ref),
    barcode: str(r.barcode),
    name: r.name as string,
    brand: str(r.brand),
    unit: (r.unit as FoodUnit) ?? 'g',
    per100: {
      kcal: num(r.kcal_100), protein: num(r.protein_100), carbs: num(r.carbs_100), fat: num(r.fat_100),
      fiber: opt(r.fiber_100), sugar: opt(r.sugar_100), salt: opt(r.salt_100),
    },
    serving: r.serving_amount == null ? null : { amount: num(r.serving_amount), label: str(r.serving_label) },
    favorite: r.favorite === true,
  }
}

function nutrientColumns(n: Nutrients) {
  return {
    kcal: n.kcal, protein_g: n.protein, carbs_g: n.carbs, fat_g: n.fat,
    fiber_g: n.fiber, sugar_g: n.sugar, salt_g: n.salt,
  }
}

function per100Columns(p: Per100) {
  return {
    kcal_100: p.kcal, protein_100: p.protein, carbs_100: p.carbs, fat_100: p.fat,
    fiber_100: p.fiber, sugar_100: p.sugar, salt_100: p.salt,
  }
}

// ─── Protokoll ──────────────────────────────────────────────────────────

export async function loadDay(userId: string, date: string): Promise<{ entries: LogEntry[]; waterMl: number }> {
  const [logs, water] = await Promise.all([
    supabase.from('food_logs').select('*').eq('user_id', userId).eq('log_date', date).order('created_at'),
    supabase.from('water_logs').select('ml').eq('user_id', userId).eq('log_date', date).maybeSingle(),
  ])
  if (logs.error) throw logs.error
  if (water.error) throw water.error
  return { entries: (logs.data ?? []).map(rowToEntry), waterMl: num(water.data?.ml) }
}

/** Kalorien und Eiweiß je Tag (für die Wochenansicht). */
export async function loadRange(userId: string, from: string, to: string): Promise<Record<string, { kcal: number; protein: number }>> {
  const { data, error } = await supabase.from('food_logs').select('log_date,kcal,protein_g')
    .eq('user_id', userId).gte('log_date', from).lte('log_date', to)
  if (error) throw error
  const out: Record<string, { kcal: number; protein: number }> = {}
  for (const r of data ?? []) {
    const d = (out[r.log_date as string] ??= { kcal: 0, protein: 0 })
    d.kcal += num(r.kcal)
    d.protein += num(r.protein_g)
  }
  return out
}

/** Letzte Einträge (neueste zuerst) — Grundlage für „Häufig". */
export async function loadRecentEntries(userId: string, limit = 200): Promise<LogEntry[]> {
  const { data, error } = await supabase.from('food_logs').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []).map(rowToEntry)
}

export async function addEntry(userId: string, date: string, meal: Meal, food: Food, amount: number): Promise<LogEntry> {
  const { data, error } = await supabase.from('food_logs').insert({
    user_id: userId, log_date: date, meal,
    food_item_id: food.itemId, source: food.source, source_ref: food.sourceRef,
    name: food.name, brand: food.brand, unit: food.unit, amount,
    ...nutrientColumns(nutrientsFor(food.per100, amount)),
  }).select('*').single()
  if (error) throw error
  return rowToEntry(data)
}

/** Schnelleintrag: nur Kalorien (und optional Eiweiß), ohne Lebensmittel. */
export async function addQuickEntry(userId: string, date: string, meal: Meal, name: string, kcal: number, protein: number): Promise<LogEntry> {
  const { data, error } = await supabase.from('food_logs').insert({
    user_id: userId, log_date: date, meal, source: 'quick', name, unit: 'g', amount: null,
    kcal, protein_g: protein, carbs_g: 0, fat_g: 0,
  }).select('*').single()
  if (error) throw error
  return rowToEntry(data)
}

/**
 * Menge und/oder Mahlzeit eines Eintrags ändern. Ohne `food` werden die Werte
 * aus dem Schnappschuss neu skaliert; mit `food` (korrigierte Werte) gilt der
 * Eintrag danach als Eintrag dieses Lebensmittels.
 */
export async function updateEntry(entry: LogEntry, change: { amount?: number; meal?: Meal; food?: Food }): Promise<LogEntry> {
  const patch: Row = {}
  if (change.meal) patch.meal = change.meal
  const amount = change.amount ?? entry.amount
  if (change.food && amount) {
    const f = change.food
    Object.assign(patch, {
      food_item_id: f.itemId, source: f.source, source_ref: f.sourceRef, name: f.name, brand: f.brand, unit: f.unit, amount,
    }, nutrientColumns(nutrientsFor(f.per100, amount)))
  } else if (change.amount != null && entry.amount && change.amount !== entry.amount) {
    Object.assign(patch, { amount: change.amount }, nutrientColumns(scaleNutrients(entry.nutrients, change.amount / entry.amount)))
  }
  if (Object.keys(patch).length === 0) return entry
  const { data, error } = await supabase.from('food_logs').update(patch).eq('id', entry.id).select('*').single()
  if (error) throw error
  return rowToEntry(data)
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('food_logs').delete().eq('id', id)
  if (error) throw error
}

/** Einträge wieder anlegen (Rückgängig, Kopieren). Neue IDs, gleicher Inhalt. */
export async function insertCopies(userId: string, entries: readonly LogEntry[], target?: { date: string; meal?: Meal }): Promise<LogEntry[]> {
  if (!entries.length) return []
  const rows = entries.map(e => ({
    user_id: userId, log_date: target?.date ?? e.date, meal: target?.meal ?? e.meal,
    food_item_id: e.itemId, source: e.source, source_ref: e.sourceRef,
    name: e.name, brand: e.brand, unit: e.unit, amount: e.amount, ...nutrientColumns(e.nutrients),
  }))
  const { data, error } = await supabase.from('food_logs').insert(rows).select('*')
  if (error) throw error
  return (data ?? []).map(rowToEntry)
}

export async function loadEntriesOn(userId: string, date: string, meal: Meal): Promise<LogEntry[]> {
  const { data, error } = await supabase.from('food_logs').select('*')
    .eq('user_id', userId).eq('log_date', date).eq('meal', meal).order('created_at')
  if (error) throw error
  return (data ?? []).map(rowToEntry)
}

// ─── Meine Lebensmittel ─────────────────────────────────────────────────

export async function loadMyFoods(userId: string): Promise<Food[]> {
  const { data, error } = await supabase.from('food_items').select('*').eq('user_id', userId).order('name')
  if (error) throw error
  return (data ?? []).map(rowToFood)
}

export async function findMyFoodByBarcode(userId: string, barcode: string): Promise<Food | null> {
  const { data, error } = await supabase.from('food_items').select('*').eq('user_id', userId).eq('barcode', barcode).limit(1)
  if (error) throw error
  return data?.[0] ? rowToFood(data[0]) : null
}

/**
 * Lebensmittel speichern: neu anlegen oder — wenn es schon zu „Meine
 * Lebensmittel" gehört (itemId) — überschreiben. Ein fremder Eintrag, den der
 * Nutzer korrigiert oder merkt, wird hier zur eigenen Fassung.
 */
export async function saveMyFood(userId: string, food: Food): Promise<Food> {
  const row = {
    user_id: userId, source: food.source, source_ref: food.sourceRef, barcode: food.barcode,
    name: food.name.trim(), brand: food.brand?.trim() || null, unit: food.unit,
    ...per100Columns(food.per100),
    serving_amount: food.serving?.amount ?? null, serving_label: food.serving?.label ?? null,
    favorite: food.favorite, updated_at: new Date().toISOString(),
  }
  const query = food.itemId
    ? supabase.from('food_items').update(row).eq('id', food.itemId)
    : supabase.from('food_items').insert(row)
  const { data, error } = await query.select('*').single()
  if (error) throw error
  return rowToFood(data)
}

export async function deleteMyFood(id: string): Promise<void> {
  const { error } = await supabase.from('food_items').delete().eq('id', id)
  if (error) throw error
}

// ─── Ziele und Wasser ───────────────────────────────────────────────────

export async function loadGoals(userId: string): Promise<Goals | null> {
  const { data, error } = await supabase.from('nutrition_goals').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    kcal: num(data.kcal), proteinG: num(data.protein_g), carbsG: num(data.carbs_g), fatG: num(data.fat_g),
    waterMl: num(data.water_ml), hideKcal: data.hide_kcal === true,
  }
}

export async function saveGoals(userId: string, g: Goals): Promise<void> {
  const { error } = await supabase.from('nutrition_goals').upsert({
    user_id: userId, kcal: g.kcal, protein_g: g.proteinG, carbs_g: g.carbsG, fat_g: g.fatG,
    water_ml: g.waterMl, hide_kcal: g.hideKcal, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function saveWater(userId: string, date: string, ml: number): Promise<void> {
  const { error } = await supabase.from('water_logs').upsert({
    user_id: userId, log_date: date, ml: Math.max(0, Math.min(15000, Math.round(ml))), updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,log_date' })
  if (error) throw error
}

// ─── Körperdaten für den Zielvorschlag ──────────────────────────────────

export interface BodyData {
  weightKg: number | null
  heightCm: number | null
  birthDate: string | null
  sex: 'male' | 'female' | null
}

/** Gewicht bevorzugt aus `weight_logs` (neuester Wert), sonst aus dem Profil. */
export async function loadBodyData(userId: string): Promise<BodyData> {
  const [profile, weight] = await Promise.all([
    supabase.from('profiles').select('weight_kg,height_cm,birth_date,bio_sex,gender').eq('id', userId).maybeSingle(),
    supabase.from('weight_logs').select('weight_kg').eq('user_id', userId).order('logged_at', { ascending: false }).limit(1),
  ])
  if (profile.error) throw profile.error
  const p: Row = profile.data ?? {}
  const latest = weight.error ? null : weight.data?.[0]?.weight_kg
  // Wie Blutwerte und /health: neue Angaben, sonst die alte Freitext-Angabe.
  const bio = parseBioProfile(p)
  return {
    weightKg: opt(latest ?? p.weight_kg),
    heightCm: opt(p.height_cm),
    birthDate: bio.birthDate,
    sex: bio.sex ?? geschlechtAusAltangabe(p.gender),
  }
}
