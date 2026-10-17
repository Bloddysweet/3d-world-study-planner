import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  DataTexture,
  RGBAFormat,
  LinearFilter,
  Quaternion,
  BufferGeometry,
  Float32BufferAttribute,
  DoubleSide,
  CatmullRomCurve3,
  Color,
  InstancedMesh,
  Object3D,
  TubeGeometry,
  Vector3,
} from "three";
import type { Position3 } from "../domain/world";
type Plant = {
  position: Position3;
  scale: Position3;
  rotation?: number;
  color?: string;
};
function Instances({
  items,
  kind,
  color,
}: {
  items: Plant[];
  kind: "stone" | "bud" | "grass" | "cloud";
  color: string;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const object = new Object3D();
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      object.position.fromArray(p.position);
      object.scale.fromArray(p.scale);
      object.rotation.set(0, p.rotation ?? 0, kind === "grass" ? 0.15 : 0);
      object.updateMatrix();
      ref.current.setMatrixAt(i, object.matrix);
      if (p.color) ref.current.setColorAt(i, new Color(p.color));
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items, kind]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
      castShadow={kind !== "cloud"}
      receiveShadow={kind !== "cloud"}
    >
      {kind === "cloud" ? (
        <sphereGeometry args={[1, 12, 8]} />
      ) : kind === "stone" ? (
        <dodecahedronGeometry args={[1, 0]} />
      ) : kind === "grass" ? (
        <coneGeometry args={[1, 1, 5]} />
      ) : (
        <icosahedronGeometry args={[1, 0]} />
      )}
      <meshStandardMaterial color={color} roughness={0.92} flatShading />
    </instancedMesh>
  );
}
// Deterministic landscaping: decoration never represents earned progress.
export function IslandDressing({ seed }: { seed: number }) {
  const items = useMemo(() => {
    const random = (n: number) => {
      const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const stones: Plant[] = [],
      flowers: Plant[] = [],
      grass: Plant[] = [];
    for (let i = 0; i < 35; i++) {
      const angle = (i / 35) * Math.PI * 2;
      stones.push({
        position: [Math.cos(angle) * 2.15, 0.32, Math.sin(angle) * 2.15 - 0.9],
        scale: [0.18 + random(i) * 0.08, 0.055, 0.16],
        rotation: angle,
        color: i % 4 ? "#b3a387" : "#ded3b6",
      });
    }
    for (let i = 0; i < 100; i++) {
      const angle = random(i + 100) * Math.PI * 2,
        radius = 3.3 + random(i + 200) * 0.85,
        x = Math.cos(angle) * radius,
        z = Math.sin(angle) * radius;
      grass.push({
        position: [x, 0.42, z],
        scale: [0.08, 0.25 + random(i + 300) * 0.25, 0.08],
        rotation: angle,
        color: ["#588559", "#78a065", "#9cb16c"][i % 3],
      });
      if (i % 2 === 0)
        flowers.push({
          position: [x + 0.05, 0.57 + random(i + 300) * 0.25, z],
          scale: [0.08, 0.085, 0.08],
          color: ["#f9e6be", "#df967e", "#c5b5df", "#faf4d8"][
            Math.floor(i / 2) % 4
          ],
        });
    }
    return { stones, flowers, grass };
  }, [seed]);
  return (
    <group>
      <Instances kind="stone" color="#b3a387" items={items.stones} />
      <Instances kind="grass" color="#6b995e" items={items.grass} />
      <Instances kind="bud" color="#ffffff" items={items.flowers} />
      <IslandRoots seed={seed} />
      {seed % 3 === 0 && <Waterfall />}
    </group>
  );
}
function IslandRoots({ seed }: { seed: number }) {
  const roots = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const angle = (i / 7) * Math.PI * 2 + seed * 0.7;
        const point = (radius: number, y: number, turn = 0) =>
          new Vector3(
            Math.cos(angle + turn) * radius,
            y,
            Math.sin(angle + turn) * radius,
          );
        return new TubeGeometry(
          new CatmullRomCurve3([
            point(4.05, -0.1),
            point(4.1, -0.7, 0.02),
            point(3.65, -1.5, -0.04),
            point(3.1, -2.6, 0.06),
            point(2.5, -3.7, 0.09),
          ]),
          12,
          0.035 + (i % 3) * 0.012,
          4,
          false,
        );
      }),
    [seed],
  );
  useEffect(
    () => () => roots.forEach((geometry) => geometry.dispose()),
    [roots],
  );
  return (
    <group>
      {roots.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial
            color={i % 2 ? "#705b46" : "#9a7855"}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}
function Waterfall() {
  const curve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-3.65, 0.33, 1.3),
        new Vector3(-4.12, 0.05, 1.4),
        new Vector3(-4.25, -1.1, 1.5),
        new Vector3(-4.33, -3.4, 1.65),
        new Vector3(-4.5, -5.4, 1.8),
      ]),
    [],
  );
  const ribbon = useMemo(() => {
    const geometry = new BufferGeometry(),
      vertices: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const point = curve.getPoint(i / 24);
      const width = 0.23 * (1 + i / 80);
      vertices.push(
        point.x,
        point.y,
        point.z - width,
        point.x,
        point.y,
        point.z + width,
      );
      if (i < 24) {
        const n = i * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [curve]);
  useEffect(() => () => ribbon.dispose(), [ribbon]);
  return (
    <group>
      <mesh position={[-3.55, 0.29, 1.25]} scale={[1, 0.08, 0.7]}>
        <sphereGeometry args={[0.55, 12, 6]} />
        <meshStandardMaterial
          color="#86c5c1"
          roughness={0.2}
          metalness={0.15}
        />
      </mesh>
      <mesh geometry={ribbon}>
        <meshStandardMaterial
          side={DoubleSide}
          color="#83c7d7"
          transparent
          opacity={0.78}
          roughness={0.26}
        />
      </mesh>
      <mesh position={[0.04, 0, 0.09]}>
        <tubeGeometry args={[curve, 24, 0.023, 4, false]} />
        <meshBasicMaterial color="#edf9f0" transparent opacity={0.7} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[-4.5 + i * 0.13, -5.3 - i * 0.16, 1.8 + i * 0.12]}
          scale={[0.28, 0.12, 0.22]}
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color="#f8e9e0"
            transparent
            opacity={0.5 - i * 0.1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
// One small procedural alpha texture, shared across scene mounts. No download,
// texture animation, shadows or extra render loop; just soft sunlit cloud puffs.
let cloudTexture: DataTexture | undefined;
function softCloudTexture() {
  if (cloudTexture) return cloudTexture;
  const size = 128,
    pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1,
        v = ((y + 0.5) / size) * 2 - 1;
      let density = 0;
      for (const [cx, cy, r] of [
        [-0.35, 0.05, 0.49],
        [0, -0.18, 0.62],
        [0.38, 0.02, 0.46],
        [0, 0.25, 0.52],
      ]) {
        const d = Math.hypot((u - cx) / r, (v - cy) / r);
        density = Math.max(density, Math.pow(Math.max(0, 1 - d * d), 0.85));
      }
      const i = (y * size + x) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
      pixels[i + 3] = Math.round(density * 255);
    }
  cloudTexture = new DataTexture(pixels, size, size, RGBAFormat);
  cloudTexture.magFilter = LinearFilter;
  cloudTexture.minFilter = LinearFilter;
  cloudTexture.needsUpdate = true;
  return cloudTexture;
}
export function Cloudscape() {
  const mesh = useRef<InstancedMesh>(null);
  const { items, object, lastCamera } = useMemo(() => {
    const items: Plant[] = [];
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2,
        radius = 32 + (i % 4) * 6;
      for (let j = 0; j < 1; j++)
        items.push({
          position: [
            Math.cos(angle) * radius + (j - 1) * 3,
            -12 - (i % 5) * 1.8 + j * 0.6,
            Math.sin(angle) * radius,
          ],
          scale: [14 + (i % 3) * 2, 8 + (i % 2), 1],
          color: i % 3 === 0 ? "#fff7ec" : "#f5f3fc",
        });
    }
    return {
      items,
      object: new Object3D(),
      lastCamera: new Quaternion(0, 0, 0, 0),
    };
  }, []);
  useFrame(({ camera }) => {
    if (!mesh.current || lastCamera.equals(camera.quaternion)) return;
    lastCamera.copy(camera.quaternion);
    items.forEach((item, i) => {
      object.position.fromArray(item.position);
      object.scale.fromArray(item.scale);
      object.quaternion.copy(camera.quaternion);
      object.updateMatrix();
      mesh.current!.setMatrixAt(i, object.matrix);
      mesh.current!.setColorAt(i, new Color(item.color));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      name="Soft_Cloud_Bank"
      args={[undefined, undefined, items.length]}
      frustumCulled={false}
      renderOrder={-2}
      raycast={() => {}}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={softCloudTexture()}
        toneMapped={false}
        color="#fffaf5"
        transparent
        opacity={0.6}
        fog={false}
        depthWrite={false}
        alphaTest={0.002}
      />
    </instancedMesh>
  );
}
