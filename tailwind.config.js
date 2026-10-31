/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // `hover:` nur auf Geraeten, die wirklich hovern. Auf dem Handy blieb der
  // Hover-Zustand nach dem Antippen sonst haengen.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        // Werte als CSS-Variablen (--tw-slate-*, --tw-sky-* in index.css), damit
        // jeder Look sie umstellen kann — HOKU tauscht Cyan gegen sein Blau.
        // Neutrales Graphit auf reinem Schwarz (Liquid Glass). Textstufen mit
        // Kontrast auf Schwarz: 300 ≈ 9:1, 400 ≈ 7:1, 500 ≈ 5:1, 600 ≈ 2,8:1
        // (nur noch für Deaktiviertes). Flächenstufen 700–950 ohne Blaustich.
        slate: {
          50: 'rgb(var(--tw-slate-50) / <alpha-value>)',
          100: 'rgb(var(--tw-slate-100) / <alpha-value>)',
          200: 'rgb(var(--tw-slate-200) / <alpha-value>)',
          300: 'rgb(var(--tw-slate-300) / <alpha-value>)',
          400: 'rgb(var(--tw-slate-400) / <alpha-value>)',
          500: 'rgb(var(--tw-slate-500) / <alpha-value>)',
          600: 'rgb(var(--tw-slate-600) / <alpha-value>)',
          700: 'rgb(var(--tw-slate-700) / <alpha-value>)',
          800: 'rgb(var(--tw-slate-800) / <alpha-value>)',
          900: 'rgb(var(--tw-slate-900) / <alpha-value>)',
          950: 'rgb(var(--tw-slate-950) / <alpha-value>)',
        },
        // Neon cyan — replaces sky
        sky: {
          50: 'rgb(var(--tw-sky-50) / <alpha-value>)',
          100: 'rgb(var(--tw-sky-100) / <alpha-value>)',
          200: 'rgb(var(--tw-sky-200) / <alpha-value>)',
          300: 'rgb(var(--tw-sky-300) / <alpha-value>)',
          400: 'rgb(var(--tw-sky-400) / <alpha-value>)',
          500: 'rgb(var(--tw-sky-500) / <alpha-value>)',
          600: 'rgb(var(--tw-sky-600) / <alpha-value>)',
          700: 'rgb(var(--tw-sky-700) / <alpha-value>)',
          800: 'rgb(var(--tw-sky-800) / <alpha-value>)',
          900: 'rgb(var(--tw-sky-900) / <alpha-value>)',
          950: 'rgb(var(--tw-sky-950) / <alpha-value>)',
        },
      },
      // Schriften als Variablen (index.css): HOKU setzt IBM Plex Sans/Mono
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      boxShadow: {
        'card':       '0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glow-sm':    '0 0 15px rgba(0,204,245,0.18)',
        'glow-md':    '0 0 30px rgba(0,204,245,0.22), 0 0 80px rgba(0,204,245,0.06)',
        'glow-violet':'0 0 25px rgba(160,120,255,0.18), 0 0 70px rgba(160,120,255,0.06)',
        'glow-green': '0 0 20px rgba(0,220,150,0.15)',
        'btn-primary': '0 0 20px rgba(0,204,245,0.25), 0 4px 20px rgba(0,0,0,0.55)',
        'inner-top':  'inset 0 1px 0 rgba(255,255,255,0.06)',
        'inner-card': 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.3)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0,204,245,0.15)' },
          '50%':       { boxShadow: '0 0 22px rgba(0,204,245,0.35)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      },
      backdropBlur: {
        xs: '4px',
      },
    },
  },
  plugins: [],
}
