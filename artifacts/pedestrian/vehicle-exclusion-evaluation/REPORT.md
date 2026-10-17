# Vehicle-light exclusion: implementation and repeated evaluation

The changes are confined to the isolated pedestrian-experiment branch. The YOLOv5s6 and COCO-SSD weights remain unchanged. There was no training, image crawling, threshold increase, manual crop or image-specific filename/coordinate rule. YOLO's original false positives still exist in its raw output; the new application verification stage rejects them before they become pedestrian observations.

## Approaches considered

1. **Confidence threshold alone:** insufficient on the observed examples. The original Narellan false green scored higher than the real pedestrian signal in the upgrade photo. Increasing the threshold would sacrifice that real signal while retaining this false one.
2. **Illuminated-symbol verification:** implemented. A tall signal housing is not evidence of a pedestrian; a three-lamp vehicle housing is also tall. The verifier examines the coloured luminous pixels inside the candidate, trims to their actual extent and checks the figure's proportions, head/torso profile and separated legs. Round/wide lamps, filled ellipses, and arrows without two legs are rejected. Both pretrained detections and fallback figures use this gate. Evidence and rejection reasons are retained in worker diagnostics.
3. **Dark-display validation for countdowns:** implemented before seven-segment reading or general OCR. A candidate needs a dark surrounding and predominantly dark non-digit pixels inside the display; amber occupancy must be plausible. This rejects the yellow foliage mistaken for a six. It does not create an estimated duration if a display cannot be verified.
4. **Retraining with vehicle-light negatives or a distinct vehicle-light class:** a possible longer-term improvement, left out of this implementation. Ultralytics recommends background examples to reduce false positives in its [YOLOv5 training guidance](https://docs.ultralytics.com/yolov5/tutorials/tips-for-best-training-results). This would require data and training/evaluation work. A generic COCO traffic-light prediction is not a reliable veto by itself because the category does not establish whether a housing serves pedestrians. Temporal repetition alone also cannot reject a consistently misidentified round lamp.

The browser uses a small local pixel-mask implementation, without another model or an OpenCV WASM download. Classical mask/component/shape analysis is described in [OpenCV's shape-analysis documentation](https://docs.opencv.org/doc/doxygen/html/d3/dc0/group__imgproc__shape.html); no OpenCV implementation was bundled or copied for this gate.

## Implemented details and limits

* The active figure must be at least 3 pixels wide and 8 high, and its height/width must be between 1.35 and 4. Its top fifth must have a narrower, centred profile than its middle torso. Several lower rows must contain lit evidence on both sides of a substantial dark gap. Tiny gaps between adjacent LED dots do not satisfy the leg requirement.
* The two tiny blurred red figures have no recoverable leg gap. A **red-only** exception retains a centred head/torso silhouette at most 8 pixels wide and 15 high with height/width at least 1.7. Worker diagnostics label this `coarse-red-silhouette`. This weaker evidence is never used for a green claim and does not authorise crossing.
* Countdown candidates must satisfy the existing dark-surround test. Of sampled non-amber pixels inside the candidate, at least 88% must have maximum RGB below 100. Amber occupancy must be between 1.5% and 60%. These are experimental display-context rules; glare, exposure and alternative display designs may cause valid displays to be rejected.
* The rules were developed with these examples. They are **development/regression checks, not held-out accuracy validation**. Occlusion, camera movement, LED flicker, perspective, tiny green figures and unfamiliar symbols remain unresolved. Rejected candidates produce no pedestrian claim; the existing start-guidance prohibition remains in force.

## Same six images, before and after

The comparison uses the actual packaged browser pipeline both times. Before results are preserved in `../six-image-evaluation/browser-summary.json`; after results are in this folder's `browser-summary.json`. Exact image hashes match. Browser preprocessing remains unchanged: longest edge at most 960 pixels, followed by the 640×640 YOLO input. Scores belong to the unchanged model; the acceptance decision is the new rule.

| Image | Previous app result | New app result |
| --- | --- | --- |
| Road | Red 0.810 | Red 0.810 retained using coarse red evidence |
| Frome Street | Green 0.834 plus false six-second foliage countdown | Green 0.834 retained; false countdown removed |
| Pultney Street | Red 0.813 | Red 0.813 retained |
| 209b | Red 0.825 plus two false greens, 0.746 and 0.437 | Red 0.825 retained; both vehicle lamps rejected |
| Traffic signal upgrade | Green 0.525 | Green 0.525 retained |
| Narellan | False green 0.806 on vehicle light | No accepted pedestrian; round lamp rejected |

All five visually identified pedestrian signals remain; the three previous vehicle-light false greens are removed on these photos. The false foliage countdown is also removed. `comparison-after.png` shows the six full images with accepted boxes only. Individual `*-browser.png` files show actual application annotations, and JSON includes the rejected candidates and evidence.

## Two new vehicle-light close-ups

Both supplied new close-ups produce zero pedestrian observations. At the existing threshold, neither produced a retained pretrained candidate before verification, so they do not demonstrate an additional model candidate being rejected. They are useful negative regression cases, including the round green lamp and the red-lamp/green-arrow assembly. Synthetic tests separately exercise round lamps inside tall housing boxes, elongated ellipses and arrow shapes.

## Verification

The first eight-image packaged-browser rerun completed without uncaught browser errors and met the expected observations above. A portable regression suite adds all eight images as evaluation fixtures, asserts exactly one correctly coloured pedestrian box in each positive image, no boxes in the three negatives, and zero countdowns in these non-countdown scenes. It runs in desktop Chromium, mobile Chromium and iPhone WebKit. Earlier real-model countdown, button, offline, camera and recovery cases remain in the full suite.

The final complete `npm run check` passed: TypeScript, ESLint, **234 unit tests across 28 files**, **8 server tests**, production build and **103 browser scenarios**, with **5 intentional synthetic-camera WebKit skips**. The 24 new real-image checks are included in those browser counts. The earlier 21-second countdown, button, offline and camera/recovery checks also passed. The WebP inputs exposed missing MIME types in WebKit file selection; the checker now accepts known image extensions for untyped files and still validates their contents through decoding. A targeted WebKit WebP test and the final full suite passed after that fix.

All changes and results remain in the separate experiment. They have not been merged into `main` or deployed.
