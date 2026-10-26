import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support/fixtures'

/** Am Griff des Blatts ziehen, in Schritten wie ein Finger. */
async function zieheAmGriff(page: Page, blatt: Locator, weg: number, schritte = 12) {
  const griff = blatt.locator('[data-sheet-griff]')
  const box = (await griff.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + weg, { steps: schritte })
  await page.mouse.up()
}

test('Blatt ohne eigene Ausfahrt (Tagebuch): am Griff wegziehen schliesst es, kurz ziehen nicht', async ({ page, mock }) => {
  void mock
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const formular = page.getByRole('dialog', { name: 'Neuer Tagebuch-Eintrag' })
  await expect(formular).toBeVisible()
  // Die Griff-Flaeche ragt nicht seitlich hinaus — das Blatt scrollt nicht quer.
  expect(await formular.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0)

  await zieheAmGriff(page, formular, 40, 30)
  await expect(formular).toBeVisible()
  // Die Uhr der Seite steht (Fixture); das Zurueckfedern ist ein CSS-Uebergang,
  // den WebKit erst weiterlaufen laesst, wenn sie weitergeht
  await expect.poll(async () => { await page.clock.runFor(100); return formular.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42) }).toBe(0)

  await zieheAmGriff(page, formular, 240)
  await expect(formular).toBeHidden()
})

test('Lehnt das Blatt das Schliessen ab (ungespeicherte Aenderungen), kommt es zurueck', async ({ page, mock }) => {
  void mock
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const formular = page.getByRole('dialog', { name: 'Neuer Tagebuch-Eintrag' })
  await formular.getByLabel('Titel').fill('Morgens')
  // „Änderungen verwerfen?" — nein.
  page.once('dialog', dialog => void dialog.dismiss())
  await zieheAmGriff(page, formular, 240)
  await expect.poll(async () => { await page.clock.runFor(100); return formular.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42) }).toBe(0)
  await expect(formular).toBeVisible()
  await expect(formular.getByLabel('Titel')).toHaveValue('Morgens')
  // Und es laesst sich weiter bedienen.
  await formular.getByLabel('Titel').fill('Abends')
  await expect(formular.getByLabel('Titel')).toHaveValue('Abends')
})
