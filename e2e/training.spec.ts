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

test('Training: Schnellzugriff fuehrt nach Training, ohne zu starten', async ({ page, mock }) => {
  seedHistory(mock)
  await page.goto('/')
  await page.getByRole('button', { name: 'Schnellzugriff' }).click()
  await page.getByRole('button', { name: 'Training', exact: true }).click()
  await expect(page).toHaveURL(/\/training$/)
  await expect(page.getByRole('button', { name: 'Leeres Training starten' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Training' })).toHaveCount(0)
  expect(mock.table('training_sessions')).toHaveLength(2)
})

test('Training: Uebung mit Stern steht oben in der Auswahl', async ({ page, mock }) => {
  seedHistory(mock)
  await page.goto('/training?start=empty')
  const live = page.getByRole('dialog', { name: 'Training' })
  await live.getByRole('button', { name: 'Übung hinzufügen' }).click()
  const picker = page.getByRole('dialog', { name: 'Übung wählen' })
  await expect(picker.getByRole('region', { name: 'Favoriten' })).toHaveCount(0)
  await picker.getByRole('searchbox').fill('kniebeuge')
  const star = picker.getByRole('button', { name: /^Kniebeuge.*als Favorit markieren$/ }).first()
  const name = (await star.getAttribute('aria-label'))!.replace(' als Favorit markieren', '')
  await star.click()
  await expect(picker.getByRole('button', { name: `${name}: Favorit entfernen` })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => (mock.table('training_settings')[0]?.settings as { favoriteExercises?: string[] } | undefined)?.favoriteExercises?.length).toBe(1)

  // Ohne Suche: eigener Abschnitt oben, dazu der Filter
  await picker.getByRole('searchbox').fill('')
  const favs = picker.getByRole('region', { name: 'Favoriten' })
  await expect(favs.getByRole('listitem')).toHaveCount(1)
  await expect(favs).toContainText(name)
  await expect(picker.getByRole('region', { name: 'Alle Übungen' })).toBeVisible()
  await picker.getByRole('button', { name: 'Favoriten', exact: true }).click()
  await expect(picker.getByRole('listitem')).toHaveCount(1)
})

test('Training: Uebungen auswaehlen, kopieren, einfuegen, verschieben', async ({ page, mock }) => {
  mock.insert('training_routines', {
    user_id: TEST_USER.id, name: 'Push', kind: 'strength', weekdays: [1], sort_order: 0, folder: 'PPL',
    exercises: [
      { exerciseId: 'bench_press_barbell', restS: 120, sets: [{ type: 'normal', weightKg: 80, repsMin: 8, repsMax: 10 }] },
      { exerciseId: 'overhead_press_barbell', restS: 90, sets: [{ type: 'normal', weightKg: 50, repsMin: 6, repsMax: 8 }] },
      { exerciseId: 'lateral_raise_dumbbell', restS: 60, sets: [{ type: 'normal', weightKg: 10, repsMin: 15, repsMax: 15 }] },
    ],
  })
  mock.insert('training_routines', {
    user_id: TEST_USER.id, name: 'Pull', kind: 'strength', weekdays: [3], sort_order: 1, folder: 'PPL', exercises: [],
  })
  await page.goto('/training')

  // Push: zwei Uebungen kopieren
  await page.getByRole('button', { name: 'Push – Bearbeiten' }).click()
  const editor = page.getByRole('dialog', { name: 'Workout bearbeiten' })
  await editor.getByRole('button', { name: 'Auswählen' }).click()
  await editor.getByRole('checkbox', { name: /Bankdrücken/ }).click()
  await editor.getByRole('checkbox', { name: /Seitheben/ }).click()
  await expect(editor.getByText('2 ausgewählt', { exact: true })).toBeVisible()
  await editor.getByRole('button', { name: 'Kopieren' }).click()
  await editor.getByRole('button', { name: 'Schließen und speichern' }).click()

  // Pull: einfuegen — mit allen Werten
  await page.getByRole('button', { name: 'Pull – Bearbeiten' }).click()
  const pull = page.getByRole('dialog', { name: 'Workout bearbeiten' })
  await pull.getByRole('button', { name: '2 Übungen einfügen' }).click()
  await pull.getByRole('button', { name: 'Schließen und speichern' }).click()
  await expect.poll(() => {
    const row = mock.table('training_routines').find(r => r.name === 'Pull') as { exercises: Array<{ exerciseId: string; restS: number; sets: Array<{ weightKg?: number }> }> }
    return row.exercises.map(e => `${e.exerciseId}:${e.restS}:${e.sets[0].weightKg}`)
  }).toEqual(['bench_press_barbell:120:80', 'lateral_raise_dumbbell:60:10'])

  // Push: Schulterdruecken nach Pull verschieben
  await page.getByRole('button', { name: 'Push – Bearbeiten' }).click()
  await editor.getByRole('button', { name: 'Auswählen' }).click()
  await editor.getByRole('checkbox', { name: /Schulterdrücken/ }).click()
  await editor.getByRole('button', { name: 'Verschieben' }).click()
  await page.getByRole('dialog', { name: /verschieben nach/ }).getByRole('button', { name: /^Pull/ }).click()
  await expect(editor.getByRole('checkbox')).toHaveCount(0)
  await editor.getByRole('button', { name: 'Schließen und speichern' }).click()
  await expect.poll(() => {
    const rows = mock.table('training_routines') as Array<{ name: string; exercises: Array<{ exerciseId: string }> }>
    return rows.map(r => `${r.name}:${r.exercises.map(e => e.exerciseId).join(',')}`).sort()
  }).toEqual([
    'Pull:bench_press_barbell,lateral_raise_dumbbell,overhead_press_barbell',
    'Push:bench_press_barbell,lateral_raise_dumbbell',
  ])
})

test('Training: Plan mit Zeitplan, Workouts duplizieren und verschieben', async ({ page, mock }) => {
  for (const [i, name] of ['Push', 'Pull', 'Beine'].entries()) {
    mock.insert('training_routines', {
      user_id: TEST_USER.id, name, kind: 'strength', weekdays: [], sort_order: i, folder: 'PPL',
      exercises: [{ exerciseId: 'bench_press_barbell', restS: 90, sets: [{ type: 'normal', weightKg: 80, repsMin: 8, repsMax: 10 }] }],
    })
  }
  mock.insert('training_routines', { user_id: TEST_USER.id, name: 'Lauf', kind: 'run', weekdays: [], sort_order: 3, folder: null, exercises: [] })
  await page.goto('/training')

  // Zeitplan: 4× pro Woche
  await page.getByRole('button', { name: 'Plan · PPL – Plan bearbeiten' }).click()
  const plan = page.getByRole('dialog', { name: 'Plan' })
  await plan.getByRole('radio', { name: 'Pro Woche' }).click()
  await plan.getByRole('button', { name: 'Mehr', exact: true }).click()
  await expect(plan.getByRole('status', { name: '4× pro Woche' })).toBeVisible()
  await expect(plan.getByText('Diese Woche 0 von 4')).toBeVisible()
  await expect(plan.getByText('Heute dran: Push')).toBeVisible()

  // Workout duplizieren — mit allen Werten, im selben Plan
  await plan.getByRole('button', { name: 'Mehr zu Pull' }).click()
  await page.getByRole('dialog', { name: 'Pull' }).getByRole('button', { name: 'Duplizieren' }).click()
  await expect(plan.getByRole('listitem')).toHaveCount(4)
  await expect.poll(() => {
    const copy = mock.table('training_routines').find(r => r.name === 'Pull (Kopie)') as { folder: string; exercises: Array<{ sets: Array<{ weightKg: number }> }> } | undefined
    return copy && `${copy.folder}:${copy.exercises[0].sets[0].weightKg}`
  }).toBe('PPL:80')

  // Beine nach „Ohne Plan" verschieben
  await plan.getByRole('button', { name: 'Mehr zu Beine' }).click()
  await page.getByRole('dialog', { name: 'Beine' }).getByRole('button', { name: 'Verschieben' }).click()
  await page.getByRole('dialog', { name: /Beine.*verschieben nach/ }).getByRole('button', { name: 'Ohne Plan' }).click()
  await expect(plan.getByRole('listitem')).toHaveCount(3)

  await plan.getByRole('button', { name: 'Schließen und speichern' }).click()
  await expect.poll(() => mock.table('training_plans').map(p => `${p.name}:${JSON.stringify(p.schedule)}`))
    .toEqual(['PPL:{"mode":"per_week","perWeek":4}'])
  await expect.poll(() => (mock.table('training_routines').find(r => r.name === 'Beine') as { folder: string | null }).folder).toBeNull()

  // „Heute": der Plan zeigt den Zeitplan, Push ist heute dran
  await expect(page.getByRole('button', { name: 'Plan · PPL – Plan bearbeiten' })).toContainText('4× pro Woche')
  await expect(page.getByText('Heute geplant', { exact: true })).toBeVisible()
})

test('Training: neuer Plan aus „Heute"', async ({ page, mock }) => {
  seedHistory(mock)
  await page.goto('/training')
  await page.getByRole('button', { name: 'Neuer Plan' }).click()
  const sheet = page.getByRole('dialog', { name: 'Neuer Plan' })
  await sheet.getByRole('textbox').fill('Oberkörper/Unterkörper')
  await sheet.getByRole('button', { name: 'Anlegen' }).click()

  // Der Plan oeffnet sich gleich; noch ohne Workout
  const plan = page.getByRole('dialog', { name: 'Plan' })
  await expect(plan.getByRole('textbox')).toHaveValue('Oberkörper/Unterkörper')
  await expect.poll(() => mock.table('training_plans').map(p => p.name)).toEqual(['Oberkörper/Unterkörper'])
  await plan.getByRole('button', { name: 'Schließen und speichern' }).click()

  // In „Heute" steht der leere Plan mit „Workout hinzufügen"; den Namen gibt es nur einmal
  await expect(page.getByRole('button', { name: 'Plan · Oberkörper/Unterkörper – Plan bearbeiten' })).toBeVisible()
  await page.getByRole('button', { name: 'Neuer Plan' }).click()
  await sheet.getByRole('textbox').fill('Oberkörper/Unterkörper')
  await expect(sheet.getByRole('alert')).toHaveText('Diesen Plan gibt es schon.')
  await expect(sheet.getByRole('button', { name: 'Anlegen' })).toBeDisabled()
  await sheet.getByRole('button', { name: /Schließen/ }).first().click()

  await page.getByRole('button', { name: 'Workout hinzufügen' }).click()
  const editor = page.getByRole('dialog', { name: 'Neues Workout' })
  await editor.getByRole('textbox', { name: 'Name' }).fill('OK A')
  await editor.getByRole('button', { name: 'Schließen und speichern' }).click()
  await expect.poll(() => (mock.table('training_routines').find(r => r.name === 'OK A') as { folder: string } | undefined)?.folder).toBe('Oberkörper/Unterkörper')
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
