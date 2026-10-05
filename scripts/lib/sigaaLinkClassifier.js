/**
 * sigaaLinkClassifier.js — decide quais links/linhas do SIGAA são arquivos e
 * qual é a extensão de cada um.
 *
 * Por que existe em arquivo próprio: esta lógica morava dentro do
 * `page.evaluate()` do sigaa-sync.js, ou seja, dentro do navegador que o
 * Puppeteer controla. Lá ela só era alcançável logando no SIGAA de verdade —
 * cada verificação custava alguns minutos e falhava quando o IFSC mudava o
 * HTML ou o servidor deles caía. Aqui é função pura: entram strings, sai o
 * resultado. Dá para cobrir todos os casos em milissegundos, offline.
 *
 * A divisão de trabalho passa a ser: o navegador COLHE (percorre o DOM e
 * devolve dados crus), o Node DECIDE (classifica esses dados).
 *
 * Uso:
 *   import { classifySigaaFiles } from '../lib/sigaaLinkClassifier.js';
 *   const harvest = await page.evaluate(() => ({ rows: [...], links: [...] }));
 *   const files = classifySigaaFiles(harvest);
 */

/**
 * Extensões conhecidas que NÃO são PDF.
 *
 * A regra do classificador é "sem extensão não-PDF conhecida → assume PDF", então
 * toda extensão que falta aqui vira um falso PDF. A lista original tinha só
 * zip/doc/ppt/xls/mp4/avi, e o sync real de 18/08 mostrou o custo: .png, .mp3 e
 * .txt do SIGAA eram mandados ao extrator de PDF, que respondia
 * "Invalid PDF structure" para cada um.
 *
 * É lista explícita, e não "qualquer coisa depois do último ponto", de propósito:
 * material com nome tipo "Lista de exercícios cap.10" tem um sufixo que parece
 * extensão e não é — e viraria falso negativo, escondendo um PDF de verdade.
 */
const NON_PDF_EXTENSIONS = [
  // texto e documento
  'doc', 'docx', 'odt', 'rtf', 'txt', 'md',
  // planilha
  'xls', 'xlsx', 'ods', 'csv',
  // apresentação
  'ppt', 'pptx', 'odp',
  // imagem
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg',
  // áudio
  'mp3', 'wav', 'ogg', 'm4a',
  // vídeo
  'mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm',
  // arquivo compactado
  'zip', 'rar', '7z', 'tar', 'gz',
  // web e dados
  'html', 'htm', 'json', 'xml',
];

// String comum em vez de template literal, de proposito: em template, `\.`
// colapsa para `.` — 'qualquer caractere' em regex. Com 'tar' na lista, isso
// fazia "Material complementar" casar como se fosse um .tar. O teste pegou.
const NON_PDF_EXT = new RegExp('\\.(' + NON_PDF_EXTENSIONS.join('|') + ')$', 'i');
/** Extensões que marcam um link como arquivo (usada no texto do link). */
const FILE_EXT_TEXT = /\.(pdf|doc|docx|ppt|pptx|zip|xlsx|xls)$/i;
/** Mesma lista, mas procurada em qualquer parte da URL (ex.: `?nome=slides.pdf`). */
const FILE_EXT_ANYWHERE = /\.(pdf|doc|docx|ppt|pptx|zip|xlsx|xls)/i;
/**
 * A Abordagem 2 usava uma segunda lista, ainda menor que a primeira — duas listas
 * para a mesma pergunta, divergindo entre si. Passa a usar a mesma.
 */
const NON_PDF_EXT_TEXT = NON_PDF_EXT;

/** Cabeçalhos da tabela de Arquivos — nunca são nome de material. */
const HEADER_TEXTS = new Set(['Título', 'Descrição', 'Tópico de Aula', 'Ação', '']);

/**
 * Hash djb2 — id estável derivado do conteúdo, para quando o SIGAA não expõe
 * um id numérico confiável. Precisa ser determinístico entre execuções.
 */
