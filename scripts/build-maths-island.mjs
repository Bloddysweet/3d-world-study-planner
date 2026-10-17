// Shared deterministic art generator; defaults to the approved Mathematics asset.
// No downloaded imagery or model dependencies.
// Emits a batched GLB and a self-contained Blender script from the SAME mesh data.
import * as THREE from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

import { profiles, colourMap } from "./art/theme-profiles.mjs";
import { buildLandmark } from "./art/theme-landmarks.mjs";
const theme = process.argv[2] ?? "maths";
if (!Object.hasOwn(profiles, theme))
  throw new Error(`Unknown island theme: ${theme}`);
const profile = profiles[theme],
  remap = colourMap(profile);
const materials = {
  meadow: { roughness: 0.94 },
  cliff: { roughness: 1 },
  stone: { roughness: 0.91 },
  timber: { roughness: 0.8 },
  leaves: { roughness: 0.92 },
  flowers: { roughness: 0.77 },
  brass: { roughness: 0.4, metalness: 0.45 },
  crystal: {
    roughness: 0.24,
    metalness: 0.15,
    emissive: "#25496d",
    emissiveIntensity: 0.22,
  },
  water: { roughness: 0.28, metalness: 0.12 },
  foam: { roughness: 0.72 },
  roots: { roughness: 1 },
};
const batches = new Map(Object.keys(materials).map((k) => [k, []]));
const random = (n) => {
  const v = Math.sin(n * 127.1 + profile.seed) * 43758.5453;
  return v - Math.floor(v);
};
const colour = (hex) => new THREE.Color(remap[hex] ?? hex);
const plots = Array.from({ length: 6 }, (_, i) => [
  ((i % 3) - 1) * 2.35,
  1 + Math.floor(i / 3) * 1.9,
]);
const reserved = (x, z, r = 0.88) =>
  plots.some((p) => Math.hypot(x - p[0], z - p[1]) < r);
function add(
  geometry,
  material,
  hex,
  { position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0] } = {},
) {
  let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const transform = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  g.applyMatrix4(transform);
  g.computeVertexNormals();
  const colors = [];
  const c = colour(hex);
  for (let i = 0; i < g.attributes.position.count; i++)
    colors.push(c.r, c.g, c.b);
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.deleteAttribute("uv");
  g.clearGroups();
  batches.get(material).push(g);
  geometry.dispose();
}
function triangles(vertices, faces, material, colors) {
  const positions = [],
    vertexColors = [];
  faces.forEach((f, i) => {
    const c = colour(
      Array.isArray(colors) ? colors[i % colors.length] : colors,
    );
    for (const index of f) {
      positions.push(...vertices[index]);
      vertexColors.push(c.r, c.g, c.b);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(vertexColors, 3));
  g.computeVertexNormals();
  batches.get(material).push(g);
}
function box(p, s, hex, material = "timber", turn = 0) {
  add(new THREE.BoxGeometry(1, 1, 1), material, hex, {
    position: p,
    scale: s,
    rotation: [0, turn, 0],
  });
}
function ico(p, s, hex, material = "leaves", detail = 0) {
  add(new THREE.IcosahedronGeometry(1, detail), material, hex, {
    position: p,
    scale: s,
    rotation: [0, random(p[0] + p[2]) * Math.PI, 0],
  });
}
function cylinder(p, r, h, hex, material = "stone", vertices = 12, top = r) {
  add(new THREE.CylinderGeometry(top, r, h, vertices, 1), material, hex, {
    position: p,
  });
}
function branch(from, to, r, hex, material = "timber", top = r * 0.75) {
  const a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to),
    delta = b.clone().sub(a);
  let g = new THREE.CylinderGeometry(top, r, delta.length(), 7, 1);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    ),
  );
  g.translate(...a.add(b).multiplyScalar(0.5).toArray());
  add(g, material, hex);
}
function ribbon(points, widths, material, hex, vertical = false) {
  const v = [],
    f = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)],
      next = points[Math.min(points.length - 1, i + 1)];
    const tangent = new THREE.Vector3(
      next[0] - prev[0],
      0,
      next[2] - prev[2],
    ).normalize();
    // Upright waterfalls keep their width across X, horizontal streams use a bank normal.
    const side =
      vertical || Math.hypot(next[0] - prev[0], next[2] - prev[2]) < 0.18
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(tangent.z, 0, -tangent.x);
    for (const sign of [-1, 1])
      v.push([
        points[i][0] + side.x * widths[i] * sign,
        points[i][1],
        points[i][2] + side.z * widths[i] * sign,
      ]);
    if (i) {
      const n = i * 2;
      f.push([n - 2, n - 1, n], [n - 1, n + 1, n]);
    }
  }
  // Double-sided geometry, not transparent sorting or a continuous animation loop.
  triangles(v, [...f, ...f.map((a) => [...a].reverse())], material, hex);
}

