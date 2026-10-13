import {createServer} from 'node:http';
import {createReadStream,existsSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAdvancedHandler} from './server-advanced.mjs';

const root=resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.bin':'application/octet-stream'};
const masks={search:'places.id,places.displayName,places.location,places.formattedAddress',details:'id,displayName,formattedAddress,location,businessStatus,movedPlaceId',nearby:'places.id,places.displayName,places.location,places.formattedAddress,places.types',route:'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration,routes.warnings,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.polyline.encodedPolyline'};
const nearbyTypes=new Set(['fast_food_restaurant','family_restaurant','ramen_restaurant','restaurant','cafe','coffee_shop','bakery','convenience_store','supermarket','shopping_mall','store','train_station','bus_station','bus_stop','subway_station','light_rail_station','tram_stop','ferry_terminal','transit_station','parking','gas_station','car_repair','hospital','doctor','pharmacy','dentist','local_government_office','post_office','police','library','bank','atm','park','museum','sports_complex','tourist_attraction','hotel','lodging','public_bathroom','laundry','hair_salon']);
const nearbyRadii=new Set([30,50,100,150,200,250,300,400,500]);
const buckets=new Map();
function reply(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function bodyOf(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>16384)throw new Error('Body too large');}return JSON.parse(text);}
function point(p){return p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;}
export function createApp({mapsKey=process.env.GOOGLE_MAP_API_KEY??'',browserMapsKey=process.env.GOOGLE_MAPS_BROWSER_KEY??'',upstream=fetch,advancedOptions={}}={}){
 const advanced=createAdvancedHandler({upstream,...advancedOptions});
 return createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(self), microphone=(self), geolocation=(self)');
  try{
   const url=new URL(req.url,'http://localhost');
   if(await advanced(req,res,url))return;
   if(url.pathname==='/healthz'){reply(res,200,{ready:existsSync(resolve(root,'index.html'))});return;}
   if(url.pathname==='/api/config'){reply(res,200,{mapsProxyEnabled:!!mapsKey,mapsBrowserKey:browserMapsKey});return;}
   if(url.pathname.startsWith('/api/maps/')){
    if(!mapsKey){reply(res,503,{error:'Walking routes are not configured in this build.'});return;}
    // Only same-origin browser requests; never a credential-bearing arbitrary URL proxy.
    const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host){reply(res,403,{error:'Request origin is not allowed.'});return;}
    const ip=req.headers['fly-client-ip']??req.socket.remoteAddress;const now=Date.now();
    if(buckets.size>10000)for(const [id,bucket]of buckets)if(now-bucket.start>600000)buckets.delete(id);
    let bucket=buckets.get(ip);if(!bucket||now-bucket.start>600000){bucket={start:now,count:0};buckets.set(ip,bucket);}
    if(++bucket.count>120){reply(res,429,{error:'Too many requests. Try again later.'});return;}
    let target,mask,body,method='POST';
    if(url.pathname==='/api/maps/search'&&req.method==='POST'){
     const incoming=await bodyOf(req);if(typeof incoming.textQuery!=='string'||!incoming.textQuery.trim()||incoming.textQuery.length>240){reply(res,400,{error:'Enter a destination name and suburb.'});return;}
     body={textQuery:incoming.textQuery.trim(),pageSize:5,languageCode:'en'};
     const circle=incoming.locationBias?.circle;if(point(circle?.center))body.locationBias={circle:{center:circle.center,radius:5000}};
     target='https://places.googleapis.com/v1/places:searchText';mask=masks.search;
    }else if(url.pathname==='/api/maps/nearby'&&req.method==='POST'){
     const incoming=await bodyOf(req),circle=incoming.locationRestriction?.circle,types=incoming.includedTypes;
     if(!point(circle?.center)||!nearbyRadii.has(circle?.radius)||!Array.isArray(types)||!types.length||types.length>50||types.some(type=>typeof type!=='string'||!nearbyTypes.has(type))){reply(res,400,{error:'Invalid nearby search. Choose a radius and supported categories.'});return;}
     body={locationRestriction:{circle:{center:circle.center,radius:circle.radius}},includedTypes:[...new Set(types)],maxResultCount:20,rankPreference:'DISTANCE',languageCode:'en'};
     target='https://places.googleapis.com/v1/places:searchNearby';mask=masks.nearby;
    }else if(/^\/api\/maps\/places\/[^/]+$/.test(url.pathname)&&req.method==='GET'){
     const id=decodeURIComponent(url.pathname.slice('/api/maps/places/'.length));if(!id||id.length>512){reply(res,400,{error:'Place unavailable. Search again.'});return;}
     target='https://places.googleapis.com/v1/places/'+encodeURIComponent(id);method='GET';mask=masks.details;
    }else if(url.pathname==='/api/maps/route'&&req.method==='POST'){
     const incoming=await bodyOf(req),start=incoming.origin?.location?.latLng,id=incoming.destination?.placeId,end=incoming.destination?.location?.latLng,via=incoming.intermediates;
     if(!point(start)||!(typeof id==='string'&&id&&id.length<=512||point(end))||(via!==undefined&&(!Array.isArray(via)||via.length>20||via.some(p=>!point(p?.location?.latLng))))){reply(res,400,{error:'Invalid walking route request.'});return;}
     body={origin:{location:{latLng:start}},destination:point(end)?{location:{latLng:end}}:{placeId:id},travelMode:'WALK',polylineEncoding:'ENCODED_POLYLINE',polylineQuality:'HIGH_QUALITY',languageCode:'en-AU',units:'METRIC',computeAlternativeRoutes:!via?.length&&incoming.computeAlternativeRoutes===true};
     if(via?.length)body.intermediates=via.map(p=>({location:{latLng:p.location.latLng}}));
     target='https://routes.googleapis.com/directions/v2:computeRoutes';mask=masks.route;
    }else{reply(res,404,{error:'Unknown endpoint.'});return;}
    const response=await upstream(target,{method,headers:{'Content-Type':'application/json','X-Goog-Api-Key':mapsKey,'X-Goog-FieldMask':mask},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(18000)});
    if(!response.ok){reply(res,response.status===429?429:502,{error:response.status===403?'The route service is unavailable for this build.':'Google Maps could not complete the request.'});return;}
    const result=await response.text();if(result.length>4000000)throw new Error('Response too large');
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(result);return;
   }
   if(url.pathname.startsWith('/api/')){reply(res,404,{error:'Unknown endpoint.'});return;}
   if(req.method!=='GET'&&req.method!=='HEAD'){reply(res,405,{error:'Method not allowed.'});return;}
   let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(root.endsWith(sep)?root:root+sep)&&path!==root){reply(res,404,{error:'Not found.'});return;}
   let info=await stat(path).catch(()=>null);if(info?.isDirectory()){path=resolve(path,'index.html');info=await stat(path).catch(()=>null);}
   if(!info?.isFile()){if(!extname(url.pathname)&&req.headers.accept?.includes('text/html')){path=resolve(root,'index.html');info=await stat(path);}else{reply(res,404,{error:'Not found.'});return;}}
   const cache=url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':/\.(bin|ttf|png)$/.test(path)?'public, max-age=86400':'no-cache';
   res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Content-Length':info.size,'Cache-Control':cache});
   if(req.method==='HEAD')res.end();else{const stream=createReadStream(path);stream.on('error',()=>res.destroy());stream.pipe(res);}
  }catch(error){if(!res.headersSent)reply(res,error instanceof SyntaxError?400:502,{error:error instanceof SyntaxError?'Invalid request.':'Service unavailable. Try again.'});else res.destroy();}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT??8080);createApp().listen(port,'0.0.0.0',()=>console.log(`capstone_PWA serving on port ${port}`));
}
