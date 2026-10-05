import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { collegeStorageKeys, defaultCollegeData } from '../data/defaultCollegeData';
import { type Grade } from '../types/grade';
import { calculateSimpleGradeAverage } from '../utils/collegeCalculations';

type CreateGradeInput = Omit<Grade, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateGradeInput = Partial<Omit<Grade, 'id' | 'createdAt'>>;

let memoryGrades: Grade[] | null = null;

function readGrades() {
  return storageAdapter.getItem<Grade[]>(collegeStorageKeys.grades) ?? memoryGrades ?? defaultCollegeData.grades;
}

function writeGrades(grades: Grade[]) {
  memoryGrades = grades;
  storageAdapter.setItem(collegeStorageKeys.grades, grades);
}

export const gradeService = {
  listGrades(): Grade[] {
    return readGrades().sort((first, second) => (second.date ?? '').localeCompare(first.date ?? ''));
  },

  listGradesBySubject(subjectId: string): Grade[] {
    return this.listGrades().filter((grade) => grade.subjectId === subjectId);
  },

  getAverageBySubject(subjectId: string): number | null {
    return calculateSimpleGradeAverage(this.listGradesBySubject(subjectId));
  },

  createGrade(input: CreateGradeInput): Grade {
    const now = new Date().toISOString();
    const title = input.title.trim();

    if (!title) {
      throw new Error('Informe o titulo da nota.');
    }

    if (!input.subjectId) {
      throw new Error('Escolha uma disciplina.');
    }

    if (!Number.isFinite(input.value)) {
      throw new Error('Informe uma nota valida.');
    }

    const grade: Grade = {
      ...input,
      createdAt: now,
      id: generateId(),
      title,
      updatedAt: now,
    };

    writeGrades([grade, ...readGrades()]);
    return grade;
  },

  updateGrade(id: string, updates: UpdateGradeInput): Grade | null {
    let updatedGrade: Grade | null = null;
    const grades = readGrades().map((grade) => {
      if (grade.id !== id) {
        return grade;
      }

      updatedGrade = {
        ...grade,
        ...updates,
        createdAt: grade.createdAt,
        id: grade.id,
        title: updates.title?.trim() || grade.title,
        updatedAt: new Date().toISOString(),
      };

      return updatedGrade;
    });

    if (!updatedGrade) {
      return null;
    }

    writeGrades(grades);
    return updatedGrade;
  },

  /** Remove todas as notas de uma disciplina. Retorna quantas saíram. */
  removeBySubject(subjectId: string): number {
    const grades = readGrades();
    const remaining = grades.filter((grade) => grade.subjectId !== subjectId);
    if (remaining.length === grades.length) return 0;
    writeGrades(remaining);
    return grades.length - remaining.length;
  },

  clearGrades(): void {
    memoryGrades = null;
    storageAdapter.removeItem(collegeStorageKeys.grades);
  },
};

