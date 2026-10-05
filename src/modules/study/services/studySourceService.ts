import { materialService } from '../../college/services/materialService';
import { aiConfig } from '../../../core/ai/aiConfig';
import { pdfTextService } from './pdfTextService';
import type { Material } from '../../college/types/material';

/**
 * De onde sai o texto que alimenta a IA.
 *
 * `college` monta o texto a partir dos materiais do SIGAA da disciplina; `tag`
 * é o caminho de concurso (e de qualquer tema livre), onde o próprio usuário
 * cola o conteúdo. Antes essa escolha era um nível de aba — na verdade sempre
 * foi um campo do formulário.
 */
export type StudySource =
  | { kind: 'college'; subjectId: string; subjectTag: string; materialIds: string[]; extraText: string }
  | { kind: 'tag'; subjectTag: string; text: string };

export function isPdfMaterial(material: Material): boolean {
  return material.type === 'pdf' || material.type === 'pdf_reference';
}

/** Materiais do SIGAA guardam o texto extraído sob a chave do próprio arquivo. */
function pdfTextKey(material: Material): string {
  return material.url?.startsWith('sigaa://') ? material.url.slice('sigaa://'.length) : material.id;
}

export const studySourceService = {
  /** Há conteúdo suficiente para valer uma chamada de IA? */
  hasContent(source: StudySource | null): boolean {
    if (!source) return false;
    if (source.kind === 'tag') return source.subjectTag.trim() !== '' && source.text.trim() !== '';
    return source.subjectId !== '' && (source.materialIds.length > 0 || source.extraText.trim() !== '');
  },

  /**
   * Monta o texto final. `onProgress` existe porque carregar PDF é lento o
   * bastante para a tela precisar dizer em qual material está.
   */
  async buildText(source: StudySource, onProgress?: (status: string) => void): Promise<string> {
    if (source.kind === 'tag') return source.text.trim();

    // Modelo local engasga com contexto grande; os de nuvem aguentam ordens de
    // magnitude a mais. O corte segue o provedor do primeiro slot da cadeia, que
    // é o que provavelmente vai atender.
    const charsPerMaterial = (await aiConfig.getLikelyProvider()) === 'ollama' ? 4_000 : 400_000;
    const materials = materialService.listMaterialsBySubject(source.subjectId);
    const selected = source.materialIds
      .map((id) => materials.find((m) => m.id === id))
      .filter((m): m is Material => m !== undefined);

    const parts: string[] = [];
    const pdfs = selected.filter(isPdfMaterial);

    for (let i = 0; i < pdfs.length; i++) {
      const material = pdfs[i];
      onProgress?.(`Carregando material ${i + 1} de ${pdfs.length}: ${material.title}…`);
      const raw = await pdfTextService.getText(pdfTextKey(material));
      if (raw) {
        const trimmed = raw.length > charsPerMaterial
          ? `${raw.slice(0, charsPerMaterial)}\n[... conteúdo truncado para caber no contexto]`
          : raw;
        parts.push(`=== ${material.title} ===\n${trimmed}`);
      } else {
        const fallback = [material.title, material.description].filter(Boolean).join(': ');
        if (fallback) parts.push(`=== ${material.title} ===\n(texto não disponível — apenas metadados: ${fallback})`);
      }
    }

    for (const material of selected.filter((m) => !isPdfMaterial(m))) {
      const fallback = [material.title, material.description].filter(Boolean).join(': ');
      if (fallback) parts.push(fallback);
    }

    if (source.extraText.trim()) parts.push(source.extraText.trim());
    return parts.join('\n\n');
  },
};
