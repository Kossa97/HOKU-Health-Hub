import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../context/AuthContext'
import { MAX_UPLOAD_BYTES, prepareFile } from '../../lib/imageResize'
import { parseExtractResult, type ExtractResult } from '../../lib/extractResult'
import { CATALOG_MARKER_NAMES, normalizeMarker } from '../../lib/markerCatalog'
import { mergeIncoming, markerKey, type MergeConflict, type MergeItem } from '../../lib/mergeRows'
import { formatDisplayDate } from '../../lib/format'
import { CYAN, MUTED, TEXT } from '../../styles'
import { ReviewTable, type ReviewRow } from './ReviewTable'
import { ConflictResolver } from './ConflictResolver'
import { EINWILLIGUNG_FEHLT } from '../../lib/aiConsent'
import { beschreibeExtraktionsFehler } from '../../lib/extractError'
import { KiEinwilligung } from '../KiEinwilligung'
import { useKiEinwilligung } from '../useKiEinwilligung'

type Phase = 'idle' | 'extracting' | 'review' | 'saving'

interface Props {
  /** Aus dem „+"-Blatt: nur Foto oder nur Dokument anbieten. Ohne: beides. */
  mode?: 'photo' | 'document'
  onClose: () => void
  onSaved: () => void
}

const toMergeItem = (row: ReviewRow): MergeItem => ({
  marker: row.marker,
  value: row.value,
  unit: row.unit,
  ref_min: row.ref_min,
  ref_max: row.ref_max,
})

const toReviewRow = (item: MergeItem): ReviewRow => ({
  ...item,
  matched: normalizeMarker(item.marker) != null,
  selected: true,
})

