import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Box3 } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { createWildDragon } from "./art/wild-dragon.mjs";
import { createAnimatedSkyDrake } from "./art/sky-drake-rig.mjs";
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
const { root, mesh, clips, recipe } =
  createAnimatedSkyDrake(createWildDragon());
root.name = "Cinder_Wild_Dragon_Rigged";
mesh.name = "Cinder_Obsidian_Wyvern";
for (const clip of clips) {
  clip.duration *= 1.6;
  for (const t of clip.tracks)
    t.times = Float32Array.from(t.times, (n) => n * 1.6);
}
const bytes = Buffer.from(
  await new GLTFExporter().parseAsync(root, {
    binary: true,
    animations: clips,
  }),
);
const bounds = new Box3().setFromObject(root);
const meta = {
  schemaVersion: 1,
  name: "Cinder — wild obsidian wyvern",
  original: true,
  asset: "cinder_wild_dragon_v1.glb",
  generator: "scripts/build-wild-dragon.mjs",
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  meshes: 1,
  materials: 1,
  bones: mesh.skeleton.bones.length,
  triangles: mesh.geometry.index.count / 3,
  textures: 0,
  populationCap: 1,
  bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
  clips: clips.map((c) => ({ name: c.name, duration: c.duration })),
  parts: recipe.parts.map((p) => p.name),
};
await mkdir("public/models", { recursive: true });
await mkdir("design/wild-dragon", { recursive: true });
await writeFile("public/models/" + meta.asset, bytes);
await writeFile(
  "public/models/cinder-flight-v1.json",
  JSON.stringify(meta, null, 2) + "\n",
);
await writeFile(
  "design/wild-dragon/manifest.json",
  JSON.stringify(meta, null, 2) + "\n",
);
console.log(
  `Built original Cinder: ${meta.triangles} triangles, ${meta.bytes} bytes, ${meta.bones} bones; Aurel unchanged`,
);
