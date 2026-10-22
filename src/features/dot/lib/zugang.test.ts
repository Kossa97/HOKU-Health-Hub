import { describe, expect, it } from 'vitest'
import { hatPro, istTester } from './zugang'
import { hatZugang } from '../../../../supabase/functions/coach/prompt'

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
  it('App (ohne Entwicklungs-Build) und Edge Function entscheiden gleich', () => {
    for (const p of [{ pro_until: '2026-11-01T00:00:00Z' }, { pro_until: '2026-01-01T00:00:00Z' }, { is_admin: true }, {}] as { pro_until?: string; is_admin?: boolean }[]) {
      const app = hatPro(p.pro_until ?? null, jetzt) || istTester(p.is_admin === true, false)
      expect(hatZugang(p, jetzt)).toBe(app)
    }
  })
})
