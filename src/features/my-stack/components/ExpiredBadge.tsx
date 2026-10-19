import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Translate = (key: string, options?: Record<string, unknown>) => unknown

/** „Seit heute abgelaufen!", „Seit 1 Tag abgelaufen!", „Seit 5 Tagen abgelaufen!" — in Kalendertagen. */
function expiredLabel(t: Translate, daysSince: number): string {
  if (daysSince <= 0) return String(t('my_stack_expired_full_today'))
  if (daysSince === 1) return String(t('my_stack_expired_full_day'))
  return String(t('my_stack_expired_full_days', { n: daysSince }))
}

/** „seit heute", „seit 1 Tag", „seit 5 Tagen" — fuer den Wechsel. */
function expiredSinceLabel(t: Translate, daysSince: number): string {
  if (daysSince <= 0) return String(t('my_stack_expired_since_today'))
  if (daysSince === 1) return String(t('my_stack_expired_since_day'))
  return String(t('my_stack_expired_since_days', { n: daysSince }))
}

/**
 * Abgelaufen — in zwei Gestalten:
 *
 * `still` (Liste, Vollbild): ein blinkendes Warnsymbol und dahinter der
 * ganze Satz. Kein Rahmen, kein Gluehen, kein Textwechsel.
 *
 * `wechsel` (Karussell): das rote Abzeichen mit Rand. Endlos im
 * 6-Sekunden-Takt: 3 s „Abgelaufen!" mit blinkendem Symbol und gluehendem
 * Rand, dann 3 s „seit X Tagen". Beide Texte liegen uebereinander, das
 * Abzeichen springt beim Wechsel nicht; vorgelesen wird beides zusammen.
 * Bei „weniger Bewegung" steht still „seit X Tagen".
 *
 * Der Takt steht allein im CSS (`.tyd-expired-*` in `index.css`). Der
 * Aufrufer setzt einen `key` je Substanz, damit er bei der naechsten von
 * vorn beginnt. Bei „weniger Bewegung" steht auch das Symbol.
 */
export function ExpiredBadge({ daysSince, variante = 'still' }: { daysSince: number; variante?: 'still' | 'wechsel' }) {
  const { t } = useTranslation()

  if (variante === 'wechsel') {
    const since = expiredSinceLabel(t, daysSince)
    const text = 'col-start-1 row-start-1 whitespace-nowrap'
    return (
      <span
        data-expired-badge="wechsel"
        className="tyd-expired-badge inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-500/10 px-2.5 py-1 font-semibold text-red-300"
      >
        <AlertTriangle size={13} aria-hidden="true" className="tyd-expired-icon shrink-0 text-red-400" />
        <span className="sr-only">{String(t('my_stack_expired_aria', { since }))}</span>
        <span aria-hidden="true" className="grid">
          <span className={`${text} tyd-expired-text-alarm`}>{String(t('my_stack_expired'))}</span>
          <span className={`${text} tyd-expired-text-since tabular-nums`}>{since}</span>
        </span>
      </span>
    )
  }

  return (
    <span
      data-expired-badge="still"
      className="inline-flex items-center gap-1.5 whitespace-nowrap py-1 font-semibold text-red-300"
    >
      <AlertTriangle size={14} aria-hidden="true" className="tyd-expired-icon shrink-0 text-red-400" />
      {expiredLabel(t, daysSince)}
    </span>
  )
}
