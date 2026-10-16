# CrossWise: Eye Navi screen and product implementation plan

Revised 13 October 2026. This is the pre-implementation design record. The local implementation is now described in [implementation status](EYENAVI_IMPLEMENTATION_STATUS.md); future-tense estimates and choices below remain the original planning baseline. This revision supersedes the previous recommendation against a screen-by-screen adaptation. **Build Eye Navi-style screens, settings, destination management and walking workflows inside CrossWise. Preserve the installed detection model and useful CrossWise crossing, voice and practice features.**

Read with [screen specifications](EYENAVI_SCREEN_SPEC.md), [voice specifications](EYENAVI_VOICE_SPEC.md), [the full feature comparison](EYENAVI_FEATURE_MATRIX.md), and [all 40 historical screen records](EYENAVI_SCREEN_EVIDENCE.md). Later capabilities receive complete proposed screens where their original layout is unshown.

## 1. Product decision

Make CrossWise a complete walking-navigation product. Adapt Eye Navi's large Route guidance/Stroll buttons, pale blue headers, black settings lists, dedicated Home and destination management, radio-list settings, acknowledgment dialogs and clear parent/back paths. Translate to English and retain the CrossWise name. Reuse the working detector, map/search, crossing state machine and feedback engine underneath the new interface.

Do not require retraining, new weights, segmentation, TFLite migration or twenty-class recognition before implementing these screens. All twenty announcement categories can be represented; live availability must reflect actual model outputs. Unsupported categories receive an explanation and a clearly labeled practice sample. Generic traffic lights must not become verified pedestrian signals through relabeling.

Track completion at three levels:

1. **Screen coverage:** every documented workflow has connected accessible pages, including empty/loading/error/permission states and return paths.
2. **Functional PWA coverage:** actions perform actual local or server operations. Unsupported functions explain their limits and provide alternatives. Fake success dialogs, simulated observers and canned AI answers do not pass.
3. **Device/service parity:** background tracking/recording, manufacturer headset controls, specialized routing data and commercial insurance require native or contracted services. Their pages alone do not establish parity.

Use the reproducible 2023 screens as the visual baseline and add later capabilities in the same language. Later Eye Navi accounts describe automatic recognition and removal of the separate Stroll choice. Deliberately retain Stroll in CrossWise, with optional Start Stroll at launch; do not pretend historical and newer screens belong to one release.

The previous audit started the local server but the in-app browser blocked localhost. Interaction was performed on the public deployment; source inspection is the authority for this plan. Camera/location were unavailable in that browser session. No field performance or live Eye Navi iPhone test has been verified.

## 2. Preserve, replace and add

| Current CrossWise feature | Revised decision |
|---|---|
| TensorFlow.js/COCO model, loading and backend selection | Preserve unchanged. Add a post-inference announcement adapter. |
| Camera permission, brightness and phone-angle feedback | Preserve in walking and holding-guide screens. |
| Manual crossing start/far-footpath completion, vehicle alerts, sonar, tones/haptics | Preserve inside Stroll and Route walking; retain phase rules and critical feedback priority. |
| Google search/map/walking routes | Reuse; extend coordinate endpoints, candidate routes and nearby search. |
| Pause/resume/repeat/change/end route, long-route confirmation, location freshness checks | Preserve behind new route screens and Toolbox. |
| Saved aliases, duplicate checks, Undo, recent places | Migrate to stable IDs, Home role and user-owned coordinates. |
| Guide, microphone check, practice | Retain and expand; prominent Help entry. |
| User/Developer mode and CSV diagnostics | Keep; move developer details into Advanced. |
| Camera-first app entry and destination drawer as primary navigation | Replace with Eye Navi-style Home and full-page destination flows. A drawer may remain during walking. |
| Camera and ordinary scene narration behind every menu | Replace with explicit lifecycle and quiet menu policy. |
| Unsupported model-import controls | Keep only with truthful Developer availability status; no model replacement work. |
| My Routes, nearby reader, recorder, monitoring, photo questions, cloud settings | Add complete screens and real implementations, as specified below. |

## 3. Navigation and visual contract

Home → Route guidance → saved destinations/search → place review → route review → walking → arrival.

Home → Stroll → walking without destination → crossing/nearby/tools → Home.

Home → Settings → Home / Destinations / Obstacles and landmarks / Nearby facilities / Speech speed / Route preference / Feedback / Startup / Recording / Sharing / Account / Help.

