/**
 * Titelbild (3:1) oben, rundes Profilbild überlappt dessen unteren Rand.
 * Tippen auf ein Bild: ohne Bild öffnet sich sofort die Dateiauswahl, mit
 * Bild ein Menü „Ändern / Entfernen". Die Bilder sieht nur der Nutzer selbst
 * (privater Bucket, signierte URLs) — der Hinweis darunter sagt das.
 */
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Camera, User } from 'lucide-react'
import { Sheet } from '../../compliance/components/Sheet'
import { removeProfileMedia, signedMediaUrl, uploadProfileMedia, type MediaKind } from '../services/profileMedia'

interface Props {
  userId: string
  avatarPath: string | null
  coverPath: string | null
  /** Neuer Pfad nach Hochladen, `null` nach Entfernen. */
  onChange: (kind: MediaKind, path: string | null) => void
  /** Steht unter dem Profilbild (Name, E-Mail), vor dem Hinweis. */
  children?: ReactNode
}

function useSignedUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let aktiv = true
    setUrl(null)
    if (path) void signedMediaUrl(path).then(u => { if (aktiv) setUrl(u) })
    return () => { aktiv = false }
  }, [path])
  return url
}

export function ProfilBilder({ userId, avatarPath, coverPath, onChange, children }: Props) {
  const { t } = useTranslation()
  const [menue, setMenue] = useState<MediaKind | null>(null)
  const [arbeitet, setArbeitet] = useState<MediaKind | null>(null)
  const eingaben = useRef<Record<MediaKind, HTMLInputElement | null>>({ avatar: null, cover: null })
  const avatarUrl = useSignedUrl(avatarPath)
  const coverUrl = useSignedUrl(coverPath)
  const pfade: Record<MediaKind, string | null> = { avatar: avatarPath, cover: coverPath }

  const tippe = (kind: MediaKind) => {
    if (pfade[kind]) setMenue(kind)
    else eingaben.current[kind]?.click()
  }

  const waehle = async (kind: MediaKind, event: ChangeEvent<HTMLInputElement>) => {
    const datei = event.target.files?.[0]
    event.target.value = '' // dieselbe Datei darf nochmal gewählt werden
    if (!datei) return
    setArbeitet(kind)
    try {
      onChange(kind, await uploadProfileMedia(userId, kind, datei))
    } catch {
      toast.error(t('profil_bild_fehler'))
    } finally {
      setArbeitet(null)
    }
  }

  const entferne = async (kind: MediaKind) => {
    const pfad = pfade[kind]
    setMenue(null)
    if (!pfad) return
    setArbeitet(kind)
    try {
      await removeProfileMedia(userId, kind, pfad)
      onChange(kind, null)
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
      </button>

      <div className="-mt-[42px] flex flex-col items-center">
        <button
          type="button"
          data-media-open="avatar"
          aria-label={titel('avatar')}
          aria-busy={arbeitet === 'avatar'}
          disabled={arbeitet !== null}
          onClick={() => tippe('avatar')}
          className="relative mb-2 grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-full border-[3px] border-[var(--app-bg)] bg-[var(--lg-fill)] disabled:opacity-60"
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            : <User size={38} className="text-[var(--lg-text-2)]" aria-hidden="true" />}
        </button>
        {children}
        <p className="mt-2 text-center text-[13px] leading-snug text-[var(--lg-text-3)]">{t('profil_bilder_privat')}</p>
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
