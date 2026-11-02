/**
 * Favoriten: Uebungen mit Stern. Gespeichert als Liste von Uebungs-IDs in den
 * Trainingseinstellungen (jsonb), in der Reihenfolge, in der sie markiert
 * wurden. Hoechstens `MAX_FAVORITES` — die Einstellungen haben ein
 * Groessenlimit in der Datenbank (8 KB, geteilt mit den uebrigen
 * Einstellungen); 50 IDs sind gut 1,5 KB.
 */

export const MAX_FAVORITES = 50
/** Laengste zulaessige Uebungs-ID (Katalog-ID oder `custom:<uuid>`). */
const MAX_ID_LENGTH = 120

export function toggleFavorite(favorites: readonly string[], exerciseId: string): string[] {
  if (favorites.includes(exerciseId)) return favorites.filter(id => id !== exerciseId)
  return [...favorites, exerciseId].slice(-MAX_FAVORITES)
}

export function normalizeFavorites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const ids = raw.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH)
  return [...new Set(ids)].slice(-MAX_FAVORITES)
}
