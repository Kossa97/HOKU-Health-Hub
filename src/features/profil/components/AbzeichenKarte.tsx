/**
 * Abzeichen im Profil (Teilprojekt 2b): Karte mit den zuletzt verdienten und
 * „Alle Abzeichen“ (eigene Sicht), dazu die Kachel eines Abzeichens, die auch
 * die Seite „Alle Abzeichen“ nutzt. Andere sehen nur verdiente Abzeichen.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BADGE_BY_ID, badgeName, needsFriends } from '../lib/badges'
import { BADGE_IDS, type BadgeId } from '../lib/badgeIds'
import { formatDay } from '../lib/progressFormat'

export function AbzeichenKachel({ id, earned, on, stand }: {
  id: BadgeId
  earned: boolean
  /** Tag des Erhalts (nur verdient). */
  on?: string | null
  /** Stand eines nicht verdienten (nur eigene Sicht). */
  stand?: string | null
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n?.language || 'de'
  const lang = i18n?.resolvedLanguage ?? locale
  const def = BADGE_BY_ID[id]
  const name = badgeName(id, lang)
  const freunde = !earned && needsFriends(id)
  const zusatz = freunde ? t('pf_abz_ab_freunde') : earned ? null : stand
  return (
    <div
      className="flex min-w-0 flex-col items-center text-center"
      data-badge={id}
      data-badge-earned={earned ? 'true' : 'false'}
      title={earned && on ? t('pf_abz_verdient_am', { datum: formatDay(on, locale) }) : undefined}
    >
      <div
        className={`grid h-14 w-14 place-items-center rounded-[16px] text-[26px] ${earned ? '' : 'opacity-45 grayscale'}`}
        style={{
          background: earned
            ? 'linear-gradient(180deg, color-mix(in srgb, var(--pf-badge) 26%, transparent), color-mix(in srgb, var(--pf-badge) 10%, transparent))'
            : 'var(--lg-surface-2)',
          boxShadow: earned ? 'inset 0 0 0 1px color-mix(in srgb, var(--pf-badge) 40%, transparent)' : undefined,
        }}
        aria-hidden="true"
      >
        {def.icon}
      </div>
      <span lang={lang.toLowerCase().startsWith('de') ? 'de' : 'en'} className={`mt-1.5 text-[12px] leading-tight [hyphens:auto] [overflow-wrap:break-word] ${earned ? 'text-[var(--lg-text)]' : 'text-[var(--lg-text-3)]'}`}>
        {name}
      </span>
      {zusatz && <span className="mt-0.5 text-[11px] tabular-nums text-[var(--lg-text-3)]" data-badge-progress>{zusatz}</span>}
      <span className="sr-only">{earned ? t('pf_abz_verdient') : t('pf_abz_nicht_verdient')}</span>
    </div>
  )
}

export function AbzeichenKarte({ ids, earnedDays, chip, own }: {
  /** Verdiente Abzeichen, zuletzt verdiente zuerst. */
  ids: readonly BadgeId[]
  earnedDays?: Partial<Record<BadgeId, string>>
  chip?: ReactNode
  /** Eigene Sicht: die vier neuesten + „Alle Abzeichen“; fremde: alle verdienten. */
  own: boolean
}) {
  const { t } = useTranslation()
  const shown = own ? ids.slice(0, 4) : ids
  return (
    <section className="card mb-3 min-w-0" data-badges-card aria-labelledby="profil-karte-abzeichen">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 id="profil-karte-abzeichen" className="min-w-0 truncate text-[17px] font-semibold text-[var(--lg-text)]">{t('profil_feld_badges')}</h2>
          {chip}
        </div>
        <span className="shrink-0 text-[13px] tabular-nums text-[var(--lg-text-3)]" data-badges-count>
          {own ? t('pf_abz_von', { n: ids.length, gesamt: BADGE_IDS.length }) : ids.length}
        </span>
      </div>
      {shown.length > 0 ? (
        <div className="grid grid-cols-4 gap-x-2 gap-y-3" data-badges-row>
          {shown.map(id => <AbzeichenKachel key={id} id={id} earned on={earnedDays?.[id]} />)}
        </div>
      ) : (
        <p className="text-[14px] leading-snug text-[var(--lg-text-3)]">{t('pf_abz_keine')}</p>
      )}
      {own && (
        <Link to="/profil/abzeichen" className="lg-gray-btn mt-3 w-full" data-badges-all>{t('pf_abz_alle')}</Link>
      )}
    </section>
  )
}
