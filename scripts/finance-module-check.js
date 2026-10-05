import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const calculationsPath = path.join(projectRoot, "src", "modules", "finance", "utils", "financeCalculations.ts");
const financePeriodPath = path.join(projectRoot, "src", "modules", "finance", "utils", "financePeriod.ts");
const classificationPath = path.join(projectRoot, "src", "modules", "finance", "services", "categoryClassificationService.ts");
const categoryRuleServicePath = path.join(projectRoot, "src", "modules", "finance", "services", "categoryRuleService.ts");
const categoryRuleApplicationServicePath = path.join(projectRoot, "src", "modules", "finance", "services", "categoryRuleApplicationService.ts");
const categoryServicePath = path.join(projectRoot, "src", "modules", "finance", "services", "categoryService.ts");
const budgetServicePath = path.join(projectRoot, "src", "modules", "finance", "services", "budgetService.ts");
const financeSummaryServicePath = path.join(projectRoot, "src", "modules", "finance", "services", "financeSummaryService.ts");
const reimbursementServicePath = path.join(projectRoot, "src", "modules", "finance", "services", "reimbursementService.ts");
const financeTextPath = path.join(projectRoot, "src", "modules", "finance", "utils", "financeText.ts");
const importServicePath = path.join(projectRoot, "src", "modules", "finance", "services", "importService.ts");
const importCommitServicePath = path.join(projectRoot, "src", "modules", "finance", "services", "importCommitService.ts");
const normalizationPath = path.join(projectRoot, "src", "modules", "finance", "services", "transactionNormalizationService.ts");
const deduplicationPath = path.join(projectRoot, "src", "modules", "finance", "services", "transactionDeduplicationService.ts");
const transactionServicePath = path.join(projectRoot, "src", "modules", "finance", "services", "transactionService.ts");
const investmentServicePath = path.join(projectRoot, "src", "modules", "finance", "investments", "services", "investmentService.ts");
const investmentMovementServicePath = path.join(projectRoot, "src", "modules", "finance", "investments", "services", "investmentMovementService.ts");
const allocationServicePath = path.join(projectRoot, "src", "modules", "finance", "investments", "services", "allocationService.ts");
const parserProfilesPath = path.join(projectRoot, "src", "modules", "finance", "services", "parsers", "parserProfiles.ts");
const csvParserPath = path.join(projectRoot, "src", "modules", "finance", "services", "parsers", "csvParser.ts");
const csvStructuredMapperPath = path.join(projectRoot, "src", "modules", "finance", "services", "parsers", "csvStructuredMapper.ts");
const structuredParserPath = path.join(projectRoot, "src", "modules", "finance", "services", "parsers", "structuredTransactionParser.ts");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  calculateBudgetStatus,
  calculateBudgetUsage,
  calculateBudgetsSummary,
  calculateBudgetUsedByCategory,
  calculateCardPaymentReceived,
  calculateCardPayments,
  calculateCardPurchases,
  calculateExpensesByCategory,
  calculateFinanceSummary,
  calculateGrossRealExpenses,
  calculateInternalTransfers,
  calculateNetExpensesByCategory,
  calculateNetRealExpenses,
  calculatePendingExpenseReview,
  calculatePendingIncomeReview,
  calculateRefundAdjustments,
  calculateRealBalance,
  calculateRealExpenses,
  calculateRealIncome,
  filterTransactionsByMonth,
  filterTransactionsByCategory,
  filterTransactionsBySelectedMonth,
  filterTransactionsByScope,
  getBudgetTransactions,
  isMatchedReimbursement,
} = require(calculationsPath);

const {
  formatMonthLabel,
  getCurrentMonthKey,
  getMonthKeyFromQuery,
  getNextMonthKey,
  getPreviousMonthKey,
  isValidMonthKey,
  withFinanceFilters,
  withoutFinanceFilter,
  clearFinanceFilters,
  withMonthParam,
  withMonthAndCategoryParams,
} = require(financePeriodPath);

const {
  classifyTransactionDraft,
  suggestCategory,
  suggestTransactionKind,
} = require(classificationPath);

const {
  categoryRuleService,
} = require(categoryRuleServicePath);

const {
  categoryRuleApplicationService,
} = require(categoryRuleApplicationServicePath);

const {
  categoryService,
} = require(categoryServicePath);

const {
  budgetService,
} = require(budgetServicePath);

const {
  financeSummaryService,
} = require(financeSummaryServicePath);

const {
  investmentService,
} = require(investmentServicePath);

const {
  calculatePosition,
} = require(investmentMovementServicePath);

const {
  calculateAllocation,
  suggestNextContribution,
  isTargetComplete,
} = require(allocationServicePath);

const {
  reimbursementService,
  detectReimbursementPairs,
} = require(reimbursementServicePath);

const {
  containsKeyword,
  extractMerchant,
  matchesRuleKeyword,
  normalizeText,
} = require(financeTextPath);

const {
  importService,
} = require(importServicePath);

const {
  commitImportSelection,
  createImportBatchMetadata,
  getDefaultSelectedImportItems,
  prepareImportCommit,
} = require(importCommitServicePath);

const {
  getDefaultAccountType,
  getDefaultMethod,
  getDefaultScope,
  getDefaultSource,
  normalizeTransactionDraft,
  normalizeTransactionDrafts,
  shouldPreserveManualCategory,
} = require(normalizationPath);

const {
  createImportFingerprint,
  createTransactionFingerprint,
  deduplicateImportPreview,
  findExactDuplicate,
  findPossibleDuplicate,
  markDuplicateStatus,
} = require(deduplicationPath);

const {
  transactionService,
} = require(transactionServicePath);

const {
  c6BusinessProfile,
  nubankAccountProfile,
  nubankCreditCardProfile,
} = require(parserProfilesPath);

const {
  detectCsvDelimiter,
  normalizeCsvHeader,
  parseBrazilianMoney,
  parseCsv,
  parseCsvLine,
  parseCsvToObjects,
} = require(csvParserPath);

const {
  mapCsvRowsToStructuredRows,
  parseCsvToStructuredRows,
} = require(csvStructuredMapperPath);

const {
  mapStructuredRowToDraft,
  parseAmountFromStructuredRow,
  parseStructuredRows,
  validateStructuredRow,
} = require(structuredParserPath);

function assertMoney(actual, expected, message) {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) < 0.01,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

const createdAt = "2026-05-20T00:00:00.000Z";

function transaction(overrides) {
  return {
    id: overrides.id,
    date: overrides.date ?? "2026-05-10",
    description: overrides.description ?? overrides.id,
    originalDescription: overrides.originalDescription ?? overrides.description ?? overrides.id,
    amount: overrides.amount,
    category: overrides.category,
    categoryId: overrides.categoryId,
    accountId: overrides.accountId ?? "nubank-conta",
    accountName: overrides.accountName ?? "Nubank Conta",
    institution: overrides.institution ?? "Nubank",
    scope: overrides.scope ?? "pessoal",
    accountType: overrides.accountType ?? "checking",
    method: overrides.method ?? "pix",
    kind: overrides.kind,
    source: overrides.source ?? "manual",
    notes: overrides.notes,
    manualCategory: overrides.manualCategory ?? false,
    linkedTransferId: overrides.linkedTransferId,
    needsReview: overrides.needsReview ?? false,
    classificationConfidence: overrides.classificationConfidence ?? "high",
    classificationReason: overrides.classificationReason ?? "Fixture do check do modulo.",
    reviewedAt: overrides.reviewedAt,
    reviewedBy: overrides.reviewedBy,
    reimbursementPairId: overrides.reimbursementPairId,
    reimbursementRole: overrides.reimbursementRole,
    reimbursementStatus: overrides.reimbursementStatus,
    reimbursementMatchedAt: overrides.reimbursementMatchedAt,
    createdAt,
    updatedAt: createdAt,
  };
}

const transactions = [
  transaction({
    id: "income-review",
    amount: 1000,
    category: "Entrada a revisar",
    kind: "review",
  }),
  transaction({
    id: "expense-review",
    amount: -200,
    category: "Despesa a revisar",
    kind: "expense",
  }),
  transaction({
    id: "card-purchase-review",
    amount: -120,
    category: "Despesa a revisar",
    accountId: "nubank-cartao",
    accountName: "Nubank Cartão",
    accountType: "credit_card",
    method: "credito",
    kind: "card_purchase",
    source: "nubank_credit_card",
  }),
  transaction({
    id: "card-purchase-market",
    amount: -300,
    category: "Mercado",
    accountId: "nubank-cartao",
    accountName: "Nubank Cartão",
    accountType: "credit_card",
    method: "credito",
    kind: "card_purchase",
    source: "nubank_credit_card",
  }),
  transaction({
    id: "card-payment",
    amount: -500,
    category: "Pagamento de fatura",
    method: "fatura",
    kind: "card_payment",
  }),
  transaction({
    id: "card-payment-received",
    amount: 500,
    category: "Pagamento recebido da fatura",
    accountId: "nubank-cartao",
    accountName: "Nubank Cartão",
    accountType: "credit_card",
    method: "fatura",
    kind: "card_payment_received",
  }),
  transaction({
    id: "transfer-out",
    amount: -400,
    category: "Transferência interna",
    kind: "transfer",
    linkedTransferId: "transfer-1",
  }),
  transaction({
    id: "transfer-in",
    amount: 400,
    category: "Transferência interna",
    accountId: "c6-empresa",
    accountName: "C6 Empresa",
    institution: "C6 Bank",
    accountType: "business_checking",
    scope: "empresa",
    kind: "transfer",
    linkedTransferId: "transfer-1",
  }),
  transaction({
    id: "business-income",
    amount: 700,
    category: "Renda",
    accountId: "c6-empresa",
    accountName: "C6 Empresa",
    institution: "C6 Bank",
    accountType: "business_checking",
    scope: "empresa",
    kind: "income",
  }),
  transaction({
    id: "last-month-expense",
    date: "2026-04-30",
    amount: -50,
    category: "Mercado",
    kind: "expense",
  }),
];

const snapshot = JSON.stringify(transactions);
const mayTransactions = filterTransactionsByMonth(transactions, 2026, 5);
const personalTransactions = filterTransactionsByScope(mayTransactions, "pessoal");
const businessTransactions = filterTransactionsByScope(mayTransactions, "empresa");
const consolidatedTransactions = filterTransactionsByScope(mayTransactions, "consolidado");
const summary = calculateFinanceSummary(consolidatedTransactions);
const budget = {
  id: "budget-market",
  name: "Mercado",
  categoryId: "mercado",
  categories: ["Mercado"],
  amount: 1000,
  scope: "consolidado",
  period: "monthly",
  createdAt,
  updatedAt: createdAt,
};

assert.equal(mayTransactions.length, 9, "Filtro por mês/ano deve manter apenas maio de 2026");
assert.equal(personalTransactions.every((item) => item.scope === "pessoal"), true, "Visão pessoal não deve misturar empresa");
assert.equal(businessTransactions.every((item) => item.scope === "empresa"), true, "Visão empresa não deve misturar pessoal");
assert.equal(consolidatedTransactions.length, mayTransactions.length, "Visão consolidada deve incluir pessoal e empresa");

assertMoney(calculateRealIncome(consolidatedTransactions), 700, "Entrada a revisar e pagamento recebido da fatura não entram como receita real");
assertMoney(calculateRealExpenses(consolidatedTransactions), 620, "Despesa a revisar e card_purchase entram como despesa real");
assertMoney(calculateRealBalance(consolidatedTransactions), 80, "Resultado real deve ser receita real menos despesa real");
assertMoney(calculatePendingIncomeReview(consolidatedTransactions), 1000, "Entrada a revisar positiva deve ficar pendente");
assertMoney(calculatePendingExpenseReview(consolidatedTransactions), 320, "Despesa a revisar inclui despesa comum e compra no cartão a revisar");
assertMoney(calculateInternalTransfers(consolidatedTransactions), 800, "Transferências internas devem ser rastreadas separadamente");
assertMoney(calculateCardPurchases(consolidatedTransactions), 420, "Compras no cartão devem alimentar métrica própria");
assertMoney(calculateCardPayments(consolidatedTransactions), 500, "Pagamento de fatura deve ser rastreado separado");
assertMoney(calculateCardPaymentReceived(consolidatedTransactions), 500, "Pagamento recebido da fatura deve ser rastreado separado");

assertMoney(summary.income, 700, "Resumo não deve inflar receitas");
assertMoney(summary.expenses, 620, "Resumo não deve inflar despesas com fatura ou transferência");
// Modelo dois pools (060f286): compra no cartão não reduz saldo na hora, só o
// pagamento da fatura reduz. Saldo = receita - despesas em dinheiro - pagamentos de fatura,
// não receita - despesas totais (isso é calculateRealBalance, testado acima).
assertMoney(summary.cashExpenses, 200, "Despesas em dinheiro devem excluir compras no cartão (pool de crédito)");
assertMoney(summary.balance, 0, "Resumo deve calcular saldo em caixa (dois pools), não resultado real");

const categoryExpenses = calculateExpensesByCategory(consolidatedTransactions);
assertMoney(categoryExpenses["Mercado"], 300, "Gastos por categoria devem somar gastos reais");
assertMoney(calculateBudgetUsedByCategory("Mercado", consolidatedTransactions), 300, "Orçamento por categoria deve somar gasto real");
assertMoney(calculateBudgetStatus(budget, consolidatedTransactions).spent, 300, "Status de orçamento deve usar gasto real por categoria");

assert.equal(
  transactions.find((item) => item.id === "card-purchase-review")?.kind,
  "card_purchase",
  "Compra no cartão em Despesa a revisar deve continuar card_purchase",
);
assert.equal(snapshot, JSON.stringify(transactions), "Cálculos puros não devem alterar categoria manual, kind ou transações originais");

// ── Aporte em investimento não é gasto ───────────────────────────────────────
// Mandar dinheiro pra corretora move o dinheiro de caixa pra patrimônio; não
// consome nada. Contar como despesa inflava o gasto do mês e quebrava a
// projeção — mesmo motivo pelo qual `transfer` já era neutro.
const investmentFlowTransactions = [
  transaction({ id: "inv-salary", date: "2026-05-01", amount: 3000, category: "Renda", kind: "income" }),
  transaction({ id: "inv-market", date: "2026-05-02", amount: -200, category: "Mercado", kind: "expense" }),
  transaction({
    id: "inv-contribution",
    date: "2026-05-03",
    amount: -500,
    category: "Aporte em investimento",
    kind: "investment_contribution",
  }),
  transaction({
    id: "inv-withdrawal",
    date: "2026-05-04",
    amount: 300,
    category: "Resgate de investimento",
    kind: "investment_withdrawal",
  }),
];
const investmentSummary = calculateFinanceSummary(investmentFlowTransactions);
assertMoney(calculateRealExpenses(investmentFlowTransactions), 200, "Aporte não pode entrar em despesa real");
assertMoney(calculateRealIncome(investmentFlowTransactions), 3000, "Resgate não pode entrar em receita real");
assertMoney(investmentSummary.expenses, 200, "Resumo não deve contar aporte como despesa");
assertMoney(investmentSummary.income, 3000, "Resumo não deve contar resgate como receita");
assertMoney(investmentSummary.investmentContributions, 500, "Aporte deve ser rastreado em métrica própria");
assertMoney(investmentSummary.investmentWithdrawals, 300, "Resgate deve ser rastreado em métrica própria");
assert.equal(
  Object.keys(calculateExpensesByCategory(investmentFlowTransactions)).includes("Aporte em investimento"),
  false,
  "Aporte não deve aparecer em gastos por categoria",
);
assertMoney(
  calculateBudgetUsedByCategory("Aporte em investimento", investmentFlowTransactions),
  0,
  "Aporte não deve consumir orçamento",
);

// Sugestão por corretora precisa pedir revisão: classificar sozinho tiraria uma
// despesa real do resultado do mês se a heurística errasse.
const brokerDraft = normalizeTransactionDraft({
  id: "broker-pix",
  date: "2026-05-05",
  description: "Pix enviado para XP INVESTIMENTOS CCTVM",
  amount: -500,
  accountId: "nubank-conta",
  source: "nubank_account",
});
assert.equal(brokerDraft.category, "Aporte em investimento", "Descrição com corretora deve sugerir aporte");
assert.equal(brokerDraft.needsReview, true, "Aporte sugerido por corretora deve exigir confirmação");
const nonBrokerDraft = normalizeTransactionDraft({
  id: "person-pix",
  date: "2026-05-05",
  description: "Pix enviado para Joao da Silva",
  amount: -500,
  accountId: "nubank-conta",
  source: "nubank_account",
});
assert.equal(
  nonBrokerDraft.kind === "investment_contribution",
  false,
  "Pix comum não pode virar aporte",
);

// ── Carteira: posição a partir dos movimentos ────────────────────────────────
// O valor atual precisa ser consequência do histórico, não um número solto.
const brlMovements = [
  { id: "m1", investmentId: "a", type: "contribution", date: "2026-05-01", amount: 500, source: "manual", createdAt: "2026-05-01T00:00:00.000Z" },
  { id: "m2", investmentId: "a", type: "contribution", date: "2026-06-01", amount: 300, source: "manual", createdAt: "2026-06-01T00:00:00.000Z" },
  { id: "m3", investmentId: "a", type: "withdrawal",   date: "2026-06-15", amount: 100, source: "manual", createdAt: "2026-06-15T00:00:00.000Z" },
  { id: "m4", investmentId: "a", type: "valuation",    date: "2026-07-01", amount: 780, source: "manual", createdAt: "2026-07-01T00:00:00.000Z" },
];
const brlPosition = calculatePosition(brlMovements);
assertMoney(brlPosition.totalInvested, 700, "Aportes menos resgates definem o total investido");
assertMoney(brlPosition.currentValue, 780, "Última marcação a mercado define o valor atual");
assert.equal(brlPosition.lastValuationDate, "2026-07-01", "Posição deve registrar a data da última marcação");
assertMoney(
  calculatePosition(brlMovements.filter((m) => m.type !== "valuation")).currentValue,
  700,
  "Sem marcação, o valor atual cai pro total aportado",
);
assertMoney(calculatePosition([]).currentValue, 0, "Ativo sem movimento não pode virar NaN");

// Câmbio por movimento é o que separa ganho do ativo de ganho do dólar.
const usdPosition = calculatePosition([
  { id: "u1", investmentId: "b", type: "contribution", date: "2026-05-01", amount: 100, exchangeRate: 5, source: "manual", createdAt: "2026-05-01T00:00:00.000Z" },
  { id: "u2", investmentId: "b", type: "valuation",    date: "2026-07-01", amount: 110, exchangeRate: 6, source: "manual", createdAt: "2026-07-01T00:00:00.000Z" },
]);
assertMoney(usdPosition.totalInvested, 500, "Aporte em dólar entra em real pelo câmbio do dia");
assertMoney(usdPosition.currentValue, 660, "Marcação em dólar usa o câmbio da própria marcação");
assertMoney(usdPosition.totalInvestedInAssetCurrency, 100, "Posição preserva o valor na moeda do ativo");
assertMoney(usdPosition.currentValueInAssetCurrency, 110, "Ativo rendeu 10% em dólar, independente do câmbio");

// ── Alocação alvo × real ─────────────────────────────────────────────────────
const hydraTarget = { acoes_br: 35, fiis: 21, exterior: 14, tesouro: 30 };
assert.equal(isTargetComplete(hydraTarget), true, "Alvo que soma 100% deve ser aceito");
assert.equal(isTargetComplete({ ...hydraTarget, acoes_br: 40 }), false, "Alvo que não fecha 100% deve ser rejeitado");

const portfolio = [
  { id: "p1", currentValue: 1000, bucket: "carteira", sleeve: "acoes_br" },
  { id: "p2", currentValue: 5000, bucket: "reserva" },
  { id: "p3", currentValue: 200,  bucket: "carteira" },
];
const allocation = calculateAllocation(portfolio, hydraTarget);
assertMoney(allocation.total, 1200, "Reserva não pode entrar no total da carteira");
assertMoney(allocation.unassignedValue, 200, "Ativo de carteira sem fatia deve ficar sinalizado");
assertMoney(
  allocation.sleeves.find((s) => s.sleeve === "acoes_br").currentValue,
  1000,
  "Fatia deve somar só os ativos dela",
);

