export interface RecordingMeta {
  id: string; startedAt: number; durationMs: number; bytes: number; mimeType: string; audio: boolean;
  protected: boolean; interrupted: boolean; walkId: string;
}
export interface RecordingLimits { maxClips: number; maxBytes: number }
export const DEFAULT_RECORDING_LIMITS: RecordingLimits = { maxClips: 50, maxBytes: 2_500_000_000 };
export interface RecordingStorage {
  list(): Promise<RecordingMeta[]>;
  getBlob(id: string): Promise<Blob | undefined>;
  commit(meta: RecordingMeta, blob: Blob, limits: RecordingLimits): Promise<void>;
  protect(id: string, protect: boolean): Promise<void>;
  remove(ids: string[], allowProtected?: boolean): Promise<void>;
}
export function retentionRemovals(existing: RecordingMeta[], incoming: RecordingMeta, limits: RecordingLimits): string[] {
  if (!Number.isInteger(limits.maxClips) || limits.maxClips < 1 || !Number.isFinite(limits.maxBytes) || limits.maxBytes < 1) throw new Error('Invalid recording storage limit.');
  if (incoming.bytes > limits.maxBytes) throw new Error('This clip exceeds the recording storage limit. Increase the limit or use shorter clips.');
  if (existing.some(c => c.id === incoming.id)) throw new Error('This recording has already been saved.');
  let count = existing.length + 1, bytes = existing.reduce((n, c) => n + c.bytes, incoming.bytes);
  const remove: string[] = [];
  for (const clip of [...existing].filter(c => !c.protected).sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))) {
    if (count <= limits.maxClips && bytes <= limits.maxBytes) break;
    remove.push(clip.id); count--; bytes -= clip.bytes;
  }
  if (count > limits.maxClips || bytes > limits.maxBytes) throw new Error('Protected recordings fill the storage limit. Export or remove a protected clip before recording.');
  return remove;
}
const request = <T>(r: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error ?? new Error('Recording storage unavailable.'));
});
const completed = (tx: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not save recording.'));
});
/** Separate metadata avoids loading every video Blob just to display the library. */
export class IndexedRecordingStorage implements RecordingStorage {
  private opening: Promise<IDBDatabase> | null = null;
  private database(): Promise<IDBDatabase> {
    if (this.opening) return this.opening;
    this.opening = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) { reject(new Error('Video storage is unavailable in this browser.')); return; }
      const open = indexedDB.open('crosswise_recordings_v1', 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('metadata', { keyPath: 'id' });
        open.result.createObjectStore('blobs');
      };
      open.onerror = () => { this.opening = null; reject(new Error('Could not open recording storage. Allow device storage and try again.')); };
      open.onblocked = () => { this.opening = null; reject(new Error('Close other CrossWise tabs and retry recording storage.')); };
      open.onsuccess = () => {
        open.result.onversionchange = () => { open.result.close(); this.opening = null; };
        resolve(open.result);
      };
    });
    return this.opening;
  }
  async list(): Promise<RecordingMeta[]> {
    const db = await this.database();
    const result = await request<RecordingMeta[]>(db.transaction('metadata').objectStore('metadata').getAll());
    return result.sort((a, b) => b.startedAt - a.startedAt);
  }
  async getBlob(id: string): Promise<Blob | undefined> {
    const db = await this.database();
    return request(db.transaction('blobs').objectStore('blobs').get(id));
  }
  async commit(meta: RecordingMeta, blob: Blob, limits: RecordingLimits): Promise<void> {
    const db = await this.database(), tx = db.transaction(['metadata', 'blobs'], 'readwrite');
    const done = completed(tx);
    try {
      const existing = await request<RecordingMeta[]>(tx.objectStore('metadata').getAll());
      for (const id of retentionRemovals(existing, meta, limits)) {
        tx.objectStore('metadata').delete(id); tx.objectStore('blobs').delete(id);
      }
      tx.objectStore('metadata').add(meta); tx.objectStore('blobs').add(blob, meta.id);
      await done;
    } catch (e) {
      try { tx.abort(); } catch { /* The failed transaction may already have aborted. */ }
      await done.catch(() => undefined);
      if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new Error('Device storage is full. This clip was not saved. Export or delete recordings, then try again.');
      throw e;
    }
  }
  async protect(id: string, protect: boolean): Promise<void> {
    const db = await this.database(), tx = db.transaction('metadata', 'readwrite'), done = completed(tx);
    const meta = await request<RecordingMeta | undefined>(tx.objectStore('metadata').get(id));
    if (meta) tx.objectStore('metadata').put({ ...meta, protected: protect });
    await done;
    if (!meta) throw new Error('Recording no longer exists. Refresh the library.');
  }
  async remove(ids: string[], allowProtected = false): Promise<void> {
    const db = await this.database(), tx = db.transaction(['metadata', 'blobs'], 'readwrite'), done = completed(tx);
    try {
      const all = await request<RecordingMeta[]>(tx.objectStore('metadata').getAll());
      if (!allowProtected && all.some(c => ids.includes(c.id) && c.protected)) throw new Error('A selected clip is protected. Confirm protected deletion or choose other clips.');
      for (const id of ids) { tx.objectStore('metadata').delete(id); tx.objectStore('blobs').delete(id); }
      await done;
    } catch (e) {
      try { tx.abort(); } catch { /* Already aborted. */ }
      await done.catch(() => undefined); throw e;
    }
  }
}
export const recordingStorage = new IndexedRecordingStorage();
