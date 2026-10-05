import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { bootstrapStore } from '../core/storage/bootstrapStore';
import { rebuildDailyContext } from '../core/context/contextBuilder';
import { setupServiceWorkerUpdates } from '../core/pwa/swUpdate';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '../styles/global.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

setupServiceWorkerUpdates();

// Loading mínimo enquanto o store decide a fonte (backend ou localStorage).
root.render(
  <div className="grid min-h-screen place-items-center" style={{ background: '#F7F1E6' }}>
    <p className="text-sm" style={{ color: 'rgba(58,44,34,0.42)' }}>Carregando…</p>
  </div>,
);

// Decide a fonte de dados antes de montar o app (cache do backend ou localStorage).
// Após o store estar pronto, reconstrói o DailyContext com dados reais de todos os módulos.
bootstrapStore()
  .catch(() => undefined)
  .then(() => {
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
