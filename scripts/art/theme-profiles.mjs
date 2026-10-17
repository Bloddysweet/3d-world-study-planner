// Authoring configuration only. Runtime routing lives in src/domain/island-art.ts.
export const profiles = {
  maths: {
    label: "Mathematics",
    seed: 84.73,
    depth: 1,
    phase: 0,
    bark: null,
    canopy: null,
  },
  reasoning: {
    label: "Reasoning",
    seed: 117.42,
    depth: 0.92,
    phase: 0.4,
    canopy: ["#879e74", "#b3a0bd", "#8d9e72"],
    meadow: ["#99ab79", "#9eaf7d", "#96a777", "#a2b382"],
    cliff: [
      "#9c929f",
      "#8c818e",
      "#b0a3af",
      "#807c8d",
      "#ac9ba4",
      "#8e8494",
      "#b9acb8",
      "#a799aa",
    ],
    flower: ["#d1b9e0", "#f3dcb5", "#bcafda"],
  },
  english: {
    label: "English & Vocabulary",
    seed: 164.26,
    depth: 0.83,
    phase: 1.15,
    bark: "#aaa08d",
    canopy: ["#c0ab72", "#c8b681", "#a6a16c"],
    meadow: ["#a5ae78", "#aeb682", "#a4ad76", "#b0b986"],
    cliff: [
      "#b79c7e",
      "#a48c78",
      "#c5ae8f",
      "#a39482",
      "#be9b75",
      "#9d8876",
      "#c9b49b",
      "#baa187",
    ],
    flower: ["#ecd5a1", "#d5a5a0", "#bfc9d7"],
  },
  gk: {
    label: "General Knowledge",
    seed: 217.88,
    depth: 1.02,
    phase: 2,
    canopy: ["#77a77f", "#9cbf95", "#689a7a"],
    meadow: ["#83aa7a", "#8eb785", "#81a978", "#96bb8e"],
    cliff: [
      "#a6a99c",
      "#939d94",
      "#bab9a6",
      "#88978f",
      "#b3b29c",
      "#8d9d93",
      "#c2c4b3",
      "#a3ad9e",
    ],
    flower: ["#efd99b", "#b8d4d2", "#edc0ac"],
  },
  dsa: {
    label: "Data Structures & Algorithms",
    seed: 288.65,
    depth: 1.06,
    phase: 2.7,
    conifers: true,
    canopy: ["#496f59", "#5e8765", "#779b75"],
    meadow: ["#7b9c68", "#85a573", "#7c9e68", "#8ba779"],
    cliff: [
      "#8a9380",
      "#7c8979",
      "#a0a38a",
      "#728375",
      "#9a9d81",
      "#788775",
      "#aeb19a",
      "#8f9b86",
    ],
    flower: ["#d8dfb0", "#b6cad4", "#dbbd9f"],
  },
  software: {
    label: "Software Development",
    seed: 349.71,
    depth: 0.88,
    phase: 3.8,
    canopy: ["#7f9c88", "#98afa0", "#698779"],
    meadow: ["#91aa89", "#9bb493", "#8ca483", "#a0b697"],
    cliff: [
      "#b29383",
      "#a0867d",
      "#c2a38c",
      "#8c8586",
      "#bd937d",
      "#978279",
      "#c9b09a",
      "#ae9487",
    ],
    flower: ["#edb69c", "#c3d5cf", "#e6d2b5"],
  },
  generic: {
    label: "Custom subject · learning grove",
    seed: 418.53,
    depth: 0.97,
    phase: 4.5,
    canopy: ["#87a76a", "#adbf89", "#76975f"],
    meadow: ["#94ac70", "#9ab578", "#91a76c", "#a0b97f"],
    cliff: [
      "#a5957e",
      "#928773",
      "#b4a88d",
      "#898779",
      "#ad9777",
      "#8b8470",
      "#bfb49b",
      "#a69d86",
    ],
    flower: ["#eadca8", "#c4cadb", "#e6b6b0"],
  },
};

const original = {
  meadow: ["#91a962", "#96ad66", "#93ab63", "#98ad67"],
  cliff: [
    "#a68b76",
    "#9b8175",
    "#b69b7e",
    "#827b79",
    "#ba9673",
    "#8b7a72",
    "#a79385",
    "#c0a082",
  ],
  canopy: ["#84a659", "#a3b974", "#718f4f"],
  flower: ["#f1dfab", "#b9c7dc", "#e1b497"],
};
export function colourMap(profile) {
  const result = {};
  for (const name of Object.keys(original))
    if (profile[name])
      original[name].forEach((hex, i) => (result[hex] = profile[name][i]));
  if (profile.bark) {
    result["#886443"] = profile.bark;
    result["#98704b"] = profile.bark;
  }
  return result;
}
