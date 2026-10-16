import type { SpeechInput } from "../voice/nativeSpeech";
import { speechStatus } from "../voice/speechStatus";
import { Store } from "../state/store";

const ENGLISH = "en-US";
const PACK_OPTIONS = { langs: [ENGLISH], processLocally: true };
type Availability = "available" | "downloadable" | "downloading" | "unavailable";
type PackPhase = "idle" | "checking" | "downloading" | "needs-gesture" | "ready" | "unavailable" | "error";
export interface EnglishSpeechPackState {
  phase: PackPhase;
  availability: Availability | null;
  message: string;
}
export const englishSpeechPack = new Store<EnglishSpeechPackState>({
  phase: "idle",
  availability: null,
  message: "Checking offline English recognition…",
});

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally: boolean;
  onstart: (() => void) | null;
  onresult:
    | ((e: {
        results: {
          [index: number]: { [index: number]: { transcript: string } };
        };
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type Constructor = {
  new (): Recognition;
  available?: (o: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<Availability>;
  install?: (o: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<boolean>;
};

const unavailableMessage = "Offline English recognition is unavailable in this browser.";
let ongoing: Promise<boolean> | null = null;
let operation = 0;

function recognitionConstructor(): Constructor | undefined {
  return (window as unknown as { SpeechRecognition?: Constructor }).SpeechRecognition;
}

function updatePack(phase: PackPhase, message: string, availability: Availability | null = englishSpeechPack.value.availability) {
  englishSpeechPack.set({ phase, availability, message });
  if (phase === "ready") speechStatus.set({ locale: ENGLISH, error: null });
  else if (phase === "needs-gesture" || phase === "unavailable" || phase === "error")
    speechStatus.set({ locale: null, error: message });
}

function track(task: Promise<boolean>): Promise<boolean> {
  ongoing = task;
  void task.finally(() => { if (ongoing === task) ongoing = null; });
  return task;
}

function installPack(ctor: Constructor, id: number, fromTap: boolean): Promise<boolean> {
  if (!ctor.install) {
    updatePack("unavailable", unavailableMessage);
    return Promise.resolve(false);
  }
  updatePack("downloading", "Downloading offline English recognition…");
  let installation: Promise<boolean>;
  try {
    // This invocation must happen synchronously in retryEnglishSpeechPack's tap handler.
    installation = ctor.install(PACK_OPTIONS);
  } catch (error) {
    if (id === operation) installError(error, fromTap);
    return Promise.resolve(false);
  }
  return installation.then(installed => {
    if (id !== operation) return englishSpeechPack.value.phase === "ready";
    if (installed) {
      updatePack("ready", "Offline English recognition is ready.", "available");
      return true;
    }
    updatePack(fromTap ? "error" : "needs-gesture", fromTap
      ? "Could not install offline English recognition. Check your connection and browser settings, then retry."
      : "The browser could not start the download automatically. Tap Retry download to try again.");
    return false;
  }).catch(error => {
    if (id === operation) installError(error, fromTap);
    return false;
  });
}

function installError(error: unknown, fromTap: boolean) {
  const name = error instanceof Error ? error.name : "";
  if (!fromTap && (name === "NotAllowedError" || name === "SecurityError" || name === "InvalidStateError")) {
    updatePack("needs-gesture", "Tap Retry download to ask the browser to install offline English recognition.");
  } else {
    updatePack("error", "Could not install offline English recognition. Check your connection and browser settings, then retry.");
  }
}

/** Check for the browser-managed pack when the app opens, and install it if offered. */
export function prepareEnglishSpeechPack(): Promise<boolean> {
  if (englishSpeechPack.value.phase === "ready") return Promise.resolve(true);
  if (ongoing) return ongoing;
  if (["needs-gesture", "unavailable", "error"].includes(englishSpeechPack.value.phase))
    return Promise.resolve(false);
  const ctor = recognitionConstructor();
  if (!ctor?.available) {
    updatePack("unavailable", unavailableMessage, "unavailable");
    return Promise.resolve(false);
  }
  const id = ++operation;
  updatePack("checking", "Checking offline English recognition…", null);
  const task = Promise.resolve().then(() => ctor.available!(PACK_OPTIONS)).then(availability => {
    if (id !== operation) return englishSpeechPack.value.phase === "ready";
    if (availability === "available") {
      updatePack("ready", "Offline English recognition is ready.", availability);
      return true;
    }
    if (availability === "unavailable") {
      updatePack("unavailable", unavailableMessage, availability);
      return false;
    }
    if (availability === "downloadable" || availability === "downloading") {
      englishSpeechPack.update(previous => ({ ...previous, availability }));
      return installPack(ctor, id, false);
    }
    updatePack("error", "Could not check offline English recognition. Retry the download.");
    return false;
  }).catch(() => {
    if (id === operation) updatePack("error", "Could not check offline English recognition. Retry the download.");
    return false;
  });
  return track(task);
}

/** Call directly from a button tap so the browser can accept the install gesture. */
export function retryEnglishSpeechPack(): Promise<boolean> {
  if (englishSpeechPack.value.phase === "ready") return Promise.resolve(true);
  if (ongoing && englishSpeechPack.value.phase === "downloading") return ongoing;
  const ctor = recognitionConstructor();
  if (!ctor?.install) {
    updatePack("unavailable", unavailableMessage, "unavailable");
    return Promise.resolve(false);
  }
  const id = ++operation;
  return track(installPack(ctor, id, true));
}

export class BrowserSpeechInput implements SpeechInput {
  private ctor: Constructor | null = null;
  private stop: (() => void) | null = null;
  async prepare() {
    const ready = await prepareEnglishSpeechPack();
    const ctor = recognitionConstructor();
    if (!ready || !ctor) throw new Error(englishSpeechPack.value.message || unavailableMessage);
    this.ctor = ctor;
  }
  listen(ready: () => void): Promise<string> {
    this.cancel();
    if (!this.ctor) return Promise.reject(new Error("Voice unavailable."));
    const r = new this.ctor();
    r.lang = ENGLISH;
    r.processLocally = true;
    r.continuous = false;
    r.interimResults = false;
    return new Promise((resolve, reject) => {
      let finished = false;
      const end = (text: string | null, error?: string) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this.stop = null;
        r.abort();
        if (text) resolve(text);
        else reject(new Error(error ?? "Request cancelled."));
      };
      const timer = setTimeout(() => end(null, "Voice timed out."), 20000);
      this.stop = () => end(null);
      r.onstart = ready;
      r.onresult = (e) => end(e.results[0][0].transcript);
      r.onerror = (e) =>
        end(
          null,
          e.error === "no-speech"
            ? "No speech heard."
            : "Voice recognition unavailable. Try again.",
        );
      r.onend = () => end(null, "No speech heard.");
      try {
        r.start();
      } catch {
        end(null, "Voice recognition unavailable. Try again.");
      }
    });
  }
  cancel() {
    const stop = this.stop;
    this.stop = null;
    stop?.();
  }
}
