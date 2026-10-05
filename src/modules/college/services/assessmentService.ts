import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { collegeStorageKeys, defaultCollegeData } from '../data/defaultCollegeData';
import { type Assessment } from '../types/assessment';
import { listUpcomingAssessments } from '../utils/collegeCalculations';

type CreateAssessmentInput = Omit<Assessment, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'type'> & {
  status?: Assessment['status'];
  type?: Assessment['type'];
};
type UpdateAssessmentInput = Partial<Omit<Assessment, 'id' | 'createdAt'>>;

let memoryAssessments: Assessment[] | null = null;

function readAssessments() {
  return storageAdapter.getItem<Assessment[]>(collegeStorageKeys.assessments) ?? memoryAssessments ?? defaultCollegeData.assessments;
}

function writeAssessments(assessments: Assessment[]) {
  memoryAssessments = assessments;
  storageAdapter.setItem(collegeStorageKeys.assessments, assessments);
}

export const assessmentService = {
  listAssessments(): Assessment[] {
    return readAssessments().sort((first, second) => first.date.localeCompare(second.date));
  },

  listUpcomingAssessments(limit = 5): Assessment[] {
    return listUpcomingAssessments(readAssessments(), undefined, limit);
  },

  getAssessmentById(id: string): Assessment | null {
    return readAssessments().find((assessment) => assessment.id === id) ?? null;
  },

  createAssessment(input: CreateAssessmentInput): Assessment {
    const now = new Date().toISOString();
    const title = input.title.trim();

    if (!title) {
      throw new Error('Informe o titulo da avaliacao.');
    }

    if (!input.subjectId) {
      throw new Error('Escolha uma disciplina.');
    }

    if (!input.date) {
      throw new Error('Informe a data.');
    }

    const assessment: Assessment = {
      ...input,
      createdAt: now,
      id: generateId(),
      status: input.status ?? 'scheduled',
      title,
      type: input.type ?? 'exam',
      updatedAt: now,
    };

    writeAssessments([assessment, ...readAssessments()]);
    return assessment;
  },

  updateAssessment(id: string, updates: UpdateAssessmentInput): Assessment | null {
    let updatedAssessment: Assessment | null = null;
    const assessments = readAssessments().map((assessment) => {
      if (assessment.id !== id) {
        return assessment;
      }

      updatedAssessment = {
        ...assessment,
        ...updates,
        createdAt: assessment.createdAt,
        id: assessment.id,
        title: updates.title?.trim() || assessment.title,
        updatedAt: new Date().toISOString(),
      };

      return updatedAssessment;
    });

    if (!updatedAssessment) {
      return null;
    }

    writeAssessments(assessments);
    return updatedAssessment;
  },

  markAssessmentCompleted(id: string, grade?: number): Assessment | null {
    return this.updateAssessment(id, { grade, status: 'completed' });
  },

  markAssessmentMissed(id: string): Assessment | null {
    return this.updateAssessment(id, { status: 'missed' });
  },

  reopenAssessment(id: string): Assessment | null {
    return this.updateAssessment(id, { status: 'scheduled' });
  },

  /** Remove todas as avaliações de uma disciplina. Retorna quantas saíram. */
  removeBySubject(subjectId: string): number {
    const assessments = readAssessments();
    const remaining = assessments.filter((assessment) => assessment.subjectId !== subjectId);
    if (remaining.length === assessments.length) return 0;
    writeAssessments(remaining);
    return assessments.length - remaining.length;
  },

  clearAssessments(): void {
    memoryAssessments = null;
    storageAdapter.removeItem(collegeStorageKeys.assessments);
  },
};
