import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { collegeStorageKeys, defaultCollegeData } from '../data/defaultCollegeData';
import { type CollegeTask } from '../types/task';
import { normalizeTaskDeadline } from '../utils/collegeCalculations';
import { todayKey } from '../utils/collegePeriod';

type CreateTaskInput = Omit<CollegeTask, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'priority'> & {
  priority?: CollegeTask['priority'];
  status?: CollegeTask['status'];
};
type UpdateTaskInput = Partial<Omit<CollegeTask, 'id' | 'createdAt'>>;

let memoryTasks: CollegeTask[] | null = null;

function readRawTasks() {
  return storageAdapter.getItem<CollegeTask[]>(collegeStorageKeys.tasks) ?? memoryTasks ?? defaultCollegeData.tasks;
}

function writeTasks(tasks: CollegeTask[]) {
  memoryTasks = tasks;
  storageAdapter.setItem(collegeStorageKeys.tasks, tasks);
}

function readTasks() {
  const today = todayKey();
  const rawTasks = readRawTasks();
  const normalizedTasks = rawTasks.map((task) => normalizeTaskDeadline(task, today));
  const changed = rawTasks.some((task, index) => task.status !== normalizedTasks[index].status);

  if (changed) {
    writeTasks(normalizedTasks);
  }

  return normalizedTasks;
}

export const taskService = {
  listTasks(): CollegeTask[] {
    return readTasks().sort((first, second) => first.dueDate.localeCompare(second.dueDate));
  },

  listTasksBySubject(subjectId: string): CollegeTask[] {
    return this.listTasks().filter((task) => task.subjectId === subjectId);
  },

  getTaskById(id: string): CollegeTask | null {
    return readTasks().find((task) => task.id === id) ?? null;
  },

  createTask(input: CreateTaskInput): CollegeTask {
    const now = new Date().toISOString();
    const title = input.title.trim();

    if (!title) {
      throw new Error('Informe o titulo da tarefa.');
    }

    if (!input.subjectId) {
      throw new Error('Escolha uma disciplina.');
    }

    if (!input.dueDate) {
      throw new Error('Informe o prazo.');
    }

    const task = normalizeTaskDeadline({
      ...input,
      createdAt: now,
      id: generateId(),
      priority: input.priority ?? 'medium',
      status: input.status ?? 'pending',
      title,
      updatedAt: now,
    });

    writeTasks([task, ...readTasks()]);
    return task;
  },

  updateTask(id: string, updates: UpdateTaskInput): CollegeTask | null {
    let updatedTask: CollegeTask | null = null;
    const tasks = readTasks().map((task) => {
      if (task.id !== id) {
        return task;
      }

      updatedTask = normalizeTaskDeadline({
        ...task,
        ...updates,
        createdAt: task.createdAt,
        id: task.id,
        title: updates.title?.trim() || task.title,
        updatedAt: new Date().toISOString(),
      });

      return updatedTask;
    });

    if (!updatedTask) {
      return null;
    }

    writeTasks(tasks);
    return updatedTask;
  },

  markTaskDone(id: string): CollegeTask | null {
    return this.updateTask(id, { status: 'done' });
  },

  reopenTask(id: string): CollegeTask | null {
    return this.updateTask(id, { status: 'pending' });
  },

  cancelTask(id: string): CollegeTask | null {
    return this.updateTask(id, { status: 'canceled' });
  },

  /** Remove todas as tarefas de uma disciplina. Retorna quantas saíram. */
  removeBySubject(subjectId: string): number {
    const tasks = readTasks();
    const remaining = tasks.filter((task) => task.subjectId !== subjectId);
    if (remaining.length === tasks.length) return 0;
    writeTasks(remaining);
    return tasks.length - remaining.length;
  },

  clearTasks(): void {
    memoryTasks = null;
    storageAdapter.removeItem(collegeStorageKeys.tasks);
  },
};
