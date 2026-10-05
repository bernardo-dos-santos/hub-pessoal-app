import { storageAdapter } from '../../../core/storage/storage.adapter';
import { type DayRoutine, type Routine, WEEK_DAYS, PLANNABLE_ACTIVITIES, type ActivityType } from '../types/routine';

const STORAGE_KEY = 'planner.routine';

function defaultRoutine(): Routine {
  const days: DayRoutine[] = WEEK_DAYS.map((day) => ({
    day,
    available: day !== 'sunday' && day !== 'saturday',
    blocks: day !== 'sunday' && day !== 'saturday'
      ? [{ start: '19:00', end: '21:00' }]
      : [],
    commitment: '',
  }));
  return { days, updatedAt: new Date().toISOString() };
}

export const routineService = {
  getRoutine(): Routine {
    const stored = storageAdapter.getItem<Routine>(STORAGE_KEY);
    if (!stored) return defaultRoutine();
    // migração: se o formato antigo (hours) ainda existir, converte
    const days = stored.days.map((d: DayRoutine & { hours?: number }) => {
      if (!d.blocks) {
        const h = d.hours ?? 2;
        return { ...d, blocks: d.available ? [{ start: '19:00', end: `${19 + h}:00` }] : [] };
      }
      return d;
    });
    return { ...stored, days };
  },

  saveRoutine(routine: Routine): void {
    storageAdapter.setItem(STORAGE_KEY, { ...routine, updatedAt: new Date().toISOString() });
  },

  hasRoutine(): boolean {
    return storageAdapter.getItem<Routine>(STORAGE_KEY) !== null;
  },

  getTotalWeeklyMinutes(): number {
    return this.getRoutine().days
      .filter((d) => d.available)
      .flatMap((d) => d.blocks.filter((b) => !b.activity || PLANNABLE_ACTIVITIES.has(b.activity as ActivityType)))
      .reduce((sum, b) => {
        const [sh, sm] = b.start.split(':').map(Number);
        const [eh, em] = b.end.split(':').map(Number);
        return sum + (eh * 60 + em) - (sh * 60 + sm);
      }, 0);
  },
};
