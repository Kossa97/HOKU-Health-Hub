import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ScanFace } from 'lucide-react'
import { Sheet } from '../../compliance/components/Sheet'
import { useDotStand } from '../../dot/dotStore'
import { passkeyArt, passkeyNachfrageFaellig, passkeyNichtFragen, richtePasskeyEin } from '../lib/passkey'

/**
 * Nach einer Anmeldung ohne Passkey fragt die App einmal, ob Face ID
 * eingerichtet werden soll — erst, wenn Dot gelandet ist, damit die
 * Erfolgs-Animation ungestört bleibt.
 */
export function PasskeyNachfrage() {
  const { t } = useTranslation()
  const stand = useDotStand()
  const [offen, setOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const imPortal = stand.modus === 'portal'

  useEffect(() => {
    if (imPortal) return
    let aus = false
    const uhr = window.setTimeout(() => { void passkeyNachfrageFaellig().then(ja => { if (ja && !aus) setOffen(true) }) }, 1200)
    return () => { aus = true; window.clearTimeout(uhr) }
  }, [imPortal])

  if (!offen) return null
  const art = passkeyArt()
  const spaeter = () => { passkeyNichtFragen(); setOffen(false) }
  const einrichten = async () => {
    setLaeuft(true)
    const fehler = await richtePasskeyEin()
    setLaeuft(false)
    if (fehler === 'abgebrochen') return
    setOffen(false)
    if (fehler) toast.error(t('passkey_fehler', { art }))
    else toast.success(t('passkey_eingerichtet', { art }))
  }

  return (
    <Sheet labelledBy="passkey-frage-titel" busy={laeuft} onClose={spaeter} data-passkey-nachfrage>
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <span className="lg-icon-tile !h-12 !w-12" style={{ background: '#0a84ff' }}><ScanFace size={26} aria-hidden="true" /></span>
        <h2 id="passkey-frage-titel" className="lg-title2 !text-[22px]">{t('passkey_frage_titel', { art })}</h2>
        <p className="text-[15px] leading-snug text-[var(--lg-text-2)]">{t('passkey_frage_text', { art })}</p>
        <button type="button" className="lg-btn lg-btn-primary mt-2 w-full" disabled={laeuft} onClick={() => void einrichten()} data-passkey-einrichten>
          {t('passkey_einrichten', { art })}
        </button>
        <button type="button" className="lg-gray-btn w-full" disabled={laeuft} onClick={spaeter} data-passkey-spaeter>
          {t('passkey_spaeter')}
        </button>
      </div>
    </Sheet>
  )
}
