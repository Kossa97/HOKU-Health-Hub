import { TEST_USER } from './support/mockSupabase'
import { expect, test } from './support/fixtures'

test.use({ dotFrei: true })

/**
 * Hoku-Chat auf der Trainingsseite: Hoku kennt den Übungskatalog, ein
 * entworfener Plan erscheint als Karte „Plan ansehen" und öffnet die Vorschau
 * im Training. Gespeichert wird erst dort.
 */

const logo = (page: import('@playwright/test').Page) => page.locator('[data-tyd-slot="dot"]')
const lassLaufen = async (page: import('@playwright/test').Page, ms: number) => {
  for (let t = 0; t < ms; t += 100) await page.clock.runFor(100)
}

test('Hoku-Chat im Training: Plan entwerfen, Karte, Vorschau', async ({ page, mock }) => {
  mock.table('profiles').find(row => row.id === TEST_USER.id)!.coach_consent_at = '2026-09-01T00:00:00.000Z'
  mock.coach.antwort = 'Gern, hier ist ein Vorschlag.'
  mock.coach.plaene = [{
    name: 'Push · Pull', zeitplan: 'alle_x_tage', anzahl: 2,
    workouts: [
      { name: 'Push', wochentage: [], uebungen: [{ id: 'bench_press_barbell', saetze: 4, wdhMin: 6, wdhMax: 8, sekunden: null, pauseS: 120 }] },
      { name: 'Pull', wochentage: [], uebungen: [{ id: 'pull_up', saetze: 3, wdhMin: 6, wdhMax: 10, sekunden: null, pauseS: null }] },
    ],
  }]
  await page.goto('/training')
  await expect(logo(page)).toHaveAttribute('data-dot-bereit', 'true', { timeout: 15_000 })
  await logo(page).click()
  await lassLaufen(page, 3000)
  await page.getByRole('button', { name: /Hoku, dein KI-Coach/ }).click({ force: true })
  await lassLaufen(page, 600)
  const chat = page.getByRole('dialog', { name: 'Hoku' })

  await chat.getByRole('button', { name: 'Mach mir einen Trainingsplan' }).click()
  await expect(chat.getByText('„Push · Pull“ ist fertig: 2 Workouts. Schau ihn dir an und übernimm ihn.')).toBeVisible({ timeout: 10_000 })
  const call = mock.coach.calls.at(-1) as { seite: string; kontext: Record<string, unknown> & { training: { katalog: string[] } } }
  expect(call.seite).toBe('training')
  // Der Katalog steht vorn, damit eine Kürzung ihn nicht trifft
  expect(Object.keys(call.kontext)[0]).toBe('training')

  await chat.getByRole('button', { name: 'Plan ansehen' }).click()
  const preview = page.getByRole('dialog', { name: 'Vorschau' })
  await expect(preview.getByRole('textbox', { name: 'Name' })).toHaveValue('Push · Pull')
  await expect(preview).toContainText('alle 2 Tage')
  expect(mock.table('training_routines')).toHaveLength(0)
})
