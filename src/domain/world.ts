// Pure presentation helpers. These never change study progress or schedules.
export type Position3 = [number, number, number];
export const ISLANDS_PER_GROUP = 12;
export const TOPICS_PER_GARDEN = 6;
export function islandRadius(count: number) {
  const outer = count - 1;
  return outer > 1 ? Math.max(12, 12 / (2 * Math.sin(Math.PI / outer))) : 12;
}
export function islandPositions(count: number): Position3[] {
  const outer = count - 1,
    radius = islandRadius(count);
  return Array.from({ length: Math.max(0, count) }, (_, i) =>
    i === 0
      ? [0, 0, 0]
      : [
          Math.cos(((i - 1) / Math.max(1, outer)) * Math.PI * 2 - 0.7) * radius,
          0,
          Math.sin(((i - 1) / Math.max(1, outer)) * Math.PI * 2 - 0.7) * radius,
        ],
  );
}
export const MIN_CAMERA_DISTANCE = 4.5;
export const MAX_CAMERA_DISTANCE = 200;
/** Initial framing only; wheel, pinch and buttons dolly from the current camera pose. */
export function cameraDistance(
  width: number,
  height: number,
  count: number,
  focused: boolean,
) {
  const extent = focused ? 6 : count > 1 ? islandRadius(count) + 5 : 7;
  const aspect = Math.max(1, width) / Math.max(1, height);
  // Portrait screens need some extra distance, but the raw 1/aspect a tall
  // phone produces (~2.2x) shrinks the islands into a smudge. Clamp it.
  const portrait = Math.min(1.35, Math.max(1, 1 / Math.min(1, aspect)));
  return Math.min(
    190,
    (extent / Math.tan((21 * Math.PI) / 180)) * portrait * 1.18,
  );
}
/** Zoom is relative to the fitted view, not a fixed far-away camera distance. */
export function cameraLimits(
  width: number,
  height: number,
  count: number,
  focused: boolean,
) {
  const fitted = cameraDistance(width, height, count, focused);
  return {
    min: Math.max(MIN_CAMERA_DISTANCE, fitted * 0.25),
    max: Math.min(MAX_CAMERA_DISTANCE, fitted * 1.12),
  };
}
/** Same central 60% rectangle as the visual gesture boundary and touch edges. */
export function inZoomArea(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return (
    width > 0 &&
    height > 0 &&
    x >= width * 0.2 &&
    x <= width * 0.8 &&
    y >= height * 0.2 &&
    y <= height * 0.8
  );
}
export function gardenPositions(count: number): Position3[] {
  return Array.from(
    { length: Math.min(TOPICS_PER_GARDEN, Math.max(0, count)) },
    (_, i) => [((i % 3) - 1) * 2.35, 0.24, 1 + Math.floor(i / 3) * 1.9],
  );
}
export function groupForSubject(ids: string[], selectedId?: string | null) {
  const index = selectedId ? ids.indexOf(selectedId) : -1;
  return index < 0 ? null : Math.floor(index / ISLANDS_PER_GROUP);
}
export interface ScreenLabel {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Keep projected topic/island labels apart and away from the camera controls. */
export function layoutLabels(
  anchors: ScreenLabel[],
  width: number,
  height: number,
): ScreenLabel[] {
  const placed: ScreenLabel[] = [];
  for (const anchor of anchors) {
    const x = Math.max(
      anchor.width / 2 + 6,
      Math.min(width - anchor.width / 2 - 6, anchor.x),
    );
    let chosen: ScreenLabel | undefined;
    for (const offset of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6]) {
      const y = Math.max(
        anchor.height / 2 + 8,
        Math.min(
          height - 85 - anchor.height / 2,
          anchor.y + offset * (anchor.height + 5),
        ),
      );
      const candidate = { ...anchor, x, y };
      if (
        !placed.some(
          (other) =>
            Math.abs(other.x - x) < (other.width + anchor.width) / 2 + 3 &&
            Math.abs(other.y - y) < (other.height + anchor.height) / 2 + 3,
        )
      ) {
        chosen = candidate;
        break;
      }
    }
    placed.push(
      chosen ?? {
        ...anchor,
        x,
        y: Math.max(
          anchor.height / 2 + 8,
          Math.min(height - 85 - anchor.height / 2, anchor.y),
        ),
      },
    );
  }
  return placed;
}
