export const moduleStatuses = {
  active: {
    label: 'Ativo',
    description: 'Disponível nesta fase',
  },
  planned: {
    label: 'Planejado',
    description: 'Previsto para uma fase futura',
  },
} as const;

export type ModuleStatus = keyof typeof moduleStatuses;
