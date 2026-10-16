import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'
import { seedBpc157 } from './support/myStack'

function seed(mock: MockSupabase) {
  seedBpc157(mock, { startDate: '2026-06-01' })
  let kg = 86
  for (let tag = new Date('2026-06-01T07:00:00Z'); tag < new Date('2026-09-28T07:00:00Z'); tag = new Date(tag.getTime() + 2 * 864e5)) {
    kg -= 0.05
    mock.insert('weight_logs', { user_id: TEST_USER.id, logged_at: tag.toISOString(), weight_kg: Math.round(kg * 10) / 10 })
    mock.insert('daily_logs', {
      user_id: TEST_USER.id, log_date: tag.toISOString().slice(0, 10),
      energie: 6, schlaf: 7, wohlbefinden: 6, libido: 5, body_fat_pct: null,
    })
  }
}

test.describe('auf Englisch', () => {
  test.use({ language: 'en' })

  test('Fortschritt erscheint auf Englisch', async ({ page, mock }) => {
    seed(mock)
    await page.goto('/progress')

    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible()
    await expect(page.getByText('Biggest changes')).toBeVisible()
    await expect(page.getByText('Your values')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Weight: history' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible()
    await expect(page.getByText('Fortschritt', { exact: true })).toHaveCount(0)
    await page.waitForTimeout(900)
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/fortschritt-en.png`, fullPage: true })

    await page.getByRole('button', { name: /LOG PROGRESS|EDIT TODAY'S ENTRY/ }).click()
    await expect(page.getByRole('dialog', { name: 'Log progress' })).toBeVisible()
    await expect(page.getByText('Sleep quality')).toBeVisible()
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/fortschritt-en-eintrag.png` })
  })
})

test('Fortschritt bleibt auf Deutsch', async ({ page, mock }) => {
  seed(mock)
  await page.goto('/progress')

  await expect(page.getByRole('heading', { name: 'Fortschritt', exact: true })).toBeVisible()
  await expect(page.getByText('Größte Veränderungen')).toBeVisible()
  await expect(page.getByText('Deine Werte')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Gewicht: Verlauf' })).toBeVisible()
  await page.waitForTimeout(900)
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/fortschritt-de.png`, fullPage: true })
})
