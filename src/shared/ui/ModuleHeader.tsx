import { useEffect, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BackButton } from './BackButton';
import { useDragScroll } from '../hooks/useDragScroll';

export type ModuleTab = {
  label: string;
  to: string;
  /** Match exato (para a rota índice do módulo). */
  end?: boolean;
  /** Badge numérico opcional (ex.: pendências). */
  badge?: number;
};

type ModuleHeaderProps = {
  /** Rótulo eyebrow, ex.: "Módulo · Junho de 2025". */
  eyebrow: string;
  title: string;
  /** Abas do módulo — viram pills numa faixa que rola/arrasta. */
  tabs?: ModuleTab[];
  /**
   * Força a seta de voltar. Normalmente não precisa: quando a rota atual não é
   * nenhuma das abas, o cabeçalho entende que é drill-down e mostra a seta
   * sozinho. Use `back={false}` para suprimir num caso específico.
   */
  back?: boolean;
  /** Slot à direita do título (ex.: seletor de mês) — renderiza junto das abas, à esquerda delas. */
  right?: ReactNode;
};

function useActive() {
  const { pathname } = useLocation();
  return (tab: ModuleTab) => {
    const to = tab.to.replace(/\/$/, '');
    if (tab.end) return pathname === to || pathname === `${to}/`;
    return pathname === to || pathname.startsWith(`${to}/`);
  };
}

function TabPill({ tab, active }: { tab: ModuleTab; active: boolean }) {
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      // className como função: evita que o NavLink injete sua própria classe "active"
      // por cima da nossa (ele faz isso quando className é string) — sem isso, a aba
      // índice (end=true) ficava marcada como ativa em toda sub-rota do módulo.
      className={() => `hub-tab${active ? ' active' : ''}`}
    >
      {tab.label}
      {tab.badge != null && tab.badge > 0 && (
        <span
          className="ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
          style={{ background: 'var(--hub-warning)' }}
          aria-label={`${tab.badge} pendências`}
        />
      )}
    </NavLink>
  );
}

/**
 * Cabeçalho de módulo padrão: eyebrow "Módulo · contexto" + h1 à esquerda;
 * abas em pills, numa faixa que rola/arrasta (a ativa fica levemente maior),
 * à direita. Reutilizado por todos os módulos.
 */
export function ModuleHeader({ eyebrow, title, tabs = [], back, right }: ModuleHeaderProps) {
  const isActive = useActive();
  const { pathname } = useLocation();
  const dragScroll = useDragScroll<HTMLDivElement>();

  // Mantém a aba ativa visível quando a rota troca — sem isso, uma aba lá no
  // fim da faixa (ex.: Investimentos, Materiais) fica fora da vista sozinha.
  //
  // `behavior: 'auto'` (instantâneo), não 'smooth': cada página do módulo
  // renderiza seu próprio `ModuleHeader` (não é um layout persistente), então
  // a cada clique numa aba esta faixa é desmontada e remontada do zero — a
  // rolagem sempre nasce em 0, e animar "suave" a partir daí faz a faixa
  // inteira atravessar a tela visivelmente antes de chegar na aba certa,
  // mesmo quando ela já estava perto. Instantâneo é o comportamento certo
  // aqui: não existe uma posição anterior de verdade pra animar a partir.
  useEffect(() => {
    const active = dragScroll.ref.current?.querySelector('.active');
    active?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
  }, [pathname]);

  // Seta em TODA tela por padrão, inclusive nas abas.
  //
  // A primeira versão só mostrava em drill-down, com o raciocínio de que a régua
  // de abas já navega entre elas. Na prática, no celular, isso deixava a maioria
  // das telas sem nenhum "voltar" visível — o usuário pediu explicitamente que
  // toda tela tenha. Redundar com a régua custa uma linha; não ter saída custa
  // uma navegação travada.
  //
  // O BackButton volta no histórico e cai na Home quando não há de onde voltar,
  // então mesmo entrando direto por link a seta leva a algum lugar sensato.
  const showBack = back ?? true;

  return (
    <div className="mb-8">
      {showBack && <div className="mb-2"><BackButton /></div>}
      <div className="flex flex-wrap items-end justify-between gap-y-4">
        <div>
          <p
            className="mb-1"
            style={{ fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--hub-label)' }}
          >
            {eyebrow}
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--hub-text)', margin: 0 }}>
            {title}
          </h1>
        </div>

        {(right || tabs.length > 0) && (
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            {right && <div>{right}</div>}
            {tabs.length > 0 && (
              <div
                ref={dragScroll.ref}
                className="hub-scroll-strip"
                aria-label={`Navegação de ${title}`}
                style={{ overflowX: 'auto', maxWidth: '100%', cursor: 'grab' }}
                onMouseDown={dragScroll.onMouseDown}
                onMouseLeave={dragScroll.onMouseLeave}
                onMouseUp={dragScroll.onMouseUp}
                onMouseMove={dragScroll.onMouseMove}
                onClickCapture={dragScroll.onClickCapture}
              >
                <nav className="flex items-center gap-1">
                  {tabs.map((tab) => (
                    <TabPill key={tab.to} tab={tab} active={isActive(tab)} />
                  ))}
                </nav>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
