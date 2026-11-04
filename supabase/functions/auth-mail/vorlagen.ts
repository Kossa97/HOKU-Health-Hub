/**
 * Mails von Hoku (docs/registrierung/PLAN.md). Nur Deutsch und Englisch. Jede Mail mit Code
 * trägt ihn im Betreff, groß im Text und im Vorschautext: so schlägt iOS ihn über der
 * Tastatur vor („Aus Mail"), Gmail zeigt „Kopieren", und ein Tipp markiert ihn ganz
 * (`user-select: all`). Einen echten Kopier-Knopf gibt es in Mails nicht (kein JavaScript).
 * Keine Links außer Impressum/Datenschutz, keine Gesundheitsdaten.
 */

export type Sprache = 'de' | 'en'

/** Mails mit Code */
export type CodeArt = 'signup' | 'recovery' | 'email_change_alt' | 'email_change_neu' | 'reauthentication' | 'anmelden'
/** Hinweise ohne Code */
export type HinweisArt = 'passwort_geaendert' | 'email_geaendert' | 'anmeldung_verknuepft' | 'anmeldung_entfernt' | 'konto_geaendert'

export interface Mail {
  betreff: string
  html: string
  text: string
}

export interface CodeEingabe {
  art: CodeArt
  sprache: Sprache
  code: string
  minuten: number
  /** Uhrzeit, bis zu der der Code gilt, schon formatiert (z. B. „11:35"), oder null */
  bis: string | null
  appUrl: string
  /** Knopf „In Hoku öffnen": öffnet die App und bestätigt mit einem Tipp (sonst kein Knopf) */
  link?: string | null
}

export interface HinweisEingabe {
  art: HinweisArt
  sprache: Sprache
  /** Apple, Google … bei verknüpfter/entfernter Anmeldung */
  anbieter?: string
  appUrl: string
}

interface CodeText {
  betreff: (code: string) => string
  titel: string
  einleitung: string
  /** Einleitung, wenn die Mail den Knopf „In Hoku öffnen" hat */
  mitKnopf?: string
  ignorieren: string
}

const CODE_TEXTE: Record<Sprache, Record<CodeArt, CodeText>> = {
  de: {
    signup: {
      betreff: c => `${c} ist dein Hoku-Code`,
      titel: 'Bestätige deine E-Mail-Adresse',
      einleitung: 'Gib diesen Code in der App ein, um dein Konto zu bestätigen.',
      mitKnopf: 'Tippe auf den Knopf, um dein Konto zu bestätigen.',
      ignorieren: 'Du hast dich nicht bei Hoku registriert? Dann ignoriere diese Mail einfach.',
    },
    recovery: {
      betreff: c => `${c} ist dein Code zum Zurücksetzen`,
      titel: 'Passwort zurücksetzen',
      einleitung: 'Gib diesen Code in der App ein, um ein neues Passwort festzulegen.',
      mitKnopf: 'Tippe auf den Knopf, um ein neues Passwort festzulegen.',
      ignorieren: 'Du hast das nicht angefordert? Dann bleibt dein Passwort, wie es ist.',
    },
    email_change_alt: {
      betreff: c => `${c} ist dein Code zum Ändern der E-Mail`,
      titel: 'E-Mail-Adresse ändern',
      einleitung: 'Gib diesen Code in der App ein, um zu bestätigen, dass deine E-Mail-Adresse geändert werden soll.',
      ignorieren: 'Du hast das nicht angefordert? Dann ignoriere diese Mail und ändere zur Sicherheit dein Passwort.',
    },
    email_change_neu: {
      betreff: c => `${c} ist dein Hoku-Code`,
      titel: 'Neue E-Mail-Adresse bestätigen',
      einleitung: 'Gib diesen Code in der App ein, um deine neue E-Mail-Adresse zu bestätigen.',
      ignorieren: 'Du hast das nicht angefordert? Dann ignoriere diese Mail einfach.',
    },
    reauthentication: {
      betreff: c => `${c} ist dein Bestätigungscode`,
      titel: 'Bestätige, dass du es bist',
      einleitung: 'Gib diesen Code in der App ein, um fortzufahren.',
      ignorieren: 'Du hast das nicht angefordert? Dann ignoriere diese Mail und ändere zur Sicherheit dein Passwort.',
    },
    anmelden: {
      betreff: c => `${c} ist dein Anmeldecode`,
      titel: 'Dein Anmeldecode',
      einleitung: 'Gib diesen Code in der App ein, um dich anzumelden.',
      ignorieren: 'Du wolltest dich nicht anmelden? Dann ignoriere diese Mail einfach.',
    },
  },
  en: {
    signup: {
      betreff: c => `${c} is your Hoku code`,
      titel: 'Confirm your email address',
      einleitung: 'Enter this code in the app to confirm your account.',
      mitKnopf: 'Tap the button to confirm your account.',
      ignorieren: "Didn't sign up for Hoku? Just ignore this email.",
    },
    recovery: {
      betreff: c => `${c} is your password reset code`,
      titel: 'Reset your password',
      einleitung: 'Enter this code in the app to set a new password.',
      mitKnopf: 'Tap the button to set a new password.',
      ignorieren: "Didn't ask for this? Your password stays as it is.",
    },
    email_change_alt: {
      betreff: c => `${c} is your code to change your email`,
      titel: 'Change your email address',
      einleitung: 'Enter this code in the app to confirm that your email address should be changed.',
      ignorieren: "Didn't ask for this? Ignore this email and change your password to be safe.",
    },
    email_change_neu: {
      betreff: c => `${c} is your Hoku code`,
      titel: 'Confirm your new email address',
      einleitung: 'Enter this code in the app to confirm your new email address.',
      ignorieren: "Didn't ask for this? Just ignore this email.",
    },
    reauthentication: {
      betreff: c => `${c} is your confirmation code`,
      titel: "Confirm it's you",
      einleitung: 'Enter this code in the app to continue.',
      ignorieren: "Didn't ask for this? Ignore this email and change your password to be safe.",
    },
    anmelden: {
      betreff: c => `${c} is your sign-in code`,
      titel: 'Your sign-in code',
      einleitung: 'Enter this code in the app to sign in.',
      ignorieren: "Didn't try to sign in? Just ignore this email.",
    },
  },
}

