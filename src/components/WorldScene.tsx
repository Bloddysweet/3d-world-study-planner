import {
  Component,
  Suspense,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Group, Vector3, MathUtils } from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import { useSceneReducedMotion } from "./useSceneReducedMotion";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  PauseMotion,
  PlayMotion,
  Settings2,
  Layers3,
} from "./icons";
import { useApp } from "../data/AppProvider";
import { topicStatus } from "../domain/engine";
import type { Subject, Topic } from "../domain/model";
import {
  layoutLabels,
  cameraDistance,
  cameraLimits,
  inZoomArea,
  gardenPositions,
  groupForSubject,
  islandPositions,
  islandRadius,
  ISLANDS_PER_GROUP,
  TOPICS_PER_GARDEN,
} from "../domain/world";
import type { Position3 } from "../domain/world";
import { WorldPopover } from "./WorldPopover";
import { Cloudscape } from "./WorldScenery";
import { islandArtFile } from "../domain/island-art";
import { Villagers } from "./Villagers";
import { SkyCreature } from "./SkyCreature";
import { skyAnchor } from "../domain/sky-flight";
const loader = new GLTFLoader();
interface Resource {
  promise?: Promise<void>;
  scene?: Group;
  error?: Error;
}
const resources = new Map<string, Resource>();
// Native fetch avoids Three FileLoader's extra ReadableStream wrapper; every byte is validated before parsing.
function asset(file: string): Group {
  let resource = resources.get(file);
  if (!resource) {
    resource = {};
    resources.set(file, resource);
    const current = resource;
    current.promise = fetch(`/models/${file}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load ${file}`);
        const bytes = await response.arrayBuffer();
        const length = response.headers.get("content-length");
        // Fetch decodes compressed responses; Content-Length describes wire bytes in that case.
        const encoding = response.headers.get("content-encoding");
        if (
          length &&
          (!encoding || encoding === "identity") &&
          Number(length) !== bytes.byteLength
        )
          throw new Error(`Incomplete model: ${file}`);
        const gltf = await loader.parseAsync(bytes, "/models/");
        current.scene = gltf.scene;
      })
      .catch((error) => {
        current.error =
          error instanceof Error ? error : new Error("Model loading failed");
      });
  }
  if (resource.error) throw resource.error;
  if (!resource.scene) throw resource.promise;
  return resource.scene;
}
function Model({
  file,
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
}: {
  file: string;
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const source = asset(file),
    scene = useMemo(() => {
      const clone = source.clone(true);
      clone.traverse((object) => {
        object.castShadow = true;
        object.receiveShadow = true;
      });
      return clone;
    }, [source]);
  return (
    <primitive
      object={scene}
      position={position}
      scale={scale}
      rotation={rotation}
      dispose={null}
    />
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    queueMicrotask(() => this.props.onError?.());
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface ViewProps {
  subjects: Subject[];
  onFallback: () => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  mode?: "world" | "subject";
  exploring?: boolean;
  immersive?: boolean;
  activeTopicId?: string | null;
  onTopicSelect?: (id: string) => void;
}
function Island({
  subject,
  position,
  selected,
  onSelect,
  topics,
  onTopicSelect,
  activeTopicId,
  garden,
}: {
  subject: Subject;
  position: Position3;
  selected: boolean;
  onSelect: () => void;
  topics: Topic[];
  onTopicSelect?: (id: string) => void;
  activeTopicId?: string | null;
  garden: boolean;
}) {
  const { data } = useApp(),
    [hovered, setHovered] = useState(false);
  const plotPositions = gardenPositions(topics.length);
  useEffect(() => {
    if (hovered) document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta <= 6) onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <Model file={islandArtFile(subject.theme)} />
      {topics.map((topic, i) => (
        <group
          key={topic.id}
          position={plotPositions[i]}
          onClick={(e) => {
            if (onTopicSelect) {
              e.stopPropagation();
              if (e.delta <= 6) onTopicSelect(topic.id);
            }
          }}
        >
          <Model
            file={`topic_plot_${topicStatus(data, topic.id)}.glb`}
            scale={[0.65, 0.65, 0.65]}
          />
          {garden && activeTopicId === topic.id && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
              <ringGeometry args={[0.62, 0.7, 32]} />
              <meshBasicMaterial color="#f7dc88" depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
      {(selected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.32, 0]}>
          <ringGeometry args={[4.04, selected ? 4.1 : 4.08, 64]} />
          <meshBasicMaterial
            color={selected ? "#c5d1ec" : "#fff9dd"}
            transparent
            opacity={selected ? 0.9 : 0.65}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
interface CameraCommand {
  id: number;
  direction: number;
}
function CameraRig({
  count,
  selectedPosition,
  reset,
  zoom,
  rotation,
  reduced,
  onLost,
  immersive,
}: {
  count: number;
  selectedPosition: Position3 | null;
  reset: number;
  zoom: CameraCommand;
  rotation: CameraCommand;
  reduced: boolean;
  onLost: () => void;
  immersive: boolean;
}) {
  const { camera, size, gl, invalidate } = useThree(),
    controls = useRef<Controls>(null);
  const goal = useRef({
    position: new Vector3(35, 32, 42),
    target: new Vector3(0, -1, 0),
    active: false,
  });
  const handledZoom = useRef(0);
  const limits = cameraLimits(
    size.width,
    size.height,
    count,
    !!selectedPosition,
  );
  const x = selectedPosition?.[0] ?? 0,
    z = selectedPosition?.[2] ?? 0;
  const begin = useCallback(() => {
    goal.current.active = true;
    if (controls.current) controls.current.enabled = false;
    invalidate();
  }, [invalidate]);
  useEffect(() => {
    const distance = cameraDistance(
      size.width,
      size.height,
      count,
      !!selectedPosition,
    );
    goal.current.target.set(x, -0.6, z);
    goal.current.position
      .copy(goal.current.target)
      .add(new Vector3(0.65, 0.74, 1).normalize().multiplyScalar(distance));
    begin();
  }, [x, z, reset, count, size.width, size.height, !!selectedPosition, begin]);
  useEffect(() => {
    if (!rotation.id || !controls.current) return;
    goal.current.target.copy(controls.current.target);
    const offset = camera.position
      .clone()
      .sub(controls.current.target)
      .applyAxisAngle(new Vector3(0, 1, 0), (rotation.direction * Math.PI) / 4);
    goal.current.position.copy(goal.current.target).add(offset);
    begin();
  }, [rotation, camera, begin]);
  useEffect(() => {
    if (!zoom.id || handledZoom.current === zoom.id || !controls.current)
      return;
    handledZoom.current = zoom.id;
    goal.current.target.copy(controls.current.target);
    const offset = camera.position.clone().sub(controls.current.target);
    offset.setLength(
      MathUtils.clamp(
        offset.length() * (zoom.direction > 0 ? 0.75 : 1 / 0.75),
        limits.min,
        limits.max,
      ),
    );
    goal.current.position.copy(goal.current.target).add(offset);
    begin();
  }, [zoom, camera, begin, limits.min, limits.max]);
  useEffect(() => {
    const interrupt = () => {
      goal.current.active = false;
      if (controls.current) controls.current.enabled = true;
    };
    const lost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    const canvas = gl.domElement;
    const container = canvas.closest(".world-canvas") as HTMLElement | null;
    const inside = (event: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return inZoomArea(
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
      );
    };
    const wheel = (event: WheelEvent) => {
      // Do not prevent default outside the centre: page/panel scrolling wins.
      if (!inside(event)) {
        event.stopImmediatePropagation();
        return;
      }
      if (controls.current) controls.current.enableZoom = true;
      interrupt();
    };
    const touches = new Set<number>();
    let touchZoom = true;
    const down = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        if (!touches.size) touchZoom = true;
        touches.add(event.pointerId);
        touchZoom = touchZoom && inside(event);
        if (controls.current) controls.current.enableZoom = touchZoom;
      }
      interrupt();
    };
    const up = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      if (!touches.size && controls.current) controls.current.enableZoom = true;
    };
    const hover = (event: PointerEvent) => {
      if (container && event.pointerType !== "touch")
        container.dataset.zoomZoneHover = String(inside(event));
    };
    const leave = () => {
      if (container) container.dataset.zoomZoneHover = "false";
    };
    canvas.addEventListener("pointerdown", down, true);
    canvas.addEventListener("pointermove", hover, { passive: true });
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("pointerup", up, true);
    canvas.addEventListener("pointercancel", up, true);
    canvas.addEventListener("wheel", wheel, { capture: true, passive: true });
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      canvas.removeEventListener("pointerdown", down, true);
      canvas.removeEventListener("pointermove", hover);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("pointerup", up, true);
      canvas.removeEventListener("pointercancel", up, true);
      canvas.removeEventListener("wheel", wheel, true);
      canvas.removeEventListener("webglcontextlost", lost);
    };
  }, [gl, onLost]);
  useFrame((_, delta) => {
    const target = goal.current,
      orbit = controls.current;
    if (!orbit) return;
    // Frame-rate-independent settling avoids long camera drift on slower GPUs.
    orbit.dampingFactor = reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 8);
    if (target.active) {
      const blend = reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 7);
      camera.position.lerp(target.position, blend);
      orbit.target.lerp(target.target, blend);
      camera.lookAt(orbit.target);
      if (
        camera.position.distanceToSquared(target.position) < 0.0001 &&
        orbit.target.distanceToSquared(target.target) < 0.0001
      ) {
        camera.position.copy(target.position);
        orbit.target.copy(target.target);
        camera.lookAt(orbit.target);
        orbit.update();
        orbit.enabled = true;
        target.active = false;
      } else invalidate();
    }
    const element = gl.domElement.closest(
      ".world-canvas",
    ) as HTMLElement | null;
    if (element) {
      element.dataset.cameraMinDistance = String(limits.min);
      element.dataset.cameraMaxDistance = String(limits.max);
      element.dataset.cameraAzimuth = String(orbit.getAzimuthalAngle());
      element.dataset.cameraDistance = String(
        camera.position.distanceTo(orbit.target),
      );
      element.dataset.cameraMoving = String(target.active);
    }
  }, -0.5);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      enableZoom
      minDistance={limits.min}
      maxDistance={limits.max}
      minPolarAngle={0.08}
      maxPolarAngle={Math.PI * 0.73}
      rotateSpeed={0.65}
      zoomSpeed={0.85}
      panSpeed={0.7}
      enableDamping={!reduced}
      dampingFactor={0.12}
      screenSpacePanning={immersive}
    />
  );
}
interface LabelPoint {
  id: string;
  position: Position3;
}
function LabelsTracker({
  points,
  labels,
}: {
  points: LabelPoint[];
  labels: React.RefObject<HTMLDivElement | null>;
}) {
  const projected = useMemo(() => new Vector3(), []);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => invalidate(), [points, invalidate]);
  useFrame(({ camera, size }) => {
    const visible: {
      element: HTMLElement;
      x: number;
      y: number;
      width: number;
      height: number;
      depth: number;
    }[] = [];
    points.forEach((point, i) => {
      const element = labels.current?.children[i] as HTMLElement | undefined;
      if (!element) return;
      projected.fromArray(point.position).project(camera);
      const inView =
        projected.z >= -1 &&
        projected.z <= 1 &&
        Math.abs(projected.x) < 1.2 &&
        Math.abs(projected.y) < 1.2;
      element.style.visibility = inView ? "visible" : "hidden";
      element.style.opacity = inView ? "1" : "0";
      if (inView)
        visible.push({
          element,
          x: ((projected.x + 1) * size.width) / 2,
          y: ((1 - projected.y) * size.height) / 2,
          width: element.offsetWidth,
          height: element.offsetHeight,
          depth: projected.z,
        });
    });
    const arranged = layoutLabels(visible, size.width, size.height);
    arranged.forEach((point, i) => {
      const { element, depth } = visible[i];
      element.style.transform = `translate3d(${point.x}px,${point.y}px,0) translate(-50%,-50%)`;
      element.style.zIndex = String(Math.round((1 - depth) * 1000));
    });
  });
  return null;
}
function SceneReady({ onReady }: { onReady: () => void }) {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
    onReady();
  }, [gl, invalidate, onReady]);
  return null;
}
function WorldScene({
  subjects,
  positions,
  selectedId,
  onSelect,
  topics,
  onTopicSelect,
  activeTopicId,
  garden,
  points,
  labels,
  reset,
  zoom,
  rotation,
  reduced,
  onLost,
  onReady,
  immersive,
  motionPaused,
  onVillagerUnavailable,
  skyPaused,
  onSkyUnavailable,
  wildPaused,
  wildAvailable,
  onWildUnavailable,
}: {
  wildPaused: boolean;
  wildAvailable: boolean;
  onWildUnavailable: () => void;
  skyPaused: boolean;
  onSkyUnavailable: () => void;
  motionPaused: boolean;
  onVillagerUnavailable: () => void;
  immersive: boolean;
  subjects: Subject[];
  positions: Position3[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  topics: Topic[];
  onTopicSelect?: (id: string) => void;
  activeTopicId?: string | null;
  garden: boolean;
  points: LabelPoint[];
  labels: React.RefObject<HTMLDivElement | null>;
  reset: number;
  zoom: CameraCommand;
  rotation: CameraCommand;
  reduced: boolean;
  onLost: () => void;
  onReady: () => void;
}) {
  const { data } = useApp();
  const { gl, invalidate, size } = useThree();
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate, data, garden, selectedId, reset, subjects.length]);
  const selectedIndex = subjects.findIndex((s) => s.id === selectedId);
  const extent = subjects.length > 1 ? islandRadius(subjects.length) + 5 : 7;
  const fogStart = Math.max(
    65,
    cameraLimits(size.width, size.height, subjects.length, selectedIndex >= 0)
      .max + extent,
  );
  return (
    <>
      <CameraRig
        count={subjects.length}
        selectedPosition={selectedIndex < 0 ? null : positions[selectedIndex]}
        reset={reset}
        zoom={zoom}
        rotation={rotation}
        reduced={reduced}
        onLost={onLost}
        immersive={immersive}
      />
      <LabelsTracker points={points} labels={labels} />
      <ambientLight intensity={0.65} color="#e8deef" />
      <hemisphereLight args={["#fff0db", "#7a8193", 1.8]} />
      <directionalLight
        position={[-22, 35, 18]}
        intensity={3.2}
        color="#ffe3bd"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-camera-far={110}
        shadow-normalBias={0.035}
        shadow-bias={-0.0001}
      />
      <directionalLight
        position={[20, 8, -25]}
        intensity={1.2}
        color="#c9cfef"
      />
      {immersive && (
        <>
          <fog attach="fog" args={["#ead4d9", fogStart, fogStart + 100]} />
          <Cloudscape />
        </>
      )}
      <Suspense fallback={null}>
        <SceneReady onReady={onReady} />
        {!garden &&
          positions
            .slice(1)
            .map((p, i) => (
              <Model
                key={`bridge-${i}`}
                file="bridge.glb"
                position={[p[0] / 2, 0.24, p[2] / 2]}
                rotation={[0, -Math.atan2(p[2], p[0]), 0]}
                scale={[(Math.hypot(p[0], p[2]) - 8.7) / 4, 1, 1]}
              />
            ))}
        {subjects.map((subject, i) =>
          garden && subject.id !== selectedId ? null : (
            <Island
              key={subject.id}
              subject={subject}
              position={positions[i]}
              selected={subject.id === selectedId}
              onSelect={() => onSelect(subject.id)}
              garden={garden && subject.id === selectedId}
              activeTopicId={activeTopicId}
              topics={
                garden && subject.id === selectedId
                  ? topics
                  : data.topics
                      .filter((t) => t.subjectId === subject.id)
                      .slice(0, 3)
              }
              onTopicSelect={
                garden && subject.id === selectedId ? onTopicSelect : undefined
              }
            />
          ),
        )}
        {!immersive && !garden && !selectedId && (
          <>
            <Model
              file="scenery_cloud.glb"
              position={[-extent * 0.75, -2, extent * 0.75]}
              scale={[3.5, 3.5, 3.5]}
            />
            <Model
              file="scenery_cloud.glb"
              position={[extent * 0.8, -3, -extent * 0.75]}
              scale={[4, 4, 4]}
            />
            <Model
              file="scenery_cloud.glb"
              position={[-extent * 0.7, 3, -extent * 0.9]}
              scale={[2.3, 2.3, 2.3]}
            />
          </>
        )}
      </Suspense>
      {skyAnchor(positions, selectedIndex) && (
        <SkyCreature
          paired={immersive && wildAvailable}
          anchor={skyAnchor(positions, selectedIndex)!}
          focused={garden || selectedIndex >= 0}
          islands={
            garden && selectedIndex >= 0
              ? [positions[selectedIndex]]
              : positions
          }
          paused={skyPaused}
          reduced={reduced}
          onUnavailable={onSkyUnavailable}
        />
      )}
      {immersive && wildAvailable && skyAnchor(positions, selectedIndex) && (
        <SkyCreature
          kind="wild"
          paired
          anchor={skyAnchor(positions, selectedIndex)!}
          focused={garden || selectedIndex >= 0}
          islands={
            garden && selectedIndex >= 0
              ? [positions[selectedIndex]]
              : positions
          }
          paused={wildPaused}
          reduced={reduced}
          onUnavailable={onWildUnavailable}
        />
      )}
      <Villagers
        subjects={
          garden ? subjects.filter((s) => s.id === selectedId) : subjects
        }
        positions={
          garden
            ? subjects.flatMap((s, i) =>
                s.id === selectedId ? [positions[i]] : [],
              )
            : positions
        }
        selectedId={selectedId}
        paused={motionPaused}
        reduced={reduced}
        onUnavailable={onVillagerUnavailable}
      />
    </>
  );
}
export default function WorldSceneView({
  subjects,
  onFallback,
  selectedId,
  onSelect,
  mode = "world",
  activeTopicId,
  onTopicSelect,
  exploring = false,
  immersive = false,
}: ViewProps) {
  const { data, date } = useApp(),
    reduced = useSceneReducedMotion(),
    labels = useRef<HTMLDivElement>(null);
  const sceneElement = useRef<HTMLDivElement>(null);
  const [reset, setReset] = useState(0),
    [zoom, setZoom] = useState<CameraCommand>({ id: 0, direction: 0 }),
    [page, setPage] = useState(0),
    [topicPage, setTopicPage] = useState(0);
  const [rotation, setRotation] = useState<CameraCommand>({
    id: 0,
    direction: 0,
  });
  const [motionPaused, setMotionPaused] = useState(false);
  const [skyPaused, setSkyPaused] = useState(false);
  const [wildPaused, setWildPaused] = useState(false);
  const [wildUnavailable, setWildUnavailable] = useState(false);
  const onWildUnavailable = useCallback(() => setWildUnavailable(true), []);
  const [skyUnavailable, setSkyUnavailable] = useState(false);
  const onSkyUnavailable = useCallback(() => setSkyUnavailable(true), []);
  const [villagerUnavailable, setVillagerUnavailable] = useState(false);
  const onVillagerUnavailable = useCallback(
    () => setVillagerUnavailable(true),
    [],
  );
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const garden = mode === "subject" || exploring;
  const pages = Math.ceil(subjects.length / ISLANDS_PER_GROUP);
  const selectedPage = groupForSubject(
    subjects.map((s) => s.id),
    selectedId,
  );
  const safePage = Math.min(selectedPage ?? page, Math.max(0, pages - 1));
  const visible = subjects.slice(
    safePage * ISLANDS_PER_GROUP,
    (safePage + 1) * ISLANDS_PER_GROUP,
  );
  const positions = useMemo(
    () => islandPositions(visible.length),
    [visible.length],
  );
  const allTopics = garden
    ? data.topics.filter((t) => t.subjectId === (selectedId ?? subjects[0]?.id))
    : [];
  const activeTopicIndex = allTopics.findIndex((t) => t.id === activeTopicId);
  const topicPages = Math.ceil(allTopics.length / TOPICS_PER_GARDEN);
  const safeTopicPage = Math.min(
    activeTopicIndex < 0
      ? topicPage
      : Math.floor(activeTopicIndex / TOPICS_PER_GARDEN),
    Math.max(0, topicPages - 1),
  );
  const topics = allTopics.slice(
    safeTopicPage * TOPICS_PER_GARDEN,
    (safeTopicPage + 1) * TOPICS_PER_GARDEN,
  );
  const anchor = positions[
    visible.findIndex((subject) => subject.id === selectedId)
  ] ?? [0, 0, 0];
  const points: LabelPoint[] = garden
    ? topics.map((topic, i) => ({
        id: topic.id,
        position: [
          anchor[0] + gardenPositions(topics.length)[i][0],
          0.8,
          anchor[2] + gardenPositions(topics.length)[i][2] + 0.6,
        ],
      }))
    : visible.flatMap((s, i) =>
        selectedId && s.id !== selectedId
          ? []
          : [
              {
                id: s.id,
                position: [
                  positions[i][0],
                  -0.3,
                  positions[i][2] + 4.8,
                ] as Position3,
              },
            ],
      );
  const onReady = useCallback(() => setReady(true), []),
    onLost = useCallback(() => setFailed(true), []);
  useEffect(() => {
    setZoom({ id: 0, direction: 0 });
    setTopicPage(0);
  }, [selectedId]);
  useEffect(() => {
    if (garden) return;
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]"))
        onSelect?.(null);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onSelect, garden]);
  function home() {
    setZoom({ id: 0, direction: 0 });
    setReset((r) => r + 1);
    if (mode !== "subject") onSelect?.(null);
  }
  function changePage(next: number) {
    onSelect?.(null);
    setPage(next);
    setZoom({ id: 0, direction: 0 });
    setReset((r) => r + 1);
  }
  const fallback = (
    <div className="scene-fallback">
      <strong>A lighter view, just as useful.</strong>
      <p>
        3D could not load on this device. Your topics, tasks and study tools
        still work below.
      </p>
      <button className="btn" onClick={onFallback}>
        Use the 2D view
      </button>
    </div>
  );
  return (
    <div
      ref={sceneElement}
      className={`world-canvas ${mode === "subject" ? "subject-canvas" : ""} ${immersive ? "immersive-canvas" : ""}`}
      data-villager-status={villagerUnavailable ? "unavailable" : undefined}
      data-sky-status={skyUnavailable ? "unavailable" : undefined}
      data-wild-status={wildUnavailable ? "unavailable" : undefined}
      role="region"
      aria-label={
        garden
          ? "Interactive subject topic garden"
          : "Interactive 3D subject islands"
      }
    >
      <SceneBoundary fallback={fallback} onError={onLost}>
        {failed ? (
          fallback
        ) : (
          <Canvas
            onCreated={({ gl }) => {
              gl.shadowMap.autoUpdate = false;
              gl.shadowMap.needsUpdate = true;
            }}
            shadows
            camera={{ position: [35, 32, 42], fov: 42, near: 0.1, far: 400 }}
            dpr={[1, 1.5]}
            frameloop="demand"
            gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
            fallback={fallback}
          >
            <SceneBoundary fallback={null} onError={onLost}>
              <WorldScene
                subjects={visible}
                positions={positions}
                selectedId={selectedId}
                onSelect={(id) => onSelect?.(id)}
                topics={topics}
                garden={garden}
                activeTopicId={activeTopicId}
                onTopicSelect={onTopicSelect}
                points={points}
                labels={labels}
                reset={reset + safePage * 1000}
                zoom={zoom}
                rotation={rotation}
                reduced={reduced}
                onLost={onLost}
                onReady={onReady}
                immersive={immersive}
                motionPaused={motionPaused}
                onVillagerUnavailable={onVillagerUnavailable}
                skyPaused={skyPaused}
                onSkyUnavailable={onSkyUnavailable}
                wildPaused={wildPaused}
                wildAvailable={!wildUnavailable}
                onWildUnavailable={onWildUnavailable}
              />
            </SceneBoundary>
          </Canvas>
        )}
      </SceneBoundary>
      {!failed && (
        <>
          <div className="world-zoom-boundary" aria-hidden="true">
            <span>Scroll / pinch here to zoom</span>
          </div>
          <div className="world-touch-scroll-edges" aria-hidden="true">
            <div className="edge-top" />
            <div className="edge-bottom" />
            <div className="edge-left" />
            <div className="edge-right" />
          </div>
        </>
      )}
      {ready && !failed && (
        <div
          className={`island-label-layer ${garden ? "topic-label-layer" : ""}`}
          ref={labels}
        >
          {points.map((point) => {
            const topic = garden ? topics.find((t) => t.id === point.id) : null;
            const subject = garden
              ? (subjects.find((subject) => subject.id === selectedId) ??
                subjects[0])
              : visible.find((s) => s.id === point.id)!;
            const ids = new Set(
              data.topics
                .filter((t) => t.subjectId === subject.id)
                .map((t) => t.id),
            );
            const due = data.revisions.filter(
              (r) => ids.has(r.topicId) && r.due <= date,
            ).length;
            const status = topic ? topicStatus(data, topic.id) : null;
            const pressed = garden
              ? activeTopicId === point.id
              : selectedId === point.id;
            return (
              <button
                key={point.id}
                className={`island-label ${garden ? "topic-plot-label" : ""} ${pressed ? "selected" : ""} ${status ? `plot-${status}` : ""}`}
                style={
                  { "--subject-color": subject.color } as React.CSSProperties
                }
                aria-pressed={pressed}
                aria-label={
                  topic
                    ? `Open topic: ${topic.name}`
                    : `Select island: ${subject.name}`
                }
                onClick={() =>
                  topic ? onTopicSelect?.(topic.id) : onSelect?.(subject.id)
                }
              >
                <span className="island-dot" />
                <span>{topic?.name ?? subject.name}</span>
                {!garden && due > 0 && <small>{due}</small>}
              </button>
            );
          })}
        </div>
      )}
      {!ready && !failed && (
        <div className="scene-loading scene-loading-overlay">
          Growing your {garden ? "topic garden" : "islands"}…
        </div>
      )}
      {!failed &&
        sceneElement.current &&
        createPortal(
          <WorldPopover
            title="World controls"
            className="world-controls-menu"
            trigger={
              <>
                <Settings2 size={16} />
                <span>Controls</span>
              </>
            }
          >
            <p className="world-controls-hint">
              Drag to explore. Scroll or pinch in the centre to zoom.
            </p>
            <div
              className="world-controls"
              role="group"
              aria-label="Camera controls"
            >
              <button
                aria-label="Zoom in on world"
                title="Zoom in"
                onClick={() =>
                  setZoom((previous) => ({ id: previous.id + 1, direction: 1 }))
                }
              >
                <Plus size={15} />
                <span>Zoom in</span>
              </button>
              <button
                aria-label="Zoom out of world"
                title="Zoom out"
                onClick={() =>
                  setZoom((previous) => ({
                    id: previous.id + 1,
                    direction: -1,
                  }))
                }
              >
                <Minus size={15} />
                <span>Zoom out</span>
              </button>
              <button
                aria-label="Rotate view left"
                title="Rotate left"
                onClick={() =>
                  setRotation((r) => ({ id: r.id + 1, direction: -1 }))
                }
              >
                <RotateCcw size={14} />
                <span>Turn left</span>
              </button>
              <button
                aria-label="Rotate view right"
                title="Rotate right"
                onClick={() =>
                  setRotation((r) => ({ id: r.id + 1, direction: 1 }))
                }
              >
                <RotateCw size={14} />
                <span>Turn right</span>
              </button>
              <button
                aria-label="Reset world camera"
                title={garden ? "Reset camera" : "Return to all islands"}
                onClick={home}
              >
                <Home size={14} />
                <span>Reset view</span>
              </button>
              <button
                className="villager-motion-toggle"
                aria-label="Animate villagers"
                aria-pressed={!motionPaused && !reduced && !villagerUnavailable}
                disabled={reduced || villagerUnavailable}
                title={
                  villagerUnavailable
                    ? "Villager artwork unavailable; study tools still work"
                    : reduced
                      ? "Villager motion is off for reduced motion"
                      : motionPaused
                        ? "Resume villagers"
                        : "Pause villagers"
                }
                onClick={() => setMotionPaused((value) => !value)}
              >
                {motionPaused || reduced || villagerUnavailable ? (
                  <PlayMotion size={14} />
                ) : (
                  <PauseMotion size={14} />
                )}
                <span>Villagers {motionPaused || reduced ? "off" : "on"}</span>
              </button>
            </div>
            {visible.length > 0 && (
              <button
                className={`sky-motion-toggle ${!garden && pages > 1 ? "sky-paged" : ""}`}
                aria-label="Animate sky creature"
                aria-pressed={!skyPaused && !reduced && !skyUnavailable}
                disabled={reduced || skyUnavailable}
                title={
                  skyUnavailable
                    ? "Sky artwork unavailable; study tools still work"
                    : reduced
                      ? "Sky motion is off for reduced motion"
                      : skyPaused
                        ? "Resume Aurel flight"
                        : "Pause Aurel flight"
                }
                onClick={() => setSkyPaused((value) => !value)}
              >
                {skyPaused || reduced || skyUnavailable ? (
                  <PlayMotion size={13} />
                ) : (
                  <PauseMotion size={13} />
                )}
                <span>Aurel flight {skyPaused || reduced ? "off" : "on"}</span>
              </button>
            )}
            {immersive && visible.length > 0 && (
              <button
                className="sky-motion-toggle companion-motion-toggle"
                aria-label="Animate male dragon"
                aria-pressed={!wildPaused && !reduced && !wildUnavailable}
                disabled={reduced || wildUnavailable}
                title={
                  wildUnavailable
                    ? "Male companion artwork unavailable; study tools still work"
                    : reduced
                      ? "Male companion motion is off for reduced motion"
                      : wildPaused
                        ? "Resume Auren flight"
                        : "Pause Auren flight"
                }
                onClick={() => setWildPaused((value) => !value)}
              >
                {wildPaused || reduced || wildUnavailable ? (
                  <PlayMotion size={13} />
                ) : (
                  <PauseMotion size={13} />
                )}
                <span>
                  Auren · male companion {wildPaused || reduced ? "off" : "on"}
                </span>
              </button>
            )}
            {immersive && (
              <button className="world-controls-view" onClick={onFallback}>
                <Layers3 size={16} />
                <span>Switch to 2D atlas</span>
                <ChevronRight size={14} />
              </button>
            )}
          </WorldPopover>,
          sceneElement.current.closest<HTMLElement>(".world-experience") ??
            sceneElement.current,
        )}
      {mode !== "subject" && !exploring && pages > 1 && (
        <div className="world-pagination">
          <button
            aria-label="Previous island group"
            disabled={!safePage}
            onClick={() => changePage(safePage - 1)}
          >
            <ChevronLeft size={13} />
          </button>
          <span>
            Islands {safePage * ISLANDS_PER_GROUP + 1}–
            {Math.min(subjects.length, (safePage + 1) * ISLANDS_PER_GROUP)} /{" "}
            {subjects.length}
          </span>
          <button
            aria-label="Next island group"
            disabled={safePage >= pages - 1}
            onClick={() => changePage(safePage + 1)}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
      {garden && topicPages > 1 && (
        <div className="world-pagination topic-pagination">
          <button
            aria-label="Previous topic plots"
            disabled={!safeTopicPage}
            onClick={() => {
              onTopicSelect?.("");
              setTopicPage(safeTopicPage - 1);
            }}
          >
            <ChevronLeft size={13} />
          </button>
          <span>
            Topics {safeTopicPage * TOPICS_PER_GARDEN + 1}–
            {Math.min(
              allTopics.length,
              (safeTopicPage + 1) * TOPICS_PER_GARDEN,
            )}{" "}
            / {allTopics.length}
          </span>
          <button
            aria-label="Next topic plots"
            disabled={safeTopicPage >= topicPages - 1}
            onClick={() => {
              onTopicSelect?.("");
              setTopicPage(safeTopicPage + 1);
            }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
