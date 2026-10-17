import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { AnimationMixer, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnimatedSkyDrake } from "./art/sky-drake-rig.mjs";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
const meta = JSON.parse(
  await readFile("public/models/auren-flight-v1.json", "utf8"),
);
const bytes = await readFile("public/models/" + meta.asset);
assert.equal(createHash("sha256").update(bytes).digest("hex"), meta.sha256);
assert.equal(bytes.length, meta.bytes);
assert(bytes.length < 2 * 1024 * 1024);
assert.deepEqual(
  meta,
  JSON.parse(await readFile("design/dragon-pair/manifest.json", "utf8")),
);
const data = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "/models/",
);
let meshes = 0,
  mesh;
data.scene.traverse((o) => {
  if (o.isMesh) {
    meshes++;
    mesh = o;
  }
});
assert.equal(meshes, 1);
assert(mesh.isSkinnedMesh);
assert.equal(mesh.skeleton.bones.length, 16);
assert.equal(mesh.geometry.index.count / 3, meta.triangles);
assert.equal(meta.textures, 0);
assert.equal(meta.materials, 1);
const a = mesh.geometry.attributes;
for (let i = 0; i < a.position.count; i++) {
  for (let j = 0; j < 3; j++)
    assert(Number.isFinite(a.position.getComponent(i, j)));
  let sum = 0;
  for (let j = 0; j < 4; j++) {
    const weight = a.skinWeight.getComponent(i, j),
      index = a.skinIndex.getComponent(i, j);
    assert(weight >= 0 && weight <= 1);
    assert(index >= 0 && index < 16);
    sum += weight;
  }
  assert(Math.abs(sum - 1) < 1e-6);
}
assert.deepEqual(
  data.animations.map((c) => c.name),
  ["Wingbeat", "Glide", "TailSway"],
);
// Same species and exact approved palette, but genuinely larger morphology.
assert.equal(meta.species, "Aurel sky drake");
assert.equal(meta.sex, "male");
const femaleBytes = await readFile(
  "public/models/aurel_sky_drake_rigged_v1.glb",
);
const female = await new GLTFLoader().parseAsync(
  femaleBytes.buffer.slice(
    femaleBytes.byteOffset,
    femaleBytes.byteOffset + femaleBytes.byteLength,
  ),
  "/models/",
);
let femaleMesh;
female.scene.traverse((o) => {
  if (o.isSkinnedMesh) femaleMesh = o;
});
assert.deepEqual(
  mesh.geometry.attributes.color.array,
  femaleMesh.geometry.attributes.color.array,
  "Exact same species palette",
);
assert.equal(a.position.count, femaleMesh.geometry.attributes.position.count);
mesh.geometry.computeBoundingBox();
femaleMesh.geometry.computeBoundingBox();
const maleBounds = mesh.geometry.boundingBox,
  femaleBounds = femaleMesh.geometry.boundingBox;
assert(
  (maleBounds.max.x - maleBounds.min.x) /
    (femaleBounds.max.x - femaleBounds.min.x) >
    1.4,
  "42% broader outer wings",
);
assert(maleBounds.min.z < femaleBounds.min.z * 1.5, "Longer male tail");
data.scene.updateMatrixWorld(true);
mesh.skeleton.update();
for (let i = 0; i < a.position.count; i += 13) {
  const rest = mesh.getVertexPosition(i, new Vector3()),
    bind = new Vector3().fromBufferAttribute(a.position, i);
  assert(
    rest.distanceTo(bind) < 1e-5,
    "Morphed joints must match the morphed bind skin",
  );
}
const mixer = new AnimationMixer(data.scene),
  action = mixer.clipAction(data.animations[0]).play();
const wing = data.scene.getObjectByName("LeftShoulder"),
  initial = wing.quaternion.clone();
mixer.update(1.2);
assert(!wing.quaternion.equals(initial));
const vertex = new Vector3();
for (let t = 0; t < 6; t += 0.2) {
  mixer.setTime(t);
  data.scene.updateMatrixWorld(true);
  mesh.skeleton.update();
  for (let i = 0; i < a.position.count; i += 17) {
    mesh.getVertexPosition(i, vertex);
    assert(vertex.toArray().every(Number.isFinite));
  }
}
action.stop();
// Refactoring the shared rig must not change a single byte of approved Aurel.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type};base64,${Buffer.from(b).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
const original = createAnimatedSkyDrake();
const regenerated = Buffer.from(
  await new GLTFExporter().parseAsync(original.root, {
    binary: true,
    animations: original.clips,
  }),
);
assert.deepEqual(
  regenerated,
  await readFile("public/models/aurel_sky_drake_rigged_v1.glb"),
);
console.log(
  `PASS Auren male companion runtime asset: ${meta.triangles} triangles, ${bytes.length} bytes, normalized finite skin/animation, 16 bones, one mesh/material; regenerated approved Aurel byte-identical`,
);
