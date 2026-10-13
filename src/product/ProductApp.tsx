import { useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore } from 'react';
import { controller } from '../state/controller';
import { useStore } from '../state/store';
import { useCameraPermission } from '../platform/cameraPermission';
import { JourneyScreen } from '../ui/JourneyScreen';
import { SettingsScreen } from '../ui/SettingsScreen';
import { GuideScreen } from '../ui/GuideScreen';
import { PracticeScreen } from '../ui/PracticeScreen';
import { AssistMode } from '../crossing/crossingEngine';
import { Action,ConfirmDialog,Notice,Page,Row } from './ProductPage';
import { ProductSettings,type SettingsPage } from './ProductSettings';
import { SupportScreen } from './SupportScreen';
import { PlacesScreen } from './PlacesScreen';
import { NearbyScreen } from './NearbyScreen';
import { LocalToolsScreen } from './LocalToolsScreen';
import { CloudToolsScreen } from './CloudToolsScreen';
import { productPreferences,updateProductPreferences } from './preferences';
import { walkingRecorder } from './local/recorder';
import { type AuthoredRoute } from './local/routes';
import { authoredJourney } from './authoredJourney';
import type { GeoPoint,PlaceCandidate } from '../nav/navigation';
import { NearbyReader,nearbySettings } from '../nav/nearby';
import { collectBackup } from './cloud/api';
import { foregroundSharing } from './cloud/sharing';
import { refreshDeviceData,importDeviceData,resetDeviceData } from './dataLifecycle';

const settingsPages=['settings','speed','preference','objects','types','feedback','startup','display','permissions'] as const;
const localPages=['routes','recordings','data','areas'] as const;
const cloudPages=['account','backup','monitoring','photo','access','insurance','headphones'] as const;
const supportPages=['help','holding','direction','about','terms','privacy','samples'] as const;
const allPages=['home','welcome','walk','arrival','places','homePlaces','managePlaces','nearby','facilities','tools','more','overview','advanced','guide','practice',...settingsPages,...localPages,...cloudPages,...supportPages];
const termsVersion='2026-10-13';

