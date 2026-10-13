import type { BoxF } from '../core/geometry';
import type { PixelImage } from './pedestrianVision';

/** Canvas-free preprocessing also works in WebKit workers without OffscreenCanvas. */
export function letterboxPixels(image: PixelImage) {
  const scale = Math.min(640 / image.width, 640 / image.height);
  const width = Math.round(image.width * scale), height = Math.round(image.height * scale);
  const dx = Math.floor((640 - width) / 2), dy = Math.floor((640 - height) / 2);
  const tensor = new Float32Array(3 * 640 * 640).fill(114 / 255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.max(0, Math.min(image.width - 1, (x + .5) / width * image.width - .5));
    const sy = Math.max(0, Math.min(image.height - 1, (y + .5) / height * image.height - .5));
    const l = Math.floor(sx), t = Math.floor(sy), r = Math.min(l + 1, image.width - 1), b = Math.min(t + 1, image.height - 1), fx = sx - l, fy = sy - t;
    for (let c = 0; c < 3; c++) {
      const a = image.data[(t * image.width + l) * 4 + c] * (1 - fx) + image.data[(t * image.width + r) * 4 + c] * fx;
      const d = image.data[(b * image.width + l) * 4 + c] * (1 - fx) + image.data[(b * image.width + r) * 4 + c] * fx;
      tensor[c * 640 * 640 + (y + dy) * 640 + x + dx] = (a * (1 - fy) + d * fy) / 255;
    }
  }
  return { tensor, width, height, dx, dy };
}

/** Encode a thresholded digit crop as a standard 24-bit BMP for local Tesseract. */
export function countdownBitmap(image: PixelImage, box: BoxF): Uint8Array {
  const innerHeight = 160, innerWidth = Math.max(20, Math.round(box.width * image.width / (box.height * image.height) * innerHeight));
  const width = innerWidth + 40, height = innerHeight + 40, stride = Math.ceil(width * 3 / 4) * 4;
  const bytes = new Uint8Array(54 + stride * height), header = new DataView(bytes.buffer);
  bytes[0] = 66; bytes[1] = 77; header.setUint32(2, bytes.length, true); header.setUint32(10, 54, true); header.setUint32(14, 40, true);
  header.setInt32(18, width, true); header.setInt32(22, height, true); header.setUint16(26, 1, true); header.setUint16(28, 24, true); header.setUint32(34, stride * height, true);
  bytes.fill(255, 54);
  for (let y = 0; y < innerHeight; y++) for (let x = 0; x < innerWidth; x++) {
    const px = Math.min(image.width - 1, Math.floor((box.left + (x + .5) / innerWidth * box.width) * image.width));
    const py = Math.min(image.height - 1, Math.floor((box.top + (y + .5) / innerHeight * box.height) * image.height));
    const p = (py * image.width + px) * 4;
    const lit = image.data[p] > 120 && image.data[p + 1] > 60 && image.data[p + 2] < image.data[p + 1] * .7;
    if (lit) { const offset = 54 + (height - 1 - y - 20) * stride + (x + 20) * 3; bytes[offset] = bytes[offset + 1] = bytes[offset + 2] = 0; }
  }
  return bytes;
}
