// Test all deployable GLBs plus the exact standalone Blender recipe, not configuration alone.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { Box3, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { profiles } from "./art/theme-profiles.mjs";
const manifest = JSON.parse(
  await readFile("public/models/island-art-v2.json", "utf8"),
);
const py = await readFile(
  "assets/blender/scripts/15_all_subject_art_islands.py",
  "utf8",
);
const entries = JSON.parse(
  inflateSync(Buffer.from(py.match(/PAYLOAD = """([\s\S]*?)"""/)[1], "base64")),
);
assert.deepEqual(
  manifest.islands.map((e) => e.theme),
  Object.keys(profiles),
);
assert.deepEqual(
  entries.map((e) => e.theme),
  Object.keys(profiles),
);
assert(
  !/bpy\.data\.objects\.remove|save_as_mainfile|export_scene\.|open_mainfile/.test(
    py,
  ),
);
assert(py.includes("scenes.new(") && py.includes('"BLENDER_EEVEE"'));
assert(
  py.includes(
    "C:\\Users\\kashif\\Desktop\\3d-world-study-planner\\blender\\source",
  ),
);
const reports = [],
  seen = new Set();
for (const entry of manifest.islands) {
  const { theme, metadata: meta } = entry,
    recipeEntry = entries.find((e) => e.theme === theme);
  const bytes = await readFile(`public/models/${meta.asset}`);
  assert.equal(meta.asset, `island_${theme}_v2.glb`);
  assert.deepEqual(
    meta,
    JSON.parse(await readFile(`public/models/${theme}-art-v2.json`, "utf8")),
  );
  assert.deepEqual(meta, recipeEntry.metadata);
  assert.equal(bytes.length, meta.bytes);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), meta.sha256);
  assert(!seen.has(meta.sha256));
  seen.add(meta.sha256);
  assert(bytes.length < 1_300_000);
  const json = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  assert(
    !json.images?.length &&
      !json.textures?.length &&
      !json.animations?.length &&
      !json.skins?.length &&
      !json.extensionsRequired?.length,
  );
  assert(json.buffers.every((b) => !b.uri));
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  gltf.scene.updateMatrixWorld(true);
  let meshes = 0,
    triangles = 0;
  const recipe = recipeEntry.recipe;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry,
      count = g.index ? g.index.count : g.attributes.position.count;
    triangles += count / 3;
    assert(
      Object.values(g.attributes).every((attr) =>
        [...attr.array].every(Number.isFinite),
      ),
    );
    assert(g.attributes.color.normalized);
    assert.equal(o.material.transparent, false);
    assert.equal(o.material.vertexColors, true);
    const name = o.name.replace(
      theme === "maths" ? "SW14_" : `SW15_${theme}_`,
      "",
    );
    const source = recipe.meshes.find((m) => m.name === name);
    assert(
      source &&
        source.positions.length === count * 3 &&
        source.colors.length === count * 3,
    );
    // Export welding may reorder vertices; compare every expanded triangle corner.
    for (let i = 0; i < count; i++) {
      const j = g.index ? g.index.getX(i) : i;
      for (let axis = 0; axis < 3; axis++) {
        assert(
          Math.abs(
            source.positions[i * 3 + axis] -
              g.attributes.position[["getX", "getY", "getZ"][axis]](j),
          ) < 1.1e-6,
          `${theme} embedded position mismatch`,
        );
        assert(
          Math.round(source.colors[i * 3 + axis] * 255) ===
            Math.round(
              g.attributes.color[["getX", "getY", "getZ"][axis]](j) * 255,
            ),
          `${theme} embedded colour mismatch`,
        );
      }
    }
  });
  assert.equal(meshes, meta.meshes);
  assert(meshes <= 11);
  assert.equal(triangles, meta.triangles);
  assert(triangles < 16_000);
  const box = new Box3().setFromObject(gltf.scene);
  assert(box.min.y >= -5.1 && box.max.y < 4.5);
  assert(Math.max(Math.abs(box.min.x), box.max.x) < 4.9);
  assert(Math.max(Math.abs(box.min.z), box.max.z) < 5.6);
  assert.deepEqual(box.min.toArray(), meta.bounds.min);
  assert.deepEqual(box.max.toArray(), meta.bounds.max);
  const failed = [];
  for (let plot = 0; plot < 6; plot++) {
    const x = ((plot % 3) - 1) * 2.35,
      z = 1 + Math.floor(plot / 3) * 1.9;
    // A dense disk rather than only its centre: 49 rays per plot, 294 per island.
    for (let dx = -0.6; dx <= 0.6001; dx += 0.15)
      for (let dz = -0.6; dz <= 0.6001; dz += 0.15) {
        if (Math.hypot(dx, dz) > 0.6001) continue;
        const hit = new Raycaster(
          new Vector3(x + dx, 10, z + dz),
          new Vector3(0, -1, 0),
        ).intersectObject(gltf.scene, true)[0];
        if (!hit || Math.abs(hit.point.y - 0.24) > 0.005)
          failed.push({
            plot,
            x: x + dx,
            z: z + dz,
            y: hit?.point.y,
            mesh: hit?.object.name,
          });
      }
  }
  assert.deepEqual(
    failed,
    [],
    `${theme}: keep every real topic footprint unobstructed and level`,
  );
  const report = {
    theme,
    bytes: bytes.length,
    triangles,
    meshes,
    sha256: meta.sha256,
    plotRayChecks: 294,
  };
  reports.push(report);
  console.log(
    "PASS " +
      theme +
      ": " +
      triangles +
      " triangles, " +
      meshes +
      " opaque batches, level live plots, exact Blender recipe",
  );
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
}
assert.equal(
  manifest.islands[0].metadata.sha256,
  "7afdf158c4dc3f09660286778153402ba08b6cfc2e688e3aa55417cd52184b42",
  "The approved Mathematics GLB must not change",
);
execFileSync(process.execPath, ["scripts/validate-maths-art.mjs"], {
  stdio: "inherit",
});
await mkdir(".cache/island-art", { recursive: true });
await writeFile(
  ".cache/island-art/asset-validation.json",
  JSON.stringify(
    {
      checks: [
        "Seven unique GLBs, hashes, static/opaque/resource/size budgets",
        "All expanded GLB corners match embedded Blender positions/colours",
        "2058 downward rays preserve six real plots on every profile",
        "Approved Maths and all 20 legacy hashes preserved",
        "Script 15 is standalone, new-scene-only, no automatic file writes",
      ],
      reports,
    },
    null,
    2,
  ) + "\n",
);
console.log("PASS all seven profiles and safe complete Script 15");