// Um destino por mês: o aporte inteiro vai pra fatia mais atrasada.
assert.equal(
  suggestNextContribution([], 500, hydraTarget).sleeve,
  "acoes_br",
  "Carteira zerada deve começar pela maior fatia do alvo",
);
assert.equal(
  suggestNextContribution([{ id: "x", currentValue: 1000, bucket: "carteira", sleeve: "acoes_br" }], 500, hydraTarget).sleeve,
  "tesouro",
  "Com Ações já preenchida, o aporte deve ir pra fatia mais atrasada",
);
assert.equal(suggestNextContribution([], 0, hydraTarget), null, "Aporte zerado não deve sugerir destino");
assert.equal(
  suggestNextContribution([{ id: "r", currentValue: 9999, bucket: "reserva" }], 500, hydraTarget).sleeve,
  "acoes_br",
  "Reserva grande não pode influenciar o destino do aporte da carteira",
);
const filteredCategoryTransactions = filterTransactionsByCategory(transactions, "Mercado");
assert.equal(filteredCategoryTransactions.every((item) => item.category === "Mercado"), true, "Filtro por categoria deve excluir outras categorias");
assert.equal(filterTransactionsBySelectedMonth(filteredCategoryTransactions, "2026-05").length, 1, "Month + category devem manter apenas intersecao dos filtros");
assert.equal(filterTransactionsBySelectedMonth(transactions, "2026-04").some((item) => item.date.startsWith("2026-05")), false, "Filtro mensal deve excluir outro mes");
assert.equal(isValidMonthKey(getCurrentMonthKey()), true, "getCurrentMonthKey deve retornar YYYY-MM valido");
assert.equal(getPreviousMonthKey("2026-01"), "2025-12", "Mes anterior deve atravessar virada de ano");
assert.equal(getNextMonthKey("2026-12"), "2027-01", "Proximo mes deve atravessar virada de ano");
assert.equal(isValidMonthKey("2026-13"), false, "isValidMonthKey deve rejeitar mes invalido");
assert.equal(isValidMonthKey("maio-2026"), false, "isValidMonthKey deve rejeitar formato fora de YYYY-MM");
assert.equal(formatMonthLabel("2026-05").includes("2026"), true, "formatMonthLabel deve incluir o ano");
assert.equal(getMonthKeyFromQuery("2026-13"), getCurrentMonthKey(), "Query month invalida deve cair no mes atual");
assert.equal(withMonthParam("/financeiro/orcamentos", "2026-05"), "/financeiro/orcamentos?month=2026-05", "Links mensais devem preservar month");
assert.equal(
  withMonthAndCategoryParams("/financeiro/transacoes", "2026-05", "Alimentação fora"),
  "/financeiro/transacoes?month=2026-05&category=Alimenta%C3%A7%C3%A3o+fora",
  "Helper deve montar month e category com encoding seguro",
);
assert.equal(
  withFinanceFilters("/financeiro/transacoes", { month: "2026-05", category: "Cartão de crédito" }),
  "/financeiro/transacoes?month=2026-05&category=Cart%C3%A3o+de+cr%C3%A9dito",
  "Helper deve codificar categorias com espaco e acento",
);
assert.equal(
  withMonthAndCategoryParams("/financeiro/transacoes", "2026-05"),
  "/financeiro/transacoes?month=2026-05",
  "Helper deve funcionar sem categoria",
);
assert.equal(
  withoutFinanceFilter("/financeiro/transacoes", { month: "2026-05", category: "Mercado" }, "category"),
  "/financeiro/transacoes?month=2026-05",
  "Remover categoria deve preservar month",
);
assert.equal(
  withoutFinanceFilter("/financeiro/transacoes", { month: "2026-05", category: "Mercado" }, "month"),
  "/financeiro/transacoes?category=Mercado",
  "Remover month deve preservar category",
);
assert.equal(clearFinanceFilters("/financeiro/transacoes"), "/financeiro/transacoes", "Limpar filtros deve remover month e category");

assert.equal(normalizeText("Saúde CAFÉ"), "saude cafe", "normalizeText deve remover acentos e padronizar caixa");
assert.equal(containsKeyword("Empréstimo contratado", "tim"), false, "Keyword curta não deve bater como substring indevida");
const realisticSantanderDescription =
  "Transferência recebida pelo Pix - BERNARDO DOS SANTOS FERREIRA - BCO SANTANDER";
const maskedSantanderDescription =
  "Transferência recebida pelo Pix - BERNARDO DOS SANTOS FERREIRA - •••.484.579-•• - BCO SANTANDER";
assert.equal(
  containsKeyword(realisticSantanderDescription, "BERNARDO DOS SANTOS FERREIRA"),
  true,
  "Keyword parcial com nome Santander/Bernardo deve bater na descricao completa",
);
assert.equal(
  containsKeyword(realisticSantanderDescription, "bco santander"),
  true,
  "Keyword parcial BCO SANTANDER deve ignorar caixa",
);
assert.equal(
  containsKeyword(realisticSantanderDescription, "SANTANDER"),
  true,
  "Keyword parcial SANTANDER deve bater na descricao completa",
);
assert.equal(
  containsKeyword(realisticSantanderDescription, "bernardo dos santos ferreira bco santander"),
  true,
  "Match de regra deve tolerar hifens e pontuacao entre nome e banco",
);
assert.equal(
  matchesRuleKeyword(maskedSantanderDescription, "BERNARDO DOS SANTOS FERREIRA BCO SANTANDER"),
  true,
  "Regra composta deve tolerar CPF mascarado entre nome e banco",
);
assert.equal(
  matchesRuleKeyword(maskedSantanderDescription, "BCO SANTANDER"),
  true,
  "Regra parcial BCO SANTANDER deve bater na descricao Pix mascarada",
);
assert.equal(
  matchesRuleKeyword(maskedSantanderDescription, "BERNARDO DOS SANTOS FERREIRA"),
  true,
  "Regra parcial pelo nome deve bater na descricao Pix mascarada",
);
assert.equal(
  matchesRuleKeyword(maskedSantanderDescription, "tim"),
  false,
  "Regra curta nao deve virar substring perigosa no match tolerante",
);
assert.equal(extractMerchant("Compra no crédito - Mercado Pago - Cinemark"), "Mercado Pago - Cinemark", "Merchant deve preservar contexto após operação");

const mercadoPagoOnly = classifyTransactionDraft({
  description: "Compra no crédito - Mercado Pago",
  amount: -45,
  method: "credito",
});
assert.notEqual(mercadoPagoOnly.category, "Mercado", "Mercado Pago não deve virar Mercado automaticamente");

const ifood = classifyTransactionDraft({
  description: "Compra no débito - iFood restaurante",
  amount: -52,
  method: "debito",
});
assert.equal(ifood.category, "Alimentação fora", "iFood deve sugerir Alimentação fora");

const cinemarkViaIntermediary = classifyTransactionDraft({
  description: "Compra no crédito - Mercado Pago - Cinemark",
  amount: -80,
  method: "credito",
});
assert.equal(cinemarkViaIntermediary.category, "Lazer", "Merchant real depois de intermediário deve permitir categoria Lazer");

const unknownIncomingPix = classifyTransactionDraft({
  description: "Transferência recebida pelo Pix - Pessoa Desconhecida",
  amount: 100,
  method: "pix",
});
assert.equal(unknownIncomingPix.category, "Entrada a revisar", "Pix recebido desconhecido deve ir para Entrada a revisar");
assert.equal(unknownIncomingPix.kind, "review", "Pix recebido desconhecido deve ficar como review");

const unknownOutgoingPix = classifyTransactionDraft({
  description: "Transferência enviada pelo Pix - Pessoa Desconhecida",
  amount: -90,
  method: "pix",
});
assert.equal(unknownOutgoingPix.category, "Despesa a revisar", "Pix enviado desconhecido deve ir para Despesa a revisar");
assert.equal(unknownOutgoingPix.kind, "expense", "Pix enviado desconhecido deve ficar como expense");
assert.notEqual(unknownOutgoingPix.kind, "transfer", "Pix enviado desconhecido não deve virar transferência automaticamente");

const cardPayment = classifyTransactionDraft({
  description: "Pagamento de fatura",
  amount: -500,
  method: "fatura",
});
assert.equal(cardPayment.kind, "card_payment", "Pagamento de fatura deve virar card_payment");

const cardPaymentReceived = classifyTransactionDraft({
  description: "Pagamento recebido",
  amount: 500,
  method: "fatura",
  source: "nubank_credit_card",
});
assert.equal(cardPaymentReceived.kind, "card_payment_received", "Pagamento recebido da fatura deve virar card_payment_received");

const cardPurchase = classifyTransactionDraft({
  description: "Compra no crédito - Loja Teste",
  amount: -120,
  method: "credito",
  kind: "card_purchase",
});
assert.equal(cardPurchase.kind, "card_purchase", "Compra no crédito deve preservar card_purchase");

const manualCategory = classifyTransactionDraft({
  description: "Uber viagem",
  amount: -60,
  category: "Despesa a revisar",
  kind: "expense",
  manualCategory: true,
});
assert.equal(manualCategory.category, "Despesa a revisar", "Categoria manual não deve ser sobrescrita");

const santanderOwnAccountDescription = maskedSantanderDescription;
categoryRuleService.createCategoryRule({
  keyword: "BERNARDO DOS SANTOS FERREIRA",
  category: "Transferência interna",
  kind: "transfer",
});
categoryRuleService.createCategoryRule({
  keyword: "BERNARDO DOS SANTOS FERREIRA BCO SANTANDER",
  category: "Renda",
  kind: "income",
});
assert.equal(
  categoryRuleService.findMatchingCategoryRule(realisticSantanderDescription)?.category,
  "Renda",
  "Regra completa Santander/Bernardo deve tolerar pontuacao da descricao real",
);
assert.equal(
  categoryRuleService.findMatchingCategoryRule(maskedSantanderDescription)?.kind,
  "income",
  "Regra especifica de Renda deve vencer regra generica de Transferencia interna",
);
categoryRuleService.createCategoryRule({
  keyword: "BERNARDO DOS SANTOS FERREIRA",
  category: "Renda",
  kind: "income",
});
assert.equal(
  categoryRuleService.findMatchingCategoryRule(realisticSantanderDescription)?.category,
  "Renda",
  "Regra parcial pelo nome deve bater na descricao real",
);
categoryRuleService.createCategoryRule({
  keyword: "BCO SANTANDER",
  category: "Renda",
  kind: "income",
});
assert.equal(
  categoryRuleService.findMatchingCategoryRule(realisticSantanderDescription)?.category,
  "Renda",
  "Regra parcial pelo banco deve bater na descricao real",
);
const manualSantanderIncome = normalizeTransactionDraft({
  id: "manual-santander-income",
  date: "2026-05-21",
  description: santanderOwnAccountDescription,
  amount: 2450,
  method: "pix",
  source: "nubank_account",
});
assert.equal(manualSantanderIncome.category, "Renda", "Regra manual ativa deve vir antes da transferencia interna");
assert.equal(manualSantanderIncome.kind, "income", "Indicio de conta propria vira income quando regra manual explicita receita");
assert.equal(manualSantanderIncome.needsReview, false, "Regra manual explicita deve remover needsReview");
assert.equal(manualSantanderIncome.manualCategory, true, "Regra manual aplicada no pipeline deve proteger categoria");
assert.equal(manualSantanderIncome.classificationConfidence, "high", "Regra manual explicita deve ter confidence high");
assert.equal(manualSantanderIncome.classificationReason.includes("Regra manual"), true, "Reason deve indicar regra manual");
assertMoney(calculateRealIncome([manualSantanderIncome]), 2450, "Receita por regra manual entra em receitas reais");
transactionService.replaceTransactions([manualSantanderIncome]);
assert.equal(transactionService.listOptionalCheckTransactions().length, 0, "Receita por regra manual nao entra em conferencia opcional");

const manualSantanderPreview = importService.previewImportDrafts([
  {
    id: "preview-santander-income",
    date: "2026-05-21",
    description: santanderOwnAccountDescription,
    amount: 2450,
    method: "pix",
    source: "nubank_account",
  },
]);
assert.equal(manualSantanderPreview.normalizedTransactions[0].category, "Renda", "Preview deve mostrar categoria Renda por regra manual");
assert.equal(manualSantanderPreview.normalizedTransactions[0].kind, "income", "Preview deve mostrar Receita por regra manual");
assert.equal(manualSantanderPreview.needsReviewCount, 0, "Preview de regra manual explicita nao cria revisao");

categoryRuleService.createCategoryRule({
  keyword: "fornecedor regra explicita",
  category: "Outros",
  kind: "expense",
});
assert.equal(
  classifyTransactionDraft({
    description: "Transferencia recebida pelo Pix - Bernardo dos Santos Ferreira - Fornecedor Regra Explicita",
    amount: -80,
    method: "pix",
  }).kind,
  "expense",
  "Regra manual Despesa explicita vence heuristica automatica",
);
categoryRuleService.createCategoryRule({
  keyword: "transferencia manual confirmada",
  category: "Transferência interna",
  kind: "transfer",
});
assert.equal(
  classifyTransactionDraft({
    description: "Transferencia manual confirmada",
    amount: -140,
    method: "pix",
  }).kind,
  "transfer",
  "Regra manual Transferencia interna continua gerando transfer",
);
categoryRuleService.clearCategoryRules();
categoryRuleService.createCategoryRule({
  keyword: "bernardo manter classificador",
  category: "Renda",
});
assert.equal(
  classifyTransactionDraft({
    description: "Transferencia recebida pelo Pix - Bernardo dos Santos Ferreira - Bernardo manter classificador",
    amount: 100,
    method: "pix",
  }).kind,
  "transfer",
  "Regra manual Manter classificador nao forca income",
);
categoryRuleService.clearCategoryRules();
const automaticSantanderTransfer = normalizeTransactionDraft({
  id: "automatic-santander-transfer",
  date: "2026-05-21",
  description: santanderOwnAccountDescription,
  amount: 2450,
  method: "pix",
  source: "nubank_account",
});
assert.equal(automaticSantanderTransfer.kind, "transfer", "Transferencia automatica sem regra deve virar transfer");
assert.equal(automaticSantanderTransfer.manualCategory, false, "Transferencia interna automatica deve manter manualCategory false");
const automaticOwnTransfer = classifyTransactionDraft({
  description: santanderOwnAccountDescription,
  amount: 2450,
  method: "pix",
  source: "nubank_account",
});
assert.equal(automaticOwnTransfer.kind, "transfer", "Indicio de conta propria sem regra manual continua transfer");
assertMoney(
  calculateRealIncome([{ ...manualSantanderIncome, kind: automaticOwnTransfer.kind, category: automaticOwnTransfer.category }]),
  0,
  "Transferencia interna sem regra continua fora de receitas reais",
);
const preservedOwnTransferManualChoice = classifyTransactionDraft({
  description: santanderOwnAccountDescription,
  amount: 2450,
  method: "pix",
  category: "Renda",
  kind: "income",
  manualCategory: true,
});
assert.equal(preservedOwnTransferManualChoice.kind, "income", "manualCategory true nao e sobrescrito pela heuristica automatica");
assert.equal(preservedOwnTransferManualChoice.category, "Renda", "Categoria manual de conta propria fica preservada");
const manualIfoodRule = categoryRuleService.createCategoryRule({
  name: "iFood manual",
  keyword: "IFood",
  category: "Alimentação fora",
});
assert.equal(manualIfoodRule.normalizedKeyword, "ifood", "createCategoryRule deve normalizar keyword");
assert.equal(categoryRuleService.listCategoryRules().length, 1, "listCategoryRules deve retornar regras salvas");
assert.throws(
  () => categoryRuleService.createCategoryRule({ keyword: "   ", category: "Mercado" }),
  /vazia/,
  "createCategoryRule deve rejeitar keyword vazia",
);
assert.throws(
  () => categoryRuleService.createCategoryRule({ keyword: "ifood", category: "Alimentação fora" }),
  /existe/,
  "createCategoryRule deve evitar duplicada simples",
);
const manualIfoodSuggestion = classifyTransactionDraft({
  description: "Compra no débito - IFood mercado",
  amount: -49,
  method: "debito",
});
assert.equal(manualIfoodSuggestion.category, "Alimentação fora", "Regra manual para IFOOD deve sugerir categoria configurada");
assert.equal(manualIfoodSuggestion.reason.includes("Regra manual"), true, "classificationReason deve indicar regra manual usada");

const inactiveManualRule = categoryRuleService.createCategoryRule({
  keyword: "steam",
  category: "Mercado",
});
categoryRuleService.toggleCategoryRule(inactiveManualRule.id);
assert.equal(
  classifyTransactionDraft({ description: "Steam game", amount: -35 }).category,
  "Lazer",
  "Regra inativa não deve ser aplicada",
);
categoryRuleService.toggleCategoryRule(inactiveManualRule.id);
assert.equal(
  classifyTransactionDraft({ description: "Steam game", amount: -35 }).category,
  "Mercado",
  "Regra ativa deve vir antes de aliases automáticos",
);
assert.equal(categoryRuleService.deleteCategoryRule(inactiveManualRule.id), true, "deleteCategoryRule deve remover regra");

const ruleProtectedManualCategory = classifyTransactionDraft({
  description: "IFood restaurante",
  amount: -28,
  category: "Despesa a revisar",
  kind: "expense",
  manualCategory: true,
});
assert.equal(ruleProtectedManualCategory.category, "Despesa a revisar", "Regra manual deve preservar manualCategory true");

categoryRuleService.createCategoryRule({
  keyword: "pagamento",
  category: "Renda",
});
assert.equal(
  classifyTransactionDraft({ description: "Pagamento de fatura", amount: -500, method: "fatura" }).kind,
  "card_payment",
  "Regra manual sem tipo explicito nao transforma card_payment",
);
assert.equal(
  classifyTransactionDraft({ description: "Pagamento recebido", amount: 500, method: "fatura", source: "nubank_credit_card" }).kind,
  "card_payment_received",
  "Regra manual sem tipo explicito nao transforma card_payment_received",
);
categoryRuleService.createCategoryRule({
  keyword: "loja regra",
  category: "Mercado",
});
assert.equal(
  classifyTransactionDraft({
    description: "Compra no crédito - Loja Regra",
    amount: -72,
    method: "credito",
    source: "nubank_credit_card",
  }).kind,
  "card_purchase",
  "Compra no cartão continua card_purchase mesmo com regra de categoria",
);

const reviewRuleSource = normalizeTransactionDraft({
  id: "review-rule-source",
  date: "2026-05-20",
  description: "Compra no débito - Padaria Manual",
  amount: -21,
  category: "Alimentação fora",
  manualCategory: true,
});
const ruleFromReview = categoryRuleService.createRuleFromTransaction(reviewRuleSource, reviewRuleSource.category, "padaria manual");
assert.equal(ruleFromReview.category, reviewRuleSource.category, "createRuleFromTransaction deve usar categoria da transação");
assert.equal(
  classifyTransactionDraft({ description: "Padaria Manual Centro", amount: -19 }).category,
  reviewRuleSource.category,
  "Regra criada em revisão deve ser usada em nova classificação",
);

// Sem `kind`, a regra é tratada como "manter classificador" e o preview de
// aplicação a descarta — ela nunca alcança os lançamentos parecidos que já
// estão na fila, que é justamente o motivo de criá-la durante a revisão.
assert.equal(
  ruleFromReview.kind,
  undefined,
  "Regra sem tipo informado continua sem kind (modo manter classificador)",
);
const ruleWithKind = categoryRuleService.createRuleFromTransaction(
  reviewRuleSource,
  reviewRuleSource.category,
  "padaria com tipo",
  "expense",
);
assert.equal(ruleWithKind.kind, "expense", "createRuleFromTransaction deve propagar o tipo escolhido na revisão");
categoryRuleService.clearCategoryRules();

