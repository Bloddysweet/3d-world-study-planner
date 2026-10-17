// Check the actual deployable mesh, not just an authored configuration.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import assert from "node:assert/strict";
import { Box3, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
const bytes = await readFile("public/models/island_maths_v2.glb");
const meta = JSON.parse(
  await readFile("public/models/maths-art-v2.json", "utf8"),
);
assert.equal(createHash("sha256").update(bytes).digest("hex"), meta.sha256);
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const json = JSON.parse(
  bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
);
assert(
  !json.images?.length &&
    !json.textures?.length &&
    !json.animations?.length &&
    !json.skins?.length,
);
assert(!json.extensionsRequired?.length);
assert(json.buffers.every((b) => !b.uri));
assert(
  bytes.length < 1_300_000,
  "Keep the one-island pass under its 1.3MB uncompressed budget",
);
const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
const scene = gltf.scene;
scene.updateMatrixWorld(true);
let meshes = 0,
  triangles = 0;
const names = [];
scene.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  names.push(o.name);
  const g = o.geometry;
  triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
  for (const attr of Object.values(g.attributes))
    assert(
      [...attr.array].every(Number.isFinite),
      "All vertex attributes must be finite",
    );
  assert(
    g.attributes.color?.normalized,
    "Use compact normalized vertex colours",
  );
  assert.equal(o.material.transparent, false);
  assert.equal(o.material.vertexColors, true);
});
assert.equal(meshes, 11);
assert.equal(triangles, meta.triangles);
assert(triangles < 16_000);
assert.equal(gltf.animations.length, 0);
const box = new Box3().setFromObject(scene);
assert(box.min.y >= -5.1 && box.max.y < 4.5);
assert(Math.max(Math.abs(box.min.x), box.max.x) < 4.9);
// The existing runtime plots are NOT art. Check all six complete reserved footprints
// against the actual exported triangles, including river banks, paths and foliage.
const hits = [];
for (let i = 0; i < 6; i++) {
  const x = ((i % 3) - 1) * 2.35,
    z = 1 + Math.floor(i / 3) * 1.9;
  for (const [dx, dz] of [
    [0, 0],
    [0.6, 0],
    [-0.6, 0],
    [0, 0.6],
    [0, -0.6],
    [0.42, 0.42],
    [-0.42, 0.42],
    [0.42, -0.42],
    [-0.42, -0.42],
  ]) {
    const ray = new Raycaster(
      new Vector3(x + dx, 10, z + dz),
      new Vector3(0, -1, 0),
    );
    const hit = ray.intersectObject(scene, true)[0];
    if (!hit || Math.abs(hit.point.y - 0.24) > 0.005)
      hits.push({
        plot: i,
        x: x + dx,
        z: z + dz,
        y: hit?.point.y,
        mesh: hit?.object.name,
      });
  }
}
assert.deepEqual(
  hits,
  [],
  "All topic plots need a genuinely level, unobstructed deck",
);
// Confirm the user-deliverable Blender file contains precisely this model recipe.
const py = await readFile(
  "assets/blender/scripts/14_maths_art_island.py",
  "utf8",
);
const packed = py.match(/PAYLOAD = """([\s\S]*?)"""/)[1];
const recipe = JSON.parse(inflateSync(Buffer.from(packed, "base64")));
assert.equal(recipe.meshes.length, 11);
assert.equal(
  recipe.meshes.reduce((sum, m) => sum + m.positions.length / 9, 0),
  triangles,
);
assert(py.includes(meta.sha256));
assert(
  !/bpy\.data\.objects\.remove|save_as_mainfile|export_scene\.|open_mainfile/.test(
    py,
  ),
);
for (const m of recipe.meshes) {
  assert.equal(m.positions.length, m.colors.length);
  assert(m.colors.every((c) => c >= 0 && c <= 1));
}
// The 20 original deployment assets must still match their manifest exactly.
const original = JSON.parse(
  await readFile("public/models/manifest.json", "utf8"),
);
for (const entry of original.assets) {
  const b = await readFile("public/models/" + entry.file);
  assert.equal(
    createHash("sha256").update(b).digest("hex"),
    entry.sha256,
    "Do not modify another island or the legacy kit: " + entry.file,
  );
}
const result = {
  checks: [
    "GLB/hash/resource/budget validation",
    "11 batched opaque materials; finite attributes and no animations/decoders",
    "54 downward ray checks keep all six real topic footprints clear at Y=0.24",
    "Blender embedded reconstruction matches GLB and never saves/deletes/exports automatically",
    "All 20 existing deployment assets retain their original optimized hashes",
  ],
  bytes: bytes.length,
  triangles,
  meshes,
  bounds: { min: box.min.toArray(), max: box.max.toArray() },
};
await mkdir(".cache/maths-art", { recursive: true });
await writeFile(
  ".cache/maths-art/asset-validation.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
