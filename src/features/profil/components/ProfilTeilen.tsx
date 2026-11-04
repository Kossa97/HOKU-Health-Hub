import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, Copy, Share, X } from 'lucide-react'
import { Sheet } from '../../compliance/components/Sheet'
import { Schalter } from '../../../components/ui/Schalter'
import { HokuCode } from './HokuCode'
import { hokuCodeAddress } from '../lib/hokuCode'
import { linkKarte, teilenStand, type LinkKarte } from '../lib/shareCard'
import type { ProgressArea } from '../lib/progressScore'
import type { Visibility } from '../lib/profileVisibility'
import { kopiereText, teileLink } from '../lib/teilen'

/** Welcher Knopf zuletzt kopiert hat: dort steht kurz „Kopiert“. */
type Quelle = 'teilen' | 'link' | 'zeile' | 'voll-teilen' | 'voll-link'

const KARTE_TEXT: Record<LinkKarte, string> = {
  fortschritt: 'profil_teilen_karte_fortschritt',
  rueckfall: 'profil_teilen_karte_rueckfall',
  neutral: 'profil_teilen_karte_neutral',
}

const KOPIERT_MS = 1600

/**
 * Sheet „Profil teilen“ (Spec 2c, 4.4/4.5): kleiner Hoku-Code (antippen →
 * Vollbild), „Teilen …“, „Link kopieren“, Adresszeile, Statuszeile mit der
 * Link-Karte und „Ändern ›“, Messenger-Hinweis. Bei Web-Link aus der Hinweis mit
 * Schalter „Web-Link einschalten“, bei privatem Profil ein eigener Hinweis.
 *
 * Kein Knopf „Helligkeit hoch“ (Spec-Frage 11): ohne Plugin lässt sich die
 * Bildschirmhelligkeit nicht setzen.
 */
