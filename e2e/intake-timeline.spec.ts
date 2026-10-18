import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { seedBpc157, stageObject } from './support/myStack'

async function openConfirmation(page: Page, slotKey: string) {
  const row = page.locator(`[data-due-row="${slotKey}"]`)
  await expect(row).toBeVisible()
  const expand = row.locator('[data-due-item]')
  if (await expand.getAttribute('aria-expanded') !== 'true') await expand.click()
  await row.getByRole('button', { name: 'Eingenommen', exact: true }).click()
  const sheet = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Einnahme bestätigen', exact: true }),
  })
  await expect(sheet).toBeVisible()
  return sheet
}

test('Kalender: neue Planmenge gilt ab dem gewählten Tag, bestätigte Einnahme bleibt erhalten', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  const cycleId = String(mock.table('cycles')[0].id)
  const originalVersionId = mock.table('cycle_plan_versions')[0].id
  const confirmedSlot = `${cycleId}@2026-09-28T08:00`

  await page.goto('/kalender?date=2026-09-28#due-intakes')
  await expect(page.locator('[data-calendar-date="2026-09-28"][aria-pressed="true"]').first()).toBeVisible()
  await expect(page.locator(`[data-due-row="${confirmedSlot}"]`)).toContainText('250 mcg')
  const sheet = await openConfirmation(page, confirmedSlot)
  await expect(sheet.getByRole('spinbutton', { name: 'Menge', exact: true })).toHaveValue('250')
  await sheet.getByRole('button', { name: 'Eingenommen', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(page.locator('[data-due-receipt]')).toContainText('1 von 1 bestätigt')
  expect(mock.table('dose_logs')).toHaveLength(1)
  const savedLog = structuredClone(mock.table('dose_logs')[0])
  expect(savedLog).toMatchObject({
    routine_slot_key: confirmedSlot, plan_version_id: originalVersionId,
    dose: 250, unit: 'mcg', taken: true,
  })

  await page.goto('/my-stack')
  await stageObject(page, 'BPC-157').click()
  await page.getByRole('dialog', { name: 'BPC-157', exact: true })
    .getByRole('button', { name: 'Plan & Verlauf öffnen', exact: true }).click()
  await page.getByRole('button', { name: 'Plan anpassen', exact: true }).click()
  const plan = page.getByRole('dialog', { name: 'Plan anpassen', exact: true })
  await plan.getByRole('radio', { name: 'Ab Datum', exact: true }).check()
  await plan.locator('input[type="date"]').fill('2026-09-29')
  await plan.getByRole('spinbutton', { name: /^Menge/ }).fill('500')
  await plan.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(plan).toBeHidden()
  expect(mock.rpcCalls.find(call => call.name === 'create_plan_version')?.params).toMatchObject({
    p_effective_kind: 'local_date', p_effective_local_date: '2026-09-29',
    p_schedule: { dose: 500, unit: 'mcg' },
  })
  expect(mock.table('cycle_plan_versions')).toHaveLength(2)
  expect(mock.table('cycle_plan_versions').find(row => row.id === originalVersionId)).toMatchObject({ dose: 250 })
  expect(mock.table('dose_logs')).toEqual([savedLog])

  await page.goto('/kalender?date=2026-09-29#due-intakes')
  await expect(page.locator('[data-calendar-date="2026-09-29"][aria-pressed="true"]').first()).toBeVisible()
  const nextSlot = page.locator(`[data-due-row="${cycleId}@2026-09-29T08:00"]`)
  await expect(nextSlot).toContainText('500 mcg')
  await page.reload()
  await expect(page.locator('[data-calendar-date="2026-09-29"][aria-pressed="true"]').first()).toBeVisible()
  await expect(nextSlot).toContainText('500 mcg')

  await page.goto('/kalender?date=2026-09-28#due-intakes')
  await expect(page.locator('[data-calendar-date="2026-09-28"][aria-pressed="true"]').first()).toBeVisible()
  await expect(page.locator('[data-due-receipt]')).toContainText('1 von 1 bestätigt')
  await expect(page.locator('[data-due-row]')).toHaveCount(0)
  await page.getByRole('button', { name: /^Bereits protokolliert/ }).click()
  await expect(page.locator('#due-intakes')).toContainText('250 mcg')
  await expect(page.locator('#due-intakes')).not.toContainText('500 mcg')
  expect(mock.table('dose_logs')).toEqual([savedLog])
})

test.describe('Lokaler Tag an der Herbstzeitumstellung', () => {
  // Berlin ist hier schon am 25. Oktober, UTC noch am 24.; 02:30 kommt
  // später zweimal vor. Die Identität trägt weiterhin die geplante Minute.
  test.use({ now: new Date('2026-10-25T00:05:00+02:00') })

  test('Bestätigung kurz nach Mitternacht bleibt am lokalen Tag und im geplanten Slot', async ({ page, mock }) => {
    seedBpc157(mock, { startDate: '2026-10-01' })
    Object.assign(mock.table('cycle_plan_versions')[0], {
      intake_time: 'morgens', intake_time_custom: '02:30',
    })
    const cycleId = String(mock.table('cycles')[0].id)
    const slotKey = `${cycleId}@2026-10-25T02:30`

    await page.goto('/kalender')
    await expect(page.locator('[data-calendar-date="2026-10-25"][aria-pressed="true"]').first()).toBeVisible()
    const sheet = await openConfirmation(page, slotKey)
    await expect(sheet.locator('input[type="time"]')).toHaveValue('02:30')
    await sheet.getByRole('button', { name: 'Jetzt', exact: true }).click()
    await expect(sheet.locator('input[type="time"]')).toHaveValue('00:05')
    await sheet.getByRole('button', { name: 'Eingenommen', exact: true }).click()
    await expect(sheet).toBeHidden()
    await expect(page.locator('[data-due-receipt]')).toContainText('1 von 1 bestätigt')
    expect(mock.table('dose_logs')).toHaveLength(1)
    const savedLog = structuredClone(mock.table('dose_logs')[0])
    expect(savedLog).toMatchObject({
      routine_slot_key: slotKey, logged_at: '2026-10-24T22:05:00.000Z', taken: true,
    })
    expect(mock.rpcCalls.find(call => call.name === 'confirm_intake_group')?.params).toMatchObject({
      p_entries: [{ slot_key: slotKey, timezone: 'Europe/Berlin', logged_at: '2026-10-24T22:05:00.000Z' }],
    })

    await page.reload()
    await expect(page.locator('[data-calendar-date="2026-10-25"][aria-pressed="true"]').first()).toBeVisible()
    await expect(page.locator('[data-due-receipt]')).toContainText('1 von 1 bestätigt')
    await expect(page.locator('[data-due-row]')).toHaveCount(0)
    await page.getByRole('button', { name: /^Bereits protokolliert/ }).click()
    await expect(page.locator('#due-intakes')).toContainText('250 mcg')
    await expect(page.locator('#due-intakes')).toContainText('00:05')

    await page.goto('/kalender?date=2026-10-26#due-intakes')
    await expect(page.locator('[data-calendar-date="2026-10-26"][aria-pressed="true"]').first()).toBeVisible()
    await expect(page.locator(`[data-due-row="${cycleId}@2026-10-26T02:30"]`)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Bereits protokolliert/ })).toHaveCount(0)
    expect(mock.table('dose_logs')).toEqual([savedLog])
  })
})
