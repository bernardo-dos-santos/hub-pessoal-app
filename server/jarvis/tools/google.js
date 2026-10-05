/**
 * jarvis/tools/google.js — leitura de Gmail, Agenda e Drive (Fase 10).
 *
 * Tudo aqui traz conteúdo escrito por gente que não é o Bernardo, então TODAS
 * estas tools estão em EXTERNAL_CONTENT_TOOLS (tools/index.js): o resultado
 * volta embrulhado como "dado, não instrução" e o turno fica contaminado — a
 * partir daí nenhuma ação irreversível na máquina roda sem confirmação, em
 * qualquer nível de acesso. É a mesma fronteira que a web já atravessa.
 *
 * A porta de entrada é `capabilities.google.read`, checada AQUI e não só na
 * composição da lista de tools: a UI é conveniência, o servidor é a garantia.
 *
 * Escrita (send_email, create_calendar_event, upload_to_drive) é a Fase 11 —
 * este arquivo é só leitura.
 */

import {
  hasGoogleAuth,
  searchMessages, getMessage, headerValue, messageText, listAttachments, sendEmail,
  listEvents, insertEvent,
  listFiles, getFileMetadata, downloadFile, exportFile, escapeQueryValue,
  getOrCreateFolder, uploadFile, mimeTypeForFile,
} from '../../google.js';
import { getJarvisConfig } from '../config.js';
import { requestApproval } from '../commands.js';

/**
 * Tetos de texto. Um e-mail de newsletter ou um PDF de apostila passam
 * fácil de 100 mil caracteres; sem corte, uma única chamada estoura a janela e
 * queima o orçamento do mês numa tacada. Corta com aviso explícito para o
 * modelo saber que existe mais, em vez de concluir que o documento acabou ali.
 */
const MAX_EMAIL_CHARS = 6000;
const MAX_FILE_CHARS = 12000;

function truncate(text, limit) {
  const value = text ?? '';
  if (value.length <= limit) return { text: value, truncated: false };
  return {
    text: `${value.slice(0, limit)}\n\n[...cortado: o conteúdo tem ${value.length} caracteres no total]`,
    truncated: true,
  };
}

export const googleTools = [
  {
    name: 'search_gmail',
    description: 'Busca e-mails na caixa do Bernardo e devolve remetente, assunto, data e um trecho — não o corpo inteiro (use read_email para isso). Aceita a sintaxe de busca do Gmail: from:, subject:, has:attachment, is:unread, newer_than:7d, label:.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Busca no formato do Gmail, ex.: from:nubank newer_than:30d' },
        max_results: { type: 'number', description: 'Quantos e-mails no máximo (padrão 10, teto 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_email',
    description: 'Lê o corpo completo de um e-mail específico, pelo id devolvido por search_gmail. Lista também os anexos (nome e tipo), mas não os abre.',
    input_schema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'id da mensagem, vindo do search_gmail' },
      },
      required: ['message_id'],
    },
  },
  {
    name: 'list_calendar_events',
    description: 'Lista os compromissos do Google Calendar do Bernardo a partir de agora. Inclui os eventos que o próprio Hub exporta (plano semanal marcado com [Hub] e prazos da faculdade com [Hub Faculdade]).',
    input_schema: {
      type: 'object',
      properties: {
        days_ahead: { type: 'number', description: 'Janela em dias a partir de hoje (padrão 7, teto 90)' },
        query: { type: 'string', description: 'Filtro textual opcional, ex.: "prova"' },
      },
      required: [],
    },
  },
  {
    name: 'search_drive',
    description: 'Procura arquivos no Google Drive do Bernardo pelo nome (inclui os materiais da faculdade em "Hub Materiais" e os backups do Hub). Devolve id, nome, tipo e data — use read_drive_file para o conteúdo.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Trecho do nome do arquivo' },
        max_results: { type: 'number', description: 'Quantos arquivos no máximo (padrão 10, teto 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_drive_file',
    description: 'Lê o conteúdo de um arquivo do Drive pelo id: PDF, texto e documentos do Google Docs. Planilha, imagem e binário não são legíveis por aqui.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'id do arquivo, vindo do search_drive' },
      },
      required: ['file_id'],
    },
  },
];

/**
 * Escrita (Fase 11). Nenhuma destas executa quando é chamada: todas devolvem
 * "pedido registrado" e esperam o Bernardo aprovar no painel, vendo o texto
 * literal do que vai sair. As descrições dizem isso ao modelo para ele não
 * prometer que já enviou — e a persona reforça que pedido enfileirado não é
 * motivo para ficar esperando.
 */
