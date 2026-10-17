import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Bone,
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  MeshBasicMaterial,
  PerspectiveCamera,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from "three";
import {
  isPaintedSkyOverlay,
  projectSkyBones,
  skyBoneBounds,
  skyBoundsScratch,
} from "./sky-bounds";

afterEach(() => vi.unstubAllGlobals());

describe("painted sky obstacles", () => {
  function overlay({
    closed = false,
    summary = false,
    painted = true,
    rects = 1,
    style = {},
  } = {}) {
    vi.stubGlobal("getComputedStyle", () => ({
      display: "block",
      visibility: "visible",
      opacity: "1",
      ...style,
    }));
    return {
      closest: () =>
        closed ? { querySelector: () => ({ contains: () => summary }) } : null,
      checkVisibility: () => painted,
      getClientRects: () => Array(rects),
    } as unknown as HTMLElement;
  }
  it("ignores a closed atlas even when it reports a nonzero layout rectangle", () => {
    expect(isPaintedSkyOverlay(overlay({ closed: true }))).toBe(false);
  });
  it("still protects the painted summary of a closed atlas", () => {
    expect(isPaintedSkyOverlay(overlay({ closed: true, summary: true }))).toBe(
      true,
    );
  });
  it("protects painted content when the atlas is open", () => {
    expect(isPaintedSkyOverlay(overlay())).toBe(true);
  });
  it("does not reserve CSS-hidden, transparent or unpainted overlays", () => {
    for (const style of [
      { display: "none" },
      { visibility: "hidden" },
      { visibility: "collapse" },
      { opacity: "0" },
    ])
      expect(isPaintedSkyOverlay(overlay({ style }))).toBe(false);
    expect(isPaintedSkyOverlay(overlay({ painted: false }))).toBe(false);
    expect(isPaintedSkyOverlay(overlay({ rects: 0 }))).toBe(false);
  });
  it("also excludes closed atlas content on browsers without checkVisibility", () => {
    const node = overlay({ closed: true });
    Object.defineProperty(node, "checkVisibility", { value: undefined });
    expect(isPaintedSkyOverlay(node)).toBe(false);
  });
});

describe("conservative animated sky bounds", () => {
  function fixture() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute([-2, 0, 0, 0, 1, 0, 2, 0, 0], 3),
    );
    geometry.setAttribute(
      "skinIndex",
      new Uint16BufferAttribute([0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0], 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new Float32BufferAttribute([1, 0, 0, 0, 0.5, 0.5, 0, 0, 1, 0, 0, 0], 4),
    );
    const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial());
    const root = new Bone(),
      tip = new Bone(),
      unused = new Bone();
    root.add(tip, unused);
    mesh.add(root);
    mesh.bind(new Skeleton([root, tip, unused]));
    const group = new Group();
    group.add(mesh);
    group.position.set(1, -1, -20);
    group.scale.setScalar(1.4);
    const camera = new PerspectiveCamera(45, 390 / 844, 0.1, 100);
    camera.updateMatrixWorld(true);
    return { mesh, group, tip, camera };
  }
  it("does not inflate empty, zero-weight bone bounds", () => {
    const { mesh } = fixture(),
      boxes = skyBoneBounds(mesh);
    expect(boxes[2].isEmpty()).toBe(true);
    expect(
      boxes[0].equals(new Box3(new Vector3(-2, 0, 0), new Vector3(0, 1, 0))),
    ).toBe(true);
    expect(boxes[1].containsPoint(new Vector3(2, 0, 0))).toBe(true);
  });
  it("encloses actual skinned vertices through wing poses, banking and world transforms", () => {
    const { mesh, group, tip, camera } = fixture(),
      boxes = skyBoneBounds(mesh);
    for (const angle of [-1, -0.3, 0, 0.5, 1.2]) {
      tip.rotation.z = angle;
      group.rotation.set(0.2, angle * 0.2, angle * 0.1);
      group.updateMatrixWorld(true);
      const rect = projectSkyBones(
        mesh,
        boxes,
        camera,
        390,
        844,
        skyBoundsScratch(),
      );
      expect(rect).not.toBeNull();
      for (let i = 0; i < 3; i++) {
        const v = mesh
          .getVertexPosition(i, new Vector3())
          .applyMatrix4(mesh.matrixWorld)
          .project(camera);
        const x = (v.x + 1) * 195,
          y = (1 - v.y) * 422;
        expect(x).toBeGreaterThanOrEqual(rect!.left - 1e-6);
        expect(x).toBeLessThanOrEqual(rect!.right + 1e-6);
        expect(y).toBeGreaterThanOrEqual(rect!.top - 1e-6);
        expect(y).toBeLessThanOrEqual(rect!.bottom + 1e-6);
      }
    }
  });
  it("rejects an empty footprint instead of publishing infinite coordinates", () => {
    const { mesh, camera } = fixture();
    expect(
      projectSkyBones(mesh, [new Box3()], camera, 390, 844, skyBoundsScratch()),
    ).toBeNull();
  });
});
