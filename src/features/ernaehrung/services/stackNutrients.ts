/**
 * Supplements aus My Stack, die an einem Tag genommen wurden — nur lesen, nur eigene Zeilen (RLS).
 * Rechnen: lib/stackMicros.ts.
 */
import { addDays, format, parseISO } from 'date-fns'
import { supabase } from '../../../lib/supabase'
import { localDateBoundaryInstant } from '../../../lib/planTimeline'
import { type StackIngredient, type StackLog, type StackPart, stackMicros } from '../lib/stackMicros'
import type { Micros } from '../lib/micros'

type Row = Record<string, unknown>
const num = (v: unknown) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export async function loadStackNutrients(userId: string, date: string): Promise<{ total: Micros; parts: StackPart[] }> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const from = localDateBoundaryInstant(date, tz).toISOString()
  const to = localDateBoundaryInstant(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'), tz).toISOString()
  const logs = await supabase.from('dose_logs').select('stack_item_id, dose, unit')
    .eq('user_id', userId).eq('taken', true).gte('logged_at', from).lt('logged_at', to)
  if (logs.error) throw logs.error
  const rows = (logs.data ?? []) as Row[]
  const ids = [...new Set(rows.map(r => str(r.stack_item_id)).filter((x): x is string => !!x))]
  if (!ids.length) return { total: {}, parts: [] }
  const items = await supabase.from('stack_items')
    .select('id, display_name, ingredients:stack_item_ingredients(custom_name, amount_value, amount_unit, basis_value, basis_unit, substance_catalog(canonical_name))')
    .eq('user_id', userId).in('id', ids)
  if (items.error) throw items.error
  const byId = new Map<string, { name: string; ings: StackIngredient[] }>()
  for (const it of (items.data ?? []) as Row[]) {
    const ings = (Array.isArray(it.ingredients) ? it.ingredients : []) as Row[]
    byId.set(String(it.id), {
      name: str(it.display_name) ?? '',
      ings: ings.map(i => ({
        name: str((i.substance_catalog as Row | null)?.canonical_name) ?? str(i.custom_name),
        amount: num(i.amount_value), unit: str(i.amount_unit), basisValue: num(i.basis_value), basisUnit: str(i.basis_unit),
      })),
    })
  }
  const stackLogs: StackLog[] = rows
    .filter(r => byId.has(String(r.stack_item_id)))
    .map(r => ({ itemId: String(r.stack_item_id), itemName: byId.get(String(r.stack_item_id))!.name, dose: num(r.dose), unit: str(r.unit) }))
  return stackMicros(stackLogs, id => byId.get(id)?.ings ?? [])
}
