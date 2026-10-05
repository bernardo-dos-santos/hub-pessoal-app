import { assessmentService } from './assessmentService';
import { gradeService } from './gradeService';
import { materialService } from './materialService';
import { subjectService } from './subjectService';
import { taskService } from './taskService';
import { getCollegeStudyOverview } from '../utils/collegeStudy';

export const collegeStudyService = {
  getOverview(subjectId: string) {
    return getCollegeStudyOverview({
      assessments: assessmentService.listAssessments(),
      grades: gradeService.listGrades(),
      materials: materialService.listMaterials(),
      subjectId,
      subjects: subjectService.listSubjects(),
      tasks: taskService.listTasks(),
    });
  },
};
