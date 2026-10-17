import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import assert from "node:assert/strict";
import { AnimationMixer, Box3, Vector3, Matrix4, Quaternion } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createSkyDrake } from "./art/sky-drake.mjs";
import { createAnimatedSkyDrake } from "./art/sky-drake-rig.mjs";
const meta = JSON.parse(
  await readFile("design/sky-creature/animation-manifest.json", "utf8"),
);
const bytes = await readFile("design/sky-creature/" + meta.asset);
assert.equal(bytes.length, meta.bytes);
assert(bytes.length < 2 * 1024 * 1024);
assert.equal(createHash("sha256").update(bytes).digest("hex"), meta.sha256);
const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
assert(
  !doc.images?.length &&
    !doc.textures?.length &&
    !doc.extensionsRequired?.length,
);
assert(doc.buffers.every((b) => !b.uri));
assert.equal(doc.skins.length, 1);
assert.equal(doc.meshes.length, 1);
assert.equal(doc.materials.length, 1);
assert(!doc.materials[0].doubleSided);
const py = await readFile(
  "assets/blender/scripts/18_aurel_flight_animation.py",
  "utf8",
);
const recipe = JSON.parse(
  inflateSync(Buffer.from(py.match(/PAYLOAD = """([\s\S]*?)"""/)[1], "base64")),
);
assert(py.includes(meta.sha256));
const currentRecipe = JSON.parse(
  JSON.stringify(createAnimatedSkyDrake().recipe),
);
assert.deepEqual(
  recipe,
  currentRecipe,
  "Embedded model must match the current rig source",
);
await mkdir(".cache/sky-animation", { recursive: true });
await writeFile(
  ".cache/sky-animation/source-recipe.json",
  JSON.stringify(currentRecipe),
);
const original = createSkyDrake().recipe;
assert.deepEqual(
  recipe.positions,
  original.meshes.flatMap((m) => m.positions),
);
assert.deepEqual(
  recipe.colors,
  original.meshes.flatMap((m) => m.colors),
);
assert.deepEqual(
  recipe.parts.map((p) => p.name),
  original.meshes.map((m) => m.name),
);
const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
const meshes = [];
gltf.scene.traverse((o) => {
  if (o.isMesh) meshes.push(o);
});
assert.equal(meshes.length, 1);
const mesh = meshes[0],
  g = mesh.geometry;
assert(mesh.isSkinnedMesh);
assert.equal(mesh.skeleton.bones.length, 16);
assert(!mesh.material.transparent && mesh.material.vertexColors);
assert.equal((g.index?.count ?? g.attributes.position.count) / 3, 10188);
assert.deepEqual(
  mesh.skeleton.bones.map((b) => b.name),
  recipe.bones.map((b) => b.name),
);
recipe.bones.forEach((b, i) => {
  const actual = mesh.skeleton.bones[i];
  if (b.parent) assert.equal(actual.parent.name, b.parent);
  actual.position
    .toArray()
    .forEach((v, j) => assert(Math.abs(v - b.position[j]) < 1e-7));
});
let blended = 0;
for (let i = 0; i < g.attributes.position.count; i++) {
  let sum = 0,
    nonzero = 0;
  for (let j = 0; j < 4; j++) {
    const w = g.attributes.skinWeight.getComponent(i, j),
      index = g.attributes.skinIndex.getComponent(i, j);
    assert(Number.isFinite(w) && w >= 0 && w <= 1);
    assert(Number.isInteger(index) && index >= 0 && index < 16);
    sum += w;
    if (w > 0) nonzero++;
  }
  assert(Math.abs(sum - 1) < 1e-6);
  if (nonzero > 1) blended++;
}
assert(
  blended > 1000,
  "Must smoothly blend joints, not rigidly move separate images/parts",
);
for (let i = 0; i < recipe.positions.length / 3; i++) {
  const index = g.index ? g.index.getX(i) : i;
  for (let j = 0; j < 3; j++) {
    assert(
      Math.abs(
        recipe.positions[i * 3 + j] -
          g.attributes.position.getComponent(index, j),
      ) < 1e-6,
    );
    assert.equal(
      Math.round(recipe.colors[i * 3 + j] * 255),
      Math.round(g.attributes.color.getComponent(index, j) * 255),
    );
  }
  for (let j = 0; j < 4; j++) {
    assert.equal(
      recipe.skinIndices[i * 4 + j],
      g.attributes.skinIndex.getComponent(index, j),
    );
    assert(
      Math.abs(
        recipe.skinWeights[i * 4 + j] -
          g.attributes.skinWeight.getComponent(index, j),
      ) < 1e-6,
    );
  }
}
// Uniform Blender rest basis C=Rx(pi/2) preserves all parent-local rotations.
const C = new Matrix4().makeRotationX(Math.PI / 2),
  invC = C.clone().invert();
const mixer = new AnimationMixer(gltf.scene),
  v = new Vector3(),
  bounds = new Box3(),
  motions = {};
