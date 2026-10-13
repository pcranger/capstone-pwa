import { afterEach, describe, expect, it, vi } from 'vitest';
import { backupChanges, collectBackup, restoreBackup, validateBackup, type BackupData } from '../src/product/cloud/api';
import { ForegroundSharing, metersBetween } from '../src/product/cloud/sharing';
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
describe('foreground check-in geometry', () => {
  it('uses geographic distances rather than screen pixels and handles coincident points', () => {
    expect(metersBetween({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
    expect(metersBetween({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 })).toBeCloseTo(111.195, 2);
  });
});
describe('foreground location publisher',()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
  it('sends only fresh accurate foreground fixes, waits for dwell and resets targets for a new session',async()=>{
    vi.useFakeTimers();vi.setSystemTime(1000000);let callback:PositionCallback=()=>{};let visibility:()=>void=()=>{};
    const doc={visibilityState:'visible',addEventListener:(_name:string,listener:()=>void)=>{visibility=listener;},removeEventListener:vi.fn()};
    vi.stubGlobal('document',doc);vi.stubGlobal('navigator',{geolocation:{watchPosition:vi.fn((onPosition:PositionCallback)=>{callback=onPosition;return 1;}),clearWatch:vi.fn()}});
    const calls:{path:string;body:Record<string,unknown>}[]=[];vi.stubGlobal('fetch',vi.fn(async(path:string,options:{body:string})=>{calls.push({path,body:JSON.parse(options.body)});return Response.json({position:{},event:{}});}));
    const publish=new ForegroundSharing();publish.start('walk-one');publish.arm({latitude:-33.87,longitude:151.2,label:'Entrance',radius:40,dwellSeconds:20});
    const fix=(age=0,accuracy=8)=>({timestamp:Date.now()-age,coords:{latitude:-33.87,longitude:151.2,accuracy,altitude:null,altitudeAccuracy:null,heading:null,speed:null}} as GeolocationPosition);
    const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
    callback(fix(20000));callback(fix(0,200));await flush();expect(calls).toHaveLength(0);
    callback(fix());await flush();expect(calls.filter(c=>c.path.endsWith('/position'))).toHaveLength(1);expect(calls.filter(c=>c.path.endsWith('/check-in'))).toHaveLength(0);
    vi.setSystemTime(Date.now()+10000);callback(fix());await flush();vi.setSystemTime(Date.now()+10000);callback(fix());await flush();expect(calls.filter(c=>c.path.endsWith('/check-in'))).toHaveLength(1);expect(publish.getSnapshot().checkedIn).toBe(true);
    doc.visibilityState='hidden';visibility();vi.setSystemTime(Date.now()+21000);callback(fix());await flush();expect(calls.filter(c=>c.path.endsWith('/position'))).toHaveLength(2);expect(publish.getSnapshot().paused).toBe(true);
    publish.start('walk-two');expect(publish.getSnapshot().target).toBeNull();expect(publish.getSnapshot().checkedIn).toBe(false);publish.stop();
  });
  it.each(['hidden','location error','poor accuracy','outside target','stale fix','GPS gap'] as const)('requires a new continuous dwell after %s, including fixes skipped by transmission throttling',async(reason)=>{
    vi.useFakeTimers();vi.setSystemTime(1000000);
    let callback:PositionCallback=()=>{};let locationError:PositionErrorCallback=()=>{};let visibility:()=>void=()=>{};
    const doc={visibilityState:'visible',addEventListener:(_name:string,listener:()=>void)=>{visibility=listener;},removeEventListener:vi.fn()};
    vi.stubGlobal('document',doc);vi.stubGlobal('navigator',{geolocation:{watchPosition:vi.fn((ok:PositionCallback,error:PositionErrorCallback)=>{callback=ok;locationError=error;return 1;}),clearWatch:vi.fn()}});
    const calls:string[]=[];vi.stubGlobal('fetch',vi.fn(async(path:string)=>{calls.push(path);return Response.json({position:{},event:{}});}));
    const publisher=new ForegroundSharing();publisher.start('walk');publisher.arm({latitude:-33.87,longitude:151.2,label:'Entrance',radius:40,dwellSeconds:20});
    const fix=(accuracy=8,latitude=-33.87,age=0)=>({timestamp:Date.now()-age,coords:{latitude,longitude:151.2,accuracy}} as GeolocationPosition);
    const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
    callback(fix());await flush();vi.setSystemTime(1010000);callback(fix());await flush();
    vi.setSystemTime(1011000);
    if(reason==='hidden'){doc.visibilityState='hidden';visibility();}
    if(reason==='location error')locationError({code:2,message:'Unavailable'} as GeolocationPositionError);
    if(reason==='poor accuracy')callback(fix(80)); // Valid for sharing, too uncertain for this target.
    if(reason==='outside target')callback(fix(8,-33.871));
    if(reason==='stale fix')callback(fix(8,-33.87,20000));
    vi.setSystemTime(reason==='GPS gap'?1035000:1020000);
    if(reason==='hidden'){doc.visibilityState='visible';visibility();}
    callback(fix());await flush();expect(calls.filter(path=>path.endsWith('/check-in'))).toHaveLength(0);
    vi.setSystemTime(Date.now()+10000);callback(fix());await flush();expect(calls.filter(path=>path.endsWith('/check-in'))).toHaveLength(0);
    vi.setSystemTime(Date.now()+10000);callback(fix());await flush();expect(calls.filter(path=>path.endsWith('/check-in'))).toHaveLength(1);
    expect(publisher.getSnapshot().checkedIn).toBe(true);publisher.stop();
  });
  it.each(['hidden','rearmed','outside target'] as const)('does not check in from a completed position request after dwell was invalidated by %s',async(reason)=>{
    vi.useFakeTimers();vi.setSystemTime(1000000);let callback:PositionCallback=()=>{};let visibility:()=>void=()=>{};
    const doc={visibilityState:'visible',addEventListener:(_name:string,listener:()=>void)=>{visibility=listener;},removeEventListener:vi.fn()};
    vi.stubGlobal('document',doc);vi.stubGlobal('navigator',{geolocation:{watchPosition:vi.fn((ok:PositionCallback)=>{callback=ok;return 1;}),clearWatch:vi.fn()}});
    let release:(response:Response)=>void=()=>{};const pending=new Promise<Response>(resolve=>{release=resolve;});const calls:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(path:string)=>{calls.push(path);return calls.length===2?pending:Response.json({position:{},event:{}});}));
    const publisher=new ForegroundSharing();publisher.start('walk');const target={latitude:-33.87,longitude:151.2,label:'Entrance',radius:40,dwellSeconds:20};publisher.arm(target);
    const fix=(latitude=-33.87)=>({timestamp:Date.now(),coords:{latitude,longitude:151.2,accuracy:8}} as GeolocationPosition);
    const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
    callback(fix());await flush();vi.setSystemTime(1010000);callback(fix());await flush();vi.setSystemTime(1020000);callback(fix());await flush();
    expect(calls.filter(path=>path.endsWith('/position'))).toHaveLength(2);
    if(reason==='hidden'){doc.visibilityState='hidden';visibility();}
    if(reason==='rearmed')publisher.arm({...target,label:'Different entrance'});
    if(reason==='outside target')callback(fix(-33.871));
    release(Response.json({position:{}}));await flush();expect(calls.filter(path=>path.endsWith('/check-in'))).toHaveLength(0);expect(publisher.getSnapshot().checkedIn).toBe(false);publisher.stop();
  });
});
