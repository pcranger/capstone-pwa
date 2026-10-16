import { test, expect, vi, afterEach } from 'vitest';
import { filterNearby, nearbyPlaces, NearbyReader, validateNearbySettings, type NearbyPlace } from '../../src/nav/nearby';
import { services } from '../../src/config/services';
import { walkingRoute, parseWalkingRoutes, type LocationFix, type PlaceCandidate } from '../../src/nav/navigation';
const fix: LocationFix = { latitude:0,longitude:0,accuracy:5,timestamp:Date.now() };
const place = (id='a',types=['restaurant'],north=0.0001): PlaceCandidate & {types:string[]} => ({id,name:id,address:'address',point:{latitude:north,longitude:0},types});
const encoded='_p~iF~ps|U_ulLnnqC_mqNvxq`@';
const route=(distanceMeters:number,duration='120s')=>({polyline:{encodedPolyline:encoded},distanceMeters,duration,legs:[{steps:[{polyline:{encodedPolyline:encoded},distanceMeters,navigationInstruction:{instructions:'Head north'}}]}]});
afterEach(()=>{vi.restoreAllMocks();services.mapsProxyEnabled=false;services.mapsRestApiKey='';});
test('nearby classification deduplicates IDs, enforces radius and excludes specific dining from Other',()=>{
  const settings={radius:50,enabled:['dining-other']};
  const found=filterNearby([place('a'),place('a'),place('fast',['restaurant','fast_food_restaurant']),place('far',['restaurant'],1)],fix,settings);
  expect(found.map(p=>p.id)).toEqual(['a']);expect(found[0].direction).toBe('north');expect(found[0].distance).toBeGreaterThan(10);
});
test('None, all-off and unsupported-only make no API/location-content requests',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch');expect(await nearbyPlaces(fix,{radius:0,enabled:['dining-other']})).toEqual([]);
  expect(await nearbyPlaces(fix,{radius:50,enabled:[]})).toEqual([]);expect(await nearbyPlaces(fix,{radius:50,enabled:['everyday-other']})).toEqual([]);expect(fetcher).not.toHaveBeenCalled();
  expect(validateNearbySettings({radius:75,enabled:[]})).toBe(false);expect(validateNearbySettings({radius:50,enabled:['arbitrary']})).toBe(false);
});
test('nearby request uses bounded radius/type mask and filters provider data, never a persistent business cache',async()=>{
  services.mapsProxyEnabled=true;services.mapsRestApiKey='server';const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({places:[{id:'ramen',displayName:{text:'Noodles'},formattedAddress:'Test',location:place().point,types:['restaurant','ramen_restaurant']}]}));
  const found=await nearbyPlaces({...fix,timestamp:Date.now()},{radius:100,enabled:['dining-ramen']});expect(found[0].name).toBe('Noodles');expect(fetcher.mock.calls[0][0]).toBe('/api/maps/nearby');const body=JSON.parse(fetcher.mock.calls[0][1]?.body as string);expect(body.includedTypes).toEqual(['ramen_restaurant']);expect(body.locationRestriction.circle.radius).toBe(100);
});
test('reader throttles, uses movement threshold, announces once and discards canceled late results',async()=>{
  let time=100000;const announce=vi.fn();const p:NearbyPlace={...place(),distance:10,direction:'north'};
  const query=vi.fn(async()=>[p]);const reader=new NearbyReader(announce,query,()=>time);const settings={radius:100,enabled:['dining-other']};
  await reader.update({...fix,timestamp:time},settings);await reader.update({...fix,latitude:1,timestamp:time},settings);expect(query).toHaveBeenCalledTimes(1);expect(announce).toHaveBeenCalledTimes(1);
  time+=31000;await reader.update({...fix,timestamp:time},settings);expect(query).toHaveBeenCalledTimes(1);await reader.update({...fix,latitude:.001,timestamp:time},settings);expect(query).toHaveBeenCalledTimes(2);expect(announce).toHaveBeenCalledTimes(1);
  let finish!:(p:NearbyPlace[])=>void;const late=new NearbyReader(announce,()=>new Promise(resolve=>{finish=resolve;}),()=>time);const pending=late.update({...fix,timestamp:time},settings);late.stop();finish([{...p,id:'late'}]);expect(await pending).toEqual([]);expect(announce).toHaveBeenCalledTimes(1);
});
test('inaccurate or stale first fixes do not consume the reader request threshold before recovery',async()=>{
  let time=100000;const announce=vi.fn();const query=vi.fn(async()=>[{...place(),distance:10,direction:'north'}]);const reader=new NearbyReader(announce,query,()=>time);const settings={radius:100,enabled:['dining-other']};
  await reader.update({...fix,timestamp:time,accuracy:100},settings);await reader.update({...fix,timestamp:time-20000},settings);expect(query).not.toHaveBeenCalled();time+=1;await reader.update({...fix,timestamp:time},settings);expect(query).toHaveBeenCalledTimes(1);expect(announce).toHaveBeenCalledTimes(1);
});
test('failed nearby requests retry at the same point after the rate limit without a request storm',async()=>{
  let time=100000;const announce=vi.fn();const query=vi.fn(async()=>[{...place(),distance:10,direction:'north'}]).mockRejectedValueOnce(new Error('Offline'));const reader=new NearbyReader(announce,query,()=>time);const settings={radius:100,enabled:['dining-other']};
  await expect(reader.update({...fix,timestamp:time},settings)).rejects.toThrow('Offline');time+=29000;await reader.update({...fix,timestamp:time},settings);expect(query).toHaveBeenCalledTimes(1);time+=1000;await reader.update({...fix,timestamp:time},settings);expect(query).toHaveBeenCalledTimes(2);expect(announce).toHaveBeenCalledTimes(1);
});
test('coordinate route sends coordinates and shortest available candidate, retaining alternatives',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({routes:[route(900),route(400,'200s')]}));
  const to={...place(),endpoint:'coordinate' as const};const result=await walkingRoute(fix,to,'key',undefined,{preference:'distance'});
  expect(result.distanceMeters).toBe(400);expect(result.alternatives?.[0].distanceMeters).toBe(900);expect(result.appliedPreference).toBe('distance');
  const body=JSON.parse(fetcher.mock.calls[0][1]?.body as string);expect(body.destination).toEqual({location:{latLng:to.point}});expect(body.computeAlternativeRoutes).toBe(true);
});
test('unsupported preferences need explicit standard fallback; time ranks duration and intermediate routes do not request alternatives',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>Response.json({routes:[route(900,'120s'),route(400,'200s')]}));
  await expect(walkingRoute(fix,place(),'key',undefined,{preference:'stairs'})).rejects.toThrow('unavailable');expect(fetcher).not.toHaveBeenCalled();
  const fallback=await walkingRoute(fix,place(),'key',undefined,{preference:'stairs',allowStandardFallback:true});expect(fallback.appliedPreference).toBe('standard');
  const timed=await walkingRoute(fix,place(),'key',undefined,{preference:'time',via:[{latitude:1,longitude:2}]});expect(timed.distanceMeters).toBe(900);const body=JSON.parse(fetcher.mock.calls.at(-1)![1]?.body as string);expect(body.computeAlternativeRoutes).toBe(false);expect(body.intermediates).toHaveLength(1);
});
test('one malformed alternative does not hide a complete route; malformed-only response fails',()=>{
  expect(parseWalkingRoutes({routes:[route(900),{}]},place())).toHaveLength(1);expect(()=>parseWalkingRoutes({routes:[{}]},place())).toThrow();
});

