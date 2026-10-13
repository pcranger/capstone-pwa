import { Store } from '../../state/store';
import type { GeoPoint } from '../../nav/navigation';

export interface AuthoredWaypoint extends GeoPoint { id: string; label: string; note: string }
export interface AuthoredRoute { id: string; name: string; waypoints: AuthoredWaypoint[]; updatedAt: number }
export interface AreaPack {
  id: string; name: string; region: string; source: string; version: string; updatedAt: number;
  routes: AuthoredRoute[]; landmarks: AuthoredWaypoint[];
}
export interface LocalToolsData { version: 1; routes: AuthoredRoute[]; areas: AreaPack[] }
export const LOCAL_TOOLS_KEY = 'crosswise_local_tools_v1';
export const MAX_ROUTES = 100;
export const MAX_WAYPOINTS = 100;
export const localId = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid data object.');
  return v as Record<string, unknown>;
};
const text = (v: unknown, name: string, limit: number, required = true): string => {
  if (typeof v !== 'string' || v.length > limit || (required && !v.trim())) throw new Error(`Invalid ${name}.`);
  return v.trim();
};
export function validateWaypoint(value: unknown): AuthoredWaypoint {
  const v = object(value);
  if (typeof v.latitude !== 'number' || typeof v.longitude !== 'number' || !Number.isFinite(v.latitude) ||
      !Number.isFinite(v.longitude) || Math.abs(v.latitude) > 90 || Math.abs(v.longitude) > 180) throw new Error('Enter a valid latitude and longitude.');
  return { id: text(v.id, 'waypoint identifier', 100), label: text(v.label, 'waypoint name', 160),
    note: text(v.note, 'spoken note', 1000, false), latitude: v.latitude, longitude: v.longitude };
}
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const r = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * r / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin((b.longitude - a.longitude) * r / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function validateRoute(value: unknown): AuthoredRoute {
  const v = object(value);
  if (!Number.isFinite(v.updatedAt) || Number(v.updatedAt) < 0 || !Array.isArray(v.waypoints) || v.waypoints.length < 2 || v.waypoints.length > MAX_WAYPOINTS) throw new Error('A route needs 2 to 100 waypoints.');
  const waypoints = v.waypoints.map(validateWaypoint);
  if (new Set(waypoints.map(p => p.id)).size !== waypoints.length) throw new Error('Repeated waypoint identifier.');
  if (!waypoints.some((p, i) => i > 0 && distanceMeters(p, waypoints[0]) >= 1)) throw new Error('Choose at least two distinct locations.');
  return { id: text(v.id, 'route identifier', 100), name: text(v.name, 'route name', 160), updatedAt: Number(v.updatedAt), waypoints };
}
export function validateArea(value: unknown): AreaPack {
  const v = object(value);
  if (!Number.isFinite(v.updatedAt) || Number(v.updatedAt) < 0 || !Array.isArray(v.routes) || v.routes.length > MAX_ROUTES || !Array.isArray(v.landmarks) || v.landmarks.length > 500) throw new Error('Invalid special-area contents.');
  const routes = v.routes.map(validateRoute), landmarks = v.landmarks.map(validateWaypoint);
  if (new Set(routes.map(r => r.id)).size !== routes.length || new Set(landmarks.map(p => p.id)).size !== landmarks.length) throw new Error('Repeated special-area identifier.');
  return { id: text(v.id, 'area identifier', 100), name: text(v.name, 'area name', 160), region: text(v.region, 'region', 160),
    source: text(v.source, 'source', 500), version: text(v.version, 'pack version', 80), updatedAt: Number(v.updatedAt), routes, landmarks };
}
export function validateLocalToolsData(value: unknown): LocalToolsData {
  const v = object(value);
  if (v.version !== 1 || !Array.isArray(v.routes) || v.routes.length > MAX_ROUTES || !Array.isArray(v.areas) || v.areas.length > 20) throw new Error('Unsupported or oversized CrossWise data.');
  const routes = v.routes.map(validateRoute), areas = v.areas.map(validateArea);
  if (new Set(routes.map(r => r.id)).size !== routes.length || new Set(areas.map(a => a.id)).size !== areas.length) throw new Error('Repeated data identifier.');
  return { version: 1, routes, areas };
}
export function parseLocalToolsFile(content: string): LocalToolsData {
  if (content.length > 2_000_000) throw new Error('This data file is too large. Maximum 2 MB.');
  try { return validateLocalToolsData(JSON.parse(content)); }
  catch (e) { throw new Error(e instanceof SyntaxError ? 'This is not a valid JSON data file.' : e instanceof Error ? e.message : 'Invalid data file.'); }
}

interface RepositoryState { status: 'loading' | 'ready' | 'error'; data: LocalToolsData; error: string | null }
interface LocalStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const empty = (): LocalToolsData => ({ version: 1, routes: [], areas: [] });
/** Stores only user-authored coordinates/notes, never a durable Google map-content cache. */
export class LocalToolsRepository {
  readonly state = new Store<RepositoryState>({ status: 'loading', data: empty(), error: null });
  constructor(private storage: LocalStorage = {
    getItem: key => globalThis.localStorage.getItem(key), setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  }) {}
  load(): void {
    try {
      const content = this.storage.getItem(LOCAL_TOOLS_KEY);
      this.state.set({ status: 'ready', data: content ? parseLocalToolsFile(content) : empty(), error: null });
    } catch {
      this.state.update(s => ({ ...s, status: 'error', error: 'Local route data could not be read. Your stored data has been preserved. Retry or export the original data before resetting.' }));
    }
  }
  private write(data: LocalToolsData): void {
    const validated = validateLocalToolsData(data);
    try { this.storage.setItem(LOCAL_TOOLS_KEY, JSON.stringify(validated)); }
    catch { throw new Error('Could not save local data. Check available device storage and try again.'); }
    this.state.set({ status: 'ready', data: validated, error: null });
  }
  private ready(): LocalToolsData {
    if (this.state.value.status !== 'ready') throw new Error('Local data is unavailable. Retry loading first.');
    return this.state.value.data;
  }
  saveRoute(value: AuthoredRoute): AuthoredRoute {
    const data = this.ready(), route = validateRoute(value);
    const items = data.routes.filter(r => r.id !== route.id);
    if (items.length >= MAX_ROUTES) throw new Error('100 routes are already saved. Export or delete a route before adding another.');
    this.write({ ...data, routes: [route, ...items] });
    return route;
  }
  removeRoute(id: string): void { const data = this.ready(); this.write({ ...data, routes: data.routes.filter(r => r.id !== id) }); }
  saveArea(value: AreaPack): void {
    const data = this.ready(), area = validateArea(value), others = data.areas.filter(a => a.id !== area.id);
    if (others.length >= 20) throw new Error('20 special-area packs are already installed.');
    this.write({ ...data, areas: [area, ...others] });
  }
  removeArea(id: string): void { const data = this.ready(); this.write({ ...data, areas: data.areas.filter(a => a.id !== id) }); }
  importData(value: LocalToolsData, replace = false): { routes: number; areas: number } {
    const valid = validateLocalToolsData(value), current = this.ready();
    // Merge keeps existing records on an identifier collision; replacement is an explicit separate choice.
    const routes = replace ? valid.routes : [...current.routes, ...valid.routes.filter(r => !current.routes.some(c => c.id === r.id))];
    const areas = replace ? valid.areas : [...current.areas, ...valid.areas.filter(a => !current.areas.some(c => c.id === a.id))];
    this.write({ version: 1, routes, areas });
    return { routes: routes.length, areas: areas.length };
  }
  reset(): void { this.write(empty()); }
  originalExport(): string { return this.storage.getItem(LOCAL_TOOLS_KEY) ?? JSON.stringify(empty()); }
}
export const localToolsRepository = new LocalToolsRepository();
export function routeLength(route: AuthoredRoute): number {
  return route.waypoints.reduce((sum, point, index, points) => sum + (index ? distanceMeters(points[index - 1], point) : 0), 0);
}
export function duplicateRoute(route: AuthoredRoute, reversed = false): AuthoredRoute {
  return { ...route, id: localId(), name: `${route.name} ${reversed ? '(reversed)' : '(copy)'}`.slice(0, 160), updatedAt: Date.now(),
    waypoints: (reversed ? [...route.waypoints].reverse() : route.waypoints).map(p => ({ ...p, id: localId(), note: reversed ? '' : p.note })) };
}
