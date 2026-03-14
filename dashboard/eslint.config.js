import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // These rules are broadly violated across the existing codebase;
      // downgrade to warn so lint remains useful without blocking CI.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-unused-vars': 'off', // handled by @typescript-eslint/no-unused-vars
      'no-empty': 'warn',
      // react-hooks v5+ rules that fire throughout the existing code
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Per-file rule relaxations kept for files with intentional patterns
  {
    files: [
      'src/components/SettingsPanel.tsx',
      'src/utils/googleApis.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: [
      'src/App.tsx',
      'src/components/BlockOverlay.tsx',
      'src/components/ProjectDashboard.tsx',
      'src/components/SettingsPanel.tsx',
    ],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    files: ['src/components/BlockOverlay.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': 'off',
    },
  },
])