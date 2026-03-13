import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'node_modules',
    '**/*.backup',
    '**/*.tmp',
    'src/ui-draft/**',
    'src/ui-draft-agency-v2/**',
  ]),
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
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-refresh/only-export-components': 'off',
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
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-empty': 'off',
    },
  },
  {
    files: [
      'src/components/ProjectDashboard.tsx',
      'src/components/OnboardingChecklist.tsx',
    ],
    rules: {
      'no-empty': 'off',
    },
  },
  {
    files: [
      'src/utils/googleApis.ts',
      'src/components/SettingsPanel.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: [
      'src/components/AIApprovalQueue.tsx',
      'src/components/AbTestManager.tsx',
      'src/components/ActivityAuditLog.tsx',
      'src/components/AltTextGenerator.tsx',
      'src/components/ComponentLibrary.tsx',
      'src/components/ContrastAuditor.tsx',
      'src/components/EditorView.tsx',
      'src/components/Header.tsx',
      'src/components/IconManager.tsx',
      'src/components/ImageOptimizer.tsx',
      'src/components/ImportFidelityPanel.tsx',
      'src/components/InteractionTimeline.tsx',
      'src/components/PlatformHelpGuide.tsx',
      'src/components/ProjectDashboard.tsx',
      'src/components/ProjectSharing.tsx',
      'src/components/PseudoElementEditor.tsx',
      'src/components/ResetPasswordScreen.tsx',
      'src/components/SettingsPanel.tsx',
      'src/components/StyleMirrorUI.tsx',
      'src/components/TechnicalAudit.tsx',
      'src/components/VersionHistory.tsx',
      'src/components/VisualNodeTree.tsx',
      'src/hooks/useAutoSave.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
])
