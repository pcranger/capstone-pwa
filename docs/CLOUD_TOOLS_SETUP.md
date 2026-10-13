# CrossWise cloud tools: implementation and operation

The app includes account, backup, location sharing, check-in and photo-question screens. Local navigation and file backup work without an account. Service availability is read from `/api/product/capabilities`; missing configuration produces an explanation rather than a successful-looking demo.

## Server configuration

Run the existing Node server (`npm start`) after building the app. Vite's preview server serves the UI alone and does not provide product APIs. Product endpoints are implemented in `server-advanced.mjs` and connected through `server.mjs`.

| Server environment variable | Purpose |
| --- | --- |
| `GOOGLE_MAP_API_KEY` | Private upstream Places/Routes credential used by the same-origin map proxy. Enables online search, walking routes and nearby queries. |
| `GOOGLE_MAPS_BROWSER_KEY` | Optional public, origin-restricted Maps JavaScript credential for interactive map tiles. Coordinate/text workflows remain available without tiles. Keep this distinct from the private upstream key. |
| `CROSSWISE_DATA_DIR` | Opt-in absolute directory on a persistent volume. Enables accounts, backup and sharing. Without it, those services are unavailable. |
| `GEMINI_API_KEY` | Server-only AI credential; enables photo questions when persistent account storage is also configured. Never use a `VITE_` variable for this key. |
| `GEMINI_MODEL` | Optional image-capable model identifier. Default: `gemini-3.8-flash`, verified against [Google's current model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) on 13 October 2026. The model remains configurable because provider availability changes. |
| `NODE_ENV=production` | Adds Secure to the session cookie. HTTPS is required for production accounts and browser camera/location use. |

`product-data.json` is sensitive account data. It contains salted password hashes, hashed session tokens, account identifiers, cloud backups, sharing data and stored AI answers. Image bytes are passed to the configured AI provider for request processing and are not written to this file. The file is written through a temporary file and atomic rename. Directory/file permissions are restricted where the host supports them.

This backend is for a single Node process on a research server. Do not run multiple replicas against the same JSON file: process-local serialization does not coordinate separate processes. A multi-instance deployment needs a transactional database and operational account recovery. Keep the persistent volume private and maintain protected operator backups. An ephemeral deployment directory does not provide durable accounts.

## Accounts and isolation

Create an account from More tools → Account. Passwords must contain 12–200 characters and are stored using Node scrypt with an independent salt. Session tokens contain random entropy and are stored as hashes. Sessions expire after seven days. The browser receives a host-only, HttpOnly, SameSite=Strict cookie restricted to `/api/product`.

Only same-origin requests are accepted. Account operations are rate limited. Every backup, sharing and AI request is authorized against the session owner; a caller cannot select an arbitrary owner ID. Sign-out invalidates its session and stops this device's active foreground publisher. Account deletion removes its cloud data and owner sharing sessions, and removes the account from other accepted observer lists. Local device data is separate.

These are research accounts. Email delivery, email verification, reset-password emails and provider-managed identity recovery are not present. The UI states this limitation and does not pretend to send messages.

## Backup and restore

The allowlist includes CrossWise settings, product preferences, saved-place rollback/v2 records, route preference, nearby preferences, authored routes/area packs and recorder settings. It excludes video blobs, captured photos, diagnostics and fetched provider configuration/content. Imports validate the per-feature schemas before any device write; v2 saved places and authored packs are normalized through their repository validators.

Local imports first show a list of changed sections. Restore replaces only the included sections and keeps absent sections. Export the current device first for an independent rollback copy. Writes attempt to roll back if device storage rejects part of a restore. Navigation, crossing and recording must end before import/restore; the confirmation rechecks current runtime state before mutation. A successful restore dispatches `crosswise-data-restored` so running repositories reload.

Cloud backups have revisions. Load and review the cloud revision before replacing it with device data. A stale revision fails with a conflict rather than overwriting a newer backup. Cloud deletion does not delete the device's local data.

## Location sharing and check-ins

An owner creates a bounded, expiring session and receives an unguessable invitation code. A different signed-in account must explicitly accept the invitation. There is no automatic contact upload or outgoing message. The user shares the code through their own channel.

Starting location transmission requests the browser's location permission. The publisher runs across in-app menus, stops on sign-out, and pauses while the document is hidden. A new session clears a previous session's arrival target. Position updates include sequence, accuracy, observation time and server receipt time; stale or out-of-order writes are rejected. The UI distinguishes recent and stale observations. Observers refresh every 15 seconds while visible and can refresh manually. Revocation is enforced immediately by the API; an already-rendered observer view clears on its next refresh. This is polling, not instant remote screen erasure.

Owners can send a real check-in message to accepted observers. Optional arrival check-ins require a configured coordinate, a radius of 20–500 m and a dwell of 10–120 seconds. The complete accuracy circle must fit inside the radius; leaving the radius resets dwell. Events are idempotent per target/session. This location event does not establish a safe arrival. Stop/pause transmission, revoke the session or leave as an observer through the visible controls.

Dwell uses fresh observations with no gap above 15 seconds. Backgrounding, location errors and poor/outside fixes restart the observation period. A pending network response rechecks visibility, target identity and dwell before sending an automatic check-in.

The PWA does not claim locked-screen, terminated-app or reliable background tracking. Native background integration remains separate work requiring device tests.

## Photo questions

Choose an image under 4 MB or capture a frame from the already-active camera. Still capture never creates a second camera stream; if no active frame exists, upload remains available. Review the image, enter a question (keyboard dictation may be used), explicitly select the upload checkbox and submit. The server sends a real image request to the configured Gemini model.

Each account gets 100 successful or currently processing requests per UTC calendar month by default. Reservations and idempotency IDs are committed before upstream calls; repeated requests return the existing answer without charging twice. Failed calls release the reservation. A retry of an old failed request still checks the current quota. Stale pending reservations can be retried after two minutes. Deleting stored answer text keeps the request/quota record and does not reset usage.

Follow-up questions reuse the selected image and bounded prior discussion. Load saved answers retrieves at most 100 questions, answer texts and dates from the signed-in account after revisiting the tool. Selecting a saved answer clears the current photo; history cannot recover an image, and a new submission still requires a selected photo and explicit upload consent. The owner can delete all stored answer text without resetting usage. Answers can be read through the shared speech scheduler and stopped. AI output never changes navigation or crossing state. Real-provider credentials were not used in automated tests; tests exercise the HTTP integration with a controlled upstream response.

## Other tools

Research access states that no payment is charged. Insurance states that CrossWise has no insurer agreement or active policy. Headphones provide actual Web Audio left/right/centre tones and a mono test. Bluetooth device identity, Sony Quick Access and sensor direction are unavailable; the action chooser is explicitly a session setup preview, not a hardware assignment.

## Verification

- `node --test tests/server-advanced.test.mjs`: account isolation, hashing, origin checks, backup conflicts, accepted/revoked sharing, AI idempotency, quota and retry.
- `npx vitest run tests/cloudTools.test.ts`: privacy allowlist, schema rejection, conflict preview, partial-restore rollback, check-in geometry, foreground freshness/accuracy, visibility pause and arrival dwell.
- `npx playwright test tests/e2e/cloudTools.spec.ts`: actual served app, missing-service states, account/backup/restore controls, two browser accounts sharing/checking in/revoking, image submission/answer deletion and headphone tones. Fixtures use temporary durable data directories and an isolated fake AI upstream, not live paid services.

Browser tests cover the supported workflows and small viewports; they do not establish real-device screen-reader quality, audio perception, outdoor GPS accuracy, insurer coverage or native background behavior.
