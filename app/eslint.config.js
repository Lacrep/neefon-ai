import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Vendored shadcn/ui primitives: these intentionally co-export variant
    // helpers (buttonVariants, etc.) and use a random skeleton width. Don't
    // apply the fast-refresh / purity rules to generated library code.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'react-hooks/purity': 'off',
    },
  },
  {
    // Context/provider files idiomatically co-locate a Provider component with
    // its hook (useWeather, useSettings) or client (trpc). That trips the
    // fast-refresh rule, which is a dev-only HMR concern, not a correctness one.
    files: ['src/contexts/**/*.{ts,tsx}', 'src/providers/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
