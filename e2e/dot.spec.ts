import { TEST_USER } from './support/mockSupabase'
import { expect, test } from './support/fixtures'

test.use({ dotFrei: true })

/**
 * Hoku, der KI-Coach: wohnt für alle in der Leiste. Bis Pro startet, kommt er
 * für alle heraus (PRO_PFLICHT aus). Chat nur mit Einwilligung.
 */

const logo = (page: import('@playwright/test').Page) => page.locator('[data-tyd-slot="dot"]')
const bereit = async (page: import('@playwright/test').Page) => {
  await expect(logo(page)).toHaveAttribute('data-dot-bereit', 'true')
}
const lassLaufen = async (page: import('@playwright/test').Page, ms: number) => {
  for (let t = 0; t < ms; t += 100) await page.clock.runFor(100)
}

test('bis Pro startet, kommt Hoku auch ohne Pro heraus', async ({ page, mock }) => {
  await page.goto('/')
  await bereit(page)
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'true')
  await logo(page).click()
  await lassLaufen(page, 3000)
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'false')
  await expect(page.getByText('Hoku kommt mit Pro heraus')).toHaveCount(0)
  expect(mock.coach.calls).toEqual([])
})

test('mit Pro: herausholen, einwilligen, fragen, zurück ins Haus', async ({ page, mock }) => {
  const profil = mock.table('profiles').find(row => row.id === TEST_USER.id)!
  profil.pro_until = '2099-01-01T00:00:00.000Z'
  mock.coach.antwort = 'Heute ist nichts geplant. Genieß den Tag.'
  await page.goto('/')
  await bereit(page)
  await logo(page).click()
  await lassLaufen(page, 3000)
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'false')

  const figur = page.getByRole('button', { name: /Hoku, dein KI-Coach/ })
  await expect(figur).toBeVisible()
  // Seine Trefferfläche folgt dem atmenden Umriss und steht nie ganz still;
  // WebKit wartet sonst vergeblich auf ein „stabiles" Element
  await figur.click({ force: true })
  await lassLaufen(page, 600)

  const chat = page.getByRole('dialog', { name: 'Hoku' })
  await expect(chat.getByRole('heading', { name: 'Bevor wir reden' })).toBeVisible()
  await chat.getByRole('button', { name: 'Einverstanden' }).click()
  await expect(chat.getByRole('button', { name: 'Was steht heute an?' })).toBeVisible()

  await chat.getByRole('button', { name: 'Was steht heute an?' }).click()
  await lassLaufen(page, 4000)
  await expect(chat.getByText('Heute ist nichts geplant. Genieß den Tag.')).toBeVisible()
  expect(mock.coach.calls).toHaveLength(1)
  expect(mock.coach.calls[0].nachrichten.at(-1)).toEqual({ rolle: 'ich', text: 'Was steht heute an?' })
  expect(mock.coach.calls[0].sprache).toBe('de')
  expect(mock.coach.calls[0].seite).toBe('home')

  await chat.getByRole('button', { name: 'Geh in dein Haus' }).click()
  await lassLaufen(page, 4000)
  await expect(chat).toBeHidden()
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'true')
})

test('dreimal schnell auf dieselbe Stelle tippen ruft Hoku dorthin', async ({ page, mock }) => {
  const profil = mock.table('profiles').find(row => row.id === TEST_USER.id)!
  profil.pro_until = '2099-01-01T00:00:00.000Z'
  await page.goto('/')
  await bereit(page)
  await logo(page).click()
  await lassLaufen(page, 3000)
  const figur = page.getByRole('button', { name: /Hoku, dein KI-Coach/ })
  await expect(figur).toBeVisible()
  // auf eine freie Fläche tippen: unter der leeren Stack-Karte
  await page.goto('/my-stack')
  await bereit(page)
  await lassLaufen(page, 1500)
  const karte = (await page.getByText('Noch keine Substanzen').boundingBox())!
  const vorher = (await figur.boundingBox())!
  const ziel = { x: vorher.x + vorher.width / 2 < 160 ? 240 : 80, y: karte.y + 260 }

  // zweimal reicht nicht
  await page.touchscreen.tap(ziel.x, ziel.y)
  await page.touchscreen.tap(ziel.x, ziel.y)
  await lassLaufen(page, 1500)
  let b = (await figur.boundingBox())!
  expect(Math.hypot(b.x + b.width / 2 - ziel.x, b.y + b.height / 2 - ziel.y)).toBeGreaterThan(60)

  for (let i = 0; i < 3; i++) await page.touchscreen.tap(ziel.x + i, ziel.y - i)
  await lassLaufen(page, 2500)
  b = (await figur.boundingBox())!
  expect(Math.hypot(b.x + b.width / 2 - ziel.x, b.y + b.height / 2 - ziel.y)).toBeLessThan(30)
})

