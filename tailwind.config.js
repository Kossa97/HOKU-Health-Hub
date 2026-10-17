/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutrales Graphit auf reinem Schwarz (Liquid Glass). Textstufen mit
        // Kontrast auf Schwarz: 300 ≈ 9:1, 400 ≈ 7:1, 500 ≈ 5:1, 600 ≈ 2,8:1
        // (nur noch für Deaktiviertes). Flächenstufen 700–950 ohne Blaustich.
        slate: {
          50:  '#f5f5f7',
          100: '#ebebf0',
          200: '#d1d1d6',
          300: '#aeaeb2',
          400: '#98989d',
          500: '#7c7c82',
          600: '#545458',
          700: '#2c2c2e',
          800: '#1c1c1e',
          900: '#121214',
          950: '#050506',
        },
        // Neon cyan — replaces sky
        sky: {
          50:  '#eafaff',
          100: '#c0f3ff',
          200: '#80e8ff',
          300: '#44daff',
          400: '#00ccf5',
          500: '#00aad4',
          600: '#0088aa',
          700: '#006680',
          800: '#004455',
          900: '#00222b',
          950: '#00111a',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Inter',
          '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif',
        ],
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
