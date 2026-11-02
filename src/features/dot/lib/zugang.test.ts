import { describe, expect, it } from 'vitest'
import { ERKENNTNISSE_FREI, PRO_PFLICHT, darfErkenntnisseSehen, erkenntnisseSeitenModus, hatPro, istTester } from './zugang'
import { PRO_PFLICHT as PRO_PFLICHT_SERVER, hatZugang } from '../../../../supabase/functions/coach/prompt'

describe('Dot: Zugang', () => {
  const jetzt = new Date('2026-10-22T12:00:00Z')
  it('Pro gilt bis zum Ablauf', () => {
    expect(hatPro('2026-11-01T00:00:00Z', jetzt)).toBe(true)
    expect(hatPro('2026-10-01T00:00:00Z', jetzt)).toBe(false)
    expect(hatPro(null, jetzt)).toBe(false)
    expect(hatPro('kein datum', jetzt)).toBe(false)
  })
  it('Tester: Entwicklung und Admin, keine E-Mail-Domain', () => {
    expect(istTester(false, false)).toBe(false)
    expect(istTester(false, true)).toBe(true)
    expect(istTester(true, false)).toBe(true)
  })
  it('Erkenntnisse: bis zur Freigabe nur für Tester', () => {
    expect(ERKENNTNISSE_FREI).toBe(false)
    expect(darfErkenntnisseSehen(false, false, false)).toBe(false)
    expect(darfErkenntnisseSehen(false, true, false)).toBe(true)
    expect(darfErkenntnisseSehen(false, false, true)).toBe(true)
    expect(darfErkenntnisseSehen(true, false, false)).toBe(true)
  })
  it('Erkenntnisse-Seite: freigeschaltet voll, sonst nur zum Widerrufen, wer eingewilligt hat (Art. 7 Abs. 3 DSGVO)', () => {
    expect(erkenntnisseSeitenModus(true, null)).toBe('voll')
    expect(erkenntnisseSeitenModus(true, '2026-11-01T10:00:00Z')).toBe('voll')
    expect(erkenntnisseSeitenModus(false, '2026-11-01T10:00:00Z')).toBe('nurWiderruf')
    expect(erkenntnisseSeitenModus(false, null)).toBe('weg')
  })
  it('App (ohne Entwicklungs-Build) und Edge Function entscheiden gleich', () => {
    for (const p of [{ pro_until: '2026-11-01T00:00:00Z' }, { pro_until: '2026-01-01T00:00:00Z' }, { is_admin: true }, {}] as { pro_until?: string; is_admin?: boolean }[]) {
      const app = hatPro(p.pro_until ?? null, jetzt) || istTester(p.is_admin === true, false)
      expect(hatZugang(p, jetzt, true)).toBe(app)
    }
  })
  it('bis Pro startet, ist Dot für alle frei — in App und Edge Function', () => {
    expect(PRO_PFLICHT).toBe(PRO_PFLICHT_SERVER)
    expect(hatZugang({}, jetzt, false)).toBe(true)
    expect(hatZugang(null, jetzt)).toBe(!PRO_PFLICHT_SERVER)
  })
})
