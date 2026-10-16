"""Full-image pretrained-model evaluation; no hand-picked ROI or shape fallback."""
from pathlib import Path
import argparse, gzip, hashlib, json, time
import cv2
import numpy as np
import onnxruntime as ort

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('image', type=Path)
parser.add_argument('--output', type=Path, default=Path('artifacts/pedestrian/latest-image'))
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
original = cv2.imread(str(args.image))
if original is None:
    raise SystemExit('Image could not be read.')
h, w = original.shape[:2]
scale = min(640 / w, 640 / h)
nw, nh = round(w * scale), round(h * scale)
dx, dy = (640 - nw) // 2, (640 - nh) // 2
padded = np.full((640, 640, 3), 114, np.uint8)
padded[dy:dy+nh, dx:dx+nw] = cv2.resize(original, (nw, nh))
data = padded[:, :, ::-1].copy().transpose(2, 0, 1)[None].astype(np.float32) / 255
model = gzip.decompress((root / 'public/pedestrian/pedestrian-yolov5.onnx.gz').read_bytes())
options = ort.SessionOptions()
options.intra_op_num_threads = 1
session = ort.InferenceSession(model, sess_options=options, providers=['CPUExecutionProvider'])
elapsed = []
for i in range(6):
    started = time.perf_counter()
    rows = session.run(['detections'], {'images': data})[0][0]
    duration = (time.perf_counter() - started) * 1000
    if i:
        elapsed.append(duration)
boxes, scores, labels = [], [], []
for row in rows:
    category = int(np.argmax(row[5:]))
    confidence = float(row[4] * row[5+category])
    if category == 0 or confidence < .35:
        continue
    cx, cy, bw, bh = row[:4]
    x1, y1 = max(0., float((cx-bw/2-dx)/nw*w)), max(0., float((cy-bh/2-dy)/nh*h))
    x2, y2 = min(float(w), float((cx+bw/2-dx)/nw*w)), min(float(h), float((cy+bh/2-dy)/nh*h))
    boxes.append([x1, y1, x2-x1, y2-y1]); scores.append(confidence); labels.append(category)
indices = cv2.dnn.NMSBoxes(boxes, scores, .35, .4)
detections = []
annotated = original.copy()
for index in indices:
    i = int(index)
    x, y, bw, bh = boxes[i]
    colour = (0, 230, 118) if labels[i] == 2 else (80, 80, 255)
    text = f'{"Green" if labels[i] == 2 else "Red"} pedestrian {scores[i]:.3f} (pretrained)'
    cv2.rectangle(annotated, (round(x), round(y)), (round(x+bw), round(y+bh)), colour, 3)
    (tw, th), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, .55, 1)
    label_x, label_y = max(0, min(round(x), w-tw-8)), max(th+8, round(y)-7)
    cv2.rectangle(annotated, (label_x, label_y-th-5), (label_x+tw+7, label_y+baseline+3), (0, 0, 0), -1)
    cv2.putText(annotated, text, (label_x+3, label_y), cv2.FONT_HERSHEY_SIMPLEX, .55, colour, 1, cv2.LINE_AA)
    detections.append({'class': ['Zebra_Cross', 'R_Signal', 'G_Signal'][labels[i]], 'confidence': scores[i], 'box_xyxy': [x,y,x+bw,y+bh], 'box_normalized': [x/w,y/h,(x+bw)/w,(y+bh)/h], 'source': 'pretrained ONNX model only'})
args.output.parent.mkdir(parents=True, exist_ok=True)
cv2.imwrite(str(args.output.with_suffix('.png')), annotated)
report = {'input': str(args.image.resolve()), 'input_sha256': hashlib.sha256(args.image.read_bytes()).hexdigest(), 'image_size': [w,h], 'model_sha256': hashlib.sha256(model).hexdigest(), 'input_tensor': [1,3,640,640], 'confidence_threshold': .35, 'detections': detections, 'timing': {'native_CPU_single_thread_median_ms': float(np.median(elapsed)), 'samples_ms': elapsed, 'note': 'Desktop native ONNX inference only; excludes preprocessing and is not browser/mobile performance.'}, 'limitations': 'No shape fallback, countdown reader or button heuristics in this raw-model evaluation. One image does not establish Australian road accuracy.'}
args.output.with_suffix('.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
