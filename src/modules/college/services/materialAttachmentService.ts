import { generateId } from '../../../shared/utils/generateId';
import { type MaterialAttachment } from '../types/material';

const databaseName = 'hub-pessoal-college-attachments';
const databaseVersion = 1;
const storeName = 'material-attachments';

export const collegeMaterialAttachmentMaxSizeBytes = 20 * 1024 * 1024;

export const acceptedCollegeMaterialAttachmentTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

type MaterialAttachmentRecord = {
  blob: Blob;
  metadata: MaterialAttachment;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB nao esta disponivel neste navegador.'));
      return;
    }

    const request = window.indexedDB.open(databaseName, databaseVersion);

    request.onerror = () => reject(request.error ?? new Error('Nao foi possivel abrir o armazenamento local de anexos.'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'metadata.id' });
      }
    };
  });
}

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);

    request.onerror = () => reject(request.error ?? new Error('Falha ao acessar anexo local.'));
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Falha na transacao de anexo local.'));
    };
  });
}

function validateAttachmentFile(file: File) {
  if (file.size > collegeMaterialAttachmentMaxSizeBytes) {
    throw new Error('O arquivo precisa ter ate 20MB nesta versao.');
  }

  if (file.type && !acceptedCollegeMaterialAttachmentTypes.includes(file.type)) {
    throw new Error('Tipo de arquivo ainda nao suportado. Use PDF, imagem, texto ou documento.');
  }
}

export function formatAttachmentSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1).replace('.', ',')} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export const materialAttachmentService = {
  async saveAttachment(materialId: string, file: File): Promise<MaterialAttachment> {
    validateAttachmentFile(file);

    const metadata: MaterialAttachment = {
      createdAt: new Date().toISOString(),
      fileName: file.name,
      id: generateId(),
      materialId,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    };

    await withStore('readwrite', (store) => store.put({ blob: file, metadata }));

    return metadata;
  },

  async getAttachment(attachmentId: string): Promise<MaterialAttachmentRecord | null> {
    return (await withStore('readonly', (store) => store.get(attachmentId))) ?? null;
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    await withStore('readwrite', (store) => store.delete(attachmentId));
  },
};
