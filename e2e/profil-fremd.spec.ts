import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'

/**
 * Fremdes Profil /u/<name> und Web-Link (Profil 2a): Andere sehen nur Werte
 * auf „Alle“, ohne Lücke und ohne Chips; privat nur Kopf und Hinweiskarte;
 * ohne Anmeldung nie Erfahrungsberichte; „Ansehen als“ zeigt die eigene Seite
 * in der Sicht der Stufe.
 */

const MAX_ID = '00000000-0000-4000-8000-0000000000f2'

/** Max: Alter und KFA auf „Alle“, Gewicht auf „Freunde“, Berichte auf „Alle“. */
function max(mock: MockSupabase, extra: Record<string, unknown> = {}) {
  const avatar = `${MAX_ID}/avatar-1.jpg`
  mock.storage.set('profile-media', [avatar])
  mock.insert('profiles', {
    id: MAX_ID, username: 'max', display_name: 'Max Muster', public_bio: 'Kraft und Ausdauer.',
    field_visibility: { bio: 'all', age: 'all', weight: 'friends', body_fat: 'all', reviews: 'all' },
    profile_private: false, web_link_enabled: true,
    // freigegeben: der Bild-Check hat genau diese Datei geprüft
    avatar_path: avatar, avatar_status: 'approved', avatar_object_id: mock.objektId('profile-media', avatar),
    ...extra,
  })
  mock.insert('profile_snapshots', {
    user_id: MAX_ID,
    data: { age: { v: 31 }, weight: { v: 84.2, unit: 'kg' }, body_fat: { v: 14.5, unit: '%' }, reviews: { count: 1, avgRating: 4 } },
  })
  const item = mock.insert('stack_items', { user_id: MAX_ID, display_name: 'TB-500', category: 'peptide', archived: false })
  mock.insert('reviews', {
    user_id: MAX_ID, stack_item_id: item.id, cycle_id: null, rating: 4, title: 'Bericht von Max', body: 'Lief gut.',
    pros: null, cons: null, experience: 'gut', wirkung: null, vertraeglichkeit: null, wieder_nehmen: null,
    is_public: true, created_at: '2026-09-02T10:00:00.000Z', updated_at: null,
  })
}

test('Angemeldet: nur Werte auf „Alle“, zwei Ein-Wert-Karten nebeneinander, keine Chips', async ({ page, mock }) => {
  max(mock)
  await page.goto('/u/max')

  await expect(page.locator('[data-profile-bar]')).toContainText('@max')
  await expect(page.locator('[data-profile-name]')).toContainText('Max Muster')
  await expect(page.locator('[data-profile-bio]')).toContainText('Kraft und Ausdauer.')
  await expect(page.locator('[data-profile-tile="age"]')).toContainText('31')
  await expect(page.locator('[data-profile-tile="body_fat"]')).toContainText('14,5')
  await expect(page.locator('[data-profile-tile="weight"]')).toHaveCount(0)
  await expect(page.getByText('84,2')).toHaveCount(0)
  await expect(page.locator('[data-vis-chip]')).toHaveCount(0)

  // Über mich und Körper haben je einen Wert: eine Reihe, gleiche Höhe, keine Lücke.
  const paar = page.locator('[data-profile-pair]')
  await expect(paar).toHaveCount(1)
  const [links, rechts] = await Promise.all(['ueber', 'koerper'].map(id => paar.locator(`[data-profile-card="${id}"]`).boundingBox()))
  expect(links && rechts && Math.abs(links.y - rechts.y)).toBe(0)

  await expect(page.locator('[data-public-review]')).toContainText('Bericht von Max')
  await expect(page.locator('[data-profile-avatar] img')).toBeVisible()

  // ⋯ führt zu Melden und Blockieren
  await page.locator('[data-profile-more]').click()
  await expect(page.locator('[data-profile-more-sheet] [data-report-profile]')).toBeVisible()
  await expect(page.locator('[data-profile-more-sheet] [data-block-open]')).toBeVisible()
})

test('Freigegebenes Bild gelöscht und unter gleichem Namen neu angelegt: andere sehen es nicht mehr', async ({ page, mock }) => {
  max(mock)
  mock.ersetzeDatei('profile-media', `${MAX_ID}/avatar-1.jpg`)
  await page.goto('/u/max')
  await expect(page.locator('[data-profile-name]')).toContainText('Max Muster')
  await expect(page.locator('[data-profile-avatar]')).toBeVisible()
  await expect(page.locator('[data-profile-avatar] img')).toHaveCount(0)
})

test('Berichte nur bei Freigabe: ohne „Alle“ keine Liste und keine Anfrage', async ({ page, mock }) => {
  max(mock, { field_visibility: { age: 'all', reviews: 'friends' } })
  await page.goto('/u/max')
  await expect(page.locator('[data-profile-tile="age"]')).toBeVisible()
  await expect(page.locator('[data-public-review]')).toHaveCount(0)
  expect(mock.rpcCalls.map(c => c.name)).not.toContain('public_profile_reviews')
})

