import type { Page } from '@playwright/test'
import { STORAGE_KEY } from './support/mockSupabase'
import { expect, test } from './support/fixtures'

/**
 * Anmeldung mit Dot (docs/login/UEBERGABE.md): Start abgemeldet auf /auth.
 * Fehler im Gerät fragen den Server nicht; falsche Zugangsdaten kommen vom
 * Server; Erfolg öffnet Dots Portal in die App und er fliegt in die Leiste.
 */

const abgemeldet = async (page: Page) => {
  // Die Attrappe legt eine Sitzung an; hier beginnt die Person ohne
  await page.addInitScript(key => {
    if (sessionStorage.getItem('__e2e_abgemeldet')) return
    sessionStorage.setItem('__e2e_abgemeldet', '1')
    localStorage.removeItem(key)
  }, STORAGE_KEY)
}
const lassLaufen = async (page: Page, ms: number) => {
  for (let t = 0; t < ms; t += 100) await page.clock.runFor(100)
}
const zumFormular = async (page: Page) => {
  await page.goto('/auth')
  await page.locator('[data-auth-start-login]').click()
  await expect(page.locator('#auth-kennung')).toBeVisible()
}

test('Fehler im Gerät: leeres Feld markiert, Satz darunter, keine Anfrage', async ({ page, mock }) => {
  await abgemeldet(page)
  await zumFormular(page)
  await page.locator('[data-auth-submit]').click()
  await expect(page.getByRole('alert')).toHaveText('Gib deine E-Mail oder deinen Benutzernamen ein.')
  await expect(page.locator('#auth-kennung')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#auth-kennung')).toHaveAttribute('aria-describedby', 'auth-meldung')
  expect(mock.log.filter(z => z.includes('/auth/v1/token'))).toEqual([])
})

test('Erfolg: Haken, Portal in die App, Dot fliegt in die Leiste', async ({ page, mock }) => {
  await abgemeldet(page)
  await zumFormular(page)
  await page.locator('#auth-kennung').fill('test@example.test')
  await page.locator('#auth-pw').fill('geheim1')
  await page.locator('[data-auth-submit]').click()
  // Denken 1 s, Haken 1,2 s (zeichnet sich, wird grün), ausblenden, Portal, Ruhe, Zusammenfinden, Heimflug (Tempo 0,6)
  await lassLaufen(page, 3000)
  await expect(page).toHaveURL(/\/$/)
  const portal = page.locator('[data-dot-portal]')
  await expect(portal).toBeAttached()
  await lassLaufen(page, 9000)
  // gelandet: das Logo hüpft, die App ist ganz zu sehen
  await expect(page.locator('[data-tyd-slot="dot"] .tyd-dot-huepf')).toHaveAttribute('data-stoss', 'true')
  await expect(page.locator('[data-tyd-slot="dot"]')).toHaveAttribute('data-dot-drinnen', 'true')
  expect(await portal.evaluate(el => el.style.clipPath)).toBe('')
  expect(mock.log.filter(z => z.includes('/auth/v1/token')).length).toBe(1)
})

test('Wurf: Dot klebt an der Wand wie in der App, löst sich und kehrt zur Bühne zurück', async ({ page }) => {
  await abgemeldet(page)
  await page.goto('/auth')
  await lassLaufen(page, 6000)
  const treffer = page.locator('.tyd-dot-treffer')
  const lage = () => treffer.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, w: r.width } })
  const platz = () => page.evaluate(() => localStorage.getItem('tyd.dot.platz.v1'))
  const vorher = await lage(), platzVorher = await platz()
  // schnell nach rechts geworfen
  await treffer.evaluate((el, s) => {
    const ev = (t: string, x: number) => el.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: s.y, bubbles: true, cancelable: true }))
    ev('pointerdown', s.x)
    for (let i = 1; i <= 6; i++) ev('pointermove', s.x + i * 25)
    ev('pointerup', s.x + 150)
  }, { x: vorher.x, y: await treffer.evaluate(el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 }) })
  // über 3 s: am weitesten rechts und am schmalsten (abgeplattet an der Wand)
  let rechts = 0, schmal = Infinity
  for (let t = 0; t < 3000; t += 100) {
    await page.clock.runFor(100)
    const l = await lage(); rechts = Math.max(rechts, l.x); schmal = Math.min(schmal, l.w)
  }
  expect(rechts).toBeGreaterThan(page.viewportSize()!.width - 70)
  expect(schmal).toBeLessThan(vorher.w * 0.92)
  await lassLaufen(page, 7000)
  const zurueck = await lage()
  expect(Math.abs(zurueck.x - vorher.x)).toBeLessThan(3)
  // sein Platz in der App bleibt, wo er war
  expect(await platz()).toBe(platzVorher)
})

