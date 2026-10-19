import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'
import { seedBpc157 } from './support/myStack'

test('Protokoll-Analyse: Linien im Aktienstil, Detail-Graphen lesen gemeinsam ab', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-08-01' })
  let kg = 86
  for (let tag = new Date('2026-08-01T07:00:00Z'); tag < new Date('2026-09-28T07:00:00Z'); tag = new Date(tag.getTime() + 3 * 864e5)) {
    kg -= 0.1
    mock.insert('weight_logs', { user_id: TEST_USER.id, logged_at: tag.toISOString(), weight_kg: Math.round(kg * 10) / 10 })
  }
  for (const [tested_at, value] of [['2026-08-02', 180], ['2026-08-30', 230], ['2026-09-25', 265]] as const) {
    mock.insert('bloodwork', { user_id: TEST_USER.id, tested_at, marker: 'IGF-1', value, unit: 'ng/mL', notes: null, report_id: null, ref_min: null, ref_max: null })
  }
  await page.goto('/protokoll/analyse')
  const prozent = page.getByRole('img', { name: 'Verlauf — % Veränderung' })
  await prozent.scrollIntoViewIfNeeded()
  await expect(prozent).toBeVisible()

  const gewicht = page.getByRole('img', { name: 'Gewicht: Verlauf' })
  const igf = page.getByRole('img', { name: 'IGF-1: Verlauf' })
  await expect(gewicht).toBeVisible()
  await expect(igf).toBeVisible()
  await page.waitForTimeout(900)
  if (process.env.SCREENSHOT_DIR) await prozent.locator('xpath=ancestor::section[1]').screenshot({ path: `${process.env.SCREENSHOT_DIR}/protokoll-prozent.png` })

  // Ablesen im Gewicht-Graph zeigt den Tag oben und den IGF-1-Wert des Tags, wenn es einen gibt
  // In die Mitte: am unteren Rand läge der Graph unter der Tab-Leiste
  await igf.evaluate(el => el.scrollIntoView({ block: 'center' }))
  const box = (await igf.boundingBox())!
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2)
  await page.mouse.down()
  const detail = igf.locator('xpath=ancestor::section[1]')
  await expect(detail.locator('[aria-live]')).not.toHaveText('')
  if (process.env.SCREENSHOT_DIR) await detail.screenshot({ path: `${process.env.SCREENSHOT_DIR}/protokoll-detail.png` })
  await page.mouse.up()
})
