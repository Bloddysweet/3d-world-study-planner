> **Optimization update:** The report below records the original upload baseline.
> The deployment files are now optimized: **129 draw calls, 1.31 MiB**, same 20
> assets and triangle count. See [optimization-report.md](optimization-report.md).
> Original measured JSON is preserved in `baseline-*-results.json`.

# Exported model review — passed

Source: `models.zip` in `Bloddysweet/3d-world-study-planner`, downloaded from GitHub
main commit `b6576415a2e6bab799876611743934b560da3484` on 15 October 2026.
No remote files or branches were changed. The upload contains 20 GLBs and a
manifest. Only those 21 files were extracted; no uploaded code was executed.

## Result

- **20/20 models** passed binary/geometry validation and loaded in Three.js.
- Total GLB size: **1,609,652 bytes (1.54 MiB)**.
- Unique exported kit: **18,222 triangles** (not the repeated full world).
- Every file's byte size, triangles, mesh/material counts and actual transformed
  bounds agree with `manifest.json`.
- Native origins/scales are intact: there are no full-world placement offsets.
- The three island profiles have different undersides as intended.
- Embedded binary buffers; no external images, textures or network dependencies.
- No cameras, lights, animation, skinning or demo node metadata in the assets.
- Browser loader and actual WebGL draw tests passed for every model individually
  and the complete kit. No JavaScript, network or WebGL errors were observed.
- The review page also fits a 390 px viewport without horizontal overflow.

Browser checks used headless Chromium 153 with a **software WebGL renderer**.
This verifies loading, geometry and rendering—not GPU/mobile frame-rate guarantees.
A screenshot review of the complete kit and Maths landmark found the expected
parts and colours. The browser setup deliberately uses neutral inspection lighting,
not an exact match to the Blender sky, exposure, lights or shadows.

## Performance note — optimize during integration

The files are small and the triangle budget is modest. However, the exported kit
still has **549 draw calls** when every piece is displayed once.
The bridge alone takes 106 calls; the strong plot 61. Repeating these throughout
the full world would cost more. Merge compatible static pieces by material and
instance repeated props when integrating the actual 3D world. No Blender redo is
required. Do not claim mobile performance from these headless checks.

## File inventory

| Model | KiB | Triangles |
| --- | ---: | ---: |
| `island_base_01.glb` | 67.9 | 570 |
| `island_base_02.glb` | 68.4 | 570 |
| `island_base_03.glb` | 67.9 | 570 |
| `landmark_maths.glb` | 167.3 | 2,038 |
| `landmark_reasoning.glb` | 77.6 | 708 |
| `landmark_english.glb` | 84.3 | 688 |
| `landmark_gk.glb` | 325.4 | 4,964 |
| `landmark_dsa.glb` | 85.3 | 908 |
| `landmark_software.glb` | 104.2 | 1,332 |
| `topic_plot_not_started.glb` | 18.4 | 234 |
| `topic_plot_in_revision.glb` | 20.9 | 240 |
| `topic_plot_ready_for_test.glb` | 21.7 | 242 |
| `topic_plot_strong.glb` | 147.4 | 1,210 |
| `topic_plot_weak.glb` | 19.4 | 236 |
| `bridge.glb` | 252.7 | 3,384 |
| `scenery_tree_round.glb` | 11.7 | 96 |
| `scenery_tree_pine.glb` | 8.6 | 72 |
| `scenery_cloud.glb` | 10.9 | 80 |
| `scenery_rocks.glb` | 8.3 | 60 |
| `path_stone.glb` | 3.3 | 20 |

## What has not been done

No planner application, scheduling, subject editing, localStorage, authentication
or backend was implemented. This is only an asset-inspection page plus validation.
The live **3D model review** preview lets you orbit/zoom individual native-scale
models, or view all 20 pieces together in a scaled display grid.

## Reproduce

```bash
cd design/model-review
npm install
npm run validate
npm start
# In another terminal while the viewer is running:
npm run check
```

Detailed results: `validation-results.json` and `browser-results.json`.
