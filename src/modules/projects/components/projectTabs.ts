import { type ModuleTab } from '../../../shared/ui';
import { projectExpansionService } from '../services/projectExpansionService';
import { projectIssueService } from '../services/projectIssueService';
import { isCodeProject, type Project } from '../types/project';

/**
 * Abas de um projeto.
 *
 * Função e não constante pelo mesmo motivo documentado em `getFinanceTabs`:
 * as abas carregam contagem viva (o ponto de pendência do `badge`). Lê as
 * contagens aqui dentro em vez de recebê-las por parâmetro porque as seis
 * páginas do projeto precisariam repetir as mesmas duas chamadas.
 *
 * Depende do projeto porque a natureza decide o que faz sentido mostrar:
 * "Atividade" lê commits do repositório vinculado e não teria conteúdo
 * nenhum numa reforma de quarto.
 *
 * Lista plana, sem divisão em "Mais ▾": a tira rola e arrasta, então não
 * existe contagem de abas que justifique esconder parte delas atrás de um
 * menu (rejeitado em 2026-07-28 — `moreTabs` nem existe mais no tipo).
 */
export function getProjectTabs(project: Project): ModuleTab[] {
  const base = `/projetos/${project.id}`;
  const tabs: ModuleTab[] = [
    { label: 'Visão geral', to: base, end: true },
    { label: 'Melhorias', to: `${base}/melhorias`, badge: projectIssueService.countOpen(project.id) },
    { label: 'Decisões', to: `${base}/decisoes` },
    { label: 'Arquivos', to: `${base}/arquivos` },
    { label: 'Painel', to: `${base}/painel` },
    { label: 'Ideias', to: `${base}/expansoes`, badge: projectExpansionService.countBacklog(project.id) },
  ];
  if (isCodeProject(project)) tabs.push({ label: 'Atividade', to: `${base}/atividade` });
  return tabs;
}

/** Eyebrow único das telas de projeto — o detalhe divergia com "Módulo · Projetos". */
export function projectEyebrow(project: Project): string {
  return `Projeto · ${project.name}`;
}
