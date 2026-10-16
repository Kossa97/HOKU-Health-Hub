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

test('Eintragen: scheitert nur das Gewicht, bleibt das Sheet offen und erneutes Speichern klappt', async ({ page, mock }) => {
  seed(mock)
  await page.goto('/progress')
  await page.getByRole('button', { name: /FORTSCHRITT EINTRAGEN|HEUTIGEN EINTRAG BEARBEITEN/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Fortschritt eintragen' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('slider', { name: 'Energie' }).fill('8')

  // Der Server speichert das Gewicht, die Antwort geht aber verloren —
  // der schlimmste Fall fürs erneute Speichern.
  let loseWeightResponse = true
  await page.route(/\/rest\/v1\/weight_logs/, async route => {
    if (loseWeightResponse && route.request().method() === 'POST') {
      loseWeightResponse = false
      mock.insert('weight_logs', route.request().postDataJSON())
      return route.fulfill({ status: 500, json: { message: 'boom', code: 'XX000' } })
    }
    return route.fallback()
  })
  const dailyBefore = mock.tables.get('daily_logs')?.length ?? 0
  const weightBefore = mock.tables.get('weight_logs')?.length ?? 0

  await sheet.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(page.getByText('Werte gespeichert, das Gewicht aber nicht. Bitte erneut speichern.')).toBeVisible()
  await expect(sheet).toBeVisible()
  await expect(page.getByText('boom')).toHaveCount(0)

  await sheet.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(page.getByText('Fortschritt gespeichert')).toBeVisible()
  await expect(sheet).toBeHidden()
  // Zweimal gespeichert, trotzdem nur ein Tageseintrag mehr: Upsert pro Datum.
  expect(mock.tables.get('daily_logs')?.length).toBe(dailyBefore + 1)
  // Und nur ein Gewicht mehr, obwohl der erste Versuch schon geschrieben hatte.
  expect(mock.tables.get('weight_logs')?.length).toBe(weightBefore + 1)
})

test('Foto löschen: scheitert die Zeile, bleibt die Datei; sonst gehen beide', async ({ page, mock }) => {
  seed(mock)
  const path = `${TEST_USER.id}/1.jpg`
  mock.storage.set('progress-photos', [path])
  mock.insert('progress_photos', { user_id: TEST_USER.id, photo_url: path, taken_at: '2026-09-20', weight_kg: 83, notes: null })
  page.on('dialog', dialog => void dialog.accept())
  // Das Bild selbst: ein leeres GIF reicht, der Mock liefert nur signierte Links.
  await page.route(/\/storage\/v1\/object\/sign\/.*\.jpg/, route => route.fulfill({
    contentType: 'image/gif',
    body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'),
  }))

  let failDelete = true
  await page.route(/\/rest\/v1\/progress_photos/, async route => {
    if (failDelete && route.request().method() === 'DELETE') {
      failDelete = false
      return route.fulfill({ status: 500, json: { message: 'boom', code: 'XX000' } })
    }
    return route.fallback()
  })

  await page.goto('/progress')
  await page.getByRole('button', { name: /Alle anzeigen/ }).click()
  await page.getByRole('button', { name: /20\.09\.2026/ }).click()
  await page.getByRole('button', { name: 'Foto löschen' }).click()
  await expect(page.getByText('Fehler beim Löschen')).toBeVisible()
  expect(mock.storage.get('progress-photos')).toEqual([path])
  expect(mock.tables.get('progress_photos')).toHaveLength(1)

  await page.getByRole('button', { name: 'Foto löschen' }).click()
  await expect(page.getByText('Foto gelöscht')).toBeVisible()
  expect(mock.tables.get('progress_photos') ?? []).toHaveLength(0)
  expect(mock.storage.get('progress-photos')).toEqual([])
})
