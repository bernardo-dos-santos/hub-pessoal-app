import { type ModuleTab } from '../../../shared/ui';

/**
 * Abas do ModuleHeader dos Estudos — fonte única de todas as páginas do módulo.
 *
 * Formato dos módulos (o mesmo em todos): "Hoje" é o resumo e vem
 * primeiro — não "Resumo", que aqui se confundiria com a aba Resumos (os textos
 * de estudo). Depois as ferramentas na ordem do fluxo da faculdade (resumir o
 * material → virar questão → virar flashcard → revisar o que errou → simular) e
 * Configurar por último.
 *
 * Uma lista plana, como manda o guia: a faixa rola e arrasta, não existe
 * contagem de abas que justifique esconder tela atrás de um menu.
 *
 * Função e não constante porque Erros carrega badge vivo, mesmo motivo de
 * `getFinanceTabs`. As outras contagens não são pendência: questão ou resumo em
 * zero é vazio, não cobrança.
 */
export function getStudyTabs(pendingErrors: number): ModuleTab[] {
  return [
    { label: 'Hoje', to: '/estudos', end: true },
    { label: 'Resumos', to: '/estudos/resumos' },
    { label: 'Questões', to: '/estudos/questoes' },
    { label: 'Flashcards', to: '/estudos/flashcards' },
    { label: 'Erros', to: '/estudos/erros', badge: pendingErrors },
    { label: 'Simulados', to: '/estudos/simulados' },
    { label: 'Configurar', to: '/estudos/configurar' },
  ];
}
