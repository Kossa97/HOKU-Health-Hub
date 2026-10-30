import { TEST_USER } from './support/mockSupabase'
import { expect, test } from './support/fixtures'
import { next, seedBpc157 } from './support/myStack'

test.use({ dotFrei: true })

/**
 * Hoku trägt per Satz ein: der Nutzer sagt „BPC heute vergessen", Claude meldet
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
  await expect(logo(page)).toHaveAttribute('data-dot-bereit', 'true', { timeout: 15_000 })
  await logo(page).click()
  await lassLaufen(page, 3000)
  await page.getByRole('button', { name: /Hoku, dein KI-Coach/ }).click({ force: true })
  await lassLaufen(page, 600)
  return page.getByRole('dialog', { name: 'Hoku' })
}

async function sagen(page: import('@playwright/test').Page, chat: import('@playwright/test').Locator, satz: string) {
  await chat.getByRole('textbox').fill(satz)
  await chat.getByRole('button', { name: 'Senden' }).click()
  await lassLaufen(page, 3000)
}

test.beforeEach(({ mock }) => {
  mock.table('profiles').find(row => row.id === TEST_USER.id)!.coach_consent_at = '2026-09-01T00:00:00.000Z'
})

test('„heute vergessen": Hoku trägt aus, bestätigt mit Karte, Rückgängig nimmt es zurück', async ({ page, mock }) => {
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

test('„um 9 genommen": Hoku trägt mit der genannten Zeit ein; ohne Schalter bleibt „später" beim Haken', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  mock.coach.antwort = 'Alles klar.'
  mock.coach.meldungen = kontext => [{ ref: heutigeRef(kontext), art: 'genommen', uhrzeit: '09:00' }]
  const chat = await chatOeffnen(page)
  await sagen(page, chat, 'BPC um 9 genommen')
  await expect(chat.getByText('Alles klar.')).toBeVisible()
  await expect(chat.getByText(/BPC-157, heute \d\d:\d\d: als genommen eingetragen \(09:00\)\./)).toBeVisible()
  await expect.poll(() => heute(mock).map(l => [l.taken, l.logged_at, l.auto_logged ?? false])).toEqual([[true, '2026-09-28T07:00:00.000Z', false]])

  // Rückgängig, dann „erst um 22 Uhr": ohne Schalter an der Substanz trägt Hoku nicht selbst ein
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

test('eine überholte Karte nimmt nichts zurück, was danach entschieden wurde', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  mock.coach.antwort = ''
  mock.coach.meldungen = kontext => [{ ref: heutigeRef(kontext), art: 'vergessen', uhrzeit: null }]
  const chat = await chatOeffnen(page)
  await sagen(page, chat, 'BPC heute vergessen')
  await expect.poll(() => heute(mock).map(l => l.taken)).toEqual([false])
  mock.coach.meldungen = kontext => [{ ref: heutigeRef(kontext), art: 'genommen', uhrzeit: '09:00' }]
  await sagen(page, chat, 'doch, um 9 genommen')
  await expect.poll(() => heute(mock).map(l => l.taken)).toEqual([true])

  // Rückgängig auf der ersten Karte: der Platz ist inzwischen genommen, das bleibt
  await chat.getByRole('button', { name: 'Rückgängig' }).first().click()
  await expect(chat.getByText('Das hat sich inzwischen geändert, ich lasse es so. Bitte im Kalender prüfen.')).toBeVisible()
  expect(heute(mock).map(l => l.taken)).toEqual([true])
})

test('„leg BPC-157 an, Vial, 250 mcg morgens": Hoku bereitet vor, der Assistent öffnet sich vorbefüllt, gespeichert wird dort', async ({ page, mock }) => {
  mock.coach.antwort = 'Mach ich.'
  mock.coach.anlagen = [{
    name: 'BPC-157', form: 'vial', menge: 250, einheit: 'mcg',
    zeiten: [{ tageszeit: 'morning', uhrzeit: null }], rhythmus: 'taeglich', wochentage: [], alleNTage: null,
  }]
  const chat = await chatOeffnen(page)
  await sagen(page, chat, 'Leg BPC-157 an, Vial, 250 mcg morgens')
  await expect(chat.getByText('BPC-157 · 250 mcg · morgens: Ich habe alles für dich vorbereitet.', { exact: false })).toBeVisible()
  // Noch nichts gespeichert
  expect(mock.rpcCalls.filter(c => c.name === 'save_stack_item_with_plan')).toHaveLength(0)

  await chat.getByRole('button', { name: 'Ansehen und speichern' }).click()
  await lassLaufen(page, 1500)
  await expect(page).toHaveURL(/\/my-stack/)
  const wizard = page.getByRole('dialog', { name: 'Substanz hinzufügen' })
  await expect(wizard.getByRole('radio', { name: 'Vial' })).toHaveAttribute('aria-checked', 'true')
  await next(wizard, 'Zusammensetzung')
  await wizard.getByRole('spinbutton', { name: 'Wirkstoff im Vial' }).fill('5')
  await wizard.getByRole('spinbutton', { name: 'Lösungsmittel' }).fill('2')
  await next(wizard, 'Einnahmeplan')
  await expect(wizard.getByRole('spinbutton', { name: /^Menge/ })).toHaveValue('250')
  await expect(wizard.getByRole('combobox', { name: 'Einheit' })).toHaveValue('mcg')
  await next(wizard, 'Zusammenfassung')
  await expect(wizard.getByText('Morgens · 250 mcg')).toBeVisible()
  await wizard.getByRole('button', { name: 'Speichern' }).click()
  await expect(wizard).toBeHidden()
  const save = mock.rpcCalls.find(call => call.name === 'save_stack_item_with_plan')
  expect(save?.params).toMatchObject({
    p_item: { display_name: 'BPC-157', dosage_form: 'vial' },
    p_plan: { dose: 250, unit: 'mcg', intake_time: 'morgens' },
  })
})

test('Hoku hört zu: Mikrofon tippen, sprechen, das Gehörte geht ab wie getippt', async ({ page, mock }) => {
  // Nachgebildete Spracherkennung des Browsers: erst ein Zwischenstand, dann der Satz
  await page.addInitScript(() => {
    class Erkennung {
      lang = ''; continuous = false; interimResults = false
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {
        (window as unknown as { __sprache: string }).__sprache = this.lang
        const ergebnis = (text: string, isFinal: boolean) => ({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] })
        setTimeout(() => this.onresult?.(ergebnis('Wie viel', false)), 50)
        setTimeout(() => this.onresult?.(ergebnis('Wie viel BPC habe ich noch?', true)), 120)
        setTimeout(() => this.onend?.(), 200)
      }
      stop() { this.onend?.() }
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: Erkennung, webkitSpeechRecognition: Erkennung })
  })
  mock.coach.antwort = 'Du hast noch zwei Vials.'
  const chat = await chatOeffnen(page)
  await chat.getByRole('button', { name: 'Sprechen' }).click()
  await lassLaufen(page, 3000)
  await expect(chat.getByText('Du hast noch zwei Vials.')).toBeVisible()
  expect(mock.coach.calls[0].nachrichten.at(-1)).toEqual({ rolle: 'ich', text: 'Wie viel BPC habe ich noch?' })
  expect(await page.evaluate(() => (window as unknown as { __sprache: string }).__sprache)).toBe('de-DE')
})

test('ohne Spracherkennung im Browser gibt es keinen Mikrofon-Knopf', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
  })
  const chat = await chatOeffnen(page)
  await expect(chat.getByRole('button', { name: 'Sprechen' })).toHaveCount(0)
  await expect(chat.getByRole('button', { name: 'Senden' })).toBeVisible()
})

test('Chat zu, während Hoku zuhört: das halb Gehörte geht nicht ab', async ({ page, mock }) => {
  // Spricht und hört nicht von selbst auf; abort() endet wie im Standard: erst „aborted", dann „end"
  await page.addInitScript(() => {
    class Erkennung {
      lang = ''; continuous = false; interimResults = false
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() { setTimeout(() => this.onresult?.({ results: [[{ transcript: 'Wie viel' }]] }), 50) }
      stop() { this.onend?.() }
      abort() { this.onerror?.({ error: 'aborted' }); this.onend?.() }
    }
    Object.assign(window, { SpeechRecognition: Erkennung, webkitSpeechRecognition: Erkennung })
  })
  const chat = await chatOeffnen(page)
  await chat.getByRole('button', { name: 'Sprechen' }).click()
  await lassLaufen(page, 300)
  await expect(chat.getByRole('textbox')).toHaveValue('Wie viel')
  await chat.getByRole('button', { name: 'Chat schließen' }).click()
  await lassLaufen(page, 1500)
  expect(mock.coach.calls).toHaveLength(0)
})
