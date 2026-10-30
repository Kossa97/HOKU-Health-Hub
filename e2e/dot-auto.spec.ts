import { TEST_USER } from './support/mockSupabase'
import { expect, test } from './support/fixtures'
import { seedBpc157, stageObject } from './support/myStack'

test.use({ dotFrei: true })

/**
 * Hoku trägt automatisch ein (Pro): ist der Schalter an der Substanz an, gilt
 * jede geplante Einnahme als genommen, sobald ihre Zeit vorbei ist — auf
 * demselben Weg wie der Haken, mit Markierung „automatisch".
 */

const pro = (mock: import('./support/mockSupabase').MockSupabase) => {
  const profil = mock.table('profiles').find(row => row.id === TEST_USER.id)!
  profil.pro_until = '2099-01-01T00:00:00.000Z'
}

test('mit Pro und Schalter: Hoku trägt fällige Einnahmen ein, markiert und bucht ab', async ({ page, mock }) => {
  pro(mock)
  seedBpc157(mock, { startDate: '2026-09-01' })
  const cycleId = String(mock.table('cycles')[0].id)
  // seit gestern, 07:00 Berlin; heute ist der 28.09., 10:00
  mock.table('stack_items')[0].auto_log_since = '2026-09-27T05:00:00.000Z'

  await page.goto('/kalender?date=2026-09-28#due-intakes')
  await expect.poll(() => mock.table('dose_logs').filter(l => l.auto_logged).length).toBe(2)
  const logs = mock.table('dose_logs')
  expect(logs.map(l => l.routine_slot_key).sort()).toEqual([`${cycleId}@2026-09-27T08:00`, `${cycleId}@2026-09-28T08:00`])
  for (const log of logs) expect(log).toMatchObject({ taken: true, auto_logged: true, dose: 250, unit: 'mcg' })
  // Bestand wie nach dem Haken
  await expect.poll(() => mock.rpcCalls.filter(c => c.name === 'apply_inventory_confirmation').length).toBe(2)
  // Im Kalender als „automatisch" erkennbar
  await page.getByRole('button', { name: /Bereits protokolliert/ }).click()
  await expect(page.locator('[data-auto-logged]').first()).toBeVisible()
  await expect(page.locator('[data-auto-logged]').first()).toHaveText('automatisch')
})

test('bis Pro startet, trägt Hoku auch ohne Pro ein', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  mock.table('stack_items')[0].auto_log_since = '2026-09-27T05:00:00.000Z'
  await page.goto('/kalender?date=2026-09-28#due-intakes')
  await expect.poll(() => mock.table('dose_logs').filter(l => l.auto_logged).length).toBe(2)
})

test('bis Pro startet, ist der Schalter an der Substanz ohne Pro frei', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  await stageObject(page, 'BPC-157').click()
  const detail = page.getByRole('dialog', { name: 'BPC-157', exact: true })
  const schalter = detail.getByRole('switch', { name: 'Hoku trägt automatisch ein' })
  await expect(schalter).toHaveAttribute('aria-checked', 'false')
  await expect(detail.getByText('Mit Pro')).toHaveCount(0)
  await expect(schalter).not.toHaveAttribute('aria-disabled', 'true')
  await schalter.click()
  await expect.poll(() => mock.table('stack_items')[0].auto_log_since).toBeTruthy()
})

test('mit Pro: Schalter an der Substanz ein und wieder aus', async ({ page, mock }) => {
  pro(mock)
  seedBpc157(mock, { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  await stageObject(page, 'BPC-157').click()
  const detail = page.getByRole('dialog', { name: 'BPC-157', exact: true })
  const schalter = detail.getByRole('switch', { name: 'Hoku trägt automatisch ein' })
  await schalter.click()
  await expect(schalter).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => mock.table('stack_items')[0].auto_log_since).toBeTruthy()
  await schalter.click()
  await expect(schalter).toHaveAttribute('aria-checked', 'false')
  await expect.poll(() => mock.table('stack_items')[0].auto_log_since ?? null).toBeNull()
})

test('mit Pro: Schalter im Bündel lässt Hoku dessen Substanzen eintragen', async ({ page, mock }) => {
  pro(mock)
  seedBpc157(mock, { startDate: '2026-09-01' })
  const itemId = String(mock.table('stack_items')[0].id)
  mock.insert('intake_bundles', {
    id: 'bundle-1', user_id: TEST_USER.id, name: 'Morgen', stack_item_ids: [itemId], sort_order: 0,
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', auto_log_since: null,
  })
  await page.goto('/kalender?date=2026-09-28#due-intakes')
  await page.getByRole('button', { name: 'Morgen bearbeiten' }).click()
  const schalter = page.getByRole('switch', { name: 'Hoku trägt automatisch ein' })
  await expect(schalter).toHaveAttribute('aria-checked', 'false')
  await schalter.click()
  await expect(schalter).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => mock.table('intake_bundles')[0].auto_log_since).toBeTruthy()
})
