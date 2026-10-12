import {test,expect,vi} from "vitest";
import { NavigationVoice, voiceIntent } from '../../src/voice/navigationVoice';
import { expectsVoiceAnswer, V } from '../../src/voice/speechCatalog';
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

test('search, choice, start and long-trip confirmation stay conversational; directions close the microphone', async () => {
  let capture: ReturnType<typeof deferred<string>>;
  const input = { prepare: vi.fn(async () => {}), listen: vi.fn(ready => {
    capture = deferred<string>(); ready(); return capture.promise;
  }), cancel: vi.fn(() => capture?.reject(new Error('Voice off.'))) };
  const handle = vi.fn().mockResolvedValueOnce('1. Town Hall. 2. Library. Say one or two.')
    .mockResolvedValueOnce(V.place('Town Hall', 'Sydney')).mockResolvedValueOnce(V.longTrip)
    .mockResolvedValueOnce(V.longTripAnswer).mockResolvedValueOnce('Head north on George Street.');
  const announceListening = vi.fn(async () => true);
  const voice = new NavigationVoice({ input, handle, say: async () => true, ready: () => {}, cancel: () => {}, announceListening });
  voice.start(null); await flush();
  for (const command of ['search Town Hall', 'one', 'start', 'maybe']) {
    capture!.resolve(command); await flush();
    expect(voice.active).toBe(true);
    expect(voice.state.value.phase).toBe('listening');
  }
  capture!.resolve('yes'); await flush(); await voice.whenStopped();
  expect(voice.active).toBe(false);
  expect(voice.state.value.phase).toBe('off');
  expect(handle).toHaveBeenCalledTimes(5);
});

test('follow-up policy covers questions and choices without opening the microphone for directions or fatal errors', () => {
  for (const text of [V.longTrip, V.longTripAnswer, V.destination, V.place('Library', 'Sydney'),
    V.unknown, V.routeUnavailable, '1. A. 2. B. 3. C. Say one, two, or three.']) expect(expectsVoiceAnswer(text)).toBe(true);
  for (const text of [V.paused, V.stopped, V.microphoneIOS, V.voiceRecovery, 'Turn left onto Question Street.']) expect(expectsVoiceAnswer(text)).toBe(false);
});

test('microphone timeout during a question waits for speech completion then listens for the answer', async () => {
  const speech = deferred<boolean>();
  const answer = deferred<string>();
  const input = { prepare: async () => {}, listen: vi.fn()
    .mockRejectedValueOnce(new Error('No speech heard.'))
    .mockImplementation(ready => { ready(); return answer.promise; }),
    cancel: vi.fn(() => { if (input.listen.mock.calls.length > 1) answer.reject(new Error('Voice off.')); }) };
  const voice = new NavigationVoice({ input, say: () => speech.promise, handle: vi.fn(), ready: () => {}, cancel: () => {} });
  voice.start(V.longTrip); await flush();
  expect(voice.active).toBe(true);
  expect(input.listen).toHaveBeenCalledTimes(1);
  speech.resolve(true); await flush();
  expect(voice.state.value.phase).toBe('listening');
  voice.stop(); await voice.whenStopped();
});

test('commands preserve explicit intent and never interpret acknowledgements as permission to move', () => {
  expect(voiceIntent('Navigate to Central Library.')).toEqual({ kind: 'destination', query: 'Central Library', navigate: true });
  expect(voiceIntent('Search for Central Library')).toEqual({ kind: 'destination', query: 'Central Library', navigate: false });
  expect(voiceIntent('Central Library')).toBeNull();
  expect(voiceIntent('Central Library')).toBeNull();
  expect(voiceIntent('Save as Home')).toEqual({ kind: 'save', alias: 'Home' });
  expect(voiceIntent('second')).toEqual({ kind: 'choose', index: 1 });
  expect(voiceIntent('Next instruction')).toEqual({kind:'next'});
  expect(voiceIntent('Arrived')).toEqual({kind:'arrived'});
  expect(voiceIntent('Finish crossing')).toEqual({kind:'finishCrossing'});
  expect(voiceIntent('yes')).toEqual({kind:'yes'});
  expect(voiceIntent('no')).toEqual({kind:'no'});
  expect(voiceIntent('cancel search')).toEqual({kind:'cancel'});
  for (const word of ['okay', 'stop', 'cross now', 'I am across', 'Held', 'And journey', 'where am I', 'save as', 'navigate to']) expect(voiceIntent(word)).toBeNull();
});

test('first-time flow waits for completed speech, gives readiness feedback and executes one final transcript', async () => {
  const speech = deferred<boolean>(); const transcript = deferred<string>(); const next = deferred<string>(); let rejectBarge!: (error: Error) => void;
  const barge = new Promise<string>((_, reject) => { rejectBarge = reject; });
  const input = { prepare: vi.fn(async () => undefined), listen: vi.fn().mockImplementationOnce(() => barge).mockImplementationOnce(ready => { ready(); return transcript.promise; }).mockImplementation(() => next.promise), cancel: vi.fn(() => { rejectBarge(new Error('Voice off.')); next.reject(new Error('Voice off.')); }) };
  const handle = vi.fn(async () => 'Navigating to Library. Head north.'); const ready = vi.fn();
  const announceListening = vi.fn(async () => true);
  const say = vi.fn().mockReturnValueOnce(speech.promise).mockResolvedValue(true);
  const voice = new NavigationVoice({ input, say, ready, handle, cancel: vi.fn(), announceListening });
  voice.start('Welcome. Say your destination.'); await flush(); expect(input.listen).toHaveBeenCalledTimes(1);
  speech.resolve(true); await flush(); expect(ready).toHaveBeenCalledTimes(1);
  transcript.resolve('Library'); await flush(); expect(handle).toHaveBeenCalledTimes(1);
  expect(announceListening).toHaveBeenCalledTimes(1);
  expect(say).toHaveBeenCalledWith('Navigating to Library. Head north.');
  voice.stop(); await flush(); expect(voice.active).toBe(false);
});

