import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('hub.db');

const row = db.prepare("SELECT value FROM kv_store WHERE key = 'finance.transactions'").get();
const all = JSON.parse(row.value);

const month = '2026-06';
const txs = all.filter(t => t.date?.startsWith(month));

// Replica calculateFinanceSummary do app
const notMatched = txs.filter(t => !(t.reimbursementPairId && t.reimbursementStatus === 'matched'));

const neutralCats = ['transferência interna', 'pagamento de fatura', 'pagamento fatura recebido'];
const normalize = s => (s ?? '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
const isNeutral = t => neutralCats.some(c => normalize(t.category) === normalize(c));

const isRealIncome = t =>
  t.kind === 'income' &&
  normalize(t.category) !== normalize('receita a revisar') &&
  !isNeutral(t);

const isRealExpense = t =>
  t.amount < 0 &&
  !isNeutral(t) &&
  (t.kind === 'expense' || t.kind === 'card_purchase');

const isRefund = t =>
  t.kind === 'refund' && t.amount > 0 && !isNeutral(t) &&
  normalize(t.category) !== normalize('receita a revisar') &&
  normalize(t.category) !== normalize('despesa a revisar');

const isCardPayment = t => t.kind === 'card_payment';
const isCardPurchase = t => t.kind === 'card_purchase';

const sum = arr => arr.reduce((s, t) => s + Math.abs(t.amount), 0);

const income = sum(notMatched.filter(isRealIncome));
const grossExpenses = sum(notMatched.filter(isRealExpense));
const refunds = sum(notMatched.filter(isRefund));
const netExpenses = grossExpenses - refunds;
const cardPurchases = sum(notMatched.filter(isCardPurchase));
const cardPayments = sum(notMatched.filter(isCardPayment));
const cashExpenses = netExpenses - cardPurchases;
const balance = income - cashExpenses - cardPayments;

console.log(`=== CÁLCULO DO SALDO — ${month} ===`);
console.log(`Receita real:       R$ ${income.toFixed(2)}`);
console.log(`Despesas brutas:    R$ ${grossExpenses.toFixed(2)}`);
console.log(`Reembolsos:         R$ ${refunds.toFixed(2)}`);
console.log(`Despesas líquidas:  R$ ${netExpenses.toFixed(2)}`);
console.log(`  - Compras crédito: R$ ${cardPurchases.toFixed(2)}`);
console.log(`  - Pagto fatura:    R$ ${cardPayments.toFixed(2)}`);
console.log(`  - Cash expenses:   R$ ${cashExpenses.toFixed(2)}`);
console.log(`\nSALDO (income - cashExpenses - cardPayments): R$ ${balance.toFixed(2)}`);

// Conta de débito especificamente
const contaTxs = notMatched.filter(t => t.accountId === 'nubank-conta' && t.date?.startsWith(month));
console.log(`\n=== NUBANK CONTA — ${month} ===`);
console.log(`Total lançamentos: ${contaTxs.length}`);
const contaIncome = sum(contaTxs.filter(t => t.amount > 0));
const contaExpense = sum(contaTxs.filter(t => t.amount < 0));
console.log(`Entradas: R$ ${contaIncome.toFixed(2)}`);
console.log(`Saídas:   R$ ${contaExpense.toFixed(2)}`);
console.log(`Líquido:  R$ ${(contaIncome - contaExpense).toFixed(2)}`);

db.close();
