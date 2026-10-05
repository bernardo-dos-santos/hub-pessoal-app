import { useEffect, useState } from 'react';
import { Card, ProgressBar, Select } from '../../shared/ui';
import { apiUrl } from '../config/backendConfig';
import { resetLocationCapabilityCache } from './location';

/**
 * Configuração do Jarvis (Fase 6) — presets, dials e trava de gasto.
 *
 * Dois eixos independentes de propósito: inteligência (preset) custa dinheiro,
 * acesso à máquina custa risco. Juntar os dois num controle só tornaria
 * impossível querer o modelo mais esperto com acesso mínimo, ou o contrário.
 *
 * Toda a verdade vem do servidor (`/api/jarvis/config`) — a tela não guarda
 * cópia dos defaults, senão eles divergiriam de `server/jarvis/config.js`.
 */

type ModelCap = { label: string; effort: boolean; adaptiveThinking: boolean; webToolsV2: boolean };
type MachineLevel = { label: string; hint: string };

type SurfaceDial = {
  model: string;
  effort: string | null;
  maxTokens: number;
  maxIters: number;
  intervalMinutes?: number;
  dailyBudget?: number;
  windowStart?: number;
  windowEnd?: number;
};

type JarvisConfig = {
  preset: string;
  chat: SurfaceDial;
  tick: SurfaceDial;
  task: SurfaceDial;
  capabilities: {
    web: 'off' | 'tasks' | 'all';
    google: { read: boolean; write: boolean };
    machine: { level: number };
    memoryTool: boolean;
    location: boolean;
  };
  budget: { monthlyCapBrl: number; usdToBrl: number; creditUsd: number | null; creditUpdatedAt: string | null };
};

type Place = { id: string; name: string; radiusM: number };

/** O que o servidor devolve sobre a última posição — sem coordenada, de propósito. */
type LastLocation = { place: string | null; at: string | null; minutesAgo?: number };

type BudgetStatus = {
  month: string;
  spentUsd: number;
  spentBrl: number;
  calls: number;
  webSearches: number;
  monthlyCapBrl: number;
  capReached: boolean;
  capUsedRatio: number;
  creditUsd: number | null;
  creditRemainingUsd: number | null;
  lowCredit: boolean;
};

type Payload = {
  config: JarvisConfig;
  budget: BudgetStatus;
  presets: string[];
  models: Record<string, ModelCap>;
  machineLevels: Record<string, MachineLevel>;
};

const PRESET_LABEL: Record<string, string> = {
  basico: 'Básico',
  medio: 'Médio',
  maximo: 'Máximo',
  custom: 'Personalizado',
};

const PRESET_HINT: Record<string, string> = {
  basico: 'Chat no modelo mais barato, verificações espaçadas, web só nas tarefas.',
  medio: 'Chat esperto, web também na conversa, escrita nas contas Google.',
  maximo: 'Tarefas no modelo mais capaz, verificações frequentes, allowlist livre.',
  custom: 'Você ajustou algum controle — os valores não são mais os de um nível pronto.',
};

const WEB_LABEL: Record<string, string> = {
  off: 'Desligada',
  tasks: 'Só nas tarefas e verificações',
  all: 'Em tudo, inclusive no chat',
};

const LABEL_STYLE = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  color: 'var(--hub-subtle)',
};

const HOURS = Array.from({ length: 24 }, (_, h) => h);

const SECTION_TITLE = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.13em',
  color: 'var(--hub-subtle)',
};

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Projeção do mês a partir do que já foi gasto: extrapola linear pelo dia do
 * mês. Deliberadamente simples — a alternativa é uma tabela estática de
 * estimativas que envelhece e mente. Com poucos dias corridos a projeção é
 * ruidosa, então a tela diz isso em vez de fingir precisão.
 */
function projectMonth(spentBrl: number): { projected: number; reliable: boolean } {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return {
    projected: (spentBrl / dayOfMonth) * daysInMonth,
    reliable: dayOfMonth >= 5,
  };
}

