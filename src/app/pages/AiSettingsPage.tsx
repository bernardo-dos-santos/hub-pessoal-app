import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '../../shared/components/PageContainer';
import { PageHeader } from '../../shared/components/PageHeader';
import { Card, Select } from '../../shared/ui';
import {
  aiConfig,
  aiKeys,
  AI_SLOTS,
  AI_SLOT_LABEL,
  AI_SLOT_HELP,
  AI_SLOT_DEFAULT_PROVIDER,
  type AiProviderMeta,
  type AiProviderName,
  type AiSlotId,
  type AiStatus,
} from '../../core/ai/aiConfig';
import { notifyAiConfigChanged } from '../../core/ai/useAiAvailable';
import { JarvisSettings } from '../../core/jarvis/JarvisSettings';

const labelStyle = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--hub-subtle)',
} as const;

const sectionTitleStyle = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.13em',
  color: 'var(--hub-subtle)',
} as const;

const primaryButton = { color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' } as const;
const subtleButton = { color: 'var(--hub-muted)', background: 'none', border: 'none', cursor: 'pointer' } as const;
const dangerButton = { color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' } as const;

type Feedback = { tone: 'ok' | 'error'; message: string } | null;

type SlotCardProps = {
  slot: AiSlotId;
  /** Posição na ordem de tentativa, vinda do servidor. */
  attempt: number;
  providers: AiProviderMeta[];
  hasKey: boolean;
  canSaveKey: boolean;
  onChanged: () => void;
};

function SlotCard({ slot, attempt, providers, hasKey, canSaveKey, onChanged }: SlotCardProps) {
  const saved = aiConfig.getSlot(slot);

  const [provider, setProvider] = useState<AiProviderName>(saved?.provider ?? AI_SLOT_DEFAULT_PROVIDER[slot]);
  const [model, setModel] = useState(saved?.model ?? '');
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<'save' | 'test' | 'models' | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const meta = providers.find((p) => p.id === provider) ?? null;
  const configured = saved !== null;
  const options = models.length > 0 ? models : (meta?.suggestedModels ?? []);
  const effectiveModel = model || meta?.defaultModel || '';
  // Provedor com chave exigida só é utilizável se a chave já está guardada ou
  // está sendo enviada agora — é essa checagem que sustenta a invariante de
  // "slot gravado é slot utilizável", da qual o isReady() síncrono depende.
  const keyReady = !meta?.needsKey || hasKey || apiKey.trim().length > 0;

  function pickProvider(next: AiProviderName) {
    setProvider(next);
    setModel('');
    setModels([]);
    setBaseUrl('');
    setFeedback(null);
  }

  async function handleSave() {
    if (!meta) return;
    if (!keyReady) {
      setFeedback({ tone: 'error', message: `${meta.label} precisa de uma chave.` });
      return;
    }
    setBusy('save');
    setFeedback(null);
    try {
      // A chave primeiro: se ela for recusada, o slot não é gravado, e a IA não
      // passa a se anunciar como pronta com uma credencial que não existe.
      if (meta.needsKey && apiKey.trim()) {
        await aiKeys.saveKey(slot, apiKey.trim());
        setApiKey('');
      }
      aiConfig.setSlot(slot, {
        provider,
        model: effectiveModel,
        baseUrl: meta.needsBaseUrl ? (baseUrl.trim() || meta.defaultBaseUrl) : null,
      });
      notifyAiConfigChanged();
      onChanged();
      setFeedback({ tone: 'ok', message: 'Slot salvo.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar.' });
    } finally {
      setBusy(null);
    }
  }

  async function handleTest() {
    if (!meta) return;
    setBusy('test');
    setFeedback(null);
    try {
      const result = await aiKeys.test(slot, {
        provider,
        model: effectiveModel,
        baseUrl: meta.needsBaseUrl ? (baseUrl.trim() || meta.defaultBaseUrl) : null,
      });
      setFeedback(result.ok
        ? { tone: 'ok', message: `Respondeu — ${result.provider} · ${result.model}.` }
        : { tone: 'error', message: `Respondeu de forma inesperada: "${result.text.slice(0, 80)}"` });
    } catch (err) {
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Erro ao testar.' });
    } finally {
      setBusy(null);
    }
  }

  async function handleFetchModels() {
    if (!meta) return;
    setBusy('models');
    setFeedback(null);
    try {
      const found = await aiKeys.listModels(slot, {
        provider,
        baseUrl: meta.needsBaseUrl ? (baseUrl.trim() || meta.defaultBaseUrl) : null,
      });
      if (found.length === 0) {
        setFeedback({ tone: 'error', message: 'Nenhum modelo disponível para esta chave.' });
        return;
      }
      setModels(found);
      if (!found.includes(effectiveModel)) setModel(found[0]);
      setFeedback({ tone: 'ok', message: `${found.length} modelo(s) encontrado(s).` });
    } catch (err) {
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Erro ao listar modelos.' });
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setBusy('save');
    try {
      await aiKeys.clearKey(slot);
      aiConfig.setSlot(slot, null);
      notifyAiConfigChanged();
      onChanged();
      setProvider(AI_SLOT_DEFAULT_PROVIDER[slot]);
      setModel('');
      setBaseUrl('');
      setApiKey('');
      setModels([]);
      setFeedback({ tone: 'ok', message: 'Slot removido.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Erro ao remover.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h2 style={sectionTitleStyle}>
            {attempt}ª tentativa · {AI_SLOT_LABEL[slot]}
          </h2>
          <p className="mt-1.5 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
            {AI_SLOT_HELP[slot]}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs" style={{ color: configured ? 'var(--hub-positive)' : 'var(--hub-subtle)' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: configured ? 'var(--hub-positive)' : 'var(--hub-disabled)' }} />
          {configured ? 'ativo' : 'vazio'}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span style={labelStyle}>Provedor</span>
          <Select className="mt-1.5 w-full text-sm" value={provider} onChange={(value) => pickProvider(value as AiProviderName)}>
            {providers.map((p) => (
              <Select.Option key={p.id} value={p.id}>{`${p.label} — ${p.hint}`}</Select.Option>
            ))}
          </Select>
        </label>

        {meta?.needsKey && (
          <div>
            <label className="block">
              <span style={labelStyle}>Chave da API</span>
              <input
                type="password"
                className="mt-1.5 w-full text-sm"
                placeholder={hasKey ? 'chave guardada — preencha só para trocar' : 'cole sua chave aqui'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setFeedback(null); }}
              />
            </label>
            {meta.keyUrl && (
              <a
                href={meta.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block text-xs transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)' }}
              >
                Onde pegar a chave do {meta.label} →
              </a>
            )}
          </div>
        )}

        {meta?.needsBaseUrl && (
          <label className="block">
            <span style={labelStyle}>URL do servidor</span>
            <input
              className="mt-1.5 w-full text-sm"
              placeholder={meta.defaultBaseUrl ?? ''}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <span className="mt-1 block text-xs" style={{ color: 'var(--hub-subtle)' }}>
              Quem alcança esta URL é o servidor do Hub, não este aparelho.
            </span>
          </label>
        )}

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span style={labelStyle}>Modelo</span>
            <button
              onClick={handleFetchModels}
              disabled={busy !== null || !keyReady}
              className="text-xs transition-opacity hover:opacity-70 disabled:opacity-40"
              style={primaryButton}
            >
              {busy === 'models' ? 'Buscando…' : '↻ Buscar modelos disponíveis'}
            </button>
          </div>
          <Select className="w-full text-sm" value={effectiveModel} onChange={setModel}>
            {!options.includes(effectiveModel) && effectiveModel && (
              <Select.Option value={effectiveModel}>{effectiveModel}</Select.Option>
            )}
            {options.map((m) => (<Select.Option key={m} value={m}>{m}</Select.Option>))}
          </Select>
        </div>

        <div className="flex flex-wrap items-baseline gap-5 pt-1">
          <button
            onClick={handleSave}
            disabled={busy !== null || !canSaveKey}
            className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
            style={primaryButton}
          >
            {busy === 'save' ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            onClick={handleTest}
            disabled={busy !== null || !keyReady}
            className="text-sm transition-opacity hover:opacity-70 disabled:opacity-40"
            style={subtleButton}
          >
            {busy === 'test' ? 'Testando…' : 'Testar'}
          </button>
          {configured && (
            <button
              onClick={handleRemove}
              disabled={busy !== null}
              className="text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
              style={dangerButton}
            >
              Remover slot
            </button>
          )}
        </div>

        {feedback && (
          <p className="text-xs" style={{ color: feedback.tone === 'ok' ? 'var(--hub-positive)' : 'var(--hub-negative)' }}>
            {feedback.tone === 'ok' ? '✓' : '✗'} {feedback.message}
          </p>
        )}
      </div>
    </Card>
  );
}

export function AiSettingsPage() {
  const [providers, setProviders] = useState<AiProviderMeta[]>([]);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loadError, setLoadError] = useState('');

  const refreshStatus = useCallback(() => {
    aiKeys.getStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    aiKeys.listProviders()
      .then(setProviders)
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : 'Erro ao carregar provedores.'));
    refreshStatus();
  }, [refreshStatus]);

  const chainOrder = status?.chainOrder ?? [];
  const encryptionOff = status !== null && !status.encryption;

  return (
    <PageContainer>
      <div>
        <Link to="/configuracoes" className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-subtle)' }}>
          ← Configurações
        </Link>
        <PageHeader
          eyebrow="Preferências · IA"
          title="Inteligência Artificial"
          description={
            chainOrder.length > 0
              ? `Cada chamada tenta os slots nesta ordem: ${chainOrder.map((s) => AI_SLOT_LABEL[s]).join(' → ')}. `
                + 'Começar pela Secundária é o que gasta a cota gratuita antes da paga; a queda só acontece quando o provedor avisa que acabou.'
              : 'Três slots, tentados em ordem. A cota gratuita é gasta antes da paga, e a queda só acontece quando o provedor avisa que acabou.'
          }
        />
      </div>

      {loadError && (
        <p className="text-sm" style={{ color: 'var(--hub-negative)' }}>
          ✗ {loadError} — o servidor do Hub precisa estar no ar para configurar a IA.
        </p>
      )}

      {encryptionOff && (
        <Card>
          <p className="text-sm leading-6" style={{ color: 'var(--hub-negative)' }}>
            O servidor está sem <span className="font-medium">CREDENTIALS_ENCRYPTION_KEY</span>, então nenhuma chave pode
            ser guardada com segurança — e por isso salvar está bloqueado. Defina a variável no <code>.env</code> do
            servidor e reinicie.
          </p>
        </Card>
      )}

      {providers.length > 0 && status !== null && AI_SLOTS.map((slot) => (
        <SlotCard
          key={slot}
          slot={slot}
          attempt={chainOrder.indexOf(slot) + 1}
          providers={providers}
          hasKey={status.settings[slot]?.hasKey ?? false}
          canSaveKey={status.encryption}
          onChanged={refreshStatus}
        />
      ))}

      <Card>
        <h2 style={sectionTitleStyle}>Jarvis</h2>
        <p className="mt-1.5 mb-4 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
          O assistente usa a chave da Anthropic do servidor, separada dos slots acima.
        </p>
        <JarvisSettings />
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>Privacidade</h2>
        <p className="mt-2 text-sm leading-6" style={{ color: 'var(--hub-muted)' }}>
          As chaves ficam cifradas no banco do servidor e nunca são devolvidas ao navegador — nem para esta tela, que só
          sabe se existe ou não uma chave guardada. O conteúdo dos seus dados só sai da máquina quando você aciona uma
          função de IA, e vai para o provedor do slot que atender a chamada. Com o Ollama, nada sai.
        </p>
      </Card>
    </PageContainer>
  );
}
