import { describe, expect, it } from 'vitest'
import { ETIKETT_EINWILLIGUNG_AB, giltFuerEtiketten, ladeKiEinwilligung, setzeKiEinwilligung, type ConsentClient } from './aiConsent'

function nachbild(start: string | null, fehler: string | null = null, keinProfil = false) {
  const zeile = { ai_import_consent_at: start }
  const updates: (string | null)[] = []
  const client: ConsentClient = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fehler ? null : zeile, error: fehler ? { message: fehler } : null }) }) }),
      update: values => ({
        eq: () => ({
          select: async () => {
            if (fehler) return { data: null, error: { message: fehler } }
            if (keinProfil) return { data: [], error: null }
            updates.push(values.ai_import_consent_at)
            // Wie der Trigger: die Datenbank setzt den Zeitpunkt.
            zeile.ai_import_consent_at = values.ai_import_consent_at ? 'SERVERZEIT' : null
            return { data: [{ ...zeile }], error: null }
          },
        }),
      }),
    }),
  }
  return { client, updates }
}

describe('KI-Einwilligung', () => {
  it('liest den Zeitpunkt oder null', async () => {
    expect(await ladeKiEinwilligung(nachbild(null).client, 'u1')).toBeNull()
    expect(await ladeKiEinwilligung(nachbild('2026-10-06T08:00:00.000Z').client, 'u1')).toBe('2026-10-06T08:00:00.000Z')
  })

  it('erteilt und widerruft; zurueck kommt der gespeicherte Wert der Datenbank', async () => {
    const { client, updates } = nachbild(null)
    expect(await setzeKiEinwilligung(client, 'u1', new Date('2026-10-06T08:00:00Z'))).toBe('SERVERZEIT')
    expect(await setzeKiEinwilligung(client, 'u1', null)).toBeNull()
    expect(updates).toEqual(['2026-10-06T08:00:00.000Z', null])
  })

  it('meldet keinen Erfolg, wenn kein Profil getroffen wurde', async () => {
    await expect(setzeKiEinwilligung(nachbild(null, null, true).client, 'u1', new Date())).rejects.toThrow('profil_fehlt')
  })

  it('wirft bei Fehlern statt still „nicht erteilt“ zu melden', async () => {
    await expect(ladeKiEinwilligung(nachbild(null, 'offline').client, 'u1')).rejects.toThrow('offline')
    await expect(setzeKiEinwilligung(nachbild(null, 'offline').client, 'u1', new Date())).rejects.toThrow('offline')
  })
})

describe('giltFuerEtiketten', () => {
  it('eine Einwilligung von vor dem Etikett-Text galt nur Befunden', () => {
    expect(giltFuerEtiketten(null)).toBe(false)
    expect(giltFuerEtiketten('2026-10-06T12:00:00.000Z')).toBe(false)
    expect(giltFuerEtiketten(ETIKETT_EINWILLIGUNG_AB)).toBe(true)
    expect(giltFuerEtiketten('2026-10-20T08:00:00+00:00')).toBe(true)
  })
})
