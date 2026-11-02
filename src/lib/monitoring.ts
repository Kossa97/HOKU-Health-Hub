import type { Breadcrumb, ErrorEvent } from '@sentry/react'
import { NETWORK_FAILURE_MESSAGES } from './networkErrors'

/**
 * Fehler-Monitoring (Sentry).
 *
 * Aus ohne `VITE_SENTRY_DSN`: dann wird Sentry nicht einmal geladen.
 *
 * In der Datenbank liegen Gesundheitsdaten echter Nutzer (Stack, Einnahmen,
 * Blutwerte). Nichts davon darf in einem Fehlerbericht landen. Deshalb gilt
 * hier „nur Bekanntes durchlassen", nicht „Bekanntes entfernen":
 * - Breadcrumbs: nur Seitenwechsel und Netzwerkaufrufe, beide mit Pfad ohne
 *   Parameter und ohne IDs. Klicks und Eingaben nie — Sentry beschreibt
 *   geklickte Elemente mit ihrem aria-label, und das traegt hier Namen und
 *   Mengen („BPC-157, 5 mg, 80 %").
 * - Fehlermeldungen: nur Meldungen, deren Wortlaut bekannt und frei von
 *   Nutzerdaten ist (eigene Pruefungen, Browser- und Netzfehler). Alles
 *   andere wird durch „[entfernt]" ersetzt; Typ, Stacktrace und die Stelle
 *   (`where`) bleiben — das reicht, um den Fehler zu finden.
 * - Keine Nutzerangaben, keine Anfrageinhalte, keine Sitzungen, kein Tracing.
 */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Pfad einer URL ohne Parameter, Fragment und IDs; Storage-Pfade nur bis zum Bucket. */
