import { describe, expect, it } from 'vitest'
import { pruefeSignatur, secretBytes, TOLERANZ_S } from './signatur'
import { codeMail, escape, gueltigBis, hinweisMail } from './vorlagen'
import { appLink, planeMails, spracheVon, type Einstellungen } from './logik'

const SECRET_ROH = 'hoku-test-secret-0123456789abcdef'
const SECRET = `v1,whsec_${btoa(SECRET_ROH)}`

async function signiere(id: string, zeit: string, body: string, roh = SECRET_ROH) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(roh), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${zeit}.${body}`)))
  return `v1,${btoa(String.fromCharCode(...sig))}`
}

describe('auth-mail: Signatur', () => {
  const body = '{"user":{}}'
  const jetzt = 1_800_000_000
  const zeit = String(jetzt)

  it('liest das Secret mit und ohne Vorsilben', () => {
    expect(secretBytes(SECRET)).not.toBeNull()
    expect(secretBytes(`whsec_${btoa(SECRET_ROH)}`)).not.toBeNull()
    expect(secretBytes('')).toBeNull()
    expect(secretBytes('v1,whsec_')).toBeNull()
  })

  it('nimmt eine gültige Signatur, auch neben einer alten', async () => {
    const sig = await signiere('msg_1', zeit, body)
    expect(await pruefeSignatur(SECRET, { id: 'msg_1', zeit, signatur: sig }, body, jetzt)).toBeNull()
    const alt = await signiere('msg_1', zeit, body, 'altes-secret-xyz')
    expect(await pruefeSignatur(SECRET, { id: 'msg_1', zeit, signatur: `${alt} ${sig}` }, body, jetzt)).toBeNull()
  })

  it('lehnt veränderten Inhalt, falsches Secret, fehlende Köpfe und alte Zeit ab', async () => {
    const sig = await signiere('msg_1', zeit, body)
    expect(await pruefeSignatur(SECRET, { id: 'msg_1', zeit, signatur: sig }, body + ' ', jetzt)).toBe('signatur')
    expect(await pruefeSignatur(SECRET, { id: 'msg_2', zeit, signatur: sig }, body, jetzt)).toBe('signatur')
    const fremd = await signiere('msg_1', zeit, body, 'fremdes-secret')
    expect(await pruefeSignatur(SECRET, { id: 'msg_1', zeit, signatur: fremd }, body, jetzt)).toBe('signatur')
    expect(await pruefeSignatur(SECRET, { id: null, zeit, signatur: sig }, body, jetzt)).toBe('kopf_fehlt')
    expect(await pruefeSignatur(SECRET, { id: 'msg_1', zeit, signatur: sig }, body, jetzt + TOLERANZ_S + 1)).toBe('zeit')
    expect(await pruefeSignatur(SECRET, { id: 'msg_1', zeit: 'abc', signatur: sig }, body, jetzt)).toBe('zeit')
    expect(await pruefeSignatur('', { id: 'msg_1', zeit, signatur: sig }, body, jetzt)).toBe('kein_secret')
    expect(await pruefeSignatur(SECRET, { id: 'msg_1', zeit, signatur: 'v1,%%%' }, body, jetzt)).toBe('signatur')
  })
})

describe('auth-mail: Vorlagen', () => {
  const basis = { code: '305805', minuten: 15, bis: '11:35', appUrl: 'https://hokuhealth.app/' }

  it('Code steht im Betreff, im Text, im Vorschautext und markierbar im HTML', () => {
    const m = codeMail({ ...basis, art: 'signup', sprache: 'de' })
    expect(m.betreff).toBe('305805 ist dein Hoku-Code')
    expect(m.text).toContain('Dein Code: 305805')
    expect(m.text).toContain('Gültig für 15 Minuten · bis 11:35 Uhr')
    expect(m.html).toContain('Tippen und halten zum Kopieren')
    expect(m.html).toContain('user-select:all;">305805</div>')
    expect(m.html).toMatch(/display:none[^>]*>Dein Code: 305805</)
    expect(m.html).toContain('https://hokuhealth.app/impressum')
    // Brand-Kit: Hauptlogo im Kopf, dunkle Fläche, Cyan-Akzent
    expect(m.html).toContain('src="cid:hoku-logo" width="240"')
    expect(m.html).not.toContain('/mail/hoku-health-hub-logo')
    expect(m.html).toContain('alt="HOKU · HEALTH HUB"')
    expect(m.html).toContain('content="dark"')
    expect(m.html).not.toContain('hokuhealth.app//')
  })

  it('jede Art gibt es auf Deutsch und Englisch', () => {
    const arten = ['signup', 'recovery', 'email_change_alt', 'email_change_neu', 'reauthentication', 'anmelden'] as const
    for (const art of arten) {
      const de = codeMail({ ...basis, art, sprache: 'de' })
      const en = codeMail({ ...basis, art, sprache: 'en' })
      expect(de.betreff).toContain('305805')
      expect(en.betreff).toContain('305805')
      expect(de.betreff).not.toBe(en.betreff)
      expect(en.html).toContain('<html lang="en">')
    }
    expect(codeMail({ ...basis, bis: null, art: 'recovery', sprache: 'en' }).text).toContain('Valid for 15 minutes\nThe code can only be used once.')
  })

  it('Hinweise ohne Code, Anbieter wird genannt und escaped', () => {
    const m = hinweisMail({ art: 'anmeldung_verknuepft', sprache: 'de', anbieter: '<Apple>', appUrl: 'https://hokuhealth.app' })
    expect(m.text).toContain('(<Apple>)')
    expect(m.html).toContain('(&lt;Apple&gt;)')
    expect(m.html).not.toContain('<Apple>')
    expect(escape(`"a'&`)).toBe('&quot;a&#39;&amp;')
  })

  it('Uhrzeit in der Zeitzone der Person, sonst keine', () => {
    const jetzt = new Date('2026-11-03T10:20:00Z')
    expect(gueltigBis(jetzt, 15, 'Europe/Berlin', 'de')).toBe('11:35')
    expect(gueltigBis(jetzt, 15, 'America/New_York', 'en')).toBe('05:35')
    expect(gueltigBis(jetzt, 15, 'Mond/Basis', 'de')).toBeNull()
    expect(gueltigBis(jetzt, 15, undefined, 'de')).toBeNull()
  })
})