export function JarvisSettings() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [creditInput, setCreditInput] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [lastPlace, setLastPlace] = useState<LastLocation | null>(null);
  const [placeName, setPlaceName] = useState('');

  const loadPlaces = () => {
    fetch(apiUrl('/api/jarvis/places'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { places: Place[]; last: LastLocation }) => {
        setPlaces(d.places ?? []);
        setLastPlace(d.last ?? null);
      })
      .catch(() => { /* lista de lugares é acessório: falhar aqui não derruba a tela */ });
  };

  useEffect(loadPlaces, []);

  async function savePlace() {
    const name = placeName.trim();
    if (!name) return;
    setError('');
    try {
      const res = await fetch(apiUrl('/api/jarvis/places'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setPlaceName('');
      loadPlaces();
      flashSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o lugar.');
    }
  }

  async function deletePlace(id: string) {
    await fetch(apiUrl(`/api/jarvis/places/${id}`), { method: 'DELETE' }).catch(() => null);
    loadPlaces();
  }

  useEffect(() => {
    fetch(apiUrl('/api/jarvis/config'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Payload) => {
        setData(d);
        setCreditInput(d.config.budget.creditUsd === null ? '' : String(d.config.budget.creditUsd));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar.'));
  }, []);

  function flashSaved() {
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  }

  async function send(path: string, method: 'POST' | 'PUT', body: unknown) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(apiUrl(path), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      const next = await res.json();
      setData((prev) => (prev ? { ...prev, config: next.config, budget: next.budget } : prev));
      flashSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) {
    return (
      <Card>
        <p style={SECTION_TITLE}>Jarvis</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--hub-negative)' }}>
          ✗ Não consegui carregar a configuração: {error}
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--hub-subtle)' }}>
          O servidor do Hub precisa estar rodando.
        </p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <p style={SECTION_TITLE}>Jarvis</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--hub-subtle)' }}>Carregando…</p>
      </Card>
    );
  }

  const { config, budget, presets, models, machineLevels } = data;
  const chatCaps = models[config.chat.model];
  const webOnChatBlocked = config.capabilities.web === 'all' && chatCaps && !chatCaps.webToolsV2;
  const projection = projectMonth(budget.spentBrl);
  const modelIds = Object.keys(models);

  return (
    <div className="space-y-5">
      {/* ── Nível ────────────────────────────────────────────────────────── */}
      <Card>
        <p style={SECTION_TITLE}>Nível do Jarvis</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--hub-muted)' }}>
          Quanto ele pensa, com que frequência olha as coisas sozinho e quanto isso custa.
        </p>

        <div className="mt-4 flex flex-wrap gap-6">
          {[...presets, 'custom'].map((p) => {
            const active = config.preset === p;
            const isCustom = p === 'custom';
            return (
              <button
                key={p}
                onClick={() => { if (!isCustom) void send('/api/jarvis/config/preset', 'POST', { preset: p }); }}
                disabled={saving || isCustom}
                className="pb-2 text-left transition-opacity hover:opacity-80 disabled:cursor-default"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: isCustom ? 'default' : 'pointer',
                  borderBottom: active ? '1px solid var(--hub-accent)' : '1px solid transparent',
                  opacity: isCustom && !active ? 0.35 : 1,
                }}
              >
                <p className="text-sm font-medium" style={{ color: active ? 'var(--hub-text)' : 'var(--hub-subtle)' }}>
                  {PRESET_LABEL[p] ?? p}
                </p>
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--hub-subtle)' }}>
          {PRESET_HINT[config.preset] ?? ''}
        </p>
      </Card>

      {/* ── Gasto ────────────────────────────────────────────────────────── */}
      <Card>
        <p style={SECTION_TITLE}>Gasto de {budget.month}</p>

        <p className="mt-3 tabular-nums" style={{ fontSize: '32px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-text)' }}>
          {brl(budget.spentBrl)}
        </p>
        <p className="text-sm tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
          US$ {budget.spentUsd.toFixed(2)} · {budget.calls} chamada(s)
          {budget.webSearches > 0 && ` · ${budget.webSearches} busca(s) na web`}
        </p>

        <div className="mt-4">
          <ProgressBar value={budget.capUsedRatio} signal={budget.capReached ? 'negative' : 'neutral'} />
          <div className="mt-1.5 flex justify-between text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
            <span>{(budget.capUsedRatio * 100).toFixed(0)}% do teto</span>
            <span>teto {brl(budget.monthlyCapBrl)}</span>
          </div>
        </div>

        {budget.spentBrl > 0 && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-muted)' }}>
            Projeção do mês: <span className="tabular-nums">{brl(projection.projected)}</span>
            {!projection.reliable && (
              <span style={{ color: 'var(--hub-subtle)' }}> — poucos dias corridos, ainda pouco confiável</span>
            )}
          </p>
        )}

        {budget.capReached && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-warning)' }}>
            ⚠ Teto atingido. Tarefas em background estão pausadas; chat e verificações automáticas seguem.
          </p>
        )}
        {budget.lowCredit && (
          <p className="mt-2 text-sm" style={{ color: 'var(--hub-negative)' }}>
            ⚠ Saldo estimado abaixo de US$ 1 (restam US$ {budget.creditRemainingUsd?.toFixed(2)}).
          </p>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span style={LABEL_STYLE}>Teto mensal (R$)</span>
            <input
              type="number"
              min={0}
              className="mt-1.5 w-full text-sm"
              defaultValue={config.budget.monthlyCapBrl}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v !== config.budget.monthlyCapBrl) {
                  void send('/api/jarvis/config', 'PUT', { budget: { monthlyCapBrl: v } });
                }
              }}
            />
          </label>
          <label className="block">
            <span style={LABEL_STYLE}>Saldo de crédito (US$)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="digite após recarregar"
              className="mt-1.5 w-full text-sm"
              value={creditInput}
              onChange={(e) => setCreditInput(e.target.value)}
              onBlur={() => {
                const v = creditInput.trim() === '' ? null : Number(creditInput);
                if (v !== null && !Number.isFinite(v)) return;
                if (v !== config.budget.creditUsd) {
                  void send('/api/jarvis/config', 'PUT', {
                    budget: { creditUsd: v, creditUpdatedAt: new Date().toISOString() },
                  });
                }
              }}
            />
          </label>
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
          A Anthropic não expõe o saldo por API — este número precisa ser redigitado a cada recarga.
        </p>
      </Card>

      {/* ── Modelos por superfície ───────────────────────────────────────── */}
      <Card>
        <p style={SECTION_TITLE}>Modelos</p>
        <div className="mt-3 space-y-4">
          {([
            ['chat', 'Conversa', 'Responde quando você fala com ele.'],
            ['tick', 'Verificação automática', 'Olha o Hub sozinho e decide se vale te interromper.'],
            ['task', 'Tarefa em background', 'Trabalho longo que ele faz sozinho depois de você pedir.'],
          ] as const).map(([surface, label, hint]) => {
            const dial = config[surface];
            const caps = models[dial.model];
            return (
              <div key={surface} style={{ borderBottom: surface === 'task' ? 'none' : '1px solid var(--hub-border)', paddingBottom: surface === 'task' ? 0 : '16px' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{label}</p>
                    <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>{hint}</p>
                  </div>
                  <Select
                    value={dial.model}
                    onChange={(v) => void send('/api/jarvis/config', 'PUT', { [surface]: { ...dial, model: v } })}
                    className="text-sm"
                  >
                    {modelIds.map((id) => (
                      <Select.Option key={id} value={id}>{models[id].label}</Select.Option>
                    ))}
                  </Select>
                </div>
                {caps && !caps.effort && dial.effort && (
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                    {caps.label} não aceita ajuste de esforço — o valor é ignorado.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Ritmo da verificação automática ──────────────────────────────── */}
      {/*
        Estes quatro dials existem em `server/jarvis/config.js` desde o começo,
        mas até aqui só mudavam junto com o preset — quem quisesse o Máximo
        falando menos tinha que editar o banco na mão. O gasto do tick é
        intervalo × orçamento, então é o controle mais direto de custo que a
        tela oferece depois da escolha de modelo.
      */}
      <Card>
        <p style={SECTION_TITLE}>Ritmo da verificação automática</p>
        <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
          De quanto em quanto tempo ele olha o Hub sozinho, quantas vezes por dia pode falar e
          entre que horas. Dia parado quase não gasta: ele só chama o modelo quando algo mudou.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span style={LABEL_STYLE}>A cada</span>
            <Select
              className="mt-1.5 w-full text-sm"
              value={String(config.tick.intervalMinutes ?? 45)}
              onChange={(v) => void send('/api/jarvis/config', 'PUT', { tick: { intervalMinutes: Number(v) } })}
            >
              {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                <Select.Option key={m} value={String(m)}>
                  {m < 60 ? `${m} minutos` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60) : ''}`}
                </Select.Option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span style={LABEL_STYLE}>Falas por dia (máximo)</span>
            <Select
              className="mt-1.5 w-full text-sm"
              value={String(config.tick.dailyBudget ?? 6)}
              onChange={(v) => void send('/api/jarvis/config', 'PUT', { tick: { dailyBudget: Number(v) } })}
            >
              {[2, 4, 6, 8, 10, 12, 16].map((n) => (
                <Select.Option key={n} value={String(n)}>{`${n} verificações`}</Select.Option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span style={LABEL_STYLE}>Não antes de</span>
            <Select
              className="mt-1.5 w-full text-sm"
              value={String(config.tick.windowStart ?? 7)}
              onChange={(v) => void send('/api/jarvis/config', 'PUT', { tick: { windowStart: Number(v) } })}
            >
              {HOURS.map((h) => (
                <Select.Option key={h} value={String(h)}>{`${String(h).padStart(2, '0')}:00`}</Select.Option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span style={LABEL_STYLE}>Não depois de</span>
            <Select
              className="mt-1.5 w-full text-sm"
              value={String(config.tick.windowEnd ?? 23)}
              onChange={(v) => void send('/api/jarvis/config', 'PUT', { tick: { windowEnd: Number(v) } })}
            >
              {HOURS.map((h) => (
                <Select.Option key={h} value={String(h)}>{`${String(h).padStart(2, '0')}:00`}</Select.Option>
              ))}
            </Select>
          </label>
        </div>

        {(config.tick.windowStart ?? 7) >= (config.tick.windowEnd ?? 23) && (
          <p className="mt-3 text-xs" style={{ color: 'var(--hub-warning)' }}>
            ⚠ A janela começa depois de terminar — com esses horários ele nunca vai verificar nada.
          </p>
        )}
        {(config.tick.intervalMinutes ?? 45) >= 60 && (
          <p className="mt-3 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            Com intervalo de 1h ou mais, o cache das ferramentas do tick expira entre uma
            verificação e outra — cada uma paga o contexto por inteiro.
          </p>
        )}
      </Card>

      {/* ── Capacidades ──────────────────────────────────────────────────── */}
      <Card>
        <p style={SECTION_TITLE}>O que ele pode fazer</p>

        <label className="mt-4 block">
          <span style={LABEL_STYLE}>Acesso à web</span>
          <Select
            value={config.capabilities.web}
            onChange={(v) => void send('/api/jarvis/config', 'PUT', { capabilities: { web: v } })}
            className="mt-1.5 w-full text-sm"
          >
            {Object.entries(WEB_LABEL).map(([v, label]) => (
              <Select.Option key={v} value={v}>{label}</Select.Option>
            ))}
          </Select>
        </label>
        {webOnChatBlocked && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--hub-warning)' }}>
            ⚠ {chatCaps.label} não suporta as ferramentas de web atuais. Com ele na conversa, a web só funciona
            nas tarefas e verificações. Troque o modelo da conversa para usar web no chat.
          </p>
        )}

        <label className="mt-5 block">
          <span style={LABEL_STYLE}>Acesso à máquina</span>
          <Select
            value={String(config.capabilities.machine.level)}
            onChange={(v) => void send('/api/jarvis/config', 'PUT', { capabilities: { machine: { level: Number(v) } } })}
            className="mt-1.5 w-full text-sm"
          >
            {Object.entries(machineLevels).map(([level, info]) => (
              <Select.Option key={level} value={level}>{`${level} — ${info.label}`}</Select.Option>
            ))}
          </Select>
        </label>
        <p className="mt-1.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
          {machineLevels[String(config.capabilities.machine.level)]?.hint}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
          Independente do nível, qualquer comando que venha depois de ele ler algo de fora
          (site, e-mail, arquivo) sempre espera sua aprovação.
        </p>

        <div className="mt-5 space-y-3">
          {([
            ['google.read', 'Ler Gmail, Agenda e Drive', config.capabilities.google.read],
            ['google.write', 'Escrever nas contas Google (sempre com sua aprovação)', config.capabilities.google.write],
            ['memoryTool', 'Memória de longo prazo (arquivos em /memories, sem teto)', config.capabilities.memoryTool],
            ['location', 'Saber em que lugar você está (só pelo celular)', config.capabilities.location],
          ] as const).map(([key, label, value]) => (
            <label key={key} className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (key === 'memoryTool') void send('/api/jarvis/config', 'PUT', { capabilities: { memoryTool: checked } });
                  else if (key === 'location') {
                    // A trava do lado do app lê a capacidade uma vez por sessão;
                    // sem isto, ligar aqui só valeria no próximo boot.
                    resetLocationCapabilityCache();
                    void send('/api/jarvis/config', 'PUT', { capabilities: { location: checked } });
                  }
                  else if (key === 'google.read') void send('/api/jarvis/config', 'PUT', { capabilities: { google: { read: checked } } });
                  else void send('/api/jarvis/config', 'PUT', { capabilities: { google: { write: checked } } });
                }}
                className="h-4 w-4"
                style={{ accentColor: 'var(--hub-accent)' }}
              />
              <span className="text-sm" style={{ color: 'var(--hub-text-body)' }}>{label}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--hub-subtle)' }}>
          Estas chaves ficam guardadas; as capacidades entram em funcionamento conforme cada fase for
          implementada.
        </p>
      </Card>

      {config.capabilities.location && (
        <Card>
          <p style={SECTION_TITLE}>Lugares</p>
          <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            O Jarvis nunca vê coordenada — só o nome do lugar em que você está, e apenas se for um
            destes. Fora deles, ele não sabe onde você está.
          </p>

          <p className="mt-3 text-sm" style={{ color: 'var(--hub-text-body)' }}>
            {lastPlace?.at
              ? lastPlace.place
                ? `Agora: ${lastPlace.place}${lastPlace.minutesAgo !== undefined ? ` (posição de ${lastPlace.minutesAgo} min atrás)` : ''}`
                : 'Última posição recebida não bate com nenhum lugar salvo.'
              : 'Nenhuma posição recebida ainda — abra o Hub no celular com a capacidade ligada.'}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <input
              className="flex-1"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void savePlace(); }}
              placeholder="Ex.: casa, IFSC, academia"
              maxLength={40}
            />
            <button
              onClick={() => void savePlace()}
              disabled={!placeName.trim() || !lastPlace?.at}
              className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-30"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              salvar aqui
            </button>
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            Usa a última posição que o celular mandou — então salve estando no lugar.
          </p>

          <div className="mt-4">
            {places.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Nenhum lugar salvo.</p>
            )}
            {places.map((place, idx) => (
              <div
                key={place.id}
                className="flex items-center justify-between py-2"
                style={{ borderBottom: idx === places.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
              >
                <span className="text-sm" style={{ color: 'var(--hub-text)' }}>{place.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{place.radiusM} m</span>
                  <button
                    onClick={() => void deletePlace(place.id)}
                    className="text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-1">
        {savedMsg && <p className="text-xs" style={{ color: 'var(--hub-positive)' }}>✓ Salvo.</p>}
        {error && data && <p className="text-xs" style={{ color: 'var(--hub-negative)' }}>✗ {error}</p>}
      </div>
    </div>
  );
}
