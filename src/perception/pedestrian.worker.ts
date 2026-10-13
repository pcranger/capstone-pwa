/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/wasm';
import { createWorker, PSM, type Worker as OCRWorker } from 'tesseract.js';
import { BoxF } from '../core/geometry';
import { buttonRegions, colourInBox, colourRegions, countdownRegions, darkSurround, readSevenSegment, symbolRegions, type PixelImage } from './pedestrianVision';
import { countdownBitmap, letterboxPixels } from './pedestrianPixels';
import wasmURL from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import type { PedestrianObservation } from './pedestrianTypes';

let session: ort.InferenceSession | null = null;
let ocr: OCRWorker | null = null;
let base = '';
async function recognizeDigits(box: BoxF, pixels: PixelImage): Promise<number | null> {
  ocr ??= await createWorker('eng', 1, {
    workerPath: new URL('pedestrian/ocr/worker.min.js', base).href,
    corePath: new URL('pedestrian/ocr/', base).href,
    langPath: new URL('pedestrian/ocr/', base).href,
    workerBlobURL: false,
    cacheMethod: 'none',
  });
  await ocr.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: PSM.SINGLE_LINE });
  // Tesseract's browser loader accepts Uint8Array; its shared Node/browser type omits it.
  const encoded = countdownBitmap(pixels, box) as unknown as Parameters<OCRWorker['recognize']>[0];
  const result = await ocr.recognize(encoded);
  const text = result.data.text.trim();
  return /^\d{1,2}$/.test(text) && result.data.confidence >= 45 ? Number(text) : null;
}

async function detect(pixels: PixelImage): Promise<PedestrianObservation[]> {
  const { tensor, width, height, dx, dy } = letterboxPixels(pixels);
  const feed = new ort.Tensor('float32', tensor, [1, 3, 640, 640]);
  let outputs: ort.InferenceSession.ReturnType | undefined;
  const modelObservations: PedestrianObservation[] = [];
  try {
    outputs = await session!.run({ images: feed });
    const output = outputs.detections.data as Float32Array;
    for (let i = 0; i < output.length; i += 8) {
      const cls = output[i + 6] > output[i + 7] ? 1 : 2;
      const score = output[i + 4] * output[i + 5 + cls];
      if (score < .35 || output[i + 5] > output[i + 5 + cls]) continue;
      const [x, y, w, h] = output.slice(i, i + 4);
      const box = new BoxF((x - w / 2 - dx) / width, (y - h / 2 - dy) / height, (x + w / 2 - dx) / width, (y + h / 2 - dy) / height).clamp01();
      const colour = colourInBox(pixels, box);
      const phase = cls === 1 && colour.red > 4 && colour.red > colour.green * 2 ? 'RED' : cls === 2 && colour.green > 4 && colour.green > colour.red * 3 && colour.amber < colour.green * .25 ? 'GREEN' : 'UNKNOWN';
      modelObservations.push({ id: `model-${i}`, kind: 'signal', box, phase, score, source: 'pretrained' });
    }
  } finally { feed.dispose(); if (outputs) Object.values(outputs).forEach(t => t.dispose()); }
  const regions = colourRegions(pixels);
  const signals = modelObservations.sort((a, b) => b.score - a.score).filter((o, i, all) => !all.slice(0, i).some(p => p.box.iou(o.box) > .4));
  for (const shape of symbolRegions(pixels, regions)) {
    if (!signals.some(o => o.box.iou(shape.box) > .1 || shape.box.centerX > o.box.left && shape.box.centerX < o.box.right && shape.box.centerY > o.box.top && shape.box.centerY < o.box.bottom)) signals.push(shape);
  }
  const timers: PedestrianObservation[] = [];
  for (const box of countdownRegions(regions.filter(r => r.colour !== 'AMBER' || darkSurround(pixels, r.box)))) {
    const digits = regions.filter(r => r.colour === 'AMBER' && r.box.centerX >= box.left && r.box.centerX <= box.right && r.box.centerY >= box.top && r.box.centerY <= box.bottom && r.box.height >= box.height * .7);
    const sevenSegment = readSevenSegment(pixels, digits);
    const seconds = sevenSegment ?? await recognizeDigits(box, pixels);
    // Natural reflections must not fill the view with alleged timers. An unreadable
    // candidate is retained only within an independently detected signal housing.
    if (seconds === null && !signals.some(o => box.centerX >= o.box.left && box.centerX <= o.box.right && box.centerY >= o.box.top && box.centerY <= o.box.bottom)) continue;
    timers.push({ id: `timer-${timers.length}`, kind: 'countdown', box, phase: 'UNKNOWN', score: seconds === null ? .4 : .7, source: sevenSegment === null ? 'ocr' : 'seven-segment', seconds });
  }
  return [...signals, ...timers, ...buttonRegions(pixels, regions)];
}

self.onmessage = async (event: MessageEvent) => {
  const message = event.data;
  try {
    if (message.type === 'init') {
      base = message.base;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = { mjs: new URL('pedestrian/ort/ort-wasm-simd-threaded.mjs', base).href, wasm: new URL(wasmURL, base).href };
      const url = new URL('pedestrian/pedestrian-yolov5.onnx.gz', base).href;
      let response: Response;
      try { response = await fetch(url); }
      catch { response = await fetch(url); }
      if (!response.ok) response = await fetch(url);
      if (!response.ok) throw new Error(`Pedestrian model download failed (${response.status}).`);
      const downloaded = await response.arrayBuffer();
      const signature = new Uint8Array(downloaded, 0, Math.min(2, downloaded.byteLength));
      // Some hosts transparently decompress .gz responses; only decode an actual gzip stream.
      const model = signature[0] === 0x1f && signature[1] === 0x8b
        ? await new Response(new Blob([downloaded]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
        : downloaded;
      session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      self.postMessage({ type: 'ready' });
    } else if (message.type === 'frame' && session) {
      const observations = await detect({ data: new Uint8ClampedArray(message.buffer), width: message.width, height: message.height });
      self.postMessage({ type: 'result', timestampMs: message.timestampMs, observations, error: null });
    }
  } catch (error) {
    self.postMessage({ type: 'error', timestampMs: message.timestampMs ?? -Infinity, error: error instanceof Error ? error.message : 'Pedestrian detection unavailable.' });
  }
};
