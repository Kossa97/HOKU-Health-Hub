import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'

/**
 * Moment „Neuer Rang“ (Titel, Task 5): Wer einen Eintrag speichert, der die
 * Schwelle von 10 Tagen mit Eintrag nimmt, sieht nach dem Schnappschuss-Lauf
 * „Ab heute: Entdecker.“ und wird gefragt, wer den Titel sehen soll.
 *
 * Heute ist der 28.09.2026 (fixtures.ts); neun Tage mit Eintrag davor.
 */

function neunTage(mock: MockSupabase, earned: Record<string, string>) {
  for (let d = 19; d <= 27; d++) {
    mock.insert('daily_logs', {
      user_id: TEST_USER.id, log_date: `2026-09-${d}`, energie: 6, schlaf: 7, wohlbefinden: 6, libido: 5, body_fat_pct: null, muscle_mass_kg: null,
    })
  }
  mock.insert('progress_settings', {
    user_id: TEST_USER.id, start_on: null, previous_starts: [], directions: {}, baselines: {}, history: [], earned_badges: earned,
  })
}

const profil = (mock: MockSupabase) => mock.table('profiles').find(row => row.id === TEST_USER.id)!
const verdient = (mock: MockSupabase) =>
  (mock.table('progress_settings').find(row => row.user_id === TEST_USER.id)!.earned_badges ?? {}) as Record<string, string>

/** Jede Animation im Moment mitschreiben: welche Eigenschaften er bewegt. */
async function animationenMitschreiben(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const log: string[] = []
    Object.assign(window, { __animiert: log })
    const original = Element.prototype.animate
    Element.prototype.animate = function (this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
      if (this.closest('.tm-root') && Array.isArray(keyframes)) log.push(...keyframes.flatMap(k => Object.keys(k)))
      return original.call(this, keyframes, options)
    }
  })
}
const animiert = (page: import('@playwright/test').Page) =>
  page.evaluate(() => [...new Set((window as unknown as { __animiert: string[] }).__animiert)].sort())

async function eintragSpeichern(page: import('@playwright/test').Page) {
  await page.goto('/progress')
  await page.getByRole('button', { name: /^(Werte eintragen|Eintrag bearbeiten)$/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Fortschritt eintragen' })
  await sheet.getByRole('slider', { name: 'Energie' }).fill('8')
  await sheet.getByRole('button', { name: 'Eintrag speichern', exact: true }).click()
  await expect(sheet).toBeHidden()
}

test('zehnter Tag mit Eintrag: Moment „Ab heute: Entdecker.“, Sichtbarkeit wird als Feldstufe gespeichert', async ({ page, mock }) => {
  neunTage(mock, { rank_1: '2026-09-19', first_daily_log: '2026-09-19' })
  await animationenMitschreiben(page)
  await eintragSpeichern(page)

  const moment = page.getByRole('dialog', { name: 'Entdecker' })
  // Der Schnappschuss läuft entprellt nach dem Speichern (2 s) und rechnet dann.
  await expect(moment).toBeVisible({ timeout: 15_000 })
  await expect(moment).toContainText('Neuer Rang')
  await expect(moment).toContainText('Ab heute: Entdecker.')
  await expect(moment).toContainText('10 Tage, an denen du selbst etwas eingetragen hast.')
  expect(verdient(mock)).toHaveProperty('rank_2', '2026-09-28')
  await expect(moment).toBeFocused()
  // Nur transform und opacity
  expect(await animiert(page)).toEqual(['opacity', 'transform'])

  // Rang getragen: Fertig / Titel ansehen
  await expect(moment.locator('[data-titel-moment-act]')).toHaveText(['Fertig', 'Titel ansehen'])

  // Wer soll deinen Titel sehen? Standard Nur ich
  const frage = moment.getByRole('group', { name: 'Wer soll deinen Titel sehen?' })
  await expect(frage.getByRole('button', { name: 'Nur ich' })).toHaveAttribute('aria-pressed', 'true')
  await frage.getByRole('button', { name: 'Freunde' }).click()
  await expect(frage.getByRole('button', { name: 'Freunde' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => (profil(mock).field_visibility as Record<string, string>).title).toBe('friends')

  if (process.env.SCREENSHOT_DIR) {
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/titel-moment-rang.png` })
  }

  await moment.getByRole('button', { name: 'Fertig' }).click()
  await expect(moment).toHaveCount(0)
  expect(profil(mock).title_choice ?? null).toBeNull()
})

test('trägt ein Abzeichen: „Als Titel tragen“ wechselt zum Rang; Bewegung reduziert blendet nur ein', async ({ page, mock }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await animationenMitschreiben(page)
  neunTage(mock, { rank_1: '2026-09-19', run_10: '2026-09-20' })
  Object.assign(profil(mock), { title_choice: 'run_10', field_visibility: { title: 'all' } })
  await eintragSpeichern(page)

  const moment = page.getByRole('dialog', { name: 'Entdecker' })
  await expect(moment).toBeVisible({ timeout: 15_000 })
  await expect(moment).toContainText('Du trägst gerade Jogger.')
  const frage = moment.getByRole('group', { name: 'Wer soll deinen Titel sehen?' })
  await expect(frage.getByRole('button', { name: 'Alle' })).toHaveAttribute('aria-pressed', 'true')
  // Ohne Bewegung: nur Einblenden, kein Lichtstreif
  expect(await animiert(page)).toEqual(['opacity'])

  await moment.getByRole('button', { name: 'Als Titel tragen' }).click()
  await expect(moment).toHaveCount(0)
  await expect.poll(() => profil(mock).title_choice).toBeNull()
  await expect(page.getByText('Entdecker steht jetzt unter deinem Namen.')).toBeVisible()
})

test('Escape schließt den Moment, „Später“-Fall ohne Änderung', async ({ page, mock }) => {
  neunTage(mock, { rank_1: '2026-09-19', run_10: '2026-09-20' })
  Object.assign(profil(mock), { title_choice: 'run_10' })
  await eintragSpeichern(page)
  const moment = page.getByRole('dialog', { name: 'Entdecker' })
  await expect(moment).toBeVisible({ timeout: 15_000 })
  await expect(moment.locator('[data-titel-moment-act]')).toHaveText(['Als Titel tragen', 'Später'])
  await page.keyboard.press('Escape')
  await expect(moment).toHaveCount(0)
  expect(profil(mock).title_choice).toBe('run_10')
})

test('„Titel ansehen“ öffnet das Profil', async ({ page, mock }) => {
  neunTage(mock, { rank_1: '2026-09-19' })
  await eintragSpeichern(page)
  const moment = page.getByRole('dialog', { name: 'Entdecker' })
  await expect(moment).toBeVisible({ timeout: 15_000 })
  await moment.getByRole('button', { name: 'Titel ansehen' }).click()
  await expect(page).toHaveURL(/\/profil$/)
  await expect(moment).toHaveCount(0)
})
