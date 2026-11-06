import { expect, test } from './support/fixtures'
import { RpcError, type MockSupabase } from './support/mockSupabase'

/**
 * Web-Seite /u/<name> ohne Anmeldung (Profil 2c, Task 4): nur die Web-Felder
 * aus `profile_view` (Stufe web), Bio nur nach Textprüfung, Fortschritt nur als
 * Stufe ohne Bereiche, Abzeichen nach Web-Freigabe in einer Reihe, und eine
 * 404-Seite für Web-Link aus, privat, unbekannt und ausgeblendet.
 */

const MARA_ID = '00000000-0000-4000-8000-0000000000c2'

/** Sichtbarkeit in `mara`: alle Web-Felder auf „Alle“ (ohne Titel), dazu Felder, die nie ins Web dürfen. */
const FELDER_ALLE: Record<string, string> = {
  cover: 'all', country: 'all', goals: 'all', bio: 'all', streak: 'all', progress: 'all', badges: 'all', reviews: 'all',
  // nie im Web, auch auf „Alle“
  age: 'all', weight: 'all', markers: 'all', adherence: 'all', gender: 'all', member_since: 'all',
}

/** Verdiente Abzeichen (und Ränge) wie `progress_settings.earned_badges`. */
function verdient(mock: MockSupabase, ids: string[]) {
  mock.insert('progress_settings', { user_id: MARA_ID, earned_badges: Object.fromEntries(ids.map(id => [id, '2026-10-01'])) })
}

/** Mara: alle Web-Felder auf „Alle“, dazu Felder auf „Alle“, die nie ins Web dürfen. */
function mara(mock: MockSupabase, extra: Record<string, unknown> = {}, snap: Record<string, unknown> = {}) {
  const avatar = `${MARA_ID}/avatar-1.jpg`
  const cover = `${MARA_ID}/cover-1.jpg`
  mock.storage.set('profile-media', [avatar, cover])
  mock.insert('profiles', {
    id: MARA_ID, username: 'mara', display_name: 'Mara Muster', public_bio: 'Laufen, Heben, Schlafen.',
    goals: ['kraft', 'ausdauer'], country: 'DE', profile_gender: 'female', created_at: '2026-03-01T09:00:00.000Z',
    field_visibility: FELDER_ALLE,
    profile_private: false, web_link_enabled: true, web_indexable: false, web_badges: {},
    avatar_path: avatar, avatar_status: 'approved', avatar_object_id: mock.objektId('profile-media', avatar),
    cover_path: cover, cover_status: 'approved', cover_object_id: mock.objektId('profile-media', cover),
    ...extra,
  })
  mock.insert('profile_snapshots', {
    user_id: MARA_ID,
    data: {
      age: { v: 34 }, weight: { v: 63.4, unit: 'kg' }, markers: { count: 14 },
      adherence: { pct: 96, confirmed: 48, missed: 2, days: 90 },
      streak: { days: 41 },
      progress: {
        total: 32.5, areas: { koerper: 21.5, training: 44, blut: 37.5 }, since: '2026-03-01',
        counts: { koerper: 4, training: 3, erholung: 2, blut: 9 },
      },
      // heikel (aus), Grenzfall (aus), sonst ab Werk an
      badges: ['first_bloodwork', 'wearable_connected', 'streak_7', 'workouts_250', 'streak_30', 'profile_shared', 'first_pr'],
      reviews: { count: 12, avgRating: 4.5 },
      ...snap,
    },
  })
}