Home → More tools → My Routes / Recordings / Monitoring / Photo questions / Headphones / Special areas / Backup / Help.

Eye Navi's historical Toolbox was visible but unopened. CrossWise's proposed Toolbox contains Repeat instruction, Route overview, Direction check, Nearby places, Change destination, Pause/resume, Recording, Share/check in and End walk. Do not attribute these inferred contents to the original.

**Proposed tokens, not measured Eye Navi assets:** Home #B9E3F5, header #C5E7F5, circular buttons #163B79, list #080A0C, text #FFFFFF, secondary text #C9D0D8, selection #70B8FF, separator #646B73. Check contrast before freezing. System sans font; 20 px body, 24 px heading, 16 px helpers, line height ≥1.4. Setting rows ≥64 px high; controls ≥48×48 CSS px. Home circles 140–160 px, stacking when two cannot fit. Respect safe areas, landscape, 320 px width and 200% text scaling. Back/TOP always has text. Version remains secondary near lower left. Do not use screenshots as functional backgrounds.

Use semantic buttons, radio groups, switches, headings and text inputs. Selected state has a check plus accessible state; chevrons mean navigation. Maps have equivalent lists/numeric editors. Do not reproduce the historical need to disable VoiceOver for pin editing.

Extend current history/back handling with typed page/modal descriptors rather than installing a second router. History holds IDs and lightweight state, never streams/blobs/API responses. Deep links resolve stored IDs and handle deletion. Back closes modal/keyboard, then child page, then returns to walking/Home. Unsaved edits offer Discard/Keep editing. Dialogs restore focus to their invoker. Success dialogs return to the originating workflow.

## 4. Implementation research and technology choices

### 4.1 Web foundation and storage

Retain React 19, React Native Web, TypeScript, Vite, Three.js and the existing store style. Do not upgrade dependencies during the screen migration. Existing Vitest, Playwright and server tests are sufficient. Add semantic shared components, typed page state and a Promise wrapper around IndexedDB; a new global state library is unnecessary.

