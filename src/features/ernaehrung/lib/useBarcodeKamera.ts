import { useEffect, useRef, useState } from 'react'
import { cameraAvailable, createDetector } from './barcodeDetector'
import { normalizeBarcode } from './barcode'
import { useDotWeg } from '../../dot/useDotWeg'

/** `photo_only`: Kamerabild laeuft, aber der Barcode-Leser liess sich nicht laden. */
export type KameraStand = 'starting' | 'scanning' | 'photo_only' | 'denied' | 'unavailable' | 'failed'

/** Gleiche Ziffernfolge in zwei Bildern hintereinander — gegen Fehllesungen bei Bewegung. */
const CONFIRM_FRAMES = 2
const FRAME_MS = 180

/**
 * Rueckkamera an, Barcodes lesen, beim ersten sicheren Treffer `onCode` und
 * aufhoeren. Ohne `onCode` nur das Kamerabild (Etikett fotografieren). Die
 * Kamera laeuft, solange die Komponente steht — wer neu scannen will, setzt
 * sie neu ein. Gemeinsam fuer Ernaehrung und My Stack.
 */
export function useBarcodeKamera(
  onCode: ((code: string) => void) | null,
  /**
   * Auch Data-Matrix-Codes lesen; angenommen wird ein Code, fuer den das
   * `true` ergibt, und dann roh weitergereicht (My Stack: Arzneimittelpackung).
   */
  dataMatrix?: (raw: string) => boolean,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cam, setCam] = useState<KameraStand>(cameraAvailable() ? 'starting' : 'unavailable')
  // Solange ein Kamerabild läuft, ist Dot ganz weg
  useDotWeg(cam === 'starting' || cam === 'scanning' || cam === 'photo_only')
  const onCodeRef = useRef(onCode)
  useEffect(() => { onCodeRef.current = onCode })
  // Beim Start festgelegt: ein Wechsel mitten im Lauf hiesse, den Leser
  // nachzuladen oder abzuschalten — dafuer wird neu eingesetzt.
  const [mitBarcode] = useState(onCode !== null)
  const [mitDataMatrix] = useState(() => dataMatrix)

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
        if (!mitBarcode) { if (!stopped) setCam('scanning'); return }
        let detector: Awaited<ReturnType<typeof createDetector>>
        try {
          detector = await createDetector(Boolean(mitDataMatrix))
        } catch {
          // Etwa ZXing offline nicht geladen: das Bild steht trotzdem.
          if (!stopped) setCam('photo_only')
          return
        }
        if (stopped) return
        setCam('scanning')
        let last = ''
        let seen = 0
        const tick = async () => {
          if (stopped) return
          try {
            if (video.readyState >= 2) {
              const found = await detector.detect(video)
              const code = found
                .map(f => normalizeBarcode(f.rawValue) ?? (mitDataMatrix?.(f.rawValue) ? f.rawValue : null))
                .find(Boolean) ?? ''
              seen = code && code === last ? seen + 1 : code ? 1 : 0
              last = code
              if (code && seen >= CONFIRM_FRAMES) {
                stopped = true
                navigator.vibrate?.(30)
                onCodeRef.current?.(code)
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
  }, [mitBarcode, mitDataMatrix])

  return { videoRef, cam }
}