for (const suggestion of [
  mercadoPagoOnly,
  ifood,
  cinemarkViaIntermediary,
  unknownIncomingPix,
  unknownOutgoingPix,
  cardPayment,
  cardPaymentReceived,
  cardPurchase,
  manualCategory,
  suggestCategory({ description: "Steam", amount: -20 }),
  suggestTransactionKind({ description: "Estorno compra", amount: 20 }),
]) {
  assert.ok(suggestion.reason, "Sugestão deve trazer reason");
  assert.ok(["high", "medium", "low"].includes(suggestion.confidence), "Sugestão deve trazer confidence");
}

const manualExpense = normalizeTransactionDraft({
  id: "manual-expense",
  date: "10/05/2026",
  description: "Mercado manual",
  amount: -75,
  category: "Mercado",
  manualCategory: true,
});
assert.equal(manualExpense.category, "Mercado", "Despesa manual simples deve preservar categoria");
assert.equal(manualExpense.kind, "expense", "Despesa manual simples deve normalizar kind expense");
assert.equal(manualExpense.date, "2026-05-10", "Data manual deve normalizar para YYYY-MM-DD");

const manualIncome = normalizeTransactionDraft({
  id: "manual-income",
  date: "2026-05-10",
  description: "Renda manual",
  amount: 1500,
  category: "Renda",
  manualCategory: true,
});
assert.equal(manualIncome.category, "Renda", "Receita manual simples deve preservar categoria");
assert.equal(manualIncome.kind, "income", "Receita manual simples deve normalizar kind income");

const normalizedIncomingPix = normalizeTransactionDraft({
  id: "incoming-pix",
  date: "2026-05-11",
  description: "Transferência recebida pelo Pix - Pessoa Desconhecida",
  amount: 100,
  method: "pix",
});
assert.equal(normalizedIncomingPix.category, "Entrada a revisar", "Pix recebido desconhecido normalizado deve ir para Entrada a revisar");
assert.equal(normalizedIncomingPix.kind, "review", "Pix recebido desconhecido normalizado deve ficar como review");

const normalizedOutgoingPix = normalizeTransactionDraft({
  id: "outgoing-pix",
  date: "2026-05-11",
  description: "Transferência enviada pelo Pix - Pessoa Desconhecida",
  amount: -90,
  method: "pix",
});
assert.equal(normalizedOutgoingPix.category, "Despesa a revisar", "Pix enviado desconhecido normalizado deve ir para Despesa a revisar");
assert.notEqual(normalizedOutgoingPix.kind, "transfer", "Pix enviado desconhecido normalizado não deve virar transfer");

const normalizedCreditPurchase = normalizeTransactionDraft({
  id: "credit-purchase",
  date: "2026-05-12",
  description: "Compra no crédito - Loja Teste",
  amount: -120,
});
assert.equal(normalizedCreditPurchase.method, "credito", "Compra no crédito deve normalizar método credito");
assert.equal(normalizedCreditPurchase.kind, "card_purchase", "Compra no crédito deve virar card_purchase");

const normalizedCardPayment = normalizeTransactionDraft({
  id: "normalized-card-payment",
  date: "2026-05-13",
  description: "Pagamento de fatura",
  amount: -500,
});
assert.equal(normalizedCardPayment.method, "fatura", "Pagamento de fatura deve normalizar método fatura");
assert.equal(normalizedCardPayment.kind, "card_payment", "Pagamento de fatura deve virar card_payment");

const normalizedCardPaymentReceived = normalizeTransactionDraft({
  id: "normalized-card-payment-received",
  date: "2026-05-14",
  description: "Pagamento recebido",
  amount: 500,
  method: "fatura",
  source: "nubank_credit_card",
});
assert.equal(normalizedCardPaymentReceived.kind, "card_payment_received", "Pagamento recebido da fatura deve virar card_payment_received");

const normalizedRefund = normalizeTransactionDraft({
  id: "normalized-refund",
  date: "2026-05-15",
  description: "Estorno compra cartão",
  amount: 35,
});
assert.equal(normalizedRefund.kind, "refund", "Estorno/reembolso deve virar refund");

assertMoney(
  calculateRealExpenses([
    transaction({ id: "positive-old-expense", amount: 208.44, category: "Alimentacao fora", kind: "expense" }),
    transaction({ id: "positive-old-card-purchase", amount: 50, category: "Alimentacao fora", kind: "card_purchase" }),
  ]),
  0,
  "Entradas positivas antigas com kind de gasto nao devem inflar Despesas reais",
);
assertMoney(calculateGrossRealExpenses([transaction({ id: "positive-refund", amount: 208.44, category: "Alimentacao fora", kind: "refund" })]), 0, "Refund positivo nao entra em despesa bruta");
assertMoney(
  calculateNetExpensesByCategory([
    transaction({ id: "ifood-expense-for-refund", amount: -300, category: "Alimentacao fora", kind: "expense" }),
    transaction({ id: "ifood-refund-adjustment", amount: 208.44, category: "Alimentacao fora", kind: "refund" }),
  ]).find((item) => item.category === "Alimentacao fora")?.amount,
  91.56,
  "Refund positivo reduz gasto liquido da categoria",
);
const refundedMealTransactions = [
  transaction({ id: "gross-meal-expense", amount: -200, category: "Alimentacao fora", kind: "expense" }),
  transaction({ id: "safe-meal-refund", amount: 200, category: "Alimentacao fora", kind: "refund" }),
];
assertMoney(calculateGrossRealExpenses(refundedMealTransactions), 200, "Saida real entra em despesas brutas");
assertMoney(calculateRealIncome([refundedMealTransactions[1]]), 0, "Refund nao entra em receita real");
assertMoney(calculateRefundAdjustments(refundedMealTransactions), 200, "Refund seguro entra como ajuste de estorno");
assertMoney(calculateNetRealExpenses(refundedMealTransactions), 0, "Compra e refund iguais zeram despesa liquida");
assertMoney(calculateRealExpenses(refundedMealTransactions), 0, "Despesas reais exibidas usam despesa liquida");
assertMoney(
  calculateRealBalance([
    transaction({ id: "income-before-refund", amount: 1000, category: "Renda", kind: "income" }),
    ...refundedMealTransactions,
  ]),
  1000,
  "Resultado real deve usar despesa liquida",
);
assertMoney(
  calculateRefundAdjustments([
    transaction({ id: "neutral-transfer-refund", amount: 20, category: "Transferencia interna", kind: "refund" }),
    transaction({ id: "neutral-card-refund", amount: 20, category: "Pagamento de fatura", kind: "refund" }),
    transaction({ id: "review-refund", amount: 20, category: "Entrada a revisar", kind: "refund" }),
  ]),
  0,
  "Refund neutro ou pendente nao reduz despesas liquidas",
);
const refundedMealSummary = calculateFinanceSummary([
  transaction({ id: "refunded-income", amount: 1000, category: "Renda", kind: "income" }),
  ...refundedMealTransactions,
]);
assertMoney(refundedMealSummary.grossExpenses, 200, "Resumo expõe despesas brutas");
assertMoney(refundedMealSummary.refundAdjustments, 200, "Resumo expõe ajustes de estorno");
assertMoney(refundedMealSummary.netExpenses, 0, "Resumo expõe despesas liquidas");
assertMoney(refundedMealSummary.expenses, refundedMealSummary.netExpenses, "Despesas reais do resumo usam liquido");
assertMoney(
  calculateNetExpensesByCategory(refundedMealTransactions).reduce((total, item) => total + item.amount, 0),
  refundedMealSummary.netExpenses,
  "Total liquido por categoria bate com despesas liquidas sem pendencias",
);

const ifoodOriginalForPair = transaction({
  id: "ifood-reimbursement-original",
  date: "2026-05-10",
  description: "Compra no debito via NuPay - iFood",
  amount: -208.44,
  category: "Alimentacao fora",
  kind: "expense",
  source: "nubank_account",
});
const ifoodRefundForPair = transaction({
  id: "ifood-reimbursement-refund",
  date: "2026-05-10",
  description: "Estorno - Compra no debito via NuPay - iFood",
  amount: 208.44,
  category: "Alimentacao fora",
  kind: "refund",
  source: "nubank_account",
});
const detectedIfoodPair = detectReimbursementPairs([ifoodOriginalForPair, ifoodRefundForPair]);
assert.equal(detectedIfoodPair.matches.length, 1, "Pareamento encontra compra e estorno iFood com valor exato");
assert.equal(
  detectReimbursementPairs([ifoodOriginalForPair, { ...ifoodRefundForPair, id: "wrong-cent-refund", amount: 208.43 }]).matches.length,
  0,
  "Centavo diferente nao cria par automatico",
);
assert.equal(
  detectReimbursementPairs([ifoodOriginalForPair, { ...ifoodRefundForPair, id: "other-category-refund", category: "Mercado" }]).matches.length,
  0,
  "Valor igual com categoria diferente nao cria par automatico",
);
assert.equal(
  detectReimbursementPairs([ifoodOriginalForPair, { ...ifoodRefundForPair, id: "other-source-refund", source: "c6_business" }]).matches.length,
  0,
  "Valor igual com source diferente nao cria par automatico",
);
assert.equal(
  detectReimbursementPairs([ifoodOriginalForPair, { ...ifoodRefundForPair, id: "other-description-refund", description: "Estorno - Compra no debito Mercado" }]).matches.length,
  0,
  "Valor igual sem nucleo de descricao nao cria par automatico",
);
assert.equal(
  detectReimbursementPairs([{ ...ifoodOriginalForPair, id: "future-original", date: "2026-05-12" }, ifoodRefundForPair]).matches.length,
  0,
  "Estorno so pareia com compra anterior ou do mesmo dia",
);
assert.equal(
  detectReimbursementPairs([{ ...ifoodOriginalForPair, id: "far-original", date: "2026-04-01" }, ifoodRefundForPair]).matches.length,
  0,
  "Compra muito distante nao pareia automaticamente",
);
assert.equal(
  detectReimbursementPairs([
    ifoodOriginalForPair,
    { ...ifoodOriginalForPair, id: "ifood-reimbursement-original-2" },
    ifoodRefundForPair,
  ]).ambiguousRefunds.length,
  1,
  "Duas compras fortes de mesmo valor geram ambiguidade",
);
assert.equal(
  detectReimbursementPairs([ifoodOriginalForPair, { ...ifoodRefundForPair, id: "unmatched-refund", amount: 199.99 }]).unmatchedRefunds.length,
  1,
  "Estorno sem par exato fica como candidato nao pareado",
);
transactionService.replaceTransactions([ifoodOriginalForPair, ifoodRefundForPair]);
const appliedIfoodPairs = reimbursementService.applyReimbursementPairs();
const matchedIfoodOriginal = transactionService.getTransactionById(ifoodOriginalForPair.id);
const matchedIfoodRefund = transactionService.getTransactionById(ifoodRefundForPair.id);
assert.equal(appliedIfoodPairs.pairs.length, 1, "Apply persiste par seguro");
assert.equal(matchedIfoodOriginal.reimbursementPairId, matchedIfoodRefund.reimbursementPairId, "Par recebe mesmo reimbursementPairId");
assert.equal(matchedIfoodOriginal.reimbursementRole, "original", "Compra pareada recebe role original");
assert.equal(matchedIfoodRefund.reimbursementRole, "refund", "Estorno pareado recebe role refund");
assert.equal(isMatchedReimbursement(matchedIfoodOriginal), true, "Compra pareada fica marcada para calculos");
assert.equal(isMatchedReimbursement(matchedIfoodRefund), true, "Estorno pareado fica marcado para calculos");
assertMoney(calculateGrossRealExpenses([matchedIfoodOriginal]), 0, "Compra pareada nao entra em despesa bruta");
assertMoney(calculateRealIncome([matchedIfoodRefund]), 0, "Estorno pareado nao entra em receita");
assertMoney(calculateRefundAdjustments([matchedIfoodRefund]), 0, "Estorno pareado nao entra em ajustes de refund");
assertMoney(calculateNetRealExpenses([matchedIfoodOriginal, matchedIfoodRefund]), 0, "Par matched tem impacto liquido zero");
assert.equal(calculateNetExpensesByCategory([matchedIfoodOriginal, matchedIfoodRefund]).length, 0, "Par matched nao entra em gasto por categoria");
assertMoney(
  calculateBudgetUsage(
    { ...budget, id: "ifood-reimbursement-budget", name: "Alimentacao fora", category: "Alimentacao fora", categoryId: "food" },
    [matchedIfoodOriginal, matchedIfoodRefund],
    "2026-05",
  ).spent,
  0,
  "Par matched nao entra no orcamento",
);
assert.equal(
  transactionService.listRequiredReviewTransactions().some((item) => item.reimbursementPairId === matchedIfoodOriginal.reimbursementPairId),
  false,
  "ReviewPage nao recebe reimbursement matched como revisao necessaria",
);
assert.equal(
  financeSummaryService.getMonthlyCategoryComparison("2026-05").some((item) => item.category === "Alimentacao fora"),
  false,
  "Par matched nao entra em comparacao mensal de categoria",
);
assertMoney(financeSummaryService.getFinanceSummary("2026-05").expenses, 0, "Summary mensal ignora par matched");
transactionService.clearTransactions();
commitImportSelection([
  {
    transactionId: ifoodOriginalForPair.id,
    transaction: ifoodOriginalForPair,
    selected: true,
    disabled: false,
    reason: "Compra pronta para commit.",
    duplicateStatus: "unique",
    needsReview: false,
  },
  {
    transactionId: ifoodRefundForPair.id,
    transaction: ifoodRefundForPair,
    selected: true,
    disabled: false,
    reason: "Estorno pronto para commit.",
    duplicateStatus: "unique",
    needsReview: false,
  },
], []);
assert.equal(
  reimbursementService.listReimbursementPairs().length,
  1,
  "Commit de importacao aplica pareamento de reembolso seguro",
);
categoryRuleService.createCategoryRule({
  keyword: "refund regra manual segura",
  category: "Alimentacao fora",
  kind: "refund",
});
assert.notEqual(
  classifyTransactionDraft({
    description: "Refund regra manual segura compra negativa",
    amount: -20,
  }).kind,
  "refund",
  "Regra manual refund nao transforma compra negativa em refund",
);
const ruleRefundCandidate = normalizeTransactionDraft({
  id: "rule-refund-candidate",
  date: "2026-05-11",
  description: "Estorno - refund regra manual segura compra positiva",
  amount: 20,
});
assert.equal(ruleRefundCandidate.kind, "refund", "Regra manual refund em valor positivo continua gerando refund candidato");
assert.equal(
  detectReimbursementPairs([
    transaction({
      id: "rule-refund-original",
      date: "2026-05-11",
      description: "Refund regra manual segura compra positiva",
      amount: -20,
      category: "Alimentacao fora",
      kind: "expense",
      source: "manual",
    }),
    ruleRefundCandidate,
  ]).matches.length,
  1,
  "Regra manual refund positiva pode alimentar par seguro",
);

const preservedManualCategory = normalizeTransactionDraft({
  id: "preserved-manual-category",
  date: "2026-05-16",
  description: "Uber viagem",
  amount: -60,
  category: "Despesa a revisar",
  manualCategory: true,
});
assert.equal(preservedManualCategory.category, "Despesa a revisar", "Categoria manual deve ser preservada no pipeline");
assert.equal(shouldPreserveManualCategory({ ...preservedManualCategory, amount: -60 }), true, "manualCategory true deve sinalizar preservação");

const mercadoPagoNormalized = normalizeTransactionDraft({
  id: "mercado-pago-only",
  date: "2026-05-17",
  description: "Compra no crédito - Mercado Pago",
  amount: -45,
});
assert.notEqual(mercadoPagoNormalized.category, "Mercado", "Mercado Pago sem merchant real não deve virar Mercado no pipeline");

assert.ok(normalizedIncomingPix.classificationReason, "Transação normalizada deve ter classificationReason");
assert.ok(["high", "medium", "low"].includes(normalizedIncomingPix.classificationConfidence), "Transação normalizada deve ter classificationConfidence");

const rawPipelineInputs = [
  { id: "draft-1", date: "2026-05-01", description: "Pagamento de fatura", amount: -500 },
  { id: "draft-2", date: "2026-05-02", description: "Pagamento recebido", amount: 500, method: "fatura", source: "nubank_credit_card" },
  { id: "draft-3", date: "2026-05-03", description: "Compra no crédito - Cinemark", amount: -80 },
  { id: "draft-4", date: "2026-05-04", description: "Transferência recebida pelo Pix - Pessoa Desconhecida", amount: 100, method: "pix" },
  { id: "draft-5", date: "2026-05-05", description: "Mercado manual", amount: -200, category: "Mercado", manualCategory: true },
  { date: "2026-05-06", description: "Transferência enviada pelo Pix - Pessoa Desconhecida", amount: -30, method: "pix" },
];
const normalizedPipeline = normalizeTransactionDrafts(rawPipelineInputs);
assert.equal(normalizedPipeline.length, rawPipelineInputs.length, "normalizeTransactionDrafts deve preservar quantidade de itens");
assert.equal(normalizedPipeline[0].id, "draft-1", "normalizeTransactionDrafts deve preservar ids existentes");
assert.equal(getDefaultScope({ date: "2026-05-01", description: "C6", amount: 100, source: "c6_business" }), "empresa", "getDefaultScope deve reconhecer C6 business");
assert.equal(getDefaultAccountType({ date: "2026-05-01", description: "Cartão", amount: -10, source: "nubank_credit_card" }), "credit_card", "getDefaultAccountType deve reconhecer cartão");
assert.equal(getDefaultMethod({ date: "2026-05-01", description: "Pix enviado", amount: -10 }), "pix", "getDefaultMethod deve inferir pix");
assert.equal(getDefaultSource({ date: "2026-05-01", description: "Manual", amount: -10 }), "manual", "getDefaultSource deve usar manual como padrão");

const preview = importService.previewImportDrafts(rawPipelineInputs);
assert.equal(preview.totalRows, rawPipelineInputs.length, "previewImportDrafts deve retornar totalRows correto");
assert.equal(preview.normalizedTransactions.length, rawPipelineInputs.length, "previewImportDrafts deve retornar normalizados");
assert.equal(preview.needsReviewCount >= 2, true, "previewImportDrafts deve contar pendências de revisão");
assertMoney(preview.incomeReviewTotal, 100, "previewImportDrafts deve somar Entrada a revisar");
assertMoney(preview.expenseReviewTotal, 30, "previewImportDrafts deve somar Despesa a revisar");

const pipelineSummary = calculateFinanceSummary(normalizedPipeline);
assertMoney(pipelineSummary.expenses, 310, "Transações normalizadas devem funcionar com calculateFinanceSummary");
assertMoney(pipelineSummary.income, 0, "card_payment_received não deve inflar receita no fluxo normalizado");
assertMoney(calculateRealExpenses([normalizedCardPayment]), 0, "card_payment não deve inflar despesa no fluxo normalizado");
assertMoney(calculateRealIncome([normalizedCardPaymentReceived]), 0, "card_payment_received não deve inflar receita no fluxo normalizado");

const nubankAccountNegative = mapStructuredRowToDraft({
  date: "2026-05-20",
  description: "Pix enviado para Pessoa Desconhecida",
  value: -42,
  identifier: "nu-account-out",
}, nubankAccountProfile);
assert.equal(nubankAccountNegative.amount, -42, "Nubank Conta: linha negativa deve virar draft de saída");
assert.equal(nubankAccountNegative.source, "nubank_account", "Nubank Conta deve usar source nubank_account");

const nubankAccountPositive = mapStructuredRowToDraft({
  date: "2026-05-21",
  description: "Pix recebido de Pessoa Desconhecida",
  value: 150,
  identifier: "nu-account-in",
}, nubankAccountProfile);
assert.equal(nubankAccountPositive.amount, 150, "Nubank Conta: linha positiva deve virar draft de entrada");

