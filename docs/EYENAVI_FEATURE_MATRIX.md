# Eye Navi / CrossWise feature disposition

13 October 2026. This is the pre-implementation comparison/checklist accompanying the revised plan. Current implementation and validation are tracked in [implementation status](EYENAVI_IMPLEMENTATION_STATUS.md). “Add” below means the planned disposition; “Partial” describes the inspected baseline. The separate goggles product is excluded. Hidden/unshown original screens are not treated as recovered UI.

| Capability | CrossWise baseline | Planned disposition / page IDs | Completion boundary |
|---|---|---|---|
| Large Route/Stroll launch | Camera-first entry | Replace entry, CW01 | Responsive functional controls, not background image |
| Settings parent/child navigation | Mostly single settings page | Replace organization, CW02–10 | Back/focus/selected state |
| Terms/privacy on first use | Guide precautions; no equivalent verified onboarding | Add CW03 | Own policy/version, no copied legal promise |
| VoiceOver/TalkBack operation | Accessible controls in places; full device audit absent | Audit all pages | Real mobile-reader sessions |
| Stroll without route | Camera/crossing without route | Repackage CW31 | Same detector/stream |
| Auto-Stroll at launch | No dedicated matching setting | Add CW10 | No automatic recording/sharing/crossing resume |
| Dedicated Home | Alias-based selected provider save | Add true role, CW11–16 | Single durable Home |
| Home from GPS | No coordinate-registration flow | Add CW12 | Fresh/accurate captured point |
| Home by address | General search exists | Specialize CW13/19/21 | Review before register |
| Confirm Home | General saved-place review | Add CW16 | Actual stored endpoint |
| Edit Home entrance | No editable pin | Add CW15 | Keyboard/nudge alternative |
| Delete Home | Saved removal/Undo exists | Specialize CW14 | Correct record/recovery |
| Search/register destination | Search/save already works | Reuse CW18–21 | Save separate from navigate |
| Dictated address/name | OS/voice input exists partially | Keep CW08/13/19/20 | Text fallback, no hidden microphone |
| Numbered result list/distance | Provider results exist | Refine CW19 | Identity and location bias reliable |
| Register/Choose again | Existing confirm/new search | Adapt CW21 | No accidental route start |
| Register named current point | Missing | Add CW12/20 | Coordinate frozen while naming |
| Destination acknowledgment | Some existing save speech | Add common CW23 | Durable commit before success |
| List registered destinations | Recent/all favorites | Extend CW24 | Count/empty/stable order |
| Rename destinations | Aliases supported at save | Add explicit edit CW20/25 | Duplicate/conflict handling |
| Edit destination coordinate | Missing | Add CW15/25 | User entrance separate from Google identity |
| Delete destination/empty list | Remove/Undo exists | Refine CW26/24 | No active-route snapshot corruption |
| Destination capacity | No equivalent tier policy confirmed | Configurable CW18/60 | 100 research plus Home is proposed |
| Home-first route destination picker | Saved drawer | Replace primary flow CW17 | No route start on row tap |
| Route summary before walk | Present | Preserve CW22/34 | Distances/warnings/steps, no fabricated attributes |
| Shortest-distance preference | Fixed default walking route | Add candidate ranking CW06/22 | Shortest returned alternative, not universal optimum |
| Shortest-time preference | Fixed default walking route | Add candidate ranking CW06/22 | Estimated walking duration |
| Fewer stairs | Missing provider support | Screen + explicit fallback now; graph service later | Cannot claim applied before data validation |
| Covered paths | Missing | Same staged path | Requires covered attributes |
| Near main roads | Missing | Same staged path | Pedestrian-safe adjacency data |
| Current-position origin/accuracy | Present checks | Preserve CW12/22/40 | Freshness and origin displacement guards |
| Turn guidance/repeat/pause/resume/end | Present | Reuse CW32/36/39 | One speech arbiter |
| Direction/body alignment | Heading diagnostic, not reliable steering | Add CW35 after sensor reliability gate | Unavailable fallback when unreliable |
| Near destination/arrival | Present progress/arrival logic | Refine CW39 | Near area versus entrance distinction |
| Route overview/intersections | Steps/map present; no complete intersection semantics | CW34 | Show only provider-known metadata |
| Toolbox | Some actions dispersed | Proposed CW36 | Original contents unknown |
| Camera recognition | Present local detector | Preserve CW31 | No weights/backend replacement |
| Twenty recognition classes | Not complete in current baseline | All rows CW28; supported live mappings only | Unsupported visible, not falsely detected |
| Front/sides setting | No equivalent ordinary-label zone control | Add CW27 | Announcement filtering, no inference change |
| Category switches/bulk actions | Developer-specific toggles only | Add CW28 | Critical Crossing channel separately explained |
| Pedestrian red/green voices | Existing phase framework; model capability conditional | Preserve semantics CW33 | Generic traffic lights insufficient |
| Offline object detection | Cached local model | Preserve | Offline routes/POIs not implied |
| Nearby radius None–500 m | No automatic nearby reader | Add CW29/37 | No query when None |
| Nearby nine genres/dining filters | Missing | Add CW30 | Unknown original taxonomy replaced explicitly |
| Automatic nearby names/distance/clock | Missing | Add CW37/38 | Query bounds/dedup/heading reliability |
| Seven speech levels | Existing .6–2 slider | Adapt CW05 | Proposed calibrated mapping; no claimed units |
| App speech distinct from OS reader | Separate systems, overlap possible | Refine CW05/07 | Reader-friendly mode; no fake OS-speech detection |
| Short object labels/priority signals | Existing feedback engine, incomplete taxonomy | Adapter + scheduler | No queued stale names |
| Rolling walking video | Missing | Add CW45–48 | Real saved/playable/exportable clips |
| Five-minute/50-clip local retention | Missing | Add adjustable recorder policy | Quota can reduce capacity |
| Recorder audio | Missing | Add opt-in CW45 | Mic denial keeps silent video |
| Exact MOV/Files folder | Browser cannot guarantee | Native adapter branch | Not PWA screen-only completion |
| My Routes/unmapped paths | Missing | Add CW42–44 | Ordered authored geometry/notes, review reversal |
| Monitoring live share | Missing backend/accounts | Add CW49–53 | Real accepted/revocable relationship |
| Observer role | Missing | Add CW52/53 | Actual second account authorization |
| Automatic/manual check-ins | Missing | Add CW54 | Accuracy/dwell/dedup/delivery status |
| Background locked-screen sharing | Browser lifecycle limit | Native branch | Real OS/device tests |
| Still-photo AI description/questions | Anticipated configuration; no verified deployed flow | Add CW55–57 | Server key, real provider, explicit upload |
| Monthly AI allowance | Missing | Optional server quota CW57/60 | Atomic counter/idempotency/reset |
| Sign-in settings cloud storage | Missing | Add CW58/59 | Conflict preview/restore/auth/RLS |
| Premium/trial access | Missing | Research entitlement CW60 | No fake purchase/renewal |
| Walking insurance/support contract | Missing | Honest availability CW61 | Actual contract before active policy |
| Headset directional output | Stereo cues partly present | CW62, reuse audio engine | Stereo versus head-tracked capabilities distinct |
| Quick Access launch/read nearby | Missing manufacturer adapter | CW63 + native integration | Verified supported headset/firmware/actions |
| Special park/area navigation | No content packs | CW64 authored pilot pack | No unlicensed official Expo content claim |
| Setup/holding/training | Existing guide/practice | Extend CW65–67 | Independent usable text; no required new hardware |
| Feedback/user philosophy | Help/diagnostics present | CW69 task-based feedback | No automatic outbound messages |
| Offline help/error recovery | Partial | CW40/65/68/72 | Useful alternatives, not indefinite spinner |
| Battery/data/storage information | Diagnostic/technical details partial | Measure and report CW68/69 | Never reuse Eye Navi benchmarks as CrossWise results |

## CrossWise additions worth retaining

Manual crossing and far-footpath confirmation; vehicle/aim sonar; haptic preferences; long-route confirmation; voice command and typed fallback; Undo; user/developer separation; CSV diagnostics; robust fresh-location checks; accessible pin nudges; explicit unsupported capability states. These are integrated into the new shell rather than deleted for visual similarity.

## Research-only material and exclusions

The historical posters, dataset statistics, developer biographies, anecdotes and reported tests inform rationale and evaluation, not additional buttons. Preserve them in the illustrated research report. The experimental BLE/infrastructure signal concept is not established shipping app behavior. Goggles are outside scope. Unknown Toolbox contents, hidden names and unseen original premium layouts remain unknown even though proposed CrossWise replacements are fully specified.

## Sign-off rule

For each row, mark Screen done / PWA behavior done / Device-service parity done separately, link a page screenshot and test evidence, and record the actual remaining dependency. A screenshot or a menu switch alone is never evidence that a server, model category or native integration works.
