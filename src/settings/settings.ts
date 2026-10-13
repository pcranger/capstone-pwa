import {Verbosity} from '../feedback/cue';
export enum InterfaceMode {
  USER = 'USER',
  DEVELOPER = 'DEVELOPER',
}

/** Typeface for the whole app; see docs/UI_DESIGN.md. */
export enum AppFont {
  MODERN = 'MODERN',
  CLASSIC = 'CLASSIC',
  HYPERLEGIBLE = 'HYPERLEGIBLE',
}

export interface AppSettings {
  interfaceMode: InterfaceMode;
  speech: boolean;
  tones: boolean;
  haptics: boolean;
  speechRate: number;
  verbosity: Verbosity;
  aimSonar: boolean;
  veerGuidance: boolean;
  vehicleAlerts: boolean;
  autoDetectCrossing: boolean;
  useGpu: boolean;
  scoreThreshold: number;
  showPreview: boolean;
  showOverlay: boolean;
  showMovingVehicles: boolean;
  showStationaryVehicles: boolean;
  logSessions: boolean;
  appFont: AppFont;
  /** Everything below covers the camera, so each one is opt-in and off by default unless it is a warning. */
  showWarnings: boolean;
  /** The icon rail at the top left: people, crosswalk, you, vehicles, signal. */
  showStatusIcons: boolean;
  showModelLine: boolean;
  geminiEnabled: boolean;
  /** Low-vision mode: the phase word takes the whole bottom panel instead of a compact line. */
  largeStatus: boolean;
  /**
   * The active model: `asset:<name>` for one bundled with the app, `documents:<relative path>` for one imported
   * or copied into the app's Documents folder, or null for the default bundled model. Paths are relative because
   * iOS moves the app container between installs.
   */
  customModelPath: string | null;
  acceptedSafetyNotice: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  interfaceMode: InterfaceMode.USER,
  speech: true,
  tones: true,
  haptics: true,
  speechRate: 0.85,
  verbosity: Verbosity.NORMAL,
  aimSonar: true,
  veerGuidance: true,
  vehicleAlerts: true,
  autoDetectCrossing: true,
  useGpu: true,
  scoreThreshold: 0.35,
  showPreview: true,
  showOverlay: true,
  showMovingVehicles: true,
  showStationaryVehicles: false,
  logSessions: false,
  appFont: AppFont.MODERN,
  showWarnings: true,
  showStatusIcons: true,
  showModelLine: false,
  geminiEnabled: true,
  largeStatus: false,
  customModelPath: null,
  acceptedSafetyNotice: false,
};

/** Treat imported device preferences as untrusted input, including legacy partial exports. */
export function validateAppSettings(value: unknown): AppSettings {
  const result = { ...DEFAULT_SETTINGS };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(result) as (keyof AppSettings)[]) {
    if (typeof result[key] === 'boolean' && typeof raw[key] === 'boolean')
      (result as unknown as Record<string, unknown>)[key] = raw[key];
  }
  if (Object.values(InterfaceMode).includes(raw.interfaceMode as InterfaceMode)) result.interfaceMode = raw.interfaceMode as InterfaceMode;
  if (Object.values(AppFont).includes(raw.appFont as AppFont)) result.appFont = raw.appFont as AppFont;
  if (Object.values(Verbosity).includes(raw.verbosity as Verbosity)) result.verbosity = raw.verbosity as Verbosity;
  if (typeof raw.speechRate === 'number' && Number.isFinite(raw.speechRate) && raw.speechRate >= .6 && raw.speechRate <= 2) result.speechRate = raw.speechRate;
  if (typeof raw.scoreThreshold === 'number' && Number.isFinite(raw.scoreThreshold) && raw.scoreThreshold >= .2 && raw.scoreThreshold <= .7) result.scoreThreshold = raw.scoreThreshold;
  if (typeof raw.customModelPath === 'string' && raw.customModelPath.length <= 512) result.customModelPath = raw.customModelPath;
  return result;
}