describe('auth-mail: wer bekommt was', () => {
  const e: Einstellungen = { minuten: 15, appUrl: 'https://hokuhealth.app', jetzt: new Date('2026-11-03T10:20:00Z') }
  const user = (meta: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
    ({ email: 'a@example.com', user_metadata: meta, ...extra })

  it('Sprache aus den Metadaten, ältere Konten deutsch', () => {
    expect(spracheVon({ sprache: 'en' })).toBe('en')
    expect(spracheVon({ sprache: 'en-US' })).toBe('en')
    expect(spracheVon({ sprache: 'fr' })).toBe('de')
    expect(spracheVon(undefined)).toBe('de')
  })

  it('Registrieren: eine Mail an die Adresse, mit Uhrzeit aus der Zeitzone', () => {
    const plan = planeMails({ user: user({ sprache: 'en', zeitzone: 'Europe/Berlin' }), email_data: { email_action_type: 'signup', token: '123456' } }, e)
    expect(Array.isArray(plan) && plan.length).toBe(1)
    if (typeof plan === 'string') throw new Error(plan)
    expect(plan[0].an).toBe('a@example.com')
    expect(plan[0].mail.betreff).toBe('123456 is your Hoku code')
    expect(plan[0].mail.text).toContain('until 11:35')
  })

  it('Passwort vergessen nutzt den Recovery-Text', () => {
    const plan = planeMails({ user: user(), email_data: { email_action_type: 'recovery', token: '654321' } }, e)
    if (typeof plan === 'string') throw new Error(plan)
    expect(plan[0].mail.betreff).toBe('654321 ist dein Code zum Zurücksetzen')
  })

  it('E-Mail ändern, sicher: token an die alte, token_new an die neue Adresse', () => {
    const plan = planeMails({
      user: user({}, { new_email: 'neu@example.com' }),
      email_data: { email_action_type: 'email_change', token: '111111', token_new: '222222' },
    }, e)
    if (typeof plan === 'string') throw new Error(plan)
    expect(plan.map(p => [p.an, p.mail.betreff.slice(0, 6)])).toEqual([
      ['a@example.com', '111111'],
      ['neu@example.com', '222222'],
    ])
  })

  it('E-Mail ändern ohne „sicher": eine Mail an die neue Adresse', () => {
    const plan = planeMails({
      user: user({}, { new_email: 'neu@example.com' }),
      email_data: { email_action_type: 'email_change', token: '', token_new: '333333' },
    }, e)
    if (typeof plan === 'string') throw new Error(plan)
    expect(plan).toHaveLength(1)
    expect(plan[0].an).toBe('neu@example.com')
  })

  it('Hinweis nach Adressänderung geht an die alte Adresse', () => {
    const plan = planeMails({
      user: user({}, { email: 'neu@example.com' }),
      email_data: { email_action_type: 'email_changed_notification', old_email: 'alt@example.com' },
    }, e)
    if (typeof plan === 'string') throw new Error(plan)
    expect(plan[0].an).toBe('alt@example.com')
    expect(plan[0].mail.betreff).toBe('Deine E-Mail-Adresse wurde geändert')
  })

  it('verknüpfte Anmeldung nennt den Anbieter', () => {
    const plan = planeMails({ user: user(), email_data: { email_action_type: 'identity_linked_notification', provider: 'apple' } }, e)
    if (typeof plan === 'string') throw new Error(plan)
    expect(plan[0].mail.text).toContain('(Apple)')
  })

  it('unbrauchbare Aufrufe werden abgelehnt', () => {
    expect(planeMails(null, e)).toBe('payload')
    expect(planeMails({ user: user() }, e)).toBe('payload')
    expect(planeMails({ user: user(), email_data: { email_action_type: 'signup', token: 'abc' } }, e)).toBe('token')
    expect(planeMails({ user: { email: '' }, email_data: { email_action_type: 'signup', token: '123456' } }, e)).toBe('empfaenger')
    expect(planeMails({ user: user(), email_data: { email_action_type: 'unbekannt', token: '123456' } }, e)).toBe('art')
  })
})

describe('auth-mail: Knopf „In Hoku öffnen"', () => {
  const e: Einstellungen = { minuten: 15, appUrl: 'https://hokuhealth.app/', jetzt: new Date('2026-11-03T10:20:00Z') }
  const HASH = '7d5b7b1964cf5d388340a7f04f1dbb5eeb6c7b52ef8270e1737a58d0'

  it('Link nur für Registrieren und Passwort vergessen, nur mit sauberem Hash', () => {
    expect(appLink('https://hokuhealth.app/', 'signup', HASH)).toBe(`https://hokuhealth.app/auth?bestaetigen=${HASH}&art=signup`)
    expect(appLink('https://hokuhealth.app', 'recovery', HASH)).toBe(`https://hokuhealth.app/auth?bestaetigen=${HASH}&art=recovery`)
    expect(appLink('https://hokuhealth.app', 'email_change_neu', HASH)).toBeNull()
    expect(appLink('https://hokuhealth.app', 'signup', '')).toBeNull()
    expect(appLink('https://hokuhealth.app', 'signup', 'abc"><script>')).toBeNull()
  })

  it('Registrieren: Knopf über dem Code, auch im Text', () => {
    const plan = planeMails({ user: { email: 'a@example.com', user_metadata: {} }, email_data: { email_action_type: 'signup', token: '123456', token_hash: HASH } }, e)
    if (typeof plan === 'string') throw new Error(plan)
    const { html, text } = plan[0].mail
    expect(html).toContain(`href="https://hokuhealth.app/auth?bestaetigen=${HASH}&amp;art=signup"`)
    expect(html).toContain('>In Hoku öffnen</a>')
    expect(html.indexOf('>In Hoku öffnen</a>')).toBeLessThan(html.indexOf('user-select:all;">123456'))
    expect(text).toContain(`In Hoku öffnen: https://hokuhealth.app/auth?bestaetigen=${HASH}&art=signup`)
  })

  it('ohne Hash oder bei E-Mail-Änderung: kein Knopf, nur der Code', () => {
    const ohne = planeMails({ user: { email: 'a@example.com' }, email_data: { email_action_type: 'signup', token: '123456' } }, e)
    if (typeof ohne === 'string') throw new Error(ohne)
    expect(ohne[0].mail.html).not.toContain('In Hoku öffnen')
    const wechsel = planeMails({ user: { email: 'a@example.com', new_email: 'b@example.com' }, email_data: { email_action_type: 'email_change', token: '111111', token_new: '222222', token_hash: HASH } }, e)
    if (typeof wechsel === 'string') throw new Error(wechsel)
    expect(wechsel.every(v => !v.mail.html.includes('In Hoku öffnen'))).toBe(true)
  })
})
