export type AppPermission = 'camera' | 'microphone' | 'location' | 'motion';
export type PermissionStates = Record<AppPermission, 'granted' | 'denied' | 'prompt' | 'unavailable'>;
export type MotionPermissionResult = 'granted' | 'denied' | 'unavailable' | 'needs-gesture' | 'error';
export function hasMotionPermissionPrompt() {
  return typeof (window.DeviceOrientationEvent as unknown as {requestPermission?:unknown})?.requestPermission === 'function';
}
/** Call directly from a click when possible; an existing grant can also resolve on entry. */
export async function requestMotionPermission(): Promise<MotionPermissionResult> {
  const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
  if(!orientation?.requestPermission)return 'unavailable';
  try { return await orientation.requestPermission(); }
  catch(error) { return error instanceof DOMException&&error.name==='NotAllowedError'?'needs-gesture':'error'; }
}
export async function readPermissionStates(): Promise<PermissionStates> {
  const query = async (name: string, supported: boolean): Promise<PermissionStates[AppPermission]> => {
    if (!supported) return 'unavailable';
    if (!navigator.permissions?.query) return 'prompt';
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        navigator.permissions.query({name:name as PermissionName}).then(result=>result.state),
        new Promise<'prompt'>(resolve=>{timer=setTimeout(()=>resolve('prompt'),1500);}),
      ]);
    } catch { return 'prompt'; } finally { clearTimeout(timer); }
  };
  const [camera,microphone,location] = await Promise.all([
    query('camera',!!navigator.mediaDevices?.getUserMedia),query('microphone',!!navigator.mediaDevices?.getUserMedia),query('geolocation',!!navigator.geolocation),
  ]);
  const motion = hasMotionPermissionPrompt() ? 'prompt' : 'unavailable';
  return {camera,microphone,location,motion};
}
export const permissionsNeedSetup = (states: PermissionStates) => Object.values(states).some(state=>state==='prompt'||state==='denied');
