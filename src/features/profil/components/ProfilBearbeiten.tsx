/**
 * „Bearbeiten“ im eigenen Profil: Bilder, Name, Bio, Ziele/Land/Geschlecht
 * (Bausteine aus Teilprojekt 1), dazu Lieblingsübung und Routine für die
 * Trainingskarte. Name und Bio speichert „Speichern“; alles andere sofort,
 * wie bisher in „Über dich“. Danach wird der Schnappschuss neu angestoßen.
 *
 * Wird erst beim Öffnen geladen: Übungskatalog und Auswahl sind groß.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Check, ChevronRight } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { SheetClose } from '../../../components/ui/SheetClose'
import { Sheet } from '../../compliance/components/Sheet'
import { filterFehlerSchluessel } from '../../compliance/lib/moderation'
import { ExercisePicker } from '../../training/components/ExercisePicker'
import { exerciseName } from '../../training/lib/exerciseLookup'
import { insertCustomExercise, isMissingTable, loadCustomExercises, loadRoutines, loadSessions } from '../../training/services/trainingRepo'
import type { CustomExercise, TrainingRoutine, TrainingSession } from '../../training/types'
import { requestProfileSnapshot } from '../hooks/useProfileSnapshotSync'
import type { MediaKind } from '../services/profileMedia'
import type { MediaStatus } from '../lib/profileView'
import { ProfilBilder } from './ProfilBilder'
import { UeberDichKarte, type UeberDichWerte } from './UeberDichKarte'

export interface BearbeitenWerte extends UeberDichWerte {
  username: string
  display_name: string
  public_bio: string
  avatar_path: string | null
  cover_path: string | null
  avatar_status: MediaStatus | null
  cover_status: MediaStatus | null
  favorite_exercise: string | null
  profile_routine_id: string | null
}

/** Was sich geändert hat; dazu, was die Trainingskarte sofort zeigen soll. */
export interface BearbeitenAenderung {
  werte: Partial<BearbeitenWerte>
  routineName?: string | null
  favoritName?: string | null
}

interface Training {
  sessions: TrainingSession[]
  routines: TrainingRoutine[]
  custom: CustomExercise[]
}

