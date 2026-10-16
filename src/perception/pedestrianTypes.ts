import type { BoxF } from '../core/geometry';

/** Preserve small symbol details for verification; the neural input stays 640 square. */
export const PEDESTRIAN_MAX_IMAGE_EDGE = 1920;

export type PedestrianKind = 'signal' | 'countdown' | 'button' | 'press-surface';
export interface PedestrianObservation {
  id: string;
  kind: PedestrianKind;
  box: BoxF;
  phase: 'GREEN' | 'RED' | 'UNKNOWN';
  score: number;
  source: 'pretrained' | 'shape' | 'ocr' | 'seven-segment' | 'button-shape';
  seconds?: number | null;
}
export interface PedestrianScene {
  timestampMs: number;
  observations: PedestrianObservation[];
  error: string | null;
}
export const EMPTY_PEDESTRIAN_SCENE: PedestrianScene = { timestampMs: -Infinity, observations: [], error: null };
