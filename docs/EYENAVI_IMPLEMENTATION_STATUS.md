# Eye Navi-style CrossWise implementation

13 October 2026. Implemented in the local `capstone-pwa` checkout and subsequently deployed, at the user's request, to the separate [Fly dev app](https://capstone-pwa-dev.fly.dev/). See [deployment record](DEV_DEPLOYMENT.md). This record distinguishes usable PWA behavior from services/hardware that require configuration or physical-device validation. The source research, original screenshots, detailed screen specification and voice specification remain in the companion documents.

## Product outcome

The primary entry is now Home with Route guidance, Stroll, Settings, More tools and Help. The Eye Navi-inspired palette and dedicated settings replace the former camera-first shell. The existing CrossWise camera renderer, COCO-SSD weights/inference, manual crossing/far-footpath confirmation, navigation, voice commands and Advanced controls remain integrated.

Page families may share a screen or use nested review states. CW01–CW72 are design identifiers, not a claim of 72 independent components or exact recovery of unseen Eye Navi screens. English replacement copy is used. Unsupported services have useful, reachable explanations rather than simulated results.

## Coverage by planned page family

| ID | Implemented entry/workflow | Practical boundary |
|---|---|---|
| CW01 | Home, large Route/Stroll controls, Settings/More/Help, return to active walk | First-use notice precedes ordinary Home; no launch camera request |
| CW02 | Dedicated settings rows and child screens | Original controls remain under Advanced |
| CW03 | Welcome, use information, privacy, explicit versioned acknowledgment, readable terms/audio | Research information, no copied Eye Navi contract |
| CW04 | Camera/location/storage tests and microphone setup link | Motion, notifications and background/device limits explained; OS prompts remain feature-specific |
| CW05 | Seven levels 40/50/55/60/70/80/90, immediate persistence, preview/stop | Relative browser voice rates; OS reader speed stays separate |
| CW06 | Five desired walking preferences | Distance/time rank returned alternatives; other priorities need explicit standard fallback |
| CW07 | Speech/tones/haptics/detail, reader-friendly speech, mono output | Haptics and audio depend on browser/device |
| CW08 | Retained voice setup, microphone test, recognized text, command/manual fallback | Requires available on-device browser speech recognition |
| CW09 | System/large/extra-large text, wrapped controls, retained Advanced visual options | Full VoiceOver/TalkBack audit requires devices |
| CW10 | Opt-in Stroll startup and test | Does not restore a crossing or share location; recorder auto-start is a separate explicit choice |
| CW11 | Separate single Home role, absent/registered actions | Renaming Home retains its role, including voice lookup |
| CW12 | Fresh GPS capture, accuracy/time review, retry, Use this location, frozen naming draft | Existing freshness/accuracy rules retained |
| CW13 | Home address search and reviewed selection | Needs configured maps service |
| CW14 | Named Home deletion, confirmation, acknowledgment and Undo | Route snapshots remain separate |
| CW15 | Entrance editor, latitude/longitude, map click, directional nudges/increment/reset, address/GPS alternatives | User entrance differs from provider identity |
| CW16 | Home review, actual coordinate/provenance, edit/delete/route | Provider details need online service; user coordinates remain local |
| CW17 | Home-first destination picker, recents/all, search/current position, My Routes/Toolbox shortcuts | Choosing a row opens review |
| CW18 | Destination registration/manage/count/capacity | 100 research destinations plus Home is a CrossWise policy |
| CW19 | Search, numbered matches, address/location-biased distance, clear/cancel and retained input | Generation checks discard stale replies; no service is reported as available without configuration |
| CW20 | Name/rename, normalization/duplicates and frozen coordinate save | Storage failure retains draft |
| CW21 | Confirm place, register, choose again and route review | No implicit journey start |
| CW22 | Route summary, warning/steps/alternatives, requested/applied preference, start | Unsupported pedestrian attributes are not invented |
| CW23 | Durable save/update/delete acknowledgment and usable return | Success follows repository commit |
| CW24 | Registered destinations, recent/all list, map/list, empty/count | Coordinates are usable without provider-detail cache |
| CW25 | Saved-place review, rename/edit entrance, delete/navigation | Stable record identity across address edits |
| CW26 | Named destination deletion and Undo | Deleting saved record does not mutate active journey snapshot |
| CW27 | Front only/front and sides, type-list entry | Ordinary announcement filter; detector unchanged |
| CW28 | All twenty category rows, four supported switches, bulk on/off, individual practice | Sixteen unsupported live categories cannot be enabled |
| CW29 | None and nine distance radii, nine genre groups | None disables queries; automatic reading starts explicitly for a walk |
| CW30 | Genre/subtype switches and group controls, persisted selection | Nonobserved historical taxonomy uses documented proposed choices |
| CW31 | Stroll with retained camera/assistance and new walking navigation | Permission denial remains recoverable; one shared stream |
| CW32 | Existing route walking, instructions/repeat/pause/resume, fresh location | Authored routes keep their ordered geometry/notes |
| CW33 | Retained crossing/far-footpath controls, critical cues across menus | No automatic safe-to-cross claim; End blocked during unfinished crossing |
| CW34 | Full map and textual overview, steps, warnings and duration when supplied | No fabricated intersection/accessibility metadata |
| CW35 | Direction availability, repeat route instruction, overview/practice alternative | Dependable body-direction alignment awaits calibrated native sensing |
| CW36 | Toolbox with repeat/overview/direction/nearby/change/pause/end and tools | Replacement destination can be canceled while original journey remains paused |
| CW37 | Nearby list, category/radius filtering, distance/compass, explicit read, session auto reading | Foreground only; bounded/throttled queries and deduplication |
| CW38 | Nearby detail, save destination, route handoff | Compass is used without an unverified body-heading clock direction |
| CW39 | Manual arrival summary, planned length, Continue Stroll, another destination, Route Home, End | User-confirmed arrival differs from verified entrance; Route Home waits for endpoint resolution |
| CW40 | Retained GPS/off-route/camera/voice recovery, retry and route alternatives | No fabricated persistence of crossing after reload |
| CW41 | More tools and capability-aware entries | Local and optional online tools remain reachable |
| CW42 | My Routes list/create/import/open, local persistence | Account not required |
| CW43 | Ordered waypoint editor, saved/search/GPS/manual coordinates, notes, reorder/delete/Undo, dirty-draft confirmation | Map is optional; no inferred walkable graph |
| CW44 | Route preview/start/edit/duplicate/reverse/export/delete and >1 km review | Reverse clears directional notes for review; origin must be near first point |
| CW45 | Recorder enable/auto/audio/clip/count/byte settings and actual format | Browser MediaRecorder format; no MOV guarantee |
| CW46 | Actual recording, pause/resume, protect, finalize, elapsed/status and storage failures | Shared camera; microphone optional; empty clips are errors |
| CW47 | IndexedDB library, protected filter, metadata, bulk export/delete | Rolling retention removes oldest unprotected clips; important clips need export |
| CW48 | Playable browser video, protection, download/delete and reload persistence | Unsaved finalized Blob remains exportable after quota failure |
| CW49 | Monitoring hub and owner/observer roles | Requires configured persistent account service |
| CW50 | Expiring session/invitation, explicit second-account acceptance | No automatic messaging or contact upload |
| CW51 | Foreground publisher, age/accuracy/status, pause/revoke/manual check-in | Background/locked-screen tracking unavailable; End walk stops publishing |
| CW52 | Accepted observer session list and leave | No public account enumeration |
| CW53 | Authorized location/accuracy/time and check-in list, refresh/revoke handling | Accessible coordinate list supplied; observer polls every 15 seconds, no historical trail |
| CW54 | Target coordinate/GPS, name/radius/dwell, arm/disarm and event display | One active target per foreground session; no push notification/native background delivery |
| CW55 | Existing-camera still capture or supported file upload | Capture alone sends nothing; no second camera |
| CW56 | Photo review/remove/retake, question/dictation via keyboard, explicit upload consent | Image validation and configured AI/account required |
| CW57 | Answer/follow-up/read/stop, saved answer history/reopen/delete | Saved history is question/answer/date only; original image must be selected again for new image questions |
| CW58 | Real research registration/login/logout/account deletion | Hashed credentials/cookie sessions; no email verification or password recovery service |
| CW59 | File/cloud backup, changed-section preview, revision conflicts, validated restore | No video sync; absent sections preserved; running stores refreshed; active journey/recording blocks restore |
| CW60 | Research access and actual server AI usage/quota | No payment/trial simulation; 100 monthly requests by default |
| CW61 | Reachable insurance availability page | No active insurer agreement/policy |
| CW62 | Actual left/right/centre/mono channel test and setup | Output device identity cannot be confirmed by browser |
| CW63 | Hardware-action explanation and future-adapter intent preview | No Sony Quick Access assignment or direction sensor claim |
| CW64 | Local pilot area-pack author/import/update/remove, version/source, routes/landmarks | No official Expo content bundled |
| CW65 | Help/practice hub, guide/voice/object/cue/privacy/about entries | Essential instructions are text, locally cached |
| CW66 | Holding/rear-camera/lighting guidance with current camera status | No required pouch purchase |
| CW67 | Retained real cue vocabulary plus twenty objects/direction/nearby practice | Samples cannot change live crossing/route/sharing state |
| CW68 | Permissions/status plus retained guide recovery instructions | Physical OS permission/settings instructions still require device verification |
| CW69 | About/current recognition limits, feedback text/copy, privacy | User chooses where to send; nothing sent automatically |
| CW70 | Existing Advanced/developer/model/display/CSV/voice tools | Weights and inference implementation preserved |
| CW71 | Data sizes/manifest, full local backup merge/import, scoped deletion/all reset | Credentials/provider content/videos excluded from JSON; videos export separately |
| CW72 | Named dialogs, dirty-draft confirmation, unsupported/error/status states, browser Back/Escape | Shared modal Back cancels before underlying page; physical-reader focus remains a device sign-off item |

