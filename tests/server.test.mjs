import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
async function fixture(t,options){const app=createApp(options);await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{app.closeAllConnections();app.close(r);}));return `http://127.0.0.1:${app.address().port}`;}
test('public runtime configuration never discloses the native key',async t=>{const url=await fixture(t,{mapsKey:'private-native-key'});const r=await fetch(url+'/api/config');const body=await r.text();assert(!body.includes('private-native-key'));assert.deepEqual(JSON.parse(body),{mapsProxyEnabled:true,mapsBrowserKey:''});assert.equal(r.headers.get('cache-control'),'no-store');});
test('search sends credentials only upstream, limits fields and sanitizes errors',async t=>{let calls=0;const url=await fixture(t,{mapsKey:'private-native-key',upstream:async(target,options)=>{calls++;assert.equal(target,'https://places.googleapis.com/v1/places:searchText');assert.equal(options.headers['X-Goog-Api-Key'],'private-native-key');assert.equal(JSON.parse(options.body).pageSize,5);assert(!options.headers['X-Goog-FieldMask'].includes('photos'));return new Response('secret-provider-error',{status:403});}});const r=await fetch(url+'/api/maps/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({textQuery:'Library Sydney',pageSize:100})});assert.equal(r.status,502);const body=await r.text();assert(!body.includes('private-native-key'));assert(!body.includes('secret-provider-error'));assert.equal(calls,1);});
test('proxy rejects foreign origins, invalid routes and unknown endpoints without fetching',async t=>{const url=await fixture(t,{mapsKey:'key',upstream:()=>{throw new Error('Unexpected upstream request');}});assert.equal((await fetch(url+'/api/maps/search',{method:'POST',headers:{Origin:'https://other.example'},body:'{}'})).status,403);assert.equal((await fetch(url+'/api/maps/route',{method:'POST',body:'{}'})).status,400);assert.equal((await fetch(url+'/api/maps/arbitrary?url=https://other.example')).status,404);});
test('walking routes cannot be turned into driving routes',async t=>{const url=await fixture(t,{mapsKey:'key',upstream:async(_target,options)=>{const body=JSON.parse(options.body);assert.equal(body.travelMode,'WALK');assert.equal(body.destination.placeId,'library');return Response.json({routes:[]});}});const r=await fetch(url+'/api/maps/route',{method:'POST',body:JSON.stringify({origin:{location:{latLng:{latitude:-33.87,longitude:151.2}}},destination:{placeId:'library'},travelMode:'DRIVE'})});assert.equal(r.status,200);});
test('static hosting serves root, model MIME, service worker revalidation and excludes env/source',async t=>{const url=await fixture(t,{mapsKey:'key'});const r=await fetch(url+'/');assert.equal(r.status,200);assert.match(await r.text(),/capstone_PWA/);const sw=await fetch(url+'/sw.js');assert.equal(sw.headers.get('cache-control'),'no-cache');assert.match(sw.headers.get('content-type'),/javascript/);assert.equal((await fetch(url+'/.env')).status,404);assert.equal((await fetch(url+'/server.mjs')).status,404);assert.equal((await fetch(url+'/models/model.json')).status,200);assert.equal((await fetch(url+'/models/missing.bin')).status,404);});

test('coordinate destinations and bounded waypoints stay pedestrian and reject invalid geometry',async t=>{
 let seen;const url=await fixture(t,{mapsKey:'key',upstream:async(_target,options)=>{seen=JSON.parse(options.body);return Response.json({routes:[]});}});
 const incoming={origin:{location:{latLng:{latitude:0,longitude:0}}},destination:{location:{latLng:{latitude:1,longitude:2}}},intermediates:[{location:{latLng:{latitude:.5,longitude:1}}}],computeAlternativeRoutes:true,travelMode:'DRIVE'};
 assert.equal((await fetch(url+'/api/maps/route',{method:'POST',body:JSON.stringify(incoming)})).status,200);assert.equal(seen.travelMode,'WALK');assert.deepEqual(seen.destination,incoming.destination);assert.equal(seen.computeAlternativeRoutes,false);assert.equal(seen.intermediates.length,1);
 incoming.destination.location.latLng.latitude=91;assert.equal((await fetch(url+'/api/maps/route',{method:'POST',body:JSON.stringify(incoming)})).status,400);
});
test('nearby is allowlisted, bounded, attributed, no-store and rejects arbitrary types and radii',async t=>{
 let calls=0;const url=await fixture(t,{mapsKey:'private',upstream:async(target,options)=>{calls++;assert.equal(target,'https://places.googleapis.com/v1/places:searchNearby');const body=JSON.parse(options.body);assert.equal(body.maxResultCount,20);assert.equal(body.rankPreference,'DISTANCE');assert.deepEqual(body.includedTypes,['ramen_restaurant']);assert.equal(options.headers['X-Goog-FieldMask'].includes('photos'),false);return Response.json({places:[]});}});
 const incoming={locationRestriction:{circle:{center:{latitude:0,longitude:0},radius:100}},includedTypes:['ramen_restaurant','ramen_restaurant'],maxResultCount:100};
 const r=await fetch(url+'/api/maps/nearby',{method:'POST',body:JSON.stringify(incoming)});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 incoming.includedTypes=['arbitrary'];assert.equal((await fetch(url+'/api/maps/nearby',{method:'POST',body:JSON.stringify(incoming)})).status,400);
 incoming.includedTypes=['restaurant'];incoming.locationRestriction.circle.radius=0;assert.equal((await fetch(url+'/api/maps/nearby',{method:'POST',body:JSON.stringify(incoming)})).status,400);assert.equal(calls,1);
});


test('demo server has no account, sharing, photo or backup endpoints',async t=>{
 const url=await fixture(t,{});
 for(const path of ['/api/product/capabilities','/api/product/account','/api/product/login','/api/product/backup','/api/product/shares','/api/product/questions']){
  const response=await fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,404);assert.deepEqual(await response.json(),{error:'Unknown endpoint.'});
 }
});
