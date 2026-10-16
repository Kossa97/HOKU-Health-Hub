import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'
import { seedBpc157 } from './support/myStack'

test('Fortschritt-Verlauf: Aktien-Graph mit Zyklus-Balken, Wischen blaettert zurueck, „Jetzt" springt ans Ende', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-06-01' })
  // ein Gewicht alle zwei Tage seit Juni
  let kg = 86
  for (let tag = new Date('2026-06-01T07:00:00Z'); tag < new Date('2026-09-28T07:00:00Z'); tag = new Date(tag.getTime() + 2 * 864e5)) {
    kg -= 0.05
    mock.insert('weight_logs', { user_id: TEST_USER.id, logged_at: tag.toISOString(), weight_kg: Math.round(kg * 10) / 10 })
  }
  await page.goto('/progress')
  // Das Sichtfenster folgt dem Seiten-Zeitraum; in 30 Tagen lässt sich zurückblättern.
  await page.getByRole('button', { name: '30T', exact: true }).click()
  const graph = page.getByRole('img', { name: 'Gewicht: Verlauf' })
  await graph.scrollIntoViewIfNeeded()
  await expect(graph).toBeVisible()
  await page.waitForTimeout(900)
  if (process.env.SCREENSHOT_DIR) await graph.locator('xpath=ancestor::section[1]').screenshot({ path: `${process.env.SCREENSHOT_DIR}/verlauf-jetzt.png` })
  const jetzt = page.locator('[data-chart-jump-now]')
  await expect(jetzt).toHaveCount(0)

  const box = (await graph.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.5, { steps: 8 })
  await page.mouse.up()
  await expect(jetzt).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await graph.locator('xpath=ancestor::section[1]').screenshot({ path: `${process.env.SCREENSHOT_DIR}/verlauf-zurueck.png` })
  await jetzt.click()
  await expect(jetzt).toHaveCount(0)
})
