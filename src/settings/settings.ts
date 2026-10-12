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

