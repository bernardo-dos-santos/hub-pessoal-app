import { useRef, useState } from 'react';
import { backupService, type HubBackup } from '../../core/backup/backupService';
import { isApiCachePrimed } from '../../core/storage/apiStorageAdapter';
import { BackButton } from '../../shared/ui';

type ImportState = 'idle' | 'confirm' | 'success' | 'error';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const MODULE_LABEL: Record<string, string> = {
  finance:  'Financeiro',
  fitness:  'Treino',
  college:  'Faculdade',
  concurso: 'Concurso CBSC',
  rpg:      'RPG',
};

export function BackupPage() {
  const summary = backupService.getSummary();
  const isServerMode = isApiCachePrimed();
  const [importing, setImporting] = useState<ImportState>('idle');
  const [pendingBackup, setPendingBackup] = useState<HubBackup | null>(null);
  const [importResult, setImportResult] = useState<{ restored: number; skipped: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!backupService.validateBackup(parsed)) {
          setErrorMsg('Arquivo inválido — não é um backup do Hub Pessoal.');
          setImporting('error');
          return;
        }
        setPendingBackup(parsed);
        setImporting('confirm');
      } catch {
        setErrorMsg('Não foi possível ler o arquivo JSON.');
        setImporting('error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleDownload() {
    setExporting(true);
    try {
      // Tenta exportar via servidor primeiro (lê direto do SQLite)
      if (isServerMode) {
        const serverBackup = await backupService.exportFromServer();
        if (serverBackup) {
          const json = JSON.stringify(serverBackup, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const date = new Date().toISOString().split('T')[0];
          const a = document.createElement('a');
          a.href = url;
          a.download = `hub-pessoal-backup-${date}.json`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
      }
      // Fallback: exporta do cache/localStorage
      backupService.downloadBackup();
    } finally {
      setExporting(false);
    }
  }

  async function confirmImport() {
    if (!pendingBackup) return;
    let result: { restored: number; skipped: number };
    if (isServerMode) {
      const serverResult = await backupService.importToServer(pendingBackup);
      result = serverResult ?? backupService.importBackup(pendingBackup);
    } else {
      result = backupService.importBackup(pendingBackup);
    }
    setImportResult(result);
    setPendingBackup(null);
    setImporting('success');
    setTimeout(() => window.location.reload(), 1500);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 py-6">
      <BackButton />
      <div>
        <h1 className="text-2xl font-medium" style={{ color: 'var(--hub-text)' }}>Backup</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--hub-subtle)' }}>
          Exporta todos os seus dados locais em um arquivo JSON. Sem servidores — tudo fica no seu PC.
        </p>
      </div>

      {/* Resumo do que será exportado */}
      <div style={{ borderBottom: '1px solid var(--hub-border)', paddingBottom: '24px' }}>
        <h2 className="mb-3 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
          O que será exportado
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {summary.modules.map((mod) => (
            <div key={mod} className="flex items-center gap-2 py-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--hub-accent)' }} />
              <span className="text-sm" style={{ color: 'var(--hub-text-body)' }}>{MODULE_LABEL[mod] ?? mod}</span>
            </div>
          ))}
          {summary.modules.length === 0 && (
            <p className="col-span-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>Nenhum dado encontrado ainda.</p>
          )}
        </div>
        <p className="mt-3 text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
          {summary.keys} chave{summary.keys !== 1 ? 's' : ''} · ~{summary.sizeKb} KB
        </p>
      </div>

      {/* Exportar */}
      <div>
        <h2 className="mb-2 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>Exportar</h2>
        <button
          onClick={handleDownload}
          disabled={summary.keys === 0 || exporting}
          className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {exporting ? 'Exportando…' : '⬇ Baixar backup JSON'}
        </button>
        <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
          {isServerMode
            ? 'Exportando do banco SQLite (modo servidor ativo).'
            : 'Salve o arquivo em local seguro — Google Drive, pen drive, email pra você mesmo.'}
        </p>
      </div>

      {/* Importar */}
      <div>
        <h2 className="mb-2 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>Restaurar</h2>

        {importing === 'idle' && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ⬆ Carregar arquivo de backup
            </button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
            <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
              Atenção: a restauração substitui os dados atuais.
            </p>
          </>
        )}

        {importing === 'confirm' && pendingBackup && (
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium" style={{ color: 'var(--hub-warning)' }}>Confirmar restauração?</p>
            <p className="text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>
              Backup de {formatDate(pendingBackup.exportedAt)} ·{' '}
              {Object.keys(pendingBackup.data).length} chaves
            </p>
            <p className="text-xs" style={{ color: 'var(--hub-warning)' }}>
              Os dados atuais serão substituídos. Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-baseline gap-5 pt-1">
              <button
                onClick={confirmImport}
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-warning)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Sim, restaurar
              </button>
              <button
                onClick={() => { setImporting('idle'); setPendingBackup(null); }}
                className="text-xs transition-opacity hover:opacity-60"
                style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {importing === 'success' && importResult && (
          <div className="py-2">
            <p className="text-sm font-medium" style={{ color: 'var(--hub-positive)' }}>
              ✓ Restaurado com sucesso — {importResult.restored} chaves
            </p>
            <p className="mt-1 text-xs" style={{ color: 'color-mix(in srgb, var(--hub-positive) 70%, transparent)' }}>Recarregando o app…</p>
          </div>
        )}

        {importing === 'error' && (
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium" style={{ color: 'var(--hub-negative)' }}>Erro ao importar</p>
            <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--hub-negative) 80%, transparent)' }}>{errorMsg}</p>
            <button
              onClick={() => setImporting('idle')}
              className="text-xs transition-opacity hover:opacity-60"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
