import { useRef, useState, type ChangeEvent } from 'react'
import { format } from 'date-fns'
import { Camera, ImageOff, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../context/AuthContext'
import type { ProgressPhotoEntry } from '../../types'
import { PHOTO_BUCKET } from '../../constants'
import { PHOTO_GRID_OPTIONS, photoGridColumns, readPhotoGridSize, writePhotoGridSize, type PhotoGridSize } from '../../lib/photoGrid'
import { isLegacyPhotoUrl } from '../../hooks/useFortschrittData'
import { fieldLabel, inputStyle, panel } from '../../styles'
import { denyProps } from '../../../../lib/denyFeedback'
import { BATCH_BUCKET, batchDateiPfad } from '../../../../lib/batchFiles'
import { reportError } from '../../../../lib/monitoring'
import { formatDaySafe, formatNumber } from '../../lib/dates'
import { useSheetPresence } from '../../hooks/useSheetPresence'

const todayStr = () => format(new Date(), 'yyyy-MM-dd')
const fmtDate = (d: string) => formatDaySafe(d, 'full')

interface Props {
  photos: ProgressPhotoEntry[]
  onChange: () => void
  /** Dieses Foto gleich groß öffnen — wer eine Kachel antippt, will genau dieses Foto sehen. */
  initialPhotoId?: string | null
  /** Gleich das Hinzufügen-Formular öffnen. */
  initialAdd?: boolean
}

export function FotosTab({ photos, onChange, initialPhotoId = null, initialAdd = false }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(initialAdd)
  const [date, setDate] = useState(todayStr())
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState<ProgressPhotoEntry | null>(
    () => photos.find(p => p.id === initialPhotoId) ?? null,
  )
  // Beim Ausblenden bleibt das zuletzt gezeigte Foto stehen, bis es weg ist.
  const [lastPhoto, setLastPhoto] = useState(activePhoto)
  const openPhoto = (photo: ProgressPhotoEntry) => {
    setLastPhoto(photo)
    setActivePhoto(photo)
  }
  const lightbox = useSheetPresence(activePhoto != null)
  const shownPhoto = activePhoto ?? lastPhoto
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [gridSize, setGridSize] = useState<PhotoGridSize>(() => readPhotoGridSize())

  const handleGridSizeChange = (size: PhotoGridSize) => {
    setGridSize(size)
    writePhotoGridSize(size)
  }

  const openSheet = () => {
    setDate(todayStr())
    setWeight('')
    setNotes('')
    setSelectedFile(null)
    setPreviewUrl(null)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setSelectedFile(null)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleUpload = async () => {
    if (!user || !selectedFile) {
      toast.error(t('fortschritt_photo_select_first'))
      return
    }
    setUploading(true)
    try {
      const ext = selectedFile.name.split('.').pop() ?? 'jpg'
      // Privater Bucket: erster Pfad-Teil = user.id, darauf prüfen die Storage-Policies.
      // In der DB liegt nur der Pfad; Anzeige läuft über signierte URLs.
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, selectedFile, { contentType: selectedFile.type, upsert: false })
      if (upErr) {
        // Zu groß, falsches Format: Eingabefehler, kein App-Fehler fürs Monitoring.
        const status = (upErr as { status?: unknown }).status
        if (!(typeof status === 'number' && status >= 400 && status < 500)) reportError(upErr, 'fortschritt.photo-upload')
        throw upErr
      }
      const { error: dbErr } = await supabase.from('progress_photos').insert({
        user_id: user.id,
        photo_url: path,
        taken_at: date,
        weight_kg: weight ? Number(weight) : null,
        notes: notes || null,
      })
      if (dbErr) {
        // Ohne Zeile wäre die Datei verwaist und unsichtbar — wieder entfernen.
        reportError(dbErr, 'fortschritt.photo-insert')
        const { error: cleanupError } = await supabase.storage.from(PHOTO_BUCKET).remove([path])
        if (cleanupError) reportError(cleanupError, 'fortschritt.photo-orphan-cleanup')
        throw dbErr
      }
      toast.success(t('fortschritt_photo_saved'))
      closeSheet()
      onChange()
    } catch {
      toast.error(t('fortschritt_photo_upload_failed'))
    } finally {
      setUploading(false)
    }
  }

  const deletePhoto = async (photo: ProgressPhotoEntry) => {
    if (!confirm(t('fortschritt_photo_delete_confirm'))) return
    // Erst die Zeile, dann die Datei: scheitert das Löschen der Zeile, bleibt
    // das Foto vollständig. Scheitert danach die Datei, ist sie nur verwaist —
    // unsichtbar für den Nutzer, aber gemeldet.
    // RLS ohne Treffer liefert keinen Fehler, nur null Zeilen — dann bleibt die Datei.
    const { data: deleted, error } = await supabase.from('progress_photos').delete().eq('id', photo.id).select('id')
    if (error || !deleted?.length) {
      reportError(error ?? new Error('progress_photos: no row deleted'), 'fortschritt.photo-delete')
      toast.error(t('fortschritt_photo_delete_failed'))
      return
    }
    const legacy = isLegacyPhotoUrl(photo.photo_url)
    const pfad = legacy ? batchDateiPfad(photo.photo_url) : photo.photo_url
    if (pfad) {
      const { error: storageError } = await supabase.storage
        .from(legacy ? BATCH_BUCKET : PHOTO_BUCKET)
        .remove([pfad])
      if (storageError) reportError(storageError, 'fortschritt.photo-file-delete')
    }
    toast.success(t('fortschritt_photo_deleted'))
    setActivePhoto(null)
    onChange()
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text)' }}>{t('fortschritt_photos')}</h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {t(photos.length === 1 ? 'fortschritt_photos_count_singular' : 'fortschritt_photos_count_plural', { n: photos.length })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div role="group" aria-label={t('fortschritt_grid_size')} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 10, background: 'var(--surface-input)', border: '1px solid var(--border)' }}>
            {PHOTO_GRID_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={gridSize === option.value}
                onClick={() => handleGridSizeChange(option.value)}
                style={{
                  border: 'none', borderRadius: 8, padding: '8px 10px', minHeight: 36,
                  background: gridSize === option.value ? 'var(--lg-fill-selected, var(--accent-weak))' : 'transparent',
                  color: gridSize === option.value ? 'var(--text)' : 'var(--text-muted)',
                  fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                }}
              >
                {t(`fortschritt_grid_${option.value}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openSheet}
            aria-label={t('fortschritt_photo_add')}
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'var(--surface-input)', border: '1px solid var(--border)',
              color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Plus size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div style={{ ...panel, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--surface-input)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageOff size={24} strokeWidth={1.5} color="var(--text-dim)" />
          </div>
          <div>
            <p style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-dim)', marginBottom: 8 }}>{t('fortschritt_photos_empty_title')}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {t('fortschritt_photos_empty_body')}
            </p>
          </div>
          <button type="button" onClick={openSheet} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Camera size={16} strokeWidth={1.5} /> {t('fortschritt_photo_add')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${photoGridColumns(gridSize)}, 1fr)`, gap: 8 }}>
          {photos.map(photo => (
            <button
              key={photo.id}
              type="button"
              onClick={() => openPhoto(photo)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, overflow: 'hidden', padding: 0, textAlign: 'left', cursor: 'pointer',
              }}
            >
              <div style={{ aspectRatio: '3/4', overflow: 'hidden' }}>
                <img src={photo.display_url} alt={fmtDate(photo.taken_at)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ padding: '8px 12px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dim)' }}>{fmtDate(photo.taken_at)}</p>
                {photo.weight_kg != null && (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{formatNumber(photo.weight_kg)} kg</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {lightbox.mounted && shownPhoto && (
        <div className="fs-backdrop" data-shown={lightbox.shown} inert={!activePhoto} onClick={() => setActivePhoto(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.93)', display: 'flex', flexDirection: 'column' }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text)' }}>{fmtDate(shownPhoto.taken_at)}</p>
              {shownPhoto.weight_kg != null && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>{formatNumber(shownPhoto.weight_kg)} kg</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" aria-label={t('fortschritt_photo_delete')} onClick={e => { e.stopPropagation(); void deletePhoto(shownPhoto) }}
                style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--lg-danger-fill, rgba(244,63,94,0.14))', border: '1px solid rgba(244,63,94,0.24)', color: 'var(--lg-bad-text, #f43f5e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
              <button type="button" aria-label={t('close')} onClick={e => { e.stopPropagation(); setActivePhoto(null) }}
                style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-input)', border: '1px solid var(--border)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
          <div className="fs-modal" data-shown={lightbox.shown} style={{ flex: 1, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <img src={shownPhoto.display_url} alt={fmtDate(shownPhoto.taken_at)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
          {shownPhoto.notes && (
            <div onClick={e => e.stopPropagation()} style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{shownPhoto.notes}</p>
            </div>
          )}
        </div>
      )}

      <div className="fs-backdrop" data-shown={sheetOpen} onClick={closeSheet} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }} />
      <div className="fs-sheet" data-shown={sheetOpen} inert={!sheetOpen} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px 24px 0 0',
        padding: '0 20px calc(24px + env(safe-area-inset-bottom, 0px))', maxHeight: 'calc(100dvh - var(--tyd-popup-top))', overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}>
        <div style={{ position: 'sticky', top: 0, paddingTop: 16, paddingBottom: 16, background: 'inherit', zIndex: 1 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--border)', margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 500, color: 'var(--text)' }}>{t('fortschritt_photo_add')}</h2>
            <button type="button" onClick={closeSheet} aria-label={t('close')} style={{ color: 'var(--text-muted)', display: 'flex' }}><X size={18} strokeWidth={1.5} /></button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />

        {previewUrl ? (
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <img src={previewUrl} alt={t('fortschritt_photo_preview')} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 16, display: 'block' }} />
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()}
            style={{ width: '100%', padding: '32px 0', borderRadius: 14, marginBottom: 16, border: '1px dashed var(--border-strong, var(--border))', background: 'var(--surface-input)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-dim)', cursor: 'pointer' }}>
            <Camera size={24} strokeWidth={1.5} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t('fortschritt_photo_pick')}</span>
          </button>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>{t('fortschritt_date')}</label>
          <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>{t('fortschritt_photo_weight_optional')}</label>
          <input type="number" inputMode="decimal" placeholder={t('fortschritt_photo_weight_placeholder', { value: formatNumber(82.5) })} value={weight} onChange={e => setWeight(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={fieldLabel}>{t('fortschritt_photo_notes_optional')}</label>
          <textarea placeholder={t('fortschritt_photo_notes_placeholder')} value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
        </div>
        <button type="button" onClick={() => void handleUpload()} disabled={uploading} {...denyProps(!selectedFile, t('fortschritt_photo_select_first'))} className="btn-primary" style={{ width: '100%' }}>
          {uploading ? t('fortschritt_photo_uploading') : t('fortschritt_photo_save')}
        </button>
      </div>
    </>
  )
}
