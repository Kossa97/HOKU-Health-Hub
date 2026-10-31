import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Link2, Pencil, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ProfilKopf } from '../features/profil/components/ProfilKopf'
import { ProfilKarten } from '../features/profil/components/ProfilKarten'
import type { BearbeitenAenderung, BearbeitenWerte } from '../features/profil/components/ProfilBearbeiten'
import { useEigenesProfil, type ProfilZeile } from '../features/profil/hooks/useEigenesProfil'
import { useFieldVisibility } from '../features/profil/hooks/useFieldVisibility'
import { requestProfileSnapshot } from '../features/profil/hooks/useProfileSnapshotSync'
import { GOAL_TAGS, isProfileGender, knownCountry } from '../features/profil/lib/profileFields'
import { parseFields, profileUrl, type ProfileViewFields } from '../features/profil/lib/profileView'
import { importWithReload } from '../lib/staleChunkReload'

// Übungskatalog und Auswahl erst beim Öffnen laden
const ProfilBearbeiten = lazy(importWithReload(() => import('../features/profil/components/ProfilBearbeiten')
  .then(m => ({ default: m.ProfilBearbeiten }))))

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null)

function bearbeitenWerte(row: ProfilZeile): BearbeitenWerte {
  return {
    username: str(row.username),
    display_name: str(row.display_name),
    public_bio: str(row.public_bio),
    avatar_path: strOrNull(row.avatar_path),
    cover_path: strOrNull(row.cover_path),
    favorite_exercise: strOrNull(row.favorite_exercise),
    profile_routine_id: strOrNull(row.profile_routine_id),
    goals: Array.isArray(row.goals) ? GOAL_TAGS.filter(g => (row.goals as unknown[]).includes(g)) : [],
    country: knownCountry(row.country),
    profile_gender: isProfileGender(row.profile_gender) ? row.profile_gender : null,
  }
}

/** Neue Profilzeile nach „Bearbeiten“ → die Felder, die der Server aus `profiles` liest. */
function felderAusZeile(fields: ProfileViewFields, row: ProfilZeile, aenderung: BearbeitenAenderung): ProfileViewFields {
  const ausZeile = parseFields({
    bio: row.public_bio, goals: row.goals, country: row.country, gender: row.profile_gender, cover: row.cover_path,
  })
  const next: ProfileViewFields = { ...fields }
  for (const key of ['bio', 'goals', 'country', 'gender', 'cover'] as const) delete next[key]
  Object.assign(next, ausZeile)
  if (aenderung.routineName !== undefined) {
    if (aenderung.routineName) next.routine = { name: aenderung.routineName }
    else delete next.routine
  }
  if (aenderung.favoritName !== undefined) {
    if (aenderung.favoritName && row.favorite_exercise) next.favorite_exercise = { id: String(row.favorite_exercise), name: aenderung.favoritName }
    else delete next.favorite_exercise
  }
  return next
}

/**
 * Eigenes Profil als Schaufenster (Teilprojekt 2a): Kopf, Kennzahlen, Karten.
 * Jeder Wert trägt seine Stufe als Chip; Tippen schaltet Nur ich → Freunde →
 * Alle und speichert sofort. Alles Einstellbare liegt hinter ⚙︎.
 */
export function Profil() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { state, setState } = useEigenesProfil(user?.id)
  const [bearbeiten, setBearbeiten] = useState(false)
  const geladen = state.status === 'ok' ? state : null
  const sichtbarkeit = useFieldVisibility(user?.id, geladen?.view.visibility ?? null)

  // Beim Öffnen den Schnappschuss auffrischen: andere sehen dann den Stand von heute
  useEffect(() => { requestProfileSnapshot() }, [])

  const teilen = async () => {
    const name = geladen?.view.username
    if (!name) return toast.error(t('zuerst_username'))
    const url = profileUrl(name)
    try {
      if (navigator.share) {
        await navigator.share({ title: geladen.view.displayName ?? `@${name}`, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success(t('link_kopiert'))
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error(t('error'))
    }
  }

  const aendern = (aenderung: BearbeitenAenderung) => setState(s => {
    if (s.status !== 'ok') return s
    const row = { ...s.row, ...aenderung.werte }
    const view = {
      ...s.view,
      username: str(row.username) || s.view.username,
      displayName: strOrNull(row.display_name),
      avatar: strOrNull(row.avatar_path),
      fields: felderAusZeile(s.view.fields, row, aenderung),
    }
    return { ...s, row, view }
  })

  return (
    <div data-profile-page>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="lg-large-title min-w-0 truncate">{t('nav_profil')}</h1>
        <Link
          to="/profil/einstellungen"
          aria-label={t('profil_einstellungen')}
          className="lg-gray-btn shrink-0 !min-h-11 !w-11 !px-0"
          data-profile-settings
        >
          <Settings size={19} aria-hidden="true" />
        </Link>
      </div>

      {state.status === 'laden' && <div className="h-[320px] animate-pulse rounded-[24px] bg-[var(--lg-surface-2)]" aria-busy="true" />}

      {state.status === 'fehler' && (
        <div className="card text-center" role="alert">
          <p className="text-[15px] text-[var(--lg-text-2)]">{t('profil_laden_fehler')}</p>
        </div>
      )}

      {geladen && user && (
        <>
          <ProfilKopf
            name={geladen.view.displayName || geladen.view.username}
            username={geladen.view.username}
            avatarPath={geladen.view.avatar}
            fields={geladen.view.fields}
            visibility={sichtbarkeit.map}
            onChangeVisibility={(field, v) => void sichtbarkeit.setField(field, v)}
          >
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button type="button" className="lg-btn lg-btn-primary !min-h-11" onClick={() => void teilen()} data-profile-share>
                <Link2 size={16} aria-hidden="true" /> {t('profil_teilen')}
              </button>
              <button type="button" className="lg-gray-btn !min-h-11" onClick={() => setBearbeiten(true)} data-profile-edit>
                <Pencil size={15} aria-hidden="true" /> {t('profil_bearbeiten')}
              </button>
            </div>
          </ProfilKopf>

          <ProfilKarten
            fields={geladen.view.fields}
            visibility={sichtbarkeit.map}
            onChangeVisibility={(field, v) => void sichtbarkeit.setField(field, v)}
          />

          <p className="mt-5 px-4 text-center text-[13px] leading-snug text-[var(--lg-text-3)]" data-profile-note>
            {t('profil_hinweis_freunde')} {t('profil_hinweis_privat')}
          </p>

          {bearbeiten && (
            <Suspense fallback={null}>
              <ProfilBearbeiten
                userId={user.id}
                werte={bearbeitenWerte(geladen.row)}
                onChange={aendern}
                onClose={() => setBearbeiten(false)}
              />
            </Suspense>
          )}
        </>
      )}
    </div>
  )
}
