# CrossWise / Eye Navi-style screen specification

13 October 2026. Companion to EYENAVI_PARITY_PLAN.md. CW01–CW72 are implementation page families, not a claim that Eye Navi has exactly 72 screens. Dialogs and failure states are additional variants. **Observed** means recovered historical UI; **published** means a described capability without a full original walkthrough; **proposed** means a CrossWise design choice. All replacement copy is English.

## Shared behavior

Pale-blue header with named parent Back/TOP at left, centered title, optional contextual action at right. Black list content, white labels, separators, selected blue check. Home and camera pages are exceptions. Screen-reader order: header, explanation, primary controls, status, bottom actions. All icons have names. A row and child switch must not become two conflicting controls.

On entry focus heading or meaningful instruction; on return restore the invoking row and scroll. Radio/switch changes persist immediately. Text/pin/route drafts commit only with Save/Confirm. Loading has meaningful status and Cancel where possible. Empty states offer Add/search. Errors retain input and offer Retry/Back. Canceled requests cannot later change a closed page.

Camera, route, recording and sharing have independent status. Menus pause ordinary object/POI narration; critical crossing feedback keeps existing rules. Leaving a crossing never silently resets its phase. Map functionality always has a list/coordinate alternative. Every applicable page needs large-text, keyboard, mobile-reader, offline and permission variants.

## A. Entry and ordinary settings

### CW01 — Home [observed S01; extended]

Pale-blue background, CrossWise title, two large dark-blue outlined circles: Route guidance left, Stroll right. Rounded Settings centered below; More tools and Help and practice underneath; version/build near lower left. Route opens CW17; Stroll CW31; Settings CW02; tools CW41; Help CW65. No permission prompts for opening Home. Resume walk appears only for a recoverable session and requires freshness review. Auto-Stroll has visible Cancel and respects browser audio restrictions. First use opens CW03.

### CW02 — Settings root [observed S02; extended]

TOP returns Home. Rows: Home; Destinations; Obstacles and landmarks; Nearby facilities; Guidance speech speed; Route preference; Feedback and voice; Startup; Walking recorder; Monitoring and sharing; Headphones; Account and backup; Help and practice; Advanced. Each row opens a child and may show current summary, e.g. Not registered, saved count, radius, speech level. Parent returns preserve focus/scroll. Do not duplicate writable startup controls in two places.

### CW03 — First use / terms [published/proposed]

Welcome, concise purpose/current capabilities, internet needs and mobility-aid guidance. Read aloud/Stop; Terms; Privacy; Continue/Agree. Record policy version/date after an explicit action. Decline stays outside active camera use. Text remains readable offline after installation. CrossWise needs its own terms, not copied Eye Navi legal promises. A policy update must not erase local data.

### CW04 — Permission and service setup [proposed]

Rows Camera, Location, Microphone, Motion/direction, Notifications and Persistent storage, each with reason/status/Enable or test. Request individually when needed. Microphone is optional for voice/audio, motion for direction, notifications for check-ins. Denied/revoked has device instructions and alternatives; unknown is not Allowed. Continue with available features remains available. No request-all launch gate.

### CW05 — Guidance speed [observed S03–S05]

Seven radio rows 40, 50, 55, 60, 70, 80, 90; one blue check, immediate persistence. Explain App messages only; screen-reader speed uses device settings. Preview message/Stop preview below. Proposed relative mapping: .60/.75/.85/1.00/1.20/1.50/1.80 respectively; these are calibration candidates, not Eye Navi units. Existing .85 migrates to 55. Actual engines require phone testing. No Save button or words-per-minute claim.

### CW06 — Route preference [observed S06–S07]

Radio rows Shortest distance, Shortest time, Fewer stairs, Covered paths, Near main roads. Selection persists; each shows supported/limited status. Explain priorities depend on map information. Store desired unavailable choice but require explicit fallback in CW22. Learn about preferences explains practical trade-offs. No car modifier is presented as a pedestrian accessibility preference.

### CW07 — Feedback and voice [CrossWise retained]

Speech/Tones/Haptics switches; speech level link; Minimal/Normal/Detailed verbosity; Screen-reader-friendly mode; stereo/mono; Preview; voice help. Speech off retains text/accessibility. Unsupported vibration has a readable unavailable state. Separate ordinary object/route/POI quiet preferences from critical crossing cues. Preview samples never execute live crossing actions. Reuse one feedback engine.

