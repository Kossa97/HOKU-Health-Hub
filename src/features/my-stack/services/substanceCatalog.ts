import type { SubstanceCatalogEntry } from '../types'

interface ServiceError {
  message: string
}

export interface SubstanceCatalogQueryResult {
  data: SubstanceCatalogEntry[] | null
  error: ServiceError | null
}

export interface SubstanceCatalogClient {
  from(table: 'substance_catalog'): {
    select(columns: string): {
      eq(column: 'active', value: true): PromiseLike<SubstanceCatalogQueryResult>
    }
  }
}

export interface SubstanceCatalogSearchResult {
  entries: SubstanceCatalogEntry[]
  unavailable: boolean
}

const CATALOG_COLUMNS = [
  'id',
  'canonical_name',
  'aliases',
  'default_category',
  'suggested_units',
  'suggested_dosage_forms',
  'pk_profile_id',
  'pk_profiles(routes)',
  'component_names',
  'active',
].join(', ')

/** So viele Treffer zeigt die Suche hoechstens. */
const MAX_TREFFER = 20

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export function filterCatalog(
  entries: SubstanceCatalogEntry[],
  query: string,
): SubstanceCatalogEntry[] {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return entries

  return entries.filter(entry => (
    normalize(entry.canonical_name).includes(normalizedQuery)
    || entry.aliases.some(alias => normalize(alias).includes(normalizedQuery))
  ))
}

export async function searchSubstanceCatalog(
  client: SubstanceCatalogClient,
  query: string,
): Promise<SubstanceCatalogSearchResult> {
  try {
    const { data, error } = await client
      .from('substance_catalog')
      .select(CATALOG_COLUMNS)
      .eq('active', true)

    if (error) return { entries: [], unavailable: true }

    // Die Obergrenze gilt der TREFFERLISTE, nicht dem Katalog. Ohne Suchwort
    // fragt die Seite den ganzen Katalog ab, um ihn im Blaettern zu zeigen und
    // um die Bestandteile eines Kombipraeparats aufloesen zu koennen — und
    // bekam bisher zwanzig von zweihundert Substanzen. Der Rest war nicht
    // auffindbar.
    const treffer = filterCatalog(data ?? [], query)

    return {
      entries: query.trim() ? treffer.slice(0, MAX_TREFFER) : treffer,
      unavailable: false,
    }
  } catch {
    return { entries: [], unavailable: true }
  }
}
