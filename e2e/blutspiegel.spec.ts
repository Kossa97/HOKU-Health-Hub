import { expect, test } from './support/fixtures'
import type { MockSupabase } from './support/mockSupabase'
import { seedBpc157, seedPeptide } from './support/myStack'

/** BPC-157 mit PK-Profil und taeglicher Einnahme um 08:00 seit Zyklusbeginn. */
function bpcMitEinnahmen(mock: MockSupabase) {
  const profil = mock.insert('pk_profiles', {
    name: 'BPC-157', half_life_hours: 4, tmax_hours: 0.5, bioavailability_sc: 1, iu_per_mg: null, vd_l_kg: null, category: 'peptide',
  })
  mock.table('substance_catalog').find(row => row.canonical_name === 'BPC-157')!.pk_profile_id = profil.id
  seedBpc157(mock, { startDate: '2026-08-01' })
  mock.table('stack_items')[0].pk_profile_method = 'Subkutan'
  const zyklus = mock.table('cycles')[0]
  for (let tag = new Date('2026-08-01T06:00:00Z'); tag < new Date('2026-09-28T06:00:00Z'); tag = new Date(tag.getTime() + 864e5)) {
    mock.insert('dose_logs', {
      logged_at: tag.toISOString(), dose: 250, unit: 'mcg', method: 'Subkutan', taken: true,
      cycle_id: zyklus.id, plan_version_id: zyklus.plan_version_id ?? null, stack_item_id: zyklus.stack_item_id,
    })
  }
}

test('Übersicht: Zeile je Substanz mit Wert und neutraler 24-h-Veränderung; Tipp führt ins Detail', async ({ page, mock }) => {
  bpcMitEinnahmen(mock)
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
  await page.goto('/simulation')

  await expect(page.getByRole('heading', { level: 1, name: 'Blutspiegel' })).toBeVisible()
  await expect(page.locator('[data-bs-live]')).toContainText('Live')
  await expect(page.locator('[data-bs-live]')).toContainText('Stand 10:00')
  const zeile = page.locator('[data-bs-row]')
  await expect(zeile).toHaveCount(1)
  await expect(zeile).toContainText('BPC-157')
  await expect(zeile).toContainText('nächste Dosis')
  await expect(zeile).toContainText('%')
  // Ohne Kurve: steht darunter, nicht als Zeile
  await expect(page.getByText('TB-500')).toBeVisible()
  // Keine Kurve und keine manuelle Simulation auf der Übersicht
  await expect(page.getByRole('img', { name: /BPC-157/ })).toHaveCount(0)

  await zeile.click()
  await expect(page).toHaveURL(/\/simulation\/[^/]+$/)
  await expect(page.getByRole('img', { name: /BPC-157/ })).toBeVisible()
  await expect(page.locator('[data-bs-live]')).toContainText('Live')
  // Letzte Einnahmen, neueste zuerst
  const einnahmen = page.getByRole('region', { name: 'Letzte Einnahmen' })
  await expect(einnahmen.getByRole('listitem')).toHaveCount(10)
  await expect(einnahmen.getByRole('listitem').first()).toContainText('250')
  await page.locator('[data-bs-back]').click()
  await expect(page).toHaveURL(/\/simulation$/)
})

test('„+“ öffnet die eigene Simulation; alte Links leiten weiter', async ({ page, mock }) => {
  bpcMitEinnahmen(mock)
  await page.goto('/simulation')
  await page.locator('[data-bs-manual]').click()
  await expect(page).toHaveURL(/\/simulation\/neu$/)
  await expect(page.getByRole('button', { name: /Manuelle Simulation/ })).toHaveAttribute('aria-expanded', 'true')

  await page.goto('/simulation?pk=abc')
  await expect(page).toHaveURL(/\/simulation\/neu\?pk=abc$/)
})

test('Aktualisieren lädt neu', async ({ page, mock }) => {
  bpcMitEinnahmen(mock)
  await page.goto('/simulation')
  await expect(page.locator('[data-bs-row]')).toHaveCount(1)
  const anfragen: string[] = []
  page.on('request', r => { if (r.url().includes('dose_logs')) anfragen.push(r.url()) })
  await page.locator('[data-bs-refresh]').click()
  await expect.poll(() => anfragen.length).toBeGreaterThan(0)
})

test('Blutspiegel: Werte links, Wischen blaettert zurueck, „Jetzt" springt ans Ende', async ({ page, mock }) => {
  const profil = mock.insert('pk_profiles', {
    name: 'BPC-157', half_life_hours: 4, tmax_hours: 0.5, bioavailability_sc: 1, iu_per_mg: null, vd_l_kg: null, category: 'peptide',
  })
  mock.table('substance_catalog').find(row => row.canonical_name === 'BPC-157')!.pk_profile_id = profil.id
  seedBpc157(mock, { startDate: '2026-08-01' })
  mock.table('stack_items')[0].pk_profile_method = 'Subkutan'
  const zyklus = mock.table('cycles')[0]
  // jeden Morgen eingenommen, seit Zyklusbeginn
  for (let tag = new Date('2026-08-01T06:00:00Z'); tag < new Date('2026-09-28T06:00:00Z'); tag = new Date(tag.getTime() + 864e5)) {
    mock.insert('dose_logs', {
      logged_at: tag.toISOString(), dose: 250, unit: 'mcg', method: 'Subkutan', taken: true,
      cycle_id: zyklus.id, plan_version_id: zyklus.plan_version_id ?? null, stack_item_id: zyklus.stack_item_id,
    })
  }
  await page.goto('/simulation')
  await page.locator('[data-bs-row]').first().click()
  const graph = page.getByRole('img', { name: /BPC-157/ })
  await expect(graph).toBeVisible()
  await page.getByRole('radio', { name: '1 W.' }).click()
  await page.waitForTimeout(800)
  if (process.env.SCREENSHOT_DIR) await graph.screenshot({ path: `${process.env.SCREENSHOT_DIR}/pk-jetzt.png` })
  await expect(page.locator('[data-chart-jump-now]')).toHaveCount(0)

  // mit der Maus nach rechts ziehen = in die Vergangenheit
  await graph.scrollIntoViewIfNeeded()
  const box = (await graph.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5, { steps: 8 })
  await page.mouse.up()
  const jetzt = page.locator('[data-chart-jump-now]')
  await expect(jetzt).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await graph.screenshot({ path: `${process.env.SCREENSHOT_DIR}/pk-zurueck.png` })
  await jetzt.click()
  await expect(jetzt).toHaveCount(0)
})

test('Unbekannte Detail-Adresse zeigt keine andere Substanz', async ({ page, mock }) => {
  bpcMitEinnahmen(mock)
  await page.goto('/simulation/gibt-es-nicht')
  await expect(page.locator('[data-bs-not-found]')).toContainText('keinen Blutspiegel mehr')
  await expect(page.getByRole('img', { name: /BPC-157/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Zur Übersicht' }).click()
  await expect(page.locator('[data-bs-row]')).toHaveCount(1)
})

test('Wechsel Übersicht → Detail zeigt sofort den letzten Stand, ohne Ladeanzeige', async ({ page, mock }) => {
  bpcMitEinnahmen(mock)
  await page.goto('/simulation')
  await expect(page.locator('[data-bs-row]')).toHaveCount(1)
  await page.locator('[data-bs-row]').first().click()
  await expect(page.getByText('Live-Spiegel wird berechnet')).toHaveCount(0)
  await expect(page.getByRole('img', { name: /BPC-157/ })).toBeVisible()
})
