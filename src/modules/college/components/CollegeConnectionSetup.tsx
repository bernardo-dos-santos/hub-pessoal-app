import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, ChoiceCard, Select, hub, tint, useConfirm } from '../../../shared/ui';
import {
  collegeConnectionService,
  type AcademicSystem,
  type CollegeConnection,
  type Institution,
  type SigaaStatus,
} from '../services/collegeConnectionService';

const labelStyle = {
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--hub-subtle)',
} as const;

const linkButton = { background: 'none', border: 'none', cursor: 'pointer' } as const;

function errorText(err: unknown) {
  return err instanceof Error ? err.message : 'Algo deu errado.';
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function SigaaSetup() {
  const confirmAction = useConfirm();
  const [status, setStatus] = useState<SigaaStatus | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(() => collegeConnectionService.lastSync());

  const reload = useCallback(() => {
    collegeConnectionService.sigaaStatus().then(setStatus).catch((err: unknown) => setError(errorText(err)));
    collegeConnectionService.refreshLastSync().then(setLastSync).catch(() => {});
  }, []);

  useEffect(reload, [reload]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await collegeConnectionService.saveSigaaCredentials(login.trim(), password);
      setLogin('');
      setPassword('');
      reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!(await confirmAction('Remover o acesso ao SIGAA?\n\nO Olimpo apaga o usuário e a senha guardados e para de buscar. O que já foi importado continua aqui.', { confirmLabel: 'Remover' }))) return;
    try {
      await collegeConnectionService.removeSigaa();
      reload();
    } catch (err) {
      setError(errorText(err));
    }
  }

  const connected = status?.configured === true;

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
        O Olimpo entra no SIGAA por você algumas vezes por dia e traz disciplinas, provas, tarefas, notas, faltas,
        materiais e o plano de ensino.
      </p>

      {!connected && (
        <div className="p-4 text-xs leading-5" style={{ background: tint(hub.warning, 12), borderRadius: 'var(--hub-radius-card)', color: 'var(--hub-text-body)' }}>
          <p className="font-medium" style={{ color: 'var(--hub-text)' }}>Antes de digitar sua senha</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>No IFSC, a senha do SIGAA costuma ser a mesma do e-mail e dos outros sistemas da instituição.</li>
            <li>Ela fica cifrada no servidor do Olimpo e nunca volta para esta tela. Mesmo assim, quem administra o servidor teria como acessá-la — só continue se confiar nele.</li>
            <li>Se preferir, deixe para depois e cadastre provas e tarefas à mão em Faculdade.</li>
          </ul>
        </div>
      )}

      {connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--hub-positive)' }}>SIGAA conectado.</p>
          <button onClick={() => void remove()} className="text-xs font-medium transition-opacity hover:opacity-70" style={{ ...linkButton, color: 'var(--hub-negative)' }}>
            Remover acesso
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void save(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span style={labelStyle}>Usuário do SIGAA</span>
              <input className="mt-1 w-full" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="off" spellCheck={false} />
            </label>
            <label className="block">
              <span style={labelStyle}>Senha</span>
              <input className="mt-1 w-full" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </label>
          </div>
          <p className="text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
            A senha não é testada agora: cada teste é um login de verdade, e o SIGAA bloqueia logins demais. A primeira
            busca agendada confirma — o resultado aparece aqui.
          </p>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !login.trim() || !password}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </form>
      )}

      {status?.configured && (
        <p className="text-xs leading-5" style={{ color: lastSync && !lastSync.ok ? 'var(--hub-negative)' : 'var(--hub-subtle)' }}>
          {lastSync
            ? lastSync.ok
              ? `Última busca ${formatWhen(lastSync.at)}: ${lastSync.courses ?? 0} disciplina(s).`
              : `Última busca ${formatWhen(lastSync.at)} com problema: ${lastSync.error}`
            : 'Ainda não houve busca — ela roda sozinha algumas vezes por dia.'}
        </p>
      )}
      {error && <p className="text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
    </div>
  );
}

