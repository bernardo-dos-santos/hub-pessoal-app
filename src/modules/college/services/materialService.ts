import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { collegeStorageKeys, defaultCollegeData } from '../data/defaultCollegeData';
import { type Material } from '../types/material';

type CreateMaterialInput = Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'type'> & {
  type?: Material['type'];
};
type UpdateMaterialInput = Partial<Omit<Material, 'id' | 'createdAt'>>;

let memoryMaterials: Material[] | null = null;

function readMaterials() {
  return storageAdapter.getItem<Material[]>(collegeStorageKeys.materials) ?? memoryMaterials ?? defaultCollegeData.materials;
}

function writeMaterials(materials: Material[]) {
  memoryMaterials = materials;
  storageAdapter.setItem(collegeStorageKeys.materials, materials);
}

export function normalizeCollegeMaterialTags(tags?: string[]) {
  return [...new Set((tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean))];
}

function normalizeMaterialType(type?: Material['type']): Material['type'] {
  if (type === 'pdf_reference' || type === 'file_reference') {
    return 'pdf';
  }

  return type ?? 'note';
}

export const materialService = {
  listMaterials(): Material[] {
    return readMaterials();
  },

  listMaterialsBySubject(subjectId: string): Material[] {
    return readMaterials().filter((material) => material.subjectId === subjectId);
  },

  createMaterial(input: CreateMaterialInput): Material {
    const now = new Date().toISOString();
    const title = input.title.trim();

    if (!title) {
      throw new Error('Informe o titulo do material.');
    }

    const material: Material = {
      ...input,
      createdAt: now,
      id: generateId(),
      source: input.source ?? 'manual',
      tags: normalizeCollegeMaterialTags(input.tags),
      title,
      type: normalizeMaterialType(input.type),
      updatedAt: now,
    };

    writeMaterials([material, ...readMaterials()]);
    return material;
  },

  updateMaterial(id: string, updates: UpdateMaterialInput): Material | null {
    let updatedMaterial: Material | null = null;
    const materials = readMaterials().map((material) => {
      if (material.id !== id) {
        return material;
      }

      updatedMaterial = {
        ...material,
        ...updates,
        createdAt: material.createdAt,
        id: material.id,
        tags: updates.tags ? normalizeCollegeMaterialTags(updates.tags) : material.tags,
        title: updates.title?.trim() || material.title,
        type: normalizeMaterialType(updates.type ?? material.type),
        updatedAt: new Date().toISOString(),
      };

      return updatedMaterial;
    });

    if (!updatedMaterial) {
      return null;
    }

    writeMaterials(materials);
    return updatedMaterial;
  },

  removeMaterial(id: string): void {
    writeMaterials(readMaterials().filter((material) => material.id !== id));
  },

  /**
   * Remove todos os materiais de uma disciplina (anexos vão junto, pois ficam
   * embutidos no próprio material). Retorna quantos saíram.
   */
  removeBySubject(subjectId: string): number {
    const materials = readMaterials();
    const remaining = materials.filter((material) => material.subjectId !== subjectId);
    if (remaining.length === materials.length) return 0;
    writeMaterials(remaining);
    return materials.length - remaining.length;
  },

  clearMaterials(): void {
    memoryMaterials = null;
    storageAdapter.removeItem(collegeStorageKeys.materials);
  },
};
