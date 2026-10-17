import { describe, expect, it } from "vitest";
import { islandArtFile } from "./island-art";
import { themes } from "./model";

describe("theme-based island artwork", () => {
  it("routes every supported theme, including custom subjects, to its own static asset", () => {
    const files = themes.map(islandArtFile);
    expect(new Set(files).size).toBe(7);
    expect(files).toEqual([
      "island_maths_v2.glb",
      "island_reasoning_v2.glb",
      "island_english_v2.glb",
      "island_gk_v2.glb",
      "island_dsa_v2.glb",
      "island_software_v2.glb",
      "island_generic_v2.glb",
    ]);
  });
});
