# Experimental pedestrian detection and countdowns

Implemented 13 October 2026 on top of the focused demo. The original COCO-SSD vehicle detector and weights remain unchanged. A separate worker adds local pedestrian signal boxes, countdown boxes, and possible crossing-button/press-surface boxes. One pedestrian frame is in flight at a time, sampled no faster than every 700 ms, with a maximum 960-pixel image edge. Results carry capture timestamps; live boxes expire after 1.2 seconds. Closing or backgrounding the camera terminates its worker and clears the results.

## Crossing behaviour

This build does **not authorise starting a road crossing**. `Start crossing` is disabled, and controller commands are guarded as well. Public models and shape estimates have not been validated at Australian intersections, and neither a green prediction nor an arbitrary ten-second threshold establishes that a particular crossing can be completed safely.

* Red has precedence over other predictions.
* Countdown values **0–10 inclusive** trigger the low-time guard.
* Values **above 10**, including the supplied 21-second example, remain blocked: Australian countdowns can display clearance time, during which a pedestrian must not begin crossing.
* Unreadable, stale, failed, missing, contradictory, or multiple signals remain blocked.
* A static green observation describes the visible symbol and says that safety and remaining time are unverified.
* `Already in the road — get assistance` reports an existing crossing, preserves assistance and route-speech suspension, and requires explicit confirmation of the far footpath. Red, signal loss, and low countdown values do not instruct a person to stop in the road.

The policy is deliberately not user-adjustable. A validated model and a reviewed crossing policy would be needed before enabling start guidance. A crossing distance, a user's walking pace, turning vehicles, and which signal applies to the desired crossing cannot be determined from a number alone.

