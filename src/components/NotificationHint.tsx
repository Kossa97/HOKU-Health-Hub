import { BellOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NotificationSupport } from '../lib/notificationPermission'

/**
 * Ein Satz unter einer Funktion, die Mitteilungen braucht, wenn sie dort nicht
 * ankommen koennen. Nur de/en (CLAUDE.md, „Sprachen beim Start"); jede andere
 * Oberflaechensprache bekommt Englisch, die grossen Locale-Dateien bleiben
 * unangetastet.
 */

type HintKind = Exclude<NotificationSupport, 'default' | 'granted'>

const TEXTS: Record<'de' | 'en', Record<HintKind, string>> = {
  de: {
    'denied': 'Mitteilungen sind aus, deshalb kommt hier nichts an. In den Einstellungen deines Geräts kannst du sie für HOKU wieder erlauben.',
    'ios-needs-install': 'Auf dem iPhone kommen Mitteilungen nur an, wenn HOKU auf dem Home-Bildschirm liegt: Teilen → „Zum Home-Bildschirm“, dann von dort öffnen.',
    'unsupported': 'Dieser Browser kann keine Mitteilungen anzeigen.',
    'native-app': 'In dieser App-Version kommen noch keine Mitteilungen an.',
  },
  en: {
    'denied': 'Notifications are off, so nothing will reach you here. You can allow them for HOKU again in your device settings.',
    'ios-needs-install': 'On iPhone, notifications only arrive when HOKU is on your home screen: Share → “Add to Home Screen”, then open it from there.',
    'unsupported': 'This browser can’t show notifications.',
    'native-app': 'This version of the app can’t deliver notifications yet.',
  },
}

/** Bildet den Stand des Push-Hooks auf die Hinweise ab. */
function hintKindFor(state: string): HintKind | null {
  switch (state) {
    case 'denied':            return 'denied'
    case 'ios-needs-install': return 'ios-needs-install'
    case 'unsupported':       return 'unsupported'
    case 'ios-native-app':
    case 'native-app':        return 'native-app'
    default:                  return null
  }
}

export function NotificationHint({ state }: { state: string }) {
  const { i18n } = useTranslation()
  const kind = hintKindFor(state)
  if (!kind) return null
  const lang = (i18n.resolvedLanguage ?? i18n.language ?? '').toLowerCase().startsWith('de') ? 'de' : 'en'
  return (
    <p data-notification-hint={kind} role="status" className="flex items-start gap-2 text-xs leading-relaxed text-amber-200/90">
      <BellOff aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
      <span className="min-w-0">{TEXTS[lang][kind]}</span>
    </p>
  )
}