export const googleWriteTools = [
  {
    name: 'send_email',
    description: 'Prepara um e-mail para enviar da conta do Bernardo. NÃO envia na hora: o pedido vai para a fila de aprovação e ele libera vendo o texto completo. Depois de chamar, diga que pediu a aprovação e siga — não repita o pedido nem fique esperando.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Destinatário (e-mail). Vários, separados por vírgula.' },
        subject: { type: 'string', description: 'Assunto' },
        body: { type: 'string', description: 'Corpo do e-mail, em texto puro' },
        cc: { type: 'string', description: 'Cópia (opcional)' },
        why: { type: 'string', description: 'Por que está mandando — aparece para o Bernardo na hora de aprovar' },
      },
      required: ['to', 'subject', 'body', 'why'],
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Prepara um evento no Google Calendar do Bernardo. NÃO cria na hora: vai para a fila de aprovação. Para compromisso sem horário definido (prazo, prova sem hora), omita start_time e ele vira evento de dia inteiro.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título do evento' },
        date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
        start_time: { type: 'string', description: 'Hora de início HH:MM (omita para dia inteiro)' },
        end_time: { type: 'string', description: 'Hora de fim HH:MM (padrão: 1h depois do início)' },
        description: { type: 'string', description: 'Descrição (opcional)' },
        why: { type: 'string', description: 'Por que este evento — aparece na hora de aprovar' },
      },
      required: ['title', 'date', 'why'],
    },
  },
  {
    name: 'upload_to_drive',
    description: 'Prepara o envio de um arquivo de texto (resumo, anotação, relatório que você mesmo escreveu) para o Google Drive do Bernardo. NÃO envia na hora: vai para a fila de aprovação. Não serve para copiar arquivo que já existe na máquina.',
    input_schema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Nome do arquivo com extensão, ex.: resumo-financeiro-2026-08.txt' },
        content: { type: 'string', description: 'Conteúdo do arquivo, em texto' },
        folder: { type: 'string', description: 'Nome da pasta no Drive (criada se não existir). Omita para a raiz.' },
        why: { type: 'string', description: 'Por que este arquivo — aparece na hora de aprovar' },
      },
      required: ['filename', 'content', 'why'],
    },
  },
];

export const GOOGLE_TOOL_NAMES = new Set(googleTools.map((t) => t.name));
export const GOOGLE_WRITE_TOOL_NAMES = new Set(googleWriteTools.map((t) => t.name));

/** Leitura do Google ligada na config E token presente no disco. */
export function googleReadAllowed(config = getJarvisConfig()) {
  return config?.capabilities?.google?.read === true;
}

export function googleWriteAllowed(config = getJarvisConfig()) {
  return config?.capabilities?.google?.write === true;
}

