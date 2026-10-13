import { Store } from '../state/store';
export const ROUTE_PREFERENCES = [
  { id: 'distance', label: 'Shortest distance', supported: true },
  { id: 'time', label: 'Shortest time', supported: true },
  { id: 'stairs', label: 'Fewer stairs', supported: false },
  { id: 'covered', label: 'Covered paths', supported: false },
  { id: 'main-roads', label: 'Near main roads', supported: false },
] as const;
export type RoutePreference = typeof ROUTE_PREFERENCES[number]['id'];
const KEY = 'crosswise_route_preference';
function initial(): RoutePreference { try { const raw = localStorage.getItem(KEY); return ROUTE_PREFERENCES.some(p => p.id === raw && p.supported) ? raw as RoutePreference : 'distance'; } catch { return 'distance'; } }
export const routePreference = new Store<RoutePreference>(initial());
export function reloadRoutePreference(): void { routePreference.set(initial()); }
export function setRoutePreference(preference: RoutePreference): void {
  if (!ROUTE_PREFERENCES.some(p => p.id === preference)) throw new Error('Invalid route preference.');
  localStorage.setItem(KEY, preference); routePreference.set(preference);
}
export const supportsPreference = (preference: RoutePreference): boolean => preference === 'distance' || preference === 'time';
