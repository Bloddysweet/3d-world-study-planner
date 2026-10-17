# All seven subject islands — artwork v2

Mathematics was approved first. The user then authorized extending the artwork to **all designs at once**. This rollout is now implemented across `maths`, `reasoning`, `english`, `gk`, `dsa`, `software` and `generic` (custom subjects). These are real meshes used by the app, never pictures substituted for its 3D scene. Animated villagers are now implemented as a separate runtime layer; see `../villagers/README.md`.

## Art direction and budgets

The islands share the approved functional garden layout: six clear front topic footprints, rear landmark terraces, planted groves, flagstones, a banked stream/footbridge, waterfall and faceted hanging rock. New themes have individually authored landmarks, planting palettes, rock colours, deterministic outline variation and cliff depths. DSA has a conifer grove; English has autumn-coloured broadleaf planting. This is stylized low-poly artwork, not an exact concept-art reproduction or physically simulated glass/water.

| Theme | Landmark / planting | Triangles | Opaque batches | GLB bytes |
| --- | --- | ---: | ---: | ---: |
| Mathematics | Approved crystal and walnut/brass abacus | 15,092 | 11 | 1,144,080 |
| Reasoning | Turning inlaid logic cubes, miniature hedge maze | 13,114 | 11 | 964,444 |
| English | Stacked books, open pages, reading lamp, autumn grove | 13,627 | 10 | 995,852 |
| General Knowledge | Globe with simplified continents, meridian, compass terrace | 15,657 | 11 | 1,127,916 |
| DSA | Binary-tree node monument, evergreen grove | 14,643 | 11 | 1,009,504 |
| Software | Code workbench, geometric code brackets, small roofed studio | 13,144 | 10 | 962,908 |
| Generic / custom | Potted seedling monument, planted arbor, quiet bench | 13,588 | 9 | 984,008 |

The generated manifest is authoritative for byte counts and hashes. Every island is below 16,000 triangles / 1.3 MB, with no textures, external resources, decoder dependencies, skins or animation tracks. Batches are static and opaque. Compact normalized 8-bit vertex colours and welded identical position/normal/colour tuples retain the faceted edges. Assets are loaded by theme, not subject ID; multiple subjects with the same theme share loaded geometry/materials through the existing cache.

Mathematics remains **byte-for-byte unchanged**: SHA256 `7afdf158c4dc3f09660286778153402ba08b6cfc2e688e3aa55417cd52184b42`. The 20 legacy deployment assets, original backups and earlier Blender scripts are preserved. The old optimization/publishing workflow and `deliverables/study-world-optimized-models.zip` still describe the legacy kit, not these new GLBs.

Topic plots are **not baked into the models**. The app still renders real evidence states, selection, labels, tasks and six-plot paging. Landmark crystals, graph nodes, trees and seedlings are decoration, not earned progress. The shared surface remains at Y=0.24. Water remains static. Villagers are not baked into these island assets; the app now adds them separately (see `../villagers/README.md`). The GK globe is decorative, with simplified authored continent silhouettes, not an authoritative map.

## Deliverables and source

- `public/models/island_{theme}_v2.glb` — seven runtime assets, selected by `src/domain/island-art.ts`.
- `public/models/{theme}-art-v2.json` / `island-art-v2.json` — individual and aggregate generated hashes, bounds and budgets.
- `scripts/build-all-islands.mjs` — complete reproducible build and Script 15 delivery.
- `scripts/build-maths-island.mjs` — shared deterministic mesh/landscaping generator; defaults to the approved Mathematics asset. Accepts one supported theme as its argument.
- `scripts/art/theme-profiles.mjs` / `theme-landmarks.mjs` — authored palettes, seeds, terrain differences, planting and unique landmark geometry.
- `assets/blender/scripts/15_all_subject_art_islands.py` — **ONE complete offline Blender file for all seven islands**, independent of earlier scripts.
- `assets/blender/scripts/14_maths_art_island.py` — preserved complete Maths-only delivery.
- `design/islands/all-themes-overview.png` / `all-themes.html` — overview of actual GLB renders, with links to the interactive reviewer.
- `design/islands/{theme}-v2-render.png` — clean, actual WebGL front render of each asset.
- `design/islands/review.html` / `review.js` — optional dev reviewer with theme selector, front/back/side/above, wireframe and orbit. `?theme=english` selects a specimen. Old model geometry/materials are disposed on theme changes; no continuous animation loop. Browser-facing URLs are same-origin.

## Reproduce and validate

