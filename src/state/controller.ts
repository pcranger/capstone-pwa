import { Store } from "./store";
import { nowMs } from "../core/geometry";
import { BrowserSessionLogger } from "../platform/logger";
import {
  CrossingEngine,
  AssistMode,
  UserCommand,
  EMPTY_SNAPSHOT,
  type EngineSnapshot,
  type EngineOutput,
} from "../crossing/crossingEngine";
import { type Cue, Verbosity } from "../feedback/cue";
import { cueText, PHRASES, P } from "../strings";
import { DEFAULT_SETTINGS, validateAppSettings, type AppSettings } from "../settings/settings";
import {
  Feedback,
  browserOrientation,
  convertPredictions,
  mediaError,
} from "../browser";
import { EMPTY_PIPELINE } from "../perception/pipelineHealth";
import { DestinationPlanner } from "../nav/planner";
import { Journey } from "../nav/journey";
import {walkingCue} from "../nav/feedbackPolicy";
import { SavedPlacesRepository } from "../nav/savedPlaces";
import {
  searchPlaces,
  placeDetails,
  walkingRoute,
  type PlaceCandidate,
  type LocationFix,
  type WalkingRoute,
  usableFix,
} from "../nav/navigation";
import { services } from "../config/services";
import {
  NavigationVoice,
  voiceIntent,
  VOICE_QUICK_START,
} from "../voice/navigationVoice";
import { V, spokenError } from "../voice/speechCatalog";
import { BrowserSpeechInput } from "../platform/speech";
import type { ModelSource } from "../perception/modelLoader";
import type { OrientationSample } from "../sensors/orientationMath";
import type { BrowserDetector } from "../perception/browserDetector";
import { AnnouncementScheduler,ObjectAnnouncementFilter,engineAnnouncements } from '../product/announcementScheduler';
import { productPreferences } from '../product/preferences';

export interface UiState {
  snapshot: EngineSnapshot;
  fps: number;
  inferenceMs: number;
  frameAspect: number;
  caption: string | null;
  frameBrightness: number;
}
export interface ModelInfo {
  displayName: string;
  inputWidth: number;
  inputHeight: number;
  format: string;
  backend: string;
  labels: string[];
  hasPedestrianSignalClasses: boolean;
}
export type ModelState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; info: ModelInfo }
  | { kind: "failed"; message: string };
