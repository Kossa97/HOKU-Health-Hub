import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'

/**
 * Bild-Check (Profil 2a): Nach dem Hochladen steht „wird geprüft“ am eigenen
 * Bild; abgelehnt kommt der Hinweis mit „Anderes wählen“; offene Prüfungen
 * holt das eigene Profil beim Öffnen nach. Der Check selbst (Claude) ist im
 * Mock nachgebildet.
 */

/** 1×1-PNG — die App schneidet zu und kodiert neu als JPEG. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

const AVATAR = `${TEST_USER.id}/avatar-1.jpg`

test('Offene Prüfung beim Öffnen nachgeholt: scheitert sie, bleibt „wird geprüft“ am Bild', async ({ page, mock }) => {
  Object.assign(mock.table('profiles')[0], { display_name: 'Eva', avatar_path: AVATAR, avatar_status: 'pending' })
  mock.storage.set('profile-media', [AVATAR])
  mock.imageCheck.urteil = 'pending'

  await page.goto('/profil')
  await expect(page.locator('[data-profile-head] [data-media-pending="avatar"]')).toHaveText('wird geprüft')
  await expect(page.locator('[data-profile-avatar] img')).toBeVisible()
  await expect.poll(() => mock.imageCheck.calls).toEqual([{ kind: 'avatar' }])
})

test('Offene Prüfung bestanden: Marke verschwindet, andere sehen das Bild', async ({ page, mock }) => {
  Object.assign(mock.table('profiles')[0], { avatar_path: AVATAR, avatar_status: 'pending' })
  mock.storage.set('profile-media', [AVATAR])
  mock.imageCheck.urteil = 'approved'

  await page.goto('/profil')
  await expect.poll(() => mock.table('profiles')[0].avatar_status).toBe('approved')
  await expect(page.locator('[data-media-pending]')).toHaveCount(0)
})

test('Hochladen → „wird geprüft“; abgelehnt → Hinweis, „Anderes wählen“, OK quittiert', async ({ page, mock }) => {
  mock.imageCheck.urteil = 'pending'
  await page.goto('/profil')
  await page.locator('[data-profile-edit]').click()
  const sheet = page.locator('[data-profile-edit-sheet]')
  await sheet.locator('input[data-media-input="avatar"]').setInputFiles({ name: 'ich.png', mimeType: 'image/png', buffer: PNG })

  await expect(sheet.locator('[data-media-pending="avatar"]')).toHaveText('wird geprüft')
  await expect(sheet).toContainText('Andere sehen neue Bilder erst nach einer kurzen automatischen Prüfung.')
  expect(mock.table('profiles')[0].avatar_status).toBe('pending')
  expect(mock.imageCheck.calls).toEqual([{ kind: 'avatar' }])

  // Zweites Bild, diesmal abgelehnt: Datei und Pfad weg, Hinweis im Sheet
  mock.imageCheck.urteil = 'rejected'
  await sheet.locator('input[data-media-input="avatar"]').setInputFiles({ name: 'neu.png', mimeType: 'image/png', buffer: PNG })
  await expect(sheet.locator('[data-media-rejected="avatar"]')).toContainText('Dieses Bild können wir nicht zeigen. Wähle ein anderes.')
  await expect(sheet.locator('[data-media-choose-other]')).toHaveText('Anderes wählen')
  expect(mock.table('profiles')[0]).toMatchObject({ avatar_path: null, avatar_status: 'rejected' })
  expect(mock.storage.get('profile-media') ?? []).toEqual([])

  // Im Profil selbst derselbe Hinweis; OK quittiert ihn
  await sheet.getByRole('button', { name: 'Schließen' }).click()
  await expect(sheet).toBeHidden()
  const hinweis = page.locator('[data-profile-page] [data-media-rejected="avatar"]')
  await expect(hinweis).toBeVisible()
  await hinweis.locator('[data-media-dismiss]').click()
  await expect(hinweis).toBeHidden()
  expect(mock.table('profiles')[0].avatar_status).toBeNull()
})
