import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { type BodyMetric } from '../types/body-metric';

const STORAGE_KEY = 'fitness.bodyMetrics';

export const bodyMetricService = {
  listMetrics(): BodyMetric[] {
    return (storageAdapter.getItem<BodyMetric[]>(STORAGE_KEY) ?? []).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  },

  create(input: Omit<BodyMetric, 'id'>): BodyMetric {
    const metric: BodyMetric = { ...input, id: generateId() };
    storageAdapter.setItem(STORAGE_KEY, [metric, ...this.listMetrics()]);
    return metric;
  },
};
