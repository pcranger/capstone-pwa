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
