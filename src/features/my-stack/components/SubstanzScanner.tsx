import { useRef, useState } from 'react'
import { Camera, ImageUp, LoaderCircle, ScanLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Sheet } from '../../compliance/components/Sheet'
import { SheetClose } from '../../../components/ui/SheetClose'
import { KiEinwilligung } from '../../blutwerte/components/KiEinwilligung'
import { useKiEinwilligung } from '../../blutwerte/components/useKiEinwilligung'
import { EINWILLIGUNG_FEHLT, giltFuerEtiketten } from '../../blutwerte/lib/aiConsent'
import { prepareFile, targetSize } from '../../blutwerte/lib/imageResize'
import { useBarcodeKamera, type KameraStand } from '../../ernaehrung/lib/useBarcodeKamera'
import { reportError } from '../../../lib/monitoring'
import { formatLocalDay } from '../lib/localDays'
import { parsePackungscode, type Packungscode } from '../lib/packungscode'
import { vorschlagAusEtikett, vorschlagAusProdukt, type ScanStaerke, type ScanVorschlag } from '../lib/substanzScan'
import { ScanFehler, liesEtikett, sucheBarcode } from '../services/substanzScan'
import type { SubstanceCatalogEntry } from '../types'

interface Foto {
  base64: string
  mimeType: string
}

type Phase =
  // `nurFoto`: ohne Barcode-Leser — sonst faende er den eben gelesenen
  // Barcode gleich wieder, statt das Etikett fotografieren zu lassen.
  | { art: 'kamera'; hinweis?: string; nurFoto?: boolean }
  | { art: 'einwilligung'; foto: Foto }
  | { art: 'laeuft'; was: 'barcode' | 'foto' }
  | { art: 'ergebnis'; vorschlag: ScanVorschlag }

/** Das aktuelle Kamerabild als JPEG, so gross wie fuer die Bilderkennung noetig. */
function fotoAusVideo(video: HTMLVideoElement): Foto | null {
  if (!video.videoWidth || !video.videoHeight) return null
  const size = targetSize(video.videoWidth, video.videoHeight)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, size.width, size.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' }
}

const istPackungscode = (raw: string) => parsePackungscode(raw) !== null

/** Kamerabild mit Barcode-Erkennung und Ausloeser. Wird je Versuch neu eingesetzt. */
function KameraAnsicht({ hinweis, fotoBereit, onCode, onFoto }: {
  hinweis?: string
  fotoBereit: boolean
  onCode: ((code: string) => void) | null
  onFoto: (foto: Foto) => void
}) {
  const { t } = useTranslation()
  const { videoRef, cam } = useBarcodeKamera(onCode, istPackungscode)
  // Ohne Barcode-Leser (nicht ladbar) bleibt das Foto.
  const bildLaeuft = cam === 'scanning' || cam === 'photo_only'
  const camMessage: Partial<Record<KameraStand, string>> = {
    starting: t('nutr_scan_starting'),
    denied: t('my_stack_scan_denied'),
    unavailable: t('my_stack_scan_unavailable'),
    failed: t('my_stack_scan_unavailable'),
  }

  const ausloesen = () => {
    const foto = videoRef.current ? fotoAusVideo(videoRef.current) : null
    if (foto) onFoto(foto)
  }

  return (
    <>
      {cam !== 'unavailable' && (
        <div className="relative mt-3 aspect-[4/3] w-full overflow-hidden rounded-[18px] bg-black">
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" aria-label={t('nutr_scan_camera')} />
          {bildLaeuft && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[10%] inset-y-[14%] rounded-xl"
              style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.9)' }} />
          )}
          {!bildLaeuft && (
            <p role="status" className="absolute inset-0 grid place-items-center p-6 text-center text-[15px] font-medium text-[var(--lg-text-2)]">
              {camMessage[cam]}
            </p>
          )}
        </div>
      )}
      <p role={hinweis ? 'status' : undefined} data-scan-hint className="mt-2 text-center text-[13px] leading-snug text-[var(--lg-text-2)]">
        {hinweis ?? (cam === 'unavailable' ? camMessage.unavailable : t(onCode && cam !== 'photo_only' ? 'my_stack_scan_hint' : 'my_stack_scan_hint_photo'))}
      </p>
      {bildLaeuft && (
        <button type="button" data-scan-shutter onClick={ausloesen} disabled={!fotoBereit}
          className="lg-btn lg-btn-primary mt-3 flex w-full items-center justify-center gap-2">
          <Camera size={18} aria-hidden="true" /> {t('my_stack_scan_photo')}
        </button>
      )}
    </>
  )
}