function clamp(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

// ── Executores ───────────────────────────────────────────────────────────────

async function doSearchGmail(args) {
  const refs = await searchMessages(args.query, clamp(args.max_results, 10, 20));
  if (!refs.length) return { ok: true, emails: [], message: 'Nenhum e-mail encontrado para essa busca.' };

  // metadata em vez de full: o corpo não é usado aqui e vem um por mensagem —
  // buscar 20 e-mails completos custaria mais em tokens do que a resposta toda.
  const emails = [];
  for (const ref of refs) {
    const msg = await getMessage(ref.id, 'metadata');
    emails.push({
      id: ref.id,
      de: headerValue(msg, 'From'),
      assunto: headerValue(msg, 'Subject'),
      data: headerValue(msg, 'Date'),
      trecho: msg.snippet ?? '',
      naoLido: (msg.labelIds ?? []).includes('UNREAD'),
    });
  }
  return { ok: true, total: emails.length, emails };
}

async function doReadEmail(args) {
  const msg = await getMessage(args.message_id, 'full');
  const body = truncate(messageText(msg), MAX_EMAIL_CHARS);
  const anexos = listAttachments(msg).map((a) => ({ nome: a.filename, tipo: a.mimeType }));

  return {
    ok: true,
    de: headerValue(msg, 'From'),
    para: headerValue(msg, 'To'),
    assunto: headerValue(msg, 'Subject'),
    data: headerValue(msg, 'Date'),
    corpo: body.text,
    cortado: body.truncated,
    anexos,
  };
}

async function doListCalendarEvents(args) {
  const days = clamp(args.days_ahead, 7, 90);
  const now = new Date();
  const until = new Date(now.getTime() + days * 86_400_000);

  const data = await listEvents({
    timeMin: now.toISOString(),
    timeMax: until.toISOString(),
    q: args.query || undefined,
    orderBy: 'startTime',
    maxResults: 50,
  });

  const eventos = (data.items ?? []).map((ev) => ({
    id: ev.id,
    titulo: ev.summary ?? '(sem título)',
    // Evento de dia inteiro vem em `date`; com horário, em `dateTime`.
    inicio: ev.start?.dateTime ?? ev.start?.date ?? null,
    fim: ev.end?.dateTime ?? ev.end?.date ?? null,
    diaInteiro: !ev.start?.dateTime,
    local: ev.location ?? null,
    descricao: ev.description ?? null,
  }));

  return { ok: true, janelaDias: days, total: eventos.length, eventos };
}

async function doSearchDrive(args) {
  const files = await listFiles({
    q: `name contains '${escapeQueryValue(args.query)}' and trashed=false`,
    orderBy: 'modifiedTime desc',
    pageSize: clamp(args.max_results, 10, 20),
  });

  const arquivos = files.map((f) => ({
    id: f.id,
    nome: f.name,
    tipo: f.mimeType,
    tamanhoKb: f.size ? Math.round(Number(f.size) / 1024) : null,
    modificadoEm: f.modifiedTime,
  }));

  if (!arquivos.length) return { ok: true, arquivos: [], message: 'Nenhum arquivo com esse nome no Drive.' };
  return { ok: true, total: arquivos.length, arquivos };
}

/** Formatos nativos do Google não têm bytes — precisam de export. */
const GOOGLE_DOC_EXPORTS = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.presentation': 'text/plain',
};

