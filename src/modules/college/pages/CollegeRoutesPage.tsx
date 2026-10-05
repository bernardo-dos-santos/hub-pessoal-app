import { Navigate, Route, Routes } from 'react-router-dom';
import { AssessmentsPage } from './AssessmentsPage';
import { CollegeDashboardPage } from './CollegeDashboardPage';
import { CollegeSettingsPage } from './CollegeSettingsPage';
import { GradesPage } from './GradesPage';
import { MaterialsPage } from './MaterialsPage';
import { QuickCapturePage } from './QuickCapturePage';
import { SigaaImportPage } from './SigaaImportPage';
import { StudyPage } from './StudyPage';
import { SubjectsPage } from './SubjectsPage';
import { TasksPage } from './TasksPage';

export function CollegeRoutesPage() {
  return (
    <Routes>
      <Route index element={<CollegeDashboardPage />} />
      <Route path="disciplinas" element={<SubjectsPage />} />
      <Route path="avaliacoes" element={<AssessmentsPage />} />
      <Route path="tarefas" element={<TasksPage />} />
      <Route path="notas" element={<GradesPage />} />
      <Route path="materiais" element={<MaterialsPage />} />
      <Route path="estudo" element={<StudyPage />} />
      <Route path="captura" element={<QuickCapturePage />} />
      <Route path="sigaa" element={<SigaaImportPage />} />
      <Route path="configuracoes" element={<CollegeSettingsPage />} />
      <Route path="*" element={<Navigate to="/faculdade" replace />} />
    </Routes>
  );
}
