import { type DragEvent, type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import { ModuleHeader, Card, ProgressBar, Select } from '../../../shared/ui';
import { COLLEGE_TABS } from '../components/collegeTabs';
import { EmptyCollegeState } from '../components/EmptyCollegeState';
import { acceptedCollegeMaterialAttachmentTypes, collegeMaterialAttachmentMaxSizeBytes, formatAttachmentSize, materialAttachmentService } from '../services/materialAttachmentService';
import { materialService } from '../services/materialService';
import { subjectService } from '../services/subjectService';
import { type Material, type MaterialAttachment, type MaterialType } from '../types/material';
import { formatMaterialType } from '../utils/collegeFormatters';
import { filterCollegeMaterials, sortCollegeMaterials } from '../utils/collegeMaterialFilters';

type PageMode = 'single' | 'bulk';

type BulkFileDraft = {
  file: File;
  title: string;
  error?: string;
};

function guessTypeFromFile(file: File): MaterialType {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'other';
  const name = file.name.toLowerCase();
  if (name.includes('slide') || name.includes('aula')) return 'slide';
  if (name.includes('lista') || name.includes('exerc')) return 'exercise_list';
  return 'other';
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '');
}

type MaterialDraft = {
  description: string;
  subjectId: string;
  tags: string;
  title: string;
  type: Material['type'];
  url: string;
};

const materialTypes: Array<{ label: string; value: MaterialType }> = [
  { label: 'PDF externo', value: 'pdf' },
  { label: 'Link', value: 'link' },
  { label: 'Nota', value: 'note' },
  { label: 'Slide', value: 'slide' },
  { label: 'Lista de exercicios', value: 'exercise_list' },
  { label: 'Livro', value: 'book' },
  { label: 'Video', value: 'video' },
  { label: 'Outro', value: 'other' },
];

function createDraft(material?: Material): MaterialDraft {
  return {
    description: material?.description ?? '',
    subjectId: material?.subjectId ?? '',
    tags: material?.tags?.join(', ') ?? '',
    title: material?.title ?? '',
    type: material?.type ?? 'note',
    url: material?.url ?? '',
  };
}

