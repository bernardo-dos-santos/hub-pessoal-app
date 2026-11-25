import { useState, type FormEvent } from 'react';
import { Button } from '../../shared/ui';
import { aiConfig, aiKeys } from './aiConfig';
import { notifyAiConfigChanged, useAiAvailable } from './useAiAvailable';

const labelStyle = {
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--hub-subtle)',
} as const;

const STEPS = [
  'Abra aistudio.google.com/app/apikey com a sua conta Google.',
  'Clique em "Create API key" (criar chave). É gratuito — o Google dá uma cota diária sem cartão.',
  'Copie a chave e cole aqui.',
];

/**
 * The shortest path to working AI for someone new: a free Gemini key as the
 * principal slot. Same invariant as Configurações → IA — the slot is written
 * only after the key is stored AND the provider answered with it; a key that
 * fails the test is removed again, so isReady() never lies.
 */
export function AiQuickSetup() {
  const ready = useAiAvailable();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const gemini = (await aiKeys.listProviders()).find((p) => p.id === 'gemini');
      if (!gemini) throw new Error('O servidor não oferece o Gemini.');
      await aiKeys.saveKey('principal', key.trim());
      const config = { provider: gemini.id, model: gemini.defaultModel, baseUrl: null };
      try {
        const result = await aiKeys.test('principal', config);
        if (!result.ok) throw new Error('O Gemini respondeu de forma inesperada.');
      } catch (err) {
        await aiKeys.clearKey('principal').catch(() => {});
        throw err;
      }
      aiConfig.setSlot('principal', config);
      notifyAiConfigChanged();
      setKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a chave.');
    } finally {
      setBusy(false);
    }
  }

  if (ready) {
    return (
      <p className="text-sm leading-6" style={{ color: 'var(--hub-positive)' }}>
        IA configurada. Dá para trocar de provedor ou adicionar outros em Configurações → Conexão com IA.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <ol className="space-y-2">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
            <span className="tabular-nums shrink-0 font-medium" style={{ color: 'var(--hub-accent)' }}>{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <label className="block">
        <span style={labelStyle}>Chave do Gemini</span>
        <input className="mt-1 w-full" type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <p className="text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
        A chave é testada antes de valer, fica cifrada no servidor e é só sua — o uso de IA sai da sua cota, não da de outra pessoa.
      </p>
      {error && <p className="text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !key.trim()}>{busy ? 'Testando…' : 'Testar e salvar'}</Button>
      </div>
    </form>
  );
}
