import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'

/** Sprachauswahl: zum Start nur Deutsch und Englisch. */

test('Erster Start: Auswahl zeigt nur Deutsch und Englisch, die Wahl gilt sofort und bleibt', async ({ page, mock }) => {
  void mock
  await page.addInitScript(userId => {
    if (sessionStorage.getItem('__e2e_lang_gate')) return
    sessionStorage.setItem('__e2e_lang_gate', '1')
    localStorage.removeItem(`tyd_lang_picked_${userId}`)
  }, TEST_USER.id)
  await page.goto('/')

  const auswahl = page.getByRole('dialog', { name: 'Wähle deine Sprache' })
  await expect(auswahl).toBeVisible()
  await expect(auswahl.getByRole('radio')).toHaveText(['Deutsch', 'English'])
  await expect(auswahl.getByRole('radio', { name: /Deutsch/ })).toHaveAttribute('aria-checked', 'true')
  await page.screenshot({ path: 'test-results/sprache-start-de.png' })

  await auswahl.getByRole('radio', { name: /English/ }).click()
  const choose = page.getByRole('dialog', { name: 'Choose your language' })
  await expect(choose).toBeVisible()
  await page.screenshot({ path: 'test-results/sprache-start-en.png' })
  await choose.getByRole('button', { name: 'Continue' }).click()
  await expect(choose).toBeHidden()

  await page.reload()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('Profil: Umschalter mit genau zwei Sprachen, ohne Anleitung', async ({ page, mock }) => {
  void mock
  await page.goto('/profil')

  const deutsch = page.getByRole('button', { name: /Deutsch/ })
  const english = page.getByRole('button', { name: /English/ })
  await expect(deutsch).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Español')).toHaveCount(0)
  await english.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/sprache-profil.png' })

  await english.click()
  await expect(english).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Language', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('tyd_lang'))).toBe('en')
})
