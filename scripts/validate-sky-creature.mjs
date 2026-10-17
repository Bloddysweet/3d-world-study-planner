import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createSkyDrake } from "./art/sky-drake.mjs";
import { Vector3 } from "three";
const folder = "design/sky-creature",
  meta = JSON.parse(await readFile(folder + "/manifest.json", "utf8"));
const bytes = await readFile(folder + "/" + meta.asset);
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const doc = JSON.parse(
  bytes
    .subarray(20, 20 + bytes.readUInt32LE(12))
    .toString("utf8")
    .trim(),
);
assert.equal(createHash("sha256").update(bytes).digest("hex"), meta.sha256);
assert.equal(bytes.length, meta.bytes);
assert(bytes.length < 1024 * 1024);
assert.equal(doc.meshes.length, 13);
assert.equal(doc.materials.length, 1);
assert(!doc.materials[0].doubleSided);
assert(!doc.materials[0].alphaMode || doc.materials[0].alphaMode === "OPAQUE");
assert.equal(doc.images?.length ?? 0, 0);
assert.equal(doc.textures?.length ?? 0, 0);
assert.equal(doc.animations?.length ?? 0, 0);
assert.equal(doc.skins?.length ?? 0, 0);
assert(doc.buffers.every((b) => !b.uri));
assert(!doc.extensionsRequired?.length);
const { recipe, root } = createSkyDrake();
// Decode the actual exported binary (including padded colour strides), rather
// than only trusting its manifest, and compare every indexed triangle to source.
const binaryOffset = 28 + bytes.readUInt32LE(12);
function accessor(id) {
  const a = doc.accessors[id],
    view = doc.bufferViews[a.bufferView];
  const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const readers = {
    5121: ["readUInt8", 1],
    5123: ["readUInt16LE", 2],
    5125: ["readUInt32LE", 4],
    5126: ["readFloatLE", 4],
  };
  const [read, size] = readers[a.componentType],
    width = sizes[a.type];
  const values = [];
  for (let i = 0; i < a.count; i++)
    for (let j = 0; j < width; j++) {
      const offset =
        binaryOffset +
        (view.byteOffset ?? 0) +
        (a.byteOffset ?? 0) +
        i * (view.byteStride ?? size * width) +
        j * size;
      let value = bytes[read](offset);
      if (a.normalized) {
        assert.equal(a.componentType, 5121);
        value /= 255;
      }
      values.push(value);
    }
  return values;
}
for (let part = 0; part < doc.meshes.length; part++) {
  assert.equal(doc.meshes[part].primitives.length, 1);
  const p = doc.meshes[part].primitives[0],
    expected = recipe.meshes[part];
  assert.equal(p.mode, 4);
  assert.equal(p.material, 0);
  const index = accessor(p.indices),
    positions = accessor(p.attributes.POSITION),
    colors = accessor(p.attributes.COLOR_0);
  assert.equal(index.length * 3, expected.positions.length);
  for (let i = 0; i < index.length; i++)
    for (let j = 0; j < 3; j++) {
      assert(
        Math.abs(positions[index[i] * 3 + j] - expected.positions[i * 3 + j]) <
          1e-5,
        expected.name + " exported position",
      );
      assert.equal(
        colors[index[i] * 3 + j],
        expected.colors[i * 3 + j],
        expected.name + " exported colour",
      );
    }
}
let triangles = 0;
const geometry = [];
for (const mesh of recipe.meshes) {
  const edges = new Map(),
    faceEdges = [],
    volumes = [],
    areas = [];
  assert.equal(mesh.positions.length, mesh.colors.length);
  assert(mesh.positions.every(Number.isFinite));
  assert(mesh.colors.every((c) => Number.isFinite(c) && c >= 0 && c <= 1));
  assert.equal(mesh.positions.length % 9, 0);
  const key = (p) => p.map((v) => Math.round(v * 1e5)).join(",");
  for (let i = 0; i < mesh.positions.length; i += 9) {
    const vertices = [0, 3, 6].map((j) =>
        mesh.positions.slice(i + j, i + j + 3),
      ),
      ids = vertices.map(key);
    assert.equal(new Set(ids).size, 3, mesh.name + " degenerate face");
    const [a, b, c] = vertices.map((p) => new Vector3(...p));
    areas.push(b.clone().sub(a).cross(c.clone().sub(a)).length() / 2);
    volumes.push(a.dot(b.clone().cross(c)) / 6);
    const f = volumes.length - 1,
      keys = [];
    for (let j = 0; j < 3; j++) {
      const a = ids[j],
        b = ids[(j + 1) % 3],
        k = [a, b].sort().join("|");
      keys.push(k);
      if (!edges.has(k)) edges.set(k, []);
      edges.get(k).push({ face: f, direction: a < b ? 1 : -1 });
    }
    faceEdges.push(keys);
  }
  assert(
    areas.every((a) => a > 1e-12),
    mesh.name + " zero area",
  );
  for (const edge of edges.values()) {
    assert.equal(edge.length, 2, mesh.name + " boundary/non-manifold edge");
    assert.notEqual(
      edge[0].direction,
      edge[1].direction,
      mesh.name + " inconsistent winding",
    );
  }
  const seen = new Set(),
    componentVolumes = [];
  for (let start = 0; start < volumes.length; start++)
    if (!seen.has(start)) {
      const queue = [start];
      seen.add(start);
      let volume = 0;
      for (let q = 0; q < queue.length; q++) {
        const f = queue[q];
        volume += volumes[f];
        for (const k of faceEdges[f])
          for (const edge of edges.get(k))
            if (!seen.has(edge.face)) {
              seen.add(edge.face);
              queue.push(edge.face);
            }
      }
      assert(volume > 1e-10, mesh.name + " inward/zero-volume component");
      componentVolumes.push(volume);
    }
  triangles += mesh.positions.length / 9;
  geometry.push({
    name: mesh.name,
    triangles: mesh.positions.length / 9,
    closedComponents: componentVolumes.length,
    positiveVolumes: componentVolumes,
  });
}
assert.equal(triangles, meta.triangles);
assert(triangles <= 12000);
const materials = new Set();
root.traverse((o) => {
  if (o.isMesh) materials.add(o.material);
});
assert.equal(materials.size, 1);
const wing = recipe.meshes.filter((m) => m.name.endsWith("Wing_Membrane"));
assert.equal(wing.length, 2);
assert.equal(wing[0].positions.length, wing[1].positions.length);
const mirrorKeys = (m) => {
  const result = [];
  for (let i = 0; i < m.positions.length; i += 3)
    result.push(
      [Math.abs(m.positions[i]), m.positions[i + 1], m.positions[i + 2]]
        .map((v) => Math.round(v * 1e5))
        .join(","),
    );
  return result.sort();
};
assert.deepEqual(mirrorKeys(wing[0]), mirrorKeys(wing[1]));
await mkdir(".cache/sky-creature", { recursive: true });
await writeFile(
  ".cache/sky-creature/source-recipe.json",
  JSON.stringify(recipe),
);
await writeFile(
  ".cache/sky-creature/asset-report.json",
  JSON.stringify(
    {
      meta,
      geometry,
      checks: [
        "GLB SHA and size",
        "Opaque one-material, no textures/external files/skins/clips",
        "Finite positions and linear colours",
        "All closed components consistently wound and positive volume",
        "Mirrored wing membranes",
        "Under 1 MiB / 12,000 triangles",
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `PASS Aurel GLB / ${triangles} triangles / 13 parts / ${geometry.reduce((n, g) => n + g.closedComponents, 0)} closed, outward-wound components / opaque one-material / no rig or clips`,
);