async function doReadDriveFile(args) {
  const meta = await getFileMetadata(args.file_id);
  const mime = meta.mimeType ?? '';

  let raw;
  if (GOOGLE_DOC_EXPORTS[mime]) {
    raw = await exportFile(args.file_id, GOOGLE_DOC_EXPORTS[mime]);
  } else if (mime === 'application/pdf') {
    // pdf-parse já é dependência (o sync da fatura do Nubank usa). Sem isso,
    // read_drive_file seria quase inútil: os materiais da faculdade são PDF.
    const { PDFParse } = await import('pdf-parse');
    const bytes = await downloadFile(args.file_id, 'arraybuffer');
    const parser = new PDFParse({ data: Buffer.from(bytes) });
    try {
      raw = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  } else if (mime.startsWith('text/') || mime === 'application/json') {
    const data = await downloadFile(args.file_id, 'text');
    raw = typeof data === 'string' ? data : JSON.stringify(data);
  } else {
    return {
      ok: false,
      error: `Arquivo "${meta.name}" é do tipo ${mime}, que não dá para ler como texto. `
        + 'Legíveis: PDF, texto e documentos do Google Docs.',
    };
  }

  const body = truncate(raw, MAX_FILE_CHARS);
  return { ok: true, nome: meta.name, tipo: mime, conteudo: body.text, cortado: body.truncated };
}

// ── Escrita: enfileirar (Fase 11) ────────────────────────────────────────────

const TIMEZONE = 'America/Sao_Paulo';

function addDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function endTimeFor(startTime, endTime) {
  if (endTime) return endTime;
  const [h, m] = startTime.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * O texto que o Bernardo lê antes de aprovar.
 *
 * VERBATIM é requisito, não capricho: o corpo do e-mail vai inteiro, sem
 * resumo e sem reescrita. Se aqui aparecesse "um e-mail educado para o
 * professor", a aprovação viraria um carimbo — ele estaria confiando na
 * descrição que o modelo deu de si mesmo, que é exatamente o que a fila
 * existe para não ter que fazer.
 */
export function describeGoogleWrite(name, args) {
  switch (name) {
    case 'send_email':
      return [
        'ENVIAR E-MAIL',
        `Para: ${args.to}`,
        ...(args.cc ? [`Cc: ${args.cc}`] : []),
        `Assunto: ${args.subject}`,
        '',
        args.body,
      ].join('\n');

    case 'create_calendar_event': {
      const quando = args.start_time
        ? `${args.date} das ${args.start_time} às ${endTimeFor(args.start_time, args.end_time)}`
        : `${args.date} (dia inteiro)`;
      return [
        'CRIAR EVENTO NA AGENDA',
        `Título: ${args.title}`,
        `Quando: ${quando}`,
        ...(args.description ? ['', args.description] : []),
      ].join('\n');
    }

    case 'upload_to_drive': {
      const kb = (Buffer.byteLength(args.content ?? '', 'utf-8') / 1024).toFixed(1);
      const preview = (args.content ?? '').slice(0, 400);
      return [
        'ENVIAR ARQUIVO PARA O DRIVE',
        `Nome: ${args.filename}`,
        `Pasta: ${args.folder ?? '(raiz do Drive)'}`,
        `Tamanho: ${kb} KB`,
        '',
        preview + ((args.content ?? '').length > 400 ? '\n[...]' : ''),
      ].join('\n');
    }

    default:
      return null;
  }
}

/** Executa de verdade. Só é chamada por commands.js, DEPOIS da aprovação. */
export async function executeGoogleWrite(name, args) {
  try {
    switch (name) {
      case 'send_email': {
        const sent = await sendEmail({ to: args.to, subject: args.subject, body: args.body, cc: args.cc });
        return { ok: true, message: `E-mail enviado para ${args.to}.`, messageId: sent.id };
      }

      case 'create_calendar_event': {
        const event = {
          summary: args.title,
          description: args.description ?? undefined,
          ...(args.start_time
            ? {
              start: { dateTime: `${args.date}T${args.start_time}:00`, timeZone: TIMEZONE },
              end: { dateTime: `${args.date}T${endTimeFor(args.start_time, args.end_time)}:00`, timeZone: TIMEZONE },
            }
            // Evento de dia inteiro: o fim é EXCLUSIVO na API, então vai o dia
            // seguinte — com a mesma data, o evento não aparece.
            : { start: { date: args.date }, end: { date: addDay(args.date) } }),
        };
        const created = await insertEvent(event);
        return { ok: true, message: `Evento "${args.title}" criado em ${args.date}.`, eventId: created.id };
      }

      case 'upload_to_drive': {
        const parentId = args.folder ? await getOrCreateFolder(args.folder) : null;
        const uploaded = await uploadFile({
          name: args.filename,
          parentId,
          mimeType: mimeTypeForFile(args.filename),
          body: args.content ?? '',
        });
        return { ok: true, message: `Arquivo "${uploaded.name}" enviado para o Drive.`, fileId: uploaded.id };
      }

      default:
        return { ok: false, error: `Escrita desconhecida no Google: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: `Falha no Google (${name}): ${err?.message ?? err}` };
  }
}

// ── Despacho ─────────────────────────────────────────────────────────────────

export async function executeGoogleTool(name, args) {
  if (GOOGLE_WRITE_TOOL_NAMES.has(name)) {
    if (!googleWriteAllowed()) {
      return { ok: false, error: 'Escrita no Google desligada na configuração do Jarvis (Capacidades → Escrever nas contas Google).' };
    }
    if (!hasGoogleAuth()) {
      return { ok: false, error: 'Conta Google ainda não autorizada no servidor. Rode: node scripts/sync/authorize-google.js' };
    }
    const display = describeGoogleWrite(name, args);
    if (!display) return { ok: false, error: `Escrita desconhecida no Google: ${name}` };
    // Sempre a fila — não existe nível que libere mandar e-mail sozinho.
    return requestApproval({ kind: 'google', display, why: args.why, payload: { tool: name, args } });
  }

  if (!GOOGLE_TOOL_NAMES.has(name)) return undefined;

  if (!googleReadAllowed()) {
    return { ok: false, error: 'Acesso ao Google desligado na configuração do Jarvis (Capacidades → Ler Gmail, Agenda e Drive).' };
  }
  if (!hasGoogleAuth()) {
    return { ok: false, error: 'Conta Google ainda não autorizada no servidor. Rode: node scripts/sync/authorize-google.js' };
  }

  try {
    switch (name) {
      case 'search_gmail': return await doSearchGmail(args);
      case 'read_email': return await doReadEmail(args);
      case 'list_calendar_events': return await doListCalendarEvents(args);
      case 'search_drive': return await doSearchDrive(args);
      case 'read_drive_file': return await doReadDriveFile(args);
      default: return undefined;
    }
  } catch (err) {
    // Erro da API do Google chega como exceção com a mensagem já legível
    // (404 "File not found", 403 de escopo). Vira resultado de tool para o
    // modelo poder explicar ao Senhor, em vez de derrubar o turno inteiro.
    return { ok: false, error: `Falha no Google (${name}): ${err?.message ?? err}` };
  }
}
