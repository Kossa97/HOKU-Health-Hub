import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

/** Der Projektname in Sentry (Settings → Projects). */
const SENTRY_PROJECT = 'javascript-react'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const publicHost = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
  // Source-Maps fuer Sentry: nur wenn der Build hochladen darf (Vercel mit
  // SENTRY_AUTH_TOKEN). Sie werden erzeugt, hochgeladen und danach geloescht —
  // ausgeliefert wird keine, der Quelltext bleibt also nicht oeffentlich.
  const sentryUpload = Boolean(env.SENTRY_AUTH_TOKEN)
  return {
  build: {
    sourcemap: sentryUpload ? 'hidden' : false,
    // Drei Seiten aus einem Bau: die App, die Landing Page (meethoku.com) und die
    // Handy-Vorschauen, die die Landing Page in Rahmen zeigt (src/landing/).
    rollupOptions: {
      input: {
        main: 'index.html',
        landing: 'landing.html',
        'landing-mockup': 'landing-mockup.html',
      },
    },
  },
  define: {
    'import.meta.env.VITE_PUBLIC_SITE_URL': JSON.stringify(env.VITE_PUBLIC_SITE_URL || (publicHost ? `https://${publicHost}` : '')),
    // Fuer Fehlerberichte: production/preview/development und die Commit-Kennung.
    'import.meta.env.VITE_DEPLOY_ENV': JSON.stringify(env.VERCEL_ENV || ''),
    'import.meta.env.VITE_RELEASE': JSON.stringify(env.VERCEL_GIT_COMMIT_SHA || ''),
  },
  server: {
    proxy: {
      '/ncbi': {
        target: 'https://eutils.ncbi.nlm.nih.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ncbi/, '/entrez/eutils'),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        rollupFormat: 'es',
        // Der Service Worker entsteht nach dem Sentry-Upload; seine Map
        // wuerde weder hochgeladen noch geloescht.
        sourcemap: false,
        // Barcode-Leser (ZXing, ~1,1 MB) nicht vorab laden: er kommt erst beim
        // ersten Scan, sonst laedt jedes Geraet ihn bei jeder neuen Version mit.
        // Dasselbe fuer pdf.js (~490 KB + Worker): nur die PDF-Vorschau braucht es.
        // Die Landing Page gehört nicht in den Vorrat der App.
        globIgnores: ['**/node_modules/**/*', '**/zxing_reader-*.wasm', '**/assets/pdf-*.js', '**/assets/pdf.worker*', 'landing.html', 'landing-mockup.html', '**/assets/landing*'],
      },
      manifest: {
        name: 'HOKU: Health Hub',
        short_name: 'HOKU',
        description: 'Persönliche Peptid-Management-App für Inventar, Zyklen und Protokoll.',
        theme_color: '#00ccf5',
        background_color: '#000101',
        display: 'standalone',
        icons: [
          // Bestätigter organischer Cyan-Hoku; neue URLs lösen ältere PWA-Icon-Caches ab.
          { src: '/icons/hoku-organisch-v4-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/hoku-organisch-v4-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/hoku-organisch-v4-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
    // Nach VitePWA (das den Eintrag setzt): die Landing Page (landing*.html) bekommt keinen Service Worker: sie ist
    // keine App-Seite und soll den Vorrat der App nicht bei jedem Besuch laden.
    {
      name: 'hoku-landing-ohne-sw',
      enforce: 'post' as const,
      transformIndexHtml: {
        order: 'post' as const,
        handler: (html: string, ctx: { filename: string }) => (/landing[^/]*\.html$/.test(ctx.filename) ? html.replace(/<script[^>]*registerSW[^>]*><\/script>\s*/g, '') : html),
      },
    },
    // Muss das letzte Plugin sein.
    sentryUpload && sentryVitePlugin({
      authToken: env.SENTRY_AUTH_TOKEN,
      // Die Organisation steckt im Organisations-Token.
      org: env.SENTRY_ORG || undefined,
      project: env.SENTRY_PROJECT || SENTRY_PROJECT,
      // Dieselbe Kennung wie `release` in src/lib/monitoring.ts.
      release: { name: env.VERCEL_GIT_COMMIT_SHA || undefined },
      sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
      telemetry: false,
    }),
  ],
  }
})
