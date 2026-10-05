import { type FormEvent, useMemo, useState } from 'react';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { getFinanceTabs } from '../components/financeTabs';
import { categoryRuleService } from '../services/categoryRuleService';
import { categoryService } from '../services/categoryService';
import { transactionService } from '../services/transactionService';
import { type Category, type CategoryRule, type CategoryType } from '../types/category';
import { type TransactionKind } from '../types/finance';
import { formatTransactionKind } from '../utils/financeFormatters';

type RuleDraft = {
  name: string;
  keyword: string;
  category: string;
  kind: '' | TransactionKind;
};

type CategoryDraft = {
  name: string;
  type: CategoryType;
};

const kindOptions: TransactionKind[] = [
  'income',
  'expense',
  'transfer',
  'card_payment',
  'card_payment_received',
];

const inputClass = 'w-full bg-transparent pb-1.5 text-sm outline-none';
const selectClass = 'w-full bg-transparent pb-1.5 text-sm outline-none cursor-pointer appearance-none';

function categoryTypeLabel(type?: CategoryType) {
  return {
    expense: 'Despesa',
    income: 'Receita',
    review: 'Revisão',
    transfer: 'Transferência',
  }[type ?? 'expense'];
}

function createRuleDraft(category = categoryService.getAvailableCategories()[0]?.name ?? ''): RuleDraft {
  return { name: '', keyword: '', category, kind: '' };
}

function createRuleDraftFromRule(rule: CategoryRule): RuleDraft {
  return { name: rule.name, keyword: rule.keyword, category: rule.category, kind: rule.kind ?? '' };
}

function createCategoryDraft(category?: Category): CategoryDraft {
  return { name: category?.name ?? '', type: category?.type ?? 'expense' };
}

