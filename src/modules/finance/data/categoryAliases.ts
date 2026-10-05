import { specialCategories } from './specialCategories';

export type CategoryAliasRule = {
  category: string;
  keywords: string[];
};

export const categoryAliasRules: CategoryAliasRule[] = [
  {
    category: specialCategories.foodOut,
    keywords: ['ifood', 'restaurante', 'lanche', 'lanchonete', 'café', 'cafe', 'padaria', 'pizzaria', 'giraffas', 'mcdonalds', 'burger'],
  },
  {
    category: specialCategories.market,
    keywords: ['supermercado', 'supermercados', 'mercado', 'atacadão', 'atacadao', 'angeloni', 'giassi'],
  },
  {
    category: specialCategories.transport,
    keywords: ['uber', '99', 'posto', 'combustível', 'combustivel', 'gasolina', 'estacionamento'],
  },
  {
    category: specialCategories.health,
    keywords: ['farmácia', 'farmacia', 'drogaria', 'consulta', 'exame'],
  },
  {
    category: specialCategories.education,
    keywords: ['educação', 'educacao', 'curso', 'faculdade', 'livro'],
  },
  {
    category: specialCategories.leisure,
    keywords: ['netflix', 'spotify', 'cinema', 'cinemark', 'game', 'steam'],
  },
  {
    category: specialCategories.subscriptions,
    keywords: ['assinatura', 'subscription', 'mensalidade'],
  },
  {
    category: specialCategories.pet,
    keywords: ['pet', 'agro', 'veterinário', 'veterinario'],
  },
  {
    category: specialCategories.gym,
    keywords: ['academia', 'fitness', 'phd'],
  },
  {
    category: specialCategories.income,
    keywords: ['salário', 'salario', 'freelance', 'pro labore', 'pro-labore'],
  },
];