test('Privates Profil: Bild, Name, Nickname und die Karte „Privates Profil“', async ({ page, mock }) => {
  max(mock, { profile_private: true })
  await page.goto('/u/max')
  await expect(page.locator('[data-profile-private]')).toContainText('Privates Profil')
  await expect(page.locator('[data-profile-name]')).toContainText('Max Muster')
  await expect(page.locator('[data-profile-avatar] img')).toBeVisible()
  await expect(page.locator('[data-profile-tile]')).toHaveCount(0)
  await expect(page.locator('[data-profile-bio]')).toHaveCount(0)
  await expect(page.locator('[data-public-review]')).toHaveCount(0)
})

test('Blockiert (von Max): nur der Hinweis, keine Werte', async ({ page, mock }) => {
  max(mock)
  mock.insert('user_blocks', { blocker_id: MAX_ID, blocked_id: TEST_USER.id })
  await page.goto('/u/max')
  await expect(page.locator('[data-profile-blocked]')).toBeVisible()
  await expect(page.locator('[data-profile-tile]')).toHaveCount(0)
  await expect(page.getByText('Max Muster')).toHaveCount(0)
})

test('„Ansehen als“: App-Nutzer sieht nur „Alle“, Freund auch „Freunde“, Web nur den Kopf', async ({ page, mock }) => {
  Object.assign(mock.table('profiles')[0], {
    username: 'e2e', display_name: 'Eva', public_bio: 'Meine Bio', web_link_enabled: true,
    field_visibility: { bio: 'all', age: 'all', weight: 'friends' },
  })
  mock.insert('profile_snapshots', { user_id: TEST_USER.id, data: { age: { v: 29 }, weight: { v: 61, unit: 'kg' }, height: { v: 168, unit: 'cm' } } })

  await page.goto('/u/e2e?als=all')
  await expect(page.locator('[data-view-as="all"]')).toContainText('Ansehen als: App-Nutzer')
  await expect(page.locator('[data-profile-tile="age"]')).toBeVisible()
  await expect(page.locator('[data-profile-tile="weight"]')).toHaveCount(0)
  await expect(page.locator('[data-profile-tile="height"]')).toHaveCount(0)
  await expect(page.locator('[data-profile-more]')).toHaveCount(0)

  await page.goto('/u/e2e?als=friends')
  await expect(page.locator('[data-view-as="friends"]')).toContainText('Freund')
  await expect(page.locator('[data-profile-tile="weight"]')).toBeVisible()
  await expect(page.locator('[data-profile-tile="height"]')).toHaveCount(0)

  await page.goto('/u/e2e?als=web')
  await expect(page.locator('[data-view-as="web"]')).toContainText('Web')
  await expect(page.locator('[data-web-profile]')).toContainText('Meine Bio')
  await expect(page.locator('[data-profile-tile]')).toHaveCount(0)

  await page.locator('[data-view-as-back]').click()
  await expect(page).toHaveURL(/\/profil\/einstellungen$/)
})

test('Eigenes Profil ohne „Ansehen als“ führt zum Schaufenster', async ({ page, mock }) => {
  expect(mock.table('profiles')[0].username).toBe('e2e')
  await page.goto('/u/e2e')
  await expect(page).toHaveURL(/\/profil$/)
})

test.describe('ohne Anmeldung', () => {
  test.use({ angemeldet: false })

  test('Web-Link: Bild, Name, Nickname, Bio und „In Hoku öffnen“ — keine Berichte, keine Werte', async ({ page, mock }) => {
    max(mock)
    await page.goto('/u/max')
    const web = page.locator('[data-web-profile]')
    await expect(web).toContainText('Max Muster')
    await expect(web).toContainText('@max')
    await expect(web.locator('[data-profile-bio]')).toContainText('Kraft und Ausdauer.')
    await expect(web.locator('[data-profile-avatar] img')).toBeVisible()
    await expect(web.locator('[data-web-open]')).toHaveText('In Hoku öffnen')
    await expect(web.locator('[data-web-app-only]')).toContainText('nur in der App sichtbar')
    await expect(page.locator('[data-public-review]')).toHaveCount(0)
    await expect(page.getByText('Bericht von Max')).toHaveCount(0)
    await expect(page.locator('[data-profile-tile]')).toHaveCount(0)
    await expect(page.locator('[data-report-profile], [data-report-open]')).toHaveCount(0)
    expect(mock.rpcCalls.map(c => c.name)).toEqual(['profile_view'])
  })

  test('Web-Link aus, privat und unbekannt: gleiche „Seite nicht gefunden“', async ({ page, mock }) => {
    max(mock, { web_link_enabled: false })
    await page.goto('/u/max')
    await expect(page.locator('[data-web-not-found]')).toContainText('Seite nicht gefunden')

    mock.table('profiles').find(row => row.id === MAX_ID)!.web_link_enabled = true
    mock.table('profiles').find(row => row.id === MAX_ID)!.profile_private = true
    await page.goto('/u/max')
    await expect(page.locator('[data-web-not-found]')).toContainText('Seite nicht gefunden')

    await page.goto('/u/gibtsnicht')
    await expect(page.locator('[data-web-not-found]')).toContainText('Seite nicht gefunden')
  })
})
