import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const legacyAppPath = path.join(projectRoot, "legacy", "finance-mvp", "app.js");
const appCode = fs.readFileSync(legacyAppPath, "utf8");

function makeElement(name = "") {
  return {
    name,
    value: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    required: false,
    dataset: {},
    style: {},
    classList: {
      toggle() {},
    },
    getAttribute(attribute) {
      return attribute === "href" ? this.href || "" : "";
    },
    addEventListener() {},
    removeEventListener() {},
    closest() {
      return null;
    },
    scrollIntoView() {},
    showModal() {},
    close() {},
    reset() {
      if (!this.elements) return;
      Object.values(this.elements).forEach((element) => {
        if ("value" in element) element.value = "";
      });
    },
  };
}

function createSandbox() {
  const elements = new Map();
  const storage = new Map();

  function getElement(selector) {
    if (!elements.has(selector)) {
      elements.set(selector, makeElement(selector));
    }
    return elements.get(selector);
  }

  const transactionForm = makeElement("#transactionForm");
  transactionForm.elements = {
    id: makeElement("id"),
    date: makeElement("date"),
    description: makeElement("description"),
    account: makeElement("account"),
    scope: makeElement("scope"),
    method: makeElement("method"),
    kind: makeElement("kind"),
    category: makeElement("category"),
    customCategory: makeElement("customCategory"),
    amount: makeElement("amount"),
  };
  elements.set("#transactionForm", transactionForm);
  const budgetForm = makeElement("#budgetForm");
  budgetForm.elements = {
    id: makeElement("id"),
    name: makeElement("name"),
    category: makeElement("category"),
    categories: makeElement("categories"),
    scope: makeElement("scope"),
    limit: makeElement("limit"),
  };
  elements.set("#budgetForm", budgetForm);

  const navLinks = ["#dashboard", "#transactions", "#budgets", "#assistant", "#analytics"].map(
    (href) => ({
      ...makeElement(`nav-${href}`),
      href,
      getAttribute(attribute) {
        return attribute === "href" ? href : "";
      },
    }),
  );

  const sandbox = {
    console,
    Intl,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Object,
    Array,
    Set,
    Map,
    JSON,
    RegExp,
    Error,
    NaN,
    isNaN,
    crypto: {
      randomUUID: () => `test-${Math.random().toString(16).slice(2)}`,
    },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
    },
    window: {
      confirm: () => true,
      addEventListener() {},
      location: {
        hash: "",
      },
    },
    document: {
      querySelector: getElement,
      querySelectorAll: (selector) => (selector === ".nav-list a" ? navLinks : []),
    },
    FormData: function FormData() {
      return [];
    },
  };

  sandbox.globalThis = sandbox;
  return sandbox;
}

function runInAppContext(source) {
  return vm.runInNewContext(`${appCode}\n${source}`, createSandbox(), {
    filename: "legacy/finance-mvp/app.js",
  });
}

function assertMoney(actual, expected, message) {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) < 0.01,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

const { totals, reviewCardPurchase } = runInAppContext(`
  state.selectedMonth = "2026-05";
  state.selectedView = "consolidada";
  state.selectedCategory = "";
  state.budgets = [];

  const transactions = [
    normalizeTransaction({
      date: "2026-05-01",
      description: "Pix recebido de pessoa desconhecida",
      amount: 1000,
      account: "Nubank Conta",
      kind: "review",
      category: incomeReviewCategory,
      method: "pix",
    }),
    normalizeTransaction({
      date: "2026-05-02",
      description: "Pix enviado para terceiro desconhecido",
      amount: -200,
      account: "Nubank Conta",
      kind: "expense",
      category: expenseReviewCategory,
      method: "pix",
    }),
    normalizeTransaction({
      date: "2026-05-03",
      description: "Pagamento de fatura",
      amount: -500,
      account: "Nubank Conta",
      kind: "card_payment",
      category: "Pagamento de fatura",
      method: "fatura",
    }),
    normalizeTransaction({
      date: "2026-05-04",
      description: "Pagamento recebido",
      amount: 500,
      account: "Nubank Cartao",
      kind: "card_payment_received",
      category: "Pagamento de fatura",
      method: "fatura",
    }),
    normalizeTransaction({
      date: "2026-05-05",
      description: "Compra no credito - Loja Teste",
      amount: -300,
      account: "Nubank Cartao",
      kind: "card_purchase",
      category: "Compras pessoais",
      method: "credito",
      source: "nubank_credit_card",
    }),
    normalizeTransaction({
      date: "2026-05-06",
      description: "Compra no credito - Loja sem regra",
      amount: -120,
      account: "Nubank Cartao",
      kind: "card_purchase",
      category: expenseReviewCategory,
      method: "credito",
      source: "nubank_credit_card",
    }),
    normalizeTransaction({
      date: "2026-05-07",
      description: "Transferencia enviada pelo Pix - Bernardo dos Santos Ferreira",
      amount: -400,
      account: "Nubank Conta",
      kind: "transfer",
      category: "Transferencia interna",
      method: "pix",
    }),
    normalizeTransaction({
      date: "2026-05-07",
      description: "Transferencia recebida pelo Pix - Bernardo dos Santos Ferreira",
      amount: 400,
      account: "C6 Empresa",
      kind: "transfer",
      category: "Transferencia interna",
      method: "pix",
    }),
  ];

  state.transactions = transactions;
  const totals = calculateTotals(getFilteredTransactions());

  ({
    totals,
    reviewCardPurchase: transactions[5],
  });
`);

