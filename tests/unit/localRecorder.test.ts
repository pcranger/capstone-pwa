import { afterEach, expect, test, vi } from 'vitest';
import { WalkingRecorder, DEFAULT_RECORDER_SETTINGS, validateRecorderSettings } from '../../src/product/local/recorder';
import { retentionRemovals, type RecordingMeta, type RecordingStorage } from '../../src/product/local/recordingStore';

const meta = (id: string, bytes = 10, protectedClip = false): RecordingMeta => ({ id, startedAt: Number(id) || 0, durationMs: 1000, bytes, protected: protectedClip, audio: false, mimeType: 'video/webm', interrupted: false, walkId: 'walk' });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
test('rolling retention deletes only oldest unprotected clips and observes both limits', () => {
  expect(retentionRemovals([meta('1'), meta('2', 10, true), meta('3')], meta('4'), { maxClips: 3, maxBytes: 100 })).toEqual(['1']);
  expect(retentionRemovals([meta('1'), meta('2', 10, true), meta('3')], meta('4'), { maxClips: 10, maxBytes: 20 })).toEqual(['1', '3']);
  expect(() => retentionRemovals([meta('1', 20, true)], meta('2'), { maxClips: 1, maxBytes: 20 })).toThrow('Protected');
  expect(() => retentionRemovals([], meta('1', 100), { maxClips: 3, maxBytes: 20 })).toThrow('exceeds');
});
test('recorder settings bound clip duration, capacity and corrupt imports', () => {
  expect(validateRecorderSettings(DEFAULT_RECORDER_SETTINGS)).toEqual(DEFAULT_RECORDER_SETTINGS);
  expect(() => validateRecorderSettings({ ...DEFAULT_RECORDER_SETTINGS, clipMinutes: -1 })).toThrow();
  expect(() => validateRecorderSettings({ ...DEFAULT_RECORDER_SETTINGS, maxClips: Infinity })).toThrow();
});
class FakeStream {
  constructor(private tracks: MediaStreamTrack[] = []) {}
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getTracks() { return this.tracks; }
}
class FakeRecorder {
  state: RecordingState = 'inactive'; mimeType = 'video/webm';
  onstop: (() => void) | null = null; ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(['recorded-video'], { type: this.mimeType }) }); this.onstop?.(); }); }
}
function fixture(fail = false) {
  vi.stubGlobal('MediaStream', FakeStream);
  const track = { readyState: 'live', kind: 'video', stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaStreamTrack;
  const source = new FakeStream([track]) as unknown as MediaStream;
  const clips: { meta: RecordingMeta; blob: Blob }[] = [];
  const storage: RecordingStorage = { list: vi.fn(async () => clips.map(c => c.meta)), getBlob: vi.fn(async id => clips.find(c => c.meta.id === id)?.blob),
    commit: vi.fn(async (m, blob) => { if (fail) throw new Error('Device storage is full.'); clips.push({ meta: m, blob }); }), protect: vi.fn(), remove: vi.fn() };
  const recorders: FakeRecorder[] = [];
  const microphone = vi.fn(async (): Promise<MediaStream> => { throw new Error('denied'); });
  const recorder = new WalkingRecorder(storage, { create: () => { const r = new FakeRecorder(); recorders.push(r); return r as unknown as MediaRecorder; }, microphone });
  return { recorder, source, track, clips, storage, recorders, microphone };
}
test('records shared video, handles denied audio and awaits committed clip without stopping camera', async () => {
  vi.useFakeTimers(); const f = fixture();
  await f.recorder.start(f.source, { ...DEFAULT_RECORDER_SETTINGS, enabled: true, includeAudio: true });
  expect(f.recorder.state.value.status).toBe('recording'); expect(f.recorder.state.value.audio).toBe(false);
  expect(f.recorder.state.value.error).toContain('silent');
  await vi.advanceTimersByTimeAsync(1250); f.recorder.protectCurrent();
  f.recorder.pause(); await vi.advanceTimersByTimeAsync(3000); f.recorder.resume(); await vi.advanceTimersByTimeAsync(1000);
  await f.recorder.stop();
  expect(f.clips).toHaveLength(1); expect(f.clips[0].meta.protected).toBe(true); expect(f.clips[0].meta.durationMs).toBe(2250);
  expect(f.clips[0].blob.size).toBeGreaterThan(0); expect(f.track.stop).not.toHaveBeenCalled();
  expect(f.recorder.state.value.status).toBe('idle');
});
test('rotation saves complete clips and starts fresh recording, interrupted stop labels final clip', async () => {
  vi.useFakeTimers(); const f = fixture();
  await f.recorder.start(f.source, { ...DEFAULT_RECORDER_SETTINGS, enabled: true, clipMinutes: 1 });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(f.clips).toHaveLength(1); expect(f.recorders).toHaveLength(2);
  expect(f.clips[0].meta.durationMs).toBe(60_000);
  await vi.advanceTimersByTimeAsync(1000); await f.recorder.stop(true);
  expect(f.clips[1].meta.interrupted).toBe(true); expect(f.clips[1].meta.walkId).toBe(f.clips[0].meta.walkId);
});
test('quota error preserves unsaved Blob for export/retry and never reports saved', async () => {
  const f = fixture(true);
  await f.recorder.start(f.source, { ...DEFAULT_RECORDER_SETTINGS, enabled: true }); await f.recorder.stop();
  expect(f.recorder.state.value.status).toBe('error'); expect(f.recorder.state.value.clipsSaved).toBe(0);
  expect(f.recorder.state.value.unsaved?.blob.size).toBeGreaterThan(0); expect(f.track.stop).not.toHaveBeenCalled();
  await expect(f.recorder.start(f.source, { ...DEFAULT_RECORDER_SETTINGS, enabled: true })).rejects.toThrow('unsaved');
  f.storage.commit = vi.fn(async () => undefined); await f.recorder.retryUnsaved();
  expect(f.recorder.state.value.status).toBe('idle'); expect(f.recorder.state.value.unsaved).toBeNull();
});
test('stopping a pending microphone request cancels without leaking the audio track', async () => {
  const f = fixture(); let resolve!: (stream: MediaStream) => void;
  const micTrack = { kind: 'audio', stop: vi.fn() } as unknown as MediaStreamTrack;
  const recorder = new WalkingRecorder(f.storage, { create: () => new FakeRecorder() as unknown as MediaRecorder,
    microphone: () => new Promise(r => { resolve = r; }) });
  const started = recorder.start(f.source, { ...DEFAULT_RECORDER_SETTINGS, enabled: true, includeAudio: true });
  await Promise.resolve(); await recorder.stop();
  resolve(new FakeStream([micTrack]) as unknown as MediaStream); await started;
  expect(micTrack.stop).toHaveBeenCalledOnce(); expect(recorder.state.value.status).toBe('idle');
});
test('natural source stop is awaited through storage commit before data reset can proceed', async () => {
  const f = fixture(); let commit!: () => void;
  f.storage.commit = vi.fn(() => new Promise<void>(resolve => { commit = resolve; }));
  await f.recorder.start(f.source, { ...DEFAULT_RECORDER_SETTINGS, enabled: true });
  // Native MediaRecorder can become inactive before its queued data and stop callbacks run.
  f.recorders[0].stop();
  const stopped = vi.fn(); const pending = f.recorder.stop(true).then(stopped);
  await Promise.resolve(); await Promise.resolve();
  expect(stopped).not.toHaveBeenCalled(); expect(f.recorder.state.value.status).toBe('finalizing');
  commit(); await pending;
  expect(stopped).toHaveBeenCalledOnce(); expect(f.recorder.state.value.status).toBe('idle');
});
