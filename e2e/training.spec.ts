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
  await expect(page.getByText('Heute geplant', { exact: true })).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/training-heute.png`, fullPage: true })

  await page.getByRole('button', { name: 'Push starten' }).click()
  const live = page.getByRole('dialog', { name: 'Push' })
  await expect(live).toBeVisible()
  await expect(live.getByText('80 × 5').first()).toBeVisible()

  // Der Vorschlag: 80 × 5 zweimal geschafft → heute 82,5 kg (Langhantel-Schritt)
  await expect(live.getByText(/Vorschlag 82,5 × 5/).first()).toBeVisible()
  // Erster Satz: 85 kg statt 82,5 per Rad — der runde Haken uebernimmt und hakt ab, die Pause startet
  await live.getByRole('button', { name: /^kg: 82,5/ }).first().click()
  const wheels = page.getByRole('dialog', { name: 'Satz 1' })
  await expect(wheels.getByRole('button', { name: 'Wie letztes Mal · 80 × 5' })).toBeVisible()
  const whole = wheels.getByRole('spinbutton', { name: 'kg', exact: true })
  await expect(whole).toHaveAttribute('aria-valuetext', '82')
  await whole.press('ArrowDown')
  await whole.press('ArrowDown')
  await whole.press('ArrowDown')
  await expect(whole).toHaveAttribute('aria-valuetext', '85')
  const decimals = wheels.getByRole('spinbutton', { name: 'kg Nachkomma' })
  await expect(decimals).toHaveAttribute('aria-valuetext', ',50')
  await decimals.press('Home')
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/training-raeder.png` })
  await wheels.getByRole('button', { name: 'Übernehmen und abhaken' }).click()
  await expect(wheels).toBeHidden()
  await expect(live.getByRole('button', { name: 'kg: 85' }).first()).toBeVisible()
  await expect(page.getByRole('timer')).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/training-logger.png` })
  await page.getByRole('button', { name: 'Weiter' }).click()
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
  // Satz 2 blieb beim Vorschlag (82,5 × 5)
  expect(sets.map(s => [s.weightKg, s.reps, s.done])).toEqual([[85, 5, true], [82.5, 5, true]])

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

test.describe('Dot auf „Heute"', () => {
  test.use({ dotFrei: true })

  test('Dot sagt, was heute dran ist', async ({ page, mock }) => {
    seedHistory(mock)
    await page.goto('/training')
    await expect(page.getByRole('button', { name: 'Push starten' })).toBeVisible()
    const logo = page.locator('[data-tyd-slot="dot"]')
    await expect(logo).toHaveAttribute('data-dot-bereit', 'true')
    await logo.click()
    const blase = page.locator('.tyd-dot-blase')
    const gesagt = new Set<string>()
    for (let t = 0; t < 5000; t += 100) {
      await page.clock.runFor(100)
      const text = (await blase.textContent())?.trim()
      if (text && (await blase.getAttribute('data-zeigen')) === 'true') gesagt.add(text)
    }
    // Montag, 28.09.: Push ist geplant, diese Woche noch nichts trainiert (Ziel 3)
    expect([...gesagt].some(t => t.includes('Heute ist Push dran. Noch 3 Einheiten bis zu deinem Wochenziel.'))).toBe(true)
  })
})

test('Training: Rad rastet nach freiem Drehen auf der naechsten Zeile ein', async ({ page, mock }) => {
  seedHistory(mock)
  await page.goto('/training')
  await page.getByRole('button', { name: 'Push starten' }).click()
  const live = page.getByRole('dialog', { name: 'Push' })
  await live.getByRole('button', { name: /^kg: 82,5/ }).first().click()
  const whole = page.getByRole('dialog', { name: 'Satz 1' }).getByRole('spinbutton', { name: 'kg', exact: true })
  // Beim Oeffnen bleibt es bei 82 — auch nach einer Weile (WebKit rastete frueher selbst weiter)
  await page.waitForTimeout(600)
  await expect(whole).toHaveAttribute('aria-valuetext', '82')
  // Frei um 1,3 Zeilen gedreht und losgelassen: rastet bei 83 ein
  await whole.evaluate(el => { el.scrollTop += 50 })
  await expect(whole).toHaveAttribute('aria-valuetext', '83')
  await expect.poll(() => whole.evaluate(el => Math.abs(el.scrollTop - 83 * 38))).toBeLessThan(1.5)
})
