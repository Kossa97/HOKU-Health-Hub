import { describe, expect, it } from 'vitest'
import { erstesLeeres, faellig, type Stille } from './hinweise'

const still = (ansicht: Stille['ansicht'], gezeigt = 0, geklopft = false): Stille => ({ ansicht, seit: 0, gezeigt, geklopft })

describe('Hinweise bei Stille', () => {
  it('Start: Anmelden direkt nach der Begrüßung, Registrieren gleich nach dem Ende des ersten Hinweises, Klopfen nach 30 s', () => {
    expect(faellig(still('start'), 799, null)).toBeNull()
    expect(faellig(still('start'), 800, null)).toEqual({ art: 'hinweis', ziel: 'start-anmelden', text: 'login_start_anmelden' })
    // nach einem Hinweis beginnt die Stille neu (seit = Ende des Hinweises), gezeigt zählt weiter
    expect(faellig(still('start', 1), 0, null)).toEqual({ art: 'hinweis', ziel: 'start-registrieren', text: 'login_start_registrieren' })
    expect(faellig(still('start', 2), 29999, null)).toBeNull()
    expect(faellig(still('start', 2), 30000, null)).toEqual({ art: 'klopfen' })
    expect(faellig(still('start', 2, true), 600000, null)).toBeNull()
  })

  it('Formular: genau ein Hinweis je Stille, dann Klopfen', () => {
    expect(faellig(still('login'), 9999, 'passwort')).toBeNull()
    expect(faellig(still('login'), 10000, 'passwort')).toEqual({ art: 'hinweis', ziel: 'passwort', text: 'login_tipp_passwort' })
    expect(faellig(still('login', 1), 25000, 'passwort')).toBeNull()
    expect(faellig(still('login', 1), 30000, 'passwort')).toEqual({ art: 'klopfen' })
  })

  it('Anmelden: Text je Ziel', () => {
    expect(faellig(still('login'), 10000, 'kennung')).toMatchObject({ text: 'login_tipp_email' })
    expect(faellig(still('login'), 10000, 'absenden')).toMatchObject({ ziel: 'absenden', text: 'login_tipp_anmelden' })
  })

  it('Registrieren: Text je Ziel', () => {
    const text = (z: Parameters<typeof faellig>[2]) => (faellig(still('register'), 10000, z) as { text: string }).text
    expect(text('benutzer')).toBe('login_tipp_name')
    expect(text('email')).toBe('login_tipp_reg_email')
    expect(text('passwort')).toBe('login_tipp_reg_passwort')
    expect(text('passwort2')).toBe('login_tipp_passwort2')
    expect(text('zustimmung')).toBe('login_tipp_zustimmung')
    expect(text('absenden')).toBe('login_tipp_konto')
  })

  it('die Stille zählt ab ihrem Beginn, nicht ab null', () => {
    expect(faellig({ ansicht: 'login', seit: 50000, gezeigt: 0, geklopft: false }, 59999, 'kennung')).toBeNull()
    expect(faellig({ ansicht: 'login', seit: 50000, gezeigt: 0, geklopft: false }, 60000, 'kennung')).not.toBeNull()
  })

  it('erstesLeeres folgt der Lesereihenfolge', () => {
    expect(erstesLeeres({ kennung: true, passwort: false }, ['kennung', 'passwort'])).toBe('passwort')
    expect(erstesLeeres({ kennung: false, passwort: false }, ['kennung', 'passwort'])).toBe('kennung')
    expect(erstesLeeres({ kennung: true, passwort: true }, ['kennung', 'passwort'])).toBe('absenden')
  })
})
