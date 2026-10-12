# capstone_PWA

Phone PWA rebuilt from the current `capstone_android` CrossWise screens. The UI reuses the native Journey, camera controls, Settings, Guide, Practice, destination drawer, typography, colours, icons and wording through React Native Web. There is no desktop dashboard, landing page, extra navigation, install card or synthetic practice interface.

## Run

```sh
cd /Users/hieu/Desktop/capstone/capstone_PWA
npm ci
npm run build
npm run preview -- --port 4174
```

Open http://localhost:4174 locally. Serve `dist/` at the root of an HTTPS host for phone camera access and installation. `npm run dev` starts development; the service worker is enabled in production builds.

## Original phone flow

- Camera opens automatically after permission. Voice and Settings sit at the top; More controls and the map arrow sit at the bottom.
- More controls reveals Start camera assistance. Once detection is available, start assistance, then select I’m crossing. I’m on the footpath stays reachable with controls collapsed. Completion is explicit.
- The bottom arrow opens the full-screen map and destination drawer. The handle expands/collapses it; inward arrows return to the camera.
- Settings opens over the mounted camera. Guide and Practice return to Settings. Browser Back follows screen and drawer history; Escape provides the native Back action.
- Practice plays the actual cue vocabulary and offers a separate microphone check. It does not fabricate detections or change crossing progress.
- User/Developer mode, feedback, thresholds, visibility and other settings persist on this browser. The Developer session logger exports local CSV files containing counts and crossing state, without images or GPS coordinates.

## Browser capabilities

The camera preview is a flat Three.js scene using WebGPU where available, with WebGL 2 and direct-video fallbacks. iPhone/iPad previews use an oriented canvas texture to avoid the iOS external-video-texture rotation issue; source dimensions and cover cropping update when the camera orientation changes. The phone UI and map remain the original React Native Web components. The local COCO-SSD baseline runs through TensorFlow.js, preferring WebGPU, then WebGL, then CPU. Model initialization includes a real inference warmup before reporting readiness. It detects generic vehicles, people and traffic lights; it is not the native YOLO/TFLite model and cannot classify pedestrian walk/don’t-walk signals. Native model import and segmentation are unavailable. Detection reuses a canvas at a 300-pixel short edge, preserves aspect ratio, reads GPU outputs asynchronously and schedules the next inference on a fresh video frame. The former fixed 150 ms delay is removed. The original controls report unsupported native-model actions when used.

The shell, fonts, icons, Three.js renderer, detector backends and five model shards are precached after a successful first production load. Local inference and all local screens work offline; maps and online place/route services require connectivity. Browser storage eviction can remove cached files.

Speech uses installed browser/OS voices. Stereo tones reuse the native note sequences and panning; vibration reuses the original rhythms where supported. Voice recognition requires an available on-device English `SpeechRecognition` service; it reports failure with Retry/Voice help when unavailable and never switches to cloud recognition. The original command parser, conversational turn coordinator, saved places, route planner and journey logic are retained.

The Fly deployment uses `GOOGLE_MAP_API_KEY` for same-origin Places and walking-route endpoints. At the owner’s explicit request, the same existing native key is also configured as `GOOGLE_MAPS_BROWSER_KEY` for the interactive public web map. That browser key is deliberately visible through `/api/config` and Google Maps requests. The native environment file itself is never copied into the PWA or Docker image. `GEMINI_API_KEY` is unused and is not deployed. Local static-only builds can use a browser key through `VITE_GOOGLE_MAPS_API_KEY`.

## Fly deployment

Live URL: https://capstone-pwa.fly.dev/

App: `capstone-pwa`, personal organization, Sydney region, one shared CPU / 256 MB Machine, automatic stop/start, HTTPS. The Node server delivers static files and a bounded Google Places/Routes proxy. Camera/model inference still runs on the user's device.

```sh
npm run check
# When updating the existing Google key (including the public map):
node scripts/import-fly-secrets.mjs ../capstone_android/.env --public-map
fly deploy --remote-only --ha=false --yes
node scripts/smoke-deployment.mjs
```

The Docker build includes only `dist/` and `server.mjs`. Environment files, sources, tests and dependencies are excluded. Keys are configured at runtime; rebuilding the public assets does not embed them. The configured browser map key is intentionally public through the runtime configuration. `sw.js`, HTML and runtime configuration revalidate on the server; configuration and API responses are not stored by the service worker.

`npm start` runs the production server locally on port 8080. Fly imports are staged until the next deployment. The deployment smoke test uses a synthetic camera and a fixed Sydney test location to verify real Google services and offline screen loading.

Backgrounding releases the camera, stops listening and pauses route guidance. Returning reacquires the camera. An unfinished crossing remains explicit during the active page session; reload/OS termination does not restore crossing state. Camera assistance requires a fresh frame to start.

## Validation

```sh
npm run check
npm audit --omit=dev
```

The browser suite uses installed Chrome and Playwright WebKit (`npx playwright install webkit` if needed). See [TEST_REPORT.md](TEST_REPORT.md) for results and physical-device limitations.

## Implementation

- `src/ui/`: original phone screen components; browser history and platform imports adapted.
- `src/platform/`: browser camera, speech, maps, slider, storage, accessibility and CSV adapters.
- `src/state/controller.ts`: browser integration with the original engine and navigation stores.
- `src/nav/`, `src/voice/`: original destination, journey, bookmark, voice and speech logic.
- `src/shared/`: platform-free crossing, tracking, optical-motion, hazard, signal and sensor logic.
- `public/models/`, `public/fonts/`: self-hosted model and native font/icon assets.
- `scripts/build-sw.mjs`: content-versioned offline cache.

The original Android/iOS projects are unchanged. Third-party notices are in [THIRD_PARTY.md](THIRD_PARTY.md).

## Video performance benchmark

Run the local video benchmark against the Vite dev server (no video is included in the deployment):

```sh
BENCHMARK_BASE_URL=http://localhost:4175 node scripts/benchmark-video.mjs /absolute/path/to/video.mp4
```

Results and annotated frames are written to `artifacts/benchmark/`. The benchmark compares the original full-resolution COCO wrapper and 150 ms delay against optimized WebGL and WebGPU inference, including Three.js preview rendering. Chrome uses `--enable-unsafe-webgpu` during the benchmark; results record the actual adapter and backend. These measurements describe this host, not an iPhone or outdoor detection accuracy. `scripts/benchmark-app-video.mjs` also replays the video through the production app at localhost:4174 with active camera assistance.
