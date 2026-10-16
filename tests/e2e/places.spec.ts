import { test, expect, type Page } from './fixtures';
// Keep API fixtures observable; a production worker otherwise owns these fetches.
test.use({ serviceWorkers: 'block' });
const origin={latitude:-33.87,longitude:151.2};
function encode(points:{latitude:number;longitude:number}[]) { let lastLat=0,lastLng=0,text=''; const value=(n:number)=>{let v=n<0?~(n<<1):n<<1;let s='';while(v>=32){s+=String.fromCharCode((32|(v&31))+63);v>>=5;}return s+String.fromCharCode(v+63);};for(const p of points){const lat=Math.round(p.latitude*1e5),lng=Math.round(p.longitude*1e5);text+=value(lat-lastLat)+value(lng-lastLng);lastLat=lat;lastLng=lng;}return text; }
const geometry=encode([origin,{...origin,latitude:-33.8695}]);
const routeData=(distance=60,duration='60s')=>({polyline:{encodedPolyline:geometry},distanceMeters:distance,duration,legs:[{steps:[{polyline:{encodedPolyline:geometry},distanceMeters:distance,navigationInstruction:{instructions:'Head north along the footpath',maneuver:'DEPART'}}]}]});
async function setup(page:Page,preference='distance',mapsBrowserKey='') {
 await page.addInitScript(() => { Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true }); });
 await page.addInitScript(({origin,preference})=>{
  localStorage.setItem('crosswise_product_preferences_v1',JSON.stringify({version:1,termsVersion:'2026-10-13'}));localStorage.setItem('crosswise_permission_setup_v1','done');localStorage.setItem('crosswise_route_preference',preference);
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(ok:(position:unknown)=>void)=>ok({coords:{...origin,accuracy:5},timestamp:Date.now()}),watchPosition:()=>1,clearWatch:()=>{}}});
  navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};
 },{origin,preference});
 await page.route('**/api/config',r=>r.fulfill({json:{mapsProxyEnabled:true,mapsBrowserKey}}));
 await page.goto('/');
 await expect(page.getByRole('region',{name:'Preparing offline voice'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Preparing offline voice'})).toHaveCount(0);
 const agree=page.getByRole('button',{name:'Agree and continue',exact:true});if(await agree.count())await agree.click();
 await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();
}
async function homeSettings(page:Page){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/^Home.*Register/}).click();}
async function manager(page:Page){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/^Destinations.*Search/}).click();}
async function back(page:Page){await page.getByRole('button',{name:'‹ Back',exact:true}).click();}

test('destination search automatically gets location and orders matches closest first',async({page})=>{
 await setup(page);let body:{rankPreference?:string;locationBias:{circle:{center:typeof origin}}}={locationBias:{circle:{center:origin}}};
 await page.route('**/api/maps/search',r=>{body=r.request().postDataJSON();return r.fulfill({json:{places:[{id:'far',displayName:{text:'Far library'},location:{...origin,latitude:-33.85}},{id:'near',displayName:{text:'Near library'},location:{...origin,latitude:-33.8699}}]}});});
 await page.getByRole('button',{name:'Route guidance',exact:true}).click();await page.getByRole('button',{name:'Search destination',exact:true}).click();
 await page.getByLabel('Place name or address',{exact:true}).fill('library');await page.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.getByRole('button',{name:/^1\. Near library/})).toBeVisible();expect(body.rankPreference).toBe('DISTANCE');expect(body.locationBias.circle.center).toEqual(origin);
 await expect(page.getByRole('status')).toContainText('Closest first by straight-line distance');
 await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=(_ok,fail)=>fail?.({code:1,message:'Denied'} as GeolocationPositionError);});
 await page.reload();await page.getByRole('button',{name:'Route guidance',exact:true}).click();await page.getByRole('button',{name:'Search destination',exact:true}).click();
 await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=(_ok,fail)=>fail?.({code:1,message:'Denied'} as GeolocationPositionError);});
 await page.getByLabel('Place name or address',{exact:true}).fill('library');await page.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.getByRole('button',{name:/^1\. Far library/})).toBeVisible();expect(body.rankPreference).toBeUndefined();await expect(page.getByRole('status')).toContainText('Location unavailable');
});

