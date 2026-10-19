import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'

/**
 * Das Dauer-Rad gleitet nach einer Pfeiltaste sanft zum neuen Wert. Stockt
 * das Gleiten unterwegs (WebKit unter Last), darf das Rad die Zwischenstellung
 * nicht als Wahl lesen — sonst springt der Wert kurz zurück und „Fertig"
 * speichert ihn.
 */

/** Stockendes Gleiten einbauen und den Editor eines neuen Chips bis zum Dauer-Rad oeffnen. */
async function oeffneRad(page: Page) {
  // Sanftes Scrollen, das bei 40 % des Wegs 150 ms anhält, ohne einzurasten.
  await page.addInitScript(() => {
    const original = Element.prototype.scrollTo
    Element.prototype.scrollTo = function (this: HTMLElement, arg?: ScrollToOptions | number, y?: number) {
      // Nur die Walzen; andere Fahrten auf der Seite bleiben unberuehrt.
      if (this.getAttribute('role') === 'spinbutton' && typeof arg === 'object' && arg?.behavior === 'smooth' && typeof arg.top === 'number') {
        const ziel = arg.top
        this.style.scrollSnapType = 'none'
        this.scrollTop += (ziel - this.scrollTop) * 0.4
        setTimeout(() => { this.scrollTop = ziel; this.style.scrollSnapType = '' }, 150)
        return
      }
      return (original as (a?: unknown, b?: unknown) => void).call(this, arg, y)
    } as typeof Element.prototype.scrollTo
  })

  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = page.getByRole('dialog', { name: /^(Neuer Tagebuch-Eintrag|Eintrag bearbeiten)$/ })
  await dialog.getByRole('button', { name: /^Mehr Energie, / }).click()
  const editor = page.getByRole('dialog', { name: 'Mehr Energie' })
  await editor.getByRole('button', { name: '4 – Stark' }).click()
  await editor.getByRole('group', { name: 'Dauer' }).getByRole('button', { name: 'Dauer' }).click()
  const zahl = editor.getByRole('spinbutton', { name: 'Dauer, Zahl' })
  return { dialog, editor, zahl }
}

test('Dauer-Rad: stockendes Gleiten setzt den Wert nicht zurück', async ({ page, mock }) => {
  void mock
  const { dialog, editor, zahl } = await oeffneRad(page)
  await zahl.press('ArrowDown')

  // Ueber die ganze Fahrt hinweg bleibt der Wert 2.
  const verlauf: (string | null)[] = []
  for (let schritt = 0; schritt < 12; schritt++) {
    await page.waitForTimeout(25)
    verlauf.push(await zahl.getAttribute('aria-valuetext'))
  }
  expect(verlauf.join(',')).toBe(Array(12).fill('2').join(','))
  // Und das Rad steht sichtbar auf dem Wert, nicht nur im Zustand.
  await expect.poll(() => zahl.evaluate(el => el.scrollTop)).toBe(34)

  await editor.getByRole('button', { name: 'Fertig' }).click()
  await expect(dialog.getByRole('button', { name: 'Mehr Energie, Wirkung, Intensität 4, Dauer 2 Std.' })).toBeVisible()
})

test('Dauer-Rad: Hin und gleich zurück endet sichtbar auf dem letzten Wert', async ({ page, mock }) => {
  void mock
  const { zahl } = await oeffneRad(page)
  await zahl.press('ArrowDown')
  await zahl.press('ArrowUp')
  await page.waitForTimeout(600)
  await expect(zahl).toHaveAttribute('aria-valuetext', '1')
  await expect.poll(() => zahl.evaluate(el => el.scrollTop)).toBe(0)
})