// A level, genuinely usable deck, irregular sod lip and deeper asymmetric mineral strata.
const N = 24,
  outline = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2,
      r = 4.52 + 0.16 * Math.sin(i * 2.6 + profile.phase) + 0.08 * random(i);
    return [Math.cos(a) * r, 0.24, Math.sin(a) * r];
  });
const topRings = [0.26, 0.55, 0.78, 1].map((factor, ring) =>
  outline.map((p, i) => {
    const a =
      (i / N) * Math.PI * 2 +
      (ring === 3 ? 0 : (random(i + ring * 53) - 0.5) * 0.1);
    const r = Math.hypot(p[0], p[2]) * factor;
    return [Math.cos(a) * r, 0.24, Math.sin(a) * r];
  }),
);
const top = [[0, 0.24, 0], ...topRings.flat()],
  topFaces = [];
for (let i = 0; i < N; i++) topFaces.push([0, 1 + ((i + 1) % N), 1 + i]);
for (let ring = 0; ring < 3; ring++)
  for (let i = 0; i < N; i++) {
    const a = 1 + ring * N + i,
      b = 1 + ring * N + ((i + 1) % N),
      c = a + N,
      d = b + N;
    topFaces.push([a, b, c], [b, d, c]);
  }
triangles(
  top,
  topFaces,
  "meadow",
  topFaces.map(
    (_, i) =>
      ["#91a962", "#96ad66", "#93ab63", "#98ad67"][
        Math.floor(random(i + 4000) * 4)
      ],
  ),
);
const sod = outline.flatMap((p) => [p, [p[0] * 1.006, -0.12, p[2] * 1.006]]),
  sodFaces = [];
for (let i = 0; i < N; i++) {
  const a = i * 2,
    b = ((i + 1) % N) * 2;
  sodFaces.push([a, a + 1, b], [b, a + 1, b + 1]);
}
triangles(
  sod,
  sodFaces.map((f) => [...f].reverse()),
  "meadow",
  ["#668b4c", "#769a50", "#819f51", "#5e8149"],
);
const rings = [
  outline.map((p) => [p[0] * 1.006, -0.12, p[2] * 1.006]),
  outline.map((p, i) => [
    p[0] * (0.94 + 0.06 * random(i + 80)),
    -0.85 - 0.5 * random(i + 60),
    p[2] * (0.94 + 0.04 * random(i + 70)),
  ]),
  outline.map((p, i) => [
    p[0] * (0.7 + 0.09 * random(i + 90)) + 0.18,
    -2.35 - 0.4 * random(i + 110),
    p[2] * (0.73 + 0.08 * random(i + 100)),
  ]),
  outline.map((p, i) => [
    p[0] * (0.3 + 0.12 * random(i + 120)) + 0.32,
    -3.75 - 0.35 * random(i + 130),
    p[2] * 0.35 - 0.15,
  ]),
];
if (theme !== "maths")
  for (const ring of rings) for (const p of ring) p[1] *= profile.depth;
