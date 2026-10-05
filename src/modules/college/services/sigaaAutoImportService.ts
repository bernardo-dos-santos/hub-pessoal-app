import { storageAdapter } from '../../../core/storage/storage.adapter';
import { isSigaaExport, importSigaaData, type SigaaImportResult } from './sigaaImportService';
import { materialService } from './materialService';
import { subjectService } from './subjectService';

const LAST_AUTO_IMPORT_KEY = 'college.sigaaAutoImportAt';

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}

function hasIncompleteMaterials(data: { courses: { title: string; files: unknown[] }[] }): boolean {
  // Alguns snapshots antigos ficaram com as disciplinas criadas, mas sem todos os
  // materiais vinculados. Se a contagem local estiver abaixo da exportacao atual
  // do SIGAA, refazemos a importacao aditiva para completar os vinculos faltantes.
  const subjectsByName = new Map(
    subjectService
      .listSubjects()
      .map((subject) => [normalizeTitle(subject.name), subject.id] as const),
  );

  const materialCountBySubject = new Map<string, number>();
  for (const material of materialService.listMaterials()) {
    if (!material.subjectId) continue;
    materialCountBySubject.set(
      material.subjectId,
      (materialCountBySubject.get(material.subjectId) ?? 0) + 1,
    );
  }

  return data.courses.some((course) => {
    const subjectId = subjectsByName.get(normalizeTitle(course.title));
    if (!subjectId) return false;
    const currentCount = materialCountBySubject.get(subjectId) ?? 0;
    return currentCount < course.files.length;
  });
}

export async function checkAndAutoImport(): Promise<SigaaImportResult | null> {
  try {
    const res = await fetch('/sigaa-pending.json', { cache: 'no-store' });
    if (!res.ok) return null;

    const data: unknown = await res.json();
    if (!isSigaaExport(data)) return null;

    // Só pula o auto-import quando o arquivo não é mais novo E não falta
    // material de disciplina já existente.
    const lastImportAt = storageAdapter.getItem<string>(LAST_AUTO_IMPORT_KEY);
    // Só materiais faltando forçam reimportação. A checagem equivalente por
    // DISCIPLINA faltando foi removida: ela não sabia distinguir "sumiu porque
    // o banco foi restaurado" de "sumiu porque o Bernardo apagou", e tratava
    // sempre como o primeiro caso — bastava apagar uma matéria e abrir o app
    // para ela voltar na hora, sem nem esperar o sync das 19h. Quem protege
    // exclusão agora são as lápides (sigaaTombstones), que a importação
    // respeita.
    const needsRecoveryImport = hasIncompleteMaterials(data);
    if (!needsRecoveryImport && lastImportAt && lastImportAt >= data.exportedAt) return null;

    const result = importSigaaData(data);
    storageAdapter.setItem(LAST_AUTO_IMPORT_KEY, data.exportedAt);
    return result;
  } catch (error) {
    // O auto-import era silencioso demais. Mantemos o fallback nulo, mas agora
    // registramos o erro bruto para descobrir em que etapa a sincronizacao falhou.
    console.error('[SIGAA auto-import] Falha ao importar automaticamente.', error);
    return null;
  }
}

export function getLastAutoImportAt(): string | null {
  return storageAdapter.getItem<string>(LAST_AUTO_IMPORT_KEY);
}
