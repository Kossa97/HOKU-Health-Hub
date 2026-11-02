import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { Leiste } from '../features/profil/components/ProfilLeiste'
import { AbzeichenKachel } from '../features/profil/components/AbzeichenKarte'
import { badgeProgressText } from '../features/profil/lib/progressFormat'
import { useEigenerFortschritt } from '../features/profil/hooks/useEigenerFortschritt'
import { BADGE_IDS_BY_GROUP } from '../features/profil/lib/badgeIds'
import { BADGE_GROUPS } from '../features/profil/lib/badges'

/**
 * Alle Abzeichen nach Gruppen (Teilprojekt 2b, `/profil/abzeichen`, nur eigene
 * Sicht): verdiente farbig, nicht verdiente grau mit Stand („41/100“). Die
 * beiden Freunde-Abzeichen stehen da, sind aber erst mit der Freunde-Funktion
 * verdienbar.
 */
export function ProfilAbzeichen() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const locale = i18n?.language || 'de'
  const { fortschritt } = useEigenerFortschritt(user?.id)

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
                      return <AbzeichenKachel key={id} id={id} earned={s.earned} on={s.on} stand={badgeProgressText(s, locale)} />
                    })}
                  </div>
                </section>
              )
            })}
            <p className="mt-5 px-4 text-center text-[13px] leading-snug text-[var(--lg-text-3)]">{t('pf_abz_hinweis')}</p>
          </>
        )
      })()}
    </div>
  )
}