export function scrubUrl(url: string): string {
  const cut = url.search(/[?#]/)
  let rest = cut === -1 ? url : url.slice(0, cut)
  rest = rest.replace(/(\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?[^/]+)\/.*/, '$1/…')
  return rest.replace(UUID, ':id')
}

// Meldungen, die nachweislich keine Nutzerdaten tragen.
const SAFE_MESSAGES: readonly RegExp[] = [
  /^Invalid stack item( setup)? draft(: [\w., ]+)?$/,
  /^My Stack: kein angemeldeter Nutzer$/,
  /^(save_stack_item|save_stack_item_with_plan) returned no data$/,
  ...NETWORK_FAILURE_MESSAGES,
  /^The (operation|user) (was )?abort(ed|ed a request)\.?$/i,
  /^Failed to fetch dynamically imported module/,
  /^error loading dynamically imported module/,
  /^Importing a module script failed\.?$/,
  /^Loading (CSS )?chunk \d+ failed/,
  // Typfehler der Browser. Was in Klammern steht, ist QUELLTEXT (der
  // ausgewertete Ausdruck, bei uns verkleinert) — kein Laufzeitwert. Ohne
  // diese Formen kam der erste echte Fehler als „TypeError: [entfernt]" an
  // und liess sich keiner Stelle zuordnen.
  // (Meldungen mit einem gelesenen oder gesetzten Schluessel stehen unten
  // in RUNTIME_KEY_MESSAGES: der Schluessel ist ein Laufzeitwert.)
  /^[\w$.]+ is not a function$/,
  /^[\w$.]+ is not a function\. \(In '[^'\n]{1,160}', '[^'\n]{1,120}' is (undefined|null|an instance of [\w$]+)\)$/,
  /^[\w$.]+ is not defined$/,
  /^[\w$.]+ is not iterable( \(cannot read property Symbol\(Symbol\.iterator\)\))?$/,
  /^(undefined|null) is not an object \(evaluating '[^'\n]{1,160}'\)$/,
  /^(undefined|null) is not a function \(near '[^'\n]{1,160}'\)$/,
  /^Right side of assignment cannot be destructured$/,
  // Firefox
  /^[\w$.]+ is (undefined|null)$/,
  /^Minified React error #\d+/,
  /^Maximum update depth exceeded/,
  /^Hydration failed/,
  /^ResizeObserver loop/,
]

/**
 * Meldungen, die den gelesenen oder gesetzten SCHLUESSEL nennen — einen
 * Laufzeitwert. Bei `byName[substanz]` waere das der Name einer Substanz,
 * bei `dosen[menge]` eine Menge. Stehen bleibt er nur, wenn er wie ein Name
 * aus dem Quelltext aussieht (klein beginnend: `length`, `map`, `id`);
 * sonst wird er zu „…". Die Stelle findet man ueber den Stapel.
 */
const RUNTIME_KEY_MESSAGES: readonly RegExp[] = [
  /^(Cannot (?:read|set) properties of (?:undefined|null) \((?:reading|setting) ')([^'\n]{1,80})('\))$/,
  /^(Cannot destructure property ')([^'\n]{1,80})(' of '[^'\n]{1,160}' as it is (?:undefined|null)\.?)$/,
  /^(can't access property ")([^"\n]{1,80})(", [\w$.]+ is (?:undefined|null))$/,
]

function codeKey(key: string): string {
  return /^[a-z_$][\w$]{0,30}$/.test(key) ? key : '…'
}

export function scrubMessage(message: string): string {
  for (const pattern of RUNTIME_KEY_MESSAGES) {
    const treffer = message.match(pattern)
    if (treffer) return `${treffer[1]}${codeKey(treffer[2])}${treffer[3]}`
  }
  return SAFE_MESSAGES.some(pattern => pattern.test(message)) ? message : '[entfernt]'
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'navigation') {
    return {
      category: 'navigation',
      timestamp: breadcrumb.timestamp,
      data: {
        from: typeof breadcrumb.data?.from === 'string' ? scrubUrl(breadcrumb.data.from) : undefined,
        to: typeof breadcrumb.data?.to === 'string' ? scrubUrl(breadcrumb.data.to) : undefined,
      },
    }
  }
  if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
    return {
      category: breadcrumb.category,
      type: breadcrumb.type,
      level: breadcrumb.level,
      timestamp: breadcrumb.timestamp,
      data: {
        method: breadcrumb.data?.method,
        status_code: breadcrumb.data?.status_code,
        url: typeof breadcrumb.data?.url === 'string' ? scrubUrl(breadcrumb.data.url) : undefined,
      },
    }
  }
  return null
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event }
  delete scrubbed.user
  delete scrubbed.extra
  delete scrubbed.contexts
  if (scrubbed.request) {
    scrubbed.request = { url: scrubbed.request.url ? scrubUrl(scrubbed.request.url) : undefined }
  }
  if (scrubbed.message) scrubbed.message = scrubMessage(scrubbed.message)
  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map(value => ({
        ...value,
        value: value.value ? scrubMessage(value.value) : value.value,
        // Ohne Stapel baut Sentry einen Rahmen aus der Seitenadresse — mit
        // Parametern und Fragment. Die Rahmen gehen durch denselben Filter.
        ...(value.stacktrace?.frames ? {
          stacktrace: {
            ...value.stacktrace,
            frames: value.stacktrace.frames.map(frame => ({
              ...frame,
              ...(frame.filename ? { filename: scrubUrl(frame.filename) } : {}),
              ...(frame.abs_path ? { abs_path: scrubUrl(frame.abs_path) } : {}),
            })),
          },
        } : {}),
      })),
    }
  }
  if (scrubbed.breadcrumbs) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null)
  }
  return scrubbed
}

/**
 * Browser und System, grob: Name und Hauptversion („Safari 18", „iOS 18").
 * Ohne das war nicht zu sagen, auf welchem Geraet ein Fehler auftrat — die
 * vollstaendige Kennung (User-Agent) geht bewusst nicht mit.
 *
 * Die Kennungen sind teils eingefroren: Chrome auf Android meldet immer
 * „Android 10; K", iOS 26 noch „OS 18_6", ein iPad nennt sich „Macintosh".
 * Wo das erkennbar ist, steht keine Version statt einer falschen; auf iOS
 * gilt die Safari-Version, die der des Systems folgt.
 */
