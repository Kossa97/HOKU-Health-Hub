/**
 * Konto in der App loeschen (Apple 5.1.1(v), Google Play „Account deletion").
 *
 * Reihenfolge:
 *   1. `delete_my_account(true)` — loescht nichts, prueft nur, ob das
 *      Loeschen moeglich ist; sonst bleibt alles, wie es ist
 *   2. eigene Dateien im Speicher entfernen — Fortschrittsfotos, Profil-/Titelbild und
 *      Chargen-Dokumente liegen unter `<user-id>/…`, alte Fotos noch unter
 *      `progress/<user-id>/…` in `batch-files`; SQL darf den Speicher nicht
 *      anfassen, deshalb tut es die App vorher selbst
 *   3. `delete_my_account()` — loescht Blutwerte, Gewicht und das Konto;
 *      alles andere haengt mit `on delete cascade` daran
 *   4. abmelden
 */

/** Ordner je Bucket, in denen Dateien des Nutzers liegen. */
export function nutzerOrdner(userId: string): [bucket: string, ordner: string][] {
  return [
    ['progress-photos', userId],
    ['batch-files', userId],
    // Profil- und Titelbild
    ['profile-media', userId],
    // Fortschrittsfotos vor dem eigenen Bucket
    ['batch-files', `progress/${userId}`],
  ]
}

interface StorageError { message: string }

export interface AccountClient {
  storage: {
    from(bucket: string): {
      list(path: string, options: { limit: number; offset: number }): Promise<{ data: { name: string; id?: string | null }[] | null; error: StorageError | null }>
      remove(paths: string[]): Promise<{ error: StorageError | null }>
    }
  }
  rpc(fn: string, params?: Record<string, unknown>): PromiseLike<{ error: StorageError | null }>
  auth: { signOut(): Promise<unknown> }
}

const SEITE = 100

/** Alle Dateien in einem Ordner eines Buckets; liefert die Anzahl. */
export async function loescheNutzerDateien(client: AccountClient, bucket: string, ordner: string): Promise<number> {
  const ablage = client.storage.from(bucket)
  let geloescht = 0
  // Nach jedem Loeschen rutscht die Liste nach — deshalb immer ab 0 lesen.
  // Die Obergrenze schuetzt vor einer Endlosschleife, falls ein Loeschen
  // still nichts bewirkt.
  for (let runde = 0; runde < 1000; runde++) {
    const { data, error } = await ablage.list(ordner, { limit: SEITE, offset: 0 })
    if (error) throw new Error(error.message)
    // Unterordner (ohne id) bleiben stehen: sie loeschen sich mit der letzten Datei.
    const eintraege = data ?? []
    const dateien = eintraege.filter(eintrag => eintrag.name && eintrag.name !== '.emptyFolderPlaceholder' && eintrag.id !== null)
    if (dateien.length === 0) return geloescht
    const { error: fehler } = await ablage.remove(dateien.map(datei => `${ordner}/${datei.name}`))
    if (fehler) throw new Error(fehler.message)
    geloescht += dateien.length
    if (eintraege.length < SEITE) return geloescht
  }
  return geloescht
}

export async function loescheKonto(client: AccountClient, userId: string): Promise<void> {
  const pruefung = await client.rpc('delete_my_account', { p_nur_pruefen: true })
  if (pruefung.error) throw new Error(pruefung.error.message)
  for (const [bucket, ordner] of nutzerOrdner(userId)) await loescheNutzerDateien(client, bucket, ordner)
  const { error } = await client.rpc('delete_my_account')
  if (error) throw new Error(error.message)
  await client.auth.signOut()
}
