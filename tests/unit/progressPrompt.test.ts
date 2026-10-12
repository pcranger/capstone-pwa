import {test,expect,vi,beforeEach,afterEach} from 'vitest';
import { ProgressPrompt } from '../../src/voice/progressPrompt';
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
test('repeats at five seconds, stops cleanly, and never queues overlapping reminders', async () => {
  let resolve!: () => void;
  const say = vi.fn(() => new Promise<void>(r => { resolve = r; })), silence = vi.fn();
  const p = new ProgressPrompt(say, silence); p.start('Finding route.');
  await vi.advanceTimersByTimeAsync(4999); expect(say).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(say).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(10000); expect(say).toHaveBeenCalledTimes(1);
  resolve(); await vi.advanceTimersByTimeAsync(5000); expect(say).toHaveBeenCalledTimes(2);
  p.stop(); expect(silence).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(15000); expect(say).toHaveBeenCalledTimes(2);
});
test('replacing requests drops old progress and rejected speech can retry', async () => {
  const say = vi.fn().mockRejectedValue(new Error('audio interrupted'));
  const p = new ProgressPrompt(say, vi.fn()); p.start('Searching.');
  await vi.advanceTimersByTimeAsync(4000); p.start('Finding route.');
  await vi.advanceTimersByTimeAsync(5000); expect(say).toHaveBeenCalledWith('Finding route.');
  expect(say).not.toHaveBeenCalledWith('Searching.');
  await vi.advanceTimersByTimeAsync(5000); expect(say).toHaveBeenCalledTimes(2); p.stop();
});