test('Benutzername: Anmelden über die Edge Function, falsches Passwort bekommt X und Satz', async ({ page, mock }) => {
  await abgemeldet(page)
  await zumFormular(page)
  await page.locator('#auth-kennung').fill('E2E')
  await page.locator('#auth-pw').fill('falsch1')
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 1200)
  await expect(page.getByRole('alert')).toHaveText('Benutzername, E-Mail oder Passwort stimmt nicht.')
  await expect(page.locator('#auth-pw')).toHaveAttribute('aria-invalid', 'true')
  await page.locator('#auth-pw').fill('geheim1')
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 2500)
  await expect(page).toHaveURL(/\/$/)
  expect(mock.loginName.calls).toEqual([{ name: 'E2E' }, { name: 'E2E' }])
  expect(mock.log.filter(z => z.includes('/auth/v1/token'))).toEqual([])
})

test('Angemeldet bleiben aus: Neuladen behält die Sitzung, ein neuer App-Start fragt wieder', async ({ page, mock }) => {
  void mock
  await abgemeldet(page)
  await zumFormular(page)
  await page.locator('#auth-kennung').fill('test@example.test')
  await page.locator('#auth-pw').fill('geheim1')
  await page.locator('.tyd-auth-schalter').click()
  await expect(page.locator('[data-auth-bleiben]')).not.toBeChecked()
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 2500)
  await expect(page).toHaveURL(/\/$/)
  await page.reload()
  await expect(page).toHaveURL(/\/$/)
  // neuer App-Start: der Lauf im sessionStorage ist weg
  await page.evaluate(() => sessionStorage.removeItem('tyd.appLaeuft'))
  await page.reload()
  await expect(page).toHaveURL(/\/auth$/)
})

test('Registrieren: vergebener Benutzername wird vom Server erkannt, bevor ein Konto entsteht', async ({ page, mock }) => {
  await abgemeldet(page)
  await page.goto('/auth')
  await page.locator('[data-auth-start-register]').click()
  await page.locator('#auth-user').fill('E2E')
  await page.locator('#auth-reg-email').fill('neu@example.test')
  await page.locator('#auth-reg-pw').fill('geheim1')
  await page.locator('#auth-reg-pw2').fill('geheim1')
  for (const haken of await page.locator('[data-consent]').all()) await haken.check()
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 1200)
  await expect(page.getByRole('alert')).toHaveText('Dieser Benutzername ist schon vergeben.')
  await expect(page.locator('#auth-user')).toHaveAttribute('aria-invalid', 'true')
  expect(mock.log.filter(z => z.includes('/auth/v1/signup'))).toEqual([])
})

test('Apple/Google: ohne Einrichtung keine Knöpfe', async ({ page, mock }) => {
  test.skip(process.env.VITE_AUTH_GOOGLE === '1', 'Build mit Anbietern')
  void mock
  await abgemeldet(page)
  await zumFormular(page)
  await expect(page.locator('[data-auth-anbieter]')).toHaveCount(0)
})

test('Apple/Google eingerichtet: Knöpfe stehen oben, Google leitet zu Supabase weiter', async ({ page, mock }) => {
  test.skip(process.env.VITE_AUTH_GOOGLE !== '1' || process.env.VITE_AUTH_APPLE !== '1', 'nur im Build mit Anbietern')
  void mock
  await abgemeldet(page)
  let ziel = ''
  await page.route('**/auth/v1/authorize**', route => { ziel = route.request().url(); return route.fulfill({ status: 200, body: 'weiter' }) })
  await zumFormular(page)
  await expect(page.locator('[data-auth-anbieter]')).toHaveText(['Mit Apple fortfahren', 'Mit Google fortfahren'])
  await page.locator('[data-auth-anbieter="google"]').click()
  await expect.poll(() => ziel).toContain('provider=google')
  expect(decodeURIComponent(ziel)).toContain('/auth?anbieter=google')
})

