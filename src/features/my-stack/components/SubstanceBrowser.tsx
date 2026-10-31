import { ChevronDown, Library } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { STACK_CATEGORIES } from '../lib/categories'
import { nachBuchstaben, nachKategorie } from '../lib/katalogBlaettern'
import type { StackCategory, SubstanceCatalogEntry } from '../types'

// Ab wann sich die Sprungleiste lohnt. Die Liste ist rund 320 px hoch, ein
// Eintrag gut 50 — sichtbar sind also etwa sechs. Erst ab dem Doppelten muss
// man wirklich scrollen; darunter ist Wischen schneller als Zielen.
const SPRUNGLEISTE_AB = 12

export interface SubstanceBrowserProps {
  entries: SubstanceCatalogEntry[]
  onSelect: (entry: SubstanceCatalogEntry) => void
}

// Der Katalog zum Durchblaettern.
//
// Das Suchfeld darueber zeigt nichts, solange niemand tippt — wer nicht weiss,
// wie ein Stoff heisst, hatte keinen Weg. Deshalb hier die Liste.
//
// ZUGEKLAPPT, und zwar mit Absicht: der Substanzschritt ist der erste Eindruck
// des Formulars. Fuenf Reiter plus Liste plus Sprungleiste ueber dem Suchfeld
// waeren mehr, als eine Frage vertraegt. Zugeklappt kostet das Ganze eine
// Zeile — und wer tippen will, tippt einfach.
//
// Die Reiter sind die Kategorien, weil die Substanz ihre Kategorie ohnehin
// mitbringt: wer hier waehlt, hat das Kategoriefeld schon beantwortet.
export function SubstanceBrowser({ entries, onSelect }: SubstanceBrowserProps) {
  const { t } = useTranslation()
  const [offen, setOffen] = useState(false)
  const [kategorie, setKategorie] = useState<StackCategory>('peptide')
  const listeRef = useRef<HTMLDivElement>(null)

  const gesamt = useMemo(() => entries.filter(eintrag => eintrag.active).length, [entries])

  // Die Zahl je Reiter steht am Reiter: sonst tippt man auf „Hormone" und
  // findet elf Eintraege, wo man hundert erwartet hat.
  const anzahlJeKategorie = useMemo(() => {
    const zaehler = new Map<StackCategory, number>()
    for (const eintrag of entries) {
      if (!eintrag.active) continue
      zaehler.set(eintrag.default_category, (zaehler.get(eintrag.default_category) ?? 0) + 1)
    }
    return zaehler
  }, [entries])

  // Nur Reiter, hinter denen etwas steht. „Sonstiges" gehoert ins Formular, wo
  // jemand eine eigene Substanz benennt — im Katalog liegt nichts darunter,
  // und ein Reiter, der auf eine leere Liste fuehrt, sieht aus wie ein Fehler.
  const sichtbar = useMemo(
    () => STACK_CATEGORIES.filter(option => (anzahlJeKategorie.get(option.key) ?? 0) > 0),
    [anzahlJeKategorie],
  )
  // Abgeleitet statt nachgezogen: waere der gewaehlte Reiter verschwunden,
  // muesste ein Effekt den Zustand korrigieren — und bis er laeuft, stuende
  // eine leere Liste da.
  const aktiveKategorie = sichtbar.some(option => option.key === kategorie)
    ? kategorie
    : sichtbar[0]?.key ?? kategorie

  const gefiltert = useMemo(
    () => nachKategorie(entries, aktiveKategorie),
    [entries, aktiveKategorie],
  )
  const gruppen = useMemo(() => nachBuchstaben(gefiltert), [gefiltert])

  function springeZu(buchstabe: string): void {
    listeRef.current
      ?.querySelector(`[data-katalog-buchstabe="${buchstabe}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }

  if (gesamt === 0) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOffen(wert => !wert)}
        aria-expanded={offen}
        aria-controls="stack-katalog-liste"
        data-katalog-schalter
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Library aria-hidden="true" size={18} className="shrink-0 text-slate-400" />
          <span className="min-w-0 text-sm font-medium text-slate-200">
            {t('my_stack_browse_catalog', { defaultValue: 'Katalog durchblättern' })}
          </span>
          <span className="shrink-0 text-sm text-slate-500">{gesamt}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${offen ? 'rotate-180' : ''}`}
        />
      </button>

      {offen && (
        <div id="stack-katalog-liste" className="border-t border-white/[0.07] px-4 pb-4 pt-3">
          <div
            role="tablist"
            aria-label={String(t('my_stack_category', { defaultValue: 'Kategorie' }))}
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3"
          >
            {sichtbar.map(option => {
              const aktiv = option.key === aktiveKategorie
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={aktiv}
                  onClick={() => setKategorie(option.key)}
                  className={`min-h-11 shrink-0 cursor-pointer rounded-xl border px-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none ${aktiv
                    ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-weak)] text-slate-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t(option.labelKey)}
                  <span className={`ml-1.5 ${aktiv ? 'text-[color:var(--accent)]' : 'text-slate-500'}`}>
                    {anzahlJeKategorie.get(option.key) ?? 0}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex gap-2">
            {/* Die Liste bekommt eine feste Hoehe und scrollt in sich: sonst
                schoebe ein Reiter mit 69 Eintraegen alles darunter aus dem
                Bild, und der Schritt haette keinen Boden mehr. */}
            <div
              ref={listeRef}
              data-katalog-eintraege
              className="max-h-80 min-w-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {gruppen.map(gruppe => (
                <div key={gruppe.buchstabe}>
                  <div
                    data-katalog-buchstabe={gruppe.buchstabe}
                    className="sticky top-0 z-10 bg-slate-950/95 py-1 text-[13px] font-medium text-slate-500"
                  >
                    {gruppe.buchstabe}
                  </div>
                  {gruppe.eintraege.map(eintrag => (
                    <button
                      key={eintrag.id}
                      type="button"
                      onClick={() => onSelect(eintrag)}
                      className="min-h-11 w-full cursor-pointer rounded-xl px-2 py-2 text-left transition-colors duration-200 hover:bg-sky-400/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
                    >
                      <span className="block truncate text-[15px] font-medium text-white">
                        {eintrag.canonical_name}
                      </span>
                      {eintrag.aliases.length > 0 && (
                        <span className="mt-0.5 block truncate text-xs text-slate-400">
                          {eintrag.aliases.join(', ')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Die Sprungleiste. Bei 69 Medikamenten sind das sonst zehn
                Bildschirme Scrollen. Sie zeigt nur Buchstaben, unter denen
                wirklich etwas steht — einer, der ins Leere springt, ist
                schlimmer als einer, der fehlt. */}
            {gefiltert.length > SPRUNGLEISTE_AB && gruppen.length > 3 && (
              <div data-katalog-sprungleiste className="flex shrink-0 flex-col justify-start gap-0.5 py-1">
                {gruppen.map(gruppe => (
                  <button
                    key={gruppe.buchstabe}
                    type="button"
                    onClick={() => springeZu(gruppe.buchstabe)}
                    aria-label={String(t('my_stack_jump_to_letter', {
                      defaultValue: 'Zu {{letter}} springen',
                      letter: gruppe.buchstabe,
                    }))}
                    className="w-6 cursor-pointer rounded text-[11px] font-medium leading-[1.35] text-slate-500 transition-colors duration-200 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 motion-reduce:transition-none"
                  >
                    {gruppe.buchstabe}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
