import { lazy,Suspense,useEffect,useLayoutEffect,useRef,useState } from 'react';
import { controller } from '../state/controller';
import { useStore } from '../state/store';
import { useCameraPermission } from '../platform/cameraPermission';
import { PermissionSetup } from './PermissionSetup';
import { SpeechPackStartup } from './SpeechPackStartup';
import { focusActiveHeading } from './focus';
import { requestMotionPermission, type MotionPermissionResult } from './permissions';
import { JourneyScreen } from '../ui/JourneyScreen';
import { AssistMode } from '../crossing/crossingEngine';
import { Action,ConfirmDialog,Notice,Page,Row } from './ProductPage';
import { ProductSettings,type SettingsPage } from './ProductSettings';
import { SupportScreen } from './SupportScreen';
import { PlacesScreen } from './PlacesScreen';
import { NearbyScreen } from './NearbyScreen';
import { PRESENTER_TOOLS } from './demoScope';
import { productPreferences,updateProductPreferences } from './preferences';
import type { PlaceCandidate } from '../nav/navigation';
import { NearbyReader,nearbySettings,demoNearbySettings } from '../nav/nearby';

const settingsPages=['settings','speed','preference','objects','types','feedback','display','permissions'] as const;
const localPages=['routes','recordings','data'] as const;
const supportPages=['help','holding','terms','privacy','audio'] as const;
const allPages=['home','welcome','permissionSetup','walk','arrival','places','homePlaces','managePlaces','nearby','facilities','tools','overview',...settingsPages,...supportPages,...(PRESENTER_TOOLS?['presenter','advanced','guide','practice',...localPages]:[])];
const PresenterTools=PRESENTER_TOOLS?lazy(()=>import('./PresenterTools')):null;
const termsVersion='2026-10-13';
const permissionSetupKey='crosswise_permission_setup_v1';

