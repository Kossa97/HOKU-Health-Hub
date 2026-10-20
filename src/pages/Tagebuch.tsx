import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, BookHeart, Zap, AlertTriangle, Clock, Search } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { getDateLocale } from '../i18n/dateLocales'
import { durationLabel } from './tagebuch/duration'
import { ORDER, PAGE_SIZE, searchFilter, type SortBy } from './tagebuch/query'
import { intakeDose, intakeGap } from './tagebuch/intake'
import { Sheet } from '../features/compliance/components/Sheet'
import { Auswertung } from './tagebuch/Auswertung'
import { EntryForm } from './tagebuch/EntryForm'
import { SymptomChip } from './tagebuch/SymptomChip'
import { ENTRY_SELECT, sortedChips, type DiaryEntry } from './tagebuch/entry'
import { chipAria, chipLabel, durationText, fromRow, kindColor } from './tagebuch/chips'

type Effect = DiaryEntry

interface StackItem { id: string; display_name: string }

const SEVERITY_COLORS: Record<number, string> = {
  1: 'text-[var(--lg-good-text)]', 2: 'text-[var(--lg-good-text)]', 3: 'text-[var(--lg-warn-text)]',
  4: 'text-[var(--lg-warn-text)]', 5: 'text-[var(--lg-bad-text)]',
}