const cliffs = rings.flat(),
  cliffFaces = [];
for (let band = 0; band < 3; band++)
  for (let i = 0; i < N; i++) {
    const a = band * N + i,
      b = band * N + ((i + 1) % N),
      c = a + N,
      d = b + N;
    cliffFaces.push([a, b, c], [b, d, c]);
  }
cliffs.push([0.35, -4.65 * profile.depth, -0.3]);
for (let i = 0; i < N; i++)
  cliffFaces.push([3 * N + i, 3 * N + ((i + 1) % N), cliffs.length - 1]);
triangles(cliffs, cliffFaces, "cliff", [
  "#a68b76",
  "#9b8175",
  "#b69b7e",
  "#827b79",
  "#ba9673",
  "#8b7a72",
  "#a79385",
  "#c0a082",
]);

// Keep the approved Mathematics landmark byte-for-byte; other themes have authored silhouettes.
if (theme !== "maths") {
  buildLandmark(theme, { THREE, add, triangles });
} else {
  // Taller, clearly faceted crystal, with a mineral plinth instead of a tiny marker.
  cylinder([-0.47, 0.32, -1.85], 1.16, 0.16, "#b8b5a0", "stone", 12);
  cylinder([-0.47, 0.43, -1.85], 0.72, 0.12, "#d4d0b6", "stone", 8);
  const crystalCenter = [-0.47, -1.85],
    segments = 7;
  const crystalRings = [
    { y: 0.49, r: 0.37 },
    { y: 0.89, r: 0.57 },
    { y: 2.8, r: 0.43 },
    { y: 3.45, r: 0.31 },
  ];
  const cv = crystalRings.flatMap((ring, j) =>
    Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * Math.PI * 2 + 0.16;
      return [
        crystalCenter[0] + Math.cos(a) * ring.r * (j === 1 ? 1.05 : 1),
        ring.y,
        crystalCenter[1] + Math.sin(a) * ring.r,
      ];
    }),
  );
  cv.push([-0.57, 4.12, -1.87]);
  const cf = [];
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * segments + i,
        b = j * segments + ((i + 1) % segments);
      cf.push([a, b, a + segments], [b, b + segments, a + segments]);
    }
  for (let i = 0; i < segments; i++) cf.push([21 + i, 21 + ((i + 1) % 7), 28]);
  triangles(
    cv,
    cf.map((face) => [...face].reverse()),
    "crystal",
    [
      "#467ab2",
      "#64b8cd",
      "#a0d9dc",
      "#345c9b",
      "#7396ce",
      "#656aab",
      "#a6bbdf",
      "#3f6caa",
      "#83c3d4",
    ],
  );
  // A hand-built, warm walnut abacus in front of the rear grove, facing +Z.
  for (const x of [0.68, 2.6]) {
    box([x, 1.59, -1.68], [0.15, 2.18, 0.18], "#785b42");
    box([x, 1.59, -1.56], [0.045, 2.05, 0.035], "#ba9766");
    cylinder([x, 0.39, -1.68], 0.28, 0.21, "#c9c3a9", "stone", 8);
    box([x, 0.54, -1.68], [0.4, 0.15, 0.62], "#987249");
  }
  box([1.64, 2.65, -1.68], [2.1, 0.18, 0.22], "#80604a");
  box([1.64, 0.59, -1.68], [2.1, 0.17, 0.22], "#80604a");
  for (let row = 0; row < 4; row++) {
    const y = 0.94 + row * 0.43;
    branch(
      [0.77, y, -1.61],
      [2.51, y, -1.61],
      0.025,
      "#c4ad71",
      "brass",
      0.025,
    );
    for (let bead = 0; bead < 6; bead++) {
      const x = 0.91 + bead * 0.255 + (bead >= 3 ? 0.08 : 0);
      ico(
        [x, y, -1.59],
        [0.092, 0.125, 0.11],
        ["#485f85", "#d6b778", "#759d93", "#667d9e"][row],
        "stone",
        1,
      );
    }
  }
}

