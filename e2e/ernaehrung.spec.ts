import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'

/** Ernährung: Barcode, Häufig, Bearbeiten/Korrigieren, Löschen mit Rückgängig, Ziele, Gerichte. */

const SKYR = {
  barcode: '4002671157751', name: 'Skyr Natur', brand: 'Ehrmann', unit: 'g',
  per100: { kcal: 63, protein: 11, carbs: 4, fat: 0.2, fiber: null, sugar: 4, salt: 0.1 },
  serving: { amount: 150, label: '1 Becher' },
}

function logEntry(mock: MockSupabase, fields: Record<string, unknown>) {
  return mock.insert('food_logs', {
    user_id: TEST_USER.id, log_date: '2026-09-28', meal: 'breakfast', food_item_id: null,
    source: 'off', source_ref: SKYR.barcode, name: 'Skyr Natur', brand: 'Ehrmann', unit: 'g',
    amount: 200, kcal: 126, protein_g: 22, carbs_g: 8, fat_g: 0.4, fiber_g: null, sugar_g: 8, salt_g: 0.2,
    ...fields,
  })
}

const mealCard = (page: import('@playwright/test').Page, name: string) => page.getByRole('region', { name })

test('Barcode eingeben → Produkt aus Open Food Facts → Portion → eingetragen mit Schnappschuss der Werte', async ({ page, mock }) => {
  mock.foodLookup.products[SKYR.barcode] = SKYR
  await page.goto('/ernaehrung')

  await mealCard(page, 'Frühstück').getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Barcode scannen' }).click()
  await page.getByLabel('Ziffern unter dem Barcode').fill('4 002671 157751')
  await page.getByRole('button', { name: 'Suchen', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Skyr Natur' })).toBeVisible()
  // Portion des Produkts ist vorgewählt
  await expect(page.getByLabel('Menge in g')).toHaveValue('150')
  await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen' }).click()

  await expect(mealCard(page, 'Frühstück').getByText('Skyr Natur')).toBeVisible()
  expect(mock.foodLookup.calls).toEqual([{ barcode: '4002671157751', query: undefined }])
  expect(mock.table('food_logs')).toHaveLength(1)
  expect(mock.table('food_logs')[0]).toMatchObject({
    meal: 'breakfast', source: 'off', source_ref: '4002671157751', amount: 150, kcal: 94.5, protein_g: 16.5,
  })
})

test('Tippfehler im Barcode wird abgefangen, ohne den Server zu fragen', async ({ page, mock }) => {
  await page.goto('/ernaehrung')
  await page.getByRole('button', { name: 'Barcode scannen' }).first().click()
  await page.getByLabel('Ziffern unter dem Barcode').fill('4002671157752')
  await page.getByRole('button', { name: 'Suchen', exact: true }).click()
  await expect(page.getByText('Diese Ziffern sind kein gültiger Barcode')).toBeVisible()
  expect(mock.foodLookup.calls).toEqual([])
})

test('Unbekannter Barcode → selbst anlegen → beim nächsten Scan kommt die eigene Fassung ohne Serveranfrage', async ({ page, mock }) => {
  await page.goto('/ernaehrung')
  await mealCard(page, 'Snacks').getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Barcode scannen' }).click()
  await page.getByLabel('Ziffern unter dem Barcode').fill('4006381333931')
  await page.getByRole('button', { name: 'Suchen', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Neu anlegen' })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Proteinriegel Haselnuss')
  await page.getByLabel('Kalorien (kcal)').fill('380')
  await page.getByLabel('Eiweiß (g)').fill('32')
  await page.getByLabel('Kohlenhydrate (g)').fill('30')
  await page.getByLabel('Fett (g)').fill('14')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(page.getByLabel('Menge in g')).toBeVisible()
  await page.getByLabel('Menge in g').fill('60')
  await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(mealCard(page, 'Snacks').getByText('Proteinriegel Haselnuss')).toBeVisible()

  expect(mock.table('food_items')[0]).toMatchObject({ barcode: '4006381333931', kcal_100: 380, source: 'custom' })
  expect(mock.table('food_logs')[0]).toMatchObject({ amount: 60, kcal: 228, food_item_id: mock.table('food_items')[0].id })

  const callsBefore = mock.foodLookup.calls.length
  await mealCard(page, 'Snacks').getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Barcode scannen' }).click()
  await page.getByLabel('Ziffern unter dem Barcode').fill('4006381333931')
  await page.getByRole('button', { name: 'Suchen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Proteinriegel Haselnuss' })).toBeVisible()
  expect(mock.foodLookup.calls.length).toBe(callsBefore)
})

test('Häufig: zuletzt gegessene Menge ist vorgeschlagen — zwei Taps', async ({ page, mock }) => {
  logEntry(mock, { log_date: '2026-09-27', amount: 200 })
  await page.goto('/ernaehrung')

  await mealCard(page, 'Frühstück').getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(page.getByRole('tab', { name: 'Häufig' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: /Skyr Natur/ }).click()
  await expect(page.getByLabel('Menge in g')).toHaveValue('200')
  await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen' }).click()

  await expect(mealCard(page, 'Frühstück').getByText('Skyr Natur')).toBeVisible()
  const today = mock.table('food_logs').filter(r => r.log_date === '2026-09-28')
  expect(today).toHaveLength(1)
  expect(today[0]).toMatchObject({ amount: 200, kcal: 126 })
})

test('Wie gestern: Mahlzeit vom Vortag übernehmen', async ({ page, mock }) => {
  logEntry(mock, { log_date: '2026-09-27', meal: 'lunch', name: 'Reis', source: 'custom', source_ref: null, amount: 150, kcal: 195 })
  await page.goto('/ernaehrung')
  await mealCard(page, 'Mittagessen').getByRole('button', { name: 'Wie gestern' }).click()
  await expect(mealCard(page, 'Mittagessen').getByText('Reis')).toBeVisible()
  await expect(page.getByText('1 Eintrag von gestern übernommen')).toBeVisible()
  expect(mock.table('food_logs').filter(r => r.log_date === '2026-09-28')).toHaveLength(1)
})

test('Löschen mit Rückgängig', async ({ page, mock }) => {
  logEntry(mock, {})
  await page.goto('/ernaehrung')
  await page.getByRole('button', { name: 'Skyr Natur bearbeiten' }).click()
  await page.getByRole('button', { name: 'Löschen' }).click()
  await expect(mealCard(page, 'Frühstück').getByText('Skyr Natur')).toHaveCount(0)
  // Die Liste blendet sofort aus (optimistisch); das Löschen beim Server kommt danach.
  await expect.poll(() => mock.table('food_logs').length).toBe(0)

  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(mealCard(page, 'Frühstück').getByText('Skyr Natur')).toBeVisible()
  expect(mock.table('food_logs')).toHaveLength(1)
  expect(mock.table('food_logs')[0]).toMatchObject({ amount: 200, kcal: 126 })
})

test('Bearbeiten: Menge ändern skaliert den Schnappschuss, Werte korrigieren ändert auch diesen Eintrag', async ({ page, mock }) => {
  // Falscher Eintrag aus der Datenbank: kJ als kcal (263 statt 63)
  logEntry(mock, { amount: 100, kcal: 263, protein_g: 11, carbs_g: 4, fat_g: 0.2 })
  await page.goto('/ernaehrung')

  await page.getByRole('button', { name: 'Skyr Natur bearbeiten' }).click()
  await expect(page.getByText('Kalorien und Nährwerte passen nicht zusammen')).toBeVisible()
  await page.getByRole('button', { name: 'Werte korrigieren' }).click()
  await expect(page.getByRole('heading', { name: 'Werte korrigieren' })).toBeVisible()
  await page.getByLabel('Kalorien (kcal)').fill('63')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await page.getByLabel('Menge in g').fill('200')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Skyr Natur bearbeiten' })).toContainText('200 g')
  await expect(page.getByRole('button', { name: 'Skyr Natur bearbeiten' })).toContainText('126')
  expect(mock.table('food_logs')[0]).toMatchObject({ amount: 200, kcal: 126, food_item_id: mock.table('food_items')[0].id })
  expect(mock.table('food_items')[0]).toMatchObject({ barcode: SKYR.barcode, source: 'off', kcal_100: 63 })
})

test('Markensuche nur auf Knopfdruck; nicht erreichbar → verständlicher Hinweis, eigene Lebensmittel bleiben', async ({ page, mock }) => {
  mock.insert('food_items', {
    user_id: TEST_USER.id, source: 'custom', source_ref: null, barcode: null, name: 'Haferflocken (meine)', brand: null,
    unit: 'g', kcal_100: 372, protein_100: 13.5, carbs_100: 58.7, fat_100: 7, fiber_100: 10, sugar_100: 1.2, salt_100: 0.02,
    serving_amount: null, serving_label: null, favorite: false,
  })
  mock.foodLookup.down = true
  await page.goto('/ernaehrung')
  await mealCard(page, 'Frühstück').getByRole('button', { name: 'Hinzufügen' }).click()

  await page.getByLabel('Lebensmittel suchen').fill('hafer')
  await expect(page.getByRole('button', { name: /Haferflocken \(meine\)/ })).toBeVisible()
  expect(mock.foodLookup.calls).toEqual([]) // Tippen fragt Open Food Facts nicht

  await page.getByRole('button', { name: '„hafer" in Markenprodukten suchen' }).click()
  await expect(page.getByText('Markenprodukte gerade nicht erreichbar')).toBeVisible()
  await expect(page.getByRole('button', { name: /Haferflocken \(meine\)/ })).toBeVisible()
  expect(mock.foodLookup.calls).toEqual([{ barcode: undefined, query: 'hafer' }])
})

test('Ziele: Kalorien ausblenden zeigt Eiweiß als Hauptzahl', async ({ page, mock }) => {
  logEntry(mock, {})
  await page.goto('/ernaehrung')
  await expect(page.getByRole('img', { name: '126 von 2000 kcal gegessen' })).toBeVisible()

  await page.getByRole('button', { name: 'Ziele', exact: true }).click()
  await page.getByLabel('Kalorienzahlen ausblenden').check()
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()

  await expect(page.getByRole('img', { name: '22 von 110 g Eiweiß' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Tagesübersicht' }).getByText('kcal')).toHaveCount(0)
  expect(mock.table('nutrition_goals')).toHaveLength(1)
  expect(mock.table('nutrition_goals')[0]).toMatchObject({ hide_kcal: true, kcal: 2000 })
})

function ownFood(mock: MockSupabase, name: string, per100: { kcal: number; protein: number; carbs: number; fat: number }) {
  return mock.insert('food_items', {
    user_id: TEST_USER.id, source: 'custom', source_ref: null, barcode: null, name, brand: null, unit: 'g',
    kcal_100: per100.kcal, protein_100: per100.protein, carbs_100: per100.carbs, fat_100: per100.fat,
    fiber_100: null, sugar_100: null, salt_100: null, serving_amount: null, serving_label: null, favorite: false,
  })
}

test('Gericht anlegen: Zutaten suchen, Portionen festlegen, dann eine Portion eintragen', async ({ page, mock }) => {
  ownFood(mock, 'Haferflocken', { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 })
  ownFood(mock, 'Magerquark', { kcal: 68, protein: 12, carbs: 4, fat: 0.3 })
  await page.goto('/ernaehrung')

  await mealCard(page, 'Frühstück').getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('tab', { name: 'Gerichte' }).click()
  await page.getByRole('button', { name: 'Neues Gericht' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Quark-Porridge')
  await page.getByLabel('Portionen').fill('2')

  for (const [name, amount] of [['Haferflocken', '80'], ['Magerquark', '250']] as const) {
    await page.getByRole('button', { name: 'Zutat hinzufügen' }).click()
    await page.getByRole('tab', { name: 'Meine' }).click()
    await page.getByRole('button', { name: new RegExp(name) }).click()
    await page.getByLabel('Menge in g').fill(amount)
    await page.getByRole('button', { name: 'Zum Gericht' }).click()
  }
  // Eingaben überstehen das Zutat-Suchen; Menge lässt sich in der Liste ändern
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Quark-Porridge')
  await page.getByLabel('Menge Magerquark in g').fill('200')
  // je Portion: (80 g Hafer 297,6 + 200 g Quark 136) / 2
  await expect(page.getByText('Je Portion (140 g)')).toBeVisible()
  await page.getByRole('button', { name: 'Gericht speichern', exact: true }).click()

  // gleich weiter zum Eintragen, eine Portion vorgewählt
  await expect(page.getByRole('heading', { name: 'Quark-Porridge' })).toBeVisible()
  await expect(page.getByLabel(/Portionen \(1 Portion = 140 g\)/)).toHaveValue('1')
  await page.getByRole('button', { name: '½', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(mealCard(page, 'Frühstück').getByText('Quark-Porridge')).toBeVisible()

  const dish = mock.table('food_items').find(r => r.name === 'Quark-Porridge')!
  expect(dish).toMatchObject({ portions: 2, serving_amount: 140, source: 'custom' })
  expect((dish.ingredients as { name: string; amount: number }[]).map(i => [i.name, i.amount])).toEqual([['Haferflocken', 80], ['Magerquark', 200]])
  const log = mock.table('food_logs')[0]
  expect(log).toMatchObject({ food_item_id: dish.id, amount: 70 })
  expect(Number(log.kcal)).toBeCloseTo((297.6 + 136) / 4, 0)

  // Beim nächsten Mal steht es unter „Gerichte" mit Werten je Portion
  await mealCard(page, 'Abendessen').getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('tab', { name: 'Gerichte' }).click()
  await expect(page.getByRole('button', { name: /Quark-Porridge.*2 Zutaten.*217 kcal/ })).toBeVisible()
})

test('Mahlzeit als Gericht speichern — Schnelleinträge fallen weg', async ({ page, mock }) => {
  logEntry(mock, {})
  logEntry(mock, { name: 'Haferflocken', brand: null, source: 'custom', source_ref: null, amount: 50, kcal: 186, protein_g: 6.8, carbs_g: 29.4, fat_g: 3.5 })
  logEntry(mock, { name: 'Schnelleintrag', brand: null, source: 'quick', source_ref: null, amount: null, kcal: 100, protein_g: 0, carbs_g: 0, fat_g: 0 })
  await page.goto('/ernaehrung')

  await page.getByRole('button', { name: 'Frühstück als Gericht speichern' }).click()
  await expect(page.getByRole('heading', { name: 'Neues Gericht' })).toBeVisible()
  await expect(page.getByLabel('Menge Skyr Natur in g')).toHaveValue('200')
  await expect(page.getByLabel('Menge Haferflocken in g')).toHaveValue('50')
  await expect(page.getByRole('dialog').getByText('Schnelleintrag')).toHaveCount(0)

  await page.getByRole('button', { name: 'Gericht speichern', exact: true }).click()
  await expect(page.getByText('Bitte Namen, Portionen und für jede Zutat eine Menge angeben.')).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Mein Frühstück')
  await page.getByRole('button', { name: 'Gericht speichern', exact: true }).click()
  await expect(page.getByText('Gericht gespeichert')).toBeVisible()

  const dish = mock.table('food_items').find(r => r.name === 'Mein Frühstück')!
  expect(dish).toMatchObject({ portions: 1, serving_amount: 250 })
  expect(Number(dish.kcal_100)).toBeCloseTo((126 + 186) / 2.5, 0)
  expect(mock.table('food_logs')).toHaveLength(3) // Einträge bleiben, wie sie sind
})

// 1×1-PNG — die App verkleinert und schickt es als JPEG; der Mock erkennt „Spaghetti".
const TELLER = { name: 'teller.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }

test('Essen per Foto: erst Einwilligung, dann prüfen, Mengen ändern, abwählen, eintragen', async ({ page, mock }) => {
  mock.foodPhoto.items = [
    { name: 'Spaghetti', grams: 250, confidence: 'high', per100: { kcal: 158, protein: 5.8, carbs: 31, fat: 0.9 } },
    { name: 'Bolognese-Soße', grams: 150, confidence: 'medium', per100: { kcal: 120, protein: 8, carbs: 5, fat: 7.5 } },
    { name: 'Parmesan', grams: 10, confidence: 'low', per100: { kcal: 392, protein: 36, carbs: 0, fat: 26 } },
  ]
  await page.goto('/ernaehrung')
  await mealCard(page, 'Abendessen').getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Essen fotografieren' }).click()

  // Ohne Einwilligung geht kein Foto raus
  const accept = page.getByRole('button', { name: 'Einwilligen und weiter' })
  await expect(accept).toBeDisabled()
  await page.getByText('Ich willige ausdrücklich ein').click()
  await accept.click()
  await expect.poll(() => mock.table('profiles').find(r => r.id === TEST_USER.id)?.ai_food_consent_at).toBeTruthy()

  await page.getByLabel('Notiz (optional)').fill('mit Olivenöl')
  await page.locator('[data-photo-gallery]').setInputFiles(TELLER)
  await expect(page.getByText('KI-Schätzung')).toBeVisible()
  expect(mock.foodPhoto.calls).toEqual([{ mimeType: 'image/jpeg', hint: 'mit Olivenöl', lang: 'de' }])
  await expect(page.getByText('unsicher')).toBeVisible() // Parmesan: geringe Sicherheit

  await page.getByLabel('Menge Spaghetti in g').fill('300')
  await page.getByLabel('Parmesan eintragen').uncheck()
  await page.getByRole('button', { name: '2 Positionen eintragen' }).click()

  await expect(mealCard(page, 'Abendessen').getByText('Spaghetti')).toBeVisible()
  await expect(page.getByText('2 Positionen eingetragen')).toBeVisible()
  const logs = mock.table('food_logs')
  expect(logs.map(r => [r.name, r.amount, r.meal, r.source, r.food_item_id])).toEqual([
    ['Spaghetti', 300, 'dinner', 'custom', null],
    ['Bolognese-Soße', 150, 'dinner', 'custom', null],
  ])
  expect(Number(logs[0].kcal)).toBe(474)
})

test('Essen per Foto: kein Essen erkannt → verständlicher Hinweis, nichts eingetragen', async ({ page, mock }) => {
  mock.table('profiles').find(r => r.id === TEST_USER.id)!.ai_food_consent_at = '2026-10-01T10:00:00Z'
  mock.foodPhoto.error = { status: 422, code: 'not_food' }
  await page.goto('/ernaehrung')
  await mealCard(page, 'Snacks').getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Essen fotografieren' }).click()
  await page.locator('[data-photo-gallery]').setInputFiles(TELLER)
  await expect(page.getByText('Auf dem Foto war kein Essen zu erkennen')).toBeVisible()
  expect(mock.table('food_logs')).toHaveLength(0)
})
