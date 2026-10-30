import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { seedPeptide } from './support/myStack'

function zeile(page: Page, name: string): Locator {
  return page.locator('[data-due-row]').filter({ hasText: name })
}

/** Die nächste Einnahme steht aufgeklappt da; zum Ziehen alle zuklappen. */
async function alleZu(page: Page) {
  const offen = page.locator('[data-due-open] [data-due-item]')
  if (await offen.count()) await offen.first().click()
  await expect(page.locator('[data-due-open]')).toHaveCount(0)
}

/**
 * Mit dem Finger gedrueckt halten und auf ein Ziel ziehen, wie auf dem Handy:
 * erst halten, bis die Zeile sich anhebt, dann in Schritten hinueber und dort
 * kurz verweilen. Die feste Testuhr laeuft nur, wenn wir sie weiterstellen.
 */
/** Bei einer Einnahme die Zeile selbst (ohne Kreis), sonst das Element. */
function griff(ort: Locator): Locator {
  return ort.locator('[data-due-item]').or(ort.filter({ hasNot: ort.page().locator('[data-due-item]') })).first()
}

async function ziehe(page: Page, von: Locator, nach: Locator, { ziel: mitZiel = true } = {}) {
  const a = (await griff(von).boundingBox())!
  const b = (await griff(nach).boundingBox())!
  const start = { x: a.x + a.width * 0.4, y: a.y + a.height / 2 }
  const ziel = { x: b.x + b.width * 0.4, y: b.y + Math.min(b.height / 2, 24) }
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
  // Halten, bis die Zeile wirklich angehoben ist — die Seite sieht den Druck
  // unter Last erst etwas spaeter, und die Uhr steht sonst einfach still.
  await expect.poll(async () => {
    await page.clock.runFor(100)
    return page.evaluate(() => document.body.hasAttribute('data-zieht'))
  }).toBe(true)
  const schritte = 10
  for (let i = 1; i <= schritte; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
      x: start.x + ((ziel.x - start.x) * i) / schritte,
      y: start.y + ((ziel.y - start.y) * i) / schritte,
    }] })
    await page.clock.runFor(16)
  }
  // Verweilen, bis das Ziel markiert ist (wie bei Ordnern auf dem iPhone).
  if (mitZiel) {
    await expect.poll(async () => {
      await page.clock.runFor(100)
      return page.evaluate(() => Boolean(document.querySelector('[data-zieh-ziel]')))
    }).toBe(true)
  } else {
    await page.clock.runFor(300)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

test.describe('Kalender: Bündel ziehen', () => {
  test.beforeEach(({ browserName }, info) => {
    test.skip(browserName !== 'chromium', 'echte Touch-Ereignisse brauchen Chromium-CDP')
    test.skip(!info.project.use.hasTouch, 'braucht Touch')
  })

  test('zwei Einnahmen derselben Tageszeit aufeinander ergeben ein Bündel', async ({ page, mock }) => {
    seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
    seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
    await page.goto('/kalender')
    await expect(zeile(page, 'TB-500')).toBeVisible()
    await alleZu(page)
    const scrollVorher = await page.evaluate(() => window.scrollY)

    await ziehe(page, zeile(page, 'BPC-157'), zeile(page, 'TB-500'))

    // Gleich zum Benennen offen; die Seite ist dabei nicht mitgescrollt.
    const name = page.getByRole('textbox', { name: 'Bündel benennen' })
    await expect(name).toBeVisible()
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollVorher)
    await name.fill('Morgenroutine')
    await page.getByRole('button', { name: 'Fertig' }).click()

    const karte = page.locator('[data-bundle-row]')
    await expect(karte).toHaveCount(1)
    await expect(karte).toContainText('Bündel · 2 Einnahmen')
    await expect(karte).toContainText('Morgenroutine')
    // Die beiden stehen nicht mehr einzeln da.
    await expect(page.locator('[data-periode-bloecke] > .lg-group:not([data-bundle-row]) [data-due-row]')).toHaveCount(0)
    await expect.poll(() => mock.table('intake_bundles').map(row => ({
      name: row.name, anzahl: (row.stack_item_ids as string[]).length,
    }))).toEqual([{ name: 'Morgenroutine', anzahl: 2 }])
  })

  test('„Rückgängig" beim Benennen legt kein Bündel an', async ({ page, mock }) => {
    seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
    seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
    await page.goto('/kalender')
    await expect(zeile(page, 'TB-500')).toBeVisible()
    await alleZu(page)

    await ziehe(page, zeile(page, 'BPC-157'), zeile(page, 'TB-500'))
    await expect(page.getByRole('textbox', { name: 'Bündel benennen' })).toBeVisible()
    await page.getByRole('button', { name: 'Rückgängig' }).first().click()

    await expect(page.locator('[data-bundle-row]')).toHaveCount(0)
    await expect(zeile(page, 'BPC-157')).toBeVisible()
    await expect(zeile(page, 'TB-500')).toBeVisible()
    await alleZu(page)
    await expect.poll(() => mock.table('intake_bundles').length).toBe(0)
  })

  test('in eine andere Tageszeit gezogen federt die Einnahme zurück und sagt warum', async ({ page, mock }) => {
    seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
    seedPeptide(mock, 'TB-500', { startDate: '2026-09-01', intakeTime: 'abends' })
    await page.goto('/kalender')
    await expect(zeile(page, 'TB-500')).toBeVisible()
    await alleZu(page)

    // Auf die Abends-Ueberschrift: auf dem kleinen iPhone liegt TB-500 selbst
    // unter der Tab-Leiste.
    await ziehe(page, zeile(page, 'BPC-157'), page.locator('[data-periode-abschnitt="abends"]').getByText('Abends', { exact: true }), { ziel: false })

    await expect(page.getByText('Bündel gehen nur innerhalb einer Tageszeit')).toBeVisible()
    await page.clock.runFor(500)
    await expect(page.locator('[data-bundle-row]')).toHaveCount(0)
    await expect(page.locator('[data-ziehbild]')).toHaveCount(0)
    expect(mock.table('intake_bundles')).toHaveLength(0)
  })
})

test('Vial: die Zeile nennt die Einheiten auf der Spritze', async ({ page, mock }) => {
  // 5 mg im Vial auf 2 ml: 250 mcg sind 0,1 ml, auf der U-100-Spritze 10 E.
  seedPeptide(mock, 'BPC-157', {
    startDate: '2026-09-01',
    form: { dosage_form: 'vial', zutat: { amount_value: 5, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial' } },
    inventory: { package_quantity: 5, package_unit: 'vial', remaining_quantity: 5, reconstitution_ml: 2 },
  })
  await page.goto('/kalender')
  await expect(zeile(page, 'BPC-157')).toContainText('250 mcg · 10 E · Subkutan')
})
