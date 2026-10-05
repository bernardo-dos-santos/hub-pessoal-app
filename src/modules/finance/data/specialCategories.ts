export const specialCategories = {
  incomeReview: 'Entrada a revisar',
  expenseReview: 'Despesa a revisar',
  internalTransfer: 'Transferência interna',
  cardPayment: 'Pagamento de fatura',
  cardPaymentReceived: 'Pagamento recebido da fatura',
  foodOut: 'Alimentação fora',
  market: 'Mercado',
  transport: 'Transporte',
  housing: 'Moradia',
  health: 'Saúde',
  education: 'Educação',
  leisure: 'Lazer',
  subscriptions: 'Assinaturas',
  income: 'Renda',
  other: 'Outros',
  pet: 'Pet',
  gym: 'Academia',
  investmentContribution: 'Aporte em investimento',
  investmentWithdrawal: 'Resgate de investimento',
} as const;

/**
 * Corretoras e plataformas de investimento reconhecidas na descrição de um PIX.
 * Serve pra *sugerir* aporte, sempre com revisão — nunca pra classificar sozinho:
 * "Rico" e "Inter" são palavras comuns e apareceriam em pagamento a pessoa.
 */
export const brokerIndicators = [
  'xp investimentos',
  'xp corretora',
  'rico investimentos',
  'clear corretora',
  'nu invest',
  'nuinvest',
  'avenue',
  'btg pactual',
  'genial investimentos',
  'orama',
  'órama',
  'warren',
  'toro investimentos',
  'modalmais',
  'easynvest',
  'tesouro direto',
];

export const paymentIntermediaries = [
  'mercado pago',
  'mercado pago ip',
  'pagar me',
  'pagar.me',
  'stone',
  'pay2all',
  'nu pagamentos',
  'itau unibanco',
  'itaú unibanco',
  'banco do brasil',
  'bco do brasil',
  'caixa economica',
  'caixa econômica',
];

export const ownAccountIndicators = [
  'bernardo dos santos ferreira',
  '60.274.041 bernardo dos santos ferreira',
  '60274041 bernardo dos santos ferreira',
];
