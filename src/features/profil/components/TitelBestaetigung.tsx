import { useEffect, useId, useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { PERSONAL_TITLE_SOURCE, titleName, type PersonalTitleId } from '../lib/titles'
import type { Visibility } from '../lib/profileVisibility'

/**
 * Bestätigung vor dem ersten Tragen eines persönlichen Titels (Spec Titel 3.3):
 * sagt, was der Titel verrät, dass es ein Gesundheitsdatum ist und wie weit er
 * höchstens sichtbar ist (Stufe des Quellfelds). „Trotzdem tragen“ ist die
 * Einwilligung nach Art. 9 Abs. 2 a DSGVO; Escape und der Hintergrund brechen ab.
 */
export function TitelBestaetigung({ id, sourceVisibility, onConfirm, onCancel }: {
  id: PersonalTitleId
  /** Stufe des Quellfelds (Deckel für den Titel). */
  sourceVisibility: Visibility
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n?.resolvedLanguage ?? i18n?.language ?? 'de'
  const titelId = `bestaetigen-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const abbrechen = useRef<HTMLButtonElement>(null)
  const name = titleName(id, lang) ?? ''

  // Fokus auf „Abbrechen“: Bestätigen soll ein bewusster Tipp sein
  useEffect(() => { abbrechen.current?.focus({ preventScroll: true }) }, [])

  return (
    <div
      data-app-modal
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-6"
      onClick={event => { event.stopPropagation(); onCancel() }}
      onKeyDown={event => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titelId}
        aria-describedby={`${titelId}-text`}
        className="lg-sheet grid w-full max-w-[340px] gap-2.5 rounded-[22px] px-5 py-5"
        onClick={event => event.stopPropagation()}
        data-title-consent={id}
      >
        <h2 id={titelId} className="text-[17px] font-semibold text-[var(--lg-text)]">{t('titel_bestaetigen_titel', { name })}</h2>
        <p id={`${titelId}-text`} className="text-[14px] leading-snug text-[var(--lg-text-2)]">
          <Trans
            i18nKey="titel_bestaetigen_text"
            values={{
              was: t(`titel_verraet_${id}`),
              feld: t(`profil_feld_${PERSONAL_TITLE_SOURCE[id]}`),
              stufe: t(`profil_stufe_${sourceVisibility}`),
            }}
            components={{ b: <b className="font-semibold text-[var(--lg-text)]" /> }}
          />
        </p>
        <p className="text-[13px] leading-snug text-[var(--lg-text-3)]">{t('titel_bestaetigen_widerruf')}</p>
        <div className="mt-1 grid gap-2">
          <button type="button" className="lg-btn lg-btn-primary !min-h-11" onClick={onConfirm} data-title-consent-ok>
            {t('titel_trotzdem_tragen')}
          </button>
          <button ref={abbrechen} type="button" className="lg-gray-btn !min-h-11" onClick={onCancel} data-title-consent-cancel>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
