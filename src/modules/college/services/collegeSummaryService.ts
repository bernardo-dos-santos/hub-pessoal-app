import { assessmentService } from './assessmentService';
import { gradeService } from './gradeService';
import { materialService } from './materialService';
import { subjectService } from './subjectService';
import { taskService } from './taskService';
import { calculateCollegeSummary } from '../utils/collegeCalculations';
import { getCollegeUrgencyGroups } from '../utils/collegeUrgency';
import { getCurrentSemester } from '../utils/collegePeriod';

export const collegeSummaryService = {
  getCollegeSummary() {
    return calculateCollegeSummary({
      assessments: assessmentService.listAssessments(),
      currentSemester: getCurrentSemester(),
      subjects: subjectService.listSubjects(),
      tasks: taskService.listTasks(),
    });
  },

  getDashboardData() {
    const assessments = assessmentService.listAssessments();
    const tasks = taskService.listTasks();

    return {
      activeSubjects: subjectService.listActiveSubjects(),
      assessments,
      grades: gradeService.listGrades(),
      materials: materialService.listMaterials(),
      subjects: subjectService.listSubjects(),
      summary: this.getCollegeSummary(),
      tasks,
      urgencyGroups: getCollegeUrgencyGroups({ assessments, tasks }),
      upcomingAssessments: assessmentService.listUpcomingAssessments(5),
    };
  },
};
