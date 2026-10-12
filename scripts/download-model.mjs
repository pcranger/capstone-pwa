import { mkdir, writeFile } from "node:fs/promises";
const base =
  "https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/";
const dir = new URL("../public/models/", import.meta.url);
await mkdir(dir, { recursive: true });
async function download(path) {
  const r = await fetch(base + path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  const data = new Uint8Array(await r.arrayBuffer());
  await writeFile(new URL(path, dir), data);
  return data;
}
const json = JSON.parse(new TextDecoder().decode(await download("model.json")));
for (const path of new Set(json.weightsManifest.flatMap((g) => g.paths)))
  await download(path);
console.log("COCO-SSD model downloaded for local, offline inference.");
