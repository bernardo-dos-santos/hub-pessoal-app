import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { modules } from '../../core/module-registry/modules';
import { adminService, type AdminSyncRecord, type AdminUser, type AdminUserPatch } from '../../core/session/adminService';
import { loadSession, moduleMaintenance, useSession, viewAs } from '../../core/session/session';
import { type ModuleId } from '../../core/module-registry/module-types';
import { Button, Card, EditableText, ModuleHeader, useConfirm } from '../../shared/ui';
import { DeviceCertificatesCard } from '../components/DeviceCertificatesCard';

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

const activeModuleCount = modules.filter((m) => m.status === 'active').length;

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias". */
function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 10) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ontem' : `há ${days} dias`;
}

function lastSeenLabel(iso: string | null): string {
  if (!iso) return 'nunca entrou';
  const when = relativeTime(iso);
  return when === 'agora' ? 'ativo agora' : `visto ${when}`;
}

const SYSTEM_NAME: Record<string, string> = { moodle: 'Moodle', sigaa: 'SIGAA de outra instituição', classroom: 'Google Classroom' };

function collegeLabel(user: AdminUser): string {
  const college = user.college;
  if (!college) return 'não informada';
  if (college.institution === 'ifsc') return user.integrations.sigaa ? 'IFSC · SIGAA conectado' : 'IFSC · SIGAA pendente';
  if (college.institution === 'uniplac') return 'UNIPLAC · aguarda Classroom';
  return college.institutionName || 'outra';
}

/** " · última busca há 3 h" / " · última busca falhou" — next to the integration it belongs to. */
function SyncNote({ record }: { record: AdminSyncRecord | null }) {
  if (!record) return null;
  if (!record.ok) {
    return <span title={record.error ?? record.issues?.join(' · ')} style={{ color: 'var(--hub-negative)' }}> (última busca falhou)</span>;
  }
  return <span style={{ color: 'var(--hub-subtle)' }}> (buscou {relativeTime(record.at)})</span>;
}

function statusOf(user: AdminUser): { label: string; color: string } {
  if (user.disabledAt) return { label: 'Desativado', color: 'var(--hub-negative)' };
  if (!user.onboardedAt) return { label: 'Primeiro acesso pendente', color: 'var(--hub-warning)' };
  return { label: 'Ativo', color: 'var(--hub-positive)' };
}

type UserRowProps = {
  user: AdminUser;
  isSelf: boolean;
  last: boolean;
  onUpdate: (user: AdminUser, patch: AdminUserPatch) => void;
};