export function ProfilBearbeiten({ userId, werte, onChange, onClose }: {
  userId: string
  werte: BearbeitenWerte
  onChange: (aenderung: BearbeitenAenderung) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang: 'de' | 'en' = (i18n?.language ?? 'de').startsWith('de') ? 'de' : 'en'
  const [form, setForm] = useState({ username: werte.username, display_name: werte.display_name, public_bio: werte.public_bio })
  const [saving, setSaving] = useState(false)
  const [training, setTraining] = useState<Training | null>(null)
  const [auswahl, setAuswahl] = useState<'uebung' | 'routine' | null>(null)
  const geaendert = form.username !== werte.username || form.display_name !== werte.display_name || form.public_bio !== werte.public_bio

  // Routinen und eigene Übungen: für die Namen der aktuellen Auswahl und für die Listen
  useEffect(() => {
    let aktiv = true
    const orEmpty = <T,>(p: Promise<T[]>) => p.catch(error => (isMissingTable(error) ? [] as T[] : Promise.reject(error)))
    Promise.all([orEmpty(loadSessions(userId)), orEmpty(loadRoutines(userId)), orEmpty(loadCustomExercises(userId))])
      .then(([sessions, routines, custom]) => { if (aktiv) setTraining({ sessions, routines, custom }) })
      .catch(() => { if (aktiv) setTraining({ sessions: [], routines: [], custom: [] }) })
    return () => { aktiv = false }
  }, [userId])

  const speichern = async () => {
    const username = form.username.trim().toLowerCase()
    if (!username) return toast.error(t('benutzername_req'))
    setSaving(true)
    const patch = { username, display_name: form.display_name.trim() || null, public_bio: form.public_bio.trim() || null }
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    setSaving(false)
    if (error) {
      const filter = filterFehlerSchluessel(error.message)
      toast.error(filter ? t(filter) : t('fehler_speichern'), { duration: filter ? 6000 : undefined })
      return
    }
    onChange({ werte: { username, display_name: patch.display_name ?? '', public_bio: patch.public_bio ?? '' } })
    setForm({ username, display_name: patch.display_name ?? '', public_bio: patch.public_bio ?? '' })
    toast.success(t('profil_gespeichert'))
  }

  const setzeTraining = async (patch: { favorite_exercise?: string | null; profile_routine_id?: string | null }, anzeige: Omit<BearbeitenAenderung, 'werte'>) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    if (error) return toast.error(t('fehler_speichern'))
    onChange({ werte: patch, ...anzeige })
    requestProfileSnapshot()
  }

  const routine = training?.routines.find(r => r.id === werte.profile_routine_id) ?? null
  const uebungName = werte.favorite_exercise && training ? exerciseName(werte.favorite_exercise, lang, training.custom) : null

  return (
    <Sheet labelledBy="profil-bearbeiten-titel" tall onClose={onClose} data-profile-edit-sheet>
      <div className="flex items-start justify-between gap-3">
        <h2 id="profil-bearbeiten-titel" className="lg-title2 pt-2">{t('profil_bearbeiten_titel')}</h2>
        <SheetClose onClick={onClose} />
      </div>

      <div className="mt-3">
        <ProfilBilder
          userId={userId}
          avatarPath={werte.avatar_path}
          coverPath={werte.cover_path}
          avatarStatus={werte.avatar_status}
          coverStatus={werte.cover_status}
          onChange={(kind: MediaKind, pfad, status) => {
            onChange({ werte: kind === 'avatar' ? { avatar_path: pfad, avatar_status: status } : { cover_path: pfad, cover_status: status } })
            requestProfileSnapshot()
          }}
        />
      </div>

      <form
        className="space-y-4"
        onSubmit={event => { event.preventDefault(); void speichern() }}
        data-profile-edit-form
      >
        <div>
          <label className="label" htmlFor="profil-username">{t('benutzername_pflicht')}</label>
          <input id="profil-username" className="input" autoCapitalize="none" autoCorrect="off" placeholder={t('username_placeholder')}
            value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          <p className="mt-1.5 text-xs text-[var(--lg-text-3)]">{t('benutzername_hinweis')}</p>
        </div>
        <div>
          <label className="label" htmlFor="profil-anzeigename">{t('anzeigename')}</label>
          <input id="profil-anzeigename" className="input" placeholder={t('anzeigename_ph')}
            value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
        </div>
        <div>
          <label className="label" htmlFor="profil-bio">{t('profil_bio')}</label>
          <textarea id="profil-bio" className="input resize-none" rows={3} maxLength={300} placeholder={t('profil_bio_ph')}
            value={form.public_bio} onChange={e => setForm(f => ({ ...f, public_bio: e.target.value }))} />
          <p className="mt-1.5 text-xs text-[var(--lg-text-3)]">{t('profil_bio_hinweis')}</p>
        </div>
        <button type="submit" className="lg-btn lg-btn-primary w-full" disabled={saving || !geaendert} data-profile-edit-save>
          {saving ? t('saving') : t('profil_speichern')}
        </button>
      </form>

      <div className="mt-6">
        <UeberDichKarte
          userId={userId}
          geladen
          goals={werte.goals}
          country={werte.country}
          gender={werte.profile_gender}
          onChange={patch => onChange({ werte: patch })}
          ohneKarte
        />
      </div>

      <div className="mt-6">
        <p className="label">{t('profil_bereich_training')}</p>
        <div className="flex flex-col gap-2">
          <AuswahlZeile
            label={t('profil_feld_favorite_exercise')}
            wert={uebungName}
            leer={t('profil_keine_auswahl')}
            disabled={!training}
            onClick={() => setAuswahl('uebung')}
            data-favorite-open
          />
          {werte.favorite_exercise && (
            <button
              type="button"
              className="min-h-11 self-start text-[15px] font-semibold text-[var(--lg-accent-text)]"
              onClick={() => void setzeTraining({ favorite_exercise: null }, { favoritName: null })}
              data-favorite-clear
            >
              {t('profil_lieblingsuebung_entfernen')}
            </button>
          )}
          <AuswahlZeile
            label={t('profil_feld_routine')}
            wert={routine?.name ?? null}
            leer={t('profil_keine_auswahl')}
            disabled={!training}
            onClick={() => setAuswahl('routine')}
            data-routine-open
          />
        </div>
        <p className="mt-1.5 text-xs text-[var(--lg-text-3)]">{t('profil_training_hinweis')}</p>
      </div>

      {auswahl === 'routine' && training && (
        <Sheet labelledBy="profil-routine-titel" tall onClose={() => setAuswahl(null)} data-routine-sheet>
          <div className="flex items-start justify-between gap-3">
            <h2 id="profil-routine-titel" className="lg-title2 pt-2">{t('profil_feld_routine')}</h2>
            <SheetClose onClick={() => setAuswahl(null)} />
          </div>
          <div className="mt-3 space-y-0.5">
            {[{ id: null, name: t('profil_keine_auswahl') }, ...training.routines.map(r => ({ id: r.id, name: r.name }))].map(r => {
              const aktiv = r.id === werte.profile_routine_id
              return (
                <button
                  key={r.id ?? 'keine'}
                  type="button"
                  aria-pressed={aktiv}
                  data-routine-option={r.id ?? ''}
                  onClick={() => {
                    setAuswahl(null)
                    if (!aktiv) void setzeTraining({ profile_routine_id: r.id }, { routineName: r.id ? r.name : null })
                  }}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[16px] text-[var(--lg-text)] ${aktiv ? 'bg-[var(--lg-fill-selected)] font-semibold' : ''}`}
                >
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  {aktiv && <Check size={16} aria-hidden="true" />}
                </button>
              )
            })}
            {training.routines.length === 0 && (
              <p className="px-3 pt-2 text-[14px] text-[var(--lg-text-3)]">{t('profil_keine_routinen')}</p>
            )}
          </div>
        </Sheet>
      )}

      {auswahl === 'uebung' && training && createPortal(
        <ExercisePicker
          sessions={training.sessions}
          customExercises={training.custom}
          multiple={false}
          onAddCustom={async exercise => {
            const saved = await insertCustomExercise(userId, exercise)
            setTraining(tr => tr && { ...tr, custom: [...tr.custom, saved] })
            return saved
          }}
          onClose={() => setAuswahl(null)}
          onPick={ids => {
            setAuswahl(null)
            const id = ids[0]
            if (!id || id === werte.favorite_exercise) return
            void setzeTraining({ favorite_exercise: id }, { favoritName: exerciseName(id, lang, training.custom) })
          }}
        />,
        document.body,
      )}
    </Sheet>
  )
}

function AuswahlZeile({ label, wert, leer, disabled, onClick, ...data }: {
  label: string
  wert: string | null
  leer: string
  disabled: boolean
  onClick: () => void
} & Record<`data-${string}`, boolean>) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={onClick}
      {...data}
      className="flex min-h-12 w-full items-center gap-3 rounded-[14px] bg-[var(--lg-fill)] px-3.5 text-left disabled:opacity-60"
    >
      <span className="shrink-0 text-[15px] text-[var(--lg-text-2)]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right text-[16px] text-[var(--lg-text)]">
        {wert ?? <span className="text-[var(--lg-text-3)]">{leer}</span>}
      </span>
      <ChevronRight size={18} className="shrink-0 text-[var(--lg-text-3)]" aria-hidden="true" />
    </button>
  )
}