// Soft rear terraces, not a uniformly flat green plate. Front six topic plots remain level.
for (const [x, z, s] of [
  [-2.8, -2.7, 1.13],
  [1.9, -3.1, 1.04],
  [0.1, -3.6, 0.7],
  [-3.6, -1.8, 0.65],
]) {
  ico([x, 0.25, z], [s, 0.38, s * 0.8], "#8da561", "meadow", 1);
}
// Deliberately grouped trees. Trunks branch into clustered broadleaf canopies.
const trees = [
  [-3.05, -2.35, 1.05],
  [-2.5, -3.32, 0.85],
  [-3.8, -1.1, 0.65],
  [2.9, -2.7, 1.05],
  [2, -3.65, 0.78],
  [3.65, -1.75, 0.7],
  [-0.7, -3.62, 0.7],
];
for (let i = 0; i < trees.length; i++) {
  const [x, z, s] = trees[i],
    base = 0.35;
  branch([x, base, z], [x + 0.07 * s, base + 1.35 * s, z], 0.1 * s, "#886443");
  branch(
    [x, base + 0.65 * s, z],
    [x - 0.37 * s, base + 1.25 * s, z + 0.13 * s],
    0.053 * s,
    "#98704b",
  );
  branch(
    [x, base + 0.8 * s, z],
    [x + 0.42 * s, base + 1.42 * s, z - 0.1 * s],
    0.047 * s,
    "#98704b",
  );
  if (profile.conifers) {
    for (let tier = 0; tier < 4; tier++)
      add(
        new THREE.ConeGeometry((0.72 - tier * 0.13) * s, 0.98 * s, 8),
        "leaves",
        profile.canopy[tier % 3],
        { position: [x, base + (0.72 + tier * 0.41) * s, z] },
      );
    continue;
  }
  for (let j = 0; j < 3; j++)
    ico(
      [
        x + (j - 1) * 0.38 * s,
        base + (1.45 + (j === 1 ? 0.4 : 0)) * s,
        z + (j === 0 ? 0.1 : -0.04),
      ],
      [0.65 * s, 0.67 * s, 0.59 * s],
      ["#84a659", "#a3b974", "#718f4f"][(i + j) % 3],
      "leaves",
      1,
    );
}
// Narrow conifers provide vertical variety without crowding the landmark.
for (const [x, z, s] of [
  [3.8, -0.5, 0.7],
  [-1.65, -3.9, 0.65],
]) {
  branch([x, 0.24, z], [x, 1.65 * s, z], 0.065, "#886443");
  for (let i = 0; i < 3; i++)
    add(
      new THREE.ConeGeometry((0.52 - i * 0.1) * s, 0.8 * s, 7),
      "leaves",
      ["#4f7960", "#608a64", "#7d9b6d"][i],
      { position: [x, 0.5 + (i * 0.39 + 0.35) * s, z] },
    );
}
// Restrained broad stone paths; avoid every live topic plot rather than painting fake gardens.
function pathStone(x, z, turn, i) {
  if (reserved(x, z, 0.93)) return;
  add(
    new THREE.CylinderGeometry(1, 1, 1, 7),
    "stone",
    i % 4 === 0 ? "#d7c9a6" : "#c5b89a",
    {
      position: [x, 0.276, z],
      scale: [0.23, 0.045, 0.18],
      rotation: [0, turn, 0],
    },
  );
}
for (let i = 0; i < 64; i++) {
  const a = (i / 64) * Math.PI * 2;
  pathStone(Math.cos(a) * 3.52, Math.sin(a) * 3.68 - 0.08, a, i);
}
for (let i = 0; i < 17; i++) pathStone(-3.2 + i * 0.4, 0.03, 0, i);
for (const x of [-1.17, 1.17])
  for (let i = 0; i < 10; i++) pathStone(x, 0.15 + i * 0.38, Math.PI / 2, i);
