// All landmarks are authored geometry, not labels or baked screenshots.
// They stay behind the six runtime topic plots (whose front edge is z=0.4).
export function buildLandmark(theme, { THREE, add: rawAdd, triangles }) {
  const add = (
    g,
    material,
    hex,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
  ) => rawAdd(g, material, hex, { position, rotation, scale });
  const box = (p, s, material, hex, rotation = [0, 0, 0]) =>
    add(new THREE.BoxGeometry(1, 1, 1), material, hex, p, rotation, s);
  const cylinder = (p, top, bottom, h, material, hex, n = 12) =>
    add(new THREE.CylinderGeometry(top, bottom, h, n, 1), material, hex, p);
  const ico = (p, r, detail, material, hex, scale = [1, 1, 1]) =>
    add(
      new THREE.IcosahedronGeometry(r, detail),
      material,
      hex,
      p,
      [0, 0, 0],
      scale,
    );
  const branch = (from, to, r, top, material, hex, n = 7) => {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to),
      d = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(top, r, d.length(), n, 1);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        d.normalize(),
      ),
    );
    g.translate(...a.add(b).multiplyScalar(0.5).toArray());
    add(g, material, hex);
  };
  const turnPoint = (p, angle, origin) => [
    origin[0] + p[0] * Math.cos(angle) + p[2] * Math.sin(angle),
    origin[1] + p[1],
    origin[2] - p[0] * Math.sin(angle) + p[2] * Math.cos(angle),
  ];
  const plate = (p, w, d, h, hex, angle = 0, material = "stone") =>
    box(p, [w, h, d], material, hex, [0, angle, 0]);
  const torus = (
    p,
    r,
    t,
    hex,
    rotation = [0, 0, 0],
    material = "brass",
    arc = Math.PI * 2,
  ) =>
    add(
      new THREE.TorusGeometry(r, t, 6, theme === "dsa" ? 32 : 48, arc),
      material,
      hex,
      p,
      rotation,
    );
  const base = (r = 1.55) => {
    cylinder([0, 0.3, -1.8], r, r + 0.08, 0.15, "stone", "#c1b69a", 10);
    cylinder([0, 0.4, -1.8], r - 0.15, r - 0.08, 0.09, "stone", "#ded0ad", 10);
  };
  const bench = (x, z, angle = 0) => {
    const origin = [x, 0.24, z];
    const part = (p, s, hex) =>
      box(turnPoint(p, angle, origin), s, "timber", hex, [0, angle, 0]);
    for (const dx of [-0.4, 0.4])
      part([dx, 0.22, 0], [0.1, 0.44, 0.44], "#806343");
    part([0, 0.47, 0], [1.12, 0.13, 0.48], "#bd9567");
    part([0, 0.76, -0.2], [1.12, 0.29, 0.09], "#a98158");
  };
  if (theme === "reasoning") {
    base(1.65);
    // A miniature hedge maze frames the three turning, inlaid logic cubes.
    const hedges = [
      [-1.42, -2.2, 0.16, 1.3],
      [1.42, -2.2, 0.16, 1.3],
      [0, -2.85, 2.95, 0.16],
      [-1.08, -0.72, 0.8, 0.16],
      [1.08, -0.72, 0.8, 0.16],
      [-0.9, -1.75, 0.85, 0.14],
      [0.96, -1.3, 0.75, 0.14],
      [-0.55, -1.42, 0.14, 0.7],
      [0.65, -2.25, 0.14, 0.65],
    ];
    for (const [x, z, w, d] of hedges)
      plate([x, 0.59, z], w, d, 0.28, "#758867", 0, "leaves");
    const cubes = [
      { p: [-0.16, 1.02, -1.88], a: -0.13, c: "#b8a8cf", edge: "#e0d4e9" },
      { p: [0.12, 1.94, -1.85], a: 0.16, c: "#91aeba", edge: "#d4e2df" },
      { p: [-0.07, 2.86, -1.83], a: -0.12, c: "#bba5c8", edge: "#e7d8e6" },
    ];
    for (const { p, a, c, edge } of cubes) {
      box(p, [1.03, 0.94, 1.03], "crystal", c, [0, a, 0]);
      // Real geometric face joints; no font, decal or material texture.
      for (const cut of [-0.17, 0.17]) {
        plate(
          turnPoint([cut, 0, 0.523], a, p),
          0.019,
          0.014,
          0.86,
          edge,
          a,
          "stone",
        );
        plate(
          turnPoint([0, cut, 0.523], a, p),
          0.91,
          0.014,
          0.019,
          edge,
          a,
          "stone",
        );
        plate(
          turnPoint([cut, 0.478, 0], a, p),
          0.018,
          0.91,
          0.012,
          edge,
          a,
          "stone",
        );
        plate(
          turnPoint([0, 0.478, cut], a, p),
          0.91,
          0.018,
          0.012,
          edge,
          a,
          "stone",
        );
      }
      ico(turnPoint([0, 0, 0.55], a, p), 0.085, 0, "brass", "#dbb96e");
    }
    for (const [x, z, s] of [
      [-2.8, -1.15, 0.25],
      [2.65, -1.6, 0.31],
      [-2.2, -3.2, 0.2],
    ]) {
      box(
        [x, 0.24 + s * 0.6, z],
        [s, s * 1.6, s],
        "crystal",
        "#c7b4d5",
        [0.12, 0.3, 0.1],
      );
    }
  } else if (theme === "english") {
    base(1.65);
    const book = (p, w, d, h, a, cover) => {
      const part = (v, s, mat, hex) =>
        box(turnPoint(v, a, p), s, mat, hex, [0, a, 0]);
      part([0, 0, 0], [w - 0.09, h - 0.07, d - 0.04], "stone", "#e6dbbf");
      for (const dy of [-h / 2, h / 2])
        part([0, dy, 0], [w, 0.055, d + 0.035], "timber", cover);
      part([-w / 2 + 0.02, 0, 0], [0.075, h, d], "timber", cover);
      for (const dy of [-h * 0.21, h * 0.13])
        part(
          [0.02, dy, d / 2 - 0.015],
          [w - 0.12, 0.009, 0.013],
          "stone",
          "#c1b394",
        );
      for (const z of [-d * 0.31, d * 0.31])
        part(
          [-w / 2 - 0.021, 0, z],
          [0.018, h * 0.65, 0.028],
          "brass",
          "#c9af76",
        );
    };
    book([0, 0.69, -1.85], 2.65, 1.42, 0.35, -0.08, "#8e696b");
    book([-0.1, 1.12, -1.85], 2.4, 1.35, 0.38, 0.1, "#a68d53");
    book([0.08, 1.55, -1.87], 2.45, 1.36, 0.36, -0.12, "#658e8a");
    book([-0.04, 1.95, -1.87], 2.2, 1.3, 0.31, 0.06, "#777c99");
    // An open, folded page volume on top, including side and end faces.
    for (const side of [-1, 1]) {
      const x = side * 1.23,
        z = -1.86,
        centreY = 2.22,
        edgeY = 2.52;
      const v = [
        [0, centreY, z - 0.65],
        [x, edgeY, z - 0.65],
        [x, edgeY, z + 0.65],
        [0, centreY, z + 0.65],
        [0, centreY - 0.1, z - 0.65],
        [x, edgeY - 0.1, z - 0.65],
        [x, edgeY - 0.1, z + 0.65],
        [0, centreY - 0.1, z + 0.65],
      ];
      const faces =
        side === 1
          ? [
              [0, 2, 1],
              [0, 3, 2],
              [4, 5, 6],
              [4, 6, 7],
              [0, 1, 5],
              [0, 5, 4],
              [1, 2, 6],
              [1, 6, 5],
              [2, 3, 7],
              [2, 7, 6],
            ]
          : [
              [0, 1, 2],
              [0, 2, 3],
              [4, 6, 5],
              [4, 7, 6],
              [0, 5, 1],
              [0, 4, 5],
              [1, 6, 2],
              [1, 5, 6],
              [2, 7, 3],
              [2, 6, 7],
            ];
      triangles(v, faces, "stone", "#f1e5c8");
      for (const depth of [-0.35, -0.1, 0.15, 0.4]) {
        const start = [side * 0.22, centreY + 0.06, z + depth],
          end = [side * 1.03, edgeY - 0.035, z + depth];
        branch(start, end, 0.008, 0.008, "roots", "#bdb18e", 4);
      }
    }
    box([0, 2.24, -1.79], [0.075, 0.025, 1.38], "flowers", "#aa6768");
    box([0, 2.11, -1.1], [0.075, 0.26, 0.025], "flowers", "#aa6768");
    // A reading lamp and quiet bench belong to this garden, not task state.
    cylinder([1.7, 0.51, -2.25], 0.29, 0.33, 0.12, "brass", "#a59460", 12);
    branch(
      [1.7, 0.54, -2.25],
      [1.7, 2.88, -2.25],
      0.035,
      0.03,
      "brass",
      "#bda570",
      8,
    );
    branch(
      [1.7, 2.88, -2.25],
      [1.1, 3.12, -1.95],
      0.03,
      0.026,
      "brass",
      "#bda570",
      8,
    );
    cylinder([1.1, 2.99, -1.95], 0.16, 0.36, 0.27, "brass", "#c6ae73", 12);
    cylinder([1.1, 2.85, -1.95], 0.24, 0.24, 0.015, "stone", "#f4dfaa", 12);
    bench(-2.22, -1.05, -0.22);
  } else if (theme === "gk") {
    base(1.6);
    cylinder([0, 0.65, -1.8], 0.71, 0.9, 0.39, "stone", "#b4b9a5", 12);
    cylinder([0, 0.99, -1.8], 0.24, 0.42, 0.32, "brass", "#c0aa71", 12);
    const centre = [0, 2.28, -1.8],
      radius = 1.075,
      tilt = 0.24;
    add(
      new THREE.SphereGeometry(radius, 24, 14),
      "crystal",
      "#669fa6",
      centre,
      [0, 0, tilt],
    );
    // Simplified continent silhouettes in lat/lon, authored for a decorative globe.
    const continents = [
      [
        [-17, 36],
        [10, 38],
        [36, 30],
        [50, 11],
        [39, -12],
        [26, -35],
        [12, -30],
        [-1, -1],
        [-17, 17],
      ],
      [
        [-10, 36],
        [-9, 58],
        [21, 71],
        [48, 63],
        [57, 44],
        [39, 35],
        [25, 38],
      ],
      [
        [35, 42],
        [52, 66],
        [106, 76],
        [174, 62],
        [162, 49],
        [132, 34],
        [122, 13],
        [105, -5],
        [94, 5],
        [76, 8],
        [64, 28],
      ],
      [
        [112, -12],
        [139, -10],
        [154, -26],
        [145, -39],
        [116, -33],
      ],
      [
        [-168, 70],
        [-134, 72],
        [-109, 61],
        [-61, 58],
        [-54, 43],
        [-82, 24],
        [-98, 16],
        [-108, 29],
        [-127, 49],
        [-160, 58],
      ],
      [
        [-80, 12],
        [-49, 5],
        [-35, -9],
        [-51, -28],
        [-67, -55],
        [-76, -32],
      ],
      [
        [-52, 60],
        [-23, 69],
        [-35, 83],
        [-59, 79],
      ],
      [
        [44, -13],
        [50, -16],
        [49, -26],
        [44, -24],
      ],
    ];
    const inside = (x, y, p) => {
      let hit = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const a = p[i],
          b = p[j];
        if (
          a[1] > y !== b[1] > y &&
          x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
        )
          hit = !hit;
      }
      return hit;
    };
    const point = (lon, lat) => {
      const a = THREE.MathUtils.degToRad(lon + 25),
        b = THREE.MathUtils.degToRad(lat),
        r = radius + 0.012;
      const x = r * Math.cos(b) * Math.sin(a),
        y = r * Math.sin(b),
        z = r * Math.cos(b) * Math.cos(a);
      return [
        centre[0] + x * Math.cos(tilt) - y * Math.sin(tilt),
        centre[1] + x * Math.sin(tilt) + y * Math.cos(tilt),
        centre[2] + z,
      ];
    };
    for (let lat = -55; lat < 85; lat += 5)
      for (let lon = -180; lon < 180; lon += 5) {
        if (!continents.some((p) => inside(lon + 2.5, lat + 2.5, p))) continue;
        triangles(
          [
            point(lon, lat),
            point(lon + 5, lat),
            point(lon + 5, lat + 5),
            point(lon, lat + 5),
          ],
          [
            [0, 1, 2],
            [0, 2, 3],
          ],
          "leaves",
          lat > 40 ? "#b5c29a" : "#a6b782",
        );
      }
    torus(centre, 1.29, 0.035, "#ccb47b", [0, 0, tilt]);
    torus(centre, 1.085, 0.012, "#d0c19b", [Math.PI / 2, 0, tilt]);
    for (const y of [centre[1] - 1.25, centre[1] + 1.25])
      ico([0, y, -1.8], 0.095, 0, "brass", "#ccb47b");
    // An eight-point compass inset on its own small rear-side terrace.
    cylinder([1.95, 0.31, -0.65], 0.51, 0.54, 0.12, "stone", "#d1c7a8", 12);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        r = i % 2 ? 0.31 : 0.43;
      const p = [1.95, 0.377, -0.65];
      triangles(
        [
          p,
          [p[0] + Math.sin(a) * r, p[1], p[2] + Math.cos(a) * r],
          [
            p[0] + Math.sin(a + 0.22) * 0.15,
            p[1],
            p[2] + Math.cos(a + 0.22) * 0.15,
          ],
        ],
        [
          [0, 1, 2],
          [2, 1, 0],
        ],
        "brass",
        i % 2 ? "#a99365" : "#7f968c",
      );
    }
  } else if (theme === "dsa") {
    base(1.62);
    cylinder([0, 0.59, -1.8], 0.55, 0.7, 0.32, "roots", "#947d56", 10);
    const nodes = [
      [0, 1.03, -1.8],
      [-0.78, 2.0, -1.8],
      [0.78, 2.0, -1.8],
      [-1.43, 3.04, -1.8],
      [-0.49, 3.04, -1.8],
      [0.49, 3.04, -1.8],
      [1.43, 3.04, -1.8],
    ];
    const edges = [
      [0, 1],
      [0, 2],
      [1, 3],
      [1, 4],
      [2, 5],
      [2, 6],
    ];
    for (const [a, b] of edges)
      branch(nodes[a], nodes[b], 0.067, 0.057, "brass", "#b6a270", 8);
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i],
        r = i === 0 ? 0.36 : 0.3;
      ico(p, r, 1, "crystal", i % 2 ? "#7da98e" : "#a4bd90", [1, 1, 1]);
      torus([p[0], p[1], p[2] + r * 0.74], r * 0.68, 0.018, "#d3c394");
      ico([p[0], p[1], p[2] + r * 0.96], 0.055, 0, "stone", "#dce0b7");
    }
    for (let i = 0; i < 5; i++) {
      const x = -1.13 + i * 0.56;
      plate(
        [x, 0.52, -0.8],
        0.39,
        0.36,
        0.14,
        i % 2 ? "#b3bea0" : "#9eac8d",
        0,
        "stone",
      );
    }
  } else if (theme === "software") {
    // Open-air code workbench: screen, solid geometric </>, keyboard and side studio.
    plate([0, 0.36, -1.65], 3.25, 2.05, 0.22, "#c0b69f");
    for (const x of [-1.11, 1.11])
      box([x, 0.76, -1.28], [0.13, 0.63, 0.14], "timber", "#977b62");
    box([0, 1.94, -1.6], [2.91, 1.89, 0.2], "timber", "#c49178");
    box([0, 1.94, -1.487], [2.65, 1.63, 0.034], "stone", "#405f65");
    const ink = "#c4d8b7",
      front = -1.458;
    const stroke = (a, b) =>
      branch(
        [a[0], a[1], front],
        [b[0], b[1], front],
        0.037,
        0.037,
        "flowers",
        ink,
        6,
      );
    stroke([-0.64, 2.34], [-0.95, 2.04]);
    stroke([-0.95, 2.04], [-0.64, 1.74]);
    stroke([0.65, 2.34], [0.96, 2.04]);
    stroke([0.96, 2.04], [0.65, 1.74]);
    stroke([0.18, 2.39], [-0.17, 1.69]);
    for (let i = 0; i < 3; i++)
      box(
        [-0.32 + i * 0.35, 1.37, front],
        [0.26, 0.028, 0.025],
        "flowers",
        i === 0 ? "#dfb895" : "#9ebfba",
      );
    box([0, 1.01, -0.87], [2.9, 0.12, 0.72], "timber", "#b4a185");
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 9; col++)
        box(
          [-0.91 + col * 0.225, 1.086, -1.08 + row * 0.17],
          [0.15, 0.035, 0.105],
          "stone",
          col % 3 ? "#dfd2b9" : "#c0bfa7",
        );
    box([0, 1.086, -0.51], [0.9, 0.035, 0.08], "stone", "#dfd2b9");
    const p = [2.12, 0.24, -2.3];
    box([p[0], p[1] + 0.7, p[2]], [1.14, 1.4, 1.18], "stone", "#dcc9ad");
    const y = p[1] + 1.45,
      w = 0.72,
      d = 0.74;
    const v = [
      [p[0] - w, y, p[2] - d],
      [p[0] + w, y, p[2] - d],
      [p[0] + w, y, p[2] + d],
      [p[0] - w, y, p[2] + d],
      [p[0], y + 0.55, p[2] - d],
      [p[0], y + 0.55, p[2] + d],
    ];
    triangles(
      v,
      [
        [0, 4, 5],
        [0, 5, 3],
        [4, 1, 2],
        [4, 2, 5],
        [0, 1, 4],
        [3, 5, 2],
        [0, 3, 2],
        [0, 2, 1],
      ].map((f) => f.reverse()),
      "timber",
      "#aa7863",
    );
    box(
      [p[0] - 0.13, 0.76, p[2] + 0.598],
      [0.4, 0.82, 0.035],
      "timber",
      "#8c8e7a",
    );
    box(
      [p[0] + 0.36, 1.18, p[2] + 0.61],
      [0.25, 0.35, 0.035],
      "crystal",
      "#a7c5c1",
    );
    box([p[0] - 0.13, 0.3, p[2] + 0.8], [0.6, 0.12, 0.35], "stone", "#c8bfa6");
  } else if (theme === "generic") {
    base(1.54);
    // A seedling monument, deliberately independent of earned topic progress.
    cylinder([0, 0.77, -1.8], 0.61, 0.47, 0.65, "stone", "#bdbea3", 12);
    cylinder([0, 1.13, -1.8], 0.69, 0.63, 0.13, "stone", "#dfd2b0", 12);
    cylinder([0, 1.19, -1.8], 0.58, 0.58, 0.025, "roots", "#8f7d5e", 12);
    branch(
      [0, 1.19, -1.8],
      [0.12, 2.12, -1.8],
      0.1,
      0.07,
      "roots",
      "#8c9a64",
      8,
    );
    branch(
      [0.12, 2.12, -1.8],
      [0, 2.89, -1.8],
      0.07,
      0.035,
      "roots",
      "#8c9a64",
      8,
    );
    branch(
      [0.08, 2.22, -1.8],
      [-0.61, 2.6, -1.8],
      0.055,
      0.035,
      "roots",
      "#8c9a64",
      8,
    );
    branch(
      [0.06, 2.68, -1.8],
      [0.64, 3.01, -1.8],
      0.05,
      0.03,
      "roots",
      "#8c9a64",
      8,
    );
    add(
      new THREE.IcosahedronGeometry(1, 1),
      "leaves",
      "#a3ba78",
      [-0.62, 2.65, -1.8],
      [0, 0, -0.45],
      [0.76, 0.28, 0.46],
    );
    add(
      new THREE.IcosahedronGeometry(1, 1),
      "leaves",
      "#bed094",
      [0.67, 3.08, -1.8],
      [0, 0, 0.48],
      [0.77, 0.3, 0.46],
    );
    branch(
      [-0.11, 2.67, -1.37],
      [-1.12, 2.9, -1.37],
      0.014,
      0.009,
      "roots",
      "#d1d9a8",
      5,
    );
    branch(
      [0.12, 2.85, -1.38],
      [1.15, 3.31, -1.38],
      0.014,
      0.009,
      "roots",
      "#e0e5ba",
      5,
    );
    // A light, planted arbor silhouette behind the seedling.
    torus(
      [0, 1.82, -2.27],
      1.46,
      0.055,
      "#b29e73",
      [0, 0, 0],
      "timber",
      Math.PI,
    );
    for (const x of [-1.46, 1.46])
      branch(
        [x, 0.44, -2.27],
        [x, 1.82, -2.27],
        0.065,
        0.055,
        "timber",
        "#a69066",
        8,
      );
    for (const [x, y] of [
      [-1.27, 2.53],
      [-0.88, 2.99],
      [1.27, 2.53],
      [0.88, 2.99],
    ])
      ico([x, y, -2.27], 0.19, 0, "leaves", "#97aa72", [1, 0.65, 0.75]);
    bench(2.0, -1.1, 0.18);
  }
}
