import { lazy, Suspense, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { Leiste } from '../features/profil/components/ProfilLeiste'
import { AbzeichenKachel } from '../features/profil/components/AbzeichenKarte'
import { TitelMarke } from '../features/profil/components/TitleChip'
import { TitelBestaetigung } from '../features/profil/components/TitelBestaetigung'
import { Sheet } from '../features/compliance/components/Sheet'
import { SheetClose } from '../components/ui/SheetClose'
import { badgeProgressText } from '../features/profil/lib/progressFormat'
import { useEigenerFortschritt } from '../features/profil/hooks/useEigenerFortschritt'
import { useEinstellungen } from '../features/profil/hooks/useEinstellungen'
import { useFieldVisibility } from '../features/profil/hooks/useFieldVisibility'
import { useEigenerTitel } from '../features/profil/hooks/useTitleSettings'
import { BADGE_IDS_BY_GROUP, type BadgeId } from '../features/profil/lib/badgeIds'
import { BADGE_BY_ID, BADGE_GROUPS, badgeName } from '../features/profil/lib/badges'
import { visibilityOf } from '../features/profil/lib/profileVisibility'
import { isTitleBadgeId, PERSONAL_TITLE_SOURCE, titleName, type PersonalTitleId } from '../features/profil/lib/titles'
import { isWorn, needsConsent, optionOf, titleOptions } from '../features/profil/lib/titleChoices'
import { importWithReload } from '../lib/staleChunkReload'

const EigenerTitelSheet = lazy(importWithReload(() => import('../features/profil/components/TitelSheet')
  .then(m => ({ default: m.EigenerTitelSheet }))))

/**
 * Alle Abzeichen nach Gruppen (Teilprojekt 2b, `/profil/abzeichen`, nur eigene
 * Sicht): verdiente farbig, nicht verdiente grau mit Stand („41/100“). Die
 * beiden Freunde-Abzeichen stehen da, sind aber erst mit der Freunde-Funktion
 * verdienbar. Tragbare zeigen ihren Titelnamen; verdiente lassen sich
 * antippen und „Als Titel tragen“ (Titel-Zusatz, gleiche Schreiblogik wie
 * „Dein Titel“; persönliche nur mit Schalter und Bestätigung).
 */
export function ProfilAbzeichen() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const locale = i18n?.language || 'de'
  const lang = i18n?.resolvedLanguage ?? locale
  const { fortschritt } = useEigenerFortschritt(user?.id)
  const { werte } = useEinstellungen(user?.id)
  const titel = useEigenerTitel(user?.id, werte?.titleSettings ?? null, fortschritt, null)
  const sichtbarkeit = useFieldVisibility(user?.id, werte?.visibility ?? null)
  const [gewaehlt, setGewaehlt] = useState<BadgeId | null>(null)
  const [sheetOffen, setSheetOffen] = useState(false)

  return (
    <div data-badges-page>
      <Leiste titel={t('profil_feld_badges')} />
      {fortschritt.status === 'laden' && <div className="h-[420px] animate-pulse rounded-[24px] bg-[var(--lg-surface-2)]" aria-busy="true" />}
      {fortschritt.status === 'fehler' && (
        <div className="card text-center" role="alert"><p className="text-[15px] text-[var(--lg-text-2)]">{t('pf_laden_fehler')}</p></div>
      )}
      {fortschritt.status === 'ok' && (() => {
        const byId = new Map(fortschritt.state.badges.states.map(s => [s.id, s]))
        return (
          <>
            {BADGE_GROUPS.map(group => {
              const ids = BADGE_IDS_BY_GROUP[group]
              const verdient = ids.filter(id => byId.get(id)?.earned).length
              return (
                <section key={group} className="mt-5 first-of-type:mt-0" data-badge-group={group}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 px-4">
                    <h2 className="lg-group-title !m-0 !p-0">{t(`pf_abz_gruppe_${group}`)}</h2>
                    <span className="text-[13px] tabular-nums text-[var(--lg-text-3)]" data-badge-group-count>{verdient}/{ids.length}</span>
                  </div>
                  <div className="card grid grid-cols-4 gap-x-2 gap-y-4">
                    {ids.map(id => {
                      const s = byId.get(id)!
                      const tragbar = isTitleBadgeId(id)
                      return (
                        <AbzeichenKachel
                          key={id}
                          id={id}
                          earned={s.earned}
                          on={s.on}
                          stand={badgeProgressText(s, locale)}
                          titel={tragbar ? titleName(id, lang) : null}
                          onClick={tragbar && s.earned && werte ? () => setGewaehlt(id) : undefined}
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })}
            <p className="mt-5 px-4 text-center text-[13px] leading-snug text-[var(--lg-text-3)]">{t('pf_abz_hinweis')}</p>
          </>
        )
      })()}

      {gewaehlt && (
        <AlsTitelSheet
          id={gewaehlt}
          titel={titel}
          quellStufe={id => visibilityOf(sichtbarkeit.map, PERSONAL_TITLE_SOURCE[id])}
          onDeinTitel={() => { setGewaehlt(null); setSheetOffen(true) }}
          onClose={() => setGewaehlt(null)}
        />
      )}
      {sheetOffen && werte && (
        <Suspense fallback={null}>
          <EigenerTitelSheet
            titel={titel}
            sichtbarkeit={sichtbarkeit}
            onClose={() => setSheetOffen(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

/** Ein verdientes tragbares Abzeichen: Titelname und „Als Titel tragen“. */
function AlsTitelSheet({ id, titel, quellStufe, onDeinTitel, onClose }: {
  id: BadgeId
  titel: ReturnType<typeof useEigenerTitel>
  quellStufe: (id: PersonalTitleId) => ReturnType<typeof visibilityOf>
  onDeinTitel: () => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n?.resolvedLanguage ?? i18n?.language ?? 'de'
  const titelId = `als-titel-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const [bestaetigen, setBestaetigen] = useState(false)
  const options = useMemo(() => (titel.states ? titleOptions(titel.states) : []), [titel.states])
  const option = optionOf(options, id)
  if (!option || !isTitleBadgeId(id)) return null
  const traegt = isWorn(option, titel.worn)
  const aus = option.personal && !titel.settings.personalAllowed

  const tragen = () => {
    if (needsConsent(titel.settings, option.choice)) setBestaetigen(true)
    else void titel.choose(option.choice)
  }

  return (
    <>
      <Sheet labelledBy={titelId} onClose={onClose} data-badge-title-sheet={id}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 pt-1">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-[var(--lg-fill)] text-[24px]" aria-hidden="true">{BADGE_BY_ID[id].icon}</span>
            <h2 id={titelId} className="min-w-0 text-[17px] font-semibold leading-snug text-[var(--lg-text)]">{badgeName(id, lang)}</h2>
          </div>
          <SheetClose onClick={onClose} />
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[14px] text-[var(--lg-text-2)]">
          {t('titel_abz_als_titel')} <TitelMarke name={titleName(option.shown, lang) ?? ''} />
        </p>
        {option.ladder && option.shown !== id && (
          <p className="mt-1.5 text-[13px] leading-snug text-[var(--lg-text-3)]">{t('titel_abz_leiter')}</p>
        )}
        {aus ? (
          <>
            <p className="mt-3 text-[14px] leading-snug text-[var(--lg-text-2)]" data-badge-title-personal-off>{t('titel_abz_persoenlich_aus')}</p>
            <button type="button" className="lg-gray-btn mt-3 w-full !min-h-11" onClick={onDeinTitel} data-badge-title-open-sheet>
              {t('titel_oeffnen')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`${traegt ? 'lg-gray-btn' : 'lg-btn lg-btn-primary'} mt-4 w-full !min-h-11`}
            disabled={traegt}
            onClick={tragen}
            data-badge-title-wear
          >
            {traegt ? t('titel_abz_traegst') : t('titel_als_titel_tragen')}
          </button>
        )}
      </Sheet>
      {bestaetigen && option.personal && (
        <TitelBestaetigung
          id={option.choice as PersonalTitleId}
          sourceVisibility={quellStufe(option.choice as PersonalTitleId)}
          onCancel={() => setBestaetigen(false)}
          onConfirm={() => { setBestaetigen(false); void titel.consent(option.choice as PersonalTitleId) }}
        />
      )}
    </>
  )
}