for (let i = 0; i < 15; i++) pathStone(-2.8 + i * 0.4, 1.95, 0, i);

// A source pool and banked stream lead to one obvious front-facing waterfall.
const stream = [
  [-3.45, 0.278, -0.5],
  [-3.53, 0.28, 0.3],
  [-3.4, 0.28, 1.3],
  [-3.42, 0.28, 2.8],
  [-3.05, 0.28, 3.52],
  [-2.3, 0.28, 4.02],
  [-1.05, 0.27, 4.28],
];
ribbon(stream, [0.23, 0.22, 0.21, 0.23, 0.25, 0.28, 0.33], "water", [
  "#669fa7",
  "#78b6ba",
  "#9acdcc",
]);
for (let i = 0; i < stream.length; i++) {
  const p = stream[i];
  for (const side of [-1, 1]) {
    if (reserved(p[0] + side * 0.36, p[2], 0.95)) continue;
    ico(
      [p[0] + side * 0.36, 0.3, p[2]],
      [0.17, 0.09, 0.2],
      i % 2 ? "#aeb2a0" : "#cbc5ae",
      "stone",
    );
  }
}
ico([-3.45, 0.263, -0.6], [0.49, 0.035, 0.67], "#80b9b7", "water", 1);
const fall = [
  [-1.05, 0.27, 4.28],
  [-0.98, 0.08, 4.58],
  [-0.91, -0.7, 4.7],
  [-0.85, -2.0, 4.75],
  [-0.91, -3.55, 4.77],
  [-0.99, -4.9, 4.85],
];
const fallCurve = new THREE.CatmullRomCurve3(
  fall.map((p) => new THREE.Vector3(...p)),
);
const fallPoints = Array.from({ length: 25 }, (_, i) =>
  fallCurve.getPoint(i / 24).toArray(),
);
const fallWidths = fallPoints.map(
  (_, i) =>
    0.32 -
    0.07 * Math.sin((i / 24) * Math.PI) +
    (i > 21 ? 0.025 * (i - 21) : 0),
);
ribbon(fallPoints, fallWidths, "water", "#80bdcc", true);
ribbon(
  fallPoints.map((p, i) => [
    p[0] - 0.14 + Math.sin(i * 0.15) * 0.03,
    p[1],
    p[2] + 0.026,
  ]),
  fallPoints.map(() => 0.022),
  "foam",
  "#d7edf0",
  true,
);
ribbon(
  fallPoints.map((p, i) => [p[0] + 0.08, p[1], p[2] + 0.028]),
  fallPoints.map(() => 0.045),
  "water",
  "#add9e0",
  true,
);
for (let i = 0; i < 9; i++)
  ico(
    [
      -0.95 + (random(i + 500) - 0.5) * 1.2,
      -4.85 + random(i + 510) * 0.25,
      4.9 + (random(i + 520) - 0.5) * 0.55,
    ],
    [0.16 + random(i + 530) * 0.1, 0.075, 0.12],
    "#dde9de",
    "foam",
  );
// Tiny footbridge across the stream, not a change to inter-island connections.
for (let i = 0; i < 7; i++)
  box(
    [-4.02 + i * 0.14, 0.45, 0.38],
    [0.125, 0.065, 0.61],
    i % 2 ? "#b99466" : "#c2a174",
  );
for (const z of [0.04, 0.72]) {
  for (const x of [-4.04, -3.14])
    branch([x, 0.42, z], [x, 0.95, z], 0.035, "#8d704d");
  branch([-4.04, 0.9, z], [-3.14, 0.9, z], 0.024, "#a98b5c");
}

