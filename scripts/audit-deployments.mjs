// Public deployment/version comparison and reproducible public-destination route diagnostic.
const bases=process.argv.slice(2);
for(const base of bases.length?bases:['https://capstone-pwa.fly.dev','https://capstone-pwa-dev.fly.dev']){
 const get=async(path)=>{const r=await fetch(base+path);return {status:r.status,text:await r.text()};};
 const [health,worker,html,config]=await Promise.all(['/healthz','/sw.js','/','/api/config'].map(get));
 const cfg=JSON.parse(config.text); const scripts=[...html.text.matchAll(/src="([^"]+\.js)"/g)].map(m=>m[1]);
 const bundle=(await Promise.all(scripts.map(get))).map(r=>r.text).join('');
 console.log(JSON.stringify({base,health:health.status,worker:worker.text.match(/(?:crosswise|capstone)[^\s'"`]{0,70}/g)?.slice(0,3),mapsProxyEnabled:cfg.mapsProxyEnabled,browserMapConfigured:!!cfg.mapsBrowserKey,hasPermissionSetup:bundle.includes('Set up permissions'),hasRoadCrossing:bundle.includes('Road crossing'),hasPresenter:bundle.includes('PresenterTools-'),scripts}));
 const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const search=await post('/api/maps/search',{textQuery:'Wollongong Hospital NSW',pageSize:5,languageCode:'en'});
 const place=search.data.places?.find(p=>p.displayName?.text==='Wollongong Hospital')??search.data.places?.[0];
 console.log(JSON.stringify({base,searchStatus:search.status,place:place?.displayName?.text}));
 if(!place)continue;
 // Public Wollongong railway station vicinity, not the user's location.
 for(const destination of [{placeId:place.id},{location:{latLng:place.location}}]){
  const result=await post('/api/maps/route',{origin:{location:{latLng:{latitude:-34.4274,longitude:150.8887}}},destination,travelMode:'WALK',computeAlternativeRoutes:true,polylineEncoding:'ENCODED_POLYLINE',polylineQuality:'HIGH_QUALITY',languageCode:'en-AU',units:'METRIC'});
  console.log(JSON.stringify({base,endpoint:destination.placeId?'placeId':'coordinate',status:result.status,routes:result.data.routes?.map(r=>({distance:r.distanceMeters,steps:r.legs?.flatMap(l=>l.steps??[]).map(s=>({distance:s.distanceMeters,instruction:s.navigationInstruction?.instructions,geometryLength:s.polyline?.encodedPolyline?.length}))})),error:result.data.error}));
 }
}