## Integration and data decisions

The shell mounts the walking UI once and keeps its camera identity across menus. The controller owns the camera stream; recording and still capture reuse it. A bounded priority speech scheduler deduplicates and expires ordinary descriptions. Critical events preempt descriptions. Stopping a preview does not cancel a critical warning. Ordinary scene and nearby speech pause in menus by default; requested reading remains available.

Route startup preserves its first instruction until the walking screen opens. Explicit repeat works from tools. Ending a walk clears camera-resume intent, while a background interruption preserves an active session's intent. Auto-Stroll is evaluated once at launch. Leaving an authored-route tool cancels a pending GPS start; import/reset also recheck pending navigation before mutation. Nested Back handlers change synchronously with their screens, and dialog Back cancels the dialog first.

Saved-place v2 migration preserves existing labels/IDs and a v1 rollback record. Provider identity, Home role and user entrance overrides are explicit. Validated backup restore reloads every affected live repository/settings store. The full local backup combines reviewed merge results into one restore transaction; it cannot accidentally replace current routes through a duplicate extra section. All-local reset clears legacy/current place records, preferences, authored content and diagnostics, while cloud data remains separate.

The planned hosted database was replaced with an opt-in, single-process Node persistence adapter to make the existing application runnable without a new external account. Credentials are salted/hashed, sessions protected by cookies, mutation origins checked, ownership derived server-side, writes serialized/atomic, backups revisioned and sharing accepted/revocable/expiring. See [cloud operation](CLOUD_TOOLS_SETUP.md). Production needs HTTPS, a persistent private volume and operational account recovery; multiple replicas require a transactional database.