const nubankCreditPurchase = importService.normalizeStructuredImport([
  {
    date: "2026-05-22",
    description: "Compra no crédito - Steam",
    amount: -88,
    identifier: "nu-card-purchase",
  },
], nubankCreditCardProfile)[0];
assert.equal(nubankCreditPurchase.kind, "card_purchase", "Nubank Fatura: compra deve normalizar como card_purchase");

const nubankPaymentReceived = importService.normalizeStructuredImport([
  {
    date: "2026-05-23",
    description: "Pagamento recebido",
    amount: 500,
    identifier: "nu-card-payment-received",
  },
], nubankCreditCardProfile)[0];
assert.equal(nubankPaymentReceived.kind, "card_payment_received", "Nubank Fatura: pagamento recebido deve virar card_payment_received");

const c6Entry = mapStructuredRowToDraft({
  date: "2026-05-24",
  description: "Recebimento cliente",
  entryAmount: 800,
  exitAmount: 0,
  identifier: "c6-entry",
}, c6BusinessProfile);
assert.equal(c6Entry.amount, 800, "C6 Empresa: Entrada(R$) deve virar valor positivo");

const c6Exit = mapStructuredRowToDraft({
  date: "2026-05-25",
  description: "Pix enviado para fornecedor",
  details: "Fornecedor XPTO",
  entryAmount: 0,
  exitAmount: 320,
  identifier: "c6-exit",
}, c6BusinessProfile);
assert.equal(c6Exit.amount, -320, "C6 Empresa: Saída(R$) deve virar valor negativo");
assert.equal(c6Exit.scope, "empresa", "C6 Empresa deve manter scope empresa");
assert.equal(c6Exit.originalDescription, "Pix enviado para fornecedor - Fornecedor XPTO", "Parser deve preservar details/originalDescription");
assert.equal(parseAmountFromStructuredRow({ entryAmount: "R$ 1.234,56" }, c6BusinessProfile), 1234.56, "parseAmountFromStructuredRow deve entender dinheiro brasileiro");

const invalidParse = parseStructuredRows([
  { date: "2026-05-26", amount: -10 },
  { date: "2026-05-27", description: "Válida", amount: -20 },
], nubankAccountProfile);
assert.equal(invalidParse.totalRows, 2, "parseStructuredRows deve preservar totalRows");
assert.equal(invalidParse.drafts.length, 1, "Linha inválida deve gerar erro sem quebrar tudo");
assert.equal(invalidParse.errors.length > 0, true, "Linha inválida deve gerar erro");
assert.equal(validateStructuredRow({ date: "2026-05-28", description: "Ok", amount: 0 }, nubankAccountProfile).warnings.length > 0, true, "Linha zerada deve gerar warning");

const structuredRows = [
  {
    date: "2026-05-29",
    description: "Pix recebido de Pessoa Desconhecida",
    value: 120,
    identifier: "structured-income-review",
  },
  {
    date: "2026-05-30",
    description: "Pix enviado para Pessoa Desconhecida",
    value: -70,
    identifier: "structured-expense-review",
  },
  {
    date: "2026-05-31",
    description: "Pagamento de fatura",
    value: -400,
    identifier: "structured-card-payment",
  },
];
const structuredPreview = importService.previewStructuredImport(structuredRows, nubankAccountProfile);
assert.equal(structuredPreview.totalRows, structuredRows.length, "previewStructuredImport deve preservar totalRows");
assert.equal(structuredPreview.normalizedTransactions.length, structuredRows.length, "previewStructuredImport deve retornar normalizedTransactions");
assert.equal(structuredPreview.needsReviewCount >= 2, true, "previewStructuredImport deve contar pendências");

const structuredSummary = calculateFinanceSummary(structuredPreview.normalizedTransactions);
assertMoney(structuredSummary.expenses, 70, "Fluxo estruturado deve funcionar com calculateFinanceSummary");
assertMoney(calculateRealExpenses(structuredPreview.normalizedTransactions.filter((item) => item.kind === "card_payment")), 0, "Pagamento de fatura estruturado não deve inflar despesa");

const creditCardPreview = importService.previewStructuredImport([
  { date: "2026-06-01", description: "Pagamento recebido", amount: 900, identifier: "structured-payment-received" },
], nubankCreditCardProfile);
assertMoney(calculateRealIncome(creditCardPreview.normalizedTransactions), 0, "Pagamento recebido da fatura estruturado não deve inflar receita");

const unknownC6Transfer = importService.normalizeStructuredImport([
  {
    date: "2026-06-02",
    description: "Pix enviado para Pessoa Desconhecida",
    exitAmount: 250,
    identifier: "unknown-c6-transfer",
  },
], c6BusinessProfile)[0];
assert.notEqual(unknownC6Transfer.kind, "transfer", "Transferência interna não deve ser sugerida sem alta confiança");

assert.equal(detectCsvDelimiter("Data;Valor;Descrição\n2026-05-01;-10;Teste"), ";", "detectCsvDelimiter deve detectar ponto e vírgula");
assert.equal(detectCsvDelimiter("Data,Valor,Descrição\n2026-05-01,-10,Teste"), ",", "detectCsvDelimiter deve detectar vírgula");

const bomCsv = "\uFEFFData;Valor;Descrição\n2026-05-01;-10;Teste";
assert.equal(parseCsv(bomCsv).headers[0], "data", "parseCsv deve ignorar BOM");
assert.deepEqual(parseCsvLine('"Compra, com vírgula",10', ","), ["Compra, com vírgula", "10"], "parseCsvLine deve suportar aspas e vírgula interna");
assert.equal(parseCsv("Data;Valor;Descrição\r\n2026-05-01;-10;Teste").totalRows, 1, "parseCsv deve suportar quebra Windows");
assert.equal(normalizeCsvHeader(" Descrição Ágil "), "descricao agil", "normalizeCsvHeader deve remover acentos e padronizar");
assertMoney(parseBrazilianMoney("R$ 1.234,56"), 1234.56, "parseBrazilianMoney deve converter moeda brasileira");
assertMoney(parseBrazilianMoney("-123,45"), -123.45, "parseBrazilianMoney deve converter negativo brasileiro");
assert.equal(parseCsvToObjects("Data;Valor\n2026-05-01;-1").rows[0].valor, "-1", "parseCsvToObjects deve retornar objetos");

const nubankAccountCsv = "Data;Valor;Identificador;Descrição\n2026-05-01;-42;nu-1;Pix enviado para Pessoa Desconhecida\n2026-05-02;150;nu-2;Pix recebido de Pessoa Desconhecida";
const nubankStructured = parseCsvToStructuredRows(nubankAccountCsv, nubankAccountProfile);
assert.equal(nubankStructured.structuredRows.length, 2, "Nubank Conta CSV simples deve virar structured rows");
assert.equal(nubankStructured.structuredRows[0].amount, "-42", "Nubank Conta CSV deve mapear Valor");
assert.equal(mapCsvRowsToStructuredRows(parseCsv(nubankAccountCsv).rows, nubankAccountProfile)[0].identifier, "nu-1", "Mapper deve mapear Identificador");

const nubankCsvPreview = importService.previewCsvImport(nubankAccountCsv, nubankAccountProfile);
assert.equal(nubankCsvPreview.totalRows, 2, "previewCsvImport deve retornar totalRows correto");
assert.equal(nubankCsvPreview.normalizedTransactions.length, 2, "previewCsvImport deve retornar normalizedTransactions");
assert.equal(nubankCsvPreview.needsReviewCount, 2, "previewCsvImport deve contar pendências");

categoryRuleService.clearCategoryRules();
transactionService.clearTransactions();
const endToEndSantanderCsv = [
  "Data;Valor;Identificador;Descrição",
  "2026-05-21;2450;santander-rule-e2e;Transferência recebida pelo Pix - BERNARDO DOS SANTOS FERREIRA - •••.484.579-•• - BCO SANTANDER",
].join("\n");
const endToEndWithoutSantanderRule = importService.previewCsvImport(endToEndSantanderCsv, nubankAccountProfile);
assert.equal(endToEndWithoutSantanderRule.normalizedTransactions[0].kind, "transfer", "Import preview sem regra Santander/Bernardo continua transfer");
const endToEndSantanderRule = categoryRuleService.createCategoryRule({
  keyword: "BCO SANTANDER",
  category: "Renda",
  kind: "income",
});
assert.equal(endToEndSantanderRule.isActive, true, "Regra Santander/Bernardo criada para import deve vir ativa");
assert.equal(categoryRuleService.listCategoryRules()[0].kind, "income", "Tipo sugerido da regra deve persistir no service");
transactionService.clearTransactions();
assert.equal(categoryRuleService.listCategoryRules().some((rule) => rule.id === endToEndSantanderRule.id), true, "Limpar transacoes nao deve apagar regras manuais");
const endToEndSantanderPreview = importService.previewCsvImport(endToEndSantanderCsv, nubankAccountProfile);
const endToEndSantanderPreviewTransaction = endToEndSantanderPreview.normalizedTransactions[0];
assert.equal(endToEndSantanderPreviewTransaction.category, "Renda", "Import preview com regra BCO SANTANDER deve gerar Renda");
assert.equal(endToEndSantanderPreviewTransaction.kind, "income", "Import preview com regra BCO SANTANDER deve gerar income");
assert.equal(endToEndSantanderPreviewTransaction.needsReview, false, "Import preview com regra Receita nao fica em revisao");
assert.equal(endToEndSantanderPreviewTransaction.manualCategory, true, "Import preview com regra Receita deve marcar manualCategory");
assert.equal(endToEndSantanderPreviewTransaction.classificationConfidence, "high", "Import preview com regra Receita deve ter confidence high");
assert.equal(endToEndSantanderPreviewTransaction.classificationReason.includes("Regra manual"), true, "Import preview deve expor reason de regra manual");
const endToEndSantanderCommit = commitImportSelection(
  getDefaultSelectedImportItems(endToEndSantanderPreview),
  transactionService.listTransactions(),
  nubankAccountProfile.id,
);
const endToEndSavedSantander = transactionService.listTransactions().find((item) => item.id === "santander-rule-e2e");
assert.equal(endToEndSantanderCommit.importedCount, 1, "Commit ponta a ponta Santander deve salvar o preview");
assert.equal(endToEndSavedSantander.category, "Renda", "Commit deve preservar Renda vista no preview");
assert.equal(endToEndSavedSantander.kind, "income", "Commit deve preservar income visto no preview");
assertMoney(calculateFinanceSummary(transactionService.listTransactions()).income, 2450, "Summary apos import completo deve incluir renda Santander");
assert.equal(transactionService.listOptionalCheckTransactions().length, 0, "Renda importada por regra nao entra em conferencia opcional");
assertMoney(calculateInternalTransfers(transactionService.listTransactions()), 0, "Renda importada por regra nao entra em transferencias internas");
categoryRuleService.clearCategoryRules();
categoryRuleService.createCategoryRule({
  keyword: "BERNARDO DOS SANTOS FERREIRA",
  category: "Renda",
  kind: "income",
});
assert.equal(
  importService.previewCsvImport(endToEndSantanderCsv, nubankAccountProfile).normalizedTransactions[0].kind,
  "income",
  "Import preview com regra pelo nome Bernardo deve gerar income",
);
categoryRuleService.clearCategoryRules();

const nubankCreditCsv = "data,descrição,valor\n2026-05-03,Compra no crédito - Steam,-88\n2026-05-04,Pagamento recebido,500";
const nubankCreditPreview = importService.previewCsvImport(nubankCreditCsv, nubankCreditCardProfile);
assert.equal(nubankCreditPreview.normalizedTransactions[0].kind, "card_purchase", "Nubank Fatura CSV deve normalizar compra como card_purchase");
assert.equal(nubankCreditPreview.normalizedTransactions[1].kind, "card_payment_received", "Nubank Fatura CSV deve normalizar pagamento recebido");

const realNubankCreditCsv = [
  "date,title,amount",
  "2026-05-13,Murilio Marin e Cia L,22.18",
  "2026-05-13,Posto Universitario,12.99",
  "2026-05-10,Cinemark Lagesgarden S,2.50",
].join("\n");
const realNubankCreditPreview = importService.previewCsvImport(realNubankCreditCsv, nubankCreditCardProfile);
assert.equal(realNubankCreditPreview.totalRows, 3, "Nubank Fatura date,title,amount deve preservar totalRows");
assert.equal(realNubankCreditPreview.normalizedTransactions.length, 3, "Nubank Fatura date,title,amount deve normalizar linhas");
assert.equal(realNubankCreditPreview.errors.length, 0, "Nubank Fatura date,title,amount nao deve gerar erro");
assert.equal(
  realNubankCreditPreview.normalizedTransactions[0].description.includes("Murilio Marin"),
  true,
  "Nubank Fatura deve mapear title para description",
);
assert.equal(
  realNubankCreditPreview.normalizedTransactions.every((item) => item.kind === "card_purchase"),
  true,
  "Compras reais da fatura Nubank devem virar card_purchase",
);
assert.equal(
  realNubankCreditPreview.normalizedTransactions.every((item) => item.accountName === "Nubank Cartão"),
  true,
  "Compras reais da fatura Nubank devem usar conta Nubank Cartao",
);
assert.equal(
  realNubankCreditPreview.normalizedTransactions.every(
    (item) =>
      item.institution === "Nubank" &&
      item.scope === "pessoal" &&
      item.accountType === "credit_card" &&
      item.method === "credito" &&
      item.source === "nubank_credit_card",
  ),
  true,
  "Compras reais da fatura Nubank devem preservar metadados do perfil",
);
assert.equal(
  realNubankCreditPreview.errors.some((error) => error.includes("Descrição ausente")),
  false,
  "CSV real da fatura Nubank nao deve acusar descricao ausente",
);

const c6Csv = "Resumo qualquer\nOutra linha\nData Lançamento;Data Contábil;Título;Descrição;Entrada(R$);Saída(R$);Saldo do Dia(R$)\n2026-05-05;2026-05-05;Recebimento cliente;Cliente XPTO;R$ 800,00;;R$ 800,00\n2026-05-06;2026-05-06;Pix enviado para fornecedor;Fornecedor XPTO;;R$ 320,00;R$ 480,00";
const c6Structured = parseCsvToStructuredRows(c6Csv, c6BusinessProfile);
assert.equal(c6Structured.totalRows, 2, "C6 CSV deve encontrar header real após linhas iniciais");
assert.equal(c6Structured.structuredRows[0].entryAmount, "R$ 800,00", "C6 Entrada(R$) deve mapear entryAmount");
assert.equal(c6Structured.structuredRows[1].exitAmount, "R$ 320,00", "C6 Saída(R$) deve mapear exitAmount");
const c6Preview = importService.previewCsvImport(c6Csv, c6BusinessProfile);
assertMoney(c6Preview.normalizedTransactions[0].amount, 800, "C6 Entrada(R$) deve virar valor positivo no preview CSV");
assertMoney(c6Preview.normalizedTransactions[1].amount, -320, "C6 Saída(R$) deve virar valor negativo no preview CSV");

const invalidCsv = "Data;Valor\n2026-05-01;-10";
const invalidPreview = importService.previewCsvImport(invalidCsv, nubankAccountProfile);
assert.equal(invalidPreview.errors.length > 0 || invalidPreview.warnings.length > 0, true, "CSV inválido deve gerar erro ou warning sem quebrar tudo");

const csvFlow = [
  "Data;Valor;Descrição",
  "2026-05-07;-70;Pix enviado para Pessoa Desconhecida",
  "2026-05-08;-400;Pagamento de fatura",
].join("\n");
const csvFlowPreview = importService.previewCsvImport(csvFlow, nubankAccountProfile);
const csvFlowSummary = calculateFinanceSummary(csvFlowPreview.normalizedTransactions);
assertMoney(csvFlowSummary.expenses, 70, "Fluxo CSV -> normalizado -> cálculo deve funcionar");
assertMoney(calculateRealExpenses(csvFlowPreview.normalizedTransactions.filter((item) => item.kind === "card_payment")), 0, "Pagamento de fatura CSV não deve inflar despesa");
assertMoney(calculateRealIncome(nubankCreditPreview.normalizedTransactions.filter((item) => item.kind === "card_payment_received")), 0, "Pagamento recebido da fatura CSV não deve inflar receita");

const existingMarketTransaction = transaction({
  id: "existing-market",
  date: "2026-07-01",
  description: "Mercado Central",
  amount: -120,
  category: "Mercado",
  accountId: "nubank-conta",
  accountName: "Nubank Conta",
  institution: "Nubank",
  scope: "pessoal",
  accountType: "checking",
  source: "nubank_account",
  kind: "expense",
  manualCategory: true,
});
const importedMarketTransaction = normalizeTransactionDraft({
  id: "imported-market",
  date: "2026-07-01",
  description: "Mercado Central",
  amount: -120,
  category: "Mercado",
  accountName: "Nubank Conta",
  institution: "Nubank",
  source: "nubank_account",
  manualCategory: true,
});
assert.equal(
  createTransactionFingerprint(existingMarketTransaction),
  createTransactionFingerprint(existingMarketTransaction),
  "createTransactionFingerprint deve gerar fingerprint estável",
);
assert.equal(
  createImportFingerprint(importedMarketTransaction),
  createImportFingerprint(importedMarketTransaction),
  "createImportFingerprint deve gerar fingerprint estável",
);
assert.equal(
  findExactDuplicate(importedMarketTransaction, [existingMarketTransaction])?.id,
  "existing-market",
  "Duas transações idênticas devem ser exact_duplicate",
);

const differentDescriptionSameDateAmount = normalizeTransactionDraft({
  id: "different-description",
  date: "2026-07-01",
  description: "Farmácia Central",
  amount: -120,
  accountName: "Nubank Conta",
  institution: "Nubank",
  source: "nubank_account",
});
assert.equal(
  findExactDuplicate(differentDescriptionSameDateAmount, [existingMarketTransaction]),
  null,
  "Mesma data e valor, com descrições diferentes, não deve ser exact_duplicate",
);

const differentDateSameValue = normalizeTransactionDraft({
  id: "different-date",
  date: "2026-07-05",
  description: "Mercado Central",
  amount: -120,
  accountName: "Nubank Conta",
  institution: "Nubank",
  source: "nubank_account",
});
assert.equal(
  findExactDuplicate(differentDateSameValue, [existingMarketTransaction]),
  null,
  "Mesmo valor em data diferente não deve ser duplicata exata",
);

const similarDescriptionCloseDate = normalizeTransactionDraft({
  id: "similar-description",
  date: "2026-07-02",
  description: "Mercado Central Loja 01",
  amount: -120,
  accountName: "Nubank Conta",
  institution: "Nubank",
  source: "nubank_account",
});
assert.equal(
  findPossibleDuplicate(similarDescriptionCloseDate, [existingMarketTransaction])?.id,
  "existing-market",
  "Mesma data próxima, valor e descrição parecida deve virar possible_duplicate",
);

const existingCardTransaction = transaction({
  id: "existing-card",
  date: "2026-07-01",
  description: "Mercado Central",
  amount: -120,
  category: "Mercado",
  accountId: "nubank-cartao",
  accountName: "Nubank Cartão",
  institution: "Nubank",
  scope: "pessoal",
  accountType: "credit_card",
  source: "nubank_credit_card",
  method: "credito",
  kind: "card_purchase",
});
assert.equal(
  findExactDuplicate(importedMarketTransaction, [existingCardTransaction]),
  null,
  "Nubank Conta e Nubank Cartão não devem virar duplicata exata sem motivo forte",
);

const existingBusinessTransaction = transaction({
  id: "existing-business",
  date: "2026-07-01",
  description: "Mercado Central",
  amount: -120,
  category: "Mercado",
  accountId: "c6-empresa",
  accountName: "C6 Empresa",
  institution: "C6 Bank",
  scope: "empresa",
  accountType: "business_checking",
  source: "c6_business",
  kind: "expense",
});
assert.equal(
  findExactDuplicate(importedMarketTransaction, [existingBusinessTransaction]),
  null,
  "C6 Empresa e Nubank pessoal não devem virar duplicata exata",
);

