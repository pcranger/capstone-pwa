import { BoxF } from '../core/geometry';
import type { PedestrianObservation } from './pedestrianTypes';

export interface PixelImage { width: number; height: number; data: Uint8ClampedArray }
export type LampColour = 'RED' | 'GREEN' | 'AMBER' | 'BLUE';
export function lampColour(r: number, g: number, b: number): LampColour | null {
  if (r > 145 && g > 65 && g > b * 1.55 && r > b * 1.8 && r > g * .95 && r < g * 4) return 'AMBER';
  if (r > 140 && r > g * 1.65 && r > b * 1.5) return 'RED';
  if (g > 130 && g > r * 1.45 && g > b * .9 && b < g * 1.5) return 'GREEN';
  if (b > 130 && b > r * 1.3 && b > g * 1.12) return 'BLUE';
  return null;
}

export interface ColourRegion { box: BoxF; colour: LampColour; pixels: number }
/** Dilation joins LED dots. Bounding boxes always refer to the original, upright frame. */
export function colourRegions(image: PixelImage): ColourRegion[] {
  const scale = Math.min(1, 640 / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * scale)), h = Math.max(1, Math.round(image.height * scale));
  const regions: ColourRegion[] = [];
  for (const colour of ['RED', 'GREEN', 'AMBER', 'BLUE'] as const) {
    const mask = new Uint8Array(w * h), expanded = new Uint8Array(w * h), seen = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (Math.min(image.height - 1, Math.floor(y / scale)) * image.width + Math.min(image.width - 1, Math.floor(x / scale))) * 4;
      if (lampColour(image.data[p], image.data[p + 1], image.data[p + 2]) === colour) mask[y * w + x] = 1;
    }
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (mask[y * w + x])
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expanded[(y + dy) * w + x + dx] = 1;
    for (let i = 0; i < expanded.length; i++) {
      if (!expanded[i] || seen[i]) continue;
      const queue = [i]; seen[i] = 1; let l = w, t = h, r = 0, b = 0, pixels = 0;
      for (let k = 0; k < queue.length; k++) {
        const p = queue[k], x = p % w, y = Math.floor(p / w);
        if (mask[p]) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); pixels++; }
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (expanded[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
        }
      }
      if (pixels >= 8 && b - t >= 6 && r > l) regions.push({ colour, pixels, box: new BoxF(l / w, t / h, (r + 1) / w, (b + 1) / h) });
    }
  }
  return regions.sort((a, b) => b.pixels - a.pixels).slice(0, 40);
}

export function colourInBox(image: PixelImage, box: BoxF): { red: number; green: number; amber: number } {
  let red = 0, green = 0, amber = 0;
  const l = Math.max(0, Math.floor(box.left * image.width)), r = Math.min(image.width, Math.ceil(box.right * image.width));
  const t = Math.max(0, Math.floor(box.top * image.height)), b = Math.min(image.height, Math.ceil(box.bottom * image.height));
  for (let y = t; y < b; y++) for (let x = l; x < r; x++) {
    const p = (y * image.width + x) * 4, colour = lampColour(image.data[p], image.data[p + 1], image.data[p + 2]);
    if (colour === 'RED') red++;
    if (colour === 'GREEN') green++;
    if (colour === 'AMBER') amber++;
  }
  return { red, green, amber };
}

export function darkSurround(image: PixelImage, box: BoxF): boolean {
  let dark = 0, total = 0;
  for (let y = -2; y <= 11; y++) for (let x = -2; x <= 11; x++) {
    if (x >= 0 && x <= 9 && y >= 0 && y <= 9) continue;
    const px = Math.floor((box.left + (x + .5) / 10 * box.width) * image.width), py = Math.floor((box.top + (y + .5) / 10 * box.height) * image.height);
    if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;
    const p = (py * image.width + px) * 4;
    if (Math.max(image.data[p], image.data[p + 1], image.data[p + 2]) < 110) dark++;
    total++;
  }
  return total > 0 && dark / total > .65;
}

/** Seven-segment geometry handles digital LED fonts that general-purpose OCR often misses. */
export function readSevenSegment(image: PixelImage, digits: ColourRegion[]): number | null {
  const segments = [[.2, 0, .9, .16], [.65, .12, 1, .45], [.6, .55, 1, .88], [.05, .84, .85, 1], [0, .55, .35, .9], [0, .12, .35, .45], [.1, .42, .9, .6]];
  const masks = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];
  if (!digits.length || digits.length > 2) return null;
  let text = '';
  for (const digit of [...digits].sort((a, b) => a.box.left - b.box.left)) {
    const b = digit.box, aspect = b.width * image.width / (b.height * image.height);
    if (aspect < .12 || aspect > .85) return null;
    if (aspect < .32) { text += '1'; continue; }
    const bits = segments.map(([l, t, r, bottom]) => {
      let lit = 0, total = 0;
      for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
        const px = Math.min(image.width - 1, Math.floor((b.left + (l + (x + .5) / 12 * (r - l)) * b.width) * image.width));
        const py = Math.min(image.height - 1, Math.floor((b.top + (t + (y + .5) / 12 * (bottom - t)) * b.height) * image.height));
        const p = (py * image.width + px) * 4;
        if (lampColour(image.data[p], image.data[p + 1], image.data[p + 2]) === 'AMBER') lit++;
        total++;
      }
      return lit / total > .12 ? '1' : '0';
    }).join('');
    const value = masks.indexOf(bits);
    if (value < 0) return null;
    text += value;
  }
  return Number(text);
}

