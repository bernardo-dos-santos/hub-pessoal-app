import { type ModuleTab } from '../../../shared/ui';

/**
 * Abas do ModuleHeader da Faculdade — fonte única usada por todas as páginas
 * do módulo. Mudar uma rota ou rótulo aqui reflete em todo o módulo de uma vez.
 * A faixa rola/arrasta, então cabem todas numa lista só.
 */
export const COLLEGE_TABS: ModuleTab[] = [
  { label: 'Painel', to: '/faculdade', end: true },
  { label: 'Disciplinas', to: '/faculdade/disciplinas' },
  { label: 'Tarefas', to: '/faculdade/tarefas' },
  { label: 'Avaliações', to: '/faculdade/avaliacoes' },
  { label: 'Notas', to: '/faculdade/notas' },
  { label: 'Materiais', to: '/faculdade/materiais' },
  { label: 'Estudo', to: '/faculdade/estudo' },
  { label: 'Captura rápida', to: '/faculdade/captura' },
  { label: 'Importar SIGAA', to: '/faculdade/sigaa' },
  { label: 'Configurações', to: '/faculdade/configuracoes' },
];
