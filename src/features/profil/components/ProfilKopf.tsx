/**
 * Kopf des Profils: Titelbild, rundes Profilbild, Name mit Geschlechtszeichen
 * und Herkunft (Flagge + Kürzel), @nick; darunter Bio, Ziel-Tags als wischbare
 * Zeile, Streak · Mitglied seit, Zahlenzeile (Workouts · Berichte) und Platz
 * für Knöpfe. Zeigt nur, was in `fields` steht; mit `visibility` (eigene
 * Sicht) trägt jeder Wert seinen Stufen-Chip.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from 'lucide-react'
import { flagOf, genderSymbol } from '../lib/profileFields'
import { monthYear, numberFormat } from '../lib/profileFormat'
import type { MediaStatus, ProfileViewFields } from '../lib/profileView'
import { visibilityOf, type ProfileField, type Visibility, type VisibilityMap } from '../lib/profileVisibility'
import { useSignedUrl } from '../hooks/useSignedUrl'
import { SichtbarkeitsChip } from './SichtbarkeitsChip'
import { PrueftMarke } from './PrueftMarke'

export interface ProfilKopfProps {
  name: string
  username: string
  /** Pfad des Profilbilds im Bucket (nur wenn der Betrachter es sehen darf). */
  avatarPath: string | null
  fields: ProfileViewFields
  visibility?: VisibilityMap
  onChangeVisibility?: (field: ProfileField, next: Visibility) => void
  /** Nur eigene Sicht: Stand des Bild-Checks; `pending` zeigt „wird geprüft“ am Bild. */
  bildStatus?: { avatar: MediaStatus | null; cover: MediaStatus | null }
  /** Knöpfe unter der Zahlenzeile (eigenes Profil: Teilen, Bearbeiten). */
  children?: ReactNode
}

export function ProfilKopf({ name, username, avatarPath, fields, visibility, onChangeVisibility, bildStatus, children }: ProfilKopfProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n?.language || 'de'
  const { n } = numberFormat(locale)
  const avatarUrl = useSignedUrl(avatarPath)
  const coverUrl = useSignedUrl(fields.cover ?? null)
  const chip = (field: ProfileField) => visibility && onChangeVisibility
    ? <SichtbarkeitsChip field={field} value={visibilityOf(visibility, field)} onChange={onChangeVisibility} />
    : null

  const symbol = genderSymbol(fields.gender ?? null)
  const zahlen = [
    fields.workouts ? { key: 'workouts', wert: n(fields.workouts.total), label: t('profil_zahl_workouts') } : null,
    fields.reviews ? { key: 'reviews', wert: n(fields.reviews.count), label: t('profil_zahl_berichte') } : null,
  ].filter((z): z is { key: string; wert: string; label: string } => z !== null)

  return (
    <header className="mb-4" data-profile-head>
      {/* Verborgenes oder fehlendes Titelbild: dieselbe neutrale Fläche */}
      <div className="relative h-[124px] overflow-hidden rounded-[24px] bg-[linear-gradient(160deg,#2a2c32,#222327)]" data-profile-cover>
        {coverUrl && <img src={coverUrl} alt="" className="h-full w-full object-cover" />}
        {fields.cover && visibility && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/45 px-2 py-1">{chip('cover')}</span>
        )}
        {fields.cover && bildStatus?.cover === 'pending' && <PrueftMarke kind="cover" className="absolute left-2.5 top-2.5" />}
      </div>

      <div className="relative z-[1] -mt-9 flex items-end gap-3 px-2">
        <div className="relative shrink-0">
          <div className="grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-full border-[3px] border-[var(--app-bg)] bg-[var(--lg-fill)]" data-profile-avatar>
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              : <User size={38} className="text-[var(--lg-text-2)]" aria-hidden="true" />}
          </div>
          {avatarPath && bildStatus?.avatar === 'pending' && (
            <PrueftMarke kind="avatar" className="absolute -bottom-1 left-1/2 -translate-x-1/2" />
          )}
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1" data-profile-name>
            <span className="min-w-0 max-w-full truncate text-[21px] font-semibold leading-tight text-[var(--lg-text)]">{name}</span>
            {symbol && (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[14px] text-[var(--lg-text-3)]" role="img" aria-label={t(`geschlecht_${fields.gender}`)} data-profile-gender-symbol>{symbol}</span>
                {chip('gender')}
              </span>
            )}
            {fields.country && (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="rounded-[7px] bg-[var(--lg-fill)] px-1.5 py-0.5 text-[12px] font-semibold text-[var(--lg-text-2)]" data-profile-country>
                  <span aria-hidden="true">{flagOf(fields.country)}</span> {fields.country}
                </span>
                {chip('country')}
              </span>
            )}
          </p>
          <p className="truncate text-[15px] text-[var(--lg-text-2)]" data-profile-nick>@{username}</p>
        </div>
      </div>

      {fields.bio && (
        <p className="mt-3 whitespace-pre-line px-1 text-[15px] leading-snug text-[var(--lg-text)]" data-profile-bio>
          {fields.bio} {chip('bio')}
        </p>
      )}

      {fields.goals && fields.goals.length > 0 && (
        <div
          className="no-scrollbar -mx-1 mt-3 flex items-center gap-2 px-2"
          style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
          data-profile-goals
        >
          {/* Chip vorn: am Ende der wischbaren Zeile sähe man ihn nicht */}
          {chip('goals')}
          {fields.goals.map(g => (
            <span key={g} className="shrink-0 whitespace-nowrap rounded-full bg-[var(--lg-fill)] px-3 py-1.5 text-[13px] font-semibold text-[var(--lg-accent-text)]">
              {t(`ziel_${g}`)}
            </span>
          ))}
        </div>
      )}

      {(fields.streak || fields.member_since) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[13px] text-[var(--lg-text-2)]" data-profile-meta>
          {fields.streak && (
            <span className="inline-flex items-center gap-1.5">
              {t('profil_streak', { count: fields.streak.days })} {chip('streak')}
            </span>
          )}
          {fields.member_since && (
            <span className="inline-flex items-center gap-1.5">
              {t('profil_mitglied_seit', { monat: monthYear(fields.member_since, locale) })} {chip('member_since')}
            </span>
          )}
        </p>
      )}

      {zahlen.length > 0 && (
        <div className="card mt-4 grid !py-3" style={{ gridTemplateColumns: `repeat(${zahlen.length}, minmax(0, 1fr))` }} data-profile-counts>
          {zahlen.map(z => (
            <div key={z.key} className="text-center">
              <b className="block text-[19px] font-semibold tabular-nums text-[var(--lg-text)]">{z.wert}</b>
              <small className="text-[12px] text-[var(--lg-text-3)]">{z.label}</small>
            </div>
          ))}
        </div>
      )}

      {children}
    </header>
  )
}
