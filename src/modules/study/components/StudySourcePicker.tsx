import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Select } from '../../../shared/ui';
import { subjectService } from '../../college/services/subjectService';
import { materialService } from '../../college/services/materialService';
import { isPdfMaterial, type StudySource } from '../services/studySourceService';
import type { Material } from '../../college/types/material';

const LABEL_STYLE = {
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  color: 'var(--hub-subtle)',
};

/**
 * Escolha de disciplina e conteúdo, compartilhada pelas três telas de gerar.
 *
 * Aceita `?tag=` (nome da disciplina) para pré-seleção — é como o banco de
 * questões e a tela da disciplina entram aqui já com a matéria escolhida.
 */
export function StudySourcePicker({ onChange }: { onChange: (source: StudySource | null) => void }) {
  const [searchParams] = useSearchParams();
  const subjects = subjectService.listActiveSubjects();

  const initialTag = searchParams.get('tag') ?? '';
  const [subjectId, setSubjectId] = useState(
    () => subjects.find((s) => s.name === initialTag)?.id ?? '',
  );

  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [text, setText] = useState('');

  const subjectTag = subjects.find((s) => s.id === subjectId)?.name ?? '';

  useEffect(() => {
    setMaterials(subjectId ? materialService.listMaterialsBySubject(subjectId) : []);
    setMaterialIds([]);
  }, [subjectId]);

  useEffect(() => {
    onChange(subjectId ? { subjectId, subjectTag, materialIds, extraText: text } : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, subjectTag, materialIds.join(','), text]);

  function toggleMaterial(id: string) {
    setMaterialIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block" style={LABEL_STYLE}>Matéria</label>
        <Select value={subjectId} onChange={setSubjectId} className="w-full">
          <Select.Option value="">Selecione uma matéria…</Select.Option>
          {subjects.map((s) => (
            <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
          ))}
        </Select>

        {subjects.length === 0 && (
          <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            Nenhuma disciplina ativa.{' '}
            <Link to="/faculdade" className="underline" style={{ color: 'var(--hub-accent)' }}>Cadastrar em Faculdade</Link>.
          </p>
        )}
      </div>

      {subjectId && (
        <div>
          <label className="mb-2 block" style={LABEL_STYLE}>Materiais</label>
          {materials.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Nenhum material nesta disciplina.</p>
          ) : (
            materials.map((material) => (
              <label
                key={material.id}
                className="flex cursor-pointer items-start gap-3 py-2"
                style={{ borderBottom: '1px solid var(--hub-border)' }}
              >
                <input
                  type="checkbox"
                  checked={materialIds.includes(material.id)}
                  onChange={() => toggleMaterial(material.id)}
                  className="mt-0.5"
                />
                <span className="flex-1 text-sm" style={{ color: 'var(--hub-text)' }}>{material.title}</span>
                {isPdfMaterial(material) && (
                  <span className="shrink-0 text-[11px] font-semibold" style={{ color: 'var(--hub-accent)' }}>PDF</span>
                )}
              </label>
            ))
          )}
        </div>
      )}

      {subjectId && (
        <div>
          <label className="mb-2 block" style={LABEL_STYLE}>
            Texto complementar <span style={{ color: 'var(--hub-disabled)' }}>(opcional)</span>
          </label>
          <textarea
            rows={4}
            placeholder="Cole anotações, trechos de aula ou qualquer texto adicional…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full resize-y"
          />
        </div>
      )}
    </div>
  );
}
