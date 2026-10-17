/**
 * Geburtsdatum und biologisches Geschlecht — als Felder für sich, damit sie
 * später auch im Fragebogen beim Start stehen können. Heute: eine Karte im
 * Profil und ein Hinweis auf der Blutwerte-Seite, der sie in einem Sheet öffnet.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { CalendarHeart, X } from 'lucide-react'
import { GEBURTSDATUM_MIN, geburtsdatumGueltig, type BioProfile, type BioSex } from '../lib/bioProfile'
import { Sheet } from '../../compliance/components/Sheet'
import { useBioProfil } from './useBioProfil'
import { TEXT } from '../styles'

const heuteIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface FelderProps {
  value: BioProfile
  onChange: (next: BioProfile) => void
  /** Datum halb eingegeben (das Feld meldet dann ''): nicht speichern. */
  onUnvollstaendig?: (unvollstaendig: boolean) => void
  /** Eindeutiger Präfix für die Feld-IDs, falls die Felder zweimal auf einer Seite stehen. */
  idPrefix: string
  heute: string
  disabled?: boolean
}

/** Nur die Felder, ohne Laden und Speichern. */
export function BioProfilFelder({ value, onChange, onUnvollstaendig, idPrefix, heute, disabled }: FelderProps) {
  const { t } = useTranslation()
  const [unvollstaendig, setUnvollstaendig] = useState(false)
  const ungueltig = unvollstaendig || (!!value.birthDate && !geburtsdatumGueltig(value.birthDate, heute))
  const optionen: [BioSex | null, string][] = [
    [null, t('bw_bio_sex_none')],
    ['female', t('bw_bio_sex_female')],
    ['male', t('bw_bio_sex_male')],
  ]
  return (
    <div className="space-y-3" data-bio-fields>
      <div>
        <label className="label" htmlFor={`${idPrefix}-birth`}>{t('bw_bio_birth')}</label>
        <input
          id={`${idPrefix}-birth`}
          type="date"
          className="input"
          min={GEBURTSDATUM_MIN}
          max={heute}
          disabled={disabled}
          value={value.birthDate ?? ''}
          aria-invalid={ungueltig || undefined}
          aria-describedby={ungueltig ? `${idPrefix}-birth-error` : undefined}
          onChange={e => {
            const halb = !e.target.value && e.target.validity.badInput
            setUnvollstaendig(halb)
            onUnvollstaendig?.(halb)
            onChange({ ...value, birthDate: e.target.value || null })
          }}
          data-bio-birth
        />
        {ungueltig && <p id={`${idPrefix}-birth-error`} className="mt-1 text-xs text-[var(--lg-bad-text)]">{t('bw_bio_birth_invalid')}</p>}
      </div>
      <div>
        <p className="label" id={`${idPrefix}-sex-label`}>{t('bw_bio_sex')}</p>
        <div role="radiogroup" aria-labelledby={`${idPrefix}-sex-label`} className="flex rounded-full p-0.5" style={{ background: 'var(--lg-fill)' }} data-bio-sex>
          {optionen.map(([key, label]) => {
            const aktiv = value.sex === key
            return (
              <button
                key={key ?? 'none'}
                type="button"
                role="radio"
                aria-checked={aktiv}
                disabled={disabled}
                onClick={() => onChange({ ...value, sex: key })}
                className={`min-h-10 flex-1 whitespace-nowrap rounded-full px-1 text-[13px] transition-colors disabled:opacity-50 ${aktiv ? 'bg-[var(--lg-fill-selected)] font-semibold text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]' : 'font-semibold text-[var(--lg-text-2)]'}`}
                data-bio-sex-option={key ?? 'none'}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-xs text-[var(--lg-text-3)]">{t('bw_bio_sex_hint')}</p>
      </div>
    </div>
  )
}

/** Felder mit Speichern-Knopf, auf dem geladenen Stand. */
function BioProfilFormular({ start, speichern, idPrefix, onGespeichert, onBusy }: {
  start: BioProfile
  speichern: (next: BioProfile) => Promise<void>
  idPrefix: string
  onGespeichert?: () => void
  onBusy?: (busy: boolean) => void
}) {
  const { t } = useTranslation()
  const [heute] = useState(heuteIso)
  const [entwurf, setEntwurf] = useState<BioProfile>(start)
  const [busy, setBusyState] = useState(false)
  const setBusy = (b: boolean) => { setBusyState(b); onBusy?.(b) }
  const [unvollstaendig, setUnvollstaendig] = useState(false)
  const gueltig = !unvollstaendig && (!entwurf.birthDate || geburtsdatumGueltig(entwurf.birthDate, heute))
  const geaendert = entwurf.birthDate !== start.birthDate || entwurf.sex !== start.sex

  const absenden = async () => {
    if (!gueltig) return
    setBusy(true)
    try {
      await speichern(entwurf)
      toast.success(t('bw_bio_saved'))
      onGespeichert?.()
    } catch {
      toast.error(t('bw_bio_save_error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <BioProfilFelder value={entwurf} onChange={setEntwurf} onUnvollstaendig={setUnvollstaendig} idPrefix={idPrefix} heute={heute} disabled={busy} />
      <button
        type="button"
        className="lg-btn lg-btn-primary w-full disabled:opacity-40"
        disabled={busy || !gueltig || !geaendert}
        onClick={() => void absenden()}
        data-bio-save
      >
        {busy ? t('saving') : t('save')}
      </button>
    </div>
  )
}

/** Karte im Profil. */
export function BioProfilKarte() {
  const { t } = useTranslation()
  const { profil, fehler, erneut, speichern } = useBioProfil()
  return (
    <div className="card space-y-3 mb-4" data-bio-profile-card>
      <h2 className="flex items-center gap-2 font-semibold text-slate-300">
        <CalendarHeart size={16} className="text-sky-400" aria-hidden="true" /> {t('bw_bio_title')}
      </h2>
      <p className="text-sm text-slate-400">{t('bw_bio_desc')}</p>
      {profil
        // key: nach dem Speichern startet der Entwurf vom neuen Stand.
        ? <BioProfilFormular key={`${profil.birthDate}|${profil.sex}`} start={profil} speichern={speichern} idPrefix="profil-bio" />
        : fehler
          ? (
            <div data-bio-load-error>
              <p className="text-sm text-slate-400">{t('bw_bio_load_error')}</p>
              <button type="button" onClick={erneut} className="mt-1 min-h-11 text-sm font-semibold text-sky-400">{t('ai_consent_retry')}</button>
            </div>
          )
          : <p className="text-sm text-slate-500">{t('loading')}</p>}
    </div>
  )
}

/** Sheet mit den Feldern, etwa aus dem Hinweis auf der Blutwerte-Seite. */
export function BioProfilSheet({ start, speichern, onClose }: {
  start: BioProfile
  speichern: (next: BioProfile) => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation()
  // Waehrend des Speicherns nicht schliessbar: Ergebnis und Meldung gehoeren zum Sheet.
  const [busy, setBusy] = useState(false)
  return (
    <Sheet labelledBy="bio-sheet-title" busy={busy} onClose={onClose} data-bio-sheet>
      <div className="flex items-start justify-between gap-3">
        <h2 id="bio-sheet-title" className="lg-title2 pt-2">{t('bw_bio_title')}</h2>
        <button type="button" data-app-back-close disabled={busy} onClick={onClose} aria-label={t('close')} className="lg-icon-btn -mr-2 shrink-0 text-[var(--lg-text-2)]">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--lg-fill)]"><X size={17} aria-hidden="true" /></span>
        </button>
      </div>
      <p className="mt-1 mb-4 text-[15px] leading-snug text-[var(--lg-text-2)]">{t('bw_bio_desc')}</p>
      <BioProfilFormular start={start} speichern={speichern} idPrefix="sheet-bio" onGespeichert={onClose} onBusy={setBusy} />
    </Sheet>
  )
}

/** Hinweiskarte auf der Blutwerte-Seite, solange beides fehlt. */
export function BioProfilHinweis({ onOeffnen, onAusblenden }: { onOeffnen: () => void; onAusblenden: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="lg-surface mb-4 flex items-start gap-3 py-3.5 pl-4 pr-1.5" data-bio-hint>
      <span className="lg-icon-tile mt-0.5" style={{ background: '#0a84ff' }} aria-hidden="true">
        <CalendarHeart size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold" style={{ color: TEXT }}>{t('bw_bio_hint_title')}</p>
        <p className="mt-0.5 text-[13px] leading-snug" style={{ color: 'var(--lg-text-2)' }}>{t('bw_bio_hint_body')}</p>
        <button type="button" onClick={onOeffnen} className="mt-1 -mb-2 min-h-11 text-[15px] font-semibold text-[var(--lg-accent-text)]" data-bio-hint-open>
          {t('bw_bio_hint_action')}
        </button>
      </div>
      <button type="button" onClick={onAusblenden} aria-label={t('bw_bio_hint_dismiss')} title={t('bw_bio_hint_dismiss')} className="-mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ color: 'var(--lg-text-3)' }} data-bio-hint-dismiss>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