// Rim plants, clover and low flowers, clustered rather than a spiky lawn ring.
for (let i = 0; i < 110; i++) {
  const angle = random(i + 900) * Math.PI * 2,
    r = 3.7 + random(i + 1000) * 0.48,
    x = Math.cos(angle) * r,
    z = Math.sin(angle) * r;
  if (
    reserved(x, z, 1.02) ||
    (z > 3.35 && x < -0.45 && x > -2.6) ||
    (x < -3.1 && z > -0.9 && z < 2.7)
  )
    continue;
  for (let leaf = 0; leaf < 3; leaf++) {
    const a = angle + leaf * 2.1,
      tip = [
        x + Math.cos(a) * 0.13,
        0.42 + random(i + leaf) * 0.11,
        z + Math.sin(a) * 0.13,
      ];
    triangles(
      [
        [x, 0.25, z],
        [x + 0.07, 0.29, z - 0.03],
        tip,
        [x - 0.05, 0.29, z + 0.05],
      ],
      [
        [0, 1, 2],
        [0, 2, 3],
        [1, 3, 2],
      ],
      "leaves",
      ["#6d9657", "#80a666", "#9eb572"],
    );
  }
  if (i % 3 === 0) {
    branch([x, 0.25, z], [x, 0.54, z], 0.012, "#79935b", "leaves", 0.009);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2;
      ico(
        [x + Math.cos(a) * 0.05, 0.55, z + Math.sin(a) * 0.05],
        [0.045, 0.027, 0.045],
        ["#f1dfab", "#b9c7dc", "#e1b497"][Math.floor(i / 3) % 3],
        "flowers",
      );
    }
    ico([x, 0.56, z], [0.026, 0.026, 0.026], "#d8ac58", "flowers");
  }
}
// Embedded roots grip the cliffs before trailing below them. No loose straight spikes.
for (let i = 0; i < 11; i++) {
  const a = (i / 11) * Math.PI * 2 + 0.16;
  const p = (r, y, twist = 0) => [
    Math.cos(a + twist) * r,
    y,
    Math.sin(a + twist) * r,
  ];
  const sample = (ring, angle) => {
    const t = ((((angle / (Math.PI * 2)) % 1) + 1) % 1) * N;
    const j = Math.floor(t),
      k = (j + 1) % N,
      f = t - j;
    return ring[j].map((v, axis) => v * (1 - f) + ring[k][axis] * f);
  };
  const points = rings.map((ring, j) => {
    const point = sample(ring, a + [0, 0.015, -0.025, 0.05][j]);
    const r = Math.hypot(point[0], point[2]);
    return [point[0] * (1 + 0.085 / r), point[1], point[2] * (1 + 0.085 / r)];
  });
  points.push(p(1.1, -4.3, 0.17));
  for (let j = 1; j < points.length; j++)
    branch(
      points[j - 1],
      points[j],
      0.047 - j * 0.005,
      i % 2 ? "#79634f" : "#967957",
      "roots",
    );
  branch(points[2], p(3.1, -2.7, -0.17), 0.025, "#917251", "roots", 0.012);
  if (i % 2 === 0)
    for (let j = 0; j < 4; j++) {
      const leaf = p(4.32 - j * 0.13, -0.5 - j * 0.18, j * 0.025);
      ico(leaf, [0.1, 0.16, 0.055], j % 2 ? "#80985a" : "#69874e", "leaves");
    }
}

const root = new THREE.Group();
root.name =
  theme === "maths" ? "Maths_Art_Island_v2" : `${theme}_Art_Island_v2`;
