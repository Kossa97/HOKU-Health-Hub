// src/pages/lab/AdminPanel.tsx
// Admin-Panel für KI-gestützte Pflege der Peptid-Bibliothek + PK-Profile.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Plus, RefreshCw, Save, X, Loader2,
  CheckCircle, AlertTriangle, Activity, Trash2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { getAllPeptides, STATUS_LABEL_KEYS, CATEGORY_LABEL_KEYS } from '../../services/peptideLibrary'
import type { PeptideEntry } from '../../services/peptideLibrary'
import { denyProps } from '../../lib/denyFeedback'
import { ModerationQueue } from '../../features/compliance/components/ModerationQueue'

type Tab   = 'update' | 'create' | 'pk'
type Status = 'idle' | 'loading' | 'preview' | 'saving' | 'done' | 'error'

interface PkProfile {
  id: string
  name: string
  aliases: string[]
  half_life_hours: number
  tmax_hours: number
  bioavailability_sc: number
  vd_l_kg: number
  notes: string | null
  category: string
}

const PK_CATEGORIES = ['peptide', 'glp1', 'sarm', 'hormone', 'other'] as const

const LIBRARY_WRITE_FIELDS = [
  'slug', 'name', 'full_name', 'category', 'tldr', 'mechanism',
  'benefits', 'research_dosage', 'half_life', 'administration',
  'research_status', 'side_effects', 'contraindications', 'pubmed_query',
  'tags', 'evidence_human', 'evidence_animal', 'evidence_clinical',
  'evidence_score', 'research_gaps', 'sort_order',
] as const

const LIBRARY_ARRAY_FIELDS = new Set([
  'benefits', 'administration', 'side_effects', 'contraindications', 'research_gaps', 'tags',
])

const MISSING_LIBRARY_COLUMN_RE = /Could not find the '(\w+)' column of 'peptide_library'/i

function supabaseErrorText(error: { message?: string; details?: string; hint?: string }): string {
  return [error.message, error.details, error.hint].filter(Boolean).join(' ')
}

function buildLibraryPayload(
  source: Record<string, unknown>,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  const raw = { ...source, ...extras }
  const payload: Record<string, unknown> = {}
  for (const key of LIBRARY_WRITE_FIELDS) {
    if (raw[key] === undefined) continue
    let val = raw[key]
    if (LIBRARY_ARRAY_FIELDS.has(key) && !Array.isArray(val)) val = []
    if (key === 'evidence_score' && val != null) val = Number(val)
    payload[key] = val
  }
  return payload
}

async function saveLibraryRow(
  payload: Record<string, unknown>,
  mode: { type: 'insert' } | { type: 'update'; slug: string },
): Promise<{ error: string | null; omitted: string[] }> {
  const current = { ...payload }
  const omitted: string[] = []

  for (let attempt = 0; attempt < LIBRARY_WRITE_FIELDS.length; attempt++) {
    const { error } = mode.type === 'insert'
      ? await supabase.from('peptide_library').insert(current)
      : await supabase.from('peptide_library').update(current).eq('slug', mode.slug)

    if (!error) return { error: null, omitted }

    const match = supabaseErrorText(error).match(MISSING_LIBRARY_COLUMN_RE)
    if (!match || !(match[1] in current)) return { error: supabaseErrorText(error), omitted }

    omitted.push(match[1])
    delete current[match[1]]
  }

  return { error: 'Speichern fehlgeschlagen — peptide_library-Schema unvollständig.', omitted }
}

function saveSuccessHint(omitted: string[]): string {
  if (omitted.length === 0) return ''
  return ` (Hinweis: Spalten fehlen in Supabase — ${omitted.join(', ')}. Bitte supabase-peptide-library-v2.sql und v3.sql ausführen.)`
}

// ─── API Call ─────────────────────────────────────────────────────────────────

async function callAI(
  action: 'create' | 'update',
  payload: { name?: string; existing?: Record<string, unknown> }
): Promise<Record<string, unknown>> {
  const res = await fetch('/api/peptide-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try { data = JSON.parse(text) } catch {
    throw new Error(`Server-Fehler (${res.status}): ${text.slice(0, 120)}`)
  }
  if (!res.ok || data.error) throw new Error(String(data.error ?? 'Unbekannter Fehler'))
  return data.result as Record<string, unknown>
}

