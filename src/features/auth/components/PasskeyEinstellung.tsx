import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ScanFace, Trash2 } from 'lucide-react'
import { entfernePasskey, passkeyArt, passkeys, richtePasskeyEin, type PasskeyEintrag } from '../lib/passkey'

/** Profil: eingerichtete Passkeys sehen, einen hinzufügen, einzelne entfernen. */
export function PasskeyEinstellung() {
  const { t, i18n } = useTranslation()
  const [liste, setListe] = useState<PasskeyEintrag[] | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const art = passkeyArt()

  // Neu laden nach Hinzufügen oder Entfernen: der Zähler stößt den Effekt an
  const [stand, setStand] = useState(0)
  const laden = () => setStand(n => n + 1)
  useEffect(() => {
    let aus = false
    void passkeys().then(l => { if (!aus) setListe(l) })
    return () => { aus = true }
  }, [stand])

  const hinzufuegen = async () => {
    setLaeuft(true)
    const fehler = await richtePasskeyEin()
    setLaeuft(false)
    if (fehler === 'abgebrochen') return
    if (fehler) toast.error(t('passkey_fehler', { art }))
    else { toast.success(t('passkey_eingerichtet', { art })); laden() }
  }
  const entfernen = async (p: PasskeyEintrag) => {
    setLaeuft(true)
    const ok = await entfernePasskey(p.id, (liste?.length ?? 0) <= 1)
    setLaeuft(false)
    if (!ok) toast.error(t('error'))
    laden()
  }
  const datum = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="mt-6" data-passkey-einstellung>
      <p className="lg-group-title">{t('passkey_titel', { art })}</p>
      <div className="flex flex-col gap-2 rounded-[var(--r-xl)] bg-[var(--lg-surface-2)] p-3">
        {liste === null && <p className="px-1 text-[14px] text-[var(--lg-text-3)]">{t('loading')}</p>}
        {liste?.length === 0 && <p className="px-1 text-[14px] text-[var(--lg-text-3)]">{t('passkey_leer')}</p>}
        {liste?.map(p => (
          <div key={p.id} className="flex min-h-[44px] items-center gap-3 px-1">
            <ScanFace size={18} aria-hidden="true" className="shrink-0 text-[var(--lg-text-3)]" />
            <span className="flex-1 text-[15px] text-[var(--lg-text)]">
              {p.name || 'Passkey'}
              {p.zuletzt && <span className="block text-[12px] text-[var(--lg-text-3)]">{t('passkey_zuletzt', { datum: datum(p.zuletzt) })}</span>}
            </span>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[var(--lg-text-3)]" disabled={laeuft}
              onClick={() => void entfernen(p)} aria-label={t('passkey_entfernen', { name: p.name || 'Passkey' })}>
              <Trash2 size={17} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button type="button" className="lg-gray-btn w-full" disabled={laeuft} onClick={() => void hinzufuegen()} data-passkey-hinzufuegen>
          {t('passkey_einrichten', { art })}
        </button>
      </div>
    </div>
  )
}
