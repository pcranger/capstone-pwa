# CrossWise PWA

CrossWise now has an Eye Navi-inspired Home, dedicated settings, Home/destination management, route review, walking tools, custom routes, recording and optional cloud tools. The existing detector, renderer, manual crossing controls and developer tools are retained. Unsupported model categories and device services are identified in the interface.

## Run locally

From this project directory:

```sh
npm ci
npm run build
npm start
```

Open http://localhost:8080. The Node server serves the UI and configured APIs. Development and static preview use `npm run dev` or `npm run preview` (default port 4173); preview alone does not supply account/map APIs. Production camera, location and accounts require HTTPS; localhost works for development. These commands do not deploy.

## Main flows

- Home → Route guidance: Home-first destination picker, saved/recent destinations, search, coordinate capture, My Routes and Toolbox. Review the destination and route before starting.
- Home → Stroll: existing camera/crossing UI with Home, Tools, Nearby and End walk. Camera access and nearby announcements start explicitly.
- Settings → Home/Destinations: register by fresh GPS or address, name, review, edit an entrance by map/coordinate/nudges, delete and Undo. Existing saved places migrate to v2 while retaining the v1 migration record.
- Settings: seven speech levels with preview/stop, five route preferences, twenty object-category rows, front/sides filter, nearby radii/genres, feedback/mono, startup, text size and permission status.
- My Routes: author ordered points and spoken notes, reorder/Undo, duplicate, reverse into a reviewed draft, export/import and follow. Authored segments do not establish a walkable connection.
- Recordings: shared-camera video, optional microphone, pause/resume, protection, rolling count/byte limits, playback/export/deletion. Five-minute/50-clip defaults depend on storage. Actual browser format is shown; MOV is not promised.
- Monitoring: research accounts, expiring invitations accepted by another account, foreground location, manual/arrival check-ins, observer refresh and revocation. End walk stops this device's publishing; invitation revocation is separate.
- Photo questions: shared-camera capture or file selection, review, explicit upload consent, question/follow-up, read/stop and stored-answer management. AI credentials and quota stay on the server.
- Backup/Data management: reviewed validated exports/imports and scoped deletion. Videos export separately. Restore and broad data changes are blocked during navigation/crossing. Cloud and local data are separate.
- Help/Advanced: holding guidance, cue/object practice, voice setup, privacy/feedback, existing detector/display/model status and CSV diagnostics.

## Services and limits

Dev deployment: [capstone-pwa-dev.fly.dev](https://capstone-pwa-dev.fly.dev/). Use `fly.dev.toml` explicitly when updating dev; see [deployment record](docs/DEV_DEPLOYMENT.md). The existing `fly.toml` targets the older app.

Local tools work without an account. Maps use the existing same-origin Google Places/Routes proxy and server environment configuration. Browser map keys are intentionally public; private upstream credentials stay server-side.

Accounts, backup and sharing require `CROSSWISE_DATA_DIR`, an absolute private persistent directory. Photo questions additionally require `GEMINI_API_KEY`; `GEMINI_MODEL` selects an image-capable model. See [cloud setup](docs/CLOUD_TOOLS_SETUP.md) for exact configuration, retention, research-account limits and deployment requirements. Missing configuration has a visible unavailable state.

The Docker image packages `dist/`, `server.mjs` and `server-advanced.mjs`. An existing Fly deployment is separate from these local changes. Cloud storage needs a persistent volume; this backend supports one Node process.

The existing COCO-SSD weights/inference are unchanged. Ordinary names map to Person, Bicycle, Car and Truck. The remaining sixteen Eye Navi rows show unsupported state and practice samples. Generic traffic-light detection does not classify pedestrian signals. Critical crossing/vehicle feedback is separate from ordinary switches.

Shortest distance/time rank returned walking alternatives. Fewer stairs, covered paths and main-road preferences require explicit standard-route fallback with the present provider. Reliable body-direction alignment, locked-screen tracking, Sony Quick Access/sensors, insurance and payments require external/native integration.

The service worker caches local screens, help, model shards, fonts and renderer after successful installation. Maps/nearby/cloud actions need online services. Backgrounding releases camera, stops voice input, pauses route/sharing and finalizes recording. Reload does not invent a recovered crossing. Export important local data before browser storage is cleared.

## Verify

```sh
npm run check
```

This runs TypeScript, lint, unit tests, production build, both server suites and browser workflows. Chrome is used for two Chromium profiles; install WebKit with `npx playwright install webkit` when needed. Automated tests use local fixtures/synthetic media and no real external-provider photos/locations.

See [implementation status](docs/EYENAVI_IMPLEMENTATION_STATUS.md) for page coverage, results and remaining device/service checks. The plan, feature matrix, screen and voice specifications remain design/evidence records.

## Code map

- `src/product/`: shell, dedicated screens, speech scheduler, local/cloud tools.
- `src/nav/`: planner/journey, v2 places, nearby reader and route preferences.
- `src/ui/`: retained walking/camera, guide, practice and Advanced screens.
- `src/state/controller.ts`: shared camera/crossing/navigation/voice integration.
- `src/shared/`, `src/perception/`, `public/models/`: retained detection/crossing assets.
- `server.mjs`, `server-advanced.mjs`: static hosting, map proxy and opt-in services.
- `tests/`: unit, server and desktop/mobile browser verification.

Third-party notices: [THIRD_PARTY.md](THIRD_PARTY.md).
