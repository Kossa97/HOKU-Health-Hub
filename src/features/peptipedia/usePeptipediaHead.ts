import { useEffect } from 'react'
import type { PeptipediaLocale } from './content/types'
import { buildPeptipediaMeta } from './seo'

export function usePeptipediaHead(locale: PeptipediaLocale, slug?: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const origin = document.getElementById('root')?.dataset.peptipediaOrigin || import.meta.env?.VITE_PUBLIC_SITE_URL || window.location.origin
    const meta = buildPeptipediaMeta(origin, locale, slug)
    const oldLang = document.documentElement.lang
    const oldDir = document.documentElement.dir
    document.title = meta.title
    document.documentElement.lang = locale
    document.documentElement.dir = 'ltr'
    document.head.querySelectorAll('[data-peptipedia]').forEach(node => node.remove())
    function tag(type: 'meta' | 'link', attributes: Record<string, string>) {
      const node = document.createElement(type)
      node.dataset.peptipedia = ''
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value))
      document.head.appendChild(node)
    }
    tag('meta', { name: 'description', content: meta.description })
    tag('link', { rel: 'canonical', href: meta.canonical })
    for (const language of ['de', 'en'] as const) tag('link', { rel: 'alternate', hreflang: language, href: meta.alternates[language] })
    for (const [key, content] of Object.entries(meta.openGraph)) tag('meta', { property: `og:${key}`, content })
    if (meta.noindex) tag('meta', { name: 'robots', content: 'noindex' })
    return () => {
      document.head.querySelectorAll('[data-peptipedia]').forEach(node => node.remove())
      document.title = 'HOKU: Health Hub'
      document.documentElement.lang = oldLang
      document.documentElement.dir = oldDir
    }
  }, [locale, slug, enabled])
}