test('Kalorientracker: Hoku fliegt um die Kugel und sagt je Halt, was offen ist; danach alles zusammen', async ({ page, mock }) => {
  await page.goto('/ernaehrung')
  await expect(page.getByRole('region', { name: 'Frühstück' })).toBeVisible()
  const blase = page.locator('.tyd-dot-blase')
  // Je Halt ein Satz: Kugel, dann die drei Monde; gesammelt, während er fliegt
  const gesagt = new Set<string>()
  for (let t = 0; t < 12_000; t += 100) {
    await page.clock.runFor(100)
    const text = (await blase.textContent())?.trim()
    if (text && (await blase.getAttribute('data-zeigen')) === 'true') gesagt.add(text)
  }
  expect([...gesagt]).toEqual(expect.arrayContaining([
    'Noch alle 2000 kcal frei.', 'Eiweiß: noch 110 g.', 'Kohlenhydrate: noch 230 g.', 'Fett: noch 65 g.', 'Heute ist noch alles offen.',
  ]))
  // Gemerkt: frühestens in zwei Stunden wieder. Gesprochen wird ohne KI (keine Anfrage an den Coach).
  expect(await page.evaluate(() => localStorage.getItem('tyd.dot.rundflug.v1'))).toBeTruthy()
  expect(mock.coach.calls).toEqual([])
})

test('Kalorientracker sonst: nur ein Umlauf, ohne Sätze; der Rundflug kommt erst beim dritten Öffnen', async ({ page, mock }) => {
  // Gerade geflogen, seither zweimal geöffnet: dieses Öffnen ist das erste danach
  await page.addInitScript(() => { localStorage.setItem('tyd.dot.rundflug.v1', JSON.stringify({ t: Date.now(), n: 0 })) })
  await page.goto('/ernaehrung')
  await expect(page.getByRole('region', { name: 'Frühstück' })).toBeVisible()
  const blase = page.locator('.tyd-dot-blase')
  for (let t = 0; t < 7000; t += 100) {
    await page.clock.runFor(100)
    expect(await blase.getAttribute('data-zeigen')).not.toBe('true')
  }
  // Gezählt: einmal geöffnet
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('tyd.dot.rundflug.v1')))!).n).toBe(1)
  expect(mock.coach.calls).toEqual([])
})

test('nach dem Abmelden: auf der Anmeldung gilt die Leiste der App nicht mehr, Hoku kommt bis an den unteren Rand', async ({ page, mock }) => {
  // Nutzer 02.11.2026: im Login nur oben an den Rand, und das Tor seines Hauses leuchtete über der Fußzeile
  void mock
  await page.goto('/profil')
  await bereit(page)
  await logo(page).click()
  await lassLaufen(page, 3000)
  page.on('dialog', d => d.accept())
  await page.getByRole('button', { name: /Abmelden/ }).click()
  await lassLaufen(page, 7000)
  await expect(page).toHaveURL(/auth/)
  const figur = page.getByRole('button', { name: /Hoku, dein KI-Coach/ })
  const { width: W, height: H } = page.viewportSize()!
  const b = (await figur.boundingBox())!
  const x = b.x + b.width / 2, y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) { await page.mouse.move(x + (W / 2 - x) * i / 20, y + (H - 2 - y) * i / 20); await page.clock.runFor(16) }
  await lassLaufen(page, 300)
  const g = (await figur.boundingBox())!
  await page.mouse.up()
  expect(g.y + g.height).toBeGreaterThan(H - 12)
})

