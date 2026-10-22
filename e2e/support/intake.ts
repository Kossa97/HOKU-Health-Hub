import { expect, type Page } from '@playwright/test'
import type { MockSupabase } from './mockSupabase'
import { next, seedBpc157, stageObject } from './myStack'

/** 2 vials of 5 mg; 250 mcg consumes 0.05 vial. */
export function seedTrackedIntake(mock: MockSupabase): void {
  seedBpc157(mock, { startDate: '2026-09-01' })
  Object.assign(mock.table('stack_item_inventory')[0], {
    enabled: true, package_quantity: 2, package_unit: 'vial', remaining_quantity: 2, reconstitution_ml: 2,
  })
  Object.assign(mock.table('stack_item_ingredients')[0], { basis_value: 1, basis_unit: 'vial' })
}

export function remainingStock(mock: MockSupabase): number {
  return Number(mock.table('stack_item_inventory')[0].remaining_quantity)
}

export async function createTrackedIntake(page: Page): Promise<void> {
  await page.goto('/my-stack')
  await page.getByRole('button', { name: 'Neue Substanz' }).click()
  const wizard = page.getByRole('dialog', { name: 'Substanz hinzufügen' })
  await wizard.getByRole('searchbox').fill('BPC-157')
  await wizard.getByRole('option', { name: /^BPC-157 Body/ }).click()
  await next(wizard, 'Darreichungsform')
  await next(wizard, 'Farbe')
  await next(wizard, 'Tracking-Tiefe')
  await next(wizard, 'Stärke')
  await wizard.getByRole('spinbutton', { name: 'Wirkstoff im Vial' }).fill('5')
  await wizard.getByRole('spinbutton', { name: 'Lösungsmittel' }).fill('2')
  await next(wizard, 'Einnahmeplan')
  await wizard.getByRole('radio', { name: 'Subkutan' }).click()
  await wizard.getByRole('spinbutton', { name: /^Menge/ }).fill('250')
  await wizard.getByRole('combobox', { name: 'Einheit' }).fill('mcg')
  await next(wizard, 'Zusammenfassung')
  await wizard.getByRole('button', { name: 'Speichern' }).click()
  await expect(wizard).toBeHidden()
  await stageObject(page, 'BPC-157').click()
  await page.getByRole('button', { name: 'Bestand verfolgen', exact: true }).click()
  const stock = page.getByRole('dialog', { name: 'Bestand verfolgen' })
  await stock.getByLabel('Packungsgröße').fill('2')
  await stock.getByLabel('Gezählt in').selectOption('vial')
  await stock.getByLabel('Aktueller Bestand').fill('2')
  await stock.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(stock).toBeHidden()
}

export async function openHomeRoutine(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Alle als eingenommen markieren – Morgens', exact: true }).click()
  return page.getByRole('dialog', { name: 'Gemeinsam bestätigen' })
}

export async function confirmHomeRoutine(page: Page): Promise<void> {
  const routine = await openHomeRoutine(page)
  await routine.getByRole('button', { name: 'Alle als eingenommen markieren', exact: true }).click()
  await expect(routine.getByText('Routine gespeichert', { exact: true })).toBeVisible()
  await routine.getByRole('button', { name: 'Fertig', exact: true }).click()
}

export async function expectCalendarTaken(page: Page): Promise<void> {
  await page.goto('/kalender?date=2026-09-28')
  const completed = page.getByRole('button', { name: /^Bereits protokolliert/ })
  await expect(completed).toContainText('1')
  await expect(page.locator('[data-due-row]')).toHaveCount(0)
  await completed.click()
  await expect(page.getByText('250 mcg', { exact: true })).toBeVisible()
  // Die Aktionen einer protokollierten Einnahme stehen erst nach Antippen da.
  await page.locator('[data-log-row] button[aria-expanded]').first().click()
}

export async function expectStockVisible(page: Page): Promise<void> {
  await page.goto('/my-stack')
  await stageObject(page, 'BPC-157').click()
  await expect(page.locator('[data-stack-detail="bestand"]')).toContainText('1 Vial · + 1 rekonstituiert · 95 %')
}
