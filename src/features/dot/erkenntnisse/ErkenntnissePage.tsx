import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../../context/AuthContext'
import { Silhouette, Zeilen } from '../../../components/ui/Silhouette'
import { Sheet } from '../../compliance/components/Sheet'
import { CUSTOM_PREFIX, exerciseName } from '../../training/lib/exerciseLookup'
import { loadCustomExercises } from '../../training/services/trainingRepo'
import type { CustomExercise } from '../../training/types'
import { DotZeichen } from '../DotZeichen'
import { useDotZugang } from '../lib/zugang'
import { ErkenntnisseEinwilligung } from './ErkenntnisseEinwilligung'
import {
  aktualisiereZeitzone, blendeAus, ladeFunde, ladeWoche, markiereGelesen, setzeErkenntnisseEinwilligung,
  sichtbareWochenFunde, type GespeicherterFund, type Woche,
} from './erkenntnisseService'
import { FundDetail } from './FundDetail'
import { FundKarte } from './FundKarte'
import { vergissErkenntnisseZugang } from './homeZugang'
import { useErkenntnisseTexte } from './texte'
import type { Namen } from './vorlagen'
import { WochenKarte } from './WochenKarte'

/**
 * Seite `/erkenntnisse`: Wochen-Update und alle Funde. Solange
 * `ERKENNTNISSE_FREI` aus ist, nur für Tester; ohne Einwilligung steht dort
 * nur, worum es geht, und der Weg zur Einwilligung.
 */
export function ErkenntnissePage() {
  const { user } = useAuth()
  const zugang = useDotZugang()
  const { et } = useErkenntnisseTexte()
  const [einwilligungOffen, setEinwilligungOffen] = useState(false)
  const zoneGeprueft = useRef(false)
  const { geladen, darfErkenntnisse, erkenntnisseEinwilligung, hokuZeitzone } = zugang

  // Zieht die Zeitzone nach, nach der die Nacht-Auswertung die Tage schneidet.
  useEffect(() => {
    if (!user || !geladen || !darfErkenntnisse || !erkenntnisseEinwilligung || zoneGeprueft.current) return
    zoneGeprueft.current = true
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (zone && zone !== hokuZeitzone) {
      aktualisiereZeitzone(user.id, zone).catch(e => console.error('[Erkenntnisse] Zeitzone:', e))
    }
  }, [user, geladen, darfErkenntnisse, erkenntnisseEinwilligung, hokuZeitzone])

  if (!geladen || !user) return <Laden />
  if (!darfErkenntnisse) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-4" data-erkenntnisse-seite>
      <h1 className="lg-large-title">{et('seite_titel')}</h1>
      {erkenntnisseEinwilligung ? (
        <MitEinwilligung userId={user.id} onWiderrufen={() => zugang.setErkenntnisseEinwilligung(null)} />
      ) : (
        <div className="card flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="lg-icon-tile mt-0.5 !h-9 !w-9 shrink-0" style={{ background: 'rgba(0, 204, 245, 0.15)' }}>
              <DotZeichen groesse={22} />
            </span>
            <p className="min-w-0 text-[15px] leading-snug text-[var(--lg-text-2)]">{et('ohne_einw_text')}</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setEinwilligungOffen(true)}>{et('ohne_einw_knopf')}</button>
        </div>
      )}
      {einwilligungOffen && (
        <ErkenntnisseEinwilligung
          onFertig={zeit => {
            // Die Einwilligung speichert die Zeitzone des Geräts gleich mit.
            zoneGeprueft.current = true
            vergissErkenntnisseZugang(user.id)
            zugang.setErkenntnisseEinwilligung(zeit)
            setEinwilligungOffen(false)
          }}
          onAbbrechen={() => setEinwilligungOffen(false)}
        />
      )}
    </div>
  )
}

function Laden() {
  return (
    <Silhouette>
      <div className="flex flex-col gap-4">
        <Zeilen breiten={['45%']} h={28} />
        <Zeilen breiten={['100%', '85%', '60%']} />
      </div>
    </Silhouette>
  )
}

interface Daten { woche: Woche | null; funde: GespeicherterFund[]; eigene: CustomExercise[] }