function stableId(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Link de portal/âncora/JS — não aponta para arquivo baixável por URL. */
function isPortalOrHash(rawHref) {
  return rawHref === '#' || rawHref === '' || rawHref.startsWith('javascript');
}

/**
 * Abordagem 1 — linha da tabela da página "Arquivos" do SIGAA.
 * Nessa página os títulos ficam em <td> (não em <a>) e os botões de download
 * são <a><img></a> sem texto — invisíveis para a abordagem de links.
 * Estrutura: Título | Descrição (nome real do arquivo) | Tópico | [ícone DL]
 *
 * @returns {object|null} arquivo classificado, ou null se a linha não é material
 */
export function classifyTableRow({ title = '', desc = '', topic = '', onclick = '', dlHref = '' }) {
  // Títulos de arquivo reais são curtos; strings longas = popups/divs capturados
  if (!title || title.length < 2 || title.length > 200 || HEADER_TEXTS.has(title)) return null;

  const idMatch = onclick.match(/\d{5,}/) || dlHref.match(/idArquivo=(\d+)/);
  // O SIGAA pode reaproveitar o mesmo id numérico em linhas diferentes da tabela.
  // Combinamos o id bruto com metadados estáveis da linha para não colidir no
  // export e no `material_content` do backend.
  const rawId = idMatch?.[1] || idMatch?.[0] || 'file';
  const uniqueId = `${rawId}-${stableId(`${title}|${desc}|${topic}`)}`;

  // isPdf: pelo nome real (desc) ou pelo título; assume PDF se não tiver ext conhecida
  const descHasOtherExt = NON_PDF_EXT.test(desc);
  const titleHasOtherExt = NON_PDF_EXT.test(title);
  const isPdf = /\.pdf$/i.test(desc) || /\.pdf$/i.test(title)
    || (!descHasOtherExt && !titleHasOtherExt);

  return {
    id: uniqueId,
    title,
    description: desc || null,
    url: null, // download é via onclick JSF
    isPdf,
  };
}

/**
 * Abordagem 2 — link com texto (página "Materiais de Aula" e similares).
 *
 * @returns {object|null} arquivo classificado, ou null se o link não é material
 */
export function classifyLink({ text = '', href = '', rawHref = '' }) {
  const portalOrHash = isPortalOrHash(rawHref);

  // isFile: identifica links de arquivo por endpoint de download ou por extensão.
  //
  // Só endpoints ESPECÍFICOS contam. Duas versões anteriores erraram por serem
  // genéricas demais, cada uma capturando navegação como se fosse material:
  //  - href.includes('/ava/') pegava a sidebar inteira (Principal, Plano de Ensino);
  //  - href.includes('arquivo'), substring solta em qualquer posição, pegava telas
  //    de listagem como listarArquivos.jsf — e ainda as marcava como PDF, porque
  //    isFileByEndpoint sem extensão conhecida assume PDF logo abaixo.
  // O parâmetro idArquivo= entra como sinal positivo: download real do SIGAA o
  // carrega, tela de listagem não.
  // `/arquivo` precisa ser o SEGMENTO inteiro (seguido de /, ? ou fim): como
  // substring solta ele ainda casava com /ava/arquivos.jsf, que é listagem.
  const isFileByEndpoint =
    /\/arquivo(?:[/?]|$)/i.test(href) || href.includes('verArquivo') ||
    href.includes('downloadFile') || href.includes('downloadArquivo') ||
    /[?&]idArquivo=\d+/i.test(href);
  const isFileByText = FILE_EXT_TEXT.test(text);
  // Extensão de arquivo em qualquer parte da URL (ex: ?nome=slides.pdf)
  const isFileByHrefExt = !portalOrHash && FILE_EXT_ANYWHERE.test(href);

  const isFile = isFileByEndpoint || isFileByText || isFileByHrefExt;
  if (!isFile || text.length < 2) return null;

  const idMatch = href.match(/idArquivo=(\d+)/) || href.match(/\/(\d+)$/);
  const rawId = idMatch?.[1] || stableId(text);
  const uniqueId = `${rawId}-${stableId(`${text}|${href}`)}`;

  // isPdf: extensão no título, extensão na URL, ou endpoint específico sem extensão conhecida
  // de outro tipo (assume PDF — o Content-Type durante o download confirma).
  const urlHasPdf = !portalOrHash && /\.pdf/i.test(href);
  const titleHasOtherExt = NON_PDF_EXT_TEXT.test(text);
  const isPdf = /\.pdf$/i.test(text) || urlHasPdf || (isFileByEndpoint && !titleHasOtherExt);

  return {
    id: uniqueId,
    title: text,
    description: null,
    url: !portalOrHash && href.startsWith('http') ? href : null,
    isPdf,
  };
}

/**
 * Pipeline completo: recebe a colheita crua do DOM e devolve a lista final de
 * materiais, já deduplicada.
 *
 * A deduplicação é por título/texto e é COMPARTILHADA entre as abordagens: um
 * arquivo que a tabela já pegou não entra de novo pelos links.
 *
 * NÃO reintroduzir um terceiro passe de "fallback" aqui. Existia um, que só
 * rodava quando as duas abordagens não achavam nada e aceitava links cujo texto
 * terminasse em .pdf/.doc/.ppt/.zip. Era inalcançável: essa lista é subconjunto
 * do isFileByText da Abordagem 2, então qualquer link que o fallback pegaria já
 * tinha sido pego antes — e, com um arquivo na lista, o fallback nunca rodava.
 * Coberto por "Abordagem 2 cobre tudo que o fallback removido cobria".
 *
 * @param {{ rows?: object[], links?: object[] }} harvest
 * @returns {object[]} materiais classificados, na ordem de descoberta
 */
export function classifySigaaFiles({ rows = [], links = [] } = {}) {
  const files = [];
  const seen = new Set();

  for (const row of rows) {
    if (seen.has(row.title)) continue;
    const file = classifyTableRow(row);
    if (!file) continue;
    seen.add(row.title);
    files.push(file);
  }

  for (const link of links) {
    if (seen.has(link.text)) continue;
    const file = classifyLink(link);
    if (!file) continue;
    seen.add(link.text);
    files.push(file);
  }

  return files;
}