for (const clip of gltf.animations) {
  const source = recipe.clips.find((c) => c.name === clip.name);
  assert(source);
  assert.equal(source.tracks.length, clip.tracks.length);
  for (const t of clip.tracks) {
    const expected = source.tracks.find((e) => e.name === t.name);
    assert(expected);
    assert.deepEqual(Array.from(t.times), expected.times);
    assert.equal(t.values.length, expected.values.length);
    assert(Array.from(t.values).every((v, i) => v === expected.values[i]));
    assert([...t.values, ...t.times].every(Number.isFinite));
    const size = t.getValueSize();
    for (let j = 0; j < size; j++)
      assert(
        Math.abs(t.values[j] - t.values.at(-size + j)) < 1e-6,
        clip.name + " loop seam",
      );
    if (size === 4)
      for (let j = 0; j < t.values.length; j += 4)
        assert(
          Math.abs(new Quaternion(...t.values.slice(j, j + 4)).length() - 1) <
            1e-6,
        );
  }
  mixer.stopAllAction();
  mixer.clipAction(clip).play();
  let first,
    motion = 0,
    wingMotion = 0,
    tailMotion = 0;
  const wingIndex = (() => {
    for (let i = 0; i < g.attributes.position.count; i++)
      if (Math.abs(g.attributes.position.getX(i)) > 4.4) return i;
  })();
  const tailIndex = (() => {
    for (let i = 0; i < g.attributes.position.count; i++)
      if (g.attributes.position.getZ(i) < -4.4) return i;
  })();
  let firstWing, firstTail;
  for (let sample = 0; sample <= 24; sample++) {
    mixer.setTime((clip.duration * sample) / 25);
    gltf.scene.updateMatrixWorld(true);
    mesh.skeleton.update();
    const current = [];
    for (let i = 0; i < g.attributes.position.count; i++) {
      mesh.getVertexPosition(i, v);
      assert(v.toArray().every(Number.isFinite));
      bounds.expandByPoint(v);
      if (i % 61 === 0) current.push(v.clone());
    }
    if (!first) first = current;
    else
      current.forEach(
        (p, i) => (motion = Math.max(motion, p.distanceTo(first[i]))),
      );
    const wing = mesh.getVertexPosition(wingIndex, new Vector3()),
      tail = mesh.getVertexPosition(tailIndex, new Vector3());
    if (!firstWing) {
      firstWing = wing.clone();
      firstTail = tail.clone();
    } else {
      wingMotion = Math.max(wingMotion, wing.distanceTo(firstWing));
      tailMotion = Math.max(tailMotion, tail.distanceTo(firstTail));
    }
    // Independently compute Blender-space pose matrices and skinning at source-key
    // sample times. Compare to transformed Three CPU skinning (not a bpy runtime).
    const worlds = [];
    recipe.bones.forEach((b, i) => {
      const actual = mesh.skeleton.bones[i];
      const local = new Matrix4().compose(
        actual.position,
        actual.quaternion,
        actual.scale,
      );
      const parent = b.parent
        ? recipe.bones.findIndex((x) => x.name === b.parent)
        : -1;
      worlds[i] = (parent < 0 ? C.clone() : worlds[parent].clone()).multiply(
        local,
      );
    });
    for (let i = 0; i < g.attributes.position.count; i += 113) {
      const expected = mesh.getVertexPosition(i, new Vector3()).applyMatrix4(C),
        blender = new Vector3();
      for (let j = 0; j < 4; j++) {
        const w = g.attributes.skinWeight.getComponent(i, j);
        if (!w) continue;
        const bi = g.attributes.skinIndex.getComponent(i, j);
        const skin = worlds[bi]
          .clone()
          .multiply(mesh.skeleton.boneInverses[bi])
          .multiply(invC);
        blender.addScaledVector(
          new Vector3()
            .fromBufferAttribute(g.attributes.position, i)
            .applyMatrix4(C)
            .applyMatrix4(skin),
          w,
        );
      }
      assert(
        expected.distanceTo(blender) < 1e-5,
        "Blender basis / skin conversion",
      );
    }
  }
  assert(motion > 0.05);
  assert(tailMotion > 0.08);
  if (clip.name === "Wingbeat")
    assert(wingMotion > 2, "Wingbeat must visibly flap");
  if (clip.name === "TailSway")
    assert(wingMotion < 1e-6, "Tail inspection keeps wings still");
  motions[clip.name] = {
    maxDeformation: motion,
    wingTipTravel: wingMotion,
    tailTravel: tailMotion,
  };
}
assert.deepEqual(
  gltf.animations.map((c) => c.name),
  ["Wingbeat", "Glide", "TailSway"],
);
assert(
  bounds.min.x > -5.2 &&
    bounds.max.x < 5.2 &&
    bounds.min.y > -3 &&
    bounds.max.y < 3 &&
    bounds.min.z > -5.5 &&
    bounds.max.z < 3.5,
);
await mkdir(".cache/sky-animation", { recursive: true });
await writeFile(
  ".cache/sky-animation/asset-report.json",
  JSON.stringify(
    {
      meta,
      blendedVertices: blended,
      animatedBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      motions,
      checks: [
        "Approved bind geometry and colours unchanged",
        "One actual 16-bone skinned mesh / one material",
        "Normalized smooth weights",
        "Exact embedded GLB position, colour, skin, hierarchy and channel correspondence",
        "Periodic normalized animation tracks",
        "Sampled genuine wing and tail deformation",
        "Independent Blender basis/skinning correspondence — not Blender execution",
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "PASS animated Aurel: 16 bones, 3 periodic deforming clips, smooth weights, approved geometry, Blender basis correspondence",
);
console.log(motions);
