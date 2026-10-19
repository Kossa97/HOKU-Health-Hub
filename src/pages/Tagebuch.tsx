import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, BookHeart, Zap, AlertTriangle, Clock, Search } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { getDateLocale } from '../i18n/dateLocales'
import { DURATION_KEYS, durationKeyOf, durationLabel } from './tagebuch/duration'
import { ORDER, PAGE_SIZE, searchFilter, type SortBy } from './tagebuch/query'
import { INTAKE_OPTIONS, intakeDose, intakeGap, type IntakeOption } from './tagebuch/intake'
import { Sheet } from '../features/compliance/components/Sheet'
import { Auswertung } from './tagebuch/Auswertung'

interface Effect {
  id: string
  type: 'effect' | 'side_effect'
  description: string
  severity: number
  duration: string | null
  occurred_at: string
  notes: string | null
  stack_item_id: string | null
  stack_items: { display_name: string } | null
  dose_log_id: string | null
  dose_logs: Omit<IntakeOption, 'id'> | null
}

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
  const [intakeOptions, setIntakeOptions] = useState<IntakeOption[]>([])
  const [view, setView] = useState<'liste' | 'auswertung'>('liste')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [customDuration, setCustomDuration] = useState(false)
  const [form, setForm] = useState({
    type: 'effect' as 'effect' | 'side_effect',
    description: '',
    severity: 3,
    duration: '',
    occurred_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    stack_item_id: '',
    dose_log_id: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  // Stand beim Öffnen — Escape und Tippen daneben fragen nur nach, wenn sich etwas geändert hat.
  const [formAtOpen, setFormAtOpen] = useState(form)

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
    let query = supabase
      .from('effects')
      .select('*, stack_items(display_name), dose_logs(dose, unit, logged_at)')
      .eq('user_id', userId)
    if (filter !== 'all') query = query.eq('type', filter)
    if (orFilter) query = query.or(orFilter)
    for (const [column, ascending] of ORDER[sortBy]) query = query.order(column, { ascending })
    // Eine Zeile mehr als angezeigt: verrät, ob es weitere gibt.
    query.range(0, limit).then(({ data, error }) => {
      if (cancelled) return
      setLoaded(true)
      if (error) { setLoadError(true); setEffects([]); setHasMore(false); toast.error(t('tagebuch_load_error')); return }
      const rows = (data ?? []) as Effect[]
      setLoadError(false)
      setHasMore(rows.length > limit)
      setEffects(rows.slice(0, limit))
    })
    return () => { cancelled = true }
  }, [userId, filter, orFilter, sortBy, limit, reloadToken, t])

  // Einnahmen zur Auswahl: bestätigte der gewählten Substanz vor dem Zeitpunkt.
  // Beim Bearbeiten bleibt die schon verknüpfte wählbar, auch wenn sie älter ist.
  const linkedAtOpen = formAtOpen.dose_log_id
  useEffect(() => {
    const at = new Date(form.occurred_at)
    if (!showForm || !form.stack_item_id || Number.isNaN(at.getTime())) { setIntakeOptions([]); return }
    let cancelled = false
    // Das Formular kennt nur Minuten — eine Einnahme aus derselben Minute (mit Sekunden) zählt mit.
    const atIso = new Date(at.getTime() + 59_999).toISOString()
    const recent = supabase.from('dose_logs').select('id, dose, unit, logged_at')
      .eq('user_id', userId).eq('stack_item_id', form.stack_item_id).eq('taken', true)
      .lte('logged_at', atIso).order('logged_at', { ascending: false }).limit(INTAKE_OPTIONS)
    const linked = linkedAtOpen
      ? supabase.from('dose_logs').select('id, dose, unit, logged_at')
        .eq('user_id', userId).eq('id', linkedAtOpen).eq('stack_item_id', form.stack_item_id).lte('logged_at', atIso)
      : null
    Promise.all([recent, linked]).then(([recentRes, linkedRes]) => {
      if (cancelled) return
      const options = [...((recentRes.data ?? []) as IntakeOption[])]
      for (const row of (linkedRes?.data ?? []) as IntakeOption[]) {
        if (!options.some(option => option.id === row.id)) options.push(row)
      }
      setIntakeOptions(options)
      // Eine Wahl, die nicht mehr passt (Zeitpunkt davor), fällt weg.
      if (!recentRes.error && !linkedRes?.error) {
        setForm(f => (f.dose_log_id && !options.some(option => option.id === f.dose_log_id) ? { ...f, dose_log_id: '' } : f))
      }
    })
    return () => { cancelled = true }
  }, [showForm, form.stack_item_id, form.occurred_at, linkedAtOpen, userId])

  const resetForm = () => {
    const empty = {
      type: 'effect' as const, description: '', severity: 3,
      duration: '', occurred_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      stack_item_id: '', dose_log_id: '', notes: '',
    }
    setForm(empty)
    setFormAtOpen(empty)
    setCustomDuration(false)
    setEditingId(null)
  }

  const openEdit = (e: Effect) => {
    const durationKey = durationKeyOf(e.duration)
    const current = {
      type: e.type, description: e.description, severity: e.severity,
      duration: durationKey ?? e.duration ?? '',
      occurred_at: format(new Date(e.occurred_at), "yyyy-MM-dd'T'HH:mm"),
      stack_item_id: e.stack_item_id ?? '', dose_log_id: e.dose_log_id ?? '', notes: e.notes ?? '',
    }
    setForm(current)
    setFormAtOpen(current)
    setCustomDuration(!!e.duration && !durationKey)
    setEditingId(e.id)
    setShowForm(true)
  }

  const save = async () => {
    if (!form.description.trim()) return toast.error(t('beschreibung_erforderlich'))
    setSaving(true)
    const fields = {
      type:        form.type,
      description: form.description,
      severity:    form.severity,
      duration:    form.duration || null,
      occurred_at: new Date(form.occurred_at).toISOString(),
      stack_item_id: form.stack_item_id || null,
      // Ohne Substanz bleibt ein bestehender Verweis (Substanz gelöscht → set null); der Wechsel der Substanz leert ihn.
      dose_log_id: form.dose_log_id || null,
      notes:       form.notes || null,
    }
    // .select() liefert die geänderte Zeile – leer heißt: Eintrag existiert nicht mehr
    const { data, error } = editingId
      ? await supabase.from('effects').update(fields).eq('id', editingId).eq('user_id', userId).select('id')
      : await supabase.from('effects').insert({ ...fields, user_id: userId, status: 'eingetreten' }).select('id')
    if (error?.message?.includes('effect_dose_log_other_substance')) toast.error(t('tagebuch_einnahme_fremd'))
    else if (error || !data?.length) toast.error(t('fehler_speichern'))
    else {
      toast.success(t(editingId ? 'eintrag_aktualisiert' : 'eintrag_gespeichert'))
      setShowForm(false); resetForm(); reload()
    }
    setSaving(false)
  }

  const remove = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    const { error } = await supabase.from('effects').delete().eq('id', deleting.id).eq('user_id', userId)
    setDeleteBusy(false)
    if (error) return toast.error(t('tagebuch_delete_error'))
    setDeleting(null)
    toast.success(t('deleted')); reload()
  }

  const closeForm = () => { if (!saving) setShowForm(false) }
  const dismissForm = () => {
    if (saving) return
    const dirty = (Object.keys(form) as (keyof typeof form)[]).some(key => form[key] !== formAtOpen[key])
    if (dirty && !window.confirm(t('tagebuch_aenderungen_verwerfen'))) return
    setShowForm(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="lg-large-title min-w-0 truncate">{t('tagebuch_title')}</h1>
        <button type="button" className="lg-btn lg-btn-tint lg-btn-compact shrink-0"
          onClick={() => { resetForm(); setShowForm(true) }}>
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
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Typ + Intensität */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {e.type === 'effect'
                    ? <Zap size={14} aria-hidden="true" className="text-[var(--lg-good-text)] shrink-0" />
                    : <AlertTriangle size={14} aria-hidden="true" className="text-[var(--lg-warn-text)] shrink-0" />}
                  <span className={`text-[13px] font-medium ${e.type === 'effect' ? 'text-[var(--lg-good-text)]' : 'text-[var(--lg-warn-text)]'}`}>
                    {e.type === 'effect' ? t('wirkung') : t('nebenwirkung')}
                  </span>
                  <span className={`text-[13px] font-medium ml-auto ${SEVERITY_COLORS[e.severity]}`}>
                    {severityLabel(e.severity)}
                  </span>
                </div>

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
                  {e.duration && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} aria-hidden="true" />
                      {durationLabel(e.duration, t)}
                    </span>
                  )}
                </div>

                {e.notes && <p className="text-[var(--lg-text-2)] text-[14px] mt-1">{e.notes}</p>}
              </div>

              <div className="flex shrink-0">
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

      {/* ══ FORMULAR ══════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[var(--tyd-popup-top)]" data-app-modal data-app-back-dirty-on-interaction
          onClick={dismissForm}>
          <div role="dialog" aria-modal="true" aria-labelledby="tagebuch-form-title"
            className="lg-sheet lg-sheet-solid w-full max-w-lg px-5 pt-2 space-y-4
            overflow-y-auto overscroll-contain max-h-full scroll-pb-28" onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); dismissForm() } }}>
            <span className="lg-grabber !mb-1" aria-hidden="true" />
            <h2 id="tagebuch-form-title" className="lg-title2">{t(editingId ? 'tagebuch_eintrag_bearbeiten' : 'neuer_tagebuch_eintrag')}</h2>

            {/* 1. Wirkung / Nebenwirkung */}
            <div className="flex rounded-full bg-[var(--lg-fill)] p-0.5">
              <button type="button" aria-pressed={form.type === 'effect'}
                className={`flex-1 min-h-9 rounded-full text-[14px] font-semibold transition-colors ${
                  form.type === 'effect' ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-good-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]' : 'text-[var(--lg-text-2)]'
                }`}
                onClick={() => setForm(f => ({ ...f, type: 'effect' }))}>
                {t('wirkung')}
              </button>
              <button type="button" aria-pressed={form.type === 'side_effect'}
                className={`flex-1 min-h-9 rounded-full text-[14px] font-semibold transition-colors ${
                  form.type === 'side_effect' ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-warn-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]' : 'text-[var(--lg-text-2)]'
                }`}
                onClick={() => setForm(f => ({ ...f, type: 'side_effect' }))}>
                {t('nebenwirkung')}
              </button>
            </div>

            {/* 2. Beschreibung */}
            <div>
              <label className="label" htmlFor="tagebuch-beschreibung">{t('beschreibung_required')}</label>
              <input id="tagebuch-beschreibung" className="input" autoFocus required
                placeholder={t('beschreibung_placeholder')}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {/* 3. Substanz und Zeitpunkt: eine Gruppe, Name links, Wert rechts */}
            <div className="lg-form-group">
              <div className="lg-form-row">
                <label htmlFor="tagebuch-substanz">{t('peptide_form_group_substance')}</label>
                <span className="lg-form-value" aria-hidden="true">
                  {stackItems.find(item => item.id === form.stack_item_id)?.display_name ?? t('tagebuch_substanz_keine')}
                </span>
                <select id="tagebuch-substanz" value={form.stack_item_id}
                  onChange={e => setForm(f => ({ ...f, stack_item_id: e.target.value, dose_log_id: '' }))}>
                  <option value="">{t('tagebuch_substanz_keine')}</option>
                  {stackItems.map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}
                </select>
              </div>
              <div className="lg-form-row">
                <label htmlFor="tagebuch-zeitpunkt">{t('zeitpunkt')}</label>
                <input id="tagebuch-zeitpunkt" type="datetime-local" value={form.occurred_at}
                  onChange={e => setForm(f => ({ ...f, occurred_at: e.target.value }))} />
              </div>
            </div>

            {/* 4. Bezug zur Einnahme — freiwillig, nur mit Substanz */}
            {form.stack_item_id && (
              <div>
                <label className="label" htmlFor="tagebuch-einnahme">{t('tagebuch_einnahme_label')}</label>
                {intakeOptions.length > 0 ? (
                  <select id="tagebuch-einnahme" className="select" value={form.dose_log_id}
                    onChange={e => setForm(f => ({ ...f, dose_log_id: e.target.value }))}>
                    <option value="">{t('tagebuch_einnahme_keine')}</option>
                    {intakeOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {[format(new Date(option.logged_at), 'dd.MM. HH:mm', { locale }), intakeDose(option, i18n.language)].filter(Boolean).join(' · ')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p id="tagebuch-einnahme" className="px-1 text-xs text-[var(--lg-text-3)]">{t('tagebuch_einnahme_leer')}</p>
                )}
              </div>
            )}

            {/* 5. Intensität — fünf Stufen; native Radios: Pfeiltasten funktionieren von selbst */}
            <fieldset>
              {/* Die gewählte Stufe steht rechts neben der Überschrift */}
              <legend className="label w-full">
                <span className="flex justify-between gap-3">
                  <span>{t('tagebuch_intensitaet')}</span>
                  <span className="text-[var(--lg-text)]" aria-hidden="true">{severityLabel(form.severity)}</span>
                </span>
              </legend>
              <div className="grid grid-cols-5 rounded-full bg-[var(--lg-fill)] p-0.5">
                {[1, 2, 3, 4, 5].map(level => (
                  <label key={level} className="cursor-pointer">
                    <input type="radio" name="tagebuch-intensitaet" value={level} className="peer sr-only"
                      checked={form.severity === level} aria-label={`${level} – ${severityLabel(level)}`}
                      onChange={() => setForm(f => ({ ...f, severity: level }))} />
                    <span aria-hidden="true" className="flex h-9 items-center justify-center rounded-full text-[15px] font-semibold text-[var(--lg-text-2)]
                      transition-colors peer-checked:bg-[var(--lg-fill-selected)] peer-checked:text-[var(--lg-text)] peer-checked:shadow-[0_3px_8px_rgba(0,0,0,0.25)] peer-focus-visible:ring-2 peer-focus-visible:ring-sky-400">
                      {level}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex justify-between text-xs text-[var(--lg-text-3)] mt-1.5 px-1" aria-hidden="true">
                <span>{t('sehr_leicht')}</span><span>{t('sehr_stark')}</span>
              </div>
            </fieldset>

            {/* 6. Dauer */}
            <div>
              <p className="label" id="tagebuch-dauer">{t('dauer')}</p>
              <div className="flex flex-wrap gap-2 mb-2" role="group" aria-labelledby="tagebuch-dauer">
                {DURATION_KEYS.map(key => (
                  <button key={key} type="button" aria-pressed={form.duration === key && !customDuration}
                    onClick={() => { setForm(f => ({ ...f, duration: key })); setCustomDuration(false) }}
                    className={`min-h-9 px-3.5 rounded-full text-[14px] font-medium transition-colors ${
                      form.duration === key && !customDuration
                        ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--lg-accent-text)]'
                        : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'
                    }`}>
                    {t(key)}
                  </button>
                ))}
                <button type="button" aria-pressed={customDuration}
                  onClick={() => { setCustomDuration(true); setForm(f => ({ ...f, duration: '' })) }}
                  className={`min-h-9 px-3.5 rounded-full text-[14px] font-medium transition-colors ${
                    customDuration ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--lg-accent-text)]' : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'
                  }`}>
                  {t('individuell')}
                </button>
              </div>
              {customDuration && (
                <input className="input" aria-labelledby="tagebuch-dauer" placeholder={t('dauer_placeholder')}
                  value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
              )}
            </div>

            {/* 7. Notizen */}
            <div>
              <label className="label" htmlFor="tagebuch-notizen">{t('notizen_optional')}</label>
              <textarea id="tagebuch-notizen" className="input resize-none" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* Bleibt unten stehen — Speichern ist ohne Scrollen erreichbar */}
            <div className="sticky bottom-0 -mx-5 flex gap-3 bg-[var(--lg-sheet-solid)] px-5 pt-3 pb-5">
              <button type="button" data-quiet className="lg-gray-btn flex-1 !min-h-12 !text-[17px]" data-app-back-close onClick={closeForm}>{t('cancel')}</button>
              <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" onClick={save} disabled={saving}>
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
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