const HINWEIS_TEXTE: Record<Sprache, Record<HinweisArt, (anbieter: string) => { betreff: string; titel: string; text: string }>> = {
  de: {
    passwort_geaendert: () => ({
      betreff: 'Dein Passwort wurde geändert',
      titel: 'Dein Passwort wurde geändert',
      text: 'Das Passwort für dein Hoku-Konto wurde gerade geändert. Warst du das nicht? Dann setze es in der App sofort über „Passwort vergessen“ neu.',
    }),
    email_geaendert: () => ({
      betreff: 'Deine E-Mail-Adresse wurde geändert',
      titel: 'Deine E-Mail-Adresse wurde geändert',
      text: 'Dein Hoku-Konto läuft ab jetzt über eine neue E-Mail-Adresse. Warst du das nicht? Dann setze dein Passwort in der App über „Passwort vergessen“ neu.',
    }),
    anmeldung_verknuepft: a => ({
      betreff: 'Neue Anmeldung mit deinem Konto verknüpft',
      titel: 'Neue Anmeldung verknüpft',
      text: `Mit deinem Hoku-Konto wurde gerade eine neue Anmeldung verknüpft${a ? ` (${a})` : ''}. Warst du das nicht? Dann setze dein Passwort in der App über „Passwort vergessen“ neu.`,
    }),
    anmeldung_entfernt: a => ({
      betreff: 'Anmeldung von deinem Konto entfernt',
      titel: 'Anmeldung entfernt',
      text: `Von deinem Hoku-Konto wurde gerade eine Anmeldung entfernt${a ? ` (${a})` : ''}. Warst du das nicht? Dann setze dein Passwort in der App über „Passwort vergessen“ neu.`,
    }),
    konto_geaendert: () => ({
      betreff: 'Änderung an deinem Hoku-Konto',
      titel: 'Änderung an deinem Konto',
      text: 'An der Sicherheit deines Hoku-Kontos wurde gerade etwas geändert. Warst du das nicht? Dann setze dein Passwort in der App über „Passwort vergessen“ neu.',
    }),
  },
  en: {
    passwort_geaendert: () => ({
      betreff: 'Your password was changed',
      titel: 'Your password was changed',
      text: "The password for your Hoku account was just changed. Wasn't you? Reset it right away in the app with “Forgot password”.",
    }),
    email_geaendert: () => ({
      betreff: 'Your email address was changed',
      titel: 'Your email address was changed',
      text: "Your Hoku account now uses a new email address. Wasn't you? Reset your password in the app with “Forgot password”.",
    }),
    anmeldung_verknuepft: a => ({
      betreff: 'New sign-in linked to your account',
      titel: 'New sign-in linked',
      text: `A new sign-in was just linked to your Hoku account${a ? ` (${a})` : ''}. Wasn't you? Reset your password in the app with “Forgot password”.`,
    }),
    anmeldung_entfernt: a => ({
      betreff: 'Sign-in removed from your account',
      titel: 'Sign-in removed',
      text: `A sign-in was just removed from your Hoku account${a ? ` (${a})` : ''}. Wasn't you? Reset your password in the app with “Forgot password”.`,
    }),
    konto_geaendert: () => ({
      betreff: 'A change to your Hoku account',
      titel: 'A change to your account',
      text: "Something about the security of your Hoku account was just changed. Wasn't you? Reset your password in the app with “Forgot password”.",
    }),
  },
}

