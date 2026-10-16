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

const todayStr = () => format(new Date(), 'yyyy-MM-dd')
const fmtDate = (d: string) => formatDaySafe(d, 'full')

interface Props {
  photos: ProgressPhotoEntry[]
  onChange: () => void
}

export function FotosTab({ photos, onChange }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [date, setDate] = useState(todayStr())
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState<ProgressPhotoEntry | null>(null)
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
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)' }}>{t('fortschritt_photos')}</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {t(photos.length === 1 ? 'fortschritt_photos_count_singular' : 'fortschritt_photos_count_plural', { n: photos.length })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div role="group" aria-label={t('fortschritt_grid_size')} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: 3, borderRadius: 12, background: 'var(--surface-input)', border: '1px solid var(--border)' }}>
            {PHOTO_GRID_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={gridSize === option.value}
                onClick={() => handleGridSizeChange(option.value)}
                style={{
                  border: 'none', borderRadius: 9, padding: '6px 8px',
                  background: gridSize === option.value ? 'var(--accent-weak)' : 'transparent',
                  color: gridSize === option.value ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '0.58rem', fontWeight: 800, cursor: 'pointer',
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
              width: 44, height: 44, borderRadius: 16, flexShrink: 0,
              background: 'var(--accent-weak)', border: '1px solid var(--accent-border)',
              color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div style={{ ...panel, padding: '52px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div style={{ width: 68, height: 68, borderRadius: 22, background: 'var(--accent-weak)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageOff size={30} color="var(--accent)" />
          </div>
          <div>
            <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 6 }}>{t('fortschritt_photos_empty_title')}</p>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
              {t('fortschritt_photos_empty_body')}
            </p>
          </div>
          <button type="button" onClick={openSheet} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Camera size={15} /> {t('fortschritt_photo_add')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${photoGridColumns(gridSize)}, 1fr)`, gap: 10 }}>
          {photos.map(photo => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActivePhoto(photo)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 18, overflow: 'hidden', padding: 0, textAlign: 'left', cursor: 'pointer',
              }}
            >
              <div style={{ aspectRatio: '3/4', overflow: 'hidden' }}>
                <img src={photo.display_url} alt={fmtDate(photo.taken_at)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ padding: '9px 11px' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-dim)' }}>{fmtDate(photo.taken_at)}</p>
                {photo.weight_kg != null && (
                  <p style={{ fontSize: '0.62rem', color: 'var(--accent)', fontWeight: 700 }}>{formatNumber(photo.weight_kg)} kg</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {activePhoto && (
        <div onClick={() => setActivePhoto(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.93)', display: 'flex', flexDirection: 'column' }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)' }}>{fmtDate(activePhoto.taken_at)}</p>
              {activePhoto.weight_kg != null && (
                <p style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>{formatNumber(activePhoto.weight_kg)} kg</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" aria-label={t('fortschritt_photo_delete')} onClick={e => { e.stopPropagation(); void deletePhoto(activePhoto) }}
                style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(244,63,94,0.14)', border: '1px solid rgba(244,63,94,0.24)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={16} />
              </button>
              <button type="button" aria-label={t('close')} onClick={e => { e.stopPropagation(); setActivePhoto(null) }}
                style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--surface-input)', border: '1px solid var(--border)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <img src={activePhoto.display_url} alt={fmtDate(activePhoto.taken_at)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
          {activePhoto.notes && (
            <div onClick={e => e.stopPropagation()} style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>{activePhoto.notes}</p>
            </div>
          )}
        </div>
      )}

      {sheetOpen && <div onClick={closeSheet} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }} />}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px 24px 0 0',
        padding: '0 18px 40px', transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.30s cubic-bezier(0.4,0,0.2,1)', maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ position: 'sticky', top: 0, paddingTop: 16, paddingBottom: 14, background: 'inherit', zIndex: 1 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--border)', margin: '0 auto 18px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)' }}>{t('fortschritt_photo_add')}</h2>
            <button type="button" onClick={closeSheet} aria-label={t('close')} style={{ color: 'var(--text-muted)', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />

        {previewUrl ? (
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <img src={previewUrl} alt={t('fortschritt_photo_preview')} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 16, display: 'block' }} />
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()}
            style={{ width: '100%', padding: '30px 0', borderRadius: 18, marginBottom: 16, border: '2px dashed var(--accent-border)', background: 'var(--accent-weak)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--accent)', cursor: 'pointer' }}>
            <Camera size={30} />
            <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>{t('fortschritt_photo_pick')}</span>
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
