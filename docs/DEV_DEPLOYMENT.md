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