const importedCardPaymentSameAmount = normalizeTransactionDraft({
  id: "imported-card-payment-same-amount",
  date: "2026-07-01",
  description: "Pagamento de fatura",
  amount: -120,
  accountName: "Nubank Conta",
  institution: "Nubank",
  source: "nubank_account",
});
assert.equal(
  findExactDuplicate(importedCardPaymentSameAmount, [existingCardTransaction]),
  null,
  "Pagamento de fatura e compra no cartão não devem duplicar só por valor",
);

const duplicateResults = markDuplicateStatus([importedMarketTransaction, similarDescriptionCloseDate], [existingMarketTransaction]);
assert.equal(duplicateResults[0].duplicateStatus, "exact_duplicate", "markDuplicateStatus deve marcar duplicata exata");
assert.equal(duplicateResults[1].duplicateStatus, "possible_duplicate", "markDuplicateStatus deve marcar possível duplicata");
assert.equal(duplicateResults[1].reason.length > 0, true, "Possíveis duplicatas devem trazer reason");
assert.equal(["high", "medium", "low"].includes(duplicateResults[1].confidence), true, "Possíveis duplicatas devem trazer confidence");

const deduplicatedPreview = deduplicateImportPreview([importedMarketTransaction, similarDescriptionCloseDate], [existingMarketTransaction]);
assert.equal(deduplicatedPreview.exactDuplicateCount, 1, "deduplicateImportPreview deve contar exatas");
assert.equal(deduplicatedPreview.possibleDuplicateCount, 1, "deduplicateImportPreview deve contar possíveis");
assert.equal(deduplicatedPreview.uniqueCount, 0, "deduplicateImportPreview deve contar únicas");
assert.equal(deduplicatedPreview.normalizedTransactions.length, 2, "Deduplicação não deve remover transações");
assert.equal(deduplicatedPreview.normalizedTransactions[0].kind, importedMarketTransaction.kind, "Deduplicação deve preservar kind");
assert.equal(deduplicatedPreview.normalizedTransactions[0].category, importedMarketTransaction.category, "Deduplicação deve preservar category");
assert.equal(deduplicatedPreview.normalizedTransactions[0].manualCategory, importedMarketTransaction.manualCategory, "Deduplicação deve preservar manualCategory");

const dedupCsv = "Data;Valor;Identificador;Descrição\n2026-07-01;-120;dedup-1;Mercado Central\n2026-07-02;-120;dedup-2;Mercado Central Loja 01\n2026-07-03;-80;dedup-3;Padaria Nova";
const dedupCsvPreview = importService.previewCsvImport(dedupCsv, nubankAccountProfile, {}, [existingMarketTransaction]);
assert.equal(dedupCsvPreview.exactDuplicateCount, 1, "previewCsvImport com existingTransactions deve contar duplicatas exatas");
assert.equal(dedupCsvPreview.possibleDuplicateCount, 1, "previewCsvImport com existingTransactions deve contar possíveis duplicatas");
assert.equal(dedupCsvPreview.uniqueCount, 1, "Transações únicas devem continuar unique");
assert.equal(dedupCsvPreview.duplicateResults.length, 3, "Preview deve retornar resultados de duplicidade");

const noDedupCsvPreview = importService.previewCsvImport(dedupCsv, nubankAccountProfile);
assert.equal(noDedupCsvPreview.normalizedTransactions.length, 3, "previewCsvImport sem existingTransactions deve continuar funcionando");
assert.equal(noDedupCsvPreview.duplicateResults, undefined, "preview sem existingTransactions não precisa trazer dados de duplicidade");

transactionService.clearTransactions();
assert.deepEqual(transactionService.listTransactions(), [], "transactionService vazio deve retornar [] sem storage");

const serviceImportOnly = normalizeTransactionDraft({
  id: "service-import-only",
  date: "2026-07-10",
  description: "Padaria service import",
  amount: -18,
});
transactionService.addTransactions([serviceImportOnly]);
assert.equal(transactionService.listTransactions().length, 1, "addTransactions nao deve adicionar mocks automaticamente");
assert.equal(transactionService.listTransactions()[0].id, "service-import-only", "addTransactions deve salvar apenas o lote recebido");
transactionService.clearTransactions();
assert.deepEqual(transactionService.listTransactions(), [], "clearTransactions deve limpar transacoes adicionadas");

const dedupSelection = getDefaultSelectedImportItems(dedupCsvPreview);
const exactSelection = dedupSelection.find((item) => item.duplicateStatus === "exact_duplicate");
const possibleSelection = dedupSelection.find((item) => item.duplicateStatus === "possible_duplicate");
const uniqueSelection = dedupSelection.find((item) => item.duplicateStatus === "unique");
assert.equal(uniqueSelection.selected, true, "Transacao unique deve vir selecionada por padrao");
assert.equal(exactSelection.selected, false, "Duplicata exata deve vir desmarcada por padrao");
assert.equal(exactSelection.disabled, true, "Duplicata exata deve vir bloqueada");
assert.equal(possibleSelection.selected, false, "Possivel duplicata deve vir desmarcada por padrao");
assert.equal(prepareImportCommit(dedupCsvPreview).selection.length, 3, "prepareImportCommit deve preparar a selecao do preview");

transactionService.replaceTransactions([existingMarketTransaction]);
const dedupCommit = commitImportSelection(dedupSelection, transactionService.listTransactions(), nubankAccountProfile.id);
assert.equal(dedupCommit.importedCount, 1, "Commit deve salvar somente itens selecionados");
assert.equal(dedupCommit.skippedCount, 2, "Commit deve contar itens pulados");
assert.equal(dedupCommit.exactDuplicateSkippedCount, 1, "Commit nao deve salvar duplicata exata bloqueada");
assert.equal(dedupCommit.possibleDuplicateSkippedCount, 1, "Commit nao deve salvar possivel duplicata desmarcada");
assert.equal(dedupCommit.batchId.length > 0, true, "Commit deve gerar batchId");
assert.equal(dedupCommit.importedAt.length > 0, true, "Commit deve gerar importedAt");
assert.equal(
  transactionService.listTransactions().some((item) => item.id === uniqueSelection.transactionId),
  true,
  "transactionService deve listar transacoes importadas depois do commit",
);

const needsReviewCommitPreview = importService.previewImportDrafts([
  {
    id: "review-commit",
    date: "2026-08-01",
    description: "Pix recebido de Pessoa Desconhecida",
    amount: 240,
    method: "pix",
  },
]);
const needsReviewCommit = commitImportSelection(
  getDefaultSelectedImportItems(needsReviewCommitPreview),
  transactionService.listTransactions(),
  nubankAccountProfile.id,
);
assert.equal(needsReviewCommit.reviewCount, 1, "Pendencia de revisao pode ser salva");
assert.equal(needsReviewCommit.importedTransactions[0].needsReview, true, "Commit deve preservar needsReview");
const savedNeedsReview = transactionService.listTransactions().find((item) => item.id === "review-commit");
assert.equal(savedNeedsReview.needsReview, true, "Transacao importada salva deve preservar needsReview");
assert.equal(
  savedNeedsReview.classificationConfidence,
  needsReviewCommit.importedTransactions[0].classificationConfidence,
  "Transacao importada salva deve preservar classificationConfidence",
);
assert.equal(
  savedNeedsReview.classificationReason,
  needsReviewCommit.importedTransactions[0].classificationReason,
  "Transacao importada salva deve preservar classificationReason",
);

const protectedCommitPreview = importService.previewImportDrafts([
  {
    id: "protected-commit",
    date: "2026-08-02",
    description: "Mercado manual protegido",
    amount: -80,
    category: "Mercado",
    manualCategory: true,
  },
]);
const protectedSelection = getDefaultSelectedImportItems(protectedCommitPreview);
const protectedBeforeCommit = protectedSelection[0].transaction;
const protectedCommit = commitImportSelection(protectedSelection, transactionService.listTransactions());
const protectedImported = protectedCommit.importedTransactions[0];
assert.equal(protectedImported.kind, protectedBeforeCommit.kind, "Commit deve preservar kind");
assert.equal(protectedImported.category, protectedBeforeCommit.category, "Commit deve preservar category");
assert.equal(protectedImported.manualCategory, protectedBeforeCommit.manualCategory, "Commit deve preservar manualCategory");
assert.equal(protectedImported.classificationReason, protectedBeforeCommit.classificationReason, "Commit deve preservar classificationReason");
assert.equal(protectedImported.classificationConfidence, protectedBeforeCommit.classificationConfidence, "Commit deve preservar classificationConfidence");

const manualBatch = createImportBatchMetadata({
  profileId: c6BusinessProfile.id,
  totalRows: 4,
  importedCount: 2,
  skippedCount: 2,
  importedAt: createdAt,
});
assert.equal(manualBatch.importedAt, createdAt, "createImportBatchMetadata deve preservar importedAt informado");
assert.equal(manualBatch.profileId, c6BusinessProfile.id, "createImportBatchMetadata deve registrar profileId");

const editableTransaction = normalizeTransactionDraft({
  id: "editable-transaction",
  date: "2026-08-05",
  description: "Pix enviado para Pessoa Desconhecida",
  amount: -64,
  accountName: "Nubank Conta",
  accountType: "checking",
  source: "nubank_account",
  method: "pix",
});
transactionService.replaceTransactions([editableTransaction]);
const noteUpdatedTransaction = transactionService.updateTransaction(editableTransaction.id, { notes: "Revisar comprovante." });
assert.equal(noteUpdatedTransaction.notes, "Revisar comprovante.", "updateTransaction deve alterar campo enviado");
assert.equal(noteUpdatedTransaction.category, editableTransaction.category, "updateTransaction deve preservar campos nao enviados");
assert.equal(noteUpdatedTransaction.amount, editableTransaction.amount, "Edicao deve preservar amount");
assert.equal(noteUpdatedTransaction.date, editableTransaction.date, "Edicao deve preservar date");
assert.equal(noteUpdatedTransaction.source, editableTransaction.source, "Edicao deve preservar source");
assert.equal(noteUpdatedTransaction.accountType, editableTransaction.accountType, "Edicao deve preservar accountType");

const categoryUpdatedTransaction = transactionService.updateTransactionCategory(editableTransaction.id, "Transporte");
assert.equal(categoryUpdatedTransaction.category, "Transporte", "updateTransactionCategory deve atualizar categoria");
assert.equal(categoryUpdatedTransaction.manualCategory, true, "updateTransactionCategory deve definir manualCategory true");
const expenseBeforeNeutralCorrection = calculateRealExpenses(transactionService.listTransactions());
const categoryUpdatedTransfer = transactionService.updateTransactionCategory(editableTransaction.id, "Transferência interna");
assert.equal(categoryUpdatedTransfer.kind, "transfer", "updateTransactionCategory para Transferencia interna deve inferir transfer");
assert.equal(categoryUpdatedTransfer.needsReview, false, "Transferencia interna manual deve sair da revisao");
assertMoney(calculateRealExpenses(transactionService.listTransactions()), 0, "Mudar despesa para Transferencia interna deve reduzir despesas reais");
assert.equal(expenseBeforeNeutralCorrection > calculateRealExpenses(transactionService.listTransactions()), true, "Correcao para Transferencia interna reduz gastos");
assertMoney(calculateFinanceSummary(transactionService.listTransactions()).expenses, 0, "Resumo deve reduzir despesas apos correcao para Transferencia interna");
assert.equal(
  transactionService.updateTransactionCategory(editableTransaction.id, "Pagamento de fatura").kind,
  "card_payment",
  "updateTransactionCategory para Pagamento de fatura deve inferir card_payment",
);
assert.equal(
  transactionService.updateTransactionCategory(editableTransaction.id, "Pagamento recebido da fatura").kind,
  "card_payment_received",
  "updateTransactionCategory para Pagamento recebido da fatura deve inferir card_payment_received",
);
assert.equal(
  transactionService.updateTransactionCategory(editableTransaction.id, "Renda").kind,
  "income",
  "updateTransactionCategory para Renda deve inferir income",
);

transactionService.replaceTransactions([editableTransaction]);
assert.equal(
  transactionService.reviewTransaction(editableTransaction.id, { category: "Transferência interna" }).kind,
  "transfer",
  "reviewTransaction com categoria Transferencia interna sem kind explicito deve inferir transfer",
);
const categoryIncomeReview = normalizeTransactionDraft({
  id: "category-income-review",
  date: "2026-08-05",
  description: "Pix recebido para corrigir renda",
  amount: 640,
  method: "pix",
});
transactionService.replaceTransactions([categoryIncomeReview]);
assert.equal(
  transactionService.reviewTransaction(categoryIncomeReview.id, { category: "Renda" }).kind,
  "income",
  "reviewTransaction com categoria Renda sem kind explicito deve inferir income",
);
transactionService.replaceTransactions([normalizedCreditPurchase]);
assert.equal(
  transactionService.updateTransactionCategory(normalizedCreditPurchase.id, "Transporte").kind,
  "card_purchase",
  "Compra no cartao deve preservar card_purchase ao trocar apenas categoria comum",
);

transactionService.replaceTransactions([editableTransaction]);
const reviewedTransaction = transactionService.markTransactionReviewed(editableTransaction.id);
assert.equal(reviewedTransaction.needsReview, false, "markTransactionReviewed deve definir needsReview false");
assert.ok(reviewedTransaction.reviewedAt, "markTransactionReviewed deve registrar reviewedAt");
assert.equal(reviewedTransaction.reviewedBy, "mark_reviewed", "markTransactionReviewed deve registrar reviewedBy");

const refundReviewTransaction = transaction({
  id: "refund-review-transaction",
  date: "2026-08-05",
  description: "Estorno - Compra no debito via NuPay - iFood",
  amount: 208.44,
  category: "Despesa a revisar",
  kind: "expense",
  needsReview: true,
  classificationConfidence: "low",
});
transactionService.replaceTransactions([refundReviewTransaction]);
const reviewedRefund = transactionService.reviewTransaction(refundReviewTransaction.id, {
  category: "Alimentacao fora",
  needsReview: false,
});
assert.equal(reviewedRefund.kind, "refund", "Revisao de estorno positivo com categoria comum deve inferir refund");
assert.ok(reviewedRefund.reviewedAt, "reviewTransaction concluida deve registrar reviewedAt");
const reviewedRefundWithOldKind = transactionService.reviewTransaction(refundReviewTransaction.id, {
  kind: "expense",
  needsReview: false,
});
assert.equal(reviewedRefundWithOldKind.kind, "refund", "Revisao nao deve manter expense em estorno claramente positivo");

const savedIncomeReview = normalizeTransactionDraft({
  id: "saved-income-review",
  date: "2026-08-06",
  description: "Pix recebido de Pessoa Desconhecida",
  amount: 410,
  method: "pix",
});
transactionService.replaceTransactions([savedIncomeReview]);
assert.equal(transactionService.listTransactions()[0].needsReview, true, "Entrada a revisar deve continuar pendente ate revisao");
const reviewedIncomeReview = transactionService.markTransactionReviewed(savedIncomeReview.id);
assert.equal(reviewedIncomeReview.needsReview, false, "Revisao simples deve limpar pendencia");
assert.equal(reviewedIncomeReview.category, "Entrada a revisar", "Revisao simples nao deve trocar categoria automaticamente");
assertMoney(calculateRealIncome([reviewedIncomeReview]), 0, "Revisar Entrada a revisar nao deve criar receita real automaticamente");

transactionService.replaceTransactions([manualIncome, normalizedCreditPurchase, normalizedCardPayment]);
const savedSummary = calculateFinanceSummary(transactionService.listTransactions());
assertMoney(savedSummary.income, 1500, "Resumo com transacoes salvas deve calcular receita real");
assertMoney(savedSummary.expenses, 120, "Resumo com transacoes salvas deve calcular despesas reais");
assert.equal(savedSummary.transactionCount, 3, "Resumo com transacoes salvas deve usar dados do transactionService");

const pendingIncomeReviewForQueue = normalizeTransactionDraft({
  id: "queue-income-review",
  date: "2026-08-10",
  description: "Pix recebido de Pessoa Desconhecida",
  amount: 330,
  method: "pix",
  accountId: "nubank-conta",
  accountName: "Nubank Conta",
  source: "nubank_account",
});
const pendingExpenseReviewForQueue = normalizeTransactionDraft({
  id: "queue-expense-review",
  date: "2026-08-11",
  description: "Pix enviado para Pessoa Desconhecida",
  amount: -98,
  method: "pix",
  accountId: "nubank-conta",
  accountName: "Nubank Conta",
  source: "nubank_account",
});
const neutralTransferForQueue = transaction({
  id: "queue-transfer",
  date: "2026-08-12",
  description: "Transferencia propria confirmada",
  amount: -450,
  category: "Transferência interna",
  accountId: "nubank-conta",
  accountName: "Nubank Conta",
  institution: "Nubank",
  accountType: "checking",
  source: "nubank_account",
  kind: "transfer",
});
const neutralCardPaymentForQueue = transaction({
  id: "queue-card-payment",
  date: "2026-08-13",
  description: "Pagamento de fatura",
  amount: -600,
  category: "Pagamento de fatura",
  accountId: "nubank-conta",
  accountName: "Nubank Conta",
  institution: "Nubank",
  source: "nubank_account",
  method: "fatura",
  kind: "card_payment",
});
const neutralCardPaymentReceivedForQueue = transaction({
  id: "queue-card-payment-received",
  date: "2026-08-14",
  description: "Pagamento recebido",
  amount: 600,
  category: "Pagamento recebido da fatura",
  accountId: "nubank-cartao",
  accountName: "Nubank Cartão",
  institution: "Nubank",
  accountType: "credit_card",
  source: "nubank_credit_card",
  method: "fatura",
  kind: "card_payment_received",
});
transactionService.replaceTransactions([
  pendingIncomeReviewForQueue,
  pendingExpenseReviewForQueue,
  neutralTransferForQueue,
  neutralCardPaymentForQueue,
  neutralCardPaymentReceivedForQueue,
]);
const pendingQueue = transactionService.listPendingReviewTransactions();
assert.equal(pendingQueue.some((item) => item.id === pendingIncomeReviewForQueue.id && item.needsReview), true, "Fila pendente deve trazer needsReview true");
assert.equal(pendingQueue.some((item) => item.category === "Entrada a revisar"), true, "Fila pendente deve incluir Entrada a revisar");
assert.equal(pendingQueue.some((item) => item.category === "Despesa a revisar"), true, "Fila pendente deve incluir Despesa a revisar");
assert.equal(transactionService.listReviewableTransactions().some((item) => item.id === pendingExpenseReviewForQueue.id), true, "Reviewable deve incluir pendencias");
assert.equal(transactionService.listReviewableTransactions().some((item) => item.id === neutralTransferForQueue.id), true, "Reviewable deve incluir neutros");
const neutralQueue = transactionService.listNeutralTransactions();
assert.equal(neutralQueue.some((item) => item.id === neutralTransferForQueue.id), true, "Neutros devem incluir transferencia interna");
assert.equal(neutralQueue.some((item) => item.id === neutralCardPaymentForQueue.id), true, "Neutros devem incluir card_payment");
assert.equal(neutralQueue.some((item) => item.id === neutralCardPaymentReceivedForQueue.id), true, "Neutros devem incluir card_payment_received");

