# Six supplied Australian street images: unchanged model evaluation

Run on 13 October 2026, in the isolated `codex/pedestrian-experiment` worktree. No weights, thresholds, postprocessing rules or application behaviour were changed for this evaluation. Nothing was merged, pushed or deployed.

## Raw pretrained model

The full original images were letterboxed to 640×640 and evaluated with the existing YOLOv5s6 ONNX weights. No manually selected crop, fallback, countdown OCR or button rule was used in this raw-model pass. Confidence threshold: **0.35**; suppression IoU: **0.4**. Model SHA-256: `96437c2080a0ba5364f438b41c8551e310e9761cf998c74856d42b748d357b42`.

| Image | Raw detections and scores | Visual review |
| --- | --- | --- |
| 1. Road_2022-09-12_09-42-57.webp | Red 0.802 | Correctly localizes the small red pedestrian signal across the road. |
| 2. Frome Street | Green 0.849 | Correctly localizes the illuminated walking figure and its housing. |
| 3. Pultney Street | Red 0.811 | Correctly localizes the illuminated standing figure and its housing. |
| 4. 209b.jpg | Red 0.826; green 0.745; green 0.436 | Red detection matches the distant pedestrian signal. Both green predictions are **false pedestrian detections on vehicle lights**. |
| 5. traffic-signal-ugrade.jpg | Green 0.529 | Correctly localizes the green walking figure. |
| 6. Narellan | Green 0.789 | **False pedestrian detection on a three-aspect vehicle light**. The box surrounds round vehicle lamps, not a lit walking figure. |

The five visually identified front-facing pedestrian signals were located with matching colours, but there were also **three false green pedestrian detections across two photos**. The raw scores are model confidences, not calibrated probabilities or measured accuracy. This small manually reviewed sample does not establish a general accuracy estimate or recall across all intersection views.

`comparison.png` displays all six full images with boxes and review captions. Original framing and watermarks are retained. Each numbered PNG is a full-resolution raw-model annotation; its matching JSON preserves exact input/model hashes, image size, box coordinates, scores and desktop timing samples. `summary.json` contains the combined raw output. Source input paths are recorded rather than adding extra copies of the originals.

## Actual application pipeline

The same six originals were separately submitted through **Help → Check a reference image** in the unchanged packaged app, using headless Chrome and the real worker/model assets. Worker messages were observed, not mocked or modified. The app first limits the longest image edge to 960 pixels and uses its own bilinear letterboxing, so scores can differ slightly from the native raw-image pass. The browser run includes colour checks, fallback rules and countdown reading.

| Image | App observations | App policy text/result |
| --- | --- | --- |
| Road | Red 0.810 | Red blocks starting. |
| Frome | Green 0.834 **plus a false 6-second countdown on yellow foliage** | Low-time warning is generated from an incorrect seven-segment estimate. |
| Pultney | Red 0.813 | Red blocks starting. |
| 209b | Red 0.825, false green 0.746 and false green 0.437 | Red has precedence, but the two incorrect green boxes remain visible. |
| Traffic signal upgrade | Green 0.525 | Green observation reported; start remains disabled. |
| Narellan | False green 0.806 on the vehicle light | Incorrectly describes a green pedestrian symbol; start remains disabled. |

The app's additional filters **did not reject the three vehicle-light false positives**. Its seven-segment fallback also generated a countdown from foliage in the Frome image. The six worker checks completed without uncaught browser errors; that establishes execution, not correctness. `*-browser.png`, `*-browser.json` and `browser-summary.json` preserve the app's actual boxes, sources, scores and policy text.

## Assessment

Keep this as an experiment. The model can find Australian pedestrian signals, including small ones, but currently confuses green vehicle lamps with pedestrian signals at substantial confidence. Raising the threshold alone would not reliably solve this: the Narellan false positive scores higher than the correctly detected pedestrian signal in the upgrade photo. Pedestrian-symbol verification/vehicle-light rejection and countdown-region verification need further work and negative-image evaluation before merging. This evaluation does not change the existing rule that start guidance stays disabled.
