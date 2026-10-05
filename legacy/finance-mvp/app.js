const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const STORAGE_KEYS = {
  transactions: "finance.transactions",
  budgets: "finance.budgets",
  selectedMonth: "finance.selectedMonth",
  selectedView: "finance.selectedView",
};

const reviewCategory = "A revisar";
const incomeReviewCategory = "Entrada a revisar";
const expenseReviewCategory = "Despesa a revisar";
const reviewFilterKey = "__review_categories__";
const transferFilterKey = "__internal_transfers__";
const budgetFilterPrefix = "__budget__:";

const standardCategories = [
  "A revisar",
  "Entrada a revisar",
  "Despesa a revisar",
  "Alimentação fora",
  "Mercado",
  "Transporte",
  "Moradia",
  "Saúde",
  "Academia",
  "Lazer",
  "Lazer/Assinaturas",
  "Ferramentas/Software",
  "Beleza/Cuidados pessoais",
  "Pet",
  "Educação",
  "Impostos",
  "Impostos/Taxas",
  "Seguro",
  "Tarifas/Seguros",
  "Tarifas bancárias",
  "Compras pessoais",
  "Moradia/Casa",
  "Financiamento/Veículo",
  "Empréstimos",
  "Pagamento de fatura",
  "Transferência interna",
  "Transferência para pessoal",
  "Renda",
  "Outros",
];

const defaultAccounts = [
  {
    name: "Nubank Conta",
    institution: "Nubank",
    accountType: "checking",
    scope: "pessoal",
  },
  {
    name: "Nubank Cartão",
    institution: "Nubank",
    accountType: "credit_card",
    scope: "pessoal",
  },
  {
    name: "C6 Empresa",
    institution: "C6 Bank",
    accountType: "business_checking",
    scope: "empresa",
  },
  {
    name: "Dinheiro",
    institution: "Manual",
    accountType: "cash",
    scope: "pessoal",
  },
];

const paymentIntermediaries = [
  "mercado pago",
  "mercado pago ip",
  "pagar me",
  "pagar.me",
  "stone",
  "pay2all",
  "nu pagamentos",
  "itau unibanco",
  "itaú unibanco",
  "banco do brasil",
  "bco do brasil",
  "caixa economica",
  "caixa econômica",
];

const categoryRules = [
  {
    category: "Alimentação fora",
    keywords: [
      "ifood",
      "ifd",
      "restaurante",
      "lanche",
      "lanchonete",
      "lancheri",
      "hamburguer",
      "hamburgueria",
      "pizza",
      "pizzaria",
      "cafe",
      "conexao cafe",
      "conexão cafe",
      "cafeteria",
      "padaria",
      "piu buone",
      "temakeria",
      "subway",
      "malud comercio de choc",
      "chocolate",
      "acai",
      "açaí",
      "sorvete",
      "sushi",
      "bar",
    ],
  },
  {
    category: "Mercado",
    keywords: [
      "supermercados myata",
      "myata",
      "angeloni",
      "comercial zaffari",
      "zaffari",
      "giassi",
      "atacadao",
      "atacadão",
      "assai",
      "assaí",
      "bistek",
      "fort atacadista",
      "supermercado",
      "supermercados",
      "mercearia",
      "hortifruti",
      "açougue",
      "acougue",
    ],
  },
  {
    category: "Transporte",
    keywords: [
      "uber",
      "99",
      "auto posto",
      "posto universitario",
      "posto universitaario",
      "posto de gasolina",
      "gasolina",
      "estacionamento",
      "onibus",
      "ônibus",
      "pedagio",
      "pedágio",
    ],
  },
  {
    category: "Moradia",
    keywords: [
      "aluguel",
      "condominio",
      "condomínio",
      "luz",
      "energia",
      "agua",
      "água",
      "internet",
      "claro",
      "vivo",
      "tim",
    ],
  },
  {
    category: "Saúde",
    keywords: [
      "farmacia",
      "farmácia",
      "farmacia sao joao",
      "farmácia são joão",
      "remedio",
      "remédio",
      "drogaria",
      "saude",
      "saúde",
      "consulta",
      "exame",
    ],
  },
  {
    category: "Academia",
    keywords: ["academia", "fitness", "rc fitness", "phd"],
  },
  {
    category: "Lazer",
    keywords: ["spotify", "steam", "cinema", "cinemark", "jogo", "ingresso", "lazer"],
  },
  {
    category: "Lazer/Assinaturas",
    keywords: ["netflix"],
  },
  {
    category: "Ferramentas/Software",
    keywords: ["google chatgpt", "chatgpt", "google workspace", "workspace", "render.com", "render", "wattpad"],
  },
  {
    category: "Impostos",
    keywords: ["receita federal"],
  },
  {
    category: "Impostos/Taxas",
    keywords: ["iof", "iof de compra internacional"],
  },
  {
    category: "Seguro",
    keywords: ["suhai seguradora"],
  },
  {
    category: "Tarifas/Seguros",
    keywords: ["seguro conta c6"],
  },
  {
    category: "Tarifas bancárias",
    keywords: ["banco c6 s.a", "banco c6"],
  },
  {
    category: "Beleza/Cuidados pessoais",
    keywords: ["boticario", "oboticario", "o boticario", "hna*oboticario", "beleza", "cosmetico", "cosmético"],
  },
  {
    category: "Compras pessoais",
    keywords: ["sul fashion", "stafe bank", "bijuterias", "encanto das linhas"],
  },
  {
    category: "Moradia/Casa",
    keywords: ["lojas colombo", "colombo", "asteca construcao civil", "asteca construção civil"],
  },
  {
    category: "Pet",
    keywords: ["pet", "agrotudopet", "agro tudo pet"],
  },
  {
    category: "Financiamento/Veículo",
    keywords: ["banco pan", "auto pan", "financiamento", "parcela carro", "carro", "veiculo", "veículo"],
  },
  {
    category: "Pagamento de fatura",
    keywords: ["pagamento de fatura"],
  },
  {
    category: "Empréstimos",
    keywords: ["resgate de empréstimo", "resgate de emprestimo", "empréstimo", "emprestimo"],
  },
  {
    category: "Boleto",
    keywords: ["pagamento de boleto", "boleto efetuado"],
  },
  {
    category: "Estorno/Reembolso",
    keywords: ["estorno", "reembolso"],
  },
  {
    category: "Transferência recebida",
    keywords: [
      "transferência recebida",
      "transferencia recebida",
      "recebido pelo pix",
      "reembolso recebido pelo pix",
    ],
  },
  {
    category: "Transferência enviada",
    keywords: ["transferência enviada", "transferencia enviada", "enviada pelo pix"],
  },
  {
    category: "Renda",
    keywords: ["salario", "salário", "freelance", "pagamento empresa", "pró-labore", "pro labore"],
  },
  {
    category: "Educação",
    keywords: ["faculdade", "curso", "livro", "educacao", "educação"],
  },
];

const sampleTransactions = [
  {
    date: "2026-05-02",
    description: "Salario",
    account: "Nubank Conta",
    category: "Renda",
    amount: 7800,
    method: "outro",
    kind: "income",
  },
  {
    date: "2026-05-03",
    description: "Aluguel",
    account: "Nubank Conta",
    category: "Moradia",
    amount: -2200,
    method: "boleto",
    kind: "expense",
  },
  {
    date: "2026-05-04",
    description: "Supermercado",
    account: "Nubank Cartão",
    category: "Mercado",
    amount: -386.42,
    method: "credito",
    kind: "card_purchase",
  },
  {
    date: "2026-05-05",
    description: "Uber",
    account: "Nubank Cartão",
    category: "Transporte",
    amount: -42.9,
    method: "credito",
    kind: "card_purchase",
  },
  {
    date: "2026-05-08",
    description: "Internet",
    account: "Nubank Conta",
    category: "Moradia",
    amount: -129.9,
    method: "boleto",
    kind: "expense",
  },
  {
    date: "2026-05-11",
    description: "Restaurante",
    account: "Nubank Cartão",
    category: "Alimentação fora",
    amount: -118.5,
    method: "credito",
    kind: "card_purchase",
  },
  {
    date: "2026-05-12",
    description: "Farmacia",
    account: "Dinheiro",
    category: "Saúde",
    amount: -74.3,
    method: "outro",
    kind: "expense",
  },
  {
    date: "2026-05-15",
    description: "Freelance",
    account: "Nubank Conta",
    category: "Renda",
    amount: 950,
    method: "pix",
    kind: "income",
  },
  {
    date: "2026-05-16",
    description: "Cinema",
    account: "Nubank Cartão",
    category: "Lazer",
    amount: -86,
    method: "credito",
    kind: "card_purchase",
  },
  {
    date: "2026-05-17",
    description: "Academia",
    account: "Nubank Cartão",
    category: "Academia",
    amount: -139.9,
    method: "credito",
    kind: "card_purchase",
  },
];

const state = {
  transactions: migrateTransactions(load(STORAGE_KEYS.transactions, [])),
  budgets: migrateBudgets(load(STORAGE_KEYS.budgets, defaultBudgets())),
  selectedMonth: load(STORAGE_KEYS.selectedMonth, null),
  selectedView: load(STORAGE_KEYS.selectedView, "pessoal"),
  selectedCategory: "",
  showAllAnalyticsCategories: false,
};

state.selectedMonth = state.selectedMonth || getInitialMonth(state.transactions);

