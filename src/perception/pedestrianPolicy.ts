import type { PedestrianScene } from './pedestrianTypes';

export const MINIMUM_START_SECONDS = 10;
export const PEDESTRIAN_MAX_AGE_MS = 1200;
export interface CrossingDecision { blocked: boolean; message: string; seconds: number | null }

export function pedestrianStatus(scene: PedestrianScene, now: number, alreadyCrossing: boolean): string {
  const decision = crossingDecision(scene, now);
  if (!alreadyCrossing) return decision.message;
  if (scene.error || now - scene.timestampMs > PEDESTRIAN_MAX_AGE_MS) return 'Pedestrian signal view unavailable. Crossing assistance remains active; confirm the far footpath when reached.';
  if (decision.seconds !== null) return `Countdown reads ${decision.seconds} seconds. If already crossing, use your crossing skills to reach the far footpath.`;
  if (scene.observations.some(o => o.phase === 'RED')) return 'Red signal observed. If already crossing, use your crossing skills to reach the far footpath.';
  return 'Crossing assistance is active. Confirm only when you reach the far footpath.';
}

/** An observed countdown is not a measured allowance to start an Australian crossing. */
export function crossingDecision(scene: PedestrianScene, now: number): CrossingDecision {
  const block = (message: string, seconds: number | null = null): CrossingDecision => ({ blocked: true, message, seconds });
  if (scene.error) return block('Pedestrian detection unavailable. Do not start crossing.');
  if (!Number.isFinite(scene.timestampMs) || now < scene.timestampMs || now - scene.timestampMs > PEDESTRIAN_MAX_AGE_MS)
    return block('Pedestrian signal view is unavailable or outdated. Do not start crossing.');
  const signals = scene.observations.filter(o => o.kind === 'signal');
  const timers = scene.observations.filter(o => o.kind === 'countdown');
  if (signals.some(o => o.phase === 'RED')) return block('Red pedestrian signal observed. Do not start crossing.');
  if (timers.length) {
    const values = timers.map(o => o.seconds).filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 99);
    const seconds = values.length === timers.length && new Set(values).size === 1 ? values[0] : null;
    if (seconds !== null && seconds <= MINIMUM_START_SECONDS)
      return block(`Countdown reads ${seconds} seconds, at or below the 10-second limit. Do not start crossing.`, seconds);
    if (seconds !== null) return block(`Countdown reads ${seconds} seconds. This may be the clearance phase. Do not start crossing.`, seconds);
    return block('Countdown detected; remaining time is unclear. Do not start crossing.');
  }
  if (signals.length !== 1) return block(signals.length > 1 ? 'Multiple pedestrian signals in view. Do not start crossing.' : 'No pedestrian signal identified. Do not start crossing.');
  if (signals[0].phase !== 'GREEN') return block('Pedestrian signal is unclear. Do not start crossing.');
  // These public weights have not been validated on Australian intersections. The app must
  // describe an observation, not issue permission to walk based on an experimental model.
  return block('Green pedestrian symbol observed. Crossing safety and remaining time are unverified.');
}
