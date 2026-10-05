import { type ChangeEvent, useMemo, useState } from 'react';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { getFinanceTabs } from '../components/financeTabs';
import { CategoryRulesPanel } from '../components/CategoryRulesPanel';
import { FinanceAlertBox } from '../components/FinanceAlertBox';
import { importCommitService } from '../services/importCommitService';
import { importService } from '../services/importService';
import { categoryRuleService } from '../services/categoryRuleService';
import { checkAndAutoImportInvoice, type InvoiceImportResult } from '../services/nubankInvoiceImportService';
import { pluggyImportService } from '../services/pluggyImportService';
import { pluggyAccountMappingService } from '../services/pluggyAccountMappingService';
import {
  c6BusinessProfile,
  nubankAccountProfile,
  nubankCreditCardProfile,
} from '../services/parsers/parserProfiles';
import { transactionService } from '../services/transactionService';
import { flushPendingWrites } from '../../../core/storage/apiStorageAdapter';
import {
  type DuplicateStatus,
  type ImportCommitResult,
  type ImportPreviewResult,
  type ImportSelectionItem,
  type ParserProfile,
} from '../types/import';
import {
  formatClassificationConfidence,
  formatCurrency,
  formatDate,
  formatTransactionKind,
} from '../utils/financeFormatters';

type ProfileOption = {
  id: string;
  label: string;
  profile: ParserProfile;
};

const profileOptions: ProfileOption[] = [
  { id: 'nubank_account', label: 'Nubank Conta', profile: nubankAccountProfile },
  { id: 'nubank_credit_card', label: 'Nubank Fatura', profile: nubankCreditCardProfile },
  { id: 'c6_business', label: 'C6 Empresa', profile: c6BusinessProfile },
];

const sampleCsvByProfile: Record<string, string> = {
  nubank_account:
    'Data;Valor;Identificador;Descricao\n2026-05-01;-42;nu-1;Pix enviado para Pessoa Desconhecida\n2026-05-02;150;nu-2;Pix recebido de Pessoa Desconhecida',
  nubank_credit_card: 'data,descricao,valor\n2026-05-03,Compra no credito - Steam,-88\n2026-05-04,Pagamento recebido,500',
  c6_business:
    'Resumo qualquer\nData Lancamento;Data Contabil;Titulo;Descricao;Entrada(R$);Saida(R$);Saldo do Dia(R$)\n2026-05-05;2026-05-05;Recebimento cliente;Cliente XPTO;R$ 800,00;;R$ 800,00\n2026-05-06;2026-05-06;Pix enviado para fornecedor;Fornecedor XPTO;;R$ 320,00;R$ 480,00',
};

function getDuplicateStatus(preview: ImportPreviewResult, transactionId: string): DuplicateStatus {
  return preview.duplicateResults?.find((result) => result.transaction.id === transactionId)?.duplicateStatus ?? 'unique';
}

function getDuplicateLabel(status: DuplicateStatus) {
  return {
    exact_duplicate: 'Duplicata exata',
    possible_duplicate: 'Possível duplicata',
    unique: 'Única',
  }[status];
}

function getDuplicateColor(status: DuplicateStatus) {
  return {
    exact_duplicate: 'var(--hub-negative)',
    possible_duplicate: 'var(--hub-warning)',
    unique: 'var(--hub-positive)',
  }[status];
}

function getCategoryColor(category: string) {
  if (category === 'Entrada a revisar') return 'var(--hub-warning)';
  if (category === 'Despesa a revisar') return 'var(--hub-negative)';
  return 'var(--hub-muted)';
}

type AutoImportState = 'idle' | 'loading' | 'done' | 'empty' | 'error';
type PluggyPreviewState = 'idle' | 'loading' | 'empty' | 'error' | 'missing';

