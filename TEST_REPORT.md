> Pedestrian detection update (13 October 2026): local pedestrian signal/countdown boxes and possible button boxes are now available. Open Help → Check a reference image to try the same detector on a local photo. Start crossing is disabled because the public models are not validated for Australian road use. Use Already in the road — get assistance to report an existing crossing. See [pedestrian implementation and limitations](docs/PEDESTRIAN_DETECTION.md).

# Current experiment validation - 13 October 2026

The final complete check passed: TypeScript, ESLint, 234 unit tests across 28 files, 8 server tests, production build, and 103 browser scenarios with 5 intentional synthetic-camera WebKit skips. This includes 24 new real-image regression checks across desktop Chromium, mobile Chromium and iPhone WebKit. The same six street photos retain all five visually identified pedestrian signals while removing three false green vehicle-light detections and the false foliage countdown. Two additional vehicle-light close-ups produce no pedestrian observations. The earlier countdown-21, button, offline, protected crossing commands, camera and recovery checks still pass. The packaged Chromium worker was also evaluated on all eight originals, preserving observations, rejected-candidate diagnostics and screenshots. These supplied images were used during development and are not a held-out accuracy benchmark. Details: [vehicle-exclusion implementation and repeated evaluation](artifacts/pedestrian/vehicle-exclusion-evaluation/REPORT.md). Physical-device and Australian field validation remain outstanding.

This build remains only in the separate experiment branch and folder. It has not been merged into main or published to Fly. Earlier deployed smoke/health results in docs/DEV_DEPLOYMENT.md describe the previous demo build. The original demo checkout remains clean at bb31c60.

The optional presenter build has 77 distinct passing scenarios, 8 intentional media skips and 2 unresolved forced CPU-only inference failures. It is excluded from the deployed demo. Physical-device validation remains outstanding.

## Historical reports

# capstone_PWA verification

Historical report for the 12 October baseline. The 13 October Eye Navi-style implementation, current results and remaining checks are recorded in [implementation status](docs/EYENAVI_IMPLEMENTATION_STATUS.md). The deployment observations below apply to the older main app. The current changes are deployed separately to [dev](docs/DEV_DEPLOYMENT.md).

Verified 12 October 2026 against the rebuilt phone UI and production PWA.

| Check | Result |
| --- | --- |
| TypeScript | Pass |
| ESLint | Pass |
| Unit/regression tests | 135 passed, 16 suites |
| Production server tests | 5 passed |
| Browser tests | 50 passed, 7 explicitly skipped, 0 failed |
| Production build and offline precache | Pass, 25 assets |
| Production dependency audit | 0 vulnerabilities (`npm audit --omit=dev`) |
| Full development dependency audit | 9 high findings in the React Native type package's native Metro/CLI dependency chain; these are not shipped in the browser bundle |

Command: `npm run check`. Browser projects: desktop Chrome, Pixel-sized Chrome, iPhone-sized WebKit. Seven live-camera cases are skipped only in WebKit because its runner provides no fake camera. All seven pass in both Chromium projects.

## Covered

- Original phone home, collapsed/expanded controls, settings disclosures and User/Developer modes.
- Settings → Guide/Practice → Settings → camera navigation, browser Back, hidden-screen accessibility and 320 px layout.
- Full-screen map and destination drawer, tap expansion/collapse, destination entry, explicit unconfigured-service errors, return to camera.
- Persistent preferences, actual native destination planner, saved-place cancellation/undo/persistence, walking instruction geometry, GPS freshness, explicit step progression and crossing completion.
- Original voice intents, question/answer turn policy, long-trip confirmation, barge-in, microphone cancellation, unavailable offline recognizer and Voice help recovery.
- Native cue waveform generation, distinct sounds, equal-power stereo panning and immediate speech cancellation.
- Crossing, tracking, optical-flow motion, hazard, sensor and signal regression logic.
- Real bundled COCO-SSD loading/inference against Chromium's synthetic camera, fresh-frame start guard and preserved camera element/crossing state through screen overlays.
- Camera denial/retry, failed-model camera release and successful retry, background camera release, retained explicit footpath completion.
- Offline screen reload, all five model shards, actual offline camera inference.
- Standalone manifest identity, icon dimensions and required font/model assets.

## Visual checks

Phone screenshots were inspected for the original screen hierarchy, colours, fonts, icons, spacing and absence of the former website chrome. Current screenshots:

- `docs/screenshots/mobile.png`
- `docs/screenshots/settings.png`
- `docs/screenshots/practice.png`
- `docs/screenshots/map.png`

React Native Web translates the source layout into DOM/CSS. These checks establish source/UI reuse and browser rendering, not a measured pixel comparison against a physical Android screenshot.

## Unverified integrations

Physical Android/iPhone camera permissions, rear-camera selection, installation, speech/recognizer availability, headphone routing, vibration, sensor permission, screen readers, OS process termination, sustained thermal performance and outdoor perception accuracy require real devices. Emulation cannot establish these.

The static preview has no Google key. The Fly deployment uses a same-origin Places/Routes proxy. At the owner’s explicit request, the existing native Google key is also exposed for the interactive web map through runtime configuration. Google map tiles and real Places and Routes API access were verified on the live deployment. Native YOLO/TFLite inference, native model import and segmentation are unavailable in this browser build. Pedestrian-signal phases are never inferred from the generic COCO traffic-light class.

The rebuild uses the original cue-practice screen, not synthetic scene controls. Active crossing state persists through overlays and background interruption within the current page, but is not recovered after reload/OS termination.


## Fly deployment checks