### CW08 — Voice setup/check [CrossWise retained]

Availability/language/engine, Microphone test, Start voice turn, Stop, commands and typed fallback. Test shows recognized text without executing it. Denial/offline availability has instructions and text controls. Leaving ends microphone session. Commands call the same handlers as buttons. No hidden always-listening microphone.

### CW09 — Display/accessibility [proposed]

System/Large/Extra-large text, larger status, reduced motion and screen-reader speech policy. Preview uses real row/button/switch. Follow OS defaults where practical. Immediate persistence; 320 px/landscape/200% text must work. App speech rate, visual text size and OS reader settings remain distinct.

### CW10 — Startup [observed option; extended]

Start Stroll when app opens switch; explanation of camera/audio permissions; optional Remember last walking mode off by default. Test startup/Back. No automatic recording, sharing or old-crossing resume merely because Stroll starts. Permission failure lands in the walking permission state, not a redirect loop. Stored route recovery requires review.

## B. Home, destinations and route selection

### CW11 — Home actions [observed S08/S11/S14]

Absent Home: Register current location; Register by address; Back. Registered: Confirm Home; Edit Home; Delete Home; Back, with endpoint summary. GPS→CW12, address→CW13, confirm→CW16, edit→CW15, delete→CW14. One Home role. Replacement names old/new Home before commit. Home is not simply an arbitrary favorite alias.

### CW12 — Current location capture [observed workflow; reliability extension]

Title reflects Home/save intent. Getting location, accuracy/age, coordinate and optional address. Retry; Use this location; Cancel; address/pin alternative. Start with existing fresh-fix rules (≤15 s old, ≤25 m accuracy), then validate usability. Insufficient fix explains retry/open area. Never save an old cached walk location. Reverse-geocode failure does not invalidate a good coordinate. Naming follows CW20; coordinate is frozen for that draft.

### CW13 — Home address entry [observed S09–S10]

Enter Home address field with Clear, Search, Cancel; OS keyboard/dictation. Empty errors associate with field; retain reasonable 240-character input limit and wrap. Search→CW19 with Home intent; do not save first result automatically. Cancel→CW11. Search failure retains typed address. Similar matches need identity review.

### CW14 — Delete Home [observed deletion; recovery extension]

Delete Home? names endpoint; Delete Home/Cancel. Success Home deleted, OK, Undo. Failure retains record. Historical pre-delete confirmation is unshown; this is a deliberate extension. Active route retains immutable endpoint snapshot; removing Home does not unexpectedly stop it. Delete only correct role/record under repository policy.

### CW15 — Home/destination pin editor [observed S12–S13/S22–S23; accessible extension]

Cancel; Edit [name]; Confirm. Red user pin, coordinate/optional address, Move pin to entrance instruction. Use current location; Search address; N/S/E/W nudges; 1/5/10 m increment; latitude/longitude; Reset. Drag/keyboard/numeric modes edit the same draft. Announce final coordinate, not every pointer movement. Confirm validates/commits atomically→CW23. Cancel/discard keeps original. User entrance override is distinct from provider business identity. Decimal precision does not imply GPS accuracy.

### CW16 — Home detail [observed Confirm; extended]

Home label, endpoint provenance, coordinate, optional refreshed address, small map, edit date. Start route→CW22; Edit; Delete; Back. Route uses committed entrance override. Missing remote details does not remove user coordinate. Unregistered state offers CW11. Provider attribution remains visible where needed.

### CW17 — Route destination picker [observed S29; retained search]

TOP/Route guidance/Toolbox header. Home first; named saved destinations; Recent three and All destinations; Search destination; Save current location; My Routes. Row selection→CW21 then CW22, not immediate journey start. Empty offers registration/search. Offline saved coordinates remain inspectable; online routing status is explicit. Distance/address secondary text is spoken only when useful.

### CW18 — Destination management [observed S16–S17]

Search and register; Register current location; Edit registered destinations; Back. Count/capacity. Search→CW19 in save intent; GPS→CW12→CW20; edit→CW24. At capacity permit edit/delete/export and explain additions blocked. Proposed Research access has 100 destinations plus Home; original exact counting is unknown. Do not silently truncate imported/over-limit records.