Australian rules reference: [NSW Government pedestrian signals](https://www.nsw.gov.au/driving-boating-and-transport/driving-nsw/roads-safety-and-rules/stopping-giving-way-turning/traffic-lights). Green permits starting under the traffic rules; flashing red does not. This does not mean that this app can establish the applicable signal or a safe path.

## Reused model and provenance

* Source: [mixxung/crosswalk-traffic-light-detection-yolov5](https://github.com/mixxung/crosswalk-traffic-light-detection-yolov5), commit `013c8390878332322185d8bac68a501e62d818d1`.
* Weights: `runs/train/exp4/weights/best.pt`, YOLOv5s6, classes `Zebra_Cross`, `R_Signal`, `G_Signal`. The source records 50 training epochs; no new training was conducted for CrossWise.
* The existing pretrained weights were exported to ONNX, fixed RGB NCHW 1×3×640×640, values 0–1, grey letterbox padding 114, output rows `[cx,cy,w,h,objectness,crosswalk,red,green]`. The adapter reverses letterboxing and performs suppression. Crosswalk predictions are not used as permission to cross.
* ONNX SHA-256: `96437c2080a0ba5364f438b41c8551e310e9761cf998c74856d42b748d357b42` (initial export).
* The source repository and derived weights use **GPL-3.0**. Its licence is included at `/pedestrian/YOLOv5-LICENSE.txt`; the pinned original model and conversion instructions are linked in the public model notice. This does not imply that the dataset's geographical coverage or all upstream image rights have been independently established.
* Browser inference: `onnxruntime-web` 1.24.3, WASM in a separate worker, one thread; inference does not require a server or a cloud account.
* The exported 49.8 MB model is distributed as a 41.9 MB gzip asset. The worker checks gzip magic bytes before decompressing, supporting hosts that already decode the response. Letterboxing and digit-image encoding use pixel arrays rather than `OffscreenCanvas`, which was unavailable inside the tested WebKit worker. The runtime, OCR assets, language data and existing demo assets make the initial offline cache approximately 85 MB; subsequent inference is local. Runtime and OCR licence texts accompany the model notice.
* General digit OCR: `tesseract.js` 7.0.0, local English data and worker/core assets. A separate seven-segment geometry reader handles digital LED digits. A failed or ambiguous read never becomes zero, a guessed duration, or permission to walk.

The [Autoware Foundation pedestrian classifier](https://huggingface.co/AutowareFoundation/traffic_light_classifier) was also evaluated, revision `527c4905afd8f1bfcc03253529a105f7fa5a6d36`. It classifies ROIs rather than locating full-frame signals and was trained on Japanese lights. In a manually cropped ROI from the supplied image, it assigned the amber **21** countdown a green score of about **0.979**. It was rejected and is not bundled. Manual ROI experiments are documented in the research evaluation folder and were not reported as full-frame detections.

## Shape estimates and buttons

The GitHub model detects the supplied street green signal but misses the large product illustration. A clearly labelled colour/shape fallback locates lit pedestrian-like figures against dark surroundings in that illustration. A green colour alone is insufficient; the adapter independently checks red/green/amber pixel evidence for model detections. These checks reduce some errors and do not establish road reliability.

No reusable, verified Australian pushbutton weights were found during the search. The button prototype looks for the supplied **blue plate plus silver round press-surface** arrangement. It draws both boxes and says **Possible crossing button** and **Possible press surface**. This is not a trained universal pushbutton detector. It does not cover all button designs, tactile-arrow directions, touchless units, occluded buttons, or activation confirmation. The small green confirmation ring is never interpreted as a green pedestrian signal. Camera-relative left/centre/right is descriptive; no distance or instruction to reach into the roadway is generated.

## Try the same detector on a picture

Open **Help → Check a reference image**, choose an image and wait for the result. The checker uses the same worker, preprocessing and model as the live camera. It shows boxes and a list of observations, with their source. Images remain local and are not uploaded. A still image is never used to update the live crossing state. Browser tests use the supplied images from `tests/fixtures/pedestrian`; these are evaluation fixtures, not a training set or an independent test of generalisation.

## Validation

Meaningful checks include countdown boundaries, red priority, stale/future/missing observations, conflicting signals, non-pedestrian round-lamp rejection, multiple seven-segment digits, protected start commands, continued assistance for existing crossings, real browser inference and OCR against the supplied images, preview box geometry, offline operation, and regressions for routes and camera recovery.

| Check | Result |
| --- | --- |
| TypeScript and ESLint | Passed |
| Unit and controller regressions | 225 passed across 28 files |
| Production server tests | 8 passed |
| Full demo browser suite | 79 passed, 5 intentional synthetic-camera WebKit skips |
| Final reference/layout/offline/recovery checks after visual adjustments | 20 passed, 1 synthetic-camera WebKit skip; included in the same 21 scenarios as the full suite |
| Packaged production server on local IPv4 loopback | Actual inference on street, countdown and button references, plus offline countdowns, passed in Chromium and WebKit; exact service-worker build matched and no uncaught browser errors |

The supplied street photo produces a pretrained green-signal box (about 0.72 confidence in the standalone evaluation). The three-assembly illustration produces separate green and red **shape-estimate** boxes and reads **21** with the seven-segment reader. This is not a claim that the pretrained network detected that illustration: it missed it. The earlier close-up green image uses the shape fallback. The blue-plate button reference produces the two **possible** object boxes. Browser checks assert these observations, that the street photo has no red/countdown false positives, and that boxes contain expected image locations and labels stay within the preview. Annotated screenshots and machine-readable observations are in `artifacts/pedestrian`.

The optional Autoware classifier was evaluated and rejected, not silently substituted when YOLO misses a signal. No new Australian dataset was crawled or trained. The supplied reference images are included only as evaluation fixtures.

Fly publication was attempted but the installed CLI reported **no access token available**. The previous dev deployment remains in place until authentication is restored and the new build is explicitly deployed and checked. The release script `scripts/smoke-pedestrian-deployment.mjs` verifies the exact deployed service worker, actual inference on all three reference categories, and cached countdown inference in Chromium and WebKit.

Results and annotated images are written under `artifacts/pedestrian`. Desktop browser/device emulation is not physical iPhone/Android validation. Small distant signals, glare, LED flicker, motion blur, regional designs, perspective, thermal behaviour, battery drain and field false positives remain unresolved. Bounding boxes for a possible object do not verify its identity or which crossing it controls.
