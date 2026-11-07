/**
 * Profilbild und Titelbild. Privater Bucket `profile-media`, erster Pfad-Teil
 * ist die Nutzer-ID (darauf prüfen die Storage-Policies). In `profiles` steht
 * nur der Pfad (`avatar_path`, `cover_path`); angezeigt wird über signierte
 * URLs. Vor dem Hochladen wird das Bild auf dem Gerät zugeschnitten,
 * verkleinert und über ein Canvas neu kodiert — das wirft EXIF samt
 * Aufnahmeort weg.
 */
import { supabase } from '../../../lib/supabase'
import { reportError } from '../../../lib/monitoring'

export type MediaKind = 'avatar' | 'cover'

export const PROFILE_MEDIA_BUCKET = 'profile-media'
const URL_TTL_SECONDS = 60 * 60
const MAX_BYTES = 500 * 1024
/** Größere Dateien werden nicht erst dekodiert (Speicher in der WebView). */
const MAX_FILE_BYTES = 25 * 1024 * 1024
/** So viele Quellpixel je Ausgabepixel bleiben beim Dekodieren mindestens erhalten. */
const DEKODIER_RESERVE = 2
const START_QUALITY = 0.82
const MIN_QUALITY = 0.5

const AUSGABE: Record<MediaKind, { breite: number; verhaeltnis: number }> = {
  avatar: { breite: 512, verhaeltnis: 1 },
  cover: { breite: 1500, verhaeltnis: 3 },
}

/** Datei über 25 MB — die Oberfläche zeigt dafür einen eigenen Text. */
export class BildZuGrossError extends Error {
  constructor() { super('Bild zu gross') }
}

export interface Zuschnitt { sx: number; sy: number; sw: number; sh: number; outW: number; outH: number }

/** Mittiger Zuschnitt auf 1:1 (Profilbild) bzw. 3:1 (Titelbild); nie hochskaliert. */
export function targetSize(w: number, h: number, kind: MediaKind): Zuschnitt {
  const { breite, verhaeltnis } = AUSGABE[kind]
  const sw = Math.floor(Math.min(w, h * verhaeltnis))
  const sh = Math.floor(sw / verhaeltnis)
  const outW = Math.min(breite, sw)
  return {
    sx: Math.floor((w - sw) / 2),
    sy: Math.floor((h - sh) / 2),
    sw,
    sh,
    outW,
    outH: Math.round(outW / verhaeltnis),
  }
}

function alsJpeg(canvas: HTMLCanvasElement, qualitaet: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht kodiert werden'))), 'image/jpeg', qualitaet)
  })
}

/** Größe des Bildes (mit Drehung laut EXIF) ohne es voll zu dekodieren; `null`, wenn nicht ermittelbar. */
function leseGroesse(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise(resolve => {
    let url: string
    try { url = URL.createObjectURL(file) } catch { resolve(null); return }
    const img = new Image()
    const fertig = (wert: { w: number; h: number } | null) => { URL.revokeObjectURL(url); resolve(wert) }
    img.onload = () => fertig(img.naturalWidth > 0 && img.naturalHeight > 0 ? { w: img.naturalWidth, h: img.naturalHeight } : null)
    img.onerror = () => fertig(null)
    img.src = url
  })
}

/**
 * Bild dekodieren. EXIF-Drehung wird ausdrücklich angefordert (nicht jede
 * WebView wendet sie von selbst an). Ist die Quelle viel größer als nötig,
 * wird gleich verkleinert dekodiert (mit Reserve, damit die Ausgabe nicht
 * unscharf wird) — der Zuschnitt wird danach aus den echten Maßen des
 * Bitmaps berechnet, nicht aus der geschätzten Größe.
 */
