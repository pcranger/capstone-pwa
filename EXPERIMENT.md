# CrossWise pedestrian experiment

This document records the pedestrian experiment added in commit `31de9ed` on top of the focused demo (`bb31c60`). It was developed on an isolated branch and merged into `main` in pull request #1.

Run `npm ci`, then `npm run dev -- --port 8082`. The experiment has its own dependencies and build output. Open Help → Check a reference image for a still-image check, or Stroll for the camera. `npm run check` runs the complete validation suite. Production smoke: build, run the Node server on an unused port, then run `node scripts/smoke-pedestrian-deployment.mjs http://127.0.0.1:PORT`.

After separation, an independent dependency install and production build passed, followed by **20 passing pedestrian browser scenarios and 1 intentional synthetic-camera WebKit skip**. These include reference inference, offline countdowns, worker recovery and concurrent live-camera operation. The original demo also rebuilt successfully from its restored baseline. Its working tree is clean; `main` remains at `5b92373`.

After the vehicle-exclusion follow-up, the final full check passes **234 unit tests, 8 server tests and 103 browser scenarios**, with 5 intentional synthetic-camera WebKit skips. See the current `TEST_REPORT.md` and the linked follow-up report for results and limitations.

## Models run together

The existing COCO-SSD detector continues detecting vehicles and other supported objects. The extra YOLOv5s6 pedestrian model runs asynchronously in a separate Web Worker using one-thread ONNX WASM. The controller posts a pedestrian frame before awaiting COCO inference. Pedestrian frames have at most a 960-pixel edge and are sampled no faster than every 700 ms, with only one frame in flight. YOLO then uses a 640×640 letterboxed input. The two models process the same camera view at different resolutions/cadences; their predictions are not fused into one network.

COCO prefers the configured GPU backend with a CPU fallback. Pedestrian inference uses CPU/WASM. A separate worker does not eliminate competition for device CPU, memory and battery. These costs still need physical-phone measurements, including with both models active. A stalled main inference loop also delays future pedestrian sampling. General digit OCR is lazy and runs only for countdown candidates not resolved by the seven-segment reader. Button recognition currently uses an unverified shape rule rather than a third trained network.

## Is the model sufficient?

It is a useful prototype candidate. It detects the supplied distant green street signal without a manually chosen crop. It is not sufficient to authorise crossing: the weights were not trained or independently validated on a representative Australian dataset, the product illustration requires a shape fallback, and there is no established accuracy, false-green rate, temporal/flashing reliability, applicable-crossing association or phone performance envelope. Start guidance remains disabled. Countdown and button performance are separate from the YOLO model's performance.

See `docs/PEDESTRIAN_DETECTION.md` for model provenance, licence and validation. `scripts/evaluate-pedestrian-image.py` runs the pretrained ONNX model alone on a full image and exports boxes and raw confidence; it requires Python packages `numpy`, `opencv-python` and `onnxruntime`. Its native desktop inference timings must not be presented as browser/mobile FPS.

## Latest supplied image

The image `tests/fixtures/pedestrian/street-green.png` was rerun through the ONNX model on 13 October 2026. The input was the full 1080×721 image, letterboxed to 640×640; no manually selected crop or shape fallback was used. It produced one `G_Signal` detection, score **0.723633**, original-image box approximately **(503,255)–(583,409)** around the pedestrian signal housing. The score is a model confidence, not measured accuracy or a calibrated probability that crossing is safe. The image is byte-identical to the previous street reference, so it is not a new independent test case.

`artifacts/pedestrian/request-84746-raw-model.png` contains the annotated full image; the matching JSON preserves the exact image/model hashes, box, threshold and desktop inference samples. The five warmed single-thread native CPU samples had a median of about **171 ms** on this computer, excluding preprocessing and browser overhead. No inference about sustained phone performance follows from this timing.

## Before merging

The subsequent [six-image evaluation](artifacts/pedestrian/six-image-evaluation/REPORT.md) found three false green predictions on vehicle lights and a false foliage countdown in the actual app pipeline. The [vehicle-exclusion follow-up](artifacts/pedestrian/vehicle-exclusion-evaluation/REPORT.md) adds symbol and display verification: all five real signals remain, the three false greens and foliage timer are removed on these examples, and both new vehicle-light close-ups produce no pedestrian observations. The unchanged raw model still has the original false positives. These are development examples rather than independent field validation; keep the work isolated until the owner is satisfied.

Review the experiment branch and repeat the integration tests on the intended destination branch. This branch is based on the focused demo, so a merge into an older `main` also includes the earlier demo-scope changes. Cherry-picking `31de9ed` onto another base is an alternative when only the pedestrian feature is wanted; resolve integration conflicts and rerun tests. New experiment-only evaluation commits can be reviewed independently. Do not deploy or merge until the owner is satisfied.
