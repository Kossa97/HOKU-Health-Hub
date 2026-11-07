/**
 * Titelbild (3:1) oben, rundes Profilbild überlappt dessen unteren Rand.
 * Tippen auf ein Bild: ohne Bild öffnet sich sofort die Dateiauswahl, mit
 * Bild ein Menü „Ändern / Entfernen". Nach dem Hochladen geht das Bild zum
 * Bild-Check (Profil 2a); bis dahin steht „wird geprüft“ daran, andere sehen
 * es erst danach. Abgelehnt: Hinweis mit „Anderes wählen“.
 */
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Camera, User } from 'lucide-react'
import { Sheet } from '../../compliance/components/Sheet'
import { BildZuGrossError, checkProfileMedia, removeProfileMedia, uploadProfileMedia, type MediaKind } from '../services/profileMedia'
import type { MediaStatus } from '../lib/profileView'
import { useSignedUrl } from '../hooks/useSignedUrl'
import { PrueftMarke } from './PrueftMarke'

interface Props {
  userId: string
  avatarPath: string | null
  coverPath: string | null
  /** Stand des Bild-Checks je Bild (`null`: kein Bild bzw. nichts offen). */
  avatarStatus?: MediaStatus | null
  coverStatus?: MediaStatus | null
  /**
   * Neuer Pfad und Stand: nach Hochladen `pending`, nach dem Check dessen
   * Ergebnis (abgelehnt: Pfad `null`), nach Entfernen beides `null`.
   */
  onChange: (kind: MediaKind, path: string | null, status: MediaStatus | null) => void
  /** Steht unter dem Profilbild (Name, E-Mail), vor dem Hinweis. */
  children?: ReactNode
}

