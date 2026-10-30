import { expect, test } from './support/fixtures'
import { seedTrackedIntake } from './support/intake'

/**
 * „Schwarz": Die Kante jeder Karte glänzt dort, wo sie zu einem Licht vor
 * dem Bildschirm zeigt (Mitte, etwas oberhalb der Hälfte) — beim Scrollen
 * wandert der Glanz um die Kante.
 */
test('Taschenlampen-Kante: der Glanz zeigt zum Licht und wandert beim Scrollen', async ({ page, mock }) => {
  seedTrackedIntake(mock)
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-look', 'schwarz')
  const karten = page.locator('main .lg-surface')
  const winkel = (index: number) => karten.nth(index).evaluate(el => parseFloat(el.style.getPropertyValue('--la')))

  // Oben über dem Licht: Glanz an der Unterkante; darunter: an der Oberkante.
  // Nach dem Laden baut Home die 3D-Torso-Vorschau auf; mit Software-WebGL
  // (Gerätetests) dauert das mehrere Sekunden, in denen kein Bild gezeichnet
  // wird — erst danach steht der Glanz der zweiten Karte (gemessen: nach 6 s richtig).
  await expect.poll(() => winkel(0), { timeout: 20_000 }).toBeCloseTo(180, 0)
  await expect.poll(() => winkel(1), { timeout: 20_000 }).toBeCloseTo(0, 0)

  // Scrollt die zweite Karte über das Licht hinaus, wandert ihr Glanz nach unten
  // Kein Mausrad: mobiles WebKit kennt es nicht
  await page.evaluate(() => window.scrollBy(0, 320))
  await expect.poll(() => winkel(1)).toBeCloseTo(180, 0)
})
