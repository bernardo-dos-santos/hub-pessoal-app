import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ModuleHeader, Select } from '../../../shared/ui';
import { questionService } from '../services/questionService';
import { simuladoService } from '../services/simuladoService';
import { materialService } from '../../college/services/materialService';
import { CBMSC_SUBJECTS } from '../data/cbmscSubjects';
import { ABIN_SUBJECTS } from '../data/abinSubjects';
import type { QuestionDifficulty } from '../types/question';
import { getStudyTabs } from '../components/studyTabs';
import { errorNotebookService } from '../services/errorNotebookService';
import { ScoreEvolutionChart } from '../components/ScoreEvolutionChart';

const selectClass = 'w-full cursor-pointer appearance-none';

const DURATIONS = [
  { label: 'Sem limite', value: 0 },
  { label: '30 min', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '1h30', value: 90 },
  { label: '2 horas', value: 120 },
];

export function SimuladoSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const allSubjects = questionService.listSubjects();
  const results = simuladoService.listResults();

  // Materiais que possuem questões vinculadas
  const linkedMaterialIds = useMemo(() => questionService.listLinkedMaterialIds(), []);
  const allMaterials = useMemo(() => materialService.listMaterials(), []);
  const linkedMaterials = useMemo(
    () => allMaterials.filter((m) => linkedMaterialIds.includes(m.id)),
    [allMaterials, linkedMaterialIds],
  );

  // `?tag=` pré-seleciona uma matéria. É o parâmetro que o studyAlertProvider já
  // emite no alerta de domínio crítico e que a tela da disciplina usa — antes
  // esta página lia `?modo=`, que nenhum lugar do app produzia, então o alerta
  // caía num formulário genérico sem a matéria escolhida.
  const initialTag = searchParams.get('tag');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(() =>
    initialTag && allSubjects.includes(initialTag) ? [initialTag] : [],
  );
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | 'mixed'>('mixed');
  const [durationMin, setDurationMin] = useState(0);
  const [title, setTitle] = useState('');
  const [filterMsg, setFilterMsg] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);

  const available = useMemo(
    () => simuladoService.countAvailable({
      subjectTags: selectedSubjects,
      difficulty,
      materialIds: selectedMaterials.length > 0 ? selectedMaterials : undefined,
    }),
    [selectedSubjects, difficulty, selectedMaterials],
  );

  function toggleSubject(s: string) {
    setSelectedSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function toggleMaterial(id: string) {
    setSelectedMaterials((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleStart() {
    const questions = simuladoService.pickQuestions({
      subjectTags: selectedSubjects,
      count,
      difficulty,
      materialIds: selectedMaterials.length > 0 ? selectedMaterials : undefined,
    });
    if (questions.length === 0) return;

    const autoTitle =
      title.trim() ||
      (selectedSubjects.length > 0 ? selectedSubjects.slice(0, 2).join(', ') : 'Geral') +
        ` · ${questions.length}q`;

    const simulado = simuladoService.create({
      title: autoTitle,
      questionIds: questions.map((q) => q.id),
      durationMin,
    });

    navigate(`/estudos/simulados/${simulado.id}/executar`);
  }

  const canStart = available > 0 && count <= available;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title="Simulados" tabs={getStudyTabs(errorNotebookService.countPending())} />

      <div className="space-y-6">
      {allSubjects.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>Nenhuma questão no banco ainda.</p>
          <Link
            to="/estudos/questoes/gerar"
            className="mt-3 inline-block text-xs font-bold transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)' }}
          >
            Gerar questões →
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Novo simulado</h2>

          {/* Título opcional */}
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
              Título <span style={{ color: 'var(--hub-disabled)' }}>(opcional)</span>
            </label>
            <input
              placeholder="Ex: Direito Constitucional — Revisão 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Matérias */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
                Matérias <span style={{ color: 'var(--hub-disabled)' }}>(vazio = todas)</span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const filtered = [...CBMSC_SUBJECTS].filter((s) => allSubjects.includes(s));
                    if (filtered.length === 0) {
                      setFilterMsg('Nenhuma questão CBMSC no banco ainda.');
                      setTimeout(() => setFilterMsg(''), 3000);
                    } else {
                      setSelectedSubjects(filtered);
                      setFilterMsg('');
                    }
                  }}
                  className="text-[10px] font-bold transition-opacity hover:opacity-70"
                  style={{ color: 'var(--hub-positive)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  🔥 CBMSC
                </button>
                <button
                  onClick={() => {
                    const filtered = [...ABIN_SUBJECTS].filter((s) => allSubjects.includes(s));
                    if (filtered.length === 0) {
                      setFilterMsg('Nenhuma questão ABIN no banco ainda.');
                      setTimeout(() => setFilterMsg(''), 3000);
                    } else {
                      setSelectedSubjects(filtered);
                      setFilterMsg('');
                    }
                  }}
                  className="text-[10px] font-bold transition-opacity hover:opacity-70"
                  style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  🕵️ ABIN
                </button>
                {selectedSubjects.length > 0 && (
                  <button
                    onClick={() => { setSelectedSubjects([]); setFilterMsg(''); }}
                    className="text-[10px] transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
            {filterMsg && (
              <p className="mb-2 text-[11px] animate-pulse" style={{ color: 'var(--hub-warning)' }}>
                {filterMsg} Gere questões primeiro em "Gerar".
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {allSubjects.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSubject(s)}
                  className="px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: `1px solid ${selectedSubjects.includes(s) ? 'var(--hub-accent)' : 'var(--hub-border-strong)'}`,
                    color: selectedSubjects.includes(s) ? 'var(--hub-accent)' : 'var(--hub-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  {s} · {questionService.listBySubject(s).length}
                </button>
              ))}
            </div>
          </div>

          {/* Opções */}
          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Questões</label>
              <Select value={String(count)} onChange={(value) => setCount(Number(value))} className={selectClass}>
                {[5, 10, 15, 20, 30, 40, 50].map((n) => (
                  <Select.Option key={n} value={String(n)} disabled={n > available}>
                    {n}{n > available ? ' (sem estoque)' : ''}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Dificuldade</label>
              <Select value={difficulty} onChange={(value) => setDifficulty(value as QuestionDifficulty | 'mixed')} className={selectClass}>
                <Select.Option value="mixed">Variada</Select.Option>
                <Select.Option value="easy">Fácil</Select.Option>
                <Select.Option value="medium">Médio</Select.Option>
                <Select.Option value="hard">Difícil</Select.Option>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Duração</label>
              <Select value={String(durationMin)} onChange={(value) => setDurationMin(Number(value))} className={selectClass}>
                {DURATIONS.map((d) => (
                  <Select.Option key={d.value} value={String(d.value)}>{d.label}</Select.Option>
                ))}
              </Select>
            </div>
          </div>

          {/* Filtro por material (só exibe se existirem questões rastreadas) */}
          {linkedMaterials.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
                  Priorizar por material <span style={{ color: 'var(--hub-disabled)' }}>(vazio = todos)</span>
                </label>
                {selectedMaterials.length > 0 && (
                  <button
                    onClick={() => setSelectedMaterials([])}
                    className="text-[10px] transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {linkedMaterials.map((m) => {
                  const qCount = questionService.listByMaterial(m.id).length;
                  const active = selectedMaterials.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMaterial(m.id)}
                      className="px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: `1px solid ${active ? 'var(--hub-positive)' : 'var(--hub-border-strong)'}`,
                        color: active ? 'var(--hub-positive)' : 'var(--hub-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      {m.title} · {qCount}q
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
            {available} questão(ões) disponível(is) para esses filtros.
          </p>

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full py-3 text-sm font-bold transition-opacity hover:opacity-70 disabled:opacity-30"
            style={{ background: 'none', border: 'none', color: 'var(--hub-accent)', cursor: 'pointer' }}
          >
            Montar e iniciar simulado
          </button>
        </div>
      )}

      {/* Histórico completo. Antes esta tela mostrava as 3 últimas e havia uma
          página separada com a lista inteira — a mesma informação em dois
          lugares, com duas entradas na navegação. */}
      {results.length > 0 && (
        <div style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '16px' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
              Provas feitas · {results.length}
            </h2>
            <span className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
              média {Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)}%
            </span>
          </div>

          <div className="mb-4">
            <ScoreEvolutionChart results={results} />
          </div>

          {results.map((r) => (
            <Link
              key={r.id}
              to={`/estudos/simulados/resultado/${r.id}`}
              className="flex items-center justify-between py-2.5 transition-opacity hover:opacity-80"
              style={{ borderBottom: '1px solid var(--hub-border)' }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{r.title}</p>
                <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>{formatDate(r.finishedAt)} · {r.answers.length}q</p>
              </div>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: r.score >= 70 ? 'var(--hub-positive)' : r.score >= 50 ? 'var(--hub-warning)' : 'var(--hub-negative)' }}
              >
                {r.score}%
              </span>
            </Link>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
