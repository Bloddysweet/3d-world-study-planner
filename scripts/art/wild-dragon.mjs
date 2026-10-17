// Cinder, an original ancient black wyvern. No franchise mesh or textures.
// Heavy chest, angular muzzle, swept crown, layered armour and ragged sail wings.
import * as T from "three";

export function createWildDragon() {
  const root = new T.Group(),
    parts = new Map();
  root.name = "Cinder_Original_Wild_Dragon";
  const material = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
  });
  function add(
    name,
    geometry,
    color,
    position = [0, 0, 0],
    scale = [1, 1, 1],
    rotation = [0, 0, 0],
  ) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    g.applyMatrix4(
      new T.Matrix4().compose(
        new T.Vector3(...position),
        new T.Quaternion().setFromEuler(new T.Euler(...rotation)),
        new T.Vector3(...scale),
      ),
    );
    g.deleteAttribute("uv");
    g.clearGroups();
    g.computeVertexNormals();
    const c = new T.Color(color),
      colors = [];
    for (let i = 0; i < g.attributes.position.count; i++)
      colors.push(c.r, c.g, c.b);
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    if (!parts.has(name)) parts.set(name, []);
    parts.get(name).push(g);
  }
  const ball = (name, p, s, c, w = 12, h = 8) =>
    add(name, new T.SphereGeometry(1, w, h), c, p, s);
  function tube(name, points, radii, color, steps = 18, sides = 8) {
    const curve = new T.CatmullRomCurve3(
        points.map((p) => new T.Vector3(...p)),
      ),
      frames = curve.computeFrenetFrames(steps, false),
      v = [],
      idx = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        p = curve.getPoint(t),
        u = t * (radii.length - 1),
        j = Math.min(radii.length - 2, Math.floor(u)),
        r = T.MathUtils.lerp(radii[j], radii[j + 1], u - j);
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        v.push(
          ...p
            .clone()
            .addScaledVector(frames.normals[i], Math.cos(a) * r)
            .addScaledVector(frames.binormals[i], Math.sin(a) * r)
            .toArray(),
        );
      }
    }
    for (let i = 0; i < steps; i++)
      for (let j = 0; j < sides; j++) {
        const a = i * sides + j,
          b = i * sides + ((j + 1) % sides);
        idx.push(a, b, a + sides, b, b + sides, a + sides);
      }
    const first = v.length / 3;
    v.push(...curve.getPoint(0).toArray(), ...curve.getPoint(1).toArray());
    for (let j = 0; j < sides; j++)
      idx.push(
        first,
        (j + 1) % sides,
        j,
        first + 1,
        steps * sides + j,
        steps * sides + ((j + 1) % sides),
      );
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    add(name, g, color);
  }
  function spike(name, base, tip, r, color = "#77716b") {
    const a = new T.Vector3(...base),
      b = new T.Vector3(...tip),
      d = b.clone().sub(a);
    const g = new T.ConeGeometry(r, d.length(), 5, 1);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        d.normalize(),
      ),
    );
    g.translate(...a.add(b).multiplyScalar(0.5).toArray());
    add(name, g, color);
  }
  // Strong silhouette with a low, predatory neck and broad, plated thorax.
  tube(
    "Body",
    [
      [0, -0.02, -1.25],
      [0, 0, -0.7],
      [0, 0.03, 0],
      [0, 0.12, 0.6],
      [0, 0.17, 1.02],
    ],
    [0.25, 0.49, 0.62, 0.51, 0.31],
    "#30343c",
    28,
    12,
  );
  ball("Body", [0, -0.17, 0.03], [0.44, 0.36, 0.88], "#545052");
  tube(
    "Neck",
    [
      [0, 0.16, 0.85],
      [0, 0.18, 1.2],
      [0, 0.27, 1.65],
      [0, 0.39, 2.0],
    ],
    [0.32, 0.28, 0.23, 0.25],
    "#353740",
    20,
    10,
  );
  ball("Head", [0, 0.43, 2.12], [0.38, 0.28, 0.48], "#34343b", 12, 8);
  // Wedge snout and open jaw line, not a round-eyed companion face.
  ball("Head", [0, 0.39, 2.49], [0.3, 0.17, 0.39], "#424047", 10, 6);
  ball("Head", [0, 0.235, 2.5], [0.27, 0.065, 0.36], "#1b1d25", 10, 5);
  ball("Head", [0, 0.18, 2.46], [0.28, 0.08, 0.36], "#53505a", 10, 5);
  for (const s of [-1, 1]) {
    ball(
      "Face",
      [s * 0.31, 0.51, 2.31],
      [0.075, 0.038, 0.075],
      "#b76a22",
      10,
      6,
    );
    ball(
      "Face",
      [s * 0.352, 0.513, 2.337],
      [0.015, 0.025, 0.036],
      "#f5b65a",
      8,
      6,
    );
    ball(
      "Face",
      [s * 0.362, 0.513, 2.346],
      [0.008, 0.022, 0.01],
      "#16151b",
      6,
      4,
    );
    ball("Face", [s * 0.29, 0.565, 2.26], [0.13, 0.068, 0.22], "#252831", 8, 5);
    ball(
      "Face",
      [s * 0.18, 0.467, 2.76],
      [0.043, 0.026, 0.065],
      "#16171d",
      8,
      5,
    );
    for (let i = 0; i < 6; i++)
      spike(
        "Face",
        [s * (0.24 - i * 0.014), 0.29, 2.29 + i * 0.082],
        [s * (0.235 - i * 0.014), 0.205, 2.31 + i * 0.082],
        0.026,
        "#b0a18b",
      );
    // Four swept main horns plus cheek barbs: a broken volcanic crown.
    tube(
      "Head_Fins",
      [
        [s * 0.24, 0.61, 1.97],
        [s * 0.41, 0.8, 1.73],
        [s * 0.47, 0.96, 1.3],
        [s * 0.5, 1.02, 1.12],
      ],
      [0.13, 0.11, 0.055, 0.006],
      "#79716a",
      12,
      6,
    );
    tube(
      "Head_Fins",
      [
        [s * 0.32, 0.49, 1.97],
        [s * 0.57, 0.59, 1.76],
        [s * 0.7, 0.71, 1.48],
      ],
      [0.095, 0.065, 0.005],
      "#5e5e63",
      10,
      6,
    );
    spike(
      "Head_Fins",
      [s * 0.3, 0.32, 2.02],
      [s * 0.62, 0.27, 1.64],
      0.09,
      "#666269",
    );
    for (let i = 0; i < 4; i++)
      spike(
        "Neck",
        [s * 0.19, 0.38 - i * 0.035, 1.76 - i * 0.23],
        [s * 0.38, 0.52 - i * 0.025, 1.57 - i * 0.23],
        0.07,
        "#6a6870",
      );
    // Muscular folded hind legs and three hooked talons.
    ball("Folded_Legs", [s * 0.4, -0.25, -0.67], [0.22, 0.3, 0.34], "#35363f");
    tube(
      "Folded_Legs",
      [
        [s * 0.42, -0.28, -0.6],
        [s * 0.56, -0.55, -0.96],
        [s * 0.46, -0.65, -1.34],
      ],
      [0.16, 0.12, 0.08],
      "#4b4850",
      12,
      7,
    );
    for (let j = 0; j < 3; j++)
      tube(
        "Folded_Legs",
        [
          [s * (0.38 + j * 0.065), -0.64, -1.23],
          [s * (0.37 + j * 0.07), -0.74, -1.4],
          [s * (0.37 + j * 0.07), -0.68, -1.55],
        ],
        [0.045, 0.026, 0.004],
        "#a29988",
        6,
        5,
      );
  }
  tube(
    "Tail",
    [
      [0, 0, -1.02],
      [0.15, -0.09, -1.8],
      [0.35, -0.12, -2.8],
      [0.56, -0.01, -3.75],
      [0.46, 0.18, -4.65],
      [0.22, 0.2, -5.2],
    ],
    [0.27, 0.2, 0.14, 0.09, 0.045, 0.004],
    "#383a43",
    36,
    8,
  );
  const spine = new T.CatmullRomCurve3(
    [
      [0, 0.39, 1.96],
      [0, 0.27, 1.65],
      [0, 0.18, 1.2],
      [0, 0.17, 1.02],
      [0, 0.12, 0.6],
      [0, 0.03, 0],
      [0, 0, -0.7],
      [0, -0.02, -1.25],
      [0.15, -0.09, -1.8],
      [0.35, -0.12, -2.8],
      [0.56, -0.01, -3.75],
      [0.46, 0.18, -4.65],
    ].map((p) => new T.Vector3(...p)),
  );
  const spineRadii = [
    0.25, 0.23, 0.28, 0.31, 0.51, 0.62, 0.49, 0.25, 0.2, 0.14, 0.09, 0.045,
  ];
  for (let i = 0; i < 17; i++) {
    const z = 1.76 - i * 0.36;
    let best = 0,
      error = Infinity;
    for (let j = 0; j <= 240; j++) {
      const e = Math.abs(spine.getPoint(j / 240).z - z);
      if (e < error) {
        error = e;
        best = j / 240;
      }
    }
    const p = spine.getPoint(best),
      u = best * (spineRadii.length - 1),
      k = Math.min(spineRadii.length - 2, Math.floor(u)),
      r = T.MathUtils.lerp(spineRadii[k], spineRadii[k + 1], u - k);
    const y = p.y + r * 0.88;
    spike(
      z < -1 ? "Tail" : "Dorsal_Crest",
      [p.x, y, p.z],
      [p.x, y + (i < 7 ? 0.32 : 0.2), p.z - 0.23],
      i < 7 ? 0.105 : 0.07,
      i % 2 ? "#777077" : "#56545d",
    );
  }
  // Overlapping shoulder/back armour plates, all actual geometry.
  for (let row = 0; row < 7; row++)
    for (let col = -2; col <= 2; col++) {
      const z = 0.7 - row * 0.25,
        x = col * 0.15,
        y = 0.38 + (0.14 - Math.abs(col) * 0.04);
      ball(
        "Body",
        [x, y, z],
        [0.13, 0.055, 0.18],
        (row + col) % 2 ? "#494c56" : "#3b3e48",
        6,
        4,
      );
    }
  for (const s of [-1, 1]) {
    const name = "Wing_" + (s < 0 ? "Left" : "Right"),
      wrist = [s * 3.43, 0.95, 0.38];
    tube(
      name,
      [
        [s * 0.4, 0.28, 0.48],
        [s * 1.45, 0.56, 0.72],
        [s * 2.23, 0.78, 0.83],
        wrist,
      ],
      [0.19, 0.145, 0.12, 0.07],
      "#41434c",
      22,
      8,
    );
    spike(name, wrist, [s * 3.62, 1.23, 0.62], 0.09, "#989080");
    const tips = [
      [s * 5.65, 0.64, 0.75],
      [s * 4.7, 0.37, -0.76],
      [s * 3.6, 0.16, -1.6],
      [s * 2.05, -0.03, -1.75],
      [s * 0.42, -0.1, -0.92],
    ];
    const membraneVertices = [],
      membraneIndices = [];
    // Each closed thin panel has a concave trailing scallop and inset vein ribs.
    for (let i = 0; i < tips.length - 1; i++) {
      const a = new T.Vector3(...tips[i]),
        b = new T.Vector3(...tips[i + 1]),
        w = new T.Vector3(...wrist);
      const edge = [];
      for (let j = 0; j <= 6; j++) {
        const t = j / 6,
          p = a
            .clone()
            .lerp(b, t)
            .lerp(w, 0.2 * Math.sin(Math.PI * t));
        p.y -= 0.1 * Math.sin(Math.PI * t);
        edge.push(p);
      }
      const polygon = [w, ...edge],
        base = membraneVertices.length / 3,
        n = polygon.length;
      for (const dy of [0.014, -0.014])
        for (const p of polygon) membraneVertices.push(p.x, p.y + dy, p.z);
      for (let k = 1; k < n - 1; k++)
        membraneIndices.push(
          base,
          base + k + 1,
          base + k,
          base + n,
          base + n + k,
          base + n + k + 1,
        );
      for (let k = 0; k < n; k++) {
        const j = (k + 1) % n;
        membraneIndices.push(
          base + k,
          base + j,
          base + n + k,
          base + j,
          base + n + j,
          base + n + k,
        );
      }
      tube(
        name,
        [
          wrist,
          w
            .clone()
            .lerp(a, 0.48)
            .add(new T.Vector3(0, 0.035, 0))
            .toArray(),
          a.toArray(),
        ],
        [0.055, 0.035, 0.008],
        "#66606a",
        12,
        5,
      );
      if (i === tips.length - 2)
        tube(name, [wrist, b.toArray()], [0.05, 0.007], "#66606a", 12, 5);
      // Small pointed notches along the sail, without holes or alpha textures.
      for (const j of [1, 3, 5]) {
        const p = edge[j];
        spike(
          name,
          p.toArray(),
          p
            .clone()
            .add(new T.Vector3(s * 0.04, -0.025, -0.12))
            .toArray(),
          0.025,
          "#55505b",
        );
      }
    }
    // Fill the inner sail between shoulder, wrist and flank; no detached wing web.
    const inner = [
        new T.Vector3(...wrist),
        new T.Vector3(s * 0.42, -0.1, -0.92),
        new T.Vector3(s * 0.4, 0.28, 0.48),
        new T.Vector3(s * 2.23, 0.78, 0.83),
      ],
      base = membraneVertices.length / 3,
      n = inner.length;
    for (const dy of [0.014, -0.014])
      for (const p of inner) membraneVertices.push(p.x, p.y + dy, p.z);
    for (let k = 1; k < n - 1; k++)
      membraneIndices.push(
        base,
        base + k + 1,
        base + k,
        base + n,
        base + n + k,
        base + n + k + 1,
      );
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      membraneIndices.push(
        base + k,
        base + j,
        base + n + k,
        base + j,
        base + n + j,
        base + n + k,
      );
    }
    if (s > 0)
      for (let i = 0; i < membraneIndices.length; i += 3)
        [membraneIndices[i + 1], membraneIndices[i + 2]] = [
          membraneIndices[i + 2],
          membraneIndices[i + 1],
        ];
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.Float32BufferAttribute(membraneVertices, 3),
    );
    g.setIndex(membraneIndices);
    add(name, g, "#613e48");
  }
  const meshes = [];
  for (const [name, geometries] of parts) {
    const positions = [],
      colors = [];
    for (const g of geometries) {
      positions.push(...g.attributes.position.array);
      colors.push(...g.attributes.color.array);
      g.dispose();
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new T.Mesh(g, material);
    m.name = name;
    root.add(m);
    meshes.push({ name, positions, colors });
  }
  return { root, recipe: { name: "Cinder, the wild obsidian wyvern", meshes } };
}