const SYSTEM_LABEL: Record<AcademicSystem, string> = {
  classroom: 'Google Classroom',
  moodle: 'Moodle',
  sigaa: 'SIGAA (de outra instituição)',
  other: 'Outro',
};

function OtherInstitution({ connection, onSave }: { connection: CollegeConnection; onSave: (c: CollegeConnection) => void }) {
  const [name, setName] = useState(connection.institutionName ?? '');
  const [system, setSystem] = useState<AcademicSystem | ''>(connection.system ?? '');
  const [systemName, setSystemName] = useState(connection.systemName ?? '');
  const saved = Boolean(connection.system);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!system) return;
    onSave({ institution: 'other', institutionName: name.trim(), system, systemName: system === 'other' ? systemName.trim() : undefined });
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span style={labelStyle}>Instituição</span>
          <input className="mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: UFSC" />
        </label>
        <div>
          <span style={labelStyle}>Sistema que ela usa</span>
          <Select className="mt-1 w-full" value={system} onChange={(v) => setSystem(v as AcademicSystem)}>
            <Select.Option value="" disabled>Escolher…</Select.Option>
            {(Object.keys(SYSTEM_LABEL) as AcademicSystem[]).map((key) => (
              <Select.Option key={key} value={key}>{SYSTEM_LABEL[key]}</Select.Option>
            ))}
          </Select>
        </div>
      </div>
      {system === 'other' && (
        <label className="block">
          <span style={labelStyle}>Qual?</span>
          <input className="mt-1 w-full" value={systemName} onChange={(e) => setSystemName(e.target.value)} placeholder="Nome do sistema" />
        </label>
      )}
      {saved && (
        <p className="text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
          {connection.system === 'classroom'
            ? 'Anotado. A conexão com o Google Classroom está sendo construída — quando ficar pronta, você entra com a conta Google da faculdade aqui mesmo.'
            : 'Anotado — o pedido chegou para quem administra o Olimpo, e a ideia é buscar implementar esse sistema.'}{' '}
          Enquanto isso, disciplinas, provas e tarefas podem ser cadastradas à mão em Faculdade.
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={!system || !name.trim() || (system === 'other' && !systemName.trim())}>{saved ? 'Atualizar' : 'Salvar'}</Button>
      </div>
    </form>
  );
}

/**
 * Where the user studies, and from there how College gets its data: the
 * SIGAA sync for IFSC, Google Classroom (coming) for UNIPLAC, a request for
 * anything else. Used by the first access and Configurações → Conexões.
 */
export function CollegeConnectionSetup() {
  const [connection, setConnection] = useState<CollegeConnection | null>(() => collegeConnectionService.getConnection());

  function save(next: CollegeConnection) {
    collegeConnectionService.setConnection(next);
    setConnection(next);
  }

  function choose(institution: Institution) {
    if (connection?.institution === institution) return;
    save({ institution });
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ChoiceCard active={connection?.institution === 'ifsc'} title="IFSC" description="Busca automática pelo SIGAA." onClick={() => choose('ifsc')} />
        <ChoiceCard active={connection?.institution === 'uniplac'} title="UNIPLAC" description="Google Classroom (em construção)." onClick={() => choose('uniplac')} />
        <ChoiceCard active={connection?.institution === 'other'} title="Outra" description="Conte qual sistema ela usa." onClick={() => choose('other')} />
      </div>

      {connection?.institution === 'ifsc' && <SigaaSetup />}

      {connection?.institution === 'uniplac' && (
        <p className="mt-4 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
          A UNIPLAC usa o Google Classroom. A conexão com ele está sendo construída: quando ficar pronta, você entra com a
          conta Google da faculdade aqui mesmo e as atividades chegam sozinhas. Até lá, disciplinas, provas e tarefas podem
          ser cadastradas à mão em Faculdade.
        </p>
      )}

      {connection?.institution === 'other' && <OtherInstitution connection={connection} onSave={save} />}
    </div>
  );
}
