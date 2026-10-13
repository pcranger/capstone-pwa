import { describe, expect, it } from 'vitest';
import { BoxF } from '../../src/core/geometry';
import { crossingDecision, pedestrianStatus } from '../../src/perception/pedestrianPolicy';
import type { PedestrianObservation, PedestrianScene } from '../../src/perception/pedestrianTypes';
const box = new BoxF(.4, .2, .6, .5);
const observation = (phase: 'RED' | 'GREEN' | 'UNKNOWN'): PedestrianObservation => ({ id: phase, kind: 'signal', phase, box, score: .95, source: 'pretrained' });
const timer = (seconds: number | null): PedestrianObservation => ({ id: 'timer', kind: 'countdown', phase: 'UNKNOWN', box, score: .9, source: 'ocr', seconds });
const scene = (...observations: PedestrianObservation[]): PedestrianScene => ({ timestampMs: 100, observations, error: null });
describe('Australian pedestrian countdown and start guidance', () => {
  it.each([0, 1, 9, 10])('blocks %s seconds even alongside a green prediction', seconds => {
    const decision = crossingDecision(scene(observation('GREEN'), timer(seconds)), 200);
    expect(decision.blocked).toBe(true); expect(decision.seconds).toBe(seconds); expect(decision.message).toContain('10-second limit');
  });
  it.each([11, 21, 99])('does not mistake %s seconds of clearance for permission to start', seconds => {
    const decision = crossingDecision(scene(timer(seconds)), 200);
    expect(decision.blocked).toBe(true); expect(decision.message).toContain('clearance');
  });
  it('red overrides a green prediction and a long countdown', () => {
    const decision = crossingDecision(scene(observation('GREEN'), timer(21), observation('RED')), 200);
    expect(decision.blocked).toBe(true); expect(decision.message).toContain('Red');
  });
  it.each([null, NaN, -1, 100, 1.5])('unreadable or invalid time %s never becomes permission', seconds => {
    expect(crossingDecision(scene(timer(seconds)), 200).message).toContain('unclear');
  });
  it('rejects stale, future, failed, absent and multiple signals', () => {
    for (const [input, now] of [[scene(observation('GREEN')), 1301], [scene(observation('GREEN')), 99], [{ ...scene(), error: 'failed' }, 200], [scene(), 200], [scene(observation('GREEN'), observation('GREEN')), 200]] as const)
      expect(crossingDecision(input, now).blocked).toBe(true);
  });
  it('does not treat experimental public weights as a validated road-crossing authority', () => {
    expect(crossingDecision(scene(observation('GREEN')), 200)).toMatchObject({ blocked: true, seconds: null });
    expect(crossingDecision(scene(observation('GREEN')), 200).message).toContain('unverified');
  });
  it('never tells an existing crosser to stop in the road when red, low time, or lost', () => {
    for (const input of [scene(observation('RED')), scene(timer(5)), { ...scene(), timestampMs: -Infinity }]) {
      const text = pedestrianStatus(input, 200, true);
      expect(text).toContain('footpath'); expect(text).not.toContain('Do not start');
    }
  });
});
