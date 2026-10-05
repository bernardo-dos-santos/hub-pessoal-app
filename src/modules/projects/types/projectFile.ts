/**
 * Metadado de um arquivo anexado a um projeto (ou frente). Os bytes ficam em
 * disco no servidor dedicado (fora do hub.db) — aqui só o necessário pra
 * listar, baixar e apagar. Sem `updatedAt`: um arquivo anexado não é editado,
 * só substituído por um novo anexo ou removido.
 */
/** Como o visualizador deve renderizar o anexo. `null` = só dá para baixar. */
export type FileViewerKind = 'pdf' | 'markdown' | 'text';

/** Extensões de texto puro que valem abrir — nada de binário disfarçado. */
const TEXT_EXTENSIONS = ['.txt', '.log', '.csv', '.json', '.yml', '.yaml'];

/**
 * Decide como abrir um anexo.
 *
 * A primeira versão aceitava só PDF, apoiada na suposição de que PDF seria a
 * maioria dos anexos. Os dados desmentiram na primeira olhada: os arquivos
 * realmente anexados eram 100% Markdown, e o botão de abrir não aparecia em
 * nenhum deles.
 *
 * Markdown e texto saem de graça — `MarkdownView` já existe no módulo Estudos
 * e o conteúdo é o próprio corpo da resposta, sem parser nem dependência nova.
 *
 * DOCX segue fora: exigiria `mammoth`, e continua não sendo o que aparece aqui.
 */
export function viewerKindFor(file: Pick<ProjectFile, 'fileName' | 'mimeType'>): FileViewerKind | null {
  const name = file.fileName.toLowerCase();
  if (file.mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.mimeType === 'text/markdown' || name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';
  if (file.mimeType.startsWith('text/') || TEXT_EXTENSIONS.some((ext) => name.endsWith(ext))) return 'text';
  return null;
}

export function isViewableFile(file: Pick<ProjectFile, 'fileName' | 'mimeType'>): boolean {
  return viewerKindFor(file) !== null;
}

export type ProjectFile = {
  id: string;
  projectId: string;
  /** Opcional: arquivo pode ser do projeto todo, não de uma frente. */
  frontId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};