export function ImportFlow({ mode, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('idle')
  const [rescanning, setRescanning] = useState(false)
  const [testedAt, setTestedAt] = useState('')
  const [labName, setLabName] = useState('')
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [conflicts, setConflicts] = useState<MergeConflict[]>([])

  const photoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rescanInputRef = useRef<HTMLInputElement>(null)
  // Ohne ausdrueckliche Einwilligung geht keine Datei an den KI-Dienst.
  const { einwilligung, fehler: einwilligungFehler, setze: setzeEinwilligung, vergessen: vergessenEinwilligung, neuLaden: einwilligungNeuLaden } = useKiEinwilligung()

  /** Ruft die Extraktion auf und gibt das validierte Ergebnis zurück (oder null bei Fehler). */
  const runExtraction = async (file: File): Promise<ExtractResult | null> => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t('bw_file_too_large'))
      return null
    }
    const prepared = await prepareFile(file)
    const { data, error, response } = await supabase.functions.invoke('bloodwork-extract', {
      body: { file: prepared.base64, mimeType: prepared.mimeType, markerNames: CATALOG_MARKER_NAMES },
    })

    if (error) {
      const fehler = await beschreibeExtraktionsFehler(response)
      if (fehler.code === EINWILLIGUNG_FEHLT) {
        // Inzwischen widerrufen (etwa auf einem anderen Geraet): neu fragen.
        vergessenEinwilligung()
      }
      toast.error(t(fehler.schluessel))
      return null
    }

    const result = parseExtractResult(data)
    if (!result || result.values.length === 0) {
      toast.error(t('bw_no_report_found'))
      return null
    }
    return result
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setPhase('extracting')
    try {
      const result = await runExtraction(file)
      if (!result) {
        setPhase('idle')
        return
      }
      setTestedAt(result.tested_at)
      setLabName(result.lab_name ?? '')
      setRows(result.values.map(v => ({ ...v, selected: true })))
      setPhase('review')
    } catch {
      toast.error(t('bw_file_error'))
      setPhase('idle')
    }
  }

  /** Zweite (oder weitere) Datei in den bestehenden Review mergen — ohne Dubletten. */
  const handleRescan = async (file: File | undefined) => {
    if (!file) return
    setRescanning(true)
    try {
      const result = await runExtraction(file)
      if (!result) return

      const incoming: MergeItem[] = result.values.map(v => ({
        marker: v.marker,
        value: v.value,
        unit: v.unit,
        ref_min: v.ref_min,
        ref_max: v.ref_max,
      }))
      const { added, conflicts: newConflicts, duplicates } = mergeIncoming(rows.map(toMergeItem), incoming)

      if (added.length > 0) setRows(current => [...current, ...added.map(toReviewRow)])
      if (newConflicts.length > 0) setConflicts(newConflicts)

      const parts: string[] = []
      if (added.length > 0) parts.push(t('bw_rescan_added', { count: added.length }))
      if (duplicates > 0) parts.push(t('bw_rescan_dupes', { count: duplicates }))
      if (newConflicts.length > 0) parts.push(t('bw_rescan_conflicts', { count: newConflicts.length }))
      toast.success(parts.length > 0 ? parts.join(' · ') : t('bw_rescan_none'))
    } catch {
      toast.error(t('bw_file_error'))
    } finally {
      setRescanning(false)
    }
  }

  const resolveConflicts = (replaceByKey: Record<string, boolean>) => {
    setRows(current =>
      current.map(row => {
        const key = markerKey(row.marker)
        const conflict = conflicts.find(c => c.key === key)
        if (conflict && replaceByKey[key]) {
          return {
            ...row,
            value: conflict.incoming.value,
            unit: conflict.incoming.unit,
            ref_min: conflict.incoming.ref_min,
            ref_max: conflict.incoming.ref_max,
          }
        }
        return row
      }),
    )
    setConflicts([])
  }

  const onInitialInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    void handleFile(file)
  }

  const onRescanInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    void handleRescan(file)
  }

  const selected = rows.filter(r => r.selected && r.marker.trim() && Number.isFinite(r.value))

  const handleSave = async () => {
    if (!user) return

    if (selected.length === 0) {
      toast.error(t('bw_select_one'))
      return
    }
    if (!testedAt) {
      toast.error(t('bw_err_date'))
      return
    }

    setPhase('saving')

    const { data: report, error: reportError } = await supabase
      .from('bloodwork_reports')
      .insert({ user_id: user.id, tested_at: testedAt, lab_name: labName.trim() || null, source: 'import' })
      .select()
      .single()

    if (reportError || !report) {
      toast.error(t('bw_save_values_error'))
      setPhase('review')
      return
    }

    const payload = selected.map(row => ({
      user_id: user.id,
      report_id: report.id,
      tested_at: testedAt,
      marker: row.marker.trim(),
      value: row.value,
      unit: row.unit.trim(),
      ref_min: row.ref_min,
      ref_max: row.ref_max,
      notes: null,
    }))

    const { error: valuesError } = await supabase.from('bloodwork').insert(payload)

    if (valuesError) {
      // Ein Befund ohne Werte wäre ein verwaister Datensatz.
      await supabase.from('bloodwork_reports').delete().eq('id', report.id)
      toast.error(t('bw_save_values_error'))
      setPhase('review')
      return
    }

    toast.success(t('bw_values_saved', { count: selected.length }))
    onSaved()
    onClose()
  }

  const saving = phase === 'saving'

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[var(--tyd-popup-top)]" data-app-modal onClick={onClose}>
      <div
        className="lg-sheet w-full max-w-lg px-5 pb-5 pt-2 space-y-4 overflow-y-auto overscroll-contain max-h-full"
        onClick={e => e.stopPropagation()}
      >
        <span className="lg-grabber !mb-1" aria-hidden="true" />
        <h2 className="lg-title2" style={{ color: TEXT }}>{t('bw_import_title')}</h2>

        {phase === 'idle' && einwilligung === undefined && !einwilligungFehler && (
          <div className="py-10 text-center text-sm" style={{ color: MUTED }}>…</div>
        )}

        {phase === 'idle' && einwilligungFehler && (
          <div data-ai-consent-error className="flex flex-col items-center gap-3 py-6 text-center text-sm" style={{ color: MUTED }}>
            <p>{t('ai_consent_load_error')}</p>
            <button type="button" className="btn-secondary" onClick={einwilligungNeuLaden}>{t('ai_consent_retry')}</button>
          </div>
        )}

        {phase === 'idle' && einwilligung === null && (
          <KiEinwilligung onErteilt={() => setzeEinwilligung(true)} onAbbrechen={onClose} />
        )}

        {phase === 'idle' && einwilligung && (
          <>
            <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
              {t(mode === 'photo' ? 'bw_import_desc_photo' : mode === 'document' ? 'bw_import_desc_document' : 'bw_import_desc')}
            </p>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onInitialInputChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={onInitialInputChange}
            />

            <p data-ai-consent-note className="text-xs leading-relaxed" style={{ color: MUTED }}>{t('ai_consent_note')}</p>

            {mode === 'photo' ? (
              <button className="btn-primary w-full" onClick={() => photoInputRef.current?.click()}>{t('bw_take_photo')}</button>
            ) : mode === 'document' ? (
              <button className="btn-primary w-full" onClick={() => fileInputRef.current?.click()}>{t('bw_choose_document')}</button>
            ) : (
              <div className="flex gap-3">
                <button className="btn-secondary flex-1" onClick={() => fileInputRef.current?.click()}>{t('bw_file')}</button>
                <button className="btn-primary flex-1" onClick={() => photoInputRef.current?.click()}>{t('bw_photo')}</button>
              </div>
            )}
            <button className="btn-secondary w-full" data-app-back-close onClick={onClose}>{t('cancel')}</button>
          </>
        )}

        {phase === 'extracting' && (
          <div className="py-10 text-center font-semibold" style={{ color: CYAN }}>
            {t('bw_extracting')}
          </div>
        )}

        {(phase === 'review' || saving) && (
          <>
            <div>
              <label className="label">{t('bw_test_date')}</label>
              <input
                className="input"
                type="date"
                value={testedAt}
                onChange={e => setTestedAt(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t('bw_lab')}</label>
              <input
                className="input"
                placeholder={t('bw_optional')}
                value={labName}
                onChange={e => setLabName(e.target.value)}
              />
            </div>

            <ReviewTable
              rows={rows}
              onChange={(index, row) => setRows(rows.map((r, i) => (i === index ? row : r)))}
            />

            <input
              ref={rescanInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={onRescanInputChange}
            />
            <button
              className="btn-secondary w-full"
              onClick={() => rescanInputRef.current?.click()}
              disabled={saving || rescanning}
            >
              {rescanning ? t('bw_rescanning') : t('bw_rescan')}
            </button>

            <p className="text-xs" style={{ color: MUTED }}>
              {t('bw_saved_as', { date: testedAt ? formatDisplayDate(testedAt) : '–' })}
            </p>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" data-app-back-close onClick={onClose} disabled={saving}>{t('cancel')}</button>
              <button className="btn-primary flex-1" onClick={handleSave} disabled={saving || rescanning}>
                {saving ? t('saving') : t('bw_take_over', { count: selected.length })}
              </button>
            </div>
          </>
        )}
      </div>

      {conflicts.length > 0 && (
        <ConflictResolver
          conflicts={conflicts}
          onResolve={resolveConflicts}
          onCancel={() => setConflicts([])}
        />
      )}
    </div>
  )
}
