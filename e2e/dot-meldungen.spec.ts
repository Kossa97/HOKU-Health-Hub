import { TEST_USER } from './support/mockSupabase'
import { expect, test } from './support/fixtures'
import { seedBpc157 } from './support/myStack'

/**
 * Dot trägt per Satz ein: der Nutzer sagt „BPC heute vergessen", Claude meldet
 * das über sein Werkzeug, die App trägt es ein wie der Kalender und bietet
 * „Rückgängig" an. Heute ist der 28.09., 10:00; BPC-157 ist morgens geplant.
 */

const logo = (page: import('@playwright/test').Page) => page.locator('[data-tyd-slot="dot"]')
const lassLaufen = async (page: import('@playwright/test').Page, ms: number) => {
  for (let t = 0; t < ms; t += 100) await page.clock.runFor(100)
}
type Einnahme = { ref: string; datum: string; substanz: string }
const heutigeRef = (kontext: unknown) =>
  ((kontext as { einnahmen: Einnahme[] }).einnahmen.find(e => e.datum === '2026-09-28' && e.substanz === 'BPC-157'))!.ref

const heute = (mock: import('./support/mockSupabase').MockSupabase) =>
  mock.table('dose_logs').filter(l => String(l.routine_slot_key).includes('@2026-09-28T'))

async function chatOeffnen(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(logo(page)).toHaveAttribute('data-dot-bereit', 'true')
  await logo(page).click()
  await lassLaufen(page, 3000)
  await page.getByRole('button', { name: /Dot, dein KI-Coach/ }).click({ force: true })
  await lassLaufen(page, 600)
  return page.getByRole('dialog', { name: 'Dot' })
}

async function sagen(page: import('@playwright/test').Page, chat: import('@playwright/test').Locator, satz: string) {
  await chat.getByRole('textbox').fill(satz)
  await chat.getByRole('button', { name: 'Senden' }).click()
  await lassLaufen(page, 3000)
}

test.beforeEach(({ mock }) => {
  mock.table('profiles').find(row => row.id === TEST_USER.id)!.coach_consent_at = '2026-09-01T00:00:00.000Z'
})

test('„heute vergessen": Dot trägt aus, bestätigt mit Karte, Rückgängig nimmt es zurück', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  mock.coach.antwort = ''
  mock.coach.meldungen = kontext => [{ ref: heutigeRef(kontext), art: 'vergessen', uhrzeit: null }]
  const chat = await chatOeffnen(page)
  await sagen(page, chat, 'BPC heute vergessen')

  await expect(chat.getByText(/BPC-157, heute \d\d:\d\d: als vergessen eingetragen\./)).toBeVisible()
  await expect.poll(() => heute(mock).map(l => l.taken)).toEqual([false])
  // Der Kontext für Claude trägt die Verweise
  expect(mock.coach.calls[0].kontext).toMatchObject({ einnahmen: expect.arrayContaining([expect.objectContaining({ ref: expect.stringMatching(/^e\d+$/) })]) })

  await chat.getByRole('button', { name: 'Rückgängig' }).click()
  await lassLaufen(page, 500)
  await expect(chat.getByText('Rückgängig gemacht.')).toBeVisible()
  await expect.poll(() => heute(mock).length).toBe(0)
  await expect(chat.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0)
})

test('„um 9 genommen": Dot trägt mit der genannten Zeit ein; ohne Schalter bleibt „später" beim Haken', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  mock.coach.antwort = 'Alles klar.'
  mock.coach.meldungen = kontext => [{ ref: heutigeRef(kontext), art: 'genommen', uhrzeit: '09:00' }]
  const chat = await chatOeffnen(page)
  await sagen(page, chat, 'BPC um 9 genommen')
  await expect(chat.getByText('Alles klar.')).toBeVisible()
  await expect(chat.getByText(/BPC-157, heute \d\d:\d\d: als genommen eingetragen \(09:00\)\./)).toBeVisible()
  await expect.poll(() => heute(mock).map(l => [l.taken, l.logged_at, l.auto_logged ?? false])).toEqual([[true, '2026-09-28T07:00:00.000Z', false]])

  // Rückgängig, dann „erst um 22 Uhr": ohne Schalter an der Substanz trägt Dot nicht selbst ein
  await chat.getByRole('button', { name: 'Rückgängig' }).click()
  await expect.poll(() => heute(mock).length).toBe(0)
  mock.coach.antwort = ''
  mock.coach.meldungen = kontext => [{ ref: heutigeRef(kontext), art: 'spaeter', uhrzeit: '22:00' }]
  await sagen(page, chat, 'BPC heute erst um 22 Uhr')
  await expect(chat.getByText(/BPC-157, heute \d\d:\d\d: notiert\. Hak sie um 22:00 selbst ab/)).toBeVisible()
  expect(heute(mock)).toHaveLength(0)
})

test('automatisch eingetragen, dann „heute vergessen": umentschieden samt Bestand; Rückgängig stellt es wieder her', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  mock.table('stack_items')[0].auto_log_since = '2026-09-27T05:00:00.000Z'
  mock.coach.antwort = ''
  mock.coach.meldungen = kontext => [{ ref: heutigeRef(kontext), art: 'vergessen', uhrzeit: null }]
  const chat = await chatOeffnen(page)
  await expect.poll(() => heute(mock).map(l => [l.taken, l.auto_logged])).toEqual([[true, true]])

  await sagen(page, chat, 'BPC heute vergessen')
  await expect(chat.getByText(/BPC-157, heute \d\d:\d\d: als vergessen eingetragen\./)).toBeVisible()
  await expect.poll(() => heute(mock).map(l => l.taken)).toEqual([false])
  // Erst geöffnet (mit Rückbuchung), dann über den Kalenderweg ausgelassen
  expect(mock.rpcCalls.filter(c => c.name === 'reverse_inventory_confirmation').map(c => c.params.p_action)).toEqual(['undo'])

  await chat.getByRole('button', { name: 'Rückgängig' }).click()
  // wieder als „automatisch" markiert, wie vorher
  await expect.poll(() => heute(mock).map(l => [l.taken, l.auto_logged])).toEqual([[true, true]])
  await expect.poll(() => mock.rpcCalls.filter(c => c.name === 'apply_inventory_confirmation').length).toBe(3)
})
