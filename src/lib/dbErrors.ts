/**
 * Fehlt eine Spalte, weil eine Migration noch nicht gelaufen ist? Beim Lesen
 * meldet Postgres 42703, beim Schreiben PostgREST PGRST204 („Could not find
 * the … column … in the schema cache").
 */
export function isMissingColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  return code === '42703' || code === 'PGRST204'
}