### CW19 — Search/results [observed S18–S20]

Name/address field, Search, Clear, Back. Searching status/Cancel. Numbered result list name/address/distance/bearing where available and secondary pins. Select→CW21. No results offers Edit query/current location. Network/quota/config errors keep input and Retry. Generation IDs discard old replies. Long labels wrap; attribution visible. OS dictation is an input method, not a separate app service.

### CW20 — Name destination [observed S27–S28]

Name field prefilled Destination 1/provider suggestion, captured coordinate summary, Save/Cancel. Maximum 160 characters; trim/normalize duplicate comparison while preserving spelling. Duplicate offers rename/review, no silent overwrite. Durable success→Saved [name]/OK→origin with new row focused. Write failure keeps draft. Frozen coordinate cannot drift while user names it.

### CW21 — Place review/register [observed S20–S21; retained CrossWise review]

Selected name/address/distance/endpoint provenance, map/list equivalent. Save intent: Register/Choose again. Navigate intent: Confirm place, Save, Save with a name, New search. Home intent: Register as Home/Choose again. Already saved exposes Edit instead of duplication. Closed/moved provider result warns. Confirm prepares route; saving does not start it. No business centroid presented as verified entrance.

### CW22 — Route review/alternatives [published/retained/proposed]

Destination/origin accuracy, requested/applied preference, route cards, distance/time, instruction list/map and provider warnings. Start journey; Change preference; Choose destination; Save; Back. Start rechecks fresh origin; existing >1 km confirmation stays. Unsupported panel names limitation with Use standard route/Change preference. No route→Retry/edit. Choosing card updates preview only. Unknown stairs/crossings/accessibility are not fabricated.

### CW23 — Acknowledgment [observed S10/S13/S15/S21/S23/S25/S28]

Home registered, Destination registered, Location updated or [name] deleted, followed by OK and correct return/focus. Show only after durable commit. Optional deletion Undo. Do not stack OS alert/live-region/app voice repeating one event. Failure gets a distinct error and retained input, never a success icon with caveat.

### CW24 — Registered destination list [observed S22/S24/S26]

Edit destinations heading, Add, count, named list/map toggle. Select→CW25. Empty No destinations registered/Add. Proposed name/recent sorting is persistent and stable while reader explores. After deletion focus next row/empty heading. Provider refresh cannot reorder focused items unexpectedly. Home shortcut is clearly separate.

### CW25 — Saved destination actions [observed Delete/Back; extended]

[Name], Start route, Confirm location, Rename, Edit location, Delete, Back. Route review before start; rename CW20 edit mode; location CW15; delete CW26. Local IDs distinguish multiple user entrances for one provider. Extra controls are proposed, not claimed as visible originals.

### CW26 — Delete destination/Undo [observed S25–S26; retained recovery]

Recommended name-specific confirm plus Undo. Remove only intended ID; revision checks handle concurrent change. Success updates count/list; failure retains record. Active journey keeps snapshot. Undo checks conflicts/capacity and reports failure honestly; never overwrites another renamed record. Focus returns predictably.

## C. Recognition and facility settings

### CW27 — Obstacles and landmarks [observed S30–S31]

Types to announce→CW28; radio Front and sides/Front only; explanation and supported count. Source describes a frequency trade-off without measured angles/metres. CrossWise retains full-frame inference and filters announcements only. No physical distance claim. Changes do not alter crossing state. How recognition works opens help.

### CW28 — Twenty types [observed S32 plus published vocabulary]

All on/All off, then labeled switches: Person; Bicycle; Car; Truck; Tactile paving; White road line; Guardrail; Crosswalk; Red pedestrian signal; Green pedestrian signal; Curb; Shrubs; Street trees; Vending machine; Bollard/vehicle barrier; Pole/utility pole; Fence; Postbox; Wall; Traffic cone. Each has capability status and Preview voice. Unsupported switches unavailable with explanation, never hidden. All on affects supported ordinary types; All off leaves separately documented critical crossing cues. Proposed defaults: verified supported types on, unsupported off; exact Eye Navi defaults unknown. Generic traffic light cannot enable red/green pedestrian rows.

### CW29 — Nearby radius and genres [observed S33–S35]

