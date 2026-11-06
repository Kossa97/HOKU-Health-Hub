import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Info, ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Schalter } from '../components/ui/Schalter'
import { Leiste } from '../features/profil/components/ProfilLeiste'
import { useEigenerFortschritt } from '../features/profil/hooks/useEigenerFortschritt'
import { useEinstellungen, type Einstellungen } from '../features/profil/hooks/useEinstellungen'
import { useWebSettings } from '../features/profil/hooks/useWebSettings'
import {
  BADGE_IDS_BY_GROUP, BADGES_WEB_BORDERLINE, BADGES_WEB_SENSITIVE, SHOWN_BADGE_IDS, type BadgeId,
} from '../features/profil/lib/badgeIds'
import { BADGE_BY_ID, BADGE_GROUPS, badgeName, needsFriends } from '../features/profil/lib/badges'
import { profileUrl } from '../features/profil/lib/profileView'
import { visibilityOf } from '../features/profil/lib/profileVisibility'

/**
 * „Abzeichen im Web“ (Teilprojekt 2c, Spec 6.2, Mockup Abschnitt 3):
 * je Abzeichen ein Schalter für die Seite ohne Anmeldung und die Link-Karte.
 * Gespeichert werden nur Abweichungen vom Standard (`profiles.web_badges`);
 * was im Web wirklich erscheint, entscheidet `profile_view` auf dem Server.
 */

type Hinweis = 'weblink' | 'privat' | 'stufe'

/** Warum im Web gerade gar keine Abzeichen erscheinen — in der Reihenfolge, in der man es beheben müsste. */
function webAbzeichenHinweis(w: Pick<Einstellungen, 'webLink' | 'privat' | 'visibility'>): Hinweis | null {
  if (!w.webLink) return 'weblink'
  if (w.privat) return 'privat'
  if (visibilityOf(w.visibility, 'badges') !== 'all') return 'stufe'
  return null
}

const HINWEIS_ZIEL: Record<Hinweis, { to: string; label: string }> = {
  weblink: { to: '/profil/einstellungen', label: 'profil_webabz_zum_weblink' },
  privat: { to: '/profil/einstellungen', label: 'profil_webabz_zum_privat' },
  stufe: { to: '/profil/sichtbarkeit', label: 'profil_webabz_zu_wer' },
}

