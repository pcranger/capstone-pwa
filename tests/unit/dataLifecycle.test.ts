import {beforeEach,expect,test,vi} from 'vitest';
const mocks=vi.hoisted(()=>({
 journey:{state:{value:{phase:'idle',busy:null,crossing:false} as {phase:string;busy:string|null;crossing:boolean}},hasJourney:false,end:vi.fn()},
 planner:{state:{value:{busy:null as string|null}},reset:vi.fn()},
 recorder:{state:{value:{status:'idle'}}}, restore:vi.fn(),reload:vi.fn(),clear:vi.fn(),release:vi.fn(),stopVoice:vi.fn(),
}));
vi.mock('../../src/state/controller',()=>({controller:{journey:mocks.journey,planner:mocks.planner,ui:{value:{snapshot:{mode:'IDLE'}}},stopVoice:mocks.stopVoice,releaseCamera:mocks.release,logger:{clear:mocks.clear},savedPlaces:{load:vi.fn(async()=>{})},savedDetails:{set:vi.fn()},reloadSettings:mocks.reload}}));
vi.mock('../../src/product/preferences',()=>({reloadProductPreferences:vi.fn()}));
vi.mock('../../src/nav/nearby',()=>({reloadNearbySettings:vi.fn()}));
vi.mock('../../src/nav/routePreferences',()=>({reloadRoutePreference:vi.fn()}));
vi.mock('../../src/product/local/routes',()=>({localToolsRepository:{load:vi.fn()}}));
vi.mock('../../src/product/local/recorder',()=>({reloadRecorderSettings:vi.fn(),walkingRecorder:mocks.recorder}));
vi.mock('../../src/product/cloud/api',()=>({BACKUP_KEYS:['crosswise_settings','crosswise_local_tools_v1'],restoreBackup:mocks.restore}));
import {importDeviceData,refreshDeviceData,requireIdleData,resetDeviceData} from '../../src/product/dataLifecycle';
beforeEach(()=>{vi.clearAllMocks();mocks.journey.state.value={phase:'idle',busy:null,crossing:false};mocks.journey.hasJourney=false;mocks.planner.state.value.busy=null;mocks.recorder.state.value.status='idle';const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:vi.fn((key:string)=>values.delete(key))});});
test.each(['searching','routing','starting'])('pending journey %s blocks import and reset before any mutation',async busy=>{
 mocks.journey.state.value.busy=busy;
 expect(()=>requireIdleData()).toThrow('End navigation');
 await expect(importDeviceData({})).rejects.toThrow('End navigation');await expect(resetDeviceData()).rejects.toThrow('End navigation');
 expect(mocks.restore).not.toHaveBeenCalled();expect(localStorage.removeItem).not.toHaveBeenCalled();expect(mocks.journey.end).not.toHaveBeenCalled();
});
test('pending planner work also blocks destructive data changes',async()=>{mocks.planner.state.value.busy='routing';await expect(resetDeviceData()).rejects.toThrow('End navigation');expect(localStorage.removeItem).not.toHaveBeenCalled();});
test('reset clears arrived journey and camera intent before deleting device data',async()=>{
 mocks.journey.state.value.phase='arrived';await resetDeviceData();
 expect(mocks.journey.end).toHaveBeenCalled();expect(mocks.release).toHaveBeenCalled();expect(mocks.clear).toHaveBeenCalled();expect(localStorage.removeItem).toHaveBeenCalledWith('crosswise_local_tools_v1');expect(mocks.planner.reset).toHaveBeenCalled();
 expect(mocks.journey.end.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(localStorage.removeItem).mock.invocationCallOrder[0]);
});
test('refresh removes an inactive arrived route but retains an active journey',async()=>{mocks.journey.state.value.phase='arrived';await refreshDeviceData();expect(mocks.journey.end).toHaveBeenCalledTimes(1);mocks.journey.hasJourney=true;mocks.journey.state.value.phase='walking';await refreshDeviceData();expect(mocks.journey.end).toHaveBeenCalledTimes(1);});
