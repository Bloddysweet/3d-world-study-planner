import type { Subject } from "./model";
import type { Position3 } from "./world";

// Decorative presentation only. Nothing here reads or writes study evidence.
export const VILLAGER_VARIANTS = ["scout", "reader", "gardener"] as const;
export type VillagerVariant = (typeof VILLAGER_VARIANTS)[number];
export type VillagerActivity = "Walk" | "Idle" | "LookAround" | "Study";
export const VILLAGER_LANES = [0.16, 1.95] as const;
export const VILLAGER_GROUND = 0.305;
export const VILLAGER_FPS = { desktop: 30, compact: 24 } as const;
export function villagerSeed(id: string) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++)
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return hash >>> 0;
}
export interface VillagerSite {
  id: string;
  variant: VillagerVariant;
  position: Position3;
  lane: number;
  phase: number;
}
export function villagerSites(
  subjects: Subject[],
  positions: Position3[],
  selectedId: string | null | undefined,
  compact: boolean,
): VillagerSite[] {
  const focused = subjects.findIndex((s) => s.id === selectedId);
  const indices =
    focused >= 0
      ? [focused]
      : subjects.slice(0, compact ? 1 : 3).map((_, i) => i);
  return indices.flatMap((i) => {
    const seed = villagerSeed(subjects[i].id);
    return Array.from(
      { length: focused >= 0 && !compact ? 2 : 1 },
      (_, slot) => ({
        id: `${subjects[i].id}-villager-${slot}`,
        variant: VILLAGER_VARIANTS[(seed + slot) % 3],
        position: positions[i],
        lane: focused >= 0 && !compact ? slot : 1,
        phase: (((seed % 997) / 997) * 42 + slot * 17) % 42,
      }),
    );
  });
}
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Two safe flagstone corridors. Never walk through plots, landmarks, stream or bridges.
 * Slow cosine acceleration at both ends, a look/read pause, then a turn in place.
 * Input is an accumulated visible simulation clock, never Date.now or study data.
 */
export function sampleVillager(seconds: number, lane = 1, phase = 0) {
  const walk = 15,
    rest = 6,
    cycle = 42;
  const t = (((Math.max(0, seconds) + phase) % cycle) + cycle) % cycle;
  const returning = t >= walk + rest;
  const local = returning ? t - walk - rest : t;
  const direction = returning ? -1 : 1;
  const start = returning ? 2.55 : -2.55;
  if (local < walk) {
    const fraction = local / walk;
    return {
      x: start + direction * 5.1 * (0.5 - 0.5 * Math.cos(Math.PI * fraction)),
      z: VILLAGER_LANES[lane === 0 ? 0 : 1],
      yaw: (direction * Math.PI) / 2,
      state: "Walk" as VillagerActivity,
      speed: ((5.1 * Math.PI) / (2 * walk)) * Math.sin(Math.PI * fraction),
    };
  }
  const paused = local - walk;
  const turn = smooth(Math.max(0, Math.min(1, (paused - 4.8) / 1.2)));
  return {
    x: -start,
    z: VILLAGER_LANES[lane === 0 ? 0 : 1],
    yaw: (direction * Math.PI) / 2 - direction * Math.PI * turn,
    state: (paused < 2 || paused >= 4.8
      ? "LookAround"
      : "Study") as VillagerActivity,
    speed: 0,
  };
}
