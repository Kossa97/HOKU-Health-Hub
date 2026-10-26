import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import toast from 'react-hot-toast'
import { Download, FileUp } from 'lucide-react'
import type { TrainingData } from '../../hooks/useTrainingData'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import { detectFormat, parseWorkoutCsv, toCsv, type CsvFormat } from '../../lib/csvImport'
import { exerciseName, resolveExerciseName } from '../../lib/exerciseLookup'
import { formatDate } from '../../lib/format'
import type { WeightUnit } from '../../types'
import { Button, Card, Chip } from '../ui'
import {
  customExerciseDraft,
  ensureCustomExercises,
  exportFileName,
  replaceUnknownExercises,
  strongNeedsWeightUnit,
  summarizeImport,
} from './importPlan'
import { SectionHeading } from './parts'
import { hintStyle, noteStyle } from './styles'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const FORMAT_LABEL: Record<CsvFormat, string> = { hevy: 'Hevy', strong: 'Strong' }

interface LoadedFile {
  text: string
  format: CsvFormat
  needsUnit: boolean
}

/**
 * Datei speichern: auf Touch-Geraeten ueber das Teilen-Blatt (dort klappt
 * `a[download]` in der installierten App bzw. im WebView nicht), sonst als Download.
 */
async function saveFile(blob: Blob, name: string): Promise<void> {
  const file = typeof File === 'function' ? new File([blob], name, { type: blob.type }) : null
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  if (file && coarse && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: name })
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ImportSection({ data, onBusyChange }: { data: TrainingData; onBusyChange: (busy: boolean) => void }) {
  const { tt, locale } = useTrainingText()
  const inputRef = useRef<HTMLInputElement>(null)
  const createdRef = useRef(new Map<string, string>())
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [fileError, setFileError] = useState<TrainingTextKey | null>(null)
  const [strongUnit, setStrongUnit] = useState<WeightUnit>(data.settings.unit)
  const [importing, setImporting] = useState(false)

  const customExercises = data.customExercises
  const parsed = useMemo(() => {
    if (!file) return null
    return parseWorkoutCsv(file.text, {
      resolveExercise: name => resolveExerciseName(name, customExercises),
      weightUnit: strongUnit,
    })
  }, [file, strongUnit, customExercises])
  const preview = useMemo(() => (file && parsed ? summarizeImport(file.format, parsed) : null), [file, parsed])

  const plural = (one: TrainingTextKey, other: TrainingTextKey, count: number) =>
    tt(count === 1 ? one : other, { count })

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    // Zuruecksetzen, damit dieselbe Datei erneut gewaehlt werden kann.
    event.target.value = ''
    if (!picked) return
    setFile(null)
    createdRef.current = new Map()
    if (picked.size > MAX_FILE_BYTES) { setFileError('settings_import_too_large'); return }
    let text: string
    try {
      text = await picked.text()
    } catch {
      setFileError('settings_import_read_error')
      return
    }
    const format = detectFormat(text)
    if (!format) { setFileError('settings_import_unknown_format'); return }
    setFileError(null)
    setFile({ text, format, needsUnit: format === 'strong' && strongNeedsWeightUnit(text) })
  }

  async function confirmImport() {
    if (!parsed || !preview || importing) return
    setImporting(true)
    onBusyChange(true)
    try {
      const sessions = parsed.sessions
      const idByName = await ensureCustomExercises(
        preview.unknownExercises,
        createdRef.current,
        name => data.addCustomExercise(customExerciseDraft(name, sessions)),
      )
      const count = await data.importSessions(replaceUnknownExercises(sessions, idByName))
      toast.success(plural('settings_import_done_one', 'settings_import_done', count))
      setFile(null)
      createdRef.current = new Map()
    } catch {
      toast.error(tt('settings_import_error'))
    } finally {
      setImporting(false)
      onBusyChange(false)
    }
  }

  const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

  return (
    <section aria-labelledby="training-settings-import">
      <SectionHeading id="training-settings-import">{tt('settings_section_import')}</SectionHeading>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={hintStyle}>{tt('settings_import_hint')}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          data-testid="training-import-file"
          style={{ display: 'none' }}
        />
        {!file && (
          <Button tone="ghost" block onClick={() => inputRef.current?.click()}>
            <FileUp size={18} aria-hidden="true" />
            {tt('settings_import_choose')}
          </Button>
        )}
        {fileError && <p role="alert" style={noteStyle}>{tt(fileError)}</p>}

        {file && preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontWeight: 600 }}>{tt('settings_import_detected', { format: FORMAT_LABEL[file.format] })}</p>

            {file.needsUnit && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="label" style={{ marginBottom: 0 }}>{tt('settings_import_strong_unit')}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Chip active={strongUnit === 'kg'} onClick={() => setStrongUnit('kg')}>kg</Chip>
                  <Chip active={strongUnit === 'lb'} onClick={() => setStrongUnit('lb')}>lbs</Chip>
                </div>
              </div>
            )}

            {preview.sessionCount === 0 ? (
              <p style={noteStyle}>{tt('settings_import_empty')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {plural('settings_import_sessions_one', 'settings_import_sessions', preview.sessionCount)}
                </p>
                {preview.firstAt && preview.lastAt && (
                  <p style={hintStyle}>
                    {tt('settings_import_range', {
                      from: formatDate(preview.firstAt, locale, dateOptions),
                      to: formatDate(preview.lastAt, locale, dateOptions),
                    })}
                  </p>
                )}
              </div>
            )}

            {preview.unknownExercises.length > 0 && (
              <div>
                <p style={hintStyle}>
                  {plural('settings_import_unknown_one', 'settings_import_unknown', preview.unknownExercises.length)}
                </p>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--lg-text)', overflowWrap: 'anywhere' }}>
                  {preview.unknownExercises.map(name => <li key={name}>{name}</li>)}
                </ul>
              </div>
            )}

            {preview.issueCount > 0 && (
              <p style={hintStyle}>{plural('settings_import_issues_one', 'settings_import_issues', preview.issueCount)}</p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <Button tone="ghost" onClick={() => setFile(null)} disabled={importing} style={{ flex: 1 }}>
                {tt('settings_import_discard')}
              </Button>
              <Button onClick={confirmImport} disabled={importing || preview.sessionCount === 0} style={{ flex: 2 }}>
                {importing ? tt('settings_import_running') : tt('settings_import_confirm')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  )
}

export function ExportSection({ data }: { data: TrainingData }) {
  const { tt } = useTrainingText()
  const [exporting, setExporting] = useState(false)
  const empty = data.sessions.length === 0

  async function exportCsv() {
    if (empty || exporting) return
    setExporting(true)
    try {
      const oldestFirst = [...data.sessions].reverse()
      // Englische Namen wie bei Hevy und Strong: so lesen auch andere Apps die Datei.
      const csv = toCsv(oldestFirst, id => exerciseName(id, 'en', data.customExercises))
      // BOM, damit Excel Umlaute richtig anzeigt; der eigene Import entfernt es wieder.
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
      await saveFile(blob, exportFileName())
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error(tt('settings_export_error'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <section aria-labelledby="training-settings-export">
      <SectionHeading id="training-settings-export">{tt('settings_section_export')}</SectionHeading>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={hintStyle}>{tt('settings_export_hint')}</p>
        <Button tone="ghost" block onClick={exportCsv} disabled={empty || exporting}>
          <Download size={18} aria-hidden="true" />
          {tt('settings_export_button')}
        </Button>
        {empty && <p style={hintStyle}>{tt('settings_export_empty')}</p>}
      </Card>
    </section>
  )
}
