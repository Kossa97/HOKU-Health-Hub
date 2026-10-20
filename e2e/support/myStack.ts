import { expect, type Locator, type Page } from '@playwright/test'
import type { MockSupabase } from './mockSupabase'

/** Der Schritt, auf dem der Assistent steht („Substanz", „Einnahmeplan", …) — die Zeile unter der Ueberschrift. */
async function stepName(dialog: Locator): Promise<string> {
  return (await dialog.locator('p').nth(1).innerText()).trim()
}

/** „Weiter" und warten, bis der naechste Schritt wirklich da ist. */
export async function next(dialog: Locator, expected?: string): Promise<void> {
  const before = await stepName(dialog)
  await dialog.getByRole('button', { name: 'Weiter', exact: true }).click()
  if (expected) await expect.poll(() => stepName(dialog)).toBe(expected)
  else await expect.poll(() => stepName(dialog)).not.toBe(before)
}

export async function expectStep(dialog: Locator, name: string): Promise<void> {
  await expect.poll(() => stepName(dialog)).toBe(name)
}

/** Die Buehne: das Objekt einer Substanz im Karussell. */
export function stageObject(page: Page, name: string): Locator {
  return page.locator('[data-vial-index]', { has: page.getByText(name, { exact: true }) }).first()
}

/**
 * Ein Peptid (Katalogname) als Vial mit taeglichem Plan anlegen — so, wie der
 * Assistent es speichert, aber ohne durch ihn zu gehen.
 */
export function seedPeptide(
  mock: MockSupabase,
  name: string,
  options: {
    startDate: string
    category?: string
    /** Ein gefuehrter Bestand; ohne Angabe wird keiner gefuehrt. */
    inventory?: {
      package_quantity: number
      package_unit: string
      remaining_quantity: number
      reconstitution_ml?: number
      expires_at?: string
      opened_at?: string
      use_within_days?: number
    }
    /** Andere Darreichungsform als das Vial — dann mit eigener Zutat, ohne Katalog. */
    form?: {
      dosage_form: string
      zutat: { amount_value: number; amount_unit: string; basis_value: number; basis_unit: string }
    }
    /** false: nur der Eintrag, ohne Plan. */
    plan?: boolean
  },
): void {
  const item = {
    id: null, display_name: name, category: options.category ?? 'peptide', tracking_level: 'complete', dosage_form: options.form?.dosage_form ?? 'vial',
    brand: null, color_hex: '#10b981', notes: null, pk_profile_method: null,
    inventory: options.inventory
      ? { enabled: true, batch_number: null, expires_at: null, reconstitution_ml: null, ...options.inventory }
      : { enabled: false, package_quantity: null, package_unit: null, remaining_quantity: null, batch_number: null, expires_at: null },
  }
  const ingredients = [options.form
    ? { catalog_substance_id: null, custom_name: name, ...options.form.zutat, position: 0 }
    : {
      // Wie in der Produktion: Katalog-Zutaten tragen keinen eigenen Namen
      // (NULL). Mit `name` hier fiel nicht auf, dass Bearbeiten daran abstuerzte.
      catalog_substance_id: mock.catalogId(name), custom_name: null,
      amount_value: 5, amount_unit: 'mg', basis_value: 2, basis_unit: 'ml', position: 0,
    }]
  if (options.plan === false) {
    mock.callRpc('save_stack_item', { p_item: item, p_ingredients: ingredients, p_idempotency_key: `seed-${name}` })
    return
  }
  mock.callRpc('save_stack_item_with_plan', {
    p_item: item,
    p_ingredients: ingredients,
    p_plan: {
      id: null, name, dose: 250, unit: 'mcg', method: 'Subkutan', frequency: 'Täglich',
      x_days_interval: null, interval_unit: null, cycle_on_days: null, cycle_off_days: null, schedule_days: [],
      start_date: options.startDate, end_date: null, intake_time: 'morgens', intake_time_custom: null,
      slot_doses: null, slot_days: null, reminder: [], timezone: 'Europe/Berlin',
    },
    p_idempotency_key: `seed-${name}`,
  })
}

export function seedBpc157(mock: MockSupabase, options: { startDate: string }): void {
  seedPeptide(mock, 'BPC-157', options)
}
