import { useState } from 'react'
import { ScanBarcode } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Panel'
import { useBarcodeKamera, type KameraStand } from '../lib/useBarcodeKamera'
import { normalizeBarcode } from '../lib/barcode'
import { DIM, ERROR_TEXT, MUTED } from '../styles'
import { SheetClose } from '../../../components/ui/SheetClose'

export function BarcodeScanner({ busy, onCode, onClose }: { busy: boolean; onCode: (code: string) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const { videoRef, cam } = useBarcodeKamera(onCode)
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState(false)

  const submitManual = () => {
    const code = normalizeBarcode(manual)
    if (!code) { setManualError(true); return }
    onCode(code)
  }

  const camMessage: Partial<Record<KameraStand, string>> = {
    starting: t('nutr_scan_starting'),
    denied: t('nutr_scan_denied'),
    unavailable: t('nutr_scan_unavailable'),
    failed: t('nutr_scan_failed'),
    photo_only: t('nutr_scan_failed'),
  }

  return (
    <Sheet labelledBy="nutr-scan-title" busy={busy} onClose={onClose}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="nutr-scan-title" className="lg-title2 flex items-center gap-2">
          <ScanBarcode size={18} strokeWidth={1.5} aria-hidden="true" className="text-[var(--lg-text-2)]" />{t('nutr_scan')}
        </h2>
        <SheetClose onClick={onClose} />
      </div>

      {cam !== 'unavailable' && (
        <div className="relative mt-3 aspect-[4/3] w-full overflow-hidden rounded-[16px] bg-black">
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" aria-label={t('nutr_scan_camera')} />
          {cam === 'scanning' && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[34%] -translate-y-1/2 rounded-xl"
              style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)', border: '2px solid rgba(255,255,255,0.9)' }} />
          )}
          {cam !== 'scanning' && (
            <p role="status" className="absolute inset-0 grid place-items-center p-6 text-center text-[15px] font-medium text-[var(--lg-text-2)]">
              {camMessage[cam]}
            </p>
          )}
        </div>
      )}
      {cam === 'scanning' && <p className={`mt-2 text-center text-[13px] ${MUTED}`}>{t('nutr_scan_hint')}</p>}
      {cam === 'unavailable' && <p role="status" className={`mt-3 text-[15px] leading-snug ${DIM}`}>{camMessage.unavailable}</p>}

      <form className="mt-4" onSubmit={e => { e.preventDefault(); submitManual() }}>
        <label htmlFor="nutr-barcode" className="label">{t('nutr_scan_manual')}</label>
        <div className="flex gap-2">
          <input id="nutr-barcode" inputMode="numeric" enterKeyHint="search" autoComplete="off" value={manual}
            onChange={e => { setManual(e.target.value); setManualError(false) }}
            aria-invalid={manualError} aria-describedby={manualError ? 'nutr-barcode-error' : undefined}
            placeholder="4 012345 678901" className="input min-w-0" />
          <button type="submit" disabled={busy} className="lg-btn lg-btn-primary lg-btn-compact shrink-0 !px-4">{t('nutr_scan_lookup')}</button>
        </div>
        {manualError && <p id="nutr-barcode-error" role="alert" className={`mt-1.5 px-1 ${ERROR_TEXT}`}>{t('nutr_scan_invalid')}</p>}
      </form>
    </Sheet>
  )
}
