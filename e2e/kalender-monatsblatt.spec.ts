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

/**
 * Am Griff des Blatts ziehen, in Schritten wie ein Finger — beim langsamen
 * Ziehen je Schritt ein Bild (16 ms) Seitenzeit. Das Blatt misst das Tempo des Zugs; ohne die Uhr
 * weiterzustellen kaemen alle Schritte im selben Augenblick an (WebKit unter
 * der festen Testuhr), und jedes langsame Ziehen waere ein Wurf.
 */
async function ziehe(page: Page, blatt: ReturnType<Page['getByRole']>, weg: number, schritte = 12) {
  const box = (await blatt.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + 12
  await page.mouse.move(x, y)
  await page.mouse.down()
  // Ein Wurf (wenige Schritte) bleibt so schnell, wie der Browser ihn schickt.
  if (schritte <= 2) {
    await page.mouse.move(x, y + weg, { steps: schritte })
    await page.mouse.up()
    return
  }
  for (let i = 1; i <= schritte; i++) {
    await page.clock.runFor(16)
    await page.mouse.move(x, y + (weg * i) / schritte)
  }
  await page.mouse.up()
}

/**
 * Federt das Blatt zurueck? Geprueft wird das Ziel, das der Zug setzt (kein
 * Inline-`transform` mehr), nicht der laufende Uebergang: den laesst WebKit
 * unter der festen Testuhr nicht verlaesslich weiterlaufen, dort blieb das
 * Blatt dann bei 40 oder 140 px stehen, obwohl es zurueckfederte.
 */
async function federtZurueck(blatt: ReturnType<Page['getByRole']>) {
  await expect.poll(() => blatt.evaluate(el => (el as HTMLElement).style.transform)).toBe('')
  await expect(blatt).toBeVisible()
}

test('Monatsblatt: nach unten ziehen schliesst es, ein kurzes Ziehen federt zurueck', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  const blatt = await oeffneMonatsblatt(page)

  // Ein kurzes, langsames Ziehen ist kein Wegwischen: das Blatt bleibt und
  // steht wieder — auch wenn es beim Zugreifen noch einfuhr.
  await ziehe(page, blatt, 40, 30)
  await expect(blatt).toBeVisible()
  await federtZurueck(blatt)

  // Weit genug nach unten: es geht zu.
  await ziehe(page, blatt, 220)
  await expect(blatt).toBeHidden()

  // Und es oeffnet danach wieder ganz normal.
  await page.getByRole('button', { name: 'Monatsübersicht öffnen' }).click()
  await expect(page.getByRole('dialog', { name: 'September 2026' })).toBeVisible()
})

test('Monatsblatt: noch tief beim Greifen — ein kurzes Ziehen schickt es nicht weg', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  const blatt = await oeffneMonatsblatt(page)
  await expect.poll(async () => { await page.clock.runFor(100); return blatt.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42) }).toBe(0)
  // Wie mitten in der Einfahrt: das Blatt steht noch 100 px tiefer. Der Finger
  // zieht nur 40 px — das ist kein Wegwischen. Frueher zaehlte die Lage
  // (140 px ≥ 110) und es ging zu; halb aus dem Bild ist es dabei nicht
  // (auf dem iPhone ist das Blatt rund 400 px hoch).
  await blatt.evaluate(el => { el.style.animation = 'none'; el.style.transition = 'none'; el.style.transform = 'translateY(100px)' })
  await ziehe(page, blatt, 40, 30)
  await federtZurueck(blatt)
  await expect(blatt).toBeVisible()

})

test('Monatsblatt: steht es nach dem Zug mehr als halb aus dem Bild, geht es zu', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  const blatt = await oeffneMonatsblatt(page)
  await expect.poll(async () => { await page.clock.runFor(100); return blatt.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42) }).toBe(0)
  // Schon halb unten gegriffen (wie mitten in der Einfahrt), 40 px weiter: zu.
  const hoehe = await blatt.evaluate(el => (el as HTMLElement).offsetHeight)
  await blatt.evaluate((el, tief) => { el.style.animation = 'none'; el.style.transition = 'none'; el.style.transform = `translateY(${tief}px)` }, Math.round(hoehe / 2))
  await ziehe(page, blatt, 40, 30)
  await expect(blatt).toBeHidden()
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