function UserRow({ user, isSelf, last, onUpdate }: UserRowProps) {
  const confirmAction = useConfirm();
  const status = statusOf(user);
  const moduleCount = user.modules?.length ?? activeModuleCount;

  async function toggleDisabled() {
    if (!user.disabledAt) {
      const ok = await confirmAction(
        `Desativar ${user.name}?\n\nO acesso é recusado a partir da próxima requisição. Nenhum dado é apagado — reativar devolve tudo como estava.`,
        { confirmLabel: 'Desativar' },
      );
      if (!ok) return;
    }
    onUpdate(user, { disabled: !user.disabledAt });
  }

  return (
    <div className="py-4" style={{ borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <EditableText
              className="min-w-0"
              inputClassName="min-w-0 text-sm"
              value={user.name}
              onSave={(name) => onUpdate(user, { name })}
              ariaLabel={`Renomear ${user.name}`}
            >
              <span className="truncate text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{user.name}</span>
            </EditableText>
            {user.isAdmin && <span className="text-[11px]" style={{ color: 'var(--hub-accent)' }}>admin</span>}
          </div>
          <p className="mt-1 text-xs" style={{ color: status.color }}>
            {status.label}
            <span style={{ color: 'var(--hub-subtle)' }}>
              {' · '}{lastSeenLabel(user.lastSeenAt)}
              {' · '}<span className="tabular-nums">{moduleCount}</span> módulo(s)
              {' · '}<span className="tabular-nums">{user.keyCount}</span> chave(s) de dados
            </span>
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            IA: <span style={{ color: user.integrations.ai ? 'var(--hub-positive)' : 'var(--hub-subtle)' }}>{user.integrations.ai ? 'chave própria' : 'sem chave'}</span>
            {' · '}Faculdade: <span style={{ color: user.integrations.sigaa ? 'var(--hub-positive)' : 'var(--hub-subtle)' }}>{collegeLabel(user)}</span>{user.integrations.sigaa && <SyncNote record={user.lastSync.sigaa} />}
          </p>
          {user.college?.institution === 'other' && user.college.system && user.college.system !== 'classroom' && (
            <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-warning)' }}>
              Pedido: integrar {user.college.system === 'other' ? user.college.systemName : SYSTEM_NAME[user.college.system] ?? user.college.system}
              {user.college.institutionName ? ` (${user.college.institutionName})` : ''}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
          {!isSelf && (
            <button
              onClick={() => void viewAs(user.id)}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Ver como
            </button>
          )}
          {!user.isAdmin && user.onboardedAt && (
            <button
              onClick={() => onUpdate(user, { resetOnboarding: true })}
              className="text-xs transition-opacity hover:opacity-60"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Refazer primeiro acesso
            </button>
          )}
          {!user.isAdmin && (
            <button
              onClick={() => void toggleDisabled()}
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: user.disabledAt ? 'var(--hub-positive)' : 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {user.disabledAt ? 'Reativar' : 'Desativar'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <div>
          <p style={labelStyle}>E-mail</p>
          <EditableText
            className="mt-0.5 min-w-0"
            inputClassName="min-w-0 w-full text-xs"
            value={user.email ?? ''}
            onSave={(email) => onUpdate(user, { email })}
            ariaLabel={`E-mail de ${user.name}`}
          >
            <span className="truncate text-xs" style={{ color: user.email ? 'var(--hub-text-body)' : 'var(--hub-disabled)' }}>
              {user.email ?? 'sem e-mail'}
            </span>
          </EditableText>
        </div>
        <div>
          <p style={labelStyle}>Login do Tailscale</p>
          <EditableText
            className="mt-0.5 min-w-0"
            inputClassName="min-w-0 w-full text-xs"
            value={user.tailscaleLogin ?? ''}
            onSave={(tailscaleLogin) => onUpdate(user, { tailscaleLogin })}
            ariaLabel={`Login do Tailscale de ${user.name}`}
          >
            <span className="truncate text-xs" style={{ color: user.tailscaleLogin ? 'var(--hub-text-body)' : 'var(--hub-disabled)' }}>
              {user.tailscaleLogin ?? (user.isAdmin ? 'sem login' : 'sem login — entra só pelo "ver como"')}
            </span>
          </EditableText>
        </div>
      </div>
    </div>
  );
}

function MaintenanceRow({ moduleId, name, last }: { moduleId: ModuleId; name: string; last: boolean }) {
  const session = useSession();
  const confirmAction = useConfirm();
  const active = moduleMaintenance(moduleId, session);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await loadSession();
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const ok = await confirmAction(
      `Pôr ${name} em manutenção?

Para os outros usuários o módulo vira uma tela de aviso com o seu recado, e o servidor recusa gravações nele até você encerrar. Você continua usando normalmente.`,
      { tone: 'neutral', confirmLabel: 'Pôr em manutenção' },
    );
    if (ok) await run(() => adminService.startMaintenance(moduleId, message.trim()));
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3" style={{ borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}>
      <span className="w-28 shrink-0 text-sm" style={{ color: active ? 'var(--hub-warning)' : 'var(--hub-text)' }}>{name}</span>
      {active ? (
        <>
          <span className="min-w-0 flex-1 text-xs" style={{ color: 'var(--hub-text-body)' }}>
            Em manutenção {relativeTime(active.since)} — “{active.message}”
          </span>
          <button onClick={() => void run(() => adminService.endMaintenance(moduleId))} disabled={busy} className="text-xs font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-positive)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Encerrar
          </button>
        </>
      ) : (
        <>
          <input className="min-w-0 flex-1 text-xs" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Recado para as pessoas (ex.: consertando as notas, volta hoje à noite)" maxLength={300} />
          <button onClick={() => void start()} disabled={busy || !message.trim()} className="text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40" style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Pôr em manutenção
          </button>
        </>
      )}
      {error && <span className="w-full text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</span>}
    </div>
  );
}

export function AdminPage() {
  const session = useSession();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => {
    adminService.list().then(setUsers).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os usuários.');
    });
  }, []);

  useEffect(reload, [reload]);

  async function update(user: AdminUser, patch: AdminUserPatch) {
    setError('');
    try {
      const updated = await adminService.update(user.id, patch);
      setUsers((list) => list?.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      await adminService.create({ name: name.trim(), email: email.trim() || null });
      setName('');
      setEmail('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <ModuleHeader eyebrow="Configurações · Admin" title="Usuários" />

      <Card>
        <h2 style={sectionTitleStyle}>Pessoas no Olimpo</h2>
        {error && <p className="mt-2 text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
        {!users && !error && <p className="mt-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>Carregando…</p>}
        {users?.map((user, index) => (
          <UserRow
            key={user.id}
            user={user}
            isSelf={user.id === session.realUser.id}
            last={index === users.length - 1}
            onUpdate={(u, patch) => void update(u, patch)}
          />
        ))}
      </Card>

      {users && <DeviceCertificatesCard users={users} />}

      <Card>
        <h2 style={sectionTitleStyle}>Módulos em manutenção</h2>
        <p className="mt-1.5 mb-2 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
          Tira um módulo do ar para todos os outros enquanto você conserta algo — eles veem o recado, e nada é gravado
          nele até você encerrar.
        </p>
        {modules.filter((m) => m.status === 'active').map((m, i, list) => (
          <MaintenanceRow key={m.id} moduleId={m.id} name={m.name} last={i === list.length - 1} />
        ))}
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>Novo usuário</h2>
        <p className="mt-1.5 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
          A pessoa começa com o Olimpo vazio e passa pelo primeiro acesso. Para ela entrar do próprio aparelho, cadastre o
          certificado dele em "Aparelhos com acesso pela internet"; antes disso, o "Ver como" mostra o que ela vai ver.
        </p>
        <form onSubmit={(e) => void create(e)} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span style={labelStyle}>Nome</span>
            <input className="mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ana" maxLength={80} />
          </label>
          <label className="block">
            <span style={labelStyle}>E-mail (opcional)</span>
            <input className="mt-1 w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@exemplo.com" />
          </label>
          <Button type="submit" disabled={creating || !name.trim()}>{creating ? 'Criando…' : 'Criar'}</Button>
        </form>
      </Card>
    </div>
  );
}