export function ImportPage() {
  const [selectedProfileId, setSelectedProfileId] = useState(profileOptions[0].id);
  const [csvText, setCsvText] = useState('');
  const [pasteExpanded, setPasteExpanded] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [selection, setSelection] = useState<ImportSelectionItem[]>([]);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);
  const [commitConfirmationOpen, setCommitConfirmationOpen] = useState(false);
  const [selectedCsvFileName, setSelectedCsvFileName] = useState('');
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const [localDataMessage, setLocalDataMessage] = useState('');
  const [autoImportState, setAutoImportState] = useState<AutoImportState>('idle');
  const [autoImportResult, setAutoImportResult] = useState<InvoiceImportResult | null>(null);
  const [pluggyState, setPluggyState] = useState<PluggyPreviewState>('idle');
  const [previewSource, setPreviewSource] = useState<'csv' | 'pluggy'>('csv');
  const [pluggyAccounts, setPluggyAccounts] = useState<{ id: string; name: string; type: string; institution: string | null }[]>([]);
  const [accountMap, setAccountMap] = useState(() => pluggyAccountMappingService.getPluggyAccountMap());
  const [pluggySkipped, setPluggySkipped] = useState(0);
  const [pluggyPairedCount, setPluggyPairedCount] = useState(0);
  const [persistFailed, setPersistFailed] = useState(false);
  const hubAccounts = pluggyAccountMappingService.listMappableHubAccounts();
  const pendingReviewCount = transactionService.listRequiredReviewTransactions().length;

  const selectedProfile = useMemo(
    () => profileOptions.find((option) => option.id === selectedProfileId)?.profile ?? nubankAccountProfile,
    [selectedProfileId],
  );
  const activeCategoryRules = categoryRuleService.getActiveCategoryRules();
  const importDiagnostics = useMemo(() => {
    const transactions = preview?.normalizedTransactions ?? [];

    return {
      manualRuleCount: transactions.filter((transaction) => transaction.classificationReason.includes('Regra manual')).length,
      transferHeuristicCount: transactions.filter(
        (transaction) => transaction.kind === 'transfer' && !transaction.classificationReason.includes('Regra manual'),
      ).length,
      reviewCount: transactions.filter((transaction) => transaction.needsReview).length,
    };
  }, [preview]);

  const selectionSummary = useMemo(
    () => ({
      selectedCount: selection.filter((item) => item.selected && !item.disabled).length,
      blockedExactCount: selection.filter((item) => item.disabled && item.duplicateStatus === 'exact_duplicate').length,
      unselectedPossibleCount: selection.filter((item) => !item.selected && item.duplicateStatus === 'possible_duplicate').length,
      selectedReviewCount: selection.filter((item) => item.selected && !item.disabled && item.needsReview).length,
    }),
    [selection],
  );

  async function handleAutoImport() {
    setAutoImportState('loading');
    setAutoImportResult(null);
    try {
      const invoice = await checkAndAutoImportInvoice();
      setAutoImportResult(invoice);
      setAutoImportState((invoice?.imported ?? 0) === 0 ? 'empty' : 'done');
    } catch {
      setAutoImportState('error');
    }
  }

  function resetPreview() {
    setPreview(null);
    setSelection([]);
    setCommitResult(null);
    setCommitConfirmationOpen(false);
    setClearConfirmationOpen(false);
  }

  function handleGeneratePreview() {
    const existingTransactions = transactionService.listTransactions();
    const nextPreview = importService.previewCsvImport(csvText, selectedProfile, {}, existingTransactions);

    setPreviewSource('csv');
    setPreview(nextPreview);
    setSelection(importCommitService.prepareImportCommit(nextPreview).selection);
    setCommitResult(null);
    setCommitConfirmationOpen(false);
    setLocalDataMessage('');
  }

  /**
   * Devolve false quando não há arquivo pra ler. Sem esse retorno, uma falha no
   * fetch deixava a tela exatamente igual a "ainda não cliquei" — o usuário
   * clicava, nada acontecia, e não havia como distinguir arquivo ausente de
   * botão quebrado.
   */
  async function loadPluggyAccounts(): Promise<boolean> {
    const data = await pluggyImportService.fetchPluggyPendingFile();

    if (!data) {
      setPluggyAccounts([]);
      setPluggyState('missing');
      return false;
    }

    setPluggyAccounts(
      data.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        institution: account.institution,
      })),
    );
    setPluggyState('idle');
    return true;
  }

  function handleMapAccount(pluggyAccountId: string, hubAccountId: string) {
    setAccountMap(
      hubAccountId
        ? pluggyAccountMappingService.setPluggyAccountMapping(pluggyAccountId, hubAccountId)
        : pluggyAccountMappingService.clearPluggyAccountMapping(pluggyAccountId),
    );
  }

  async function handlePluggyPreview() {
    setPluggyState('loading');
    try {
      // Sem arquivo, o problema é o sync não ter rodado — não faz sentido
      // seguir e culpar o mapeamento de contas.
      if (!(await loadPluggyAccounts())) return;

      const { drafts, skippedForUnmappedAccount } = await pluggyImportService.buildDraftsFromPendingFile();
      setPluggySkipped(skippedForUnmappedAccount);

      if (drafts.length === 0) {
        setPluggyState('empty');
        return;
      }

      const existingTransactions = transactionService.listTransactions();
      const { preview: nextPreview, pairedCount } = pluggyImportService.buildPluggyPreview(drafts, existingTransactions);
      setPluggyPairedCount(pairedCount);

      setPreviewSource('pluggy');
      setPreview(nextPreview);
      setSelection(importCommitService.prepareImportCommit(nextPreview).selection);
      setCommitResult(null);
      setCommitConfirmationOpen(false);
      setLocalDataMessage('');
      setPluggyState('idle');
    } catch {
      setPluggyState('error');
    }
  }

  function handleUseSample() {
    setSelectedCsvFileName('');
    setCsvText(sampleCsvByProfile[selectedProfileId] ?? sampleCsvByProfile.nubank_account);
    resetPreview();
  }

  function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    resetPreview();

    if (!file) {
      setSelectedCsvFileName('');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setSelectedCsvFileName(file.name);
      setCsvText(typeof reader.result === 'string' ? reader.result : '');
    };

    reader.readAsText(file);
  }

  function handleToggleSelection(transactionId: string) {
    setCommitConfirmationOpen(false);
    setSelection((currentSelection) =>
      currentSelection.map((item) =>
        item.transactionId === transactionId && !item.disabled ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  function handleCommitSelection() {
    if (selectionSummary.selectedCount === 0) {
      return;
    }

    setCommitConfirmationOpen(true);
  }

  async function handleConfirmCommit() {
    const existingTransactions = transactionService.listTransactions();
    const profileId = previewSource === 'pluggy' ? 'pluggy' : selectedProfile.id;
    setCommitResult(importCommitService.commitImportSelection(selection, existingTransactions, profileId));
    setCommitConfirmationOpen(false);

    // Confirma que o lote chegou ao backend antes de dar como salvo: a escrita
    // é assíncrona, e sem esta checagem um erro de rede deixava tudo só na
    // memória — a tela dizia "importado" e o próximo reload zerava o trabalho.
    setPersistFailed((await flushPendingWrites()).length > 0);
  }

  function handleClearLocalTransactions() {
    transactionService.clearTransactions();
    resetPreview();
    setClearConfirmationOpen(false);
    setLocalDataMessage('Transações locais do Financeiro limpas.');
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Financeiro" title="Importar" tabs={getFinanceTabs(pendingReviewCount)} />

      <p className="mb-5 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Leia CSVs locais, revise o preview e salve somente os movimentos confirmados.
      </p>

      {/* Auto-import da fatura Nubank (PDF baixado do Gmail no dia 5) */}
      <Card className="mb-5">
        <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '10px' }}>
          Fatura Nubank
        </p>
        <p className="text-sm" style={{ color: 'var(--hub-muted)', marginBottom: '14px' }}>
          Importa as compras da fatura fechada, baixada do Gmail no dia 5 de cada mês.
        </p>
        <button
          onClick={handleAutoImport}
          disabled={autoImportState === 'loading'}
          className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {autoImportState === 'loading' ? 'Verificando…' : 'Importar fatura'}
        </button>
        {autoImportState === 'done' && autoImportResult && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-positive)' }}>
            ✓ {autoImportResult.imported} compra(s) importada(s)
            {autoImportResult.skipped > 0 && ` · ${autoImportResult.skipped} já existiam`}
          </p>
        )}
        {autoImportState === 'empty' && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>
            Nenhuma compra nova — tudo já está importado ou o sync ainda não rodou.
          </p>
        )}
        {autoImportState === 'error' && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-negative)' }}>
            ✗ Erro ao acessar o arquivo da fatura. Verifique se o servidor está rodando.
          </p>
        )}
      </Card>

      {/* Pluggy (Open Finance) */}
      <Card className="mb-5">
        <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '10px' }}>
          Pluggy · Open Finance
        </p>
        <p className="text-sm" style={{ color: 'var(--hub-muted)', marginBottom: '14px' }}>
          Gera o preview das contas e transações reais conectadas via Open Finance. Nada é salvo automaticamente —
          revise e selecione abaixo, igual a um CSV.
        </p>

        <div className="flex flex-wrap items-center gap-5">
          <button
            onClick={handlePluggyPreview}
            disabled={pluggyState === 'loading'}
            className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {pluggyState === 'loading' ? 'Buscando…' : 'Gerar preview da Pluggy'}
          </button>
          <button
            onClick={loadPluggyAccounts}
            className="text-xs transition-opacity hover:opacity-60"
            style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            conferir contas
          </button>
        </div>

        {pluggyAccounts.length > 0 && (
          <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--hub-border)' }}>
            <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
              Contas da Pluggy
            </p>
            <p className="text-xs leading-5" style={{ color: 'var(--hub-subtle)', marginBottom: '14px' }}>
              Cada conta precisa apontar pra uma conta do Hub. Sem isso a mesma transação vinda da Pluggy e do
              Gmail Sync não é reconhecida como duplicata, e o lançamento entra duas vezes.
            </p>
            <div className="grid gap-3">
              {pluggyAccounts.map((account) => (
                <div key={account.id} className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm" style={{ color: 'var(--hub-text)' }}>{account.name}</p>
                    <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                      {account.type === 'CREDIT' ? 'Cartão de crédito' : 'Conta'}
                    </p>
                  </div>
                  <Select
                    className="w-52"
                    value={accountMap[account.id] ?? ''}
                    onChange={(value) => handleMapAccount(account.id, value)}
                  >
                    <Select.Option value="">— não mapeada —</Select.Option>
                    {hubAccounts.map((hubAccount) => (
                      <Select.Option key={hubAccount.id} value={hubAccount.id}>
                        {hubAccount.name} ({hubAccount.scope})
                      </Select.Option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {pluggySkipped > 0 && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-warning)' }}>
            {pluggySkipped} transação(ões) fora do preview por estarem em conta não mapeada.
          </p>
        )}
        {pluggyPairedCount > 0 && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-positive)' }}>
            ✓ {pluggyPairedCount} lançamento(s) reconhecido(s) como transferência entre suas contas — ficam fora do
            cálculo de despesa.
          </p>
        )}
        {pluggyState === 'missing' && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-warning)' }}>
            Nenhum arquivo de sync encontrado. Rode <code>node --env-file=.env scripts/sync/pluggy-sync.js</code> e
            recarregue — se o app é servido pelo backend, o arquivo só aparece depois de <code>npm run build</code>.
          </p>
        )}
        {pluggyState === 'empty' && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>
            Arquivo lido, mas nenhuma transação importável — falta mapear as contas acima.
          </p>
        )}
        {pluggyState === 'error' && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-negative)' }}>
            ✗ Erro ao buscar os dados da Pluggy.
          </p>
        )}
      </Card>

      {/* Painel de upload */}
      <Card className="mb-5">
        <FinanceAlertBox tone="info">
          O arquivo é lido localmente no navegador. Nada é enviado para servidor.
        </FinanceAlertBox>

        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4">
          <label className="space-y-1.5" style={{ minWidth: '160px' }}>
            <span style={{ fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Perfil</span>
            <Select
              className="w-full cursor-pointer appearance-none"
              value={selectedProfileId}
              onChange={(value) => {
                setSelectedProfileId(value);
                resetPreview();
              }}
            >
              {profileOptions.map((option) => (
                <Select.Option key={option.id} value={option.id}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </label>

          <div className="flex flex-wrap items-center gap-5" style={{ paddingBottom: '6px' }}>
            <button
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              type="button"
              onClick={handleGeneratePreview}
            >
              Gerar preview
            </button>
            <button
              className="text-sm transition-opacity hover:opacity-60"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              type="button"
              onClick={handleUseSample}
            >
              usar exemplo
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-1.5">
          <span style={{ fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Arquivo CSV</span>
          <div style={{ paddingTop: '6px' }}>
            <label className="cursor-pointer transition-opacity hover:opacity-70" style={{ display: 'inline-block' }}>
              <input
                className="sr-only"
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileChange}
              />
              <span style={{ fontSize: '13px', color: 'var(--hub-accent)', borderBottom: '1px solid color-mix(in srgb, var(--hub-accent) 30%, transparent)', paddingBottom: '1px' }}>
                {selectedCsvFileName ? selectedCsvFileName : 'Selecionar arquivo local…'}
              </span>
            </label>
            {selectedCsvFileName ? (
              <button
                type="button"
                className="ml-3 text-xs transition-opacity hover:opacity-60"
                style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => { setSelectedCsvFileName(''); setCsvText(''); resetPreview(); }}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        {/* Colar CSV — collapsável */}
        <div className="mt-4">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setPasteExpanded((v) => !v)}
          >
            <span className={`transition-transform ${pasteExpanded ? 'rotate-90' : ''}`}>▶</span>
            {pasteExpanded ? 'Ocultar área de cola' : 'Ou colar CSV manualmente'}
          </button>
          {pasteExpanded && (
            <label className="mt-2 block space-y-1.5">
              <textarea
                className="w-full pb-2 font-mono text-xs leading-6 resize-y"
                style={{ minHeight: '180px' }}
                placeholder="Cole aqui o conteúdo CSV..."
                value={csvText}
                autoFocus
                onChange={(event) => {
                  setCsvText(event.target.value);
                  resetPreview();
                }}
              />
            </label>
          )}
        </div>

        <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--hub-subtle)', lineHeight: 1.6 }}>
          O parser só prepara o preview. O salvamento passa pelos services do Financeiro e continua local nesta etapa.
        </p>
      </Card>

      {/* Dados locais / limpar */}
      <Card className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p style={{ fontSize: '13px', color: 'var(--hub-text-body)', fontWeight: 500 }}>Dados locais</p>
            <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '3px' }}>
              Limpe apenas transações salvas localmente no Financeiro durante testes de importação.
            </p>
          </div>
          <button
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
            type="button"
            onClick={() => setClearConfirmationOpen(true)}
          >
            Limpar transações importadas
          </button>
        </div>

        {clearConfirmationOpen ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ paddingTop: '10px', borderTop: '1px solid color-mix(in srgb, var(--hub-negative) 18%, transparent)' }}>
            <p style={{ fontSize: '12px', color: 'color-mix(in srgb, var(--hub-negative) 80%, transparent)', lineHeight: 1.6 }}>Confirmar limpeza das transações locais?</p>
            <div className="flex items-center gap-5">
              <button
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                type="button"
                onClick={handleClearLocalTransactions}
              >
                Confirmar limpeza
              </button>
              <button
                className="text-xs transition-opacity hover:opacity-60"
                style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                type="button"
                onClick={() => setClearConfirmationOpen(false)}
              >
                cancelar
              </button>
            </div>
          </div>
        ) : null}

        {localDataMessage ? (
          <p style={{ fontSize: '12px', color: 'var(--hub-positive)', marginTop: '12px' }}>{localDataMessage}</p>
        ) : null}
      </Card>

      <Card className="mb-5">
        <CategoryRulesPanel />
      </Card>

      {preview ? (
        <div className="space-y-5">
          {/* Métricas do preview + diagnóstico + erros/avisos */}
          <Card>
            <div className="flex flex-wrap items-end" style={{ gap: '20px 32px', marginBottom: '20px' }}>
              <PreviewStat label="Linhas" value={preview.totalRows} />
              <PreviewStat label="Normalizadas" value={preview.normalizedTransactions.length} />
              <PreviewStat label="A revisar" value={preview.needsReviewCount} tone="warning" />
              <PreviewStat label="Duplicatas exatas" value={preview.exactDuplicateCount ?? 0} tone="danger" />
              <PreviewStat label="Possíveis duplicatas" value={preview.possibleDuplicateCount ?? 0} tone="warning" />
              <PreviewStat label="Erros" value={preview.errors.length} tone="danger" />
              <PreviewStat label="Avisos" value={preview.warnings.length} tone="warning" />
              <PreviewStat label="Entrada a revisar" value={formatCurrency(preview.incomeReviewTotal)} />
            </div>

            {/* Diagnóstico */}
            <details style={{ paddingTop: '16px', borderTop: '1px solid var(--hub-border)' }}>
              <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--hub-subtle)', userSelect: 'none', marginBottom: '12px' }}>
                Diagnóstico do preview
              </summary>
              <div className="flex flex-wrap items-end" style={{ gap: '20px 32px' }}>
                <PreviewStat label="Regras ativas" value={activeCategoryRules.length} />
                <PreviewStat label="Por regra manual" value={importDiagnostics.manualRuleCount} />
                <PreviewStat label="Transferência heurística" value={importDiagnostics.transferHeuristicCount} />
                <PreviewStat label="Para revisão" value={importDiagnostics.reviewCount} tone="warning" />
              </div>
            </details>

            {/* Erros e avisos */}
            {preview.errors.length > 0 || preview.warnings.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--hub-border)' }}>
                <MessageList title="Erros" messages={preview.errors} tone="danger" />
                <MessageList title="Avisos" messages={preview.warnings} tone="warning" />
              </div>
            ) : null}
          </Card>

          {/* Conferir e salvar */}
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ marginBottom: '16px' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--hub-text-body)', fontWeight: 500 }}>Conferir e salvar</p>
                <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '3px' }}>
                  Duplicatas exatas ficam bloqueadas. Possíveis duplicatas exigem escolha explícita.
                </p>
              </div>
              <button
                className="text-sm font-medium transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                type="button"
                onClick={handleCommitSelection}
                disabled={selectionSummary.selectedCount === 0}
              >
                Salvar selecionadas →
              </button>
            </div>

            {commitConfirmationOpen ? (
              <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2" style={{ paddingTop: '10px', paddingBottom: '10px', borderTop: '1px solid color-mix(in srgb, var(--hub-accent) 20%, transparent)' }}>
                <p style={{ fontSize: '12px', color: 'color-mix(in srgb, var(--hub-accent) 80%, transparent)', lineHeight: 1.6 }}>
                  Confirmar salvamento de {selectionSummary.selectedCount} transação(ões)?
                </p>
                <div className="flex items-center gap-5">
                  <button
                    className="text-sm font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                    type="button"
                    onClick={handleConfirmCommit}
                  >
                    Confirmar
                  </button>
                  <button
                    className="text-xs transition-opacity hover:opacity-60"
                    style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                    type="button"
                    onClick={() => setCommitConfirmationOpen(false)}
                  >
                    cancelar
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-end" style={{ gap: '16px 28px' }}>
              <PreviewStat label="Selecionadas" value={selectionSummary.selectedCount} />
              <PreviewStat label="Exatas bloqueadas" value={selectionSummary.blockedExactCount} tone="danger" />
              <PreviewStat label="Possíveis desmarcadas" value={selectionSummary.unselectedPossibleCount} tone="warning" />
              <PreviewStat label="Revisões selecionadas" value={selectionSummary.selectedReviewCount} tone="warning" />
            </div>

            {/* Resultado do commit */}
            {commitResult && persistFailed ? (
              <div
                style={{
                  marginTop: '20px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--hub-negative)',
                }}
              >
                <p style={{ fontSize: '13px', color: 'var(--hub-negative)', fontWeight: 500, marginBottom: '4px' }}>
                  Não foi possível gravar no servidor
                </p>
                <p style={{ fontSize: '12px', color: 'var(--hub-negative)', lineHeight: 1.6 }}>
                  As transações estão só na memória desta aba e <strong>somem se você recarregar</strong>. Verifique se
                  o servidor está no ar e importe de novo — não recarregue antes disso.
                </p>
              </div>
            ) : null}

            {commitResult ? (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--hub-border)' }}>
                <p style={{ fontSize: '13px', color: persistFailed ? 'var(--hub-warning)' : 'var(--hub-positive)', fontWeight: 500, marginBottom: '5px' }}>
                  {persistFailed ? 'Importação apenas em memória' : 'Importação salva'}
                </p>
                <p style={{ fontSize: '12px', color: 'color-mix(in srgb, var(--hub-positive) 60%, transparent)', marginBottom: '16px' }}>
                  Lote {commitResult.batchId}: {commitResult.importedCount} importada(s), {commitResult.skippedCount} ignorada(s).
                </p>
                <div className="flex flex-wrap items-end" style={{ gap: '16px 28px', marginBottom: '16px' }}>
                  <PreviewStat label="Importadas" value={commitResult.importedCount} tone="positive" />
                  <PreviewStat label="A revisar" value={commitResult.reviewCount} tone="warning" />
                  <PreviewStat label="Exatas ignoradas" value={commitResult.exactDuplicateSkippedCount} tone="danger" />
                  <PreviewStat label="Possíveis ignoradas" value={commitResult.possibleDuplicateSkippedCount} tone="warning" />
                </div>
                {commitResult.warnings.length > 0 ? (
                  <MessageList title="Avisos do commit" messages={commitResult.warnings} tone="warning" />
                ) : null}
              </div>
            ) : null}
          </Card>

          {/* Lista de transações do preview */}
          {preview.normalizedTransactions.length > 0 ? (
            <Card>
              <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '16px' }}>
                Transações do preview
              </p>
              <div>
                {preview.normalizedTransactions.map((transaction, txIndex) => {
                  const duplicateStatus = getDuplicateStatus(preview, transaction.id);
                  const duplicateResult = preview.duplicateResults?.find((result) => result.transaction.id === transaction.id);
                  const selectedItem = selection.find((item) => item.transactionId === transaction.id);
                  const matchedRule = categoryRuleService.findMatchingCategoryRule(transaction.description);
                  const wasClassifiedByManualRule = transaction.classificationReason.includes('Regra manual');
                  const isLast = txIndex === preview.normalizedTransactions.length - 1;

                  return (
                    <article
                      key={transaction.id}
                      className="grid gap-3 lg:grid-cols-[140px_1fr_140px] lg:items-start"
                      style={{ padding: '14px 0', borderBottom: isLast ? 'none' : '1px solid var(--hub-border)' }}
                    >
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer" style={{ color: 'var(--hub-text-body)' }}>
                          <input
                            className="h-4 w-4 rounded accent-indigo-500 disabled:cursor-not-allowed"
                            type="checkbox"
                            checked={selectedItem?.selected ?? false}
                            disabled={selectedItem?.disabled ?? false}
                            onChange={() => handleToggleSelection(transaction.id)}
                          />
                          Salvar
                        </label>
                        <div className="space-y-1">
                          <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--hub-subtle)' }}>Data</span>
                          <span className="text-sm font-medium" style={{ color: 'var(--hub-text-body)' }}>{formatDate(transaction.date)}</span>
                        </div>
                      </div>

                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="min-w-0 truncate text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{transaction.description}</h4>
                          <span className="text-xs font-semibold" style={{ color: getCategoryColor(transaction.category) }}>
                            {transaction.category}
                          </span>
                          <span className="text-xs font-semibold" style={{ color: getDuplicateColor(duplicateStatus) }}>
                            {getDuplicateLabel(duplicateStatus)}
                          </span>
                        </div>
                        <p className="text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                          {formatTransactionKind(transaction.kind)} · {transaction.accountName ?? 'Sem conta'} · {transaction.scope} · confiança{' '}
                          {formatClassificationConfidence(transaction.classificationConfidence)}
                        </p>
                        <p className="text-xs leading-5" style={{ color: 'var(--hub-muted)' }}>{transaction.classificationReason}</p>
                        <details style={{ paddingTop: '6px', borderTop: '1px solid var(--hub-border)', fontSize: '12px', lineHeight: 1.6, color: 'var(--hub-subtle)' }}>
                          <summary className="cursor-pointer font-semibold transition-opacity hover:opacity-70" style={{ userSelect: 'none', color: 'var(--hub-subtle)' }}>Diagnóstico da classificação</summary>
                          <div className="mt-2 grid gap-1">
                            <span>Categoria: {transaction.category}</span>
                            <span>Tipo: {formatTransactionKind(transaction.kind)}</span>
                            <span>Confiança: {formatClassificationConfidence(transaction.classificationConfidence)}</span>
                            <span>Categoria manual: {transaction.manualCategory ? 'sim' : 'não'}</span>
                            <span>Regras ativas carregadas: {activeCategoryRules.length}</span>
                            <span>
                              Regra manual:{' '}
                              {wasClassifiedByManualRule
                                ? matchedRule
                                  ? `${matchedRule.ruleKeyword} -> ${matchedRule.category}`
                                  : transaction.classificationReason
                                : matchedRule
                                  ? `Regra "${matchedRule.ruleKeyword}" bateu, mas a classificação atual manteve ${formatTransactionKind(transaction.kind)}.`
                                  : activeCategoryRules.length > 0
                                    ? 'Nenhuma regra manual bateu nesta descrição.'
                                    : 'Nenhuma regra manual ativa carregada.'}
                            </span>
                            {activeCategoryRules.length > 0 ? (
                              <span>Keywords ativas: {activeCategoryRules.map((rule) => rule.keyword).join(' / ')}</span>
                            ) : null}
                            <span>Motivo: {transaction.classificationReason}</span>
                          </div>
                        </details>
                        {duplicateResult?.reason ? <p className="text-xs leading-5" style={{ color: 'var(--hub-warning)' }}>{duplicateResult.reason}</p> : null}
                        {selectedItem?.reason ? <p className="text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{selectedItem.reason}</p> : null}
                      </div>

                      <div className="space-y-1 lg:text-right">
                        <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--hub-subtle)' }}>Valor</span>
                        <strong
                          className="block text-base tabular-nums"
                          style={{ fontWeight: 300, color: transaction.amount < 0 ? 'var(--hub-negative)' : 'var(--hub-positive)' }}
                        >
                          {formatCurrency(transaction.amount)}
                        </strong>
                        <span className="block text-xs" style={{ color: 'var(--hub-subtle)' }}>{transaction.needsReview ? 'Revisar' : 'Sem revisão'}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: 'var(--hub-muted)' }}>Nenhuma transação normalizada.</p>
                <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '8px' }}>
                  Verifique o perfil selecionado, o cabeçalho do CSV e as mensagens de erro.
                </p>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--hub-muted)' }}>Cole ou selecione um CSV para gerar o preview.</p>
            <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '8px', maxWidth: '480px', margin: '8px auto 0' }}>
              Escolha o perfil, cole ou selecione o arquivo local e clique em Gerar preview para conferir transações, pendências e duplicidades.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

function PreviewStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
}) {
  const valueColor = {
    danger: 'var(--hub-negative)',
    neutral: 'var(--hub-text)',
    positive: 'var(--hub-positive)',
    warning: 'var(--hub-warning)',
  }[tone];

  return (
    <div>
      <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
        {label}
      </p>
      <p className="tabular-nums" style={{ fontSize: '18px', fontWeight: 300, letterSpacing: '-0.02em', color: valueColor }}>
        {value}
      </p>
    </div>
  );
}

function MessageList({ title, messages, tone }: { title: string; messages: string[]; tone: 'warning' | 'danger' }) {
  const textColor = tone === 'danger' ? 'var(--hub-negative)' : 'var(--hub-warning)';

  if (messages.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ fontSize: '11px', color: textColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', fontWeight: 600 }}>
        {title}
      </p>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {messages.slice(0, 6).map((message) => (
          <li key={message} style={{ fontSize: '12px', color: textColor, lineHeight: 1.6 }}>{message}</li>
        ))}
      </ul>
      {messages.length > 6 ? (
        <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginTop: '6px' }}>
          Mais {messages.length - 6} mensagens.
        </p>
      ) : null}
    </div>
  );
}