test.describe('ohne Anmeldung', () => {
  test.use({ angemeldet: false })

  test('zeigt nur die Web-Felder: Kopf, Bio, Streak, Dauer, Werte-Zahl, Stufe, Abzeichen-Reihe, Berichte-Zahl', async ({ page, mock }) => {
    mara(mock)
    await page.goto('/u/mara')
    const web = page.locator('[data-web-profile]')

    await expect(web.locator('[data-profile-name]')).toHaveText('Mara Muster')
    await expect(web.locator('[data-profile-nick]')).toHaveText('@mara')
    await expect(web.locator('[data-profile-country]')).toContainText('DE')
    await expect(web.locator('[data-profile-bio]')).toHaveText('Laufen, Heben, Schlafen.')
    await expect(web.locator('[data-profile-goals]')).toContainText('Kraft')
    await expect(web.locator('[data-web-streak]')).toHaveText('41 Tage in Folge dabei')
    await expect(web.locator('[data-web-member]')).toHaveText('Seit 6 Monaten dabei')
    // Werte nur aus Körper, Training, Erholung (4 + 3 + 2), nie Blut
    await expect(web.locator('[data-web-values="9"]')).toContainText('Mara trackt')
    await expect(web.locator('[data-web-cover] img')).toBeVisible()
    await expect(web.locator('[data-profile-avatar] img')).toBeVisible()

    // Fortschritt nur als Stufe: „über 30 %“, keine genaue Zahl, keine Bereiche, kein Start
    const fortschritt = web.locator('[data-web-progress="30"]')
    await expect(fortschritt).toContainText('über')
    await expect(fortschritt).toContainText('30 %')
    await expect(fortschritt).toContainText('positive Veränderung seit Start')
    for (const verboten of ['32,5', '32.5', '21,5', '44', '37,5', 'Blut', 'Einnahmen', 'Körper', 'März']) {
      await expect(fortschritt).not.toContainText(verboten)
    }

    // Abzeichen: heikle und Grenzfälle ab Werk aus; schwerste zuerst, zwei offen, „+3“
    const reihe = web.locator('[data-web-badges-row]')
    await expect(reihe.locator('[data-badge]')).toHaveCount(2)
    await expect(reihe.locator('[data-badge]').nth(0)).toHaveAttribute('data-badge', 'workouts_250')
    await expect(reihe.locator('[data-badge]').nth(1)).toHaveAttribute('data-badge', 'streak_30')
    await expect(web.locator('[data-web-badges-more="3"]')).toContainText('+3')
    await expect(web.locator('[data-web-badges-count]')).toHaveText('5')
    await expect(web.locator('[data-badge="first_bloodwork"], [data-badge="wearable_connected"]')).toHaveCount(0)
    await expect(web).not.toContainText('Erstes Blutbild')

    await expect(web.locator('[data-web-reviews-hint]')).toHaveText('12 Erfahrungsberichte und weitere Werte nur in der App.')
    await expect(web.locator('[data-web-open]').first()).toHaveAttribute('href', '/auth')
    await expect(web.locator('[data-web-about]')).toContainText('Was ist Hoku?')
    await expect(web.locator('[data-web-about]')).toContainText('Hoku stellt keine Diagnosen')

    // Nie im Web: Alter, Gewicht, Marker, Einnahmen, Geschlecht, Beitrittsmonat, Berichte-Inhalte
    for (const verboten of ['34', '63,4', '96', '14 ', '♀', 'März 2026', '4,5']) await expect(web).not.toContainText(verboten)
    await expect(page.locator('[data-profile-tile], [data-public-review], [data-profile-gender-symbol]')).toHaveCount(0)
    expect(mock.rpcCalls.map(c => c.name)).toEqual(['profile_view'])

    await expect(page).toHaveTitle('Mara Muster (@mara) · Hoku')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  })

  test('Bio, die die Textprüfung nicht besteht, fehlt im Web', async ({ page, mock }) => {
    mara(mock, { public_bio: 'Mehr auf www.example.com' })
    await page.goto('/u/mara')
    await expect(page.locator('[data-web-profile] [data-profile-name]')).toHaveText('Mara Muster')
    await expect(page.locator('[data-profile-bio]')).toHaveCount(0)
    await expect(page.getByText('example.com')).toHaveCount(0)
  })

  test('Felder nicht auf „Alle“ fehlen ohne Lücke und ohne Hinweis auf Verborgenes', async ({ page, mock }) => {
    mara(mock, { field_visibility: { bio: 'friends', progress: 'friends', badges: 'friends', reviews: 'friends', streak: 'friends' } })
    await page.goto('/u/mara')
    const web = page.locator('[data-web-profile]')
    await expect(web.locator('[data-profile-name]')).toHaveText('Mara Muster')
    await expect(web.locator('[data-profile-bio], [data-web-progress], [data-web-badges], [data-web-reviews-hint], [data-web-streak]')).toHaveCount(0)
    // Gehören zum Web-Link selbst (Entscheidung 04.11.)
    await expect(web.locator('[data-web-member]')).toHaveText('Seit 6 Monaten dabei')
    await expect(web.locator('[data-web-values="9"]')).toBeVisible()
    // Titelbild nur auf „Alle“: dieselbe ruhige Fläche ohne Bild
    await expect(web.locator('[data-web-cover]')).toBeVisible()
    await expect(web.locator('[data-web-cover] img')).toHaveCount(0)
  })

  test('Titel: Chip unter dem Namen nur bei Feld „Titel“ auf „Alle“', async ({ page, mock }) => {
    // Gewählt ist die erste Stufe der Leiter Laufen; getragen wird die höchste verdiente
    mara(mock, { field_visibility: { ...FELDER_ALLE, title: 'all' }, title_choice: 'run_10' })
    verdient(mock, ['rank_1', 'rank_2', 'rank_3', 'run_10', 'run_50'])
    await page.goto('/u/mara')
    const web = page.locator('[data-web-profile]')
    const chip = web.locator('[data-profile-title]')
    await expect(chip).toHaveAttribute('data-profile-title', 'run_50')
    await expect(chip).toContainText('Läufer')
    await expect(chip.locator('span[lang="de"]')).toHaveCSS('text-transform', 'uppercase')
    // unter dem Namen, über @mara
    const [name, titel, nick] = await Promise.all(['[data-profile-name] >> ..', '[data-profile-title]', '[data-profile-nick]']
      .map(async sel => (await web.locator(sel).boundingBox())!))
    expect(titel.y).toBeGreaterThanOrEqual(name.y + name.height - 1)
    expect(nick.y).toBeGreaterThanOrEqual(titel.y + titel.height - 1)
    // passt in die Spalte, auch auf schmalen Geräten
    const kopf = (await chip.locator('..').boundingBox())!
    expect(titel.x + titel.width).toBeLessThanOrEqual(kopf.x + kopf.width + 1)
  })

  // „Nur ich“ ist gespeichert als fehlender Eintrag (Standard)
  for (const [stufe, vis] of [['Freunde', { ...FELDER_ALLE, title: 'friends' }], ['Nur ich', FELDER_ALLE]] as const) {
    test(`Titel: auf „${stufe}“ fehlt der Chip ohne Lücke`, async ({ page, mock }) => {
      mara(mock, { field_visibility: vis, title_choice: 'run_50' })
      verdient(mock, ['rank_1', 'rank_2', 'run_10', 'run_50'])
      await page.goto('/u/mara')
      const web = page.locator('[data-web-profile]')
      await expect(web.locator('[data-profile-name]')).toHaveText('Mara Muster')
      await expect(web.locator('[data-profile-title]')).toHaveCount(0)
      await expect(web).not.toContainText('Läufer')
      await expect(web).not.toContainText('Entdecker')
      // keine Lücke: @mara steht direkt unter der Zeile mit Name und Land
      const name = (await web.locator('[data-profile-name]').locator('..').boundingBox())!
      const nick = (await web.locator('[data-profile-nick]').boundingBox())!
      expect(nick.y - (name.y + name.height)).toBeLessThan(4)
    })
  }

  test('Titel: nie ein persönlicher im Web, auch mit Schalter, Einwilligung und Quellfeld auf „Alle“', async ({ page, mock }) => {
    mara(mock, {
      field_visibility: { ...FELDER_ALLE, title: 'all', body_fat: 'all', progress: 'all' },
      title_choice: 'body_fat_10', personal_titles: true, title_consents: { body_fat_10: '2026-10-01' },
    })
    verdient(mock, ['rank_1', 'rank_2', 'rank_3', 'body_fat_5', 'body_fat_10'])
    await page.goto('/u/mara')
    const chip = page.locator('[data-web-profile] [data-profile-title]')
    // statt des persönlichen Titels der höchste Rang
    await expect(chip).toHaveAttribute('data-profile-title', 'rank_3')
    await expect(chip).toHaveAttribute('data-profile-title-kind', 'rank')
    await expect(chip).toContainText('Dranbleiber')
    await expect(page.locator('[data-web-profile]')).not.toContainText('Formwandler')
    await expect(page.locator('[data-web-profile]')).not.toContainText('In Form')
  })

  test('Schutzregel: trägt nur Blut den Fortschritt, gibt es keine Stufe', async ({ page, mock }) => {
    mara(mock, {}, { progress: { total: 55, areas: { blut: 55 }, since: '2026-03-01', counts: { blut: 9 } } })
    await page.goto('/u/mara')
    await expect(page.locator('[data-web-profile] [data-profile-name]')).toHaveText('Mara Muster')
    await expect(page.locator('[data-web-progress]')).toHaveCount(0)
    await expect(page.locator('[data-web-values]')).toHaveCount(0)
    await expect(page.getByText('55')).toHaveCount(0)
  })

  test('Abzeichen folgen web_badges: freigegebene heikle erscheinen, verborgene fehlen', async ({ page, mock }) => {
    mara(mock, { web_badges: { first_bloodwork: true, workouts_250: false, streak_30: false, first_pr: false } })
    await page.goto('/u/mara')
    const reihe = page.locator('[data-web-badges-row]')
    await expect(reihe.locator('[data-badge]')).toHaveCount(3)
    await expect(reihe.locator('[data-badge]').nth(0)).toHaveAttribute('data-badge', 'streak_7')
    await expect(reihe.locator('[data-badge]').nth(1)).toHaveAttribute('data-badge', 'first_bloodwork')
    await expect(reihe.locator('[data-badge]').nth(2)).toHaveAttribute('data-badge', 'profile_shared')
    await expect(page.locator('[data-web-badges-more]')).toHaveCount(0)
  })

  test('web_indexable hebt noindex auf', async ({ page, mock }) => {
    mara(mock, { web_indexable: true })
    await page.goto('/u/mara')
    await expect(page.locator('[data-web-profile] [data-profile-name]')).toHaveText('Mara Muster')
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('Web-Link aus, privat, unbekannt und ausgeblendet: dieselbe 404-Seite', async ({ page, mock }) => {
    mara(mock, { web_link_enabled: false })
    const zeile = mock.table('profiles').find(row => row.id === MARA_ID)!
    const seiten: string[] = []
    const fall = async (adresse: string) => {
      await page.goto(adresse)
      const nf = page.locator('[data-web-not-found]')
      await expect(nf).toContainText('Seite nicht gefunden')
      await expect(nf).toContainText('Prüf den Link oder frag nach einem neuen.')
      await expect(nf.locator('[data-web-about]')).toContainText('Was ist Hoku?')
      await expect(page).toHaveTitle('Seite nicht gefunden · Hoku')
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
      seiten.push(await nf.evaluate(node => node.outerHTML))
    }
    await fall('/u/mara')
    Object.assign(zeile, { web_link_enabled: true, profile_private: true })
    await fall('/u/mara')
    await fall('/u/gibtsnicht')
    Object.assign(zeile, { profile_private: false, hidden_by_moderation: true })
    await fall('/u/mara')
    expect(new Set(seiten).size).toBe(1)
    expect(seiten[0]).not.toContain('mara')
  })

  test('Profil melden ohne Konto: Grund und freiwillige E-Mail gehen an die Moderation', async ({ page, mock }) => {
    mara(mock)
    await page.goto('/u/mara')
    await page.locator('[data-web-report]').click()
    const sheet = page.locator('[data-report-sheet]')
    await expect(sheet).toContainText('@mara')
    await expect(sheet.locator('[data-report-send]')).toBeDisabled()
    await sheet.locator('[data-report-reason="werbung"]').check()
    await sheet.locator('[data-report-details]').fill('Verkauft etwas')
    await sheet.locator('[data-report-email]').fill('melder@example.org')
    await sheet.locator('[data-report-send]').click()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByText('Danke — die Meldung ist eingegangen.')).toBeVisible()
    // wie report_public_profile_web: in content_reports, ohne Melder, als Web-Meldung mit E-Mail
    expect(mock.table('content_reports')).toMatchObject([{
      reported_user_id: MARA_ID, reporter_id: null, reason: 'werbung', details: 'Verkauft etwas', status: 'offen',
      source: 'web', reporter_contact: 'melder@example.org',
      snapshot: { art: 'profil', username: 'mara', public_bio: 'Laufen, Heben, Schlafen.' },
    }])
  })

  test('Profil melden: zu viele Meldungen, unvollständige E-Mail und andere Fehler', async ({ page, mock }) => {
    mara(mock)
    let fehler = 'zu_viele_meldungen'
    mock.onRpc('report_public_profile_web', () => { throw new RpcError(fehler) })
    await page.goto('/u/mara')
    await page.locator('[data-web-report]').click()
    const sheet = page.locator('[data-report-sheet]')
    await sheet.locator('[data-report-reason="spam"]').check()
    await sheet.locator('[data-report-send]').click()
    await expect(sheet.locator('[data-report-web-error="zu_viele"]')).toContainText('Gerade gehen sehr viele Meldungen ein')
    await expect(sheet.locator('[data-report-web-imprint]')).toBeVisible()

    fehler = 'kontakt_ungueltig'
    await sheet.locator('[data-report-send]').click()
    await expect(sheet.locator('[data-report-web-error="kontakt"]')).toContainText('E-Mail-Adresse sieht unvollständig aus')
    await expect(sheet.locator('[data-report-web-imprint]')).toHaveCount(0)

    // z. B. Netzfehler oder das Profil ist inzwischen aus: Weg über das Impressum
    fehler = 'meldung_nicht_moeglich'
    await sheet.locator('[data-report-send]').click()
    await expect(sheet.locator('[data-report-web-error="fehler"]')).toContainText('Impressum')
    await sheet.locator('[data-report-web-imprint]').click()
    await expect(page).toHaveURL(/\/impressum$/)
  })
})

test.describe('ohne Anmeldung am Rechner', () => {
  test.use({
    angemeldet: false, isMobile: false, hasTouch: false, viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  })

  test('„In Hoku öffnen“ zeigt den Hoku-Code zum Scannen und den Weg in den Browser', async ({ page, mock }) => {
    mara(mock)
    await page.goto('/u/mara')
    const knopf = page.locator('[data-web-profile] .lg-btn-primary[data-web-open]')
    await expect(knopf).toHaveAttribute('aria-expanded', 'false')
    await knopf.click()
    await expect(knopf).toHaveAttribute('aria-expanded', 'true')
    const panel = page.locator('[data-web-desktop-open]').first()
    await expect(panel.locator('[data-hoku-code]')).toHaveAttribute('data-hoku-code', /\/u\/mara$/)
    await expect(panel.locator('[data-web-browser]')).toHaveAttribute('href', '/auth')
  })
})

test('„Ansehen als › Web-Link“ zeigt dieselbe Seite mit Band; melden geht dort nicht', async ({ page, mock }) => {
  Object.assign(mock.table('profiles')[0], {
    username: 'e2e', display_name: 'Eva', public_bio: 'Meine Bio', web_link_enabled: true,
    field_visibility: { bio: 'all', age: 'all', streak: 'all' },
  })
  mock.insert('profile_snapshots', { user_id: mock.table('profiles')[0].id, data: { age: { v: 29 }, streak: { days: 3 } } })
  await page.goto('/u/e2e?als=web')
  await expect(page.locator('[data-view-as="web"]')).toBeVisible()
  const web = page.locator('[data-web-profile]')
  await expect(web.locator('[data-profile-bio]')).toHaveText('Meine Bio')
  await expect(web.locator('[data-web-streak]')).toHaveText('3 Tage in Folge dabei')
  await expect(page.locator('[data-profile-tile]')).toHaveCount(0)
  await expect(web.locator('[data-web-report]')).toBeDisabled()

  // Web-Link aus: in der Vorschau dieselbe 404 wie im Web
  mock.table('profiles')[0].web_link_enabled = false
  await page.goto('/u/e2e?als=web')
  await expect(page.locator('[data-web-not-found]')).toContainText('Seite nicht gefunden')
  await expect(page.locator('[data-view-as="web"]')).toBeVisible()
})
