import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { sampleVillager } from "../../src/domain/villagers.ts";
const canvas = document.querySelector("canvas"),
  renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.outputColorSpace = T.SRGBColorSpace;
const scene = new T.Scene(),
  camera = new T.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 100),
  controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;
controls.minDistance = 1.5;
controls.maxDistance = 28;
scene.add(
  new T.AmbientLight("#e8deef", 0.65),
  new T.HemisphereLight("#fff0db", "#7a8193", 1.8),
);
const key = new T.DirectionalLight("#ffe3bd", 3.2);
key.position.set(-5, 8, 5);
scene.add(key);
const fill = new T.DirectionalLight("#c9cfef", 1.2);
fill.position.set(5, 3, -5);
scene.add(fill);
const loader = new GLTFLoader(),
  actors = [];
let island,
  playing = !matchMedia("(prefers-reduced-motion: reduce)").matches,
  clock = 0,
  raf = 0,
  last = 0;
let clip = "Walk",
  garden = false;
const render = () => {
  renderer.render(scene, camera);
  if (window.villagersReady)
    window.villagerStats = {
      draws: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      bones: actors.map(
        (a) => a.model.getObjectByName("VillagerMesh").skeleton.bones.length,
      ),
      time: clock,
      clip,
      poses: actors.map((a) => ({
        leg: a.model.getObjectByName("LeftThigh").rotation.x,
        arm: a.model.getObjectByName("LeftUpperArm").rotation.x,
        head: a.model.getObjectByName("Head").rotation.y,
      })),
    };
};
function pose(time) {
  clock = time;
  actors.forEach((a, i) => {
    a.mixer.setTime(time + (garden ? i * 0.3 : 0));
    if (garden) {
      const p = sampleVillager(time, i % 2, i * 18);
      a.group.position.set(p.x, 0.305, p.z);
      a.group.rotation.y = p.yaw;
    }
  });
  render();
}
function schedule() {
  if (playing && !document.hidden && !raf) raf = requestAnimationFrame(frame);
}
function frame(now) {
  raf = 0;
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
  last = now;
  pose(clock + dt);
  document.querySelector("#time").value =
    clock % actors[0].actions[clip].getClip().duration;
  schedule();
}
function play(value) {
  playing = value;
  document.querySelector("#play").textContent = value ? "Pause" : "Play";
  document.querySelector("#play").setAttribute("aria-pressed", String(value));
  if (!value) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  last = 0;
  schedule();
}
function setClip(name) {
  clip = name;
  for (const a of actors) {
    a.mixer.stopAllAction();
    a.actions[name].reset().play();
  }
  document.querySelector("#time").max =
    actors[0].actions[name].getClip().duration;
  pose(0);
}
function view() {
  if (garden) {
    camera.position.set(10, 8, 14);
    controls.target.set(0, -0.3, 0);
    actors.forEach((a, i) => (a.group.visible = i < 2));
    island.visible = true;
  } else {
    const factor = innerWidth < 600 ? 1.7 : 1;
    camera.position.set(1.7 * factor, 1.6 * factor, 4.4 * factor);
    controls.target.set(0, 0.57, 0);
    actors.forEach((a, i) => {
      a.group.visible = true;
      a.group.position.set((i - 1) * 0.8, 0, 0);
      a.group.rotation.y = -0.04;
    });
    island.visible = false;
  }
  controls.update();
  pose(clock);
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  view();
}
for (const variant of ["scout", "reader", "gardener"]) {
  const gltf = await loader.loadAsync(`/models/villager_${variant}_v1.glb`),
    group = new T.Group();
  group.add(gltf.scene);
  scene.add(group);
  const mixer = new T.AnimationMixer(gltf.scene),
    actions = Object.fromEntries(
      gltf.animations.map((c) => [c.name, mixer.clipAction(c)]),
    );
  actors.push({ group, model: gltf.scene, mixer, actions });
}
island = (await loader.loadAsync("/models/island_maths_v2.glb")).scene;
scene.add(island);
window.villagersReady = true;
setClip("Walk");
resize();
play(playing);
controls.addEventListener("change", render);
addEventListener("resize", resize);
document.querySelector("#play").onclick = () => play(!playing);
document.querySelector("#clip").onchange = (e) => setClip(e.target.value);
document.querySelector("#time").oninput = (e) => {
  play(false);
  pose(Number(e.target.value));
};
document.querySelector("#scene").onchange = (e) => {
  garden = e.target.value === "garden";
  view();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
  } else {
    last = 0;
    schedule();
  }
});
window.villagerReview = {
  seek: (t) => {
    play(false);
    pose(t);
  },
  play,
  clip: (name) => {
    document.querySelector("#clip").value = name;
    setClip(name);
  },
};
document.querySelector("#status").textContent =
  "3 skinned meshes · 14 bones each\n4 real animation clips per character";
