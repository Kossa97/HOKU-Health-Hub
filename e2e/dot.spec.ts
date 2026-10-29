import { TEST_USER } from './support/mockSupabase'
import { expect, test } from './support/fixtures'

test.use({ dotFrei: true })

/**
 * Dot, der KI-Coach: wohnt für alle in der Leiste. Bis Pro startet, kommt er
 * für alle heraus (PRO_PFLICHT aus). Chat nur mit Einwilligung.
 */

const logo = (page: import('@playwright/test').Page) => page.locator('[data-tyd-slot="dot"]')
const bereit = async (page: import('@playwright/test').Page) => {
  await expect(logo(page)).toHaveAttribute('data-dot-bereit', 'true')
}
const lassLaufen = async (page: import('@playwright/test').Page, ms: number) => {
  for (let t = 0; t < ms; t += 100) await page.clock.runFor(100)
}

test('bis Pro startet, kommt Dot auch ohne Pro heraus', async ({ page, mock }) => {
  await page.goto('/')
  await bereit(page)
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'true')
  await logo(page).click()
  await lassLaufen(page, 3000)
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'false')
  await expect(page.getByText('Dot kommt mit Pro heraus')).toHaveCount(0)
  expect(mock.coach.calls).toEqual([])
})

test('mit Pro: herausholen, einwilligen, fragen, zurück ins Haus', async ({ page, mock }) => {
  const profil = mock.table('profiles').find(row => row.id === TEST_USER.id)!
  profil.pro_until = '2099-01-01T00:00:00.000Z'
  mock.coach.antwort = 'Heute ist nichts geplant. Genieß den Tag.'
  await page.goto('/')
  await bereit(page)
  await logo(page).click()
  await lassLaufen(page, 3000)
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'false')

  const figur = page.getByRole('button', { name: /Dot, dein KI-Coach/ })
  await expect(figur).toBeVisible()
  // Seine Trefferfläche folgt dem atmenden Umriss und steht nie ganz still;
  // WebKit wartet sonst vergeblich auf ein „stabiles" Element
  await figur.click({ force: true })
  await lassLaufen(page, 600)

  const chat = page.getByRole('dialog', { name: 'Dot' })
  await expect(chat.getByRole('heading', { name: 'Bevor wir reden' })).toBeVisible()
  await chat.getByRole('button', { name: 'Einverstanden' }).click()
  await expect(chat.getByRole('button', { name: 'Was steht heute an?' })).toBeVisible()

  await chat.getByRole('button', { name: 'Was steht heute an?' }).click()
  await lassLaufen(page, 4000)
  await expect(chat.getByText('Heute ist nichts geplant. Genieß den Tag.')).toBeVisible()
  expect(mock.coach.calls).toHaveLength(1)
  expect(mock.coach.calls[0].nachrichten.at(-1)).toEqual({ rolle: 'ich', text: 'Was steht heute an?' })
  expect(mock.coach.calls[0].sprache).toBe('de')
  expect(mock.coach.calls[0].seite).toBe('home')

  await chat.getByRole('button', { name: 'Geh in dein Haus' }).click()
  await lassLaufen(page, 4000)
  await expect(chat).toBeHidden()
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'true')
})

test('dreimal schnell auf dieselbe Stelle tippen ruft Dot dorthin', async ({ page, mock }) => {
  const profil = mock.table('profiles').find(row => row.id === TEST_USER.id)!
  profil.pro_until = '2099-01-01T00:00:00.000Z'
  await page.goto('/')
  await bereit(page)
  await logo(page).click()
  await lassLaufen(page, 3000)
  const figur = page.getByRole('button', { name: /Dot, dein KI-Coach/ })
  await expect(figur).toBeVisible()
  // auf eine freie Fläche tippen: unter der leeren Stack-Karte
  await page.goto('/my-stack')
  await bereit(page)
  await lassLaufen(page, 1500)
  const karte = (await page.getByText('Noch keine Substanzen').boundingBox())!
  const vorher = (await figur.boundingBox())!
  const ziel = { x: vorher.x + vorher.width / 2 < 160 ? 240 : 80, y: karte.y + 260 }

  // zweimal reicht nicht
  await page.touchscreen.tap(ziel.x, ziel.y)
  await page.touchscreen.tap(ziel.x, ziel.y)
  await lassLaufen(page, 1500)
  let b = (await figur.boundingBox())!
  expect(Math.hypot(b.x + b.width / 2 - ziel.x, b.y + b.height / 2 - ziel.y)).toBeGreaterThan(60)

  for (let i = 0; i < 3; i++) await page.touchscreen.tap(ziel.x + i, ziel.y - i)
  await lassLaufen(page, 2500)
  b = (await figur.boundingBox())!
  expect(Math.hypot(b.x + b.width / 2 - ziel.x, b.y + b.height / 2 - ziel.y)).toBeLessThan(30)
})

test('Kalorientracker: Dot fliegt um die Kugel und sagt je Halt, was offen ist; danach alles zusammen', async ({ page, mock }) => {
  await page.goto('/ernaehrung')
  await expect(page.getByRole('region', { name: 'Frühstück' })).toBeVisible()
  const blase = page.locator('.tyd-dot-blase')
  // Je Halt ein Satz: Kugel, dann die drei Monde; gesammelt, während er fliegt
  const gesagt = new Set<string>()
  for (let t = 0; t < 12_000; t += 100) {
    await page.clock.runFor(100)
    const text = (await blase.textContent())?.trim()
    if (text && (await blase.getAttribute('data-zeigen')) === 'true') gesagt.add(text)
  }
  expect([...gesagt]).toEqual(expect.arrayContaining([
    'Noch alle 2000 kcal frei.', 'Eiweiß: noch 110 g.', 'Kohlenhydrate: noch 230 g.', 'Fett: noch 65 g.', 'Heute ist noch alles offen.',
  ]))
  // Gemerkt: frühestens in zwei Stunden wieder. Gesprochen wird ohne KI (keine Anfrage an den Coach).
  expect(await page.evaluate(() => localStorage.getItem('tyd.dot.rundflug.v1'))).toBeTruthy()
  expect(mock.coach.calls).toEqual([])
})
