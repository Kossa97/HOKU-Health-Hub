/**
 * „Wer sieht was“: alle 30 Profilfelder nach Bereich, je Zeile ein
 * Dreier-Schalter (Ich / Freunde / Alle), je Bereich „Alle auf Ich“ und
 * „Alle auf Alle“. Bei privatem Profil gesperrt; die Stufen bleiben gespeichert.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GlassSegmented, type SegmentOption } from '../../../components/ui/GlassSegmented'
import { OWN_PLACEHOLDER_FIELDS } from '../lib/profileView'
import {
  PROFILE_SECTIONS, fieldsOfSection, visibilityOf,
  type ProfileField, type ProfileSection, type Visibility, type VisibilityMap,
} from '../lib/profileVisibility'

export function WerSiehtWas({ map, privat, onSetField, onSetSection }: {
  map: VisibilityMap
  privat: boolean
  onSetField: (field: ProfileField, v: Visibility) => void
  onSetSection: (section: ProfileSection, v: Visibility) => void
}) {
  const { t } = useTranslation()
  const optionen: SegmentOption<Visibility>[] = [
    { key: 'me', label: t('profil_stufe_kurz_me') },
    { key: 'friends', label: t('profil_stufe_friends') },
    { key: 'all', label: t('profil_stufe_all') },
  ]

  return (
    <div data-wer-sieht-was>
      <div className="card flex min-h-12 items-center justify-between gap-3 !py-3">
        <span className="text-[15px] text-[var(--lg-text)]">{t('profil_immer_sichtbar_felder')}</span>
        <span className="shrink-0 text-[13px] text-[var(--lg-text-3)]">{t('profil_immer_sichtbar')}</span>
      </div>

      {privat && (
        <p className="mt-3 rounded-[16px] bg-[var(--lg-surface-2)] px-3.5 py-3 text-[14px] leading-snug text-[var(--lg-warn-text)]" role="status" data-wer-privat>
          {t('profil_privat_gesperrt')}
        </p>
      )}
      <p className="mt-3 px-1 text-[13px] leading-snug text-[var(--lg-text-3)]">{t('profil_stufe_freunde_erklaerung')}</p>

      {PROFILE_SECTIONS.map(section => (
        <section key={section} className="mt-5" data-wer-bereich={section} aria-labelledby={`wer-${section}`}>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
            <h2 id={`wer-${section}`} className="text-[13px] font-semibold uppercase tracking-[0.02em] text-[var(--lg-text-3)]">
              {t(`profil_bereich_${section}`)}
            </h2>
            {!privat && (
              <span className="flex items-center gap-1 text-[13px]">
                <button type="button" className="min-h-9 px-1 font-semibold text-[var(--lg-accent-text)]" data-bereich-alle={`${section}:me`} onClick={() => onSetSection(section, 'me')}>
                  {t('profil_alle_auf_ich')}
                </button>
                <span aria-hidden="true" className="text-[var(--lg-text-3)]">·</span>
                <button type="button" className="min-h-9 px-1 font-semibold text-[var(--lg-accent-text)]" data-bereich-alle={`${section}:all`} onClick={() => onSetSection(section, 'all')}>
                  {t('profil_alle_auf_alle')}
                </button>
              </span>
            )}
          </div>
          <fieldset disabled={privat} className={`card min-w-0 !py-1 ${privat ? 'opacity-60' : ''}`}>
            <legend className="sr-only">{t(`profil_bereich_${section}`)}</legend>
            <ul className="flex flex-col divide-y divide-[var(--lg-separator)]">
              {fieldsOfSection(section).map(field => (
                <li key={field} className="flex min-h-[52px] items-center justify-between gap-3 py-1.5" data-wer-feld={field}>
                  <span className="min-w-0 text-[15px] leading-snug text-[var(--lg-text)]">
                    {t(`profil_feld_${field}`)}
                    {OWN_PLACEHOLDER_FIELDS.includes(field) && (
                      <span className="ml-1.5 whitespace-nowrap text-[12px] text-[var(--lg-text-3)]">{t('profil_noch_ohne_wert')}</span>
                    )}
                  </span>
                  <GlassSegmented<Visibility>
                    options={optionen}
                    value={visibilityOf(map, field)}
                    onChange={v => onSetField(field, v)}
                    ariaLabel={t('profil_sichtbarkeit_von', { feld: t(`profil_feld_${field}`) })}
                    material="fill"
                    className="shrink-0 [&>button]:!px-2.5 [&>button]:!text-[13px]"
                  />
                </li>
              ))}
            </ul>
          </fieldset>
          {section === 'berichte' && (
            <p className="mt-2 px-1 text-[13px] leading-snug text-[var(--lg-text-3)]" data-profile-public-content>
              {t('review_public_profile_desc')}{' '}
              <Link to="/bewertungen" className="font-semibold text-[var(--lg-accent-text)]">{t('review_public_profile_link')}</Link>
            </p>
          )}
        </section>
      ))}
    </div>
  )
}
