// Original articulated, stylized villagers. One vertex-colour skinned mesh per person.
import * as T from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
export const outfits = {
  scout: {
    skin: "#c58d68",
    hair: "#503b32",
    coat: "#648f91",
    trousers: "#525c71",
    accent: "#dfbb78",
    cap: true,
  },
  reader: {
    skin: "#805c48",
    hair: "#302b30",
    coat: "#a77e9e",
    trousers: "#626b7d",
    accent: "#e1c394",
    bun: true,
  },
  gardener: {
    skin: "#e0b18b",
    hair: "#705139",
    coat: "#879864",
    trousers: "#6d7561",
    accent: "#d7bc86",
    hat: true,
  },
};
export const boneSpec = [
  ["Root", null, [0, 0, 0]],
  ["Hips", "Root", [0, 0.48, 0]],
  ["Spine", "Hips", [0, 0.12, 0]],
  ["Head", "Spine", [0, 0.23, 0]],
  ["LeftUpperArm", "Spine", [-0.17, 0.15, 0]],
  ["LeftForearm", "LeftUpperArm", [0, -0.15, 0]],
  ["RightUpperArm", "Spine", [0.17, 0.15, 0]],
  ["RightForearm", "RightUpperArm", [0, -0.15, 0]],
  ["LeftThigh", "Hips", [-0.075, -0.02, 0]],
  ["LeftShin", "LeftThigh", [0, -0.2, 0]],
  ["LeftFoot", "LeftShin", [0, -0.2, 0]],
  ["RightThigh", "Hips", [0.075, -0.02, 0]],
  ["RightShin", "RightThigh", [0, -0.2, 0]],
  ["RightFoot", "RightShin", [0, -0.2, 0]],
];
export function createVillager(variant) {
  const o = outfits[variant];
  if (!o) throw new Error("Unknown villager variant");
  const root = new T.Group();
  root.name = "Villager_" + variant;
  const bones = boneSpec.map(([name, , p]) => {
    const b = new T.Bone();
    b.name = name;
    b.position.fromArray(p);
    return b;
  });
  boneSpec.forEach(([, parent], i) => {
    if (parent) bones[boneSpec.findIndex((b) => b[0] === parent)].add(bones[i]);
  });
  const parts = [];
  const add = (
    geometry,
    hex,
    bone,
    p = [0, 0, 0],
    s = [1, 1, 1],
    rot = [0, 0, 0],
  ) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    g.applyMatrix4(
      new T.Matrix4().compose(
        new T.Vector3(...p),
        new T.Quaternion().setFromEuler(new T.Euler(...rot)),
        new T.Vector3(...s),
      ),
    );
    g.computeVertexNormals();
    g.deleteAttribute("uv");
    g.clearGroups();
    const n = g.attributes.position.count,
      c = new T.Color(hex),
      col = [],
      idx = [],
      weights = [];
    for (let i = 0; i < n; i++) {
      col.push(c.r, c.g, c.b);
      idx.push(
        boneSpec.findIndex((b) => b[0] === bone),
        0,
        0,
        0,
      );
      weights.push(1, 0, 0, 0);
    }
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(idx, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(weights, 4));
    parts.push(g);
  };
  const box = (p, s, c, b, rot) =>
    add(new T.BoxGeometry(1, 1, 1), c, b, p, s, rot);
  const ball = (p, s, c, b) => add(new T.SphereGeometry(1, 10, 7), c, b, p, s);
  const cyl = (p, rt, rb, h, c, b, n = 8) =>
    add(new T.CylinderGeometry(rt, rb, h, n), c, b, p);
  // Comfortable storybook proportions: rounded face, hair, tiny eyes, collar, real limbs.
  cyl([0, 0.635, 0], 0.145, 0.125, 0.3, o.coat, "Spine");
  box([0, 0.74, 0.105], [0.16, 0.045, 0.045], o.accent, "Spine");
  for (const y of [0.65, 0.71])
    ball([0, y, 0.142], [0.009, 0.009, 0.006], "#ead9b4", "Spine");
  cyl([0, 0.805, 0], 0.055, 0.06, 0.09, o.skin, "Spine");
  ball([0, 0.96, 0], [0.16, 0.175, 0.15], o.skin, "Head");
  // A real upper hemisphere, plus side locks. No painted face textures or billboard heads.
  add(
    new T.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    o.hair,
    "Head",
    [0, 0.975, -0.012],
    [0.165, 0.172, 0.15],
  );
  for (const x of [-0.143, 0.143])
    box([x, 0.955, -0.01], [0.036, 0.1, 0.08], o.hair, "Head");
  for (const x of [-0.052, 0.052]) {
    ball([x, 0.971, 0.134], [0.024, 0.025, 0.011], "#f7efde", "Head");
    ball([x, 0.97, 0.145], [0.011, 0.014, 0.006], "#34312e", "Head");
    box([x, 1.012, 0.14], [0.039, 0.009, 0.008], o.hair, "Head", [
      0,
      0,
      x < 0 ? 0.1 : -0.1,
    ]);
  }
  ball([0, 0.925, 0.154], [0.019, 0.023, 0.021], o.skin, "Head");
  add(
    new T.TorusGeometry(0.03, 0.004, 4, 10, Math.PI),
    "#795246",
    "Head",
    [0, 0.901, 0.139],
    [0, 0, Math.PI],
  );
  for (const x of [-0.16, 0.16])
    ball([x, 0.947, -0.005], [0.025, 0.035, 0.025], o.skin, "Head");
  if (o.cap) {
    add(
      new T.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      "#496f76",
      "Head",
      [0, 1.048, -0.01],
      [0.171, 0.107, 0.16],
    );
    box([0, 1.055, 0.127], [0.24, 0.025, 0.14], "#567f83", "Head");
    box([0, 1.093, 0.137], [0.045, 0.033, 0.013], o.accent, "Head");
  }
  if (o.bun) ball([0, 1.052, -0.135], [0.078, 0.073, 0.071], o.hair, "Head");
  if (o.hat) {
    cyl([0, 1.06, 0], 0.205, 0.205, 0.026, "#c4a374", "Head", 12);
    cyl([0, 1.11, -0.01], 0.115, 0.15, 0.1, "#d7b987", "Head", 12);
    cyl([0, 1.078, -0.01], 0.147, 0.151, 0.026, "#8d7960", "Head", 12);
    box([0, 0.58, 0.13], [0.22, 0.22, 0.025], o.accent, "Spine");
    for (const x of [-0.09, 0.09])
      box([x, 0.7, 0.13], [0.025, 0.2, 0.025], o.accent, "Spine");
  }
  // A small satchel and straps; shared book is held by the left forearm.
  box([0, 0.64, -0.134], [0.19, 0.19, 0.065], "#b08a65", "Spine");
  box([0, 0.7, -0.175], [0.2, 0.065, 0.023], "#c9a77a", "Spine");
  for (const x of [-0.095, 0.095])
    box([x, 0.67, 0.105], [0.023, 0.23, 0.024], "#a88561", "Spine");
  for (const [side, x] of [
    ["Left", -0.17],
    ["Right", 0.17],
  ]) {
    const arm = side + "UpperArm",
      fore = side + "Forearm";
    cyl([x, 0.681, 0], 0.049, 0.043, 0.145, o.coat, arm);
    ball([x, 0.604, 0], [0.043, 0.043, 0.043], o.skin, fore);
    cyl([x, 0.543, 0], 0.036, 0.031, 0.125, o.skin, fore);
    ball([x, 0.467, 0], [0.039, 0.045, 0.034], o.skin, fore);
  }
  box(
    [-0.177, 0.468, 0.039],
    [0.13, 0.16, 0.036],
    "#8a6e78",
    "LeftForearm",
    [0.25, 0, 0],
  );
  box(
    [-0.177, 0.468, 0.06],
    [0.105, 0.138, 0.011],
    "#ecddbb",
    "LeftForearm",
    [0.25, 0, 0],
  );
  box(
    [-0.177, 0.468, 0.068],
    [0.012, 0.13, 0.009],
    o.accent,
    "LeftForearm",
    [0.25, 0, 0],
  );
  cyl([0, 0.466, 0], 0.12, 0.12, 0.09, o.trousers, "Hips");
  for (const [side, x] of [
    ["Left", -0.075],
    ["Right", 0.075],
  ]) {
    cyl([x, 0.36, 0], 0.061, 0.052, 0.2, o.trousers, side + "Thigh");
    cyl([x, 0.16, 0], 0.05, 0.043, 0.2, o.trousers, side + "Shin");
    box([x, 0.049, 0.027], [0.105, 0.088, 0.17], "#66594c", side + "Foot");
    box([x, 0.013, 0.033], [0.108, 0.017, 0.177], "#51493e", side + "Foot");
  }
  const flat = mergeGeometries(parts, false);
  flat.setAttribute(
    "color",
    new T.Uint8BufferAttribute(
      Uint8Array.from(flat.attributes.color.array, (v) => Math.round(v * 255)),
      3,
      true,
    ),
  );
  const geometry = mergeVertices(flat, 1e-5);
  const mesh = new T.SkinnedMesh(
    geometry,
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }),
  );
  mesh.name = "VillagerMesh";
  mesh.add(bones[0]);
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton(bones));
  const clips = ["Walk", "Idle", "LookAround", "Study"].map((name) =>
    makeClip(name),
  );
  const recipe = {
    variant,
    materials: { roughness: 0.86 },
    bones: boneSpec.map(([name, parent, position]) => ({
      name,
      parent,
      position,
    })),
    positions: Array.from(flat.attributes.position.array),
    colors: Array.from(flat.attributes.color.array, (v) => v / 255),
    skinIndices: Array.from(flat.attributes.skinIndex.array).filter(
      (_, i) => i % 4 === 0,
    ),
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
  parts.forEach((g) => g.dispose());
  flat.dispose();
  return { root, clips, recipe };
}
function makeClip(name) {
  const duration = { Walk: 1.4, Idle: 4, LookAround: 4, Study: 5 }[name],
    frames = Math.round(duration * (name === "Walk" ? 30 : 15));
  const times = Array.from(
    { length: frames + 1 },
    (_, i) => (i / frames) * duration,
  );
  const poses = times.map((t) => {
    const phase = (t / duration) * Math.PI * 2,
      rot = Object.fromEntries(boneSpec.map(([n]) => [n, [0, 0, 0]]));
    let lift = 0,
      breathe = 0.002 * Math.sin(phase);
    if (name === "Walk") {
      lift = 0.01 * (1 - Math.cos(phase * 2));
      rot.Spine = [0, 0.035 * Math.sin(phase), 0.025 * Math.sin(phase)];
      for (const [side, sign] of [
        ["Left", 1],
        ["Right", -1],
      ]) {
        const step = Math.sin(phase) * sign,
          hip = 0.39 * step,
          knee = -0.58 * Math.max(0, -step);
        rot[side + "Thigh"] = [hip, 0, 0];
        rot[side + "Shin"] = [knee, 0, 0];
        rot[side + "Foot"] = [-hip - knee, 0, 0];
        rot[side + "UpperArm"] = [-0.3 * step, 0, sign * 0.055];
        rot[side + "Forearm"] = [-0.13, 0, 0];
      }
      rot.Head = [0.025 * Math.sin(phase), 0.025 * Math.sin(phase / 1), 0];
    } else if (name === "LookAround") {
      rot.Head = [0.025, Math.sin(phase) * 0.52, Math.sin(phase) * 0.055];
      rot.Spine = [0, 0.06 * Math.sin(phase), 0];
      rot.LeftForearm = [-0.13, 0, 0];
      rot.RightForearm = [-0.13, 0, 0];
    } else if (name === "Study") {
      rot.LeftUpperArm = [-0.9, 0, -0.08];
      rot.LeftForearm = [-1.05, 0, -0.1];
      rot.RightUpperArm = [-0.8, 0, 0.15];
      rot.RightForearm = [-1.13, 0, 0.15];
      rot.Head = [0.22 + 0.025 * Math.sin(phase), 0.055 * Math.sin(phase), 0];
      rot.Spine = [0.04, 0, 0];
    } else {
      rot.LeftUpperArm = [0.04, 0, -0.06];
      rot.RightUpperArm = [-0.04, 0, 0.06];
      rot.LeftForearm = [-0.12, 0, 0];
      rot.RightForearm = [-0.1, 0, 0];
      rot.Head = [0.01, Math.sin(phase) * 0.08, 0];
    }
    return { rot, lift, breathe };
  });
  const tracks = boneSpec.map(
    ([n]) =>
      new T.QuaternionKeyframeTrack(
        n + ".quaternion",
        times,
        poses.flatMap((p) =>
          new T.Quaternion().setFromEuler(new T.Euler(...p.rot[n])).toArray(),
        ),
      ),
  );
  tracks.push(
    new T.VectorKeyframeTrack(
      "Hips.position",
      times,
      poses.flatMap((p) => [0, 0.48 + p.lift, 0]),
    ),
  );
  tracks.push(
    new T.VectorKeyframeTrack(
      "Spine.position",
      times,
      poses.flatMap((p) => [0, 0.12 + p.breathe, 0]),
    ),
  );
  return new T.AnimationClip(name, duration, tracks);
}