const recipe = {
  surfaceY: 0.24,
  coordinates: "Three.js Y-up; Blender reconstructs as Z-up",
  materials,
  meshes: [],
};
for (const [name, parts] of batches) {
  if (!parts.length) continue;
  const geometry = mergeGeometries(parts, false);
  geometry.computeBoundingBox();
  // Vertex colours need only normalized 8-bit precision; weld ONLY identical
  // position/normal/colour tuples, preserving the intentionally faceted edges.
  geometry.setAttribute(
    "color",
    new THREE.Uint8BufferAttribute(
      Uint8Array.from(geometry.attributes.color.array, (value) =>
        Math.round(value * 255),
      ),
      3,
      true,
    ),
  );
  const mesh = new THREE.Mesh(
    mergeVertices(geometry, 1e-5),
    new THREE.MeshStandardMaterial({
      color: "#ffffff",
      vertexColors: true,
      ...materials[name],
    }),
  );
  mesh.name = theme === "maths" ? `SW14_${name}` : `SW15_${theme}_${name}`;
  root.add(mesh);
  recipe.meshes.push({
    name,
    positions: Array.from(geometry.attributes.position.array).map(
      (v) => +v.toFixed(6),
    ),
    colors: Array.from(geometry.attributes.color.array).map(
      (v) => +(v / 255).toFixed(6),
    ),
  });
}
// GLTFExporter uses FileReader in both web and Node runtimes. No new dependency required.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
const glb = Buffer.from(
  await new GLTFExporter().parseAsync(root, {
    binary: true,
    onlyVisible: true,
  }),
);
const bounds = new THREE.Box3().setFromObject(root),
  trianglesCount = recipe.meshes.reduce(
    (n, m) => n + m.positions.length / 9,
    0,
  );