const highConfidenceNeutralTransfer = { ...neutralTransferForQueue, needsReview: false, classificationConfidence: "high" };
const highConfidenceCardPayment = { ...neutralCardPaymentForQueue, needsReview: false, classificationConfidence: "high" };
const highConfidenceCardPaymentReceived = { ...neutralCardPaymentReceivedForQueue, needsReview: false, classificationConfidence: "high" };
const lowConfidenceNeutralTransfer = { ...neutralTransferForQueue, id: "queue-transfer-low", needsReview: false, classificationConfidence: "low" };
transactionService.replaceTransactions([
  pendingIncomeReviewForQueue,
  pendingExpenseReviewForQueue,
  highConfidenceNeutralTransfer,
  highConfidenceCardPayment,
  highConfidenceCardPaymentReceived,
  lowConfidenceNeutralTransfer,
]);
const requiredQueue = transactionService.listRequiredReviewTransactions();
const optionalQueue = transactionService.listOptionalCheckTransactions();
assert.equal(requiredQueue.some((item) => item.id === highConfidenceNeutralTransfer.id), false, "Transferencia neutra high confidence nao entra em revisao necessaria");
assert.equal(optionalQueue.some((item) => item.id === highConfidenceNeutralTransfer.id), true, "Transferencia neutra high confidence entra em conferencia opcional");
assert.equal(requiredQueue.some((item) => item.id === highConfidenceCardPayment.id), false, "card_payment sem needsReview nao entra em revisao necessaria");
assert.equal(requiredQueue.some((item) => item.id === highConfidenceCardPaymentReceived.id), false, "card_payment_received sem needsReview nao entra em revisao necessaria");
assert.equal(requiredQueue.some((item) => item.category === "Entrada a revisar"), true, "Entrada a revisar entra em revisao necessaria");
assert.equal(requiredQueue.some((item) => item.category === "Despesa a revisar"), true, "Despesa a revisar entra em revisao necessaria");
assert.equal(requiredQueue.some((item) => item.needsReview), true, "needsReview true entra em revisao necessaria");
assert.equal(requiredQueue.some((item) => item.id === lowConfidenceNeutralTransfer.id), true, "Baixa confianca entra em revisao necessaria");
assert.equal(transactionService.listPendingReviewTransactions().length, requiredQueue.length, "Compatibilidade de pendencias deve apontar para revisao necessaria");
assert.equal(
  transactionService.listReviewableTransactions().filter((item) => item.id === highConfidenceNeutralTransfer.id).length,
  1,
  "Reviewable pode abrir neutro opcional sem duplica-lo como pendencia obrigatoria",
);
transactionService.reviewTransaction(lowConfidenceNeutralTransfer.id, { needsReview: false });
assert.equal(
  transactionService.listRequiredReviewTransactions().some((item) => item.id === lowConfidenceNeutralTransfer.id),
  false,
  "Baixa confianca revisada com reviewedAt nao deve voltar para revisao necessaria",
);
transactionService.markTransactionReviewed(highConfidenceNeutralTransfer.id);
transactionService.markTransactionReviewed(highConfidenceCardPayment.id);
assert.equal(
  transactionService.listOptionalCheckTransactions().some((item) => item.id === highConfidenceNeutralTransfer.id),
  false,
  "Transferencia neutra revisada nao deve voltar para conferencia opcional",
);
assert.equal(
  transactionService.listOptionalCheckTransactions().some((item) => item.id === highConfidenceCardPayment.id),
  false,
  "Pagamento de fatura revisado nao deve voltar para conferencia opcional",
);
assert.equal(
  transactionService.listOptionalCheckTransactions().some((item) => item.id === highConfidenceCardPaymentReceived.id),
  true,
  "Neutro ainda nao revisado continua na conferencia opcional",
);
transactionService.markTransactionReviewed(highConfidenceCardPaymentReceived.id);
assert.equal(
  transactionService.listOptionalCheckTransactions().some((item) => item.id === highConfidenceCardPaymentReceived.id),
  false,
  "Pagamento recebido da fatura revisado nao deve voltar para conferencia opcional",
);
transactionService.reviewTransaction(lowConfidenceNeutralTransfer.id, { needsReview: true });
assert.equal(
  transactionService.listRequiredReviewTransactions().some((item) => item.id === lowConfidenceNeutralTransfer.id),
  true,
  "reviewTransaction com needsReview true deve manter item pendente",
);

const neutralPreview = importService.previewImportDrafts([
  { id: "preview-card-payment-neutral", date: "2026-08-15", description: "Pagamento de fatura", amount: -600, method: "fatura" },
]);
assert.equal(neutralPreview.needsReviewCount, 0, "Preview A revisar nao conta neutro high confidence");

const manualQueueReview = transactionService.reviewTransaction(pendingExpenseReviewForQueue.id, { category: "Transporte" });
assert.equal(manualQueueReview.manualCategory, true, "reviewTransaction com categoria manual deve proteger categoria");
assert.equal(transactionService.markTransactionReviewed(pendingExpenseReviewForQueue.id).needsReview, false, "Fila deve permitir marcar revisada");

const reviewedQueueIncome = transactionService.reviewTransaction(pendingIncomeReviewForQueue.id, { needsReview: false });
assertMoney(calculateRealIncome([reviewedQueueIncome]), 0, "Revisar Entrada a revisar sem mudar kind nao cria receita real");
const incomeCorrection = transactionService.reviewTransaction(pendingIncomeReviewForQueue.id, {
  category: "Renda",
  kind: "income",
  needsReview: false,
});
assert.equal(incomeCorrection.category, "Renda", "Escolher Renda deve corrigir categoria");
assert.equal(incomeCorrection.kind, "income", "Escolher Renda deve corrigir kind");

const expenseCorrection = transactionService.reviewTransaction(pendingExpenseReviewForQueue.id, {
  category: "Outros",
  kind: "expense",
  needsReview: false,
});
assert.equal(expenseCorrection.kind, "expense", "Escolher Despesa deve corrigir kind");

const transferCorrection = transactionService.reviewTransaction(pendingExpenseReviewForQueue.id, {
  category: "Transferência interna",
  kind: "transfer",
  needsReview: false,
});
assert.equal(transferCorrection.kind, "transfer", "Escolher Transferencia interna deve corrigir kind");
assert.equal(transferCorrection.category, "Transferência interna", "Confirmar Transferencia interna deve manter categoria");
assertMoney(calculateRealIncome([transferCorrection]), 0, "Transferencia interna nao entra em receita real");
assertMoney(calculateRealExpenses([transferCorrection]), 0, "Transferencia interna nao entra em despesa real");
const inconsistentTransferExpense = transaction({
  id: "legacy-transfer-expense-kind",
  date: "2026-08-12",
  description: "Transferencia antiga com tipo inconsistente",
  amount: -450,
  category: "Transferência interna",
  kind: "expense",
});
assertMoney(calculateRealExpenses([inconsistentTransferExpense]), 0, "Categoria Transferencia interna com kind expense antigo nao entra em despesa real");
assert.equal(calculateExpensesByCategory([inconsistentTransferExpense])["Transferência interna"], undefined, "Gastos por categoria nao incluem Transferencia interna");
assertMoney(
  calculateBudgetUsage(
    {
      ...budget,
      id: "budget-transfer-neutral",
      name: "Transferencia interna",
      category: "Transferência interna",
      categories: ["Transferência interna"],
      limit: 1000,
    },
    [inconsistentTransferExpense],
    new Date("2026-08-21T00:00:00.000Z"),
  ).spent,
  0,
  "Orcamento nao conta Transferencia interna inconsistente",
);

const transferToExpense = transactionService.reviewTransaction(neutralTransferForQueue.id, {
  category: "Outros",
  kind: "expense",
  needsReview: false,
});
assert.equal(transferToExpense.kind, "expense", "Transferencia corrigida para despesa deve mudar kind");
assert.equal(transferToExpense.manualCategory, true, "Transferencia corrigida para despesa deve proteger categoria");
const transferToIncome = transactionService.reviewTransaction(neutralTransferForQueue.id, {
  category: "Renda",
  kind: "income",
  needsReview: false,
});
assert.equal(transferToIncome.kind, "income", "Transferencia corrigida para renda deve mudar kind");
assert.equal(transferToIncome.manualCategory, true, "Transferencia corrigida para renda deve proteger categoria");

const preservedQueueReview = transactionService.reviewTransaction(pendingIncomeReviewForQueue.id, { notes: "Conferido na fila." });
assert.equal(preservedQueueReview.amount, incomeCorrection.amount, "Revisao deve preservar amount");
assert.equal(preservedQueueReview.date, incomeCorrection.date, "Revisao deve preservar date");
assert.equal(preservedQueueReview.source, incomeCorrection.source, "Revisao deve preservar source");
assert.equal(preservedQueueReview.accountType, incomeCorrection.accountType, "Revisao deve preservar accountType");
assert.equal(preservedQueueReview.accountId, incomeCorrection.accountId, "Revisao deve preservar accountId");
assertMoney(calculateRealExpenses([neutralCardPaymentForQueue]), 0, "card_payment da fila nao deve inflar despesa");
assertMoney(calculateRealIncome([neutralCardPaymentReceivedForQueue]), 0, "card_payment_received da fila nao deve inflar receita");

categoryRuleService.clearCategoryRules();
const importedBernardoWithoutRule = normalizeTransactionDraft({
  id: "apply-rule-imported-transfer-without-rule",
  date: "2026-08-19",
  description: "Transferencia recebida pelo Pix - BERNARDO DOS SANTOS FERREIRA BCO SANTANDER",
  amount: 1800,
  method: "pix",
  source: "nubank_account",
});
assert.equal(importedBernardoWithoutRule.kind, "transfer", "Nova importacao sem regra Santander/Bernardo continua transfer");
const pendingBernardoRuleTarget = transaction({
  id: "apply-rule-bernardo-income",
  date: "2026-08-20",
  description: "Transferencia recebida pelo Pix - BERNARDO DOS SANTOS FERREIRA BCO SANTANDER",
  amount: 2400,
  category: "Entrada a revisar",
  kind: "review",
  needsReview: true,
  classificationConfidence: "low",
});
const pendingExpenseRuleTarget = transaction({
  id: "apply-rule-expense",
  date: "2026-08-21",
  description: "Compra Taxi Regra Pendencia",
  amount: -46,
  category: "Despesa a revisar",
  kind: "expense",
  needsReview: true,
  classificationConfidence: "low",
});
const pendingTransferRuleTarget = transaction({
  id: "apply-rule-transfer",
  date: "2026-08-22",
  description: "Ajuste Conta Propria Regra Pendencia",
  amount: -120,
  category: "Despesa a revisar",
  kind: "expense",
  needsReview: true,
  classificationConfidence: "low",
});
const manualPendingRuleTarget = transaction({
  id: "apply-rule-manual-protected",
  date: "2026-08-23",
  description: "Manual Regra Protegida",
  amount: -35,
  category: "Despesa a revisar",
  kind: "expense",
  needsReview: true,
  classificationConfidence: "low",
  manualCategory: true,
});
const sensitivePendingCardPayment = transaction({
  id: "apply-rule-card-payment-protected",
  date: "2026-08-24",
  description: "Fatura Regra Protegida",
  amount: -500,
  category: "Pagamento de fatura",
  kind: "card_payment",
  needsReview: true,
  classificationConfidence: "low",
});
const sensitivePendingTransfer = transaction({
  id: "apply-rule-transfer-protected",
  date: "2026-08-24",
  description: "Transferencia Ja Classificada Protegida",
  amount: -115,
  category: "TransferÃªncia interna",
  kind: "transfer",
  needsReview: true,
  classificationConfidence: "low",
});
const sensitivePendingCardPaymentReceived = transaction({
  id: "apply-rule-card-payment-received-protected",
  date: "2026-08-25",
  description: "Recebido Regra Protegida",
  amount: 500,
  category: "Pagamento recebido da fatura",
  kind: "card_payment_received",
  needsReview: true,
  classificationConfidence: "low",
});
const optionalTransferRuleTarget = transaction({
  id: "apply-rule-optional-transfer",
  date: "2026-08-26",
  description: "Conta Propria Neutra Opcional",
  amount: -110,
  category: "TransferÃªncia interna",
  kind: "transfer",
  needsReview: false,
  classificationConfidence: "high",
});
const automaticBernardoTransferRuleTarget = transaction({
  id: "apply-rule-automatic-bernardo-income",
  date: "2026-08-26",
  description: "Transferencia recebida pelo Pix - BERNARDO DOS SANTOS FERREIRA BCO SANTANDER",
  amount: 2900,
  category: "TransferÃƒÂªncia interna",
  kind: "transfer",
  needsReview: false,
  classificationConfidence: "high",
});
const automaticExpenseTransferRuleTarget = transaction({
  id: "apply-rule-automatic-expense",
  date: "2026-08-26",
  description: "Transferencia enviada pelo Pix - Fornecedor Explicito Regra",
  amount: -155,
  category: "TransferÃƒÂªncia interna",
  kind: "transfer",
  needsReview: false,
  classificationConfidence: "high",
});
const automaticTransferRuleTarget = transaction({
  id: "apply-rule-automatic-transfer",
  date: "2026-08-26",
  description: "Transferencia automatica manter interna por regra",
  amount: -210,
  category: "Outros",
  kind: "expense",
  needsReview: false,
  classificationConfidence: "high",
});
const automaticClassifierOnlyTransferTarget = transaction({
  id: "apply-rule-automatic-classifier-only",
  date: "2026-08-26",
  description: "Transferencia automatica manter classificador lote",
  amount: 190,
  category: "TransferÃƒÂªncia interna",
  kind: "transfer",
  needsReview: false,
  classificationConfidence: "high",
});
const automaticInactiveTransferTarget = transaction({
  id: "apply-rule-automatic-inactive",
  date: "2026-08-26",
  description: "Transferencia automatica regra inativa lote",
  amount: 165,
  category: "TransferÃƒÂªncia interna",
  kind: "transfer",
  needsReview: false,
  classificationConfidence: "high",
});
const automaticManualTransferTarget = transaction({
  id: "apply-rule-automatic-manual",
  date: "2026-08-26",
  description: "Transferencia automatica protegida manual lote",
  amount: 175,
  category: "TransferÃƒÂªncia interna",
  kind: "transfer",
  needsReview: false,
  classificationConfidence: "high",
  manualCategory: true,
});
const pendingInactiveRuleTarget = transaction({
  id: "apply-rule-inactive",
  date: "2026-08-27",
  description: "Regra Inativa Pendencia",
  amount: -72,
  category: "Despesa a revisar",
  kind: "expense",
  needsReview: true,
  classificationConfidence: "low",
});
const pendingClassifierOnlyRuleTarget = transaction({
  id: "apply-rule-classifier-only",
  date: "2026-08-28",
  description: "Manter Classificador Pendencia",
  amount: -29,
  category: "Despesa a revisar",
  kind: "expense",
  needsReview: true,
  classificationConfidence: "low",
});
transactionService.replaceTransactions([
  pendingBernardoRuleTarget,
  pendingExpenseRuleTarget,
  pendingTransferRuleTarget,
  manualPendingRuleTarget,
  sensitivePendingCardPayment,
  sensitivePendingTransfer,
  sensitivePendingCardPaymentReceived,
  optionalTransferRuleTarget,
  automaticBernardoTransferRuleTarget,
  automaticExpenseTransferRuleTarget,
  automaticTransferRuleTarget,
  automaticClassifierOnlyTransferTarget,
  automaticInactiveTransferTarget,
  automaticManualTransferTarget,
  pendingInactiveRuleTarget,
  pendingClassifierOnlyRuleTarget,
]);
const bernardoPendingRule = categoryRuleService.createCategoryRule({
  keyword: "BERNARDO DOS SANTOS FERREIRA BCO SANTANDER",
  category: "Renda",
  kind: "income",
});
categoryRuleService.createCategoryRule({
  keyword: "taxi regra pendencia",
  category: "Transporte",
  kind: "expense",
});
categoryRuleService.createCategoryRule({
  keyword: "ajuste conta propria regra pendencia",
  category: "TransferÃªncia interna",
  kind: "transfer",
});
categoryRuleService.createCategoryRule({
  keyword: "fornecedor explicito regra",
  category: "Outros",
  kind: "expense",
});
categoryRuleService.createCategoryRule({
  keyword: "transferencia automatica manter interna por regra",
  category: "Transferencia interna",
  kind: "transfer",
});
categoryRuleService.createCategoryRule({
  keyword: "transferencia automatica manter classificador lote",
  category: "Renda",
});
categoryRuleService.createCategoryRule({
  keyword: "transferencia automatica protegida manual lote",
  category: "Renda",
  kind: "income",
});
const inactiveApplicationRule = categoryRuleService.createCategoryRule({
  keyword: "regra inativa pendencia",
  category: "Outros",
  kind: "expense",
});
categoryRuleService.toggleCategoryRule(inactiveApplicationRule.id);
const inactiveAutomaticRule = categoryRuleService.createCategoryRule({
  keyword: "transferencia automatica regra inativa lote",
  category: "Renda",
  kind: "income",
});
categoryRuleService.toggleCategoryRule(inactiveAutomaticRule.id);
categoryRuleService.createCategoryRule({
  keyword: "manter classificador pendencia",
  category: "Outros",
});
const importedBernardoWithRule = normalizeTransactionDraft({
  id: "apply-rule-imported-income-with-rule",
  date: "2026-08-19",
  description: "Transferencia recebida pelo Pix - BERNARDO DOS SANTOS FERREIRA BCO SANTANDER",
  amount: 1800,
  method: "pix",
  source: "nubank_account",
});
assert.equal(importedBernardoWithRule.category, "Renda", "Nova importacao com regra Santander/Bernardo entra como Renda");
assert.equal(importedBernardoWithRule.kind, "income", "Nova importacao com regra Santander/Bernardo entra como income");
const applicationPreview = categoryRuleApplicationService.previewApplyActiveRulesToEligibleTransactions();
assert.equal(applicationPreview.totalCandidates, 13, "Preview deve analisar pendencias e automaticos com regra explicita");
assert.equal(applicationPreview.matches.some((item) => item.transactionId === optionalTransferRuleTarget.id), false, "Preview nao inclui conferencia opcional");
assert.equal(applicationPreview.matches.some((item) => item.transactionId === manualPendingRuleTarget.id), false, "Preview nao inclui manualCategory true");
assert.equal(applicationPreview.matches.some((item) => item.transactionId === automaticManualTransferTarget.id), false, "Preview nao inclui automatico manualCategory true");
assert.equal(
  applicationPreview.skipped.some((item) => item.transactionId === automaticManualTransferTarget.id && item.reason.includes("manualCategory true")),
  true,
  "Preview explica quando manualCategory true bloqueia regra",
);
assert.equal(applicationPreview.matches.some((item) => item.transactionId === sensitivePendingTransfer.id), false, "Preview nao altera transfer ja classificada");
assert.equal(applicationPreview.matches.some((item) => item.transactionId === sensitivePendingCardPayment.id), false, "Preview nao altera card_payment classificado");
assert.equal(applicationPreview.matches.some((item) => item.transactionId === sensitivePendingCardPaymentReceived.id), false, "Preview nao altera card_payment_received classificado");
assert.equal(applicationPreview.matches.some((item) => item.matchedRuleId === bernardoPendingRule.id), true, "Preview encontra regra ativa por palavra-chave");
assert.equal(applicationPreview.matches.some((item) => item.transactionId === automaticBernardoTransferRuleTarget.id), true, "Preview inclui transfer automatica quando regra Receita bate");
assert.equal(applicationPreview.matches.some((item) => item.transactionId === automaticInactiveTransferTarget.id), false, "Preview nao inclui transfer automatica com regra inativa");
assert.equal(applicationPreview.matches.some((item) => item.transactionId === pendingInactiveRuleTarget.id), false, "Preview ignora regra inativa");
assert.equal(applicationPreview.matches.some((item) => item.transactionId === automaticClassifierOnlyTransferTarget.id), false, "Preview nao sobrescreve transfer com Manter classificador");
assert.equal(applicationPreview.matches.find((item) => item.transactionId === pendingBernardoRuleTarget.id).newCategory, "Renda", "Preview retorna nova categoria da regra");
assert.equal(applicationPreview.matches.find((item) => item.transactionId === pendingBernardoRuleTarget.id).newKind, "income", "Preview retorna kind Receita explicito");
assert.equal(applicationPreview.matches.find((item) => item.transactionId === pendingExpenseRuleTarget.id).newKind, "expense", "Preview retorna kind Despesa explicito");
assert.equal(applicationPreview.matches.find((item) => item.transactionId === pendingTransferRuleTarget.id).newKind, "transfer", "Preview retorna kind Transferencia explicito");
assert.equal(applicationPreview.skipped.some((item) => item.transactionId === pendingClassifierOnlyRuleTarget.id), true, "Preview protege regra em Manter classificador ambigua");

