import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Select } from '../../../shared/ui';
import { subjectService } from '../../college/services/subjectService';
import { materialService } from '../../college/services/materialService';
import { isPdfMaterial, type StudySource } from '../services/studySourceService';
import { CBMSC_SUBJECTS } from '../data/cbmscSubjects';
import { ABIN_SUBJECTS } from '../data/abinSubjects';
import type { Material } from '../../college/types/material';

const LABEL_STYLE = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  color: 'var(--hub-subtle)',
};

/** Prefixos que distinguem disciplina da faculdade de tema de concurso no mesmo Select. */
const COLLEGE = 'college:';
const TAG = 'tag:';

/**
 * Matérias que os dois concursos compartilham (hoje só "Língua Portuguesa")
 * aparecem uma vez só, sob CBMSC.
 *
 * O valor guardado é a própria tag, então listar nos dois grupos criava duas
 * opções com o mesmo `value` — ambíguo para o Select e chave duplicada no React.
 * E é o mesmo material de estudo de qualquer forma: a tag não sabe de qual
 * concurso veio.
 */
const abinOnly = ABIN_SUBJECTS.filter((s) => !CBMSC_SUBJECTS.includes(s));

/**
 * Escolha de matéria e conteúdo, compartilhada pelas três telas de gerar.
 *
 * Substitui dois níveis inteiros de sub-aba. Antes a fonte era navegação —
 * Faculdade/Concurso e, dentro de Concurso, CBMSC/ABIN — o que produzia estados
 * impossíveis (Concurso + seleção de material) e obrigava a atravessar duas
 * réguas antes do primeiro campo. Agora é um campo só, com as disciplinas da
 * faculdade em cima porque é o uso principal do módulo, e divisores desabilitados
 * separando os grupos (mesmo padrão do seletor de tag do DeckListPage).
 *
 * Aceita `?tag=` para pré-seleção — é como a página da ABIN, o banco de questões
 * e a tela da disciplina entram aqui já com a matéria escolhida.
 */
export function StudySourcePicker({ onChange }: { onChange: (source: StudySource | null) => void }) {
  const [searchParams] = useSearchParams();
  const subjects = subjectService.listActiveSubjects();

  const initialTag = searchParams.get('tag') ?? '';
  const [selected, setSelected] = useState(() => {
    if (!initialTag) return '';
    const match = subjects.find((s) => s.name === initialTag);
    return match ? `${COLLEGE}${match.id}` : `${TAG}${initialTag}`;
  });

  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [text, setText] = useState('');

  const isCollege = selected.startsWith(COLLEGE);
  const subjectId = isCollege ? selected.slice(COLLEGE.length) : '';
  const subjectTag = isCollege
    ? subjects.find((s) => s.id === subjectId)?.name ?? ''
    : selected.slice(TAG.length);

  useEffect(() => {
    setMaterials(subjectId ? materialService.listMaterialsBySubject(subjectId) : []);
    setMaterialIds([]);
  }, [subjectId]);

  useEffect(() => {
    if (!selected) {
      onChange(null);
      return;
    }
    onChange(isCollege
      ? { kind: 'college', subjectId, subjectTag, materialIds, extraText: text }
      : { kind: 'tag', subjectTag, text });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, subjectId, subjectTag, materialIds.join(','), text]);

  function toggleMaterial(id: string) {
    setMaterialIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block" style={LABEL_STYLE}>Matéria</label>
        <Select value={selected} onChange={setSelected} className="w-full">
          <Select.Option value="">Selecione uma matéria…</Select.Option>

          {subjects.length > 0 && <Select.Option value="__g_college" disabled>— Faculdade —</Select.Option>}
          {subjects.map((s) => (
            <Select.Option key={s.id} value={`${COLLEGE}${s.id}`}>{s.name}</Select.Option>
          ))}

          <Select.Option value="__g_cbmsc" disabled>— Concurso · CBMSC —</Select.Option>
          {CBMSC_SUBJECTS.map((s) => (
            <Select.Option key={`cbmsc-${s}`} value={`${TAG}${s}`}>{s}</Select.Option>
          ))}

          <Select.Option value="__g_abin" disabled>— Concurso · ABIN —</Select.Option>
          {abinOnly.map((s) => (
            <Select.Option key={`abin-${s}`} value={`${TAG}${s}`}>{s}</Select.Option>
          ))}
        </Select>

        {subjects.length === 0 && (
          <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            Nenhuma disciplina ativa.{' '}
            <Link to="/faculdade" className="underline" style={{ color: 'var(--hub-accent)' }}>Cadastrar em Faculdade</Link>.
          </p>
        )}
      </div>

      {/* Materiais só existem para disciplina da faculdade — era exatamente o
          estado impossível que a régua Faculdade/Concurso deixava acontecer. */}
      {isCollege && subjectId && (
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
                  style={{ accentColor: 'var(--hub-accent)' }}
                />
                <span className="flex-1 text-sm" style={{ color: 'var(--hub-text)' }}>{material.title}</span>
                {isPdfMaterial(material) && (
                  <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'var(--hub-accent)' }}>PDF</span>
                )}
              </label>
            ))
          )}
        </div>
      )}

      {selected && (
        <div>
          <label className="mb-2 block" style={LABEL_STYLE}>
            {isCollege ? 'Texto complementar ' : 'Conteúdo'}
            {isCollege && <span style={{ color: 'var(--hub-disabled)' }}>(opcional)</span>}
          </label>
          <textarea
            rows={isCollege ? 4 : 7}
            placeholder={isCollege
              ? 'Cole anotações, trechos de aula ou qualquer texto adicional…'
              : 'Cole o texto do material de estudo…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full resize-y"
          />
        </div>
      )}
    </div>
  );
}