function savedSettings(): AppSettings {
  try {
    const raw = JSON.parse(localStorage.getItem("crosswise_settings") ?? "{}");
    return validateAppSettings(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
function locate(signal: AbortSignal): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location unavailable. Try again."));
      return;
    }
    if (signal.aborted) {
      reject(new Error("Request cancelled."));
      return;
    }
    const abort = () => reject(new Error("Request cancelled."));
    signal.addEventListener("abort", abort, { once: true });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        signal.removeEventListener("abort", abort);
        if (!signal.aborted)
          resolve({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy,
            timestamp: p.timestamp,
          });
      },
      () => {
        signal.removeEventListener("abort", abort);
        reject(
          new Error(
            "Location unavailable. Allow location access and try again.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}
class Controller {
  settings = new Store<AppSettings>(savedSettings());
  settingsLoaded = new Store(true);
  notice = new Store<string | null>(null);
  presentation = new Store({ mapOpen: false, expanded: false });
  ui = new Store<UiState>({
    snapshot: EMPTY_SNAPSHOT,
    fps: 0,
    inferenceMs: 0,
    frameAspect: 9 / 16,
    caption: null,
    frameBrightness: 1,
  });
  model = new Store<ModelState>({ kind: "loading" });
  modelLibrary = new Store<ModelSource[]>([
    { kind: "asset", name: "coco-ssd" },
  ]);
  mask = new Store(null);
  cameraStatus = new Store<"starting" | "running" | "unavailable">("starting");
  cameraDetail = new Store<string | null>(null);
  cameraPermission = new Store(false);
  pipeline = new Store(EMPTY_PIPELINE);

  private checking = false;
  private checkState = new Store({ text: "" });
  voiceCheck = {
    state: this.checkState,
    get active() {
      return controller.checking;
    },
    start: () => this.startVoice(true, true),
    stop: () => {
      this.stopVoice();
      this.checking = false;
    },
  };
  savedPlaces = new SavedPlacesRepository();
  savedDetails = new Store<Record<string, PlaceCandidate>>({});
  engine = new CrossingEngine({
    pedestrianSignals: false,
    aimSonar: false,
    veerGuidance: true,
    vehicleAlerts: true,
    autoDetectCrossing: false,
    verbosity: Verbosity.NORMAL,
  });
  private feedback = new Feedback(this.settings.value);
  private announcements = new AnnouncementScheduler(text=>this.feedback.sayAndWait(text),()=>this.feedback.cancel());
  private objectAnnouncements = new ObjectAnnouncementFilter();
  private productBrowsing = true;
  private pendingInitialGuidance: { route: WalkingRoute; stepIndex: number; expiresAt: number } | null = null;
  private speechInput = new BrowserSpeechInput();
  voice = new NavigationVoice({
    input: this.speechInput,
    say: (t) => {this.lastVoicePrompt=t;return this.announcements.enqueue({text:t,priority:80,key:`voice:${t}`,expiresAt:Date.now()+30_000});},
    ready: () => this.feedback.vibrate(),
    handle: (t, current) => this.handleVoice(t, current),
    cancel: () => this.announcements.cancel(),
    stopSpeech: () => this.announcements.cancel(),
    announceListening: () => this.feedback.sayAndWait("Listening."),
  });
  private voiceNavigate = false;
  private lastVoiceQuery = "";
  private lastVoicePrompt = "";
  private unknownCommands = 0;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private generation = 0;
  private pendingCamera: Promise<void> | null = null;
  private cameraResumeRequested = false;
  private detector: BrowserDetector | null = null;
  private modelPromise: Promise<BrowserDetector> | null = null;
  private lastFrame = 0;
  private home = true;
  private orientation: OrientationSample | null = null;
  private speechGeneration = 0;
  journey = new Journey({
    now: Date.now,
    locate,
    search: (q, fix, signal) =>
      searchPlaces(q, fix, services.mapsRestApiKey, signal),
    route: (fix, to, signal) =>
      walkingRoute(fix, to, services.mapsRestApiKey, signal),
    watch: async (onFix, onError) => {
      const id = navigator.geolocation.watchPosition(
        (p) =>
          onFix({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy,
            timestamp: p.timestamp,
          }),
        onError,
        { enableHighAccuracy: true, maximumAge: 0 },
      );
      return { remove: () => navigator.geolocation.clearWatch(id) };
    },
    say: (t) => this.sayNavigation(t),
    silence: () => { this.pendingInitialGuidance = null; this.announcements.cancel(); },
  });
  planner = new DestinationPlanner({
    search: (query, signal) =>
      searchPlaces(
        query,
        this.journey.location.value,
        services.mapsRestApiKey,
        signal,
      ),
    details: async (id, signal) => this.savedPlaces.getCandidate(id) ?? await placeDetails(id, services.mapsRestApiKey, signal),
    route: async (place, signal) => {
      if (!services.mapsRestApiKey)
        throw new Error(
          "Walking routes are not configured in this build. Camera assistance is still available.",
        );
      const fix = await locate(signal);
      if (!usableFix(fix, Date.now()))
        throw new Error(
          "Location not accurate enough. Wait on the footpath and retry.",
        );
      this.journey.location.set(fix);
      return walkingRoute(fix, place, services.mapsRestApiKey, signal);
    },
    start: async (plan) => {
      const okay = await this.journey.start(plan);
      if (okay) {
        this.command(UserCommand.START_ASSIST);
      }
      return okay;
    },
    cancelStart: () => this.journey.pause(),
    progress: async (t) => this.sayNavigation(t),
    silenceProgress: () => this.announcements.cancel(),
  });
  logger = new BrowserSessionLogger();
  constructor() {
    this.updateSettings((s) => s,false);
    void this.savedPlaces.load();
    setInterval(() => {
      const now = nowMs();
      const fresh =
        this.orientation && now - this.orientation.timestampMs < 1500
          ? this.orientation
          : null;
      if (!fresh) this.engine.invalidateOrientation();
      if (!document.hidden && this.home) {
        this.output(this.engine.onSensors(now, fresh, false));
      }
      if (now - this.lastFrame > 2500 && this.ui.value.snapshot.tracks.length) {
        this.engine.invalidatePerception();
        this.ui.update((s) => ({ ...s, snapshot: this.engine.snapshot }));
      }
    }, 250);
    window.addEventListener("deviceorientation", (e) => {
      if (e.alpha !== null && e.beta !== null && e.gamma !== null)
        this.orientation = browserOrientation(
          e.alpha,
          e.beta,
          e.gamma,
          nowMs(),
        );
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopVoice();
        if (this.journey.hasJourney) this.journey.pause();
        this.suspendCamera();
        this.announcements.cancel();
      } else if (this.cameraResumeRequested) void this.requestCamera();
    });
    window.addEventListener(
      "crosswise-permissions",
      () => void this.requestCamera(),
    );
  }
  get hasRecentFrame() {
    return (
      this.cameraStatus.value === "running" && nowMs() - this.lastFrame < 2500
    );
  }
  updateSettings(transform: (s: AppSettings) => AppSettings,persist=true) {
    const previous = this.settings.value;
    const next = transform(previous);
    if(persist)localStorage.setItem('crosswise_settings',JSON.stringify(next));
    this.settings.set(next);
    this.feedback.settings = next;
    this.engine.settings = {
      pedestrianSignals: false,
      aimSonar: next.aimSonar,
      veerGuidance: next.veerGuidance,
      vehicleAlerts: next.vehicleAlerts,
      autoDetectCrossing:
        next.interfaceMode === "DEVELOPER" &&
        !this.journey.hasJourney &&
        next.autoDetectCrossing,
      verbosity: next.verbosity,
    };
    if (previous.useGpu !== next.useGpu) {
      const old = this.modelPromise;
      this.modelPromise = null;
      const resume = this.cameraResumeRequested;
      this.suspendCamera();
      void old?.then((model) => model.dispose()).catch(() => {});
      if (resume && !document.hidden) void this.requestCamera();
    }
  }
  reloadSettings() { this.updateSettings(() => savedSettings(),false); }
  setHomeVisible(visible: boolean) {
    this.home = visible;
    if (!visible) {this.stopVoice();this.announcements.cancel();}
  }
  setProductBrowsing(browsing: boolean) {
    this.productBrowsing=browsing;
    if(browsing)this.announcements.cancel();
    else {
      const pending = this.pendingInitialGuidance; this.pendingInitialGuidance = null;
      const state = this.journey.state.value;
      if (pending && pending.expiresAt > Date.now() && this.journey.running && !state.crossing &&
          this.engine.mode !== AssistMode.CROSSING && state.route === pending.route && state.stepIndex === pending.stepIndex)
        this.sayNavigation(this.journey.guidanceText());
    }
  }
  /** Preserve the first route instruction until the shell finishes its menu-to-walk handoff. */
  queueInitialGuidance(): void {
    const state = this.journey.state.value;
    if (!this.journey.running || state.crossing || !state.route || this.home && !this.productBrowsing) return;
    this.pendingInitialGuidance = { route: state.route, stepIndex: state.stepIndex, expiresAt: Date.now() + 15000 };
  }
  clearNotice() {
    this.notice.set(null);
  }
  private output(out: EngineOutput, minimumSpeechPriority = 0) {
    this.logger.record(out.snapshot, this.settings.value.logSessions);
    this.ui.update((s) => ({ ...s, snapshot: out.snapshot }));
    if ((!this.home && minimumSpeechPriority < 80) || document.hidden) return;
    const cues=this.journey.running&&!this.journey.state.value.crossing?out.cues.filter(walkingCue):out.cues;
    let captionUpdated = false;
    for (const announcement of engineAnnouncements(cues, Date.now(), minimumSpeechPriority)) {
      if (this.productBrowsing && announcement.priority < 80) continue;
      if (!captionUpdated) { this.ui.update(s => ({ ...s, caption: announcement.text })); captionUpdated = true; }
      void this.announcements.enqueue(announcement);
    }
    for (const c of cues) {
      if (c.kind === "tone") this.feedback.playTone(c.tone, c.pan);
      if (c.kind === "haptic") this.feedback.vibrate(c.pattern);
    }
  }
  command(command: UserCommand, _explicit = false) {
    this.feedback.unlock();
    if (
      command === UserCommand.START_ASSIST &&
      (this.model.value.kind !== "ready" || !this.hasRecentFrame)
    ) {
      this.notice.set("Detection unavailable.");
      return;
    }
    this.output(this.engine.command(command, nowMs()), command === UserCommand.REPEAT_STATUS && _explicit ? 80 : 0);
  }
  crossingAction(action: "start" | "help" | "finish") {
    if (action === "finish") {
      this.command(UserCommand.END_CROSSING);
      this.journey.leaveCrossing();
    } else if (action === "help") {
      this.journey.enterCrossing();
      this.command(UserCommand.START_ASSIST);
    } else {
      this.command(UserCommand.START_CROSSING);
      if (this.journey.hasJourney) this.journey.enterCrossing();
    }
  }
  repeatGuidance() {
    this.feedback.unlock();
    if (this.journey.running && !this.journey.state.value.crossing)
      this.sayNavigation(this.journey.guidanceText(),80);
    else this.command(UserCommand.REPEAT_STATUS,true);
  }
  pauseJourney() {
    this.journey.pause();
    if(!this.journey.state.value.crossing&&this.engine.mode!==AssistMode.IDLE)this.command(UserCommand.STOP_ASSIST);
  }
  async startJourney() {
    if (this.engine.mode === AssistMode.CROSSING) {
      this.notice.set(
        "The crossing is unfinished. Confirm the far footpath before resuming the route.",
      );
      return false;
    }
    const started=await this.journey.start();
    if(started){if(this.hasRecentFrame)this.command(UserCommand.START_ASSIST);this.queueInitialGuidance();}
    return started;
  }
  finishJourney(step: number) {
    this.journey.arrive(step);
    if (this.journey.state.value.phase === "arrived")
      this.command(UserCommand.STOP_ASSIST);
  }
  stopNavigation() {
    if (this.engine.mode === AssistMode.CROSSING) {
      this.notice.set(
        "The crossing is unfinished. Confirm the far footpath before ending the journey.",
      );
      return;
    }
    this.planner.reset();
    this.journey.end();
    this.command(UserCommand.STOP_ASSIST);
  }
  openMap() {
    this.presentation.update((s) => ({ ...s, mapOpen: true }));
  }
  closeMap() {
    this.planner.cancel();
    this.presentation.update((s) => ({
      ...s,
      mapOpen: false,
      expanded: false,
    }));
  }
  changeDestination() {
    if (this.engine.mode === AssistMode.CROSSING) return false;
    this.journey.pause();
    this.planner.replace();
    this.presentation.set({ mapOpen: true, expanded: true });
    return true;
  }
  cancelPlanning() {
    this.planner.reset();
    this.presentation.update((s) => ({ ...s, expanded: false }));
  }
  async startPlannedJourney(confirmed = false) {
    const started=await this.planner.start(this.planner.state.value.revision,confirmed);
    if(started){this.presentation.set({mapOpen:false,expanded:false});this.queueInitialGuidance();}
    return started;
  }
  sayNavigation(text: string,priority=70) {
    if (!text || (this.productBrowsing && priority<80)) return;
    this.ui.update((s) => ({ ...s, caption: text }));
    void this.announcements.enqueue({text,priority,key:`${priority}:${text}`,expiresAt:Date.now()+(priority>=80?15_000:priority>=70?5_000:2_000)});
  }
  async savePlace(place: PlaceCandidate, alias?: string) {
    try {
      if(place.endpoint==='coordinate'||place.id.startsWith('local:')) {
        const existing=this.savedPlaces.state.value.items.find(p=>p.placeId===place.id);
        await this.savedPlaces.saveCoordinate(place.point,alias??existing?.alias??place.name,existing?.role??'destination',place.id);
      } else await this.savedPlaces.save(place.id, place.name, alias);
      this.savedDetails.update((s) => ({ ...s, [place.id]: place }));
      return "Place saved.";
    } catch (e) {
      return e instanceof Error
        ? e.message
        : "Couldn’t save changes. Try again.";
    }
  }
  async removeSaved(id: string) {
    try {
      await this.savedPlaces.remove(id);
      return "Saved place removed.";
    } catch {
      return "Couldn’t save changes. Try again.";
    }
  }
  async undoSaved() {
    try {
      await this.savedPlaces.undo();
      return "Saved place restored.";
    } catch {
      return "Couldn’t save changes. Try again.";
    }
  }
  async loadSavedDetails(ids: string[], signal: AbortSignal) {
    await Promise.all(
      ids.map(async (id) => {
        try {
          const place = this.savedPlaces.getCandidate(id) ?? await placeDetails(id, services.mapsRestApiKey, signal);
          if (!signal.aborted)
            this.savedDetails.update((s) => ({ ...s, [id]: place }));
        } catch {
          /* Open saved place to retry details. */
        }
      }),
    );
  }
  async practice(cues: Cue[]) {
    this.feedback.unlock();
    for (const c of cues) {
      if (c.kind === "speak") this.sayNavigation(PHRASES[c.phrase],80);
      else if (c.kind === "speakText") this.sayNavigation(c.text,80);
      else if (c.kind === "tone") this.feedback.playTone(c.tone, c.pan);
      else this.feedback.vibrate(c.pattern);
    }
  }
  stopSpeechPreview() {
    ++this.speechGeneration;
    this.announcements.cancelBelow(100);
  }
  async previewSpeech(cues: Cue[]) {
    const generation = ++this.speechGeneration;
    if (this.engine.mode !== AssistMode.IDLE) return false;
    await this.practice(cues);
    const text = cues.map((c) => cueText(c)).join(" ");
    await new Promise((r) => setTimeout(r, Math.max(350, text.length * 65)));
    return generation === this.speechGeneration;
  }
  selectModel(_source: ModelSource) {
    this.notice.set("This build uses the browser detection model.");
  }
  deleteModel(_source: ModelSource) {
    this.notice.set("Bundled models cannot be deleted.");
  }
  importModel(_uri: string, _name: string | null) {
    this.notice.set(
      "Native .tflite model import is unavailable in this browser build.",
    );
  }
  async requestCamera() {
    this.cameraResumeRequested = true;
    if (this.pendingCamera) return this.pendingCamera;
    const pending = this.startCamera().finally(() => {
      if (this.pendingCamera === pending) this.pendingCamera = null;
    });
    this.pendingCamera = pending;
    return pending;
  }
  /** Read-only access for local recording/photo tools; the controller remains the camera owner. */
  getCameraStream(): MediaStream | null {
    return this.stream?.getVideoTracks().some(track => track.readyState === 'live') ? this.stream : null;
  }
  private async startCamera() {
    this.releaseCameraStream();
    const generation = this.generation;
    this.cameraStatus.set("starting");
    this.cameraDetail.set(null);
    try {
      if (!window.isSecureContext)
        throw new Error("Camera requires HTTPS or localhost.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (generation !== this.generation || document.hidden) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.cameraPermission.set(true);
      const interrupted = () => {
        if (generation !== this.generation) return;
        this.releaseCamera();
        this.cameraStatus.set("unavailable");
        this.cameraDetail.set("Camera interrupted. Retry camera.");
      };
      stream.getVideoTracks()[0].addEventListener("ended", interrupted);
      stream.getVideoTracks()[0].addEventListener("mute", interrupted);
      if (this.video) await this.attachCamera(this.video);
    } catch (e) {
      if (generation !== this.generation) return;
      this.releaseCamera();
      this.cameraStatus.set("unavailable");
      this.cameraDetail.set(mediaError(e));
      if (!this.cameraPermission.value) this.notice.set(mediaError(e));
    }
  }
  releaseCamera() {
    this.cameraResumeRequested = false;
    this.suspendCamera();
  }
  /** Backgrounding interrupts tracks without forgetting a deliberately active camera session. */
  private suspendCamera() {
    this.pendingCamera = null;
    this.releaseCameraStream();
  }
  private releaseCameraStream() {
    ++this.generation;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.lastFrame = 0;
    this.engine.invalidatePerception();
    this.ui.update((s) => ({ ...s, snapshot: this.engine.snapshot }));
    this.cameraStatus.set("unavailable");
  }
  detachCamera() {
    this.video = null;
  }
  async attachCamera(video: HTMLVideoElement) {
    this.video = video;
    if (!this.stream) {
      void this.requestCamera();
      return;
    }
    const generation = this.generation;
    video.srcObject = this.stream;
    try {
      await video.play();
      if (generation !== this.generation) return;
      this.cameraStatus.set("running");
      this.model.set({ kind: "loading" });
      this.modelPromise ??= import("../perception/browserDetector")
        .then(({loadBrowserDetector}) => loadBrowserDetector(this.settings.value.useGpu))
        .catch((e) => {
          this.modelPromise = null;
          throw e;
        });
      this.detector = await this.modelPromise;
      if (generation !== this.generation) return;
      this.model.set({
        kind: "ready",
        info: {
          displayName: "COCO-SSD",
          inputWidth: 300,
          inputHeight: 300,
          format: "DETECTION",
          backend: `TensorFlow.js ${this.detector.backend}`,
          labels: [
            "person",
            "bicycle",
            "car",
            "motorcycle",
            "bus",
            "truck",
            "traffic light",
          ],
          hasPedestrianSignalClasses: false,
        },
      });
      const capture = document.createElement("canvas"),
        grayCanvas = document.createElement("canvas");
      grayCanvas.width = 160;
      grayCanvas.height = 120;
      const ctx = capture.getContext("2d")!,
        gctx = grayCanvas.getContext("2d", { willReadFrequently: true })!;
      let previousFrame = performance.now();
      const infer = async () => {
        if (generation !== this.generation) return;
        if (document.hidden || !this.home) {
          setTimeout(() => void infer(), 250);
          return;
        }
        try {
          const aspect = video.videoWidth / video.videoHeight;
          if (!Number.isFinite(aspect) || aspect <= 0) { setTimeout(() => void infer(), 100); return; }
          const width = aspect >= 1 ? Math.round(300 * aspect) : 300;
          const height = aspect >= 1 ? 300 : Math.round(300 / aspect);
          if (capture.width !== width || capture.height !== height) { capture.width = width; capture.height = height; }
          const frameStarted = performance.now();
          ctx.drawImage(video, 0, 0, width, height);
          gctx.drawImage(capture, 0, 0, 160, 120);
          const data = gctx.getImageData(0, 0, 160, 120).data,
            gray = new Uint8Array(160 * 120);
          let sum = 0;
          for (let i = 0; i < gray.length; i++) {
            gray[i] =
              (data[i * 4] * 77 +
                data[i * 4 + 1] * 150 +
                data[i * 4 + 2] * 29) >>
              8;
            sum += gray[i];
          }
          const stamp = nowMs(),
            t = performance.now();
          const predictions = await this.detector!.detect(
            capture,
            20,
            this.settings.value.scoreThreshold,
          );
          if (generation !== this.generation) return;
          const processingMs = performance.now() - frameStarted;
          if (nowMs() - stamp > 2500) {
            this.engine.invalidatePerception();
          } else {
            this.lastFrame = stamp;
            const inference = performance.now() - t;
            this.pipeline.set({
              receivedAt: stamp,
              latencyMs: nowMs() - stamp,
              slowFrames: 0,
              error: null,
              processingMs,
            });
            this.ui.update((s) => ({
              ...s,
              fps: 1000 / Math.max(1, performance.now() - previousFrame),
              inferenceMs: inference,
              frameAspect: capture.width / capture.height,
              frameBrightness: sum / (gray.length * 255),
            }));
            previousFrame = performance.now();
            this.output(
              this.engine.onFrame(
                {
                  timestampMs: stamp,
                  brightness: sum / (gray.length * 255),
                  detections: convertPredictions(
                    predictions,
                    capture.width,
                    capture.height,
                  ),
                  frameWidth: capture.width,
                  frameHeight: capture.height,
                  inferenceMs: inference,
                  motionImage: { width: 160, height: 120, pixels: gray },
                },
                { hfovDeg: 60, vfovDeg: 45 },
              ),
            );
            if(!this.productBrowsing&&!this.voice.active&&this.engine.mode!==AssistMode.CROSSING&&!this.journey.state.value.crossing){
              const label=this.objectAnnouncements.choose(predictions,capture.width,productPreferences.value,Date.now());
              if(label)this.sayNavigation(`${label.charAt(0).toUpperCase()+label.slice(1)}.`,40);
            }
          }
        } catch {
          if (generation !== this.generation) return;
          this.pipeline.update((s) => ({
            ...s,
            error: "Detection unavailable.",
          }));
          this.engine.invalidatePerception();
          this.ui.update((s) => ({ ...s, snapshot: this.engine.snapshot }));
        }
        if (generation === this.generation) {
          if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => void infer());
          else setTimeout(() => void infer(), 16);
        }
      };
      void infer();
    } catch (e) {
      if (generation !== this.generation) return;
      this.releaseCamera();
      this.model.set({
        kind: "failed",
        message: e instanceof Error ? e.message : "Detection unavailable.",
      });
      this.cameraDetail.set("Detection unavailable. Retry camera.");
    }
  }
  stopVoice() {
    this.voice.stop();
    this.speechInput.cancel();
    this.checking = false;
  }
  toggleVoiceFromGesture() {
    if (this.voice.active) this.stopVoice();
    else void this.startVoice(true);
  }
  async startVoice(_explicit = true, check = false) {
    this.stopVoice();
    this.feedback.unlock();
    if (!this.settings.value.speech) return;
    if (!check) {
      this.voice.start(null);
      return;
    }
    this.checking = true;
    this.checkState.set({ text: "Listening…" });
    try {
      await this.speechInput.prepare();
      const text = await this.speechInput.listen(() => this.feedback.vibrate());
      this.checkState.set({ text });
      await this.feedback.sayAndWait(text);
    } catch (e) {
      this.checkState.set({
        text: e instanceof Error ? e.message : "Voice unavailable.",
      });
    } finally {
      this.checking = false;
      this.checkState.update((s) => ({ ...s }));
    }
  }
  private async handleVoice(
    text: string,
    current: () => boolean,
  ): Promise<string | null> {
    if (!current()) return null;
    const intent = voiceIntent(text);
    if (!intent && this.planner.state.value.awaitingLongTrip)
      return V.longTripAnswer;
    if (!intent) return ++this.unknownCommands >= 2 ? V.unknownHelp : V.unknown;
    this.unknownCommands = 0;
    const describeRoute = () => {
      const s = this.journey.state.value;
      return s.route
        ? `${s.phase === "paused" ? "Navigation paused. " : ""}${s.route.destination}. ${this.journey.guidanceText()}`
        : V.destination;
    };
    switch (intent.kind) {
      case "yes":
        if (!this.planner.state.value.awaitingLongTrip) return V.noConfirmation;
        return (await this.startPlannedJourney(true))
          ? describeRoute()
          : V.startFailed;
      case "no":
        if (!this.planner.state.value.awaitingLongTrip) return V.noConfirmation;
        this.cancelPlanning();
        return V.cancelled;
      case "stopListening":
        this.stopVoice();
        return null;
      case "help":
        return VOICE_QUICK_START;
      case "pause":
        if (!this.journey.hasJourney) return V.noRoute;
        this.pauseJourney();
        return V.paused;
      case "resume":
        if (this.planner.state.value.awaitingLongTrip) return V.longTrip;
        if (this.journey.running) return V.running;
        return (await this.startJourney()) && current()
          ? describeRoute()
          : this.journey.state.value.error
            ? spokenError(this.journey.state.value.error)
            : V.noPausedRoute;
      case "end":
        this.stopNavigation();
        return V.stopped;
      case "repeat":
        if (this.planner.state.value.awaitingLongTrip) return V.longTrip;
        if (
          this.journey.state.value.crossing ||
          this.engine.mode === AssistMode.CROSSING
        ) {
          this.repeatGuidance();
          return null;
        }
        return this.journey.hasJourney
          ? describeRoute()
          : this.lastVoicePrompt || V.destination;
      case "cancel":
        this.cancelPlanning();
        return V.cancelled;
      case "save": {
        const place =
          this.planner.state.value.selected ??
          this.journey.state.value.destination;
        return place ? this.savePlace(place, intent.alias) : V.chooseBeforeSave;
      }
      case "destination": {
        if (
          this.journey.state.value.crossing ||
          this.engine.mode === AssistMode.CROSSING
        )
          return V.changeBlocked;
        this.voiceNavigate = intent.navigate;
        this.lastVoiceQuery = intent.query;
        if (this.journey.hasJourney) this.journey.pause();
        this.planner.replace();
        await this.savedPlaces.load();
        if (!current()) return null;
        const query = intent.query.toLocaleLowerCase("en-AU").trim();
        const saved = this.savedPlaces.state.value.items.filter(
          (p) =>
            (query==='home'&&p.role==='home')||(p.alias ?? p.queryLabel ?? "")
              .toLocaleLowerCase("en-AU")
              .trim() === query,
        );
        if (saved.length === 1) {
          await this.planner.resolve(saved[0].placeId);
          if (!current()) return null;
          return this.voicePlace(current);
        }
        await this.planner.search(intent.query);
        if (!current()) return null;
        const s = this.planner.state.value;
        if (s.error) return spokenError(s.error);
        if (s.candidates.length === 1) {
          this.planner.select(s.candidates[0]);
          return this.voicePlace(current);
        }
        this.presentation.set({ mapOpen: true, expanded: true });
        if (!s.candidates.length) return V.noPlaces;
        return (
          s.candidates
            .slice(0, 3)
            .map((p, i) => `${i + 1}. ${p.name}, ${p.address}.`)
            .join(" ") +
          (s.candidates.length === 2
            ? " Say one or two."
            : " Say one, two, or three.")
        );
      }
      case "choose": {
        const s = this.planner.state.value;
        const place = s.page === "results" ? s.candidates[intent.index] : null;
        if (!place) return V.resultUnavailable;
        this.planner.select(place);
        return this.voicePlace(current);
      }
      case "retry": {
        const selected = this.planner.state.value.selected;
        if (selected) return this.voicePlace(current);
        return this.lastVoiceQuery
          ? this.handleVoice(
              `${this.voiceNavigate ? "navigate to" : "search"} ${this.lastVoiceQuery}`,
              current,
            )
          : V.destination;
      }
      case "next": {
        const s = this.journey.state.value;
        if (s.crossing || this.engine.mode === AssistMode.CROSSING)
          return V.finishCrossingFirst;
        if (!this.journey.running || !s.route)
          return s.phase === "paused" ? V.paused : V.noRoute;
        if (s.stepIndex === s.route.steps.length - 1) return V.finalInstruction;
        this.journey.next(s.stepIndex);
        return describeRoute();
      }
      case "arrived": {
        const s = this.journey.state.value;
        if (s.crossing || this.engine.mode === AssistMode.CROSSING)
          return V.finishCrossingFirst;
        if (!this.journey.running || !s.route)
          return s.phase === "paused" ? V.paused : V.noRoute;
        if (s.stepIndex !== s.route.steps.length - 1) return V.arrivalTooSoon;
        this.finishJourney(s.stepIndex);
        return P.arrived(s.route.destination);
      }
      case "finishCrossing": {
        if (
          !this.journey.state.value.crossing &&
          this.engine.mode !== AssistMode.CROSSING
        )
          return V.noCrossing;
        this.crossingAction("finish");
        return this.journey.running
          ? describeRoute()
          : this.journey.state.value.phase === "paused"
            ? P.crossingPaused
            : V.crossingEnded;
      }
      case "confirm":
        if (this.planner.state.value.awaitingLongTrip) return V.longTrip;
        if (
          this.journey.state.value.crossing ||
          this.engine.mode === AssistMode.CROSSING
        )
          return V.changeBlocked;
        if (this.journey.hasJourney && !this.planner.state.value.selected)
          return V.completionCommands;
        this.voiceNavigate = true;
        return this.voicePlace(current);
    }
  }
  private async voicePlace(current: () => boolean): Promise<string | null> {
    const selected = this.planner.state.value.selected;
    if (!selected)
      return this.planner.state.value.error
        ? spokenError(this.planner.state.value.error)
        : V.destination;
    if (!this.voiceNavigate) return V.place(selected.name, selected.address);
    await this.planner.confirm(selected.id);
    if (!current()) return null;
    const s = this.planner.state.value;
    if (s.error || !s.route)
      return s.error ? spokenError(s.error) : V.routeUnavailable;
    const started = await this.startPlannedJourney();
    if (!current()) return null;
    if (this.planner.state.value.awaitingLongTrip) return V.longTrip;
    if (!started)
      return this.journey.state.value.error
        ? spokenError(this.journey.state.value.error)
        : V.startFailed;
    return V.routeStarted(selected.name, this.journey.guidanceText());
  }
}
export const controller = new Controller();
