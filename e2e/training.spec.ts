import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'

/**
 * Workout-Tracker: eine Routine starten, die Werte vom letzten Mal sehen,
 * Saetze abhaken (Pausen-Timer laeuft), beenden — der Rekord wird erkannt
 * und die Einheit gespeichert. Dazu eine Aktivitaet ohne Saetze eintragen.
 */

function seedHistory(mock: import('./support/mockSupabase').MockSupabase) {
  mock.insert('training_routines', {
    user_id: TEST_USER.id, name: 'Push', kind: 'strength', weekdays: [1], sort_order: 0,
    exercises: [
      { exerciseId: 'bench_press_barbell', restS: 90, sets: [{ type: 'normal' }, { type: 'normal' }] },
    ],
  })
  // Montag, 21.09.: Bankdruecken 80 × 5
  mock.insert('training_sessions', {
    user_id: TEST_USER.id, kind: 'strength', title: 'Push', started_at: '2026-09-21T16:00:00.000Z',
    ended_at: '2026-09-21T17:00:00.000Z', duration_s: 3600, distance_m: null, kcal: null, avg_hr: null,
    rpe: 7, notes: null, routine_id: null, source: 'live', external_id: null,
    exercises: [{ exerciseId: 'bench_press_barbell', sets: [
      { type: 'normal', weightKg: 80, reps: 5, done: true },
      { type: 'normal', weightKg: 80, reps: 5, done: true },
    ] }],
  })
  mock.insert('training_sessions', {
    user_id: TEST_USER.id, kind: 'run', title: '', started_at: '2026-09-23T06:30:00.000Z',
    ended_at: '2026-09-23T07:00:00.000Z', duration_s: 1800, distance_m: 5200, kcal: 380, avg_hr: 151,
    rpe: 6, notes: null, routine_id: null, source: 'manual', external_id: null, exercises: [],
  })
}

test('Training: Routine starten, Vorher-Werte, Rekord, speichern', async ({ page, mock }) => {
  seedHistory(mock)
  await page.goto('/training')

  // Montag (28.09.) ist „Push" geplant
  await expect(page.getByText('Heute geplant')).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/training-heute.png`, fullPage: true })

  await page.getByRole('button', { name: 'Starten' }).first().click()
  const live = page.getByRole('dialog', { name: 'Push' })
  await expect(live).toBeVisible()
  await expect(live.getByText('80 × 5').first()).toBeVisible()

  // Erster Satz: 85 kg statt 80 — dann abhaken, die Pause startet
  const weight = live.getByRole('textbox', { name: 'kg' }).first()
  await weight.fill('85')
  await live.getByRole('checkbox', { name: 'Satz abhaken' }).first().click()
  await expect(page.getByRole('timer')).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/training-logger.png` })
  await page.getByRole('button', { name: 'Überspringen' }).click()
  await live.getByRole('checkbox', { name: 'Satz abhaken' }).nth(1).click()

  await live.getByRole('button', { name: 'Beenden' }).click()
  const summary = page.getByRole('dialog', { name: 'Training beenden' })
  await expect(summary.getByText('Neue Rekorde')).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/training-abschluss.png` })
  await summary.getByRole('button', { name: '8', exact: true }).click()
  await summary.getByRole('button', { name: 'Training speichern' }).click()
  await expect(summary).toBeHidden()

  const saved = mock.table('training_sessions').find(row => row.started_at !== '2026-09-21T16:00:00.000Z' && row.kind === 'strength')
  expect(saved).toBeTruthy()
  expect(saved!.rpe).toBe(8)
  const sets = (saved!.exercises as Array<{ sets: Array<{ weightKg: number; reps: number; done: boolean }> }>)[0].sets
  expect(sets.map(s => [s.weightKg, s.reps, s.done])).toEqual([[85, 5, true], [80, 5, true]])

  // Nach dem Neuladen ist nichts mehr „laufend", der Verlauf zeigt die Einheit mit Rekord
  await page.reload()
  await expect(page.getByText('Training läuft')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Verlauf' }).click()
  // 85 × 5 schlaegt 80 × 5: e1RM, Gewicht und Volumen
  await expect(page.getByRole('button', { name: /3 Rekorde/ })).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/training-verlauf.png`, fullPage: true })
  await page.getByRole('tab', { name: 'Fortschritt' }).click()
  if (process.env.SCREENSHOT_DIR) {
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/training-fortschritt.png`, fullPage: true })
  }
})

test('Training: laufendes Training uebersteht einen Neustart', async ({ page, mock }) => {
  seedHistory(mock)
  await page.goto('/training?start=empty')
  const live = page.getByRole('dialog', { name: 'Training' })
  await expect(live).toBeVisible()
  await live.getByRole('button', { name: 'Übung hinzufügen' }).click()
  const picker = page.getByRole('dialog', { name: 'Übung wählen' })
  await picker.getByRole('searchbox').fill('kniebeuge')
  await picker.getByRole('button').filter({ hasText: /Kniebeuge/ }).first().click()
  await picker.getByRole('button', { name: /hinzufügen/ }).click()
  await expect(live.getByRole('region').first()).toBeVisible()

  await page.reload()
  await expect(page.getByText(/Training läuft|Fortsetzen/).first()).toBeVisible()
  await page.getByText('Fortsetzen').click()
  await expect(page.getByRole('dialog', { name: 'Training' }).getByRole('region').first()).toContainText('Kniebeuge')
  expect(mock.table('training_sessions')).toHaveLength(2)
})

test('Training: Aktivitaet eintragen', async ({ page, mock }) => {
  seedHistory(mock)
  await page.goto('/training')
  await page.getByRole('button', { name: /Aktivität eintragen/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Aktivität eintragen' })
  await sheet.getByRole('button', { name: 'Radfahren', exact: true }).click()
  await sheet.getByLabel('Dauer (Min.)').fill('60')
  await sheet.getByLabel('Strecke (km)').fill('25,5')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(sheet).toBeHidden()
  const ride = mock.table('training_sessions').find(row => row.kind === 'cycle')
  expect(ride).toMatchObject({ duration_s: 3600, distance_m: 25500, source: 'manual' })
})
