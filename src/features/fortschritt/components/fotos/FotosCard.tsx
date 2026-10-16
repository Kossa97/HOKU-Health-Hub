import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Camera, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DateRange, ProgressPhotoEntry } from '../../types'
import { buildPhotoSlots, photoPreviewColumns } from '../../lib/photoPreview'
import { filterByDateRange } from '../../lib/range'
import { formatDaySafe } from '../../lib/dates'
import { panel, sectionLabel } from '../../styles'
import { FotosTab } from './FotosTab'

function PhotoPeriodMarquee({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  const innerRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const inner = innerRef.current
    if (!wrap || !inner || typeof window === 'undefined') return

    let animation: Animation | null = null
    const setup = () => {
      animation?.cancel()
      inner.style.transform = 'translateX(0)'
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

      const overflow = inner.scrollWidth - wrap.clientWidth
      if (overflow <= 4) return
      const holdStart = 1400
      const holdEnd = 900
      const moveOut = Math.max(1800, overflow * 32)
      const moveBack = Math.max(700, overflow * 14)
      const total = holdStart + moveOut + holdEnd + moveBack

      animation = inner.animate(
        [
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: holdStart / total },
          { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut) / total },
          { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut + holdEnd) / total },
          { transform: 'translateX(0)', offset: 1 },
        ],
        { duration: total, iterations: Infinity, easing: 'linear' },
      )
    }

    setup()
    if (typeof ResizeObserver === 'undefined') return () => animation?.cancel()
    const observer = new ResizeObserver(setup)
    observer.observe(wrap)
    observer.observe(inner)
    return () => {
      animation?.cancel()
      observer.disconnect()
    }
  }, [children])

  return (
    <span ref={wrapRef} style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <span ref={innerRef} style={{ display: 'inline-block', willChange: 'transform' }}>
        {children}
      </span>
    </span>
  )
}
interface Props {
  photos: ProgressPhotoEntry[]
  range: DateRange
  onChange: () => void
}

export function FotosCard({ photos, range, onChange }: Props) {
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)

  const inRange = useMemo(
    () => filterByDateRange(photos, range, p => p.taken_at),
    [photos, range],
  )

  const photoSlots = useMemo(() => buildPhotoSlots(inRange, photos), [inRange, photos])
  const previewColumns = photoPreviewColumns(photoSlots.length)
  const previewRows = photoSlots.length > 0 ? Math.ceil(photoSlots.length / previewColumns) : 0

  return (
    <>
      <section style={{ ...panel, padding: '14px 14px 12px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <p style={{ ...sectionLabel, margin: 0 }}>{t('fortschritt_photos')}</p>
            <p style={{ margin: '3px 0 0', fontSize: '0.58rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {t('fortschritt_photos_in_range')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={t('fortschritt_photo_add')}
            style={{
              width: 28,
              height: 28,
              borderRadius: 9,
              background: 'var(--accent-weak)',
              border: '1px solid var(--accent-border)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={15} />
          </button>
        </div>

        {photoSlots.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${previewColumns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${previewRows}, minmax(0, 1fr))`, gap: 6, flex: 1, minHeight: 0 }}>
            {photoSlots.map(slot => (
              <button
                key={slot.photo.id}
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label={slot.inRange ? t('fortschritt_photo_show') : t('fortschritt_photo_outside')}
                style={{
                  position: 'relative',
                  minHeight: 0,
                  borderRadius: 10,
                  overflow: 'hidden',
                  padding: 0,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: 'var(--surface-input)',
                }}
              >
                <img
                  src={slot.photo.display_url}
                  alt={slot.inRange ? formatDaySafe(slot.photo.taken_at, 'full') : t('fortschritt_photo_outside_alt')}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: slot.inRange ? undefined : 'blur(8px)', transform: slot.inRange ? undefined : 'scale(1.08)' }}
                />
                {!slot.inRange && (
                  <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', padding: '5px 7px', background: 'rgba(2, 6, 23, 0.42)', color: 'var(--text)', fontSize: '0.6rem', fontWeight: 800, lineHeight: 1.2, textAlign: 'center' }}>
                    <PhotoPeriodMarquee>{t('fortschritt_photo_outside_label')}</PhotoPeriodMarquee>
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label={t('fortschritt_photo_add')}
              style={{ width: 64, height: 64, borderRadius: 16, border: '1px dashed var(--accent-border)', background: 'var(--accent-weak)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Plus size={22} />
            </button>
          </div>
        )}
        {photos.length > 0 ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            style={{
              marginTop: 10,
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '0.68rem',
              fontWeight: 800,
              cursor: 'pointer',
              textAlign: 'left',
              padding: 0,
            }}
          >
            {t('fortschritt_photos_show_all', { n: photos.length })}
          </button>
        ) : (
          <button type="button" onClick={() => setSheetOpen(true)} className="btn-secondary" style={{ marginTop: 10, fontSize: '0.72rem', padding: '8px 10px' }}>
            <Camera size={14} /> {t('fortschritt_photo_add')}
          </button>
        )}
      </section>

      {sheetOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10060,
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: 'max(10px, env(safe-area-inset-top)) 12px 0',
            flexShrink: 0,
          }}>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label={t('close')}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface-input)',
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div style={{ padding: '0 12px 24px', flex: 1 }}>
            <FotosTab photos={photos} onChange={() => { onChange(); }} />
          </div>
        </div>
      )}
    </>
  )
}