Automatic check-in requires consecutive fresh observations inside the target accuracy circle. Hiding the app, a location error, a poor/outside fix or a GPS gap resets dwell. Late position responses cannot check in against an old target or an interrupted observation period.

## Validation record

The implementation was tested incrementally, with failures fixed before broad verification. Browser workflows cover desktop Chrome, Pixel-sized Chrome and iPhone WebKit. Media tests use actual browser MediaRecorder/Blobs/IndexedDB with animated test-camera frames, and actual detector/model loading for camera regressions. Map and cloud tests use local controlled service responses; no user's precise location, personal image or real credentials were submitted to external services.

Final verified production build: `a9e92c9f061b`, 26 precached assets. Checks were run separately through the same entry points used by `npm run check`.

| Check | Result |
|---|---|
| TypeScript and ESLint | Pass |
| Unit/regression suites | 210 passed in 26 files |
| Server suites | 17 passed |
| Desktop Chrome browser cases | 50 passed |
| Pixel-sized Chrome browser cases | 50 passed |
| iPhone WebKit browser cases | 42 passed, 8 intentionally skipped |
| Unique verified browser cases, combined | 142 passed, 8 intentionally skipped |
| Production build/offline precache | Pass |
| Model/perception source and weight diff | No changes under `src/perception`, `src/shared` or `public/models` |

