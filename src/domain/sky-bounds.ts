import { Box3, Matrix4, Vector3 } from "three";
import type { Camera, SkinnedMesh } from "three";
import type { SkyRect } from "./sky-flight";

/** Non-negative normalized skin weights keep each vertex in the convex hull of
 * its influencing bones' transformed bind-space boxes. These 16 tiny boxes are
 * conservative under animation, without projecting a giant whole-body cube or
 * CPU-skinning the complete mesh on every frame. */
export function skyBoneBounds(mesh: SkinnedMesh): Box3[] {
  const boxes = mesh.skeleton.bones.map(() => new Box3());
  const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
  const point = new Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    for (let j = 0; j < 4; j++)
      if (skinWeight.getComponent(i, j) > 0)
        boxes[skinIndex.getComponent(i, j)].expandByPoint(point);
  }
  return boxes;
}
export function skyBoundsScratch() {
  return { skin: new Matrix4(), point: new Vector3() };
}
export function projectSkyBones(
  mesh: SkinnedMesh,
  boxes: Box3[],
  camera: Camera,
  width: number,
  height: number,
  scratch: ReturnType<typeof skyBoundsScratch>,
): SkyRect | null {
  const rect = {
    left: Infinity,
    top: Infinity,
    right: -Infinity,
    bottom: -Infinity,
  };
  let valid = false;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (box.isEmpty()) continue;
    scratch.skin
      .copy(mesh.matrixWorld)
      .multiply(mesh.bindMatrixInverse)
      .multiply(mesh.skeleton.bones[i].matrixWorld)
      .multiply(mesh.skeleton.boneInverses[i])
      .multiply(mesh.bindMatrix);
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const p = scratch.point
            .set(x, y, z)
            .applyMatrix4(scratch.skin)
            .project(camera);
          if (p.z < -1 || p.z > 1) continue;
          valid = true;
          const px = ((p.x + 1) * width) / 2,
            py = ((1 - p.y) * height) / 2;
          rect.left = Math.min(rect.left, px);
          rect.right = Math.max(rect.right, px);
          rect.top = Math.min(rect.top, py);
          rect.bottom = Math.max(rect.bottom, py);
        }
  }
  return valid ? rect : null;
}

/** Closed details can expose non-zero descendant layout rectangles even though
 * the browser does not paint them. They must not reserve a fictional sky area. */
export function isPaintedSkyOverlay(node: HTMLElement): boolean {
  const closed = node.closest("details:not([open])");
  if (closed) {
    const summary = closed.querySelector(":scope > summary");
    if (!summary?.contains(node)) return false;
  }
  const style = getComputedStyle(node);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse" ||
    Number(style.opacity) === 0
  )
    return false;
  if (
    typeof node.checkVisibility === "function" &&
    !node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  )
    return false;
  return node.getClientRects().length > 0;
}