interface Rahmen {
  code: string
  /** Knopf: öffnet die App, die den Code selbst übernimmt (ein echter Kopier-Knopf geht in Mails nicht) */
  oeffnen: string
  oeffnenInfo: string
  oder: string
  /** Kopieren: Mail-Apps führen kein JavaScript aus, ein echter Knopf geht nicht — gedrückt halten markiert den Code */
  kopieren: string
  /** Gültigkeit, groß im Codefeld */
  gilt: (min: number, bis: string | null) => string
  einmal: string
  fuss: string
  impressum: string
  datenschutz: string
}

const RAHMEN: Record<Sprache, Rahmen> = {
  de: {
    code: 'Dein Code',
    oeffnen: 'In Hoku öffnen',
    oeffnenInfo: 'Hoku öffnet sich und übernimmt den Code.',
    oder: 'oder Code eingeben',
    kopieren: 'Tippen und halten zum Kopieren',
    gilt: (min, bis) => `Gültig für ${min} Minuten${bis ? ` · bis ${bis} Uhr` : ''}`,
    einmal: 'Der Code lässt sich nur einmal verwenden.',
    fuss: 'Diese Mail wurde automatisch von Hoku verschickt.',
    impressum: 'Impressum',
    datenschutz: 'Datenschutz',
  },
  en: {
    code: 'Your code',
    oeffnen: 'Open in Hoku',
    oeffnenInfo: 'Hoku opens and fills in the code.',
    oder: 'or enter the code',
    kopieren: 'Tap and hold to copy',
    gilt: (min, bis) => `Valid for ${min} minutes${bis ? ` · until ${bis}` : ''}`,
    einmal: 'The code can only be used once.',
    fuss: 'This email was sent automatically by Hoku.',
    impressum: 'Legal notice',
    datenschutz: 'Privacy',
  },
}

export function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Uhrzeit „HH:MM" in der Zeitzone der Person; null, wenn die Zone fehlt oder unbekannt ist. */
export function gueltigBis(jetzt: Date, minuten: number, zeitzone: unknown, sprache: Sprache): string | null {
  if (typeof zeitzone !== 'string' || !zeitzone) return null
  try {
    return new Intl.DateTimeFormat(sprache === 'de' ? 'de-DE' : 'en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zeitzone,
    }).format(new Date(jetzt.getTime() + minuten * 60_000))
  } catch {
    return null
  }
}

/**
 * Brand-Kit v2 (docs/logo/hoku/brand-kit-v2/HOKU-Brand-Guide.md): ruhige dunkle Fläche im
 * Blau-Schwarz des App-Icons, Cyan #00CCF5 als einziger Akzent, Schrift neutral weiß. Kopf ist
 * das Hauptlogo (Hoku in Cyan, HOKU / HEALTH HUB weiß, freigestellt) in 240 px, der kleinsten
 * empfohlenen Breite; die Datei liegt in public/mail. Michroma und IBM Plex Mono kommen über
 * Google Fonts — Apple Mail lädt sie, andere Programme nehmen die Ersatzschriften.
 */
const FARBE = {
  grund: '#000101', karte: '#0a1014', rand: 'rgba(255,255,255,0.08)',
  text: '#ffffff', zweit: '#c3ccd2', leise: '#86929a',
  cyan: '#00ccf5', codeGrund: 'rgba(0,204,245,0.08)', codeRand: 'rgba(0,204,245,0.35)',
}
const SCHRIFT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
const MARKE = "Michroma,'Arial Black',Helvetica,Arial,sans-serif"
/** Logo im Kopf: Datei 720 × 235 px (dreifach), angezeigt mit 240 px Breite */
export const LOGO = { pfad: '/mail/hoku-health-hub-logo-720.png', breite: 240, hoehe: 78 }

