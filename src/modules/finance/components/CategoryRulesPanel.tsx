import { type FormEvent, useMemo, useState } from 'react';
import { Select } from '../../../shared/ui';
import { categoryRuleService } from '../services/categoryRuleService';
import { categoryService } from '../services/categoryService';
import { type CategoryRule } from '../types/category';
import { type TransactionKind } from '../types/finance';
import { formatTransactionKind } from '../utils/financeFormatters';

type RuleDraft = {
  name: string;
  keyword: string;
  category: string;
  kind: '' | TransactionKind;
};

const KIND_OPTIONS: TransactionKind[] = ['income', 'expense', 'transfer', 'card_payment', 'card_payment_received'];

function emptyDraft(defaultCategory = ''): RuleDraft {
  return { name: '', keyword: '', category: defaultCategory, kind: '' };
}

function draftFromRule(rule: CategoryRule): RuleDraft {
  return { name: rule.name, keyword: rule.keyword, category: rule.category, kind: rule.kind ?? '' };
}

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--hub-subtle)',
  fontWeight: 500,
};

const inputClass = 'w-full';

export function CategoryRulesPanel() {
  const availableCategories = useMemo(() => categoryService.getAvailableCategories(), []);
  const defaultCategory = availableCategories[0]?.name ?? '';

  const [rules, setRules] = useState(() => categoryRuleService.listCategoryRules());
  const [draft, setDraft] = useState<RuleDraft>(() => emptyDraft(defaultCategory));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const categoryOptions = useMemo(
    () => [...new Set([...availableCategories.map((c) => c.name), ...rules.map((r) => r.category)])].sort(),
    [availableCategories, rules],
  );

  function refresh() {
    setRules(categoryRuleService.listCategoryRules());
  }

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft(defaultCategory));
    setFormOpen(true);
    setMessage('');
    setError('');
  }

  function startEdit(rule: CategoryRule) {
    setEditingId(rule.id);
    setDraft(draftFromRule(rule));
    setFormOpen(true);
    setMessage('');
    setError('');
  }

  function cancelForm() {
    setEditingId(null);
    setDraft(emptyDraft(defaultCategory));
    setFormOpen(false);
    setError('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const input = {
        name: draft.name.trim() || undefined,
        keyword: draft.keyword,
        category: draft.category,
        kind: (draft.kind || undefined) as TransactionKind | undefined,
      };

      if (editingId) {
        categoryRuleService.updateCategoryRule(editingId, input);
        setMessage('Regra atualizada.');
      } else {
        categoryRuleService.createCategoryRule(input);
        setMessage('Regra criada — será usada nas próximas importações.');
      }

      refresh();
      cancelForm();
      setFormOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar a regra.');
    }
  }

  function handleToggle(rule: CategoryRule) {
    categoryRuleService.toggleCategoryRule(rule.id);
    refresh();
  }

  function handleDelete(rule: CategoryRule) {
    if (!window.confirm(`Excluir a regra "${rule.name || rule.keyword}"?`)) return;
    categoryRuleService.deleteCategoryRule(rule.id);
    if (editingId === rule.id) cancelForm();
    refresh();
    setMessage('Regra excluída.');
  }

  return (
    <section>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
            Regras de categorização
          </p>
          <p style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
            {rules.length === 0
              ? 'Nenhuma regra criada. Crie regras para categorizar transações automaticamente ao importar.'
              : `${rules.filter((r) => r.isActive).length} ativa${rules.filter((r) => r.isActive).length !== 1 ? 's' : ''} de ${rules.length} regra${rules.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={startCreate}
            className="text-sm font-medium transition-opacity hover:opacity-70 shrink-0"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            + Nova regra
          </button>
        )}
      </div>

      {/* Feedback */}
      {message && (
        <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--hub-positive)' }}>{message}</p>
      )}
      {error && (
        <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--hub-negative)' }}>{error}</p>
      )}

      {/* Formulário criar/editar */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3"
          style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--hub-border)' }}
        >
          <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
            {editingId ? 'Editar regra' : 'Nova regra'}
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span style={labelStyle}>Palavra-chave *</span>
              <input
                className={inputClass}
                placeholder="Ex.: delivery, netflix"
                value={draft.keyword}
                onChange={(e) => setDraft({ ...draft, keyword: e.target.value })}
                required
                autoFocus
              />
            </label>

            <label className="space-y-1.5">
              <span style={labelStyle}>Nome (opcional)</span>
              <input
                className={inputClass}
                placeholder="Ex.: Streaming"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>

            <label className="space-y-1.5">
              <span style={labelStyle}>Categoria *</span>
              <Select
                className="w-full cursor-pointer appearance-none"
                value={draft.category}
                onChange={(value) => setDraft({ ...draft, category: value })}
              >
                {categoryOptions.map((c) => (
                  <Select.Option key={c} value={c}>{c}</Select.Option>
                ))}
              </Select>
            </label>

            <label className="space-y-1.5">
              <span style={labelStyle}>Tipo sugerido</span>
              <Select
                className="w-full cursor-pointer appearance-none"
                value={draft.kind}
                onChange={(value) => setDraft({ ...draft, kind: value as RuleDraft['kind'] })}
              >
                <Select.Option value="">Manter classificador</Select.Option>
                {KIND_OPTIONS.map((k) => (
                  <Select.Option key={k} value={k}>{formatTransactionKind(k)}</Select.Option>
                ))}
              </Select>
            </label>
          </div>

          <div className="flex items-center gap-5">
            <button
              type="submit"
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {editingId ? 'Salvar alterações' : 'Criar regra'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="text-xs transition-opacity hover:opacity-60"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de regras */}
      {rules.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-3 py-3"
              style={{ borderBottom: '1px solid var(--hub-border)' }}
            >
              {/* Status dot */}
              <span
                className="mt-0.5 h-2 w-2 shrink-0 self-start rounded-full"
                style={{ background: rule.isActive ? 'var(--hub-positive)' : 'var(--hub-disabled)' }}
              />

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" style={{ color: 'var(--hub-text)' }}>
                  <span className="font-semibold" style={{ color: 'var(--hub-accent)' }}>{rule.keyword}</span>
                  <span className="mx-1.5" style={{ color: 'var(--hub-subtle)' }}>→</span>
                  {rule.category}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                  {rule.name ? `${rule.name} · ` : ''}
                  {rule.kind ? formatTransactionKind(rule.kind) : 'tipo automático'}
                  {' · '}
                  <span style={{ color: rule.isActive ? 'var(--hub-positive)' : 'var(--hub-disabled)' }}>
                    {rule.isActive ? 'ativa' : 'inativa'}
                  </span>
                </p>
              </div>

              {/* Ações */}
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => startEdit(rule)}
                  className="text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(rule)}
                  className="text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {rule.isActive ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rule)}
                  className="text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