assertMoney(totals.income, 0, "Entrada a revisar nao deve entrar em receitas reais");
assertMoney(totals.incomeReviewAmount, 1000, "Entrada a revisar deve aparecer como pendencia");
assertMoney(totals.expenseReviewAmount, 320, "Despesa a revisar deve aparecer como pendencia de saida");
assertMoney(totals.expenses, 620, "Despesa a revisar e compra no cartao devem entrar em despesas reais");
assertMoney(totals.cardPayments, 500, "Pagamento de fatura deve ser rastreado separado");
assertMoney(totals.cardPaymentReceived, 500, "Pagamento recebido na fatura deve ser rastreado separado");
assertMoney(totals.cardPurchases, 420, "Compras do cartao devem alimentar metricas do cartao");
assertMoney(totals.transfers, 800, "Transferencias internas devem ser rastreadas separado");
assert.equal(reviewCardPurchase.kind, "card_purchase", "Compra do cartao em Despesa a revisar deve continuar card_purchase");

const unknownPix = runInAppContext(`
  state.selectedMonth = "2026-05";
  state.selectedView = "consolidada";
  const outgoingDescription = "Transferencia enviada pelo Pix - Pessoa Desconhecida";
  const incomingDescription = "Transferencia recebida pelo Pix - Pessoa Desconhecida";
  state.transactions = [
    normalizeTransaction({
      date: "2026-05-10",
      description: outgoingDescription,
      originalDescription: outgoingDescription,
      amount: -90,
      account: "Nubank Conta",
      kind: inferNubankAccountKind(outgoingDescription, -90),
      category: inferNubankAccountCategory(outgoingDescription, -90, ""),
      method: "pix",
      source: "nubank_account",
    }),
    normalizeTransaction({
      date: "2026-05-10",
      description: incomingDescription,
      originalDescription: incomingDescription,
      amount: 90,
      account: "C6 Empresa",
      kind: "review",
      category: incomeReviewCategory,
      method: "pix",
      source: "c6_business",
    }),
  ];

  const linked = detectInternalTransfers();
  const transaction = state.transactions[0];

  ({
    linked,
    kind: transaction.kind,
    category: transaction.category,
    amount: transaction.amount,
  });
`);

assert.equal(unknownPix.linked, 0, "Pix para terceiro desconhecido nao deve virar transferencia interna");
assert.equal(unknownPix.kind, "expense", "Pix negativo para terceiro desconhecido deve ser despesa");
assert.equal(unknownPix.category, "Despesa a revisar", "Pix negativo para terceiro desconhecido deve cair em Despesa a revisar");
assertMoney(unknownPix.amount, -90, "Pix negativo deve preservar valor de saida");

const manualCategory = runInAppContext(`
  state.transactions = [
    normalizeTransaction({
      date: "2026-05-11",
      description: "Uber viagem",
      originalDescription: "Uber viagem",
      amount: -60,
      account: "Nubank Conta",
      kind: "expense",
      category: expenseReviewCategory,
      method: "pix",
      manualCategory: true,
    }),
  ];

  const reclassified = reclassifyReviewCategories();
  const transaction = state.transactions[0];

  ({
    reclassified,
    category: transaction.category,
    manualCategory: transaction.manualCategory,
  });
`);

assert.equal(manualCategory.reclassified, 0, "Categoria manual nao deve ser reclassificada");
assert.equal(manualCategory.category, "Despesa a revisar", "Categoria manual deve ser preservada");
assert.equal(manualCategory.manualCategory, true, "Marcador manualCategory deve ser preservado");

console.log("Finance rules check passed.");
