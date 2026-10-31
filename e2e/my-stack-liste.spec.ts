import { expect, test } from './support/fixtures'
import { seedPeptide } from './support/myStack'

/**
 * My Stack als Liste: je Substanz eine kompakte Zeile — fuer jede
 * Darreichungsform gleich: Name, aktiv/inaktiv, Zusammensetzung,
 * Haltbarkeit. Ein Tipp oeffnet das Vollbild; Bearbeiten und Loeschen
 * stehen dort — und unter der Zeile, wenn man sie nach links wischt.
 * Gegliedert nach Dringlichkeit: Ablaufendes zuerst, dann aktiv, inaktiv.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tyd_peptide_view', 'list'))
})

function zeile(page: import('@playwright/test').Page, name: string) {
  return page.locator('[data-list-row]', { has: page.getByText(name, { exact: true }) })
}

test('Liste: Name, Zusammensetzung, Haltbarkeit und aktiv/inaktiv — für jede Form', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', {
    startDate: '2026-09-01',
    inventory: { package_quantity: 5, package_unit: 'vial', remaining_quantity: 3, reconstitution_ml: 2, expires_at: '2027-03-31' },
  })
  // Eine Tablette ohne Plan: inaktiv, und ihre Haltbarkeit ist bald um.
  seedPeptide(mock, 'Magnesium', {
    startDate: '2026-09-01',
    category: 'supplement',
    plan: false,
    form: { dosage_form: 'tablet', zutat: { amount_value: 400, amount_unit: 'mg', basis_value: 1, basis_unit: 'tablet' } },
    inventory: { package_quantity: 60, package_unit: 'tablet', remaining_quantity: 40, expires_at: '2026-10-01' },
  })
  await page.goto('/my-stack')

  const bpc = zeile(page, 'BPC-157')
  await expect(bpc).toBeVisible()
  await expect(bpc).toContainText('Aktiv')
  await expect(bpc).toContainText('5 mg / 2 ml')
  // Wie im Karussell: „Haltbar noch n Tage" — hier das Datum auf der Packung.
  await expect(bpc.locator('[data-haltbarkeit="gut"]')).toHaveText(/^Haltbar noch \d+ Tage$/)

  const magnesium = zeile(page, 'Magnesium')
  await expect(magnesium).toContainText('Inaktiv')
  await expect(magnesium).toContainText('400 mg / 1 Tablette')
  await expect(magnesium.locator('[data-haltbarkeit="bald"]')).toHaveText('Haltbar noch 3 Tage')

  // Nur diese vier Angaben: keine Einnahme, kein Vorrat, keine sichtbaren Aktionen.
  await expect(bpc).not.toContainText('250 mcg')
  await expect(bpc).not.toContainText('Vials')
  await expect(bpc.getByRole('button', { name: 'Löschen' })).toHaveCount(0)
  await expect(bpc.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)

  // Kompakt: deutlich mehr als drei Substanzen passen auf einen Bildschirm.
  expect((await bpc.boundingBox())!.height).toBeLessThanOrEqual(96)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('Liste: Antippen öffnet das Vollbild, Zurück schließt es', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  await page.goto('/my-stack')

  await page.getByRole('button', { name: 'BPC-157 öffnen' }).click()
  const detail = page.getByRole('dialog', { name: 'BPC-157' })
  await expect(detail).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Bearbeiten' })).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Löschen' })).toBeVisible()
  await expect(detail.getByText('Nächste Einnahme')).toBeVisible()

  await page.goBack()
  await expect(detail).toBeHidden()
  await expect(page.getByRole('button', { name: 'BPC-157 öffnen' })).toBeVisible()
})

test('Liste: abgelaufen steht ausgeschrieben da, wie im Karussell', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', {
    startDate: '2026-09-01',
    inventory: { package_quantity: 5, package_unit: 'vial', remaining_quantity: 3, reconstitution_ml: 2, expires_at: '2026-09-20' },
  })
  await page.goto('/my-stack')
  // Ausgeschrieben, ohne Rahmen: alarmieren tut nur das Symbol.
  await expect(zeile(page, 'BPC-157').locator('[data-expired-badge]')).toHaveText('Seit 8 Tagen abgelaufen!')

  // Dieselbe Substanz im Karussell: das Abzeichen im Wechsel — „Abgelaufen"
  // und „seit 8 Tagen", vorgelesen zusammen.
  await page.evaluate(() => localStorage.setItem('tyd_peptide_view', 'vials'))
  await page.addInitScript(() => localStorage.setItem('tyd_peptide_view', 'vials'))
  await page.reload()
  const karussell = page.locator('[data-my-stack-carousel] [data-expired-badge="wechsel"]')
  await expect(karussell).toContainText('Abgelaufen')
  await expect(karussell).toContainText('seit 8 Tagen')
})

test('Vollbild: Haltbarkeit oben links; abgelaufen angemischt — der Anmisch-Knopf alarmiert', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', {
    startDate: '2026-09-01',
    inventory: { package_quantity: 5, package_unit: 'vial', remaining_quantity: 3, reconstitution_ml: 2, opened_at: '2026-08-20', use_within_days: 28 },
  })
  seedPeptide(mock, 'TB-500', {
    startDate: '2026-09-01',
    inventory: { package_quantity: 5, package_unit: 'vial', remaining_quantity: 3, reconstitution_ml: 2, expires_at: '2027-03-31' },
  })
  await page.goto('/my-stack')

  await page.getByRole('button', { name: 'BPC-157 öffnen' }).click()
  const detail = page.getByRole('dialog', { name: 'BPC-157' })
  await expect(detail.locator('[data-stage-detail-top-left] [data-expired-badge]')).toHaveText('Seit 11 Tagen abgelaufen!')
  await expect(detail.getByRole('button', { name: 'Neu rekonstituieren' })).toHaveAttribute('data-anmischen-alarm', 'true')
  await page.goBack()

  // Nicht abgelaufen: Haltbarkeit oben links, der Knopf bleibt ruhig.
  await page.getByRole('button', { name: 'TB-500 öffnen' }).click()
  const tb = page.getByRole('dialog', { name: 'TB-500' })
  await expect(tb.locator('[data-stage-detail-top-left] [data-haltbarkeit="gut"]')).toBeVisible()
  await expect(tb.locator('[data-anmischen-alarm]')).toHaveCount(0)
})

test('Nasenspray: Einnahme in Sprühstößen, Bestand in Sprays, Knopf „Neues Spray öffnen"', async ({ page, mock }) => {
  seedPeptide(mock, 'Semax', {
    startDate: '2026-09-01',
    form: { dosage_form: 'nasal_spray', zutat: { amount_value: 125, amount_unit: 'mcg', basis_value: 1, basis_unit: 'spray' } },
    inventory: { package_quantity: 100, package_unit: 'spray', remaining_quantity: 240, opened_at: '2026-09-20', use_within_days: 30 },
  })
  await page.goto('/my-stack')
  await page.getByRole('button', { name: 'Semax öffnen' }).click()
  const detail = page.getByRole('dialog', { name: 'Semax' })

  // 250 mcg bei 125 mcg je Sprühstoß.
  await expect(detail.locator('[data-einnahme-hinweis]').first()).toHaveText('= 2 Sprühstöße')
  await expect(detail.locator('[data-stack-detail="bestand"]')).toContainText('2 Sprays')
  await expect(detail.locator('[data-stack-detail="bestand"]')).toContainText('+ 1 geöffnet · 40 %')
  await expect(detail.getByRole('button', { name: 'Neues Spray öffnen' })).toBeVisible()
  // Zusammensetzung: je Sprühstoß, übersetzt.
  await expect(detail.locator('[data-stack-detail-field="wirkstoff"]')).toContainText('Wirkstoff pro Sprühstoß')
  await expect(detail.locator('[data-stack-detail-field="wirkstoff"]')).toContainText('125 mcg / 1 Sprühstoß')
})

/**
 * Zieht die Zeile mit dem Zeiger waagerecht um `dx` Pixel. `ruhig`: langsam
 * und vor dem Loslassen stillhalten — dann zaehlt nur die Strecke, nicht der
 * Schwung.
 */