const elements = {
  monthFilter: document.querySelector("#monthFilter"),
  dashboardScope: document.querySelector("#dashboardScope"),
  csvProfile: document.querySelector("#csvProfile"),
  importStatus: document.querySelector("#importStatus"),
  balanceValue: document.querySelector("#balanceValue"),
  incomeValue: document.querySelector("#incomeValue"),
  incomeReviewValue: document.querySelector("#incomeReviewValue"),
  expenseValue: document.querySelector("#expenseValue"),
  expenseReviewValue: document.querySelector("#expenseReviewValue"),
  topCategoryValue: document.querySelector("#topCategoryValue"),
  cardPurchaseValue: document.querySelector("#cardPurchaseValue"),
  cardPaymentValue: document.querySelector("#cardPaymentValue"),
  budgetSummaryValue: document.querySelector("#budgetSummaryValue"),
  budgetSummaryStatus: document.querySelector("#budgetSummaryStatus"),
  incomeReviewFocusValue: document.querySelector("#incomeReviewFocusValue"),
  incomeReviewFocusCount: document.querySelector("#incomeReviewFocusCount"),
  expenseReviewFocusValue: document.querySelector("#expenseReviewFocusValue"),
  expenseReviewFocusCount: document.querySelector("#expenseReviewFocusCount"),
  navLinks: [...document.querySelectorAll(".nav-list a")],
  categoryCount: document.querySelector("#categoryCount"),
  categoryBars: document.querySelector("#categoryBars"),
  transactionSubtitle: document.querySelector("#transactionSubtitle"),
  categoryFilterSummary: document.querySelector("#categoryFilterSummary"),
  clearCategoryFilterButton: document.querySelector("#clearCategoryFilterButton"),
  analysisTopCategoryValue: document.querySelector("#analysisTopCategoryValue"),
  analysisTopCategoryText: document.querySelector("#analysisTopCategoryText"),
  analysisTopDayValue: document.querySelector("#analysisTopDayValue"),
  analysisTopDayText: document.querySelector("#analysisTopDayText"),
  analysisTransactionCount: document.querySelector("#analysisTransactionCount"),
  analysisExpenseReviewValue: document.querySelector("#analysisExpenseReviewValue"),
  analysisIncomeReviewValue: document.querySelector("#analysisIncomeReviewValue"),
  analysisTopExpenseValue: document.querySelector("#analysisTopExpenseValue"),
  analysisTopExpenseText: document.querySelector("#analysisTopExpenseText"),
  analyticsCategoryToggleButton: document.querySelector("#analyticsCategoryToggleButton"),
  analyticsCategoryBars: document.querySelector("#analyticsCategoryBars"),
  dailySpendBars: document.querySelector("#dailySpendBars"),
  topExpensesList: document.querySelector("#topExpensesList"),
  reviewIncomeCount: document.querySelector("#reviewIncomeCount"),
  reviewIncomeAmount: document.querySelector("#reviewIncomeAmount"),
  reviewExpenseCount: document.querySelector("#reviewExpenseCount"),
  reviewExpenseAmount: document.querySelector("#reviewExpenseAmount"),
  analyticsReadingList: document.querySelector("#analyticsReadingList"),
  transactionTable: document.querySelector("#transactionTable"),
  budgetList: document.querySelector("#budgetList"),
  budgetDialogTitle: document.querySelector("#budgetDialogTitle"),
  insightList: document.querySelector("#insightList"),
  assistantAnswer: document.querySelector("#assistantAnswer"),
  transactionDialog: document.querySelector("#transactionDialog"),
  transactionDialogTitle: document.querySelector("#transactionDialogTitle"),
  transactionForm: document.querySelector("#transactionForm"),
  budgetDialog: document.querySelector("#budgetDialog"),
};

elements.monthFilter.value = state.selectedMonth;
elements.dashboardScope.value = state.selectedView;
populateAccountOptions();
populateCategoryOptions();
populateBudgetCategoryOptions();
updateActiveNav();

window.addEventListener("hashchange", updateActiveNav);

elements.navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    setActiveNav(link.getAttribute("href"));
  });
});

elements.monthFilter.addEventListener("change", (event) => {
  state.selectedMonth = event.target.value || getCurrentMonth();
  persist();
  render();
});

elements.dashboardScope.addEventListener("change", (event) => {
  state.selectedView = event.target.value;
  persist();
  render();
});

elements.transactionForm.elements.account.addEventListener("change", () => {
  applyAccountDefaults(elements.transactionForm.elements.account.value);
});

elements.transactionForm.elements.category.addEventListener("change", () => {
  toggleCustomCategoryInput();
});

document.querySelector("#budgetForm").elements.category.addEventListener("change", (event) => {
  const form = event.currentTarget.form;
  form.elements.name.value = formatCategory(event.target.value);
});

document.querySelector("#reviewFilterButton").addEventListener("click", () => {
  setCategoryFilter(reviewFilterKey);
});

document.querySelector("#transferFilterButton").addEventListener("click", () => {
  setCategoryFilter(transferFilterKey);
  document.querySelector("#transactions").scrollIntoView({ behavior: "smooth" });
});

document.querySelector("#analyticsReviewButton").addEventListener("click", () => {
  setCategoryFilter(reviewFilterKey);
  document.querySelector("#transactions").scrollIntoView({ behavior: "smooth" });
});

elements.clearCategoryFilterButton.addEventListener("click", () => {
  setCategoryFilter("");
});

elements.analyticsCategoryToggleButton.addEventListener("click", () => {
  state.showAllAnalyticsCategories = !state.showAllAnalyticsCategories;
  render();
});

document.querySelector("#seedButton").addEventListener("click", () => {
  const result = appendTransactions(
    sampleTransactions.map((transaction) =>
      normalizeTransaction({ ...transaction, source: "sample" }),
    ),
  );
  state.selectedMonth = "2026-05";
  elements.monthFilter.value = state.selectedMonth;
  setImportStatus(`Exemplo carregado: ${result.added} novas, ${result.skipped} duplicadas.`);
  persist();
  render();
});

document.querySelector("#clearDataButton").addEventListener("click", () => {
  const confirmed = window.confirm("Limpar todos os dados locais do Finance App?");
  if (!confirmed) return;

  state.transactions = [];
  state.budgets = defaultBudgets();
  state.selectedMonth = getCurrentMonth();
  elements.monthFilter.value = state.selectedMonth;
  elements.assistantAnswer.textContent = "";
  setImportStatus("Dados locais limpos.");
  persist();
  render();
});

document.querySelector("#reclassifyButton").addEventListener("click", () => {
  const reclassified = reclassifyReviewCategories();
  setImportStatus(`${reclassified} transacoes reclassificadas.`);
  persist();
  render();
});

document.querySelector("#detectTransfersButton").addEventListener("click", () => {
  const linked = detectInternalTransfers();
  setImportStatus(`${linked} pares de transfer?ncias internas detectados.`);
  persist();
  render();
});

document.querySelector("#addTransactionButton").addEventListener("click", () => {
  openTransactionDialog();
});

document.querySelector("#addBudgetButton").addEventListener("click", () => {
  openBudgetDialog();
});

elements.budgetList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-budget-action]");
  if (!button) return;
  const budget = state.budgets.find((item) => item.id === button.dataset.id);
  if (!budget) return;

  if (button.dataset.budgetAction === "view") {
    setCategoryFilter(`${budgetFilterPrefix}${budget.id}`);
    document.querySelector("#transactions").scrollIntoView({ behavior: "smooth" });
  }

  if (button.dataset.budgetAction === "edit") {
    openBudgetDialog(budget);
  }

  if (button.dataset.budgetAction === "delete") {
    const confirmed = window.confirm(`Excluir orçamento "${budget.name}"? As transações serão mantidas.`);
    if (!confirmed) return;
    state.budgets = state.budgets.filter((item) => item.id !== budget.id);
    setImportStatus("Orçamento excluído.");
    persist();
    render();
  }
});

elements.transactionTable.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const transaction = state.transactions.find((item) => item.id === button.dataset.id);
  if (!transaction) return;

  if (button.dataset.action === "edit") {
    openTransactionDialog(transaction);
  }

  if (button.dataset.action === "delete") {
    const confirmed = window.confirm(`Excluir "${transaction.description}"?`);
    if (!confirmed) return;
    state.transactions = state.transactions.filter((item) => item.id !== transaction.id);
    setImportStatus("Transação excluída.");
    persist();
    render();
  }
});

elements.categoryBars.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  setCategoryFilter(button.dataset.category || "");
});

elements.analyticsCategoryBars.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  setCategoryFilter(button.dataset.category || "");
  document.querySelector("#transactions").scrollIntoView({ behavior: "smooth" });
});

elements.transactionForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();

  const data = Object.fromEntries(new FormData(event.currentTarget));
  const existing = state.transactions.find((item) => item.id === data.id);
  const selectedCategory =
    data.category === "__custom__" ? data.customCategory.trim() || reviewCategory : data.category;
  const manualCategory = existing
    ? existing.manualCategory || selectedCategory !== existing.category
    : true;
  const submittedAmount = Number(data.amount);
  const submittedKind = getManualKind(data.kind, selectedCategory, submittedAmount, existing);
  const transaction = normalizeTransaction({
    id: data.id || undefined,
    date: data.date,
    description: data.description,
    originalDescription: existing?.originalDescription || data.description,
    account: data.account,
    scope: data.scope,
    method: data.method,
    kind: submittedKind,
    category: selectedCategory,
    amount: data.amount,
    source: existing?.source || "manual",
    manualCategory,
    linkedTransferId: existing?.linkedTransferId || "",
  });

  if (data.id) {
    state.transactions = state.transactions.map((item) =>
      item.id === data.id ? transaction : item,
    );
    setImportStatus("Transa??o atualizada.");
  } else {
    state.transactions.push(transaction);
    setImportStatus("Transa??o adicionada.");
  }

  state.selectedMonth = getMonthKey(transaction.date);
  elements.monthFilter.value = state.selectedMonth;
  event.currentTarget.reset();
  elements.transactionDialog.close();
  persist();
  render();
});

document.querySelector("#budgetForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const categories = getBudgetCategoriesFromForm(data);
  const budget = normalizeBudget({
    id: data.id || undefined,
    name: data.name || data.category,
    category: data.category,
    categories,
    limit: data.limit,
    scope: data.scope,
  });
  if (data.id) {
    state.budgets = state.budgets.map((item) => (item.id === data.id ? budget : item));
    setImportStatus("Orçamento atualizado.");
  } else {
    state.budgets.push(budget);
    setImportStatus("Orçamento criado.");
  }
  event.currentTarget.reset();
  elements.budgetDialog.close();
  persist();
  render();
});

