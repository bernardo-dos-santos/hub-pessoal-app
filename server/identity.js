/**
 * identity.js — quem está fazendo esta requisição.
 *
 * Vale para a porta PRIVADA (a de hoje): só chega aqui quem passou pela
 * autenticação de rede em server/index.js — localhost (scripts do próprio
 * servidor e o `tailscale serve`), o tailnet ou o Bearer HUB_API_KEY.
 *
 * - Com `Tailscale-User-Login` (o `tailscale serve` injeta quem é a pessoa do
 *   tailnet): o usuário cadastrado com esse login. O primeiro login visto
 *   quando o dono ainda não tem um vira o do dono — hoje o tailnet só tem os
 *   aparelhos dele. Login desconhecido depois disso é recusado, não promovido.
 * - Sem o cabeçalho (scripts locais, Bearer, acesso direto pelo IP do
 *   tailnet): o dono.
 * - `X-Hub-User: <id>`: o admin age como outro usuário (scripts e testes).
 *   Quem não é admin e manda o cabeçalho é recusado.
 * - Cookie `hub_view_as=<id>`: o "ver como" do painel admin. Cookie e não
 *   cabeçalho porque precisa valer também em <a href> de download e <audio
 *   src>, que não carregam cabeçalho. HttpOnly + SameSite=Strict: outro site
 *   não o envia. De quem não é admin, é ignorado (navegador compartilhado,
 *   cookie velho) — não dá privilégio nenhum, só troca de quem são os dados.
 * - Usuário desativado no painel é recusado; o "ver como" ainda o alcança,
 *   para o admin conferir os dados de quem desativou.
 *
 * A porta PÚBLICA (Cloudflare, F4) não pode usar esta função: lá esses
 * cabeçalhos vêm do cliente e seriam forjáveis. A identidade de lá sai só do
 * certificado do aparelho — resolvePublicIdentity, abaixo.
 */

import { clientCerts, users } from './db.js';
import { OWNER_ID } from './userContext.js';

function header(headers, name) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export const VIEW_AS_COOKIE = 'hub_view_as';

function cookie(headers, name) {
  const raw = header(headers, 'cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/**
 * @returns {{ userId: number, realUserId: number } | { status: number, error: string }}
 * `realUserId` é quem está de fato do outro lado; difere de `userId` só no
 * "ver como" do admin. Permissão de admin se decide por ele.
 */
export function resolvePrivateIdentity(headers) {
  let user;
  const tailscaleLogin = header(headers, 'tailscale-user-login');

  if (tailscaleLogin) {
    user = users.findByTailscaleLogin(tailscaleLogin);
    if (!user) {
      const owner = users.get(OWNER_ID);
      if (owner.tailscale_login) {
        return { status: 403, error: `Login do tailnet sem cadastro no Hub: ${tailscaleLogin}` };
      }
      users.setTailscaleLogin(OWNER_ID, tailscaleLogin);
      console.log(`[identity] login do tailnet ${tailscaleLogin} associado ao dono.`);
      user = users.get(OWNER_ID);
    }
  } else {
    user = users.get(OWNER_ID);
  }
  if (user.disabled_at) return { status: 403, error: 'Usuário desativado no Hub.' };
  const realUserId = user.id;

  const actAs = header(headers, 'x-hub-user');
  if (actAs !== undefined) {
    if (!user.is_admin) return { status: 403, error: 'Só o admin pode agir como outro usuário.' };
    const target = users.get(Number(actAs));
    if (!target) return { status: 400, error: `Usuário inexistente: ${actAs}` };
    return { userId: target.id, realUserId };
  }

  const viewAs = cookie(headers, VIEW_AS_COOKIE);
  if (viewAs !== undefined && user.is_admin) {
    const target = users.get(Number(viewAs));
    if (target) return { userId: target.id, realUserId };
  }

  return { userId: user.id, realUserId };
}

/**
 * Identity on the PUBLIC port (Cloudflare Tunnel, F4) — only the device
 * certificate counts.
 *
 * Cloudflare checks the certificate at its edge (mTLS, and a WAF rule blocks
 * whoever has none) and, with the "Add TLS client auth headers" managed
 * transform, tells the origin which one it was: `cf-cert-verified`,
 * `cf-cert-revoked`, `cf-cert-sha256`. The fingerprint is looked up in
 * `client_certs`, which the admin fills from the Usuários panel.
 *
 * Nothing the private port trusts applies here: no Tailscale login, no
 * `X-Hub-User`, no "ver como" cookie — the cloudflared connection arrives from
 * localhost, so every one of those would be forgeable from the internet.
 * Cloudflare's docs don't say whether the transform overwrites a cf-cert-*
 * header the client sent itself; measured on 2026-10-11 through the real tunnel,
 * it does (a forged `cf-cert-sha256`/`cf-cert-revoked` arrived as the true
 * values). A header seen twice (comma-joined by Node) is still refused, in case
 * that ever changes.
 */
export function resolvePublicIdentity(headers) {
  if (header(headers, 'cf-cert-verified') !== 'true') {
    return { status: 403, error: 'Este aparelho não apresentou um certificado válido do Olimpo.' };
  }
  if (header(headers, 'cf-cert-revoked') === 'true') {
    return { status: 403, error: 'O certificado deste aparelho foi revogado.' };
  }
  if (header(headers, 'x-hub-user') !== undefined) {
    return { status: 403, error: 'Agir como outro usuário só pelo Tailscale.' };
  }
  const fingerprint = header(headers, 'cf-cert-sha256') ?? '';
  if (!fingerprint || fingerprint.includes(',')) {
    return { status: 403, error: 'Certificado sem identificação.' };
  }
  const cert = clientCerts.findActive(fingerprint);
  if (!cert) return { status: 403, error: 'Certificado sem cadastro no Olimpo.' };
  const user = users.get(cert.user_id);
  if (!user || user.disabled_at) return { status: 403, error: 'Usuário desativado no Olimpo.' };
  return { userId: user.id, realUserId: user.id };
}
