import { useEffect, useRef, useState } from 'react';
import { controller } from '../state/controller';
import { Action, Page } from './ProductPage';
import { hasMotionPermissionPrompt, readPermissionStates, requestMotionPermission, type MotionPermissionResult, type PermissionStates } from './permissions';

type Permission = 'camera' | 'location' | 'microphone' | 'motion';
type PermissionStatus = { state: PermissionStates[Permission] | 'requesting' | 'error'; message: string };
type Status = Record<Permission, PermissionStatus>;
export function PermissionSetup({ onBack, onContinue, active=true, initialMotionRequest }: { onBack: () => void; onContinue: () => void; active?: boolean; initialMotionRequest?: Promise<MotionPermissionResult> | null }) {
  const interacted=useRef(new Set<Permission>());
  const completed=useRef(false);
  const mounted=useRef(true);
  const automaticStarted=useRef(false);
  const inFlight=useRef(new Set<Permission>());
  const [status, setStatus] = useState<Status>({
    camera: { state: 'prompt', message: 'Not requested' },
    location: { state: 'prompt', message: 'Not requested' },
    microphone: { state: 'prompt', message: 'Not requested' },
    motion: hasMotionPermissionPrompt() ? { state: 'prompt', message: 'Not requested' } : { state: 'unavailable', message: 'No prompt needed on this browser' },
  });
  const update = (permission: Permission, state: PermissionStatus['state'], message: string) => {
    if(!mounted.current||completed.current)return;
    interacted.current.add(permission);setStatus(previous => ({ ...previous, [permission]: { state, message } }));
  };
  const busy = Object.values(status).some(value => value.state === 'requesting');
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    if(completed.current||!Object.values(status).every(value=>value.state==='granted'||value.state==='unavailable'))return;
    completed.current=true;onContinue();
  },[status,onContinue]);

  const camera = async () => {
    if(inFlight.current.has('camera'))return;inFlight.current.add('camera');
    update('camera', 'requesting', 'Requesting…');
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      update('camera', 'unavailable', 'Camera needs HTTPS and a supported browser.');
      inFlight.current.delete('camera');
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (stream.getVideoTracks().length) {
        controller.cameraPermission.set(true);
        update('camera', 'granted', 'Allowed. Camera is off until you start walking.');
      } else update('camera', 'error', 'No camera available. Check your device and retry.');
    } catch {
      update('camera', 'error', 'Could not access camera. Check browser permissions and retry.');
    } finally {
      stream?.getTracks().forEach(track => track.stop());
      inFlight.current.delete('camera');
    }
  };
  const location = async () => {
    if(inFlight.current.has('location'))return;inFlight.current.add('location');
    update('location', 'requesting', 'Requesting…');
    if (!navigator.geolocation || !window.isSecureContext) {
      update('location', 'unavailable', 'Location needs HTTPS and a browser with location support.');
      inFlight.current.delete('location');
      return;
    }
    try {
      await new Promise<void>(resolve => {
        navigator.geolocation.getCurrentPosition(
          () => { update('location', 'granted', 'Allowed. Location is used only when a walking feature needs it.'); resolve(); },
          error => {
            if(error.code===1){update('location','denied','Blocked. Allow location in browser settings and retry.');resolve();}
            else void readPermissionStates().then(states=>{
              update('location',states.location==='granted'?'granted':'error',states.location==='granted'?'Allowed. A location fix is not available yet.':'No location fix yet. Check device location and retry.');resolve();
            });
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
        );
      });
    } catch {
      update('location', 'error', 'Could not request location. Check browser permissions and retry.');
    } finally {
      inFlight.current.delete('location');
    }
  };
  const microphone = async () => {
    if(inFlight.current.has('microphone'))return;inFlight.current.add('microphone');
    update('microphone', 'requesting', 'Requesting…');
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      update('microphone', 'unavailable', 'Microphone needs HTTPS and a supported browser.');
      inFlight.current.delete('microphone');
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const allowed = stream.getAudioTracks().length > 0;
      update('microphone', allowed ? 'granted' : 'error', allowed ? 'Allowed. Microphone is off until you use voice.' : 'No microphone available. Check your device and retry.');
    } catch {
      update('microphone', 'error', 'Could not access microphone. Check browser permissions and retry.');
    } finally {
      stream?.getTracks().forEach(track => track.stop());
      inFlight.current.delete('microphone');
    }
  };
  const motion = async (pending?: Promise<MotionPermissionResult> | null) => {
    if(inFlight.current.has('motion'))return;inFlight.current.add('motion');
    update('motion', 'requesting', 'Requesting…');
    try {
      const result = await (pending??requestMotionPermission());
      if(result==='needs-gesture'){update('motion','prompt','Tap Allow motion to finish setup.');return;}
      if(result==='unavailable'){update('motion','unavailable','No prompt needed on this browser');return;}
      if(result==='error'){update('motion','error','Motion access unavailable. Phone angle cues may be unavailable.');return;}
      update('motion', result, result === 'granted' ? 'Allowed. Motion helps with phone angle cues.' : 'Blocked. Phone angle cues may be unavailable.');
    } finally {
      inFlight.current.delete('motion');
    }
  };
  const enableAll = () => {
    // Start each request from this click. Some browsers require a fresh gesture for a retry.
    if (hasMotionPermissionPrompt()&&status.motion.state!=='granted') void motion();
    if(status.camera.state!=='granted'&&status.camera.state!=='unavailable')void camera();
    if(status.location.state!=='granted'&&status.location.state!=='unavailable')void location();
    if(status.microphone.state!=='granted'&&status.microphone.state!=='unavailable')void microphone();
  };

  useEffect(()=>{
    if(!active)return;
    let cancelled=false;
    void readPermissionStates().then(states=>{
      if(cancelled||automaticStarted.current||completed.current)return;
      automaticStarted.current=true;
      setStatus(previous=>Object.fromEntries(Object.entries(states).map(([key,state])=>[key,interacted.current.has(key as Permission)?previous[key as Permission]:{state,message:state==='granted'?'Already allowed':state==='denied'?'Blocked in browser settings. Enable access there, then retry.':state==='unavailable'?'No permission prompt available on this browser':'Not requested'}])) as Status);
      if(states.camera==='prompt'&&!interacted.current.has('camera'))void camera();
      if(states.location==='prompt'&&!interacted.current.has('location'))void location();
      if(states.microphone==='prompt'&&!interacted.current.has('microphone'))void microphone();
      if(states.motion==='prompt'&&!interacted.current.has('motion'))void motion(initialMotionRequest);
    });
    return()=>{cancelled=true;};
  },[active,initialMotionRequest]);

  return <Page title="Set up permissions" onBack={onBack}>
    <div className="cw-actions"><Action onClick={()=>{if(!completed.current){completed.current=true;onContinue();}}}>Continue to CrossWise</Action></div>
    <p>CrossWise uses the camera for walking assistance and location for routes and nearby places. Voice commands use the microphone. On supported phones, motion access helps with phone angle cues.</p>
    <p>CrossWise requests missing permissions automatically. Accept the browser prompts to finish setup. If your browser requires a tap, use Enable all or an individual Allow button. You can also continue using the button above.</p>
    <Action disabled={busy} onClick={enableAll}>Enable all available permissions</Action>
    <div className="cw-card"><h2>Camera</h2><p role="status">{status.camera.message}</p><Action secondary disabled={busy} onClick={() => { void camera(); }}>Allow camera</Action></div>
    <div className="cw-card"><h2>Location</h2><p role="status">{status.location.message}</p><Action secondary disabled={busy} onClick={() => { void location(); }}>Allow location</Action></div>
    <div className="cw-card"><h2>Microphone</h2><p>For optional voice commands. Voice recognition also depends on browser support.</p><p role="status">{status.microphone.message}</p><Action secondary disabled={busy} onClick={() => { void microphone(); }}>Allow microphone</Action></div>
    {hasMotionPermissionPrompt() && <div className="cw-card"><h2>Motion</h2><p role="status">{status.motion.message}</p><Action secondary disabled={busy} onClick={() => { void motion(); }}>Allow motion</Action></div>}
  </Page>;
}
