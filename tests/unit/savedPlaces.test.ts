import {test,expect,vi} from 'vitest';
import { SavedPlacesRepository, SAVED_PLACES_KEY, SAVED_PLACES_V2_KEY } from '../../src/nav/savedPlaces';
function fixture(raw: string | null = null, key = SAVED_PLACES_KEY) {
  const data = new Map<string,string>(); if (raw !== null) data.set(key,raw);
  const storage = { getItem: vi.fn(async (id: string) => data.get(id) ?? null), setItem: vi.fn(async (id: string, value: string) => { data.set(id,value); }) };
  return { storage, data, repo: new SavedPlacesRepository(storage, () => 100) };
}
test('keeps bookmarks, orders by actual save, deduplicates concurrent saves and survives restart', async () => {
  const { repo, storage } = fixture(); await repo.load(); expect(repo.state.value.items).toEqual([]);
  await Promise.all(['a', 'b', 'c', 'd', 'd'].map(id => repo.save(id)));
  expect(repo.state.value.items.map(p => p.placeId)).toEqual(['d','c','b','a']);
  await repo.save('a',undefined,'Home'); expect(repo.state.value.items[3].alias).toBe('Home');
  const reloaded = new SavedPlacesRepository(storage); await reloaded.load(); expect(reloaded.state.value.items).toEqual(repo.state.value.items);
});
test('removal and undo preserve unrelated concurrent saves; re-saving a removed place is newest', async () => {
  const { repo } = fixture(); await repo.load(); await repo.save('a'); await repo.save('b');
  await repo.remove('a'); await repo.save('c'); await repo.undo(); expect(repo.state.value.items.map(p => p.placeId)).toEqual(['c','b','a']);
  await repo.remove('a'); await repo.save('a',undefined,'New name'); await repo.undo();
  expect(repo.state.value.items.map(p => p.placeId)).toEqual(['a','c','b']); expect(repo.state.value.items[0].alias).toBe('New name');
});
test('duplicate alias cannot redirect a bookmark and failed writes do not claim success', async () => {
  const { repo, storage } = fixture(); await repo.load(); await repo.save('a','user query','Home');
  await expect(repo.save('b',undefined,' home ')).rejects.toThrow('already saved');
  storage.setItem.mockRejectedValueOnce(new Error('disk full')); await expect(repo.save('b')).rejects.toThrow('Couldn’t save'); expect(repo.state.value.items).toHaveLength(1);
  await repo.save('b'); expect(JSON.parse(storage.setItem.mock.calls.at(-1)![1]).items.every((p: Record<string,unknown>) => !p.address && !p.point && !p.name)).toBe(true);
});
test.each(['{broken','{"version":2,"items":[]}','{"version":1,"items":[{"placeId":"a","savedAt":null}]}'])('preserves unreadable legacy storage %s', async raw => {
  const { repo, storage, data } = fixture(raw); await repo.load(); expect(repo.state.value.status).toBe('error');
  await expect(repo.save('new')).rejects.toThrow('unavailable'); expect(storage.setItem).not.toHaveBeenCalled(); expect(data.get(SAVED_PLACES_KEY)).toBe(raw);
});
test('migration preserves the original and promotes one unambiguous Home alias', async () => {
  const raw = JSON.stringify({version:1,items:[{placeId:'a',savedAt:2,alias:' Home '},{placeId:'b',savedAt:1,alias:'Work'}]});
  const {repo,data,storage}=fixture(raw);await repo.load();expect(repo.home?.placeId).toBe('a');expect(data.get(SAVED_PLACES_KEY)).toBe(raw);expect(JSON.parse(data.get(SAVED_PLACES_V2_KEY)!).version).toBe(2);
  storage.setItem.mockRejectedValueOnce(new Error('quota')); const next=fixture(raw);next.storage.setItem.mockRejectedValueOnce(new Error('quota'));await next.repo.load();expect(next.repo.state.value.status).toBe('error');expect(next.data.get(SAVED_PLACES_KEY)).toBe(raw);expect(next.data.has(SAVED_PLACES_V2_KEY)).toBe(false);
});
test('coordinate destinations and entrance edits resolve locally, keep identity and Home role after restart', async () => {
  const {repo,storage}=fixture();await repo.load();const id=await repo.saveCoordinate({latitude:-33.87,longitude:151.2},'Home','home');
  expect(repo.getCandidate(id)?.endpoint).toBe('coordinate'); expect(repo.home?.placeId).toBe(id);
  await repo.saveCoordinate({latitude:-33.871,longitude:151.201},'Home','home',id);expect(repo.state.value.items).toHaveLength(1);
  const restart=new SavedPlacesRepository(storage);await restart.load();expect(restart.getCandidate(id)?.point.latitude).toBe(-33.871);
  await repo.save('provider',undefined,'Office');await repo.saveCoordinate({latitude:1,longitude:2},'Office','destination','provider');expect(repo.getCandidate('provider')?.endpoint).toBe('coordinate');
});
test('Home replacement is atomic; Undo cannot overwrite a subsequently registered Home', async () => {
  const {repo,storage}=fixture();await repo.load();const old=await repo.saveCoordinate({latitude:0,longitude:0},'Home','home');await repo.remove(old);
  const next=await repo.saveCoordinate({latitude:1,longitude:1},'Home','home');await expect(repo.undo()).rejects.toThrow();expect(repo.home?.placeId).toBe(next);
  storage.setItem.mockRejectedValueOnce(new Error('full'));await expect(repo.saveProviderHome('provider')).rejects.toThrow('Couldn’t save');expect(repo.home?.placeId).toBe(next);
});
test('rejects invalid coordinates, missing names and duplicate rename without data loss', async () => {
  const {repo}=fixture();await repo.load();await expect(repo.saveCoordinate({latitude:91,longitude:0},'Bad')).rejects.toThrow('valid coordinates');
  await repo.save('a',undefined,'Work');await repo.save('b',undefined,'Park');await expect(repo.rename('b','WORK')).rejects.toThrow('already saved');expect(repo.state.value.items.find(p=>p.placeId==='b')?.alias).toBe('Park');
});
test('capacity reserves a separate Home slot and permits edits, deletes and exports of over-limit data', async () => {
  const {repo}=fixture();await repo.load();for(let i=0;i<100;i++)await repo.save('id'+i,undefined,'Destination '+i);
  await expect(repo.save('overflow')).rejects.toThrow('100 destinations');await repo.saveProviderHome('home');expect(repo.state.value.items).toHaveLength(101);
  await repo.rename('id0','Renamed');await repo.remove('id1');await repo.save('new');expect(repo.state.value.items).toHaveLength(101);
});
test.each([
  {version:2,items:[{placeId:'x',savedAt:1,kind:'coordinate',point:{latitude:NaN,longitude:0}}]},
  {version:2,items:[{placeId:'a',savedAt:1,role:'home'},{placeId:'b',savedAt:2,role:'home'}]},
])('corrupt v2 never falls back and overwrites legacy',async value=>{const {repo,storage}=fixture(JSON.stringify(value),SAVED_PLACES_V2_KEY);await repo.load();expect(repo.state.value.status).toBe('error');expect(storage.setItem).not.toHaveBeenCalled();});
