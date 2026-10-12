import type { AppSettings } from "./settings/settings";
import { renderTone } from "./feedback/toneSynth";
import { HAPTIC_PATTERNS } from "./feedback/haptics";
import { ToneKind, HapticPattern } from "./feedback/cue";
type Settings = Pick<
  AppSettings,
  "speech" | "tones" | "haptics" | "speechRate"
>;
import { BoxF } from "./shared/core/geometry";
import { ObjectCategory, type Detection } from "./shared/perception/detection";
import {
  OrientationMath,
  type OrientationSample,
} from "./shared/sensors/orientationMath";
const categories: Record<string, ObjectCategory> = {
  person: ObjectCategory.PERSON,
  bicycle: ObjectCategory.BICYCLE,
  motorcycle: ObjectCategory.MOTORCYCLE,
  car: ObjectCategory.CAR,
  bus: ObjectCategory.BUS,
  truck: ObjectCategory.TRUCK,
  "traffic light": ObjectCategory.TRAFFIC_LIGHT,
};
export function convertPredictions(
  predictions: {
    bbox: [number, number, number, number];
    class: string;
    score: number;
  }[],
  width: number,
  height: number,
): Detection[] {
  return predictions
    .filter((p) => categories[p.class])
    .map((p) => ({
      box: new BoxF(
        p.bbox[0] / width,
        p.bbox[1] / height,
        (p.bbox[0] + p.bbox[2]) / width,
        (p.bbox[1] + p.bbox[3]) / height,
      ).clamp01(),
      category: categories[p.class],
      label: p.class,
      classIndex: 0,
      score: p.score,
    }));
}
/** W3C intrinsic Z-X-Y rotation, applied to the rear camera axis. */
export function browserOrientation(
  alpha: number,
  beta: number,
  gamma: number,
  time: number,
): OrientationSample {
  const [z, x, y] = [alpha, beta, gamma].map((a) => (a * Math.PI) / 180);
  const cz = Math.cos(z),
    sz = Math.sin(z),
    cx = Math.cos(x),
    sx = Math.sin(x),
    cy = Math.cos(y),
    sy = Math.sin(y);
  return OrientationMath.cameraOrientation(
    [
      cz * cy - sz * sx * sy,
      -sz * cx,
      cz * sy + sz * sx * cy,
      sz * cy + cz * sx * sy,
      cz * cx,
      sz * sy - cz * sx * cy,
      -cx * sy,
      sx,
      cx * cy,
    ],
    time,
  );
}
export class Feedback {
  settings: Settings;
  private audio: AudioContext | null = null;
  private finishSpeech: ((ok: boolean) => void) | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  constructor(settings: Settings) {
    this.settings = settings;
  }
  unlock() {
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume().catch(() => {});
    } catch {
      /* Unsupported audio. */
    }
  }
  speak(text: string) {
    if (!this.settings.speech || !("speechSynthesis" in window)) return;
    this.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-AU";
    u.rate =
      "speechRate" in this.settings &&
      typeof this.settings.speechRate === "number"
        ? this.settings.speechRate
        : 0.95;
    window.speechSynthesis.speak(u);
  }
  playTone(kind: ToneKind, pan = 0) {
    if (!this.settings.tones) return;
    this.unlock();
    const a = this.audio;
    if (!a) return;
    const [left, right] = renderTone(kind, pan, a.sampleRate);
    const buffer = a.createBuffer(2, left.length, a.sampleRate);
    buffer.copyToChannel(left, 0);
    buffer.copyToChannel(right, 1);
    const source = a.createBufferSource();
    source.buffer = buffer;
    source.connect(a.destination);
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
    source.start();
  }
  tone(pan = 0, alert = false) {
    this.playTone(alert ? ToneKind.ALERT : ToneKind.SONAR, pan);
  }
  vibrate(pattern: HapticPattern = HapticPattern.ALERT) {
    if (this.settings.haptics)
      navigator.vibrate?.(HAPTIC_PATTERNS[pattern][0].slice(1));
  }
  sayAndWait(text: string): Promise<boolean> {
    if (!this.settings.speech || !("speechSynthesis" in window))
      return Promise.resolve(false);
    this.cancel();
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-AU";
      utterance.rate = this.settings.speechRate;
      let done = false;
      const complete = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.finishSpeech = null;
        resolve(ok);
      };
      const timer = setTimeout(
        () => complete(false),
        Math.max(15000, text.length * 150),
      );
      this.finishSpeech = complete;
      utterance.onend = () => complete(true);
      utterance.onerror = () => complete(false);
      window.speechSynthesis.speak(utterance);
    });
  }
  cancel() {
    this.finishSpeech?.(false);
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.sources.clear();
    window.speechSynthesis?.cancel();
    navigator.vibrate?.(0);
  }
}
export function mediaError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError")
    return "Camera access was denied. Allow camera access in your browser settings, then retry.";
  if (name === "NotFoundError")
    return "No camera was found. Connect a camera or use Practice.";
  if (name === "NotReadableError")
    return "The camera is busy. Close other camera apps, then retry.";
  return "Camera could not start. Check browser permissions and retry, or use Practice.";
}
