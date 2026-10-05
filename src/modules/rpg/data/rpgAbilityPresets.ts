import { type RpgAbilityPreset } from '../types/rpg';

export const rpgAbilityPresets: RpgAbilityPreset[] = [
  {
    id: 'ataque-corpo-a-corpo',
    category: 'physical',
    title: 'Ataque corpo a corpo',
    summary: 'Manobra física ofensiva simples.',
    description: 'Descreva o golpe e adicione a fórmula de dano depois de criar.',
  },
  {
    id: 'manobra-combate',
    category: 'combat',
    title: 'Manobra de combate',
    summary: 'Ação tática durante a luta.',
    description: 'Descreva a manobra (desarmar, proteger, empurrar etc.).',
  },
  {
    id: 'pericia-passiva',
    category: 'passive',
    title: 'Perícia passiva',
    summary: 'Bônus ou efeito sempre ativo.',
    description: 'Descreva a condição que ativa o bônus e o que ele concede.',
  },
  {
    id: 'efeito-mental',
    category: 'mental',
    title: 'Efeito mental',
    summary: 'Sugestão, leitura ou debuff mental.',
    description: 'Descreva o alcance, a resistência esperada e o efeito.',
  },
  {
    id: 'comando-esquadrao',
    category: 'command',
    title: 'Comando de esquadrão',
    summary: 'Ordem ou bônus para aliados próximos.',
    description: 'Descreva quem é afetado e por quanto tempo.',
  },
  {
    id: 'visao-paranormal',
    category: 'uriel',
    title: 'Visão paranormal',
    summary: 'Percepção além do normal, ligada a Uriel.',
    description: 'Descreva o que é revelado e o custo espiritual.',
  },
  {
    id: 'habilidade-personalizada',
    category: 'other',
    title: 'Habilidade personalizada',
    description: 'Modelo em branco — preencha do zero.',
  },
];
