import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { markerName } from '../lib/markerCatalog.en'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import { CATALOG_MARKER_NAMES, normalizeMarker } from '../lib/markerCatalog'
import { WECHSELJAHR_MARKER } from '../lib/referenzbereiche'
import { effectiveRange } from '../lib/bloodwork'
import type { BioProfile } from '../lib/bioProfile'
import { conversionHint } from '../lib/conversionHint'
import { formatEingabe, formatRange } from '../lib/format'
import { unitChoices } from '../lib/unitConversion'
import { CYAN, MUTED, TEXT } from '../styles'

export interface EntryDraft {
  /** Gesetzt, wenn ein bestehender Wert bearbeitet wird. */
  id?: string
  /** Wert aus einem Befund: das Datum gehoert dem Befund und bleibt fest. */
  reportId?: string | null
  /** Einheit beim Oeffnen. */
  originalUnit?: string
  /** Referenzbereich beim Oeffnen — aendert sich nur die Einheit, faellt er weg. */
  originalRef?: { min: string; max: string }
  tested_at: string
  marker: string
  /** Eigener Blutwert statt einem aus dem Katalog. */
  custom?: boolean
  value: string
  unit: string
  /** „Andere …" gewaehlt: Einheit als Freitext. */
  unitOther?: boolean
  /** Eigener Referenzbereich; leer heisst: Standardbereich des Katalogs. */
  refMin: string
  refMax: string
  /** Nur Oestradiol/LH/FSH bei Frauen: Wechseljahre zum Messzeitpunkt ('' = weiss nicht). */
  menopause?: '' | 'pre' | 'post'
}

export interface ParsedEntry {
  tested_at: string
  marker: string
  value: number
  unit: string
  ref_min: number | null
  ref_max: number | null
  /** Nur gesetzt, wenn gefragt wurde; sonst bleibt das Feld unberuehrt. */
  menopause?: 'pre' | 'post' | null
}

/** Uebliche Laboreinheiten als Vorschlag fuer eigene Blutwerte. */
const COMMON_UNITS = [
  'mg/dL', 'g/dL', 'g/L', 'mg/L', 'µg/L', 'ng/mL', 'ng/dL', 'pg/mL',
  'mmol/L', 'µmol/L', 'nmol/L', 'pmol/L', 'U/L', 'IU/L', 'mIU/mL', '%', '/nL',
]
const CUSTOM = '__eigener__'
const OTHER = '__andere__'

// eslint-disable-next-line react-refresh/only-export-components
export const emptyDraft = (marker = ''): EntryDraft => ({
  tested_at: format(new Date(), 'yyyy-MM-dd'),
  marker,
  value: '',
  unit: marker ? (normalizeMarker(marker)?.einheit ?? '') : '',
  refMin: '',
  refMax: '',
})

/** Leer → null, unlesbar → NaN. */
// eslint-disable-next-line react-refresh/only-export-components
export const parseNumber = (text: string): number | null => {
  const trimmed = text.trim()
  if (!trimmed) return null
  const value = Number(trimmed.replace(',', '.'))
  return Number.isFinite(value) ? value : Number.NaN
}

interface Props {
  draft: EntryDraft
  /** Marker ist fixiert, wenn das Modal aus der Detailansicht geöffnet wurde. */
  markerLocked: boolean
  saving: boolean
  onChange: (draft: EntryDraft) => void
  onCancel: () => void
  onSave: (parsed: ParsedEntry) => void
  /** Beim Bearbeiten: Wert loeschen (fragt danach noch einmal nach). */
  onDelete?: () => void
  /** Bei Oestradiol, LH, FSH nach den Wechseljahren fragen (im Profil: weiblich). */
  frageWechseljahre?: boolean
  /** Geschlecht/Alter: der Hinweis nennt den Bereich, der ohne Laborangabe tatsaechlich gilt. */
  profil?: BioProfile | null
}