test('Locate me displays a coarse position and accuracy without claiming it is precise',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=ok=>ok({coords:{latitude:-33.87,longitude:151.2,accuracy:150},timestamp:Date.now()} as GeolocationPosition);});
 await page.getByRole('button',{name:'Road crossing',exact:true}).click();await page.getByRole('button',{name:'Show map',exact:true}).click();
 await page.getByRole('button',{name:'Locate me',exact:true}).click();
 await expect(page.getByText(/Your estimated position: -33.87000, 151.20000/)).toContainText('Accuracy: about 150 m — approximate');
 await expect(page.getByRole('button',{name:'Recenter',exact:true})).toBeVisible();
});
async function manuallySave(page:Page,name:string){await page.getByText('Advanced location editing',{exact:true}).click();await page.getByRole('button',{name:'Enter destination coordinates',exact:true}).click();await page.getByLabel('Destination name',{exact:true}).fill(name);await page.getByLabel('Latitude',{exact:true}).fill('-33.8695');await page.getByLabel('Longitude',{exact:true}).fill('151.2');await page.getByRole('button',{name:'Confirm location',exact:true}).click();await expect(page.getByRole('status')).toContainText('Destination registered.');await page.getByRole('button',{name:'OK',exact:true}).click();}

test('selected place maps focus the pin and route overview is optional',async({page})=>{
 await page.addInitScript(()=>{
  type Camera={center:{lat:number;lng:number};zoom:number;zoomCalls:number;fitCalls:number};
  const cameras:Camera[]=[];
  Object.defineProperty(window,'__mapCameras',{value:cameras});
  class FakeMap {
   private camera:Camera;
   constructor(_element:Element,options:{center:{lat:number;lng:number};zoom:number}){this.camera={center:options.center,zoom:options.zoom,zoomCalls:0,fitCalls:0};cameras.push(this.camera);}
   panTo(center:{lat:number;lng:number}){this.camera.center=center;}
   setZoom(zoom:number){this.camera.zoom=zoom;this.camera.zoomCalls++;}
   fitBounds(){this.camera.fitCalls++;}
   addListener(){return {remove(){}};}
  }
  class FakeMarker {addListener(){return {remove(){}};}setMap(){}}
  class FakePolyline {setMap(){}}
  class FakeBounds {extend(){}}
  Object.defineProperty(window,'google',{value:{maps:{Map:FakeMap,Marker:FakeMarker,Polyline:FakePolyline,LatLngBounds:FakeBounds,event:{addListenerOnce(){},clearInstanceListeners(){}}}}});
 });
 await setup(page,'distance','mock-key');
 await page.route('**/api/maps/route',r=>r.fulfill({json:{routes:[routeData()]}}));
 await page.getByRole('button',{name:'Route guidance',exact:true}).click();
 await manuallySave(page,'Pin test');
 await page.getByRole('button',{name:/^Pin test.*User/}).click();
 const camera=()=>page.evaluate(()=>{const maps=(window as unknown as {__mapCameras:{center:{lat:number;lng:number};zoom:number;zoomCalls:number;fitCalls:number}[]}).__mapCameras;return maps.at(-1)!;});
 await expect.poll(async()=>({zoom:(await camera()).zoom,center:(await camera()).center})).toEqual({zoom:17,center:{lat:-33.8695,lng:151.2}});
 expect((await camera()).zoomCalls).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Confirm place and review route',exact:true}).click();
 await expect(page.getByRole('button',{name:'Show whole route',exact:true})).toBeVisible();
 await expect.poll(async()=>(await camera()).zoom).toBe(17);
 await page.getByRole('button',{name:'Show whole route',exact:true}).click();
 await expect.poll(async()=>(await camera()).fitCalls).toBe(1);
 await page.getByRole('button',{name:'Focus destination',exact:true}).click();
 expect((await camera()).zoom).toBe(17);
});

