import { expect, test } from 'vitest';
import { LocalToolsRepository, duplicateRoute, parseLocalToolsFile, routeLength, validateRoute, type AuthoredRoute } from '../../src/product/local/routes';

const route: AuthoredRoute = { id: 'r1', name: 'Entrance walk', updatedAt: 1, waypoints: [
  { id: 'a', label: 'Gate', latitude: -33.86, longitude: 151.2, note: 'Enter through pedestrian gate.' },
  { id: 'b', label: 'Door', latitude: -33.8601, longitude: 151.2001, note: 'Door opens inward.' },
] };
function fixture(content: string | null = null) {
  let raw = content;
  const storage = { getItem: () => raw, setItem: (_: string, value: string) => { raw = value; } };
  const repo = new LocalToolsRepository(storage); repo.load();
  return { repo, storage };
}
test('authored routes save, reorder and survive reload without provider details', () => {
  const { repo, storage } = fixture(); repo.saveRoute(route);
  const updated = { ...route, name: 'Renamed', waypoints: [...route.waypoints].reverse() };
  repo.saveRoute(updated);
  const loaded = new LocalToolsRepository(storage); loaded.load();
  expect(loaded.state.value.data.routes).toEqual([updated]);
  expect(routeLength(route)).toBeGreaterThan(10);
  expect(routeLength(route)).toBeLessThan(20);
});
test('route validation rejects invalid and identical coordinates, missing endpoints and oversized data', () => {
  expect(() => validateRoute({ ...route, waypoints: [route.waypoints[0]] })).toThrow('2 to 100');
  expect(() => validateRoute({ ...route, waypoints: route.waypoints.map(p => ({ ...p, longitude: 181 })) })).toThrow('valid latitude');
  expect(() => validateRoute({ ...route, waypoints: [route.waypoints[0], { ...route.waypoints[0], id: 'c' }] })).toThrow('distinct');
  expect(() => parseLocalToolsFile(JSON.stringify({ version: 2, routes: [], areas: [] }))).toThrow('Unsupported');
  expect(() => parseLocalToolsFile('x'.repeat(2_000_001))).toThrow('too large');
});
test('invalid storage and failed saves preserve original records', () => {
  const { repo, storage } = fixture('{unreadable');
  expect(repo.state.value.status).toBe('error');
  expect(() => repo.saveRoute(route)).toThrow('unavailable');
  expect(storage.getItem()).toBe('{unreadable');
  const good = fixture(); good.repo.saveRoute(route);
  good.storage.setItem = () => { throw new Error('quota'); };
  expect(() => good.repo.removeRoute(route.id)).toThrow('Could not save');
  expect(good.repo.state.value.data.routes).toEqual([route]);
});
test('merge retains existing collision while explicit replace replaces, without half-import', () => {
  const { repo } = fixture(); repo.saveRoute(route);
  repo.importData({ version: 1, routes: [{ ...route, name: 'Imported collision' }, { ...route, id: 'r2' }], areas: [] });
  expect(repo.state.value.data.routes.map(r => r.name)).toEqual(['Entrance walk', 'Entrance walk']);
  expect(() => repo.importData({ version: 1, routes: [{ ...route, id: 'bad', waypoints: [] }], areas: [] })).toThrow();
  expect(repo.state.value.data.routes).toHaveLength(2);
  repo.importData({ version: 1, routes: [{ ...route, name: 'Replaced' }], areas: [] }, true);
  expect(repo.state.value.data.routes).toHaveLength(1);
  expect(repo.state.value.data.routes[0].name).toBe('Replaced');
});
test('duplicate and reverse use independent IDs, with directional notes cleared for review', () => {
  const copy = duplicateRoute(route), reversed = duplicateRoute(route, true);
  expect(copy.id).not.toBe(route.id); expect(copy.waypoints[0].note).toBe(route.waypoints[0].note);
  expect(reversed.waypoints[0].label).toBe('Door');
  expect(reversed.waypoints.every(p => p.note === '')).toBe(true);
  expect(route.waypoints[0].label).toBe('Gate');
});