const applicationResult = categoryRuleApplicationService.applyActiveRulesToEligibleTransactions([
  pendingBernardoRuleTarget.id,
  pendingExpenseRuleTarget.id,
  automaticBernardoTransferRuleTarget.id,
  automaticExpenseTransferRuleTarget.id,
  automaticTransferRuleTarget.id,
]);
const appliedBernardoIncome = transactionService.getTransactionById(pendingBernardoRuleTarget.id);
const appliedAutomaticBernardoIncome = transactionService.getTransactionById(automaticBernardoTransferRuleTarget.id);
const appliedAutomaticExpense = transactionService.getTransactionById(automaticExpenseTransferRuleTarget.id);
const appliedAutomaticTransfer = transactionService.getTransactionById(automaticTransferRuleTarget.id);
const unappliedTransferMatch = transactionService.getTransactionById(pendingTransferRuleTarget.id);
assert.equal(applicationResult.updatedCount, 5, "Apply altera somente matches selecionados");
assert.equal(unappliedTransferMatch.category, pendingTransferRuleTarget.category, "Apply nao altera match desmarcado");
assert.equal(appliedBernardoIncome.category, "Renda", "Apply atualiza category");
assert.equal(appliedBernardoIncome.kind, "income", "Apply atualiza kind");
assert.equal(appliedBernardoIncome.manualCategory, true, "Apply marca manualCategory true");
assert.equal(appliedBernardoIncome.needsReview, false, "Apply marca needsReview false");
assert.equal(appliedBernardoIncome.classificationConfidence, "high", "Apply sobe confidence para high");
assert.match(appliedBernardoIncome.classificationReason, /Regra manual aplicada nas pendencias/, "Apply registra regra manual no motivo");
assert.equal(appliedAutomaticBernardoIncome.category, "Renda", "Santander/Bernardo automatico vira Renda");
assert.equal(appliedAutomaticBernardoIncome.kind, "income", "Apply transforma transfer automatico em income quando regra Receita bate");
assert.equal(appliedAutomaticExpense.kind, "expense", "Apply transforma transfer automatico em expense quando regra Despesa bate");
assert.equal(appliedAutomaticTransfer.kind, "transfer", "Apply mantem transfer quando regra explicita Transferencia bate");
assert.equal(appliedAutomaticBernardoIncome.manualCategory, true, "Apply automatico marca manualCategory true");
assert.equal(appliedAutomaticBernardoIncome.needsReview, false, "Apply automatico mantem needsReview false");
assert.match(appliedAutomaticBernardoIncome.classificationReason, /classificacao automatica/, "Apply automatico registra regra manual sobre classificacao automatica");
assert.equal(transactionService.listRequiredReviewTransactions().some((item) => item.id === pendingBernardoRuleTarget.id), false, "Apply reduz revisao necessaria");
assertMoney(calculateRealIncome([appliedBernardoIncome]), 2400, "Apply faz renda manual entrar em receitas reais");
assertMoney(calculateRealExpenses([transactionService.getTransactionById(pendingExpenseRuleTarget.id)]), 46, "Apply faz despesa manual entrar em despesas reais");
assertMoney(calculateRealIncome([appliedAutomaticBernardoIncome]), 2900, "Renda aplicada sobre transfer automatica entra em Receitas reais");
assert.equal(transactionService.listOptionalCheckTransactions().some((item) => item.id === automaticBernardoTransferRuleTarget.id), false, "Renda aplicada sai da conferencia opcional");
assert.equal(transactionService.listOptionalCheckTransactions().some((item) => item.id === optionalTransferRuleTarget.id), true, "Apply nao afeta conferencia opcional");
assert.equal(appliedBernardoIncome.classificationReason.includes(bernardoPendingRule.keyword), true, "Aplicacao Santander/Bernardo registra regra vencedora");
assertMoney(calculateRealIncome([optionalTransferRuleTarget]), 0, "Transferencia opcional sem aplicacao continua fora de receitas");
assert.equal(calculateExpensesByCategory([optionalTransferRuleTarget])["TransferÃƒÂªncia interna"], undefined, "Gastos por categoria nao incluem transferencia interna");
assertMoney(
  calculateFinanceSummary(transactionService.listTransactions()).income,
  5300,
  "Summary depois do apply deve refletir receitas aplicadas salvas",
);
const emptyApplicationPreview = categoryRuleApplicationService.previewApplyActiveRulesToEligibleTransactions();
assert.equal(emptyApplicationPreview.matches.some((item) => item.transactionId === pendingInactiveRuleTarget.id), false, "Sem regra ativa correspondente nao surge match");

categoryRuleService.clearCategoryRules();
categoryService.clearCustomCategories();
const deliveryCategory = categoryService.createCategory({ name: "Delivery", type: "expense" });
assert.equal(deliveryCategory.isDefault, false, "createCategory deve criar categoria personalizada");
assert.equal(deliveryCategory.isActive, true, "Categoria personalizada nova deve vir ativa");
assert.throws(() => categoryService.createCategory({ name: "   " }), /vazio/, "createCategory deve rejeitar nome vazio");
assert.throws(() => categoryService.createCategory({ name: "delivery" }), /existe/, "createCategory deve rejeitar duplicada normalizada");
assert.equal(categoryService.listCustomCategories().some((item) => item.id === deliveryCategory.id), true, "listCustomCategories deve retornar personalizadas");
assert.equal(categoryService.listDefaultCategories().some((item) => item.name === "Mercado"), true, "listDefaultCategories deve preservar padroes");
assert.equal(categoryService.listSpecialCategories().some((item) => item.name === "Transferência interna"), true, "listSpecialCategories deve preservar especiais");
assert.equal(categoryService.getAvailableCategories().some((item) => item.name === "Delivery"), true, "getAvailableCategories deve misturar personalizada ativa");
assert.equal(categoryService.getAvailableCategories().some((item) => item.name === deliveryCategory.name), true, "Categoria personalizada deve aparecer para orcamento");

const deliveryRule = categoryRuleService.createCategoryRule({ keyword: "delivery rapido", category: deliveryCategory.name });
assert.equal(deliveryRule.category, deliveryCategory.name, "Categoria personalizada deve aparecer para regra manual");
assert.equal(
  classifyTransactionDraft({ description: "Delivery Rapido Centro", amount: -42 }).category,
  deliveryCategory.name,
  "Regra manual deve classificar para categoria personalizada",
);
const bonusCategory = categoryService.createCategory({ name: "Bonus", type: "income" });
categoryRuleService.createCategoryRule({ keyword: "bonus santander", category: bonusCategory.name, kind: "income" });
const bonusRuleIncome = normalizeTransactionDraft({
  id: "bonus-rule-income",
  date: "2026-05-18",
  description: "Bonus Santander",
  amount: 800,
  method: "pix",
});
assert.equal(bonusRuleIncome.category, bonusCategory.name, "Regra com categoria personalizada Receita deve aplicar categoria");
assert.equal(bonusRuleIncome.kind, "income", "Regra com categoria personalizada Receita deve aplicar kind income");
const oldSavedRuleTarget = normalizeTransactionDraft({
  id: "old-saved-rule-target",
  date: "2026-05-18",
  description: "Delivery Rapido antes da regra",
  amount: -51,
});
transactionService.replaceTransactions([oldSavedRuleTarget]);
assert.equal(
  transactionService.listTransactions()[0].category,
  oldSavedRuleTarget.category,
  "Criar regra manual nao reclassifica transacao antiga automaticamente",
);
const explicitlyAppliedRuleTarget = transactionService.reviewTransaction(oldSavedRuleTarget.id, {
  category: deliveryCategory.name,
  kind: "expense",
  needsReview: false,
});
assert.equal(explicitlyAppliedRuleTarget.category, deliveryCategory.name, "Aplicacao explicita da regra pode corrigir categoria atual");
assert.equal(explicitlyAppliedRuleTarget.kind, "expense", "Aplicacao explicita da regra pode corrigir tipo atual");
assert.equal(explicitlyAppliedRuleTarget.manualCategory, true, "Aplicacao explicita mantem manualCategory true");
assert.equal(explicitlyAppliedRuleTarget.needsReview, false, "Aplicacao explicita remove needsReview da transacao atual");

const customCategoryTransaction = normalizeTransactionDraft({
  id: "custom-category-transaction",
  date: "2026-05-19",
  description: "Compra para categoria propria",
  amount: -88,
});
transactionService.replaceTransactions([customCategoryTransaction]);
const customCategoryUpdatedTransaction = transactionService.updateTransactionCategory(customCategoryTransaction.id, deliveryCategory.name);
assert.equal(customCategoryUpdatedTransaction.category, deliveryCategory.name, "Categoria personalizada pode ser usada em updateTransactionCategory");
assert.equal(customCategoryUpdatedTransaction.manualCategory, true, "Categoria personalizada corrigida deve proteger manualCategory");
assert.equal(categoryService.deleteCategory(categoryService.listDefaultCategories()[0].id), false, "Nao deve excluir categoria padrao");
assert.equal(categoryService.deleteCategory(categoryService.listSpecialCategories()[0].id), false, "Nao deve excluir categoria especial");
categoryService.toggleCategory(deliveryCategory.id);
assert.equal(categoryService.getAvailableCategories().some((item) => item.id === deliveryCategory.id), false, "Categoria desativada nao aparece como opcao principal");
assert.equal(
  transactionService.listTransactions()[0].category,
  deliveryCategory.name,
  "Transacao antiga com categoria desativada continua mostrando nome",
);
assert.equal(deliveryRule.category, deliveryCategory.name, "Categoria personalizada pode continuar referenciada por regra");

budgetService.clearBudgets();
assert.deepEqual(budgetService.listBudgets(), [], "budgetService vazio nao deve inserir defaults automaticamente");
assert.equal(budgetService.listDefaultBudgetSuggestions().length > 0, true, "defaultBudgets devem ficar como sugestoes separadas");
assert.throws(
  () => budgetService.createBudget({ name: "Limite invalido", category: "Mercado", limit: 0, scope: "pessoal" }),
  /maior que zero/,
  "createBudget deve rejeitar limite invalido",
);
assert.throws(
  () => budgetService.createBudget({ name: "Sem categoria", category: " ", limit: 100, scope: "pessoal" }),
  /categoria/,
  "createBudget deve rejeitar categoria vazia",
);

const mercadoBudget = budgetService.createBudget({
  name: "Mercado maio",
  category: "Mercado",
  limit: 500,
  scope: "pessoal",
});
assert.equal(mercadoBudget.category, "Mercado", "createBudget deve criar orcamento valido");
assert.equal(budgetService.listBudgets().some((item) => item.id === mercadoBudget.id), true, "listBudgets deve retornar salvos");
const updatedMercadoBudget = budgetService.updateBudget(mercadoBudget.id, { limit: 550 });
assert.equal(updatedMercadoBudget.limit, 550, "updateBudget deve alterar orcamento");
assert.equal(budgetService.toggleBudget(mercadoBudget.id).isActive, false, "toggleBudget deve desativar orcamento");
assert.equal(budgetService.listActiveBudgets().some((item) => item.id === mercadoBudget.id), false, "listActiveBudgets deve retornar apenas ativos");
assert.equal(budgetService.toggleBudget(mercadoBudget.id).isActive, true, "toggleBudget deve reativar orcamento");

const budgetTransactions = [
  transaction({ id: "budget-expense", date: "2026-05-04", amount: -120, category: "Mercado", kind: "expense", scope: "pessoal" }),
  transaction({
    id: "budget-card-purchase",
    date: "2026-05-05",
    amount: -180,
    category: "Mercado",
    kind: "card_purchase",
    scope: "pessoal",
    accountType: "credit_card",
    method: "credito",
    source: "nubank_credit_card",
  }),
  transaction({ id: "budget-card-payment", date: "2026-05-06", amount: -300, category: "Mercado", kind: "card_payment", scope: "pessoal" }),
  transaction({ id: "budget-card-payment-received", date: "2026-05-07", amount: 300, category: "Mercado", kind: "card_payment_received", scope: "pessoal" }),
  transaction({ id: "budget-transfer", date: "2026-05-08", amount: -90, category: "Mercado", kind: "transfer", scope: "pessoal" }),
  transaction({ id: "budget-income", date: "2026-05-09", amount: 700, category: "Mercado", kind: "income", scope: "pessoal" }),
  transaction({ id: "budget-refund", date: "2026-05-10", amount: 30, category: "Mercado", kind: "refund", scope: "pessoal" }),
  transaction({ id: "budget-other-category", date: "2026-05-11", amount: -75, category: "Lazer", kind: "expense", scope: "pessoal" }),
  transaction({
    id: "budget-business",
    date: "2026-05-12",
    amount: -60,
    category: "Mercado",
    kind: "expense",
    scope: "empresa",
    accountType: "business_checking",
    accountId: "c6-empresa",
    accountName: "C6 Empresa",
    institution: "C6 Bank",
    source: "c6_business",
  }),
  transaction({ id: "budget-next-month", date: "2026-06-04", amount: -240, category: "Mercado", kind: "expense", scope: "pessoal" }),
];
const mercadoUsage = calculateBudgetUsage(updatedMercadoBudget, budgetTransactions);
assertMoney(mercadoUsage.spent, 270, "expense, card_purchase e refund devem compor gasto do orcamento");
assertMoney(mercadoUsage.remaining, 280, "Orcamento deve calcular remaining");
assertMoney(mercadoUsage.percentUsed, (270 / 550) * 100, "Orcamento deve calcular percentUsed");
assert.equal(mercadoUsage.transactionsCount, 3, "Pagamento, transferencia e income nao entram no uso");
assertMoney(calculateBudgetUsage(updatedMercadoBudget, [budgetTransactions[0]]).spent, 120, "expense entra no orcamento");
assertMoney(calculateBudgetUsage(updatedMercadoBudget, [budgetTransactions[1]]).spent, 180, "card_purchase entra no orcamento");
assertMoney(calculateBudgetUsage(updatedMercadoBudget, [budgetTransactions[2]]).spent, 0, "card_payment nao entra no orcamento");
assertMoney(calculateBudgetUsage(updatedMercadoBudget, [budgetTransactions[3]]).spent, 0, "card_payment_received nao entra no orcamento");
assertMoney(calculateBudgetUsage(updatedMercadoBudget, [budgetTransactions[4]]).spent, 0, "transfer nao entra no orcamento");
assertMoney(calculateBudgetUsage(updatedMercadoBudget, [budgetTransactions[5]]).spent, 0, "income nao entra no orcamento");
assertMoney(calculateBudgetUsage(updatedMercadoBudget, [budgetTransactions[7]]).spent, 0, "Orcamento deve respeitar categoria");
assertMoney(calculateBudgetUsage(updatedMercadoBudget, budgetTransactions, "2026-05").spent, 270, "Orcamento deve usar mes selecionado");
assertMoney(calculateBudgetUsage(updatedMercadoBudget, budgetTransactions, "2026-06").spent, 240, "Transacao do mes selecionado correto deve entrar");
assertMoney(calculateBudgetUsage(updatedMercadoBudget, budgetTransactions, "2026-07").spent, 0, "Orcamento sem transacoes no mes deve zerar gasto");
const trackedMayBudgetTransactions = getBudgetTransactions(updatedMercadoBudget, budgetTransactions, "2026-05");
assert.deepEqual(
  trackedMayBudgetTransactions.map((item) => item.id),
  ["budget-expense", "budget-card-purchase", "budget-refund"],
  "Drilldown do orcamento deve trazer apenas expense, card_purchase e refund considerados",
);
assert.equal(trackedMayBudgetTransactions.some((item) => item.kind === "expense"), true, "Drilldown inclui expense da categoria");
assert.equal(trackedMayBudgetTransactions.some((item) => item.kind === "card_purchase"), true, "Drilldown inclui card_purchase da categoria");
assert.equal(trackedMayBudgetTransactions.some((item) => item.kind === "refund"), true, "Drilldown inclui refund da categoria");
assert.equal(trackedMayBudgetTransactions.some((item) => item.kind === "transfer"), false, "Drilldown exclui transfer");
assert.equal(trackedMayBudgetTransactions.some((item) => item.kind === "card_payment"), false, "Drilldown exclui card_payment");
assert.equal(trackedMayBudgetTransactions.some((item) => item.kind === "card_payment_received"), false, "Drilldown exclui card_payment_received");
assert.equal(trackedMayBudgetTransactions.some((item) => item.kind === "income"), false, "Drilldown exclui income");
const neutralTransferBudget = { ...updatedMercadoBudget, id: "budget-internal-transfer", category: "Transferência interna", categories: ["Transferência interna"] };
const neutralCardPaymentBudget = { ...updatedMercadoBudget, id: "budget-card-payment-neutral", category: "Pagamento de fatura", categories: ["Pagamento de fatura"] };
const inconsistentBudgetNeutrals = [
  transaction({ id: "budget-old-transfer-expense", date: "2026-05-14", amount: -310, category: "Transferência interna", kind: "expense" }),
  transaction({ id: "budget-old-card-payment-expense", date: "2026-05-15", amount: -310, category: "Pagamento de fatura", kind: "expense" }),
];
assertMoney(calculateBudgetUsage(neutralTransferBudget, inconsistentBudgetNeutrals, "2026-05").spent, 0, "Transferencia interna inconsistente antiga nao entra no orcamento");
assertMoney(calculateBudgetUsage(neutralCardPaymentBudget, inconsistentBudgetNeutrals, "2026-05").spent, 0, "Pagamento de fatura inconsistente antigo nao entra no orcamento");

const personalBudget = budgetService.createBudget({ name: "Pessoal Mercado", category: "Mercado", limit: 200, scope: "pessoal" });
const businessBudget = budgetService.createBudget({ name: "Empresa Mercado", category: "Mercado", limit: 200, scope: "empresa" });
const consolidatedBudget = budgetService.createBudget({ name: "Consolidado Mercado", category: "Mercado", limit: 200, scope: "consolidado" });
assertMoney(calculateBudgetUsage(personalBudget, budgetTransactions).spent, 270, "Orcamento pessoal respeita escopo");
assertMoney(calculateBudgetUsage(businessBudget, budgetTransactions).spent, 60, "Orcamento empresa respeita escopo");
assertMoney(calculateBudgetUsage(consolidatedBudget, budgetTransactions).spent, 330, "Orcamento consolidado considera pessoal e empresa");
assert.equal(calculateBudgetUsage(personalBudget, budgetTransactions).status, "exceeded", "Orcamento deve marcar exceeded acima do limite");
const attentionBudget = budgetService.createBudget({ name: "Atencao Mercado", category: "Mercado", limit: 350, scope: "pessoal" });
assert.equal(calculateBudgetUsage(attentionBudget, budgetTransactions).status, "attention", "Orcamento deve marcar attention perto do limite");
const budgetDashboardSummary = budgetService.getBudgetsSummary(budgetTransactions);
assert.equal(budgetDashboardSummary.totalActive >= 4, true, "Resumo de orcamento deve usar budgets salvos");
assert.equal(calculateBudgetsSummary(budgetService.listActiveBudgets(), budgetTransactions).totalSpent > 0, true, "Resumo puro de orcamento deve somar gastos reais");
assert.equal(
  budgetService.getBudgetsSummary(budgetTransactions, "2026-05").totalSpent > budgetService.getBudgetsSummary(budgetTransactions, "2026-07").totalSpent,
  true,
  "Resumo de orcamento deve mudar conforme mes selecionado",
);
assertMoney(budgetService.getBudgetUsage(updatedMercadoBudget, budgetTransactions).spent, mercadoUsage.spent, "selectedMonth ausente deve manter mes atual");

categoryService.toggleCategory(deliveryCategory.id);
const deliveryBudget = budgetService.createBudget({ name: "Delivery maio", category: deliveryCategory.name, limit: 200, scope: "pessoal" });
const deliveryExpense = transaction({ id: "delivery-budget-expense", date: "2026-05-13", amount: -65, category: deliveryCategory.name, kind: "expense" });
assert.equal(deliveryBudget.category, deliveryCategory.name, "Orcamento pode usar categoria personalizada");
assertMoney(calculateBudgetUsage(deliveryBudget, [deliveryExpense], "2026-05").spent, 65, "Orcamento personalizado deve calcular gasto");
assert.equal(getBudgetTransactions(deliveryBudget, [deliveryExpense], "2026-05")[0].category, deliveryCategory.name, "Drilldown preserva categoria personalizada");