Radio None, 30, 50, 100, 150, 200, 250, 300, 400, 500 metres. Genres below, matching scroll structure. None cancels queries/speech. Explain straight-line radius and incomplete listings; separate from camera range. Selected value persists despite network failure. Refresh/list→CW37; genre→CW30. Count/partial selection summary where useful.

### CW30 — Genre/subtypes [observed Dining S36–S37; proposed remaining tree]

Parent Back, genre heading, All on/All off, subtype switches. Dining recovered labels: Fast food; Family restaurants; Ramen; Other dining. Only Dining/Shopping/Transport are visible family names; hospitals/public offices are narrated. Full original nine-genre tree is unshown. Implement this explicitly proposed complete CrossWise replacement:

| Genre | Child choices |
|---|---|
| Dining | Fast food; Family restaurants; Ramen; Other dining |
| Shopping | Convenience; Supermarkets; Shopping centres; Other shops |
| Transport and cars | Stations/stops; Parking; Fuel; Vehicle services |
| Health | Hospitals; Clinics; Pharmacies; Dental |
| Public offices | Government offices; Post offices; Police; Libraries |
| Finance | Banks; ATMs |
| Recreation and culture | Parks; Museums; Sports; Visitor attractions |
| Accommodation | Hotels; Other lodging |
| Everyday services | Toilets; Laundries; Personal services; Other useful places |

Validate actual provider types against current Table A. Unavailable mappings have explanatory state rather than breaking all searches. Other dining is deterministic app classification, not a literal provider type. One place matching multiple types is read once. Last four genre names and all non-dining children are proposed, not recovered.

## D. Walking, route, crossing and direction

### CW31 — Stroll [live S38–S40; proposed full controls]

Existing camera preview, Stroll header/TOP/Settings; large camera/aim/brightness status. Bottom Voice, Nearby, Tools, End stroll; context crossing controls. Compact recording/sharing indicators. Recent recognition text log; optional overlays. Camera denied→Enable/retry or Continue without camera. Location denial still permits supported camera detection. Route entry converts same session without second stream. End names active recording/sharing stop choices. No fake twenty-class live output.

### CW32 — Route walking [published/retained]

Destination, next instruction/distance, route state, remaining distance/time; camera/map switch. Repeat; Pause/resume; Tools; crossing controls. Camera off may coexist with route working. Stale location pauses reliable progression. Changing destination pauses replacement planning; Cancel restores prior route. Route and signal speech use one arbiter. Arrival→CW39.

### CW33 — Crossing panel [CrossWise retained]

Keep current observing/approach, verified/unverified signal, crossing and far-footpath states. I'm crossing/I'm on the footpath remain explicit. Existing vehicle/aim cues retained. Never say Safe to cross from color observation. Menus do not finish crossing. Route speech yields; completion returns without automatically skipping route step. Preserve User/route restrictions on experimental automatic crossing.

### CW34 — Map/overview [published/retained]

Map markers/polyline, Locate me, North up/rotation, overview and text-list toggle. Equivalent steps/turns/distances, endpoint provenance and warnings. Location accuracy visible. Network map failure leaves available textual route. Map exploration never alters destination. Back retains walk state. Unknown intersection/accessible entrance data remains unknown.

### CW35 — Direction check [published/proposed]

Face route direction heading, target bearing, reliable current heading and uncertainty. Check direction; Repeat; Calibrate/help; Back. Face right/left/Correct direction plus optional tone. Proposed test thresholds: correct within 15°, corrective outside 25°, stable one second; not Eye Navi measurements. Unreliable sensor→Direction unavailable plus route list/map. Current diagnostic heading must pass reliability work before steering prompts.

### CW36 — Toolbox [unopened original; proposed]

Repeat instruction; Route overview; Direction check; Nearby; Change destination; Pause/resume; Recording; Share/check in; Photo question; End walk; Back. Context unavailable actions explain why. Recording/sharing rows show states. Picker can open a limited nonwalking toolbox. This contents list is a CrossWise design, not recovered source UI.

### CW37 — Nearby list [published/proposed]

Radius/category summary; Refresh; Settings; rows name/category/distance/direction. Select→CW38. Read nearest/Stop/Back. Separate location-loading/searching/empty/offline/stale/quota states. Auto read obeys scheduler/once-per-session. Focused list stays stable; notify updates instead of moving focused rows. Clock direction requires trustworthy heading.

### CW38 — Nearby detail [proposed]

