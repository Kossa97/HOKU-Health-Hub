import { useEffect, useRef, useState } from 'react'
import { ScanBarcode, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../compliance/components/Sheet'
import { cameraAvailable, createDetector } from '../lib/barcodeDetector'
import { normalizeBarcode } from '../lib/barcode'
import { PRESSABLE, dim, input, label, muted } from '../styles'

type CamState = 'starting' | 'scanning' | 'denied' | 'unavailable' | 'failed'

/** Gleiche Ziffernfolge in zwei Bildern hintereinander — gegen Fehllesungen bei Bewegung. */
const CONFIRM_FRAMES = 2
const FRAME_MS = 180

export function BarcodeScanner({ busy, onCode, onClose }: { busy: boolean; onCode: (code: string) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cam, setCam] = useState<CamState>(cameraAvailable() ? 'starting' : 'unavailable')
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState(false)
  const onCodeRef = useRef(onCode)
  useEffect(() => { onCodeRef.current = onCode })

  useEffect(() => {
    if (!cameraAvailable()) return
    let stopped = false
    let stream: MediaStream | null = null
    let timer: number | undefined

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch (error) {
        if (!stopped) setCam(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unavailable')
        return
      }
      const video = videoRef.current
      if (stopped || !video) { stream.getTracks().forEach(tr => tr.stop()); return }
      video.srcObject = stream
      try {
        await video.play()
        const detector = await createDetector()
        if (stopped) return
        setCam('scanning')
        let last = ''
        let seen = 0
        const tick = async () => {
          if (stopped) return
          try {
            if (video.readyState >= 2) {
              const found = await detector.detect(video)
              const code = found.map(f => normalizeBarcode(f.rawValue)).find(Boolean) ?? ''
              seen = code && code === last ? seen + 1 : code ? 1 : 0
              last = code
              if (code && seen >= CONFIRM_FRAMES) {
                stopped = true
                navigator.vibrate?.(30)
                onCodeRef.current(code)
                return
              }
            }
          } catch { /* einzelnes Bild nicht lesbar — weiter */ }
          timer = window.setTimeout(tick, FRAME_MS)
        }
        tick()
      } catch {
        if (!stopped) setCam('failed')
      }
    }
    start()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach(tr => tr.stop())
    }
  }, [])

  const submitManual = () => {
    const code = normalizeBarcode(manual)
    if (!code) { setManualError(true); return }
    onCode(code)
  }

  const camMessage: Partial<Record<CamState, string>> = {
    starting: t('nutr_scan_starting'),
    denied: t('nutr_scan_denied'),
    unavailable: t('nutr_scan_unavailable'),
    failed: t('nutr_scan_failed'),
  }

  return (
    <Sheet labelledBy="nutr-scan-title" busy={busy} onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 id="nutr-scan-title" className="flex items-center gap-2 text-lg font-extrabold" style={{ color: 'var(--text)' }}>
          <ScanBarcode size={20} aria-hidden="true" style={{ color: 'var(--accent)' }} />{t('nutr_scan')}
        </h2>
        <button type="button" data-app-back-close aria-label={t('close')} onClick={onClose}
          className={`grid h-11 w-11 place-items-center rounded-xl ${PRESSABLE}`} style={dim}><X size={20} /></button>
      </div>

      {cam !== 'unavailable' && (
        <div className="relative mt-3 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" aria-label={t('nutr_scan_camera')} />
          {cam === 'scanning' && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[34%] -translate-y-1/2 rounded-xl"
              style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)', border: '2px solid rgba(255,255,255,0.9)' }} />
          )}
          {cam !== 'scanning' && (
            <p role="status" className="absolute inset-0 grid place-items-center p-6 text-center text-[0.86rem] font-semibold text-white/90">
              {camMessage[cam]}
            </p>
          )}
        </div>
      )}
      {cam === 'scanning' && <p className="mt-2 text-center text-[0.78rem]" style={muted}>{t('nutr_scan_hint')}</p>}
      {cam === 'unavailable' && <p role="status" className="mt-3 text-[0.84rem]" style={dim}>{camMessage.unavailable}</p>}

      <form className="mt-4" onSubmit={e => { e.preventDefault(); submitManual() }}>
        <label htmlFor="nutr-barcode" style={label}>{t('nutr_scan_manual')}</label>
        <div className="mt-1.5 flex gap-2">
          <input id="nutr-barcode" inputMode="numeric" enterKeyHint="search" autoComplete="off" value={manual}
            onChange={e => { setManual(e.target.value); setManualError(false) }}
            aria-invalid={manualError} aria-describedby={manualError ? 'nutr-barcode-error' : undefined}
            placeholder="4 012345 678901" style={input} />
          <button type="submit" disabled={busy} className="btn-primary shrink-0">{t('nutr_scan_lookup')}</button>
        </div>
        {manualError && <p id="nutr-barcode-error" role="alert" className="mt-1 text-[0.76rem]" style={{ color: 'var(--cat-rose)' }}>{t('nutr_scan_invalid')}</p>}
      </form>
    </Sheet>
  )
}
