import type { Subject } from "./model";

// Subject identity is deliberately unrelated to artwork. New/custom subjects can
// share any supported theme without a fixed six-subject cap or baked topic state.
export function islandArtFile(theme: Subject["theme"]): string {
  return `island_${theme}_v2.glb`;
}