export function Tagebuch() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const locale = getDateLocale()

  const severityLabel = (n: number) =>
    [t('sehr_leicht'), t('leicht'), t('mittel'), t('stark'), t('sehr_stark')][n - 1]
  const [effects, setEffects]   = useState<Effect[]>([])
  const [stackItems, setStackItems] = useState<StackItem[]>([])
  const [filter, setFilter]     = useState<'all' | 'effect' | 'side_effect'>('all')
  const [search, setSearch]     = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy]     = useState<SortBy>('date_new')
  const [limit, setLimit]       = useState(PAGE_SIZE)
  const [hasMore, setHasMore]   = useState(false)
  const [loaded, setLoaded]     = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [deleting, setDeleting] = useState<Effect | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [view, setView] = useState<'liste' | 'auswertung'>('liste')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Effect | null>(null)
  const [loadError, setLoadError] = useState(false)

  const userId = user!.id
  const reload = () => setReloadToken(n => n + 1)

  useEffect(() => {
    let cancelled = false
    supabase.from('stack_items').select('id, display_name').eq('user_id', userId).order('display_name')
      .then(({ data }) => { if (!cancelled && data) setStackItems(data) })
    return () => { cancelled = true }
  }, [userId])

  // Suche erst nach einer Tipp-Pause abschicken; neue Suche beginnt bei Seite 1.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setLimit(PAGE_SIZE)
    }, 300)
    return () => clearTimeout(id)
  }, [search])

  // Ohne Suchtext bleibt der Filter `null` — die Substanzliste löst dann kein neues Laden aus.
  const orFilter = useMemo(() => searchFilter(debouncedSearch, stackItems), [debouncedSearch, stackItems])

  useEffect(() => {
    let cancelled = false
    // Filter nach Art: Einträge mit mindestens einem Chip dieser Art (zweite,
    // gefilterte Einbettung; die erste liefert weiter alle Chips des Eintrags).
    let query = supabase
      .from('effects')
      .select(filter === 'all' ? ENTRY_SELECT : `${ENTRY_SELECT}, art:effect_symptoms!inner(kind)`)
      .eq('user_id', userId)
    if (filter !== 'all') query = query.eq('art.kind', filter)
    if (orFilter) query = query.or(orFilter)
    for (const [column, ascending] of ORDER[sortBy]) query = query.order(column, { ascending })
    // Eine Zeile mehr als angezeigt: verrät, ob es weitere gibt.
    query.range(0, limit).then(({ data, error }) => {
      if (cancelled) return
      setLoaded(true)
      if (error) { setLoadError(true); setEffects([]); setHasMore(false); toast.error(t('tagebuch_load_error')); return }
      const rows = (data ?? []) as unknown as Effect[]
      setLoadError(false)
      setHasMore(rows.length > limit)
      setEffects(rows.slice(0, limit))
    })
    return () => { cancelled = true }
  }, [userId, filter, orFilter, sortBy, limit, reloadToken, t])

  const openNew = () => { setEditing(null); setShowForm(true) }
  const openEdit = (e: Effect) => { setEditing(e); setShowForm(true) }

  const remove = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    const { error } = await supabase.from('effects').delete().eq('id', deleting.id).eq('user_id', userId)
    setDeleteBusy(false)
    if (error) return toast.error(t('tagebuch_delete_error'))
    setDeleting(null)
    toast.success(t('deleted')); reload()
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="lg-large-title min-w-0 truncate">{t('tagebuch_title')}</h1>
        <button type="button" className="lg-btn lg-btn-tint lg-btn-compact shrink-0"
          onClick={openNew}>
          <Plus size={16} aria-hidden="true" /> {t('new')}
        </button>
      </div>

      <div className="flex rounded-full bg-[var(--lg-fill)] p-0.5 mb-4" role="tablist" aria-label={t('tagebuch_title')}>
        {(['liste', 'auswertung'] as const).map(key => (
          <button key={key} type="button" role="tab" id={`tagebuch-tab-${key}`}
            aria-selected={view === key} aria-controls={`tagebuch-panel-${key}`}
            onClick={() => setView(key)}
            className={`flex-1 min-h-9 rounded-full text-[14px] font-semibold transition-colors ${
              view === key ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]' : 'text-[var(--lg-text-2)]'
            }`}>
            {t(key === 'liste' ? 'tagebuch_tab_liste' : 'tagebuch_tab_auswertung')}
          </button>
        ))}
      </div>

      {view === 'auswertung' ? (
        <div role="tabpanel" id="tagebuch-panel-auswertung" aria-labelledby="tagebuch-tab-auswertung">
          <Auswertung userId={userId} refreshKey={reloadToken} />
        </div>
      ) : (
      <div role="tabpanel" id="tagebuch-panel-liste" aria-labelledby="tagebuch-tab-liste">
      {/* Filter */}
      <div className="flex gap-2 mb-3 overflow-x-auto [scrollbar-width:none]">
        {([['all', t('alle')], ['effect', t('wirkungen')], ['side_effect', t('nebenwirkungen')]] as const).map(([val, label]) => (
          <button key={val} type="button" aria-pressed={filter === val}
            onClick={() => { setFilter(val as typeof filter); setLimit(PAGE_SIZE) }}
            className={`shrink-0 min-h-9 rounded-full px-3.5 text-[14px] font-medium transition-colors ${
              filter === val ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)]' : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Suche + Sortierung */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lg-text-3)] pointer-events-none" />
          <input className="min-h-11 w-full rounded-full border-0 bg-[var(--lg-fill)] py-2.5 pl-10 pr-4 text-[16px] text-[var(--lg-text)] outline-none placeholder:text-[var(--lg-text-3)] focus-visible:ring-2 focus-visible:ring-[var(--lg-accent)]" type="search" aria-label={t('suchen_placeholder')} placeholder={t('suchen_placeholder')}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="min-h-11 shrink-0 cursor-pointer rounded-full border-0 bg-[var(--lg-fill)] pl-3.5 pr-8 text-[15px] text-[var(--lg-text)]" value={sortBy} aria-label={t('tagebuch_sortierung')}
          onChange={e => { setSortBy(e.target.value as SortBy); setLimit(PAGE_SIZE) }}>
          <option value="date_new">{t('neueste')}</option>
          <option value="date_old">{t('aelteste')}</option>
          <option value="sev_high">{t('intensitaet_ab')}</option>
          <option value="sev_low">{t('intensitaet_auf')}</option>
        </select>
      </div>

      {loadError ? (
        <div className="lg-surface lg-flat text-center px-5 py-10 text-[var(--lg-text-2)]" role="alert">
          <AlertTriangle size={30} className="mx-auto mb-2 text-[var(--lg-warn-text)]" />
          <p>{t('tagebuch_load_error')}</p>
          <button type="button" data-quiet className="lg-gray-btn mx-auto mt-4" onClick={reload}>{t('lab_retry')}</button>
        </div>
      ) : loaded && effects.length === 0 && (
        <div className="lg-surface lg-flat text-center px-5 py-10 text-[var(--lg-text-2)]">
          <BookHeart size={30} aria-hidden="true" className="mx-auto mb-2 text-[var(--lg-text-3)]" />
          <p>{debouncedSearch ? t('nichts_gefunden', { search: debouncedSearch }) : t('noch_keine_eintraege')}</p>
        </div>
      )}

      {/* ── Eintrags-Liste ──────────────────────────────────────────────────── */}
      <ul className="space-y-3">
        {effects.map(e => (
          <li key={e.id} className="lg-surface lg-flat !rounded-[22px] py-3.5 pl-4 pr-2">
            {/* Kopf: Titel und Meta links, Bearbeiten/Löschen oben rechts — darunter haben die Chips die volle Breite */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[17px] font-semibold text-[var(--lg-text)]">{e.description}</p>

                {/* Meta */}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[var(--lg-text-2)] text-[13px]">
                  <span>{format(new Date(e.occurred_at), 'dd.MM.yyyy HH:mm', { locale })}</span>
                  {e.stack_items && <span className="text-[var(--lg-accent-text)]">{e.stack_items.display_name}</span>}
                  {e.dose_logs && (() => {
                    const gap = intakeGap(e.dose_logs.logged_at, e.occurred_at, t)
                    const dose = intakeDose(e.dose_logs, i18n.language)
                    return gap && (
                      <span data-tagebuch-intake>{[t('tagebuch_nach_einnahme', { abstand: gap }), dose].filter(Boolean).join(' · ')}</span>
                    )
                  })()}
                </div>
              </div>
              <div className="relative z-[2] -mt-1.5 flex shrink-0">
                <button type="button" aria-label={t('tagebuch_eintrag_bearbeiten')}
                  className="lg-icon-btn !h-10 !w-10 text-[var(--lg-text-3)] hover:text-[var(--lg-accent-text)]"
                  onClick={() => openEdit(e)}>
                  <Pencil size={15} aria-hidden="true" />
                </button>
                <button type="button" aria-label={t('eintrag_loeschen')}
                  className="lg-icon-btn !h-10 !w-10 text-[var(--lg-text-3)] hover:text-[var(--lg-bad-text)]"
                  onClick={() => setDeleting(e)}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="pr-2">
              {e.effect_symptoms?.length ? (
                /* Getrennt nach Art: erst Wirkungen, dann Nebenwirkungen */
                <div className="mt-2.5 space-y-2.5">
                  {(['effect', 'side_effect'] as const).map(kind => {
                    const rows = sortedChips(e).filter(row => row.kind === kind)
                    if (!rows.length) return null
                    return (
                      <div key={kind} data-tagebuch-art={kind}>
                        <p className="mb-1.5 text-[12px] font-semibold" style={{ color: kindColor(kind) }}>
                          {t(kind === 'effect' ? 'wirkungen' : 'nebenwirkungen')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {rows.map(row => {
                            const chip = fromRow(row)
                            return (
                              <SymptomChip key={row.id} small selected kind={chip.kind} label={chipLabel(chip, i18n.language)} iconKey={chip.key}
                                severity={chip.severity} duration={durationText(chip, t)} ariaLabel={chipAria(chip, true, t, i18n.language)} />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : e.type && e.severity ? (
                /* Ältere Einträge ohne Chips: Art und Intensität wie bisher */
                <div className="flex items-center gap-2 mt-1 flex-wrap text-[13px] font-medium">
                  {e.type === 'effect'
                    ? <Zap size={14} aria-hidden="true" className="text-[var(--lg-good-text)] shrink-0" />
                    : <AlertTriangle size={14} aria-hidden="true" className="text-[var(--lg-warn-text)] shrink-0" />}
                  <span className={e.type === 'effect' ? 'text-[var(--lg-good-text)]' : 'text-[var(--lg-warn-text)]'}>
                    {e.type === 'effect' ? t('wirkung') : t('nebenwirkung')}
                  </span>
                  <span className={SEVERITY_COLORS[e.severity]}>{severityLabel(e.severity)}</span>
                  {e.duration && (
                    <span className="flex items-center gap-1 text-[var(--lg-text-2)] font-normal">
                      <Clock size={11} aria-hidden="true" />
                      {durationLabel(e.duration, t)}
                    </span>
                  )}
                </div>
              ) : null}

              {e.notes && <p className="text-[var(--lg-text-2)] text-[14px] mt-1">{e.notes}</p>}
            </div>
          </li>
        ))}
      </ul>

      {hasMore && !loadError && (
        <button type="button" data-quiet className="lg-gray-btn w-full mt-4" onClick={() => setLimit(n => n + PAGE_SIZE)}>
          {t('tagebuch_mehr_laden')}
        </button>
      )}
      </div>
      )}

      {showForm && (
        <EntryForm userId={userId} stackItems={stackItems} entry={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload() }} />
      )}

      {deleting && (
        <Sheet labelledBy="tagebuch-delete-title" busy={deleteBusy} onClose={() => setDeleting(null)} role="alertdialog" data-tagebuch-delete-sheet>
          <h2 id="tagebuch-delete-title" className="lg-title2">{t('eintrag_loeschen')}</h2>
          <p className="mt-1 break-words text-[15px] text-[var(--lg-text-2)]">{deleting.description}</p>
          <div className="mt-5 flex gap-2">
            <button type="button" autoFocus data-app-back-close disabled={deleteBusy} onClick={() => setDeleting(null)} data-quiet className="lg-gray-btn flex-1 !min-h-12 !text-[17px]">
              {t('cancel')}
            </button>
            <button type="button" disabled={deleteBusy} onClick={remove} data-tone="bad" className="lg-gray-btn flex-1 !min-h-12 !text-[17px]">
              {t('delete')}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
