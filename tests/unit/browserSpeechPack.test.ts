import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

test('an installed English pack is checked once and reused by voice', async () => {
  const available = vi.fn(async () => 'available' as const);
  const install = vi.fn(async () => true);
  vi.stubGlobal('window', { SpeechRecognition: class { static available = available; static install = install; } });
  const speech = await import('../../src/platform/speech');
  expect(await speech.prepareEnglishSpeechPack()).toBe(true);
  await new speech.BrowserSpeechInput().prepare();
  expect(available).toHaveBeenCalledExactlyOnceWith({ langs: ['en-US'], processLocally: true });
  expect(install).not.toHaveBeenCalled();
  expect(speech.englishSpeechPack.value.phase).toBe('ready');
});

test.each(['downloadable', 'downloading'] as const)('startup installs an %s English pack and shares the pending download', async availability => {
  const installation = deferred<boolean>();
  const available = vi.fn(async () => availability);
  const install = vi.fn(() => installation.promise);
  vi.stubGlobal('window', { SpeechRecognition: class { static available = available; static install = install; } });
  const speech = await import('../../src/platform/speech');
  const first = speech.prepareEnglishSpeechPack();
  const second = speech.prepareEnglishSpeechPack();
  expect(second).toBe(first);
  await vi.waitFor(() => expect(install).toHaveBeenCalledTimes(1));
  expect(speech.englishSpeechPack.value).toMatchObject({ phase: 'downloading', availability });
  installation.resolve(true);
  await expect(first).resolves.toBe(true);
  expect(speech.englishSpeechPack.value.phase).toBe('ready');
});

test('a failed automatic install can be retried directly from a tap', async () => {
  const available = vi.fn(async () => 'downloadable' as const);
  let tapIsActive = false;
  const install = vi.fn(() => {
    if (!tapIsActive) return Promise.reject(new DOMException('User activation required', 'NotAllowedError'));
    return Promise.resolve(true);
  });
  vi.stubGlobal('window', { SpeechRecognition: class { static available = available; static install = install; } });
  const speech = await import('../../src/platform/speech');
  expect(await speech.prepareEnglishSpeechPack()).toBe(false);
  expect(speech.englishSpeechPack.value.phase).toBe('needs-gesture');
  tapIsActive = true;
  const retry = speech.retryEnglishSpeechPack();
  tapIsActive = false;
  expect(await retry).toBe(true);
  expect(install).toHaveBeenCalledTimes(2);
  expect(speech.englishSpeechPack.value.phase).toBe('ready');
  await new speech.BrowserSpeechInput().prepare();
  expect(available).toHaveBeenCalledTimes(1);
});

test('an unsupported browser is reported without trying online speech recognition', async () => {
  vi.stubGlobal('window', {});
  const speech = await import('../../src/platform/speech');
  expect(await speech.prepareEnglishSpeechPack()).toBe(false);
  expect(speech.englishSpeechPack.value.phase).toBe('unavailable');
  await expect(new speech.BrowserSpeechInput().prepare()).rejects.toThrow('Offline English recognition is unavailable in this browser.');
});
