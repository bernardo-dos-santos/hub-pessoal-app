import { type ModuleTab } from '../../../shared/ui';

/**
 * Abas do ModuleHeader dos Estudos — fonte única de todas as páginas do módulo.
 *
 * Uma lista plana, como manda o guia. A versão anterior colapsou tudo em três
 * abas (Hoje/Progresso/Biblioteca) e empurrou as outras 13 telas para dentro de
 * uma página "Biblioteca", que na prática era o menu "Mais ▾" já rejeitado —
 * só que como página em vez de dropdown. Resultado: 17 telas atrás de 3 abas,
 * contra ~1 aba por tela em Financeiro, Faculdade e Projetos. A faixa rola e
 * arrasta; não existe contagem de abas que justifique esconder função atrás de
 * um menu.
 *
 * A ordem é o fluxo de trabalho da faculdade (uso principal do módulo), não
 * frequência nem alfabética: decidir o que estudar → resumir o material do
 * SIGAA → virar questão → virar flashcard → revisar o que errou → simular.
 *
 * Função e não constante porque Erros carrega badge vivo, mesmo motivo de
 * `getFinanceTabs`. As outras contagens não são pendência: questão ou resumo em
 * zero é vazio, não cobrança.
 */
export function getStudyTabs(pendingErrors: number): ModuleTab[] {
  return [
    { label: 'Estudar', to: '/estudos', end: true },
    { label: 'Resumos', to: '/estudos/resumos' },
    { label: 'Questões', to: '/estudos/questoes' },
    { label: 'Flashcards', to: '/estudos/flashcards' },
    { label: 'Erros', to: '/estudos/erros', badge: pendingErrors },
    { label: 'Simulados', to: '/estudos/simulados' },
  ];
}
