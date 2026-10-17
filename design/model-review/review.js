import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const review = window.__review = { ready: false, errors: [], assets: [], current: null };
const friendly = filename => filename.replace(/\.glb$/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const number = value => value.toLocaleString('en-US');
const kib = bytes => `${(bytes / 1024).toFixed(1)} KiB`;
let renderer, scene, camera, controls, current, grid, origin, entries, lastSelection;
const cache = new Map();
const source = new URLSearchParams(location.search).get('source');
const modelRoot = source === 'original' ? '/original-models/' : source === 'candidate' ? '/candidate-models/' : '/models/';
review.source = source || 'active';
let resetTarget, resetPosition;

function failure(error) {
  const message = String(error?.message || error);
  review.errors.push(message);
  $('error').hidden = false;
  $('error').textContent = '3D review could not finish: ' + message;
  $('status').textContent = 'Review needs attention';
  console.error(error);
}

function fit() {
  if (!current) return;
  current.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(current);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.15);
  const fov = Math.min(THREE.MathUtils.degToRad(camera.fov), 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect));
  const distance = radius / Math.sin(fov / 2) * 1.08;
  camera.position.copy(centre).add(new THREE.Vector3(1, .82, 1.35).normalize().multiplyScalar(distance));
  camera.near = Math.max(distance / 1000, .001);
  camera.far = distance * 100 + 100;
  camera.updateProjectionMatrix();
  controls.target.copy(centre);
  controls.maxDistance = distance * 12;
  controls.minDistance = distance * .10;
  controls.update();
  resetTarget = centre.clone();
  resetPosition = camera.position.clone();
}

function setCurrent(group) {
  if (current) scene.remove(current);
  current = group;
  scene.add(current);
  fit();
}

function selectionClasses(file) {
  document.querySelectorAll('[data-file]').forEach(b => b.classList.toggle('active', b.dataset.file === file));
  $('kit').classList.toggle('active', file === null);
}

function dimensions(bounds) {
  return bounds.max.map((v, i) => (v - bounds.min[i]).toFixed(2)).join(' × ') + ' m';
}

function selectAsset(file) {
  if (!cache.has(file)) throw new Error('Model has not loaded: ' + file);
  const entry = entries.find(e => e.file === file);
  setCurrent(cache.get(file).clone(true));
  lastSelection = file;
  review.current = file;
  $('title').textContent = friendly(file);
  $('category').textContent = entry.kind.replaceAll('_', ' ').toUpperCase();
  $('triangles').textContent = number(entry.triangles);
  $('size').textContent = kib(entry.bytes);
  $('bounds').textContent = dimensions(entry.bounds);
  $('scale').textContent = 'Native scale · metres · Y-up';
  selectionClasses(file);
}

