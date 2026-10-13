import { productRequest, ProductServiceError, type SharedPosition } from './api';
export interface CheckInTarget { latitude: number; longitude: number; label: string; radius: number; dwellSeconds: number }
interface SharingState { sessionId: string | null; publishing: boolean; paused: boolean; lastSentAt: number | null; error: string | null; target: CheckInTarget | null; checkedIn: boolean }
const initial: SharingState = { sessionId: null, publishing: false, paused: false, lastSentAt: null, error: null, target: null, checkedIn: false };
export function metersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number { const rad = Math.PI / 180, h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2; return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))); }
export class ForegroundSharing {
  private state: SharingState = initial;
  private listeners = new Set<() => void>();
  private watch: number | null = null;
  private sequence = 0;
  private insideSince: number | null = null;
  private lastInsideObservedAt: number | null = null;
  private dwellGeneration = 0;
  private watchGeneration = 0;
  private sending = false;
  private generation = 0;
  getSnapshot = (): SharingState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(value: Partial<SharingState>): void { this.state = { ...this.state, ...value }; this.listeners.forEach(l => l()); }
  private resetDwell(): void { this.insideSince = null; this.lastInsideObservedAt = null; ++this.dwellGeneration; }
  start(sessionId: string, lastSequence = 0): void {
    const sameSession=this.state.sessionId===sessionId;this.stop(); if (!navigator.geolocation) throw new Error('Location sharing is unavailable in this browser.');
    this.sequence = lastSequence; this.update({ sessionId, publishing: true, error: null,lastSentAt:null,...(!sameSession?{target:null,checkedIn:false}:{}) }); document.addEventListener('visibilitychange', this.visibility); this.visibility();
  }
  private visibility = (): void => {
    const watchGeneration = ++this.watchGeneration; this.resetDwell();
    if (this.watch !== null) navigator.geolocation.clearWatch(this.watch); this.watch = null;
    if (!this.state.publishing) return;
    const hidden = document.visibilityState === 'hidden'; this.update({ paused: hidden });
    if (!hidden) this.watch = navigator.geolocation.watchPosition(p => { if (watchGeneration === this.watchGeneration) void this.position(p); }, e => {
      if (watchGeneration !== this.watchGeneration) return;
      this.resetDwell(); this.update({ error: e.code === 1 ? 'Location permission was denied. Allow location in browser settings to share.' : 'A recent location is unavailable. Observers will see the last update as stale.' });
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  };
  arm(target: CheckInTarget | null): void {
    if (target && (!Number.isFinite(target.latitude) || Math.abs(target.latitude) > 90 || !Number.isFinite(target.longitude) || Math.abs(target.longitude) > 180 || !target.label.trim() || !Number.isFinite(target.radius) || target.radius < 20 || target.radius > 500 || !Number.isFinite(target.dwellSeconds) || target.dwellSeconds < 10 || target.dwellSeconds > 120)) throw new Error('Enter a valid target, radius of 20 to 500 metres and dwell of 10 to 120 seconds.');
    this.resetDwell(); this.update({ target: target ? { ...target } : null, checkedIn: false });
  }
  private async position(fix: GeolocationPosition): Promise<void> {
    const { sessionId, lastSentAt, target, checkedIn } = this.state, timestamp = Date.now(), generation = this.generation;
    if (!sessionId || this.state.paused || !this.state.publishing) return;
    const { latitude, longitude, accuracy } = fix.coords;
    if (!Number.isFinite(fix.timestamp) || fix.timestamp > timestamp || timestamp - fix.timestamp > 15000 || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180 || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) { this.resetDwell(); return; }
    // Inspect every observation before network throttling: a poor/outside fix
    // must break dwell even while another position is still being sent.
    if (target && !checkedIn && accuracy <= target.radius && metersBetween({ latitude, longitude }, target) + accuracy <= target.radius) {
      // No more than 15 seconds may pass without a fresh inside observation.
      // Wall-clock time in a hidden tab or a GPS gap never establishes arrival.
      if (this.lastInsideObservedAt === null || fix.timestamp <= this.lastInsideObservedAt || fix.timestamp - this.lastInsideObservedAt > 15000) this.resetDwell();
      this.insideSince ??= fix.timestamp; this.lastInsideObservedAt = fix.timestamp;
    } else this.resetDwell();
    const dwellGeneration = this.dwellGeneration;
    const arrived = target && !checkedIn && this.insideSince !== null && fix.timestamp - this.insideSince >= target.dwellSeconds * 1000;
    if (this.sending || (lastSentAt !== null && timestamp - lastSentAt < 15000)) return;
    this.sending = true;
    const point = { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy, observedAt: fix.timestamp, sequence: ++this.sequence };
    try {
      await productRequest<{ position: SharedPosition }>(`/shares/${sessionId}/position`, 'POST', point);
      if (generation !== this.generation) return;
      this.update({ lastSentAt: timestamp, error: null });
      if (arrived && target && this.state.publishing && !this.state.paused && !this.state.checkedIn && this.state.target === target && dwellGeneration === this.dwellGeneration && this.lastInsideObservedAt !== null && Date.now() - this.lastInsideObservedAt <= 15000) {
        await productRequest(`/shares/${sessionId}/check-in`, 'POST', { message: `Arrived near ${target.label}`, eventId: `target-${sessionId}-${target.latitude}-${target.longitude}` });
        if (generation === this.generation && dwellGeneration === this.dwellGeneration) this.update({ checkedIn: true });
      }
    } catch (error) { if (generation === this.generation) { this.resetDwell(); this.update({ error: error instanceof Error ? error.message : 'Location could not be sent.' }); if (error instanceof ProductServiceError && [401, 403, 404, 410].includes(error.status)) this.stop(); } }
    finally { this.sending = false; }
  }
  stop(): void { ++this.generation; ++this.watchGeneration; this.resetDwell(); if (this.watch !== null) navigator.geolocation.clearWatch(this.watch); this.watch = null; document.removeEventListener('visibilitychange', this.visibility); this.update({ publishing: false, paused: false }); }
}
export const foregroundSharing = new ForegroundSharing();
