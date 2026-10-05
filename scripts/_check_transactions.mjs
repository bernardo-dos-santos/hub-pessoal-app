import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('hub.db');

const row = db.prepare("SELECT value FROM kv_store WHERE key = 'finance.transactions'").get();
const transactions = JSON.parse(row.value);

const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const thisMonth = transactions.filter(t => t.date?.startsWith(month));

console.log(`=== TRANSAÇÕES DE ${month} ===`);
console.log(`Total: ${thisMonth.length}`);

const income = thisMonth.filter(t => t.amount > 0);
const expense = thisMonth.filter(t => t.amount < 0);

console.log(`  Entradas: ${income.length}`);
console.log(`  Saídas:   ${expense.length}`);

const totalIncome = income.reduce((s, t) => s + t.amount, 0);
const totalExpense = expense.reduce((s, t) => s + t.amount, 0);
const balance = totalIncome + totalExpense;

console.log(`\nSaldo do mês:`);
console.log(`  Entradas: R$ ${totalIncome.toFixed(2)}`);
console.log(`  Saídas:   R$ ${Math.abs(totalExpense).toFixed(2)}`);
console.log(`  Líquido:  R$ ${balance.toFixed(2)}`);

console.log(`\nÚltimas 5 transações do mês:`);
thisMonth.slice(-5).forEach(t => {
  const sinal = t.amount > 0 ? '+' : '';
  console.log(`  [${t.date}] ${sinal}R$${t.amount} — ${t.description} (${t.accountName ?? t.accountId ?? ''})`);
});

db.close();
