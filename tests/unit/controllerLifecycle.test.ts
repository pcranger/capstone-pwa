import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AssistMode, EMPTY_SNAPSHOT, UserCommand } from '../../src/crossing/crossingEngine';
import { Cues, Priority } from '../../src/feedback/cue';
import type { WalkingRoute } from '../../src/nav/navigation';

const feedback = vi.hoisted(() => ({ spoken: [] as string[], finish: null as null | ((ok: boolean) => void) }));
vi.mock('../../src/browser', () => ({
  Feedback: class {
    settings: unknown;
    constructor(settings: unknown) { this.settings = settings; }
    unlock() {}
    vibrate() {}
    playTone() {}
    cancel() { feedback.finish?.(false); feedback.finish = null; }
    sayAndWait(text: string) { this.cancel(); feedback.spoken.push(text); return new Promise<boolean>(resolve => { feedback.finish = resolve; }); }
  },
  browserOrientation: vi.fn(), convertPredictions: vi.fn(), mediaError: () => 'Camera unavailable.',
}));

let controller: typeof import('../../src/state/controller')['controller'];
let documentEvents: EventTarget & { hidden: boolean };
let getUserMedia: ReturnType<typeof vi.fn>;
const route: WalkingRoute = {
  destination: 'Library', destinationAddress: '', distanceMeters: 100, durationSeconds: 100, warnings: [],
  points: [{ latitude: -33, longitude: 151 }, { latitude: -33.001, longitude: 151 }],
  steps: [{ instruction: 'Walk toward the library.', distanceMeters: 100, maneuver: '', points: [{ latitude: -33, longitude: 151 }, { latitude: -33.001, longitude: 151 }] }],
};
const freshPosition = () => ({ coords: { latitude: -33, longitude: 151, accuracy: 5 }, timestamp: Date.now() });
const stream = () => {
  const track = Object.assign(new EventTarget(), { readyState: 'live', stop: vi.fn(() => { track.readyState = 'ended'; }) });
  return { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); feedback.spoken = []; feedback.finish = null;
  const stored = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value); }, removeItem: (key: string) => { stored.delete(key); } });
  vi.stubGlobal('window', Object.assign(new EventTarget(), { isSecureContext: true }));
  documentEvents = Object.assign(new EventTarget(), { hidden: false }); vi.stubGlobal('document', documentEvents);
  getUserMedia = vi.fn(async () => stream());
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia },
    geolocation: { getCurrentPosition: (success: (position: ReturnType<typeof freshPosition>) => void) => success(freshPosition()), watchPosition: vi.fn(() => 1), clearWatch: vi.fn() },
  });
  controller = (await import('../../src/state/controller')).controller;
});
afterEach(() => { controller.journey.end(); controller.releaseCamera(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function startFromMenu() {
  controller.setProductBrowsing(true); controller.setHomeVisible(false);
  expect(await controller.journey.start({ destination: { id: 'library', name: 'Library', address: '', point: route.points[1] }, route })).toBe(true);
  controller.queueInitialGuidance();
}

it('holds initial guidance through menu cleanup and flushes it once after the walk handoff', async () => {
  await startFromMenu(); expect(feedback.spoken).toEqual([]);
  controller.setHomeVisible(false); controller.setProductBrowsing(false); controller.setHomeVisible(true);
  expect(feedback.spoken).toHaveLength(1); expect(feedback.spoken[0]).toContain('library');
  controller.setProductBrowsing(false); expect(feedback.spoken).toHaveLength(1);
});
it('does not replay pending initial guidance after the journey ends or its step changes', async () => {
  await startFromMenu(); controller.journey.end(); controller.setProductBrowsing(false); expect(feedback.spoken).toEqual([]);
  await startFromMenu(); controller.journey.state.update(s => ({ ...s, stepIndex: 1 })); controller.setProductBrowsing(false); expect(feedback.spoken).toEqual([]);
});
it('planned starts retain their first instruction across planner cleanup and the page handoff', async () => {
  controller.setProductBrowsing(true); controller.setHomeVisible(false);
  controller.planner.review({ id: 'library', name: 'Library', address: '', point: route.points[1] }, route);
  expect(await controller.startPlannedJourney()).toBe(true); expect(feedback.spoken).toEqual([]);
  controller.setHomeVisible(false); controller.setProductBrowsing(false); controller.setHomeVisible(true);
  expect(feedback.spoken).toHaveLength(1); expect(feedback.spoken[0]).toContain('library');
});
it('menu handoff retains guidance when screen-reader speech suppression is disabled', async () => {
  controller.setProductBrowsing(false); controller.setHomeVisible(false);
  expect(await controller.journey.start({ destination: { id: 'library', name: 'Library', address: '', point: route.points[1] }, route })).toBe(true);
  controller.queueInitialGuidance(); controller.setHomeVisible(false); feedback.spoken = [];
  controller.setProductBrowsing(false); controller.setHomeVisible(true);
  expect(feedback.spoken).toHaveLength(1);
});
it('an old pending initial instruction expires instead of replaying on a much later return', async () => {
  await startFromMenu(); vi.setSystemTime(Date.now() + 16000); controller.setProductBrowsing(false); expect(feedback.spoken).toEqual([]);
});
it('explicit route repeat speaks from menus while ordinary scene speech stays suppressed', async () => {
  await startFromMenu(); controller.sayNavigation('Ordinary scene.'); expect(feedback.spoken).toEqual([]);
  controller.repeatGuidance(); expect(feedback.spoken).toHaveLength(1); expect(feedback.spoken[0]).toContain('library');
});
it('explicit camera-status repeat works from a menu without an active route', () => {
  controller.setProductBrowsing(true); controller.setHomeVisible(false);
  vi.spyOn(controller.engine, 'command').mockReturnValue({ snapshot: EMPTY_SNAPSHOT, cues: [Cues.speakText('Camera status.', Priority.NORMAL)] });
  controller.repeatGuidance(); expect(feedback.spoken).toEqual(['Camera status.']);
});
it('preserves critical engine priority and caption when one frame also contains normal status', () => {
  controller.setProductBrowsing(false); controller.setHomeVisible(true);
  vi.spyOn(controller.engine, 'command').mockReturnValueOnce({ snapshot: EMPTY_SNAPSHOT, cues: [Cues.speakText('Ordinary status.', Priority.NORMAL)] })
    .mockReturnValueOnce({ snapshot: { ...EMPTY_SNAPSHOT, mode: AssistMode.CROSSING }, cues: [Cues.speakText('Ordinary tilt.', Priority.NORMAL), Cues.speakText('Critical vehicle.', Priority.CRITICAL)] });
  controller.command(UserCommand.REPEAT_STATUS); controller.command(UserCommand.REPEAT_STATUS);
  expect(feedback.spoken).toEqual(['Ordinary status.', 'Critical vehicle.']); expect(controller.ui.value.caption).toBe('Critical vehicle.');
});
it('manual camera release keeps permission but does not reacquire after backgrounding or a backend change', async () => {
  await controller.requestCamera(); expect(controller.cameraPermission.value).toBe(true); controller.releaseCamera();
  documentEvents.hidden = true; documentEvents.dispatchEvent(new Event('visibilitychange'));
  documentEvents.hidden = false; documentEvents.dispatchEvent(new Event('visibilitychange')); await flush();
  controller.updateSettings(s => ({ ...s, useGpu: !s.useGpu })); await flush();
  expect(getUserMedia).toHaveBeenCalledTimes(1); expect(controller.getCameraStream()).toBeNull();
});
it('background interruption resumes an intentionally active camera with fresh tracks', async () => {
  await controller.requestCamera(); const original = controller.getCameraStream()!;
  documentEvents.hidden = true; documentEvents.dispatchEvent(new Event('visibilitychange')); expect(original.getVideoTracks()[0].readyState).toBe('ended');
  documentEvents.hidden = false; documentEvents.dispatchEvent(new Event('visibilitychange')); await flush();
  expect(getUserMedia).toHaveBeenCalledTimes(2); expect(controller.getCameraStream()).not.toBeNull(); expect(controller.getCameraStream()).not.toBe(original);
});
it('a late camera grant after deliberate release is stopped and cannot reactivate the session', async () => {
  let grant: (value: MediaStream) => void = () => {}; getUserMedia.mockImplementationOnce(() => new Promise<MediaStream>(resolve => { grant = resolve; }));
  const request = controller.requestCamera(); controller.releaseCamera(); const late = stream(); grant(late); await request;
  documentEvents.hidden = true; documentEvents.dispatchEvent(new Event('visibilitychange')); documentEvents.hidden = false; documentEvents.dispatchEvent(new Event('visibilitychange')); await flush();
  expect(late.getVideoTracks()[0].readyState).toBe('ended'); expect(controller.getCameraStream()).toBeNull(); expect(getUserMedia).toHaveBeenCalledTimes(1);
});
it('a canceled pending grant cannot overwrite a new camera session or its resume intent', async () => {
  let grant: (value: MediaStream) => void = () => {}; getUserMedia.mockImplementationOnce(() => new Promise<MediaStream>(resolve => { grant = resolve; }));
  const first = controller.requestCamera(); controller.releaseCamera(); await controller.requestCamera(); const current = controller.getCameraStream();
  const late = stream(); grant(late); await first;
  expect(late.getVideoTracks()[0].readyState).toBe('ended'); expect(controller.getCameraStream()).toBe(current);
  documentEvents.hidden = true; documentEvents.dispatchEvent(new Event('visibilitychange')); documentEvents.hidden = false; documentEvents.dispatchEvent(new Event('visibilitychange')); await flush();
  expect(getUserMedia).toHaveBeenCalledTimes(3); expect(controller.getCameraStream()).not.toBeNull();
});

it('protected start commands cannot enter crossing or pause a route on unverified observations', async () => {
  controller.engine.command(UserCommand.START_ASSIST, 0);
  controller.command(UserCommand.START_CROSSING);
  expect(controller.engine.mode).toBe(AssistMode.SEARCHING);
  expect(controller.notice.value).toContain('Do not start');
  controller.command(UserCommand.TOGGLE_CROSSING);
  expect(controller.engine.mode).toBe(AssistMode.SEARCHING);
  await startFromMenu(); controller.crossingAction('start');
  expect(controller.journey.state.value.crossing).toBe(false);
});
it('an explicit existing-crossing report keeps assistance available even when no signal is verified', () => {
  controller.reportAlreadyCrossing(); expect(controller.engine.mode).toBe(AssistMode.CROSSING);
  controller.releaseCamera(); expect(controller.engine.mode).toBe(AssistMode.CROSSING);
  controller.crossingAction('finish'); expect(controller.engine.mode).toBe(AssistMode.SEARCHING);
});