export function EntryModal({ draft, markerLocked, saving, onChange, onCancel, onSave, onDelete, frageWechseljahre = false, profil }: Props) {
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  const def = draft.custom ? null : normalizeMarker(draft.marker)

  // Ein Bereich gehoert zu seinem Marker und seiner Einheit: beim Wechsel leeren.
  const setMarker = (value: string) => {
    const reset = { unitOther: false, refMin: '', refMax: '' }
    if (value === CUSTOM) {
      onChange({ ...draft, ...reset, custom: true, marker: '', unit: '' })
      return
    }
    onChange({ ...draft, ...reset, custom: false, marker: value, unit: normalizeMarker(value)?.einheit ?? '' })
  }

  // Einheit zum Auswaehlen: beim Katalog-Marker seine Einheiten (konventionell,
  // SI), bei eigenen Blutwerten die ueblichen; „Andere …" fuer alles Weitere.
  const unitOptions = def?.einheit
    ? unitChoices(def.name, def.einheit, draft.originalUnit ? [draft.originalUnit] : [])
    : COMMON_UNITS
  const unitIsOther = !!draft.unitOther || (draft.unit !== '' && !unitOptions.includes(draft.unit))
  // Was ohne eigenen Bereich gilt: Gruppe (Geschlecht, Alter, Wechseljahre) oder allgemein.
  const standard = def
    ? effectiveRange({ tested_at: draft.tested_at, menopause: draft.menopause || null, ref_min: null, ref_max: null }, def, profil)
    : null
  const katalogBereich = def && standard && standard.source !== 'none'
    ? formatRange(standard.min, standard.max, def.einheit)
    : null
  const wechseljahreFragen = frageWechseljahre && !!def && WECHSELJAHR_MARKER.has(def.name)

  const save = () => {
    const marker = draft.marker.trim()
    const unit = draft.unit.trim()
    const parsedValue = Number(draft.value.replace(',', '.'))
    const refMin = parseNumber(draft.refMin)
    const refMax = parseNumber(draft.refMax)

    if (!draft.tested_at) return toast.error(t('bw_err_date'))
    if (!marker) return toast.error(t('bw_err_marker'))
    if (!draft.value.trim() || !Number.isFinite(parsedValue)) return toast.error(t('bw_err_value'))
    if (!unit) return toast.error(t('bw_err_unit'))
    if (Number.isNaN(refMin) || Number.isNaN(refMax)) return toast.error(t('bw_err_ref_value'))
    if (refMin != null && refMax != null && refMin >= refMax) return toast.error(t('bw_err_ref'))

    onSave({
      tested_at: draft.tested_at, marker, value: parsedValue, unit, ref_min: refMin, ref_max: refMax,
      ...(wechseljahreFragen ? { menopause: draft.menopause || null } : {}),
    })
  }

  const hasLabRange = !!draft.originalRef && (draft.originalRef.min !== '' || draft.originalRef.max !== '')
  const refChanged = !!draft.originalRef && !sameRef(draft, draft.originalRef)

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-10"
      data-app-modal
      onClick={onCancel}
    >
      <div
        className="lg-sheet w-full max-w-lg px-5 pb-5 pt-2 space-y-4 overflow-y-auto overscroll-contain max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <span className="lg-grabber !mb-1" aria-hidden="true" />
        <h2 className="lg-title2" style={{ color: TEXT }}>{t(draft.id ? 'bw_edit_title' : 'bw_entry_title')}</h2>

        <div>
          <label className="label" htmlFor="bw-entry-marker">{t('bw_marker')}</label>
          {markerLocked ? (
            <div
              className="rounded-2xl px-4 py-3 font-semibold"
              style={{ background: 'var(--lg-fill)', color: 'var(--lg-accent-text)' }}
            >
              {markerName(draft.marker, sprache)}
            </div>
          ) : (
            <select
              id="bw-entry-marker"
              className="select"
              value={draft.custom ? CUSTOM : draft.marker}
              onChange={e => setMarker(e.target.value)}
            >
              <option value="">{t('bw_marker_choose')}</option>
              {CATALOG_MARKER_NAMES.map(marker => (
                <option key={marker} value={marker}>{markerName(marker, sprache)}</option>
              ))}
              <option value={CUSTOM}>{t('bw_marker_custom')}</option>
            </select>
          )}
          {draft.custom && !markerLocked && (
            <input
              className="input mt-2"
              aria-label={t('bw_marker_custom_name')}
              placeholder={t('bw_marker_custom_name')}
              maxLength={80}
              value={draft.marker}
              onChange={e => onChange({ ...draft, marker: e.target.value })}
            />
          )}
        </div>

        <div>
          <label className="label" htmlFor="bw-entry-date">{t('bw_date')}</label>
          <input
            id="bw-entry-date"
            className="input disabled:opacity-50 disabled:cursor-not-allowed"
            type="date"
            value={draft.tested_at}
            disabled={!!draft.reportId}
            aria-describedby={draft.reportId ? 'bw-date-from-report' : undefined}
            onChange={e => onChange({ ...draft, tested_at: e.target.value })}
          />
          {draft.reportId && (
            <p id="bw-date-from-report" className="text-xs mt-1.5" style={{ color: MUTED }}>{t('bw_date_from_report')}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="bw-entry-value">{t('bw_value')}</label>
            <input
              id="bw-entry-value"
              className="input"
              inputMode="decimal"
              placeholder="42,5"
              value={draft.value}
              onChange={e => onChange({ ...draft, value: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="bw-entry-unit">{t('bw_unit')}</label>
            <select
              id="bw-entry-unit"
              className="select"
              value={unitIsOther ? OTHER : draft.unit}
              onChange={e => onChange(e.target.value === OTHER
                ? { ...draft, unitOther: true, unit: '' }
                : { ...draft, unitOther: false, unit: e.target.value })}
            >
              {!draft.unit && <option value="">–</option>}
              {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              <option value={OTHER}>{t('bw_unit_other')}</option>
            </select>
          </div>
        </div>
        {unitIsOther && (
          <input
            className="input"
            aria-label={t('bw_unit')}
            placeholder="ng/mL"
            maxLength={30}
            value={draft.unit}
            onChange={e => onChange({ ...draft, unitOther: true, unit: e.target.value })}
          />
        )}

        {hasLabRange && draft.unit.trim() !== draft.originalUnit && !refChanged && (
          <p className="text-xs" style={{ color: MUTED }} data-bw-unit-drops-range>
            {t('bw_unit_drops_range', { unit: draft.originalUnit })}
          </p>
        )}

        {(() => {
          const hint = conversionHint(draft.marker, draft.unit, Number(draft.value.replace(',', '.')))
          return hint ? (
            <p className="text-xs" style={{ color: CYAN }}>
              {hint} <span style={{ color: MUTED }}>{t('bw_conversion_note')}</span>
            </p>
          ) : null
        })()}

        {wechseljahreFragen && (
          <fieldset data-bw-menopause>
            <legend className="label">{t('bw_menopause_label')}</legend>
            <div role="radiogroup" aria-label={t('bw_menopause_label')} className="flex rounded-full p-0.5" style={{ background: 'var(--lg-fill)' }}>
              {([['pre', 'bw_menopause_pre'], ['post', 'bw_menopause_post'], ['', 'bw_menopause_unknown']] as const).map(([key, label]) => {
                const aktiv = (draft.menopause ?? '') === key
                return (
                  <button
                    key={key || 'unknown'}
                    type="button"
                    role="radio"
                    aria-checked={aktiv}
                    onClick={() => onChange({ ...draft, menopause: key })}
                    className="min-h-10 flex-1 rounded-full px-2 text-sm transition-colors"
                    style={aktiv ? { background: 'var(--lg-fill-selected)', color: TEXT, fontWeight: 600, boxShadow: '0 3px 8px rgba(0,0,0,0.25)' } : { color: 'var(--lg-text-2)', fontWeight: 600 }}
                  >
                    {t(label)}
                  </button>
                )
              })}
            </div>
            <p className="text-xs mt-1.5" style={{ color: MUTED }}>{t('bw_menopause_hint')}</p>
          </fieldset>
        )}

        <fieldset>
          <legend className="label">{t('bw_ref_optional')}</legend>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              inputMode="decimal"
              aria-label={t('bw_ref_from')}
              placeholder={t('bw_ref_from')}
              value={draft.refMin}
              onChange={e => onChange({ ...draft, refMin: e.target.value })}
            />
            <input
              className="input"
              inputMode="decimal"
              aria-label={t('bw_ref_to')}
              placeholder={t('bw_ref_to')}
              value={draft.refMax}
              onChange={e => onChange({ ...draft, refMax: e.target.value })}
            />
          </div>
          {katalogBereich && !draft.refMin.trim() && !draft.refMax.trim() && (
            <p className="text-xs mt-1.5" style={{ color: MUTED }}>{t('bw_ref_default', { range: katalogBereich })}</p>
          )}
        </fieldset>

        <div className="flex gap-3 pt-2">
          <button className="btn-secondary flex-1" data-app-back-close onClick={onCancel}>{t('cancel')}</button>
          <button className="btn-primary flex-1" onClick={save} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
        {onDelete && (
          <button
            type="button"
            data-bw-entry-delete
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-[var(--lg-bad-text)]"
            disabled={saving}
            onClick={onDelete}
          >
            <Trash2 size={16} aria-hidden="true" />
            {t('bw_delete_entry')}
          </button>
        )}
      </div>
    </div>
  )
}

/** Gleicher Bereich wie beim Oeffnen — als Zahlen verglichen, nicht als Text. */
// eslint-disable-next-line react-refresh/only-export-components
export const sameRef = (draft: Pick<EntryDraft, 'refMin' | 'refMax'>, original: { min: string; max: string }): boolean =>
  Object.is(parseNumber(draft.refMin), parseNumber(original.min)) && Object.is(parseNumber(draft.refMax), parseNumber(original.max))

/** Referenzgrenze als Eingabetext. */
// eslint-disable-next-line react-refresh/only-export-components
export const refText = (value: number | null): string => (value == null ? '' : formatEingabe(value))
