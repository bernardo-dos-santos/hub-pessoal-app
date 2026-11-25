import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { ModuleHeader, Card, Select, Toast } from '../../../shared/ui';
import { getFinanceTabs } from '../components/financeTabs';
import { importCommitService } from '../services/importCommitService';
import { importService } from '../services/importService';
import { checkAndAutoImportInvoice, type InvoiceImportResult } from '../services/nubankInvoiceImportService';
import {
  c6BusinessProfile,
  nubankAccountProfile,
  nubankCreditCardProfile,
} from '../services/parsers/parserProfiles';
import { transactionService } from '../services/transactionService';
import { flushPendingWrites, retryFailedWrites } from '../../../core/storage/apiStorageAdapter';
import { useSession } from '../../../core/session/session';
import { isRequiredReviewTransaction } from '../../../shared/finance/financeTotals.js';
import { ImportReviewMonths } from '../components/ImportReviewMonths';
import { transactionMonthKey } from '../utils/financeCalculations';
import {
  type DuplicateStatus,
  type ImportCommitResult,
  type ImportPreviewResult,
  type ImportSelectionItem,
  type ParserProfile,
} from '../types/import';
import { type Transaction } from '../types/transaction';
import { formatCurrency, formatDate } from '../utils/financeFormatters';

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

