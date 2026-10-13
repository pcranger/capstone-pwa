import { usableFix, type LocationFix } from '../nav/navigation';
export function currentLocation(signal?: AbortSignal): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is unavailable in this browser. Enter coordinates or search an address.')); return; }
    if (signal?.aborted) { reject(new Error('Request cancelled.')); return; }
    let done = false;
    const finish = (error?: Error, fix?: LocationFix) => { if (done) return; done = true; signal?.removeEventListener('abort', cancel); if (error) reject(error); else resolve(fix!); };
    const cancel = () => finish(new Error('Request cancelled.')); signal?.addEventListener('abort', cancel, { once: true });
    navigator.geolocation.getCurrentPosition(p => {
      const fix = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp };
      if (!usableFix(fix, Date.now())) finish(new Error(`Location is not accurate enough${fix.accuracy === null ? '' : ` (±${Math.round(fix.accuracy)} metres)`}. Retry in an open area or enter coordinates.`));
      else finish(undefined, fix);
    }, e => finish(new Error(e.code === 1 ? 'Location permission denied. Enable it in browser settings, search an address or enter coordinates.' : 'Could not get a fresh location. Retry in an open area.')), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
}