export function ProfilWebAbzeichen() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const lang = i18n?.resolvedLanguage ?? i18n?.language ?? 'de'
  const { werte, fehler } = useEinstellungen(user?.id)
  const web = useWebSettings(user?.id, { badges: werte?.webBadges ?? null, indexable: werte?.webIndexable ?? null })
  const { fortschritt } = useEigenerFortschritt(user?.id)

  const earned: ReadonlySet<BadgeId> | null = fortschritt.status === 'ok'
    ? new Set(fortschritt.state.badges.states.filter(s => s.earned).map(s => s.id))
    : null
  const hinweis = werte ? webAbzeichenHinweis(werte) : null
  const adresse = (werte?.username ? profileUrl(werte.username) : profileUrl('…')).replace(/^https?:\/\//, '')
  // Vor dem Laden nicht schalten: ein Tipp würde sonst gespeicherte Abweichungen
  // überschreiben. Ohne Spalte (vor der Migration 2c) ginge jeder Tipp ins Leere.
  const bereit = !!werte && werte.webBadges !== null
  const standard = Object.keys(web.badges).length === 0

  return (
    <div data-web-badges-page>
      <Leiste titel={t('profil_webabz_titel')} zurueck="/profil/einstellungen" />
      <p className="mb-4 px-1 text-[15px] leading-snug text-[var(--lg-text-2)]">{t('profil_webabz_intro', { adresse })}</p>

      {fehler && <p role="alert" className="card mb-3 text-[15px] text-[var(--lg-text-2)]">{t('profil_laden_fehler')}</p>}

      {hinweis && (
        <div className="card mb-3 flex gap-3" data-web-badges-hint={hinweis}>
          <Info size={18} className="mt-0.5 shrink-0 text-[var(--lg-warn-text)]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-snug text-[var(--lg-text)]">{t(`profil_webabz_hinweis_${hinweis}`)}</p>
            <Link to={HINWEIS_ZIEL[hinweis].to} className="mt-1.5 inline-flex min-h-[36px] items-center gap-0.5 text-[15px] font-medium text-[var(--lg-accent-text)]" data-web-badges-hint-link>
              {t(HINWEIS_ZIEL[hinweis].label)}
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}

      {fortschritt.status !== 'fehler' && (
        <div className="card mb-1 flex min-h-[52px] items-center justify-between gap-3 !py-2" data-web-badges-count>
          <span className="text-[16px] text-[var(--lg-text)]">{t('profil_webabz_zaehler_label')}</span>
          <span className="text-[15px] tabular-nums text-[var(--lg-text-3)]">
            {earned
              ? t('profil_webabz_zaehler', {
                // Mit Hinweis erscheint im Web gar keins, auch nicht die eingeschalteten
                n: hinweis ? 0 : SHOWN_BADGE_IDS.filter(id => earned.has(id) && web.isBadgeOn(id)).length,
                gesamt: SHOWN_BADGE_IDS.filter(id => earned.has(id)).length,
              })
              : '…'}
          </span>
        </div>
      )}
      {fortschritt.status === 'fehler' && <p className="mb-1 px-1 text-[13px] text-[var(--lg-text-3)]">{t('pf_laden_fehler')}</p>}

      {BADGE_GROUPS.map(group => {
        const ids = BADGE_IDS_BY_GROUP[group]
        return (
          <section key={group} className="mt-5" data-web-badge-group={group} aria-labelledby={`webabz-${group}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 px-4">
              <h2 id={`webabz-${group}`} className="lg-group-title !m-0 !p-0">{t(`pf_abz_gruppe_${group}`)}</h2>
              <span className="text-[13px] tabular-nums text-[var(--lg-text-3)]" data-web-badge-group-count>
                {t('profil_webabz_gruppe_an', { n: ids.filter(id => web.isBadgeOn(id)).length, gesamt: ids.length })}
              </span>
            </div>
            <div className="card flex flex-col divide-y divide-[var(--lg-separator)] !py-1">
              {ids.map(id => (
                <AbzeichenSchalter
                  key={id}
                  id={id}
                  lang={lang}
                  an={web.isBadgeOn(id)}
                  verdient={earned ? earned.has(id) : null}
                  disabled={!bereit}
                  onClick={() => void web.setBadge(id, !web.isBadgeOn(id))}
                />
              ))}
            </div>
          </section>
        )
      })}

      <div className="mt-6 px-1">
        <button
          type="button"
          className="lg-gray-btn w-full !min-h-12"
          disabled={!bereit || standard}
          onClick={() => void web.resetBadges()}
          data-web-badges-reset
        >
          {t('profil_webabz_reset')}
        </button>
        <p className="mt-2 text-[13px] leading-snug text-[var(--lg-text-3)]">{t('profil_webabz_reset_text')}</p>
      </div>

      <section className="card mt-5" aria-labelledby="webabz-nicht" data-web-badges-scope>
        <h2 id="webabz-nicht" className="text-[15px] font-semibold text-[var(--lg-text)]">{t('profil_webabz_nicht_titel')}</h2>
        <p className="mt-1 text-[14px] leading-snug text-[var(--lg-text-2)]">{t('profil_webabz_nicht_text')}</p>
      </section>
    </div>
  )
}

function AbzeichenSchalter({ id, lang, an, verdient, disabled, onClick }: {
  id: BadgeId
  lang: string
  an: boolean
  /** `null` = Stand unbekannt (Fortschritt lädt oder scheiterte). */
  verdient: boolean | null
  disabled: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const name = badgeName(id, lang)
  const heikel = BADGES_WEB_SENSITIVE.includes(id)
  const grenzfall = BADGES_WEB_BORDERLINE.includes(id)
  const stand = verdient === null ? null
    : verdient ? t('pf_abz_verdient')
      : needsFriends(id) ? t('pf_abz_ab_freunde') : t('pf_abz_nicht_verdient')
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-label={t('profil_webabz_zeigen_aria', { name })}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left disabled:opacity-60"
      data-web-badge={id}
      data-web-badge-earned={verdient === null ? undefined : String(verdient)}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[20px] ${verdient === false ? 'opacity-45 grayscale' : ''}`}
        style={{ background: 'var(--lg-surface-2)' }}
        aria-hidden="true"
      >
        {BADGE_BY_ID[id].icon}
      </span>
      <span className="min-w-0 flex-1">
        <span lang={lang.toLowerCase().startsWith('de') ? 'de' : 'en'} className={`block text-[16px] leading-tight ${verdient === false ? 'text-[var(--lg-text-2)]' : 'text-[var(--lg-text)]'}`}>
          {name}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-snug text-[var(--lg-text-3)]">
          {heikel && (
            <span className="inline-flex items-center gap-1 text-[var(--lg-warn-text)]" data-web-badge-sensitive>
              <ShieldAlert size={13} aria-hidden="true" />
              {t('profil_webabz_heikel')}
            </span>
          )}
          {grenzfall && <span data-web-badge-borderline>{t('profil_webabz_grenzfall')}</span>}
          {stand && <span>{stand}</span>}
        </span>
      </span>
      <Schalter an={an} />
    </button>
  )
}
