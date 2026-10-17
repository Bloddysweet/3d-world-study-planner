import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const meta = JSON.parse(
  await readFile("public/models/aurel-flight-v1.json", "utf8"),
);
const bytes = await readFile("public/models/" + meta.asset);
assert.equal(meta.populationCap, 1);
assert.equal(meta.meshes, 1);
assert.equal(meta.materials, 1);
assert.equal(meta.bones, 16);
assert.equal(meta.triangles, 10188);
assert(bytes.length < 2 * 1024 * 1024);
assert.equal(bytes.length, meta.bytes);
assert.equal(createHash("sha256").update(bytes).digest("hex"), meta.sha256);
assert.deepEqual(
  bytes,
  await readFile("design/sky-creature/models/aurel_sky_drake_rigged_v1.glb"),
);
for (const file of [
  "src/components/SkyCreature.tsx",
  "src/domain/sky-flight.ts",
]) {
  const source = await readFile(file, "utf8");
  assert(
    !/localStorage|useApp|AppProvider/.test(source),
    "Sky layer must not depend on study writes",
  );
}
console.log(
  "PASS optional runtime rig: approved bytes/hash, 16 bones, one mesh/material, cap 1, no study-store access",
);
