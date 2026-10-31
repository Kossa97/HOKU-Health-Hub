import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .claude/worktrees enthaelt vollstaendige Repo-Kopien inkl. eigener tsconfig.json.
  // Ohne diese Ignores findet typescript-eslint mehrere tsconfigRootDir-Kandidaten
  // und bricht repoweit ab.
  // Gebaute Android-/iOS-Artefakte (kopiertes dist, Gradle-Ausgaben) sind kein Quelltext.
  globalIgnores(['dist', 'coverage', '**/.claude/**', '**/.worktrees/**', '**/.superpowers/**',
    'android/**/build/**', 'android/app/src/main/assets/**', 'ios/App/App/public/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Mixed context/helper exports are intentional; they only affect hot reload.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Legacy effects deliberately mirror incoming data into UI state. Keep the
    // React Compiler advisory scoped to these existing files, not the workspace.
    files: [
      'src/components/BlutspiegelCarousel.tsx',
      'src/components/ColorField.tsx',
      'src/components/Layout.tsx',
      'src/components/LiveBlutspiegelChart.tsx',
      'src/components/Onboarding.tsx',
      'src/components/ProtocolPdfModal.tsx',
      'src/components/WorkflowBanner.tsx',
      'src/components/injection3d/InjectionLogSheet.tsx',
      'src/context/OnboardingContext.tsx',
      'src/features/fortschritt/components/TodayLogSheet.tsx',
      'src/features/fortschritt/components/verlauf/MetricChart.tsx',
      'src/features/fortschritt/components/verlauf/VerlaufSection.tsx',
      'src/features/fortschritt/hooks/useFortschrittData.ts',
      'src/features/my-stack/MyStackPage.tsx',
      'src/lib/useNew.ts',
      'src/lib/usePushNotifications.ts',
      'src/pages/Bewertungen.tsx',
      'src/pages/BlutspiegelSimulation.tsx',
      'src/pages/Dashboard.tsx',
      'src/pages/Health.tsx',
      'src/pages/InjektionsTracker.tsx',
      'src/pages/Tagebuch.tsx',
      'src/pages/lab/AdminPanel.tsx',
    ],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
  {
    // These legacy visual components read layout/animation refs while rendering.
    files: [
      'src/components/LiveBlutspiegelChart.tsx',
      'src/components/ColorField.tsx',
      'src/components/ProtocolPdfModal.tsx',
      'src/components/SloshContext.tsx',
      'src/features/fortschritt/components/overview/TopChangesSection.tsx',
      'src/features/fortschritt/components/verlauf/MetricChart.tsx',
    ],
    rules: { 'react-hooks/refs': 'off' },
  },
  {
    files: ['src/components/BlutspiegelCarousel.tsx'],
    rules: { 'react-hooks/purity': 'off' },
  },
  {
    files: ['src/features/my-stack/MyStackPage.tsx'],
    rules: { 'react-hooks/immutability': 'off' },
  },
  {
    // Supabase chain mocks intentionally use partial dynamic rows. Production
    // code remains under the strict TypeScript rules above.
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
])
