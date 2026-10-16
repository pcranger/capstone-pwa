import { Store } from '../../state/store';
import { localId } from './routes';
import { recordingStorage, DEFAULT_RECORDING_LIMITS, type RecordingMeta, type RecordingStorage } from './recordingStore';

export interface RecorderSettings {
  enabled: boolean; autoStart: boolean; includeAudio: boolean; clipMinutes: number; maxClips: number; maxBytes: number;
}
export const RECORDER_SETTINGS_KEY = 'crosswise_recorder_settings_v1';
export const DEFAULT_RECORDER_SETTINGS: RecorderSettings = { enabled: false, autoStart: false, includeAudio: false, clipMinutes: 5, ...DEFAULT_RECORDING_LIMITS };
export function validateRecorderSettings(value: unknown): RecorderSettings {
  const v = value as RecorderSettings;
  if (!v || typeof v.enabled !== 'boolean' || typeof v.autoStart !== 'boolean' || typeof v.includeAudio !== 'boolean' ||
      ![1, 3, 5].includes(v.clipMinutes) || !Number.isInteger(v.maxClips) || v.maxClips < 1 || v.maxClips > 100 ||
      !Number.isFinite(v.maxBytes) || v.maxBytes < 10_000_000 || v.maxBytes > 10_000_000_000) throw new Error('Invalid recording settings.');
  return { enabled: v.enabled, autoStart: v.autoStart, includeAudio: v.includeAudio, clipMinutes: v.clipMinutes, maxClips: v.maxClips, maxBytes: v.maxBytes };
}
const settings = (): RecorderSettings => {
  try { const raw = globalThis.localStorage?.getItem(RECORDER_SETTINGS_KEY); return raw ? validateRecorderSettings(JSON.parse(raw)) : { ...DEFAULT_RECORDER_SETTINGS }; }
  catch { return { ...DEFAULT_RECORDER_SETTINGS }; }
};
export const recorderSettings = new Store(settings());
export function reloadRecorderSettings(): void { recorderSettings.set(settings()); }
export function saveRecorderSettings(next: RecorderSettings): void {
  const valid = validateRecorderSettings(next);
  try { globalThis.localStorage.setItem(RECORDER_SETTINGS_KEY, JSON.stringify(valid)); }
  catch { throw new Error('Recording settings could not be saved. Check device storage.'); }
  recorderSettings.set(valid);
}
export function recordingMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type)) ?? '';
}
interface RecorderState {
  status: 'idle' | 'starting' | 'recording' | 'paused' | 'finalizing' | 'error'; elapsedMs: number; mimeType: string;
  audio: boolean; protected: boolean; clipsSaved: number; bytesSaved: number; error: string | null;
  unsaved: { meta: RecordingMeta; blob: Blob } | null;
}
interface Dependencies {
  create?: (stream: MediaStream, mimeType: string) => MediaRecorder;
  microphone?: () => Promise<MediaStream>;
  now?: () => number;
}
const initial = (): RecorderState => ({ status: 'idle', elapsedMs: 0, mimeType: '', audio: false, protected: false, clipsSaved: 0, bytesSaved: 0, error: null, unsaved: null });
/** One shared-camera recorder; finalized clips are independently playable, not arbitrary timeslice fragments. */
export class WalkingRecorder {
  readonly state = new Store<RecorderState>(initial());
  private recorder: MediaRecorder | null = null;
  private source: MediaStream | null = null;
  private microphone: MediaStream | null = null;
  private recordingStream: MediaStream | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private pausedAt: number | null = null;
  private pausedMs = 0;
  private continueRecording = false;
  private interrupted = false;
  private walkId = '';
  private activeSettings: RecorderSettings = { ...DEFAULT_RECORDER_SETTINGS };
  private finishing: Promise<void> | null = null;
  private clipFinished: Promise<void> | null = null;
  private settle: (() => void) | null = null;
  private readonly now: () => number;
  private generation = 0;
  constructor(private storage: RecordingStorage = recordingStorage, private deps: Dependencies = {}) {
    this.now = deps.now ?? Date.now;
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.recorder) void this.stop(true);
    });
  }
  async maybeAutoStart(source: MediaStream | null): Promise<void> {
    const options = recorderSettings.value;
    if (options.enabled && options.autoStart && source && this.state.value.status === 'idle') await this.start(source, options);
  }
  async start(source: MediaStream | null, options = recorderSettings.value): Promise<void> {
    if (!['idle', 'error'].includes(this.state.value.status)) throw new Error('Recording is already active.');
    if (this.state.value.unsaved) throw new Error('Export or discard the unsaved clip before starting another recording.');
    const valid = validateRecorderSettings(options);
    if (!valid.enabled) throw new Error('Enable the walking recorder in Recorder settings first.');
    if (!source?.getVideoTracks().some(t => t.readyState === 'live')) throw new Error('Start Road crossing and allow the camera before recording.');
    const mime = this.deps.create ? 'video/webm' : recordingMime();
    if (mime === null) throw new Error('Video recording is unavailable in this browser. Try a browser with MediaRecorder support.');
    const generation = ++this.generation;
    this.state.set({ ...initial(), status: 'starting' });
    this.activeSettings = valid; this.source = source; this.walkId = localId();
    let notice: string | null = null;
    try {
      // Test storage before requesting an optional microphone or starting a video writer.
      await this.storage.list();
      let microphone: MediaStream | null = null;
      if (valid.includeAudio) {
        try { microphone = await (this.deps.microphone?.() ?? navigator.mediaDevices.getUserMedia({ audio: true, video: false })); }
        catch { notice = 'Microphone was unavailable. This recording contains silent video.'; }
      }
      if (generation !== this.generation) {
        microphone?.getTracks().forEach(t => t.stop()); return;
      }
      this.microphone = microphone;
      if (!source.getVideoTracks().some(t => t.readyState === 'live')) throw new Error('Camera was interrupted before recording started. Retry the camera.');
      this.recordingStream = new MediaStream([...source.getVideoTracks(), ...(this.microphone?.getAudioTracks() ?? [])]);
      source.getVideoTracks().forEach(t => t.addEventListener('ended', this.onSourceEnded));
      this.continueRecording = true;
      this.state.update(s => ({ ...s, mimeType: mime, audio: !!this.microphone?.getAudioTracks().length, error: notice }));
      this.beginClip();
    } catch (e) {
      if (generation !== this.generation) return;
      this.cleanup(); this.state.update(s => ({ ...s, status: 'error', error: e instanceof Error ? e.message : 'Could not start recording.' }));
      throw e;
    }
  }
  private onSourceEnded = () => { void this.stop(true); };
  private duration(): number {
    return Math.max(0, (this.pausedAt ?? this.now()) - this.startedAt - this.pausedMs);
  }
  private beginClip(): void {
    if (!this.recordingStream) return;
    const recorder = this.deps.create?.(this.recordingStream, this.state.value.mimeType) ?? new MediaRecorder(this.recordingStream, {
      ...(this.state.value.mimeType ? { mimeType: this.state.value.mimeType } : {}), videoBitsPerSecond: 1_500_000,
    });
    this.recorder = recorder; this.startedAt = this.now(); this.pausedAt = null; this.pausedMs = 0; this.interrupted = false;
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onerror = () => { this.state.update(s => ({ ...s, error: 'Recording was interrupted by the browser.' })); void this.stop(true); };
    recorder.onstop = () => {
      if (this.timer) clearInterval(this.timer); this.timer = null;
      this.state.update(s => ({ ...s, status: 'finalizing', elapsedMs: this.duration() }));
      this.finishing ??= this.clipFinished;
      void this.finalize(chunks, recorder.mimeType || this.state.value.mimeType);
    };
    recorder.start(1000);
    this.clipFinished = new Promise(resolve => { this.settle = resolve; });
    this.state.update(s => ({ ...s, status: 'recording', elapsedMs: 0, protected: false, mimeType: recorder.mimeType || s.mimeType }));
    this.timer = setInterval(() => {
      const elapsedMs = this.duration(); this.state.update(s => ({ ...s, elapsedMs }));
      if (recorder.state === 'recording' && elapsedMs >= this.activeSettings.clipMinutes * 60_000) this.endClip();
    }, 250);
  }
  pause(): void {
    if (this.recorder?.state !== 'recording') return;
    this.recorder.pause(); this.pausedAt = this.now();
    this.state.update(s => ({ ...s, status: 'paused', elapsedMs: this.duration() }));
  }
  resume(): void {
    if (this.recorder?.state !== 'paused' || this.pausedAt === null) return;
    this.pausedMs += this.now() - this.pausedAt; this.pausedAt = null;
    this.recorder.resume(); this.state.update(s => ({ ...s, status: 'recording' }));
  }
  protectCurrent(): void { this.state.update(s => ({ ...s, protected: !s.protected })); }
  private endClip(): Promise<void> {
    if (this.finishing) return this.finishing;
    if (!this.recorder) return Promise.resolve();
    if (this.timer) clearInterval(this.timer); this.timer = null;
    this.state.update(s => ({ ...s, status: 'finalizing', elapsedMs: this.duration() }));
    this.finishing = this.clipFinished ?? new Promise(resolve => { this.settle = resolve; });
    const finishing = this.finishing;
    // The browser may already have ended the recorder's stream and queued onstop.
    // Keep awaiting that clip's real commit rather than racing a data reset.
    if (this.recorder.state === 'inactive') return finishing;
    try { this.recorder.stop(); }
    catch {
      this.continueRecording = false; this.cleanup();
      this.state.update(s => ({ ...s, status: 'error', error: 'The browser could not finalize this clip. Previously saved recordings are preserved.' }));
      this.settle?.(); this.settle = null; this.finishing = null;
    }
    return finishing;
  }
  async stop(interrupted = false): Promise<void> {
    this.continueRecording = false; this.interrupted ||= interrupted;
    if (this.state.value.status === 'starting') {
      ++this.generation; this.cleanup(); this.state.set(initial()); return;
    }
    await this.endClip();
  }
  private async finalize(chunks: Blob[], mimeType: string): Promise<void> {
    const oldSettle = this.settle;
    const blob = new Blob(chunks, { type: mimeType });
    const meta: RecordingMeta = { id: localId(), walkId: this.walkId, startedAt: this.startedAt, durationMs: this.state.value.elapsedMs,
      bytes: blob.size, mimeType, audio: this.state.value.audio, protected: this.state.value.protected, interrupted: this.interrupted };
    let saved = false;
    try {
      if (blob.size === 0) throw new Error('The browser returned an empty clip. Nothing was saved.');
      await this.storage.commit(meta, blob, this.activeSettings);
      saved = true;
      this.state.update(s => ({ ...s, clipsSaved: s.clipsSaved + 1, bytesSaved: s.bytesSaved + blob.size, unsaved: null }));
      this.recorder = null; this.finishing = null; this.clipFinished = null; this.settle = null;
      if (this.continueRecording && this.source?.getVideoTracks().some(t => t.readyState === 'live')) this.beginClip();
      else { this.cleanup(); this.state.update(s => ({ ...s, status: 'idle' })); }
    } catch (e) {
      this.continueRecording = false; this.cleanup();
      this.state.update(s => ({ ...s, status: 'error', error: e instanceof Error ? e.message : 'This clip could not be saved.', unsaved: !saved && blob.size ? { meta, blob } : null }));
      this.finishing = null; this.clipFinished = null; this.settle = null;
    } finally { oldSettle?.(); }
  }
  discardUnsaved(): void {
    if (this.state.value.status === 'error') this.state.set(initial());
  }
  async retryUnsaved(): Promise<void> {
    const unsaved = this.state.value.unsaved;
    if (!unsaved) return;
    this.state.update(s => ({ ...s, status: 'finalizing' }));
    try {
      await this.storage.commit(unsaved.meta, unsaved.blob, recorderSettings.value);
      this.state.update(s => ({ ...s, status: 'idle', unsaved: null, error: null, clipsSaved: s.clipsSaved + 1, bytesSaved: s.bytesSaved + unsaved.blob.size }));
    } catch (e) { this.state.update(s => ({ ...s, status: 'error', error: e instanceof Error ? e.message : 'Clip still could not be saved.' })); throw e; }
  }
  private cleanup(): void {
    if (this.timer) clearInterval(this.timer); this.timer = null;
    this.source?.getVideoTracks().forEach(t => t.removeEventListener('ended', this.onSourceEnded));
    // Only the optional microphone belongs to this tool. Never stop the detector's camera tracks.
    this.microphone?.getTracks().forEach(t => t.stop()); this.microphone = null;
    this.source = null; this.recordingStream = null; this.recorder = null;
  }
}
export const walkingRecorder = new WalkingRecorder();
