import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { bootstrapStore } from '../core/storage/bootstrapStore';
import { rebuildDailyContext } from '../core/context/contextBuilder';
import { setupServiceWorkerUpdates } from '../core/pwa/swUpdate';
import { initTheme, loadThemePreference } from '../core/theme/theme';
import { IrisMark } from '../core/jarvis/IrisMark';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '../styles/global.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

setupServiceWorkerUpdates();
initTheme();

// Abertura enquanto o store decide a fonte (backend ou localStorage): os arcos da
// Íris se desenham e, se o carregamento demorar, passam a "pensar".
root.render(
  <div className="grid min-h-screen place-items-center" style={{ background: 'var(--hub-bg)' }}>
    <IrisMark size={120} mode="intro" settle="thinking" label="Carregando o Olimpo" />
  </div>,
);

// Decide a fonte de dados antes de montar o app (cache do backend ou localStorage).
// Após o store estar pronto, reconstrói o DailyContext com dados reais de todos os módulos.
bootstrapStore()
  .catch(() => undefined)
  .then(() => {
    loadThemePreference();
    try {
      rebuildDailyContext();
    } catch (e) {
      console.warn('[boot] rebuildDailyContext falhou:', e);
    }
  })
  .finally(() => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