export function MaterialsPage() {
  const subjects = subjectService.listSubjects();
  const [materials, setMaterials] = useState(() => materialService.listMaterials());
  const [mode, setMode] = useState<PageMode>('single');

  const [draft, setDraft] = useState(() => createDraft());
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [bulkDrafts, setBulkDrafts] = useState<BulkFileDraft[]>([]);
  const [bulkSubjectId, setBulkSubjectId] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const [queryFilter, setQueryFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<MaterialType | 'all'>('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const visibleMaterials = sortCollegeMaterials(filterCollegeMaterials(materials, {
    query: queryFilter,
    subjectId: subjectFilter,
    type: typeFilter,
  }));

  function refreshMaterials() {
    setMaterials(materialService.listMaterials());
  }

  function resetDraft() {
    setEditingMaterialId(null);
    setDraft(createDraft());
    setSelectedFile(null);
  }

  function addBulkFiles(files: File[]) {
    const valid = files.filter((f) => {
      if (f.size > collegeMaterialAttachmentMaxSizeBytes) return false;
      if (f.type && !acceptedCollegeMaterialAttachmentTypes.includes(f.type)) return false;
      return true;
    });
    const skipped = files.length - valid.length;
    if (skipped > 0) setError(`${skipped} arquivo${skipped === 1 ? '' : 's'} ignorado${skipped === 1 ? '' : 's'} (tipo ou tamanho nao suportado).`);
    else setError('');
    setBulkDrafts((prev) => [
      ...prev,
      ...valid.map((file) => ({ file, title: stripExtension(file.name) })),
    ]);
  }

  function handleDropzoneDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    addBulkFiles(Array.from(event.dataTransfer.files));
  }

  function handleBulkFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addBulkFiles(Array.from(event.target.files));
    event.target.value = '';
  }

  function removeBulkDraft(index: number) {
    setBulkDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBulkTitle(index: number, title: string) {
    setBulkDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, title } : d)));
  }

  async function saveBulkMaterials() {
    if (bulkDrafts.length === 0) return;
    setError('');
    setMessage('');
    const tags = bulkTags.split(',').map((t) => t.trim()).filter(Boolean);
    const total = bulkDrafts.length;
    setBulkProgress({ done: 0, total });
    let saved = 0;
    const remaining: BulkFileDraft[] = [];

    for (const bulkDraft of bulkDrafts) {
      try {
        const material = materialService.createMaterial({
          subjectId: bulkSubjectId || undefined,
          tags,
          title: bulkDraft.title.trim() || stripExtension(bulkDraft.file.name),
          type: guessTypeFromFile(bulkDraft.file),
        });
        const attachment = await materialAttachmentService.saveAttachment(material.id, bulkDraft.file);
        materialService.updateMaterial(material.id, { attachments: [attachment] });
        saved++;
        setBulkProgress({ done: saved, total });
      } catch (err) {
        remaining.push({ ...bulkDraft, error: err instanceof Error ? err.message : 'Erro ao salvar.' });
      }
    }

    refreshMaterials();
    setBulkProgress(null);
    setBulkDrafts(remaining);
    if (saved > 0) setMessage(`${saved} material${saved === 1 ? '' : 'is'} importado${saved === 1 ? '' : 's'} com sucesso.`);
    if (remaining.length > 0) setError(`${remaining.length} arquivo${remaining.length === 1 ? '' : 's'} com erro — verifique abaixo.`);
    else if (saved > 0) {
      setBulkSubjectId('');
      setBulkTags('');
    }
  }

  async function saveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const input = {
        description: draft.description.trim() || undefined,
        subjectId: draft.subjectId || undefined,
        tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        title: draft.title,
        type: draft.type,
        url: draft.url.trim() || undefined,
      };
      let savedMaterial: Material | null;

      if (editingMaterialId) {
        savedMaterial = materialService.updateMaterial(editingMaterialId, input);
        setMessage('Material atualizado.');
      } else {
        savedMaterial = materialService.createMaterial(input);
        setMessage('Material salvo.');
      }

      if (selectedFile && savedMaterial) {
        const attachment = await materialAttachmentService.saveAttachment(savedMaterial.id, selectedFile);
        savedMaterial = materialService.updateMaterial(savedMaterial.id, {
          attachments: [...(savedMaterial.attachments ?? []), attachment],
        });
        setMessage('Material salvo com anexo local.');
      }

      refreshMaterials();
      resetDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel salvar o material.');
    }
  }

  function startEditing(material: Material) {
    setEditingMaterialId(material.id);
    setDraft(createDraft(material));
    setSelectedFile(null);
    setMessage('');
    setError('');
  }

  async function openAttachment(attachment: MaterialAttachment) {
    setError('');
    try {
      const record = await materialAttachmentService.getAttachment(attachment.id);
      if (!record) { setError('Anexo local nao encontrado neste navegador.'); return; }
      const objectUrl = URL.createObjectURL(record.blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : 'Nao foi possivel abrir o anexo.');
    }
  }

  async function downloadAttachment(attachment: MaterialAttachment) {
    setError('');
    try {
      const record = await materialAttachmentService.getAttachment(attachment.id);
      if (!record) { setError('Anexo local nao encontrado neste navegador.'); return; }
      const objectUrl = URL.createObjectURL(record.blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : 'Nao foi possivel baixar o anexo.');
    }
  }

  async function removeAttachment(material: Material, attachment: MaterialAttachment) {
    setError('');
    try {
      await materialAttachmentService.deleteAttachment(attachment.id);
      materialService.updateMaterial(material.id, {
        attachments: material.attachments?.filter((item) => item.id !== attachment.id),
      });
      refreshMaterials();
      setMessage('Anexo removido.');
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : 'Nao foi possivel remover o anexo.');
    }
  }

  async function removeMaterial(material: Material) {
    setError('');
    try {
      await Promise.all((material.attachments ?? []).map((attachment) => materialAttachmentService.deleteAttachment(attachment.id)));
      materialService.removeMaterial(material.id);
      refreshMaterials();
      setMessage('Material removido.');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Nao foi possivel remover o material.');
    }
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Faculdade" title="Materiais" tabs={COLLEGE_TABS} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Links, notas, referencias e anexos locais. Arquivos ficam neste navegador/dispositivo, sem envio para servidor.
      </p>

      {message ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-positive)' }}>{message}</p> : null}
      {error ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.25fr)] xl:items-start">
        <Card className="xl:sticky xl:top-4">
          <div className="flex gap-1 mb-5">
            {(['single', 'bulk'] as PageMode[]).map((m) => (
              <button
                key={m}
                className="px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{
                  color: mode === m ? 'var(--hub-accent)' : 'var(--hub-subtle)',
                  background: 'none',
                  border: 'none',
                  borderBottom: `1px solid ${mode === m ? 'var(--hub-accent)' : 'transparent'}`,
                  cursor: 'pointer',
                }}
                type="button"
                onClick={() => { setMode(m); setMessage(''); setError(''); if (m === 'bulk') resetDraft(); }}
              >
                {m === 'single' ? 'Material único' : 'Importar em massa'}
              </button>
            ))}
          </div>

          {mode === 'bulk' ? (
            <div className="grid gap-5">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>Importar arquivos em massa</h3>
                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                  Selecione varios arquivos de uma vez. Cada um vira um material separado.
                </p>
              </div>
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 py-6 text-center transition-opacity hover:opacity-80"
                style={{
                  border: isDragOver ? '1px dashed var(--hub-accent)' : '1px dashed var(--hub-border-strong)',
                  borderRadius: '6px',
                }}
                onClick={() => bulkFileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDropzoneDrop}
              >
                <span className="text-2xl">📂</span>
                <p className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>Arraste arquivos ou clique para selecionar</p>
                <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>PDF, imagem, texto ou documento — ate 20 MB cada</p>
                <input ref={bulkFileInputRef} className="hidden" type="file" multiple accept=".pdf,image/*,.txt,.md,.doc,.docx" onChange={handleBulkFileInput} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Disciplina (todos)">
                  <Select className={selectClass} value={bulkSubjectId} onChange={setBulkSubjectId}>
                    <Select.Option value="">Geral</Select.Option>
                    {subjects.map((s) => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
                  </Select>
                </Field>
                <Field label="Tags (todos)">
                  <input className={inputClass} value={bulkTags} onChange={(e) => setBulkTags(e.target.value)} placeholder="aula, capitulo 3" />
                </Field>
              </div>
              {bulkDrafts.length > 0 && (
                <div className="grid gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
                    {bulkDrafts.length} arquivo{bulkDrafts.length === 1 ? '' : 's'} selecionado{bulkDrafts.length === 1 ? '' : 's'}
                  </span>
                  <div className="max-h-56 overflow-y-auto">
                    {bulkDrafts.map((bulkDraft, index) => (
                      <div
                        key={index}
                        className="grid gap-1 py-2"
                        style={{
                          borderBottom: index === bulkDrafts.length - 1 ? 'none' : '1px solid var(--hub-border)',
                          borderLeft: bulkDraft.error ? '2px solid var(--hub-negative)' : 'none',
                          paddingLeft: bulkDraft.error ? '8px' : '0',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            className={`${inputClass} flex-1`}
                            value={bulkDraft.title}
                            onChange={(e) => updateBulkTitle(index, e.target.value)}
                          />
                          <button
                            className="shrink-0 transition-opacity hover:opacity-70"
                            style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                            type="button"
                            onClick={() => removeBulkDraft(index)}
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                          {bulkDraft.file.name} / {formatAttachmentSize(bulkDraft.file.size)}
                        </p>
                        {bulkDraft.error && <p className="text-xs" style={{ color: 'var(--hub-negative)' }}>{bulkDraft.error}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {bulkProgress ? (
                <div className="grid gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>
                    Importando... {bulkProgress.done}/{bulkProgress.total}
                  </p>
                  <ProgressBar value={bulkProgress.done / bulkProgress.total} signal="accent" />
                </div>
              ) : (
                <button
                  className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-30"
                  style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                  type="button"
                  disabled={bulkDrafts.length === 0}
                  onClick={() => void saveBulkMaterials()}
                >
                  {bulkDrafts.length === 0 ? 'Selecione arquivos' : `Importar ${bulkDrafts.length} arquivo${bulkDrafts.length === 1 ? '' : 's'}`}
                </button>
              )}
            </div>
          ) : (
            <form className="grid gap-5" onSubmit={saveMaterial}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>
                  {editingMaterialId ? 'Editar material' : 'Salvar material'}
                </h3>
                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                  Guarde referencias, textos e anexos locais sem enviar arquivos para servidor.
                </p>
              </div>
              <Field label="Titulo">
                <input className={inputClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Apostila de grafos" />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Tipo">
                  <Select className={selectClass} value={draft.type} onChange={(value) => setDraft({ ...draft, type: value as Material['type'] })}>
                    <Select.Option value="link">Link</Select.Option>
                    <Select.Option value="note">Nota</Select.Option>
                    <Select.Option value="pdf">PDF externo</Select.Option>
                    <Select.Option value="slide">Slide</Select.Option>
                    <Select.Option value="exercise_list">Lista de exercicios</Select.Option>
                    <Select.Option value="book">Livro</Select.Option>
                    <Select.Option value="video">Video</Select.Option>
                    <Select.Option value="other">Outro</Select.Option>
                  </Select>
                </Field>
                <Field label="Disciplina">
                  <Select className={selectClass} value={draft.subjectId} onChange={(value) => setDraft({ ...draft, subjectId: value })}>
                    <Select.Option value="">Geral</Select.Option>
                    {subjects.map((subject) => <Select.Option key={subject.id} value={subject.id}>{subject.name}</Select.Option>)}
                  </Select>
                </Field>
              </div>
              <Field label="URL ou referencia">
                <input className={inputClass} value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://... ou caminho anotado" />
              </Field>
              <Field label="Tags">
                <input className={inputClass} value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="prova, capitulo 3, exercicios" />
                <span className="block text-xs leading-5 mt-1" style={{ color: 'var(--hub-subtle)' }}>
                  Separe por virgula. As tags ajudam na organizacao futura de pacotes de estudo.
                </span>
              </Field>
              <Field label="Descricao">
                <textarea className={`${inputClass} min-h-28 pt-1`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Resumo, pagina importante, observacoes" />
              </Field>
              <Field label="Anexo local">
                <input
                  className="block w-full text-sm"
                  style={{ color: 'var(--hub-muted)', background: 'none' }}
                  type="file"
                  accept=".pdf,image/*,.txt,.md,.doc,.docx,application/pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <span className="block text-xs leading-5 mt-1" style={{ color: 'var(--hub-subtle)' }}>
                  PDF, imagem, texto ou documento ate {formatAttachmentSize(collegeMaterialAttachmentMaxSizeBytes)}. O arquivo fica salvo localmente via IndexedDB.
                </span>
                {selectedFile ? (
                  <span className="block text-xs font-semibold mt-1" style={{ color: 'var(--hub-accent)' }}>
                    Selecionado: {selectedFile.name} / {formatAttachmentSize(selectedFile.size)}
                  </span>
                ) : null}
              </Field>
              <div className="flex items-center gap-5">
                <button
                  className="text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                  type="submit"
                >
                  {editingMaterialId ? 'Salvar material' : 'Adicionar material'}
                </button>
                {editingMaterialId ? <InlineButton label="Cancelar" onClick={resetDraft} /> : null}
              </div>
            </form>
          )}
        </Card>

        <div className="grid gap-5">
          <Card>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Disciplina">
                <Select className={selectClass} value={subjectFilter} onChange={setSubjectFilter}>
                  <Select.Option value="all">Todas</Select.Option>
                  <Select.Option value="general">Geral</Select.Option>
                  {subjects.map((subject) => <Select.Option key={subject.id} value={subject.id}>{subject.name}</Select.Option>)}
                </Select>
              </Field>
              <Field label="Tipo">
                <Select className={selectClass} value={typeFilter} onChange={(value) => setTypeFilter(value as MaterialType | 'all')}>
                  <Select.Option value="all">Todos</Select.Option>
                  {materialTypes.map((type) => <Select.Option key={type.value} value={type.value}>{type.label}</Select.Option>)}
                </Select>
              </Field>
              <Field label="Buscar">
                <input className={inputClass} value={queryFilter} onChange={(event) => setQueryFilter(event.target.value)} placeholder="titulo, tag ou observacao" />
              </Field>
            </div>

            <p className="mt-4 text-xs" style={{ color: 'var(--hub-subtle)' }}>
              {visibleMaterials.length} material{visibleMaterials.length === 1 ? '' : 's'} neste recorte
            </p>

            <p className="mt-2 text-xs leading-5" style={{ color: 'var(--hub-subtle)', borderLeft: '2px solid var(--hub-accent)', paddingLeft: '8px' }}>
              Anexos ficam locais neste navegador. No futuro podem apoiar pacotes de estudo, prompts, quizzes e flashcards.
              Limpar dados do navegador pode apagar anexos.
            </p>
          </Card>

          {visibleMaterials.length === 0 ? (
            <Card>
              <EmptyCollegeState
                title={materials.length === 0 ? 'Nenhum material salvo.' : 'Nenhum material neste recorte.'}
                description="Adicione ou ajuste filtros para encontrar links, anexos locais, listas e anotacoes por disciplina."
              />
            </Card>
          ) : (
            <Card>
              {visibleMaterials.map((material, i) => (
                <article key={material.id} className="py-3" style={{ borderBottom: i === visibleMaterials.length - 1 ? 'none' : '1px solid var(--hub-border)' }}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{material.title}</h3>
                      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                        {formatMaterialType(material.type)} / {material.subjectId ? subjectMap.get(material.subjectId)?.name ?? 'Disciplina removida' : 'Geral'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-3">
                      {material.url?.startsWith('http') ? (
                        <a
                          className="text-xs font-semibold transition-opacity hover:opacity-70"
                          style={{ color: 'var(--hub-accent)' }}
                          href={material.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir link
                        </a>
                      ) : null}
                      <InlineButton label="Editar" onClick={() => startEditing(material)} />
                      <InlineButton label="Remover" onClick={() => void removeMaterial(material)} />
                    </div>
                  </div>
                  {material.url && !material.url.startsWith('sigaa://') ? (
                    material.url.startsWith('http') ? (
                      <a
                        className="mt-1 block break-all text-xs transition-opacity hover:opacity-70"
                        style={{ color: 'var(--hub-subtle)' }}
                        href={material.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {material.url}
                      </a>
                    ) : (
                      <p className="mt-1 break-all text-xs" style={{ color: 'var(--hub-subtle)' }}>{material.url}</p>
                    )
                  ) : null}
                  {material.description ? (
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{material.description}</p>
                  ) : null}
                  {material.attachments?.length ? (
                    <div className="mt-3 grid gap-1" style={{ borderLeft: '2px solid var(--hub-accent)', paddingLeft: '10px' }}>
                      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
                        Anexos locais
                      </span>
                      {material.attachments.map((attachment, ai) => (
                        <div key={attachment.id} className="py-2" style={{ borderBottom: ai === material.attachments!.length - 1 ? 'none' : '1px solid var(--hub-border)' }}>
                          <p className="break-all text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{attachment.fileName}</p>
                          <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                            {attachment.mimeType} / {formatAttachmentSize(attachment.sizeBytes)}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-3">
                            <InlineButton label="Abrir" onClick={() => void openAttachment(attachment)} />
                            <InlineButton label="Baixar" onClick={() => void downloadAttachment(attachment)} />
                            <InlineButton label="Remover anexo" onClick={() => void removeAttachment(material, attachment)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {material.tags?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {material.tags.map((tag) => (
                        <span key={tag} className="text-xs font-medium" style={{ color: 'var(--hub-subtle)' }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass = 'w-full bg-transparent pb-1.5 text-sm outline-none';
const selectClass = 'w-full bg-transparent pb-1.5 text-sm outline-none cursor-pointer appearance-none';

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="space-y-2">
      <span className="block text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function InlineButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button
      className="text-xs transition-opacity hover:opacity-70"
      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