function MitEinwilligung({ userId, onWiderrufen }: { userId: string; onWiderrufen(): void }) {
  const { et, lang } = useErkenntnisseTexte()
  const [daten, setDaten] = useState<Daten | null>(null)
  const [fehler, setFehler] = useState(false)
  const [versuch, setVersuch] = useState(0)
  const [offen, setOffen] = useState<GespeicherterFund | null>(null)
  const [widerrufFrage, setWiderrufFrage] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let aus = false
    void (async () => {
      try {
        const [woche, funde] = await Promise.all([ladeWoche(userId), ladeFunde(userId)])
        // Eigene Übungen nur, wenn ein Rekord auf eine verweist.
        const brauchtEigene = funde.some(g => g.fund.id === 'R4' && g.fund.bezug?.startsWith(CUSTOM_PREFIX))
        const eigene = brauchtEigene ? await loadCustomExercises(userId).catch(() => []) : []
        if (aus) return
        setDaten({ woche, funde, eigene })
        if (woche && !woche.gelesen) {
          markiereGelesen(userId, woche.woche).catch(e => console.error('[Erkenntnisse] gelesen:', e))
        }
      } catch (e) {
        if (aus) return
        console.error('[Erkenntnisse] Laden:', e)
        setFehler(true)
        toast.error(et('laden_fehler'))
      }
    })()
    return () => { aus = true }
  }, [userId, versuch, et])

  const eigene = daten?.eigene
  const namen = useMemo<Namen>(() => ({ uebung: id => exerciseName(id, lang, eigene ?? []) }), [lang, eigene])

  if (fehler) {
    return (
      <div role="alert" className="card flex flex-col gap-3">
        <p className="text-[15px] text-[var(--lg-text-2)]">{et('laden_fehler')}</p>
        <button type="button" className="btn-secondary" onClick={() => { setFehler(false); setVersuch(v => v + 1) }}>{et('erneut')}</button>
      </div>
    )
  }
  if (!daten) return <Laden />

  const ausblenden = async () => {
    if (!offen) return
    setBusy(true)
    try {
      await blendeAus(offen.id)
      setDaten(d => d && { ...d, funde: d.funde.filter(g => g.id !== offen.id) })
      setOffen(null)
    } catch (e) {
      console.error('[Erkenntnisse] Ausblenden:', e)
      toast.error(et('aktion_fehler'))
    } finally {
      setBusy(false)
    }
  }

  const widerrufen = async () => {
    setBusy(true)
    try {
      await setzeErkenntnisseEinwilligung(userId, false)
      vergissErkenntnisseZugang(userId)
      onWiderrufen()
    } catch (e) {
      console.error('[Erkenntnisse] Widerruf:', e)
      toast.error(et('aktion_fehler'))
      setBusy(false)
    }
  }

  return (
    <>
      {daten.woche ? (
        <WochenKarte woche={daten.woche} funde={sichtbareWochenFunde(daten.woche, daten.funde)} namen={namen} onOeffnen={setOffen} />
      ) : (
        <p className="card text-[15px] text-[var(--lg-text-2)]">{et('keine_woche')}</p>
      )}

      <section aria-labelledby="erkenntnisse-alle" className="mt-2 flex flex-col gap-3">
        <h2 id="erkenntnisse-alle" className="text-[20px] font-bold text-[var(--lg-text)]">{et('alle_funde')}</h2>
        {daten.funde.length === 0
          ? <p className="text-[15px] text-[var(--lg-text-2)]">{et('keine_funde')}</p>
          : daten.funde.map(g => <FundKarte key={g.id} eintrag={g} namen={namen} onOeffnen={() => setOffen(g)} />)}
      </section>

      <button type="button" className="btn-secondary mt-4 self-center" onClick={() => setWiderrufFrage(true)}>
        {et('widerruf_knopf')}
      </button>

      {offen && (
        <FundDetail eintrag={offen} namen={namen} busy={busy} onNichtHilfreich={() => void ausblenden()} onSchliessen={() => setOffen(null)} />
      )}

      {widerrufFrage && (
        <Sheet labelledBy="erkenntnisse-widerruf-titel" role="alertdialog" busy={busy} onClose={() => setWiderrufFrage(false)}>
          <div className="flex flex-col gap-3">
            <h3 id="erkenntnisse-widerruf-titel" className="text-[17px] font-semibold text-[var(--lg-text)]">{et('widerruf_titel')}</h3>
            <p className="text-[15px] leading-snug text-[var(--lg-text-2)]">{et('widerruf_text')}</p>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary flex-1" data-app-back-close onClick={() => setWiderrufFrage(false)} disabled={busy}>
                {et('abbrechen')}
              </button>
              <button type="button" className="btn-danger flex-1" onClick={() => void widerrufen()} disabled={busy}>
                {et('widerruf_ja')}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  )
}
