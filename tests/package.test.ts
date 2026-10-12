import { it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
const root = new URL("../public/", import.meta.url);
it("ships a standalone manifest with correctly sized icons", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("manifest.webmanifest", root), "utf8"),
  );
  expect(manifest.name).toBe("capstone_PWA");
  expect(manifest.display).toBe("standalone");
  expect(manifest.scope).toBe("./");
  for (const icon of manifest.icons) {
    const b = readFileSync(new URL(icon.src, root));
    expect(`${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`).toBe(icon.sizes);
  }
});
it("ships every model shard for local offline inference", () => {
  const model = JSON.parse(
    readFileSync(new URL("models/model.json", root), "utf8"),
  );
  const paths = model.weightsManifest.flatMap(
    (g: { paths: string[] }) => g.paths,
  );
  expect(paths).toHaveLength(5);
  for (const path of paths)
    expect(
      readFileSync(new URL("models/" + path, root)).length,
    ).toBeGreaterThan(100000);
});
it("ships required accessible font assets and their license", () => {
  for (const file of ["atkinson_regular.ttf", "atkinson_bold.ttf", "OFL.txt"])
    expect(existsSync(new URL("fonts/" + file, root))).toBe(true);
});
