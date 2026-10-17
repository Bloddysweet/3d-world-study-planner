// Stage a reversible, non-lossy merge of static GLB parts. Does not publish results.
import { NodeIO, PropertyType, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, join } from '@gltf-transform/functions';
import { mkdir, readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const active = path.join(root, 'public/models');
const originals = path.join(root, 'assets/blender/exports-original');
const staged = path.join(root, '.cache/model-optimization/staged');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async file => { try { await access(file); return true; } catch { return false; } };
const sourceManifestPath = path.join(originals, 'manifest.json');

await mkdir(originals, { recursive: true });
if (!(await exists(sourceManifestPath))) {
  const input = JSON.parse(await readFile(path.join(active, 'manifest.json'), 'utf8'));
  if (input.optimization || input.generator !== 'study-world-step-13-v1' || input.assets.length !== 20) {
    throw new Error('Cannot create original backup from already optimized or unexpected models. Restore the original export first.');
  }
  // Manifest is the final backup-complete marker. Retry interrupted backups safely.
  for (const asset of input.assets) {
    if (path.basename(asset.file) !== asset.file || asset.file.includes('\\')) throw new Error('Unsafe asset filename');
    const bytes = await readFile(path.join(active, asset.file));
    if (bytes.length !== asset.bytes) throw new Error('Source size mismatch: ' + asset.file);
    const target = path.join(originals, asset.file);
    if (await exists(target)) {
      if (hash(await readFile(target)) !== hash(bytes)) throw new Error('Original backup already differs: ' + asset.file);
    } else await writeFile(target, bytes, { flag: 'wx' });
  }
  await copyFile(path.join(active, 'manifest.json'), sourceManifestPath);
}
for (const file of ['browser-results.json', 'validation-results.json']) {
  const baseline = path.join(here, 'baseline-' + file);
  if (!(await exists(baseline))) await copyFile(path.join(here, file), baseline);
}
const manifest = JSON.parse(await readFile(sourceManifestPath, 'utf8'));
if (manifest.optimization || manifest.assets.length !== 20) throw new Error('Invalid original manifest');
const baseline = JSON.parse(await readFile(path.join(here, 'baseline-validation-results.json'), 'utf8'));
const originalHashes = new Map(baseline.assets.map(asset => [asset.file, asset.sha256]));
await mkdir(staged, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const summary = [];
for (const asset of manifest.assets) {
  const source = path.join(originals, asset.file);
  const bytes = await readFile(source);
  if (bytes.length !== asset.bytes || hash(bytes) !== originalHashes.get(asset.file)) {
    throw new Error('Original backup differs from its verified pre-optimization baseline: ' + asset.file);
  }
  const document = await io.read(source);
  document.setLogger(new Logger(Logger.Verbosity.SILENT));
  // Materials with equivalent shader parameters may be shared. No flattening,
  // quantization, simplification, normal generation, welding, or texture changes.
  await document.transform(
    dedup({ propertyTypes: [PropertyType.MATERIAL] }),
    join({ keepNamed: false, keepMeshes: false }),
  );
  let output = await io.writeBinary(document);
  const jsonSize = Buffer.from(output).readUInt32LE(12);
  let gltf = JSON.parse(Buffer.from(output).subarray(20, 20 + jsonSize).toString());
  const originalJSON = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const primitives = doc => doc.meshes.reduce((sum, mesh) => sum + mesh.primitives.length, 0);
  // Keep small already-efficient files byte-for-byte if rewriting would add size
  // without reducing draws. Optimize the kit, not an arbitrary file-size score.
  if (output.length >= bytes.length && primitives(gltf) >= primitives(originalJSON)) {
    output = bytes;
    gltf = originalJSON;
  }
  const beforeCalls = asset.meshCount; // Real baseline primitive/draw counts are in browser report.
  asset.originalSha256 = hash(bytes);
  asset.sha256 = hash(output);
  asset.bytes = output.length;
  asset.meshCount = gltf.meshes.length;
  asset.materialCount = gltf.materials.length;
  await writeFile(path.join(staged, asset.file), output);
  summary.push({ file: asset.file, beforeBytes: bytes.length, afterBytes: output.length,
    beforeMeshes: beforeCalls, afterMeshes: gltf.meshes.length, sha256: asset.sha256 });
  console.log(`${asset.file}: ${bytes.length} -> ${output.length} bytes; ${beforeCalls} -> ${asset.meshCount} meshes`);
}
manifest.optimization = {
  tool: 'glTF-Transform 4.5.1', recipe: 'dedup(MATERIAL), join(static compatible primitives)',
  lossy: false, originals: 'assets/blender/exports-original',
  note: 'Submesh/part names are not stable after merging. Asset filenames and material names remain available. Grass and crystal materials remain distinct for recolouring.',
};
await writeFile(path.join(staged, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(root, '.cache/model-optimization/stage-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log('STAGED ONLY:', staged, '\nValidate geometry/material equivalence and browser rendering BEFORE publishing.');
