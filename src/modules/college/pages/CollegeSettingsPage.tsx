import { useState } from 'react';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { COLLEGE_TABS } from '../components/collegeTabs';
import { collegeStorageKeys } from '../data/defaultCollegeData';
import { alertService } from '../services/alertService';
import { assessmentService } from '../services/assessmentService';
import { collegeBreakService, type SemesterBreak } from '../services/collegeBreakService';
import { collegeSummaryService } from '../services/collegeSummaryService';
import { gradeService } from '../services/gradeService';
import { materialService } from '../services/materialService';
import { subjectService } from '../services/subjectService';
import { taskService } from '../services/taskService';

export function CollegeSettingsPage() {
  const [cleared, setCleared] = useState(false);
  const [counts, setCounts] = useState(() => ({
    assessments: assessmentService.listAssessments().length,
    grades: gradeService.listGrades().length,
    materials: materialService.listMaterials().length,
    subjects: subjectService.listSubjects().length,
    tasks: taskService.listTasks().length,
  }));
  const summary = collegeSummaryService.getCollegeSummary();
  const [semesters, setSemesters] = useState(() => subjectService.listSemesters());
  const [selectedSemester, setSelectedSemester] = useState(() => semesters[0] ?? '');
  const [closedMessage, setClosedMessage] = useState<string | null>(null);

  const [semesterBreak, setSemesterBreak] = useState<SemesterBreak | null>(() => collegeBreakService.get());
  const [breakStart, setBreakStart] = useState(semesterBreak?.startDate ?? '');
  const [breakEnd, setBreakEnd] = useState(semesterBreak?.endDate ?? '');
  const isCurrentlyOnBreak = collegeBreakService.isOnBreak(semesterBreak);

  function saveBreak() {
    if (!breakStart || !breakEnd || breakStart > breakEnd) return;
    const period = { startDate: breakStart, endDate: breakEnd };
    collegeBreakService.set(period);
    setSemesterBreak(period);
  }

  function clearBreak() {
    collegeBreakService.clear();
    setSemesterBreak(null);
    setBreakStart('');
    setBreakEnd('');
  }

  const activeInSelectedSemester = subjectService
    .listActiveSubjects()
    .filter((s) => s.semester === selectedSemester);

  function clearAllData() {
    if (!confirm('Limpar TODOS os dados da Faculdade? Isso remove disciplinas, tarefas, avaliacoes, notas e materiais. Nao ha desfazer.')) return;
    subjectService.clearSubjects();
    assessmentService.clearAssessments();
    taskService.clearTasks();
    gradeService.clearGrades();
    materialService.clearMaterials();
    alertService.clearAlerts();
    setCounts({ assessments: 0, grades: 0, materials: 0, subjects: 0, tasks: 0 });
    setSemesters([]);
    setSelectedSemester('');
    setCleared(true);
  }

  function closeSemester() {
    if (!selectedSemester || activeInSelectedSemester.length === 0) return;
    const names = activeInSelectedSemester.map((s) => s.name).join(', ');
    if (!confirm(`Fechar o semestre ${selectedSemester}? Isso arquiva ${activeInSelectedSemester.length} disciplina(s): ${names}. Tarefas, notas e materiais continuam salvos.`)) return;
    const closed = subjectService.closeSemester(selectedSemester);
    setClosedMessage(`${closed.length} disciplina(s) do semestre ${selectedSemester} arquivada(s).`);
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Faculdade" title="Configurações" tabs={COLLEGE_TABS} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Estado local e limites assumidos para manter o modulo simples.
      </p>

      <Card className="mb-5">
        <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Semestre atual" value={summary.currentSemester} />
          <Metric label="Disciplinas salvas" value={counts.subjects} />
          <Metric label="Tarefas salvas" value={counts.tasks} />
          <Metric label="Avaliacoes salvas" value={counts.assessments} />
          <Metric label="Notas salvas" value={counts.grades} />
          <Metric label="Materiais salvos" value={counts.materials} last />
        </div>
      </Card>

      {cleared && (
        <p className="mb-5 text-sm" style={{ color: 'var(--hub-positive)' }}>
          Dados limpos com sucesso. Recarregue a pagina para ver o estado zerado em todo o modulo.
        </p>
      )}

      <Card className="mb-5">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>Período de férias</h3>
        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
          Enquanto a data de hoje estiver dentro do período, o sync automático do SIGAA
          (agendado no PC dedicado) não roda — evita login e coleta desnecessários fora do
          semestre letivo. Volta a rodar sozinho no dia seguinte ao fim do período.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="block" style={{ minWidth: '150px' }}>
            <span className="mb-1 block" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
              Início
            </span>
            <input type="date" className="w-full" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
          </label>

          <label className="block" style={{ minWidth: '150px' }}>
            <span className="mb-1 block" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
              Fim
            </span>
            <input type="date" className="w-full" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
          </label>

          <button
            className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            type="button"
            disabled={!breakStart || !breakEnd || breakStart > breakEnd}
            onClick={saveBreak}
          >
            Salvar período
          </button>

          {semesterBreak && (
            <button
              className="text-xs transition-opacity hover:opacity-60"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              type="button"
              onClick={clearBreak}
            >
              limpar
            </button>
          )}
        </div>

        {semesterBreak && (
          <p className="mt-3 text-xs" style={{ color: isCurrentlyOnBreak ? 'var(--hub-warning)' : 'var(--hub-subtle)' }}>
            {isCurrentlyOnBreak
              ? `Em férias agora — sync pausado até ${semesterBreak.endDate.split('-').reverse().join('/')}.`
              : `Período salvo: ${semesterBreak.startDate.split('-').reverse().join('/')} a ${semesterBreak.endDate.split('-').reverse().join('/')} (fora dele hoje — sync roda normal).`}
          </p>
        )}
      </Card>

      <Card className="mb-5">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>Fechar semestre</h3>
        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
          Arquiva de uma vez todas as disciplinas ativas do semestre escolhido. Nada e apagado — tarefas,
          notas e materiais continuam no historico, e disciplinas param de aparecer como trabalho ativo no
          Planner, Estudos e nos seletores da Faculdade.
        </p>

        {semesters.length === 0 ? (
          <p className="mt-3 text-xs" style={{ color: 'var(--hub-disabled)' }}>Nenhuma disciplina cadastrada ainda.</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="block" style={{ minWidth: '160px' }}>
              <span className="mb-1 block" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
                Semestre
              </span>
              <Select value={selectedSemester} onChange={setSelectedSemester}>
                {semesters.map((s) => (
                  <Select.Option key={s} value={s}>{s}</Select.Option>
                ))}
              </Select>
            </label>

            <button
              className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              type="button"
              disabled={activeInSelectedSemester.length === 0}
              onClick={closeSemester}
            >
              Fechar {selectedSemester} ({activeInSelectedSemester.length} ativa{activeInSelectedSemester.length === 1 ? '' : 's'})
            </button>
          </div>
        )}

        {closedMessage && (
          <p className="mt-3 text-xs" style={{ color: 'var(--hub-positive)' }}>{closedMessage}</p>
        )}
      </Card>

      <Card className="mb-5" style={{ borderLeft: '2px solid var(--hub-negative)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-negative)' }}>Limpar todos os dados</h3>
        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
          Remove disciplinas, tarefas, avaliacoes, notas e materiais do localStorage. Util para recomecar ou apos testes. Nao ha como desfazer.
        </p>
        <button
          className="mt-3 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
          type="button"
          onClick={clearAllData}
        >
          Limpar todos os dados da Faculdade
        </button>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>Persistencia local</h3>
          <p className="mt-2 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
            A interface conversa com services do modulo Faculdade. Esses services usam o storage adapter existente do Hub e guardam dados nas chaves locais abaixo.
          </p>
          <div className="mt-4 grid gap-0">
            {Object.entries(collegeStorageKeys).map(([name, key], i, arr) => (
              <div key={key} className="py-2" style={{ borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--hub-border)' }}>
                <span className="block text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
                  {name}
                </span>
                <code className="text-sm" style={{ color: 'var(--hub-muted)' }}>{key}</code>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>Fora do escopo desta versao</h3>
          <ul className="mt-3 grid gap-2">
            {[
              'Sem backend, banco remoto, autenticacao ou sincronizacao.',
              'Sem IA, SIGAA, Google Calendar ou notificacoes reais.',
              'Sem upload real de arquivos e sem leitura automatica de PDFs.',
              'Sem regras especificas de media do IFSC nesta versao.',
            ].map((item) => (
              <li key={item} className="text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, last = false }: { label: string; value: number | string; last?: boolean }) {
  return (
    <div className="py-3" style={{ borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}>
      <span className="block text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
        {label}
      </span>
      <strong className="mt-2 block text-xl" style={{ color: 'var(--hub-text)' }}>{value}</strong>
    </div>
  );
}
