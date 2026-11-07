import { describe, expect, it, vi } from 'vitest'
import { loescheKonto, loescheNutzerDateien, nutzerOrdner, type AccountClient } from './account'

function nachbild(dateien: Record<string, string[]>, rpcFehler: string | null = null) {
  const aufrufe: string[] = []
  const client: AccountClient = {
    storage: {
      from(bucket) {
        return {
          async list(path, { limit, offset }) {
            aufrufe.push(`list ${bucket} ${path}`)
            const namen = (dateien[bucket] ?? [])
              .filter(voll => voll.startsWith(`${path}/`) && !voll.slice(path.length + 1).includes('/'))
              .map(voll => voll.slice(path.length + 1))
              .slice(offset, offset + limit)
            return { data: namen.map(name => ({ name, id: name })), error: null }
          },
          async remove(paths) {
            aufrufe.push(`remove ${bucket} ${paths.length}`)
            dateien[bucket] = (dateien[bucket] ?? []).filter(voll => !paths.includes(voll))
            return { error: null }
          },
        }
      },
    },
    rpc: async (fn, params) => {
      aufrufe.push(params?.p_nur_pruefen ? `rpc ${fn} pruefen` : `rpc ${fn}`)
      return { error: rpcFehler ? { message: rpcFehler } : null }
    },
    auth: { signOut: vi.fn(async () => { aufrufe.push('signOut') }) },
  }
  return { client, aufrufe, dateien }
}

describe('Konto loeschen', () => {
  it('raeumt auch Profil- und Titelbild auf', () => {
    expect(nutzerOrdner('u1')).toContainEqual(['profile-media', 'u1'])
  })

  it('loescht erst die Dateien, dann das Konto, dann meldet es ab', async () => {
    const { client, aufrufe, dateien } = nachbild({
      'progress-photos': ['u1/a.jpg', 'u1/b.jpg', 'u2/fremd.jpg'],
      'batch-files': ['u1/c.pdf', 'progress/u1/alt.jpg', 'progress/u2/fremd.jpg'],
      'profile-media': ['u1/avatar-1.jpg', 'u1/cover-2.jpg', 'u2/avatar-3.jpg'],
    })
    await loescheKonto(client, 'u1')
    expect(dateien['progress-photos']).toEqual(['u2/fremd.jpg'])
    expect(dateien['batch-files']).toEqual(['progress/u2/fremd.jpg'])
    expect(dateien['profile-media']).toEqual(['u2/avatar-3.jpg'])
    expect(aufrufe.indexOf('rpc delete_my_account')).toBeGreaterThan(aufrufe.lastIndexOf('remove profile-media 2'))
    expect(aufrufe[0]).toBe('rpc delete_my_account pruefen')
    expect(aufrufe.indexOf('rpc delete_my_account')).toBeGreaterThan(aufrufe.lastIndexOf('remove batch-files 1'))
    expect(aufrufe.at(-1)).toBe('signOut')
  })

  it('arbeitet viele Dateien seitenweise ab', async () => {
    const namen = Array.from({ length: 250 }, (_, i) => `u1/${i}.jpg`)
    const { client, dateien } = nachbild({ 'progress-photos': namen })
    expect(await loescheNutzerDateien(client, 'progress-photos', 'u1')).toBe(250)
    expect(dateien['progress-photos']).toEqual([])
  })

  it('fasst keine Datei an, wenn das Loeschen nicht moeglich ist', async () => {
    const { client, aufrufe, dateien } = nachbild({ 'progress-photos': ['u1/a.jpg'] }, 'function delete_my_account does not exist')
    await expect(loescheKonto(client, 'u1')).rejects.toThrow('delete_my_account')
    expect(dateien['progress-photos']).toEqual(['u1/a.jpg'])
    expect(aufrufe.some(a => a.startsWith('remove'))).toBe(false)
    expect(aufrufe).not.toContain('signOut')
  })
})
