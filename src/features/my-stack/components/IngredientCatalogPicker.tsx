import { Check, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SubstanceCatalogEntry } from '../types'

// Wie viele Treffer eine Zeile zeigt. Mehr als eine Handvoll waere in einer
// Zutatenzeile eine zweite Substanzsuche — die gibt es schon im ersten
// Schritt, mit Katalogblaettern und allem.
const MAX_TREFFER = 6

export interface IngredientCatalogPickerProps {
  /** Der Katalogeintrag, an dem diese Zeile haengt — null bei freier Eingabe. */
  entry: SubstanceCatalogEntry | null
  /** Der freie Name, solange kein Eintrag gewaehlt ist. */
  customName: string
  entries: readonly SubstanceCatalogEntry[]
  inputId: string
  fieldName: string
  invalid?: boolean
  describedBy?: string
  onPick: (entry: SubstanceCatalogEntry) => void
  onCustomName: (name: string) => void
  onDetach: () => void
}

// Die Katalogsuche EINER Zutatenzeile.
//
// Bis hierher hing nur die erste Zutat am Katalog — sie kommt aus dem
// Substanzschritt. Jede weitere war reiner Freitext: `catalog_substance_id`
// wurde bei jedem Tastendruck auf null gesetzt. Damit hatte der zweite
// Wirkstoff eines Kombipraeparats weder Einheitenvorschlaege noch ein
// PK-Profil — er war nur ein Wort.
//
// Dieselbe Mechanik wie im Substanzschritt, nur klein: tippen, waehlen, und
// die Wahl steht sichtbar da, bis man sie loest.
export function IngredientCatalogPicker({
  entry,
  customName,
  entries,
  inputId,
  fieldName,
  invalid = false,
  describedBy,
  onPick,
  onCustomName,
  onDetach,
}: IngredientCatalogPickerProps) {
  const { t } = useTranslation()
  const [verworfen, setVerworfen] = useState(false)

  const treffer = useMemo(() => {
    const suche = customName.trim().toLocaleLowerCase()
    if (suche.length < 2) return []
    return entries
      .filter(kandidat => kandidat.active)
      .filter(kandidat => [kandidat.canonical_name, ...kandidat.aliases]
        .some(name => name.toLocaleLowerCase().includes(suche)))
      .slice(0, MAX_TREFFER)
  }, [entries, customName])

  if (entry) {
    return (
      <div
        data-ingredient-catalog={entry.id}
        className="flex min-h-11 items-center gap-3 rounded-xl border border-[color:var(--accent-border)] bg-[color:var(--accent-weak)] px-3 py-2"
      >
        <Check aria-hidden="true" size={18} className="shrink-0 text-[color:var(--accent)]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-white">{entry.canonical_name}</span>
          <span className="block truncate text-[12px] text-slate-400">
            {entry.pk_profile_id
              ? t('my_stack_from_catalog_pk', { defaultValue: 'Aus dem Katalog · PK-Profil vorhanden' })
              : t('my_stack_from_catalog', { defaultValue: 'Aus dem Katalog' })}
          </span>
        </span>
        <button
          type="button"
          onClick={onDetach}
          aria-label={String(t('my_stack_detach_catalog', { defaultValue: 'Auswahl lösen' }))}
          className="grid min-h-11 min-w-11 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-white/[0.08] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
    )
  }

  const zeigeTreffer = treffer.length > 0 && !verworfen

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
        <input
          id={inputId}
          type="search"
          value={customName}
          onChange={event => {
            setVerworfen(false)
            onCustomName(event.target.value)
          }}
          data-field={fieldName}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          className="input min-h-11 w-full pl-9 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        />
      </div>

      {zeigeTreffer && (
        <ul data-ingredient-treffer className="space-y-1.5">
          {treffer.map(kandidat => (
            <li key={kandidat.id}>
              <button
                type="button"
                onClick={() => onPick(kandidat)}
                className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-400/20 bg-slate-400/[0.06] px-3 py-2 text-left transition-colors duration-200 hover:border-sky-400/30 hover:bg-sky-400/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
              >
                <span className="block truncate text-[15px] font-medium text-white">{kandidat.canonical_name}</span>
                {kandidat.aliases.length > 0 && (
                  <span className="mt-0.5 block truncate text-xs text-slate-400">{kandidat.aliases.join(', ')}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