Name/type/distance/bearing, freshness/attribution, optional address. Read again; Route here; Save; Show map; Back. Route opens review; Save uses standard registration, never silently changes current route. Recompute direction if position changed. No accessibility entrance/opening-hours claim without actual fields/data.

### CW39 — Arrival/end/summary [published/retained/extended]

Near destination remains status; actual Arrived follows existing logic/manual confirmation. Destination and final instruction; End journey, Continue Stroll, Route Home. Summary duration/distance if reliable; recordings; sharing state; optional feedback. End explicitly states recording/sharing outcome. Proximity to business centroid is not verified entrance arrival.

### CW40 — Walking recovery [retained/extended]

One cause, still-available services, Retry/reacquire, overview, Change destination, End. Stale GPS shows age/accuracy. Off-route recalculation is reviewed, not surprise destination replacement. Camera failure retains route text; offline retains supported detector. Unlock rechecks freshness. Full reload never fabricates an unfinished crossing state. Avoid diagnostic overload.

## E. Tools, custom routes and recorder

### CW41 — More tools [proposed]

My Routes; Recordings; Monitoring; Photo questions; Headphones; Special areas; Account/backup; Help. Show real capability/Research access. Every row opens useful page even when dependency unavailable; explain setup/alternative, not a dead button. TOP→Home.

### CW42 — My Routes list [published/proposed]

Names/endpoints/waypoint count; Create; optional validated Import. Select→CW44. Rename/Duplicate/Delete/Export. Empty explanation. Local routes need no account; sync explicit. Deleting route does not delete shared saved places. Active journey keeps snapshot.

### CW43 — My Route editor [published/proposed]

Name, ordered waypoint list: Add saved place/Search/Current location/Map point. Per waypoint Edit label/coordinate, Move up/down, Spoken note, Delete. Map optional; drag not required. Authored unmapped segments explicit with coverage warning. Undo; Preview; Save draft; Cancel/discard. Validate distinct useful endpoints and bounded size. Accessible order always visible.

### CW44 — My Route preview [published/proposed]

Ordered points/notes/turns, map, authored-vs-provider segments, estimated length and unknown coverage/accessibility. Start; Edit; Duplicate; Reverse into draft; Export; Delete; Back. Reversal reviews entrance/one-way access/notes, not blind text reversal. Start validates origin; authored-path off-route behavior explicit without assuming routable graph.

### CW45 — Recorder settings [published/proposed]

Enable; Auto-start with walk default off until chosen; Include microphone audio; five-minute clips; default 50 rolling clips; byte cap/storage; actual format; Manage. Explain oldest unprotected deletion and foreground limits. Microphone denial leaves silent video. Route pause distinct from recorder pause. No MOV guarantee in browser.

### CW46 — Recording control [published/proposed]

Start, Pause/resume, Stop/finalize, Protect current clip. Elapsed time/audio/saved clips/bytes/MIME/storage estimate. Finalization progress before acknowledgment. Interruption marks partial recovery state; no safely-saved claim before commit. Settings does not acquire another stream. Quota error stops recording cleanly and preserves finalized clips.

### CW47 — Recording library [published/proposed]

Newest grouped by walk/date; time/duration/size/audio/protected/interrupted per row. Filter protected; storage; Export/Delete selected; Delete all confirmation. Empty explains recording. Actual share/download mechanism. No automatic upload. Eviction/storage explanation concise and actionable. Avoid loading all blobs at once.

### CW48 — Playback/export [proposed]

Accessible player, timestamp/duration/MIME/audio, Play/pause/seek, Protect, Export/share, Delete, Back. Transcript/location trail only if actually recorded and configured. Interrupted recovery reports playable/not recoverable. Export failure keeps clip. Revoke object URLs on exit. Protected deletion requires explicit action.

## F. Monitoring and check-ins

### CW49 — Monitoring hub [published/proposed]

Share my walk and Watch someone are separate roles. Active cards show expiry/viewer count/status. Foreground-only web explanation. Share→CW50, watch→CW52. Account required for actual cloud relationships, not local walking. No fake contacts/positions in ordinary app.

### CW50 — Share setup/invites [published/proposed]

