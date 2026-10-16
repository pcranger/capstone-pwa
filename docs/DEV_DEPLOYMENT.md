# Current deployments — 16 October 2026

### Automatic permission requests on entry

Setup now requests missing camera, microphone and location access once automatically after the voice startup screen closes. First-time Agree and continue calls motion permission directly during that existing tap; setup consumes the same pending result. Returning users check existing motion access automatically instead of treating the mere presence of the API as a new undecided permission. Known grants and denials are not repeatedly requested; Continue remains at the top for a manual exit.

If motion permission is still undecided and a browser requires a tap, setup offers Allow motion. This follows the [orientation permission algorithm](https://www.w3.org/TR/orientation-event/#dom-deviceorientationevent-requestpermission); no saved application flag can replace the browser's grant. Automatic failures do not loop. Camera/microphone tracks stop even when the result arrives after setup was dismissed. Browser permission persistence and physical iPhone prompt behavior remain browser/device dependent.

Production build/typecheck, lint and 69 browser cases passed across desktop Chrome, Android-sized Chrome and iPhone WebKit, with three presenter-only skips. New checks cover automatic requests exactly once, the original Agree gesture, existing motion grants on entry, the one-tap gesture fallback, denied permissions without retries, waiting for the voice preparation screen and cleanup of a late camera stream after manual Continue.

Published main revision: `f957b05c5acf`. Image: `registry.fly.io/capstone-pwa:deployment-01M50244W8T1PV11J85N4YNCG0`.

Live Chrome and WebKit checks passed exact build identity and health, automatic first-open requests without Enable all, the original Agree gesture for motion, top Continue keyboard access, stopped media tracks, denied-permission manual exit, returning grants without a tap and a single motion tap when a new gesture is required. Permission APIs were simulated for repeatable checks; no personal camera or location was used. Reproduce with `node scripts/smoke-permissions.mjs https://capstone-pwa.fly.dev`.

### Automatic permission completion and accessible Continue

Permission setup opens Home automatically after every available permission is granted, including the final individual permission or a delayed motion approval. Already granted permissions are retained; an unavailable browser prompt does not block completion. Continue to CrossWise is immediately after the setup heading in visual and reading order, so Tab from the focused heading reaches it first. Completed setup replaces its history entry, and Home receives focus.

Production build/typecheck, lint and 57 browser cases passed across desktop Chrome, Android-sized Chrome and iPhone WebKit. Three presenter-only cases were skipped. Checks cover waiting for the last grant, unsupported motion, denied-permission manual exit, reading/keyboard order, focus and Back behavior. Actual VoiceOver remains a physical-device check.

Published main revision: `1569bc76ae5f`. Image: `registry.fly.io/capstone-pwa:deployment-01M5013J26D6AAN4V13V7BNJFV`. Live Chrome and WebKit checks passed exact release identity, HTTP health, top Continue placement and keyboard access, automatic completion after delayed motion approval, stopped camera/microphone tracks and denied-permission manual exit. Screenshots: [Chrome setup](../artifacts/permission-setup-chromium.png), [WebKit setup](../artifacts/permission-setup-webkit.png). Reproduce with `node scripts/smoke-permissions.mjs https://capstone-pwa.fly.dev`.

### Slower pedestrian observations and Home cleanup

The pedestrian observation freshness window is now 5 seconds (previously 1.2 seconds). Camera interruption still clears observations immediately. The verifier retains more source detail and checks the bottom foot rows of small red figures. The Home sentence “Plan your route. Stay informed at the crossing.” is removed. See [detection notes](PEDESTRIAN_DETECTION.md) for the supplied-screenshot limitations and verifier changes.

Main revision: `bf2f7629ee53`. Image: `registry.fly.io/capstone-pwa:deployment-01M4ZZX60PMATVTV1T7RD9JNNK`. Production build/typecheck, lint, 41 focused unit tests and 38 browser regression cases passed. One synthetic-camera WebKit case is intentionally skipped; real reference inference still runs in WebKit. Dev remains the earlier baseline.

Published checks passed exact service-worker identity, HTTP health and the reported red screenshot in Chrome and WebKit. Red scored approximately 0.786; inference took 1.52 s and 1.25 s respectively, excluding initial model loading. The published Home screenshot confirms the removed sentence. Dev revision `3fec05612876` was rechecked unchanged. Reports and screenshots are in `artifacts/pedestrian/freshness-deployed`; delayed live replay screenshots are in `artifacts/pedestrian/delayed-red-*.png`. Physical phone camera performance remains unverified.

### Location and closest-first search follow-up

Deployed image: `registry.fly.io/capstone-pwa:deployment-01M4YW2P7CANDS87SNJ4B5GTSB`. Live smoke passed exact build identity, real Google pharmacy matches ordered closest first, and a public test coordinate displayed on the map with a 150-metre accuracy estimate. The test uses a simulated location, not the user's position. Screenshots: [search](../artifacts/closest-search-live.png), [estimated position](../artifacts/estimated-location-live.png).

Main release revision `e06b3b76045b` requests the current browser location for destination searches, sends Google's `DISTANCE` ranking with a location bias, and sorts returned matches by straight-line distance. Without a recent estimate, results retain Google relevance and explain that proximity ordering is unavailable. Google may override location bias for an explicit location in the query, and its distance-ranking option does not apply to all query categories; local ordering applies to the returned matches only. See [Google Text Search documentation](https://developers.google.com/maps/documentation/places/web-service/text-search#rankpreference).

Locate me now shows valid coarse estimates, a blue position marker, accuracy circle and coordinates. Map/search estimates expire after 60 seconds. Navigation retains the existing 25-metre/15-second accuracy/freshness gates and movement consistency checks. The previous “Location uncertain” label was a navigation reliability warning; it did not mean the browser could never return coordinates. The replacement explains that updates are paused and directs users to check the map. The app requests high accuracy, but the browser/device determines the actual accuracy; displaying more decimal places cannot make a location exact.

Validation: production build/typecheck, lint, 37 navigation unit cases, 9 server cases and 15 focused browser cases passed on desktop Chrome, Android-sized Chrome and iPhone WebKit. Coverage includes automatic location acquisition, nearest-first sorting, denied-location fallback, approximate map display and preserved navigation accuracy gates. Dev remains the earlier baseline.

### Compact camera follow-up

Main was updated to revision `d1302fb5dff5`, image `registry.fly.io/capstone-pwa:deployment-01M4YVCBSDDNZPRSZJYT00XZDB`. Car/signal badges are 36 pixels high and show icons/numbers only, retaining screen-reader labels. Notifications are capped at 120 pixels; the idle “Camera assistance is off” notice is removed. Camera descriptions are requested using the information button and can be dismissed. Build, typecheck, lint and 12 focused browser checks passed; three WebKit synthetic-camera cases were skipped. Dev remains the preserved baseline below.

The compact follow-up also passed live smoke: exact deployed build, icon-only counters at the expected height, a running synthetic camera with no idle notice, real Hospital routing, street-level maps and offline reload. The deployed camera screenshot was inspected.

### Initial redesign release

As requested, the pre-redesign local baseline was deployed to **https://capstone-pwa-dev.fly.dev/** first. Revision: `3fec05612876`. Image: `registry.fly.io/capstone-pwa-dev:deployment-01M4YR2WCT3PMEBAR4AVJJB6E2`. Its first-open permission setup, real Hospital route, offline reload and exact build identity passed live smoke. It retains the previous Stroll label and theme for comparison.

The redesign is deployed to **https://capstone-pwa.fly.dev/** using `fly.toml`. Revision: `d0a4e041cd15`. Image: `registry.fly.io/capstone-pwa:deployment-01M4YS715T8SATXMMMTATQKPJX`. It combines Google Maps and route guidance, focuses pins at zoom 17, renames Stroll to Road crossing, shares a dark theme, and adds compact car/pedestrian indicators under Settings → Developer camera view. Missing permissions now reopen setup even when the old completion flag exists.

Comparison found that the previous deployed main rejected coordinate route endpoints while dev accepted them; both were missing recent local startup changes. Some valid Google routes to Wollongong Hospital contained geometry without written step instructions. Rejecting those sections caused the whole route to fail. The parser now retains them and explicitly warns that complete written/spoken instructions are unavailable. It never invents turns.

Verification: typecheck, lint, production and presenter builds, **243 unit tests**, **8 server tests**, **97 browser cases** across desktop Chrome, Android-sized Chrome and iPhone WebKit, plus **3 presenter accessibility cases** passed. Eight default cases were skipped: three presenter-only cases and five WebKit synthetic-camera cases. Live main smoke passed exact build identity, first-open permission setup, a real 811-metre Hospital walking route, street-level map tiles/zoom, the longer Sydney-to-Hospital route with missing-instruction warnings, compact developer indicators, offline reload and no uncaught/map-configuration errors. Main Fly HTTP health passed; dev health and unchanged baseline revision were rechecked after main deployment.

Screenshots: [main Home](../artifacts/release-main-home.png), [Hospital map](../artifacts/release-main-hospital-map.png), [developer camera view](../artifacts/release-main-crossing.png), [dev baseline](../artifacts/baseline-dev-home.png).

Close all old PWA tabs and reopen to activate the waiting service worker. Permissions are separate for the two origins; supported prompts need a user tap, and denied permissions may require browser settings. No camera or personal location was used in smoke checks. Blinking is an experimental estimate from repeated detections. Physical-device, VoiceOver/TalkBack and outdoor validation remain manual.

## Historical deployment — 13 October 2026

Deployed the current workspace production build to https://capstone-pwa-dev.fly.dev/ using fly.dev.toml. Service-worker revision: `5ada6bdaeb0d`. Image: `registry.fly.io/capstone-pwa-dev:deployment-01M4T2FS5PJ5QRQ28DV214EQQC`.

Validation: typecheck, lint, 234 unit tests, production build, 8 server tests and 103 browser tests passed; 5 browser tests skipped. Live smoke passed exact service-worker identity, HTTPS, health, settings persistence, real Google search/routes, journey controls, synthetic camera rendering and offline help. Pedestrian smoke passed green signal, countdown and possible button inference plus offline countdown in Chromium and WebKit. Fly HTTP health check is passing.

Close existing PWA tabs and reopen the URL if the previous service worker is still active.

---
# Current demo deployment

Deployed on 13 October 2026 to https://capstone-pwa-dev.fly.dev/ using fly.dev.toml. Build revision: a86e9be26bcb. Image: registry.fly.io/capstone-pwa-dev:deployment-01M4SAF59NVJWE2A1SBGE7ZXD0.

The original full version is saved in Git commit 5b92373. The separate capstone-pwa app was not deployed by this change. Google Maps configuration remains available on dev.

The current build removes product cloud APIs and non-demo screens. Presenter modules are excluded from the public bundle. See DEMO_VERSION.md for scope and preparation instructions.

Verification: types, lint, 199 unit tests, 8 server tests and 59 demo browser tests passed, with 4 intentional iPhone-runner synthetic-camera skips. Live deployment smoke passed exact build identity, HTTPS, settings persistence, real Google search/routes, pause/resume, detector rendering, End walk, removed endpoints and offline help. Fly HTTP health check passed.

Use the normal build and the explicit fly.dev.toml deployment commands in README.md. If an already-open tab retains old menus, close the old app tabs and reopen the URL so the waiting service worker can activate. Saved places/settings are not cleared.

Physical phone, screen-reader, vibration/audio and outdoor GPS checks remain manual. The separate optional presenter build has a known forced CPU-only inference failure; the default demo detector path passed local and deployed checks.

## Historical full-version deployment, superseded

# Fly dev deployment

Dev app: **capstone-pwa-dev**. URL: https://capstone-pwa-dev.fly.dev/.

Deployed on 13 October 2026 using the verified production build `a9e92c9f061b`. The separate configuration is `fly.dev.toml`; `fly.toml` still targets the existing `capstone-pwa` app.

The dev app runs one shared CPU / 256 MB machine in Sydney, with HTTPS, health checks, automatic stop when idle and automatic start on demand. Image: `registry.fly.io/capstone-pwa-dev:deployment-01M4S673F6JNQJV9ZBE18K6ED1`.

The existing Google map configuration was staged in the dev app without printing credential values. Places/Routes use the server proxy; the interactive map key remains intentionally public, as in the existing application. No credentials are bundled into the static build.

Accounts, cloud backup/sharing and photo questions are currently unavailable on this deployment: persistent account storage and Gemini credentials have not been configured. Local tools, recording, file backup, navigation and camera inference are available. See [cloud setup](CLOUD_TOOLS_SETUP.md) for optional service configuration and operational limits.

To update this dev app explicitly:

```sh
npm run build
fly deploy --config fly.dev.toml --remote-only --ha=false
node scripts/smoke-dev-deployment.mjs https://capstone-pwa-dev.fly.dev
```

The smoke check uses a synthetic camera stream and a fixed public Sydney coordinate. It verifies HTTPS/health, exact build identity, Home, settings persistence, twenty capability rows, live Google search and walking routes, journey controls, bundled detector rendering, End walk and offline local tools. It does not use the user's camera, personal location or photos, create cloud accounts, or replace physical-device validation.

Result: **passed** on the deployed URL. Fly's HTTP health check also passes. Initial harness runs were adjusted to expand walking controls and end the route before testing standalone camera assistance; the app's screen hierarchy and assertions remain intact. Screenshots: [dev Home](../artifacts/dev-home.png), [live route review](../artifacts/dev-route.png).