function seite(sprache: Sprache, appUrl: string, vorschau: string, titel: string, inhalt: string): string {
  const r = RAHMEN[sprache]
  const basis = appUrl.replace(/\/+$/, '')
  return `<!doctype html>
<html lang="${sprache}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escape(titel)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=Michroma&display=swap" rel="stylesheet">
<style>:root{color-scheme:dark;supported-color-schemes:dark}</style>
</head>
<body style="margin:0;padding:0;background:${FARBE.grund};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(vorschau)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FARBE.grund};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${FARBE.karte};border:1px solid ${FARBE.rand};border-radius:24px;">
<tr><td align="center" style="padding:24px 28px 16px;border-bottom:1px solid ${FARBE.rand};">
<img src="${escape(basis + LOGO.pfad)}" width="${LOGO.breite}" height="${LOGO.hoehe}" alt="HOKU · HEALTH HUB" style="display:block;margin:0 auto;width:${LOGO.breite}px;max-width:100%;height:auto;border:0;outline:none;color:${FARBE.text};font-family:${MARKE};font-size:20px;letter-spacing:0.16em;">
</td></tr>
<tr><td style="padding:24px 28px 8px;font-family:${SCHRIFT};color:${FARBE.text};">
<h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:${FARBE.text};">${escape(titel)}</h1>
${inhalt}
</td></tr>
<tr><td style="padding:16px 28px 28px;font-family:${SCHRIFT};font-size:12px;line-height:1.6;color:${FARBE.leise};">
${escape(r.fuss)}<br>
<a href="${escape(basis)}/impressum" style="color:${FARBE.leise};">${escape(r.impressum)}</a> · <a href="${escape(basis)}/datenschutz" style="color:${FARBE.leise};">${escape(r.datenschutz)}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

const absatz = (text: string) =>
  `<p style="margin:12px 0 0;font-size:16px;line-height:1.5;color:${FARBE.zweit};">${escape(text)}</p>`
const leise = (text: string) =>
  `<p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:${FARBE.leise};">${escape(text)}</p>`

export function codeMail(e: CodeEingabe): Mail {
  const t = CODE_TEXTE[e.sprache][e.art]
  const r = RAHMEN[e.sprache]
  const code = e.code
  const gilt = r.gilt(e.minuten, e.bis)
  // Großes Codefeld: Beschriftung, Code (ein Tipp markiert ihn ganz), Hinweis zum Kopieren,
  // darunter abgesetzt die Gültigkeit
  const codeBox = `<div style="margin:24px 0 0;background:${FARBE.codeGrund};border:1px solid ${FARBE.codeRand};border-radius:20px;text-align:center;">
<div style="padding:24px 12px 20px;">
<div style="font-family:${MONO};font-size:12px;font-weight:500;letter-spacing:0.3em;text-transform:uppercase;color:${FARBE.cyan};">${escape(r.code)}</div>
<div style="margin-top:12px;font-family:${MONO};font-size:52px;line-height:1.1;font-weight:500;letter-spacing:12px;padding-left:12px;color:${FARBE.text};-webkit-user-select:all;user-select:all;">${escape(code)}</div>
<div style="margin-top:12px;font-family:${SCHRIFT};font-size:13px;color:${FARBE.leise};">${escape(r.kopieren)}</div>
</div>
<div style="padding:14px 12px;border-top:1px solid ${FARBE.codeRand};font-family:${SCHRIFT};font-size:15px;font-weight:600;color:${FARBE.text};">⏱ ${escape(gilt)}</div>
</div>`
  // Knopf im Stil des Hauptknopfs der App: Cyan, dunkle Schrift; als Tabelle, damit ihn auch Outlook zeigt
  const knopf = e.link ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
<tr><td align="center" style="border-radius:16px;background:${FARBE.cyan};">
<a href="${escape(e.link)}" style="display:block;padding:17px 16px;font-family:${SCHRIFT};font-size:17px;font-weight:600;line-height:1.2;color:#00141c;text-decoration:none;border-radius:16px;">${escape(r.oeffnen)}</a>
</td></tr>
</table>
<p style="margin:10px 0 0;font-size:13px;line-height:1.5;text-align:center;color:${FARBE.leise};">${escape(r.oeffnenInfo)}</p>
<div style="margin:22px 0 0;font-family:${MONO};font-size:11px;letter-spacing:0.3em;text-transform:uppercase;text-align:center;color:${FARBE.leise};">${escape(r.oder)}</div>` : ''
  const html = seite(e.sprache, e.appUrl, `${r.code}: ${code}`, t.titel,
    absatz(e.link && t.mitKnopf ? t.mitKnopf : t.einleitung) + knopf + codeBox + leise(r.einmal) + leise(t.ignorieren))
  const text = [t.titel, '', e.link && t.mitKnopf ? t.mitKnopf : t.einleitung, '', ...(e.link ? [`${r.oeffnen}: ${e.link}`, ''] : []),
    `${r.code}: ${code}`, gilt, r.einmal, '', t.ignorieren, '', '—', r.fuss].join('\n')
  return { betreff: t.betreff(code), html, text }
}

export function hinweisMail(e: HinweisEingabe): Mail {
  const t = HINWEIS_TEXTE[e.sprache][e.art](e.anbieter ?? '')
  const r = RAHMEN[e.sprache]
  const html = seite(e.sprache, e.appUrl, t.text, t.titel, absatz(t.text))
  const text = [t.titel, '', t.text, '', '—', r.fuss].join('\n')
  return { betreff: t.betreff, html, text }
}
