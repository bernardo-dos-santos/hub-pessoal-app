import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminService, type AdminUser, type DeviceCertificate } from '../../core/session/adminService';
import { Button, Card, Select, useConfirm } from '../../shared/ui';

const sectionTitleStyle = {
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.13em',
  color: 'var(--hub-subtle)',
} as const;

const labelStyle = {
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--hub-subtle)',
} as const;

const linkButton = { color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' } as const;

const DAY_MS = 86_400_000;

type Generated = { label: string; p12: string; password: string };

function expiryNote(cert: DeviceCertificate): { text: string; color: string } {
  if (cert.revokedAt) return { text: `revogado em ${new Date(cert.revokedAt).toLocaleDateString('pt-BR')}`, color: 'var(--hub-subtle)' };
  if (!cert.notAfter) return { text: 'sem data de validade', color: 'var(--hub-subtle)' };
  const days = Math.floor((new Date(cert.notAfter).getTime() - Date.now()) / DAY_MS);
  const date = new Date(cert.notAfter).toLocaleDateString('pt-BR');
  if (days < 0) return { text: `venceu em ${date}`, color: 'var(--hub-negative)' };
  if (days < 30) return { text: `vence em ${days} dias (${date})`, color: 'var(--hub-warning)' };
  return { text: `vale até ${date}`, color: 'var(--hub-subtle)' };
}

function fileNameOf(label: string): string {
  const slug = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `olimpo-${slug || 'aparelho'}.p12`;
}

function download(generated: Generated) {
  const bytes = Uint8Array.from(atob(generated.p12), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/x-pkcs12' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileNameOf(generated.label);
  link.click();
  URL.revokeObjectURL(url);
}

/** The one-time result of "Gerar certificado": the file and its password, shown once. */
function GeneratedNotice({ generated, onClose }: { generated: Generated; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 py-3" style={{ borderTop: '1px solid var(--hub-border)', borderBottom: '1px solid var(--hub-border)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--hub-positive)' }}>Certificado de {generated.label} pronto e cadastrado.</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Button onClick={() => download(generated)}>Baixar o arquivo .p12</Button>
        <span className="text-sm" style={{ color: 'var(--hub-text-body)' }}>
          Senha: <code className="text-base tabular-nums" style={{ color: 'var(--hub-text)' }}>{generated.password}</code>
        </span>
        <button
          onClick={() => void navigator.clipboard.writeText(generated.password).then(() => setCopied(true))}
          className="text-xs font-medium transition-opacity hover:opacity-70"
          style={linkButton}
        >
          {copied ? 'Copiada' : 'Copiar senha'}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5" style={{ color: 'var(--hub-warning)' }}>
        A senha não aparece de novo e o arquivo não fica guardado: baixe agora. Mande o arquivo e a senha por canais
        diferentes (ex.: o arquivo no WhatsApp, a senha falando). Se perder, revogue e gere outro.
      </p>
      <button onClick={onClose} className="mt-2 text-xs transition-opacity hover:opacity-60" style={{ ...linkButton, color: 'var(--hub-subtle)' }}>
        Já baixei, fechar
      </button>
    </div>
  );
}

/**
 * Who may come in through the public address (F4): one certificate per device.
 * With the Cloudflare API configured on the server, "Gerar certificado" does it
 * all (sign, register, .p12); otherwise the admin pastes a certificate signed by
 * hand (`npm run cert:device`). Only answers through Tailscale.
 */
export function DeviceCertificatesCard({ users }: { users: AdminUser[] }) {
  const confirmAction = useConfirm();
  const [certs, setCerts] = useState<DeviceCertificate[] | null>(null);
  const [canGenerate, setCanGenerate] = useState<boolean | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [label, setLabel] = useState('');
  const [pem, setPem] = useState('');
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);

  const reload = useCallback(() => {
    adminService.listCertificates().then(setCerts).catch((err: Error) => setError(err.message));
  }, []);
  useEffect(reload, [reload]);
  useEffect(() => {
    adminService.certificateGeneratorAvailable().then(setCanGenerate).catch(() => setCanGenerate(false));
  }, []);

  const nameOf = (id: number) => users.find((u) => u.id === id)?.name ?? `usuário ${id}`;
  const visible = (certs ?? []).filter((c) => !c.revokedAt).concat((certs ?? []).filter((c) => c.revokedAt));
  const manual = canGenerate === false || showManual;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!userId || !label.trim() || (manual && !pem.trim())) return;
    setSaving(true);
    setError('');
    try {
      if (manual) {
        await adminService.addCertificate({ userId: Number(userId), label: label.trim(), certificate: pem.trim() });
        setPem('');
      } else {
        const result = await adminService.generateCertificate({ userId: Number(userId), label: label.trim() });
        setGenerated({ label: result.label, p12: result.p12, password: result.password });
      }
      setLabel('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cadastrar.');
    } finally {
      setSaving(false);
    }
  }

  async function revoke(cert: DeviceCertificate) {
    const ok = await confirmAction(
      `Revogar "${cert.label}" de ${nameOf(cert.userId)}?\n\nEsse aparelho deixa de entrar pela internet na hora. Para ele voltar, é preciso um certificado novo.`,
      { confirmLabel: 'Revogar' },
    );
    if (!ok) return;
    setError('');
    try {
      const { cloudflareError } = await adminService.revokeCertificate(cert.fingerprint);
      if (cloudflareError) setError(`Revogado no Olimpo, mas a Cloudflare falhou (${cloudflareError}) — revogue lá também em SSL/TLS → Client Certificates.`);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível revogar.');
    }
  }

  return (
    <Card>
      <h2 style={sectionTitleStyle}>Aparelhos com acesso pela internet</h2>
      <p className="mt-1.5 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
        Fora do Tailscale, cada aparelho entra com um certificado próprio.
        {canGenerate
          ? ' Gere um aqui, mande o arquivo e a senha para a pessoa, e ela instala: no Android, Configurações → Criptografia e credenciais → Instalar um certificado → "Certificado de usuário de app e VPN"; no Windows, dois cliques no arquivo → Usuário Atual.'
          : ' Para gerar com um clique, configure a API da Cloudflare no servidor (CLOUDFLARE_API_TOKEN e CLOUDFLARE_ZONE_ID); até lá, gere à mão com npm run cert:device e cole o certificado aqui.'}
      </p>

      {error && <p className="mt-3 text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
      {generated && <GeneratedNotice generated={generated} onClose={() => setGenerated(null)} />}
      {certs && certs.length === 0 && (
        <p className="mt-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>Nenhum aparelho cadastrado ainda.</p>
      )}
      <div className="mt-2">
        {visible.map((cert, index) => {
          const note = expiryNote(cert);
          return (
            <div
              key={cert.fingerprint}
              className="flex items-center justify-between gap-4 py-3"
              style={{ borderBottom: index === visible.length - 1 ? 'none' : '1px solid var(--hub-border)', opacity: cert.revokedAt ? 0.6 : 1 }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm" style={{ color: 'var(--hub-text)' }}>
                  {cert.label} <span style={{ color: 'var(--hub-subtle)' }}>· {nameOf(cert.userId)}</span>
                </p>
                <p className="mt-0.5 text-xs tabular-nums" style={{ color: note.color }}>{note.text}</p>
              </div>
              {!cert.revokedAt && (
                <button
                  onClick={() => void revoke(cert)}
                  className="shrink-0 text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Revogar
                </button>
              )}
            </div>
          );
        })}
      </div>

      {canGenerate !== null && (
        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span style={labelStyle}>Pessoa</span>
              <Select className="mt-1 w-full" value={userId} onChange={setUserId}>
                <Select.Option value="">escolha</Select.Option>
                {users.filter((u) => !u.disabledAt).map((u) => (
                  <Select.Option key={u.id} value={String(u.id)}>{u.name}</Select.Option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span style={labelStyle}>Aparelho</span>
              <input className="mt-1 w-full" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Celular da Ana" maxLength={80} />
            </label>
          </div>
          {manual && (
            <label className="block">
              <span style={labelStyle}>Certificado (assinado pela Cloudflare)</span>
              <textarea
                className="mt-1 w-full font-mono text-xs leading-5 resize-none"
                rows={4}
                value={pem}
                onChange={(e) => setPem(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----"
              />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Button type="submit" disabled={saving || !userId || !label.trim() || (manual && !pem.trim())}>
              {saving ? (manual ? 'Cadastrando…' : 'Gerando…') : manual ? 'Cadastrar aparelho' : 'Gerar certificado'}
            </Button>
            {canGenerate && (
              <button type="button" onClick={() => setShowManual((v) => !v)} className="text-xs transition-opacity hover:opacity-60" style={{ ...linkButton, color: 'var(--hub-subtle)' }}>
                {showManual ? 'Gerar automaticamente' : 'Já tenho um certificado assinado'}
              </button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}