test('Home GPS registration, entrance edit, delete/Undo and reload preserve the committed endpoint',async({page})=>{
 await setup(page);await homeSettings(page);await page.getByRole('button',{name:'Register current location',exact:true}).click();await page.getByRole('button',{name:'Use this location',exact:true}).click();await expect(page.getByRole('heading',{name:'Name destination',exact:true})).toBeVisible();await page.getByRole('button',{name:'Save name',exact:true}).click();await expect(page.getByRole('status')).toContainText('Home registered.');await page.getByRole('button',{name:'OK',exact:true}).click();
 await page.getByRole('button',{name:'Confirm Home',exact:false}).click();await expect(page.getByText('User-selected entrance',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Edit location',exact:true}).click();await page.getByRole('button',{name:'Move North',exact:true}).click();await page.getByRole('button',{name:'Confirm location',exact:true}).click();await page.getByRole('button',{name:'OK',exact:true}).click();
 await page.getByRole('button',{name:'Delete Home',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:/^Undo delete Home/}).click();await expect(page.getByRole('status')).toContainText('restored');await page.getByRole('button',{name:'OK',exact:true}).click();await page.reload();await homeSettings(page);await page.getByRole('button',{name:'Confirm Home',exact:false}).click();
 const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('crosswise_saved_places_v2')!).items[0]);expect(record.role).toBe('home');expect(record.point.latitude).toBeGreaterThan(origin.latitude);expect(record.point.longitude).toBe(origin.longitude);
});
test('named coordinate destinations reject duplicate names, cancel edits, delete and Undo without loss',async({page})=>{
 await setup(page);await manager(page);await manuallySave(page,'Library entrance');await page.getByRole('button',{name:/^Library entrance.*User/}).click();await page.getByRole('button',{name:'Edit location',exact:true}).click();await page.getByRole('button',{name:'Move East',exact:true}).click();await back(page);await page.getByRole('dialog').getByRole('button',{name:'Discard',exact:true}).click();await back(page);
 await page.getByText('Advanced location editing',{exact:true}).click();await page.getByRole('button',{name:'Enter destination coordinates',exact:true}).click();await page.getByLabel('Destination name',{exact:true}).fill(' library ENTRANCE ');await page.getByLabel('Latitude',{exact:true}).fill('-33.86');await page.getByLabel('Longitude',{exact:true}).fill('151.2');await page.getByRole('button',{name:'Confirm location',exact:true}).click();await expect(page.getByRole('alert')).toContainText('already saved');await back(page);await page.getByRole('dialog').getByRole('button',{name:'Discard',exact:true}).click();
 await page.getByRole('button',{name:/^Library entrance.*User/}).click();await page.getByRole('button',{name:'Delete destination',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'OK',exact:true}).click();await expect(page.getByRole('status')).toContainText('No destinations');await page.getByRole('button',{name:/^Undo delete Library entrance/}).click();await page.getByRole('button',{name:'OK',exact:true}).click();
 const items=await page.evaluate(()=>JSON.parse(localStorage.getItem('crosswise_saved_places_v2')!).items);expect(items).toHaveLength(1);expect(items[0].point.longitude).toBe(151.2);
});
test('search identity review saves a provider ID and route preview uses coordinate endpoints with alternatives',async({page})=>{
 await setup(page);await page.route('**/api/maps/search',r=>r.fulfill({json:{places:[{id:'library',displayName:{text:'Town Library'},formattedAddress:'Test Street',location:{...origin,latitude:-33.8695}}]}}));
 const requests:unknown[]=[];await page.route('**/api/maps/route',r=>{requests.push(r.request().postDataJSON());return r.fulfill({json:{routes:[routeData(90,'90s'),routeData(60,'60s')]}});});
 await manager(page);await page.getByRole('button',{name:'Search and register',exact:true}).click();await page.getByLabel('Place name or address',{exact:true}).fill('Town Library Test suburb');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:/^1\. Town Library/}).click();await page.getByRole('button',{name:'Register destination',exact:true}).click();await page.getByRole('button',{name:'OK',exact:true}).click();
 const provider=await page.evaluate(()=>JSON.parse(localStorage.getItem('crosswise_saved_places_v2')!).items[0]);expect(provider.placeId).toBe('library');expect(provider.point).toBeUndefined();expect(provider.address).toBeUndefined();
 await manuallySave(page,'North entrance');await page.getByRole('button',{name:/^North entrance.*User/}).click();await page.getByRole('button',{name:'Confirm place and review route',exact:true}).click();await expect(page.getByRole('button',{name:'Start journey',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/^Route 1: 60 metres/})).toBeVisible();expect(requests[0]).toMatchObject({destination:{location:{latLng:{latitude:-33.8695,longitude:151.2}}},computeAlternativeRoutes:true,travelMode:'WALK'});await page.getByRole('button',{name:'Start journey',exact:true}).click();await expect(page.getByRole('navigation',{name:'Walking tools'})).toBeVisible();
});
test('legacy unsupported route preference falls back to supported distance on load',async({page})=>{
 await setup(page,'stairs');let calls=0;await page.route('**/api/maps/route',r=>{calls++;return r.fulfill({json:{routes:[routeData()]}});});await manager(page);await manuallySave(page,'Park entrance');await page.getByRole('button',{name:/^Park entrance.*User/}).click();await page.getByRole('button',{name:'Confirm place and review route',exact:true}).click();await expect(page.getByRole('button',{name:'Start journey',exact:true})).toBeVisible();expect(calls).toBe(1);await expect(page.getByRole('button',{name:'Use standard route',exact:true})).toHaveCount(0);
});

