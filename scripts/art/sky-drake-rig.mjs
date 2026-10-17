// Approved Script 17 geometry, unchanged in bind pose; smooth original flight rig.
import * as T from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createSkyDrake } from "./sky-drake.mjs";
export const skyBones = [
  ["Root", null, [0, 0, 0]],
  ["Body", "Root", [0, 0, 0]],
  ["Neck", "Body", [0, 0.16, 0.9]],
  ["Head", "Neck", [0, 0.33, 1.07]],
  ["TailBase", "Body", [0, 0, -0.97]],
  ["TailMid", "TailBase", [0.35, -0.07, -1.43]],
  ["TailTip", "TailMid", [0.31, 0.37, -1.5]],
  ["Rudder", "TailTip", [-0.02, -0.04, -0.1]],
  ...[
    [-1, "Left"],
    [1, "Right"],
  ].flatMap(([s, n]) => [
    [n + "Shoulder", "Body", [s * 0.38, 0.28, 0.48]],
    [n + "Elbow", n + "Shoulder", [s * 1.85, 0.5, 0.35]],
    [n + "Wrist", n + "Elbow", [s * 1.2, 0.17, -0.45]],
    [n + "Leg", "Body", [s * 0.28, -0.17, -0.55]],
  ]),
];
const smooth = (a, b, x) => {
  const t = T.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const blend = (a, b, t) =>
  [
    [a, 1 - t],
    [b, t],
  ].filter(([, w]) => w > 1e-8);
function weights(name, x, y, z) {
  if (name.includes("Wing_")) {
    const side = x < 0 ? "Left" : "Right",
      d = Math.abs(x);
    if (d < 0.85)
      return blend("Body", side + "Shoulder", smooth(0.36, 0.85, d));
    if (d < 2.75)
      return blend(side + "Shoulder", side + "Elbow", smooth(1.65, 2.75, d));
    return blend(side + "Elbow", side + "Wrist", smooth(3.1, 4.25, d));
  }
  if (name === "Tail_Rudder") return [["Rudder", 1]];
  if (name === "Tail") {
    if (z > -2.55) return blend("TailBase", "TailMid", smooth(1.5, 2.55, -z));
    return blend("TailMid", "TailTip", smooth(3, 4.05, -z));
  }
  if (["Head", "Face", "Head_Fins"].includes(name)) return [["Head", 1]];
  if (name === "Folded_Legs") return [[(x < 0 ? "Left" : "Right") + "Leg", 1]];
  if (name === "Neck" || name === "Dorsal_Crest") {
    if (z < 1.5) return blend("Body", "Neck", smooth(0.85, 1.3, z));
    return blend("Neck", "Head", smooth(1.55, 1.95, z));
  }
  return [["Body", 1]];
}
export function createAnimatedSkyDrake(original = createSkyDrake()) {
  const positions = [],
    colors = [],
    skinIndices = [],
    skinWeights = [],
    parts = [];
  for (const m of original.recipe.meshes) {
    const start = positions.length / 3;
    positions.push(...m.positions);
    colors.push(...m.colors);
    for (let i = 0; i < m.positions.length; i += 3) {
      const w = weights(m.name, ...m.positions.slice(i, i + 3));
      for (let j = 0; j < 4; j++) {
        skinIndices.push(
          j < w.length ? skyBones.findIndex((b) => b[0] === w[j][0]) : 0,
        );
        skinWeights.push(j < w.length ? w[j][1] : 0);
      }
    }
    parts.push({ name: m.name, start, count: m.positions.length / 3 });
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute(
    "color",
    new T.Uint8BufferAttribute(
      Uint8Array.from(colors, (c) => Math.round(c * 255)),
      3,
      true,
    ),
  );
  g.setAttribute("skinIndex", new T.Uint16BufferAttribute(skinIndices, 4));
  g.setAttribute("skinWeight", new T.Float32BufferAttribute(skinWeights, 4));
  g.computeVertexNormals();
  const material = new T.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.81,
    vertexColors: true,
  });
  const mesh = new T.SkinnedMesh(mergeVertices(g, 1e-6), material);
  mesh.name = "SW18_Aurel";
  const root = new T.Group();
  root.name = "SW18_Aurel_Rigged";
  root.add(mesh);
  const bones = skyBones.map(([n, , p]) => {
    const b = new T.Bone();
    b.name = n;
    b.position.fromArray(p);
    return b;
  });
  skyBones.forEach(([, parent], i) => {
    if (parent) bones[skyBones.findIndex((b) => b[0] === parent)].add(bones[i]);
    else mesh.add(bones[i]);
  });
  root.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton(bones));
  const clips = ["Wingbeat", "Glide", "TailSway"].map(makeClip);
  const recipe = {
    name: "Aurel animated sky drake",
    positions: Array.from(g.attributes.position.array),
    colors: Array.from(g.attributes.color.array, (c) => c / 255),
    skinIndices: Array.from(g.attributes.skinIndex.array),
    skinWeights: Array.from(g.attributes.skinWeight.array),
    parts,
    bones: skyBones.map(([name, parent, position]) => ({
      name,
      parent,
      position,
    })),
    clips: clips.map((c) => ({
      name: c.name,
      duration: c.duration,
      tracks: c.tracks.map((t) => ({
        name: t.name,
        times: Array.from(t.times),
        values: Array.from(t.values),
      })),
    })),
  };
  g.dispose();
  const oldMaterials = new Set();
  original.root.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      oldMaterials.add(o.material);
    }
  });
  oldMaterials.forEach((m) => m.dispose());
  return { root, mesh, bones, clips, recipe };
}
function makeClip(name) {
  const duration = { Wingbeat: 3.2, Glide: 6, TailSway: 4.8 }[name],
    steps = Math.round(duration * 15);
  const times = Array.from(
    { length: steps + 1 },
    (_, i) => (duration * i) / steps,
  );
  const poses = times.map((t) => {
    const p = (2 * Math.PI * t) / duration,
      rot = Object.fromEntries(skyBones.map(([n]) => [n, [0, 0, 0]]));
    const flying = name === "Wingbeat",
      tailOnly = name === "TailSway";
    const strength = flying ? 1 : tailOnly ? 0 : 0.16;
    for (const [side, s] of [
      ["Left", -1],
      ["Right", 1],
    ]) {
      rot[side + "Shoulder"] = [
        0.025 * strength * Math.sin(p),
        0,
        s * 0.32 * strength * Math.cos(p),
      ];
      rot[side + "Elbow"] = [0, 0, s * 0.17 * strength * Math.cos(p - 0.5)];
      rot[side + "Wrist"] = [
        0.035 * strength * Math.sin(p - 0.6),
        0,
        s * 0.12 * strength * Math.cos(p - 0.95),
      ];
      rot[side + "Leg"] = [tailOnly ? 0 : 0.018 * Math.sin(p - 0.4), 0, 0];
    }
    const tail = flying ? 1 : tailOnly ? 1.25 : 0.65;
    rot.TailBase = [
      0.018 * tail * Math.sin(p - 0.3),
      0.07 * tail * Math.sin(p - 0.4),
      0,
    ];
    rot.TailMid = [
      0.025 * tail * Math.sin(p - 0.8),
      0.11 * tail * Math.sin(p - 0.9),
      0,
    ];
    rot.TailTip = [
      0.028 * tail * Math.sin(p - 1.3),
      0.13 * tail * Math.sin(p - 1.5),
      0,
    ];
    rot.Rudder = [0, 0.06 * tail * Math.sin(p - 1.8), 0];
    rot.Body = [tailOnly ? 0 : 0.025 * Math.sin(p), 0, 0];
    rot.Neck = [tailOnly ? 0 : 0.014 * Math.sin(p + 0.3), 0, 0];
    rot.Head = [
      tailOnly ? 0 : -0.012 * Math.sin(p),
      tailOnly ? 0 : 0.035 * Math.sin(p - 0.4),
      0,
    ];
    return { rot, bob: tailOnly ? 0 : (flying ? 0.08 : 0.035) * Math.sin(p) };
  });
  const tracks = skyBones.map(
    ([n]) =>
      new T.QuaternionKeyframeTrack(
        n + ".quaternion",
        times,
        poses.flatMap((v) =>
          new T.Quaternion().setFromEuler(new T.Euler(...v.rot[n])).toArray(),
        ),
      ),
  );
  tracks.push(
    new T.VectorKeyframeTrack(
      "Root.position",
      times,
      poses.flatMap((v) => [0, v.bob, 0]),
    ),
  );
  return new T.AnimationClip(name, duration, tracks);
}