/**
 * „Scannen" im Assistenten: Barcode zuerst (ohne KI), sonst das Etikett
 * fotografieren und per KI auslesen. Am Ende steht ein Vorschlag, den der
 * Nutzer uebernimmt oder verwirft — gespeichert wird hier nichts.
 */
export function SubstanzScanner({ katalog, onUebernehmen, onClose }: {
  katalog: SubstanceCatalogEntry[]
  onUebernehmen: (vorschlag: ScanVorschlag) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [phase, setPhase] = useState<Phase>({ art: 'kamera' })
  const [versuch, setVersuch] = useState(0)
  // Der Data-Matrix-Code einer Arzneimittelpackung: Charge und Verfall, aber
  // kein Name — den liefert das Etikettfoto danach.
  const [packung, setPackung] = useState<Packungscode | null>(null)
  const dateiRef = useRef<HTMLInputElement>(null)
  const { einwilligung, fehler: einwilligungFehler, setze, vergessen, neuLaden } = useKiEinwilligung()
  const lang = (i18n.resolvedLanguage ?? i18n.language).startsWith('de') ? 'de' : 'en'
  // Eine Einwilligung von vor dem Etikett-Text galt nur Befunden.
  const etikettErlaubt = einwilligung !== undefined && giltFuerEtiketten(einwilligung)
  const laeuft = phase.art === 'laeuft'

  const zurKamera = (hinweis?: string, nurFoto = false) => {
    // Neu anfangen heisst auch: der gelesene Packungscode gehoert nicht zum
    // naechsten Produkt. Nur fuers Etikett derselben Packung bleibt er.
    if (!nurFoto) setPackung(null)
    setVersuch(n => n + 1)
    setPhase({ art: 'kamera', hinweis, nurFoto })
  }

  const barcodeGefunden = async (code: string) => {
    const gelesen = parsePackungscode(code)
    if (gelesen) {
      setPackung(gelesen)
      zurKamera(t('my_stack_scan_pack_read'), true)
      return
    }
    setPackung(null)
    setPhase({ art: 'laeuft', was: 'barcode' })
    try {
      const produkt = await sucheBarcode(code, lang)
      if (!produkt) { zurKamera(t('my_stack_scan_barcode_unknown'), true); return }
      setPhase({ art: 'ergebnis', vorschlag: vorschlagAusProdukt(produkt, katalog) })
    } catch {
      zurKamera(t('my_stack_scan_err_lookup'), true)
    }
  }

  const senden = async (foto: Foto) => {
    setPhase({ art: 'laeuft', was: 'foto' })
    try {
      const etikett = await liesEtikett(foto.base64, foto.mimeType, katalog.map(e => e.canonical_name))
      const vorschlag = vorschlagAusEtikett(etikett, katalog)
      setPhase({ art: 'ergebnis', vorschlag: packung ? { ...vorschlag, packung } : vorschlag })
    } catch (error) {
      if (error instanceof ScanFehler && error.code === EINWILLIGUNG_FEHLT) {
        // Inzwischen widerrufen (etwa auf einem anderen Geraet): neu fragen.
        vergessen()
        setPhase({ art: 'einwilligung', foto })
        return
      }
      if (!(error instanceof ScanFehler)) reportError(error, 'SubstanzScanner')
      zurKamera(t(error instanceof ScanFehler ? error.schluessel : 'my_stack_scan_err'))
    }
  }

  // Ohne ausdrueckliche Einwilligung geht kein Foto an den KI-Dienst.
  const fotoErhalten = (foto: Foto) => {
    if (etikettErlaubt) void senden(foto)
    else setPhase({ art: 'einwilligung', foto })
  }

  const dateiGewaehlt = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error(t('my_stack_scan_image_only')); return }
    try {
      fotoErhalten(await prepareFile(file))
    } catch {
      toast.error(t('my_stack_scan_err'))
    }
  }

  return (
    <Sheet labelledBy="stack-scan-title" busy={laeuft} onClose={onClose} tall data-substanz-scanner>
      <div className="flex items-center justify-between gap-2">
        <h2 id="stack-scan-title" className="lg-title2 flex items-center gap-2.5">
          <span className="lg-icon-tile" style={{ background: '#0a84ff' }} aria-hidden="true"><ScanLine size={16} /></span>
          {t('my_stack_scan')}
        </h2>
        <SheetClose onClick={onClose} disabled={laeuft} />
      </div>

      {phase.art === 'kamera' && (
        <>
          <KameraAnsicht
            key={versuch}
            hinweis={phase.hinweis}
            fotoBereit={einwilligung !== undefined}
            onCode={phase.nurFoto ? null : code => void barcodeGefunden(code)}
            onFoto={fotoErhalten}
          />
          <button type="button" data-scan-file onClick={() => dateiRef.current?.click()} disabled={einwilligung === undefined}
            className="lg-btn lg-btn-secondary mt-2 flex w-full items-center justify-center gap-2">
            <ImageUp size={18} aria-hidden="true" /> {t('my_stack_scan_choose')}
          </button>
          <input ref={dateiRef} type="file" accept="image/*" hidden data-scan-file-input
            onChange={event => { void dateiGewaehlt(event.target.files?.[0]); event.target.value = '' }} />
          {einwilligungFehler && (
            <div role="alert" className="mt-3 space-y-2 text-[13px] text-[var(--lg-text-2)]">
              <p>{t('ai_consent_load_error')}</p>
              <button type="button" className="btn-secondary" onClick={neuLaden}>{t('ai_consent_retry')}</button>
            </div>
          )}
          {etikettErlaubt && <p data-ai-consent-note className="mt-3 text-[12px] leading-relaxed text-[var(--lg-text-3)]">{t('my_stack_scan_ai_note')}</p>}
        </>
      )}

      {phase.art === 'einwilligung' && (
        <div className="mt-3">
          <KiEinwilligung
            onErteilt={async () => {
              // Erst zuruecknehmen, dann erteilen: der Trigger behaelt sonst den
              // alten Zeitpunkt — und der galt nur Befunden.
              await setze(false)
              await setze(true)
              void senden(phase.foto)
            }}
            onAbbrechen={() => zurKamera()}
          />
        </div>
      )}

      {phase.art === 'laeuft' && (
        <p role="status" className="mt-6 flex flex-col items-center gap-3 py-8 text-center text-[15px] text-[var(--lg-text-2)]">
          <LoaderCircle size={28} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {t(phase.was === 'barcode' ? 'my_stack_scan_searching' : 'my_stack_scan_reading')}
        </p>
      )}

      {phase.art === 'ergebnis' && (
        <ScanErgebnis
          vorschlag={phase.vorschlag}
          onUebernehmen={onUebernehmen}
          // Nach einem Barcode heisst „nochmal" fast immer: das Etikett lesen.
          onNochmal={() => zurKamera(undefined, phase.vorschlag.quelle === 'barcode' && !phase.vorschlag.packung)}
        />
      )}
    </Sheet>
  )
}

