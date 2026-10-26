import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { reportError } from '../lib/monitoring'
import { BATCH_LINK_ERNEUERN_MS, BATCH_LINK_SEKUNDEN, signiereBatchDateien } from '../lib/batchFiles'

/** Nach einem Fehler erneut versuchen. */
const NOCHMAL_MS = 30 * 1000
/** Kurz vor Ablauf gilt ein Link schon als abgelaufen. */
const GUELTIG_MS = (BATCH_LINK_SEKUNDEN - 60) * 1000

interface Link {
  wert: string
  url: string
  am: number
}

/**
 * Link zu einer Datei im privaten Speicher `batch-files`.
 *
 * Der Link steht signiert im `href` — so oeffnet ihn auch die native App wie
 * jeden anderen Link. Er wird erneuert, wenn er aelter als 40 Minuten ist und
 * die Seite wieder sichtbar wird, der Link beruehrt oder fokussiert wird, oder
 * ein Timer ablaeuft (Timer allein reichen nicht: im Hintergrund stehen sie).
 * Ist er beim Tippen doch abgelaufen, wird erst ein neuer geholt.
 * Bis dahin — oder wenn es die Datei nicht mehr gibt — steht der Text ohne Link da.
 */
export function BatchDateiLink({ wert, className, children }: { wert: string; className?: string; children: ReactNode }) {
  const [link, setLink] = useState<Link | null>(null)
  const linkRef = useRef<Link | null>(null)
  // Vom Effekt gesetzt: neuen Link holen (fuer Beruehren, Fokus, Tippen).
  const holenRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Gilt nur fuer diese Datei und dieses Einhaengen; spaetere Antworten verfallen.
    let aktiv = true
    let laeuft = false
    let timer: ReturnType<typeof setTimeout> | undefined
    linkRef.current = null

    const holen = () => {
      if (laeuft) return
      laeuft = true
      clearTimeout(timer)
      signiereBatchDateien(supabase as never, [wert]).then(
        links => {
          laeuft = false
          if (!aktiv) return
          const url = links.get(wert)
          const neu = url ? { wert, url, am: Date.now() } : null
          linkRef.current = neu
          setLink(neu)
          if (neu) timer = setTimeout(holen, BATCH_LINK_ERNEUERN_MS)
        },
        error => {
          laeuft = false
          if (!aktiv) return
          reportError(error, 'batch-files.sign')
          // Einen abgelaufenen Link nicht stehen lassen.
          if (linkRef.current && Date.now() - linkRef.current.am > GUELTIG_MS) {
            linkRef.current = null
            setLink(null)
          }
          timer = setTimeout(holen, NOCHMAL_MS)
        },
      )
    }
    const sichtbar = () => {
      if (document.visibilityState !== 'visible') return
      const alt = linkRef.current
      if (!alt || Date.now() - alt.am > BATCH_LINK_ERNEUERN_MS) holen()
    }

    holenRef.current = holen
    holen()
    document.addEventListener('visibilitychange', sichtbar)
    return () => {
      aktiv = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', sichtbar)
    }
  }, [wert])

  const auffrischen = () => {
    const alt = linkRef.current
    if (alt && Date.now() - alt.am > BATCH_LINK_ERNEUERN_MS) holenRef.current()
  }

  const oeffnen = (event: MouseEvent<HTMLAnchorElement>) => {
    const alt = linkRef.current
    if (alt && Date.now() - alt.am > GUELTIG_MS) {
      event.preventDefault()
      linkRef.current = null
      setLink(null)
      holenRef.current()
    }
  }

  const url = link?.wert === wert ? link.url : null
  if (!url) return <span className={className} aria-disabled="true">{children}</span>
  return (
    <a
      className={className}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onPointerDown={auffrischen}
      onFocus={auffrischen}
      onClick={oeffnen}
    >
      {children}
    </a>
  )
}
