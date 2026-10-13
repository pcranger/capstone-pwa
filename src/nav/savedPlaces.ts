import AsyncStorage from '../platform/storage';
import { Store } from '../state/store';
import type { GeoPoint, PlaceCandidate } from './navigation';

/** Provider content is refreshed; only user labels and user-authored endpoints persist. */
export interface SavedPlace {
  placeId: string; savedAt: number; alias?: string; queryLabel?: string;
  kind?: 'provider' | 'coordinate'; role?: 'home' | 'destination'; point?: GeoPoint; updatedAt?: number;
}
interface SavedState { status: 'loading' | 'ready' | 'error'; items: SavedPlace[]; busy: boolean; error: string | null; undo: SavedPlace | null }
export const SAVED_PLACES_KEY = 'crosswise_saved_places_v1';
export const SAVED_PLACES_V2_KEY = 'crosswise_saved_places_v2';
export const DESTINATION_CAPACITY = 100;
export const normalizedName = (s: string) => s.trim().normalize('NFKC').toLocaleLowerCase('en-AU');
const order = (items: SavedPlace[]) => [...items].sort((a, b) => b.savedAt - a.savedAt || a.placeId.localeCompare(b.placeId));
const label = (value?: string) => value?.trim().slice(0, 160) || undefined;
const validCoordinate = (p: GeoPoint) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
const newId = () => `local:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
export function parseSavedPlacesV2(value: unknown): SavedPlace[] {
  const data = value as { version: number; items: SavedPlace[] };
  if (!data || data.version !== 2 || !Array.isArray(data.items)) throw new Error('Invalid saved data');
  const ids = new Set<string>(); let homes = 0;
  return data.items.map(p => {
    if (!p || typeof p.placeId !== 'string' || !p.placeId || p.placeId.length > 512 ||
        !Number.isFinite(p.savedAt) || p.savedAt < 0 || ids.has(p.placeId) ||
        (p.alias !== undefined && typeof p.alias !== 'string') || (p.queryLabel !== undefined && typeof p.queryLabel !== 'string') ||
        (p.kind !== undefined && !['provider', 'coordinate'].includes(p.kind)) ||
        (p.role !== undefined && !['home', 'destination'].includes(p.role)) ||
        (p.point !== undefined && !validCoordinate(p.point)) || (p.kind === 'coordinate' && !p.point) ||
        (p.updatedAt !== undefined && (!Number.isFinite(p.updatedAt) || p.updatedAt < 0))) throw new Error('Invalid saved data');
    ids.add(p.placeId); if (p.role === 'home' && ++homes > 1) throw new Error('Multiple Home records');
    return { placeId: p.placeId, savedAt: p.savedAt, alias: label(p.alias), queryLabel: label(p.queryLabel), kind: p.kind ?? 'provider', role: p.role ?? 'destination', ...(p.point ? { point: { latitude: p.point.latitude, longitude: p.point.longitude } } : {}), updatedAt: p.updatedAt ?? p.savedAt };
  });
}
export function validateSavedPlacesV2(value: unknown): boolean { try { parseSavedPlacesV2(value); return true; } catch { return false; } }
export function savedPlaceCandidate(entry: SavedPlace): PlaceCandidate | null {
  if (!entry.point || !validCoordinate(entry.point)) return null;
  return { id: entry.placeId, name: entry.alias || entry.queryLabel || (entry.role === 'home' ? 'Home' : 'Saved destination'),
    address: 'User-selected location', point: { ...entry.point }, endpoint: 'coordinate' };
}
export class SavedPlacesRepository {
  readonly state = new Store<SavedState>({ status: 'loading', items: [], busy: false, error: null, undo: null });
  private chain: Promise<unknown> = Promise.resolve();
  private loading: Promise<void> | null = null;
  constructor(private storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'> = AsyncStorage, private now = Date.now) {}
  get home(): SavedPlace | undefined { return this.state.value.items.find(p => p.role === 'home'); }
  getCandidate(id: string): PlaceCandidate | null { const p = this.state.value.items.find(p => p.placeId === id); return p ? savedPlaceCandidate(p) : null; }
  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.state.update(s => ({ ...s, status: 'loading', error: null }));
    this.loading = (async () => {
      try {
        const current = await this.storage.getItem(SAVED_PLACES_V2_KEY);
        const legacy = current === null ? await this.storage.getItem(SAVED_PLACES_KEY) : null;
        const data = current ? JSON.parse(current) : legacy ? JSON.parse(legacy) : { version: 1, items: [] };
        if ((current !== null ? data.version !== 2 : data.version !== 1) || !Array.isArray(data.items)) throw new Error('Invalid saved data');
        const items = parseSavedPlacesV2({ ...data, version: 2 });
        if (legacy && items.filter(p => normalizedName(p.alias ?? '') === 'home').length === 1) items.find(p => normalizedName(p.alias ?? '') === 'home')!.role = 'home';
        // Commit v2 separately; keep the legacy data intact for rollback.
        if (legacy) await this.storage.setItem(SAVED_PLACES_V2_KEY, JSON.stringify({ version: 2, items }));
        this.state.set({ status: 'ready', items: order(items), busy: false, error: null, undo: null });
      } catch { this.state.update(s => ({ ...s, status: 'error', error: 'Saved places unavailable. Retry loading.' })); }
      finally { this.loading = null; }
    })(); return this.loading;
  }
  private mutate<T>(change: (s: SavedState) => { items: SavedPlace[]; undo: SavedPlace | null; result: T }): Promise<T> {
    const operation = this.chain.then(async () => {
      if (this.state.value.status !== 'ready') throw new Error('Saved places unavailable. Retry loading.');
      this.state.update(s => ({ ...s, busy: true, error: null }));
      try {
        const next = change(this.state.value);
        await this.storage.setItem(SAVED_PLACES_V2_KEY, JSON.stringify({ version: 2, items: next.items }));
        this.state.update(s => ({ ...s, items: order(next.items), undo: next.undo, busy: false })); return next.result;
      } catch (e) {
        const message = e instanceof PlaceError ? e.message : 'Couldn’t save changes. Try again.';
        this.state.update(s => ({ ...s, busy: false, error: message })); throw new Error(message);
      }
    }); this.chain = operation.catch(() => undefined); return operation;
  }
  private checkName(items: SavedPlace[], id: string, alias?: string): void {
    if (alias && items.some(p => p.placeId !== id && p.alias && normalizedName(p.alias) === normalizedName(alias))) throw new PlaceError('That name is already saved. Choose another name.');
  }
  save(placeId: string, queryLabel?: string, alias?: string): Promise<'saved' | 'already'> {
    return this.mutate(s => {
      if (!placeId || placeId.length > 512 || placeId.startsWith('local:')) throw new PlaceError('Invalid provider place.');
      const cleanAlias = label(alias); this.checkName(s.items, placeId, cleanAlias);
      const existing = s.items.find(p => p.placeId === placeId);
      if (existing) return { items: s.items.map(p => p.placeId === placeId && cleanAlias ? { ...p, alias: cleanAlias, updatedAt: this.now() } : p), undo: s.undo, result: 'already' };
      if (s.items.filter(p => p.role !== 'home').length >= DESTINATION_CAPACITY) throw new PlaceError('100 destinations are registered. Delete a destination before adding another.');
      const savedAt = s.items.reduce((latest, p) => Math.max(latest, p.savedAt + 1), this.now());
      return { items: [{ placeId, savedAt, updatedAt: savedAt, kind: 'provider', role: 'destination', alias: cleanAlias, queryLabel: label(queryLabel) }, ...s.items], undo: s.undo, result: 'saved' };
    });
  }
  saveCoordinate(point: GeoPoint, alias: string, role: 'home' | 'destination' = 'destination', id = newId()): Promise<string> {
    return this.mutate(s => {
      if (!validCoordinate(point) || !label(alias) || !id || id.length > 512 || !['home','destination'].includes(role)) throw new PlaceError('Enter a name and valid coordinates.');
      this.checkName(role === 'home' ? s.items.filter(p => p.role !== 'home') : s.items, id, label(alias));
      const existing = s.items.find(p => p.placeId === id);
      if (!existing && role !== 'home' && s.items.filter(p => p.role !== 'home').length >= DESTINATION_CAPACITY) throw new PlaceError('100 destinations are registered. Delete a destination before adding another.');
      const savedAt = existing?.savedAt ?? s.items.reduce((latest, p) => Math.max(latest, p.savedAt + 1), this.now());
      const next: SavedPlace = { placeId: id, savedAt, updatedAt: this.now(), alias: label(alias), kind: existing?.kind ?? 'coordinate', role, point: { latitude: point.latitude, longitude: point.longitude }, queryLabel: existing?.queryLabel };
      return { items: [next, ...s.items.filter(p => p.placeId !== id && !(role === 'home' && p.role === 'home'))], undo: s.undo, result: id };
    });
  }
  setHome(placeId: string, userLabel = 'Home'): Promise<void> {
    return this.mutate(s => {
      if (!s.items.some(p => p.placeId === placeId)) throw new PlaceError('Destination is no longer registered.');
      if (!label(userLabel)) throw new PlaceError('Enter a Home name.');
      this.checkName(s.items.filter(p => p.role !== 'home'), placeId, label(userLabel));
      return { items: s.items.filter(p => p.role !== 'home' || p.placeId === placeId).map(p => p.placeId === placeId ? { ...p, alias: label(userLabel), role: 'home', updatedAt: this.now() } : p), undo: s.undo, result: undefined };
    });
  }
  saveProviderHome(placeId: string, alias = 'Home'): Promise<string> {
    return this.mutate(s => {
      if (!placeId || placeId.length > 512 || placeId.startsWith('local:') || !label(alias)) throw new PlaceError('Invalid Home.');
      const existing = s.items.find(p => p.placeId === placeId);
      this.checkName(s.items.filter(p => p.role !== 'home'), placeId, label(alias));
      const next: SavedPlace = { ...existing, placeId, savedAt: existing?.savedAt ?? this.now(), updatedAt: this.now(), alias: label(alias), kind: 'provider', role: 'home' };
      return { items: [next, ...s.items.filter(p => p.placeId !== placeId && p.role !== 'home')], undo: s.undo, result: placeId };
    });
  }
  rename(placeId: string, alias: string): Promise<void> {
    return this.mutate(s => {
      const clean = label(alias); if (!clean) throw new PlaceError('Enter a destination name.'); this.checkName(s.items, placeId, clean);
      if (!s.items.some(p => p.placeId === placeId)) throw new PlaceError('Destination is no longer registered.');
      return { items: s.items.map(p => p.placeId === placeId ? { ...p, alias: clean, updatedAt: this.now() } : p), undo: s.undo, result: undefined };
    });
  }
  remove(placeId: string): Promise<void> { return this.mutate(s => ({ items: s.items.filter(p => p.placeId !== placeId), undo: s.items.find(p => p.placeId === placeId) ?? s.undo, result: undefined })); }
  undo(): Promise<void> {
    return this.mutate(s => {
      const p = s.undo;
      if (!p || s.items.some(i => i.placeId === p.placeId)) return { items: s.items, undo: null, result: undefined };
      this.checkName(s.items, p.placeId, p.alias);
      if (p.role === 'home' && s.items.some(i => i.role === 'home')) throw new PlaceError('Another Home is registered. Remove it before restoring this Home.');
      if (p.role !== 'home' && s.items.filter(i => i.role !== 'home').length >= DESTINATION_CAPACITY) throw new PlaceError('Destination limit reached. Delete one before restoring.');
      return { items: [...s.items, p], undo: null, result: undefined };
    });
  }
}
class PlaceError extends Error {}
