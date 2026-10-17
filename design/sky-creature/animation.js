import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
const $ = (s) => document.querySelector(s);
try {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute(
    "aria-label",
    "Animated 3D Aurel. Use motion, pose-time and camera controls to inspect.",
  );
  $("#stage").append(renderer.domElement);
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-7, 7, 5, -5, 0.1, 100),
    controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minZoom = 0.65;
  controls.maxZoom = 3.5;
  const key = new T.DirectionalLight(0xffe7c7, 2.5);
  key.position.set(-6, 10, 9);
  scene.add(key);
  const fill = new T.DirectionalLight(0xc6ebee, 1.4);
  fill.position.set(8, 4, -5);
  scene.add(fill);
  const under = new T.DirectionalLight(0xe3dfbf, 0.8);
  under.position.set(0, -7, 4);
  scene.add(under);
  scene.add(new T.HemisphereLight(0xebf5ff, 0x758f7d, 1.5));
  let activeView = "hero",
    model,
    mesh,
    mixer,
    action,
    helper,
    clipName = "Wingbeat",
    timer = null,
    last = 0,
    playing = true,
    visible = true,
    renderTicks = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const views = {
    hero: { p: [8, 11, 13], target: [0, 0.1, -0.5], width: 11.8 },
    front: { p: [0, 3, 16], target: [0, 0.1, -0.4], width: 12 },
    above: { p: [0, 18, -0.3], target: [0, 0, -0.4], width: 12.4 },
    below: { p: [0, -15, 7], target: [0, 0, -0.4], width: 12 },
    head: { p: [3, 2.1, 6], target: [0, 0.55, 2.1], width: 3.5 },
  };
  function render() {
    rootUpdate();
    renderer.render(scene, camera);
    renderTicks++;
  }
  function rootUpdate() {
    model?.updateMatrixWorld(true);
    mesh?.skeleton.update();
  }
  function resize() {
    let width = views[activeView].width;
    if (innerWidth < 680 && activeView === "hero") width *= 0.92;
    if (activeView !== "head")
      width = Math.max(width, (13 * innerWidth) / innerHeight);
    const height = (width * innerHeight) / innerWidth;
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    render();
  }
  function view(name) {
    activeView = name;
    camera.zoom = 1;
    camera.position.fromArray(views[name].p);
    controls.target.fromArray(views[name].target);
    controls.update();
    document
      .querySelectorAll("[data-view]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.view === name)),
      );
    resize();
  }
  const gltf = await new GLTFLoader().loadAsync(
    "./models/aurel_sky_drake_rigged_v1.glb",
  );
  model = gltf.scene;
  scene.add(model);
  model.traverse((o) => {
    if (o.isSkinnedMesh) {
      mesh = o;
      o.frustumCulled = false;
    }
  });
  if (!mesh) throw Error("Aurel skin was not loaded");
  mixer = new T.AnimationMixer(model);
  helper = new T.SkeletonHelper(model);
  helper.visible = false;
  helper.material.depthTest = false;
  helper.material.transparent = true;
  helper.material.opacity = 0.7;
  scene.add(helper);
  const active = () =>
    playing && !reduced.matches && !document.hidden && visible;
  function status() {
    $("#play").disabled = reduced.matches;
    $("#play").textContent = playing && !reduced.matches ? "Pause" : "Play";
    $("#play").setAttribute(
      "aria-pressed",
      String(playing && !reduced.matches),
    );
    $("#motion-status").textContent = reduced.matches
      ? "Reduced motion · pose controls still work"
      : document.hidden || !visible
        ? "Hidden · motion suspended"
        : `${playing ? "Playing" : "Paused"} · ${clipName}`;
  }
  function clock() {
    if (!action) return;
    $("#time").value = String(action.time);
    $("#time-label").textContent =
      `${action.time.toFixed(1)} / ${action.getClip().duration.toFixed(1)}s`;
  }
  function tick() {
    timer = null;
    if (!active()) return;
    const now = performance.now();
    mixer.update(Math.min((now - last) / 1000, 0.1));
    last = now;
    clock();
    render();
    timer = setTimeout(tick, 1000 / 30);
  }
  function schedule() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    last = performance.now();
    status();
    if (active()) timer = setTimeout(tick, 1000 / 30);
  }
  function play(on) {
    playing = Boolean(on);
    schedule();
  }
  function clip(name) {
    const c = gltf.animations.find((c) => c.name === name);
    if (!c) throw Error("Unknown Aurel clip");
    action?.stop();
    clipName = name;
    action = mixer.clipAction(c);
    action.reset().play();
    mixer.update(0);
    $("#time").max = String(c.duration);
    document
      .querySelectorAll("[data-clip]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.clip === name)),
      );
    clock();
    render();
    schedule();
  }
  function seek(t) {
    action.time = T.MathUtils.clamp(t, 0, action.getClip().duration);
    mixer.update(0);
    clock();
    render();
  }
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.addEventListener("click", () => view(b.dataset.view)));
  document
    .querySelectorAll("[data-clip]")
    .forEach((b) => b.addEventListener("click", () => clip(b.dataset.clip)));
  $("#play").addEventListener("click", () => play(!playing));
  $("#time").addEventListener("input", (e) => {
    play(false);
    seek(Number(e.currentTarget.value));
  });
  $("#bones").addEventListener("click", () => {
    helper.visible = !helper.visible;
    $("#bones").setAttribute("aria-pressed", String(helper.visible));
    render();
  });
  controls.addEventListener("change", render);
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", schedule);
  reduced.addEventListener("change", schedule);
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    schedule();
  });
  observer.observe(renderer.domElement);
  addEventListener("pagehide", () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    observer.disconnect();
  });
  addEventListener("pageshow", () => {
    observer.observe(renderer.domElement);
    schedule();
  });
  const manifest = await fetch("./animation-manifest.json").then((r) => {
    if (!r.ok) throw Error("Missing rig manifest");
    return r.json();
  });
  $("#stats").textContent =
    `${manifest.triangles.toLocaleString()} triangles · ${manifest.bones} bones · 1 mesh / material`;
  $("#loading").remove();
  view("hero");
  clip("Wingbeat");
  window.__skyAnimation = {
    ready: true,
    model,
    mesh,
    mixer,
    helper,
    camera,
    renderer,
    controls,
    clips: gltf.animations,
    clip,
    play,
    seek,
    view,
    render,
    get state() {
      return {
        playing,
        running: active(),
        clip: clipName,
        time: action.time,
        reduced: reduced.matches,
        ticks: renderTicks,
        timer: timer !== null,
      };
    },
  };
} catch (e) {
  console.error(e);
  $("#loading")?.remove();
  const n = document.createElement("div");
  n.className = "error";
  n.setAttribute("role", "alert");
  n.textContent =
    "The animation studio could not load. Use the supplied motion video or complete Blender Script 18 instead.";
  $("main").append(n);
}