function staerkeText(staerke: ScanStaerke, sprache: string): string {
  const menge = `${staerke.amount.toLocaleString(sprache)} ${staerke.unit}`
  // Nur Volumen und Masse als Bezug zeigen — „je 1 tablet" waere unuebersetzt.
  const bezug = staerke.perUnit === 'ml' || staerke.perUnit === 'g' ? ` / ${staerke.perAmount ?? 1} ${staerke.perUnit}` : ''
  return `${staerke.name ? `${staerke.name} · ` : ''}${menge}${bezug}`
}

function ScanErgebnis({ vorschlag: gelesen, onUebernehmen, onNochmal }: {
  vorschlag: ScanVorschlag
  onUebernehmen: (vorschlag: ScanVorschlag) => void
  onNochmal: () => void
}) {
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  // Offen, welcher aus einer Familie es ist: erst waehlen, dann uebernehmen.
  const kandidaten = gelesen.kandidaten ?? []
  const [gewaehlt, setGewaehlt] = useState<SubstanceCatalogEntry | null>(null)
  const offen = kandidaten.length > 0 && !gewaehlt
  const vorschlag: ScanVorschlag = gewaehlt
    ? { ...gelesen, entry: gewaehlt, name: gewaehlt.canonical_name, kandidaten: [] }
    : gelesen
  const zeilen: [string, string][] = [
    [t('my_stack_step_dosage_form'), vorschlag.dosageForm ? t(`dosage_form_${vorschlag.dosageForm}`) : t('my_stack_scan_not_found')],
    [t('my_stack_scan_strength'), vorschlag.staerken.length > 0 ? vorschlag.staerken.map(s => staerkeText(s, sprache)).join('\n') : t('my_stack_scan_not_found')],
  ]
  if (vorschlag.brand) zeilen.push([t('my_stack_scan_brand'), vorschlag.brand])
  const { packung } = vorschlag
  if (packung?.verfall) zeilen.push([t('my_stack_scan_expiry'), formatLocalDay(packung.verfall, sprache)])
  if (packung?.charge) zeilen.push([t('my_stack_scan_batch'), packung.charge])
  if (packung?.pzn) zeilen.push([t('my_stack_scan_pzn'), packung.pzn])

  return (
    <div data-scan-result className="mt-3 space-y-3">
      <div className="rounded-[18px] bg-[var(--lg-surface-2)] p-4">
        <p data-scan-result-name className="break-words text-[17px] font-semibold text-[var(--lg-text)]">{vorschlag.name}</p>
        {kandidaten.length > 0 && (
          <fieldset data-scan-candidates className="mt-3">
            <legend className="text-[15px] font-semibold text-[var(--lg-text)]">{t('my_stack_scan_which')}</legend>
            <p className="mt-0.5 text-[13px] text-[var(--lg-text-2)]">{t('my_stack_scan_which_hint')}</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {kandidaten.map(kandidat => (
                <button
                  key={kandidat.id}
                  type="button"
                  aria-pressed={gewaehlt?.id === kandidat.id}
                  data-scan-candidate={kandidat.id}
                  onClick={() => setGewaehlt(kandidat)}
                  className={`min-h-11 rounded-xl px-3 text-left text-[15px] transition-colors ${gewaehlt?.id === kandidat.id ? 'bg-[var(--lg-fill)] font-semibold text-[var(--lg-text)] ring-2 ring-[var(--lg-accent)]' : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'}`}
                >
                  {kandidat.canonical_name}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {!offen && (
          <p className="mt-0.5 text-[13px] text-[var(--lg-text-2)]">
            {vorschlag.entry ? t('my_stack_from_catalog') : t('my_stack_scan_custom')}
          </p>
        )}
        <dl className="mt-3 space-y-2 text-[15px]">
          {zeilen.map(([label, wert]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-32 shrink-0 text-[var(--lg-text-2)]">{label}</dt>
              <dd className="min-w-0 whitespace-pre-line break-words text-[var(--lg-text)]">{wert}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-[13px] leading-snug text-[var(--lg-text-2)]">{t('my_stack_scan_check')}</p>
      <div className="flex gap-3">
        <button type="button" className="btn-secondary flex-1" data-scan-again onClick={onNochmal}>
          {t(vorschlag.quelle === 'barcode' ? 'my_stack_scan_photo_instead' : 'my_stack_scan_again')}
        </button>
        <button type="button" className="btn-primary flex-1" data-scan-apply disabled={offen} onClick={() => onUebernehmen(vorschlag)}>{t('my_stack_scan_apply')}</button>
      </div>
    </div>
  )
}
