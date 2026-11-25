import { useState } from 'react';
import { Card, ListRow, ModuleHeader, SwitchRow } from '../../../shared/ui';
import { aiConfig } from '../../../core/ai/aiConfig';
import { subjectService } from '../../college/services/subjectService';
import { weeklyPlanService } from '../../planner/services/weeklyPlanService';
import { getStudyTabs } from '../components/studyTabs';
import { autoGenerateService } from '../services/autoGenerateService';
import { errorNotebookService } from '../services/errorNotebookService';

const OUTCOME_LABEL = {
  generated: 'gerou questões',
  nothing: 'não havia o que gerar',
  failed: 'falhou',
} as const;

function Meta({ children }: { children: string }) {
  return <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>{children}</p>;
}

function when(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Configurar dos Estudos — o que muda o comportamento do módulo, num lugar só:
 * a geração automática (que gasta a chave de IA da pessoa) e onde moram as
 * coisas de que os Estudos dependem (disciplinas, plano semanal, IA).
 */
export function StudyConfigurePage() {
  const [autoOn, setAutoOn] = useState(() => autoGenerateService.isEnabled());
  const archivedTags = subjectService.listArchivedSubjectTags();
  const pendingErrors = errorNotebookService.countPending(archivedTags);
  const subjects = subjectService.listActiveSubjects().length;
  const lastAttempt = autoGenerateService.getLastAttempt();
  const notice = autoGenerateService.getLastNotice();
  const planAuto = weeklyPlanService.isAutoGenerateEnabled();
  const aiReady = aiConfig.isReady();

  function toggleAuto(next: boolean) {
    autoGenerateService.setEnabled(next);
    setAutoOn(next);
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title="Configurar" tabs={getStudyTabs(pendingErrors)} />

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card>
          <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '2px' }}>
            Geração automática
          </p>
          <SwitchRow
            checked={autoOn}
            onChange={toggleAuto}
            last
            label="Criar questões sozinho"
            description="Ao abrir Estudos, até uma vez por dia, cria 10 questões da disciplina mais fraca ou do material novo do SIGAA. Usa a sua chave de IA; pausa quando há prova em até 3 dias."
          />
          {autoOn && (lastAttempt || notice) && (
            <div style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '10px' }}>
              {lastAttempt && (
                <p className="text-xs tabular-nums" style={{ color: lastAttempt.outcome === 'failed' ? 'var(--hub-negative)' : 'var(--hub-subtle)' }}>
                  Última vez: {when(lastAttempt.at)} — {OUTCOME_LABEL[lastAttempt.outcome]}.
                </p>
              )}
              {notice && <p className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>{notice}</p>}
            </div>
          )}
        </Card>

        <Card>
          <ListRow
            to="/faculdade/disciplinas"
            label={<><p className="text-sm" style={{ color: 'var(--hub-text)' }}>Disciplinas</p><Meta>{subjects > 0 ? `${subjects} ativa${subjects === 1 ? '' : 's'} — vêm da Faculdade` : 'Cadastre na Faculdade — os Estudos se organizam por elas'}</Meta></>}
            value={<span style={{ color: 'var(--hub-subtle)' }}>→</span>}
          />
          <ListRow
            to="/planner/configurar"
            label={<><p className="text-sm" style={{ color: 'var(--hub-text)' }}>Plano semanal</p><Meta>{planAuto ? 'Gerado aos domingos; as sessões de hoje aparecem em Hoje' : 'Geração automática desligada no Planejador'}</Meta></>}
            value={<span style={{ color: 'var(--hub-subtle)' }}>→</span>}
          />
          <ListRow
            to="/configuracoes/ia"
            last
            label={<><p className="text-sm" style={{ color: 'var(--hub-text)' }}>IA</p><Meta>{aiReady ? 'Configurada — resumos, questões e flashcards' : 'Não configurada — sem ela, nada é gerado'}</Meta></>}
            value={<span style={{ color: aiReady ? 'var(--hub-subtle)' : 'var(--hub-warning)' }}>→</span>}
          />
        </Card>
      </div>
    </div>
  );
}