export function ProductApp(){
 const prefs=useStore(productPreferences),notice=useStore(controller.notice),journey=useStore(controller.journey.state),ui=useStore(controller.ui),saved=useStore(controller.savedPlaces.state);
 const permission=useCameraPermission();
 const nearbyPrefs=useStore(nearbySettings),voice=useStore(controller.voice.state);
 const [nearbyOn,setNearbyOn]=useState(false);
 const nearbyReader=useRef<NearbyReader|null>(null);nearbyReader.current??=new NearbyReader(text=>controller.sayNavigation(text,50));
 const [page,setPage]=useState(prefs.termsVersion===termsVersion?'permissionSetup':'welcome');const [walkMounted,setWalkMounted]=useState(false),[error,setError]=useState('');
 const [speechStartupVisible,setSpeechStartupVisible]=useState(true);
 const [initialMotionRequest,setInitialMotionRequest]=useState<Promise<MotionPermissionResult>|null>(null);
 const [endConfirm,setEndConfirm]=useState(false);
 useEffect(()=>{if(speechStartupVisible)return;const frame=requestAnimationFrame(focusActiveHeading);return()=>cancelAnimationFrame(frame);},[page,speechStartupVisible]);
 const stack=useRef<string[]>([]);const initial=useRef(true);
 const navigate=(target:string)=>{
  if(!allPages.includes(target))return;
  if(target===page)return;
  stack.current.push(page);history.pushState({crosswiseProduct:target},'');setPage(target);setError('');
  if(target==='walk')setWalkMounted(true);
 };
 const childBack=()=>!window.dispatchEvent(new Event('crosswise-product-back',{cancelable:true}));
 const back=()=>{if(page==='welcome'||childBack())return;if(stack.current.length)history.back();else navigate('home');};
 useEffect(()=>{if(initial.current){history.replaceState({crosswiseProduct:page},'');initial.current=false;}},[page]);
 useEffect(()=>{const restore=(event:PopStateEvent)=>{if(childBack()){history.pushState({crosswiseProduct:page},'');return;}const target=event.state?.crosswiseProduct;if(typeof target==='string'&&allPages.includes(target)){stack.current.pop();setPage(target);if(target==='walk')setWalkMounted(true);}};window.addEventListener('popstate',restore);const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!speechStartupVisible&&!document.querySelector('dialog[open]')){event.preventDefault();back();}};window.addEventListener('keydown',escape);return()=>{window.removeEventListener('popstate',restore);window.removeEventListener('keydown',escape);};});
 const crossing=ui.snapshot.mode===AssistMode.CROSSING||journey.crossing;
 useEffect(()=>{controller.setProductBrowsing(page!=='walk'&&prefs.readerFriendly);controller.setHomeVisible(page==='walk'||crossing);return()=>controller.setHomeVisible(false);},[page,crossing,prefs.readerFriendly]);
 useLayoutEffect(()=>()=>{if((page==='routes'||page==='areas')&&controller.journey.state.value.busy==='starting')controller.journey.pause();},[page]);
 useEffect(()=>{
  const reader=nearbyReader.current!;let watch:number|null=null;
  const update=()=>{if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;reader.stop();
   if(page!=='walk'||!nearbyOn||crossing||voice.phase!=='off'||document.hidden||!nearbyPrefs.radius||!navigator.geolocation)return;
   watch=navigator.geolocation.watchPosition(position=>{void reader.update({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp},demoNearbySettings(nearbyPrefs)).catch(()=>{/* Explicit Nearby screen reports service errors; background narration remains quiet. */});},()=>setError('Nearby announcements could not get your location. Open Nearby to retry.'),{enableHighAccuracy:true,maximumAge:0,timeout:15000});};
  update();document.addEventListener('visibilitychange',update);return()=>{document.removeEventListener('visibilitychange',update);if(watch!==null)navigator.geolocation?.clearWatch(watch);reader.stop();};
 },[page,nearbyOn,crossing,voice.phase,nearbyPrefs]);
 useEffect(()=>{if(journey.phase==='arrived'&&page==='walk')navigate('arrival');},[journey.phase,page]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>controller.clearNotice(),6000);return()=>clearTimeout(timer);},[notice]);
 const walk=(_place?:PlaceCandidate)=>navigate('walk');
 const openRouteGuidance=(placeId?:string)=>{
  const active=journey.phase==='walking'||journey.phase==='paused';
  if(active&&!controller.planner.state.value.replacing){
   if(!controller.changeDestination()){setError('Finish crossing before changing destination.');return;}
  }else if(!active)controller.planner.reset();
  controller.closeMap();
  if(!placeId){navigate('places');return;}
  void controller.planner.resolve(placeId).then(()=>{
   if(controller.planner.state.value.selected)navigate('places');
   else setError(controller.planner.state.value.error??'Could not check this place. Open Route guidance to search again.');
  });
 };
  const completePermissionSetup=()=>{try{localStorage.setItem(permissionSetupKey,'done');}catch{setError('Permission setup could not be saved on this device.');}setInitialMotionRequest(null);history.replaceState({crosswiseProduct:'home'},'');setPage('home');};
 const end=async()=>{setEndConfirm(false);if(crossing){setError('Confirm the far footpath before ending this walk.');return;}if(PRESENTER_TOOLS)await (await import('./local/recorder')).walkingRecorder.stop();setNearbyOn(false);nearbyReader.current?.reset();controller.stopNavigation();controller.releaseCamera();setWalkMounted(false);navigate('home');};
 const settingsTool=settingsPages.includes(page as SettingsPage);const supportTool=supportPages.includes(page as typeof supportPages[number]);
 return <div className="cw-shell" style={{fontSize:prefs.textSize==='extra'?'28px':prefs.textSize==='large'?'24px':'20px'}}>
  {walkMounted&&<div className="cw-walk-host" style={{display:page==='walk'?'flex':'none'}} aria-hidden={page!=='walk'||speechStartupVisible} inert={speechStartupVisible}>
   <nav className="cw-walk-nav" aria-label="Walking tools"><Action secondary onClick={()=>navigate('home')}>Home</Action><Action secondary onClick={()=>navigate('tools')}>Tools</Action><Action secondary onClick={()=>setEndConfirm(true)}>End walk</Action></nav>
   <div className="cw-walk-content"><JourneyScreen onSettings={()=>navigate('settings')} onOpenRouteGuidance={openRouteGuidance} hidden={page!=='walk'} {...permission}/></div>
  </div>}
  {page!=='walk'&&<div className="cw-overlay" aria-hidden={speechStartupVisible} inert={speechStartupVisible}>
   {page==='home'&&<main className="cw-home"><h1 tabIndex={-1}>CrossWise</h1><p className="cw-eyebrow">Your walking companion</p><div className="cw-home-buttons"><button className="cw-feature" aria-label="Route guidance" onClick={()=>{controller.planner.reset();navigate('places');}}><svg aria-hidden="true" viewBox="0 0 32 32"><path d="M4 7l8-3 8 3 8-3v21l-8 3-8-3-8 3zM12 4v21M20 7v21"/></svg><strong>Route guidance</strong><span>Search places, view Google Maps and follow directions</span></button><button className="cw-feature" aria-label="Road crossing" onClick={()=>navigate('walk')}><svg aria-hidden="true" viewBox="0 0 32 32"><circle cx="18" cy="5" r="3"/><path d="M14 13l4-4 3 7 5 2M18 10l-3 10 6 9M15 20l-7 8M14 13l-6 5"/></svg><strong>Road crossing</strong><span>Camera assistance and pedestrian signal observations</span></button></div><Action onClick={()=>navigate('settings')}>Settings</Action><div className="cw-home-links"><Action secondary onClick={()=>navigate('help')}>Help</Action>{PRESENTER_TOOLS&&<Action secondary onClick={()=>navigate('presenter')}>Presenter setup</Action>}</div>{journey.phase==='walking'||journey.phase==='paused'?<Action onClick={()=>navigate('walk')}>Return to walk: {journey.route?.destination}</Action>:null}<p className="cw-version">CrossWise · {import.meta.env.VITE_RELEASE_LABEL??'Local preview'}</p></main>}
    {page==='welcome'&&<Page title="Welcome to CrossWise"><p>Walking navigation and on-device camera assistance.</p><p>Keep using your mobility aid and established walking skills. Camera observations, GPS and map instructions may be incomplete. No signal observation establishes that it is safe to cross.</p><p>Camera detection stays on this device. Maps and nearby searches need online services. Next, you can allow camera, location, microphone and supported phone motion permissions.</p><div className="cw-actions"><Action secondary onClick={()=>navigate('terms')}>Read use information</Action><Action secondary onClick={()=>navigate('privacy')}>Privacy</Action><Action onClick={()=>{try{setInitialMotionRequest(requestMotionPermission());updateProductPreferences(p=>({...p,termsVersion}));navigate('permissionSetup');}catch{setError('Could not save your preference. Check storage and try again.');}}}>Agree and continue</Action></div></Page>}
    {page==='permissionSetup'&&<PermissionSetup onBack={back} onContinue={completePermissionSetup} active={!speechStartupVisible} initialMotionRequest={initialMotionRequest}/>}
   {page==='arrival'&&<Page title="Journey completed" onBack={()=>navigate('home')}><h2>{journey.route?.destination??'Your destination'}</h2><p>You confirmed arrival. Check the final entrance using your established mobility skills.</p>{journey.route&&<p>Planned route length: {Math.round(journey.route.distanceMeters)} metres.</p>}<div className="cw-actions"><Action onClick={()=>{controller.journey.end();controller.closeMap();navigate('walk');}}>Continue Road crossing</Action><Action secondary onClick={()=>{controller.journey.end();controller.planner.reset();navigate('places');}}>Choose another destination</Action><Action secondary onClick={()=>{const home=saved.items.find(p=>p.role==='home');if(home){void controller.planner.resolve(home.placeId).then(()=>{if(controller.planner.state.value.selected){controller.journey.end();navigate('places');}else setError(controller.planner.state.value.error??'Home could not be loaded. Open Home settings to review it.');});}else{controller.journey.end();navigate('homePlaces');}}}>Route Home</Action><Action secondary onClick={()=>setEndConfirm(true)}>End walk</Action></div></Page>}
   {settingsTool&&<ProductSettings page={page as SettingsPage} onBack={back} onOpen={navigate}/>}
   {supportTool&&<SupportScreen page={page as typeof supportPages[number]} onBack={back} onOpen={navigate}/>}
   {['places','homePlaces','managePlaces'].includes(page)&&<PlacesScreen onBack={back} onWalk={walk} onMyRoutes={PRESENTER_TOOLS?()=>navigate('routes'):undefined} intent={page==='homePlaces'?'home':page==='managePlaces'?'manage':'navigate'}/>}
   {(page==='nearby'||page==='facilities')&&<NearbyScreen key={page} onBack={back} initialView={page==='facilities'?'settings':'list'} onNavigate={place=>{controller.planner.select(place);navigate('places');}}/>}
   {PresenterTools&&<Suspense fallback={<Notice>Loading presenter tools...</Notice>}><PresenterTools page={page} onBack={back} onOpen={navigate} onError={setError}/></Suspense>}
   {page==='tools'&&<Page title="Walking tools" onBack={back}>
    <Row label="Repeat instruction" onClick={()=>controller.repeatGuidance()}/>
    <Row label="Route overview" onClick={()=>navigate('overview')}/>
    <Row label="Nearby places" onClick={()=>navigate('nearby')}/>
    <Row label={nearbyOn?'Stop nearby announcements':'Start nearby announcements'} onClick={()=>setNearbyOn(v=>!v)}/>
    <p>Nearby announcements run only while the walking screen is visible, with a search radius enabled.</p>
    <Row label="Change destination" onClick={()=>{if(controller.changeDestination())navigate('places');else setError('Finish crossing before changing destination.');}}/>
    {journey.route&&<Row label={journey.phase==='paused'?'Resume navigation':'Pause navigation'} onClick={()=>{if(journey.phase==='paused')void controller.startJourney().then(ok=>{if(ok)navigate('walk');});else controller.pauseJourney();}}/>}
    <Row label="End walk" onClick={()=>setEndConfirm(true)}/>
   </Page>}
   {PRESENTER_TOOLS&&page==='presenter'&&<Page title="Presenter setup" onBack={back}><p>Preparation tools. These are excluded from the public demo build.</p><Row label="My Routes" onClick={()=>navigate('routes')}/><Row label="Recordings" onClick={()=>navigate('recordings')}/><Row label="Data management" onClick={()=>navigate('data')}/><Row label="Advanced" onClick={()=>navigate('advanced')}/></Page>}
   {page==='overview'&&<Page title="Route overview" onBack={back}>{journey.route?<><h2>{journey.route.destination}</h2><p>{Math.round(journey.route.distanceMeters)} metres. {journey.route.durationSeconds?`Estimated ${Math.round(journey.route.durationSeconds/60)} minutes.`:'Duration unknown for authored routes.'}</p><ol>{journey.route.steps.map((s,i)=><li key={i}><p>{s.instruction} · {Math.round(s.distanceMeters)} m</p></li>)}</ol>{journey.route.warnings.map(w=><p key={w}>{w}</p>)}<Action onClick={()=>{controller.openMap();navigate('walk');}}>Show map</Action></>:<Notice>No active route. Choose a destination to review a route.</Notice>}</Page>}
  </div>}
  {speechStartupVisible&&<SpeechPackStartup onDone={()=>{
   setSpeechStartupVisible(false);
  }}/>}
  {notice&&<div className="cw-global-notice"><Notice>{notice}</Notice></div>}{error&&<div className="cw-global-notice"><Notice error>{error}</Notice><button onClick={()=>setError('')}>Dismiss</button></div>}
  {endConfirm&&<ConfirmDialog title="End this walk?" confirmLabel="End walk" onCancel={()=>setEndConfirm(false)} onConfirm={()=>{void end();}}><p>Stops navigation, camera assistance and nearby announcements.</p>{crossing&&<p>Finish crossing before ending the walk.</p>}</ConfirmDialog>}
 </div>;
}
