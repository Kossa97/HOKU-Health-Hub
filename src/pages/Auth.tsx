import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Eye, EyeOff, ScanFace } from 'lucide-react'
import { hapticErgebnis } from '../lib/haptics'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LANGUAGES, setLanguage } from '../i18n'
import { dotStore, useDotStand } from '../features/dot/dotStore'
import { useDotText, type DotTextKey } from '../features/dot/texte'
import { ConsentChecks } from '../features/compliance/components/ConsentChecks'
import { MedicalNotice } from '../features/compliance/components/MedicalNotice'
import { LegalLinks } from '../features/compliance/components/LegalLinks'
import { KEINE_ZUSTIMMUNG, vollstaendig, zustimmungsZeile } from '../features/compliance/lib/consent'
import { istEmail, pruefeLogin, pruefeRegistrierung, serverFehler, type LoginFeld, type RegFeld } from '../features/auth/lib/pruefung'
import { anmeldenMitName, benutzernameFrei, type NamensFehler } from '../features/auth/lib/anmelden'
import { merkeAngemeldetBleiben } from '../features/auth/lib/sitzung'
import { ANBIETER, mitAnbieter, rueckkehr, type Anbieter } from '../features/auth/lib/anbieter'
import { AppleLogo, GoogleLogo } from '../features/auth/AnbieterLogos'
import { PASSKEY_AN, anmeldenMitPasskey, merkePasskeyAnbieten, passkeyArt, passkeyAufGeraet, passkeyMoeglich } from '../features/auth/lib/passkey'
import '../features/auth/auth.css'

/**
 * Anmeldung mit Dot (docs/login/UEBERGABE.md). Drei Ansichten: Start (zwei
 * Knöpfe), Anmelden, Registrieren. Dot steht auf der Bühne oben — derselbe
 * Dot wie in der App (DotLayer über den Routen) — und zeigt, was passiert:
 * zuhören im Passwortfeld, denken beim Abschicken, rotes X bei Fehlern,
 * Kein-Netz-Symbol ohne Verbindung, Haken bei Erfolg.
 */

type Ansicht = 'start' | 'login' | 'register'
type Feld = LoginFeld | RegFeld
interface Meldung { feld: Feld | null; text: string; art: 'fehler' | 'info' }

// Zeiten aus dem Mockup: Denken vor dem Urteil des Servers, Dauer der Fehler
const DENKEN: Record<NamensFehler | 'erfolg', number> = { falsch: 900, viele: 900, fehler: 900, netz: 1400, erfolg: 1000 }
const ZEIGEN = { fehler: 1300, netz: 2500, haken: 800 }
// So lange blendet die Anmeldung aus, bevor das Portal die App zeigt
const VERLASSEN = 450
// So lange steht der Hinweis, dass der Name später gewählt wird
const HINWEIS = 3500
// Begrüßung (Mockup „Feinschliff"): Hand 2,6 s, Text 2,2 s (auf dem Start 15 % länger), Herz 2,4 s
const GRUSS = { hand: 2600, text: 2200, herz: 2400 }
const SAETZE: DotTextKey[] = ['login_hub', 'login_zurueck', 'login_hey']

const fuehlen = (ok: boolean) => { void hapticErgebnis(ok) }