```sh
npm ci
npm run art:all
npm run test:art-assets
npm run build
npm test

# Optional browser tooling:
npm --prefix design/model-review ci
# In separate terminals, keep these running:
npm run dev
npm run preview -- --port 5175
# Then:
npm run test:art
npm run test:maths
APP_URL=http://127.0.0.1:5175 npm run test:world
APP_URL=http://127.0.0.1:5175 npm run test:browser
npm run test:preview
```

`APP_URL` overrides the built app URL, `ART_URL` the reviewer URL. `test:preview` intentionally targets the development server's embedded toolbar. Shell environment syntax above is for a POSIX terminal; Windows users can use their shell's environment-variable syntax. `npm run art:maths` and the Maths-only test commands remain supported. Build commands regenerate the known repository outputs; neither downloadable Blender script automatically writes files on the user's computer.

### Latest verified results

- Production build / strict TypeScript and **106 unit tests** passed.
- All seven GLBs parsed with matching hashes, finite attributes, budgets and no external dependencies. **2,058 downward ray samples** (294 per island) verify the six complete radius-0.6 topic footprints remain unobstructed and level.
- Every expanded GLB triangle corner matches Script 15's embedded positions to rounding tolerance, and every colour re-quantizes to the exact GLB byte. Tests account for glTF's interleaved/padded colour attributes. Python compilation and no-automatic-save/export/delete safety checks passed for both scripts. Approved Maths and all 20 original asset hashes are unchanged.
- **24 all-theme browser groups** passed: actual front/back/side WebGL renders and exact draw/triangle counts for every profile; theme switching/disposal; thirteen dynamic subjects across 12-island groups; every custom-themed garden's six-plus-two topic paging and selection; every profile at 320/390/430px under reduced motion; non-Maths model failure / usable Today recovery; unchanged stored study data.
- **4 Maths + 12 immersive World + 23 core workflow + 5 embedded-preview groups** rerun and passed. With the 24 new groups, **68 current browser check groups** passed. World coverage retains full 360°, bounded centre-only zoom, native edge scroll, actual evidence states/deep links/paging and recovery. Preview controls resize the same live app without losing drafts/dialogs/data.
- Actual front renders, rear/side renders, desktop and phone app screenshots inspected. Durable front renders/overview live here; detailed results and regression screenshots are under ignored `.cache/island-art/`, `.cache/maths-art/`, `.cache/world-check/`, `.cache/app-check/` and `.cache/preview-check/`.

Isolated per-island main-pass draw counts are **not** a full-world performance budget or physical-phone FPS measurement. Chromium software-renderer/CSS-viewport tests do not certify real iOS/Android/Safari/Firefox hardware. Other dedicated page/header/icon/workspace/exam/axe suites retain their previously recorded results; they were not rerun in this artwork rollout. No scheduler, parser, exam, persistence schema or backend changes were made.

## Blender 5.2 — one complete file, beginner steps

You do **not** need to run Script 14 or earlier files first.

1. Download **`15_all_subject_art_islands.py`** into:
   `C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts`
   (The downloadable repository source is under `assets/blender/scripts`; your local working folders are the Windows paths here.)
2. Open Blender. Choose **Scripting → Text → Open**, select the script, then click **Run Script**. No paths need editing; no add-ons/downloads/external files are needed.
3. Switch to **Layout** to orbit the seven islands. A new scene named `Study World - All Art Islands v2` is created on every run. Your earlier scenes and manual work remain untouched. **Render → Render Image** uses the all-island camera.
4. Use **File → Save As** manually:
   `C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_all_art_v2.blend`
   Choose a fresh name if that file exists. The script does **not** save or export automatically.

Each island has a separate `SW15_{theme}_EXPORT` collection and root. Roots are offset to arrange the seven islands for viewing; the mesh local coordinates are the website coordinates converted from Three (X,Y,Z) to Blender (X,-Z,Y). Surface Z=0.24 metres. Camera/lights are in `SW15_Presentation_DO_NOT_EXPORT`, not in an island collection. The script uses available engine enums, preferring `BLENDER_EEVEE` (supported in the user's Blender 5.2), then Cycles/Workbench.

**Blender 5.2 application execution/rendering has not been tested in this sandbox.** Python syntax, payload/mesh correspondence and safety checks passed; the matching GLBs were independently loaded and rendered in Chromium. Local Blender execution remains the user's verification step. Script 14 stays available for the already-approved Maths-only scene, using its original `study_world_maths_art_v2.blend` manual Save As path.


**Subsequent stage:** the image overview records the art-only milestone before people were added. Current animated-character preview, Script 16 and runtime details are in `design/villagers/README.md`; the island models/budgets here remain unchanged.