test('simple nearby filters persist without permission or provider requests',async({page})=>{
 await setup(page);let calls=0;await page.route('**/api/maps/nearby',r=>{calls++;return r.fulfill({json:{places:[]}});});await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/^Nearby facilities.*Radius/}).click();await expect(page.getByRole('radio')).toHaveCount(4);await expect(page.getByRole('switch')).toHaveCount(4);await page.getByRole('radio',{name:'50 metres',exact:true}).check();await page.getByRole('switch',{name:'Dining',exact:true}).uncheck();expect(calls).toBe(0);
 await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/^Nearby facilities.*Radius/}).click();await expect(page.getByRole('radio',{name:'50 metres',exact:true})).toBeChecked();await expect(page.getByRole('switch',{name:'Dining',exact:true})).not.toBeChecked();await page.getByRole('radio',{name:/^None/}).check();await page.getByRole('button',{name:'View nearby places',exact:true}).click();await expect(page.getByRole('button',{name:'Refresh nearby places',exact:true})).toBeDisabled();expect(calls).toBe(0);
});

test('nearby search filters duplicates and outside-radius places, then opens detail and saves destination',async({page})=>{
 await setup(page);await page.route('**/api/maps/nearby',r=>r.fulfill({json:{places:[{id:'cafe',displayName:{text:'Corner Cafe'},formattedAddress:'Near Street',location:{...origin,latitude:-33.8698},types:['restaurant']},{id:'cafe',displayName:{text:'Corner Cafe'},formattedAddress:'Near Street',location:{...origin,latitude:-33.8698},types:['restaurant']},{id:'far',displayName:{text:'Far Cafe'},location:{latitude:0,longitude:0},types:['restaurant']}]}}));await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/^Nearby facilities.*Radius/}).click();await page.getByRole('button',{name:'View nearby places',exact:true}).click();await page.getByRole('button',{name:'Refresh nearby places',exact:true}).click();await expect(page.getByRole('button',{name:/^1\. Corner Cafe/})).toHaveCount(1);await expect(page.getByRole('button',{name:/Far Cafe/})).toHaveCount(0);await page.getByRole('button',{name:/^1\. Corner Cafe/}).click();await page.getByRole('button',{name:'Save destination',exact:true}).click();await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('crosswise_saved_places_v2')??'{"items":[]}').items.length)).toBe(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});




test('browser Back respects local destination editor and nearby genre hierarchy',async({page})=>{
 await setup(page);await manager(page);await manuallySave(page,'Back test');await page.getByRole('button',{name:/^Back test.*User/}).click();await page.getByRole('button',{name:'Edit location',exact:true}).click();await page.getByRole('button',{name:'Move North',exact:true}).click();await page.goBack();await expect(page.getByRole('dialog',{name:'Discard this draft?',exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:'Edit entrance location',exact:true})).toBeVisible();await page.goBack();await page.getByRole('dialog').getByRole('button',{name:'Discard',exact:true}).click();await expect(page.getByRole('heading',{name:'Destination detail',exact:true})).toBeVisible();await page.goBack();await expect(page.getByRole('heading',{name:'Destinations',exact:true})).toBeVisible();await page.goBack();await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/^Nearby facilities.*Radius/}).click();await page.getByRole('button',{name:'View nearby places',exact:true}).click();await page.goBack();await expect(page.getByRole('heading',{name:'Nearby facilities',exact:true})).toBeVisible();await expect(page.getByRole('radio')).toHaveCount(4);
});


