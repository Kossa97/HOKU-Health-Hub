import type { Page } from '@playwright/test'
import { STORAGE_KEY } from './support/mockSupabase'
import { expect, test } from './support/fixtures'

/**
 * Registrieren und Passwort vergessen mit Code aus der Mail (docs/registrierung/PLAN.md).
 * Supabase ist nachgebildet: „E-Mail bestätigen" ist an, der richtige Code ist 123456.
 */

const abgemeldet = async (page: Page) => {
  await page.addInitScript(key => {
    if (sessionStorage.getItem('__e2e_abgemeldet')) return
    sessionStorage.setItem('__e2e_abgemeldet', '1')
    localStorage.removeItem(key)
  }, STORAGE_KEY)
}
const lassLaufen = async (page: Page, ms: number) => {
  for (let t = 0; t < ms; t += 100) await page.clock.runFor(100)
}

async function registriere(page: Page) {
  await page.goto('/auth')
  await page.locator('[data-auth-start-register]').click()
  await page.locator('#auth-user').fill('neu_hier')
  await page.locator('#auth-reg-email').fill('neu@example.test')
  await page.locator('#auth-geburt').fill('1990-05-17')
  await page.locator('#auth-reg-pw').fill('geheim1')
  await page.locator('#auth-reg-pw2').fill('geheim1')
  for (const haken of await page.locator('[data-consent]').all()) await haken.check()
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 1500)
}

test('Registrieren: Code-Ansicht, falscher Code, dann der richtige — angemeldet in der App', async ({ page, mock }) => {
  await abgemeldet(page)
  await registriere(page)

  const ansicht = page.locator('[data-auth-code-ansicht]')
  await expect(ansicht).toBeVisible()
  await expect(ansicht).toContainText('neu@example.test')
  await expect(page.locator('#auth-code')).toHaveAttribute('autocomplete', 'one-time-code')
  // Sprache, Zeitzone und Geburtsdatum gehen mit (für die Mail und das Profil)
  const signup = mock.authMail.calls.find(c => c.pfad === 'signup')
  expect(signup?.body.data).toMatchObject({ username: 'neu_hier', birth_date: '1990-05-17', sprache: 'de', zeitzone: 'Europe/Berlin' })

  // sechs Ziffern prüfen sich von selbst
  await page.locator('#auth-code').fill('111111')
  await lassLaufen(page, 1500)
  await expect(page.getByRole('alert')).toHaveText('Der Code stimmt nicht oder ist abgelaufen.')
  await expect(page.locator('#auth-code')).toHaveValue('')

  // eingefügter Text mit Leerzeichen: nur die Ziffern zählen
  await page.locator('#auth-code').fill('123 456')
  await lassLaufen(page, 3500)
  await expect(page).toHaveURL(/\/$/)
  expect(mock.authMail.calls.filter(c => c.pfad === 'verify').map(c => c.body.token)).toEqual(['111111', '123456'])
})

test('Neuer Code: eine Minute gesperrt, dann geht er raus', async ({ page, mock }) => {
  await abgemeldet(page)
  await registriere(page)
  const knopf = page.locator('[data-auth-neuer-code]')
  await expect(knopf).toBeDisabled()
  await expect(knopf).toHaveText(/Neuer Code in 0:5\d/)
  await lassLaufen(page, 60_000)
  await expect(knopf).toBeEnabled()
  await knopf.click()
  await lassLaufen(page, 300)
  await expect(page.locator('#auth-meldung')).toHaveText('Ein neuer Code ist unterwegs.')
  expect(mock.authMail.calls.filter(c => c.pfad === 'resend')).toHaveLength(1)
  await expect(knopf).toBeDisabled()
})

test('Registrieren mit vergebener Adresse: Hinweis statt Code-Ansicht', async ({ page, mock }) => {
  mock.authMail.vorhanden = true
  await abgemeldet(page)
  await registriere(page)
  await expect(page.locator('[data-auth-code-ansicht]')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveText('Für diese E-Mail-Adresse gibt es schon ein Konto. Melde dich an.')
})

test('Anmelden mit unbestätigter Adresse: neuer Code, Code-Ansicht, dann in die App', async ({ page, mock }) => {
  mock.authMail.unbestaetigt = true
  await abgemeldet(page)
  await page.goto('/auth')
  await page.locator('[data-auth-start-login]').click()
  await page.locator('#auth-kennung').fill('neu@example.test')
  await page.locator('#auth-pw').fill('geheim1')
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 1500)
  await expect(page.locator('[data-auth-code-ansicht]')).toBeVisible()
  await expect(page.locator('#auth-meldung')).toHaveText('Bestätige zuerst deine E-Mail. Wir haben dir einen neuen Code geschickt.')
  expect(mock.authMail.calls.filter(c => c.pfad === 'resend').map(c => c.body.email)).toEqual(['neu@example.test'])
  // E-Mail ändern gibt es nur nach dem Registrieren; zurück führt zum Registrieren
  await page.locator('#auth-code').fill('123456')
  await lassLaufen(page, 3500)
  await expect(page).toHaveURL(/\/$/)
})