Accepted viewer/contact or expiring invite, duration, check-in points, Start sharing. Explain coordinate/accuracy/time/session data shared. Copy/share invitation requires user action; no automatic messaging. Viewer accepts, link copying alone does not grant relationship. Revoke pending invite. Good fix/auth required; failure leaves local walk intact. Proposed two-hour expiry configurable before start.

### CW51 — Active sharing [published/proposed]

Accepted viewers, expiry, last upload, accuracy, foreground/background capability. Stop, Revoke viewer, Extend, Check-ins, Manual check-in, Back. Stop local uploads immediately; server revocation success/failure distinguished. Offline/lock becomes stale. Expiry ends access/upload. Already-open observers lose access on revoke.

### CW52 — Observer sessions [published/proposed]

Invitations with Accept/Decline; active/ended sessions→CW53. Viewer role without software paywall in proposed research access. No stranger name-based enumeration. Expired/revoked displays unavailable and no new positions. Observer cannot edit route/settings.

### CW53 — Observer view [published/proposed]

Map and accessible list: session/person label, observed/received timestamps, accuracy, actual supplied movement/session state. Check-in events; optional notifications. Refresh; Stop watching; Back. Stopped updates never remain Live. No emergency inference or remote crossing advice. Historical trail requires separate explicit retention policy.

### CW54 — Check-in editor/events [published/proposed]

Named points/radius/enabled; Add saved/GPS/search. Editor label/coordinate/radius/dwell/notification switch, Save/Cancel. Proposed 40 m/20 s defaults accuracy-tested. Fresh sustained fixes, dedup and exit re-arm. Manual event labeled Manual. Event time/place/delivery visible; reconnect retry does not repeat notification.

## G. AI, account, access and peripherals

### CW55 — Photo question capture [published/proposed]

Still-photo purpose, Capture, supported Upload, Recent conversations, remaining allowance, Back. Shared camera, review before upload. Camera denied offers file input/help. Opening/capturing alone never transmits photo. Separate from live detector/crossing.

### CW56 — Photo review/question [published/proposed]

Photo, Retake, question field, Dictate, Ask, Cancel. Examples Describe scene/Where is entrance?/Where is remote? Explicit transmission notice. Empty default question visible before submit. Size/type validation first. Cancel removes draft. Rotation only if implemented correctly. AI entrance answer does not become route certainty.

### CW57 — Answer/history [published/proposed]

Question/thumbnail, processing, answer text, Read/Stop, Follow-up, New photo, Delete conversation, Back. Retry same idempotency ID. Quota shows reset/date and keeps draft. Empty/error/timeout meaningful, no fake answer. Follow-up attaches intended image context. Local history opt-in; retention visible. Answer speech yields to critical crossing cues.

### CW58 — Account/sign-in [published cloud settings; proposed]

Continue locally, Sign in/Create, identity, Sign out/recovery using selected auth method. Field errors readable. Session expiry blocks cloud action only. Sign-out explains active sharing and offers explicit stop; no silent orphan sharing. No keys/technical configuration in ordinary account UI.

### CW59 — Backup/restore/conflicts [published/proposed]

Last backup/device/status; Back up now; Preview restore; opt-in automatic settings backup; Export local; Delete cloud. Preview changed settings/routes/places, local/cloud choices, Cancel. Incompatible version prevents destructive restore. No implicit video/location-history sync. Cloud deletion separate from local wipe. Provider-retention constraints apply.

### CW60 — Access/quota [published/proposed]

Research access, actual enabled software/capacities/service status, real remaining AI allowance. Future billing/trial/purchase restoration only through actual configured adapter. No working-looking Buy button before billing exists. Over-limit records retained readable/exportable on downgrade. Eye Navi's price/trial is research context, not CrossWise contract.

### CW61 — Insurance availability [published/proposed]

Explain no active CrossWise insurance unless real agreement exists. Product help/Back. Future provider can expose genuine policy/terms/contact. No borrowed insurer logo/active policy/limits. Reachable information screen is required; commercial coverage remains external work.

### CW62 — Headphone setup [published/proposed]

Connection instructions, output status where available, stereo/mono test, left/right/center/Stop, volume and surrounding-sound guidance, hardware compatibility. Sony actions/sensors only when verified adapter reports support. Unsupported devices retain ordinary audio. No claim that every headphone fit preserves environmental hearing.

### CW63 — Hardware actions [published/proposed conditional]

