import { type ChangeEvent, useState } from 'react';
import { ModuleHeader, Card } from '../../../shared/ui';
import { COLLEGE_TABS } from '../components/collegeTabs';
import { isSigaaExport, importSigaaData, type SigaaExport, type SigaaImportResult } from '../services/sigaaImportService';

type ImportResult = SigaaImportResult;

export function SigaaImportPage() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<SigaaExport | null>(null);
  const [loading, setLoading] = useState(false);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setResult(null);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!isSigaaExport(data)) {
          setError('Arquivo invalido. Certifique-se de usar o arquivo gerado pelo script sigaa-sync.js.');
          return;
        }
        setPreview(data);
      } catch {
        setError('Nao foi possivel ler o arquivo. Verifique se e um JSON valido.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function runImport() {
    if (!preview) return;
    setLoading(true);
    try {
      const importResult = importSigaaData(preview);
      setResult(importResult);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro durante a importacao.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Faculdade" title="Importar do SIGAA" tabs={COLLEGE_TABS} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Sincronize disciplinas, avaliacoes, arquivos e notas diretamente do SIGAA IFSC.
      </p>

      <Card className="mb-5" style={{ borderLeft: '2px solid var(--hub-accent)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-accent)' }}>Como usar</h3>
        <ol className="mt-2 grid gap-2">
          <li className="text-xs leading-5" style={{ color: 'var(--hub-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--hub-text)' }}>1.</span>{' '}
            Copie{' '}
            <code className="text-xs" style={{ color: 'var(--hub-text-body)' }}>scripts/config/sigaa-config.example.json</code>
            {' '}para{' '}
            <code className="text-xs" style={{ color: 'var(--hub-text-body)' }}>sigaa-config.json</code>
            {' '}e preencha seu login e senha.
          </li>
          <li className="text-xs leading-5" style={{ color: 'var(--hub-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--hub-text)' }}>2.</span>{' '}
            Execute no terminal:{' '}
            <code className="text-xs" style={{ color: 'var(--hub-text-body)' }}>node scripts/sync/sigaa-sync.js</code>
          </li>
          <li className="text-xs leading-5" style={{ color: 'var(--hub-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--hub-text)' }}>3.</span>{' '}
            Selecione o arquivo{' '}
            <code className="text-xs" style={{ color: 'var(--hub-text-body)' }}>sigaa-export.json</code>
            {' '}gerado abaixo.
          </li>
        </ol>
      </Card>

      {error ? <p className="mb-5 text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p> : null}

      {result ? (
        <Card className="mb-5" style={{ borderLeft: '2px solid var(--hub-positive)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--hub-positive)' }}>Importacao concluida!</p>
          <ul className="mt-2 grid gap-1">
            {[
              `${result.subjects} disciplina${result.subjects === 1 ? '' : 's'} criada${result.subjects === 1 ? '' : 's'}`,
              `${result.assessments} avaliacao${result.assessments === 1 ? '' : 'es'} criada${result.assessments === 1 ? '' : 's'}`,
              `${result.tasks} tarefa${result.tasks === 1 ? '' : 's'} criada${result.tasks === 1 ? '' : 's'}`,
              `${result.materials} material${result.materials === 1 ? 'is' : 'is'} criado${result.materials === 1 ? '' : 's'}`,
              `${result.grades} nota${result.grades === 1 ? '' : 's'} importada${result.grades === 1 ? '' : 's'}`,
            ].map((item) => (
              <li key={item} className="text-xs leading-5" style={{ color: 'var(--hub-muted)' }}>✓ {item}</li>
            ))}
            {result.alerts > 0 && (
              <li className="text-xs leading-5" style={{ color: 'var(--hub-warning)' }}>
                🔔 {result.alerts} aviso{result.alerts === 1 ? '' : 's'} novo{result.alerts === 1 ? '' : 's'} do SIGAA
              </li>
            )}
            {result.skipped > 0 && (
              <li className="text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                ⏭ {result.skipped} item{result.skipped === 1 ? '' : 'ns'} ignorado{result.skipped === 1 ? '' : 's'} — ja existiam
              </li>
            )}
          </ul>
        </Card>
      ) : null}

      {!preview ? (
        <Card className="mb-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--hub-text)' }}>Selecionar arquivo exportado</h3>
          <input
            className="block w-full text-sm"
            style={{ color: 'var(--hub-muted)', background: 'none' }}
            type="file"
            accept=".json,application/json"
            onChange={handleFile}
          />
          <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            Apenas arquivos <code>sigaa-export.json</code> gerados pelo script sao aceitos.
          </p>
        </Card>
      ) : null}

      {preview ? (
        <Card style={{ borderLeft: '2px solid var(--hub-warning)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-warning)' }}>Revisar antes de importar</h3>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
            Exportado em {new Date(preview.exportedAt).toLocaleString('pt-BR')} · Periodo {preview.period} · {preview.studentName}
          </p>

          <div className="mt-4 grid gap-0">
            {preview.courses.map((course, i) => (
              <div key={course.id} className="py-2.5" style={{ borderBottom: i === preview.courses.length - 1 ? 'none' : '1px solid var(--hub-border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>
                  {course.title}{' '}
                  <span className="font-normal" style={{ color: 'var(--hub-subtle)' }}>({course.code})</span>
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                  {course.exams.length} avaliacao{course.exams.length === 1 ? '' : 'es'} · {course.files.length} arquivo{course.files.length === 1 ? '' : 's'} · {course.grades.length} grupo{course.grades.length === 1 ? '' : 's'} de nota
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-5">
            <button
              className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-30"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              disabled={loading}
              type="button"
              onClick={runImport}
            >
              {loading ? 'Importando...' : `Importar ${preview.courses.length} turma${preview.courses.length === 1 ? '' : 's'}`}
            </button>
            <button
              className="text-sm transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              type="button"
              onClick={() => setPreview(null)}
            >
              Cancelar
            </button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
