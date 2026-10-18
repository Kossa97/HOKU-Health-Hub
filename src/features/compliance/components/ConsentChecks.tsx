import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Sheet } from './Sheet'
import { LegalDocument } from './LegalDocument'
import type { LegalPageKey } from '../legal/texts'
import type { ConsentState } from '../lib/consent'

/**
 * Drei Pflicht-Haekchen: 18+, Nutzungsbedingungen/Datenschutz und die
 * ausdrueckliche Einwilligung in die Verarbeitung von Gesundheitsdaten
 * (Art. 9 DSGVO verlangt sie gesondert). Die Rechtstexte oeffnen sich in
 * einem Sheet — so bleibt ein halb ausgefuelltes Formular erhalten.
 */
export function ConsentChecks({ value, onChange }: { value: ConsentState; onChange: (next: ConsentState) => void }) {
  const { t } = useTranslation()
  const [offen, setOffen] = useState<LegalPageKey | null>(null)
  const linkKlasse = 'font-semibold text-[var(--lg-accent-text)] underline underline-offset-2'
  const zeile = (key: keyof ConsentState, label: React.ReactNode) => (
    <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-[var(--lg-text)]">
      <input
        type="checkbox"
        data-consent={key}
        checked={value[key]}
        onChange={event => onChange({ ...value, [key]: event.target.checked })}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
        required
      />
      <span>{label}</span>
    </label>
  )

  return (
    <div className="flex flex-col gap-3" data-consent-checks>
      {zeile('alter', t('consent_age'))}
      {zeile('bedingungen', (
        <Trans
          i18nKey="consent_terms"
          components={{
            terms: <button type="button" className={linkKlasse} onClick={event => { event.preventDefault(); setOffen('nutzungsbedingungen') }} />,
            privacy: <button type="button" className={linkKlasse} onClick={event => { event.preventDefault(); setOffen('datenschutz') }} />,
          }}
        />
      ))}
      {zeile('gesundheit', t('consent_health'))}
      {offen && (
        <Sheet labelledBy="legal-sheet-title" onClose={() => setOffen(null)} tall data-legal-sheet>
          <LegalDocument page={offen} headingId="legal-sheet-title" />
          <button
            type="button"
            autoFocus
            data-app-back-close
            onClick={() => setOffen(null)}
            data-quiet
            className="lg-gray-btn mt-6 w-full !min-h-12 !text-[17px]"
          >
            {t('close')}
          </button>
        </Sheet>
      )}
    </div>
  )
}
