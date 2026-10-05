import { type CollegeData } from '../types/college';

export const collegeStorageKeys = {
  assessments: 'college.assessments',
  grades: 'college.grades',
  materials: 'college.materials',
  subjects: 'college.subjects',
  tasks: 'college.tasks',
};

export const defaultCollegeData: CollegeData = {
  assessments: [],
  grades: [],
  materials: [],
  subjects: [],
  tasks: [],
};

export const defaultSubjectColors = [
  '#0284c7',
  '#16a34a',
  '#ca8a04',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
];

