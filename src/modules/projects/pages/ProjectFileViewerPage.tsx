import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as pdfjs from 'pdfjs-dist';
// `?url` faz o Vite empacotar o worker como asset local. Nunca apontar para
// CDN: o guia proíbe dependência de rede em asset do app, porque quebra o
// modo offline do PWA e do APK — mesma razão que bane a fonte via Google Fonts.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Card, Eyebrow, ModuleHeader } from '../../../shared/ui';
import { MarkdownView } from '../../study/components/MarkdownView';
import { getProjectTabs, projectEyebrow } from '../components/projectTabs';
import { projectFileService } from '../services/projectFileService';
import { projectService } from '../services/projectService';
import { viewerKindFor, type FileViewerKind, type ProjectFile } from '../types/projectFile';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Largura máxima de render — acima disso o canvas fica pesado sem ganho visual. */
const MAX_CANVAS_WIDTH = 1000;

type PdfInfo = { pages: number | null; words: number; preview: string };

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function ProjectFileViewerPage() {
  const { projectId = '', fileId = '' } = useParams();
  const project = projectService.getById(projectId);

  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [kind, setKind] = useState<FileViewerKind | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  // O tipo do anexo decide TUDO que vem depois, e ele só é conhecido depois de
  // buscar o metadado — por isso nenhum carregamento dispara antes daqui.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    projectFileService.listByProject(projectId)
      .then((files) => {
        if (cancelled) return;
        const found = files.find((f) => f.id === fileId) ?? null;
        setFile(found);
        setKind(found ? viewerKindFor(found) : null);
        if (found && !viewerKindFor(found)) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) { setFile(null); setStatus('error'); setError('Não foi possível carregar o arquivo.'); }
      });
    return () => { cancelled = true; };
  }, [projectId, fileId]);

  // Metadados do PDF são complemento: se falharem (arquivo protegido, por
  // exemplo), a renderização continua — por isso não mexem em `status`.
  useEffect(() => {
    if (kind !== 'pdf') return;
    let cancelled = false;
    projectFileService.pdfInfo(fileId)
      .then((data) => { if (!cancelled) setPdfInfo(data); })
      .catch(() => { if (!cancelled) setPdfInfo(null); });
    return () => { cancelled = true; };
  }, [kind, fileId]);

  useEffect(() => {
    if (kind !== 'markdown' && kind !== 'text') return;
    let cancelled = false;
    projectFileService.readText(fileId)
      .then((content) => { if (!cancelled) { setText(content); setStatus('ready'); } })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.');
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [kind, fileId]);

  /**
   * PDF renderiza em canvas via pdf.js, e não num <iframe>.
   *
   * O WebView do Android não embute visualizador de PDF: `<iframe src="x.pdf">`
   * funciona no Chrome do desktop e dá tela branca no APK. Canvas é o único
   * caminho que funciona nos dois.
   */
  useEffect(() => {
    if (kind !== 'pdf') return;
    let cancelled = false;
    const task = pdfjs.getDocument({ url: projectFileService.inlineUrl(fileId), withCredentials: false });

    task.promise
      .then(async (pdf) => {
        if (cancelled) return;
        const host = canvasHostRef.current;
        if (!host) return;
        host.replaceChildren();

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const available = Math.min(host.clientWidth || MAX_CANVAS_WIDTH, MAX_CANVAS_WIDTH);
          const viewport = page.getViewport({ scale: available / baseViewport.width });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.marginBottom = '12px';
          canvas.style.borderRadius = '8px';
          canvas.style.border = '1px solid var(--hub-border)';
          const context = canvas.getContext('2d');
          if (!context) continue;
          host.appendChild(canvas);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
        }
        if (!cancelled) setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Não foi possível abrir o PDF.');
        setStatus('error');
      });

    return () => { cancelled = true; task.destroy(); };
  }, [kind, fileId]);

  if (!project) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Projetos" title="Arquivo" back />
        <Card><p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Projeto não encontrado.</p></Card>
      </div>
    );
  }

  const resumo = kind === 'pdf'
    ? pdfInfo && `${pdfInfo.pages ?? '—'} página(s)${pdfInfo.words > 0 ? ` · ${pdfInfo.words.toLocaleString('pt-BR')} palavras` : ''}`
    : text !== null
      ? `${text.split('\n').length.toLocaleString('pt-BR')} linhas · ${countWords(text).toLocaleString('pt-BR')} palavras`
      : null;

  return (
    <div className="space-y-4">
      <ModuleHeader
        eyebrow={projectEyebrow(project)}
        title={file?.fileName ?? 'Arquivo'}
        tabs={getProjectTabs(project)}
        back
      />

      {resumo && (
        <Card>
          <Eyebrow style={{ marginBottom: '8px' }}>Resumo</Eyebrow>
          <p className="text-xs tabular-nums" style={{ color: 'var(--hub-text-body)' }}>{resumo}</p>
          {kind === 'pdf' && pdfInfo?.preview && (
            <p className="mt-2 whitespace-pre-line text-xs leading-5" style={{ color: 'var(--hub-muted)' }}>
              {pdfInfo.preview}
            </p>
          )}
        </Card>
      )}

      <Card>
        {status === 'loading' && (
          <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>
            {kind === 'pdf' ? 'Renderizando o PDF…' : 'Carregando…'}
          </p>
        )}

        {status === 'error' && (
          <>
            <p className="text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p>
            <a
              href={projectFileService.downloadUrl(fileId)}
              className="mt-3 inline-block text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)' }}
            >
              Baixar o arquivo
            </a>
          </>
        )}

        {/* Tipo sem visualizador não é erro — é um .zip, e baixar é tudo que dá. */}
        {status === 'ready' && kind === null && (
          <>
            <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>
              Este tipo de arquivo não pode ser aberto aqui.
            </p>
            <a
              href={projectFileService.downloadUrl(fileId)}
              className="mt-3 inline-block text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)' }}
              download={file?.fileName}
            >
              Baixar o arquivo
            </a>
          </>
        )}

        {kind === 'markdown' && text !== null && <MarkdownView content={text} />}

        {kind === 'text' && text !== null && (
          <pre
            className="overflow-x-auto text-xs leading-5"
            style={{ color: 'var(--hub-text-body)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {text}
          </pre>
        )}

        <div ref={canvasHostRef} />
      </Card>
    </div>
  );
}
