import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import {
  KEINE_ZUSTIMMUNG, geburtsdatumAusMetadaten, geburtsdatumZeile, heuteLokal, pruefeGeburtsdatum, vollstaendig,
  zustimmungAusMetadaten, zustimmungFehlt, zustimmungsZeile, type ConsentRow,
} from '../lib/consent'
import { GEBURTSDATUM_MIN } from '../../blutwerte/lib/bioProfile'
import { ConsentChecks } from './ConsentChecks'
import { MedicalNotice } from './MedicalNotice'
import { LegalLinks } from './LegalLinks'
import { SilhouettenHuelle } from '../../../components/ui/Silhouette'

/**
 * `profiles.username` ist Pflicht: Gibt es noch keine Profilzeile (etwa
 * weil die Registrierung auf die E-Mail-Bestaetigung wartete), wird sie mit
 * dem Nutzernamen aus der Registrierung angelegt — sonst nur ergaenzt.
 */
async function speichereZustimmung(
  userId: string,
  profilDa: boolean,
  zustimmung: Partial<ConsentRow> & { birth_date?: string; age?: number | null },
  meta: Record<string, unknown> | undefined,
): Promise<boolean> {
  if (!Object.keys(zustimmung).length) return true
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

/** Was auf der Seite noch fehlt. */
interface Fehlt { zustimmung: boolean; geburt: boolean }

/**
 * Vor der App: fehlt die Zustimmung (Bestandskonten, neue Fassung der
 * Bedingungen, neue Konten über Apple/Google), kommt erst diese Seite — mit
 * Geburtsdatum (ab 18), falls das Profil keins hat. Steht beides aus der
 * Registrierung in den Konto-Metadaten, wird es still ins Profil uebernommen.
 *
 * Kann das Profil nicht gelesen werden (offline, Fehler), laesst die Sperre
 * durch: wer schon zugestimmt hat, soll nicht ausgesperrt werden, und die
 * Pruefung kommt beim naechsten Start wieder.
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const userId = user?.id ?? null
  const [ergebnis, setErgebnis] = useState<{ fuer: string; fehlt: Fehlt | null; profilDa: boolean } | null>(null)
  const [auswahl, setAuswahl] = useState(KEINE_ZUSTIMMUNG)
  const [geburt, setGeburt] = useState('')
  const [geburtFehler, setGeburtFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)

  useEffect(() => {
    if (!userId) return
    let aktuell = true
    const heute = heuteLokal()
    const metaZustimmung = zustimmungAusMetadaten(user?.user_metadata)
    const metaGeburt = geburtsdatumAusMetadaten(user?.user_metadata, heute)
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('age_confirmed_at, terms_accepted_at, terms_version, birth_date')
        .eq('id', userId)
        .maybeSingle()
      if (!aktuell) return
      if (error) return setErgebnis({ fuer: userId, fehlt: null, profilDa: true })
      const profilDa = Boolean(data)
      const ohneGeburt = !(data as { birth_date?: string | null } | null)?.birth_date
      // Das Geburtsdatum wird nur zusammen mit der Zustimmung verlangt (neue Konten über
      // Apple/Google, neue Fassung der Bedingungen). Im Körperprofil darf man es löschen,
      // ohne dass danach bei jedem Start diese Seite kommt.
      const fehlt: Fehlt = { zustimmung: zustimmungFehlt(data as ConsentRow | null), geburt: false }
      fehlt.geburt = fehlt.zustimmung && ohneGeburt
      // Aus der Registrierung übernehmen, was dort schon angegeben wurde
      const uebernehmen = {
        ...(fehlt.zustimmung && metaZustimmung ? metaZustimmung : {}),
        ...(ohneGeburt && metaGeburt ? geburtsdatumZeile(metaGeburt, heute) : {}),
      }
      let angelegt = false
      if (Object.keys(uebernehmen).length) {
        const ok = await speichereZustimmung(userId, profilDa, uebernehmen, user?.user_metadata)
        if (!aktuell) return
        angelegt = ok
        if (ok) {
          if (fehlt.zustimmung && metaZustimmung) fehlt.zustimmung = false
          if (fehlt.geburt && metaGeburt) fehlt.geburt = false
        }
      }
      const offen = fehlt.zustimmung || fehlt.geburt
      setErgebnis({ fuer: userId, fehlt: offen ? fehlt : null, profilDa: profilDa || angelegt })
    })()
    return () => { aktuell = false }
  }, [userId, user?.user_metadata])

  const gilt = ergebnis && ergebnis.fuer === userId ? ergebnis : null
  if (!gilt) return <SilhouettenHuelle pfad={pathname} />
  if (!gilt.fehlt) return <>{children}</>
  const fehlt = gilt.fehlt

  const bestaetigen = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!userId) return
    const heute = heuteLokal()
    if (fehlt.geburt) {
      const f = pruefeGeburtsdatum(geburt, heute)
      setGeburtFehler(f)
      if (f) return
    }
    if (fehlt.zustimmung && !vollstaendig(auswahl)) return toast.error(t('consent_required'))
    setSpeichert(true)
    const ok = await speichereZustimmung(userId, gilt.profilDa, {
      ...(fehlt.zustimmung ? zustimmungsZeile(new Date()) : {}),
      ...(fehlt.geburt ? geburtsdatumZeile(geburt, heute) : {}),
    }, user?.user_metadata)
    setSpeichert(false)
    if (!ok) return toast.error(t('error'))
    setErgebnis({ fuer: userId, fehlt: null, profilDa: true })
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
          {fehlt.geburt && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="consent-geburt" className="text-[15px] font-medium">{t('login_birth')}</label>
              <input id="consent-geburt" type="date" autoComplete="bday" min={GEBURTSDATUM_MIN} max={heuteLokal()}
                value={geburt} onChange={e => { setGeburt(e.target.value); setGeburtFehler(null) }}
                aria-invalid={!!geburtFehler || undefined} aria-describedby={geburtFehler ? 'consent-geburt-fehler' : 'consent-geburt-hinweis'}
                className="input" data-consent-geburt />
              {geburtFehler
                ? <p id="consent-geburt-fehler" role="alert" className="text-[13px] text-[var(--lg-bad,#ff453a)]">{t(geburtFehler)}</p>
                : <p id="consent-geburt-hinweis" className="text-[13px] text-[var(--lg-text-2)]">{t('consent_birth_hint')}</p>}
            </div>
          )}
          {fehlt.zustimmung && <ConsentChecks value={auswahl} onChange={setAuswahl} />}
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
