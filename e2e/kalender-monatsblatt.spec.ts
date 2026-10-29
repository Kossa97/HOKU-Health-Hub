import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { seedBpc157 } from './support/myStack'

async function oeffneMonatsblatt(page: Page) {
  await page.goto('/kalender')
  await page.getByRole('button', { name: 'Monatsübersicht öffnen' }).click()
  const blatt = page.getByRole('dialog', { name: 'September 2026' })
  await expect(blatt).toBeVisible()
  return blatt
}

/** Am Griff des Blatts ziehen, in Schritten wie ein Finger. */
async function ziehe(page: Page, blatt: ReturnType<Page['getByRole']>, weg: number, schritte = 12) {
  const box = (await blatt.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + 12
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + weg, { steps: schritte })
  await page.mouse.up()
}

test('Monatsblatt: nach unten ziehen schliesst es, ein kurzes Ziehen federt zurueck', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  const blatt = await oeffneMonatsblatt(page)

  // Ein kurzes, langsames Ziehen ist kein Wegwischen: das Blatt bleibt und
  // steht wieder — auch wenn es beim Zugreifen noch einfuhr.
  await ziehe(page, blatt, 40, 30)
  await expect(blatt).toBeVisible()
  // Die Uhr der Seite steht (Fixture); das Zurueckfedern ist ein CSS-Uebergang,
  // den WebKit erst weiterlaufen laesst, wenn sie weitergeht
  await expect.poll(async () => { await page.clock.runFor(100); return blatt.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42) }).toBe(0)

  // Weit genug nach unten: es geht zu.
  await ziehe(page, blatt, 220)
  await expect(blatt).toBeHidden()

  // Und es oeffnet danach wieder ganz normal.
  await page.getByRole('button', { name: 'Monatsübersicht öffnen' }).click()
  await expect(page.getByRole('dialog', { name: 'September 2026' })).toBeVisible()
})

test('Monatsblatt: ein kurzer schneller Wurf nach unten schliesst es auch', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  const blatt = await oeffneMonatsblatt(page)
  await expect.poll(async () => { await page.clock.runFor(100); return blatt.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42) }).toBe(0)
  await ziehe(page, blatt, 60, 2)
  await expect(blatt).toBeHidden()
})

test('Monatsblatt: Tipps in der Kopfzeile bleiben Tipps', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  const blatt = await oeffneMonatsblatt(page)
  await blatt.getByRole('button', { name: 'Nächster Monat' }).click()
  await expect(page.getByRole('dialog', { name: 'Oktober 2026' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Oktober 2026' }).getByRole('button', { name: 'Schließen' }).click()
  await expect(page.getByRole('dialog', { name: 'Oktober 2026' })).toBeHidden()
})