test('Passwort vergessen: Code, neues Passwort, angemeldet in der App', async ({ page, mock }) => {
  await abgemeldet(page)
  await page.goto('/auth')
  await page.locator('[data-auth-start-login]').click()
  await page.locator('#auth-kennung').fill('e2e@example.test')
  await page.locator('[data-auth-vergessen]').click()
  // die Adresse aus dem Anmeldefeld steht schon drin
  await expect(page.locator('#auth-vergessen-email')).toHaveValue('e2e@example.test')
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 1500)
  await expect(page.locator('[data-auth-code-ansicht]')).toBeVisible()
  await expect(page.locator('[data-auth-email-aendern]')).toHaveCount(0)
  expect(mock.authMail.calls.filter(c => c.pfad === 'recover').map(c => c.body.email)).toEqual(['e2e@example.test'])

  await page.locator('#auth-code').fill('123456')
  await lassLaufen(page, 2500)
  // die Sitzung steht schon, aber erst mit neuem Passwort geht es weiter
  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.locator('[data-auth-neues-pw]')).toBeVisible()
  await page.locator('#auth-neu-pw').fill('neuesPw1')
  await page.locator('#auth-neu-pw2').fill('anderes')
  await page.locator('[data-auth-submit]').click()
  await expect(page.getByRole('alert')).toHaveText('Die Passwörter stimmen nicht überein.')
  await page.locator('#auth-neu-pw2').fill('neuesPw1')
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 3500)
  await expect(page).toHaveURL(/\/$/)
  expect(mock.authMail.neuesPasswort).toBe('neuesPw1')
})

test('Passwort vergessen, beim neuen Passwort zurück: wieder abgemeldet', async ({ page, mock }) => {
  await abgemeldet(page)
  await page.goto('/auth')
  await page.locator('[data-auth-start-login]').click()
  await page.locator('[data-auth-vergessen]').click()
  await page.locator('#auth-vergessen-email').fill('e2e@example.test')
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 1500)
  await page.locator('#auth-code').fill('123456')
  await lassLaufen(page, 2500)
  await expect(page.locator('[data-auth-neues-pw]')).toBeVisible()
  await page.locator('.tyd-auth-zurueck').click()
  await lassLaufen(page, 500)
  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.locator('#auth-kennung')).toBeVisible()
  expect(mock.log.some(z => z.includes('/auth/v1/logout'))).toBe(true)
  expect(mock.authMail.neuesPasswort).toBeNull()
})

test('Knopf „In Hoku öffnen“ im Browser: erst „Jetzt bestätigen“, dann angemeldet in der App', async ({ page, mock }) => {
  await abgemeldet(page)
  await page.goto(`/auth?bestaetigen=${mock.authMail.hash}&art=signup`)
  await lassLaufen(page, 3000)
  // Link-Prüfer in Mailprogrammen öffnen die Seite probeweise: ohne Tipp wird nichts verbraucht
  await expect(page.locator('[data-auth-link-ansicht]')).toBeVisible()
  expect(mock.authMail.calls.filter(c => c.pfad === 'verify')).toEqual([])
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 4000)
  await expect(page).toHaveURL(/\/$/)
  expect(mock.authMail.calls.filter(c => c.pfad === 'verify').map(c => [c.body.token_hash, c.body.type])).toEqual([[mock.authMail.hash, 'email']])
})

test('Knopf aus der Mail, schon benutzt: Hinweis, Anmeldung bleibt offen', async ({ page, mock }) => {
  await abgemeldet(page)
  await page.goto('/auth?bestaetigen=0000000000000000000000000000000000000000&art=signup')
  await lassLaufen(page, 2000)
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 2500)
  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.getByRole('alert')).toHaveText('Der Knopf in der Mail gilt nicht mehr. Melde dich an oder lass dir einen neuen Code schicken.')
  await expect(page.locator('#auth-kennung')).toBeVisible()
  void mock
})

test('Knopf aus der Mail bei „Passwort vergessen“: gleich zum neuen Passwort', async ({ page, mock }) => {
  await abgemeldet(page)
  await page.goto(`/auth?bestaetigen=${mock.authMail.hash}&art=recovery`)
  await lassLaufen(page, 2000)
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 3000)
  await expect(page.locator('[data-auth-neues-pw]')).toBeVisible()
  await expect(page).toHaveURL(/\/auth$/)
})
