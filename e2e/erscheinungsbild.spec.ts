import { expect, test } from './support/fixtures'

test('Erscheinungsbild: Licht im Profil wählen, bleibt nach dem Neuladen', async ({ page, mock }) => {
  void mock
  await page.goto('/profil')
  await expect(page.locator('html')).toHaveAttribute('data-look', 'schwarz')
  // Schwarz: das Umgebungslicht ist unsichtbar
  await expect(page.locator('.lg-ambient')).toHaveCSS('visibility', 'hidden')

  const umschalter = page.locator('[data-look-switcher]')
  await umschalter.getByRole('button', { name: 'Licht' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'licht')
  await expect(page.locator('.lg-ambient')).toHaveCSS('visibility', 'visible')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'licht')
  await expect(umschalter.getByRole('button', { name: 'Licht' })).toHaveAttribute('aria-pressed', 'true')
})
