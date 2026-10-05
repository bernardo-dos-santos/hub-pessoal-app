import { type Material, type MaterialType } from '../types/material';

export type CollegeMaterialFilters = {
  query?: string;
  subjectId?: string;
  type?: MaterialType | 'all';
};

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function sortCollegeMaterials(materials: Material[]) {
  return [...materials].sort((first, second) => {
    const dateComparison = second.updatedAt.localeCompare(first.updatedAt);

    return dateComparison || first.title.localeCompare(second.title);
  });
}

export function filterCollegeMaterials(materials: Material[], filters: CollegeMaterialFilters) {
  const query = normalizeSearchText(filters.query ?? '');

  return materials.filter((material) => {
    const matchesSubject = !filters.subjectId || filters.subjectId === 'all'
      || (filters.subjectId === 'general' ? !material.subjectId : material.subjectId === filters.subjectId);
    const matchesType = !filters.type || filters.type === 'all' || material.type === filters.type;
    const searchableText = normalizeSearchText([
      material.title,
      material.description,
      material.url,
      ...(material.tags ?? []),
    ].filter(Boolean).join(' '));
    const matchesQuery = !query || searchableText.includes(query);

    return matchesSubject && matchesType && matchesQuery;
  });
}
