import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'

/**
 * /health nutzt dieselben Angaben wie die Blutwerte: Geburtsdatum und
 * biologisches Geschlecht. Die alten Felder age/gender werden nur gelesen,
 * solange die neuen fehlen, und beim Speichern passend mitgeschrieben.
 */
const profil = (mock: MockSupabase) => mock.table('profiles').find(row => row.id === TEST_USER.id)!

test('alte Angaben werden angezeigt; Speichern schreibt Geburtsdatum und Geschlecht', async ({ page, mock }) => {
  Object.assign(profil(mock), { age: 40, gender: 'männlich', height_cm: 180, birth_date: null, bio_sex: null })
  await page.goto('/health')

  await expect(page.getByText('40 J.')).toBeVisible()
  await expect(page.getByText('Männlich', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Bearbeiten' }).click()
  // Das alte Geschlecht ist vorgeschlagen, das Alter wird zum Geburtsdatum
  await expect(page.getByLabel('Biologisches Geschlecht')).toHaveValue('male')
  await page.getByLabel('Geburtsdatum').fill('1990-06-01')
  await page.getByRole('button', { name: 'Speichern' }).click()

  await expect.poll(() => [profil(mock).birth_date, profil(mock).bio_sex]).toEqual(['1990-06-01', 'male'])
  // Alte Felder passend mitgeschrieben
  expect([profil(mock).age, profil(mock).gender]).toEqual([36, 'männlich'])
  // Alter jetzt aus dem Geburtsdatum (Testuhr: 28.09.2026)
  await expect(page.getByText('36 J.')).toBeVisible()

  // Leeren bleibt leer — kein Rueckfall auf die alten Angaben
  await page.getByRole('button', { name: 'Bearbeiten' }).click()
  await page.getByLabel('Geburtsdatum').fill('')
  await page.getByLabel('Biologisches Geschlecht').selectOption('')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect.poll(() => [profil(mock).birth_date, profil(mock).bio_sex, profil(mock).age, profil(mock).gender]).toEqual([null, null, null, null])
  await expect(page.getByText('36 J.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Bearbeiten' }).click()
  await expect(page.getByLabel('Biologisches Geschlecht')).toHaveValue('')
})

test('Angaben aus den Blutwerten erscheinen auf /health', async ({ page, mock }) => {
  Object.assign(profil(mock), { birth_date: '1985-01-10', bio_sex: 'female', age: null, gender: null })
  await page.goto('/health')
  await expect(page.getByText('41 J.')).toBeVisible()
  await expect(page.getByText('Weiblich', { exact: true })).toBeVisible()
})
