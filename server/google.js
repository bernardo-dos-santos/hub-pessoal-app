/**
 * server/google.js — ponto único de acesso ao Google (Gmail, Drive, Calendar).
 *
 * Antes da Fase 10 a autenticação estava copiada em cinco scripts CLI, cada um
 * com o seu `getAuthClient()` lendo o mesmo token.json, e as chamadas de API
 * espalhadas junto — o servidor não conseguia usar nada disso sem duplicar tudo
 * de novo. Aqui vale a mesma regra da camada de IA:
 * NINGUÉM importa `googleapis` direto. Scripts e tools do Jarvis passam por
 * este módulo.
 *
 * O token vive em scripts/config/token.json (arquivo sensível, gitignorado) e é
 * gerado por `node scripts/sync/authorize-google.js`, que autoriza os três
 * escopos de uma vez. O token carrega client_id/secret dentro dele, então
 * credentials.json só é necessário na hora de autorizar, não em runtime.
 *
 * Clientes são memoizados por processo: o refresh do access token é feito pela
 * própria googleapis dentro do cliente, e recriar um a cada chamada jogaria fora
 * o token renovado.
 */

import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CONFIG_DIR = resolve(__dirname, '../scripts/config');
export const TOKEN_PATH = resolve(CONFIG_DIR, 'token.json');
export const CREDENTIALS_PATH = resolve(CONFIG_DIR, 'credentials.json');

/** Escopos autorizados de uma vez pelo authorize-google.js. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
];

export const PRIMARY_CALENDAR = 'primary';

/** Mensagem única de "falta autorizar" — os cinco scripts diziam isso cada um do seu jeito. */
const NO_TOKEN_MESSAGE =
  `Token do Google não encontrado em ${TOKEN_PATH}. `
  + 'Rode: node scripts/sync/authorize-google.js';

/** Dá para checar sem lançar — as tools do Jarvis precisam responder, não estourar. */
export function hasGoogleAuth() {
  return existsSync(TOKEN_PATH);
}

let authClient = null;
let gmailClient = null;
let driveClient = null;
let calendarClient = null;

export function getAuthClient() {
  if (authClient) return authClient;
  if (!existsSync(TOKEN_PATH)) throw new Error(NO_TOKEN_MESSAGE);
  authClient = google.auth.fromJSON(JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')));
  return authClient;
}

// ── Fluxo de autorização (usado só pelo authorize-google.js) ─────────────────

/**
 * Cliente OAuth2 montado a partir do credentials.json, para TROCAR o código de
 * autorização por um token. É o único caminho que precisa do credentials.json —
 * todo o resto roda com o token.json, que já carrega client_id/secret.
 */
export function createOAuthClient(redirectUri) {
  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error(`credentials.json não encontrado em ${CREDENTIALS_PATH}`);
  }
  const keys = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const key = keys.installed || keys.web;
  const client = new google.auth.OAuth2(key.client_id, key.client_secret, redirectUri);
  return { client, key };
}

/**
 * Grava o token e derruba os clientes memoizados — reautorizar no meio de um
 * processo vivo tem que valer na chamada seguinte, não só depois de reiniciar.
 */
export function saveToken(key, refreshToken) {
  writeFileSync(TOKEN_PATH, JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: refreshToken,
  }));
  authClient = null;
  gmailClient = null;
  driveClient = null;
  calendarClient = null;
}

export function getGmail() {
  gmailClient ??= google.gmail({ version: 'v1', auth: getAuthClient() });
  return gmailClient;
}

export function getDrive() {
  driveClient ??= google.drive({ version: 'v3', auth: getAuthClient() });
  return driveClient;
}

export function getCalendar() {
  calendarClient ??= google.calendar({ version: 'v3', auth: getAuthClient() });
  return calendarClient;
}

// ── Gmail ────────────────────────────────────────────────────────────────────

/** Lista de {id, threadId} da busca — sem corpo, uma chamada só. */
export async function searchMessages(query, maxResults = 10) {
  const res = await getGmail().users.messages.list({ userId: 'me', q: query, maxResults });
  return res.data.messages ?? [];
}

export async function getMessage(id, format = 'full') {
  const res = await getGmail().users.messages.get({ userId: 'me', id, format });
  return res.data;
}

/**
 * Anexo já decodificado. O Gmail devolve base64url (com - e _ no lugar de + e /),
 * que Buffer.from(..., 'base64') não entende — daí a troca antes de decodificar.
 */