async function wische(page: import('@playwright/test').Page, row: import('@playwright/test').Locator, dx: number, ruhig = false) {
  const box = (await row.boundingBox())!
  const y = box.y + box.height / 2
  const x = box.x + box.width * 0.7
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(x + (dx * i) / 6, y)
    if (ruhig) await page.waitForTimeout(30)
  }
  if (ruhig) await page.waitForTimeout(150)
  await page.mouse.up()
}

test('Liste: nach links wischen zeigt Bearbeiten und Löschen; Tipp daneben schließt', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
  await page.goto('/my-stack')

  const bpc = zeile(page, 'BPC-157')
  await expect(bpc.getByRole('button', { name: 'Löschen' })).toHaveCount(0)
  // In Ruhe ist von den Aktionen nichts zu sehen — auch kein roter Rand an
  // der runden Ecke (Safari schnitt ihn nicht sauber ab).
  await expect(bpc.locator('[data-list-actions]')).toBeHidden()
  await wische(page, bpc, -160)
  await expect(bpc.locator('[data-list-actions]')).toBeVisible()
  await expect(bpc).toHaveAttribute('data-list-open', 'true')
  await expect(bpc.getByRole('button', { name: 'Bearbeiten' })).toBeVisible()
  // Gewischt ist nicht getippt: kein Vollbild.
  await expect(page.getByRole('dialog', { name: 'BPC-157' })).toHaveCount(0)

  // Ein Tipp auf eine andere Zeile schliesst die offene — und oeffnet die andere.
  await zeile(page, 'TB-500').getByRole('button', { name: 'TB-500 öffnen' }).click()
  await expect(bpc).not.toHaveAttribute('data-list-open', 'true')
  await expect(page.getByRole('dialog', { name: 'TB-500' })).toBeVisible()
  await page.goBack()

  // Kurz und ruhig gezogen rastet zurueck.
  await expect(bpc.locator('[data-list-actions]')).toBeHidden()
  await wische(page, bpc, -40, true)
  await expect(bpc).not.toHaveAttribute('data-list-open', 'true')
  await expect(bpc.locator('[data-list-actions]')).toBeHidden()

  // Loeschen fragt wie im Vollbild nach.
  await wische(page, bpc, -160)
  await bpc.getByRole('button', { name: 'Löschen' }).click()
  await expect(page.getByRole('dialog', { name: 'Substanz entfernen' })).toBeVisible()
})

