import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AnimationMixer,
  Group,
  Mesh,
  MathUtils,
  PerspectiveCamera,
  SkinnedMesh,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Position3 } from "../domain/world";
import { gardenPositions } from "../domain/world";
import {
  overlapsSky,
  sampleSkyFlight,
  SKY_ASSET,
  SKY_FPS,
  skyPixelDiameter,
  skyLane,
} from "../domain/sky-flight";
import type { SkyRect } from "../domain/sky-flight";
import {
  skyBoneBounds,
  skyBoundsScratch,
  projectSkyBones,
  isPaintedSkyOverlay,
} from "../domain/sky-bounds";

import type { SkyCorridor } from "../domain/sky-corridor";
import {
  findSkyCorridor,
  skyCorridorClear,
  easeSkyCorridor,
} from "../domain/sky-corridor";

import {
  WILD_SKY_ASSET,
  sampleWildFlight,
  wildPixelDiameter,
  companionSkyEnvelope,
  findWildCorridor,
  compactDragonCorridor,
} from "../domain/wild-flight";
type SkyKind = "aurel" | "wild";
const plannedRoutes = new WeakMap<HTMLElement, Map<SkyKind, SkyCorridor>>();

interface SkyResource {
  data?: GLTF;
  error?: Error;
  promise?: Promise<void>;
}
const cached = new Map<SkyKind, SkyResource>();
function resource(kind: SkyKind): GLTF | null {
  let entry = cached.get(kind);
  if (!entry) {
    entry = {};
    cached.set(kind, entry);
    const value = entry;
    value.promise = fetch(kind === "wild" ? WILD_SKY_ASSET : SKY_ASSET)
      .then(async (r) => {
        if (!r.ok) throw Error("Sky artwork unavailable");
        value.data = await new GLTFLoader().parseAsync(
          await r.arrayBuffer(),
          "/models/",
        );
      })
      .catch((e) => {
        value.error =
          e instanceof Error ? e : new Error("Sky artwork unavailable");
      });
  }
  // Optional download/parse failure is a data state, not a render exception.
  // This avoids React reporting a recovered fetch failure as a global error.
  if (entry.error) return null;
  if (!entry.data) throw entry.promise;
  return entry.data;
}
class OptionalSky extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    queueMicrotask(this.props.onUnavailable);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
interface Props {
  kind?: SkyKind;
  paired?: boolean;
  anchor: Position3;
  focused: boolean;
  islands: Position3[];
  paused: boolean;
  reduced: boolean;
  onUnavailable: () => void;
}
// These are existing interactive overlays, not the transparent gesture boundary.
const protectedUI =
  ".world-hud-left,.world-top-tools,.island-console,.world-bottom-left,.world-evidence,.world-flat-switch,.world-controls,.sky-motion-toggle,.island-label,.topic-pagination,.world-pagination,.atlas-list,.world-popover,.world-controls-menu";
