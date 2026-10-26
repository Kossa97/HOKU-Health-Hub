import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'
import { seedBpc157 } from './support/myStack'

test('Fortschritt-Verlauf: Zyklus per Chip als Balken hinter der Kurve, Ablesen ändert die große Zahl und rastet am Start ein', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-07-01' })
  // ein Gewicht alle zwei Tage seit Juni
  let kg = 86
  for (let tag = new Date('2026-06-01T07:00:00Z'); tag < new Date('2026-09-28T07:00:00Z'); tag = new Date(tag.getTime() + 2 * 864e5)) {
    kg -= 0.05
    mock.insert('weight_logs', { user_id: TEST_USER.id, logged_at: tag.toISOString(), weight_kg: Math.round(kg * 10) / 10 })
  }
  await page.goto('/progress')

  const graph = page.getByRole('img', { name: /^Gewicht: Verlauf vom/ })
  await graph.scrollIntoViewIfNeeded()
  await expect(graph).toBeVisible()
  // Ruht das Scrollen auf dem Graphen, weichen die Hintergrundlichter an seine Ränder aus
  await expect(page.locator('.lg-light[data-moved="true"]').first()).toBeAttached()

  // Anfangs ist kein Zyklus an; der erste Chip weist darauf hin
  const chip = page.getByRole('button', { name: /^BPC-157:/ })
  await expect(chip).toHaveAttribute('aria-pressed', 'false')
  await expect(chip).toHaveAttribute('data-hint', 'true')
  await expect(graph.locator('rect.fg-band')).toHaveCount(0)

  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect(chip).toHaveAttribute('data-hint', 'false')
  await expect(graph.locator('rect.fg-band')).toHaveCount(1)
  // Der feste Hintergrund nimmt die Zyklusfarbe im mittleren Licht an
  const mitte = page.locator('.lg-light-middle')
  await expect(mitte).toHaveAttribute('data-tinted', 'true')
  const hero = page.locator('[data-hero-value]')
  const heute = await hero.textContent()

  // Ablesen am linken Rand: ein älterer, schwererer Wert
  const box = (await graph.boundingBox())!
  await page.mouse.move(box.x + 6, box.y + box.height / 2)
  await expect(hero).not.toHaveText(heute ?? '')
  // Das Licht unter der Ablese-Linie tritt zurück
  const zurueck = page.locator('.lg-light[data-avoided="true"]')
  await expect(zurueck).toHaveCount(1)

  // Am Zyklusstart rastet der Finger ein und nennt ihn
  const start = (await graph.locator('circle[r="4"]').boundingBox())!
  await page.mouse.move(start.x + start.width / 2 + 3, box.y + box.height / 2)
  await expect(page.locator('.fg-hero-label')).toContainText('BPC-157 · Start')
  if (process.env.SCREENSHOT_DIR) await page.locator('.fg-hero').screenshot({ path: `${process.env.SCREENSHOT_DIR}/verlauf-start.png` })

  // Loslassen bzw. Verlassen: zurück zum heutigen Wert
  await page.mouse.move(box.x + box.width / 2, box.y - 40)
  await expect(hero).toHaveText(heute ?? '')
  await expect(zurueck).toHaveCount(0)

  await chip.click()
  await expect(graph.locator('rect.fg-band')).toHaveCount(0)
  await expect(mitte).toHaveAttribute('data-tinted', 'false')
})
