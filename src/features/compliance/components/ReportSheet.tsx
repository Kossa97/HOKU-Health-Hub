import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Flag } from 'lucide-react'
import { MELDEGRUENDE, type Meldegrund } from '../lib/moderation'
import { Sheet } from './Sheet'

/**
 * Eine oeffentliche Erfahrung oder ein Profil melden: Grund waehlen, optional
 * Details. Ohne Konto (Web-Seite, 2c) zusaetzlich eine freiwillige E-Mail fuer
 * Rueckfragen (`kontakt`) und ein Hinweis, wenn das Senden scheitert.
 */
export function ReportSheet({ titel, betreff, busy, onCancel, onSend, kontakt = false, hinweis }: {
  titel: string
  betreff: string
  busy: boolean
  onCancel: () => void
  onSend: (grund: Meldegrund, details: string, email: string) => void
  kontakt?: boolean
  /** Unter dem Formular, z. B. ein Fehler mit dem Weg ueber das Impressum. */
  hinweis?: ReactNode
}) {
  const { t } = useTranslation()
  const [grund, setGrund] = useState<Meldegrund | null>(null)
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState('')
  return (
    <Sheet labelledBy="report-title" busy={busy} onClose={onCancel} data-report-sheet>
      <form onSubmit={event => { event.preventDefault(); if (grund) onSend(grund, details, email.trim()) }}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--lg-warn)_18%,transparent)] text-[var(--lg-warn-text)]">
            <Flag size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="report-title" className="lg-title2">{titel}</h2>
            <p className="mt-0.5 truncate text-[15px] text-[var(--lg-text-2)]">{betreff}</p>
          </div>
        </div>
        <p className="mt-3 text-[15px] leading-snug text-[var(--lg-text-2)]">{t('report_desc')}</p>
        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="sr-only">{titel}</legend>
          {MELDEGRUENDE.map(key => (
            <label
              key={key}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm ${grund === key ? 'border-transparent bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--lg-text)]' : 'border-transparent bg-[var(--lg-fill)] text-[var(--lg-text)]'}`}
            >
              <input type="radio" name="report-reason" value={key} data-report-reason={key} checked={grund === key} onChange={() => setGrund(key)} className="accent-sky-500" />
              {t(`report_reason_${key}`)}
            </label>
          ))}
        </fieldset>
        <label className="mt-4 block text-[13px] font-medium text-[var(--lg-text-2)]" htmlFor="report-details">{t('report_details')}</label>
        <textarea
          id="report-details"
          data-report-details
          value={details}
          maxLength={1000}
          onChange={event => setDetails(event.target.value)}
          rows={3}
          className="input mt-1 w-full resize-none"
        />
        {kontakt && (
          <>
            <label className="mt-4 block text-[13px] font-medium text-[var(--lg-text-2)]" htmlFor="report-email">{t('report_email')}</label>
            <input
              id="report-email"
              data-report-email
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={254}
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="input mt-1 w-full"
            />
            <p className="mt-1.5 text-[12px] leading-snug text-[var(--lg-text-3)]">{t('report_email_hint')}</p>
          </>
        )}
        {hinweis && <div className="mt-4" data-report-hint>{hinweis}</div>}
        <div className="mt-5 flex gap-2">
          <button type="button" data-app-back-close disabled={busy} onClick={onCancel} data-quiet className="lg-gray-btn flex-1 !min-h-12 !text-[17px]">
            {t('cancel')}
          </button>
          <button type="submit" data-report-send disabled={busy || !grund} data-tone="bad" className="lg-gray-btn flex-1 !min-h-12 !text-[17px]">
            {busy ? t('report_sending') : t('report_send')}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
