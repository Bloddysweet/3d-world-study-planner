import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const stage = document.querySelector("#stage");
const error = (message) => {
  document.querySelector("#loading")?.remove();
  const node = document.createElement("div");
  node.className = "error";
  node.setAttribute("role", "alert");
  node.textContent = message;
  document.querySelector("main").append(node);
};
try {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.setAttribute(
    "aria-label",
    "3D Aurel sky drake. Use the named view buttons or drag to orbit.",
  );
  renderer.domElement.setAttribute("role", "img");
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.minZoom = 0.65;
  controls.maxZoom = 3.5;
  controls.enablePan = false;
  const light = new THREE.DirectionalLight(0xffe7c7, 2.5);
  light.position.set(-6, 10, 9);
  scene.add(light);
  const fill = new THREE.DirectionalLight(0xc6ebee, 1.4);
  fill.position.set(8, 4, -5);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xebf5ff, 0x758f7d, 1.5));
  let model,
    active = "hero";
  const views = {
    hero: { position: [8, 11, 13], target: [0, 0.1, -0.5], width: 10.4 },
    front: { position: [0, 3, 16], target: [0, 0.1, -0.4], width: 12 },
    back: { position: [0, 4, -16], target: [0, 0.1, -0.4], width: 12 },
    above: { position: [0, 18, -0.3], target: [0, 0, -0.4], width: 12.4 },
    below: { position: [0, -15, 7], target: [0, 0, -0.4], width: 12 },
    head: { position: [3, 2.1, 6], target: [0, 0.55, 2.1], width: 3.5 },
  };
  function render() {
    renderer.render(scene, camera);
  }
  function resize() {
    const w = innerWidth,
      h = innerHeight;
    let width = views[active].width;
    if (w < 680 && active === "hero") width *= 0.94;
    // Keep the entire model clear of the overlaid header and controls in short windows.
    if (active !== "head") width = Math.max(width, (11.5 * w) / h);
    const height = (width * h) / w;
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    render();
  }
  function view(name) {
    active = name;
    const v = views[name];
    camera.zoom = 1;
    camera.position.fromArray(v.position);
    controls.target.fromArray(v.target);
    camera.up.set(0, 1, 0);
    controls.update();
    document
      .querySelectorAll("[data-view]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.view === name)),
      );
    resize();
  }
  controls.addEventListener("change", render);
  addEventListener("resize", resize);
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.addEventListener("click", () => view(b.dataset.view)));
  document.querySelector("#wire").addEventListener("click", (event) => {
    const on = event.currentTarget.getAttribute("aria-pressed") !== "true";
    event.currentTarget.setAttribute("aria-pressed", String(on));
    model?.traverse((o) => {
      if (o.isMesh) o.material.wireframe = on;
    });
    render();
  });
  view("hero");
  const gltf = await new GLTFLoader().loadAsync(
    "./models/aurel_sky_drake_v1.glb",
  );
  model = gltf.scene;
  scene.add(model);
  const manifest = await fetch("./manifest.json").then((r) => {
    if (!r.ok) throw Error("Missing model manifest");
    return r.json();
  });
  document.querySelector("#stats").textContent =
    `${manifest.triangles.toLocaleString()} triangles · 13 parts · 1 material · ${(manifest.bytes / 1024).toFixed(0)} KiB`;
  document.querySelector("#loading").remove();
  render();
  window.__skyReview = {
    ready: true,
    model,
    camera,
    renderer,
    controls,
    view,
    render,
    animations: gltf.animations.length,
  };
  // Static review: redraw on input/resize only. No perpetual animation loop or application storage.
} catch (e) {
  console.error(e);
  error(
    "The 3D preview could not load. Use the supplied image and complete Blender Script 17 instead.",
  );
}
