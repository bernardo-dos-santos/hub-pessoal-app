import { type ModuleTab } from '../../../shared/ui';

/** Abas do ModuleHeader do RPG — Personagem (ficha) e Campanhas, cada uma com sua
 * própria navegação interna (a ficha usa abas client-side; campanhas, rotas). */
export function getRpgTabs(): ModuleTab[] {
  return [
    { label: 'Personagem', to: '/rpg', end: true },
    { label: 'Campanhas', to: '/rpg/campanhas' },
  ];
}