const manifest = {
  schemaVersion: 1,
  asset: `island_${theme}_v2.glb`,
  generator: "scripts/build-maths-island.mjs",
  seed: profile.seed,
  theme,
  surfaceY: 0.24,
  topicPlots: "Runtime only; all six gardenPositions remain clear",
  bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
  bytes: glb.length,
  triangles: trianglesCount,
  meshes: root.children.length,
  materials: root.children.length,
  static: true,
  externalResources: 0,
  sha256: createHash("sha256").update(glb).digest("hex"),
};
await mkdir("design/islands", { recursive: true });
await writeFile(`public/models/island_${theme}_v2.glb`, glb);
await writeFile(
  `public/models/${theme}-art-v2.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
// Shared build orchestration consumes this ignored intermediate for Script 15.
await mkdir(".cache/island-art", { recursive: true });
await writeFile(
  `.cache/island-art/${theme}-recipe.json`,
  JSON.stringify(recipe),
);
if (theme === "maths") {
  // Compact, embedded data makes the Blender delivery ONE complete, offline file.
  const packed = deflateSync(Buffer.from(JSON.stringify(recipe)), {
    level: 9,
  }).toString("base64");
  const python = `r"""STUDY WORLD — SCRIPT 14: MATHEMATICS ART ISLAND V2
Complete offline Blender 5.2-compatible reconstruction of the live-preview mesh.
Run this ONE file using Scripting > Text > Open > Run Script, then Layout.
No previous script, add-on, downloads, external files, auto-save or auto-export.
Creates a NEW scene on every run. Never deletes or overwrites existing work.
Script folder: C:\\Users\\kashif\\Desktop\\3d-world-study-planner\\blender\\scripts
Save As: C:\\Users\\kashif\\Desktop\\3d-world-study-planner\\blender\\source\\study_world_maths_art_v2.blend
Use Save As manually, choosing a new filename if that file already exists.

Geometry is embedded below, compressed to keep this a single downloadable script.
The procedural authoring source is scripts/build-maths-island.mjs in the repo.
Mesh collection: SW14_Maths_Art_EXPORT. Presentation objects are separate.
Flat plot surface: Z=0.24 m. Topic plots/villagers are runtime features, NOT baked in.
The stone paths, trees, crystal and stream are decoration, not learning progress.
"""
import bpy, json, zlib, base64, math
from mathutils import Vector

PAYLOAD = """${packed.match(/.{1,100}/g).join("\n")}"""

def build():
    recipe = json.loads(zlib.decompress(base64.b64decode(PAYLOAD)))
    scene = bpy.data.scenes.new("Study World - Maths Art v2")
    scene["study_world_owner"] = "study_world_maths_art_v2"
    scene["asset_sha256"] = "${manifest.sha256}"
    scene["surface_z"] = 0.24
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene["note"] = "New scene only. Topic progress is rendered by the website, not by this artwork."
    if bpy.context.window:
        bpy.context.window.scene = scene
    engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = next((e for e in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES") if e in engines), scene.render.engine)
    export = bpy.data.collections.new("SW14_Maths_Art_EXPORT")
    presentation = bpy.data.collections.new("SW14_Presentation_DO_NOT_EXPORT")
    scene.collection.children.link(export)
    scene.collection.children.link(presentation)
    root = bpy.data.objects.new("SW14_Maths_Art_ROOT", None)
    export.objects.link(root)
    mats = {}
    for name, settings in recipe["materials"].items():
        mat = bpy.data.materials.new("SW14_" + name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Roughness"].default_value = settings.get("roughness", 0.8)
        bsdf.inputs["Metallic"].default_value = settings.get("metalness", 0)
        vertex = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        vertex.layer_name = "Color"
        mat.node_tree.links.new(vertex.outputs["Color"], bsdf.inputs["Base Color"])
        emission = settings.get("emissive")
        if emission:
            # Convert authored sRGB hex to linear, matching Three's colour management.
            srgb = [int(emission[i:i+2],16)/255 for i in (1,3,5)]
            linear = [c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4 for c in srgb]
            socket = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            if socket is not None: socket.default_value = (*linear,1)
            strength = bsdf.inputs.get("Emission Strength")
            if strength is not None: strength.default_value = settings.get("emissiveIntensity",0)
        mats[name] = mat
    for entry in recipe["meshes"]:
        p, colors = entry["positions"], entry["colors"]
        # Right-handed conversion: Three (X,Y,Z) -> Blender (X,-Z,Y).
        vertices = [(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)]
        faces = [(i,i+1,i+2) for i in range(0,len(vertices),3)]
        mesh = bpy.data.meshes.new("SW14_"+entry["name"]+"_Mesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        attr = mesh.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="POINT")
        rgba = [value for i in range(0,len(colors),3) for value in (*colors[i:i+3],1)]
        attr.data.foreach_set("color",rgba)
        obj = bpy.data.objects.new("SW14_"+entry["name"],mesh)
        export.objects.link(obj)
        obj.parent = root
        mesh.materials.append(mats[entry["name"]])
    world = bpy.data.worlds.new("SW14_Warm_Sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.46,0.53,0.64,1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.65
    scene.world = world
    camera_data = bpy.data.cameras.new("SW14_Camera")
    camera = bpy.data.objects.new("SW14_Camera",camera_data)
    presentation.objects.link(camera)
    camera.location = (12,-16,11)
    camera.rotation_euler = (Vector((0,0,-0.3))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 15.5
    scene.camera = camera
    for name,position,energy,size,tint in [("Key",(-7,-8,13),1800,8,(1,0.86,0.69)),("Fill",(7,4,8),1000,7,(0.68,0.78,1))]:
        data = bpy.data.lights.new("SW14_"+name,'AREA')
        data.energy, data.shape, data.size, data.color = energy,'DISK',size,tint
        obj = bpy.data.objects.new(data.name,data)
        presentation.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x = scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    if hasattr(scene, 'view_settings'):
        choices = {i.identifier for i in scene.view_settings.bl_rna.properties['view_transform'].enum_items}
        if 'AgX' in choices: scene.view_settings.view_transform = 'AgX'
    if bpy.context.screen:
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.shading.type = 'MATERIAL'
                area.spaces.active.region_3d.view_distance = 15
                area.spaces.active.region_3d.view_location = (0,0,-0.3)
                area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
    print("Script 14 complete. NEW scene: " + scene.name)
    print("No file saved or exported. Use File > Save As to your blender/source folder.")
    return scene

if __name__ == "__main__":
    build()
`;
  await writeFile("assets/blender/scripts/14_maths_art_island.py", python);
}
console.log(JSON.stringify(manifest, null, 2));
