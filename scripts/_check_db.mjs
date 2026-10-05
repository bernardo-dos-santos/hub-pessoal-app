import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('hub.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== TABELAS ===');
for (const t of tables) {
  const count = db.prepare(`SELECT COUNT(*) as n FROM "${t.name}"`).get();
  console.log(`${t.name}: ${count.n} rows`);
}

// Mostra sample do kv_store
console.log('\n=== KV_STORE (keys) ===');
try {
  const keys = db.prepare("SELECT key, length(value) as val_len FROM kv_store ORDER BY key").all();
  keys.forEach(r => console.log(`  ${r.key} (${r.val_len} chars)`));
} catch(e) { console.log('  (sem tabela kv_store)'); }

// Mostra tabela transactions se existir
console.log('\n=== TRANSACTIONS (últimas 5) ===');
try {
  const rows = db.prepare("SELECT id, description, amount, date, type FROM transactions ORDER BY date DESC LIMIT 5").all();
  rows.forEach(r => console.log(`  [${r.date}] ${r.type} R$${r.amount} — ${r.description}`));
} catch(e) { console.log('  (sem tabela transactions)'); }

db.close();