const LABEL_STYLE = { fontSize: '11px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 } as const;
const textButton = (color: string) => ({ color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }) as const;

function getDuplicateStatus(preview: ImportPreviewResult, transactionId: string): DuplicateStatus {
  return preview.duplicateResults?.find((result) => result.transaction.id === transactionId)?.duplicateStatus ?? 'unique';
}

const DUPLICATE_LABEL: Record<DuplicateStatus, string> = {
  exact_duplicate: 'já existe',
  possible_duplicate: 'parecido com um salvo',
  unique: '',
};

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

type AutoImportState = 'idle' | 'loading' | 'done' | 'empty' | 'error';

/**
 * Pick the file, see what it brings, save. The preview is generated as soon as
 * the file is read and sits right under the picker, summed up in one sentence;
 * the per-line detail is below it for whoever wants to check.
 */
export function ImportPage() {
  const session = useSession();
  const [selectedProfileId, setSelectedProfileId] = useState(profileOptions[0].id);
  const [csvText, setCsvText] = useState('');
  const [pasteExpanded, setPasteExpanded] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [selection, setSelection] = useState<ImportSelectionItem[]>([]);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);
  const [selectedCsvFileName, setSelectedCsvFileName] = useState('');
  const [readError, setReadError] = useState('');
  const [autoImportState, setAutoImportState] = useState<AutoImportState>('idle');
  const [autoImportResult, setAutoImportResult] = useState<InvoiceImportResult | null>(null);
  const [persistFailed, setPersistFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pendingReviewCount = transactionService.listCurrentMonthReviewTransactions().length;

  const selectedProfile = useMemo(
    () => profileOptions.find((option) => option.id === selectedProfileId)?.profile ?? nubankAccountProfile,
    [selectedProfileId],
  );

  const summary = useMemo(
    () => ({
      selected: selection.filter((item) => item.selected && !item.disabled).length,
      existing: selection.filter((item) => item.disabled && item.duplicateStatus === 'exact_duplicate').length,
      similar: selection.filter((item) => !item.selected && item.duplicateStatus === 'possible_duplicate').length,
      toReview: selection.filter((item) => item.selected && !item.disabled && item.needsReview).length,
    }),
    [selection],
  );

  async function handleAutoImport() {
    setAutoImportState('loading');
    setAutoImportResult(null);
    try {
      const invoice = await checkAndAutoImportInvoice();
      setAutoImportResult(invoice);
      if (invoice?.error) {
        setAutoImportState('error');
        return;
      }
      setAutoImportState((invoice?.imported ?? 0) === 0 ? 'empty' : 'done');
    } catch {
      setAutoImportState('error');
    }
  }

  function resetPreview() {
    setPreview(null);
    setSelection([]);
    setCommitResult(null);
  }

  function generatePreview(text: string, profile: ParserProfile = selectedProfile) {
    if (!text.trim()) return;
    const nextPreview = importService.previewCsvImport(text, profile, {}, transactionService.listForDuplicateCheck());
    setPreview(nextPreview);
    setSelection(importCommitService.prepareImportCommit(nextPreview).selection);
    setCommitResult(null);
    // On a phone the preview is below the fold: take the person there.
    window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    resetPreview();
    setReadError('');
    if (!file) {
      setSelectedCsvFileName('');
      return;
    }
    // Read as bytes and decode as UTF-8, falling back to Windows-1252 — some bank
    // exports use it, and reading them as UTF-8 broke "Descrição" in the header.
    file
      .arrayBuffer()
      .then((buffer) => {
        let text: string;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch {
          text = new TextDecoder('windows-1252').decode(buffer);
        }
        setSelectedCsvFileName(file.name);
        setCsvText(text);
        generatePreview(text);
      })
      .catch(() => {
        setSelectedCsvFileName('');
        setReadError(`Não foi possível ler "${file.name}".`);
      });
    // Choosing the same file again should read it again.
    event.target.value = '';
  }

  async function handleRetryPersist() {
    setRetrying(true);
    const stillFailing = await retryFailedWrites(financeFailures(await flushPendingWrites()));
    setPersistFailed(financeFailures(stillFailing).length > 0);
    setRetrying(false);
  }

  function handleToggleSelection(transactionId: string) {
    setSelection((currentSelection) =>
      currentSelection.map((item) =>
        item.transactionId === transactionId && !item.disabled ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  async function handleSave() {
    if (summary.selected === 0) return;
    // Saving is undoable instead of confirmed: the snapshot puts back the lines
    // and whatever pairing (transfers, reimbursements) the import touched.
    const before: Transaction[] = transactionService.listTransactions();
    const result = importCommitService.commitImportSelection(selection, transactionService.listForDuplicateCheck(), selectedProfile.id);
    setCommitResult(result);
    setPreview(null);
    setSelection([]);
    setSelectedCsvFileName('');
    setCsvText('');
    setToast({
      text: `${plural(result.importedCount, 'lançamento salvo', 'lançamentos salvos')}.`,
      undo: () => {
        transactionService.replaceTransactions(before);
        setCommitResult(null);
        setToast({ text: 'Importação desfeita.' });
      },
    });

    // Confirm the batch reached the backend before calling it saved: the write is
    // async, and without this a network error left everything only in memory.
    setPersistFailed(financeFailures(await flushPendingWrites()).length > 0);
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Financeiro" title="Importar" tabs={getFinanceTabs(pendingReviewCount)} />

      <Card className="mb-5">
        <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '6px' }}>
          Extrato do banco
        </p>
        <p className="text-sm leading-6" style={{ color: 'var(--hub-muted)', marginBottom: '18px' }}>
          Baixe o extrato ou a fatura em CSV no app do banco e escolha o arquivo — dá para conferir antes de salvar.
        </p>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <label className="space-y-1.5" style={{ minWidth: '180px' }}>
            <span style={LABEL_STYLE}>Banco e tipo</span>
            <Select
              className="w-full"
              value={selectedProfileId}
              onChange={(value) => {
                setSelectedProfileId(value);
                const profile = profileOptions.find((option) => option.id === value)?.profile;
                // The same file read with the right bank: no need to pick it again.
                if (csvText && profile) generatePreview(csvText, profile);
                else resetPreview();
              }}
            >
              {profileOptions.map((option) => (
                <Select.Option key={option.id} value={option.id}>{option.label}</Select.Option>
              ))}
            </Select>
          </label>

          <div className="space-y-1.5">
            <span style={LABEL_STYLE}>Arquivo CSV</span>
            <div className="flex items-center gap-3" style={{ paddingTop: '4px' }}>
              <label className="cursor-pointer transition-opacity hover:opacity-70">
                <input className="sr-only" type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} />
                <span className="text-sm font-medium" style={{ color: 'var(--hub-accent)' }}>
                  {selectedCsvFileName || 'Escolher arquivo…'}
                </span>
              </label>
              {selectedCsvFileName ? (
                <button
                  type="button"
                  aria-label="Tirar o arquivo escolhido"
                  className="flex h-8 w-8 items-center justify-center text-sm transition-opacity hover:opacity-60"
                  style={textButton('var(--hub-subtle)')}
                  onClick={() => { setSelectedCsvFileName(''); setCsvText(''); resetPreview(); }}
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {readError ? <p className="mt-3 text-sm" style={{ color: 'var(--hub-negative)' }}>{readError}</p> : null}

        <div className="mt-5">
          <button
            type="button"
            className="text-xs transition-opacity hover:opacity-70"
            style={textButton('var(--hub-subtle)')}
            aria-expanded={pasteExpanded}
            onClick={() => setPasteExpanded((v) => !v)}
          >
            {pasteExpanded ? 'esconder a área de colar' : 'ou colar o conteúdo do CSV'}
          </button>
          {pasteExpanded && (
            <div className="mt-2 grid gap-2">
              <textarea
                className="w-full pb-2 font-mono text-xs leading-6 resize-y"
                style={{ minHeight: '160px' }}
                placeholder="Cole aqui o conteúdo CSV..."
                aria-label="Conteúdo do CSV"
                value={csvText}
                onChange={(event) => {
                  setCsvText(event.target.value);
                  setSelectedCsvFileName('');
                  resetPreview();
                }}
              />
              <button type="button" className="justify-self-start text-sm font-medium transition-opacity hover:opacity-70" style={textButton('var(--hub-accent)')} onClick={() => generatePreview(csvText)}>
                Ler o que colei
              </button>
            </div>
          )}
        </div>
      </Card>

      <div ref={previewRef} className="scroll-mt-6" />

      {commitResult ? (
        <Card className="mb-5">
          {persistFailed ? (
            <div className="mb-4" style={{ padding: '12px 14px', borderRadius: 'var(--hub-radius-card)', border: '1px solid var(--hub-negative)' }}>
              <p style={{ fontSize: '13px', color: 'var(--hub-negative)', fontWeight: 500, marginBottom: '4px' }}>Não foi possível gravar no servidor</p>
              <p style={{ fontSize: '12px', color: 'var(--hub-negative)', lineHeight: 1.6 }}>
                Os lançamentos estão só nesta aba e <strong>somem se você recarregar</strong>. Confira a conexão e tente gravar de novo antes de sair.
              </p>
              <button type="button" onClick={handleRetryPersist} disabled={retrying} className="mt-2 text-sm font-medium transition-opacity hover:opacity-70" style={textButton('var(--hub-negative)')}>
                {retrying ? 'Gravando…' : 'Tentar gravar de novo'}
              </button>
            </div>
          ) : null}
          <p className="text-sm" style={{ color: persistFailed ? 'var(--hub-warning)' : 'var(--hub-positive)' }}>
            {plural(commitResult.importedCount, 'lançamento salvo', 'lançamentos salvos')}
            {commitResult.skippedCount > 0 ? ` · ${plural(commitResult.skippedCount, 'ficou de fora', 'ficaram de fora')}` : ''}
            {commitResult.reviewCount > 0 ? ` · ${commitResult.reviewCount} para revisar` : ''}
          </p>
          <ImportReviewMonths months={[...new Set(commitResult.importedTransactions.filter(isRequiredReviewTransaction).map(transactionMonthKey))].sort()} />
          {commitResult.warnings.length > 0 ? <MessageList messages={commitResult.warnings} tone="warning" /> : null}
        </Card>
      ) : null}

      {preview ? (
        <Card className="mb-5">
          {preview.normalizedTransactions.length === 0 ? (
            <>
              <p className="text-sm" style={{ color: 'var(--hub-text)' }}>Nenhum lançamento encontrado no arquivo.</p>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                Confira se "Banco e tipo" é o do arquivo — o extrato da conta e a fatura do cartão têm colunas diferentes.
              </p>
              <MessageList messages={preview.errors} tone="danger" />
            </>
          ) : (
            <>
              {/* The answer first: what saving will do, in one sentence. */}
              <p className="text-sm leading-6" style={{ color: 'var(--hub-text)' }}>
                {plural(summary.selected, 'lançamento novo', 'lançamentos novos')}
                {summary.existing > 0 ? ` · ${summary.existing} já ${summary.existing === 1 ? 'estava salvo' : 'estavam salvos'}` : ''}
                {summary.toReview > 0 ? ` · ${summary.toReview} ${summary.toReview === 1 ? 'vai' : 'vão'} para Revisar` : ''}
              </p>
              {summary.similar > 0 ? (
                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-warning)' }}>
                  {plural(summary.similar, 'linha parecida', 'linhas parecidas')} com lançamentos já salvos ficou desmarcada — marque abaixo se for outra compra.
                </p>
              ) : null}
              <MessageList messages={preview.errors} tone="danger" />
              <button
                type="button"
                className="mt-4 text-sm font-medium transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
                style={textButton('var(--hub-accent)')}
                disabled={summary.selected === 0}
                onClick={handleSave}
              >
                {summary.selected === 0 ? 'Nada novo para salvar' : `Salvar ${plural(summary.selected, 'lançamento', 'lançamentos')}`}
              </button>

              <div className="mt-5" style={{ borderTop: '1px solid var(--hub-border)' }}>
                {preview.normalizedTransactions.map((transaction, index) => {
                  const duplicateStatus = getDuplicateStatus(preview, transaction.id);
                  const selectedItem = selection.find((item) => item.transactionId === transaction.id);
                  const isLast = index === preview.normalizedTransactions.length - 1;
                  return (
                    <label
                      key={transaction.id}
                      className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3"
                      style={{ borderBottom: isLast ? 'none' : '1px solid var(--hub-border)' }}
                    >
                      <input
                        className="h-4 w-4 rounded disabled:cursor-not-allowed"
                        type="checkbox"
                        aria-label={`Salvar ${transaction.description}`}
                        checked={selectedItem?.selected ?? false}
                        disabled={selectedItem?.disabled ?? false}
                        onChange={() => handleToggleSelection(transaction.id)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm" style={{ color: selectedItem?.disabled ? 'var(--hub-subtle)' : 'var(--hub-text)' }}>
                          {transaction.description}
                        </span>
                        <span className="block text-xs" style={{ color: 'var(--hub-subtle)' }}>
                          <span className="tabular-nums">{formatDate(transaction.date)}</span> · {transaction.category}
                          {DUPLICATE_LABEL[duplicateStatus] ? (
                            <span style={{ color: duplicateStatus === 'exact_duplicate' ? 'var(--hub-subtle)' : 'var(--hub-warning)' }}> · {DUPLICATE_LABEL[duplicateStatus]}</span>
                          ) : null}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums" style={{ color: transaction.amount < 0 ? 'var(--hub-negative)' : 'var(--hub-positive)' }}>
                        {formatCurrency(transaction.amount)}
                      </span>
                    </label>
                  );
                })}
              </div>
              {preview.warnings.length > 0 ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs" style={{ color: 'var(--hub-subtle)' }}>{plural(preview.warnings.length, 'aviso da leitura', 'avisos da leitura')}</summary>
                  <MessageList messages={preview.warnings} tone="warning" />
                </details>
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      {/* The invoice PDF comes from the owner's Gmail sync — nobody else has it yet. */}
      {session.isOwner ? (
        <Card className="mb-5">
          <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '6px' }}>
            Fatura Nubank do e-mail
          </p>
          <p className="text-sm leading-6" style={{ color: 'var(--hub-muted)', marginBottom: '12px' }}>
            Importa as compras da fatura fechada, baixada do Gmail no dia 5 de cada mês.
          </p>
          <button
            type="button"
            onClick={handleAutoImport}
            disabled={autoImportState === 'loading'}
            className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
            style={textButton('var(--hub-accent)')}
          >
            {autoImportState === 'loading' ? 'Verificando…' : 'Importar fatura'}
          </button>
          {autoImportState === 'done' && autoImportResult && autoImportResult.error === undefined && (
            <>
              <p className="mt-3 text-sm" style={{ color: 'var(--hub-positive)' }}>
                {plural(autoImportResult.imported, 'compra importada', 'compras importadas')}
                {autoImportResult.skipped > 0 && ` · ${autoImportResult.skipped} já existiam`}
              </p>
              <ImportReviewMonths months={autoImportResult.reviewMonths} />
            </>
          )}
          {autoImportState === 'empty' && (
            <p className="mt-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>
              Nenhuma compra nova — tudo já está importado ou a fatura deste mês ainda não chegou.
            </p>
          )}
          {autoImportState === 'error' && (
            <p className="mt-3 text-sm" style={{ color: 'var(--hub-negative)' }}>
              {autoImportResult?.error ?? 'Erro ao buscar a fatura no servidor.'}
            </p>
          )}
        </Card>
      ) : null}

      {toast ? (
        <Toast
          text={toast.text}
          tone={toast.undo ? 'positive' : 'neutral'}
          onClose={() => setToast(null)}
          actions={toast.undo ? [{ label: 'Desfazer', onClick: toast.undo }] : []}
        />
      ) : null}
    </div>
  );
}

function MessageList({ messages, tone }: { messages: string[]; tone: 'warning' | 'danger' }) {
  const textColor = tone === 'danger' ? 'var(--hub-negative)' : 'var(--hub-warning)';
  if (messages.length === 0) return null;
  return (
    <div style={{ marginTop: '12px' }}>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {messages.slice(0, 6).map((message) => (
          <li key={message} style={{ fontSize: '12px', color: textColor, lineHeight: 1.6 }}>{message}</li>
        ))}
      </ul>
      {messages.length > 6 ? (
        <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginTop: '6px' }}>Mais {messages.length - 6}.</p>
      ) : null}
    </div>
  );
}

/** Only the finance keys matter here — an old failed write of another module isn't this import's problem. */
function financeFailures(keys: string[]) {
  return keys.filter((key) => key.startsWith('finance.'));
}