Verified supported actions/current mapping, Test, Reset, Back. Published Eye Navi Quick Access intents include launching the app and reading nearby information; CrossWise should expose those intents when its platform adapter supports them. Browser without integration says cannot configure Quick Access and links setup/help. Show firmware/Sound Connect prerequisite when applicable, plus device-specific directional-sensor support. Generic Bluetooth or stereo panning does not establish manufacturer parity. Hardware triggers normal action handlers; no context-free crossing/sharing start.

### CW64 — Special-area content [published/proposed]

Pack name/region/version, Install/update/remove, accessible destination/route/landmark lists. Source/update/coverage/offline status. Pilot campus/park pack can serve Expo navigation purpose. No invented official Expo content. Routes/notes reuse authored-route mechanisms. Missing pack remains honest unavailable state.

## H. Help, data and developer tools

### CW65 — Help/practice hub [retained/published training philosophy]

Getting started; Holding; Screen reader; Destinations/routes; Objects/nearby; Voice commands; Cue practice; Troubleshooting; Privacy/storage; About/feedback. Text first with optional speech. No video-only essential instructions. Cached offline. Explain actual detector/capability limits.

### CW66 — Holding/camera guide [retained/published]

Rear camera forward/unobstructed, stable orientation, optional chest/pouch, lighting, angle test/calibration. Readable without permission; real status if granted. Raise/lower samples labeled practice. Body heading distinct from camera tilt. No required purchase of a particular pouch.

### CW67 — Practice library [retained/extended]

Existing signal/vehicle/sonar, twenty name samples, route turns/arrival, facility direction, speed/headphone tests. Select/Play/Repeat/Stop/Next/Back. Clearly Practice; no synthetic event reaches live detector, route progression, crossing or sharing. Use real feedback engine. Add comprehension explanation and repeatable training steps.

### CW68 — Troubleshooting [proposed]

Camera/location/microphone/audio/network/storage/headset sections with actual status, OS instructions, Retry/test. Explain foreground limits. Offline routes/POIs do not mean offline detector unavailable. Optional diagnostics preview; no raw keys or stack traces in user flow.

### CW69 — About/feedback [retained/published philosophy]

Build/model/research identity, acknowledgments/providers, terms/privacy/change log, feedback. Form task/page/expected/actual, optional contact/diagnostics; preview before user submits. No automatic email/messages. Collect useful positive cases as well as errors. Description reflects current model rather than borrowing full Eye Navi recognition claims.

### CW70 — Advanced/developer [retained]

Mode, detector/backend/threshold, existing boxes/preview/overlays, signal diagnostics, vehicle/sonar/experimental flags, CSV/export, speech debug/capabilities. Separate from ordinary settings detail. Unsupported import explains web limit; no detector replacement. Leaving respects User-mode policy and clears inappropriate debug clutter.

### CW71 — Data management [proposed]

Settings/places/routes/recording/diagnostic sizes; Export/import validated CrossWise data; Delete category; Reset settings; Delete all local. Name destructive scope; stop relevant active writers before reset. Import previews schema/conflicts, never executable content. Provider content excluded from unrestricted export. Cloud deletion separate CW59.

### CW72 — Shared dialogs/unavailable [proposed]

Acknowledgment/OK; named destructive confirm; discard draft; denied permission; unconfigured service; expired auth; quota/reset; offline/retry; capacity; unsupported model/device; storage/recovery. Every variant has useful exit/focus behavior. Local stop and server revocation are distinguishable when offline. Back/Escape tested, not assumed from appearance.

## Required state and implementation record

For applicable pages: initial/loading/ready/empty/stale/partial/error; permission unasked/granted/denied/revoked; service absent/auth expired; draft/invalid/committing/failed/success/canceled; offline/reconnect/background/foreground; quota/eviction/deleted deep-link; keyboard/VoiceOver/TalkBack/large text/mono/no microphone.

Each implementation record must include page/control IDs, input/output data, persistence writes, spoken event IDs, evidence tag, screenshot and acceptance task. A page is not functionally complete merely because it resembles a frame.

Review batches: CW01–10/27–30/72 shell/settings; CW11–26 places/routes; CW31–40/65–70 walking/help; CW41–48/71 local tools; CW49–61 cloud/AI/access; CW62–64 peripherals/content. Native and contracted-service completion stays separately reported.