document.querySelector("#csvInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = parseCsv(text, elements.csvProfile.value);
    const removedSamples = removeSampleTransactions();
    const result = appendTransactions(imported);
    if (result.added > 0) {
      state.selectedMonth = getInitialMonth(imported);
      elements.monthFilter.value = state.selectedMonth;
    }
    setImportStatus(
      `Importacao concluida: ${result.added} novas, ${result.skipped} duplicadas, ${removedSamples} exemplos removidos.`,
    );
    persist();
    render();
  } catch (error) {
    setImportStatus(error.message || "Nao foi possivel importar o CSV.");
  }

  event.target.value = "";
});

document.querySelector("#assistantForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const question = document.querySelector("#assistantInput").value.trim();
  elements.assistantAnswer.textContent = answerQuestion(question);
});

persist();
render();

function updateActiveNav() {
  setActiveNav(window.location.hash || "#dashboard");
}

function setActiveNav(hash) {
  const target = hash || "#dashboard";
  elements.navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === target);
  });
}

function render() {
  const transactions = getFilteredTransactions();
  const totals = calculateTotals(transactions);
  const visibleTransactions = getVisibleTransactions(transactions);
  elements.balanceValue.textContent = currency.format(totals.net);
  elements.incomeValue.textContent = currency.format(totals.income);
  elements.incomeReviewValue.textContent = currency.format(totals.incomeReviewAmount);
  elements.expenseValue.textContent = currency.format(totals.expenses);
  elements.expenseReviewValue.textContent = currency.format(totals.expenseReviewAmount);
  elements.topCategoryValue.textContent = currency.format(totals.transfers);
  elements.cardPurchaseValue.textContent = currency.format(totals.cardPurchases);
  elements.cardPaymentValue.textContent = currency.format(totals.cardPayments);
  const budgetSummary = getBudgetSummary(transactions);
  elements.budgetSummaryValue.textContent = `${budgetSummary.active} ativos`;
  elements.budgetSummaryStatus.textContent =
    `${budgetSummary.inside} dentro - ${budgetSummary.attention} atenção - ${budgetSummary.over} estourados`;
  elements.incomeReviewFocusValue.textContent = currency.format(totals.incomeReviewAmount);
  elements.incomeReviewFocusCount.textContent = formatCount(totals.incomeReviewCount);
  elements.expenseReviewFocusValue.textContent = currency.format(totals.expenseReviewAmount);
  elements.expenseReviewFocusCount.textContent = formatCount(totals.expenseReviewCount);
  renderCategories(totals.categoryExpenses);
  renderCategoryFilterSummary(transactions);
  renderTransactions(visibleTransactions);
  renderBudgets(transactions);
  renderInsights(totals, transactions);
  renderAnalytics(transactions, totals);
}

function calculateTotals(transactions) {
  const totals = transactions.reduce(
    (acc, item) => {
      if (item.kind === "income" && !isReviewCategory(item.category)) {
        acc.income += Math.abs(item.amount);
      }

      if (normalize(item.category) === normalize(incomeReviewCategory)) {
        acc.incomeReviewAmount += Math.abs(item.amount);
        acc.incomeReviewCount += 1;
      }

      if (normalize(item.category) === normalize(expenseReviewCategory)) {
        acc.expenseReviewAmount += Math.abs(item.amount);
        acc.expenseReviewCount += 1;
      }

      if (item.kind === "expense" || item.kind === "card_purchase") {
        acc.expenses += Math.abs(item.amount);
        acc.categoryExpenses[item.category] =
          (acc.categoryExpenses[item.category] || 0) + Math.abs(item.amount);
      }

      if (item.kind === "refund") {
        acc.refunds += Math.abs(item.amount);
      }

      if (item.kind === "transfer") {
        acc.transfers += Math.abs(item.amount);
      }

      if (item.kind === "card_payment") {
        acc.cardPayments += Math.abs(item.amount);
      }

      if (item.kind === "card_payment_received") {
        acc.cardPaymentReceived += Math.abs(item.amount);
      }

      if (item.kind === "card_purchase" && isCreditCardTransaction(item)) {
        acc.cardPurchases += Math.abs(item.amount);
      }

      if (item.kind === "refund" && isCreditCardTransaction(item)) {
        acc.cardRefunds += Math.abs(item.amount);
      }

      return acc;
    },
    {
      income: 0,
      expenses: 0,
      refunds: 0,
      transfers: 0,
      cardPayments: 0,
      cardPaymentReceived: 0,
      cardPurchases: 0,
      cardRefunds: 0,
      incomeReviewAmount: 0,
      incomeReviewCount: 0,
      expenseReviewAmount: 0,
      expenseReviewCount: 0,
      categoryExpenses: {},
    },
  );

  const topCategory =
    Object.entries(totals.categoryExpenses).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  return {
    ...totals,
    net: totals.income + totals.refunds - totals.expenses,
    cardNetMovement: totals.cardPurchases - totals.cardRefunds - totals.cardPaymentReceived,
    topCategory,
  };
}

function renderCategories(categoryExpenses) {
  const entries = Object.entries(categoryExpenses).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, amount]) => amount), 1);
  elements.categoryCount.textContent = `${entries.length} categorias`;
  elements.categoryBars.innerHTML =
    entries
      .map(([category, amount]) => {
        const width = Math.max((amount / max) * 100, 4);
        return `
          <div class="bar-row">
            <div class="bar-meta">
              <button class="category-chip" type="button" data-category="${escapeHtml(category)}">${escapeHtml(formatCategory(category))}</button>
              <span>${currency.format(amount)}</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          </div>
        `;
      })
      .join("") || emptyState("Importe transações para ver categorias neste período.");
}

function renderCategoryFilterSummary(transactions) {
  if (!state.selectedCategory) {
    elements.transactionSubtitle.textContent =
      "Use perfis para Nubank Conta, Nubank Fatura Cart\u00e3o ou CSV gen\u00e9rico";
    elements.categoryFilterSummary.hidden = true;
    elements.clearCategoryFilterButton.hidden = true;
    return;
  }
  const filtered = getVisibleTransactions(transactions);
  const total = filtered.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const label = getCategoryFilterLabel();
  elements.transactionSubtitle.textContent = `Transa\u00e7\u00f5es em ${label}`;
  elements.categoryFilterSummary.hidden = false;
  if (state.selectedCategory === reviewFilterKey) {
    const incomeReview = filtered.filter((item) => normalize(item.category) === normalize(incomeReviewCategory));
    const expenseReview = filtered.filter((item) => normalize(item.category) === normalize(expenseReviewCategory));
    const netReview = sumAbsolute(incomeReview) - sumAbsolute(expenseReview);
    elements.categoryFilterSummary.innerHTML = `
      <strong>${filtered.length} transa\u00e7\u00f5es a revisar</strong>
      <span>Entradas: ${incomeReview.length} - ${currency.format(sumAbsolute(incomeReview))}</span>
      <span>Despesas: ${expenseReview.length} - ${currency.format(sumAbsolute(expenseReview))}</span>
      <span>Saldo l\u00edquido das revis\u00f5es: ${currency.format(netReview)}</span>
    `;
  } else if (state.selectedCategory === transferFilterKey) {
    elements.categoryFilterSummary.textContent = `${filtered.length} transfer\u00eancias internas - Total ${currency.format(total)}`;
  } else if (isBudgetFilter(state.selectedCategory)) {
    const budget = getBudgetByFilter(state.selectedCategory);
    elements.categoryFilterSummary.textContent = `Transa\u00e7\u00f5es do or\u00e7amento: ${budget ? budget.name : "Or\u00e7amento"} - ${filtered.length} lan\u00e7amentos - Total ${currency.format(total)}`;
  } else {
    elements.categoryFilterSummary.textContent = `${filtered.length} transa\u00e7\u00f5es em ${label} - Total ${currency.format(total)}`;
  }
  elements.clearCategoryFilterButton.hidden = false;
}

function setCategoryFilter(category) {
  state.selectedCategory = category;
  render();
}

function getVisibleTransactions(transactions) {
  if (!state.selectedCategory) return transactions;
  if (state.selectedCategory === reviewFilterKey) {
    return transactions.filter((item) => isReviewCategory(item.category));
  }
  if (state.selectedCategory === transferFilterKey) {
    return transactions.filter((item) => item.kind === "transfer");
  }
  if (isBudgetFilter(state.selectedCategory)) {
    const budget = getBudgetByFilter(state.selectedCategory);
    if (!budget) return [];
    return transactions.filter((item) => transactionMatchesBudget(item, budget));
  }
  return transactions.filter((item) => normalize(item.category) === normalize(state.selectedCategory));
}

function getCategoryFilterLabel() {
  if (state.selectedCategory === reviewFilterKey) return "categorias a revisar";
  if (state.selectedCategory === transferFilterKey) return "transfer?ncias internas";
  if (isBudgetFilter(state.selectedCategory)) {
    const budget = getBudgetByFilter(state.selectedCategory);
    return budget ? `orçamento: ${budget.name}` : "orçamento";
  }
  return state.selectedCategory;
}

