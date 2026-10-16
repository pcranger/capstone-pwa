import {useEffect,useState} from 'react';
import {controller} from '../state/controller';
import {useStore} from '../state/store';
import {AssistMode} from '../crossing/crossingEngine';
import {SettingsScreen} from '../ui/SettingsScreen';
import {GuideScreen} from '../ui/GuideScreen';
import {PracticeScreen} from '../ui/PracticeScreen';
import {LocalToolsScreen} from './LocalToolsScreen';
import {ConfirmDialog} from './ProductPage';
import {type AuthoredRoute} from './local/routes';
import {authoredJourney} from './authoredJourney';
import {collectBackup} from './local/backup';
import {refreshDeviceData,importDeviceData,resetDeviceData} from './dataLifecycle';
import {focusActiveHeading} from './focus';
export default function PresenterTools({page,onBack,onOpen,onError}:{page:string;onBack:()=>void;onOpen:(page:string)=>void;onError:(message:string)=>void}){
 const journey=useStore(controller.journey.state),planner=useStore(controller.planner.state),ui=useStore(controller.ui),saved=useStore(controller.savedPlaces.state);
 const [pending,setPending]=useState<AuthoredRoute|null>(null);
 const crossing=ui.snapshot.mode===AssistMode.CROSSING||journey.crossing;
 useEffect(()=>{const frame=requestAnimationFrame(focusActiveHeading);return()=>cancelAnimationFrame(frame);},[page]);
 useEffect(()=>{const restored=()=>{void refreshDeviceData().catch(()=>onError('Device data could not be refreshed. Reload to retry.'));};window.addEventListener('crosswise-data-restored',restored);return()=>window.removeEventListener('crosswise-data-restored',restored);},[onError]);
 const start=async(route:AuthoredRoute)=>{if(crossing)throw new Error('Finish crossing before changing route.');if(controller.journey.hasJourney)controller.journey.pause();if(!await controller.journey.start(authoredJourney(route)))throw new Error(controller.journey.state.value.error??'Check your position near the first waypoint.');controller.queueInitialGuidance();onOpen('walk');};
 return <>
 {(['routes','recordings','data'] as const).includes(page as 'routes'|'recordings'|'data')&&<LocalToolsScreen tool={page as 'routes'|'recordings'|'data'} onBack={onBack} onNavigateCoordinate={(point,name)=>{controller.planner.select({id:`coordinate:${crypto.randomUUID()}`,name,address:'User coordinate',point,endpoint:'coordinate'});onOpen('places');}} onStartAuthoredRoute={route=>{if(authoredJourney(route).route.distanceMeters>1000){setPending(route);return;}return start(route);}} availablePlaces={saved.items.flatMap(p=>{const candidate=controller.savedPlaces.getCandidate(p.placeId);return candidate?[{name:candidate.name,...candidate.point}]:[];})} extraExport={collectBackup} onExtraImport={importDeviceData} onExtraReset={resetDeviceData} dataMutationBlocked={crossing||journey.phase==='walking'||journey.phase==='paused'||journey.busy!==null||planner.busy!==null}/>}
 {page==='advanced'&&<SettingsScreen onBack={onBack} onOpenGuide={()=>onOpen('guide')} onOpenPractice={()=>onOpen('practice')}/>}
 {page==='guide'&&<GuideScreen onBack={onBack}/>} {page==='practice'&&<PracticeScreen onBack={onBack}/>}
 {pending&&<ConfirmDialog title="This route is over 1 kilometre" confirmLabel="Start authored route" onCancel={()=>setPending(null)} onConfirm={()=>{const route=pending;setPending(null);void start(route).catch(e=>onError(e instanceof Error?e.message:'Could not start.'));}}><p>Review the authored path and make sure you are near its first waypoint.</p></ConfirmDialog>}
 </>;
}
