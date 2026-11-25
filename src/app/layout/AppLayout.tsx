import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { appConfig } from '../../core/config/app-config';
import { getNavigationItems } from '../../core/navigation/navigation-items';
import { canSeeAdmin, getSession, isModuleEnabled, useSession } from '../../core/session/session';
import { modules } from '../../core/module-registry/modules';
import { hub, tint } from '../../shared/ui';
import { ViewAsBanner } from '../components/ViewAsBanner';
import { AppUpdateBanner } from '../components/AppUpdateBanner';
import { useDragScroll } from '../../shared/hooks/useDragScroll';
import { checkAndAutoImport } from '../../modules/college/services/sigaaAutoImportService';
import { type SigaaImportResult } from '../../modules/college/services/sigaaImportService';
import { checkAndAutoImportInvoice, type InvoiceImportResult } from '../../modules/finance/services/nubankInvoiceImportService';
import { collegeConnectionService } from '../../modules/college/services/collegeConnectionService';
import { JarvisChat } from '../../core/jarvis/JarvisChat';
import { JarvisVoiceProvider } from '../../core/jarvis/JarvisVoiceContext';
import { syncGitActivity } from '../../modules/projects/services/gitActivitySyncService';
import { refreshSystemHealth } from '../../core/health/systemHealth';
import { initNativePush } from '../../core/push/nativePush';
import { IrisMark } from '../../core/jarvis/IrisMark';

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
  const navigate = useNavigate();
  const session = useSession();
  const navigationItems = getNavigationItems(session);
  // The admin keeps using a module in maintenance (he's fixing it) — but should never forget it's off for everyone else.
  const maintenanceHere = canSeeAdmin(session) && session.maintenance.some((m) =>
    pathname.startsWith(modules.find((mod) => mod.id === m.moduleId)?.basePath ?? '\0'));
  const dragScroll = useDragScroll<HTMLDivElement>();

  // Mantém a aba ativa visível quando a navegação troca de módulo — sem isso,
  // ir direto pra um módulo lá no fim da faixa deixaria ele fora da vista.
  useEffect(() => {
    const active = dragScroll.ref.current?.querySelector('.active');
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [pathname]);

  useEffect(() => {
    // APK: channel, listeners and token refresh; tapping a notification opens its screen.
    initNativePush((url) => navigate(url)).catch((error) => {
      console.error('[push] inicialização do push nativo falhou.', error);
    });
  }, [navigate]);

  useEffect(() => {
    // Auto-import SIGAA (Faculdade) — each IFSC student's own pending file.
    if (isModuleEnabled('college') && collegeConnectionService.usesSigaa()) checkAndAutoImport().then((result) => {
      if (result === null) return;
      setToast(buildSigaaToastMessage(result));
      setTimeout(() => setToast(null), 6000);
    });

    // Everything below reads the owner's syncs, repos and server (OWNER_ONLY_PREFIXES).
    // Per-user versions come later in F3; until then other users would only collect 403s.
    if (!getSession().isOwner) return;

    // Auto-import fatura PDF Nubank
    checkAndAutoImportInvoice().then((result: InvoiceImportResult) => {
      if (!result || !result.imported) return;
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setToast(`🧾 Fatura Nubank: ${result.imported} compra(s) importada(s) às ${hora}`);
      setTimeout(() => setToast(null), 6000);
    });

    // Camada 1 do parser de commits — sem toast: é metadado (lastActivityAt),
    // não dado novo pra avisar. Silenciosa também na falha (ex.: sem backend).
    syncGitActivity().catch((error) => {
      console.error('[git activity] Falha ao sincronizar.', error);
    });

    // Saúde do sistema alimenta os alertas da Home. O app fica aberto por horas
    // (PWA, APK), então revisita de tempos em tempos em vez de só no boot.
    void refreshSystemHealth();
    const healthTimer = setInterval(() => void refreshSystemHealth(), 15 * 60_000);
    return () => clearInterval(healthTimer);
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
      <ViewAsBanner />
      <AppUpdateBanner />
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
            <NavLink to="/" end className="hidden shrink-0 items-center gap-2 sm:flex" aria-label="Ir para o início">
              <IrisMark size={26} mode="still" />
              <span className="text-[15px] font-semibold" style={{ color: 'var(--hub-text)' }}>
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
            className="hub-scroll-strip flex items-center"
            style={{ overflowX: 'auto', cursor: 'grab', minWidth: 0, justifyContent: 'safe center' }}
            onMouseDown={dragScroll.onMouseDown}
            onMouseLeave={dragScroll.onMouseLeave}
            onMouseUp={dragScroll.onMouseUp}
            onMouseMove={dragScroll.onMouseMove}
            onClickCapture={dragScroll.onClickCapture}
          >
            <nav aria-label="Navegação principal" className="flex items-center">
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
              style={{ width: '40px', height: '40px', color: 'var(--hub-muted)' }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </NavLink>
          </div>
        </div>
      </header>

      {maintenanceHere && (
        <div className="px-4 py-2 text-center text-xs" style={{ background: tint(hub.warning, 16), color: 'var(--hub-text)' }}>
          Este módulo está em manutenção para os outros usuários — só você o vê funcionando. Desligue em Configurações → Usuários.
        </div>
      )}

      <main className="mx-auto max-w-6xl px-5 pb-12 pt-8 md:px-11">
        <Outlet />
      </main>

      {session.isOwner && <JarvisChat />}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-4 py-3 text-sm"
          style={{
            background: 'var(--hub-card)',
            border: '1px solid var(--hub-border-strong)',
            borderRadius: 'var(--hub-radius-card)',
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
