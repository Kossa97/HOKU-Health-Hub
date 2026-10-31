import { expect, test } from './support/fixtures'

test('Erscheinungsbild: Licht im Profil wählen, bleibt nach dem Neuladen', async ({ page, mock }) => {
  void mock
  await page.goto('/profil')
  await expect(page.locator('html')).toHaveAttribute('data-look', 'hoku')
  // HOKU (Standard): das Umgebungslicht ist unsichtbar
  await expect(page.locator('.lg-ambient')).toHaveCSS('visibility', 'hidden')

  const umschalter = page.locator('[data-look-switcher]')
  await umschalter.getByRole('button', { name: 'Licht' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'licht')
  await expect(page.locator('.lg-ambient')).toHaveCSS('visibility', 'visible')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'licht')
  await expect(umschalter.getByRole('button', { name: 'Licht' })).toHaveAttribute('aria-pressed', 'true')
})

test('Erscheinungsbild: Soft Dark — Anthrazit statt Schwarz, blaue Bedienung', async ({ page, mock }) => {
  void mock
  await page.goto('/profil')
  const umschalter = page.locator('[data-look-switcher]')
  await umschalter.getByRole('button', { name: 'Soft Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'softdark')
  // Kein Schwarz mehr auf dem Grund, und die Auswahl im Umschalter ist blau
  await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(umschalter.locator('.lg-seg-pill')).toHaveCSS('background-image', /linear-gradient/)

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'softdark')
})

test('Erscheinungsbild: HOKU ist Standard — fester Grund, Plex, kein Glas', async ({ page, mock }) => {
  void mock
  await page.goto('/profil')
  await expect(page.locator('html')).toHaveAttribute('data-look', 'hoku')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 15, 18)')
  await expect(page.locator('body')).toHaveCSS('font-family', /IBM Plex Sans/)
  await expect(page.locator('.tyd-tabbar')).toHaveCSS('backdrop-filter', 'none')
  const umschalter = page.locator('[data-look-switcher]')
  await expect(umschalter.getByRole('button', { name: 'HOKU' })).toHaveAttribute('aria-pressed', 'true')
})
