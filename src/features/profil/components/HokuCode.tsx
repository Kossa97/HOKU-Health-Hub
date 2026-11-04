import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { hokuCodeAddress, hokuCodeSvg } from '../lib/hokuCode'

/**
 * Hoku-Code als Bild (Spec 2c, 4.2): immer dunkel auf hell, auch im dunklen
 * Sheet. Größe kommt von außen (`className`, z. B. `h-[124px] w-[124px]`).
 *
 * Das SVG entsteht in `hokuCodeSvg` nur aus der QR-Matrix und festen Werten; die
 * Adresse selbst steht nicht darin. Eigene IDs je Instanz, damit Sheet und
 * Vollbild auf derselben Seite sich Verlauf und Beschnitt nicht teilen.
 */
export function HokuCode({ url, className = '' }: { url: string; className?: string }) {
  const { t } = useTranslation()
  const id = `hoku-code-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const svg = useMemo(() => hokuCodeSvg(url, { idPrefix: id }), [url, id])
  return (
    <span
      role="img"
      aria-label={t('profil_hoku_code_aria', { adresse: hokuCodeAddress(url) })}
      data-hoku-code={url}
      className={`inline-block shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