test('a command spoken during a list announcement interrupts speech and is handled immediately', async () => {
  const speech = deferred<boolean>();
  const transcript = deferred<string>();
  const input = {
    prepare: vi.fn(async () => undefined),
    listen: vi.fn().mockImplementationOnce(() => transcript.promise).mockImplementation(() => new Promise<string>(() => {})),
    cancel: vi.fn(),
  };
  const say = vi.fn().mockReturnValue(speech.promise);
  const handle = vi.fn(async (text: string) => text === 'first' ? 'Starting the first place.' : null);
  const stopSpeech = vi.fn(async () => undefined);
  const voice = new NavigationVoice({ input, say, handle, ready: vi.fn(), cancel: vi.fn(), stopSpeech });
  voice.start('1. Town Hall. 2. Library. Say one or two.');
  await flush();
  expect(input.listen).toHaveBeenCalledTimes(1);
  transcript.resolve('first');
  await flush();
  expect(stopSpeech).toHaveBeenCalledTimes(1);
  expect(handle).toHaveBeenCalledWith('first', expect.any(Function));
  expect(say).toHaveBeenCalledWith('Starting the first place.');
  speech.resolve(true);
  voice.stop();
  await flush();
});

test('interruption rejects a late transcript and restarting waits for native capture shutdown', async () => {
  const first = deferred<string>(); const second = deferred<string>();
  const input = { prepare: vi.fn(async () => undefined), listen: vi.fn().mockReturnValueOnce(first.promise).mockReturnValue(second.promise), cancel: vi.fn() };
  const handle = vi.fn(async () => null);
  const voice = new NavigationVoice({ input, handle, say: vi.fn(async () => true), ready: vi.fn(), cancel: vi.fn() });
  voice.start(null); await flush(); voice.stop(); voice.start(null); await flush();
  expect(input.listen).toHaveBeenCalledTimes(1);
  first.resolve('navigate to wrong destination'); await flush();
  expect(handle).not.toHaveBeenCalled(); expect(input.listen).toHaveBeenCalledTimes(2);
  voice.stop(); second.reject(new Error('Voice off.')); await flush();
});

test('a permission failure is spoken once and does not enter a retry or question loop', async () => {
  const input = { prepare: vi.fn(async () => { throw new Error('Enable microphone in Settings.'); }), listen: vi.fn(), cancel: vi.fn() };
  const say = vi.fn(async () => true);
  const voice = new NavigationVoice({ input, say, handle: vi.fn(), ready: vi.fn(), cancel: vi.fn() });
  voice.start('Welcome.'); await flush();
  expect(say).toHaveBeenCalledTimes(1); expect(input.listen).not.toHaveBeenCalled();
  expect(voice.state.value.phase).toBe('error'); expect(voice.active).toBe(false);
});

test('long help/end phrases are explicit commands, misheard or ambient text never becomes a place', () => {
  expect(voiceIntent('Voice help')).toEqual({ kind: 'help' });
  expect(voiceIntent('Manual')).toEqual({ kind: 'help' });
  expect(voiceIntent('man')).toEqual({ kind: 'help' });
  expect(voiceIntent('What can I say?')).toBeNull();
  expect(voiceIntent('Stop navigation')).toEqual({ kind: 'end' });
  for (const text of ['Held', 'And journey', 'Hello there', 'Where am I', 'Sydney Town Hall']) expect(voiceIntent(text)).toBeNull();
});

test('silence re-arms without repeated readiness tones or executing a command', async () => {
  vi.useFakeTimers();
  const next = deferred<string>();
  const input = { prepare: vi.fn(async () => undefined), listen: vi.fn()
    .mockImplementationOnce(ready => { ready(); return Promise.reject(new Error('No speech heard.')); })
    .mockImplementation(ready => { ready(); return next.promise; }), cancel: vi.fn() };
  const ready = vi.fn(); const handle = vi.fn();
  const announceListening = vi.fn(async () => true);
  const voice = new NavigationVoice({ input, handle, say: vi.fn(async () => true), ready, cancel: vi.fn(), announceListening });
  voice.start(null); await flush(); await vi.advanceTimersByTimeAsync(400); await flush();
  expect(input.listen).toHaveBeenCalledTimes(2); expect(ready).toHaveBeenCalledTimes(1); expect(handle).not.toHaveBeenCalled();
  expect(announceListening).toHaveBeenCalledTimes(1);
  voice.stop(); next.reject(new Error('Voice off')); await flush(); vi.useRealTimers();
});