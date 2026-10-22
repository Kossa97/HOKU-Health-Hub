import { useEffect, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Info, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getDateLocale } from '../../i18n/dateLocales'
import { INTAKE_OPTIONS, intakeDose, type IntakeOption } from './intake'
import { SymptomChip } from './SymptomChip'
import { ChipEditor } from './ChipEditor'
import { ChipInfo } from './ChipInfo'
import { sortedChips, type DiaryEntry } from './entry'
import {
  SYMPTOM_GROUPS, chipAria as ariaOf, chipId, chipLabel as labelOf, chipPayload, durationText, fromRow, kindColor, labelIn,
  matchingSymptoms, symptomByKey, type ChipDraft, type SymptomKind,
} from './chips'
import { SheetGriff } from '../../components/ui/SheetGriff'

interface StackItem { id: string; display_name: string }

interface FormState {
  title: string
  occurred_at: string
  stack_item_id: string
  dose_log_id: string
  notes: string
  chips: ChipDraft[]
}

function initialState(entry: DiaryEntry | null): FormState {
  if (!entry) {
    return { title: '', occurred_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"), stack_item_id: '', dose_log_id: '', notes: '', chips: [] }
  }
  const rows = sortedChips(entry)
  // Ältere Einträge ohne Chips: ihre Wirkung wird ein eigener Chip.
  const chips = rows.length ? rows.map(fromRow) : entry.type && entry.severity
    ? [{ key: null, customLabel: entry.description.slice(0, 80), kind: entry.type, severity: entry.severity, durationMinutes: null, ongoing: false }]
    : []
  return {
    title: entry.description,
    occurred_at: format(new Date(entry.occurred_at), "yyyy-MM-dd'T'HH:mm"),
    stack_item_id: entry.stack_item_id ?? '',
    dose_log_id: entry.dose_log_id ?? '',
    notes: entry.notes ?? '',
    chips,
  }
}

/**
 * Formular eines Tagebuch-Eintrags (v2): Titel, optionale Substanz, Zeitpunkt,
 * Wirkungen/Nebenwirkungen als Chips mit eigenem Editor, Notizen.
 * Planung und Entscheidungen: memory/projects/tagebuch.md.
 */
export function EntryForm({ userId, stackItems, entry, onClose, onSaved }: {
  userId: string
  stackItems: StackItem[]
  entry: DiaryEntry | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const locale = getDateLocale()
  const [atOpen] = useState(() => initialState(entry))
  const [form, setForm] = useState(atOpen)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<SymptomKind>('effect')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<{ chip: ChipDraft; index: number | null } | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [intakeOptions, setIntakeOptions] = useState<IntakeOption[]>([])

  // Einnahmen zur Auswahl: bestätigte der gewählten Substanz vor dem Zeitpunkt.
  // Beim Bearbeiten bleibt die schon verknüpfte wählbar, auch wenn sie älter ist.
  const linkedAtOpen = atOpen.dose_log_id
  useEffect(() => {
    const at = new Date(form.occurred_at)
    // Ohne Substanz ist der Abschnitt ausgeblendet; die alte Liste stört dort nicht.
    if (!form.stack_item_id || Number.isNaN(at.getTime())) return
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
  }, [form.stack_item_id, form.occurred_at, linkedAtOpen, userId])

  const chipLabel = (chip: Pick<ChipDraft, 'key' | 'customLabel'>) => labelOf(chip, lang)
  const chipAria = (chip: ChipDraft, selected: boolean) => ariaOf(chip, selected, t, lang)

  const title = form.title.trim()
  const missing = !title && !form.chips.length ? 'tagebuch_titel_und_chips_fehlen'
    : !title ? 'tagebuch_titel_fehlt' : !form.chips.length ? 'tagebuch_chips_fehlen' : null

  const save = async () => {
    if (missing || saving) return
    setSaving(true)
    try {
      await persist()
    } finally {
      setSaving(false)
    }
  }

  /**
   * Eintrag und Chips in einem Aufruf (eine Transaktion): scheitert etwas,
   * bleibt alles, wie es war. Meldet Fehler selbst, `saving` setzt `save` zurück.
   */
  const persist = async () => {
    const fields = {
      description: title,
      occurred_at: new Date(form.occurred_at).toISOString(),
      stack_item_id: form.stack_item_id || null,
      // Ohne Substanz bleibt ein bestehender Verweis (Substanz gelöscht); ein Wechsel leert die Wahl schon vorher.
      dose_log_id: form.dose_log_id || null,
      notes: form.notes.trim() || null,
    }
    const chips = chipPayload(form.chips)
    const { error } = await supabase.rpc('save_diary_entry', { p_effect_id: entry?.id ?? null, p_entry: fields, p_chips: chips })
    if (error) {
      toast.error(t(error.message?.includes('effect_dose_log_other_substance') ? 'tagebuch_einnahme_fremd' : 'fehler_speichern'))
      return
    }
    toast.success(t(entry ? 'eintrag_aktualisiert' : 'eintrag_gespeichert'))
    onSaved()
  }

  const dismiss = () => {
    if (saving) return
    if (JSON.stringify(form) !== JSON.stringify(atOpen) && !window.confirm(t('tagebuch_aenderungen_verwerfen'))) return
    onClose()
  }

  const openChip = (chip: ChipDraft) => {
    const index = form.chips.findIndex(c => chipId(c) === chipId(chip))
    setEditing({ chip: index >= 0 ? form.chips[index] : chip, index: index >= 0 ? index : null })
  }
  const openCustom = (kind: SymptomKind) =>
    setEditing({ chip: { key: null, customLabel: '', kind, severity: 3, durationMinutes: null, ongoing: false }, index: null })

  const doneChip = (chip: ChipDraft) => {
    setForm(f => {
      const chips = [...f.chips]
      if (editing?.index != null) chips[editing.index] = chip
      else chips.push(chip)
      return { ...f, chips }
    })
    setEditing(null)
  }
  const removeChip = () => {
    if (editing?.index != null) setForm(f => ({ ...f, chips: f.chips.filter((_, i) => i !== editing.index) }))
    setEditing(null)
  }

  const searching = query.trim().length > 0
  const hits = new Set(matchingSymptoms(query, lang).map(symptom => symptom.key))
  const visibleKinds: SymptomKind[] = searching ? ['effect', 'side_effect'] : [tab]
  const countOf = (kind: SymptomKind) => form.chips.filter(chip => chip.kind === kind).length

  const onTabKey = (event: KeyboardEvent, kind: SymptomKind) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next: SymptomKind = event.key === 'Home' ? 'effect' : event.key === 'End' ? 'side_effect' : kind === 'effect' ? 'side_effect' : 'effect'
    setTab(next)
    setQuery('')
    document.getElementById(`tagebuch-art-${next}`)?.focus()
  }

  const chipButton = (chip: ChipDraft, selected: boolean) => (
    <SymptomChip key={chipId(chip)} kind={chip.kind} label={chipLabel(chip)} iconKey={chip.key}
      selected={selected} severity={chip.severity} duration={selected ? durationText(chip, t) : undefined}
      ariaLabel={chipAria(chip, selected)} onClick={() => openChip(chip)} />
  )

  let anyHit = false
  const sections = visibleKinds.map(kind => {
    const groups = SYMPTOM_GROUPS.filter(group => group.kind === kind).map(group => {
      const chips = matchingSymptoms('', lang)
        .filter(symptom => symptom.group === group.key && hits.has(symptom.key))
        .map(symptom => {
          const chosen = form.chips.find(chip => chip.key === symptom.key)
          return chipButton(chosen ?? { key: symptom.key, customLabel: null, kind, severity: 3, durationMinutes: null, ongoing: false }, !!chosen)
        })
      if (chips.length) anyHit = true
      return chips.length ? { key: group.key, name: labelIn(group.label, lang), chips } : null
    }).filter(group => group !== null)
    const own = form.chips.map((chip, index) => ({ chip, index }))
      .filter(({ chip }) => (!chip.key || !symptomByKey(chip.key)) && chip.kind === kind && (!searching || chipLabel(chip).toLocaleLowerCase(lang).includes(query.trim().toLocaleLowerCase(lang))))
    return { kind, groups, own }
  })

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[var(--tyd-popup-top)]" data-app-modal data-app-back-dirty-on-interaction
      onClick={dismiss}>
      <div role="dialog" aria-modal="true" aria-labelledby="tagebuch-form-title"
        className="lg-sheet lg-sheet-solid w-full max-w-lg px-5 pt-2 space-y-4 overflow-y-auto overscroll-contain max-h-full scroll-pb-28"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape' && !editing && !infoOpen) { e.stopPropagation(); dismiss() } }}>
        <SheetGriff className="!mb-1" onClose={dismiss} />
        <h2 id="tagebuch-form-title" className="lg-title2">{t(entry ? 'tagebuch_eintrag_bearbeiten' : 'neuer_tagebuch_eintrag')}</h2>

        {/* Titel, Substanz, Zeitpunkt: eine Gruppe */}
        <div className="lg-form-group">
          <div className="lg-form-row">
            <input id="tagebuch-titel" aria-label={t('tagebuch_titel_label')} placeholder={t('tagebuch_titel_placeholder')} required
              autoFocus={!entry} maxLength={120} value={form.title} style={{ textAlign: 'left', color: 'var(--lg-text)' }}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="lg-form-row">
            <label htmlFor="tagebuch-substanz">{t('peptide_form_group_substance')}</label>
            <span className="lg-form-value" aria-hidden="true">
              {stackItems.find(item => item.id === form.stack_item_id)?.display_name ?? t('tagebuch_substanz_keine')}
            </span>
            <select id="tagebuch-substanz" value={form.stack_item_id}
              onChange={e => { const value = e.target.value; setIntakeOptions([]); setForm(f => ({ ...f, stack_item_id: value, dose_log_id: '' })) }}>
              <option value="">{t('tagebuch_substanz_keine')}</option>
              {stackItems.map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}
            </select>
          </div>
          <div className="lg-form-row">
            <label htmlFor="tagebuch-zeitpunkt">{t('zeitpunkt')}</label>
            {/* Leeren lässt sich der Zeitpunkt nicht — er bleibt dann, wie er war. */}
            <input id="tagebuch-zeitpunkt" type="datetime-local" value={form.occurred_at} required
              onChange={e => { const value = e.target.value; if (value) setForm(f => ({ ...f, occurred_at: value })) }} />
          </div>
        </div>

        {/* Bezug zur Einnahme — freiwillig, nur mit Substanz */}
        {form.stack_item_id && (
          <div>
            <label className="label" htmlFor="tagebuch-einnahme">{t('tagebuch_einnahme_label')}</label>
            {intakeOptions.length > 0 ? (
              <select id="tagebuch-einnahme" className="select" value={form.dose_log_id}
                onChange={e => setForm(f => ({ ...f, dose_log_id: e.target.value }))}>
                <option value="">{t('tagebuch_einnahme_keine')}</option>
                {intakeOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {[format(new Date(option.logged_at), 'dd.MM. HH:mm', { locale }), intakeDose(option, lang)].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
            ) : (
              <p id="tagebuch-einnahme" className="px-1 text-xs text-[var(--lg-text-3)]">{t('tagebuch_einnahme_leer')}</p>
            )}
          </div>
        )}

        {/* Suche, Tabs und Info bleiben beim Scrollen oben */}
        <div className="sticky -top-2 z-[2] -mx-5 space-y-2.5 bg-[var(--lg-sheet-solid)] px-5 pt-2 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lg-text-3)]" />
              <input type="search" value={query} onChange={e => setQuery(e.target.value)}
                aria-label={t('tagebuch_chip_suche')} placeholder={t('tagebuch_chip_suche_kurz')}
                className="min-h-11 w-full rounded-full border-0 bg-[var(--lg-fill)] py-2.5 pl-10 pr-4 text-[16px] text-[var(--lg-text)] outline-none placeholder:text-[var(--lg-text-3)] focus-visible:ring-2 focus-visible:ring-[var(--lg-accent)]" />
            </div>
            <button type="button" aria-label={t('tagebuch_info_oeffnen')} aria-haspopup="dialog" onClick={() => setInfoOpen(true)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--lg-fill)] text-[var(--lg-accent-text)]">
              <Info size={20} aria-hidden="true" />
            </button>
          </div>
          <div role="tablist" aria-label={t('tagebuch_info_art')}
            className={`grid grid-cols-2 gap-0.5 rounded-full bg-[var(--lg-fill)] p-0.5 ${searching ? 'opacity-50' : ''}`}>
            {(['effect', 'side_effect'] as const).map(kind => {
              const active = !searching && tab === kind
              const count = countOf(kind)
              const color = kindColor(kind)
              return (
                <button key={kind} type="button" role="tab" id={`tagebuch-art-${kind}`} aria-selected={active}
                  aria-controls="tagebuch-chip-panel" tabIndex={(searching ? kind === 'effect' : active) ? 0 : -1}
                  onClick={() => { setTab(kind); setQuery('') }} onKeyDown={e => onTabKey(e, kind)}
                  className={`relative flex min-h-[34px] min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-0.5 text-[13px] font-semibold transition-colors min-[360px]:gap-1.5 min-[360px]:px-1 min-[360px]:text-[14px]
                    after:absolute after:inset-x-0 after:top-[calc(50%-22px)] after:bottom-[calc(50%-22px)] after:content-[''] ${
                    active ? 'bg-[var(--lg-fill-selected)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]' : 'text-[var(--lg-text-2)]'}`}
                  style={active ? { color } : undefined}>
                  {t(kind === 'effect' ? 'wirkungen' : 'nebenwirkungen')}
                  {count > 0 && (
                    <span className="min-w-[18px] rounded-full px-[5px] text-[11px] font-bold leading-[18px]"
                      style={active ? { background: color, color: 'var(--lg-sheet-solid)' } : { background: 'rgba(118,118,128,.4)', color: 'var(--lg-text)' }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {searching && <p className="px-1 text-[12px] text-[var(--lg-text-2)]">{t('tagebuch_suche_beide')}</p>}
        </div>

        <div id="tagebuch-chip-panel" role="tabpanel" aria-labelledby={`tagebuch-art-${tab}`} className="space-y-4">
          {sections.map(section => (
            <section key={section.kind} className="space-y-2.5">
              {searching && (
                <h3 className="px-1 text-[20px] font-bold" style={{ color: kindColor(section.kind) }}>
                  {t(section.kind === 'effect' ? 'wirkungen' : 'nebenwirkungen')}
                </h3>
              )}
              {section.groups.map(group => (
                <div key={group.key} className="rounded-2xl bg-[rgba(118,118,128,.12)] p-3.5">
                  <h4 className="mb-2.5 text-[15px] font-semibold text-[rgba(235,240,255,.86)]">{group.name}</h4>
                  <div className="flex flex-wrap gap-2">{group.chips}</div>
                </div>
              ))}
              <div className="rounded-2xl bg-[rgba(118,118,128,.12)] p-3.5">
                <h4 className="mb-2.5 text-[15px] font-semibold text-[rgba(235,240,255,.86)]">{t('tagebuch_gruppe_eigene')}</h4>
                <div className="flex flex-wrap gap-2">
                  {section.own.map(({ chip, index }) => (
                    <SymptomChip key={`own-${index}`} kind={chip.kind} label={chipLabel(chip)} iconKey={chip.key} selected
                      severity={chip.severity} duration={durationText(chip, t)} ariaLabel={chipAria(chip, true)}
                      onClick={() => setEditing({ chip, index })} />
                  ))}
                  <SymptomChip kind={section.kind} iconKey={null} selected={false} accent="var(--lg-accent-text)"
                    label={`+ ${t(section.kind === 'effect' ? 'tagebuch_eigene_wirkung' : 'tagebuch_eigene_nebenwirkung')}`}
                    onClick={() => openCustom(section.kind)} />
                </div>
              </div>
            </section>
          ))}
          {searching && !anyHit && <p className="px-1 text-[15px] text-[var(--lg-text-2)]">{t('tagebuch_chip_nichts_gefunden')}</p>}
        </div>

        <div>
          <label className="label" htmlFor="tagebuch-notizen">{t('notizen_optional')}</label>
          <textarea id="tagebuch-notizen" className="input resize-none" rows={2} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        {/* Bleibt unten stehen — Speichern ist ohne Scrollen erreichbar */}
        <div className="sticky bottom-0 z-[2] -mx-5 space-y-2 bg-[var(--lg-sheet-solid)] px-5 pt-3 pb-5">
          {missing && <p className="text-center text-[12px] text-[var(--lg-text-2)]" id="tagebuch-speichern-hinweis">{t(missing)}</p>}
          <div className="flex gap-3">
            <button type="button" data-quiet className="lg-gray-btn flex-1 !min-h-12 !text-[17px]" data-app-back-close onClick={() => { if (!saving) onClose() }}>{t('cancel')}</button>
            <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" onClick={save} disabled={saving || !!missing}
              aria-describedby={missing ? 'tagebuch-speichern-hinweis' : undefined}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <div onClick={e => e.stopPropagation()}>
          <ChipEditor chip={editing.chip} label={chipLabel(editing.chip)} isNew={editing.index == null}
            onDone={doneChip} onRemove={removeChip} onClose={() => setEditing(null)} />
        </div>
      )}
      {infoOpen && <div onClick={e => e.stopPropagation()}><ChipInfo onClose={() => setInfoOpen(false)} /></div>}
    </div>
  )
}
