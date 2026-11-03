import type { StackCategory, StackItemIngredient, SubstanceCatalogEntry } from '../types'

// Kombipraeparate im Katalog.
//
// Ein Eintrag wie „CJC-1295 ohne DAC + Ipamorelin" ist keine eigene Substanz,
// sondern ein Produkt aus zweien. Er traegt deshalb kein PK-Profil: die
// Bestandteile haben verschiedene Halbwertszeiten, eine gemeinsame Kurve waere
// erfunden. Gerechnet wird je Wirkstoff aus seiner eigenen Konzentration im
// Produkt — genau dafuer bekommt jeder Bestandteil eine eigene Zutatenzeile.
//
// Die Verbindung laeuft ueber den NAMEN, nicht ueber eine id: der Katalog hat
// einen Unique-Index auf lower(canonical_name), der Name ist also der
// Schluessel. Dass jeder genannte Name wirklich existiert, haelt der
// Vertragstest der Quelldatei fest. Findet die App einen trotzdem nicht — weil
// der Katalog gerade nicht erreichbar war —, bleibt er als benannte Zutat
// stehen, statt lautlos zu verschwinden.

/** Ein aufgeloester Bestandteil, fertig fuer eine Zutatenzeile. */
export interface Kombinationsbestandteil {
  /** Die id im Katalog — null, wenn der Name sich nicht aufloesen liess. */
  catalogId: string | null
  name: string
  /** Die uebliche Wirkstoffeinheit des Bestandteils, nicht die des Produkts. */
  unit: string | null
  category: StackCategory | null
}

function schluessel(value: string): string {
  return value.trim().toLocaleLowerCase()
}

/** Traegt der Eintrag Bestandteile, ist er ein Kombipraeparat. */
export function istKombination(entry: SubstanceCatalogEntry): boolean {
  return (entry.component_names ?? []).length > 0
}

/**
 * Loest die Bestandteile eines Katalogeintrags gegen den Katalog auf.
 * Fuer eine einzelne Substanz kommt eine leere Liste zurueck — der Aufrufer
 * legt dann eine Zutat aus dem Eintrag selbst an, wie bisher.
 */
export function bestandteileAufloesen(
  entry: SubstanceCatalogEntry,
  alle: readonly SubstanceCatalogEntry[],
): Kombinationsbestandteil[] {
  const namen = entry.component_names ?? []
  if (namen.length === 0) return []

  const nachBezeichnung = new Map<string, SubstanceCatalogEntry>()
  for (const kandidat of alle) {
    nachBezeichnung.set(schluessel(kandidat.canonical_name), kandidat)
    for (const alias of kandidat.aliases) {
      // Der kanonische Name gewinnt: ein Alias darf ihn nicht ueberschreiben.
      if (!nachBezeichnung.has(schluessel(alias))) nachBezeichnung.set(schluessel(alias), kandidat)
    }
  }

  return namen
    .filter(name => schluessel(name).length > 0)
    .map(name => {
      const gefunden = nachBezeichnung.get(schluessel(name))
      if (!gefunden) return { catalogId: null, name: name.trim(), unit: null, category: null }
      return {
        catalogId: gefunden.id,
        name: gefunden.canonical_name,
        unit: gefunden.suggested_units[0] ?? null,
        category: gefunden.default_category,
      }
    })
}

/**
 * Der Name, den ein Produkt aus seinen Zutaten bekommt: „BPC-157 + TB-500".
 * Zutaten aus dem Katalog mit ihrem Katalognamen, eigene mit ihrem Namen;
 * Zeilen ohne Namen zaehlen nicht.
 */
export function kombiName(
  zutaten: readonly Pick<StackItemIngredient, 'catalog_substance_id' | 'custom_name'>[],
  katalogNamen: Readonly<Record<string, string>>,
): string {
  return zutaten
    .map(zutat => (zutat.catalog_substance_id ? katalogNamen[zutat.catalog_substance_id] : null) ?? zutat.custom_name ?? '')
    .map(name => name.trim())
    .filter(Boolean)
    .join(' + ')
}

/**
 * Wird aus einer Substanz nachtraeglich eine Kombination, zieht der Name mit:
 * aus „BPC-157" wird mit TB-500 „BPC-157 + TB-500". Aber nur, solange der
 * Name noch der ist, der sich aus den Zutaten ergab — einen selbst
 * vergebenen Namen („Wolverine-Stack") faesst das nicht an. Gibt den neuen
 * Namen zurueck oder null, wenn er bleibt.
 */
export function kombiNameNachfuehren(
  vorher: readonly Pick<StackItemIngredient, 'catalog_substance_id' | 'custom_name'>[],
  nachher: readonly Pick<StackItemIngredient, 'catalog_substance_id' | 'custom_name'>[],
  aktuellerName: string,
  katalogNamen: Readonly<Record<string, string>>,
): string | null {
  const alt = kombiName(vorher, katalogNamen)
  if (!alt || alt !== aktuellerName.trim()) return null
  const neu = kombiName(nachher, katalogNamen)
  return neu && neu !== alt ? neu : null
}