Keep small settings in current storage initially. Store coordinates, custom routes, recording manifests/chunks in IndexedDB transactions. Estimate quota, request persistent storage where supported, handle refusal and provide export. Browser storage can be evicted and quota varies; never guarantee a permanent 2.5 GB allocation. [MDN storage guidance](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

### 4.2 Home, destinations and pin editing

Extend Google Places New behind the existing proxy. Add reverse-geocoding only for optional address labels: a user label and coordinate suffice when it fails. Support provider-place references, GPS coordinates and user-authored entrance overrides. Google advanced markers provide dragging/keyboard movement; add explicit north/south/east/west nudges, numeric fields, Use current location, Search address, Reset and Confirm. [Draggable markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/draggable-markers).

Separate user-authored coordinates/labels from fetched provider content. Store Place IDs under their documented exception; do not permanently cache full provider addresses, photos and geometry without checking permitted retention. A modified entrance is a user endpoint, not a changed Google business record. [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id).

### 4.3 Route preferences

Current client/server routes use a fixed WALK request to a Place ID and parse only one route. Add coordinate endpoints, all returned candidates, requested/applied preference metadata and ranking. The Google API accepts coordinate waypoints and alternate-route requests, but does not return alternatives for requests with intermediate waypoints. [Compute Routes contract](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes).

| Choice | Immediate honest behavior | Full implementation |
|---|---|---|
| Shortest distance | Rank returned candidates by length; say shortest of available routes. | Validated pedestrian graph optimized for distance. |
| Shortest time | Rank by estimated walking duration. | Provider duration plus optional tested walking pace. |
| Fewer stairs | Persist selection; explain current provider limit; require explicit Standard route fallback. | Pedestrian graph with stair penalties and measured coverage. |
| Covered paths | Persist selection; explicit fallback when coverage absent. | Covered/shelter attributes imported and weighted without inaccessible detours. |
| Near main roads | Persist selection; explicit fallback when unsupported. | Prefer pedestrian-accessible paths adjacent to suitable roads, never vehicle carriageways. |

Google's documented WALK-specific modifier is avoidIndoor; it does not implement those last three preferences. Avoid indoors is not prefer cover, and avoid highways is not stay near main roads. [RouteModifiers reference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteModifiers).

Recommended full-parity path: retain Google Maps/Places, add a separate GraphHopper pedestrian routing service using a bounded pilot-region OpenStreetMap extract. Custom models support priority/speed rules, distance influence and road classes including STEPS. Covered-path and road-adjacency attributes may require custom import/encoded values; they are not established turnkey capabilities. Validate known stairs/covered alternatives before expanding. No detector or immediate map replacement is required. [GraphHopper custom models](https://github.com/graphhopper/graphhopper/blob/master/docs/core/custom-models.md), [profiles](https://github.com/graphhopper/graphhopper/blob/master/docs/core/profiles.md).

Review shows provider, requested/applied preference, distance/time, warnings and unknown attributes. Unsupported preferences never silently label a standard route “fewer stairs.” My Routes through unmapped park paths use authored geometry, not an assumption that Google can route there.

### 4.4 Nearby facilities

Add `/api/maps/nearby` using Nearby Search New, explicit field masks, circular restrictions and approved category/type mapping. It returns a limited set, not a complete inventory. Deduplicate provider IDs and filter radius. Fast food, family and ramen restaurant types exist; Other dining is an app-side classification of eligible restaurant results outside those types. [Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search), [Place types](https://developers.google.com/maps/documentation/places/web-service/place-types).

Proposed tunable query policy: first foreground good fix, then movement ≥max(25 m, radius/2), at least 30 seconds between requests, 500 ms debounce for category changes. Cancel obsolete requests. None stops queries. Offline shows unavailable status; no invented current businesses from a permanent stale cache. Announce once per place/session unless requested; allow reset after substantial exit/re-entry. Distances are straight-line metres. Clock directions require reliable orientation; otherwise use compass bearing/distance only.

### 4.5 Voice, accessibility and direction

Reuse the existing feedback engine and catalog. Add stable event IDs with priority, expiry, deduplication and parameters. One arbiter handles object, route, POI, voice answers and confirmations. Seven Eye Navi rate labels have unverified units: map them to tested relative multipliers, not claimed words per minute. [Speech rate API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/rate).

App speed cannot change VoiceOver/TalkBack speed. Focus announcements come from OS labels/roles; concise live regions report actual state changes. Browser code cannot reliably know when a screen reader is speaking: offer Screen-reader-friendly speech mode and pause ordinary walking narration during menus. Dialogs trap focus and restore it on close. [WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Direction check uses route-segment bearing and a trustworthy platform heading, with calibration/status/uncertainty. Current diagnostic heading cannot become authoritative through new wording. When heading is absent, say Direction unavailable and keep route text usable. StereoPanner supplies left/right audio, not Sony head tracking or absolute orientation. Offer mono and headphone test. [StereoPanner](https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode).

### 4.6 Recorder

Share the existing camera stream; do not acquire a second camera. Use MediaRecorder, runtime MP4/WebM type checks, actual MIME metadata, short persisted chunks and approximately five-minute finalized clips. Callbacks are not precision timers; timestamp chunks and recover interruptions. Commit a new clip before deleting oldest unprotected clips. [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder).

Use rolling five-minute/50-clip defaults where space permits, plus a measured byte cap. Expose Protect, Export/share, Delete and Delete all. Microphone is opt-in; denial leaves silent video working. Exact MOV/OS Files folder parity needs a native recorder/filesystem adapter. Browser format/size/background behavior must be described truthfully. Recording-library screens are proposed because the original full interface is unshown.

### 4.7 Accounts, backup, monitoring and check-ins

Keep server.mjs as the API boundary. Recommended cloud stack: Supabase Auth plus PostgreSQL for backup, sharing relationships, sessions and check-ins. Row-level security restricts records to owners or accepted/unrevoked viewers; frontend never receives service-role credentials. Add session expiry and immediate revocation, including already-open observer streams. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

PWA location sharing is foreground-only. Proposed updates: at most every 15 seconds or after 20 m movement, carrying accuracy and observed/received timestamps. A stopped stream becomes stale rather than remaining labeled live. The geolocation specification waits while the document is hidden. [W3C geolocation](https://www.w3.org/TR/geolocation/).

For reliable background parity, package the same UI with Capacitor and separately evaluate a background-location native plugin/service. Core Capacitor geolocation does not directly support background tracking. Test OS permissions, lock, termination, revoke and battery before claiming it. This bridge preserves the model. [Capacitor geolocation](https://capacitorjs.com/docs/apis/geolocation), [community background plugin](https://github.com/capacitor-community/background-geolocation).

Add sign-in settings backup, also present in Eye Navi's current public feature table. Local use remains available without an account. Backup is separate from location/video upload, with schema migration, conflict preview, restore confirmation and cloud deletion. Do not sync private recordings implicitly.

### 4.8 Photo questions

Capture still → Review/retake → Question → explicit submission → server image request → Answer/read aloud → Follow-up. Use a configurable currently supported Gemini image-capable model because the project already anticipates Gemini; select its actual model ID at implementation time. Keys stay server-side. [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding).

An optional 100-per-month policy uses server-side atomic reservations and idempotency IDs; retries do not double-count. Support typed/dictated questions, Stop reading, delete conversation and visible upload/error/quota states. Default image retention to request processing only. AI answers never control crossing state.

### 4.9 Entitlements, insurance, headphones and special areas

Implement advanced software under clearly named Research access in the capstone; no payment is required merely to reproduce screens. Keep a plan/entitlement adapter for a future actual product. Do not display Eye Navi's price/insurer/trial as CrossWise offerings. Insurance gets an availability/details page, but an active policy requires a genuine provider agreement.

Headphone setup includes connection instructions, stereo/mono tests, environmental-hearing guidance, supported-action status and action mapping. Sony Quick Access/sensor direction requires verified manufacturer integration; ordinary Bluetooth is insufficient. The published integration describes app launch and nearby-information reading through Quick Access, plus directional audio; implement those action intents only through a verified platform adapter. Initial firmware setup may require Sound Connect. LinkBuds Clip lacks the documented magnetic-sensor directional feature. [Official integration explanation](https://note.com/eyenavi/n/n4c8629004dff). Special areas use versioned authored route/content packs, accessible destination lists and update status. Do not claim licensed Expo park content is already available.

## 5. Code change map

| Existing module | Work |
|---|---|
| src/ui/CrossWiseApp.tsx | Home, typed page/modal state, walking-session host, Back/focus restoration. |
| JourneyScreen.tsx / MainScreen.tsx | Stroll/Route mode, Toolbox and indicators; reuse camera/aim/crossing; hide developer clutter. |
| DestinationSheet.tsx | Extract search/results/review into full-page reusable bodies; preserve save/start separation. |
| MapPanel.tsx | User-pin editing, coordinate/nudge alternative and endpoint provenance. |
| SettingsScreen.tsx / settings/settings.ts | Parent/child menu, schema migration, rate/range/categories/radius/preference/startup/recording flags. |
| nav/savedPlaces.ts | v2 repository, Home, GPS/entrance coordinates, migration/Undo. |
| nav/navigation.ts / planner.ts | Endpoint union, candidates/preferences, nearby adapter, workflow intent and stale-request protection. |
| nav/journey.ts | Preserve crossing/fresh-fix checks; coordinate/authored routes and recovery. |
| voice/speechCatalog.ts / navigationVoice.ts | Event messages and commands; one scheduler. |
| platform/storage.ts | IndexedDB transactions/export plus old-settings compatibility. |
| config/services.ts / server.mjs | Nearby/coordinate routing, capabilities, authenticated backup/sharing/AI and bounded requests. |
| Service-worker build | New UI/help precache; private/cloud/video responses excluded from general caching. |

Proposed modules: ui/HomeScreen.tsx; ui/navigation/AppPage.ts; ui/common/{SettingsList,ChoiceList,ActionDialog,AcknowledgmentDialog,CoordinateEditor}; ui/places, ui/settings, ui/tools; storage/appDatabase.ts; places/placeRepository.ts; perception/announcementAdapter.ts; voice/announcementScheduler.ts; nearby/nearbyStore.ts; routes/customRouteRepository.ts; recording/recorderService.ts; sharing/sharingService.ts; account/backupService.ts; ai/photoQuestionService.ts; platform/capabilities.ts and nativeBridge.ts. These are proposed boundaries, not files already created.

One camera owner serves preview, inference, recording and still capture. Route, camera, recorder and sharing states are independent. Pausing route instructions does not secretly stop recording; stopping sharing does not end navigation. Menus cancel obsolete ordinary speech and requests without losing committed data.

## 6. Data and API contracts

| Record | Required invariants |
|---|---|
| Place v2 | UUID, provider-or-coordinate kind, label, optional Place ID, user coordinate/entrance override, Home/destination role, timestamps/revision; one Home; finite bounded coordinates. |
| Settings v2 | Version, startup, seven-level speed, feedback/reader mode, twenty categories, range, radius/taxonomy, route preference, recorder caps; persisted preference distinct from runtime capability. |
| CustomRoute | UUID/name/owner, ordered waypoints, authored geometry when needed, spoken notes, direction, revisions and coverage. Reverse creates a draft for review. |
| RoutePlan | Provider, endpoint provenance, all candidates/chosen route, requested/applied preference, warnings, steps/geometry/distance/time/fetched time. |
| Recording | Session/clip, actual MIME, time/size/chunks, finalized/interrupted, audio/protected; index by session/time. |
| ShareSession | Owner/accepted viewers/expiry/status/sequence; positions include accuracy and both timestamps. |
| CheckIn | Coordinate/place, radius/dwell, armed state, last event ID. Proposed 40 m/20 s defaults require GPS tuning. |
| AI request | Owner/idempotency, image metadata/question, reservation/count/result/error; no client secret. |
| Backup | Schema/device/revisions, settings and user-authored data; conflict preview before apply. |

Migration reads v1 without altering it, validates records, preserves aliases/saved times in v2 and commits transactionally. Offer a unique normalized Home alias as Home; resolve ambiguous aliases explicitly. Keep a rollback copy until reload succeeds. Failure leaves original storage intact. Downgrades never delete excess destinations.

API additions:

- POST /api/maps/route: origin, destination Place ID or coordinate, preference, alternatives, bounded waypoints. Server reconstructs allowlisted upstream payload; returns normalized candidates and support status.
- POST /api/maps/nearby: coordinate, permitted radius and app category IDs; server-approved type mapping/field masks. None performs no request.
- POST /api/ai/questions: bounded image/question/idempotency; authenticate and reserve quota when applicable.
- /api/shares: create/accept/revoke; owner-only sequence-numbered position writes; accepted-viewer reads; separate check-in events.
- /api/backup: authenticated upload/preview/restore/delete; /api/capabilities exposes configuration without secrets.

Validate input, authenticate cloud operations, bound payloads, throttle, time out and test authorization directly. Extend existing proxy validation; never accept arbitrary upstream URLs. Sharing links must be unguessable, expiring and revocable.

## 7. Detector and announcement adapter

Audit emitted labels before enabling person/bicycle/car/truck mappings. Keep existing verified/unverified signal semantics. Unsupported Eye Navi categories stay visible with Not detected by this version and Preview voice; synthetic practice never enters live tracking.

Range changes announcement filtering, not weights. Proposed Front zone x=0.25–0.75; Front and sides uses full image. No metre claim. Maintain a separate critical crossing/vehicle channel: All off suppresses ordinary object names, not critical crossing feedback. All on affects supported ordinary categories; unsupported rows remain unavailable. Explain this deliberate CrossWise distinction next to bulk actions.

Proposed tunable starting values: ordinary label cooldown 8 seconds per class/zone, maximum one ordinary label per 2 seconds, direction correction cooldown 5 seconds, POI once per session. Reuse current tracking/cooldowns without double suppression. Critical events preempt; canceled/expired labels never replay. Detailed messages and priorities appear in the voice specification.

## 8. Delivery sequence and estimates

| Milestone | Work | Completion evidence | Developer days |
|---|---|---|---|
| M0 | Freeze detector, baseline crossing/route, IDs/evidence | Model hashes unchanged and inventory traceable | 2–3 |
| M1 | Home/navigation/shared controls/all settings | Reachable/persistent settings, Back and focus | 5–8 |
| M2 | Storage migration/Home/destination CRUD/pin/route selection | Register→edit→navigate→delete and reload | 7–10 |
| M3 | Stroll/Route/Toolbox/direction/voice adapter | No duplicate speech/streams or crossing regression | 6–9 |
| M4 | Nearby endpoint/taxonomy/list/announcements | Radius/filter/dedup/offline/stale behavior | 4–6 |
| M5 | My Routes and recorder | Authored geometry, export/quota/recovery on phones | 8–12 |
| M6 | Account/backup/monitor/check-ins/photo questions | Real two-account revoke and real AI with quota | 10–15 |
| M7 | Product polish/accessibility/device tests | All page IDs and tasks accounted for | 7–10 |
| M8 | Routing dataset/native background/Files/headset integration | Separate real-device/data proofs | Additional 4–8+ weeks |

M0–M7: approximately **49–73 developer days**; core M0–M4: **24–36 days**. These are broad engineering estimates, excluding recruitment, provider agreements and store review. Native/vendor/data access can dominate M8. Review incrementally; do not equate screen coverage and background service parity.

Each milestone produces screenshots, screen IDs, completed tasks and unresolved constraints. When implementation is requested, use coherent modules/milestones for review. This planning task does not install cloud resources, buy services or publish a new deployment.

## 9. Acceptance plan

Use current Vitest for transitions/repositories/scheduler, server tests for validation/authorization, Playwright for workflows/keyboard. Add real iPhone VoiceOver and Android TalkBack sessions; desktop automation cannot establish mobile accessibility.

Required tasks:

1. New user reads help/terms, declines microphone, enters Stroll with camera, leaves/returns without a second stream.
2. Register Home by GPS/address; edit entrance with keyboard/nudges; Cancel retains original; navigation uses committed endpoint.
3. Search, Choose again, save alias, duplicate/capacity checks, delete one and Undo; reload preserves state.
4. Select all seven rates and Preview; app speed changes while OS reader remains independently controlled.
5. Select each route preference; unsupported status and explicit fallback; separately validate graph-based stairs/cover routes.
6. Exercise twenty category rows and both ranges without model changes; All off respects documented critical feedback behavior.
7. Every radius including None, dining filters/bulk actions; no duplicate POIs or stale late responses.
8. Start/pause/change/cancel/resume/repeat/off-route/GPS-loss/arrival/end; crossing completion does not advance route incorrectly.
9. Create/reorder/delete custom waypoints, notes, preview/reverse draft/cancel/reload; retain unmapped geometry.
10. Multi-clip recording, audio denial, quota/full/interruption/recovery/export/protection; old clips deleted only after commit.
11. Two accounts invite/accept/view/check in/revoke/expire; revoked observer blocked at API and stream.
12. Real photo question, retake/read/stop/retry without double-count/quota; normal walking remains available.
13. Backup, conflicting restore preview/cancel/apply, sign-out/cloud delete without unexpected local deletion.
14. Every page at 200% text, keyboard and mobile reader; dialog focus, heading order, selected/switch/error state.

Device matrix: Safari and installed iPhone PWA; Chrome and installed Android PWA; permissions granted/denied/revoked; online/offline/slow; low storage; speaker/stereo/mono; lock/unlock/calls; portrait/landscape. Native adds OS termination/reboot/background permissions and file recovery.

Measure before/after detector frame rate/latency, CPU/thermal/battery, recording bytes/minute, API request count, speech overlap and recovery time. Eye Navi battery/data figures are not CrossWise benchmarks. UI/recording changes must not compete with the detector enough to regress it.

## 10. Completeness and remaining evidence boundaries

Implement all historical menus and CRUD, route/walking/direction/nearby, recorder, My Routes, account/settings backup, photo questions, monitoring/check-ins, help/practice and failure screens. Keep CrossWise crossing, haptics, voice commands, Undo, accessible pin editor and diagnostics.

Conditional dependencies: advanced routing preferences, locked-screen operation, exact MOV folder parity, Sony hardware actions/sensors, actual billing/insurance and licensed special-area content. Each gets an honest availability screen and concrete integration work package.

Exclude the separate goggles product and the interview's experimental infrastructure/BLE signal concept from established app parity. Unknown Toolbox contents, unshown genre names/defaults and unverified spoken sentences are not recovered facts. The companion spec labels proposed replacements.

Choose 100 local destinations for Research access plus a separate Home slot; capacity is configurable. This counting rule is proposed, not established Eye Navi behavior. Preserve readable/exportable over-limit records on entitlement changes. Historical/current destination limits and startup differences remain attached to their evidence dates.

The supplied voice evidence is not a complete isolated audio transcript. English messages in this plan are proposed implementation strings unless specifically marked translated evidence. We can produce a detailed complete CrossWise product without claiming an exact reconstruction of hidden Eye Navi screens.

## 11. Sources

Historical details: the prior illustrated report and the timestamped screen_evidence.json corpus, reproduced in the evidence appendix. [Official Eye Navi product page](https://www.eyenavi.jp/) and [App Store history](https://apps.apple.com/jp/app/id6446274102) rechecked 13 October 2026 for current feature context. Primary technical documentation is linked at each decision above. Research establishes options and constraints; integrations have not yet been implemented or measured.
