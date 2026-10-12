import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../dist/", import.meta.url);
async function files(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? files(new URL(e.name + "/", dir), prefix + e.name + "/")
          : prefix + e.name,
      ),
    )
  ).flat();
}
const paths = (await files(root)).filter((p) => p !== "sw.js");
const hash = createHash("sha256");
for (const p of paths) hash.update(await readFile(new URL(p, root)));
hash.update(await readFile(new URL("./build-sw.mjs", import.meta.url)));
const version = hash.digest("hex").slice(0, 12);
await writeFile(
  new URL("sw.js", root),
  `
const CACHE='capstone-pwa-${version}';
const ASSETS=${JSON.stringify(paths.map((p) => "./" + p))};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('capstone-pwa-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(event.request,{ignoreVary:true});if(cached)return cached;try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return await cache.match('./index.html');throw error;}}));});
`,
);
console.log(
  "Offline cache generated:",
  paths.length,
  "files, revision",
  version,
);