test('Zurück vom Anbieter mit Sitzung: Haken, Portal, Dot landet in der Leiste', async ({ page, mock }) => {
  void mock
  await page.goto('/auth?anbieter=google')
  await lassLaufen(page, 2500)
  await expect(page).toHaveURL(/\/$/)
  await lassLaufen(page, 9000)
  await expect(page.locator('[data-tyd-slot="dot"] .tyd-dot-huepf')).toHaveAttribute('data-stoss', 'true')
})

test('Zurück vom Anbieter mit Fehler: Satz und X, Adresse bereinigt', async ({ page, mock }) => {
  void mock
  await abgemeldet(page)
  await page.goto('/auth?anbieter=apple&error=access_denied&error_description=abgebrochen')
  await expect(page.getByRole('alert')).toHaveText('Das hat nicht geklappt. Versuch es noch einmal.')
  await expect(page).toHaveURL(/\/auth$/)
})

test('Face ID (Passkey): nach der Landung einrichten, danach mit einem Tipp anmelden', async ({ page, mock }) => {
  test.skip(process.env.VITE_AUTH_PASSKEY !== '1', 'nur im Build mit Passkeys')
  // Auf Apple-Geräten heißt der Knopf Face ID, sonst Passkey (passkeyArt)
  const art = /iPhone|iPad|Macintosh/.test(await page.evaluate(() => navigator.userAgent)) ? 'Face ID' : 'Passkey'
  // Virtueller Authenticator: Face ID mit echter Kryptografie, bestätigt automatisch
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true,
    isUserVerified: true, automaticPresenceSimulation: true,
  } })
  await abgemeldet(page)
  await zumFormular(page)
  await expect(page.locator('[data-auth-faceid]')).toHaveCount(0)
  await page.locator('#auth-kennung').fill('test@example.test')
  await page.locator('#auth-pw').fill('geheim1')
  await page.locator('[data-auth-submit]').click()
  await lassLaufen(page, 12000)
  await expect(page.locator('[data-passkey-nachfrage]')).toBeVisible()
  await expect(page.locator('#passkey-frage-titel')).toHaveText(`Nächstes Mal mit ${art} anmelden?`)
  await page.locator('[data-passkey-einrichten]').click()
  await expect(page.locator('[data-passkey-nachfrage]')).toHaveCount(0)
  expect(mock.passkeys).toHaveLength(1)

  // Abmelden auf dem Gerät: der Knopf steht jetzt neben „Anmelden"
  await page.evaluate(key => localStorage.removeItem(key), STORAGE_KEY)
  await page.goto('/auth')
  await page.locator('[data-auth-start-login]').click()
  await expect(page.locator('[data-auth-faceid]')).toHaveAttribute('aria-label', `Mit ${art} anmelden`)
  await page.locator('[data-auth-faceid]').click()
  await lassLaufen(page, 2500)
  await expect(page).toHaveURL(/\/$/)
  // nach einer Passkey-Anmeldung kommt keine Nachfrage
  await lassLaufen(page, 12000)
  await expect(page.locator('[data-passkey-nachfrage]')).toHaveCount(0)
})

test('Profil: Passkeys sehen und entfernen; der letzte nimmt den Face-ID-Knopf mit', async ({ page, mock }) => {
  test.skip(process.env.VITE_AUTH_PASSKEY !== '1', 'nur im Build mit Passkeys')
  mock.passkeys.push({ id: 'pk-1', credentialId: 'x', created_at: '2026-10-01T10:00:00.000Z' })
  await page.addInitScript(() => localStorage.setItem('tyd.passkey', '1'))
  await page.goto('/profil')
  const bereich = page.locator('[data-passkey-einstellung]')
  await expect(bereich).toContainText('Virtueller Schlüssel')
  await bereich.getByRole('button', { name: 'Virtueller Schlüssel entfernen' }).click()
  await expect(bereich).toContainText('Noch kein Passkey eingerichtet.')
  expect(mock.passkeys).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem('tyd.passkey'))).toBeNull()
})
