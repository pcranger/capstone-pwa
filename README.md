> Pedestrian detection update (13 October 2026): local pedestrian signal/countdown boxes and possible button boxes are now available. Open Help → Check a reference image to try the same detector on a local photo. Start crossing is disabled because the public models are not validated for Australian road use. Use Already in the road — get assistance to report an existing crossing. See [pedestrian implementation and limitations](docs/PEDESTRIAN_DETECTION.md).

# CrossWise demo PWA

CrossWise demonstrates walking navigation, spoken guidance, on-device camera assistance, explicit crossing controls and nearby places. The original detector and model assets are unchanged.

## Run

```sh
npm ci
npm run build
npm start
```

Open http://localhost:8080. Production camera and location require HTTPS; localhost works for development. Static preview does not provide the map API proxy.

## Main flows

- First open: Agree and continue starts supported phone motion permission directly from that tap; setup automatically requests missing camera, location and microphone access. Returning users get automatic requests after voice startup finishes, including a check for existing motion access. Setup opens Home automatically once every available permission is allowed. Continue to CrossWise appears immediately after the setup heading for easy keyboard and screen-reader access. A browser that requires a fresh tap offers individual Allow buttons and Enable all as fallback; denied permissions may need browser settings. Browser permission persistence is controlled by the browser.
- On open, CrossWise checks the browser's on-device English recognition pack and starts installation when available. The startup screen shows download status, supports a tap to retry when the browser requires it, and continues to the app after the check. The browser does not expose a download percentage.
- Home: Route guidance, Road crossing, Settings and Help. Feature screens can retry denied or expired permissions. Returning users are shown setup when browser permissions are missing, even if they completed setup previously.
- Route guidance combines Google Maps search, pin selection, saved destinations and walking directions. Road crossing's map uses this same destination flow. Maps initially focus the selected pin at zoom 17; whole-route and all-place overviews are explicit actions.
- Destination search requests current location automatically, uses Google's distance ranking with a location bias, and sorts returned matches by straight-line distance. Without a current estimate it keeps Google relevance order and explains why. Explicit cities/addresses still determine Google's matching places.
- Locate me displays an estimated blue position marker, accuracy circle and coordinates, including coarse estimates. Display/search estimates expire after 60 seconds. Walking guidance retains its stricter 25-metre/15-second checks and rejects inconsistent movement; a visible map dot does not imply precise pavement positioning.
- Provider route sections without written instructions remain visible with a warning; the app does not invent missing turns. Unsupported route preferences are no longer offered.
- Developer camera view in Settings shows a car count and pedestrian indicator: grey unavailable/not detected, red or green observed phase, yellow possible blinking, and a detected countdown when available. It removes the old diagnostics popup and extra vehicle fields. Blinking is an estimate from repeated observations, not a verified signal phase or crossing instruction.
- Camera counters use small icons and numbers with screen-reader labels. Notifications are capped at 120 pixels, and the idle assistance-off notice is removed. The information icon requests a camera description; its text can be dismissed.
- Pedestrian observations now remain available for up to five seconds from capture to accommodate slower inference. Camera interruption still clears them. Symbol verification retains more image detail and includes the feet; the model weights and blocked Start crossing policy are unchanged. An observation may lag the actual light.
- Destinations: search, confirm identity, save Home/destinations, capture current location, rename, delete/Undo and review routes. Manual coordinates sit behind Advanced location editing.
- Walking: spoken instructions, map/overview, Repeat, Pause/Resume, crossing controls and End walk. Main controls are visible immediately.
- Walking tools: nearby places/optional announcements, change destination, overview and End walk.
- Settings: three speech presets, two supported routing preferences, four supported object categories, feedback/mono, text size, permissions and audio test.
- Help: quick start, phone position, voice commands, assistance limits and privacy.

Account, cloud backup, monitoring/check-ins, photo questions, research access, insurance, special areas, unsupported direction checks, manufacturer headset previews and automatic Road crossing startup are removed. The server exposes no `/api/product/*` services.

Saved places and settings remain local; upgrading does not erase device data. Legacy unsupported routing preferences load as shortest distance. Old startup/recorder preferences cannot start the demo camera or recording.

## Screen-reader and keyboard access

Use the device's VoiceOver or TalkBack, or a keyboard; no separate app mode is required. Screen changes focus the heading, dialogs keep keyboard focus inside, and hidden camera/map panels are removed from keyboard and screen-reader navigation. The walking-panel toggle and route completion controls work without gestures. Search results, entrance adjustments, voice status and route progress have text announcements. “Describe camera view” reads a timestamped snapshot of current supported detections, including their position in the image; it does not describe every obstacle or establish a clear path. Routes and nearby places also have text lists, and entrance coordinates can be changed with compass buttons.

Reader-friendly speech in Settings pauses ordinary scene narration while browsing menus. Keyboard regression tests are in `tests/e2e/accessibility.spec.ts`, including presenter controls. These automated checks do not certify compatibility with every screen reader; physical VoiceOver/TalkBack testing with blind users is still required.

## Presenter preparation

Route authoring, manual recordings, local maintenance and presenter tools are available in a separate opt-in build. They cannot be enabled by a URL or saved preference. The default build excludes these modules; its compact Developer camera view is available in Settings. See [demo scope and rehearsal](docs/DEMO_VERSION.md).

## Services and limits

The same-origin Google Places/Routes proxy uses `GOOGLE_MAP_API_KEY`; the public interactive-map key uses `GOOGLE_MAPS_BROWSER_KEY`. Private upstream credentials stay on the server.

Ordinary object settings cover Person, Bicycle, Car and Truck. Generic traffic-light recognition does not establish pedestrian signal phases or that crossing is safe. Crossing completion stays manual. Continue using established mobility aids and skills.

A successfully installed service worker caches screens, help, model shards, fonts and renderer. New maps/searches/routes need connectivity. Backgrounding releases the camera and pauses guidance. Browser storage can be cleared by the device.

## Verify and deploy

```sh
npm run check
fly deploy --config fly.toml --remote-only --ha=false
node scripts/smoke-release.mjs https://capstone-pwa.fly.dev
```

Checks cover types, lint, unit tests, production build, server checks and demo workflows on desktop Chrome, Android-sized Chrome and iPhone-sized WebKit. Synthetic camera checks do not replace physical phone, screen-reader, GPS and audio verification.

Main: [capstone-pwa.fly.dev](https://capstone-pwa.fly.dev/), using `fly.toml`. Dev: [capstone-pwa-dev.fly.dev](https://capstone-pwa-dev.fly.dev/), using `fly.dev.toml`. The 15 October release preserves the pre-redesign local baseline on dev and deploys the redesign to main. Do not deploy the new main build to dev when preserving this comparison. [Deployment record](docs/DEV_DEPLOYMENT.md).

Close all existing PWA tabs and reopen after deployment to activate the waiting service worker. Browser permissions belong to each origin separately; granting access on dev does not grant it on main. The browser requires a tap for some permission prompts and may require settings changes after a denial.

The full pre-demo version is preserved in Git commit `5b92373`. Eye Navi parity documents and cloud setup are historical records; [demo scope](docs/DEMO_VERSION.md) describes the current application.

Third-party notices: [THIRD_PARTY.md](THIRD_PARTY.md).
