import { expect, test } from 'vitest';
import { combinedLocalBackup, mergedLocalTools } from '../../src/product/local/dataPackage';
import { type AuthoredRoute } from '../../src/product/local/routes';
import { DEFAULT_RECORDER_SETTINGS } from '../../src/product/local/recorder';

const route: AuthoredRoute = { id: 'a', name: 'Existing walk', updatedAt: 1, waypoints: [
  { id: 'a1', label: 'Gate', latitude: -33.86, longitude: 151.2, note: '' }, { id: 'a2', label: 'Door', latitude: -33.8601, longitude: 151.2001, note: '' },
] };
test('global backup import commits the reviewed merged routes rather than duplicating a replacement section', () => {
  const current = { version: 1 as const, routes: [route], areas: [] };
  const incoming = { version: 1 as const, routes: [{ ...route, id: 'b', name: 'Imported walk' }], areas: [] };
  const merged = mergedLocalTools(current, incoming, false);
  const extra = { version: 1, createdAt: 100, records: [{ key: 'crosswise_local_tools_v1', value: JSON.stringify(incoming) }, { key: 'crosswise_recorder_settings_v1', value: JSON.stringify({ ...DEFAULT_RECORDER_SETTINGS, enabled: true }) }] };
  const combined = combinedLocalBackup(extra, merged, DEFAULT_RECORDER_SETTINGS);
  expect(combined.records).toHaveLength(2);
  expect(JSON.parse(combined.records.find(r => r.key === 'crosswise_local_tools_v1')!.value).routes.map((r: AuthoredRoute) => r.name)).toEqual(['Existing walk', 'Imported walk']);
  expect(JSON.parse(combined.records.find(r => r.key === 'crosswise_recorder_settings_v1')!.value).enabled).toBe(false);
});
test('replacement is explicit and invalid additional sections are rejected before mutation', () => {
  const current = { version: 1 as const, routes: [route], areas: [] }, incoming = { version: 1 as const, routes: [], areas: [] };
  expect(mergedLocalTools(current, incoming, true).routes).toEqual([]);
  expect(() => combinedLocalBackup({ version: 1, createdAt: 0, records: [{ key: 'credentials', value: '{}' }] }, current, null)).toThrow();
});
