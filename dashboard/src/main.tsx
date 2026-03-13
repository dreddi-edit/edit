import React, { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import {
  applyThemeToDocument,
  getSystemTheme,
  hasExplicitThemePreference,
  resolveThemePreference,
} from './utils/theme';

applyThemeToDocument(resolveThemePreference());

if (!hasExplicitThemePreference() && typeof window !== 'undefined') {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (media) {
    const syncTheme = () => applyThemeToDocument(getSystemTheme());
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncTheme);
    } else if (typeof media.addListener === 'function') {
      media.addListener(syncTheme);
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
