import { expect, test } from './support/fixtures'
import { SUPABASE_ORIGIN } from './support/mockSupabase'
import { stageObject } from './support/myStack'
import {
  confirmHomeRoutine, createTrackedIntake, expectCalendarTaken, expectStockVisible,
  openHomeRoutine, remainingStock, seedTrackedIntake,
} from './support/intake'

test('Plan anlegen → Home bestätigen → Kalender → Bestand bleibt nach Neuladen erhalten', async ({ page, mock }) => {
  await createTrackedIntake(page)
  expect(remainingStock(mock)).toBe(2)
  await confirmHomeRoutine(page)
  await expect.poll(() => remainingStock(mock)).toBeCloseTo(1.95)
  expect(mock.table('dose_logs')).toHaveLength(1)
  expect(mock.table('dose_logs')[0]).toMatchObject({ taken: true, dose: 250, unit: 'mcg' })
  await page.reload()
  // Nach dem Neuladen baut Home die 3D-Torso-Vorschau neu auf. Im Test laeuft
  // WebGL in Software, das dauert hier allein rund 5 s (gemessen: ohne die
  // Vorschau 1,2 s, mit ihr 5–7 s) — die uebliche Grenze von 8 s reicht dafuer nicht.
  await expect(page.getByText('1/1 Einnahmen geloggt', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: /Alle als eingenommen markieren –/ })).toHaveCount(0)
  await expectCalendarTaken(page)
  await expectStockVisible(page)
  await page.reload()
  await stageObject(page, 'BPC-157').click()
  await expect(page.locator('[data-stack-detail="bestand"]')).toContainText('1 Vial · + 1 rekonstituiert · 95 %')
  expect(mock.table('dose_logs')).toHaveLength(1)
  expect(remainingStock(mock)).toBeCloseTo(1.95)
})

test('Kalender: Überspringen verbraucht nichts; Wiederöffnen und Bestätigen verwenden dieselbe Einnahme', async ({ page, mock }) => {
  seedTrackedIntake(mock)
  await page.goto('/kalender?date=2026-09-28')
  await page.getByRole('button', { name: 'Übersprungen', exact: true }).click()
  const skipped = page.getByRole('button', { name: /^Nicht protokolliert/ })
  await expect(skipped).toBeVisible()
  expect(mock.table('dose_logs')).toHaveLength(1)
  const id = mock.table('dose_logs')[0].id
  expect(mock.table('dose_logs')[0].taken).toBe(false)
  expect(remainingStock(mock)).toBe(2)
  await page.reload()
  await skipped.click()
  await page.locator('[data-log-row] button[aria-expanded]').first().click()
  await page.getByRole('button', { name: 'Wieder öffnen', exact: true }).click()
  await expect(page.locator('[data-due-row]')).toHaveCount(1)
  await confirmHomeRoutine(page)
  await expect.poll(() => remainingStock(mock)).toBeCloseTo(1.95)
  expect(mock.table('dose_logs')).toHaveLength(1)
  expect(mock.table('dose_logs')[0]).toMatchObject({ id, taken: true })
  await expectCalendarTaken(page)
})

