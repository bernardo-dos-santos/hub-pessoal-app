import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { appConfig } from '../../core/config/app-config';
import { navigationItems } from '../../core/navigation/navigation-items';
import { useDragScroll } from '../../shared/hooks/useDragScroll';
import { checkAndAutoImport } from '../../modules/college/services/sigaaAutoImportService';
import { type SigaaImportResult } from '../../modules/college/services/sigaaImportService';
import { checkAndAutoImportInvoice, type InvoiceImportResult } from '../../modules/finance/services/nubankInvoiceImportService';
import { checkAndAutoImportPluggy } from '../../modules/finance/services/pluggyImportService';
import { transactionService } from '../../modules/finance/services/transactionService';
import { concursoService, type EditalCache } from '../../core/concurso/concursoService';
import { JarvisChat } from '../../core/jarvis/JarvisChat';
import { JarvisVoiceProvider } from '../../core/jarvis/JarvisVoiceContext';
import { syncGitActivity } from '../../modules/projects/services/gitActivitySyncService';

function buildSigaaToastMessage(result: SigaaImportResult): string {
  const parts: string[] = [];
  if (result.subjects > 0) parts.push(`${result.subjects} disciplina(s)`);
  if (result.assessments > 0) parts.push(`${result.assessments} avaliação(ões)`);
  if (result.tasks > 0) parts.push(`${result.tasks} tarefa(s)`);
  if (result.alerts > 0) parts.push(`${result.alerts} aviso(s)`);
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (parts.length === 0) return `SIGAA verificado às ${hora} — nenhuma novidade`;
  return `🔄 SIGAA sincronizado às ${hora}: ${parts.join(', ')}`;
}

export function AppLayout() {
  const [toast, setToast] = useState<string | null>(null);
  const { pathname } = useLocation();
  const dragScroll = useDragScroll<HTMLDivElement>();

  // Mantém a aba ativa visível quando a navegação troca de módulo — sem isso,
  // ir direto pra um módulo lá no fim da faixa deixaria ele fora da vista.
  useEffect(() => {
    const active = dragScroll.ref.current?.querySelector('.active');
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [pathname]);

  useEffect(() => {
    // Cacheia edital-alerts.json para o provider de alertas
    fetch('/edital-alerts.json')
      .then((r) => r.json())
      .then((data: EditalCache) => concursoService.cacheEditalAlerts(data))
      .catch(() => {});

    // Auto-import SIGAA (Faculdade)
    checkAndAutoImport().then((result) => {
      if (result === null) return;
      setToast(buildSigaaToastMessage(result));
      setTimeout(() => setToast(null), 6000);
    });

    // Auto-import Open Finance (Pluggy) — contas e cartões conectados
    checkAndAutoImportPluggy(transactionService.listTransactions())
      .then((result) => {
        if (!result || result.imported === 0) return;
        const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const revisar = result.needsReview > 0 ? ` · ${result.needsReview} pra revisar` : '';
        setToast(`🏦 Open Finance: ${result.imported} transação(ões) importada(s) às ${hora}${revisar}`);
        setTimeout(() => setToast(null), 6000);
      })
      .catch((error) => {
        console.error('[pluggy] auto-import falhou.', error);
      });

    // Auto-import fatura PDF Nubank
    checkAndAutoImportInvoice().then((result: InvoiceImportResult) => {
      if (!result || result.imported === 0) return;
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setToast(`🧾 Fatura Nubank: ${result.imported} compra(s) importada(s) às ${hora}`);
      setTimeout(() => setToast(null), 6000);
    });

    // Camada 1 do parser de commits — sem toast: é metadado (lastActivityAt),
    // não dado novo pra avisar. Silenciosa também na falha (ex.: sem backend).
    syncGitActivity().catch((error) => {
      console.error('[git activity] Falha ao sincronizar.', error);
    });
  }, []);

  return (
    // O provider de voz envolve TUDO de propósito: é o que faz a conversa
    // sobreviver à troca de rota. O <Outlet/> troca de página por baixo dele
    // sem tocar na sessão.
    <JarvisVoiceProvider>
    <div
      id="app-layout-root"
      className="min-h-screen"
      style={{ background: 'var(--hub-bg)', color: 'var(--hub-text)' }}
    >
      <header
        className="sticky top-0 z-20 backdrop-blur"
        style={{
          borderBottom: '1px solid var(--hub-border)',
          background: 'var(--hub-header)',
        }}
      >
        <div
          className="mx-auto grid max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-5"
          style={{ height: '58px', gridTemplateColumns: '1fr minmax(0,auto) 1fr' }}
        >
          {/* Coluna esquerda — logo (só sm+) + Início. Largura forçada igual à da coluna direita
              (mesma fração 1fr), pra faixa central ficar centralizada de verdade no header,
              não só no espaço que sobrar depois da logo. */}
          <div className="flex items-center gap-2 sm:gap-4">
            <NavLink to="/" end className="hidden shrink-0 items-baseline gap-2 sm:flex" aria-label="Ir para o início">
              <span className="text-[15px] font-semibold" style={{ color: 'var(--hub-primary)' }}>
                {appConfig.name}
              </span>
            </NavLink>

            {/* Início — fixo, não faz parte da faixa que rola */}
            <NavLink
              to="/"
              end
              className={({ isActive }) => `hub-nav-link${isActive ? ' active' : ''}`}
              style={{ flexShrink: 0 }}
            >
              Início
            </NavLink>
          </div>

          {/* Módulos — faixa horizontal que rola/arrasta, aba ativa levemente maior */}
          <div
            ref={dragScroll.ref}
            className="hub-scroll-strip flex items-center gap-0.5"
            style={{ overflowX: 'auto', cursor: 'grab', minWidth: 0, justifyContent: 'safe center' }}
            onMouseDown={dragScroll.onMouseDown}
            onMouseLeave={dragScroll.onMouseLeave}
            onMouseUp={dragScroll.onMouseUp}
            onMouseMove={dragScroll.onMouseMove}
            onClickCapture={dragScroll.onClickCapture}
          >
            <nav aria-label="Navegação principal" className="flex items-center gap-0.5">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `hub-nav-link${isActive ? ' active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Configurações — coluna direita, mesma largura da esquerda (ver comentário acima) */}
          <div className="flex items-center justify-end">
            <NavLink
              to="/configuracoes"
              aria-label="Configurações"
              className="flex shrink-0 items-center justify-center transition-opacity hover:opacity-70"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--hub-card)',
                boxShadow: 'var(--hub-shadow-chip)',
                fontSize: '15px',
              }}
            >
              ⚙️
            </NavLink>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-12 pt-8 md:px-11">
        <Outlet />
      </main>

      <JarvisChat />

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-4 py-3 text-sm"
          style={{
            background: 'var(--hub-card)',
            border: '1px solid var(--hub-border-strong)',
            borderRadius: '14px',
            boxShadow: 'var(--hub-shadow-menu)',
            color: 'var(--hub-text)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
    </JarvisVoiceProvider>
  );
}