async function dekodiere(file: File, kind: MediaKind): Promise<ImageBitmap> {
  const optionen = { imageOrientation: 'from-image' } as const
  const groesse = await leseGroesse(file)
  if (groesse) {
    const z = targetSize(groesse.w, groesse.h, kind)
    const faktor = z.sw / z.outW
    if (faktor > DEKODIER_RESERVE) {
      const skala = DEKODIER_RESERVE / faktor
      try {
        return await createImageBitmap(file, {
          ...optionen,
          resizeWidth: Math.max(1, Math.round(groesse.w * skala)),
          resizeHeight: Math.max(1, Math.round(groesse.h * skala)),
          resizeQuality: 'high',
        })
      } catch { /* Resize-Optionen nicht unterstützt: voll dekodieren */ }
    }
  }
  return createImageBitmap(file, optionen)
}

/** Zuschneiden, verkleinern, als JPEG neu kodieren (ohne EXIF), Ziel unter 500 KB. */
export async function prepareImage(file: File, kind: MediaKind): Promise<Blob> {
  if (file.size > MAX_FILE_BYTES) throw new BildZuGrossError()
  const bild = await dekodiere(file, kind)
  try {
    const z = targetSize(bild.width, bild.height, kind)
    const canvas = document.createElement('canvas')
    canvas.width = z.outW
    canvas.height = z.outH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas nicht verfügbar')
    ctx.drawImage(bild, z.sx, z.sy, z.sw, z.sh, 0, 0, z.outW, z.outH)
    let qualitaet = START_QUALITY
    for (;;) {
      const blob = await alsJpeg(canvas, qualitaet)
      if (blob.size <= MAX_BYTES || qualitaet <= MIN_QUALITY) return blob
      qualitaet = Math.max(MIN_QUALITY, qualitaet - 0.1)
    }
  } finally {
    bild.close?.()
  }
}

/** Neues Bild hochladen, Pfad in `profiles` setzen, danach die alte Datei löschen. */
export async function uploadProfileMedia(userId: string, kind: MediaKind, file: File): Promise<string> {
  const spalte = `${kind}_path`
  const blob = await prepareImage(file, kind)
  const { data: alt } = await supabase.from('profiles').select(spalte).eq('id', userId).maybeSingle()
  const altPfad = (alt as Record<string, string | null> | null)?.[spalte] ?? null

  const pfad = `${userId}/${kind}-${Date.now()}.jpg`
  const ablage = supabase.storage.from(PROFILE_MEDIA_BUCKET)
  const { error: upFehler } = await ablage.upload(pfad, blob, { contentType: 'image/jpeg', upsert: false })
  if (upFehler) throw new Error(upFehler.message)

  // RLS ohne Treffer liefert keinen Fehler, nur null Zeilen.
  const { data: zeilen, error } = await supabase.from('profiles').update({ [spalte]: pfad }).eq('id', userId).select('id')
  if (error || !zeilen?.length) {
    // Ohne Pfad in der Profilzeile wäre die Datei verwaist und unsichtbar.
    const { error: aufraeumen } = await ablage.remove([pfad])
    if (aufraeumen) reportError(aufraeumen, 'profil.media-orphan-cleanup')
    throw new Error(error?.message ?? 'profiles: no row updated')
  }

  if (altPfad && altPfad !== pfad) {
    const { error: loeschFehler } = await ablage.remove([altPfad])
    if (loeschFehler) reportError(loeschFehler, 'profil.media-old-delete')
  }
  return pfad
}

/** Pfad aus der Profilzeile nehmen, dann die Datei löschen. */
export async function removeProfileMedia(userId: string, kind: MediaKind, path: string): Promise<void> {
  // RLS ohne Treffer liefert keinen Fehler, nur null Zeilen.
  const { data: zeilen, error } = await supabase.from('profiles').update({ [`${kind}_path`]: null }).eq('id', userId).select('id')
  if (error || !zeilen?.length) throw new Error(error?.message ?? 'profiles: no row updated')
  const { error: loeschFehler } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).remove([path])
  if (loeschFehler) reportError(loeschFehler, 'profil.media-delete')
}

/** Eine Stunde gültige URL für ein Bild im privaten Bucket. */
export async function signedMediaUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).createSignedUrl(path, URL_TTL_SECONDS)
  return error ? null : data?.signedUrl ?? null
}
