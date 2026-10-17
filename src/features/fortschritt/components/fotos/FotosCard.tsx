import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Camera, ChevronsLeftRight, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DateRange, ProgressPhotoEntry } from '../../types'
import { filterByDateRange } from '../../lib/range'
import { formatDaySafe, formatNumber, formatSignedNumber } from '../../lib/dates'
import { FotosTab } from './FotosTab'
import { useSheetPresence } from '../../hooks/useSheetPresence'
import { useReadingZone } from '../../../../components/ambient/context'

/** Womit die Galerie aufgeht: alle Fotos, ein bestimmtes Foto groß oder gleich das Hinzufügen. */
type SheetTarget = { kind: 'all' } | { kind: 'photo'; id: string } | { kind: 'add' }

interface Props {
  photos: ProgressPhotoEntry[]
  range: DateRange
  onChange: () => void
}

const byDate = (a: ProgressPhotoEntry, b: ProgressPhotoEntry) => a.taken_at.localeCompare(b.taken_at)

export function FotosCard({ photos, range, onChange }: Props) {
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [target, setTarget] = useState<SheetTarget>({ kind: 'all' })
  // Neuer Schlüssel je Öffnen: die Galerie startet frisch mit dem Ziel.
  const [openCount, setOpenCount] = useState(0)
  const sheet = useSheetPresence(sheetOpen)
  const openSheet = (next: SheetTarget) => {
    setTarget(next)
    setOpenCount(c => c + 1)
    setSheetOpen(true)
  }

  const inRange = useMemo(
    () => [...filterByDateRange(photos, range, p => p.taken_at)].sort(byDate),
    [photos, range],
  )
  const before = inRange[0]
  const after = inRange.length > 1 ? inRange[inRange.length - 1] : null
  const weightDelta = before?.weight_kg != null && after?.weight_kg != null ? after.weight_kg - before.weight_kg : null

  const [split, setSplit] = useState(0.5)
  const [dragging, setDragging] = useState(false)
  // Mit Fotos werden die Lichter nur leiser, damit Hautfarben echt bleiben
  const sectionRef = useRef<HTMLElement>(null)
  useReadingZone(sectionRef, before ? 'photo' : 'read')

  return (
    <>
      <section ref={sectionRef} className="lg-card lg-surface" aria-labelledby="fg-photos-title">
        <div className="lg-card-head" style={{ alignItems: 'center' }}>
          <div>
            <h3 id="fg-photos-title" className="lg-h3">
              {after ? `${t('fortschritt_compare_before')} / ${t('fortschritt_compare_after')}` : t('fortschritt_photos')}
            </h3>
            {weightDelta != null && <span className="lg-meta">{formatSignedNumber(Math.round(weightDelta * 10) / 10)} kg</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {photos.length > 0 && (
              <button type="button" className="lg-btn lg-btn-glass lg-glass" style={{ minHeight: 40, padding: '0 16px', fontSize: 15 }} onClick={() => openSheet({ kind: 'all' })}>
                {t('fortschritt_photos_show_all', { n: photos.length })}
              </button>
            )}
            <button type="button" className="lg-icon-btn lg-glass" aria-label={t('fortschritt_photo_add')} onClick={() => openSheet({ kind: 'add' })}>
              <Plus size={20} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {before && after ? (
          <Compare
            before={before}
            after={after}
            split={split}
            onSplit={setSplit}
            dragging={dragging}
            onDragging={setDragging}
            onOpen={photo => openSheet({ kind: 'photo', id: photo.id })}
          />
        ) : before ? (
          <button type="button" className="fg-photo-single" aria-label={t('fortschritt_photo_show')} onClick={() => openSheet({ kind: 'photo', id: before.id })}>
            <img src={before.display_url} alt={formatDaySafe(before.taken_at, 'full')} draggable={false} />
          </button>
        ) : (
          <div className="lg-empty" style={{ padding: '18px 8px 6px' }}>
            <p>{photos.length > 0 ? t('fortschritt_photos_none_in_range') : t('fortschritt_photos_empty_title')}</p>
            <p>{t('fortschritt_photos_empty_body')}</p>
            <button type="button" className="lg-btn lg-btn-primary" style={{ marginTop: 16 }} onClick={() => openSheet({ kind: 'add' })}>
              <Camera size={20} aria-hidden />
              {t('fortschritt_photo_add')}
            </button>
          </div>
        )}
      </section>

      {sheet.mounted && (
        <div className="fs-sheet" data-shown={sheet.shown} inert={!sheetOpen} style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10060,
          background: 'var(--app-bg)',
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
              data-app-back-close
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
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
            <FotosTab
              key={openCount}
              photos={photos}
              onChange={() => { onChange(); }}
              initialPhotoId={target.kind === 'photo' ? target.id : null}
              initialAdd={target.kind === 'add'}
            />
          </div>
        </div>
      )}
    </>
  )
}

/** Ab so vielen Pixeln wird aus einem Tippen ein Ziehen (Hysterese). */
const DRAG_THRESHOLD_PX = 6

/**
 * Zwei Fotos übereinander, eine Trennlinie zum Ziehen (Finger, Maus, Pfeiltasten).
 * Ziehen verschiebt die Linie, kurzes Antippen öffnet das Foto der angetippten Seite.
 */
function Compare({ before, after, split, onSplit, dragging, onDragging, onOpen }: {
  before: ProgressPhotoEntry
  after: ProgressPhotoEntry
  split: number
  onSplit: (f: number | ((prev: number) => number)) => void
  dragging: boolean
  onDragging: (on: boolean) => void
  onOpen: (photo: ProgressPhotoEntry) => void
}) {
  const { t } = useTranslation()
  const boxRef = useRef<HTMLDivElement>(null)
  const downX = useRef<number | null>(null)
  // Verschwindet der Vergleich mitten im Ziehen (Zeitraum, Foto gelöscht), endet das Ziehen mit
  useEffect(() => () => onDragging(false), [onDragging])
  const clamp = (f: number) => Math.min(0.97, Math.max(0.03, f))

  const moveTo = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect()
    if (rect) onSplit(clamp((clientX - rect.left) / rect.width))
  }
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    downX.current = e.clientX
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (downX.current == null) return
    if (!dragging && Math.abs(e.clientX - downX.current) < DRAG_THRESHOLD_PX) return
    onDragging(true)
    moveTo(e.clientX)
  }
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const wasTap = !dragging && downX.current != null
    downX.current = null
    onDragging(false)
    if (!wasTap) return
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect) return
    onOpen((e.clientX - rect.left) / rect.width < split ? before : after)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') { onSplit(s => clamp(s - 0.05)); e.preventDefault() }
    if (e.key === 'ArrowRight') { onSplit(s => clamp(s + 0.05)); e.preventDefault() }
  }
  const tag = (photo: ProgressPhotoEntry) => (
    <>
      {formatDaySafe(photo.taken_at, 'full')}
      {photo.weight_kg != null && <> · {formatNumber(photo.weight_kg)} kg</>}
    </>
  )

  return (
    <div
      ref={boxRef}
      className="fg-compare"
      data-dragging={dragging}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => { downX.current = null; onDragging(false) }}
    >
      <img src={before.display_url} alt={`${t('fortschritt_compare_before')}: ${formatDaySafe(before.taken_at, 'full')}`} draggable={false} />
      <div className="fg-compare-after" style={{ clipPath: `inset(0 0 0 ${(split * 100).toFixed(2)}%)` }}>
        <img src={after.display_url} alt={`${t('fortschritt_compare_after')}: ${formatDaySafe(after.taken_at, 'full')}`} draggable={false} />
      </div>
      <div className="fg-tag l lg-glass"><b>{t('fortschritt_compare_before')}</b>{tag(before)}</div>
      <div className="fg-tag r lg-glass"><b>{t('fortschritt_compare_after')}</b>{tag(after)}</div>
      <div
        className="fg-handle"
        style={{ left: `${(split * 100).toFixed(2)}%` }}
        role="slider"
        tabIndex={0}
        aria-label={t('fortschritt_compare_aria')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(split * 100)}
        onKeyDown={onKey}
      >
        <span className="fg-knob lg-glass" aria-hidden><ChevronsLeftRight size={20} /></span>
      </div>
    </div>
  )
}