const dashboardMonthTransactions = [
  transaction({ id: "dashboard-month-income", date: "2026-05-01", amount: 1800, category: "Renda", kind: "income" }),
  transaction({ id: "dashboard-month-expense", date: "2026-05-02", amount: -220, category: "Mercado", kind: "expense" }),
  transaction({
    id: "dashboard-month-card",
    date: "2026-05-03",
    amount: -130,
    category: deliveryCategory.name,
    kind: "card_purchase",
    accountType: "credit_card",
    method: "credito",
    source: "nubank_credit_card",
  }),
  transaction({ id: "dashboard-month-transfer", date: "2026-05-04", amount: 400, category: "Transferência interna", kind: "transfer" }),
  transaction({ id: "dashboard-month-card-payment", date: "2026-05-05", amount: -350, category: "Pagamento de fatura", kind: "card_payment" }),
  transaction({ id: "dashboard-month-card-payment-received", date: "2026-05-06", amount: 350, category: "Pagamento recebido da fatura", kind: "card_payment_received" }),
  transaction({ id: "dashboard-month-old-neutral", date: "2026-05-07", amount: -410, category: "Transferência interna", kind: "expense" }),
  transaction({
    id: "dashboard-month-income-review",
    date: "2026-05-08",
    amount: 500,
    category: "Entrada a revisar",
    kind: "review",
    needsReview: true,
    classificationConfidence: "low",
  }),
  transaction({
    id: "dashboard-month-neutral-check",
    date: "2026-05-09",
    amount: -90,
    category: "Transferência interna",
    kind: "transfer",
    needsReview: false,
    classificationConfidence: "high",
  }),
  transaction({ id: "dashboard-other-month", date: "2026-06-01", amount: -880, category: "Mercado", kind: "expense" }),
];
transactionService.replaceTransactions(dashboardMonthTransactions);
const dashboardMaySummary = financeSummaryService.getFinanceSummary("2026-05");
const dashboardJuneSummary = financeSummaryService.getFinanceSummary("2026-06");
assertMoney(dashboardMaySummary.income, 1800, "Summary mensal inclui income em receitas reais");
assertMoney(dashboardMaySummary.expenses, 350, "Summary mensal inclui expense e card_purchase em despesas reais");
// Modelo dois pools (060f286): saldo mensal = receita - despesas em dinheiro - pagamentos de fatura,
// nao receita - despesas totais (compra no cartao nao reduz saldo na hora de comprar).
assertMoney(
  dashboardMaySummary.balance,
  dashboardMaySummary.income - dashboardMaySummary.cashExpenses - dashboardMaySummary.cardPayments,
  "Saldo mensal (dois pools) deve ser receita menos despesas em dinheiro menos pagamentos de fatura",
);
assertMoney(dashboardJuneSummary.expenses, 880, "Summary mensal deve usar o mes selecionado");
assert.equal(dashboardMaySummary.transactionCount, 9, "Transacao de outro mes nao entra no summary mensal");
assertMoney(calculateRealIncome([dashboardMonthTransactions[3]]), 0, "Transfer nao entra em receitas reais do dashboard");
assertMoney(calculateRealIncome([dashboardMonthTransactions[5]]), 0, "card_payment_received nao entra em receitas reais do dashboard");
assertMoney(calculateRealExpenses([dashboardMonthTransactions[3]]), 0, "Transfer nao entra em despesas reais do dashboard");
assertMoney(calculateRealExpenses([dashboardMonthTransactions[4]]), 0, "card_payment nao entra em despesas reais do dashboard");
assertMoney(calculateRealExpenses([dashboardMonthTransactions[6]]), 0, "Categoria Transferencia interna inconsistente nao entra em despesas reais");
assertMoney(calculateRealIncome([dashboardMonthTransactions[7]]), 0, "Entrada a revisar nao entra em renda real");
assert.equal(dashboardMaySummary.requiredReviewCount, 1, "Summary separa pendencias obrigatorias");
assert.equal(dashboardMaySummary.optionalCheckCount, 5, "Summary separa conferencias opcionais do mes");
const dashboardCategoryExpenses = calculateExpensesByCategory(filterTransactionsBySelectedMonth(dashboardMonthTransactions, "2026-05"));
assertMoney(dashboardCategoryExpenses["Mercado"], 220, "Gastos por categoria usa mes selecionado");
assertMoney(dashboardCategoryExpenses[deliveryCategory.name], 130, "Gastos por categoria inclui card_purchase");
assert.equal(dashboardCategoryExpenses["Transferência interna"], undefined, "Gastos por categoria exclui transferencia interna");
assert.equal(dashboardCategoryExpenses["Pagamento de fatura"], undefined, "Gastos por categoria exclui pagamento de fatura");
const dashboardNetCategoryExpenses = calculateNetExpensesByCategory([
  ...dashboardMonthTransactions,
  transaction({ id: "dashboard-market-refund", date: "2026-05-11", amount: 40, category: "Mercado", kind: "refund" }),
  transaction({ id: "dashboard-neutral-refund", date: "2026-05-12", amount: 500, category: "Transferência interna", kind: "refund" }),
  transaction({ id: "dashboard-other-month-refund", date: "2026-06-12", amount: 30, category: "Mercado", kind: "refund" }),
  transaction({ id: "dashboard-zero-expense", date: "2026-05-13", amount: -25, category: "Casa", kind: "expense" }),
  transaction({ id: "dashboard-zero-refund", date: "2026-05-14", amount: 25, category: "Casa", kind: "refund" }),
  transaction({ id: "dashboard-credit-refund", date: "2026-05-15", amount: 70, category: "Lazer", kind: "refund" }),
], "2026-05");
assertMoney(
  dashboardNetCategoryExpenses.find((item) => item.category === "Mercado")?.amount,
  180,
  "Gastos por categoria reduzem refund seguro da mesma categoria",
);
assert.equal(
  dashboardNetCategoryExpenses.some((item) => item.category === "Transferência interna"),
  false,
  "Refund de categoria neutra nao reduz gastos por categoria",
);
assertMoney(
  calculateNetExpensesByCategory([
    transaction({ id: "refund-month-expense", date: "2026-05-01", amount: -90, category: "Mercado", kind: "expense" }),
    transaction({ id: "refund-other-month", date: "2026-06-01", amount: 50, category: "Mercado", kind: "refund" }),
  ], "2026-05")[0].amount,
  90,
  "Refund de outro mes nao reduz o gasto liquido selecionado",
);
assertMoney(
  dashboardNetCategoryExpenses.find((item) => item.category === "Casa")?.amount,
  0,
  "Categoria com gasto liquido zero nao quebra o resumo",
);
assert.equal(
  (dashboardNetCategoryExpenses.find((item) => item.category === "Lazer")?.amount ?? 0) < 0,
  true,
  "Categoria com gasto liquido negativo permanece representavel como ajuste",
);
const dashboardBudgetMay = budgetService.getBudgetsSummary(dashboardMonthTransactions, "2026-05");
assert.deepEqual(
  dashboardBudgetMay,
  calculateBudgetsSummary(budgetService.listActiveBudgets(), dashboardMonthTransactions, "2026-05"),
  "Resumo de orcamento do dashboard deve bater com calculo da BudgetsPage no mesmo mes",
);
assert.equal(
  budgetService.getBudgetsSummary(dashboardMonthTransactions, "2026-05").totalSpent !== budgetService.getBudgetsSummary(dashboardMonthTransactions, "2026-06").totalSpent,
  true,
  "Resumo de orcamento do dashboard usa selectedMonth",
);
const comparisonTransactions = [
  transaction({ id: "comparison-april-income", date: "2026-04-01", amount: 1000, category: "Renda", kind: "income" }),
  transaction({ id: "comparison-april-market", date: "2026-04-02", amount: -300, category: "Mercado", kind: "expense" }),
  transaction({ id: "comparison-april-market-refund", date: "2026-04-03", amount: 50, category: "Mercado", kind: "refund" }),
  transaction({
    id: "comparison-april-card",
    date: "2026-04-04",
    amount: -100,
    category: "Delivery",
    kind: "card_purchase",
    accountType: "credit_card",
    method: "credito",
    source: "nubank_credit_card",
  }),
  transaction({ id: "comparison-april-transfer", date: "2026-04-05", amount: -450, category: "Transferência interna", kind: "transfer" }),
  transaction({ id: "comparison-april-payment", date: "2026-04-06", amount: -400, category: "Pagamento de fatura", kind: "card_payment" }),
  transaction({
    id: "comparison-april-income-review",
    date: "2026-04-07",
    amount: 900,
    category: "Entrada a revisar",
    kind: "review",
    needsReview: true,
    classificationConfidence: "low",
  }),
  transaction({ id: "comparison-may-income", date: "2026-05-01", amount: 1500, category: "Renda", kind: "income" }),
  transaction({ id: "comparison-may-market", date: "2026-05-02", amount: -250, category: "Mercado", kind: "expense" }),
  transaction({ id: "comparison-may-market-refund", date: "2026-05-03", amount: 20, category: "Mercado", kind: "refund" }),
  transaction({
    id: "comparison-may-card",
    date: "2026-05-04",
    amount: -200,
    category: "Delivery",
    kind: "card_purchase",
    accountType: "credit_card",
    method: "credito",
    source: "nubank_credit_card",
  }),
  transaction({ id: "comparison-may-zero-base", date: "2026-05-05", amount: -80, category: "Lazer", kind: "expense" }),
  transaction({ id: "comparison-may-payment", date: "2026-05-06", amount: -600, category: "Pagamento de fatura", kind: "card_payment" }),
  transaction({ id: "comparison-june-expense", date: "2026-06-01", amount: -999, category: "Mercado", kind: "expense" }),
];
transactionService.replaceTransactions(comparisonTransactions);
const mayComparison = financeSummaryService.getMonthlyComparison("2026-05");
assert.equal(mayComparison.currentMonth, "2026-05", "Comparacao mensal deve manter mes selecionado");
assert.equal(mayComparison.previousMonth, "2026-04", "Comparacao mensal deve usar mes anterior");
assertMoney(mayComparison.currentSummary.income, 1500, "Receita atual da comparacao deve usar mes selecionado");
assertMoney(mayComparison.previousSummary.income, 1000, "Receita anterior da comparacao deve usar mes anterior");
assertMoney(mayComparison.currentSummary.expenses, 510, "Despesas atuais comparam gasto liquido com refund");
assertMoney(mayComparison.previousSummary.expenses, 350, "Despesas anteriores ignoram transfer, pagamento e abatem refund");
// Modelo dois pools: saldo = receita - despesas em dinheiro - pagamentos de fatura.
assertMoney(mayComparison.currentSummary.balance, 590, "Resultado atual (dois pools) deve usar resumo mensal liquido");
assertMoney(mayComparison.previousSummary.balance, 350, "Resultado anterior (dois pools) deve usar resumo mensal liquido");
assertMoney(mayComparison.deltas.cardPurchases.currentValue, 200, "Compras no cartao atuais devem comparar por mes");
assertMoney(mayComparison.deltas.cardPurchases.previousValue, 100, "Compras no cartao anteriores devem comparar por mes");
assert.equal(mayComparison.deltas.transactionCount.difference, -1, "Quantidade de transacoes deve comparar apenas os dois meses");
assert.equal(mayComparison.deltas.expenses.percentChange > 0, true, "Percentual deve existir quando ha base anterior");
assert.equal(financeSummaryService.getMonthlyComparison("2026-08").deltas.expenses.percentChange, null, "Percentual sem base anterior deve ser seguro");
assertMoney(mayComparison.previousSummary.income, 1000, "Entrada a revisar nao deve entrar como receita anterior na comparacao");
const mayCategoryComparison = financeSummaryService.getMonthlyCategoryComparison("2026-05");
const marketCategoryComparison = mayCategoryComparison.find((item) => item.category === "Mercado");
assertMoney(marketCategoryComparison.currentAmount, 230, "Comparacao de categoria usa gasto liquido atual");
assertMoney(marketCategoryComparison.previousAmount, 250, "Refund reduz categoria no mes anterior correto");
assert.equal(mayCategoryComparison.some((item) => item.category === "Transferência interna"), false, "Categoria neutra nao aparece na comparacao");
assert.equal(mayCategoryComparison.find((item) => item.category === "Lazer").percentChange, null, "Categoria sem base anterior usa percentChange seguro");
assert.equal(financeSummaryService.getMonthlyCategoryComparison("2026-06").find((item) => item.category === "Mercado").previousAmount, 230, "Refund de outro mes nao altera comparacao do gasto liquido maio/junho");
const marketComparisonDetails = financeSummaryService.getMonthlyCategoryComparisonDetails("2026-05", "Mercado");
assert.equal(marketComparisonDetails.currentMonth, "2026-05", "Detalhe da categoria deve manter mes selecionado");
assert.equal(marketComparisonDetails.previousMonth, "2026-04", "Detalhe da categoria deve trazer mes anterior");
assert.deepEqual(
  marketComparisonDetails.currentTransactions.map((item) => item.id),
  ["comparison-may-market-refund", "comparison-may-market"],
  "Detalhe atual deve conter apenas transacoes da categoria no mes selecionado em ordem decrescente",
);
assert.deepEqual(
  marketComparisonDetails.previousTransactions.map((item) => item.id),
  ["comparison-april-market-refund", "comparison-april-market"],
  "Detalhe anterior deve conter apenas transacoes da categoria no mes anterior",
);
assert.equal(marketComparisonDetails.currentTransactions.some((item) => item.isExpense), true, "Expense entra no detalhe da comparacao");
assert.equal(marketComparisonDetails.currentTransactions.some((item) => item.isRefund), true, "Refund seguro entra no detalhe como ajuste");
assert.equal(financeSummaryService.getMonthlyCategoryComparisonDetails("2026-05", "Delivery").currentTransactions[0].isCardPurchase, true, "card_purchase entra no detalhe da comparacao");
assertMoney(
  marketComparisonDetails.currentTransactions.reduce((total, item) => total + (item.isRefund ? -Math.abs(item.amount) : Math.abs(item.amount)), 0),
  marketComparisonDetails.currentAmount,
  "currentAmount deve bater com soma liquida das transacoes atuais",
);
assertMoney(
  marketComparisonDetails.previousTransactions.reduce((total, item) => total + (item.isRefund ? -Math.abs(item.amount) : Math.abs(item.amount)), 0),
  marketComparisonDetails.previousAmount,
  "previousAmount deve bater com soma liquida das transacoes anteriores",
);
assertMoney(marketComparisonDetails.difference, marketComparisonDetails.currentAmount - marketComparisonDetails.previousAmount, "Difference do detalhe deve ser corrente menos anterior");
assert.equal(financeSummaryService.getMonthlyCategoryComparisonDetails("2026-05", "Lazer").percentChange, null, "Detalhe sem base anterior mantem percentual seguro");
transactionService.replaceTransactions([
  ...comparisonTransactions,
  transaction({ id: "detail-market-transfer", date: "2026-05-07", amount: -70, category: "Mercado", kind: "transfer" }),
  transaction({ id: "detail-market-payment", date: "2026-05-08", amount: -70, category: "Mercado", kind: "card_payment" }),
  transaction({ id: "detail-market-payment-received", date: "2026-05-09", amount: 70, category: "Mercado", kind: "card_payment_received" }),
  transaction({ id: "detail-market-income", date: "2026-05-10", amount: 70, category: "Mercado", kind: "income" }),
  transaction({ id: "detail-old-neutral-expense", date: "2026-05-11", amount: -70, category: "Transferencia interna", kind: "expense" }),
]);
const marketSafetyDetails = financeSummaryService.getMonthlyCategoryComparisonDetails("2026-05", "Mercado");
assert.equal(marketSafetyDetails.currentTransactions.some((item) => item.kind === "transfer"), false, "Transfer nao entra no detalhe");
assert.equal(marketSafetyDetails.currentTransactions.some((item) => item.kind === "card_payment"), false, "card_payment nao entra no detalhe");
assert.equal(marketSafetyDetails.currentTransactions.some((item) => item.kind === "card_payment_received"), false, "card_payment_received nao entra no detalhe");
assert.equal(marketSafetyDetails.currentTransactions.some((item) => item.kind === "income"), false, "income nao entra no detalhe");
assert.equal(
  financeSummaryService.getMonthlyCategoryComparisonDetails("2026-05", "Transferencia interna").currentTransactions.length,
  0,
  "Categoria neutra inconsistente fica fora do detalhe",
);
transactionService.replaceTransactions([
  transaction({ id: "comparison-dec-income", date: "2025-12-10", amount: 500, category: "Renda", kind: "income" }),
  transaction({ id: "comparison-jan-income", date: "2026-01-10", amount: 700, category: "Renda", kind: "income" }),
]);
const januaryComparison = financeSummaryService.getMonthlyComparison("2026-01");
assert.equal(januaryComparison.previousMonth, "2025-12", "Janeiro deve comparar com dezembro do ano anterior");
assertMoney(januaryComparison.previousSummary.income, 500, "Comparacao na virada de ano deve ler dezembro");
assert.equal(financeSummaryService.getMonthlyCategoryComparisonDetails("2026-01", "Mercado").previousMonth, "2025-12", "Detalhe de janeiro usa dezembro anterior");
assert.equal(budgetService.deleteBudget(attentionBudget.id), true, "deleteBudget deve remover orcamento");
transactionService.replaceTransactions([
  transaction({ id: "chart-income", date: "2026-05-03", amount: 1000, category: "Renda", kind: "income" }),
  transaction({ id: "chart-expense", date: "2026-05-04", amount: -100, category: "Mercado", kind: "expense" }),
  transaction({ id: "chart-refund", date: "2026-05-05", amount: 40, category: "Mercado", kind: "refund" }),
  transaction({ id: "chart-transfer", date: "2026-05-06", amount: -500, category: "Transferência interna", kind: "transfer" }),
  transaction({ id: "chart-card-payment", date: "2026-05-07", amount: -600, category: "Pagamento de fatura", kind: "card_payment" }),
  transaction({ id: "chart-reimbursement-original", date: "2026-05-08", amount: -20, category: "Alimentação fora", kind: "expense", reimbursementPairId: "chart-pair", reimbursementRole: "original", reimbursementStatus: "matched" }),
  transaction({ id: "chart-reimbursement-refund", date: "2026-05-09", amount: 20, category: "Alimentação fora", kind: "refund", reimbursementPairId: "chart-pair", reimbursementRole: "refund", reimbursementStatus: "matched" }),
]);
const chartEvolution = financeSummaryService.getMonthlyEvolution("2026-05", 6);
assert.equal(chartEvolution.length, 6, "Evolucao mensal deve retornar 6 meses");
assert.equal(chartEvolution.at(-1).month, "2026-05", "Evolucao mensal deve terminar no mes selecionado");
assertMoney(chartEvolution.at(-1).expenses, 60, "Graficos devem usar despesas reais liquidas");
assertMoney(chartEvolution.at(-1).income, 1000, "Graficos devem usar receitas reais do summary");
assertMoney(chartEvolution.at(-1).balance, 340, "Graficos devem usar saldo em caixa (dois pools)");
const chartCategories = financeSummaryService.getCategoryExpenses("2026-05");
assert.equal(chartCategories.some((item) => item.category === "Transferência interna"), false, "Graficos de categoria nao devem incluir transferencia interna");
assert.equal(chartCategories.some((item) => item.category === "Pagamento de fatura"), false, "Graficos de categoria nao devem incluir pagamento de fatura");
assert.equal(chartCategories.some((item) => item.category === "Alimentação fora"), false, "Graficos de categoria nao devem incluir reembolso pareado");
assertMoney(chartCategories.find((item) => item.category === "Mercado")?.amount ?? 0, 60, "Graficos de categoria devem usar gasto liquido");
categoryRuleService.clearCategoryRules();
categoryService.clearCustomCategories();
budgetService.clearBudgets();

console.log("Finance module check passed.");
