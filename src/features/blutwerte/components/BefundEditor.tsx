import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { markerName } from '../lib/markerCatalog.en'
import toast from 'react-hot-toast'
import { FUNKTIONS_REGION, supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import type { BloodworkEntry, BloodworkReport } from '../types'
import { MAX_UPLOAD_BYTES, prepareFile } from '../lib/imageResize'
import { parseExtractResult, type ExtractResult } from '../lib/extractResult'
import { CATALOG_MARKER_NAMES, normalizeMarker } from '../lib/markerCatalog'
import { mergeIncoming, markerKey, type MergeConflict, type MergeItem } from '../lib/mergeRows'
import { toNumber } from '../lib/bloodwork'
import { formatDisplayDate, formatNumber } from '../lib/format'
import { MUTED, TEXT } from '../styles'
import { ReviewTable, type ReviewRow } from './import/ReviewTable'
import { ConflictResolver } from './import/ConflictResolver'
import { EINWILLIGUNG_FEHLT } from '../lib/aiConsent'
import { beschreibeExtraktionsFehler } from '../lib/extractError'
import { KiEinwilligung } from './KiEinwilligung'
import { useKiEinwilligung } from './useKiEinwilligung'
import { Sheet } from '../../compliance/components/Sheet'
import { SheetGriff } from '../../../components/ui/SheetGriff'

interface Props {
  report: BloodworkReport
  /** Bereits gespeicherte Werte dieses Befunds. */
  entries: BloodworkEntry[]
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

const entryToMergeItem = (entry: BloodworkEntry): MergeItem => ({
  marker: entry.marker,
  value: toNumber(entry.value),
  unit: entry.unit,
  ref_min: entry.ref_min,
  ref_max: entry.ref_max,
})

const toReviewRow = (item: MergeItem): ReviewRow => ({
  ...item,
  matched: normalizeMarker(item.marker) != null,
  selected: true,
})

export function BefundEditor({ report, entries, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  const [pending, setPending] = useState<ReviewRow[]>([])
  const [conflicts, setConflicts] = useState<MergeConflict[]>([])
  const [replacements, setReplacements] = useState<Record<string, MergeItem>>({})
  const [rescanning, setRescanning] = useState(false)
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  // Vor dem ersten Scan: ausdrueckliche Einwilligung in die KI-Auswertung.
  const { einwilligung, fehler: einwilligungFehler, setze: setzeEinwilligung, vergessen: vergessenEinwilligung, neuLaden: einwilligungNeuLaden } = useKiEinwilligung()
  const [einwilligungOffen, setEinwilligungOffen] = useState(false)

  const savedKeyToEntry = new Map<string, BloodworkEntry>()
  entries.forEach(entry => savedKeyToEntry.set(markerKey(entry.marker), entry))

  /** Ruft die Extraktion auf und gibt das validierte Ergebnis zurück (oder null bei Fehler). */
  const runExtraction = async (file: File): Promise<ExtractResult | null> => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t('bw_file_too_large'))
      return null
    }
    const prepared = await prepareFile(file)
    const { data, error, response } = await supabase.functions.invoke('bloodwork-extract', {
      region: FUNKTIONS_REGION,
      body: { file: prepared.base64, mimeType: prepared.mimeType, markerNames: CATALOG_MARKER_NAMES },
    })

    if (error) {
      const fehler = await beschreibeExtraktionsFehler(response)
      if (fehler.code === EINWILLIGUNG_FEHLT) {
        // Inzwischen widerrufen: neu fragen statt ins Leere scannen.
        vergessenEinwilligung()
        setEinwilligungOffen(true)
      } else {
        toast.error(t(fehler.schluessel))
      }
      return null
    }

    const result = parseExtractResult(data)
    if (!result || result.values.length === 0) {
      toast.error(t('bw_no_report_found'))
      return null
    }
    return result
  }

  const addManualRow = () => {
    setPending(current => [
      ...current,
      { marker: '', value: 0, unit: '', ref_min: null, ref_max: null, matched: false, selected: true },
    ])
  }

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

      const existingSet: MergeItem[] = [...entries.map(entryToMergeItem), ...pending.map(toMergeItem)]
      const { added, conflicts: newConflicts, duplicates } = mergeIncoming(existingSet, incoming)

      if (added.length > 0) setPending(current => [...current, ...added.map(toReviewRow)])
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

  const onRescanInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    void handleRescan(file)
  }

  const resolveConflicts = (replaceByKey: Record<string, boolean>) => {
    const newReplacements: Record<string, MergeItem> = {}
    conflicts.forEach(c => {
      if (!replaceByKey[c.key]) return
      const savedEntry = savedKeyToEntry.get(c.key)
      if (savedEntry) newReplacements[savedEntry.id] = c.incoming
    })
    if (Object.keys(newReplacements).length > 0) {
      setReplacements(current => ({ ...current, ...newReplacements }))
    }

    setPending(current =>
      current.map(row => {
        const key = markerKey(row.marker)
        const conflict = conflicts.find(c => c.key === key)
        if (conflict && replaceByKey[key] && !savedKeyToEntry.has(key)) {
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

  const validPending = pending.filter(r => r.selected && r.marker.trim() && Number.isFinite(r.value))
  const insertable = validPending.filter(r => !savedKeyToEntry.has(markerKey(r.marker)))

  const handleSave = async () => {
    if (!user) return

    const skipped = validPending.length - insertable.length
    if (skipped > 0) {
      toast.success(t('bw_skipped', { count: skipped }))
    }

    if (insertable.length === 0 && Object.keys(replacements).length === 0) {
      toast.error(t('bw_nothing_to_save'))
      return
    }

    setSaving(true)

    if (insertable.length > 0) {
      const payload = insertable.map(row => ({
        user_id: user.id,
        report_id: report.id,
        tested_at: report.tested_at,
        marker: row.marker.trim(),
        value: row.value,
        unit: row.unit.trim(),
        ref_min: row.ref_min,
        ref_max: row.ref_max,
        notes: null,
      }))
      const { error } = await supabase.from('bloodwork').insert(payload)
      if (error) {
        toast.error(t('bw_save_failed'))
        setSaving(false)
        return
      }
    }

    for (const [entryId, item] of Object.entries(replacements)) {
      const { error } = await supabase
        .from('bloodwork')
        .update({ value: item.value, unit: item.unit, ref_min: item.ref_min, ref_max: item.ref_max })
        .eq('id', entryId)
        .eq('user_id', user.id)
      if (error) {
        toast.error(t('bw_save_failed'))
        setSaving(false)
        return
      }
    }

    toast.success(t('bw_report_updated'))
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[var(--tyd-popup-top)]" data-app-modal onClick={onClose}>
      <div
        className="lg-sheet w-full max-w-lg px-5 pb-5 pt-2 space-y-4 overflow-y-auto overscroll-contain max-h-full"
        onClick={e => e.stopPropagation()}
      >
        <SheetGriff className="!mb-1" onClose={onClose} disabled={saving} />
        <h2 className="lg-title2" style={{ color: TEXT }}>
          {t('bw_editor_title', { date: formatDisplayDate(report.tested_at), lab: report.lab_name ? ` · ${report.lab_name}` : '' })}
        </h2>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: MUTED }}>
            {t('bw_already_saved', { count: entries.length })}
          </p>
          <div className="space-y-1.5">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <span style={{ color: MUTED }}>{markerName(entry.marker, sprache)}</span>
                <span style={{ color: MUTED }}>
                  {formatNumber(entry.value)} {entry.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: MUTED }}>
            {t('bw_new_values')}
          </p>
          <ReviewTable
            rows={pending}
            onChange={(index, row) => setPending(pending.map((r, i) => (i === index ? row : r)))}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={onRescanInputChange}
        />

        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={addManualRow} disabled={saving || rescanning}>
            {t('bw_add_manual')}
          </button>
          <button
            className="btn-secondary flex-1"
            data-befund-scan
            onClick={() => {
              if (einwilligungFehler) return einwilligungNeuLaden()
              if (einwilligung) fileInputRef.current?.click()
              else setEinwilligungOffen(true)
            }}
            disabled={saving || rescanning || (einwilligung === undefined && !einwilligungFehler)}
          >
            {rescanning ? t('bw_rescanning') : t('bw_scan_file')}
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button className="btn-secondary flex-1" data-app-back-close onClick={onClose} disabled={saving}>{t('cancel')}</button>
          <button className="btn-primary flex-1" onClick={handleSave} disabled={saving || rescanning}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      {einwilligungOffen && (
        <Sheet labelledBy="ai-consent-title" onClose={() => setEinwilligungOffen(false)} tall data-ai-consent-sheet>
          <KiEinwilligung
            onErteilt={async () => {
              await setzeEinwilligung(true)
              setEinwilligungOffen(false)
              // „Einwilligen und weiter": gleich die Dateiauswahl oeffnen. Blockt
              // der Browser das (keine Nutzergeste mehr), reicht ein zweiter Tipp.
              fileInputRef.current?.click()
            }}
            onAbbrechen={() => setEinwilligungOffen(false)}
          />
        </Sheet>
      )}

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