test('Seite „Hoku“: er kommt aus dem Haus ins Glasgehäuse und geht beim Verlassen wieder hinein', async ({ page, mock }) => {
  void mock
  await page.goto('/profil')
  await bereit(page)
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'true')
  await page.locator('[data-profil-hoku]').click()
  await expect(page).toHaveURL(/\/profil\/hoku$/)
  await lassLaufen(page, 4000)
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'false')
  // er schwebt im Glas
  const glas = (await page.locator('[data-hoku-buehne]').boundingBox())!
  const b = (await page.getByRole('button', { name: /Hoku, dein KI-Coach/ }).boundingBox())!
  expect(b.x + b.width / 2).toBeGreaterThan(glas.x)
  expect(b.x + b.width / 2).toBeLessThan(glas.x + glas.width)
  expect(b.y + b.height / 2).toBeGreaterThan(glas.y)
  expect(b.y + b.height / 2).toBeLessThan(glas.y + glas.height)
  // Einstellungen bleiben auf dem Gerät (Glas-Schalter: antippen schaltet um)
  await page.locator('[data-hoku-einst="raus"] [role="switch"]').click()
  await expect(page.locator('[data-hoku-einst="raus"] [role="switch"]')).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate(() => localStorage.getItem('tyd.hoku.raus'))).toBe('0')
  await page.goBack()
  await lassLaufen(page, 4000)
  await expect(logo(page)).toHaveAttribute('data-dot-drinnen', 'true')
})

test('Glasgehäuse: geworfen bleibt er im Glas, klebt platt an der Scheibe und liegt in der Ecke ruhig auf dem Boden', async ({ page, mock }) => {
  // Nutzer 04.11.2026: nur innerhalb des Gehäuses beweglich; in den Ecken nicht zucken, vernünftig hinlegen
  void mock
  await page.goto('/profil/hoku')
  await lassLaufen(page, 4500)
  const glas = (await page.locator('[data-hoku-buehne]').boundingBox())!
  const figur = page.getByRole('button', { name: /Hoku, dein KI-Coach/ })
  const wirf = async (dx: number, dy: number) => {
    const b = (await figur.boundingBox())!, x = b.x + b.width / 2, y = b.y + b.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 5; i++) { await page.mouse.move(x + dx * i, y + dy * i); await page.clock.runFor(16) }
    await page.mouse.up()
  }
  // kräftig nach rechts: er fliegt an die Scheibe und ragt nicht hinaus
  await wirf(40, 0)
  await lassLaufen(page, 900)
  let b = (await figur.boundingBox())!
  expect(b.x + b.width / 2).toBeGreaterThan(glas.x + glas.width * 0.6)
  // (die Trefferfläche ist ringsum etwas größer als sein Körper)
  expect(b.x + b.width).toBeLessThan(glas.x + glas.width + 12)
  // nach dem Lösen: nach unten rechts in die Ecke; dort liegt er flach auf dem Boden statt um die Ecke gebogen
  await lassLaufen(page, 6500)
  await wirf(30, 22)
  // er schwingt einmal sanft nach; danach darf er sich nicht mehr bewegen
  await lassLaufen(page, 2800)
  const lagen: number[] = []
  for (let i = 0; i < 10; i++) { await lassLaufen(page, 60); const q = (await figur.boundingBox())!; lagen.push(q.x + q.width / 2) }
  b = (await figur.boundingBox())!
  expect(b.width).toBeGreaterThan(b.height * 1.5)
  expect(b.y + b.height).toBeLessThan(glas.y + glas.height)
  // ruhig: langsames Anschmiegen darf noch ein paar px sein (die Trefferfläche atmet mit dem Umriss)
  expect(Math.max(...lagen) - Math.min(...lagen), 'liegt ruhig').toBeLessThan(5)
})

test('„Kommt für Hinweise heraus“ aus: auf einer Seite ohne Leiste bleibt er im Haus', async ({ page, mock }) => {
  void mock
  await page.addInitScript(() => { try { localStorage.setItem('tyd.hoku.raus', '0') } catch { /* ohne Speicher */ } })
  await page.goto('/injektionen')
  await lassLaufen(page, 5000)
  await expect(page.getByRole('button', { name: /Hoku, dein KI-Coach/ })).toBeHidden()
})

test('Hinweise aus: im Kalorientracker kein Rundflug und keine Sprechblase', async ({ page, mock }) => {
  void mock
  await page.addInitScript(() => { try { localStorage.setItem('tyd.hoku.hinweise', '0') } catch { /* ohne Speicher */ } })
  await page.goto('/ernaehrung')
  await expect(page.getByRole('region', { name: 'Frühstück' })).toBeVisible()
  const blase = page.locator('.tyd-dot-blase')
  for (let t = 0; t < 12_000; t += 100) {
    await page.clock.runFor(100)
    expect(await blase.getAttribute('data-zeigen')).toBeNull()
  }
})