export function Auth() {
  const { session } = useAuth()
  const { t, i18n } = useTranslation()
  const { dt } = useDotText()
  const weniger = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  // Was Dot gerade schreibt, auch als Text: für Screenreader, bei weniger Bewegung sichtbar
  const [satz, setSatz] = useState<DotTextKey | null>(null)
  const navigate = useNavigate()
  const stand = useDotStand()
  // Zurück von Apple/Google? Dann keine Eröffnung, sondern gleich der Ausgang
  const [zurueck] = useState(() => rueckkehr(window.location.search, window.location.hash))
  const [ansicht, setAnsicht] = useState<Ansicht>(zurueck.anbieter ? 'login' : 'start')
  const [von, setVon] = useState<'rechts' | 'links'>('rechts')
  const [email, setEmail] = useState('')
  // Anmelden: E-Mail oder Benutzername
  const [kennung, setKennung] = useState('')
  const [bleiben, setBleiben] = useState(true)
  const [passwort, setPasswort] = useState('')
  const [passwort2, setPasswort2] = useState('')
  const [benutzer, setBenutzer] = useState('')
  const [zustimmung, setZustimmung] = useState(KEINE_ZUSTIMMUNG)
  const [zeigePw, setZeigePw] = useState(false)
  const [meldung, setMeldung] = useState<Meldung | null>(null)
  const [laeuft, setLaeuft] = useState(() => !!zurueck.anbieter && !zurueck.fehler)
  const [nochmal, setNochmal] = useState(false)
  const [geschafft, setGeschafft] = useState(false)
  const [verlassen, setVerlassen] = useState(false)
  // Nach dem Erfolg bleibt die Seite stehen, bis Dot den Haken gezeigt hat
  const [halten, setHalten] = useState(() => !!zurueck.anbieter && !zurueck.fehler)
  const buehne = useRef<HTMLDivElement>(null)
  const lauf = useRef(0)
  const uhren = useRef<number[]>([])

  const dot = () => dotStore.api()
  const warte = (ms: number) => new Promise<void>(r => { uhren.current.push(window.setTimeout(r, Math.max(0, ms))) })

  // Die Bühne bei der Ebene anmelden: dort steht Dot, solange die Seite offen ist
  useEffect(() => {
    dotStore.setLoginBuehne(buehne.current)
    return () => dotStore.setLoginBuehne(null)
  }, [])
  useEffect(() => () => uhren.current.forEach(clearTimeout), [])

  /** Dot schreibt einen Satz und wird danach wieder zur Kugel. */
  async function schreibe(gen: number, key: DotTextKey, ms: number) {
    setSatz(key)
    if (weniger) return
    await vorbereitet.current
    if (gen !== lauf.current) return
    dot()?.zeigeText(dt(key))
    await warte(ms)
    if (gen === lauf.current) dot()?.zeigeText(null)
  }

  // Sobald er auf der Bühne steht: Eröffnung, dann winken, begrüßen, Herz
  const [faceId, setFaceId] = useState(false)
  useEffect(() => {
    if (!PASSKEY_AN || !passkeyAufGeraet()) return
    let aus = false
    void passkeyMoeglich().then(ja => { if (!aus) setFaceId(ja) })
    return () => { aus = true }
  }, [])
  const gegruesst = useRef(false)
  const anbieterSeit = useRef(0)
  const erfolgGestartet = useRef(false)
  // Zurück vom Anbieter und angemeldet: Haken, Portal, Heimflug wie nach dem Passwort —
  // sobald Sitzung und Bühne beide da sind, gleich in welcher Reihenfolge sie kommen
  useEffect(() => {
    if (!session || !zurueck.anbieter || zurueck.fehler || stand.modus !== 'login' || erfolgGestartet.current) return
    erfolgGestartet.current = true
    merkePasskeyAnbieten()
    void erfolg(lauf.current, anbieterSeit.current || performance.now())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal, sobald beides da ist
  }, [session, stand.modus])
  const vorbereitet = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => {
    const d = dotStore.api()
    if (stand.modus !== 'login' || gegruesst.current || !d) return
    gegruesst.current = true
    if (zurueck.anbieter) {
      window.history.replaceState(null, '', '/auth')
      if (zurueck.fehler) { void serverAntwort(lauf.current, 'fehler', 0, null, 'login_err_generic'); return }
      // Die Sitzung liest supabase-js selbst aus der Adresse; bis sie da ist, denkt Dot
      d.setStimmung('think'); anbieterSeit.current = performance.now()
      const gen = lauf.current
      uhren.current.push(window.setTimeout(() => { if (gen === lauf.current && !erfolgGestartet.current) void serverAntwort(gen, 'fehler', 0, null, 'login_err_generic') }, 10000))
      return
    }
    // Schrift laden und Sätze abtasten, während die Eröffnung läuft
    vorbereitet.current = d.bereiteTexte(SAETZE.map(k => dt(k)))
    const gen = lauf.current
    const dauer = d.eroeffnung()
    void (async () => {
      await warte(dauer ? dauer * 1000 - 400 : 500)
      if (gen !== lauf.current) return
      if (weniger) { setSatz('login_hub'); return }
      d.zeigeForm('hand')
      await warte(GRUSS.hand)
      if (gen !== lauf.current) return
      await schreibe(gen, 'login_hub', GRUSS.text * 1.15)
      if (gen !== lauf.current) return
      d.zeigeForm('heart')
      await warte(GRUSS.herz)
      if (gen === lauf.current) d.zeigeForm(null)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim ersten Betreten der Bühne
  }, [stand.modus])

  if (session && !halten) return <Navigate to="/" replace />

  /** Alles Laufende abbrechen: Abläufe, Dots Form, Meldung. */
  const abbrechen = () => {
    lauf.current++
    uhren.current.forEach(clearTimeout); uhren.current = []
    dot()?.setStimmung('idle'); dot()?.zeigeForm(null); dot()?.zeigeText(null); dot()?.setNeigung(0); setSatz(null)
    setLaeuft(false); setHalten(false); setMeldung(null); setNochmal(false); setGeschafft(false)
  }
  const wechsle = (ziel: Ansicht) => {
    abbrechen()
    setVon(ziel === 'start' ? 'links' : 'rechts')
    setZeigePw(false)
    setAnsicht(ziel)
    // Jedes Formular öffnet mit einem Satz von Dot
    if (ziel !== 'start') void schreibe(lauf.current, ziel === 'login' ? 'login_zurueck' : 'login_hey', GRUSS.text)
  }

  // Fokus: im Passwort hört er zu (Kreis), sonst neigt er sich zum Formular
  const beiFokus = (pw: boolean) => {
    if (laeuft) return
    dot()?.setStimmung(pw ? 'listen' : 'idle')
    dot()?.setNeigung(pw ? 0 : 10)
  }
  const beiVerlassen = () => {
    if (laeuft) return
    dot()?.setStimmung('idle'); dot()?.setNeigung(0)
  }

  /** Fehler im Gerät: sofort X und Schütteln, ohne Denken. */
  async function eingabeFehler(feld: Feld, text: string) {
    const gen = ++lauf.current
    setMeldung({ feld, text, art: 'fehler' })
    fuehlen(false)
    dot()?.setStimmung('idle'); dot()?.zeigeForm('cross')
    await warte(ZEIGEN.fehler)
    if (gen === lauf.current) dot()?.zeigeForm(null)
  }

  /** Antwort des Servers: denken lassen, dann X (falsch) oder Kein-Netz. */
  async function serverAntwort(gen: number, art: NamensFehler, seit: number, feld: Feld | null, falschText: string) {
    await warte(DENKEN[art] - (performance.now() - seit))
    if (gen !== lauf.current) return
    setHalten(false)
    dot()?.setStimmung('idle')
    fuehlen(false)
    if (art === 'netz') {
      setMeldung({ feld: null, text: 'login_err_net', art: 'fehler' }); setNochmal(true)
      dot()?.zeigeForm('wifi')
      setLaeuft(false)
      await warte(ZEIGEN.netz)
    } else {
      const text = art === 'viele' ? 'login_err_many' : art === 'fehler' ? 'login_err_generic' : falschText
      setMeldung({ feld: art === 'falsch' ? feld : null, text, art: 'fehler' })
      dot()?.zeigeForm('cross')
      setLaeuft(false)
      await warte(ZEIGEN.fehler)
    }
    if (gen === lauf.current) dot()?.zeigeForm(null)
  }

  /** Erfolg: denken, Haken, dann öffnet Dots Ring das Portal in die App und er fliegt heim. */
  async function erfolg(gen: number, seit: number) {
    await warte(DENKEN.erfolg - (performance.now() - seit))
    if (gen !== lauf.current) return
    setGeschafft(true)
    fuehlen(true)
    dot()?.setStimmung('joy')
    await warte(ZEIGEN.haken)
    if (gen !== lauf.current) return
    // Die Karte blendet aus, dann wechselt die Seite; das Portal zeigt die App (bei weniger Bewegung schlicht)
    if (dot()?.erfolg()) {
      setVerlassen(true)
      await warte(VERLASSEN)
      if (gen !== lauf.current) return
    }
    navigate('/', { replace: true })
  }

  async function anmelden(e: FormEvent) {
    e.preventDefault()
    if (laeuft) return
    const fehler = pruefeLogin(kennung, passwort)
    if (fehler) return void eingabeFehler(fehler.feld, fehler.text)
    const gen = ++lauf.current
    setMeldung(null); setNochmal(false); setLaeuft(true); setHalten(true)
    dot()?.zeigeForm(null); dot()?.setNeigung(0); dot()?.setStimmung('think')
    const seit = performance.now()
    // Mit @ direkt bei Supabase, sonst über die Edge Function (sie kennt die E-Mail zum Namen).
    // Ein abgebrochener fetch wirft, statt `error` zu liefern.
    const art: NamensFehler | null = istEmail(kennung)
      ? await supabase.auth.signInWithPassword({ email: kennung.trim(), password: passwort })
        .then(r => (r.error ? serverFehler(r.error) : null), (err: unknown) => serverFehler(err))
      : await anmeldenMitName(kennung, passwort)
    if (gen !== lauf.current) return
    if (art) return void serverAntwort(gen, art, seit, 'passwort', 'login_err_wrong')
    merkeAngemeldetBleiben(bleiben)
    merkePasskeyAnbieten()
    void erfolg(gen, seit)
  }

  async function registrieren(e: FormEvent) {
    e.preventDefault()
    if (laeuft) return
    const fehler = pruefeRegistrierung({ benutzer, email, passwort, passwort2, zugestimmt: vollstaendig(zustimmung) })
    if (fehler) return void eingabeFehler(fehler.feld, fehler.text)
    const gen = ++lauf.current
    setMeldung(null); setNochmal(false); setLaeuft(true); setHalten(true)
    dot()?.zeigeForm(null); dot()?.setNeigung(0); dot()?.setStimmung('think')
    const seit = performance.now()
    const name = benutzer.trim()
    // Die Zustimmung steht auch in den Konto-Metadaten: muss die E-Mail
    // erst bestaetigt werden, darf das Profil noch nicht geschrieben werden
    // — dann uebernimmt die Zustimmungsseite sie beim ersten Start.
    const frei = await benutzernameFrei(name)
    if (gen !== lauf.current) return
    if (frei === 'netz') return void serverAntwort(gen, 'netz', seit, null, 'login_err_generic')
    if (frei === false) return void serverAntwort(gen, 'falsch', seit, 'benutzer', 'login_err_user_taken')
    const felder = zustimmungsZeile(new Date())
    const antwort = await supabase.auth.signUp({ email: email.trim(), password: passwort, options: { data: { username: name, ...felder } } })
      .then(r => r, (err: unknown) => ({ data: { user: null, session: null }, error: err }))
    const error: unknown = antwort.error
    if (gen !== lauf.current) return
    if (error || !antwort.data.user) {
      const vorhanden = (error as { code?: string } | null)?.code === 'user_already_exists'
      return void serverAntwort(gen, serverFehler(error), seit, vorhanden ? 'email' : null, vorhanden ? 'login_err_exists' : 'login_err_generic')
    }
    // Registrieren bleibt immer angemeldet
    merkeAngemeldetBleiben(true)
    const { error: profilFehler } = await supabase.from('profiles').upsert({ id: antwort.data.user.id, username: name, ...felder })
      .then(r => r, (err: unknown) => ({ error: err }))
    if (gen !== lauf.current) return
    if (antwort.data.session) {
      merkePasskeyAnbieten()
      // Der Name wurde zwischen Prüfung und Anlegen vergeben: das Konto steht, der Name
      // kommt vorläufig (Zustimmungsseite) und lässt sich im Profil ändern
      if ((profilFehler as { code?: string } | null)?.code === '23505') {
        setMeldung({ feld: null, text: 'login_name_spaeter', art: 'info' })
        await warte(HINWEIS)
        if (gen !== lauf.current) return
      }
      return void erfolg(gen, seit)
    }
    // Ohne Sitzung wartet das Konto auf die Bestätigung der E-Mail
    await warte(DENKEN.erfolg - (performance.now() - seit))
    if (gen !== lauf.current) return
    setHalten(false); setLaeuft(false)
    fuehlen(true)
    dot()?.setStimmung('joy')
    setMeldung({ feld: null, text: 'account_created', art: 'info' })
  }

  const fehlerAn = (feld: Feld) => meldung?.art === 'fehler' && meldung.feld === feld
  const feldProps = (feld: Feld) => ({
    'aria-invalid': fehlerAn(feld) || undefined,
    'aria-describedby': fehlerAn(feld) ? 'auth-meldung' : undefined,
  })
  // Tippen nimmt die Fehlermarkierung und das „Erneut versuchen" zurück
  const tippe = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value)
    if (meldung?.art === 'fehler') setMeldung(null)
    setNochmal(false)
  }
  const meldungZeile = meldung && (
    <p id="auth-meldung" className="tyd-auth-meldung" data-art={meldung.art} role={meldung.art === 'fehler' ? 'alert' : 'status'}>
      {t(meldung.text)}
    </p>
  )
  const kopf = (titel: string) => (
    <div className="tyd-auth-kopf">
      <button type="button" className="tyd-auth-zurueck" onClick={() => wechsle('start')} aria-label={t('back')}>
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      <h2>{titel}</h2>
    </div>
  )
  const auge = (
    <button type="button" className="tyd-auth-auge" onClick={() => setZeigePw(v => !v)} aria-label={t(zeigePw ? 'login_pw_hide' : 'login_pw_show')} aria-pressed={zeigePw}>
      {zeigePw ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
    </button>
  )
  const sprache = i18n.language?.split('-')[0]
  /** Face ID: Passkey vom Gerät, danach derselbe Erfolg wie mit Passwort. */
  async function mitFaceId() {
    if (laeuft) return
    abbrechen()
    const gen = ++lauf.current
    setLaeuft(true); setHalten(true)
    dot()?.setStimmung('think')
    const seit = performance.now()
    const fehler = await anmeldenMitPasskey()
    if (gen !== lauf.current) return
    if (!fehler) return void erfolg(gen, seit)
    if (fehler === 'abgebrochen') { setLaeuft(false); setHalten(false); dot()?.setStimmung('idle'); return }
    if (fehler === 'unbekannt') setFaceId(false)
    void serverAntwort(gen, fehler === 'netz' ? 'netz' : 'falsch', seit, null, fehler === 'unbekannt' ? 'login_err_passkey_unbekannt' : 'login_err_generic')
  }
  async function anbieterStarten(a: Anbieter) {
    if (laeuft) return
    abbrechen()
    const gen = ++lauf.current
    setLaeuft(true)
    dot()?.setStimmung('think')
    const seit = performance.now()
    // Bei Erfolg verlässt die Seite die App; zurück kommt sie nur bei einem Fehler davor
    const art = await mitAnbieter(a)
    if (art && gen === lauf.current) void serverAntwort(gen, art, seit, null, 'login_err_generic')
  }
  const anbieterKnoepfe = ANBIETER.length > 0 && (
    <>
      {ANBIETER.map(a => (
        <button key={a} type="button" className="tyd-auth-knopf" data-art={a} disabled={laeuft} onClick={() => void anbieterStarten(a)} data-auth-anbieter={a}>
          {a === 'apple' ? <AppleLogo /> : <GoogleLogo />}
          <span>{t(a === 'apple' ? 'login_apple' : 'login_google')}</span>
        </button>
      ))}
      <div className="tyd-auth-oder"><span>{t('login_oder')}</span></div>
    </>
  )

  return (
    <main className="tyd-auth" data-verlassen={verlassen || undefined}>
      <div className="tyd-auth-top">
        <div className="tyd-auth-sprache" role="group" aria-label={t('language')}>
          {LANGUAGES.map(l => (
            <button key={l.code} type="button" lang={l.code} aria-pressed={sprache === l.code} onClick={() => setLanguage(l.code)}>
              {l.code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div ref={buehne} className="tyd-auth-buehne" aria-hidden="true" data-dot-buehne />
      <p className={weniger ? 'tyd-auth-gruss' : 'tyd-auth-sr'} role="status">{satz ? dt(satz).replace('\n', ' ') : ''}</p>

      <div className="tyd-auth-karte">
        {ansicht === 'start' && (
          <div key="start" className="tyd-auth-ansicht" data-von={von}>
            <button type="button" className="tyd-auth-knopf" data-art="haupt" onClick={() => wechsle('login')} data-auth-start-login>
              {t('auth_tab_login')}
            </button>
            <button type="button" className="tyd-auth-knopf" data-art="glas" onClick={() => wechsle('register')} data-auth-start-register>
              {t('auth_tab_register')}
            </button>
          </div>
        )}

        {ansicht === 'login' && (
          <form key="login" className="tyd-auth-ansicht" data-von={von} onSubmit={anmelden} noValidate>
            {kopf(t('auth_tab_login'))}
            {anbieterKnoepfe}
            <div className="tyd-auth-feld">
              <label className="tyd-auth-sr" htmlFor="auth-kennung">{t('login_id')}</label>
              <input id="auth-kennung" type="text" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                placeholder={t('login_id')} value={kennung} onChange={tippe(setKennung)}
                onFocus={() => beiFokus(false)} onBlur={beiVerlassen} {...feldProps('kennung')} />
            </div>
            <div className="tyd-auth-feld">
              <label className="tyd-auth-sr" htmlFor="auth-pw">{t('password')}</label>
              <input id="auth-pw" type={zeigePw ? 'text' : 'password'} autoComplete="current-password"
                placeholder={t('password')} value={passwort} onChange={tippe(setPasswort)}
                onFocus={() => beiFokus(true)} onBlur={beiVerlassen} {...feldProps('passwort')} />
              {auge}
            </div>
            <label className="tyd-auth-schalter">
              <input type="checkbox" checked={bleiben} onChange={e => setBleiben(e.target.checked)} data-auth-bleiben />
              <span className="tyd-auth-spur" aria-hidden="true" />
              <span>{t('login_remember')}</span>
            </label>
            {meldungZeile}
            <div className="tyd-auth-zeile">
              <button className="tyd-auth-knopf" data-art="haupt" data-ok={geschafft} type="submit" disabled={laeuft} data-auth-submit>
                {laeuft ? t('login_signing_in') : nochmal ? t('login_retry') : t('auth_tab_login')}
              </button>
              {faceId && (
                <button type="button" className="tyd-auth-knopf" data-art="glas" data-symbol disabled={laeuft} onClick={() => void mitFaceId()}
                  aria-label={t('login_faceid', { art: passkeyArt() })} data-auth-faceid>
                  <ScanFace size={26} aria-hidden="true" />
                </button>
              )}
            </div>
          </form>
        )}

        {ansicht === 'register' && (
          <form key="register" className="tyd-auth-ansicht" data-von={von} onSubmit={registrieren} noValidate>
            {kopf(t('auth_tab_register'))}
            {anbieterKnoepfe}
            <div className="tyd-auth-feld">
              <label className="tyd-auth-sr" htmlFor="auth-user">{t('username')}</label>
              <input id="auth-user" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
                placeholder={t('username')} value={benutzer} onChange={tippe(setBenutzer)}
                onFocus={() => beiFokus(false)} onBlur={beiVerlassen} {...feldProps('benutzer')} />
            </div>
            <div className="tyd-auth-feld">
              <label className="tyd-auth-sr" htmlFor="auth-reg-email">{t('email')}</label>
              <input id="auth-reg-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                placeholder={t('email')} value={email} onChange={tippe(setEmail)}
                onFocus={() => beiFokus(false)} onBlur={beiVerlassen} {...feldProps('email')} />
            </div>
            <div className="tyd-auth-feld">
              <label className="tyd-auth-sr" htmlFor="auth-reg-pw">{t('password')}</label>
              <input id="auth-reg-pw" type={zeigePw ? 'text' : 'password'} autoComplete="new-password"
                placeholder={t('login_pw_new')} value={passwort} onChange={tippe(setPasswort)}
                onFocus={() => beiFokus(true)} onBlur={beiVerlassen} {...feldProps('passwort')} />
              {auge}
            </div>
            <div className="tyd-auth-feld">
              <label className="tyd-auth-sr" htmlFor="auth-reg-pw2">{t('login_pw_repeat')}</label>
              <input id="auth-reg-pw2" type={zeigePw ? 'text' : 'password'} autoComplete="new-password"
                placeholder={t('login_pw_repeat')} value={passwort2} onChange={tippe(setPasswort2)}
                onFocus={() => beiFokus(true)} onBlur={beiVerlassen} {...feldProps('passwort2')} />
            </div>
            <div {...(fehlerAn('zustimmung') ? { 'aria-describedby': 'auth-meldung' } : {})}>
              <ConsentChecks value={zustimmung} onChange={v => { setZustimmung(v); if (fehlerAn('zustimmung')) setMeldung(null) }} />
            </div>
            {meldungZeile}
            <button className="tyd-auth-knopf" data-art="haupt" data-ok={geschafft} type="submit" disabled={laeuft} data-auth-submit>
              {laeuft ? t('loading') : nochmal ? t('login_retry') : t('create_account')}
            </button>
            <MedicalNotice />
          </form>
        )}
      </div>

      <p className="tyd-auth-fuss">{t('research_only')}</p>
      <LegalLinks className="mt-3" />
    </main>
  )
}