Deployed to https://capstone-pwa.fly.dev/ on 12 October 2026. Fly health check passes. HTTPS, runtime configuration, manifest identity and absence of Google/Gemini keys from compiled static assets were checked. The Google browser key is intentionally public in runtime configuration; Gemini remains undeployed. Five production-server tests cover secret isolation, fixed upstream endpoints, origin validation, walking-only route requests, static MIME/cache headers and exclusion of environment/source files.

The deployed-route test exposed drawer closure cancelling a just-started journey. The integration now closes the drawer only after the planner completes, and a regression test passes in desktop Chrome, mobile Chrome and iPhone WebKit.

Final live smoke test passed: deployed HTTPS phone UI, actual bundled camera inference on a synthetic camera, interactive Google map tiles, North up and Overview controls, real Google Places search, real walking-route response, journey start/pause/end, offline reload and Practice, with no uncaught browser or Google Maps API errors. Google marker duplicates are hidden from the accessibility tree, matching the native map, and the map canvas reserves space above the destination drawer for attribution and route bounds. Test location is a fixed Sydney fixture refreshed before location-sensitive actions. Physical-device validation remains outstanding.

## Three.js conversion

The camera surface now uses Three.js WebGPURenderer and VideoTexture with the same cover crop, no added controls and correct disposal on unmount. The existing phone UI, map, routes, voice and settings remain intact. Rendering suspends behind other screens and when the page is hidden. Unsupported graphics retain the direct-video preview.

TensorFlow.js detection prefers WebGPU and falls back to WebGL/CPU after initialization failures. The GPU option off uses CPU explicitly. Tests verify rendered camera frames, camera assistance with WebGPU unavailable, CPU mode, offline detector startup and camera interruption/recovery. Postprocessing tests cover class selection, overlapping-box suppression and output limits. Both WebGPU outputs are read asynchronously and all inference tensors are disposed. Frame preparation reuses a reduced-size buffer and inference waits for fresh video frames.

## Supplied highway video benchmark

Test input: 1920 × 1080 H.264, 20.294 seconds. Each backend ran for 20 seconds after model warmup, with the same 0.5 confidence threshold. The test browser is Chrome 154 on this Mac with a real Apple Metal 3 WebGPU adapter (not a fallback adapter), a 390 × 844 viewport and `--enable-unsafe-webgpu`. The supplied video is served only through the local Playwright fixture; it is excluded from Fly deployment.

| Pipeline | Measured detection FPS | Median inference | P95 inference | P95 frame processing |
| --- | ---: | ---: | ---: | ---: |
| Original WebGL + 150 ms delay | 5.0 | 32.9 ms | 35.9 ms | 40.1 ms |
| Three.js + optimized WebGL | 22.5 | 24.2 ms | 25.6 ms | 27.5 ms |
| Three.js + WebGPU | 30.0 | 11.2 ms | 12.0 ms | 14.2 ms |

WebGPU delivered about six times the original detection throughput on this host. Most throughput improvement comes from removing the fixed delay and reducing frame preparation; WebGPU further reduces inference cost. No measured processing frame exceeded 250 ms and TensorFlow tensor counts remained unchanged in every 20-second run. This does not measure sustained thermal behavior or establish absence of all memory leaks.

Raw metrics and timestamped detections: `artifacts/benchmark/results.json`. Annotated frames: `artifacts/benchmark/*-detections.png`. Real-time video decoding includes HTTP range support, and sampled detections wait for decoded video frames after seeking. The eight sampled times are not a labelled accuracy dataset; changed resizing can change confidence and detections. The footage cannot establish pedestrian-signal recognition, outdoor safety, or iPhone performance.

The production-app video replay ran with active camera assistance, Three.js WebGPU rendering and the app’s original 0.35 confidence threshold. All 20 sampled telemetry readings were available: FPS ranged 29–30, inference 10–11 ms, with 0 uncaught browser errors. Raw telemetry: `artifacts/benchmark/app-results.json`; phone screenshot: `artifacts/benchmark/app-phone.png`. This replay includes the actual crossing/tracking/UI pipeline, beyond the isolated detector benchmark.

Visual review of the annotated 11.4-second frame found a likely false-positive car detection on background foliage/rocks (about 53% confidence). Confidence is not measured accuracy. The generic COCO-SSD detector needs labelled validation and model work; higher FPS does not establish correct hazard decisions.

## iPhone preview orientation correction

The reported 90° camera preview rotation is consistent with the upstream iOS WebGPU external-video-texture issue (https://github.com/tensorflow/tfjs/issues/8733). The exact device failure has not been reproduced on a physical iPhone here. iPhone/iPad previews now normalize video through a reusable 2D canvas before Three.js uploads the pixels, including after source dimensions change. TensorFlow.js external video imports are also disabled on iOS; detection continues using its already normalized canvas and WebGPU backend. No fixed CSS rotation is applied.

Two Chromium regressions exercise the iOS-specific branch with a live four-colour captureStream, sample the rendered pixels, and verify quadrant orientation before and after portrait-to-landscape source changes. Platform tests cover iPhone, iPadOS desktop user agents, desktop Mac and Android. Full validation: 135 unit tests, 5 server tests, 50 browser tests passed, 7 physical-camera WebKit cases skipped. Physical iPhone confirmation and performance measurement of the additional canvas copy remain required; the earlier Mac benchmark describes the direct video-texture path.

The orientation correction is deployed to Fly. `SMOKE_IOS=1 node scripts/smoke-deployment.mjs` passed against the live site, verifying the oriented-canvas path, local inference, map controls, Places search, walking route, journey controls and offline reload using an iPhone user agent in Chromium. This exercises the deployed compatibility branch and does not substitute for Safari on physical hardware.
