import { BoxF } from '../core/geometry';
import type { PedestrianScene } from './pedestrianTypes';

/** A separate worker keeps the existing vehicle detector independent. One frame in flight. */
export class PedestrianClient {
  private worker: Worker;
  private ready = false;
  private busy = false;
  private active = true;
  private sentAt = -Infinity;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingImage: { pixels: ImageData; timestampMs: number } | null = null;
  private canvas = document.createElement('canvas');
  private context = this.canvas.getContext('2d', { willReadFrequently: true })!;
  constructor(private receive: (scene: PedestrianScene) => void) {
    this.worker = new Worker(new URL('./pedestrian.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = event => {
      if (!this.active) return;
      const message = event.data;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      if (message.type === 'ready') { this.ready = true; if (this.pendingImage) { const pending = this.pendingImage; this.pendingImage = null; this.send(pending.pixels, pending.timestampMs); } return; }
      this.busy = false;
      if (message.type === 'error') { console.warn('Pedestrian detector failed:', message.error); this.receive({ timestampMs: message.timestampMs, observations: [], error: 'Pedestrian detection unavailable.' }); return; }
      if (message.type === 'result') this.receive({ ...message, observations: message.observations.map((o: { box: BoxF }) => ({ ...o, box: new BoxF(o.box.left, o.box.top, o.box.right, o.box.bottom) })) });
    };
    this.worker.onerror = event => { console.warn('Pedestrian worker error:', event.message); this.fail(); };
    this.worker.postMessage({ type: 'init', base: document.baseURI });
    this.timer = setTimeout(() => this.fail(), 45000);
  }
  private fail() {
    if (!this.active) return;
    this.receive({ timestampMs: -Infinity, observations: [], error: 'Pedestrian detection unavailable. Restart camera to retry.' });
    this.dispose();
  }
  capture(video: HTMLVideoElement, timestampMs: number) {
    if (!this.active || !this.ready || this.busy || timestampMs - this.sentAt < 700 || !video.videoWidth || !video.videoHeight) return;
    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale), height = Math.round(video.videoHeight * scale);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.context.drawImage(video, 0, 0, width, height);
    const pixels = this.context.getImageData(0, 0, width, height);
    this.send(pixels, timestampMs);
  }
  analyzeImage(pixels: ImageData, timestampMs: number) {
    if (!this.active) return;
    if (!this.ready) this.pendingImage = { pixels, timestampMs };
    else if (!this.busy) this.send(pixels, timestampMs);
  }
  private send(pixels: ImageData, timestampMs: number) {
    this.busy = true; this.sentAt = timestampMs;
    this.worker.postMessage({ type: 'frame', timestampMs, width: pixels.width, height: pixels.height, buffer: pixels.data.buffer }, [pixels.data.buffer]);
    this.timer = setTimeout(() => this.fail(), 10000);
  }
  dispose() { this.active = false; if (this.timer) clearTimeout(this.timer); this.timer = null; this.worker.terminate(); }
}