The 150-case combined run produced 141 passes, eight planned skips and one new test-fixture failure: WebKit discarded an early seeded route before the pending-GPS assertion could run. The fixture was installed in the loaded page, without changing application code or weakening assertions. The complete 21-case shell suite then passed across all three profiles, including the corrected case. These combined results account for every one of the 150 cases. A separate five-repeat WebKit Back check also passed. An earlier interrupted run was discarded after its shared preview server shut down; final verification used an independently owned server.

Seven WebKit skips are synthetic-camera/inference/renderer cases and one is actual synthetic-video recording, because that Windows WebKit runner lacks the required capture support. All eight corresponding workflows pass in both Chrome profiles. Their physical iPhone confirmation remains outstanding.

Coverage includes new Home/settings, persistence, all twenty capability rows, permission denial, startup/end, GPS capture and pending-start cancellation, destination CRUD/Undo/entrances, route preferences and fallback, paused replacement, arrival/Route Home, nearby filtering, authored routes and area packs, recording/playback/export, scoped reset/merge guards, account isolation, backup conflict/restore, accepted sharing/check-in/revocation, photo consent/answers/history and audio controls. Existing crossing, camera/model recovery, CPU/GPU fallback, orientation and offline inference regressions pass. Unit checks specifically cover urgent speech preemption, initial route speech, camera-resume intent, stale replies, dwell interruption and Nearby recovery.

Manual browser review verified the new Home, settings/object list, custom-route waypoint validation and missing-cloud-service states. Desktop/mobile screenshots were visually inspected, including the corrected iPhone select and 320-pixel extra-large text wrapping. Images: [Home](../artifacts/crosswise-home-chromium.png), [mobile Home](../artifacts/crosswise-home-mobile-chromium.png), [iPhone destinations](../artifacts/product-destinations-iphone-webkit.png).

Test entry points: `npm test`, `npm run test:server`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`. Final browser commands were `npx playwright test --workers=2 --output=test-results-final-all` followed by `npx playwright test tests/e2e/productShell.spec.ts --workers=2 --output=test-results-final-shell` after the fixture correction. The latest HTML report contains the 21-case rerun; the directories preserve the verification sequence.

Known build messages are retained: React Native Web's ignored `use client` directives and large detector/renderer bundles. They do not fail the build. The service worker caches the existing model shards and local screens; offline camera inference is checked independently of online services.

## Remaining sign-off

Physical iPhone/Android camera, VoiceOver/TalkBack, outdoor GPS, device vibration/audio, storage pressure and long-duration power/thermal behavior require real hardware sessions. Synthetic browser tests establish integration behavior, not outdoor navigation accuracy. The existing physical-device evaluation protocol remains applicable.

The local implementation tests used controlled Google/Gemini responses. The subsequent Fly dev smoke test verified live Google search and walking routes; live nearby and Gemini requests remain unverified. Optional online tools require the documented server configuration. Native background tracking, dependable body alignment, manufacturer headset actions, exact MOV storage, expanded recognition classes, specialized pedestrian graph preferences, insurance and commercial billing are separate integrations. Their screens describe current availability; they are not silently represented as working parity.

No new native detection model, provider-service purchase or real account/location-sharing invitation was created. The subsequent Fly dev deployment is recorded separately; the existing app was not redeployed.
