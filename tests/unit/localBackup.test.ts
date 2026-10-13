import { describe, expect, it, vi } from 'vitest';
import { backupChanges, collectBackup, restoreBackup, validateBackup, type BackupData } from '../../src/product/local/backup';
const storage = (initial: Record<string, string> = {}) => { const values = { ...initial }; return { values, getItem: (key: string) => values[key] ?? null, setItem: (key: string, value: string) => { values[key] = value; }, removeItem: (key: string) => { delete values[key]; } }; };
const backup = (records: BackupData['records']): BackupData => ({ version: 1, createdAt: 1000, records });
describe('private local backup', () => {
  it('exports only declared settings and authored data, excluding recordings, public provider configuration and logs', () => {
    const local = storage({ crosswise_settings: '{"speech":true}', crosswise_route_preference: 'stairs', crosswise_runtime_config: '{"mapsBrowserKey":"public"}', crosswise_csv_sessions: '["location"]', crosswise_recordings: 'private video', unrelated: 'other app' });
    expect(collectBackup(local).records.map(r => r.key)).toEqual(['crosswise_settings', 'crosswise_route_preference']);
  });
  it('rejects malformed sections, unsupported identifiers, duplicate records and out-of-range user coordinates before mutation', () => {
    expect(() => validateBackup(backup([{ key: 'crosswise_saved_places_v2', value: '{"version":2,"items":[{"placeId":"local:x","savedAt":1,"kind":"coordinate","point":{"latitude":100,"longitude":0}}]}' }]))).toThrow('Invalid');
    expect(() => validateBackup(backup([{ key: 'crosswise_settings', value: '{"speech":"false"}' }]))).toThrow('Invalid');
    expect(() => validateBackup(backup([{ key: 'crosswise_settings', value: '{}' }, { key: 'crosswise_settings', value: '{}' }]))).toThrow('duplicate');
    expect(() => validateBackup(backup([{ key: 'crosswise_recordings', value: '{}' }]))).toThrow('unsupported');
  });
  it('previews conflicts, replaces changed sections and preserves absent sections', () => {
    const local = storage({ crosswise_settings: '{"speech":true}', crosswise_route_preference: 'time' }), data = backup([{ key: 'crosswise_settings', value: '{"speech":false}' }]);
    expect(backupChanges(data, local)).toEqual(['crosswise_settings']); restoreBackup(data, local);
    expect(local.values.crosswise_settings).toBe('{"speech":false}'); expect(local.values.crosswise_route_preference).toBe('time');
  });
  it('uses repository validators for malformed special areas, repeated waypoints and unknown nearby categories', () => {
    expect(() => validateBackup(backup([{ key: 'crosswise_local_tools_v1', value: JSON.stringify({ version: 1, routes: [], areas: [{ id: 'broken' }] }) }]))).toThrow();
    const waypoint = { id: 'duplicate', label: 'Entrance', note: '', latitude: -33.87, longitude: 151.2 };
    expect(() => validateBackup(backup([{ key: 'crosswise_local_tools_v1', value: JSON.stringify({ version: 1, areas: [], routes: [{ id: 'route', name: 'Walk', updatedAt: 1000, waypoints: [waypoint, { ...waypoint, latitude: -33.871 }] }] }) }]))).toThrow('Repeated waypoint');
    expect(() => validateBackup(backup([{ key: 'crosswise_nearby_v1', value: '{"radius":100,"enabled":["made-up-category"]}' }]))).toThrow('Invalid');
  });
  it('rolls back all modified values if a device write fails', () => {
    const local = storage({ crosswise_settings: '{"speech":true}' }); const write = local.setItem;
    local.setItem = vi.fn((key, value) => { if (key === 'crosswise_route_preference') throw new Error('Quota exceeded'); write(key, value); });
    expect(() => restoreBackup(backup([{ key: 'crosswise_settings', value: '{"speech":false}' }, { key: 'crosswise_route_preference', value: 'time' }]), local)).toThrow('Restore could not finish');
    expect(local.values.crosswise_settings).toBe('{"speech":true}'); expect(local.values.crosswise_route_preference).toBeUndefined();
  });
});