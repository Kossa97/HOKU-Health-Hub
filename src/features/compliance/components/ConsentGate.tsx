import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { KEINE_ZUSTIMMUNG, vollstaendig, zustimmungAusMetadaten, zustimmungFehlt, zustimmungsZeile, type ConsentRow } from '../lib/consent'
import { ConsentChecks } from './ConsentChecks'
import { MedicalNotice } from './MedicalNotice'
import { LegalLinks } from './LegalLinks'

/**
 * `profiles.username` ist Pflicht: Gibt es noch keine Profilzeile (etwa
 * weil die Registrierung auf die E-Mail-Bestaetigung wartete), wird sie mit
 * dem Nutzernamen aus der Registrierung angelegt — sonst nur ergaenzt.
 */
async function speichereZustimmung(
  userId: string,
  profilDa: boolean,
  zustimmung: ConsentRow,
  meta: Record<string, unknown> | undefined,
): Promise<boolean> {
  if (profilDa) {
    const { error } = await supabase.from('profiles').update(zustimmung).eq('id', userId)
    return !error
  }
  const ersatz = `user_${userId.slice(0, 8)}`
  const gewuenscht = typeof meta?.username === 'string' && meta.username.trim() ? meta.username.trim() : ersatz
  const { error } = await supabase.from('profiles').insert({ id: userId, username: gewuenscht, ...zustimmung })
  if (!error || gewuenscht === ersatz) return !error
  // Name inzwischen vergeben: mit Ersatznamen anlegen — aendern geht im Profil.
  const { error: zweiterFehler } = await supabase.from('profiles').insert({ id: userId, username: ersatz, ...zustimmung })
  return !zweiterFehler
}

/**
 * Vor der App: fehlt die Zustimmung (Bestandskonten, neue Fassung der
 * Bedingungen), kommt erst diese Seite. Steht sie aus der Registrierung in
 * den Konto-Metadaten, wird sie still ins Profil uebernommen.
 *
 * Kann das Profil nicht gelesen werden (offline, Fehler), laesst die Sperre
 * durch: wer schon zugestimmt hat, soll nicht ausgesperrt werden, und die
 * Pruefung kommt beim naechsten Start wieder.
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { t } = useTranslation()
  const userId = user?.id ?? null
  const [ergebnis, setErgebnis] = useState<{ fuer: string; fehlt: boolean; profilDa: boolean } | null>(null)
  const [auswahl, setAuswahl] = useState(KEINE_ZUSTIMMUNG)
  const [speichert, setSpeichert] = useState(false)

  useEffect(() => {
    if (!userId) return
    let aktuell = true
    const meta = zustimmungAusMetadaten(user?.user_metadata)
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('age_confirmed_at, terms_accepted_at, terms_version')
        .eq('id', userId)
        .maybeSingle()
      if (!aktuell) return
      if (error) return setErgebnis({ fuer: userId, fehlt: false, profilDa: true })
      const profilDa = Boolean(data)
      if (!zustimmungFehlt(data as ConsentRow | null)) return setErgebnis({ fuer: userId, fehlt: false, profilDa })
      if (meta) {
        const ok = await speichereZustimmung(userId, profilDa, meta, user?.user_metadata)
        if (!aktuell) return
        return setErgebnis({ fuer: userId, fehlt: !ok, profilDa })
      }
      setErgebnis({ fuer: userId, fehlt: true, profilDa })
    })()
    return () => { aktuell = false }
  }, [userId, user?.user_metadata])

  const gilt = ergebnis && ergebnis.fuer === userId ? ergebnis : null
  if (!gilt) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
    </div>
  )
  if (!gilt.fehlt) return <>{children}</>

  const bestaetigen = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!vollstaendig(auswahl) || !userId) return toast.error(t('consent_required'))
    setSpeichert(true)
    const ok = await speichereZustimmung(userId, gilt.profilDa, zustimmungsZeile(new Date()), user?.user_metadata)
    setSpeichert(false)
    if (!ok) return toast.error(t('error'))
    setErgebnis({ fuer: userId, fehlt: false, profilDa: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10" data-consent-gate>
      <form onSubmit={bestaetigen} className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 grid h-16 w-16 place-items-center rounded-[16px] bg-[linear-gradient(180deg,#0a84ff,#00a9d4)]">
            <FlaskConical className="text-white" size={32} aria-hidden="true" />
          </div>
          <h1 className="lg-title2 !text-[24px]">{t('consent_title')}</h1>
          <p className="mt-1 text-[15px] leading-snug text-[var(--lg-text-2)]">{t('consent_desc')}</p>
        </div>
        <div className="card flex flex-col gap-4">
          <ConsentChecks value={auswahl} onChange={setAuswahl} />
          <MedicalNotice />
          <button type="submit" data-consent-submit className="lg-btn lg-btn-primary w-full" disabled={speichert}>
            {speichert ? t('loading') : t('consent_continue')}
          </button>
        </div>
        <button type="button" onClick={() => void signOut()} className="mt-3 min-h-11 w-full text-center text-[15px] text-[var(--lg-text-2)] underline-offset-2 hover:underline">
          {t('logout')}
        </button>
        <LegalLinks className="mt-6" />
      </form>
    </div>
  )
}
