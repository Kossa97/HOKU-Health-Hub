import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../../context/AuthContext'
import { Sheet } from '../../compliance/components/Sheet'
import { DotZeichen } from '../DotZeichen'
import { setzeErkenntnisseEinwilligung } from './erkenntnisseService'
import { useErkenntnisseTexte } from './texte'

const PUNKTE = ['einw_punkt_1', 'einw_punkt_2', 'einw_punkt_3', 'einw_punkt_4'] as const

/**
 * Einwilligung in die nächtliche Auswertung (Art. 9 DSGVO). „Einverstanden"
 * ist erst mit Haken aktiv; bei Erfolg kommt der Zeitpunkt der Einwilligung
 * zurück, bei einem Fehler bleibt das Sheet offen.
 */
export function ErkenntnisseEinwilligung({ onFertig, onAbbrechen }: { onFertig(zeit: string): void; onAbbrechen(): void }) {
  const { user } = useAuth()
  const { et } = useErkenntnisseTexte()
  const [haken, setHaken] = useState(false)
  const [busy, setBusy] = useState(false)

  const erteilen = async () => {
    if (!haken || !user) return
    setBusy(true)
    try {
      const zeit = await setzeErkenntnisseEinwilligung(user.id, true)
      if (!zeit) throw new Error('keine_zeit')
      onFertig(zeit)
    } catch (e) {
      console.error('[Erkenntnisse] Einwilligung:', e)
      toast.error(et('einw_fehler'))
      setBusy(false)
    }
  }

  return (
    <Sheet labelledBy="erkenntnisse-einw-titel" busy={busy} onClose={onAbbrechen} tall data-erkenntnisse-einwilligung>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="lg-icon-tile mt-0.5 !h-9 !w-9" style={{ background: 'rgba(0, 204, 245, 0.15)' }}>
            <DotZeichen groesse={22} />
          </span>
          <h3 id="erkenntnisse-einw-titel" className="min-w-0 text-[17px] font-semibold text-[var(--lg-text)]">{et('einw_titel')}</h3>
        </div>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-snug text-[var(--lg-text-2)]">
          {PUNKTE.map(k => <li key={k}>{et(k)}</li>)}
        </ul>
        <label className="flex cursor-pointer items-start gap-3 rounded-[18px] bg-[var(--lg-surface-2)] p-3.5 text-[15px] leading-snug text-[var(--lg-text)]">
          <input
            type="checkbox"
            data-erkenntnisse-haken
            checked={haken}
            onChange={e => setHaken(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-sky-500"
          />
          <span>{et('einw_haken')}</span>
        </label>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" data-app-back-close onClick={onAbbrechen} disabled={busy}>
            {et('einw_nein')}
          </button>
          <button type="button" className="btn-primary flex-1" data-erkenntnisse-ja onClick={() => void erteilen()} disabled={!haken || busy}>
            {et('einw_ja')}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