export async function getAttachment(messageId, attachmentId) {
  const res = await getGmail().users.messages.attachments.get({
    userId: 'me', messageId, id: attachmentId,
  });
  const base64 = (res.data.data ?? '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

/** Header por nome, sem depender do case que o remetente usou. */
export function headerValue(message, name) {
  const wanted = name.toLowerCase();
  const found = (message.payload?.headers ?? []).find((h) => h.name?.toLowerCase() === wanted);
  return found?.value ?? '';
}

/** Achata a árvore de parts (multipart pode aninhar multipart). */
export function flattenParts(payload) {
  if (!payload) return [];
  const out = [payload];
  for (const part of payload.parts ?? []) out.push(...flattenParts(part));
  return out;
}

/** Anexos da mensagem, já achatados e com o attachmentId pronto para getAttachment. */
export function listAttachments(message) {
  return flattenParts(message.payload)
    .filter((p) => p.body?.attachmentId && p.filename)
    .map((p) => ({
      filename: p.filename,
      mimeType: p.mimeType,
      size: p.body.size ?? 0,
      attachmentId: p.body.attachmentId,
    }));
}

function decodeBody(part) {
  const data = part?.body?.data;
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

/**
 * Texto do e-mail. Prefere text/plain; se só houver HTML, tira as tags — melhor
 * um texto imperfeito do que devolver uma parede de markup para o modelo ler.
 */
export function messageText(message) {
  const parts = flattenParts(message.payload);

  const plain = parts.find((p) => p.mimeType === 'text/plain' && p.body?.data);
  if (plain) return decodeBody(plain).trim();

  const html = parts.find((p) => p.mimeType === 'text/html' && p.body?.data);
  if (html) {
    return decodeBody(html)
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return (message.snippet ?? '').trim();
}

/**
 * Envia um e-mail em texto puro.
 *
 * O escopo já autorizado (`gmail.modify`) cobre `messages.send` — não precisa
 * reautorizar nada para isto funcionar.
 *
 * O corpo vai como MIME montado à mão porque a API espera a mensagem RFC 2822
 * inteira em base64url. Assunto e corpo são codificados explicitamente em
 * UTF-8: sem isso, "revisão" e "não" chegam quebrados no cliente do
 * destinatário — e um e-mail com acento corrompido é pior do que não enviar.
 */
export async function sendEmail({ to, subject, body, cc }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject ?? '', 'utf-8').toString('base64')}?=`;
  const headers = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ];
  const mime = `${headers.join('\r\n')}\r\n\r\n${Buffer.from(body ?? '', 'utf-8').toString('base64')}`;
  const raw = Buffer.from(mime, 'utf-8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const res = await getGmail().users.messages.send({ userId: 'me', requestBody: { raw } });
  return res.data;
}

// ── Drive ────────────────────────────────────────────────────────────────────

const MIME_BY_EXTENSION = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

export function mimeTypeForFile(filename) {
  return MIME_BY_EXTENSION[extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Escapa um valor interpolado numa query do Drive.
 *
 * A query vai numa string com aspas simples, então um nome com apóstrofo
 * ("Prova de Cálculo do Bernardo's") fecha a string e a API devolve 400. Os
 * scripts antigos interpolavam cru e funcionavam por sorte — os nomes de pasta
 * eram fixos. Com busca vinda do modelo, o texto é arbitrário.
 */
export function escapeQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function listFiles({
  q,
  fields = 'files(id, name, mimeType, size, modifiedTime)',
  orderBy,
  pageSize = 20,
} = {}) {
  const res = await getDrive().files.list({ q, fields, orderBy, pageSize, spaces: 'drive' });
  return res.data.files ?? [];
}

export async function getFileMetadata(fileId) {
  const res = await getDrive().files.get({
    fileId,
    fields: 'id, name, mimeType, size, modifiedTime, webViewLink',
  });
  return res.data;
}

export async function getOrCreateFolder(name, parentId = null) {
  const safeName = escapeQueryValue(name);
  const q = [
    `name='${safeName}'`,
    "mimeType='application/vnd.google-apps.folder'",
    'trashed=false',
    ...(parentId ? [`'${escapeQueryValue(parentId)}' in parents`] : []),
  ].join(' and ');

  const found = await listFiles({ q, fields: 'files(id, name)' });
  if (found.length > 0) return found[0].id;

  const folder = await getDrive().files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id',
  });
  return folder.data.id;
}

export async function listFolderFiles(folderId, fields = 'files(id, name, size)') {
  return listFiles({ q: `'${escapeQueryValue(folderId)}' in parents and trashed=false`, fields, pageSize: 1000 });
}

export async function uploadFile({ name, parentId, mimeType, body, fields = 'id, name' }) {
  const type = mimeType ?? mimeTypeForFile(name);
  const res = await getDrive().files.create({
    requestBody: { name, mimeType: type, ...(parentId ? { parents: [parentId] } : {}) },
    media: { mimeType: type, body },
    fields,
  });
  return res.data;
}

export async function deleteFile(fileId) {
  await getDrive().files.delete({ fileId });
}

/** Conteúdo cru de um arquivo binário/texto do Drive. */
export async function downloadFile(fileId, responseType = 'text') {
  const res = await getDrive().files.get({ fileId, alt: 'media' }, { responseType });
  return res.data;
}

/** Google Docs/Sheets/Slides não têm bytes para baixar — precisam ser exportados. */
export async function exportFile(fileId, mimeType = 'text/plain') {
  const res = await getDrive().files.export({ fileId, mimeType }, { responseType: 'text' });
  return typeof res.data === 'string' ? res.data : String(res.data);
}

// ── Calendar ─────────────────────────────────────────────────────────────────

export async function listEvents(params, calendarId = PRIMARY_CALENDAR) {
  const res = await getCalendar().events.list({ calendarId, singleEvents: true, ...params });
  return res.data;
}

/** Percorre todas as páginas — o que os dois scripts de calendário faziam na mão. */
export async function listAllEvents(params, calendarId = PRIMARY_CALENDAR) {
  const items = [];
  let pageToken;
  do {
    const data = await listEvents({ ...params, pageToken }, calendarId);
    items.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

export async function insertEvent(event, calendarId = PRIMARY_CALENDAR) {
  const res = await getCalendar().events.insert({ calendarId, requestBody: event });
  return res.data;
}

export async function updateEvent(eventId, event, calendarId = PRIMARY_CALENDAR) {
  const res = await getCalendar().events.update({ calendarId, eventId, requestBody: event });
  return res.data;
}

export async function deleteEvent(eventId, calendarId = PRIMARY_CALENDAR) {
  await getCalendar().events.delete({ calendarId, eventId });
}
