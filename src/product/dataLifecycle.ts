import { controller } from '../state/controller';
import { AssistMode } from '../crossing/crossingEngine';
import { reloadProductPreferences } from './preferences';
import { reloadNearbySettings } from '../nav/nearby';
import { reloadRoutePreference } from '../nav/routePreferences';
import { localToolsRepository } from './local/routes';
import { reloadRecorderSettings, walkingRecorder } from './local/recorder';
import { BACKUP_KEYS, restoreBackup } from './cloud/api';

export function requireIdleData():void {
  const journey=controller.journey.state.value;
  if(journey.phase==='walking'||journey.phase==='paused'||journey.busy||controller.planner.state.value.busy||journey.crossing||controller.ui.value.snapshot.mode===AssistMode.CROSSING)
    throw new Error('End navigation and crossing before importing, restoring or resetting application data.');
  if(!['idle','error'].includes(walkingRecorder.state.value.status))throw new Error('Stop recording before restoring application data.');
}
export async function refreshDeviceData():Promise<void> {
  if(!controller.journey.hasJourney&&!controller.journey.state.value.busy)controller.journey.end();
  reloadProductPreferences(); reloadNearbySettings(); reloadRoutePreference(); reloadRecorderSettings();
  localToolsRepository.load(); await controller.savedPlaces.load(); controller.savedDetails.set({});
  controller.planner.reset(); controller.reloadSettings();
}
export async function importDeviceData(value:unknown):Promise<void> {
  requireIdleData(); restoreBackup(value as Parameters<typeof restoreBackup>[0]); await refreshDeviceData();
}
export async function resetDeviceData():Promise<void> {
  requireIdleData(); controller.journey.end();controller.stopVoice();controller.releaseCamera();controller.logger.clear();
  for(const key of BACKUP_KEYS)localStorage.removeItem(key);
  localStorage.removeItem('crosswise_places_sort');
  await refreshDeviceData();
}
