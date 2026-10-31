import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Flag } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface Meldung {
  report_id: string
  reason: string
  details: string | null
  created_at: string
  art: 'erfahrung' | 'profil'
  review_id: string | null
  review_exists: boolean
  username: string | null
  /** Was gemeldet wurde, festgehalten beim Melden. */
  snapshot: {
    substanz?: string | null; title?: string | null; body?: string | null; pros?: string | null; cons?: string | null
    display_name?: string | null; public_bio?: string | null
  } | null
}

/**
 * Offene Meldungen fuer Admins (`moderation_queue`). Ausblenden nimmt die
 * Erfahrung bzw. das ganze Profil aus der Oeffentlichkeit und erledigt alle
 * Meldungen dazu; Ablehnen schliesst nur diese Meldung. Gezeigt wird, was
 * beim Melden zu sehen war — auch wenn es inzwischen geloescht ist. Die Datenbank prueft das Admin-Recht
 * selbst — diese Ansicht ist nur die Oberflaeche dafuer.
 */
export function ModerationQueue() {
  const { t, i18n } = useTranslation()
  const [meldungen, setMeldungen] = useState<Meldung[] | null>(null)
  const [neuLaden, setNeuLaden] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let aktuell = true
    void supabase.rpc('moderation_queue').then(({ data, error }) => {
      if (!aktuell) return
      if (error) toast.error(t('error'))
      setMeldungen(error ? [] : (data as Meldung[] | null) ?? [])
    })
    return () => { aktuell = false }
  }, [neuLaden, t])

  const entscheiden = async (meldung: Meldung, aktion: 'ausblenden' | 'ablehnen') => {
    setBusy(meldung.report_id)
    const { error } = await supabase.rpc('resolve_content_report', { p_report_id: meldung.report_id, p_action: aktion })
    setBusy(null)
    if (error) return toast.error(t('error'))
    toast.success(t(aktion === 'ausblenden' ? 'moderation_hidden' : 'moderation_dismissed'))
    setNeuLaden(n => n + 1)
  }

  const datum = (wert: string) => new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(wert))

  return (
    <section data-moderation-queue className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-amber-200">
        <Flag size={16} strokeWidth={1.5} aria-hidden="true" /> {t('moderation_title')}
        {meldungen && meldungen.length > 0 && <span className="font-mono text-xs tabular-nums text-amber-200/70">{meldungen.length}</span>}
      </h2>
      {meldungen === null ? null : meldungen.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">{t('moderation_empty')}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {meldungen.map(m => (
            <li key={m.report_id} data-moderation-report={m.report_id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm">
              <p className="text-xs text-slate-500">
                {t(`report_reason_${m.reason}`)} · {datum(m.created_at)}
                {m.username && <> · @{m.username}</>}
              </p>
              {m.details && <p className="mt-1 text-xs text-slate-400">„{m.details}"</p>}
              <div className="mt-2 rounded-lg bg-slate-900 p-2 text-slate-300">
                {m.art === 'profil' ? (
                  <>
                    <p className="text-xs font-medium text-sky-400">{t('moderation_profile_report')}</p>
                    {m.snapshot?.display_name && <p className="font-medium text-white">{m.snapshot.display_name}</p>}
                    {m.snapshot?.public_bio && <p className="mt-1 whitespace-pre-wrap">{m.snapshot.public_bio}</p>}
                  </>
                ) : (
                  <>
                    {m.snapshot?.substanz && <p className="text-xs font-medium text-sky-400">{m.snapshot.substanz}</p>}
                    {m.snapshot?.title && <p className="font-medium text-white">{m.snapshot.title}</p>}
                    {m.snapshot?.body && <p className="mt-1 whitespace-pre-wrap">{m.snapshot.body}</p>}
                    {m.snapshot?.pros && <p className="mt-1 text-xs">+ {m.snapshot.pros}</p>}
                    {m.snapshot?.cons && <p className="mt-1 text-xs">− {m.snapshot.cons}</p>}
                    {!m.review_exists && <p className="mt-1 text-xs text-slate-500">{t('moderation_deleted_review')}</p>}
                  </>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" data-moderation-dismiss disabled={busy !== null} onClick={() => void entscheiden(m, 'ablehnen')} className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-900 text-xs font-medium text-slate-300 disabled:opacity-50">
                  {t('moderation_dismiss')}
                </button>
                <button type="button" data-moderation-hide disabled={busy !== null || (m.art === 'erfahrung' && !m.review_exists)} onClick={() => void entscheiden(m, 'ausblenden')} className="min-h-11 flex-1 rounded-xl bg-amber-500 text-xs font-medium text-slate-950 disabled:opacity-50">
                  {t('moderation_hide')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