function Flyer({
  anchor,
  islands,
  paused,
  reduced,
  focused,
  kind = "aurel",
  paired = false,
  source,
}: Props & { source: GLTF }) {
  const wild = kind === "wild",
    prefix = wild ? "wild" : "sky",
    { gl, camera, size, invalidate } = useThree();
  const container = gl.domElement.closest<HTMLElement>(".world-canvas");
  const host =
    container?.closest<HTMLElement>(".world-experience") ?? container;
  const compact = size.width < 700;
  // Portrait tablet has the same clear lower-sky band as phones. Sharing it
  // explicitly prevents the first dragon from reserving all of that sky.
  const pairedBand =
    paired &&
    !focused &&
    (compact || (size.width < 1000 && size.height >= 800));
  const actor = useMemo(() => {
    const model = clone(source.scene),
      group = new Group();
    group.name = wild ? "Auren_Male_Companion" : "Aurel_Sky_Companion";
    model.traverse((o) => {
      if (o instanceof Mesh) {
        // Fade only this instance, never mutate the cached artwork material.
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          m.transparent = true;
          m.depthWrite = false;
        }
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = false;
        o.raycast = () => {};
      }
    });
    let skin: SkinnedMesh | undefined;
    model.traverse((o) => {
      if (o instanceof SkinnedMesh) skin = o;
    });
    if (!skin) throw Error("Sky artwork has no skinned mesh");
    const mesh: SkinnedMesh = skin;
    // Normalize the male's broader/longer bind silhouette to its reserved
    // footprint; his larger route diameter still makes him visibly bigger.
    mesh.geometry.computeBoundingBox();
    const dimensions = mesh.geometry.boundingBox!.getSize(new Vector3());
    const modelSpan = wild ? Math.max(11.2, dimensions.x, dimensions.z) : 11.2;
    group.add(model);
    const mixer = new AnimationMixer(model);
    const actions = Object.fromEntries(
      source.animations.map((c) => [c.name, mixer.clipAction(c).play()]),
    );
    actions.TailSway.stop();
    actions.Wingbeat.setEffectiveWeight(1);
    actions.Glide.setEffectiveWeight(0);
    mixer.update(0);
    return {
      model,
      mesh,
      boneBounds: skyBoneBounds(mesh),
      modelSpan,
      group,
      mixer,
      actions,
      time: 0,
      opacity: 0,
      blockedTime: 0,
    };
  }, [source, wild]);
  const [inViewport, setInViewport] = useState(true),
    [tabVisible, setTabVisible] = useState(() => !document.hidden);
  const active = !paused && !reduced && inViewport && tabVisible;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    accumulator = useRef(0),
    ticks = useRef(0),
    lastPublished = useRef(0),
    uiRead = useRef(0);
  const uiRects = useRef<SkyRect[]>([]);
  const steering = useRef<{
    width: number;
    height: number;
    target: SkyCorridor;
    current: SkyCorridor;
  } | null>(null);
  const scratch = useMemo(
    () => ({
      center: new Vector3(),
      next: new Vector3(),
      offset: new Vector3(),
      point: new Vector3(),
      corner: new Vector3(),
      anchor: new Vector3(),
      viewCenter: new Vector3(),
      skinBounds: skyBoundsScratch(),
    }),
    [],
  );
  const clear = () => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  };
  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new IntersectionObserver((entries) =>
      setInViewport(entries[0]?.isIntersecting ?? false),
    );
    if (container) observer.observe(container);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [container]);
  useEffect(() => {
    clear();
    accumulator.current = 0;
    lastPublished.current = 0;
    uiRead.current = 0;
    if (reduced) {
      actor.actions.Wingbeat.setEffectiveWeight(0);
      actor.actions.Glide.setEffectiveWeight(1);
      actor.mixer.setTime(0);
    }
    invalidate();
    return clear;
  }, [
    active,
    reduced,
    anchor[0],
    anchor[1],
    anchor[2],
    size.width,
    size.height,
    actor,
    invalidate,
  ]);
  // StrictMode replays effects with the same memoized skeleton/mixer. Only a real
  // unmount may irreversibly uncache bindings and dispose instance bone textures.
  const live = useRef(new WeakSet<object>());
  useEffect(() => {
    const set = live.current;
    set.add(actor);
    return () => {
      clear();
      set.delete(actor);
      queueMicrotask(() => {
        if (set.has(actor)) return;
        actor.mixer.stopAllAction();
        actor.mixer.uncacheRoot(actor.model);
        actor.model.traverse((o) => {
          if (o instanceof SkinnedMesh) o.skeleton.dispose();
          if (o instanceof Mesh)
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              m.dispose();
        });
      });
      if (container) {
        plannedRoutes.get(container)?.delete(kind);
        container.dataset[`${prefix}Count`] = "0";
        container.dataset[`${prefix}Running`] = "false";
      }
    };
  }, [actor, container, kind, prefix]);
  useFrame((_, delta) => {
    if (
      !(camera instanceof PerspectiveCamera) ||
      size.width <= 0 ||
      size.height <= 0
    ) {
      actor.group.visible = false;
      return;
    }
    const now = performance.now(),
      fps = compact ? SKY_FPS.compact : SKY_FPS.desktop;
    accumulator.current += active ? Math.min(delta, 0.1) : 0;
    const step =
      accumulator.current >= 1 / fps ? Math.min(accumulator.current, 0.15) : 0;
    if (step) {
      actor.time += step;
      accumulator.current = 0;
      ticks.current++;
    }
    const distance = Math.max(
      8,
      camera.position.distanceTo(scratch.anchor.fromArray(anchor)),
    );
    // Project conservative plot-region cubes; the creature uses posed bone bounds.
    const project = (center: Vector3, radius: number): SkyRect | null => {
      const rect = {
        left: Infinity,
        top: Infinity,
        right: -Infinity,
        bottom: -Infinity,
      };
      let valid = false;
      const viewCenter = scratch.viewCenter
        .copy(center)
        .applyMatrix4(camera.matrixWorldInverse);
      for (const x of [-1, 1])
        for (const y of [-1, 1])
          for (const z of [-1, 1]) {
            const p = scratch.corner
              .copy(viewCenter)
              .add(scratch.offset.set(x * radius, y * radius, z * radius))
              .applyMatrix4(camera.projectionMatrix);
            if (p.z < -1 || p.z > 1) continue;
            valid = true;
            const px = ((p.x + 1) * size.width) / 2,
              py = ((1 - p.y) * size.height) / 2;
            rect.left = Math.min(rect.left, px);
            rect.right = Math.max(rect.right, px);
            rect.top = Math.min(rect.top, py);
            rect.bottom = Math.max(rect.bottom, py);
          }
      return valid ? rect : null;
    };
    if (
      host &&
      container &&
      (uiRead.current === 0 || now - uiRead.current > 160)
    ) {
      uiRead.current = now;
      const canvas = gl.domElement.getBoundingClientRect();
      uiRects.current = [
        ...host.querySelectorAll<HTMLElement>(protectedUI),
        ...document.querySelectorAll<HTMLElement>(
          ".site-header,.site-notices,dialog[open]",
        ),
      ].flatMap((n) => {
        if (!isPaintedSkyOverlay(n)) return [];
        const r = n.getBoundingClientRect();
        return r.width && r.height
          ? [
              {
                left: r.left - canvas.left,
                top: r.top - canvas.top,
                right: r.right - canvas.left,
                bottom: r.bottom - canvas.top,
              },
            ]
          : [];
      });
    }
    const plots: SkyRect[] = [];
    for (const island of islands)
      for (const p of gardenPositions(6)) {
        scratch.point.set(island[0] + p[0], island[1] + 0.65, island[2] + p[2]);
        const plot = project(scratch.point, 1.05);
        if (plot) plots.push(plot);
      }
    const diameter = wild
      ? wildPixelDiameter(size.width, size.height)
      : skyPixelDiameter(size.width, size.height);
    const preferredLane = wild ? 0.32 : skyLane(compact, focused);
    const companion = container
      ? plannedRoutes.get(container)?.get("aurel")
      : undefined;
    const obstacles = [
      ...uiRects.current,
      ...plots,
      ...(wild && companion
        ? [companionSkyEnvelope(companion, size.width, size.height)]
        : []),
    ];
    let corridor: SkyCorridor | null = null;
    if ((!compact || wild) && !pairedBand) {
      const old = steering.current;
      const sameSize = old?.width === size.width && old.height === size.height;
      const target =
        sameSize &&
        skyCorridorClear(old.target, size.width, size.height, obstacles)
          ? old.target
          : wild
            ? findWildCorridor(size.width, size.height, diameter, obstacles)
            : findSkyCorridor(
                size.width,
                size.height,
                diameter,
                preferredLane,
                obstacles,
              );
      if (!sameSize && !target) steering.current = null;
      if (target) {
        const current = sameSize
          ? easeSkyCorridor(old.current, target, paused ? 0 : delta)
          : { ...target };
        steering.current = {
          width: size.width,
          height: size.height,
          target,
          current,
        };
      }
      // No available replacement must not teleport us onto the old default path.
      corridor = steering.current?.current ?? null;
    }
    if (pairedBand) corridor = compactDragonCorridor(kind, size.width);
    if (container) {
      let routes = plannedRoutes.get(container);
      if (!routes) {
        routes = new Map();
        plannedRoutes.set(container, routes);
      }
      routes.set(
        kind,
        corridor ?? {
          left: size.width * 0.25,
          right: size.width * 0.75,
          lane: preferredLane,
          diameter,
        },
      );
    }
    const sample = wild ? sampleWildFlight : sampleSkyFlight;
    const pose = sample(actor.time),
      next = sample(actor.time + 0.08);
    for (const p of [pose, next]) {
      p.y += (corridor?.lane ?? preferredLane) - 0.58;
      if (corridor)
        p.x =
          ((corridor.left + (p.x + 0.5) * (corridor.right - corridor.left)) *
            2) /
            size.width -
          1;
    }
    // Stay in the foreground sky, in front of the opaque distant cloud bank.
    // Perspective size below uses actual view-space depth, not anchor distance.
    const place = (p: ReturnType<typeof sampleSkyFlight>, v: Vector3) =>
      v
        .set(p.x, p.y, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize()
        .multiplyScalar(distance * p.depth * 0.5)
        .add(camera.position);
    place(pose, scratch.center);
    place(next, scratch.next);
    actor.group.position.copy(scratch.center);
    actor.group.lookAt(scratch.next);
    actor.group.rotateZ(pose.bank);
    const viewDepth = -scratch.viewCenter
      .copy(scratch.center)
      .applyMatrix4(camera.matrixWorldInverse).z;
    const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * viewDepth;
    const scale =
      (((corridor?.diameter ?? diameter) / size.height) * (2 * halfHeight)) /
      actor.modelSpan;
    actor.group.scale.setScalar(scale);
    // Advance a single small rig before clearance checks, so the footprint
    // follows the actual wing pose instead of getting stuck at a hidden pose.
    if (step) {
      actor.actions.Wingbeat.setEffectiveWeight(1 - pose.glide);
      actor.actions.Glide.setEffectiveWeight(pose.glide);
      actor.mixer.update(step);
    }
    actor.group.updateMatrixWorld(true);
    const bounds = projectSkyBones(
      actor.mesh,
      actor.boneBounds,
      camera,
      size.width,
      size.height,
      scratch.skinBounds,
    );
    let blocked =
      !bounds ||
      bounds.left < 6 ||
      bounds.right > size.width - 6 ||
      bounds.top < 6 ||
      bounds.bottom > size.height - 6;
    if (bounds && !blocked) {
      blocked = uiRects.current.some((r) => overlapsSky(bounds, r));
      // Protect the real six topic footprints even when labels are hidden or paged.
      if (!blocked)
        blocked = plots.some((plot) => overlapsSky(bounds, plot, 8));
      if (!blocked && wild && companion)
        blocked = overlapsSky(
          bounds,
          companionSkyEnvelope(companion, size.width, size.height),
          0,
        );
    }
    // Orbiting moves projected plots under the flight path. Never cut the mesh
    // on/off on that boundary: steer continuously, debounce brief occlusions,
    // and ease a real obstruction out/in while the route and wings keep going.
    const elapsed = Math.min(Math.max(delta, 0), 0.1);
    actor.blockedTime = blocked ? actor.blockedTime + elapsed : 0;
    const targetOpacity = blocked && actor.blockedTime > 0.18 ? 0 : 1;
    actor.opacity = reduced
      ? blocked
        ? 0
        : 1
      : MathUtils.damp(actor.opacity, targetOpacity, 6, elapsed);
    actor.group.visible = actor.opacity > 0.015;
    const materials = Array.isArray(actor.mesh.material)
      ? actor.mesh.material
      : [actor.mesh.material];
    for (const material of materials) material.opacity = actor.opacity;

    if (
      container &&
      (lastPublished.current === 0 || now - lastPublished.current > 160)
    ) {
      lastPublished.current = now;
      container.dataset[`${prefix}Status`] = "ready";
      container.dataset[`${prefix}Count`] = "1";
      container.dataset[`${prefix}Visible`] = String(actor.group.visible);
      container.dataset[`${prefix}Safe`] = String(!blocked);
      container.dataset[`${prefix}Opacity`] = actor.opacity.toFixed(3);
      container.dataset[`${prefix}Running`] = String(active);
      container.dataset[`${prefix}Reason`] = reduced
        ? "reduced-motion"
        : paused
          ? "paused"
          : !tabVisible
            ? "hidden-tab"
            : !inViewport
              ? "offscreen"
              : blocked
                ? "clearance"
                : "running";
      container.dataset[`${prefix}Ticks`] = String(ticks.current);
      container.dataset[`${prefix}Pose`] = JSON.stringify({
        time: +actor.time.toFixed(3),
        position: actor.group.position.toArray(),
        wing: actor.model.getObjectByName("LeftShoulder")?.rotation.z,
        glide: reduced ? 1 : pose.glide,
        clip: reduced
          ? "Glide"
          : pose.glide > 0.6
            ? "Glide"
            : pose.glide < 0.4
              ? "Wingbeat"
              : "Transition",
        bounds,
        corridor,
      });
    }
    // Route clock continues through brief clearance gaps so a hidden flyer returns.
    // A cheap posed-bounds check replaces false whole-body clearance hides.
    // Whole-canvas hiding still pauses both the route and the skeleton.
    if (active && timer.current === undefined)
      timer.current = setTimeout(
        () => {
          timer.current = undefined;
          invalidate();
        },
        1000 / (blocked && actor.opacity < 0.02 ? 8 : fps),
      );
  });
  return <primitive object={actor.group} dispose={null} />;
}
function LoadedSky(props: Props) {
  const source = resource(props.kind ?? "aurel");
  useEffect(() => {
    if (!source) props.onUnavailable();
  }, [source, props.onUnavailable]);
  return source ? <Flyer {...props} source={source} /> : null;
}
export function SkyCreature(props: Props) {
  return (
    <OptionalSky onUnavailable={props.onUnavailable}>
      <Suspense fallback={null}>
        <LoadedSky {...props} />
      </Suspense>
    </OptionalSky>
  );
}
