import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
const canvas = document.querySelector("canvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 150);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, -0.3, 0);
controls.minDistance = 10;
controls.maxDistance = 34;
controls.maxPolarAngle = Math.PI * 0.8;
controls.enableDamping = false;
scene.add(
  new THREE.AmbientLight("#e8deef", 0.65),
  new THREE.HemisphereLight("#fff0db", "#7a8193", 1.8),
);
const key = new THREE.DirectionalLight("#ffe3bd", 3.2);
key.position.set(-22, 35, 18);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, {
  left: -35,
  right: 35,
  top: 35,
  bottom: -35,
  far: 110,
});
key.shadow.normalBias = 0.035;
key.shadow.bias = -0.0001;
scene.add(key);
const fill = new THREE.DirectionalLight("#c9cfef", 1.2);
fill.position.set(20, 8, -25);
scene.add(fill);
function render() {
  renderer.render(scene, camera);
  if (window.artReady) {
    const m = renderer.info;
    window.artStats = {
      calls: m.render.calls,
      triangles: m.render.triangles,
      geometries: m.memory.geometries,
      textures: m.memory.textures,
    };
    document.querySelector("#status").textContent =
      `${m.render.triangles.toLocaleString()} triangles · ${m.render.calls} draws\nStatic, demand-rendered geometry`;
  }
}
function view(name = "front") {
  const directions = {
    front: [11, 9, 15],
    back: [-11, 9, -15],
    side: [16, 6, -1],
    top: [0, 20, 0.01],
  };
  const p = directions[name];
  const factor = innerWidth < 600 ? 1.3 : 1;
  camera.position.set(...p.map((v) => v * factor));
  controls.target.set(0, -0.3, 0);
  controls.update();
  render();
}
function size() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  view();
}
controls.addEventListener("change", render);
addEventListener("resize", size);
document
  .querySelectorAll("[data-view]")
  .forEach((b) => b.addEventListener("click", () => view(b.dataset.view)));
document.querySelector("#wireframe").addEventListener("click", () => {
  scene.traverse((o) => {
    if (o.isMesh) o.material.wireframe = !o.material.wireframe;
  });
  render();
});
size();
const themeSelect = document.querySelector("#art-theme");
const themes = [...themeSelect.options].map((o) => o.value);
let currentModel,
  loadTicket = 0;
async function loadTheme(theme) {
  const ticket = ++loadTicket;
  window.artReady = false;
  document.querySelector("#status").textContent = "Loading the actual GLB…";
  const dispose = (model) =>
    model.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  try {
    const gltf = await new GLTFLoader().loadAsync(
      `/models/island_${theme}_v2.glb`,
    );
    if (ticket !== loadTicket) {
      dispose(gltf.scene);
      return;
    }
    if (currentModel) {
      scene.remove(currentModel);
      dispose(currentModel);
    }
    currentModel = gltf.scene;
    currentModel.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(currentModel);
    renderer.shadowMap.needsUpdate = true;
    window.artTheme = theme;
    window.artReady = true;
    document.querySelector("h1").textContent =
      themeSelect.selectedOptions[0].textContent + " island";
    view();
  } catch (error) {
    if (ticket === loadTicket)
      document.querySelector("#status").textContent =
        "Model could not be loaded.";
    throw error;
  }
}
themeSelect.value = themes.includes(
  new URLSearchParams(location.search).get("theme"),
)
  ? new URLSearchParams(location.search).get("theme")
  : "maths";
themeSelect.addEventListener("change", () => {
  history.replaceState(null, "", `?theme=${themeSelect.value}`);
  loadTheme(themeSelect.value);
});
await loadTheme(themeSelect.value);
// Deliberately no requestAnimationFrame loop; resize and real interaction draw on demand.
