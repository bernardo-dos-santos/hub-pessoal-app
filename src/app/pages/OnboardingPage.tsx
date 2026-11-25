import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { modules } from '../../core/module-registry/modules';
import { type ModuleId } from '../../core/module-registry/module-types';
import { updateMe, useSession } from '../../core/session/session';
import { Button, Card } from '../../shared/ui';
import { ModulePicker } from '../components/ModulePicker';
import { FinanceConnectionSetup } from '../../modules/finance/components/FinanceConnectionSetup';
import { CollegeConnectionSetup } from '../../modules/college/components/CollegeConnectionSetup';
import { AiQuickSetup } from '../../core/ai/AiQuickSetup';
import { ViewAsBanner } from '../components/ViewAsBanner';

type Step = 'welcome' | 'modules' | 'finance' | 'college' | 'ai' | 'done';

/** Per-module setup steps, shown only when that module was chosen. */
const MODULE_STEPS: { step: Step; module: ModuleId }[] = [
  { step: 'finance', module: 'finance' },
  { step: 'college', module: 'college' },
];

const allModules = modules.filter((m) => m.status === 'active').map((m) => m.id);

const eyebrowStyle = {
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

const quietButton = { color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' } as const;

type SetupStepProps = {
  eyebrow: string;
  title: string;
  intro?: string;
  onBack: () => void;
  onNext: () => void;
  children: ReactNode;
};

/** A setup step: always skippable — whatever is skipped waits in Configurações. */
function SetupStep({ eyebrow, title, intro, onBack, onNext, children }: SetupStepProps) {
  return (
    <Card hero>
      <p style={eyebrowStyle}>{eyebrow}</p>
      <h1 className="mt-2 text-2xl" style={{ fontWeight: 400, letterSpacing: '-0.02em' }}>{title}</h1>
      <p className="mt-3 mb-5 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
        {intro ? `${intro} ` : ''}Pode fazer agora ou deixar para depois, pelas Configurações.
      </p>
      {children}
      <div className="mt-6 flex items-center justify-between">
        <button onClick={onBack} className="text-xs transition-opacity hover:opacity-60" style={quietButton}>Voltar</button>
        <span className="flex items-center gap-5">
          <button onClick={onNext} className="text-xs transition-opacity hover:opacity-60" style={quietButton}>Configurar depois</button>
          <Button onClick={onNext}>Continuar</Button>
        </span>
      </div>
    </Card>
  );
}

/**
 * First access — shown instead of the app until the user finishes it. Asks
 * only what changes the Hub right away (name, modules); integrations (AI,
 * Google, bank) are each set up later from their own screens.
 */
export function OnboardingPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState(session.name);
  const [selected, setSelected] = useState<ModuleId[]>(session.modules ?? allModules);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const steps: Step[] = [
    'welcome',
    'modules',
    ...MODULE_STEPS.filter((s) => selected.includes(s.module)).map((s) => s.step),
    'ai',
    'done',
  ];
  const stepIndex = steps.indexOf(step);
  const next = () => setStep(steps[stepIndex + 1]);
  const back = () => setStep(steps[stepIndex - 1]);

  async function finish() {
    setSaving(true);
    setError('');
    try {
      await updateMe({ name: name.trim(), modules: selected, onboarded: true });
      navigate('/', { replace: true });
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--hub-bg)', color: 'var(--hub-text)' }}>
      <ViewAsBanner />
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 pb-12 pt-10 sm:pt-16">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold" style={{ color: 'var(--hub-primary)' }}>Olimpo</span>
          <span className="flex gap-1.5" aria-label={`Passo ${stepIndex + 1} de ${steps.length}`}>
            {steps.map((s, i) => (
              <span
                key={s}
                className="h-1.5 transition-all"
                style={{
                  width: i === stepIndex ? '22px' : '6px',
                  borderRadius: 'var(--hub-radius-control)',
                  background: i <= stepIndex ? 'var(--hub-accent)' : 'var(--hub-track)',
                }}
              />
            ))}
          </span>
        </div>

        {step === 'welcome' && (
          <Card hero>
            <p style={eyebrowStyle}>Primeiro acesso</p>
            <h1 className="mt-2 text-2xl" style={{ fontWeight: 400, letterSpacing: '-0.02em' }}>Bem-vindo(a) ao seu Olimpo</h1>
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
              Finanças, estudos, faculdade, treino, metas e planejamento num lugar só. Este Olimpo é seu: o que você
              guarda aqui só aparece para você.
            </p>
            <label className="mt-6 block">
              <span style={labelStyle}>Como quer ser chamado(a)?</span>
              <input
                className="mt-1 w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                maxLength={80}
                autoFocus
              />
            </label>
            <div className="mt-6 flex justify-end">
              <Button onClick={next} disabled={!name.trim()}>Continuar</Button>
            </div>
          </Card>
        )}

        {step === 'modules' && (
          <Card hero>
            <p style={eyebrowStyle}>O que você quer usar</p>
            <h1 className="mt-2 text-2xl" style={{ fontWeight: 400, letterSpacing: '-0.02em' }}>Escolha seus módulos</h1>
            <p className="mt-3 mb-3 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
              Desligue o que não fizer sentido para você agora. Dá para mudar quando quiser em Configurações → Módulos.
            </p>
            <ModulePicker value={selected} onChange={setSelected} />
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={back}
                className="text-xs transition-opacity hover:opacity-60"
                style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Voltar
              </button>
              <Button onClick={next} disabled={selected.length === 0}>
                {selected.length === 0 ? 'Escolha ao menos um' : 'Continuar'}
              </Button>
            </div>
          </Card>
        )}

        {step === 'finance' && (
          <SetupStep eyebrow="Financeiro" title="De onde vêm suas transações?" onBack={back} onNext={next}>
            <FinanceConnectionSetup />
          </SetupStep>
        )}

        {step === 'college' && (
          <SetupStep eyebrow="Faculdade" title="Onde você estuda?" onBack={back} onNext={next}>
            <CollegeConnectionSetup />
          </SetupStep>
        )}

        {step === 'ai' && (
          <SetupStep
            eyebrow="Inteligência artificial"
            title="Ligue a IA do seu Olimpo"
            intro="Questões, resumos, flashcards e planos de estudo são gerados por IA, com uma chave sua. Sem ela, o resto do Olimpo funciona normalmente."
            onBack={back}
            onNext={next}
          >
            <AiQuickSetup />
          </SetupStep>
        )}

        {step === 'done' && (
          <Card hero>
            <p style={eyebrowStyle}>Tudo pronto</p>
            <h1 className="mt-2 text-2xl" style={{ fontWeight: 400, letterSpacing: '-0.02em' }}>
              Pode entrar, {name.trim().split(/\s+/)[0]}
            </h1>
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
              O que você pulou fica em Configurações, para quando quiser.
            </p>
            {error && <p className="mt-3 text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={back}
                className="text-xs transition-opacity hover:opacity-60"
                style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Voltar
              </button>
              <Button onClick={finish} disabled={saving}>{saving ? 'Salvando…' : 'Entrar no Olimpo'}</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
