# CrossWise demo version

Date: 13 October 2026. Full-version checkpoint: `5b92373`. Demo branch: `codex/demo-version`.

## Scope

Keep destination search/review, local Home/saved destinations, walking instructions/map, Stroll, unchanged detector, manual crossing, nearby search/optional narration, arrival choices, voice/buttons, accessible feedback/text, permission recovery and offline application/model caching.

Remove account/cloud backup/sharing/check-ins/photo questions/history/quota/research access/insurance, special areas, unsupported body-direction checks and manufacturer headset previews. Remove sixteen unsupported category rows and three unsupported route preferences. Replace seven speech levels with Slow/Normal/Fast. Simplify nearby settings to four groups and None/50/100/200 metres; a previously saved radius stays visible until changed. Legacy unsupported route preferences load as distance without deleting user data.

Remove automatic Stroll startup and recording auto-start. Hide coordinate entry behind Advanced location editing. Home has Route guidance, Stroll, Settings and Help. Walking controls are directly visible; tools contain only in-walk actions. Preserve crossing completion, route replacement cancellation, freshness checks and camera/background lifecycle.

## Presenter build

The default build excludes route authoring, recordings, maintenance and Advanced/old guide/practice screens. No query string, history state or saved preference enables them. Cloud endpoints are removed in all builds. Upgrading does not erase saved browser data.

Build optional tools in PowerShell:

```powershell
$env:VITE_PRESENTER_TOOLS='true'
npx vite build --outDir dist-presenter
Remove-Item Env:VITE_PRESENTER_TOOLS
node scripts/build-sw.mjs ../dist-presenter/
$env:PRESENTER_TESTS='true'
npx playwright test
Remove-Item Env:PRESENTER_TESTS
```

This output is separate from `dist/` and is not deployed by the normal Dockerfile. Presenter Home/Settings offer Presenter setup with My Routes, Recordings, Data management and Advanced. Recording is manual. Authored segments do not establish a verified walkable path; origin/freshness guards remain.

## Rehearsal

1. Open Home; explain Route guidance and Stroll.
2. Search/select a saved destination, confirm identity and review the route.
3. Start walking, repeat an instruction, pause and resume.
4. Start camera assistance and show supported detection/status.
5. Demonstrate crossing controls and explicit far-footpath completion.
6. Open Nearby or route overview; return to the same walk.
7. Confirm arrival and end the walk; demonstrate Stroll briefly if useful.

Use controlled conditions for rehearsal. Synthetic camera fixtures do not establish validated outdoor performance. No screen claims a safe crossing, verified pedestrian signal or reliable body alignment.

## Verification

`npm run check` validates the public demo, including legacy preferences, preserved places, arrival, nearby, accessible layout, menu/Back behaviour, live synthetic inference, unfinished crossing guards, background release, model retry and offline inference. Presenter regressions run separately. HTTP checks verify removed product endpoints return 404 while map routes work.

Deployment smoke uses a fixed public Sydney coordinate and synthetic camera frames. It verifies exact build identity, real map search/routes, settings persistence, local inference, End walk, offline help and absence of cloud endpoints/presenter entries. Physical iPhone/Android, screen readers and outdoor GPS remain manual validation tasks.


## Results on 13 October 2026

Public demo: npm run check passed types/lint, 199 unit cases, 8 HTTP cases and 59 browser cases, with 4 intentional synthetic-camera skips on the Windows WebKit runner. Real detection/model download, crossing preservation, background release, retry and offline inference passed on both Chromium profiles. Screenshots were inspected for Home and deployed walking controls.

Presenter: across the complete run and targeted recovery rerun, 77 distinct cases passed, 8 media cases were intentionally skipped and 2 forced CPU-only inference cases failed. CPU mode did not obtain a usable detection frame within the test window, including a serial rerun. This remains a presenter diagnostic limitation, not a verified demo capability. The default public build has no CPU/backend selector. The model was not replaced or retuned.

The deployed URL passed the smoke workflow and Fly health check. Worker revision: a86e9be26bcb. See DEV_DEPLOYMENT.md. These automated checks do not establish physical-device or outdoor walking performance.
