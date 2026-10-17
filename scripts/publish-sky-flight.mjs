// Publish only the approved rig. Never regenerate or replace island/villager art.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const meta = JSON.parse(
  await readFile("design/sky-creature/animation-manifest.json", "utf8"),
);
assert.equal(meta.asset, "models/aurel_sky_drake_rigged_v1.glb");
const bytes = await readFile("design/sky-creature/" + meta.asset);
assert.equal(bytes.length, meta.bytes);
assert(bytes.length < 2 * 1024 * 1024);
assert.equal(createHash("sha256").update(bytes).digest("hex"), meta.sha256);
assert.equal(meta.bones, 16);
assert.equal(meta.triangles, 10188);
await mkdir("public/models", { recursive: true });
await writeFile("public/" + meta.asset, bytes);
await writeFile(
  "public/models/aurel-flight-v1.json",
  JSON.stringify(
    {
      ...meta,
      stage: "Optional app flight layer",
      asset: meta.asset.replace("models/", ""),
      populationCap: 1,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Published approved Aurel rig: one optional creature, " +
    meta.bytes +
    " bytes",
);