export function platformTags(userAgent: string, touchPoints = 0): { browser: string; os: string } {
  const version = (pattern: RegExp) => userAgent.match(pattern)?.[1] ?? null
  const mit = (name: string, v: string | null) => (v ? `${name} ${v}` : name)
  const safari = version(/Version\/(\d+)/)
  const ipad = /Macintosh/.test(userAgent) && touchPoints > 1
  const os = /iPhone|iPad|iPod/.test(userAgent) || ipad ? mit(ipad || /iPad/.test(userAgent) ? 'iPadOS' : 'iOS', safari ?? version(/OS (\d+)_/))
    : /Android/.test(userAgent) ? mit('Android', /Android 10; K\)/.test(userAgent) ? null : version(/Android (\d+)/))
      : /Windows/.test(userAgent) ? 'Windows'
        : /Mac OS X/.test(userAgent) ? 'macOS'
          : /Linux/.test(userAgent) ? 'Linux' : 'andere'
  const browser = /Edg(A|iOS)?\//.test(userAgent) ? mit('Edge', version(/Edg(?:A|iOS)?\/(\d+)/))
    : /SamsungBrowser\//.test(userAgent) ? mit('Samsung Internet', version(/SamsungBrowser\/(\d+)/))
      : /OPR\//.test(userAgent) ? mit('Opera', version(/OPR\/(\d+)/))
        : /(CriOS|Chrome)\//.test(userAgent) ? mit('Chrome', version(/(?:CriOS|Chrome)\/(\d+)/))
          : /(FxiOS|Firefox)\//.test(userAgent) ? mit('Firefox', version(/(?:FxiOS|Firefox)\/(\d+)/))
            : /Safari\//.test(userAgent) ? mit('Safari', safari) : 'andere'
  return { browser, os }
}

type SentryModule = typeof import('@sentry/react')
let sentry: SentryModule | null = null

/**
 * Startet Sentry — nur mit DSN, und dann erst per dynamischem Import: ohne
 * DSN kommt das SDK gar nicht erst in den Browser.
 */
export async function initMonitoring(dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined): Promise<boolean> {
  if (!dsn) return false
  const Sentry = await import('@sentry/react')
  const plattform = platformTags(navigator.userAgent, navigator.maxTouchPoints ?? 0)
  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_DEPLOY_ENV as string | undefined) || import.meta.env.MODE,
    release: (import.meta.env.VITE_RELEASE as string | undefined) || undefined,
    // Nichts ueber Nutzer erheben. Ab SDK 11 ist `userInfo` sonst AN — und
    // Sentry leitete aus der Verbindung den Ort ab („Gelsenkirchen"), auch
    // mit ausgeschalteter IP-Speicherung. Mit `userInfo: false` sagt das SDK
    // dem Server `infer_ip: never`.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      frameContextLines: 0,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
    },
    // Nur Fehler: keine Sitzungen (die gingen am beforeSend vorbei).
    integrations: defaults => defaults.filter(integration => integration.name !== 'BrowserSession'),
    beforeSend: event => {
      const scrubbed = scrubEvent(event)
      scrubbed.tags = { ...scrubbed.tags, ...plattform }
      return scrubbed
    },
    beforeBreadcrumb: breadcrumb => scrubBreadcrumb(breadcrumb),
  })
  sentry = Sentry
  return true
}

/**
 * Einen Fehler melden — dort, wo die App ihn selbst behandelt (etwa
 * „Speichern fehlgeschlagen"). `where` sagt, an welcher Stelle.
 */
export function reportError(error: unknown, where: string, componentStack?: string | null): void {
  if (!sentry) return
  const hint = {
    captureContext: { tags: { where } },
    // Was React nicht abfangen konnte, hat die App abgebaut — das ist ein
    // Absturz, kein behandelter Fehler wie „Speichern fehlgeschlagen".
    ...(where === 'react.uncaught' ? { mechanism: { handled: false, type: 'auto.function.react.error_handler' } } : {}),
  }
  // Mit Komponentenkette haengt Sentry sie als eigenen „Fehler" an, dessen
  // Stapel ueber die Source-Maps aufgeloest wird — so stehen dort die echten
  // Komponentennamen statt der verkleinerten („Br < Wo"). Das geht nur an
  // einem Error; und es setzt `cause` am Fehler, was an einem vorhandenen
  // Text-`cause` scheitern kann — dann eben ohne Kette.
  if (componentStack && error instanceof Error) {
    try {
      sentry.captureReactException(error, { componentStack }, hint)
      return
    } catch { /* weiter unten ohne Kette */ }
  }
  sentry.captureException(error, hint)
}

/**
 * Fuer createRoot/hydrateRoot: was React nicht selbst abfaengt, melden —
 * und weiter in der Konsole zeigen wie ohne Handler.
 */
export const reactRootErrorOptions = {
  onUncaughtError: (error: unknown, errorInfo?: { componentStack?: string | null }) => {
    console.error(error)
    reportError(error, 'react.uncaught', errorInfo?.componentStack)
  },
  onRecoverableError: (error: unknown, errorInfo?: { componentStack?: string | null }) => {
    console.error(error)
    reportError(error, 'react.recoverable', errorInfo?.componentStack)
  },
}
