import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ContentsPage } from './ContentsPage';
import { ErrorNotebookPage } from './ErrorNotebookPage';
import { DeckListPage } from './DeckListPage';
import { QuestionBankPage } from './QuestionBankPage';
import { QuestionRunPage } from './QuestionRunPage';
import { NewQuestionsPage } from './NewQuestionsPage';
import { NewSummaryPage } from './NewSummaryPage';
import { NewFlashcardsPage } from './NewFlashcardsPage';
import { FlashcardRunPage } from './FlashcardRunPage';
import { SimuladoResultPage } from './SimuladoResultPage';
import { SimuladoRunPage } from './SimuladoRunPage';
import { SimuladoSetupPage } from './SimuladoSetupPage';
import { StudyTodayPage } from './StudyTodayPage';
import { ErrorDrillPage } from './ErrorDrillPage';
import { StudyReaderPage } from './StudyReaderPage';
import { SubjectStudyPage } from './SubjectStudyPage';

/**
 * Redireciona preservando a query string.
 *
 * `<Navigate to="/x">` descarta os parâmetros, e há link salvo que depende deles
 * — hoje `?tag=`, que pré-seleciona a matéria no `StudySourcePicker`. Perder a
 * query levaria o usuário para a tela certa com a matéria errada.
 */
function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

export function StudyRoutesPage() {
  return (
    <Routes>
      {/* Abas de topo — ver getStudyTabs */}
      <Route index element={<StudyTodayPage />} />
      <Route path="resumos" element={<ContentsPage />} />
      <Route path="questoes" element={<QuestionBankPage />} />
      <Route path="flashcards" element={<DeckListPage />} />
      <Route path="erros" element={<ErrorNotebookPage />} />
      <Route path="simulados" element={<SimuladoSetupPage />} />

      {/* Drill-downs — herdam o destaque da aba pai e ganham a seta de voltar */}
      <Route path="disciplina/:tag" element={<SubjectStudyPage />} />
      <Route path="resumos/novo" element={<NewSummaryPage />} />
      <Route path="resumos/:id" element={<StudyReaderPage />} />
      <Route path="questoes/gerar" element={<NewQuestionsPage />} />
      <Route path="questoes/praticar" element={<QuestionRunPage />} />
      <Route path="flashcards/gerar" element={<NewFlashcardsPage />} />
      <Route path="flashcards/praticar/:deckId" element={<FlashcardRunPage />} />
      <Route path="erros/drill" element={<ErrorDrillPage />} />
      <Route path="simulados/historico" element={<LegacyRedirect to="/estudos/simulados" />} />
      <Route path="simulados/resultado/:resultId" element={<SimuladoResultPage />} />
      <Route path="simulados/:id/executar" element={<SimuladoRunPage />} />
      {/* A sessão guiada virou a prática de questões: eram o mesmo produto com
          dois conjuntos de limites e duas telas de conclusão. A rota fica como
          redirect porque a Home aponta para ela em três lugares. */}
      <Route path="sessao" element={<LegacyRedirect to="/estudos/questoes/praticar" />} />

      {/* Rotas antigas. Ficam como redirect porque há link salvo, alerta e
          referência de fora do módulo apontando para elas. */}
      <Route path="biblioteca" element={<LegacyRedirect to="/estudos" />} />
      <Route path="progresso" element={<LegacyRedirect to="/estudos" />} />
      <Route path="plano" element={<LegacyRedirect to="/planner" />} />
      <Route path="gerar" element={<LegacyRedirect to="/estudos/questoes/gerar" />} />
      <Route path="caderno" element={<LegacyRedirect to="/estudos/erros" />} />
      <Route path="drill" element={<LegacyRedirect to="/estudos/erros/drill" />} />
      <Route path="praticar" element={<LegacyRedirect to="/estudos/flashcards" />} />
      <Route path="praticar/:deckId" element={<LegacyPracticeRedirect />} />
      <Route path="simulado" element={<LegacyRedirect to="/estudos/simulados" />} />
      <Route path="historico" element={<LegacyRedirect to="/estudos/simulados" />} />
      <Route path="simulado/resultado/:resultId" element={<LegacyResultRedirect />} />
      <Route path="simulado/:id/run" element={<LegacyRunRedirect />} />

      <Route path="*" element={<Navigate to="/estudos" replace />} />
    </Routes>
  );
}

/** Redirects que precisam repassar o parâmetro dinâmico da rota antiga. */
function LegacyPracticeRedirect() {
  const { pathname, search } = useLocation();
  const deckId = pathname.split('/').pop() ?? '';
  // `interleaved` e `questoes` eram ids mágicos que escolhiam um motor de sessão
  // diferente dentro da mesma página. Viraram, respectivamente, o modo misto de
  // flashcards e a prática de questões — que agora são rotas de verdade.
  if (deckId === 'interleaved') return <Navigate to={`/estudos/flashcards/praticar/misto${search}`} replace />;
  if (deckId === 'questoes') return <Navigate to={`/estudos/questoes/praticar${search}`} replace />;
  return <Navigate to={`/estudos/flashcards/praticar/${deckId}${search}`} replace />;
}

function LegacyResultRedirect() {
  const { pathname, search } = useLocation();
  const resultId = pathname.split('/').pop() ?? '';
  return <Navigate to={`/estudos/simulados/resultado/${resultId}${search}`} replace />;
}

function LegacyRunRedirect() {
  const { pathname, search } = useLocation();
  const id = pathname.split('/').filter(Boolean).at(-2) ?? '';
  return <Navigate to={`/estudos/simulados/${id}/executar${search}`} replace />;
}