/**
 * Echter Finger (Chromium, CDP): Touch-Ereignisse statt Maus — prueft den
 * Touch-Weg, das Durchwischen und ob die Seite dabei mitscrollt. Schnippen
 * (Geschwindigkeit) prueft `useWischZeile.test.ts`: die Abstaende zwischen
 * den Ereignissen bestimmt hier der Testrechner, nicht der Test.
 */
async function fingerWisch(
  page: import('@playwright/test').Page,
  row: import('@playwright/test').Locator,
  { dx, dy = 0, schritte }: { dx: number; dy?: number; schritte: number },
) {
  const box = (await row.boundingBox())!
  const x = box.x + box.width * 0.8
  const y = box.y + box.height / 2
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= schritte; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / schritte, y: y + (dy * i) / schritte }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

test('Liste, Finger: Wischen öffnet und schließt, die Seite scrollt dabei nicht mit', async ({ page, mock, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'echte Touch-Ereignisse brauchen Chromium-CDP')
  test.skip(info.project.name === 'pixel-7' ? false : !info.project.use.hasTouch, 'braucht Touch')
  for (const name of ['BPC-157', 'TB-500', 'GHK-Cu', 'Ipamorelin', 'CJC-1295', 'Semax', 'Selank', 'MOTS-c']) {
    seedPeptide(mock, name, { startDate: '2026-09-01' })
  }
  await page.goto('/my-stack')
  const bpc = zeile(page, 'BPC-157')
  await expect(bpc).toBeVisible()
  const scrollVorher = await page.evaluate(() => window.scrollY)

  // Schraeg nach unten gewischt: die Zeile oeffnet, die Seite bleibt stehen.
  await fingerWisch(page, bpc, { dx: -120, dy: 24, schritte: 6 })
  await expect(bpc).toHaveAttribute('data-list-open', 'true')
  await expect(bpc.getByRole('button', { name: 'Löschen' })).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollVorher)
  await expect(page.getByRole('dialog', { name: 'BPC-157' })).toHaveCount(0)

  // Nach rechts: wieder zu.
  await fingerWisch(page, bpc, { dx: 120, schritte: 6 })
  await expect(bpc).not.toHaveAttribute('data-list-open', 'true')

  // Senkrecht ist Scrollen, kein Wischen.
  await fingerWisch(page, bpc, { dx: -6, dy: -60, schritte: 6 })
  await expect(bpc).not.toHaveAttribute('data-list-open', 'true')
})

