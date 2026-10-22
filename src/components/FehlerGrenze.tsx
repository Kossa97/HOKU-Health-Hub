import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { reportError } from '../lib/monitoring'

/**
 * Fängt Abstürze beim Rendern ab. Ohne sie baut React bei einem Fehler die
 * ganze App ab — der Bildschirm wird weiß. Mit ihr bleibt das Gerüst
 * (Navigation) stehen, und es gibt einen Weg zurück.
 *
 * `schluessel` setzt die Grenze zurück, z. B. beim Seitenwechsel.
 */
interface Props {
  children: ReactNode
  schluessel?: string
  ort: string
}

interface State {
  fehler: unknown
  schluessel?: string
}

export class FehlerGrenze extends Component<Props, State> {
  state: State = { fehler: null, schluessel: this.props.schluessel }

  static getDerivedStateFromError(fehler: unknown): Partial<State> {
    return { fehler: fehler ?? new Error('unbekannt') }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.schluessel !== state.schluessel) return { fehler: null, schluessel: props.schluessel }
    return null
  }

  componentDidCatch(fehler: unknown, info: ErrorInfo) {
    console.error(fehler)
    reportError(fehler, `boundary.${this.props.ort}`, info.componentStack)
  }

  render() {
    if (this.state.fehler) return <FehlerAnzeige />
    return this.props.children
  }
}

function FehlerAnzeige() {
  const { t } = useTranslation()
  return (
    <div role="alert" data-fehler-grenze className="mx-auto flex min-h-[60dvh] max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle size={36} aria-hidden="true" className="text-[var(--lg-warn-text)]" />
      <h1 className="text-[20px] font-semibold text-[var(--lg-text)]">{t('fehler_titel')}</h1>
      <p className="text-[15px] leading-snug text-[var(--lg-text-2)]">{t('fehler_text')}</p>
      <div className="flex w-full flex-col gap-2">
        <button type="button" className="lg-btn lg-btn-primary w-full" onClick={() => window.location.reload()}>
          {t('fehler_neu_laden')}
        </button>
        <button
          type="button"
          className="lg-gray-btn w-full"
          onClick={() => window.location.assign('/')}
        >
          {t('fehler_zum_start')}
        </button>
      </div>
    </div>
  )
}
