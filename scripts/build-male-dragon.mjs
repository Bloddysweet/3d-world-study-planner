// Aurel's larger male partner: approved species, palette and topology preserved.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Vector3, Skeleton } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
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
const { root, mesh, bones, clips, recipe } = createAnimatedSkyDrake();
const originalPositions = Array.from(mesh.geometry.attributes.position.array);
/** One continuous bind-space morph is applied to BOTH skin and joint pivots.
 * No disconnected wing roots or tail rudder; no changes to Aurel's source. */
function maleMorph(v) {
  const x = v.x,
    y = v.y,
    z = v.z;
  const u = Math.max(0, Math.min(1, (Math.abs(x) - 0.38) / (4.65 - 0.38))),
    wing = u * u * (3 - 2 * u);
  return v.set(
    x * (1.14 + 0.28 * wing),
    y * 1.18,
    z < -0.97 ? -0.97 * 1.16 + (z + 0.97) * 1.65 : z * (1.16 + 0.1 * wing),
  );
}
const p = mesh.geometry.attributes.position,
  v = new Vector3();
for (let i = 0; i < p.count; i++) {
  maleMorph(v.fromBufferAttribute(p, i));
  p.setXYZ(i, v.x, v.y, v.z);
}
p.needsUpdate = true;
mesh.geometry.computeVertexNormals();
mesh.geometry.computeBoundingBox();
mesh.geometry.computeBoundingSphere();
root.updateMatrixWorld(true);
const pivots = bones.map((b) => maleMorph(b.getWorldPosition(new Vector3())));
bones.forEach((b, i) => {
  const parent = bones.indexOf(b.parent);
  b.position.copy(pivots[i]);
  if (parent >= 0) b.position.sub(pivots[parent]);
});
root.updateMatrixWorld(true);
mesh.skeleton.dispose();
mesh.bind(new Skeleton(bones));
root.name = "Auren_Male_Sky_Drake";
mesh.name = "Auren_Male_Companion_Mesh";
for (const clip of clips) {
  clip.duration *= 1.18;
  for (const track of clip.tracks)
    track.times = Float32Array.from(track.times, (t) => t * 1.18);
}
const bytes = Buffer.from(
  await new GLTFExporter().parseAsync(root, {
    binary: true,
    animations: clips,
  }),
);
const box = mesh.geometry.boundingBox;
const meta = {
  schemaVersion: 1,
  name: "Auren — Aurel’s male companion",
  species: "Aurel sky drake",
  sex: "male",
  partner: "Aurel",
  asset: "auren_male_companion_v1.glb",
  generator: "scripts/build-male-dragon.mjs",
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  meshes: 1,
  materials: 1,
  bones: bones.length,
  triangles: mesh.geometry.index.count / 3,
  textures: 0,
  populationCap: 1,
  palette:
    "Unchanged approved Aurel teal, warm coral/gold membranes and cream accents",
  morph: {
    bodyWidth: 1.14,
    bodyHeight: 1.18,
    bodyLength: 1.16,
    outerWingSpan: 1.42,
    tailExtension: 1.65,
  },
  bounds: { min: box.min.toArray(), max: box.max.toArray() },
  clips: clips.map((c) => ({ name: c.name, duration: c.duration })),
  parts: recipe.parts.map((p) => p.name),
  originalVertexCount: originalPositions.length / 3,
};
await mkdir("public/models", { recursive: true });
await mkdir("design/dragon-pair", { recursive: true });
await writeFile("public/models/" + meta.asset, bytes);
await writeFile(
  "public/models/auren-flight-v1.json",
  JSON.stringify(meta, null, 2) + "\n",
);
await writeFile(
  "design/dragon-pair/manifest.json",
  JSON.stringify(meta, null, 2) + "\n",
);
console.log(
  `Built Auren: same species, ${meta.triangles} triangles, ${meta.bytes} bytes; larger body, 42% broader outer wings and 65% longer tail extension. Aurel unchanged.`,
);