test('Neues Pulver-Vial bearbeiten erhält Stärke, Lösungsmittel und angebrochenen Bestand', async ({ page, mock }) => {
  await createTrackedIntake(page)
  await confirmHomeRoutine(page)
  await expect.poll(() => remainingStock(mock)).toBeCloseTo(1.95)
  await expectStockVisible(page)
  const detail = page.getByRole('dialog', { name: 'BPC-157', exact: true })
  await detail.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Eintrag bearbeiten', exact: true })
  await edit.getByRole('button', { name: /^Produkt & Notizen/ }).click()
  await edit.getByRole('textbox', { name: 'Notizen (optional)' }).fill('Notiz nach der ersten Einnahme')
  await edit.getByRole('button', { name: 'Fertig', exact: true }).click()
  await edit.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(edit).toBeHidden()
  await expect(detail.getByText('Notiz nach der ersten Einnahme', { exact: true })).toBeVisible()
  expect(mock.table('stack_items')).toHaveLength(1)
  expect(mock.table('stack_item_ingredients')).toMatchObject([{ amount_value: 5, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial' }])
  expect(mock.table('stack_item_inventory')).toMatchObject([{ remaining_quantity: 1.95, reconstitution_ml: 2 }])
  await page.reload()
  await stageObject(page, 'BPC-157').click()
  await expect(detail.locator('[data-stage-detail-body]')).toHaveCSS('opacity', '1')
  await expect(detail.getByText('Notiz nach der ersten Einnahme', { exact: true })).toBeVisible()
  await expect(page.locator('[data-stack-detail="bestand"]')).toContainText('1 Vial · + 1 rekonstituiert · 95 %')
  await detail.getByRole('button', { name: 'Schließen', exact: true }).click()
  await expect(detail).toBeHidden()
  await page.getByRole('link', { name: 'Kalender', exact: true }).click()
  const completed = page.getByRole('button', { name: /^Bereits protokolliert/ })
  await expect(completed).toContainText('1')
  await expect(page.locator('[data-due-row]')).toHaveCount(0)
  await completed.click()
  await expect(page.getByText('250 mcg', { exact: true })).toBeVisible()
})

test('Rückgängig bucht Bestand zurück; erneutes Bestätigen zieht genau einmal ab', async ({ page, mock }) => {
  seedTrackedIntake(mock)
  await confirmHomeRoutine(page)
  await expect.poll(() => remainingStock(mock)).toBeCloseTo(1.95)
  const id = mock.table('dose_logs')[0].id
  await expectCalendarTaken(page)
  await page.getByRole('button', { name: 'Wieder öffnen', exact: true }).click()
  await expect(page.locator('[data-due-row]')).toHaveCount(1)
  expect(remainingStock(mock)).toBe(2)
  await page.reload()
  await expect(page.locator('[data-due-row]')).toHaveCount(1)
  await confirmHomeRoutine(page)
  await expect.poll(() => remainingStock(mock)).toBeCloseTo(1.95)
  expect(mock.table('dose_logs')).toHaveLength(1)
  expect(mock.table('dose_logs')[0]).toMatchObject({ id, taken: true })
  await expectStockVisible(page)
})

test('Verbindungsabbruch vor dem Speichern erhält Auswahl; erneuter Versuch speichert einmal', async ({ page, mock }) => {
  seedTrackedIntake(mock)
  const routine = await openHomeRoutine(page)
  const endpoint = `${SUPABASE_ORIGIN}/rest/v1/rpc/confirm_intake_group`
  await page.route(endpoint, route => route.abort('failed'), { times: 1 })
  await routine.getByRole('button', { name: 'Alle als eingenommen markieren', exact: true }).click()
  await expect(routine.getByRole('alert')).toContainText('Gruppe konnte nicht gespeichert werden')
  await expect(routine.getByRole('checkbox', { name: 'BPC-157 auswählen' })).toBeChecked()
  expect(mock.table('dose_logs')).toHaveLength(0)
  expect(remainingStock(mock)).toBe(2)
  await routine.getByRole('button', { name: 'Erneut versuchen', exact: true }).click()
  await expect(routine.getByText('Routine gespeichert', { exact: true })).toBeVisible()
  await expect.poll(() => remainingStock(mock)).toBeCloseTo(1.95)
  expect(mock.table('dose_logs')).toHaveLength(1)
  await routine.getByRole('button', { name: 'Fertig', exact: true }).click()
  await expectCalendarTaken(page)
})

test('Verlorene Antwort nach dem Speichern: erneuter Versuch verwendet dieselbe Einnahme', async ({ page, mock }) => {
  seedTrackedIntake(mock)
  const routine = await openHomeRoutine(page)
  const endpoint = `${SUPABASE_ORIGIN}/rest/v1/rpc/confirm_intake_group`
  // The backend commits the request, but its response never reaches the app.
  // Execute the same bounded mock contract before dropping just this response.
  await page.route(endpoint, async route => {
    mock.callRpc('confirm_intake_group', route.request().postDataJSON())
    await route.abort('failed')
  }, { times: 1 })
  await routine.getByRole('button', { name: 'Alle als eingenommen markieren', exact: true }).click()
  await expect(routine.getByRole('alert')).toContainText('Gruppe konnte nicht gespeichert werden')
  expect(mock.table('dose_logs')).toHaveLength(1)
  const saved = { ...mock.table('dose_logs')[0] }
  expect(remainingStock(mock)).toBe(2)
  await routine.getByRole('button', { name: 'Erneut versuchen', exact: true }).click()
  await expect(routine.getByText('Routine gespeichert', { exact: true })).toBeVisible()
  await expect.poll(() => remainingStock(mock)).toBeCloseTo(1.95)
  expect(mock.table('dose_logs')).toEqual([saved])
  expect(mock.table('stack_item_inventory_movements')).toHaveLength(1)
  await routine.getByRole('button', { name: 'Fertig', exact: true }).click()
  await expectCalendarTaken(page)
})

test('Bestandsfehler: erneuter Versuch bucht Bestand, ohne die gespeicherte Einnahme zu wiederholen', async ({ page, mock }) => {
  seedTrackedIntake(mock)
  mock.failNextRpc('apply_inventory_confirmation', 'Test: Bestand vorübergehend nicht verfügbar')
  const routine = await openHomeRoutine(page)
  await routine.getByRole('button', { name: 'Alle als eingenommen markieren', exact: true }).click()
  await expect(routine.getByRole('alert')).toContainText('Bestand wurde nicht aktualisiert')
  expect(mock.table('dose_logs')).toHaveLength(1)
  const id = mock.table('dose_logs')[0].id
  expect(remainingStock(mock)).toBe(2)
  await routine.getByRole('button', { name: 'Bestand erneut versuchen', exact: true }).click()
  await expect(routine.getByRole('alert')).toHaveCount(0)
  await expect.poll(() => remainingStock(mock)).toBeCloseTo(1.95)
  expect(mock.rpcCalls.filter(call => call.name === 'confirm_intake_group')).toHaveLength(1)
  expect(mock.rpcCalls.filter(call => call.name === 'apply_inventory_confirmation').map(call => call.params.p_dose_log_id)).toEqual([id, id])
  expect(mock.table('dose_logs')).toHaveLength(1)
  await routine.getByRole('button', { name: 'Fertig', exact: true }).click()
  await expectCalendarTaken(page)
})

test('Doppeltippen während einer offenen Anfrage erzeugt nur eine Bestätigung', async ({ page, mock }) => {
  seedTrackedIntake(mock)
  const routine = await openHomeRoutine(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let requests = 0
  await page.route(`${SUPABASE_ORIGIN}/rest/v1/rpc/confirm_intake_group`, async route => {
    requests++
    await gate
    await route.fallback()
  })
  const save = routine.getByRole('button', { name: 'Alle als eingenommen markieren', exact: true })
  try {
    await save.dblclick()
    await expect.poll(() => requests).toBe(1)
    await expect(routine.getByRole('button', { name: 'Speichert …', exact: true })).toBeDisabled()
  } finally {
    release()
  }
  await expect(routine.getByText('Routine gespeichert', { exact: true })).toBeVisible()
  await expect.poll(() => remainingStock(mock)).toBeCloseTo(1.95)
  expect(mock.table('dose_logs')).toHaveLength(1)
  expect(mock.rpcCalls.filter(call => call.name === 'confirm_intake_group')).toHaveLength(1)
})

test.describe('English', () => {
  test.use({ language: 'en' })
  test('Home confirmation persists into the English calendar', async ({ page, mock }) => {
    seedTrackedIntake(mock)
    await page.goto('/')
    await page.getByRole('button', { name: /^Mark all as taken –/ }).click()
    const routine = page.getByRole('dialog', { name: 'Confirm together' })
    await routine.getByRole('button', { name: 'Mark all as taken', exact: true }).click()
    await expect(routine.getByText('Routine saved', { exact: true })).toBeVisible()
    await expect.poll(() => remainingStock(mock)).toBeCloseTo(1.95)
    await routine.getByRole('button', { name: 'Done', exact: true }).click()
    await page.goto('/kalender?date=2026-09-28')
    await expect(page.getByRole('button', { name: /^Already logged/ })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: /^Already logged/ })).toBeVisible()
    expect(mock.table('dose_logs')).toHaveLength(1)
  })
})
