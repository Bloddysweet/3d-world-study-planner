# Model optimization — verified

The original Blender exports are backed up unchanged in
`assets/blender/exports-original/`. The usable files in `public/models/` are now
optimized. Downloadable kit: `deliverables/study-world-optimized-models.zip`.
No Blender source file was changed, and no GitHub branch was pushed.

## Measured results

| Metric | Original | Optimized |
| --- | ---: | ---: |
| Complete kit draw calls (each asset once) | 549 | **129** |
| Raw GLB bytes | 1,609,652 | **1,370,700** |
| Raw GLB size, MiB | 1.54 | **1.31** |
| Triangles | 18,222 | **18,222** |
| Models | 20 | **20** |

That is **76.5% fewer draw calls** and **14.8% fewer raw GLB bytes**.
This is not a claim of equivalent FPS improvement. Browser tests ran in Chromium
153 with software WebGL; actual GPU/mobile performance still needs measurement.
ZIP size depends on compression/layout and is not the raw GLB-size metric above.

## What changed

Used pinned glTF-Transform 4.5.1 to deduplicate equivalent materials and merge
compatible static primitives. No simplification, geometry decimation, quantization,
texture processing or decoder-dependent compression. Already-efficient files are
kept byte-for-byte when rewriting would only add size without saving draw calls.
Assets remain separate files; subjects and topic counts are not baked into a world.

Parts within an individual file may now share a mesh. Do not address original
Blender part-node names in app code; use the GLB filename/root and distinct shader
materials instead. The grass/crystal materials remain distinct for recolouring.
The original filenames, native origin/scale, variants and progress-state meanings
are preserved. No added plugin/decoder is required in the browser.

## Verification

- Checked **all 18,222 triangles** against the original exports, preserving exact
  positions, UVs, triangle winding, multiplicity and per-triangle shader parameters.
- The largest normal-vector rounding difference is **1.19e-07**
  (float noise; allowed threshold 1e-6).
- Compared before/after browser rendering from **two angles per asset** (40 view
  pairs). Worst foreground-pixel fraction differing by more than 4/255 in any
  channel: **0.0222%** (allowed up to 1%).
- Candidate/original SHA-256 hashes tie browser results to the exact published
  binaries. Every GLB also passed manifest, buffer, bounds and rendering checks.
- Negative-control tests reject deliberate geometry, normal, UV, winding, shader
  and duplicate-triangle changes; legitimate merging and tiny normal roundoff pass.
- Publication uses a staging copy and the tested rollback helper. Source backups
  are verified against the pre-optimization SHA-256 baseline.
- A full `npm run optimize` rerun passed, including actual browser draw tests and
  a 390 px layout check. Source backups remain unchanged.

The review loader now reads full GLB payloads with native fetch, checks their byte
lengths, and calls GLTFLoader.parseAsync. This avoids intermittent Chromium
post-read ERR_ABORTED events from FileLoader's extra streaming wrapper. We did not
suppress network failures; repeated final browser tests pass without any.

## Per-model results

| Model | Draw calls: before → after | KiB: before → after |
| --- | ---: | ---: |
| `island_base_01.glb` | 37 → 9 | 67.9 → 52.4 |
| `island_base_02.glb` | 37 → 9 | 68.4 → 52.5 |
| `island_base_03.glb` | 37 → 9 | 67.9 → 52.5 |
| `landmark_maths.glb` | 30 → 10 | 167.3 → 158.6 |
| `landmark_reasoning.glb` | 47 → 9 | 77.6 → 55.0 |
| `landmark_english.glb` | 60 → 13 | 84.3 → 56.8 |
| `landmark_gk.glb` | 12 → 7 | 325.4 → 321.1 |
| `landmark_dsa.glb` | 29 → 8 | 85.3 → 71.7 |
| `landmark_software.glb` | 49 → 12 | 104.2 → 82.0 |
| `topic_plot_not_started.glb` | 5 → 5 | 18.4 → 18.4 |
| `topic_plot_in_revision.glb` | 8 → 6 | 20.9 → 19.9 |
| `topic_plot_ready_for_test.glb` | 9 → 6 | 21.7 → 20.1 |
| `topic_plot_strong.glb` | 61 → 8 | 147.4 → 118.1 |
| `topic_plot_weak.glb` | 6 → 6 | 19.4 → 19.4 |
| `bridge.glb` | 106 → 3 | 252.7 → 201.4 |
| `scenery_tree_round.glb` | 4 → 3 | 11.7 → 11.1 |
| `scenery_tree_pine.glb` | 4 → 3 | 8.6 → 8.0 |
| `scenery_cloud.glb` | 4 → 1 | 10.9 → 9.2 |
| `scenery_rocks.glb` | 3 → 1 | 8.3 → 7.2 |
| `path_stone.glb` | 1 → 1 | 3.3 → 3.2 |

## Download / local installation

Extract `study-world-optimized-models.zip`. Copy its `models` folder into your
Desktop project's `public` folder, replacing the 20 named GLBs and `manifest.json`.
Keep your `.blend` files and raw exports as backups. No Blender rerun is needed.
If you export again with Script 13, that produces raw models: optimize the new
exports again before replacing optimized deployment assets.

## Reproduce (repository tooling, not a new Blender script)

```bash
cd design/model-review
npm ci
npm start
# Separate terminal, same directory; server must stay running:
npm run optimize
```

Stages are also available separately: `optimize:stage`, `optimize:geometry`,
`optimize:browser`, `optimize:publish`. Staging/browser captures are disposable
under `.cache/model-optimization`; original backups and final outputs are durable.
The inspection server reads only local same-origin assets and binds 0.0.0.0:4173.

The archive contains only the 20 optimized GLBs plus `manifest.json`.
Archive SHA-256: `5a5940425a2c989ca1dd6eaf1d314ff362199ade502afe81c8bab1b87f5faf70`.
No planner application implementation was started.
