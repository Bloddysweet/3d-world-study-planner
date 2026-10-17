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
  CircleGeometry,
  Frustum,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Sphere,
  Vector3,
  SkinnedMesh,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Subject } from "../domain/model";
import type { Position3 } from "../domain/world";
import {
  sampleVillager,
  villagerSites,
  VILLAGER_FPS,
  VILLAGER_GROUND,
} from "../domain/villagers";
import type { VillagerActivity, VillagerVariant } from "../domain/villagers";

// Optional art has an independent cache/boundary: a failed person never removes an island.
const resources = new Map<
  VillagerVariant,
  { data?: GLTF; error?: Error; promise?: Promise<void> }
>();
function resource(variant: VillagerVariant): GLTF {
  let entry = resources.get(variant);
  if (!entry) {
    entry = {};
    resources.set(variant, entry);
    const target = entry;
    target.promise = fetch(`/models/villager_${variant}_v1.glb`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Villager artwork unavailable");
        const bytes = await response.arrayBuffer();
        target.data = await new GLTFLoader().parseAsync(bytes, "/models/");
      })
      .catch((error) => {
        target.error =
          error instanceof Error
            ? error
            : new Error("Villager artwork unavailable");
      });
  }
  if (entry.error) throw entry.error;
  if (!entry.data) throw entry.promise;
  return entry.data;
}
class OptionalArtBoundary extends Component<
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
  subjects: Subject[];
  positions: Position3[];
  selectedId?: string | null;
  paused: boolean;
  reduced: boolean;
  onUnavailable: () => void;
}
function Crowd({ subjects, positions, selectedId, paused, reduced }: Props) {
  const { gl, invalidate, size } = useThree();
  const container = gl.domElement.closest<HTMLElement>(".world-canvas");
  const compact = size.width < 700;
  const sites = villagerSites(subjects, positions, selectedId, compact);
  // A selection/layout change rebuilds only tiny rig instances. Geometry/materials are cached.
  const key = sites
    .map((s) => [s.id, s.variant, ...s.position].join(":"))
    .join("|");
  const sources = sites.map((s) => resource(s.variant));
  const actors = useMemo(
    () =>
      sites.map((site, i) => {
        const source = sources[i],
          model = clone(source.scene),
          group = new Group();
        const sample = sampleVillager(0, site.lane, site.phase);
        group.position.set(
          site.position[0] + sample.x,
          site.position[1] + VILLAGER_GROUND,
          site.position[2] + sample.z,
        );
        group.rotation.y = sample.yaw;
        group.name = site.id;
        model.traverse((o) => {
          if (o instanceof Mesh) {
            o.castShadow = false;
            o.receiveShadow = false;
            o.frustumCulled = false;
            o.raycast = () => {};
          }
        });
        group.add(model);
        // Cheap moving contact shadow. Never invalidate the island's static shadow map.
        const shadow = new Mesh(
          new CircleGeometry(1, 16),
          new MeshBasicMaterial({
            color: "#584e44",
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
          }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.scale.set(0.19, 0.13, 1);
        shadow.position.y = 0.001;
        shadow.raycast = () => {};
        group.add(shadow);
        const mixer = new AnimationMixer(model);
        const actions = Object.fromEntries(
          source.animations.map((clip) => [clip.name, mixer.clipAction(clip)]),
        );
        actions.Idle.play();
        mixer.setTime(0);
        return {
          site,
          model,
          group,
          shadow,
          mixer,
          actions,
          time: 0,
          state: "Idle" as VillagerActivity,
        };
        // Intentional identity key: parent subject arrays can be recreated without restarting clocks.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }),
    [key],
  );
  const [inViewport, setInViewport] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => !document.hidden);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ticks = useRef(0),
    accumulator = useRef(0),
    published = useRef(0);
  const scratch = useMemo(
    () => ({
      frustum: new Frustum(),
      matrix: new Matrix4(),
      sphere: new Sphere(new Vector3(), 0.7),
    }),
    [],
  );
  const active = !paused && !reduced && inViewport && tabVisible;
  const clear = () => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  };
  useEffect(() => {
    const visibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver((entries) =>
            setInViewport(entries[0]?.isIntersecting ?? false),
          );
    if (container) observer?.observe(container);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      observer?.disconnect();
    };
  }, [container]);
  useEffect(() => {
    if (reduced)
      for (const actor of actors) {
        actor.mixer.stopAllAction();
        actor.actions.Idle.reset().play();
        actor.mixer.setTime(0);
        actor.state = "Idle";
      }
    if (container && !active) {
      container.dataset.villagerRunning = "false";
      container.dataset.villagerReason = reduced
        ? "reduced-motion"
        : paused
          ? "paused"
          : !tabVisible
            ? "hidden-tab"
            : "offscreen";
    }
    accumulator.current = 0;
    published.current = 0;
    invalidate();
    return clear;
  }, [active, actors, reduced, invalidate]);
  const liveActorSets = useRef(new WeakSet<object>());
  useEffect(() => {
    const live = liveActorSets.current;
    live.add(actors);
    return () => {
      clear();
      live.delete(actors);
      // StrictMode replays effect setup/cleanup with the SAME memoized rigs.
      // Releasing mixer bindings synchronously corrupts their reusable actions.
      // A real unmount/layout replacement still releases everything this microtask.
      queueMicrotask(() => {
        if (live.has(actors)) return;
        for (const actor of actors) {
          actor.mixer.stopAllAction();
          actor.mixer.uncacheRoot(actor.model);
          actor.model.traverse((o) => {
            if (o instanceof SkinnedMesh) o.skeleton.dispose();
          });
          actor.shadow.geometry.dispose();
          actor.shadow.material.dispose();
        }
      });
      if (container) {
        container.dataset.villagerCount = "0";
        container.dataset.villagerRunning = "false";
      }
    };
  }, [actors, container]);
  useFrame(({ camera }, delta) => {
    scratch.frustum.setFromProjectionMatrix(
      scratch.matrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    accumulator.current += active ? Math.min(delta, 0.1) : 0;
    const step =
      accumulator.current >=
      1 / (compact ? VILLAGER_FPS.compact : VILLAGER_FPS.desktop)
        ? Math.min(0.1, accumulator.current)
        : 0;
    let visible = 0;
    for (const actor of actors) {
      scratch.sphere.center.copy(actor.group.position);
      scratch.sphere.center.y += 0.58;
      actor.group.visible = scratch.frustum.intersectsSphere(scratch.sphere);
      if (!actor.group.visible) continue;
      visible++;
      if (!active || !step) continue;
      actor.time += step;
      const sample = sampleVillager(
        actor.time,
        actor.site.lane,
        actor.site.phase,
      );
      actor.group.position.x = actor.site.position[0] + sample.x;
      actor.group.position.z = actor.site.position[2] + sample.z;
      actor.group.rotation.y = sample.yaw;
      if (sample.state !== actor.state) {
        actor.actions[actor.state].fadeOut(0.25);
        actor.actions[sample.state]
          .reset()
          .setEffectiveTimeScale(1)
          .setEffectiveWeight(1)
          .fadeIn(0.25)
          .play();
        actor.state = sample.state;
      }
      actor.actions.Walk.timeScale = Math.max(0.1, sample.speed / 0.34);
      actor.mixer.update(step);
    }
    if (step) {
      accumulator.current = 0;
      if (active && visible) ticks.current++;
    }
    const now = performance.now();
    if (
      container &&
      (published.current === 0 || now - published.current >= 200)
    ) {
      published.current = now;
      container.dataset.villagerStatus = "ready";
      container.dataset.villagerCount = String(actors.length);
      container.dataset.villagerVisible = String(visible);
      container.dataset.villagerRunning = String(active && visible > 0);
      container.dataset.villagerReason = reduced
        ? "reduced-motion"
        : paused
          ? "paused"
          : !tabVisible
            ? "hidden-tab"
            : !inViewport || !visible
              ? "offscreen"
              : "running";
      container.dataset.villagerTicks = String(ticks.current);
      container.dataset.villagerPoses = JSON.stringify(
        actors.map((a) => ({
          id: a.site.id,
          variant: a.site.variant,
          time: +a.time.toFixed(3),
          state: a.state,
          x: +a.group.position.x.toFixed(3),
          z: +a.group.position.z.toFixed(3),
          leg: +(a.model.getObjectByName("LeftThigh")?.rotation.x ?? 0).toFixed(
            3,
          ),
          arm: +(
            a.model.getObjectByName("LeftUpperArm")?.rotation.x ?? 0
          ).toFixed(3),
        })),
      );
    }
    // One demand-render timer for the whole crowd; no per-person RAF/interval or permanent render loop.
    if (active && visible && timer.current === undefined)
      timer.current = setTimeout(
        () => {
          timer.current = undefined;
          invalidate();
        },
        1000 / (compact ? VILLAGER_FPS.compact : VILLAGER_FPS.desktop),
      );
  });
  return (
    <>
      {actors.map((a) => (
        <primitive key={a.site.id} object={a.group} dispose={null} />
      ))}
    </>
  );
}
export function Villagers(props: Props) {
  return (
    <OptionalArtBoundary onUnavailable={props.onUnavailable}>
      <Suspense fallback={null}>
        <Crowd {...props} />
      </Suspense>
    </OptionalArtBoundary>
  );
}