test('Liste, Finger: ganz durchgewischt fragt sofort nach dem Löschen', async ({ page, mock, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'echte Touch-Ereignisse brauchen Chromium-CDP')
  test.skip(info.project.name === 'pixel-7' ? false : !info.project.use.hasTouch, 'braucht Touch')
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  const bpc = zeile(page, 'BPC-157')
  const breite = (await bpc.boundingBox())!.width
  await fingerWisch(page, bpc, { dx: -breite * 0.75, schritte: 12 })
  await expect(page.getByRole('dialog', { name: 'Substanz entfernen' })).toBeVisible()
  await expect(bpc).not.toHaveAttribute('data-list-open', 'true')
})

test('Liste: Bearbeiten aus dem Wischen öffnet das Formular', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  const bpc = zeile(page, 'BPC-157')
  await wische(page, bpc, -160)
  await bpc.getByRole('button', { name: 'Bearbeiten' }).click()
  await expect(page.getByRole('dialog').filter({ hasText: 'BPC-157' }).first()).toBeVisible()
  await expect(bpc).not.toHaveAttribute('data-list-open', 'true')
})

test('Liste: gegliedert nach Dringlichkeit — Ablaufendes zuerst, dann aktiv, dann inaktiv', async ({ page, mock }) => {
  seedPeptide(mock, 'Magnesium', {
    startDate: '2026-09-01',
    category: 'supplement',
    plan: false,
    form: { dosage_form: 'tablet', zutat: { amount_value: 400, amount_unit: 'mg', basis_value: 1, basis_unit: 'tablet' } },
  })
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
  seedPeptide(mock, 'BPC-157', {
    startDate: '2026-09-01',
    inventory: { package_quantity: 5, package_unit: 'vial', remaining_quantity: 3, reconstitution_ml: 2, expires_at: '2026-09-20' },
  })
  await page.goto('/my-stack')

  await expect(page.locator('[data-list-group-title]')).toHaveText(['Braucht Aufmerksamkeit', 'Aktiv', 'Inaktiv'])
  // Ablaufendes zuerst, dann aktiv, dann inaktiv.
  await expect(page.getByRole('button', { name: / öffnen$/ })).toHaveText([/BPC-157/, /TB-500/, /Magnesium/])
  await expect(zeile(page, 'BPC-157')).toHaveAttribute('data-list-group', 'achtung')
  await expect(zeile(page, 'TB-500')).toHaveAttribute('data-list-group', 'aktiv')
  await expect(zeile(page, 'Magnesium')).toHaveAttribute('data-list-group', 'inaktiv')
})

test('Liste: nur eine Gruppe — keine Überschrift', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  await expect(page.locator('[data-list-row]')).toHaveCount(2)
  await expect(page.locator('[data-list-group-title]')).toHaveCount(0)
})