// ─── Preview helpers ──────────────────────────────────────────────────────────

function PreviewField({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null
  return (
    <div className="border-b border-[var(--lg-hair)] pb-3 last:border-0 last:pb-0">
      <p className="text-[13px] text-[var(--lg-text-3)] mb-1">{label}</p>
      {Array.isArray(value) ? (
        <ul className="space-y-0.5">
          {(value as string[]).map((v, i) => (
            <li key={i} className="text-xs text-[var(--lg-text-2)] flex gap-2">
              <span className="text-[var(--lg-text-3)]">·</span><span>{v}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--lg-text-2)] leading-relaxed">{String(value)}</p>
      )}
    </div>
  )
}

function EvidencePreview({ result }: { result: Record<string, unknown> }) {
  return (
    <div className="flex items-center gap-4">
      {(['evidence_human', 'evidence_animal', 'evidence_clinical'] as const).map((k, i) => (
        <div key={k} className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--lg-text-3)]">
            {['Human', 'Tier', 'Klinisch'][i]}
          </span>
          <span className="text-xs text-slate-400">{String(result[k])}</span>
        </div>
      ))}
      <div className="ml-auto flex items-center gap-1">
        <span className="text-xs font-medium tabular-nums text-[var(--lg-text)]">{String(result.evidence_score)}</span>
        <span className="text-xs text-slate-600">/10</span>
      </div>
    </div>
  )
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inp = "w-full bg-[var(--surface-input)] border border-[var(--lg-hair)] rounded-xl px-4 py-2 text-sm text-[var(--lg-text)] placeholder:text-[var(--lg-text-3)] outline-none focus:border-[var(--accent-border)] transition-colors"

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminPanel() {
  const { t }      = useTranslation()
  const navigate   = useNavigate()
  const { user }   = useAuth()

  // ── Admin-Check ──────────────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) { navigate('/auth'); return }
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setIsAdmin(data?.is_admin === true))
  }, [user, navigate])

  // ── Peptide-Library state ────────────────────────────────────────────────
  const [tab, setTab]           = useState<Tab>('update')
  const [peptides, setPeptides] = useState<PeptideEntry[]>([])
  const [selected, setSelected] = useState<PeptideEntry | null>(null)
  const [newName, setNewName]   = useState('')
  const [status, setStatus]     = useState<Status>('idle')
  const [result, setResult]     = useState<Record<string, unknown> | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [editedName, setEditedName] = useState('')
  const [editedSlug, setEditedSlug] = useState('')

  // ── PK-Profile state ─────────────────────────────────────────────────────
  const [pkProfiles, setPkProfiles]   = useState<PkProfile[]>([])
  const [pkLoading, setPkLoading]     = useState(false)
  const [showPkForm, setShowPkForm]   = useState(false)
  const [pkSaving, setPkSaving]       = useState(false)
  const [pkName, setPkName]           = useState('')
  const [pkAliases, setPkAliases]     = useState('')
  const [pkHalfLife, setPkHalfLife]   = useState('')
  const [pkTmax, setPkTmax]           = useState('')
  const [pkBioavail, setPkBioavail]   = useState('1.0')
  const [pkVd, setPkVd]               = useState('0.3')
  const [pkNotes, setPkNotes]         = useState('')
  const [pkCategory, setPkCategory]   = useState<string>('peptide')

  useEffect(() => {
    getAllPeptides().then(data => {
      setPeptides(data)
      if (data.length > 0) setSelected(data[0])
    })
  }, [])

  useEffect(() => {
    if (result) { setEditedName(String(result.name ?? '')); setEditedSlug(String(result.slug ?? '')) }
  }, [result])

  const loadPkProfiles = async () => {
    setPkLoading(true)
    const { data } = await supabase.from('pk_profiles').select('*').order('name')
    setPkProfiles((data as PkProfile[]) ?? [])
    setPkLoading(false)
  }

  useEffect(() => { if (tab === 'pk') void loadPkProfiles() }, [tab])

  // ── PK form helpers ──────────────────────────────────────────────────────
  const resetPkForm = () => {
    setPkName(''); setPkAliases(''); setPkHalfLife(''); setPkTmax('')
    setPkBioavail('1.0'); setPkVd('0.3'); setPkNotes(''); setPkCategory('peptide')
    setShowPkForm(false)
  }

  const savePkProfile = async () => {
    if (!pkName.trim() || !pkHalfLife || !pkTmax) return
    setPkSaving(true)
    const payload = {
      name: pkName.trim(),
      aliases: pkAliases.split(',').map(s => s.trim()).filter(Boolean),
      half_life_hours: Number(pkHalfLife),
      tmax_hours: Number(pkTmax),
      bioavailability_sc: Number(pkBioavail),
      vd_l_kg: Number(pkVd),
      notes: pkNotes || null,
      category: pkCategory,
    }
    const { error } = await supabase.from('pk_profiles').upsert(payload, { onConflict: 'name' })
    setPkSaving(false)
    if (error) { alert('Fehler: ' + error.message); return }
    resetPkForm()
    void loadPkProfiles()
  }

  const deletePkProfile = async (id: string, name: string) => {
    if (!confirm(`"${name}" wirklich löschen?`)) return
    await supabase.from('pk_profiles').delete().eq('id', id)
    void loadPkProfiles()
  }

  // ── Peptide-Library actions ──────────────────────────────────────────────
  function getFinalResult() { return { ...result, name: editedName, slug: editedSlug } }

  async function persistLibrary(
    mode: { type: 'insert'; sortOrder: number } | { type: 'update'; slug: string },
  ) {
    const payload = buildLibraryPayload(
      getFinalResult() as Record<string, unknown>,
      mode.type === 'insert' ? { sort_order: mode.sortOrder } : undefined,
    )
    return saveLibraryRow(payload, mode)
  }

  async function handleUpdate() {
    if (!selected) return
    setStatus('loading'); setResult(null); setErrorMsg('')
    try { setResult(await callAI('update', { existing: selected as unknown as Record<string, unknown> })); setStatus('preview') }
    catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Fehler'); setStatus('error') }
  }

  async function saveUpdate() {
    if (!selected || !result) return
    setStatus('saving')
    const { error, omitted } = await persistLibrary({ type: 'update', slug: selected.slug })
    if (error) { setErrorMsg(error); setStatus('error'); return }
    setStatus('done'); setSavedMsg(`${editedName} aktualisiert.${saveSuccessHint(omitted)}`)
    const fresh = await getAllPeptides(); setPeptides(fresh)
    const updated = fresh.find(p => p.slug === selected.slug); if (updated) setSelected(updated)
    setTimeout(() => { setStatus('idle'); setResult(null) }, 3000)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setStatus('loading'); setResult(null); setErrorMsg('')
    try { setResult(await callAI('create', { name: newName.trim() })); setStatus('preview') }
    catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Fehler'); setStatus('error') }
  }

  async function saveNew() {
    if (!result) return
    setStatus('saving')
    const { error, omitted } = await persistLibrary({ type: 'insert', sortOrder: peptides.length + 1 })
    if (error) { setErrorMsg(error); setStatus('error'); return }
    setStatus('done'); setSavedMsg(`${editedName} zur Bibliothek hinzugefügt.${saveSuccessHint(omitted)}`); setNewName('')
    setPeptides(await getAllPeptides())
    setTimeout(() => { setStatus('idle'); setResult(null) }, 3000)
  }

  const isLoading   = status === 'loading' || status === 'saving'
  const isSaving    = status === 'saving'
  const showPreview = (status === 'preview' || status === 'saving') && result !== null

  // ── Guard renders ────────────────────────────────────────────────────────
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={22} className="animate-spin text-sky-400" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto pt-16 flex flex-col items-center gap-5 text-center">
        <AlertTriangle size={28} strokeWidth={1.5} className="text-[var(--lg-text-3)]" />
        <h1 className="text-xl font-medium text-[var(--lg-text)]">Kein Zugriff</h1>
        <p className="text-sm text-slate-500">Du benötigst Admin-Rechte um diesen Bereich zu nutzen.</p>
        <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={14} /> Zurück
        </button>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto pb-12">

      {/* Header */}
      <button type="button" onClick={() => navigate('/lab/peptipedia')}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4">
        <ArrowLeft size={16} strokeWidth={1.5} />
        <span>Bibliothek</span>
      </button>

      <h1 className="mb-1 text-2xl font-medium text-[var(--lg-text)]">
        Admin-Panel
      </h1>
      <p className="text-xs text-slate-500 mb-6">
        KI-Bibliothek und pharmakokinetische Profile. Änderungen sind sofort live.
      </p>

      <div className="flex items-start gap-2 rounded-xl bg-[var(--lg-fill)] px-4 py-3 mb-6">
        <AlertTriangle size={16} strokeWidth={1.5} className="text-[var(--lg-text-3)] shrink-0" />
        <p className="text-xs text-[var(--lg-text-2)] leading-relaxed">
          KI-Funktionen laufen über Vercel. Lokal: <code className="font-mono">vercel dev</code> statt <code className="font-mono">npm run dev</code>.
        </p>
      </div>

      {/* Meldungen zu öffentlichen Erfahrungen */}
      <ModerationQueue />

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-[var(--lg-fill)] p-1 mb-6">
        {([
          { id: 'update', icon: RefreshCw, label: 'Aktualisieren' },
          { id: 'create', icon: Plus,      label: 'Hinzufügen' },
          { id: 'pk',     icon: Activity,  label: 'Blutspiegel-Profile' },
        ] as const).map(t => (
          <button key={t.id} type="button"
            onClick={() => { setTab(t.id); setResult(null); setStatus('idle') }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors duration-200 ${
              tab === t.id ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)]' : 'text-[var(--lg-text-2)] hover:text-[var(--lg-text)]'
            }`}
          >
            <t.icon size={16} strokeWidth={1.5} />{t.label}
          </button>
        ))}
      </div>

      {/* ── UPDATE TAB ──────────────────────────────────────────────────────── */}
      {tab === 'update' && (
        <div className="space-y-4">
          <div className="lg-surface lg-flat !rounded-2xl p-5">
            <p className="text-[13px] text-[var(--lg-text-3)] mb-3">Peptid wählen</p>
            <select value={selected?.slug ?? ''} onChange={e => setSelected(peptides.find(p => p.slug === e.target.value) ?? null)}
              disabled={isLoading} className={`${inp} mb-4`}>
              {peptides.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
            {selected && (
              <div className="text-xs text-slate-500 space-y-1 mb-4">
                <p>Kategorie: <span className="text-slate-400">{t(CATEGORY_LABEL_KEYS[selected.category])}</span></p>
                <p>Status: <span className="text-slate-400">{t(STATUS_LABEL_KEYS[selected.research_status])}</span></p>
                <p>Evidence Score: <span className="text-slate-400">{selected.evidence_score}/10</span></p>
              </div>
            )}
            <button type="button" onClick={handleUpdate} disabled={isLoading} {...denyProps(!isLoading && !selected, 'Wähle zuerst eine Substanz aus.')}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {status === 'loading' ? <><Loader2 size={14} className="animate-spin" /> KI analysiert…</> : <>KI-Update starten</>}
            </button>
          </div>
        </div>
      )}

      {/* ── CREATE TAB ──────────────────────────────────────────────────────── */}
      {tab === 'create' && (
        <div className="lg-surface lg-flat !rounded-2xl p-5">
          <p className="text-[13px] text-[var(--lg-text-3)] mb-3">Neue Substanz</p>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleCreate() }} disabled={isLoading}
            placeholder="z.B. Hexarelin, PT-141, Melanotan II…" className={`${inp} mb-4`} />
          <button type="button" onClick={() => void handleCreate()} disabled={isLoading} {...denyProps(!isLoading && !newName.trim())}
            className="btn-primary w-full flex items-center justify-center gap-2">
            {status === 'loading' ? <><Loader2 size={14} className="animate-spin" /> KI generiert Profil…</> : <>Profil generieren</>}
          </button>
        </div>
      )}

      {/* ── PK TAB ──────────────────────────────────────────────────────────── */}
      {tab === 'pk' && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">{pkProfiles.length} Profile</p>
            <button type="button" onClick={() => setShowPkForm(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--lg-accent-text)] transition-colors">
              {showPkForm ? <X size={13} /> : <Plus size={13} />}
              {showPkForm ? 'Abbrechen' : 'Neu hinzufügen'}
            </button>
          </div>

          {/* Inline form */}
          {showPkForm && (
            <div className="lg-surface lg-flat !rounded-2xl p-5 space-y-3">
              <p className="text-[13px] text-[var(--lg-text-3)] mb-1">Neues PK-Profil</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[13px] text-[var(--lg-text-3)] block mb-1">Name *</label>
                  <input value={pkName} onChange={e => setPkName(e.target.value)} placeholder="z.B. BPC-157" className={inp} />
                </div>
                <div className="col-span-2">
                  <label className="text-[13px] text-[var(--lg-text-3)] block mb-1">Aliases (kommagetrennt)</label>
                  <input value={pkAliases} onChange={e => setPkAliases(e.target.value)} placeholder="BPC157, Booly Protection Compound..." className={inp} />
                </div>
                <div>
                  <label className="text-[13px] text-[var(--lg-text-3)] block mb-1">Halbwertzeit (h) *</label>
                  <input type="number" value={pkHalfLife} onChange={e => setPkHalfLife(e.target.value)} placeholder="4.5" className={inp} />
                </div>
                <div>
                  <label className="text-[13px] text-[var(--lg-text-3)] block mb-1">Tmax (h) *</label>
                  <input type="number" value={pkTmax} onChange={e => setPkTmax(e.target.value)} placeholder="1.5" className={inp} />
                </div>
                <div>
                  <label className="text-[13px] text-[var(--lg-text-3)] block mb-1">Bioverfügbarkeit SC (0–1)</label>
                  <input type="number" step="0.05" min="0" max="1" value={pkBioavail} onChange={e => setPkBioavail(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="text-[13px] text-[var(--lg-text-3)] block mb-1">Vd (L/kg)</label>
                  <input type="number" step="0.1" value={pkVd} onChange={e => setPkVd(e.target.value)} className={inp} />
                </div>
                <div className="col-span-2">
                  <label className="text-[13px] text-[var(--lg-text-3)] block mb-1">Kategorie</label>
                  <select value={pkCategory} onChange={e => setPkCategory(e.target.value)} className={inp}>
                    {PK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[13px] text-[var(--lg-text-3)] block mb-1">Notizen</label>
                  <textarea value={pkNotes} onChange={e => setPkNotes(e.target.value)} rows={2}
                    placeholder="Quellen, Besonderheiten…"
                    className="w-full bg-[var(--surface-input)] border border-[var(--lg-hair)] rounded-xl px-4 py-2 text-sm text-[var(--lg-text)] placeholder:text-[var(--lg-text-3)] outline-none focus:border-[var(--accent-border)] transition-colors resize-none" />
                </div>
              </div>

              <button type="button" onClick={() => void savePkProfile()}
                disabled={pkSaving}
                {...denyProps(!pkSaving && (!pkName.trim() || !pkHalfLife || !pkTmax))}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                {pkSaving ? <><Loader2 size={14} className="animate-spin" /> Speichern…</> : <><Save size={16} strokeWidth={1.5} /> PK-Profil speichern</>}
              </button>
            </div>
          )}

          {/* Table */}
          {pkLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-sky-400" /></div>
          ) : pkProfiles.length === 0 ? (
            <div className="lg-surface lg-flat !rounded-2xl p-8 text-center">
              <p className="text-sm text-slate-500">Noch keine PK-Profile. Füge dein erstes hinzu.</p>
            </div>
          ) : (
            <div className="lg-surface lg-flat !rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 border-b border-[var(--lg-hair)]">
                {['Name', 'T½ (h)', 'Tmax (h)', 'Kat.', ''].map((h, i) => (
                  <span key={i} className="text-xs text-[var(--lg-text-3)]">{h}</span>
                ))}
              </div>
              {pkProfiles.map((pk, i) => (
                <div key={pk.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-4 py-3 ${i < pkProfiles.length - 1 ? 'border-b border-[var(--lg-hair)]' : ''}`}>
                  <div>
                    <p className="text-sm font-medium text-[var(--lg-text)]">{pk.name}</p>
                    {pk.aliases.length > 0 && (
                      <p className="text-xs text-[var(--lg-text-3)] truncate">{pk.aliases.join(', ')}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums">{pk.half_life_hours}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{pk.tmax_hours}</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--lg-fill)] text-[var(--lg-text-2)] whitespace-nowrap">
                    {pk.category}
                  </span>
                  <button type="button" onClick={() => void deletePkProfile(pk.id, pk.name)}
                    className="text-[var(--lg-text-3)] hover:text-[var(--lg-bad-text)] transition-colors p-1">
                    <Trash2 size={16} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ERROR ───────────────────────────────────────────────────────────── */}
      {status === 'error' && (
        <div className="mt-4 lg-surface lg-flat !rounded-2xl p-4 flex gap-3" data-tone="bad">
          <X size={16} strokeWidth={1.5} className="text-[var(--lg-bad-text)] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-[var(--lg-bad-text)] font-medium mb-1">Fehler</p>
            <p className="text-xs text-[var(--lg-text-2)]">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* ── SUCCESS ─────────────────────────────────────────────────────────── */}
      {status === 'done' && (
        <div className="mt-4 lg-surface lg-flat !rounded-2xl p-4 flex gap-3">
          <CheckCircle size={16} strokeWidth={1.5} className="text-[var(--lg-good-text)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--lg-text)]">{savedMsg}</p>
        </div>
      )}

      {/* ── PREVIEW ─────────────────────────────────────────────────────────── */}
      {showPreview && result && (
        <div className="mt-6 lg-surface lg-flat !rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--lg-hair)]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] text-[var(--lg-text-3)]">KI-Vorschau — vor dem Speichern bearbeiten</p>
              <button type="button" onClick={() => { setResult(null); setStatus('idle') }}
                className="text-[var(--lg-text-3)] hover:text-[var(--lg-text-2)] transition-colors"><X size={16} strokeWidth={1.5} /></button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-[13px] text-[var(--lg-text-3)] block mb-1">Name (editierbar)</label>
                <input value={editedName} onChange={e => {
                  setEditedName(e.target.value)
                  setEditedSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
                }} className="w-full bg-[var(--surface-input)] border border-[var(--lg-hair)] rounded-lg px-3 py-2 text-sm font-medium text-[var(--lg-text)] outline-none focus:border-[var(--accent-border)] transition-colors" />
              </div>
              <div>
                <label className="text-[13px] text-[var(--lg-text-3)] block mb-1">Slug (URL)</label>
                <input value={editedSlug} onChange={e => setEditedSlug(e.target.value)}
                  className="w-full bg-[var(--surface-input)] border border-[var(--lg-hair)] rounded-lg px-3 py-2 font-mono text-xs text-[var(--lg-text-2)] outline-none focus:border-[var(--accent-border)] transition-colors" />
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-b border-[var(--lg-hair)]"><EvidencePreview result={result} /></div>
          {Array.isArray(result.tags) && result.tags.length > 0 && (
            <div className="px-5 py-3 border-b border-[var(--lg-hair)]">
              <p className="text-[13px] text-[var(--lg-text-3)] mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {(result.tags as string[]).map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-[var(--lg-fill)] text-[var(--lg-text-2)]">{tag}</span>
                ))}
              </div>
            </div>
          )}
          <div className="px-5 py-4 space-y-3 max-h-[35vh] overflow-y-auto">
            <PreviewField label="TLDR"             value={result.tldr} />
            <PreviewField label="Mechanismus"      value={result.mechanism} />
            <PreviewField label="Forschungsbereiche" value={result.benefits} />
            <PreviewField label="Dosierungen"      value={result.research_dosage} />
            <PreviewField label="Halbwertszeit"    value={result.half_life} />
            <PreviewField label="Nebenwirkungen"   value={result.side_effects} />
            <PreviewField label="Wissenslücken"    value={result.research_gaps} />
          </div>
          <div className="px-5 py-4 border-t border-[var(--lg-hair)] flex gap-3">
            <button type="button" onClick={() => { setResult(null); setStatus('idle') }} className="btn-secondary flex-1 text-sm">Verwerfen</button>
            <button type="button" onClick={tab === 'update' ? () => void saveUpdate() : () => void saveNew()}
              disabled={isSaving} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
              {isSaving ? <><Loader2 size={14} className="animate-spin" /> Speichern…</> : <><Save size={16} strokeWidth={1.5} /> In Bibliothek speichern</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
