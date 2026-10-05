import { useMemo, useState } from 'react';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { COLLEGE_TABS } from '../components/collegeTabs';
import { EmptyCollegeState } from '../components/EmptyCollegeState';
import { collegeStudyService } from '../services/collegeStudyService';
import { subjectService } from '../services/subjectService';
import { formatAssessmentStatus, formatAssessmentType, formatCollegeDate, formatGradeValue, formatMaterialType, formatTaskPriority, formatTaskStatus } from '../utils/collegeFormatters';

export function StudyPage() {
  const subjects = subjectService.listSubjects();
  const activeSubjects = subjects.filter((subject) => subject.status === 'active');
  const defaultSubjectId = activeSubjects[0]?.id ?? subjects[0]?.id ?? '';
  const [selectedSubjectId, setSelectedSubjectId] = useState(defaultSubjectId);
  const overview = useMemo(() => collegeStudyService.getOverview(selectedSubjectId), [selectedSubjectId]);

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Faculdade" title="Estudo por disciplina" tabs={COLLEGE_TABS} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Um recorte simples para estudar usando materiais, tarefas, avaliacoes e notas ja cadastrados.
      </p>

      {subjects.length === 0 ? (
        <Card><EmptyCollegeState title="Nenhuma disciplina cadastrada." description="Crie disciplinas antes de montar uma visao de estudo." /></Card>
      ) : (
        <>
          <Card className="mb-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
                  Disciplina selecionada
                </span>
                <h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--hub-text)' }}>
                  {overview.subject?.name ?? 'Disciplina removida'}
                </h3>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--hub-subtle)' }}>
                  {overview.subject?.semester}
                  {overview.subject?.professor ? ` / ${overview.subject.professor}` : ''}
                </p>
              </div>
              <label className="grid gap-2 md:w-56">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
                  Escolher disciplina
                </span>
                <Select
                  className="w-full bg-transparent pb-1.5 text-sm outline-none cursor-pointer appearance-none"
                  value={selectedSubjectId}
                  onChange={setSelectedSubjectId}
                >
                  {subjects.map((subject) => (
                    <Select.Option key={subject.id} value={subject.id}>{subject.shortName ?? subject.name}</Select.Option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-0 sm:grid-cols-4" style={{ borderTop: '1px solid var(--hub-border)' }}>
              <StudyStat label="Materiais" value={overview.materials.length} />
              <StudyStat label="Tarefas abertas" value={overview.openTasks.length} />
              <StudyStat label="Provas proximas" value={overview.upcomingAssessments.length} />
              <StudyStat label="Media simples" value={overview.average === null ? '—' : formatGradeValue(overview.average)} last />
            </div>
          </Card>

          <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Card>
              <SectionHeading title="Proximos passos" description="Sugestoes locais e deterministicas, sem IA." />
              {overview.nextSteps.length === 0 ? (
                <p className="mt-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>Nenhuma sugestao por agora.</p>
              ) : (
                <div className="mt-3">
                  {overview.nextSteps.map((step, i) => (
                    <article key={step.id} className="py-2" style={{ borderBottom: i === overview.nextSteps.length - 1 ? 'none' : '1px solid var(--hub-border)', borderLeft: '2px solid var(--hub-accent)', paddingLeft: '10px' }}>
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{step.title}</h4>
                      <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{step.description}</p>
                    </article>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <SectionHeading title="Preparacao para pacote de estudo" description="Base para uso futuro, ainda sem geracao automatica." />
              <p className="mt-3 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                Materiais, tags, tarefas e avaliacoes desta disciplina poderao formar um pacote de estudo ou um prompt manual para ChatGPT/NotebookLM no futuro.
              </p>
              {overview.commonTags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {overview.commonTags.map((tag) => (
                    <span key={tag} className="text-xs font-medium" style={{ color: 'var(--hub-subtle)' }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>Nenhuma tag de material ainda.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <SectionHeading title="Materiais da disciplina" description="Recorte de estudo dos materiais cadastrados." />
              {overview.materials.length === 0 ? (
                <div className="mt-3"><EmptyCollegeState title="Nenhum material para esta disciplina." description="Adicione PDFs externos, links, slides, listas ou anotacoes em Materiais." /></div>
              ) : (
                <div className="mt-3">
                  {overview.materials.map((material, i) => (
                    <article key={material.id} className="py-2" style={{ borderBottom: i === overview.materials.length - 1 ? 'none' : '1px solid var(--hub-border)' }}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{material.title}</h4>
                          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
                            {formatMaterialType(material.type)}
                          </p>
                        </div>
                        {material.url?.startsWith('http') ? (
                          <a
                            className="shrink-0 text-xs font-semibold transition-opacity hover:opacity-70"
                            style={{ color: 'var(--hub-accent)' }}
                            href={material.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir link
                          </a>
                        ) : null}
                      </div>
                      {material.description ? (
                        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{material.description}</p>
                      ) : null}
                      {material.url && !material.url.startsWith('http') ? (
                        <p className="mt-1 break-all text-xs" style={{ color: 'var(--hub-subtle)' }}>{material.url}</p>
                      ) : null}
                      {material.tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {material.tags.map((tag) => (
                            <span key={tag} className="text-xs" style={{ color: 'var(--hub-subtle)' }}>#{tag}</span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid gap-5">
              <Card>
                <SectionHeading title="Proximas avaliacoes" description="Somente avaliacoes futuras e agendadas." />
                {overview.upcomingAssessments.length === 0 ? (
                  <p className="mt-3 text-xs" style={{ color: 'var(--hub-subtle)' }}>Nenhuma avaliacao futura cadastrada para esta disciplina.</p>
                ) : (
                  <div className="mt-3">
                    {overview.upcomingAssessments.map((assessment, i) => (
                      <ListItem
                        key={assessment.id}
                        title={assessment.title}
                        detail={`${formatCollegeDate(assessment.date)} / ${formatAssessmentType(assessment.type)} / ${formatAssessmentStatus(assessment.status)}`}
                        last={i === overview.upcomingAssessments.length - 1}
                      />
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <SectionHeading title="Tarefas abertas" description="Pendentes, em andamento ou atrasadas." />
                {overview.openTasks.length === 0 ? (
                  <p className="mt-3 text-xs" style={{ color: 'var(--hub-subtle)' }}>Nenhuma tarefa aberta para esta disciplina.</p>
                ) : (
                  <div className="mt-3">
                    {overview.openTasks.map((task, i) => (
                      <ListItem
                        key={task.id}
                        title={task.title}
                        detail={`${formatCollegeDate(task.dueDate)} / ${formatTaskStatus(task.status)} / ${formatTaskPriority(task.priority)}`}
                        last={i === overview.openTasks.length - 1}
                      />
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <SectionHeading title="Notas" description="Media simples quando houver dados suficientes." />
                {overview.grades.length === 0 ? (
                  <p className="mt-3 text-xs" style={{ color: 'var(--hub-subtle)' }}>Nenhuma nota lancada para esta disciplina.</p>
                ) : (
                  <div className="mt-3">
                    {overview.grades.map((grade, i) => (
                      <ListItem
                        key={grade.id}
                        title={grade.title}
                        detail={`${formatGradeValue(grade.value, grade.maxValue)}${grade.weight ? ` / peso ${grade.weight}` : ''}${grade.date ? ` / ${formatCollegeDate(grade.date)}` : ''}`}
                        last={i === overview.grades.length - 1}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ListItem({ detail, title, last = false }: { detail: string; title: string; last?: boolean }) {
  return (
    <article className="py-2" style={{ borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}>
      <h4 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{title}</h4>
      <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{detail}</p>
    </article>
  );
}

function SectionHeading({ description, title }: { description: string; title: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{title}</h3>
      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{description}</p>
    </div>
  );
}

function StudyStat({ label, value, last = false }: { label: string; value: number | string; last?: boolean }) {
  return (
    <div className="py-3" style={{ borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}>
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
        {label}
      </span>
      <strong className="mt-2 block text-2xl" style={{ color: 'var(--hub-text)' }}>{value}</strong>
    </div>
  );
}