export function ProfilBilder({ userId, avatarPath, coverPath, avatarStatus = null, coverStatus = null, onChange, children }: Props) {
  const { t } = useTranslation()
  const [menue, setMenue] = useState<MediaKind | null>(null)
  const [arbeitet, setArbeitet] = useState<MediaKind | null>(null)
  const eingaben = useRef<Record<MediaKind, HTMLInputElement | null>>({ avatar: null, cover: null })
  // Zählt Hochladen/Entfernen je Bild: ein Prüfergebnis gilt nur, wenn danach nichts mehr geändert wurde
  const auftrag = useRef<Record<MediaKind, number>>({ avatar: 0, cover: 0 })
  const avatarUrl = useSignedUrl(avatarPath)
  const coverUrl = useSignedUrl(coverPath)
  const pfade: Record<MediaKind, string | null> = { avatar: avatarPath, cover: coverPath }
  const stand: Record<MediaKind, MediaStatus | null> = { avatar: avatarStatus, cover: coverStatus }
  const wirdGeprueft = (kind: MediaKind) => pfade[kind] !== null && stand[kind] === 'pending'
  const abgelehnt = (['avatar', 'cover'] as const).find(kind => !pfade[kind] && stand[kind] === 'rejected') ?? null

  const tippe = (kind: MediaKind) => {
    if (pfade[kind]) setMenue(kind)
    else eingaben.current[kind]?.click()
  }

  const waehle = async (kind: MediaKind, event: ChangeEvent<HTMLInputElement>) => {
    const datei = event.target.files?.[0]
    event.target.value = '' // dieselbe Datei darf nochmal gewählt werden
    if (!datei) return
    const nummer = ++auftrag.current[kind]
    setArbeitet(kind)
    let pfad: string
    try {
      pfad = await uploadProfileMedia(userId, kind, datei)
    } catch (fehler) {
      toast.error(t(fehler instanceof BildZuGrossError ? 'profil_bild_zu_gross' : 'profil_bild_fehler'))
      return
    } finally {
      setArbeitet(null)
    }
    onChange(kind, pfad, 'pending')
    // Prüfen lassen; Fehler bleiben „wird geprüft“ und werden später nachgeholt.
    const status = (await checkProfileMedia(kind)) ?? 'pending'
    if (status === 'pending' || auftrag.current[kind] !== nummer) return
    onChange(kind, status === 'rejected' ? null : pfad, status)
  }

  const entferne = async (kind: MediaKind) => {
    const pfad = pfade[kind]
    setMenue(null)
    if (!pfad) return
    auftrag.current[kind]++
    setArbeitet(kind)
    try {
      await removeProfileMedia(userId, kind, pfad)
      onChange(kind, null, null)
    } catch {
      toast.error(t('profil_bild_fehler'))
    } finally {
      setArbeitet(null)
    }
  }

  const titel = (kind: MediaKind) => t(kind === 'avatar' ? 'profil_profilbild' : 'profil_titelbild')

  return (
    <div className="mb-6" data-profile-media>
      <button
        type="button"
        data-media-open="cover"
        aria-label={titel('cover')}
        aria-busy={arbeitet === 'cover'}
        disabled={arbeitet !== null}
        onClick={() => tippe('cover')}
        className="relative block h-[140px] w-full overflow-hidden rounded-[24px] bg-[linear-gradient(160deg,#2a2c32,#222327)] disabled:opacity-60"
      >
        {coverUrl && <img src={coverUrl} alt="" className="h-full w-full object-cover" />}
        <span className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/80" aria-hidden="true">
          <Camera size={15} />
        </span>
        {wirdGeprueft('cover') && <PrueftMarke className="absolute left-2.5 top-2.5" kind="cover" />}
      </button>

      <div className="-mt-[42px] flex flex-col items-center">
        <div className="relative mb-2">
        <button
          type="button"
          data-media-open="avatar"
          aria-label={titel('avatar')}
          aria-busy={arbeitet === 'avatar'}
          disabled={arbeitet !== null}
          onClick={() => tippe('avatar')}
          className="relative grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-full border-[3px] border-[var(--app-bg)] bg-[var(--lg-fill)] disabled:opacity-60"
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            : <User size={38} className="text-[var(--lg-text-2)]" aria-hidden="true" />}
        </button>
        {wirdGeprueft('avatar') && <PrueftMarke className="absolute -bottom-1.5 left-1/2 -translate-x-1/2" kind="avatar" />}
        </div>
        {children}
        {abgelehnt && (
          <div className="mt-2 flex w-full flex-col items-center gap-2 rounded-[16px] bg-[var(--lg-surface-2)] px-4 py-3 text-center" role="status" data-media-rejected={abgelehnt}>
            <p className="text-[14px] leading-snug text-[var(--lg-text)]">{t('profil_bild_abgelehnt')}</p>
            <button type="button" className="lg-gray-btn !min-h-11" onClick={() => eingaben.current[abgelehnt]?.click()} data-media-choose-other>
              {t('profil_bild_anderes')}
            </button>
          </div>
        )}
        <p className="mt-2 text-center text-[13px] leading-snug text-[var(--lg-text-3)]">{t('profil_bilder_pruefung')}</p>
      </div>

      {(['avatar', 'cover'] as const).map(kind => (
        <input
          key={kind}
          ref={el => { eingaben.current[kind] = el }}
          type="file"
          accept="image/*"
          hidden
          data-media-input={kind}
          onChange={event => void waehle(kind, event)}
        />
      ))}

      {menue && (
        <Sheet labelledBy="profil-bild-menue" onClose={() => setMenue(null)} data-media-menu={menue}>
          <h2 id="profil-bild-menue" className="lg-title2 pb-3 pt-2">{titel(menue)}</h2>
          <div className="space-y-2">
            <button type="button" className="lg-gray-btn w-full" onClick={() => { const kind = menue; setMenue(null); eingaben.current[kind]?.click() }}>
              {t('profil_bild_aendern')}
            </button>
            <button type="button" data-tone="bad" className="lg-gray-btn w-full" onClick={() => void entferne(menue)}>
              {t('entfernen')}
            </button>
            <button type="button" className="lg-gray-btn w-full" onClick={() => setMenue(null)}>
              {t('cancel')}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