export function CategoriesPage() {
  const pendingReviewCount = transactionService.listRequiredReviewTransactions().length;
  const [rules, setRules] = useState(() => categoryRuleService.listCategoryRules());
  const [customCategories, setCustomCategories] = useState(() => categoryService.listCustomCategories());
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(() => createRuleDraft());
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(() => createCategoryDraft());
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const defaultCategories = categoryService.listDefaultCategories();
  const specialCategories = categoryService.listSpecialCategories();
  const availableCategories = categoryService.getAvailableCategories();
  const ruleCategoryOptions = useMemo(
    () => [...new Set([...availableCategories.map((category) => category.name), ...rules.map((rule) => rule.category)])].sort(),
    [availableCategories, rules],
  );

  function refreshCategories() {
    setCustomCategories(categoryService.listCustomCategories());
  }

  function refreshRules() {
    setRules(categoryRuleService.listCategoryRules());
  }

  function resetCategoryDraft() {
    setEditingCategoryId(null);
    setCategoryDraft(createCategoryDraft());
  }

  function resetRuleDraft() {
    setEditingRuleId(null);
    setRuleDraft(createRuleDraft());
  }

  function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      if (editingCategoryId) {
        categoryService.updateCategory(editingCategoryId, categoryDraft);
        setMessage('Categoria atualizada.');
      } else {
        categoryService.createCategory(categoryDraft);
        setMessage('Categoria personalizada criada.');
      }

      refreshCategories();
      resetCategoryDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar a categoria.');
    }
  }

  function handleRuleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const input = {
        name: ruleDraft.name.trim() || undefined,
        keyword: ruleDraft.keyword,
        category: ruleDraft.category,
        kind: ruleDraft.kind || undefined,
      };

      if (editingRuleId) {
        categoryRuleService.updateCategoryRule(editingRuleId, input);
        setMessage('Regra atualizada.');
      } else {
        categoryRuleService.createCategoryRule(input);
        setMessage('Regra criada. Ela será usada em novas importações. Transações já salvas não foram alteradas automaticamente.');
      }

      refreshRules();
      resetRuleDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar a regra.');
    }
  }

  function deleteCustomCategory(category: Category) {
    if (!window.confirm(`Excluir a categoria "${category.name}"?`)) {
      return;
    }

    categoryService.deleteCategory(category.id);
    refreshCategories();
    if (editingCategoryId === category.id) {
      resetCategoryDraft();
    }
    setMessage('Categoria excluída.');
  }

  function deleteRule(rule: CategoryRule) {
    if (!window.confirm(`Excluir a regra "${rule.name}"?`)) {
      return;
    }

    categoryRuleService.deleteCategoryRule(rule.id);
    refreshRules();
    if (editingRuleId === rule.id) {
      resetRuleDraft();
    }
    setMessage('Regra excluída.');
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Financeiro" title="Categorias e regras" tabs={getFinanceTabs(pendingReviewCount)} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Organize categorias personalizadas e regras manuais de classificação.
      </p>

      {message ? <p style={{ fontSize: '12px', color: 'var(--hub-positive)', marginBottom: '20px' }}>{message}</p> : null}
      {error ? <p style={{ fontSize: '12px', color: 'var(--hub-negative)', marginBottom: '20px' }}>{error}</p> : null}

      <Card className="mb-5">
        <div className="grid gap-x-16 gap-y-10 xl:grid-cols-2">
          <CategoryList title="Categorias padrão" description="Protegidas e sempre disponíveis." categories={defaultCategories} />
          <CategoryList title="Categorias especiais" description="Protegem revisão, faturas e transferências." categories={specialCategories} />
        </div>
      </Card>

      <Card className="mb-5">
        <div className="grid gap-x-16 gap-y-10 xl:grid-cols-2">
          <form onSubmit={handleCategorySubmit}>
            <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
              {editingCategoryId ? 'Editar categoria personalizada' : 'Criar categoria personalizada'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
              Categorias ativas entram em revisão, regras e orçamentos.
            </p>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]" style={{ marginBottom: '16px' }}>
              <Field label="Nome">
                <input
                  className={inputClass}
                  value={categoryDraft.name}
                  onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })}
                  placeholder="Ex.: Viagem"
                />
              </Field>
              <Field label="Tipo">
                <Select
                  className={selectClass}
                  value={categoryDraft.type}
                  onChange={(value) => setCategoryDraft({ ...categoryDraft, type: value as CategoryType })}
                >
                  <Select.Option value="expense">Despesa</Select.Option>
                  <Select.Option value="income">Receita</Select.Option>
                  <Select.Option value="transfer">Transferência</Select.Option>
                  <Select.Option value="review">Revisão</Select.Option>
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton type="submit" tone="primary">
                {editingCategoryId ? 'Salvar categoria' : 'Criar categoria'}
              </ActionButton>
              {editingCategoryId ? (
                <ActionButton type="button" onClick={resetCategoryDraft}>Cancelar</ActionButton>
              ) : null}
            </div>
          </form>

          <div>
            <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '5px' }}>
              Categorias personalizadas
            </p>
            <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
              Desative uma categoria para tirá-la das novas opções sem quebrar histórico.
            </p>
            {customCategories.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--hub-disabled)', fontStyle: 'italic' }}>
                Nenhuma categoria personalizada criada.
              </p>
            ) : (
              <div>
                {customCategories.map((category, i) => (
                  <div
                    key={category.id}
                    style={{ paddingBottom: '14px', marginBottom: i === customCategories.length - 1 ? 0 : '14px', borderBottom: i === customCategories.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p style={{ fontSize: '14px', color: 'var(--hub-text)', fontWeight: 400 }}>{category.name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '3px' }}>
                          {categoryTypeLabel(category.type)}
                        </p>
                      </div>
                      <span style={{ fontSize: '10px', color: category.isActive ? 'var(--hub-positive)' : 'var(--hub-subtle)', flexShrink: 0 }}>
                        {category.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <InlineButton label="Editar" onClick={() => {
                        setEditingCategoryId(category.id);
                        setCategoryDraft(createCategoryDraft(category));
                        setMessage('');
                        setError('');
                      }} />
                      <InlineButton label={category.isActive ? 'Desativar' : 'Ativar'} onClick={() => {
                        categoryService.toggleCategory(category.id);
                        refreshCategories();
                      }} />
                      <InlineButton label="Excluir" tone="danger" onClick={() => deleteCustomCategory(category)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid gap-x-16 gap-y-10 xl:grid-cols-2">
          <form onSubmit={handleRuleSubmit}>
            <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
              {editingRuleId ? 'Editar regra manual' : 'Criar regra manual'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
              Regras ativas entram antes dos aliases automáticos em novas importações.
            </p>
            <div className="grid gap-4 sm:grid-cols-2" style={{ marginBottom: '16px' }}>
              <Field label="Palavra-chave">
                <input
                  className={inputClass}
                  value={ruleDraft.keyword}
                  onChange={(event) => setRuleDraft({ ...ruleDraft, keyword: event.target.value })}
                  placeholder="Ex.: delivery"
                />
              </Field>
              <Field label="Nome">
                <input
                  className={inputClass}
                  value={ruleDraft.name}
                  onChange={(event) => setRuleDraft({ ...ruleDraft, name: event.target.value })}
                  placeholder="Opcional"
                />
              </Field>
              <Field label="Categoria">
                <Select
                  className={selectClass}
                  value={ruleDraft.category}
                  onChange={(value) => setRuleDraft({ ...ruleDraft, category: value })}
                >
                  {ruleCategoryOptions.map((category) => <Select.Option key={category} value={category}>{category}</Select.Option>)}
                </Select>
              </Field>
              <Field label="Tipo sugerido">
                <Select
                  className={selectClass}
                  value={ruleDraft.kind}
                  onChange={(value) => setRuleDraft({ ...ruleDraft, kind: value as RuleDraft['kind'] })}
                >
                  <Select.Option value="">Manter classificador</Select.Option>
                  {kindOptions.map((kind) => <Select.Option key={kind} value={kind}>{formatTransactionKind(kind)}</Select.Option>)}
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton type="submit" tone="primary">
                {editingRuleId ? 'Salvar regra' : 'Criar regra'}
              </ActionButton>
              {editingRuleId ? (
                <ActionButton type="button" onClick={resetRuleDraft}>Cancelar</ActionButton>
              ) : null}
            </div>
          </form>

          <div>
            <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '5px' }}>
              Regras manuais
            </p>
            <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
              Categoria manual de transação continua protegida mesmo quando uma regra bate.
            </p>
            {rules.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--hub-disabled)', fontStyle: 'italic' }}>
                Nenhuma regra manual criada ainda.
              </p>
            ) : (
              <div>
                {rules.map((rule, i) => (
                  <div
                    key={rule.id}
                    style={{ paddingBottom: '14px', marginBottom: i === rules.length - 1 ? 0 : '14px', borderBottom: i === rules.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p style={{ fontSize: '14px', color: 'var(--hub-text)', fontWeight: 400 }}>{rule.name || rule.keyword}</p>
                        <p style={{ fontSize: '12px', color: 'var(--hub-muted)', marginTop: '3px' }}>
                          <span style={{ color: 'var(--hub-text-body)' }}>{rule.keyword}</span> → {rule.category}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginTop: '2px' }}>
                          Tipo: {rule.kind ? formatTransactionKind(rule.kind) : 'manter classificador'}
                        </p>
                      </div>
                      <span style={{ fontSize: '10px', color: rule.isActive ? 'var(--hub-positive)' : 'var(--hub-subtle)', flexShrink: 0 }}>
                        {rule.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <InlineButton label="Editar" onClick={() => {
                        setEditingRuleId(rule.id);
                        setRuleDraft(createRuleDraftFromRule(rule));
                        setMessage('');
                        setError('');
                      }} />
                      <InlineButton label={rule.isActive ? 'Desativar' : 'Ativar'} onClick={() => {
                        categoryRuleService.toggleCategoryRule(rule.id);
                        refreshRules();
                      }} />
                      <InlineButton label="Excluir" tone="danger" onClick={() => deleteRule(rule)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function CategoryList({ categories, description, title }: { categories: Category[]; description: string; title: string }) {
  return (
    <div>
      <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '5px' }}>
        {title}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginBottom: '16px' }}>{description}</p>
      <div className="grid gap-0 sm:grid-cols-2">
        {categories.map((category, i) => (
          <div
            key={category.id}
            style={{ paddingBottom: '10px', marginBottom: i === categories.length - 1 ? 0 : '10px', borderBottom: i === categories.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
          >
            <p style={{ fontSize: '13px', color: 'var(--hub-text-body)' }}>{category.name}</p>
            <p style={{ fontSize: '10px', color: 'var(--hub-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
              {categoryTypeLabel(category.type)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="space-y-1.5">
      <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  tone = 'neutral',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'neutral' | 'primary';
  type?: 'button' | 'submit';
}) {
  return (
    <button
      className="text-sm font-medium transition-opacity hover:opacity-70"
      style={{ color: tone === 'primary' ? 'var(--hub-accent)' : 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
      type={type}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function InlineButton({ label, onClick, tone = 'neutral' }: { label: string; onClick(): void; tone?: 'neutral' | 'danger' }) {
  return (
    <button
      className="text-xs font-medium transition-opacity hover:opacity-70"
      style={{ color: tone === 'danger' ? 'var(--hub-negative)' : 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