/** Shape fallback is explicitly unverified; it never enables start guidance. */
export function symbolRegions(image: PixelImage, regions: ColourRegion[]): PedestrianObservation[] {
  return regions.filter(r => (r.colour === 'RED' || r.colour === 'GREEN') && darkSurround(image, r.box) && r.box.height * image.height / (r.box.width * image.width) > 1.25 && r.box.height * image.height / (r.box.width * image.width) < 3.8)
    .filter(r => {
      // A lit round vehicle lamp has neither the narrow head nor the gap between legs.
      const box = r.box, w = 20, h = 32, rows: number[] = [];
      for (let y = 0; y < h; y++) {
        let n = 0;
        for (let x = 0; x < w; x++) {
          const px = Math.min(image.width - 1, Math.floor((box.left + (x + .5) / w * box.width) * image.width));
          const py = Math.min(image.height - 1, Math.floor((box.top + (y + .5) / h * box.height) * image.height));
          const p = (py * image.width + px) * 4;
          if (lampColour(image.data[p], image.data[p + 1], image.data[p + 2]) === r.colour) n++;
        }
        rows.push(n);
      }
      const head = Math.max(...rows.slice(0, 6)), torso = Math.max(...rows.slice(9, 21));
      return head >= 2 && torso >= 5 && head < torso * .95;
    }).slice(0, 6).map((r, i) => ({ id: `shape-${i}`, kind: 'signal', box: r.box, phase: r.colour === 'RED' ? 'RED' : 'GREEN', score: .55, source: 'shape' }));
}

export function countdownRegions(regions: ColourRegion[]): BoxF[] {
  const amber = regions.filter(r => r.colour === 'AMBER' && r.box.height / r.box.width > .5 && r.box.height / r.box.width < 12);
  const groups: BoxF[] = [];
  for (const region of amber) {
    const a = region.box;
    const i = groups.findIndex(b => Math.abs(a.centerY - b.centerY) < Math.max(a.height, b.height) * .35 && Math.min(a.height, b.height) > Math.max(a.height, b.height) * .55 && Math.max(a.left, b.left) - Math.min(a.right, b.right) < Math.max(a.height, b.height) * .6);
    if (i >= 0) { const b = groups[i]; groups[i] = new BoxF(Math.min(a.left, b.left), Math.min(a.top, b.top), Math.max(a.right, b.right), Math.max(a.bottom, b.bottom)); }
    else groups.push(a);
  }
  return groups.filter(b => b.width / b.height > .13 && b.width / b.height < 2.8).slice(0, 3);
}

/** Prototype for the blue-arrow/silver-disc button design supplied by the user. */
export function buttonRegions(image: PixelImage, regions: ColourRegion[]): PedestrianObservation[] {
  const found: PedestrianObservation[] = [];
  for (const region of regions.filter(r => r.colour === 'BLUE')) {
    const b = region.box, aspect = b.width * image.width / (b.height * image.height);
    if (aspect < .7 || aspect > 1.4 || b.area < .002) continue;
    const press = new BoxF(b.left + b.width * .2, b.bottom + b.height * .14, b.right - b.width * .13, b.bottom + b.height * .88);
    if (press.bottom > 1) continue;
    let silver = 0, total = 0;
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      if ((x - 5.5) ** 2 + (y - 5.5) ** 2 > 25) continue;
      const px = Math.floor((press.left + (x + .5) / 12 * press.width) * image.width), py = Math.floor((press.top + (y + .5) / 12 * press.height) * image.height);
      const p = (py * image.width + px) * 4, v = [image.data[p], image.data[p + 1], image.data[p + 2]];
      if (Math.min(...v) > 110 && Math.max(...v) - Math.min(...v) < 55) silver++;
      total++;
    }
    if (silver / total < .55) continue;
    const id = `button-${found.length}`;
    found.push({ id, kind: 'button', box: new BoxF(Math.max(0, b.left - b.width * .13), Math.max(0, b.top - b.height * .13), Math.min(1, b.right + b.width * .13), Math.min(1, press.bottom + b.height * .3)), phase: 'UNKNOWN', score: .5, source: 'button-shape' });
    found.push({ id: `${id}-press`, kind: 'press-surface', box: press, phase: 'UNKNOWN', score: .5, source: 'button-shape' });
  }
  return found;
}