function renderTransactions(transactions) {
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  elements.transactionTable.innerHTML =
    sorted
      .map((item) => {
        const amountClass = item.amount < 0 ? "amount-negative" : "amount-positive";
        const reviewNote = getReviewNote(item);
        return `
          <tr class="${getReviewRowClass(item)}">
            <td data-label="Data">${formatDate(item.date)}</td>
            <td data-label="Descricao">
              <strong>${escapeHtml(item.description)}</strong>
              ${reviewNote ? `<span class="review-note">${escapeHtml(reviewNote)}</span>` : ""}
            </td>
            <td data-label="Conta"><span class="data-chip chip-account">${escapeHtml(item.account)}</span></td>
            <td data-label="Escopo"><span class="data-chip chip-scope">${escapeHtml(item.scope)}</span></td>
            <td data-label="Metodo"><span class="data-chip chip-method">${escapeHtml(formatMethod(item.method))}</span></td>
            <td data-label="Tipo"><span class="data-chip ${getKindChipClass(item.kind)}">${escapeHtml(formatKind(item.kind))}</span></td>
            <td data-label="Categoria"><span class="data-chip ${getCategoryChipClass(item.category)}">${escapeHtml(formatCategory(item.category))}</span></td>
            <td data-label="Valor" class="${amountClass}">${currency.format(item.amount)}</td>
            <td data-label="Acoes">
              <div class="action-cell">
                <button type="button" data-action="edit" data-id="${item.id}">Editar</button>
                <button class="danger-button" type="button" data-action="delete" data-id="${item.id}">Excluir</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("") ||
    `<tr><td colspan="9">${emptyState("Nenhuma transa??o neste per?odo.")}</td></tr>`;
}

function formatCount(count) {
  return `${count} ${count === 1 ? "lançamento" : "lançamentos"}`;
}

function getKindChipClass(kind) {
  return {
    income: "chip-income",
    expense: "chip-expense",
    transfer: "chip-transfer",
    card_purchase: "chip-card",
    card_payment: "chip-payment",
    card_payment_received: "chip-payment",
    refund: "chip-refund",
    review: "chip-review",
  }[kind] || "chip-neutral";
}

function getCategoryChipClass(category) {
  if (normalize(category) === normalize(incomeReviewCategory)) return "chip-review-income";
  if (normalize(category) === normalize(expenseReviewCategory)) return "chip-review-expense";
  if (normalize(category).includes("transferencia")) return "chip-transfer";
  if (normalize(category).includes("pagamento de fatura")) return "chip-payment";
  return "chip-category";
}

function getReviewNote(transaction) {
  if (normalize(transaction.category) === normalize(incomeReviewCategory)) {
    return "Esta entrada ainda não conta como receita real até ser revisada.";
  }
  if (normalize(transaction.category) === normalize(expenseReviewCategory)) {
    return "Esta saída conta como despesa, mas precisa de categoria.";
  }
  return "";
}

function getReviewRowClass(transaction) {
  if (normalize(transaction.category) === normalize(incomeReviewCategory)) return "review-income-row";
  if (normalize(transaction.category) === normalize(expenseReviewCategory)) return "review-expense-row";
  return "";
}

function renderBudgets(transactions) {
  const summaries = getVisibleBudgets().map((budget) => getBudgetProgress(budget, transactions));
  elements.budgetList.innerHTML =
    summaries
      .map(({ budget, spent, remaining, percent, capped, status, statusText }) => `
        <div class="budget-item budget-${status}">
          <div class="budget-line">
            <div>
              <strong>${escapeHtml(budget.name)}</strong>
              <span>${escapeHtml(getBudgetCategoryLabel(budget))}</span>
            </div>
            <span>${currency.format(spent)} / ${currency.format(budget.limit)}</span>
          </div>
          <div class="budget-meta">
            <span>Limite mensal: ${currency.format(budget.limit)}</span>
            <span>${remaining >= 0 ? "Restante" : "Estourou"}: ${currency.format(Math.abs(remaining))}</span>
            <span>${Math.round(percent)}% usado</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${capped}%"></div></div>
          <div class="budget-footer">
            <span class="budget-status">${statusText}</span>
            <div class="budget-actions">
              <button type="button" data-budget-action="view" data-id="${budget.id}">Ver transações</button>
              <button type="button" data-budget-action="edit" data-id="${budget.id}">Editar</button>
              <button class="danger-button" type="button" data-budget-action="delete" data-id="${budget.id}">Excluir</button>
            </div>
          </div>
        </div>
      `)
      .join("") || emptyState("Nenhum orçamento ativo para esta visão.");
}

function renderInsights(totals, transactions) {
  const insights = [];
  if (!transactions.length) {
    insights.push("Carregue transações para receber insights financeiros neste período.");
  } else {
    insights.push(`Resultado real no período: ${currency.format(totals.net)}.`);
    if (totals.incomeReviewAmount) {
      insights.push(`Há ${currency.format(totals.incomeReviewAmount)} em entradas pendentes que ainda não contam como receita real.`);
    }
    if (totals.expenseReviewAmount) {
      insights.push(`Há ${currency.format(totals.expenseReviewAmount)} em despesas a revisar que já entram nas despesas reais.`);
    }
    insights.push(`Pagamentos de fatura ignorados como nova despesa: ${currency.format(totals.cardPayments)}.`);
    insights.push(`Compras no cartão no período: ${currency.format(totals.cardPurchases)}.`);
    if (totals.cardPaymentReceived) {
      insights.push(`Pagamentos recebidos na fatura: ${currency.format(totals.cardPaymentReceived)}.`);
    }
    insights.push(`Movimento líquido da fatura no período: ${currency.format(totals.cardNetMovement)}.`);
    if (totals.transfers) {
      insights.push(`Transferências internas/retiradas separadas: ${currency.format(totals.transfers)}.`);
    }
    if (totals.topCategory) {
      insights.push(`A maior categoria de gasto real foi ${totals.topCategory}.`);
    }
  }
  elements.insightList.innerHTML = insights
    .map((insight) => `<div class="insight-item">${escapeHtml(insight)}</div>`)
    .join("");
}

function renderAnalytics(transactions, totals) {
  renderAnalysisSummary(transactions, totals);
  renderAnalyticsCategoryBars(totals.categoryExpenses);
  renderDailySpendBars(transactions);
  renderTopExpensesDetailed(transactions);
  renderReviewCardDetailed(transactions);
  renderAnalyticsReading(transactions, totals);
}

function renderAnalysisSummary(transactions, totals) {
  const realExpenses = getRealExpenseTransactions(transactions);
  const topExpense = getTopExpense(realExpenses);
  const topDay = getTopSpendDay(realExpenses);
  const topCategory = getTopCategoryEntry(totals.categoryExpenses);

  elements.analysisTopCategoryValue.textContent = topCategory ? formatCategory(topCategory[0]) : "Sem gastos";
  elements.analysisTopCategoryText.textContent = topCategory
    ? "Essa foi a categoria que mais consumiu dinheiro no período."
    : "Importe ou cadastre despesas para ver a categoria principal.";
  elements.analysisTopDayValue.textContent = topDay ? `Dia ${topDay.day}` : "Sem gastos";
  elements.analysisTopDayText.textContent = topDay
    ? `${currency.format(topDay.amount)} concentrados nesse dia.`
    : "Ainda não há gastos reais para comparar dias.";
  elements.analysisTransactionCount.textContent = `${transactions.length}`;
  elements.analysisExpenseReviewValue.textContent = currency.format(totals.expenseReviewAmount);
  elements.analysisIncomeReviewValue.textContent = currency.format(totals.incomeReviewAmount);
  elements.analysisTopExpenseValue.textContent = topExpense
    ? currency.format(Math.abs(topExpense.amount))
    : "Sem gastos";
  elements.analysisTopExpenseText.textContent = topExpense
    ? `${topExpense.description} em ${formatDate(topExpense.date)}.`
    : "Ainda não há despesa real individual no período.";
}

function renderAnalyticsCategoryBars(categoryExpenses) {
  const entries = Object.entries(categoryExpenses).sort((a, b) => b[1] - a[1]);
  const visibleEntries = state.showAllAnalyticsCategories ? entries : entries.slice(0, 8);
  const totalExpenses = entries.reduce((sum, [, amount]) => sum + amount, 0);
  const max = Math.max(...entries.map(([, amount]) => amount), 1);
  elements.analyticsCategoryToggleButton.hidden = entries.length <= 8;
  elements.analyticsCategoryToggleButton.textContent = state.showAllAnalyticsCategories
    ? "Ver top 8"
    : "Ver todas";
  elements.analyticsCategoryBars.innerHTML =
    visibleEntries
      .map(([category, amount]) => {
        const width = Math.max((amount / max) * 100, 4);
        const percent = totalExpenses ? (amount / totalExpenses) * 100 : 0;
        return `
          <button class="bar-row analytics-category-row" type="button" data-category="${escapeHtml(category)}">
            <div class="bar-meta">
              <span>${escapeHtml(formatCategory(category))}</span>
              <strong>${currency.format(amount)} - ${percent.toFixed(0)}%</strong>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          </button>
        `;
      })
      .join("") || emptyState("Sem gastos reais no período.");
}

function renderDailySpendBars(transactions) {
  const daily = getRealExpenseTransactions(transactions).reduce((acc, item) => {
    const day = item.date.slice(-2);
    acc[day] = (acc[day] || 0) + Math.abs(item.amount);
    return acc;
  }, {});
  const entries = Object.entries(daily).sort(([first], [second]) => first.localeCompare(second));
  const max = Math.max(...entries.map(([, amount]) => amount), 1);
  elements.dailySpendBars.innerHTML =
    entries
      .map(([day, amount]) => {
        const height = Math.max((amount / max) * 100, 8);
        const peakClass = amount === max ? "daily-peak" : "";
        return `
          <button class="daily-bar ${peakClass}" type="button" title="Dia ${day}: ${currency.format(amount)}">
            <div class="daily-fill" style="height:${height}%"></div>
            <strong>${currency.format(amount)}</strong>
            <span>${day}</span>
          </button>
        `;
      })
      .join("") || emptyState("Sem gastos por dia no período.");
}

function renderTopExpenses(transactions) {
  const expenses = getRealExpenseTransactions(transactions)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 10);
  elements.topExpensesList.innerHTML =
    expenses
      .map(
        (item) => `
          <div class="rank-item">
            <div>
              <strong>${escapeHtml(item.description)}</strong>
              <span>${escapeHtml(item.category)} - ${escapeHtml(item.account)}</span>
            </div>
            <strong>${currency.format(Math.abs(item.amount))}</strong>
          </div>
        `,
      )
      .join("") || emptyState("Sem despesas reais no período.");
}

function renderTopExpensesDetailed(transactions) {
  const expenses = getRealExpenseTransactions(transactions)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 10);
  elements.topExpensesList.innerHTML =
    expenses
      .map((item) => {
        const needsReview = normalize(item.category) === normalize(expenseReviewCategory);
        return `
          <div class="rank-item ${needsReview ? "rank-review" : ""}">
            <div>
              <strong>${escapeHtml(item.description)}</strong>
              <span>${escapeHtml(formatCategory(item.category))} - ${escapeHtml(item.account)} - ${formatDate(item.date)}</span>
              ${needsReview ? "<em>Precisa de revisão</em>" : ""}
            </div>
            <strong>${currency.format(Math.abs(item.amount))}</strong>
          </div>
        `;
      })
      .join("") || emptyState("Sem despesas reais no período.");
}

function renderReviewCard(transactions) {
  const reviewTransactions = transactions.filter((item) => isReviewCategory(item.category));
  const incomeReview = reviewTransactions.filter(
    (item) => normalize(item.category) === normalize(incomeReviewCategory),
  );
  const expenseReview = reviewTransactions.filter(
    (item) => normalize(item.category) === normalize(expenseReviewCategory),
  );
  elements.reviewCount.textContent = `${reviewTransactions.length}`;
  elements.reviewAmount.innerHTML = `
    Entradas: ${incomeReview.length} - ${currency.format(sumAbsolute(incomeReview))}
    <br />
    Despesas: ${expenseReview.length} - ${currency.format(sumAbsolute(expenseReview))}
  `;
}

function renderReviewCardDetailed(transactions) {
  const reviewTransactions = transactions.filter((item) => isReviewCategory(item.category));
  const incomeReview = reviewTransactions.filter(
    (item) => normalize(item.category) === normalize(incomeReviewCategory),
  );
  const expenseReview = reviewTransactions.filter(
    (item) => normalize(item.category) === normalize(expenseReviewCategory),
  );
  elements.reviewIncomeCount.textContent = `${incomeReview.length}`;
  elements.reviewIncomeAmount.textContent = currency.format(sumAbsolute(incomeReview));
  elements.reviewExpenseCount.textContent = `${expenseReview.length}`;
  elements.reviewExpenseAmount.textContent = currency.format(sumAbsolute(expenseReview));
}

function getRealExpenseTransactions(transactions) {
  return transactions.filter((item) => item.kind === "expense" || item.kind === "card_purchase");
}

function renderAnalyticsReading(transactions, totals) {
  const realExpenses = getRealExpenseTransactions(transactions);
  const topExpense = getTopExpense(realExpenses);
  const topCategory = getTopCategoryEntry(totals.categoryExpenses);
  const insights = [];

  if (topCategory) {
    insights.push(`Sua maior categoria de gasto foi ${formatCategory(topCategory[0])}, com ${currency.format(topCategory[1])}.`);
  }
  if (topExpense) {
    insights.push(`O maior gasto individual foi ${topExpense.description}, de ${currency.format(Math.abs(topExpense.amount))}.`);
  }
  if (totals.expenseReviewAmount) {
    insights.push(`Há ${currency.format(totals.expenseReviewAmount)} em despesas a revisar.`);
  }
  if (totals.incomeReviewAmount) {
    insights.push(`Há ${currency.format(totals.incomeReviewAmount)} em entradas pendentes que ainda não contam como receita.`);
  }
  insights.push(
    `Seu resultado real no período foi ${totals.net < 0 ? "negativo" : "positivo"} em ${currency.format(Math.abs(totals.net))}.`,
  );

  const overBudget = state.budgets.find((budget) => {
    const spent = totals.categoryExpenses[budget.category] || 0;
    return budget.limit > 0 && spent > budget.limit;
  });
  if (overBudget) {
    insights.push(`${overBudget.category} passou do orçamento definido para o período.`);
  }

  elements.analyticsReadingList.innerHTML = insights
    .map((insight) => `<div class="reading-item">${escapeHtml(insight)}</div>`)
    .join("");
}

function getTopCategoryEntry(categoryExpenses) {
  return Object.entries(categoryExpenses).sort((a, b) => b[1] - a[1])[0] || null;
}

function getTopExpense(expenses) {
  return [...expenses].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0] || null;
}

function getTopSpendDay(expenses) {
  const daily = expenses.reduce((acc, item) => {
    const day = item.date.slice(-2);
    acc[day] = (acc[day] || 0) + Math.abs(item.amount);
    return acc;
  }, {});
  const [day, amount] = Object.entries(daily).sort((a, b) => b[1] - a[1])[0] || [];
  return day ? { day, amount } : null;
}

function answerQuestion(question) {
  if (!question) return "Digite uma pergunta sobre seus gastos.";
  const normalized = normalize(question);
  const totals = calculateTotals(getFilteredTransactions());
  const matchedCategory = Object.keys(totals.categoryExpenses).find((category) =>
    normalized.includes(normalize(category)),
  );
  if (matchedCategory) {
    return `Você gastou ${currency.format(totals.categoryExpenses[matchedCategory])} com ${matchedCategory} no período selecionado.`;
  }
  if (normalized.includes("fatura")) {
    return `Pagamentos de fatura somam ${currency.format(totals.cardPayments)} na conta e ${currency.format(totals.cardPaymentReceived)} no cartão; nenhum entra como receita ou despesa real.`;
  }
  if (normalized.includes("transfer")) {
    return `Transferencias separadas somam ${currency.format(totals.transfers)}.`;
  }
  if (normalized.includes("saldo") || normalized.includes("resultado")) {
    return `Seu resultado real no período selecionado é ${currency.format(totals.net)}.`;
  }
  if (normalized.includes("entrada") || normalized.includes("receita")) {
    return `Suas receitas reais no período selecionado somam ${currency.format(totals.income)}.`;
  }
  if (normalized.includes("gastei") || normalized.includes("saida") || normalized.includes("despesa")) {
    return `Suas despesas reais no período selecionado somam ${currency.format(totals.expenses)}.`;
  }
  return "Ainda sou uma IA local simples. Pergunte sobre resultado, receitas, despesas, fatura, transferencias ou uma categoria cadastrada.";
}

function openTransactionDialog(transaction) {
  elements.transactionForm.reset();
  elements.transactionDialogTitle.textContent = transaction ? "Editar transação" : "Nova transação";

  if (transaction) {
    elements.transactionForm.elements.id.value = transaction.id;
    elements.transactionForm.elements.date.value = transaction.date;
    elements.transactionForm.elements.description.value = transaction.description;
    elements.transactionForm.elements.account.value = transaction.account;
    elements.transactionForm.elements.scope.value = transaction.scope;
    elements.transactionForm.elements.method.value = transaction.method;
    elements.transactionForm.elements.kind.value = transaction.kind;
    setCategoryInput(transaction.category);
    elements.transactionForm.elements.amount.value = transaction.amount;
  } else {
    const [year, month] = state.selectedMonth.split("-");
    elements.transactionForm.elements.date.value = `${year}-${month}-01`;
    elements.transactionForm.elements.account.value = "Nubank Conta";
    elements.transactionForm.elements.method.value = "outro";
    elements.transactionForm.elements.kind.value = "expense";
    setCategoryInput(reviewCategory);
    applyAccountDefaults("Nubank Conta");
  }

  elements.transactionDialog.showModal();
}

function openBudgetDialog(budget) {
  const form = document.querySelector("#budgetForm");
  form.reset();
  elements.budgetDialogTitle.textContent = budget ? "Editar orçamento" : "Novo orçamento";
  form.elements.id.value = budget?.id || "";
  form.elements.category.value = budget?.category || "Alimentação fora";
  form.elements.name.value = budget?.name || formatCategory(form.elements.category.value);
  form.elements.limit.value = budget?.limit || "";
  form.elements.scope.value = budget?.scope || "pessoal";
  form.elements.categories.value = budget?.categories?.join(", ") || "";
  elements.budgetDialog.showModal();
}

function getBudgetCategoriesFromForm(data) {
  const optionalCategories = String(data.categories || "")
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);
  return [...new Set([data.category, ...optionalCategories].filter(Boolean))];
}

function createDefaultBudget(category, limit, scope) {
  return normalizeBudget({ name: category, category, categories: [category], limit, scope });
}

function normalizeBudget(budget) {
  const category = normalizeCategoryAlias(budget.category || budget.name || "Alimentação fora");
  const categories = Array.isArray(budget.categories)
    ? budget.categories.map(normalizeCategoryAlias).filter(Boolean)
    : [category];
  const uniqueCategories = [...new Set([category, ...categories])];
  return {
    id: budget.id || createId(),
    name: String(budget.name || category).trim() || category,
    category,
    categories: uniqueCategories,
    limit: Number(budget.limit) || 0,
    scope: normalizeBudgetScope(budget.scope),
  };
}

function normalizeBudgetScope(scope) {
  return ["pessoal", "empresa", "both"].includes(scope) ? scope : "pessoal";
}

function getBudgetKey(budget) {
  return `${normalize(budget.name)}|${normalize(budget.category)}|${budget.scope}`;
}

function getVisibleBudgets() {
  return state.budgets.filter((budget) => {
    if (state.selectedView === "consolidada") return true;
    return budget.scope === state.selectedView || budget.scope === "both";
  });
}

function getBudgetSummary(transactions) {
  return getVisibleBudgets().reduce(
    (summary, budget) => {
      const progress = getBudgetProgress(budget, transactions);
      summary.active += 1;
      summary[progress.status] += 1;
      return summary;
    },
    { active: 0, inside: 0, attention: 0, over: 0 },
  );
}

function getBudgetProgress(budget, transactions) {
  const spent = getBudgetSpent(budget, transactions);
  const percent = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
  const capped = Math.min(percent, 100);
  const remaining = budget.limit - spent;
  const status = percent > 100 ? "over" : percent >= 70 ? "attention" : "inside";
  const statusText =
    status === "over"
      ? `Estourou ${currency.format(Math.abs(remaining))}`
      : status === "attention"
        ? "Atenção"
        : "Dentro do limite";
  return { budget, spent, remaining, percent, capped, status, statusText };
}

function getBudgetSpent(budget, transactions) {
  return transactions
    .filter((transaction) => transactionMatchesBudget(transaction, budget))
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
}

function transactionMatchesBudget(transaction, budget) {
  const categoryMatches = budget.categories.some(
    (category) => normalize(category) === normalize(transaction.category),
  );
  if (!categoryMatches) return false;
  if (!(transaction.kind === "expense" || transaction.kind === "card_purchase")) return false;
  if (budget.scope === "both") return true;
  return transaction.scope === budget.scope;
}

function getBudgetCategoryLabel(budget) {
  return budget.categories.map(formatCategory).join(", ");
}

function isBudgetFilter(filter) {
  return String(filter || "").startsWith(budgetFilterPrefix);
}

function getBudgetByFilter(filter) {
  const id = String(filter || "").slice(budgetFilterPrefix.length);
  return state.budgets.find((budget) => budget.id === id);
}

function parseCsv(text, profile) {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const delimiter = detectDelimiter(cleaned);
  const rows = parseDelimitedRows(cleaned, delimiter).filter((row) =>
    row.some((cell) => cell.trim()),
  );
  const startIndex = profile === "c6_business" ? findC6HeaderIndex(rows) : 0;
  if (startIndex === -1) {
    throw new Error("Cabecalho do C6 Empresa nao encontrado.");
  }
  const [header, ...data] = rows.slice(startIndex);
  if (!header?.length) return [];

  const keys = header.map((item) => normalize(item));
  return data
    .map((row) => {
      const normalizedRow = repairCsvRow(row, keys, delimiter);
      const record = Object.fromEntries(
        keys.map((key, index) => [key, normalizedRow[index] || ""]),
      );
      return createTransactionFromCsvRecord(record, profile);
    })
    .filter((item) => item.date && item.description && Number.isFinite(item.amount));
}

function findC6HeaderIndex(rows) {
  return rows.findIndex((row) =>
    row.some((cell) => normalize(cell) === "data lancamento"),
  );
}

function createTransactionFromCsvRecord(record, profile) {
  if (profile === "c6_business") {
    return createC6BusinessTransaction(record);
  }

  if (profile === "nubank_account") {
    const description = record.descricao || record.description;
    const amount = parseCurrency(record.valor || record.amount);
    const kind = inferNubankAccountKind(description, amount);
    const category = inferNubankAccountCategory(description, amount, record.categoria || record.category);
    return normalizeTransaction(
      {
        date: parseDate(record.data || record.date),
        description,
        originalDescription: description,
        amount,
        account: "Nubank Conta",
        method: inferMethod(description, "nubank_account"),
        kind,
        category,
        source: "nubank_account",
        externalId: record.identificador || record.id,
      },
      { inferMissingCategory: true },
    );
  }

  if (profile === "nubank_credit_card") {
    const description = record.descricao || record.description || record.titulo || record.title;
    const rawAmount = parseCurrency(record.valor || record.amount);
    const kind = inferKind(description, rawAmount, "nubank_credit_card");
    const amount =
      kind === "refund" || kind === "card_payment_received"
        ? Math.abs(rawAmount)
        : -Math.abs(rawAmount);
    return normalizeTransaction(
      {
        date: parseDate(record.data || record.date),
        description,
        originalDescription: description,
        amount,
        account: "Nubank Cartão",
        method: kind === "card_payment_received" ? "fatura" : "credito",
        kind,
        category:
          kind === "card_payment_received"
            ? "Pagamento de fatura"
            : record.categoria || record.category,
        source: "nubank_credit_card",
        externalId: record.identificador || record.id,
      },
      { inferMissingCategory: true },
    );
  }

  const description = record.descricao || record.description;
  const amount = parseCurrency(record.valor || record.amount);
  return normalizeTransaction(
    {
      date: parseDate(record.data || record.date),
      description,
      originalDescription: description,
      account: record.conta || record.account || "Nubank Conta",
      scope: record.escopo || record.scope,
      method: record.metodo || record.method || inferMethod(description, "generic"),
      kind: record.tipo || record.kind || inferKind(description, amount, "generic"),
      category: record.categoria || record.category,
      amount,
      source: "manual",
      externalId: record.identificador || record.id,
    },
    { inferMissingCategory: true },
  );
}

function createC6BusinessTransaction(record) {
  const description = record.titulo || record.title;
  const detail = record.descricao || record.description || "";
  const entry = parseCurrency(record["entrada(r$)"] || record.entrada);
  const output = parseCurrency(record["saida(r$)"] || record["saída(r$)"] || record.saida);
  const amount = entry > 0 ? entry : -Math.abs(output || 0);
  const category = inferC6Category(description, detail);
  const kind = inferC6Kind(description, detail, amount, category);
  return normalizeTransaction(
    {
      date: parseDate(record["data lancamento"] || record.data),
      description,
      originalDescription: detail || description,
      amount,
      account: "C6 Empresa",
      institution: "C6 Bank",
      accountType: "business_checking",
      scope: "empresa",
      method: inferC6Method(description, detail),
      kind,
      category,
      source: "c6_business",
      externalId: "",
      metadata: {
        accountingDate: parseDate(record["data contabil"] || record["data contábil"]),
        balanceOfDay: parseCurrency(record["saldo do dia(r$)"]),
      },
    },
    { inferMissingCategory: true },
  );
}

function inferC6Kind(title, detail, amount, category) {
  const text = normalize(`${title} ${detail}`);
  if (text.includes("pix recebido de")) return "income";
  if (isC6TransferToPersonal(text)) return "transfer";
  if (text.includes("pix enviado para")) {
    return "expense";
  }
  if (Number(amount) > 0) return "income";
  if (Number(amount) < 0) return "expense";
  return "review";
}

function inferNubankAccountKind(description, amount) {
  const text = normalize(description);
  if (text.includes("transferencia recebida pelo pix") && isOwnAccountText(description)) {
    return "transfer";
  }
  if (text.includes("transferencia recebida pelo pix")) {
    return "review";
  }
  return inferKind(description, amount, "nubank_account");
}

function inferNubankAccountCategory(description, amount, csvCategory) {
  if (csvCategory && !isReviewCategory(csvCategory)) return csvCategory;
  const text = normalize(description);
  if (text.includes("transferencia recebida pelo pix") && isOwnAccountText(description)) {
    return "Transferência interna";
  }
  if (text.includes("transferencia recebida pelo pix")) {
    return incomeReviewCategory;
  }
  return inferCategory(description, amount);
}

function inferC6Method(title, detail) {
  const text = normalize(`${title} ${detail}`);
  if (text.includes("pix") || text.includes("transf enviada pix")) return "pix";
  if (text.includes("debito de cartao")) return "debito";
  return "outro";
}

function inferC6Category(title, detail) {
  const text = normalize(`${title} ${detail}`);
  if (isC6TransferToPersonal(text)) return "Transferência para pessoal";
  if (text.includes("seguro conta c6")) return "Tarifas/Seguros";
  if (text.includes("banco c6 s.a") || text === "banco c6") return "Tarifas bancárias";
  if (text.includes("netflix")) return "Lazer/Assinaturas";
  if (text.includes("giraffas")) return "Alimentação fora";
  if (text.includes("receita federal")) return "Impostos";
  if (text.includes("suhai seguradora")) return "Seguro";
  if (text.includes("asteca construcao civil")) return reviewCategory;
  if (text.includes("pix enviado para")) {
    const inferred = inferCategory(`${title} ${detail}`, -1);
    return inferred === "Transferência enviada" ? reviewCategory : inferred;
  }
  return inferCategory(`${title} ${detail}`, 0);
}

function isC6TransferToPersonal(normalizedText) {
  return normalizedText.includes("pix enviado para bernardo dos santos ferreira");
}

function isOwnAccountText(text) {
  const normalizedText = normalize(text);
  return (
    normalizedText.includes("bernardo dos santos ferreira") ||
    normalizedText.includes("60.274.041 bernardo dos santos ferreira") ||
    normalizedText.includes("60274041 bernardo dos santos ferreira")
  );
}

function isClearIncomeDescription(description) {
  const text = normalize(description);
  return (
    text.includes("salario") ||
    text.includes("freelance") ||
    text.includes("pagamento empresa") ||
    text.includes("pro labore") ||
    text.includes("pro-labore") ||
    text.includes("pró-labore")
  );
}

function inferKind(description, amount, profile) {
  const text = normalize(description);
  if (text.includes("estorno") || text.includes("reembolso")) return "refund";
  if (profile === "nubank_credit_card" && text.includes("pagamento recebido")) {
    return "card_payment_received";
  }
  if (text.includes("pagamento de fatura")) return "card_payment";
  if (profile === "nubank_credit_card") return "card_purchase";
  if (Number(amount) > 0) return isClearIncomeDescription(description) ? "income" : "review";
  if (Number(amount) < 0) return "expense";
  return "review";
}

function inferMethod(description, profile) {
  const text = normalize(description);
  if (profile === "nubank_credit_card") return "credito";
  if (text.includes("pix")) return "pix";
  if (text.includes("debito")) return "debito";
  if (text.includes("credito")) return "credito";
  if (text.includes("boleto")) return "boleto";
  if (text.includes("pagamento de fatura")) return "fatura";
  return "outro";
}

function repairCsvRow(row, keys, delimiter) {
  if (delimiter !== "," || row.length <= keys.length) return row;

  const valueIndex = keys.findIndex((key) => key === "valor" || key === "amount");
  const accountIndex = keys.findIndex((key) => key === "conta" || key === "account");
  const extraCells = row.length - keys.length;

  if (valueIndex === -1 || accountIndex === -1 || accountIndex <= valueIndex) {
    return row;
  }

  const value = row.slice(valueIndex, valueIndex + extraCells + 1).join(",");
  return [
    ...row.slice(0, valueIndex),
    value,
    ...row.slice(valueIndex + extraCells + 1),
  ];
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const commaCount = countDelimiter(firstLine, ",");
  const semicolonCount = countDelimiter(firstLine, ";");
  return semicolonCount > commaCount ? ";" : ",";
}

function countDelimiter(line, delimiter) {
  let count = 0;
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') inQuotes = !inQuotes;
    if (!inQuotes && char === delimiter) count += 1;
  }
  return count;
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  rows.push(row);
  return rows;
}

function appendTransactions(transactions) {
  const existingKeys = new Set(state.transactions.map(getDuplicateKey));
  let added = 0;
  let skipped = 0;

  transactions.forEach((transaction) => {
    const key = getDuplicateKey(transaction);
    if (existingKeys.has(key)) {
      skipped += 1;
      return;
    }
    state.transactions.push(transaction);
    existingKeys.add(key);
    added += 1;
  });

  return { added, skipped };
}

function removeSampleTransactions() {
  const before = state.transactions.length;
  state.transactions = state.transactions.filter((transaction) => !isSampleTransaction(transaction));
  return before - state.transactions.length;
}

function isSampleTransaction(transaction) {
  return (
    transaction.source === "sample" ||
    transaction.isSample === true ||
    getLegacySampleKeys().has(getDuplicateKey(transaction))
  );
}

function getLegacySampleKeys() {
  const legacySamples = [
    { date: "2026-05-02", description: "Salario", category: "Renda", amount: 7800 },
    { date: "2026-05-03", description: "Aluguel", category: "Moradia", amount: -2200 },
    { date: "2026-05-04", description: "Supermercado", category: "Alimentacao", amount: -386.42 },
    { date: "2026-05-05", description: "Uber", category: "Transporte", amount: -42.9 },
    { date: "2026-05-08", description: "Internet", category: "Casa", amount: -129.9 },
    { date: "2026-05-11", description: "Restaurante", category: "Alimentacao", amount: -118.5 },
    { date: "2026-05-12", description: "Farmacia", category: "Saude", amount: -74.3 },
    { date: "2026-05-15", description: "Freelance", category: "Renda", amount: 950 },
    { date: "2026-05-16", description: "Cinema", category: "Lazer", amount: -86 },
    { date: "2026-05-17", description: "Academia", category: "Saude", amount: -139.9 },
  ];

  return new Set(
    [
      ...sampleTransactions.flatMap((transaction) => [
        normalizeTransaction({ ...transaction, source: "sample" }),
        normalizeTransaction({ ...transaction, account: "Sem conta" }),
      ]),
      ...legacySamples.flatMap((transaction) => [
        normalizeTransaction({ ...transaction, account: "Sem conta" }),
        normalizeTransaction({ ...transaction, account: "Nubank Conta" }),
        normalizeTransaction({ ...transaction, account: "Nubank Cartao" }),
      ]),
    ].map(getDuplicateKey),
  );
}

function reclassifyReviewCategories() {
  let reclassified = 0;
  state.transactions = state.transactions.map((transaction) => {
    if (transaction.manualCategory || !isReviewCategory(transaction.category)) {
      return transaction;
    }

    const category = inferCategory(transaction.originalDescription || transaction.description, transaction.amount);
    if (category === transaction.category) return transaction;

    reclassified += 1;
    const kind =
      Number(transaction.amount) > 0 &&
      category === "Renda" &&
      isClearIncomeDescription(transaction.originalDescription || transaction.description)
        ? "income"
        : normalizeFinancialKind(transaction.kind, transaction.amount, category);
    return { ...transaction, category, kind };
  });
  return reclassified;
}

function detectInternalTransfers() {
  let linked = 0;
  const candidates = state.transactions.filter(
    (item) =>
      !item.linkedTransferId &&
      item.kind !== "card_payment" &&
      item.kind !== "card_payment_received" &&
      item.kind !== "card_purchase" &&
      item.kind !== "refund" &&
      Number(item.amount) !== 0,
  );

  for (const outgoing of candidates.filter((item) => item.amount < 0)) {
    const match = candidates.find(
      (incoming) =>
        incoming.amount > 0 &&
        !incoming.linkedTransferId &&
        outgoing.account !== incoming.account &&
        Math.abs(Math.abs(outgoing.amount) - Math.abs(incoming.amount)) < 0.01 &&
        Math.abs(daysBetween(outgoing.date, incoming.date)) <= 2 &&
        hasTransferConfidence(outgoing, incoming),
    );

    if (!match) continue;

    const linkedTransferId = createId();
    outgoing.kind = "transfer";
    outgoing.category = "Transferência interna";
    outgoing.linkedTransferId = linkedTransferId;
    match.kind = "transfer";
    match.category = "Transferência interna";
    match.linkedTransferId = linkedTransferId;
    linked += 1;
  }

  return linked;
}

function hasTransferConfidence(first, second) {
  const text = normalize(`${first.description} ${second.description}`);
  const hasTransferLanguage =
    text.includes("transferencia") || text.includes("pix") || text.includes("ted");
  const clearOwnAccount =
    isOwnAccountText(first.description) ||
    isOwnAccountText(second.description) ||
    isOwnAccountText(first.originalDescription) ||
    isOwnAccountText(second.originalDescription);
  const ownAccounts = defaultAccounts.some((account) => account.name === first.account) &&
    defaultAccounts.some((account) => account.name === second.account);
  const matchedPair =
    first.account !== second.account &&
    Math.abs(Math.abs(first.amount) - Math.abs(second.amount)) < 0.01 &&
    Math.abs(daysBetween(first.date, second.date)) <= 2;
  return hasTransferLanguage && ownAccounts && clearOwnAccount && matchedPair;
}

function normalizeTransaction(transaction, options = {}) {
  const description = String(transaction.description || "").trim();
  const account = getAccount(transaction.account || "Nubank Conta").name;
  const accountMeta = getAccount(account);
  const category = String(transaction.category || "").trim();
  const shouldInferCategory = options.inferMissingCategory && isReviewCategory(category);
  const amount =
    typeof transaction.amount === "number" ? transaction.amount : parseCurrency(transaction.amount);
  const kind = normalizeFinancialKind(
    normalizeKind(transaction.kind || inferKind(description, amount, transaction.source)),
    amount,
    shouldInferCategory ? inferCategory(description, amount) : normalizeCategory(category),
  );
  const method = normalizeMethod(transaction.method || inferMethod(description, transaction.source));

  return {
    id: transaction.id || createId(),
    date: parseDate(transaction.date),
    description,
    amount,
    account,
    institution: transaction.institution || accountMeta.institution,
    accountType: transaction.accountType || accountMeta.accountType,
    scope: accountMeta.accountType === "business_checking" ? "empresa" : transaction.scope || accountMeta.scope,
    method,
    kind,
    category: shouldInferCategory ? inferCategory(description, amount) : normalizeCategory(category),
    originalDescription: transaction.originalDescription || description,
    source: transaction.source || "manual",
    externalId: transaction.externalId || transaction.identifier || "",
    manualCategory: Boolean(transaction.manualCategory),
    linkedTransferId: transaction.linkedTransferId || "",
    ...(transaction.metadata ? { metadata: transaction.metadata } : {}),
    ...(transaction.isSample ? { isSample: true } : {}),
  };
}

function migrateTransactions(transactions) {
  return transactions.map(normalizeTransaction).filter((item) => item.date && item.description);
}

function defaultBudgets() {
  return [
    createDefaultBudget("Alimentação fora", 500, "pessoal"),
    createDefaultBudget("Mercado", 800, "pessoal"),
    createDefaultBudget("Transporte", 400, "pessoal"),
    createDefaultBudget("Lazer", 200, "pessoal"),
  ];
}

function migrateBudgets(budgets) {
  const migrated = budgets.map(normalizeBudget);
  const keys = new Set(migrated.map(getBudgetKey));

  defaultBudgets().forEach((budget) => {
    if (!keys.has(getBudgetKey(budget))) {
      migrated.push(budget);
      keys.add(getBudgetKey(budget));
    }
  });

  return migrated;
}

function inferCategory(description, amount = 0) {
  const merchant = extractMerchant(description);
  const priorityCategory = inferPriorityCategory(description);
  if (priorityCategory) return priorityCategory;

  const merchantCategory =
    merchant && !isPaymentIntermediary(merchant) ? matchCategory(merchant) : "";
  if (merchantCategory && !isGenericTransferCategory(merchantCategory)) {
    return merchantCategory;
  }

  const descriptionCategory = matchCategory(description);
  if (isGenericTransferCategory(descriptionCategory)) {
    return getReviewCategoryForAmount(amount);
  }
  return descriptionCategory || getReviewCategoryForAmount(amount);
}

function isGenericTransferCategory(category) {
  return category === "Transferência enviada" || category === "Transferência recebida";
}

function getReviewCategoryForAmount(amount) {
  if (Number(amount) > 0) return incomeReviewCategory;
  if (Number(amount) < 0) return expenseReviewCategory;
  return reviewCategory;
}

function inferPriorityCategory(description) {
  const text = normalize(description);
  if (hasKeyword(text, "estorno") || hasKeyword(text, "reembolso")) {
    return "Estorno/Reembolso";
  }
  if (hasKeyword(text, "pagamento de fatura")) {
    return "Pagamento de fatura";
  }
  if (
    hasKeyword(text, "pagamento de boleto efetuado") &&
    hasKeyword(text, "banco pan") &&
    hasKeyword(text, "auto pan")
  ) {
    return "Financiamento/Veículo";
  }
  return "";
}

function extractMerchant(description) {
  const parts = String(description || "")
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return String(description || "").trim();

  const operation = normalize(parts[0]);
  if (operation.includes("compra no debito") || operation.includes("compra no credito")) {
    return parts[1];
  }

  if (operation.includes("transferencia enviada pelo pix")) {
    return parts[1];
  }

  if (operation.includes("transferencia recebida pelo pix")) {
    return parts[1];
  }

  if (operation.includes("pagamento de boleto efetuado")) {
    return parts.slice(1).join(" - ");
  }

  return parts[1];
}

function matchCategory(text) {
  const normalizedText = normalize(text);
  if (isTransferText(normalizedText)) {
    const transferRules = categoryRules.filter((rule) => rule.category.includes("Transferência"));
    return matchRules(normalizedText, transferRules) || "";
  }

  return matchRules(normalizedText, categoryRules);
}

function matchRules(normalizedText, rules) {
  const match = rules.find((rule) =>
    rule.keywords.some((keyword) => hasKeyword(normalizedText, keyword)),
  );
  return match?.category || "";
}

function hasKeyword(normalizedText, keyword) {
  const normalizedKeyword = normalize(keyword);
  if (!normalizedKeyword) return false;
  const wholeWordKeywords = new Set(["99", "tim", "vivo", "claro"]);
  if (wholeWordKeywords.has(normalizedKeyword)) {
    return normalizedText.split(/[^a-z0-9]+/).includes(normalizedKeyword);
  }
  return normalizedText.includes(normalizedKeyword);
}

function isPaymentIntermediary(text) {
  const normalizedText = normalize(text);
  return paymentIntermediaries.some((intermediary) =>
    normalizedText.includes(normalize(intermediary)),
  );
}

function isTransferText(normalizedText) {
  return (
    normalizedText.includes("transferencia") ||
    normalizedText.includes("enviada pelo pix") ||
    normalizedText.includes("recebido pelo pix")
  );
}

function getDuplicateKey(transaction) {
  const amount = Math.round(Number(transaction.amount) * 100);
  if (transaction.source === "c6_business") {
    return [
      transaction.source,
      normalize(transaction.account),
      transaction.date,
      amount,
      normalize(transaction.description),
      normalize(transaction.originalDescription),
    ].join("|");
  }

  return [
    transaction.source,
    normalize(transaction.account),
    transaction.date,
    amount,
    normalize(transaction.description),
    transaction.externalId || "",
  ].join("|");
}

function parseCurrency(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return NaN;
  const negativeByParentheses = raw.startsWith("(") && raw.endsWith(")");
  const compact = raw
    .replace(/[R$\s]/g, "")
    .replace(/[()]/g, "")
    .replace(/\u00a0/g, "");
  const normalized =
    compact.includes(",") && compact.includes(".")
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(",", ".");
  const number = Number(normalized);
  if (!Number.isFinite(number)) return NaN;
  return negativeByParentheses ? -Math.abs(number) : number;
}

function parseDate(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

function persist() {
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(state.transactions));
  localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(state.budgets));
  localStorage.setItem(STORAGE_KEYS.selectedMonth, JSON.stringify(state.selectedMonth));
  localStorage.setItem(STORAGE_KEYS.selectedView, JSON.stringify(state.selectedView));
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function getFilteredTransactions() {
  return state.transactions.filter((item) => {
    const matchesMonth = getMonthKey(item.date) === state.selectedMonth;
    if (!matchesMonth) return false;
    if (state.selectedView === "consolidada") return true;
    return item.scope === state.selectedView;
  });
}

function getInitialMonth(transactions) {
  return (
    transactions
      .map((item) => getMonthKey(item.date))
      .filter(Boolean)
      .sort()
      .at(-1) || getCurrentMonth()
  );
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getMonthKey(date) {
  return String(date || "").slice(0, 7);
}

function setImportStatus(message) {
  elements.importStatus.textContent = message;
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}

function emptyState(message) {
  return `<div class="insight-item">${escapeHtml(message)}</div>`;
}

function normalizeCategory(category) {
  if (normalize(category) === "sem categoria") return reviewCategory;
  if (isReviewCategory(category)) return category || reviewCategory;
  return normalizeCategoryAlias(category || reviewCategory);
}

function normalizeCategoryAlias(category) {
  const value = String(category || "").trim();
  if (value.includes("Alimenta")) return "Alimentação fora";
  if (value.includes("Sa") && value.includes("de") && value.length <= 8) return "Saúde";
  if (value.includes("Educa")) return "Educação";
  if (value.includes("banc")) return "Tarifas bancárias";
  if (value.includes("Ve")) return "Financiamento/Veículo";
  if (value.includes("Empr")) return "Empréstimos";
  if (value.includes("Transfer") && value.includes("interna")) return "Transferência interna";
  if (value.includes("Transfer") && value.includes("pessoal")) return "Transferência para pessoal";
  const normalized = normalize(value);
  const aliases = {
    alimentacao: "Alimentação fora",
    "alimentacao fora": "Alimentação fora",
    saude: "Saúde",
    educacao: "Educação",
    emprestimos: "Empréstimos",
    "transferencia interna": "Transferência interna",
    "transferencia para pessoal": "Transferência para pessoal",
    "financiamento/veiculo": "Financiamento/Veículo",
    "tarifas bancarias": "Tarifas bancárias",
    "impostos/taxas": "Impostos/Taxas",
    "beleza/cuidados pessoais": "Beleza/Cuidados pessoais",
    "ferramentas/software": "Ferramentas/Software",
    mercado: "Mercado",
    transporte: "Transporte",
    lazer: "Lazer",
    renda: "Renda",
  };
  return aliases[normalized] || value;
}

function formatCategory(category) {
  return normalizeCategoryAlias(category);
}

function isReviewCategory(category) {
  const normalized = normalize(category);
  return (
    !normalized ||
    normalized === "sem categoria" ||
    normalized === normalize(reviewCategory) ||
    normalized === normalize(incomeReviewCategory) ||
    normalized === normalize(expenseReviewCategory)
  );
}

function getAccount(name) {
  const normalizedName = normalize(name);
  return defaultAccounts.find((account) => normalize(account.name) === normalizedName) || defaultAccounts[0];
}

function isCreditCardTransaction(transaction) {
  return (
    transaction.accountType === "credit_card" ||
    transaction.source === "nubank_credit_card" ||
    getAccount(transaction.account).accountType === "credit_card"
  );
}

function populateAccountOptions() {
  const options = defaultAccounts
    .map((account) => `<option value="${escapeHtml(account.name)}">${escapeHtml(account.name)}</option>`)
    .join("");
  elements.transactionForm.elements.account.innerHTML = options;
}

function populateCategoryOptions() {
  const options = [
    ...standardCategories.map(
      (category) => `<option value="${escapeHtml(category)}">${escapeHtml(formatCategory(category))}</option>`,
    ),
    '<option value="__custom__">Outra...</option>',
  ].join("");
  elements.transactionForm.elements.category.innerHTML = options;
}

function populateBudgetCategoryOptions() {
  const options = standardCategories
    .filter((category) => !isReviewCategory(category))
    .map((category) => `<option value="${escapeHtml(formatCategory(category))}">${escapeHtml(formatCategory(category))}</option>`)
    .join("");
  document.querySelector("#budgetForm").elements.category.innerHTML = options;
}

function setCategoryInput(category) {
  const value = standardCategories.some((item) => normalize(item) === normalize(category))
    ? standardCategories.find((item) => normalize(item) === normalize(category))
    : "__custom__";
  elements.transactionForm.elements.category.value = value;
  elements.transactionForm.elements.customCategory.value = value === "__custom__" ? category : "";
  toggleCustomCategoryInput();
}

function toggleCustomCategoryInput() {
  const isCustom = elements.transactionForm.elements.category.value === "__custom__";
  document.querySelector("#customCategoryLabel").hidden = !isCustom;
  elements.transactionForm.elements.customCategory.required = isCustom;
}

function applyAccountDefaults(accountName) {
  const account = getAccount(accountName);
  elements.transactionForm.elements.scope.value = account.scope;
}

function normalizeKind(kind) {
  const allowed = [
    "income",
    "expense",
    "transfer",
    "card_purchase",
    "card_payment",
    "card_payment_received",
    "refund",
    "review",
  ];
  return allowed.includes(kind) ? kind : "review";
}

function getManualKind(kind, category, amount, existing) {
  if (normalize(category) === normalize(incomeReviewCategory)) return "review";
  if (normalize(category) === normalize(expenseReviewCategory)) return "expense";
  if (normalize(category) === normalize(reviewCategory)) {
    return Number(amount) < 0 ? "expense" : "review";
  }
  if (normalize(category) === normalize("Transferência interna")) return "transfer";
  if (normalize(category) === normalize("Transferência para pessoal")) return "transfer";
  if (normalize(category) === "renda") return "income";
  if (["salario", "salário", "freelance"].includes(normalize(category))) return "income";
  if (
    existing?.kind === "review" &&
    Number(amount) > 0 &&
    !isReviewCategory(category) &&
    kind === "review"
  ) {
    return "income";
  }
  return kind;
}

function normalizeFinancialKind(kind, amount, category) {
  if (kind === "card_purchase") return "card_purchase";
  if (normalize(category) === normalize(incomeReviewCategory)) return "review";
  if (normalize(category) === normalize(expenseReviewCategory)) return "expense";
  if (normalize(category) === normalize(reviewCategory)) {
    return Number(amount) < 0 ? "expense" : "review";
  }
  if (kind === "review" && Number(amount) < 0) return "expense";
  return kind;
}

function normalizeMethod(method) {
  const allowed = ["pix", "debito", "credito", "boleto", "fatura", "outro"];
  return allowed.includes(method) ? method : "outro";
}

function formatKind(kind) {
  return {
    income: "Receita",
    expense: "Despesa",
    transfer: "Transferência",
    card_purchase: "Compra cartão",
    card_payment: "Pagamento fatura",
    card_payment_received: "Pagamento recebido fatura",
    refund: "Reembolso",
    review: "A revisar",
  }[kind] || kind;
}

function formatMethod(method) {
  return {
    pix: "Pix",
    debito: "Débito",
    credito: "Crédito",
    boleto: "Boleto",
    fatura: "Fatura",
    outro: "Outro",
  }[method] || method;
}

function daysBetween(firstDate, secondDate) {
  const first = new Date(`${firstDate}T00:00:00`);
  const second = new Date(`${secondDate}T00:00:00`);
  return Math.round((first - second) / 86400000);
}

function sumAbsolute(transactions) {
  return transactions.reduce((total, item) => total + Math.abs(item.amount), 0);
}