function showKit() {
  if (cache.size !== entries.length) return;
  const group = new THREE.Group();
  for (let i = 0; i < entries.length; i++) {
    const object = cache.get(entries[i].file).clone(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    object.scale.setScalar(2.35 / Math.max(size.x, size.y, size.z));
    object.updateMatrixWorld(true);
    const scaled = new THREE.Box3().setFromObject(object);
    const centre = scaled.getCenter(new THREE.Vector3());
    object.position.set((i % 5 - 2) * 3.15 - centre.x, -scaled.min.y, (Math.floor(i / 5) - 1.5) * 3.15 - centre.z);
    group.add(object);
  }
  setCurrent(group);
  lastSelection = null;
  review.current = 'kit';
  $('title').textContent = 'The complete modular kit';
  $('category').textContent = '20 VERIFIED MODEL FILES';
  $('triangles').textContent = number(entries.reduce((sum, e) => sum + e.triangles, 0));
  $('size').textContent = (entries.reduce((sum, e) => sum + e.bytes, 0) / 1024 / 1024).toFixed(2) + ' MiB total';
  $('bounds').textContent = 'Display layout only';
  $('scale').textContent = 'Pieces scaled to fit · source files unchanged';
  selectionClasses(null);
}

async function main() {
  const manifest = await fetch(modelRoot + 'manifest.json').then(r => { if (!r.ok) throw new Error('Missing manifest'); return r.json(); });
  entries = manifest.assets;
  const canvasHost = $('viewport');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasHost.append(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, .01, 1000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .08;
  scene.add(new THREE.HemisphereLight(0xe3f0ff, 0x675440, 1.6));
  const sun = new THREE.DirectionalLight(0xffefd9, 3.0);
  sun.position.set(6, 10, 8);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xd2e5ff, 1.2);
  fill.position.set(-5, 4, -4);
  scene.add(fill);
  grid = new THREE.GridHelper(20, 20, 0x85998c, 0xb6c9be);
  grid.material.transparent = true;
  grid.material.opacity = .35;
  origin = new THREE.AxesHelper(1.1);
  grid.visible = origin.visible = false;
  scene.add(grid, origin);

  let lastKind;
  for (const entry of entries) {
    if (entry.kind !== lastKind) {
      const heading = document.createElement('h3');
      heading.textContent = entry.kind.replaceAll('_', ' ');
      $('assets').append(heading);
      lastKind = entry.kind;
    }
    const button = document.createElement('button');
    button.className = 'asset';
    button.dataset.file = entry.file;
    const name = document.createElement('span');
    name.textContent = friendly(entry.file).replace(/^Landmark /, '').replace(/^Scenery /, '').replace(/^Topic Plot /, '');
    const size = document.createElement('span');
    size.textContent = Math.round(entry.bytes / 1024) + ' K';
    button.append(name, size);
    button.onclick = () => { try { selectAsset(entry.file); } catch (e) { failure(e); } };
    $('assets').append(button);
  }
  function resize() {
    const width = canvasHost.clientWidth, height = canvasHost.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (current) fit();
  }
  new ResizeObserver(resize).observe(canvasHost);
  resize();
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  $('grid').onclick = () => {
    grid.visible = origin.visible = !grid.visible;
    $('grid').setAttribute('aria-pressed', String(grid.visible));
  };
  $('reset').onclick = () => {
    if (!resetPosition) return;
    camera.position.copy(resetPosition);
    controls.target.copy(resetTarget);
    controls.update();
  };
  $('kit').onclick = showKit;

  const loader = new GLTFLoader();
  let loaded = 0;
  await Promise.all(entries.map(async entry => {
    // Read each complete embedded GLB directly, then parse it. This also checks
    // actual payload size and avoids FileLoader's extra ReadableStream wrapper.
    const response = await fetch(modelRoot + encodeURIComponent(entry.file), { cache: 'no-store' });
    if (!response.ok) throw new Error(entry.file + ': HTTP ' + response.status);
    const payload = await response.arrayBuffer();
    if (payload.byteLength !== entry.bytes) throw new Error(entry.file + ': payload size mismatch');
    const gltf = await loader.parseAsync(payload, '');
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const native = { min: box.min.toArray(), max: box.max.toArray() };
    let triangles = 0, meshes = 0;
    gltf.scene.traverse(object => {
      if (object.isMesh) {
        meshes++;
        const geometry = object.geometry;
        triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
      }
    });
    if (triangles !== entry.triangles) throw new Error(entry.file + ': loaded triangle count mismatch');
    for (const side of ['min', 'max']) {
      if (native[side].some((v, i) => Math.abs(v - entry.bounds[side][i]) > .0001)) {
        throw new Error(entry.file + ': loaded bounds mismatch');
      }
    }
    cache.set(entry.file, gltf.scene);
    review.assets.push({ file: entry.file, triangles, meshes, bounds: native });
    $('status').textContent = `Loaded ${++loaded} / ${entries.length} models`;
  }));
  review.select = selectAsset;
  review.setAngle = (azimuth, elevation) => {
    const distance = camera.position.distanceTo(controls.target);
    camera.position.copy(controls.target).add(new THREE.Vector3(
      Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation),
      Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(distance));
    controls.update();
  };
  review.capture = () => { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); };
  review.showKit = showKit;
  review.metrics = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries, glError: renderer.getContext().getError(), current: lastSelection });
  selectAsset('island_base_01.glb');
  $('status').textContent = '20 / 20 models loaded';
  review.ready = true;
}
main().catch(failure);