export function ProfilTeilen({
  url, name, username, webLink, privat, progressVisibility, progress, onClose, onGeteilt, onWebLinkEinschalten,
}: {
  /** Öffentliche Adresse (`hokuCodeUrl`): dieselbe im Code, in der Zeile und beim Teilen. */
  url: string
  name: string
  username: string
  webLink: boolean
  privat: boolean
  /** Stufe und Stand des Gesamtfortschritts: daraus folgt die Link-Karte (Spec 3.3). */
  progressVisibility: Visibility
  progress: { total: number | null; areas: Partial<Record<ProgressArea, number | null>> } | null
  onClose: () => void
  /** Geteilt oder kopiert: vergibt „Profil geteilt“. */
  onGeteilt: () => void
  /** Schreibt `web_link_enabled = true`; `false`, wenn es nicht gespeichert wurde. */
  onWebLinkEinschalten: () => Promise<boolean>
}) {
  const { t } = useTranslation()
  const titelId = `teilen-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const [vollbild, setVollbild] = useState(false)
  const [kopiert, setKopiert] = useState<Quelle | null>(null)
  const [meldung, setMeldung] = useState('')
  const [schaltet, setSchaltet] = useState(false)
  const codeKnopf = useRef<HTMLButtonElement>(null)
  const teilenKnopf = useRef<HTMLButtonElement>(null)
  const aendernLink = useRef<HTMLAnchorElement>(null)
  const zeitgeber = useRef<number | undefined>(undefined)
  const adresse = hokuCodeAddress(url)
  const stand = teilenStand({ webLink, privat })
  const karte = linkKarte({ stand, progressVisibility, progress })
  const fehler = meldung !== '' && !kopiert

  useEffect(() => () => window.clearTimeout(zeitgeber.current), [])
  // Fokus ins Sheet: sonst bliebe er auf der Seite dahinter, und Escape erreichte das Sheet nicht
  useEffect(() => { teilenKnopf.current?.focus({ preventScroll: true }) }, [])

  const zeigeKopiert = (quelle: Quelle) => {
    setKopiert(quelle)
    setMeldung(t('link_kopiert'))
    window.clearTimeout(zeitgeber.current)
    zeitgeber.current = window.setTimeout(() => { setKopiert(null); setMeldung('') }, KOPIERT_MS)
  }
  const zeigeFehler = () => {
    window.clearTimeout(zeitgeber.current)
    setKopiert(null)
    setMeldung(t('profil_teilen_fehler'))
  }

  const teilen = async (quelle: Quelle) => {
    const ergebnis = await teileLink({ title: name, url })
    if (ergebnis === 'fehler') return zeigeFehler()
    if (ergebnis === 'abgebrochen') return
    if (ergebnis === 'kopiert') zeigeKopiert(quelle)
    else setMeldung('') // geteilt: ein alter Fehler gilt nicht mehr
    onGeteilt()
  }
  const kopieren = async (quelle: Quelle) => {
    if (!(await kopiereText(url))) return zeigeFehler()
    zeigeKopiert(quelle)
    onGeteilt()
  }

  const einschalten = async () => {
    if (schaltet) return
    setSchaltet(true)
    try {
      // Der Schalter verschwindet mit dem Einschalten: Fokus auf „Ändern ›“ der neuen Statuszeile
      if (await onWebLinkEinschalten()) window.requestAnimationFrame(() => aendernLink.current?.focus({ preventScroll: true }))
    } finally {
      setSchaltet(false)
    }
  }

  const schliesseVollbild = () => {
    setVollbild(false)
    // Fokus zurück auf den Code, von dem das Vollbild kam
    window.requestAnimationFrame(() => codeKnopf.current?.focus({ preventScroll: true }))
  }

  return (
    <>
      <Sheet labelledBy={titelId} onClose={onClose} data-share-sheet>
        <h2 id={titelId} className="lg-title2">{t('profil_teilen')}</h2>
        <p className="mt-0.5 text-[14px] leading-snug text-[var(--lg-text-3)]">{t('profil_teilen_sub')}</p>

        <div className="mt-4 grid grid-cols-[124px_minmax(0,1fr)] items-center gap-3.5">
          <button
            ref={codeKnopf}
            type="button"
            aria-haspopup="dialog"
            aria-label={t('profil_teilen_vollbild_zeigen')}
            onClick={() => setVollbild(true)}
            className="teilen-code-knopf grid justify-items-center gap-1.5 text-[12px] text-[var(--lg-text-3)]"
            data-share-code-open
          >
            <HokuCode url={url} className="h-[124px] w-[124px]" />
            <span aria-hidden="true">{t('profil_teilen_antippen')}</span>
          </button>
          <div className="grid min-w-0 gap-2">
            <button ref={teilenKnopf} type="button" className="lg-btn lg-btn-primary !min-h-11 !px-3" onClick={() => void teilen('teilen')} data-share-native>
              {kopiert === 'teilen' ? <Check size={16} aria-hidden="true" /> : <Share size={16} aria-hidden="true" />}
              <span className="truncate">{kopiert === 'teilen' ? t('profil_teilen_kopiert') : t('profil_teilen_teilen')}</span>
            </button>
            <button type="button" className="lg-gray-btn !min-h-11 !px-3" onClick={() => void kopieren('link')} data-share-copy>
              {kopiert === 'link' ? <Check size={16} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              <span className="truncate">{kopiert === 'link' ? t('profil_teilen_kopiert') : t('profil_teilen_link_kopieren')}</span>
            </button>
          </div>
        </div>

        <div className="mt-3.5 flex items-center gap-2 rounded-[13px] bg-[var(--lg-fill)] py-1.5 pl-3 pr-1.5">
          <span className="min-w-0 flex-1 font-mono text-[13.5px] leading-snug text-[var(--lg-text)] [overflow-wrap:anywhere] [user-select:all]" data-share-address>
            {/* Lange Namen umbrechen nach „/u/“, nicht mitten im Namen */}
            {adresse.slice(0, adresse.lastIndexOf('/') + 1)}<wbr />{adresse.slice(adresse.lastIndexOf('/') + 1)}
          </span>
          <button type="button" className="lg-gray-btn !min-h-9 shrink-0 !px-3 !text-[14px]" onClick={() => void kopieren('zeile')} data-share-copy-row>
            {kopiert === 'zeile' ? t('profil_teilen_kopiert') : t('profil_teilen_kopieren')}
          </button>
        </div>

        {stand === 'an' ? (
          <div role="status" className="mt-3 flex items-baseline justify-between gap-3 text-[13px] text-[var(--lg-text-3)]" data-share-status="an" data-share-card={karte}>
            <span className="min-w-0">
              <span className="font-semibold text-[var(--lg-text)]">{t('profil_teilen_weblink_an')}</span>
              {' · '}{t(KARTE_TEXT[karte])}
            </span>
            <Link ref={aendernLink} to="/profil/einstellungen" className="teilen-aendern" data-share-change>
              {t('profil_teilen_aendern')}<ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="mt-3 rounded-[14px] bg-[var(--lg-fill)] px-3.5 py-3" data-share-status={stand} data-share-card={karte}>
            <div className="flex items-baseline justify-between gap-3 text-[13px] text-[var(--lg-text-3)]">
              <span className="min-w-0">
                <span className="font-semibold text-[var(--lg-text)]">{t(stand === 'privat' ? 'profil_teilen_privat' : 'profil_teilen_weblink_aus')}</span>
                {' · '}{t(KARTE_TEXT[karte])}
              </span>
              {stand === 'privat' && (
                <Link to="/profil/einstellungen" className="teilen-aendern" data-share-change>
                  {t('profil_teilen_aendern')}<ChevronRight size={14} aria-hidden="true" />
                </Link>
              )}
            </div>
            <p className="mt-1.5 text-[14px] leading-snug text-[var(--lg-text-2)]" data-share-hint>
              {t(stand === 'privat' ? 'profil_teilen_privat_hinweis' : 'profil_teilen_weblink_aus_hinweis')}
            </p>
            {stand === 'aus' && (
              <button
                type="button"
                role="switch"
                aria-checked={false}
                aria-busy={schaltet || undefined}
                disabled={schaltet}
                onClick={() => void einschalten()}
                className="mt-2 flex min-h-11 w-full items-center gap-3 text-left text-[16px] text-[var(--lg-text)] disabled:opacity-60"
                data-share-weblink-on
              >
                <span className="min-w-0 flex-1">{t('profil_teilen_weblink_einschalten')}</span>
                <Schalter an={false} />
              </button>
            )}
          </div>
        )}

        <p className="mt-3 text-[12.5px] leading-snug text-[var(--lg-text-3)]" data-share-messenger>{t('profil_teilen_messenger')}</p>
        <p className="sr-only" role="status" aria-live="polite">{meldung}</p>
        {fehler && <p className="mt-2 text-[13px] text-[var(--lg-bad-text)]" data-share-error>{meldung}</p>}
      </Sheet>

      {vollbild && (
        <HokuCodeVollbild
          url={url}
          name={name}
          username={username}
          kopiert={kopiert}
          fehler={fehler ? meldung : null}
          onClose={schliesseVollbild}
          onTeilen={() => void teilen('voll-teilen')}
          onKopieren={() => void kopieren('voll-link')}
        />
      )}
    </>
  )
}

/**
 * Vollbild zum Vorzeigen: Code 300 px, Name, @nick, Hinweis, Teilen und
 * Kopieren. Immer dunkel auf hell, unabhängig vom Erscheinungsbild; die Ränder
 * halten Abstand zu Notch und Home-Leiste. Zurück-Geste und Escape schließen
 * nur das Vollbild, das Sheet darunter bleibt.
 */
function HokuCodeVollbild({ url, name, username, kopiert, fehler, onClose, onTeilen, onKopieren }: {
  url: string
  name: string
  username: string
  kopiert: Quelle | null
  /** Kopieren scheiterte: das Sheet mit seiner Meldung liegt verdeckt darunter. */
  fehler: string | null
  onClose: () => void
  onTeilen: () => void
  onKopieren: () => void
}) {
  const { t } = useTranslation()
  const titelId = `vollbild-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const schliessen = useRef<HTMLButtonElement>(null)

  useEffect(() => { schliessen.current?.focus({ preventScroll: true }) }, [])

  return (
    <div
      data-app-modal
      role="dialog"
      aria-modal="true"
      aria-labelledby={titelId}
      className="hoku-vollbild fixed inset-0 z-[80] grid grid-rows-[auto_minmax(0,1fr)_auto]"
      onKeyDown={event => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onClose()
      }}
      data-share-fullscreen
    >
      <div className="flex px-4 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
        <button
          ref={schliessen}
          type="button"
          data-app-back-close
          aria-label={t('close')}
          onClick={onClose}
          className="hoku-vollbild-knopf grid h-11 w-11 place-items-center rounded-full"
          data-share-fullscreen-close
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="hoku-vollbild-buehne grid content-center justify-items-center gap-3.5 overflow-hidden px-5 text-center">
        <HokuCode url={url} className="aspect-square w-[min(300px,78vw,46dvh)]" />
        <h2 id={titelId} className="mt-1 max-w-full truncate text-[22px] font-semibold leading-tight">{name}</h2>
        <p className="-mt-2.5 max-w-full truncate font-mono text-[14px] text-[var(--hoku-vollbild-t2)]">@{username}</p>
        <p className="max-w-[30ch] text-[14px] leading-snug text-[var(--hoku-vollbild-t2)]">{t('profil_teilen_scannen')}</p>
        <p role="status" aria-live="polite" className="max-w-[34ch] text-[13px] leading-snug text-[#b3261e]" data-share-fullscreen-error>
          {fehler}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3">
        <button type="button" className="hoku-vollbild-knopf hoku-vollbild-primaer min-h-12 rounded-[14px] px-3 text-[15px] font-semibold" onClick={onTeilen} data-share-fullscreen-native>
          {kopiert === 'voll-teilen' ? t('profil_teilen_kopiert') : t('profil_teilen_teilen')}
        </button>
        <button type="button" className="hoku-vollbild-knopf min-h-12 rounded-[14px] px-3 text-[15px] font-semibold" onClick={onKopieren} data-share-fullscreen-copy>
          {kopiert === 'voll-link' ? t('profil_teilen_kopiert') : t('profil_teilen_link_kopieren')}
        </button>
      </div>
    </div>
  )
}