test('canceling a destination change keeps the original paused route and can resume it',async({page})=>{
 await setup(page);await page.route('**/api/maps/route',r=>r.fulfill({json:{routes:[routeData()]}}));await manager(page);await manuallySave(page,'Original entrance');await page.getByRole('button',{name:/^Original entrance.*User/}).click();await page.getByRole('button',{name:'Confirm place and review route',exact:true}).click();await page.getByRole('button',{name:'Start journey',exact:true}).click();await page.getByRole('navigation',{name:'Walking tools'}).getByRole('button',{name:'Tools',exact:true}).click();await page.getByRole('button',{name:'Change destination',exact:true}).click();await page.getByRole('button',{name:'Search destination',exact:true}).click();await page.getByRole('button',{name:'Cancel destination change',exact:true}).click();await expect(page.getByRole('heading',{name:'Walking tools',exact:true})).toBeVisible();await page.getByRole('button',{name:'Resume navigation',exact:true}).click();await expect(page.getByRole('navigation',{name:'Walking tools'})).toBeVisible();await page.getByRole('navigation',{name:'Walking tools'}).getByRole('button',{name:'Tools',exact:true}).click();await page.getByRole('button',{name:'Route overview',exact:true}).click();await expect(page.getByRole('heading',{name:'Original entrance',exact:true})).toBeVisible();
});

async function arriveAtSavedEntrance(page:Page){
 await page.route('**/api/maps/route',r=>r.fulfill({json:{routes:[routeData()]}}));await manager(page);await manuallySave(page,'Arrival entrance');await page.getByRole('button',{name:/^Arrival entrance.*User/}).click();await page.getByRole('button',{name:'Confirm place and review route',exact:true}).click();await page.getByRole('button',{name:'Start journey',exact:true}).click();await expect(page.getByRole('navigation',{name:'Walking tools'})).toBeVisible();await page.getByRole('button',{name:'Show map',exact:true}).click();await page.getByRole('button',{name:'I am at my destination',exact:true}).click();await expect(page.getByRole('heading',{name:'Journey completed',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Arrival entrance',exact:true})).toBeVisible();
}
test('confirmed arrival opens the completion choices and Continue Road crossing ends the old route',async({page})=>{
 await setup(page);await arriveAtSavedEntrance(page);for(const name of ['Continue Road crossing','Choose another destination','Route Home','End walk'])await expect(page.getByRole('button',{name,exact:true})).toBeVisible();await page.getByRole('button',{name:'Continue Road crossing',exact:true}).click();await expect(page.getByRole('navigation',{name:'Walking tools'})).toBeVisible();await page.getByRole('navigation',{name:'Walking tools'}).getByRole('button',{name:'Tools',exact:true}).click();await page.getByRole('button',{name:'Route overview',exact:true}).click();await expect(page.getByRole('region',{name:'Route overview',exact:true}).getByRole('status')).toContainText('No active route.');
});
test('arrival Route Home waits for provider identity before opening its confirmation',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('crosswise_saved_places_v2',JSON.stringify({version:2,items:[{placeId:'home-provider',savedAt:1,kind:'provider',role:'home',alias:'Home'}]})));await page.route('**/api/maps/places/home-provider',async r=>{await new Promise(resolve=>setTimeout(resolve,350));await r.fulfill({json:{id:'home-provider',displayName:{text:'Home building'},formattedAddress:'Home Test Street',location:{...origin,latitude:-33.8695}}});});await setup(page);await arriveAtSavedEntrance(page);await page.getByRole('button',{name:'Route Home',exact:true}).click();await expect(page.getByRole('heading',{name:'Home detail',exact:true})).toBeVisible();const home=page.getByRole('region',{name:'Home detail',exact:true});await expect(home.getByRole('heading',{name:'Home',exact:true})).toBeVisible();await expect(home.getByText('Home Test Street',{exact:true})).toBeVisible();await expect(home.getByRole('button',{name:'Edit location',exact:true})).toBeVisible();await home.getByRole('button',{name:'Confirm place and review route',exact:true}).click();await expect(page.getByRole('button',{name:'Start journey',exact:true})).toBeVisible();await page.getByRole('button',{name:'Start journey',exact:true}).click();await expect(page.getByRole('navigation',{name:'Walking tools'})).toBeVisible();
});