export function ProductApp(){
 const prefs=useStore(productPreferences),notice=useStore(controller.notice),journey=useStore(controller.journey.state),planner=useStore(controller.planner.state),ui=useStore(controller.ui),camera=useStore(controller.cameraStatus),saved=useStore(controller.savedPlaces.state),recorder=useStore(walkingRecorder.state);
 const permission=useCameraPermission();
 const nearbyPrefs=useStore(nearbySettings),voice=useStore(controller.voice.state);
 const sharing=useSyncExternalStore(foregroundSharing.subscribe,foregroundSharing.getSnapshot);
 const [nearbyOn,setNearbyOn]=useState(false);
 const nearbyReader=useRef<NearbyReader|null>(null);nearbyReader.current??=new NearbyReader(text=>controller.sayNavigation(text,50));
 const [page,setPage]=useState(prefs.termsVersion===termsVersion?'home':'welcome');const [walkMounted,setWalkMounted]=useState(false),[error,setError]=useState('');
 const [endConfirm,setEndConfirm]=useState(false),[pendingAuthored,setPendingAuthored]=useState<AuthoredRoute|null>(null);
 const stack=useRef<string[]>([]);const initial=useRef(true);const autoStarted=useRef(false);
 const navigate=(target:string)=>{
  if(!allPages.includes(target))return;
  if(target===page)return;
  stack.current.push(page);history.pushState({crosswiseProduct:target},'');setPage(target);setError('');
  if(target==='walk')setWalkMounted(true);
 };
 const childBack=()=>!window.dispatchEvent(new Event('crosswise-product-back',{cancelable:true}));
 const back=()=>{if(childBack())return;if(stack.current.length)history.back();else navigate('home');};
 useEffect(()=>{if(initial.current){history.replaceState({crosswiseProduct:page},'');initial.current=false;}},[page]);
 useEffect(()=>{const restore=(event:PopStateEvent)=>{if(childBack()){history.pushState({crosswiseProduct:page},'');return;}const target=event.state?.crosswiseProduct;if(typeof target==='string'&&allPages.includes(target)){stack.current.pop();setPage(target);if(target==='walk')setWalkMounted(true);}};window.addEventListener('popstate',restore);const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))back();};window.addEventListener('keydown',escape);return()=>{window.removeEventListener('popstate',restore);window.removeEventListener('keydown',escape);};});
 const crossing=ui.snapshot.mode===AssistMode.CROSSING||journey.crossing;
 useEffect(()=>{controller.setProductBrowsing(page!=='walk'&&prefs.readerFriendly);controller.setHomeVisible(page==='walk'||crossing);return()=>controller.setHomeVisible(false);},[page,crossing,prefs.readerFriendly]);
 useLayoutEffect(()=>()=>{if((page==='routes'||page==='areas')&&controller.journey.state.value.busy==='starting')controller.journey.pause();},[page]);
 useEffect(()=>{
  const reader=nearbyReader.current!;let watch:number|null=null;
  const update=()=>{if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;reader.stop();
   if(page!=='walk'||!nearbyOn||crossing||voice.phase!=='off'||document.hidden||!nearbyPrefs.radius||!navigator.geolocation)return;
   watch=navigator.geolocation.watchPosition(position=>{void reader.update({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp},nearbyPrefs).catch(()=>{/* Explicit Nearby screen reports service errors; background narration remains quiet. */});},()=>setError('Nearby announcements could not get your location. Open Nearby to retry.'),{enableHighAccuracy:true,maximumAge:0,timeout:15000});};
  update();document.addEventListener('visibilitychange',update);return()=>{document.removeEventListener('visibilitychange',update);if(watch!==null)navigator.geolocation?.clearWatch(watch);reader.stop();};
 },[page,nearbyOn,crossing,voice.phase,nearbyPrefs]);
 useEffect(()=>{if(page==='home'&&prefs.termsVersion===termsVersion&&!autoStarted.current){autoStarted.current=true;if(prefs.autoStroll)navigate('walk');}},[page,prefs.autoStroll,prefs.termsVersion]);
 useEffect(()=>{if(camera==='running'&&page==='walk'){void walkingRecorder.maybeAutoStart(controller.getCameraStream());}},[camera,page]);
 useEffect(()=>{if(journey.phase==='arrived'&&page==='walk')navigate('arrival');},[journey.phase,page]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>controller.clearNotice(),6000);return()=>clearTimeout(timer);},[notice]);
 useEffect(()=>{const restored=()=>{void refreshDeviceData().catch(()=>setError('Device data could not be refreshed. Reload the app to retry.'));};window.addEventListener('crosswise-data-restored',restored);return()=>window.removeEventListener('crosswise-data-restored',restored);},[]);
 const walk=(_place?:PlaceCandidate)=>navigate('walk');
 const navigateCoordinate=(point:GeoPoint,name:string)=>{controller.planner.select({id:`coordinate:${crypto.randomUUID()}`,name,address:'User coordinate',point,endpoint:'coordinate'});navigate('places');};
 const startAuthored=async(route:AuthoredRoute)=>{
  if(crossing)throw new Error('Finish crossing before changing route.');
  if(controller.journey.hasJourney)controller.journey.pause();
  const started=await controller.journey.start(authoredJourney(route));
  if(!started)throw new Error(controller.journey.state.value.error??'The authored route could not start. Check your position near its first waypoint.');
  controller.queueInitialGuidance();
  navigate('walk');
 };
 const end=async()=>{setEndConfirm(false);if(crossing){setError('Confirm the far footpath before ending this walk.');return;}await walkingRecorder.stop();setNearbyOn(false);nearbyReader.current?.reset();foregroundSharing.stop();controller.stopNavigation();controller.releaseCamera();setWalkMounted(false);navigate('home');};
 const localTool=localPages.includes(page as typeof localPages[number]);const cloudTool=cloudPages.includes(page as typeof cloudPages[number]);
 const settingsTool=settingsPages.includes(page as SettingsPage);const supportTool=supportPages.includes(page as typeof supportPages[number]);
 return <div className="cw-shell" style={{fontSize:prefs.textSize==='extra'?'28px':prefs.textSize==='large'?'24px':'20px'}}>
  {walkMounted&&<div className="cw-walk-host" style={{display:page==='walk'?'flex':'none'}} aria-hidden={page!=='walk'}>
   <nav className="cw-walk-nav" aria-label="Walking tools"><Action secondary onClick={()=>navigate('home')}>Home</Action><Action secondary onClick={()=>navigate('tools')}>Tools</Action><Action secondary onClick={()=>navigate('nearby')}>Nearby</Action><Action secondary onClick={()=>setNearbyOn(v=>!v)}>{nearbyOn?'Stop nearby announcements':'Start nearby announcements'}</Action><Action secondary onClick={()=>setEndConfirm(true)}>End walk</Action></nav>
   <div className="cw-walk-content"><JourneyScreen onSettings={()=>navigate('settings')} hidden={page!=='walk'} {...permission}/></div>
  </div>}
  {page!=='walk'&&<div className="cw-overlay">
   {page==='home'&&<main className="cw-home"><h1>CrossWise</h1><p>Walking guidance and camera assistance</p><div className="cw-home-buttons"><button className="cw-circle" onClick={()=>{controller.planner.reset();navigate('places');}}>Route guidance</button><button className="cw-circle" onClick={()=>navigate('walk')}>Stroll</button></div><Action onClick={()=>navigate('settings')}>Settings</Action><div className="cw-home-links"><Action secondary onClick={()=>navigate('more')}>More tools</Action><Action secondary onClick={()=>navigate('help')}>Help and practice</Action></div>{journey.phase==='walking'||journey.phase==='paused'?<Action onClick={()=>navigate('walk')}>Return to walk: {journey.route?.destination}</Action>:null}{recorder.status==='recording'&&<p role="status">Recording continues. Open Recordings to stop.</p>}<p className="cw-version">CrossWise 0.2 · Research access</p></main>}
   {page==='welcome'&&<Page title="Welcome to CrossWise" onBack={()=>navigate('home')}><p>Walking navigation, local camera assistance and optional tools in one app.</p><p>Keep using your mobility aid and established walking skills. Camera observations, GPS, map instructions and AI answers may be incomplete. No signal observation establishes that it is safe to cross.</p><p>Camera detection stays on this device. Maps and optional cloud tools need online services; permissions are requested when you use them.</p><div className="cw-actions"><Action secondary onClick={()=>navigate('terms')}>Read use information</Action><Action secondary onClick={()=>navigate('privacy')}>Privacy</Action><Action onClick={()=>{try{updateProductPreferences(p=>({...p,termsVersion}));navigate('home');}catch{setError('Could not save your preference. Check storage and try again.');}}}>Agree and continue</Action></div></Page>}
   {page==='arrival'&&<Page title="Journey completed" onBack={()=>navigate('home')}><h2>{journey.route?.destination??'Your destination'}</h2><p>You confirmed arrival. Check the final entrance using your established mobility skills.</p>{journey.route&&<p>Planned route length: {Math.round(journey.route.distanceMeters)} metres.</p>}<div className="cw-actions"><Action onClick={()=>{controller.journey.end();controller.closeMap();navigate('walk');}}>Continue Stroll</Action><Action secondary onClick={()=>{controller.journey.end();controller.planner.reset();navigate('places');}}>Choose another destination</Action><Action secondary onClick={()=>{const home=saved.items.find(p=>p.role==='home');if(home){void controller.planner.resolve(home.placeId).then(()=>{if(controller.planner.state.value.selected){controller.journey.end();navigate('places');}else setError(controller.planner.state.value.error??'Home could not be loaded. Open Home settings to review it.');});}else{controller.journey.end();navigate('homePlaces');}}}>Route Home</Action><Action secondary onClick={()=>setEndConfirm(true)}>End walk</Action></div></Page>}
   {settingsTool&&<ProductSettings page={page as SettingsPage} onBack={back} onOpen={navigate}/>}
   {supportTool&&<SupportScreen page={page as typeof supportPages[number]} onBack={back} onOpen={navigate}/>}
   {['places','homePlaces','managePlaces'].includes(page)&&<PlacesScreen onBack={back} onWalk={walk} onMyRoutes={()=>navigate('routes')} onOpenTools={()=>navigate('tools')} intent={page==='homePlaces'?'home':page==='managePlaces'?'manage':'navigate'}/>}
   {(page==='nearby'||page==='facilities')&&<NearbyScreen key={page} onBack={back} initialView={page==='facilities'?'settings':'list'} onNavigate={place=>{controller.planner.select(place);navigate('places');}}/>}
   {localTool&&<LocalToolsScreen tool={page as typeof localPages[number]} onBack={back} onNavigateCoordinate={navigateCoordinate} onStartAuthoredRoute={route=>{if(authoredJourney(route).route.distanceMeters>1000){setPendingAuthored(route);return;}return startAuthored(route);}} availablePlaces={saved.items.flatMap(p=>{const candidate=controller.savedPlaces.getCandidate(p.placeId);return candidate?[{name:candidate.name,...candidate.point}]:[];})} extraExport={collectBackup} onExtraImport={importDeviceData} onExtraReset={resetDeviceData} dataMutationBlocked={crossing||journey.phase==='walking'||journey.phase==='paused'||journey.busy!==null||planner.busy!==null}/>}
   {cloudTool&&<CloudToolsScreen tool={page as typeof cloudPages[number]} onBack={back}/>}
   {page==='advanced'&&<SettingsScreen onBack={back} onOpenGuide={()=>navigate('guide')} onOpenPractice={()=>navigate('practice')}/>}
   {page==='guide'&&<GuideScreen onBack={back}/>} {page==='practice'&&<PracticeScreen onBack={back}/>}
   {(page==='tools'||page==='more')&&<Page title={page==='tools'?'Toolbox':'More tools'} onBack={back}>{page==='tools'&&<><Row label="Repeat instruction" onClick={()=>controller.repeatGuidance()}/><Row label="Route overview" onClick={()=>navigate('overview')}/><Row label="Direction check" onClick={()=>navigate('direction')}/><Row label="Nearby places" onClick={()=>navigate('nearby')}/><Row label="Change destination" onClick={()=>{if(controller.changeDestination())navigate('places');else setError('Finish crossing before changing destination.');}}/><Row label={journey.phase==='paused'?'Resume navigation':'Pause navigation'} onClick={()=>{if(journey.phase==='paused')void controller.startJourney().then(ok=>{if(ok)navigate('walk');});else controller.pauseJourney();}}/></>}{([['routes','My Routes'],['recordings','Recordings'],['monitoring','Monitoring'],['photo','Photo questions'],['headphones','Headphones'],['areas','Special areas'],['account','Account'],['backup','Backup and restore'],['access','Research access'],['insurance','Insurance availability'],['data','Data management'],['help','Help and practice']] as const).map(([id,label])=><Row key={id} label={label} onClick={()=>navigate(id)}/>)}{page==='tools'&&<Row label="End walk" onClick={()=>setEndConfirm(true)}/>}</Page>}
   {page==='overview'&&<Page title="Route overview" onBack={back}>{journey.route?<><h2>{journey.route.destination}</h2><p>{Math.round(journey.route.distanceMeters)} metres. {journey.route.durationSeconds?`Estimated ${Math.round(journey.route.durationSeconds/60)} minutes.`:'Duration unknown for authored routes.'}</p><ol>{journey.route.steps.map((s,i)=><li key={i}><p>{s.instruction} · {Math.round(s.distanceMeters)} m</p></li>)}</ol>{journey.route.warnings.map(w=><p key={w}>{w}</p>)}<Action onClick={()=>{controller.openMap();navigate('walk');}}>Show map</Action></>:<Notice>No active route. Choose a destination to review a route.</Notice>}</Page>}
  </div>}
  {sharing.publishing&&page!=='walk'&&<div className="cw-sharing"><Action secondary onClick={()=>navigate('monitoring')}>{sharing.paused?'Location sharing paused':'Location sharing active'} · Manage</Action></div>}
  {notice&&<div className="cw-global-notice"><Notice>{notice}</Notice></div>}{error&&<div className="cw-global-notice"><Notice error>{error}</Notice><button onClick={()=>setError('')}>Dismiss</button></div>}
  {endConfirm&&<ConfirmDialog title="End this walk?" confirmLabel="End walk" onCancel={()=>setEndConfirm(false)} onConfirm={()=>{void end();}}><p>Stops navigation, camera assistance, nearby announcements, local recording and this device's live location publishing. Existing sharing invitations remain available until you revoke them in Monitoring.</p>{crossing&&<p>Finish crossing before ending the walk.</p>}</ConfirmDialog>}
  {pendingAuthored&&<ConfirmDialog title="This route is over 1 kilometre" confirmLabel="Start authored route" onCancel={()=>setPendingAuthored(null)} onConfirm={()=>{const route=pendingAuthored;setPendingAuthored(null);void startAuthored(route).catch(e=>setError(e instanceof Error?e.message:'Could not start.'));}}><p>Review the authored path and make sure you are near its first waypoint.</p></ConfirmDialog>}
 </div>;
}
