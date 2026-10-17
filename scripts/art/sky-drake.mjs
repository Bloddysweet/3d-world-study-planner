// Original Aurel sky drake: a gentle aerial wyvern, not a franchise creature replica.
// Static model approval stage only. Closed opaque geometry, separated for later rigging.
import * as T from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function createSkyDrake() {
  const groups = new Map(),
    root = new T.Group();
  root.name = "SW17_Aurel_Sky_Drake";
  const material = new T.MeshStandardMaterial({
    color: "#ffffff",
    vertexColors: true,
    roughness: 0.81,
  });
  function add(name, g, hex, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0]) {
    const flat = g.index ? g.toNonIndexed() : g.clone();
    g.dispose();
    flat.applyMatrix4(
      new T.Matrix4().compose(
        new T.Vector3(...p),
        new T.Quaternion().setFromEuler(new T.Euler(...r)),
        new T.Vector3(...s),
      ),
    );
    flat.deleteAttribute("uv");
    flat.clearGroups();
    flat.computeVertexNormals();
    const c = new T.Color(hex),
      col = [];
    for (let i = 0; i < flat.attributes.position.count; i++)
      col.push(c.r, c.g, c.b);
    flat.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(flat);
  }
  const ball = (name, p, s, hex, w = 12, h = 8) =>
    add(name, new T.SphereGeometry(1, w, h), hex, p, s);
  function faces(name, vertices, indices, colours) {
    // Orient closed triangle components by adjacency, not a centroid heuristic
    // (a concave fin or tightly curved leg is not necessarily star-convex).
    const edges = new Map(),
      flips = new Map(),
      components = [];
    indices.forEach((f, i) =>
      f.forEach((a, j) => {
        const b = f[(j + 1) % 3],
          key = [a, b].sort((a, b) => a - b).join(",");
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key).push({ i, sign: a < b ? 1 : -1 });
      }),
    );
    for (let start = 0; start < indices.length; start++)
      if (!flips.has(start)) {
        const queue = [start];
        flips.set(start, false);
        for (let q = 0; q < queue.length; q++) {
          const i = queue[q],
            f = indices[i];
          for (let j = 0; j < 3; j++) {
            const a = f[j],
              b = f[(j + 1) % 3],
              key = [a, b].sort((a, b) => a - b).join(","),
              sign = a < b ? 1 : -1;
            const pair = edges.get(key);
            if (pair.length !== 2)
              throw Error("Open/non-manifold primitive: " + name);
            for (const other of pair)
              if (other.i !== i && !flips.has(other.i)) {
                flips.set(
                  other.i,
                  sign === other.sign ? !flips.get(i) : flips.get(i),
                );
                queue.push(other.i);
              }
          }
        }
        components.push(queue);
      }
    for (const [i, flip] of flips) if (flip) indices[i].reverse();
    for (const component of components) {
      let volume = 0;
      for (const i of component) {
        const [a, b, c] = indices[i].map((j) => new T.Vector3(...vertices[j]));
        volume += a.dot(b.cross(c)) / 6;
      }
      if (volume < 0) for (const i of component) indices[i].reverse();
    }
    const positions = [],
      colors = [];
    for (let i = 0; i < indices.length; i++)
      for (const j of indices[i]) {
        positions.push(...vertices[j]);
        const c = new T.Color(
          Array.isArray(colours) ? colours[i % colours.length] : colours,
        );
        colors.push(c.r, c.g, c.b);
      }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(g);
  }
  function tube(
    name,
    points,
    radii,
    hex,
    segments = 20,
    sides = 8,
    verticalScale = 1,
  ) {
    const curve = new T.CatmullRomCurve3(
        points.map((p) => new T.Vector3(...p)),
      ),
      v = [],
      f = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments,
        c = curve.getPoint(t),
        dir = curve.getTangent(t).normalize();
      const x = new T.Vector3(1, 0, 0).addScaledVector(dir, -dir.x).normalize(),
        y = new T.Vector3().crossVectors(dir, x).normalize();
      const index = t * (radii.length - 1),
        lo = Math.min(radii.length - 2, Math.floor(index)),
        radius = T.MathUtils.lerp(radii[lo], radii[lo + 1], index - lo);
      for (let j = 0; j < sides; j++) {
        const a = (j / sides) * Math.PI * 2;
        v.push(
          c
            .clone()
            .addScaledVector(x, Math.cos(a) * radius)
            .addScaledVector(y, Math.sin(a) * radius * verticalScale)
            .toArray(),
        );
      }
    }
    for (let i = 0; i < segments; i++)
      for (let j = 0; j < sides; j++) {
        const a = i * sides + j,
          b = i * sides + ((j + 1) % sides),
          c = a + sides,
          d = b + sides;
        f.push([a, b, c], [b, d, c]);
      }
    v.push(curve.getPoint(0).toArray(), curve.getPoint(1).toArray());
    for (let j = 0; j < sides; j++) {
      f.push([v.length - 2, (j + 1) % sides, j]);
      f.push([
        v.length - 1,
        segments * sides + j,
        segments * sides + ((j + 1) % sides),
      ]);
    }
    const cols = f.map((face) => {
      const y = face.reduce((n, j) => n + v[j][1], 0) / 3;
      if (hex === "body")
        return y < -0.16 ? "#d8d6b4" : y > 0.22 ? "#50858c" : "#73a9a8";
      return hex;
    });
    faces(name, v, f, cols);
  }
  // A tapering thorax and lifted neck give a recognisable dragon silhouette, not a flat ray.
  tube(
    "Body",
    [
      [0, 0, -1.05],
      [0, 0.03, -0.55],
      [0, 0.05, 0.12],
      [0, 0.09, 0.63],
      [0, 0.16, 0.98],
    ],
    [0.19, 0.36, 0.46, 0.34, 0.21],
    "body",
    24,
    12,
    0.84,
  );
  tube(
    "Neck",
    [
      [0, 0.16, 0.85],
      [0, 0.2, 1.15],
      [0, 0.36, 1.55],
      [0, 0.49, 1.97],
    ],
    [0.23, 0.2, 0.17, 0.19],
    "body",
    18,
    10,
    1.1,
  );
  ball("Head", [0, 0.55, 2.13], [0.31, 0.24, 0.43], "#77adab", 16, 10);
  ball("Head", [0, 0.475, 2.46], [0.265, 0.155, 0.28], "#9bc0b3", 14, 8);
  ball("Head", [0, 0.391, 2.4], [0.226, 0.065, 0.27], "#dfd6b3", 12, 6);
  for (const side of [-1, 1]) {
    ball("Face", [side * 0.252, 0.618, 2.285], [0.069, 0.09, 0.113], "#e6d9a7");
    ball(
      "Face",
      [side * 0.3, 0.623, 2.318],
      [0.033, 0.066, 0.073],
      "#2e525d",
      10,
      8,
    );
    ball(
      "Face",
      [side * 0.325, 0.643, 2.337],
      [0.013, 0.019, 0.023],
      "#fff4ce",
      8,
      6,
    );
    ball(
      "Face",
      [side * 0.102, 0.509, 2.685],
      [0.023, 0.015, 0.012],
      "#578783",
      8,
      6,
    );
    tube(
      "Face",
      [
        [side * 0.21, 0.425, 2.56],
        [side * 0.245, 0.419, 2.42],
        [side * 0.268, 0.447, 2.31],
      ],
      [0.009, 0.009, 0.004],
      "#4d7d7b",
      12,
      5,
    );
    // Soft swept-back head fins instead of threatening horns.
    const v = [
      [side * 0.13, 0.72, 2.03],
      [side * 0.24, 0.95, 1.74],
      [side * 0.43, 1.04, 1.41],
      [side * 0.31, 0.76, 1.69],
      [side * 0.15, 0.69, 1.89],
    ];
    const back = v.map((p) => [p[0] + side * 0.035, p[1] - 0.018, p[2]]),
      all = [...v, ...back];
    const ff = [
      [0, 1, 3],
      [1, 2, 3],
      [0, 3, 4],
      [5, 8, 6],
      [6, 8, 7],
      [5, 9, 8],
    ];
    for (let j = 0; j < 5; j++)
      ff.push([j, (j + 1) % 5, 5 + j], [(j + 1) % 5, 5 + ((j + 1) % 5), 5 + j]);
    faces("Head_Fins", all, ff, ["#e3c798", "#b8cfb0", "#8fb9ad"]);
    tube(
      "Head_Fins",
      [
        [side * 0.21, 0.72, 1.99],
        [side * 0.28, 0.91, 1.74],
        [side * 0.43, 1.04, 1.41],
      ],
      [0.027, 0.018, 0.004],
      "#547f86",
      16,
      6,
    );
    tube(
      "Face",
      [
        [side * 0.21, 0.45, 2.47],
        [side * 0.38, 0.36, 2.61],
        [side * 0.55, 0.35, 2.48],
        [side * 0.61, 0.39, 2.31],
      ],
      [0.014, 0.011, 0.007, 0.002],
      "#d5bf94",
      20,
      5,
    );
  }
  tube(
    "Tail",
    [
      [0, 0, -0.97],
      [0.09, -0.1, -1.65],
      [0.35, -0.07, -2.4],
      [0.61, 0.07, -3.18],
      [0.66, 0.3, -3.9],
      [0.55, 0.41, -4.31],
    ],
    [0.19, 0.15, 0.115, 0.08, 0.048, 0.008],
    "#6b9b9c",
    42,
    9,
    0.9,
  );
  // A small leaf-like tail rudder, with volume and a raised central vein.
  {
    const top = [
      [0.64, 0.26, -3.77],
      [1.04, 0.31, -4.12],
      [0.9, 0.41, -4.58],
      [0.53, 0.44, -4.42],
      [0.18, 0.41, -4.58],
      [0.24, 0.31, -4.12],
    ];
    const all = [
        ...top,
        ...top.map((p) => [p[0], p[1] - 0.045, p[2]]),
        [0.62, 0.36, -4.17],
        [0.62, 0.315, -4.17],
      ],
      ff = [];
    for (let j = 0; j < 6; j++) {
      const k = (j + 1) % 6;
      ff.push([12, j, k], [13, 6 + k, 6 + j], [j, 6 + j, k], [k, 6 + j, 6 + k]);
    }
    faces("Tail_Rudder", all, ff, ["#d79e8b", "#e4c69f", "#91b8ab"]);
  }
  // Dorsal leaf crest: modest, warm highlights rather than sharp spines.
  for (let i = 0; i < 9; i++) {
    const z = -0.85 + i * 0.29,
      y = z < 0.7 ? 0.36 : 0.43 + (z - 0.7) * 0.2,
      h = 0.12 + Math.sin((i / 8) * Math.PI) * 0.14;
    const v = [
      [-0.026, y, z - 0.11],
      [0, y + h, z - 0.05],
      [0.026, y, z - 0.11],
      [-0.023, y, z + 0.12],
      [0.023, y, z + 0.12],
    ];
    faces(
      "Dorsal_Crest",
      v,
      [
        [0, 1, 2],
        [3, 1, 0],
        [2, 1, 4],
        [4, 1, 3],
        [0, 2, 4],
        [0, 4, 3],
      ],
      ["#d7ba88", "#e5d0a3", "#90b3a4"],
    );
  }
  // Folded hind legs and three little rounded toes read as a calm, gliding wyvern.
  for (const side of [-1, 1]) {
    tube(
      "Folded_Legs",
      [
        [side * 0.28, -0.17, -0.55],
        [side * 0.41, -0.43, -0.77],
        [side * 0.32, -0.5, -0.29],
      ],
      [0.1, 0.075, 0.044],
      "#56858b",
      14,
      8,
    );
    for (let toe = 0; toe < 3; toe++) {
      const x = side * (0.26 + toe * 0.055);
      tube(
        "Folded_Legs",
        [
          [side * 0.32, -0.5, -0.29],
          [x, -0.55, -0.1],
          [x, -0.52, 0.02],
        ],
        [0.027, 0.019, 0.006],
        "#d9c79d",
        10,
        6,
      );
    }
  }
  // Broad, shallow-dihedral wings: opaque closed membranes with scalloped trailing edges.
  const outline = [
    [0.46, 0.29, 0.46],
    [1.22, 0.6, 0.95],
    [2.35, 0.86, 1.11],
    [3.35, 0.98, 0.83],
    [4.65, 0.76, -0.28],
    [3.91, 0.46, -0.39],
    [3.76, 0.46, -1.37],
    [2.99, 0.24, -0.96],
    [2.64, 0.25, -1.83],
    [1.99, 0.08, -1.07],
    [1.45, 0.1, -1.48],
    [0.45, 0.1, -0.65],
  ];
  for (const side of [-1, 1]) {
    const label = side < 0 ? "Left" : "Right",
      vertices = [],
      colors = [],
      hub = new T.Vector3(2.1, 0.55, 0.15),
      n = 5;
    const reflect = (p) => [p.x * side, p.y, p.z];
    // Independent triangular patches retain gentle, hand-authored low-poly membrane facets.
    function triangle(a, b, c, bottom = false) {
      const pts = [a, b, c],
        normal = b.clone().sub(a).cross(c.clone().sub(a));
      if (normal.y < 0 !== bottom) pts.reverse();
      if (side < 0) pts.reverse();
      for (const p of pts) {
        vertices.push(...reflect(p));
        const span = Math.max(0, Math.min(1, (p.x - 0.5) / 4.15));
        const base = new T.Color("#80b7b4").lerp(
          new T.Color("#e3c79f"),
          span * 0.85,
        );
        const warmth = Math.max(0, Math.min(1, (-p.z - 0.1) / 1.4)) * 0.85;
        base.lerp(new T.Color("#d99386"), warmth);
        if (bottom) base.multiplyScalar(0.88);
        colors.push(base.r, base.g, base.b);
      }
    }
    for (let edge = 0; edge < outline.length; edge++) {
      const a = hub,
        b = new T.Vector3(...outline[edge]),
        c = new T.Vector3(...outline[(edge + 1) % outline.length]);
      const point = (i, j, bottom) => {
        const u = i / n,
          v = j / n,
          w = 1 - u - v,
          p = a
            .clone()
            .multiplyScalar(w)
            .addScaledVector(b, u)
            .addScaledVector(c, v);
        p.y +=
          (bottom ? -0.036 : 0.036) +
          0.055 *
            Math.sin(u * Math.PI) *
            Math.sin(v * Math.PI) *
            Math.max(0, w * 3);
        return p;
      };
      for (const bottom of [false, true])
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n - i; j++) {
            triangle(
              point(i, j, bottom),
              point(i + 1, j, bottom),
              point(i, j + 1, bottom),
              bottom,
            );
            if (i + j < n - 1)
              triangle(
                point(i + 1, j, bottom),
                point(i + 1, j + 1, bottom),
                point(i, j + 1, bottom),
                bottom,
              );
          }
      // Close each outer perimeter edge. No double-sided or transparent material tricks.
      for (let i = 0; i < n; i++) {
        const p0 = point(n - i, i, false),
          p1 = point(n - i - 1, i + 1, false),
          p2 = point(n - i, i, true),
          p3 = point(n - i - 1, i + 1, true);
        // Direct vertical side quads have no up/down orientation; outward is away from hub.
        let pts = [p0, p2, p1, p1, p2, p3];
        const norm = p2.clone().sub(p0).cross(p1.clone().sub(p0)),
          out = p0.clone().sub(hub);
        out.y = 0;
        if (norm.dot(out) < 0) pts = [p0, p1, p2, p1, p3, p2];
        if (side < 0) pts = [pts[2], pts[1], pts[0], pts[5], pts[4], pts[3]];
        for (const p of pts) {
          vertices.push(...reflect(p));
          const col = new T.Color("#baac91");
          colors.push(col.r, col.g, col.b);
        }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    groups.set(label + "_Wing_Membrane", [g]);
    const mirror = (pts) => pts.map((p) => [side * p[0], p[1], p[2]]);
    tube(
      label + "_Wing_Frame",
      mirror([
        [0.38, 0.28, 0.48],
        [1.24, 0.64, 0.99],
        [2.34, 0.9, 1.15],
        [3.35, 1.02, 0.87],
        [4.65, 0.8, -0.28],
      ]),
      [0.14, 0.115, 0.085, 0.049, 0.008],
      "#4e7b85",
      36,
      8,
    );
    const roots = [
      [1.15, 0.62, 0.85],
      [2.15, 0.83, 0.89],
      [2.7, 0.92, 0.95],
    ];
    for (const [i, tip] of [outline[10], outline[8], outline[6]].entries()) {
      const r = roots[i];
      tube(
        label + "_Wing_Frame",
        mirror([r, [(r[0] + tip[0]) / 2, 0.4, (r[2] + tip[2]) / 2], tip]),
        [0.04, 0.025, 0.006],
        "#75918b",
        24,
        6,
      );
    }
  }
  const recipe = {
    name: "Aurel sky drake",
    stage: "static model review — not rigged or integrated into the app",
    coordinates: "Three Y-up; Blender conversion (X,-Z,Y)",
    meshes: [],
  };
  for (const [name, parts] of groups) {
    const g = mergeGeometries(parts, false);
    g.setAttribute(
      "color",
      new T.Uint8BufferAttribute(
        Uint8Array.from(g.attributes.color.array, (x) => Math.round(x * 255)),
        3,
        true,
      ),
    );
    const mesh = new T.Mesh(mergeVertices(g, 1e-5), material);
    mesh.name = "SW17_" + name;
    root.add(mesh);
    recipe.meshes.push({
      name,
      positions: Array.from(g.attributes.position.array),
      colors: Array.from(g.attributes.color.array, (v) => v / 255),
    });
    parts.forEach((p) => p.dispose());
    g.dispose();
  }
  return { root, recipe };
}
