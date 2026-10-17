import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { AnimationMixer, Box3, Vector3, Raycaster } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { sampleVillager, VILLAGER_LANES } from "../src/domain/villagers.ts";
const load = async (file) => {
  const bytes = await readFile("public/models/" + file);
  return {
    bytes,
    gltf: await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    ),
  };
};
const manifest = JSON.parse(
  await readFile("public/models/villagers-v1.json", "utf8"),
);
const py = await readFile(
  "assets/blender/scripts/16_animated_villagers.py",
  "utf8",
);
const recipes = JSON.parse(
  inflateSync(Buffer.from(py.match(/PAYLOAD = """([\s\S]*?)"""/)[1], "base64")),
);
assert(
  !/objects\.remove|save_as_mainfile|export_scene\.|open_mainfile/.test(py),
);
assert(
  py.includes("scenes.new(") &&
    py.includes("'BLENDER_EEVEE'") &&
    py.includes("keyframe_insert"),
);
const reports = [];
for (const asset of manifest.assets) {
  const { bytes, gltf } = await load(asset.file),
    recipe = recipes.find((r) => r.variant === asset.variant);
  assert.equal(bytes.length, asset.bytes);
  assert(bytes.length < 450000);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  assert.equal(recipe.sha256, asset.sha256);
  const json = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  assert(
    !json.images?.length &&
      !json.textures?.length &&
      !json.extensionsRequired?.length,
  );
  assert(json.buffers.every((b) => !b.uri));
  assert.equal(json.skins.length, 1);
  const meshes = [];
  gltf.scene.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  assert.equal(meshes.length, 1);
  const mesh = meshes[0],
    g = mesh.geometry;
  assert(mesh.isSkinnedMesh);
  assert.equal(mesh.skeleton.bones.length, 14);
  assert.deepEqual(
    mesh.skeleton.bones.map((b) => b.name),
    recipe.bones.map((b) => b.name),
  );
  for (let i = 0; i < recipe.bones.length; i++) {
    const b = mesh.skeleton.bones[i],
      expected = recipe.bones[i];
    if (expected.parent) assert.equal(b.parent.name, expected.parent);
    b.position
      .toArray()
      .forEach((v, j) => assert(Math.abs(v - expected.position[j]) < 1e-7));
  }

  assert.equal(mesh.material.transparent, false);
  assert.equal(mesh.material.vertexColors, true);
  assert.equal(
    (g.index ? g.index.count : g.attributes.position.count) / 3,
    asset.triangles,
  );
  assert(asset.triangles < 3000);
  for (let i = 0; i < g.attributes.position.count; i++) {
    assert.equal(g.attributes.skinWeight.getX(i), 1);
    assert.equal(g.attributes.skinWeight.getY(i), 0);
    assert(
      g.attributes.skinIndex.getX(i) >= 0 &&
        g.attributes.skinIndex.getX(i) < 14,
    );
  }
  const count = g.index ? g.index.count : g.attributes.position.count;
  for (let i = 0; i < count; i++) {
    const j = g.index ? g.index.getX(i) : i;
    for (let a = 0; a < 3; a++) {
      const get = ["getX", "getY", "getZ"][a];
      assert(
        Math.abs(recipe.positions[i * 3 + a] - g.attributes.position[get](j)) <
          1e-7,
      );
      assert.equal(
        Math.round(recipe.colors[i * 3 + a] * 255),
        Math.round(g.attributes.color[get](j) * 255),
      );
    }
    assert.equal(recipe.skinIndices[i], g.attributes.skinIndex.getX(j));
  }
  assert.deepEqual(
    gltf.animations.map((a) => a.name),
    ["Walk", "Idle", "LookAround", "Study"],
  );
  const mixer = new AnimationMixer(gltf.scene),
    v = new Vector3(),
    bounds = new Box3();
  const motions = {};
  for (const clip of gltf.animations) {
    const source = recipe.clips.find((c) => c.name === clip.name);
    assert(source);
    assert.equal(source.tracks.length, clip.tracks.length);
    for (const track of clip.tracks) {
      const embedded = source.tracks.find((t) => t.name === track.name);
      assert(embedded);
      assert.equal(embedded.times.length, track.times.length);
      assert.equal(embedded.values.length, track.values.length);
      [...track.times].forEach((v, i) =>
        assert(Math.abs(v - embedded.times[i]) < 1e-7),
      );
      [...track.values].forEach((v, i) =>
        assert(Math.abs(v - embedded.values[i]) < 1e-7),
      );

      assert([...track.times, ...track.values].every(Number.isFinite));
      assert(gltf.scene.getObjectByName(track.name.split(".")[0]));
    }
    mixer.stopAllAction();
    mixer.clipAction(clip).play();
    let maxDelta = 0,
      first;
    for (let sample = 0; sample <= 12; sample++) {
      mixer.setTime((clip.duration * sample) / 13);
      gltf.scene.updateMatrixWorld(true);
      mesh.skeleton.update();
      const current = [];
      for (let i = 0; i < g.attributes.position.count; i++) {
        mesh.getVertexPosition(i, v);
        assert([v.x, v.y, v.z].every(Number.isFinite));
        bounds.expandByPoint(v);
        if (i % 53 === 0) current.push(v.clone());
      }
      if (!first) first = current;
      else
        current.forEach(
          (p, i) => (maxDelta = Math.max(maxDelta, p.distanceTo(first[i]))),
        );
    }
    assert(
      maxDelta >
        (clip.name === "Walk"
          ? 0.1
          : clip.name === "LookAround"
            ? 0.05
            : 0.003),
      clip.name + " must actually deform the character",
    );
    motions[clip.name] = +maxDelta.toFixed(4);
  }
  assert(
    bounds.min.y > -0.025 && bounds.max.y < 1.4,
    "Keep feet and character proportions bounded",
  );
  assert(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)) < 0.34);
  reports.push({
    ...asset,
    animatedBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    maxDeformation: motions,
  });
  mixer.stopAllAction();
  mixer.uncacheRoot(gltf.scene);
  mesh.skeleton.dispose();
  g.dispose();
  mesh.material.dispose();
  console.log(
    "PASS " +
      asset.variant +
      ": one 14-bone skinned mesh; 4 genuinely moving clips; exact standalone Blender geometry/colours/weights",
  );
}
let rays = 0;
const islands = JSON.parse(
  await readFile("public/models/island-art-v2.json", "utf8"),
);
for (const { theme, metadata } of islands.islands) {
  const { gltf } = await load(metadata.asset);
  gltf.scene.updateMatrixWorld(true);
  const failures = [];
  for (const lane of [0, 1])
    for (let x = -2.55; x < 2.551; x += 0.05)
      for (const dz of [-0.2, 0, 0.2]) {
        const z = VILLAGER_LANES[lane] + dz;
        const hit = new Raycaster(
          new Vector3(x, 3, z),
          new Vector3(0, -1, 0),
        ).intersectObject(gltf.scene, true)[0];
        rays++;
        if (!hit || hit.point.y > 0.31 || hit.point.y < 0.235)
          failures.push({ x, z, y: hit?.point.y, mesh: hit?.object.name });
      }
  assert.deepEqual(
    failures,
    [],
    theme + " villager corridors must avoid terrain/landmarks/stream/plants",
  );
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  console.log(
    "PASS " +
      theme +
      ": both complete route corridors physically clear on actual GLB",
  );
}
for (let t = 0; t < 84; t += 0.025)
  for (const lane of [0, 1]) {
    const p = sampleVillager(t, lane);
    for (const z of [1, 2.9])
      for (const x of [-2.35, 0, 2.35])
        assert(Math.hypot(p.x - x, p.z - z) > 0.839);
  }
// These immutable generated hashes also protect the approved islands and legacy kit.
execFileSync(process.execPath, ["scripts/validate-all-islands.mjs"], {
  stdio: "inherit",
});
await mkdir(".cache/villagers", { recursive: true });
await writeFile(
  ".cache/villagers/asset-validation.json",
  JSON.stringify(
    {
      reports,
      routeRays: rays,
      checks: [
        "Real skinning and four non-static animation clips",
        "Single opaque batch and compact finite data within budgets",
        "Blender embedded positions/colours/weights match GLBs",
        "Both route corridors clear across all seven actual islands",
        "Study footprints, immutable island/legacy hashes and standalone script safety",
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log("PASS all villager assets and " + rays + " route-clearance rays");
