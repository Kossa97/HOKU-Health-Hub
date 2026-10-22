import { TEST_USER } from './support/mockSupabase'
import { expect, test } from './support/fixtures'

/**
 * Dot, der KI-Coach: wohnt für alle in der Leiste, heraus kommt er nur mit
 * Pro (oder als Tester). Chat nur mit Einwilligung.
 */

const logo = (page: import('@playwright/test').Page) => page.locator('[data-tyd-slot="dot"]')
const bereit = async (page: import('@playwright/test').Page) => {
  await expect(logo(page)).toHaveAttribute('data-dot-bereit', 'true')
}
const lassLaufen = async (page: import('@playwright/test').Page, ms: number) => {
  for (let t = 0; t < ms; t += 100) await page.clock.runFor(100)
}

test('ohne Pro bleibt Dot im Haus und sagt, dass es Pro braucht', async ({ page, mock }) => {
  await page.goto('/')
  await bereit(page)
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'true')
  await logo(page).click()
  await lassLaufen(page, 600)
  await expect(page.getByText('Dot kommt mit Pro heraus')).toBeVisible()
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'true')
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
  await figur.click()
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
