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

- Home: Route guidance, Stroll, Settings and Help. Permissions are requested when features need them.
- Destinations: search, confirm identity, save Home/destinations, capture current location, rename, delete/Undo and review routes. Manual coordinates sit behind Advanced location editing.
- Walking: spoken instructions, map/overview, Repeat, Pause/Resume, crossing controls and End walk. Main controls are visible immediately.
- Walking tools: nearby places/optional announcements, change destination, overview and End walk.
- Settings: three speech presets, two supported routing preferences, four supported object categories, feedback/mono, text size, permissions and audio test.
- Help: quick start, phone position, voice commands, assistance limits and privacy.

Account, cloud backup, monitoring/check-ins, photo questions, research access, insurance, special areas, unsupported direction checks, manufacturer headset previews and automatic Stroll startup are removed. The server exposes no `/api/product/*` services.

Saved places and settings remain local; upgrading does not erase device data. Legacy unsupported routing preferences load as shortest distance. Old startup/recorder preferences cannot start the demo camera or recording.

## Presenter preparation

Route authoring, manual recordings, local maintenance and original developer tools are available in a separate opt-in build. They cannot be enabled by a URL or saved preference. The default build excludes these modules. See [demo scope and rehearsal](docs/DEMO_VERSION.md).

## Services and limits

The same-origin Google Places/Routes proxy uses `GOOGLE_MAP_API_KEY`; the public interactive-map key uses `GOOGLE_MAPS_BROWSER_KEY`. Private upstream credentials stay on the server.

Ordinary object settings cover Person, Bicycle, Car and Truck. Generic traffic-light recognition does not establish pedestrian signal phases or that crossing is safe. Crossing completion stays manual. Continue using established mobility aids and skills.

A successfully installed service worker caches screens, help, model shards, fonts and renderer. New maps/searches/routes need connectivity. Backgrounding releases the camera and pauses guidance. Browser storage can be cleared by the device.

## Verify and deploy

```sh
npm run check
fly deploy --config fly.dev.toml --remote-only --ha=false
node scripts/smoke-dev-deployment.mjs https://capstone-pwa-dev.fly.dev
```

Checks cover types, lint, unit tests, production build, server checks and demo workflows on desktop Chrome, Android-sized Chrome and iPhone-sized WebKit. Synthetic camera checks do not replace physical phone, screen-reader, GPS and audio verification.

Dev: [capstone-pwa-dev.fly.dev](https://capstone-pwa-dev.fly.dev/). [Deployment record](docs/DEV_DEPLOYMENT.md). `fly.toml` still targets the existing separate app.

The full pre-demo version is preserved in Git commit `5b92373`. Eye Navi parity documents and cloud setup are historical records; [demo scope](docs/DEMO_VERSION.md) describes the current application.

Third-party notices: [THIRD_PARTY.md](THIRD_PARTY.md).
