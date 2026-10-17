# Blender build — one script at a time

## Step 01: floating island base

Script: `scripts/01_build_island_base.py`

This first script creates just one reusable grassy floating island, with a
faceted rock underside and a few small rim decorations. The middle is left clear
for future landmarks and dynamic topic plots. It is not the complete world yet.

### Local folders

Inside your Desktop `3d-world-study-planner` folder, create:

```text
assets/blender/scripts/
assets/blender/source/
assets/blender/previews/
```

Download the script into `assets/blender/scripts/`. Some browsers append `.txt`;
make sure the actual filename ends in `.py`, not `.py.txt`.

### Run

1. Use Blender 4.2 or newer. Check **Help > About Blender** if unsure.
2. Open Blender, then the **Scripting** workspace. If a welcome screen is open,
   dismiss it first. A new General file is fine.
3. In the Text Editor, choose **Text > Open** and open the downloaded `.py`.
4. Choose **Text > Run Script** (or click the triangle Run Script button).
5. Switch to **Layout**. The script has activated a separate scene named
   `Study World - Step 01`. Your original scene is preserved.
6. Use **Render > Render Image** to see the lit preview. The initial viewport
   uses flat material colours; it is not the final lighting.
7. Choose **File > Save As** and save as:
   `assets/blender/source/study_world_island_base.blend`.
8. Send a screenshot of the result before moving to Script 02.

If you need to inspect the island, middle-mouse drag orbits, the scroll wheel
zooms, and Shift + middle-mouse drag pans. Numpad 0 returns to camera view.

### Safety and limitations

- Creates its own scene; does not delete the default scene or unrelated work.
- Re-running replaces the generated objects in its own scene. Save any manual
  edits separately first. If you add unowned objects to that scene, the script
  refuses to rebuild it, to avoid deleting them.
- Does not automatically save, export, install add-ons, or access the internet.
- The exportable mesh collection is `SW01_Island_Base_EXPORT`.
- Camera and lights are in `SW01_Presentation_DO_NOT_EXPORT`.
- Flat land surface: Z = 0.24 m. Radius: approximately 4.6 m.
- No fixed six-island layout, text labels, topic plots or website code yet.
- Written for Blender 4.2+ APIs. Syntax checked in the sandbox. A Blender 4.5.3
  Python runtime test could not start because the sandbox lacks required Linux
  graphics libraries (first missing library: `libXrender.so.1`). Therefore actual
  Blender execution and visual appearance still need verification on your computer.

The eventual shared library will be `study_world_assets.blend` and the assembled
world will be `study_world_preview.blend`. This step's file is the first checkpoint,
not a replacement for those final files.

## Step 02: five topic-progress plots

Script: `scripts/02_build_topic_plots.py`

1. Save Step 01 as `source/study_world_island_base.blend` first.
2. With that file open, use Scripting > Text > Open to open the Step 02 script.
3. Choose Text > Run Script, then switch to Layout.
4. The new `Study World - Step 02` scene shows five plots, left to right:
   Not started, In revision, Ready for test, Strong, Weak.
5. Render > Render Image gives the lit preview; viewport colours are not final lighting.
6. Save As `source/study_world_topic_plots.blend`. This new file contains both
   scenes if you started from the saved Step 01 file; the old checkpoint remains.
7. Send a screenshot before continuing.

Each state uses a separate export collection and a root empty. State roots are
spaced apart for inspection only. Exporters must recenter the root before export.
The future app shows one state per topic, not all five at once. Status is not
stored in the Blender file as the source of truth; the application will select
the appropriate model from actual study progress.

Step 02 hides viewport overlays (camera/light guides) for a clean view. Use the
Viewport Overlays button to turn them on again when editing. Crystal emission is
included, but this script does not add a bloom compositor effect. Syntax checked;
actual Blender execution/visual verification awaits the user's screenshot.

## Step 03: Maths landmark

Script: `scripts/03_build_maths_landmark.py`

1. Save Step 02 first. Keep `study_world_topic_plots.blend` open.
2. Open Step 03 in the Scripting Text Editor, then Text > Run Script.
3. Switch to Layout or use Render > Render Image.
4. Inspect the blue crystal obelisk and four-row wooden abacus.
5. Save As `source/study_world_maths_landmark.blend`.
6. Send a screenshot before continuing.

Creates the separate scene `Study World - Step 03`. The previous scenes are
unchanged. The exportable landmark collection is `SW03_Landmark_Maths_EXPORT`;
its root empty is `SW03_Maths_ROOT`. The landmark base rests at Z=0; a later
assembly step will place it on the island at Z=0.24. Do not move the individual
pieces onto the island manually. Camera and lights are not export assets.

Re-running replaces generated objects only in this step's scene. As in the other
scripts, added unowned objects stop the rebuild. Manual edits to generated
objects are not protected against rebuilding; save a separate copy first.
Syntax checked in the sandbox; Blender runtime/visual verification awaits the
user's screenshot. Uses the same Eevee engine-name compatibility fix as Step 02.

## Step 04: Reasoning landmark

Script: `scripts/04_build_reasoning_landmark.py`

1. Save Step 03 first; keep `study_world_maths_landmark.blend` open.
2. Open Step 04 in the Scripting Text Editor, then Text > Run Script.
3. Switch to Layout or choose Render > Render Image.
4. Inspect the miniature hedge maze and three purple puzzle cubes.
5. Save As `source/study_world_reasoning_landmark.blend`.
6. Send a screenshot before continuing.

Creates `Study World - Step 04`, leaving previous scenes unchanged. Export
collection: `SW04_Landmark_Reasoning_EXPORT`. Root: `SW04_Reasoning_ROOT`.
The small gaps between the three cubes are intentional levitation, not missing
supports. The maze and cubes are decorative landmarks, not interactive puzzles.
All pieces will be assembled onto the island by a later script, not by hand.

Safety behaviour matches Step 03: reruns replace generated objects in this
step's scene; added unowned objects stop rebuilding. Save separately before
manually editing generated pieces. No automatic file writes or exports.
Syntax checked; Blender runtime/visual verification awaits the user's screenshot.

## Step 05: English & Vocabulary landmark

Script: `scripts/05_build_english_landmark.py`

1. Save Step 04 first; keep `study_world_reasoning_landmark.blend` open.
2. In Scripting > Text > Open, open Step 05, then Text > Run Script.
3. Switch to Layout; choose Render > Render Image for the lit preview.
4. Inspect five closed books, the open book on top, and the red bookmark.
5. Save As `source/study_world_english_landmark.blend`.
6. Send a screenshot before continuing.

Creates separate scene `Study World - Step 05`. Previous scenes are unchanged.
Export collection: `SW05_Landmark_English_EXPORT`. Root: `SW05_English_ROOT`.
Each closed book has a nested root for its slight rotation. All nested roots
and meshes belong to the same export collection and descend from the main root.
The platform bottom rests at Z=0; later assembly places it on the island.
No text labels or external fonts are used: page markings are decorative lines.

Rebuilding replaces this scene's generated objects; it stops if unowned objects
were added. Save a separate copy before manually editing generated pieces.
Nothing is saved/exported automatically. Syntax checked; Blender runtime and
appearance await verification from the user's screenshot.

## Step 06: GK & GS globe landmark

Script: `scripts/06_build_gk_landmark.py`

1. Save Step 05; keep `study_world_english_landmark.blend` open.
2. Open Step 06 via Scripting > Text > Open, then Text > Run Script.
3. Switch to Layout; use Render > Render Image for the lit preview.
4. Inspect the teal globe, green continents, brass meridian frame and stand.
5. Save As `source/study_world_gk_landmark.blend`.
6. Send a screenshot before continuing.

Creates separate scene `Study World - Step 06`. Previous scenes are unchanged.
Export collection: `SW06_Landmark_GK_EXPORT`. Root: `SW06_GK_ROOT`.
The nested `SW06_Tilted_Globe_ROOT` tilts the globe, its latitude rings, and its
axial pin together. All asset geometry descends from the main root. The base
rests at Z=0; the later assembly script handles placement onto the island.

Continent silhouettes are deliberately approximate, generated from small custom
polygons and coloured mesh faces. This is decorative art, not an accurate atlas
or an educational map. No external geography datasets or textures are needed.

Rebuild safety and manual-edit cautions match earlier scripts. No automatic
saving/exporting. Python syntax and pure point-in-polygon helper checks passed;
actual Blender execution and appearance await the user's screenshot.

## Step 07: DSA node-tree landmark

Script: `scripts/07_build_dsa_landmark.py`

1. Save Step 06; keep `study_world_gk_landmark.blend` open.
2. Open Step 07 using Scripting > Text > Open, then Text > Run Script.
3. Switch to Layout; choose Render > Render Image for the lit preview.
4. Inspect seven green nodes connected by six branching edges, plus the trunk,
   small decorative leaves, and root supports.
5. Save As `source/study_world_dsa_landmark.blend`.
6. Send a screenshot before continuing.

Creates separate scene `Study World - Step 07`. Prior scenes are unchanged.
Export collection: `SW07_Landmark_DSA_EXPORT`. Root: `SW07_DSA_ROOT`.
The binary tree grows upward: graph root at the bottom, four leaf nodes at the
upper ends. The trunk and five root supports are scenery, not graph edges.
This is a decorative DSA landmark, not an interactive algorithm visualization.
The platform bottom is at Z=0; later assembly places it onto the island.

Node materials include modest emission, but the script does not add bloom or
halos. Viewport solid colours will differ from the rendered lighting.
Rebuild safety and manual-edit cautions match the previous steps. No automatic
saving/exporting. Syntax, namespace, and seven-node binary-tree topology checks
passed; actual Blender runtime and appearance await the user's screenshot.

## Step 08: Software Development workshop

Script: `scripts/08_build_software_landmark.py`

1. Save Step 07; keep `study_world_dsa_landmark.blend` open.
2. Open Step 08 using Scripting > Text > Open, then Text > Run Script.
3. Switch to Layout; choose Render > Render Image for the lit preview.
4. Inspect the open-front workshop, computer, keyboard and two gears.
5. Save As `source/study_world_software_landmark.blend`.
6. Send a screenshot before continuing.

Creates separate scene `Study World - Step 08`. Previous scenes are unchanged.
Export collection: `SW08_Landmark_Software_EXPORT`. Root: `SW08_Software_ROOT`.
The platform bottom is at Z=0. Assembly onto islands comes later; no manual
placement is needed. Screen markings are decorative mesh strips, not real text
or an interactive UI. The gears are decorative, not a mechanically meshing pair.
All materials are opaque, with no external fonts, textures, or add-ons required.

Rebuild safety matches prior steps. Save separately before manually editing
generated objects. No automatic saving/exporting. Syntax, namespace, and closed
gear-mesh/winding checks passed; Blender execution and appearance still need the
user's screenshot for verification.

## Step 09: assemble the Maths island preview (updated file-loading version)

Script: `scripts/09_assemble_maths_island.py`

1. Put these three saved checkpoints in `assets/blender/source/`:
   - `study_world_island_base.blend`
   - `study_world_topic_plots.blend`
   - `study_world_maths_landmark.blend`
2. Open `study_world_software_landmark.blend` from that same source folder.
   It no longer needs to contain all previous scenes.
3. Download/open the updated Step 09 script in the Scripting Text Editor, then
   Text > Run Script. Opening the updated file matters: Blender does not reload
   an already-open text block just because the downloaded disk file changed.
4. Switch to Layout; choose Render > Render Image.
5. Save As `source/study_world_maths_island_preview.blend`.
6. Send a screenshot before continuing.

When source collections are missing, the script reads the three sibling .blend
files and appends only the required collections. Imported assets are retained in
an additional scene named `Study World - Imported Sources`. Original disk files
are not modified. If the source files are elsewhere, use the optional
`SOURCE_FOLDER_OVERRIDE` setting at the top of the script. Normally leave it empty.
File existence and library collection names are checked before rebuilding an old
preview. Clear errors identify missing files or incorrectly saved checkpoints.

Creates separate preview scene `Study World - Step 09`, with collection
`SW09_Maths_Island_PREVIEW`. Copies objects and mesh data, leaving original
collections/meshes unchanged. Original materials are shared but not modified.
Cameras/lights from source scenes are not copied. Plot showcase offsets are reset
before placement, including when Blender has renamed imported root objects.

Seven plots and their progress states are demo data only, not a topic limit.
Topic names, percentages and due labels will be website overlays later. The
preview is not a monolithic game asset; reusable pieces will be exported later.

Rebuild safety matches earlier steps. Manual changes to generated objects are
replaced on rerun; save a separate copy first. No automatic saves or exports.
Syntax, state coverage, spacing and footprint checks passed. Mocked library tests
cover unsaved-file guidance, missing-file preflight, appending seven collections,
and avoiding duplicate imports on rerun. Actual Blender library loading and
visual assembly still require verification on the user's computer.

## Step 10: rope bridge and scenery kit

Script: `scripts/10_build_scenery_kit.py`

1. Save the successful Step 09 preview first.
2. Keep that file open; use Scripting > Text > Open to open Step 10.
3. Text > Run Script, then Layout > Render > Render Image.
4. Inspect one rope bridge, a round tree, a pine tree, a cloud, and a rock cluster.
5. Save As `study_world_scenery_kit.blend` in your local source folder:
   `C:\Users\kashif\Desktop\3d-world-study-planner\blender\source`.
6. Send a screenshot before continuing to the full-world assembly.

Creates separate scene `Study World - Step 10`. Does not need earlier collections
or disk paths; previous scenes remain unchanged. Each asset has its own export
collection and a root tagged with `scenery_kind` (bridge also has `asset_role`
set to bridge). The showcase roots are spaced out for inspection; assembly and
export should reset their showcase offsets. Export collections are:

- `SW10_Bridge_EXPORT` (span 4 m along X, 1.02 m plank width)
- `SW10_Tree_Round_EXPORT`
- `SW10_Tree_Pine_EXPORT`
- `SW10_Cloud_EXPORT`
- `SW10_Rock_Cluster_EXPORT`

Bridge nominal deck endpoints are at local Z=0; centre sag is 0.18 m. Endpoints
can be placed on island shores later. The cloud floats deliberately. Scenery
uses mesh geometry only; ropes are segmented cylinders rather than curves.
There is no background floor, and shadows/lighting are not baked into assets.

Rerun safety matches previous scripts. No automatic saving or exporting. Python
syntax, namespaces, bridge-height symmetry and sag checks passed. Blender visual
and runtime verification await the user's screenshot.

## Step 11: full-world preview

Script: `scripts/11_assemble_world_preview.py`

1. Save Step 10 as `study_world_scenery_kit.blend` in your local `blender/source`
   folder first. Keep your other saved checkpoint files there as well.
2. Download Step 11 to `blender/scripts`, then use Scripting > Text > Open to
   open that exact updated file. Text > Run Script.
3. Switch to Layout and choose Render > Render Image. This is a larger scene,
   so it can take longer than the individual landmark previews.
4. Save As `blender/source/study_world_preview.blend`.
5. Send a screenshot before exporting models or starting website code.

`SOURCE_FOLDER` is already configured for:
`C:\Users\kashif\Desktop\3d-world-study-planner\blender\source`.
Missing collections are appended from nine original checkpoints (Steps 01–08
and Step 10). It does not need Step 09's assembled island file. Import uses a
copied list to avoid the Blender in-place list mutation bug from Step 09.
Sources already loaded are reused. Disk source files are never modified.

Creates separate scene `Study World - Step 11`. Maths is in the centre with five
other subjects around it. Two additional sample forest islands demonstrate
unassigned subjects; these are not a fixed subject limit or reserved slots.
`SHOW_UNASSIGNED_ISLANDS = False` hides these examples. Bridges connect the
outer islands to the centre. Island rotations vary while keeping all grassy
surfaces at Z=0.24. Bridges stretch along their length only, preserving width
and matching the shore anchors. Camera framing is calculated from mesh bounds.

Plots and progress states are demo data. Labels, hover cards, actual tasks,
subject creation/removal and navigation will belong to the future website.
The layout is an initial world preview, not an exact reproduction of every
concept-art detail: no waterfalls, new island-base variants or final lighting
polish have been added yet. Six subject landmarks are included.

Mesh data is shared between repeated instances and sources to keep this larger
scene efficient. The script changes object transforms only, not meshes or
materials. Before manually editing a mesh instance, use Make Single User or save
a separate copy. Generator-owned objects are replaced on rerun; the script stops
if unowned objects have been added to its preview scene. No automatic exports.

Tests: Python syntax; eight non-overlapping island footprints; bridge transforms
and shore anchors; plot footprint; mocked library loading with in-place mutation;
17 required collections and hierarchy checks; missing-file preflight; rerun
without duplicate imports. Run tests with:
`python3 assets/blender/tests/test_step11_world.py`.
These are not actual Blender runtime/render tests; user verification is needed.

### Step 11 copy-loop correction

The copy helper now snapshots `tuple(source.all_objects)` before creating the
placement wrapper or linking duplicates. Direct iteration over Blender's live
collection during scene mutations could yield invalid entries (`None.copy`).
The added regression check simulates live-iterator invalidation, confirms copying
all objects and preserving nested parenting/transforms, and reproduces the old
failure without the fix. Run:
`python3 assets/blender/tests/test_step11_copy.py`.
This is a mock test, not an actual Blender runtime test. Download/open the new
Script 11 text block before rerunning; no need to recreate earlier assets.

## Step 12: visual polish (layout approved by the user)

Script: `scripts/12_polish_world.py`

1. Save Step 11 as `study_world_preview.blend` in your local `blender/source`
   folder. Keep it open in Blender.
2. Download Script 12 into your local `blender/scripts` folder.
3. Scripting > Text > Open > `12_polish_world.py`, then Text > Run Script.
4. Switch to Layout and choose Render > Render Image. Solid viewport colours do
   not show the new sky and lighting; inspect the actual render.
5. Save As `blender/source/study_world_polished.blend`. Keep Step 11's checkpoint.
6. Send a screenshot before model exports or website implementation.

Your configured fallback folder is:
`C:\Users\kashif\Desktop\3d-world-study-planner\blender\source`.
If Step 11 is not already open, the script appends its scene from the saved
`study_world_preview.blend` there. It never changes that disk file.

### Changes

- Reinterprets the early scripts' palette as sRGB and converts it correctly to
  shader-linear values, with a small saturation boost and contrast look when
  supported. Does not globally increase exposure to fight washed-out colours.
- Adds subtle per-subject grass tones without changing plot-status semantics.
- Adds three rock-depth profiles and mild underside variation. Top rim vertices,
  the grassy surface, object placements and bridge landings remain unchanged.
- Uses warm sunlight, cool soft fill and a warm rim light.
- Fits the camera to fresh evaluated mesh bounds, including the clouds and new
  rock depths, recentres the bounds, and adds a 16% framing allowance.
- Adds a blue-to-cream gradient on a camera-facing emissive backdrop. Using a
  direction-only world gradient with an orthographic camera would look flat.
  The backdrop is deliberately in the DO_NOT_EXPORT presentation collection.

Creates separate scene `Study World - Step 12`. Meshes and materials are copied
independently of the original scene; repeated assets can still share copied
mesh data *within* the polished scene. Grass caps and rock undersides receive
per-island mesh copies. Step 11/source geometry, materials, world and camera
are not modified. Island/bridge/landmark/plot transforms and layout are preserved.

The new scene has `SW12_Polished_World_PREVIEW` and
`SW12_Presentation_DO_NOT_EXPORT`. Camera, lights and gradient backdrop are not
reusable .glb assets. Bloom, waterfalls and new gameplay features are not added.
No automatic saves or exports. Re-running replaces this script's generated
scene objects, not other scenes. Added unowned objects stop the rebuild, while
manual edits to generator-owned objects will be replaced; save separately first.

### Validation

Run `python3 assets/blender/tests/test_step12_polish.py`. Checks include colour
conversion, three rock profiles, exact rim preservation, padded camera bounds
at three aspect ratios, a live-iterator mutation simulation, independent source
mesh copies, preserved hierarchy and shared internal instances. All earlier
Step 09/11 mock tests still pass. Python syntax checks pass. Blender runtime,
shader appearance and rendering cannot be verified in this sandbox (missing
Linux graphics libraries); actual output still needs the user's screenshot.

### Step 12 layout/camera correction

The first Step 12 user render showed islands and landmarks stacked at the origin
and the camera facing the underside. The script had read unparented objects' and
the camera's calculated `matrix_world` after changing the active scene, where
those source-scene caches could be stale/identity.

The corrected script activates and evaluates Step 11 first, freezes each object's
local basis, parent inverse, parent reference and expected world pose, and freezes
the camera pose *before* creating/rebuilding Step 12. It reconstructs the entire
parent graph before restoring frozen local matrices. No placements are taken
from inactive originals. A new evaluated-world-matrix guard checks every clone
against Step 11 and stops before rendering if any placement differs.

Recovery: open the original successful `study_world_preview.blend`, then open the
newly downloaded `12_polish_world.py` text block and run it. Do not overwrite the
Step 11 checkpoint with the broken polished preview. Save the corrected result
separately as `study_world_polished.blend` after inspecting the render.

Regression checks now simulate inactive-source world-cache resets, reproduce the
old incorrect assignment, check frozen root/camera ordering and verify the guard
rejects a collapsed root. These remain mocked checks; actual Blender runtime and
render validation await the user's next screenshot.

## Step 13: export the polished modular kit

Script: `scripts/13_export_models.py`

1. Save the successful Step 12 result as `study_world_polished.blend` in your
   local `blender/source` folder. Keep it open, in Object Mode.
2. Download Script 13 into your local `blender/scripts` folder.
3. Scripting > Text > Open > `13_export_models.py`, then Text > Run Script.
4. Wait for the success popup: **20 GLB models + manifest.json**.
5. Check `C:\Users\kashif\Desktop\3d-world-study-planner\public\models`.
   The folder is created automatically. No new .blend save is required.
6. Compress the `models` folder to a ZIP and upload it here for browser testing.
   If exporting fails, send the complete traceback instead.

The script already contains the user's Windows project path. If the polished
scene is not currently loaded it appends it from the saved checkpoint, using
Blender's native library loader without changing the source disk file.

### Outputs: 20 models, not one fixed world

| Files | Contents |
| --- | --- |
| `island_base_01.glb`, `island_base_02.glb`, `island_base_03.glb` | Shallow, balanced, deep polished bases; each includes cap/rim decorations but no subject landmark or topic plots |
| `landmark_maths.glb`, `landmark_reasoning.glb`, `landmark_english.glb` | Native-sized polished landmarks |
| `landmark_gk.glb`, `landmark_dsa.glb`, `landmark_software.glb` | Native-sized polished landmarks |
| `topic_plot_not_started.glb`, `topic_plot_in_revision.glb` | Two plot states |
| `topic_plot_ready_for_test.glb`, `topic_plot_strong.glb`, `topic_plot_weak.glb` | Three other plot states |
| `bridge.glb` | Native 4 m span, 1.02 m plank width, sagging deck |
| `scenery_tree_round.glb`, `scenery_tree_pine.glb` | Two reusable tree shapes |
| `scenery_cloud.glb`, `scenery_rocks.glb` | Cloud and rock cluster |
| `path_stone.glb` | One stepping stone |
| `manifest.json` | Relative filenames, categories, sizes, triangle counts, native bounds, coordinate/placement notes |

The three bases use the Maths/Reasoning/English profiles as representatives;
these are not subject-locked models. Their grass retains sample polished tones;
the browser may recolour grass. Unassigned/new subjects can use tree/rock scenery.
Five plot meshes correspond to progress states, not five fixed topics.

### Placement conventions

Everything is at native scale (metres), centred on its own placement root. Scene
placement, bridge stretch, showcase offsets, and demo scale/rotation are removed.
The exporter bakes each mesh's **root-relative evaluated transform**. This retains
internal book/globe/branch transforms while removing full-world placement.

Standard glTF is Y-up: Blender `(x,y,z)` becomes `(x,z,-y)`. Island surface is
Y=0.24. Place landmarks, plots and trees there. Landmark/plot/tree/rock bases are Y=0; the path stone uses its centre.
Bridge endpoint surfaces are Y=0 and endpoints run along X from -2 to +2.
The cloud deliberately has a floating shape; its root is its placement centre.
Native bounds are recorded in glTF coordinates in the manifest. A browser viewer
must still verify actual dimensions and materials.

### Safety and validation

- Activates/evaluates the polished scene and snapshots all source objects first.
- Identifies source instances by original placement-root metadata, not brittle
  global object names. Export planning checks all required assets before writing.
- Copies evaluated mesh data and freezes native transforms before switching to
  an isolated temporary export scene. No late reads of inactive source matrices.
- Does not change source meshes, materials, object placement, camera, sky or light
  settings. Restores the original active scene and removes temporary objects/data.
- Excludes camera, lights, backdrop, demo metadata, animation and compression.
  The browser must recreate lighting/sky separately; a GLB is not a Blender render.
- Uses Blender's bundled glTF exporter and checks supported operator options;
  enables the bundled add-on if necessary, without saving preferences/downloads.
- Writes to a unique staging directory inside `public/models`, checks GLB headers,
  basic glTF mesh content, excluded features and external dependencies, and guards
  against an unexpectedly large (>8 MiB) individual asset.
- Publishes only the 20 named GLBs and `manifest.json` after all exports pass.
  Reruns overwrite these known files; other outputs are untouched. Publication
  temporarily backs up existing managed files and attempts rollback on failure.
- A failed run retains its staging/backup folder and prints its location, useful
  for diagnosis/recovery if a filesystem error prevents rollback. No .blend file
  is saved/overwritten, and no source files are deleted.

Run `python3 assets/blender/tests/test_step13_export.py` for 12 standard-library
checks: asset planning, missing/empty assets, exclusions, a valid triangle GLB,
invalid headers, unwanted features/dependencies, publication, rollback, filename
safety, root-relative transform baking, source-freeze ordering. These are pure/mock checks; the actual Blender
export and subsequent browser rendering still need verification on the user's
computer / uploaded exported assets. No planner application code has started.

## Uploaded exports: browser verification completed

The user uploaded `models.zip` to GitHub main at commit
`b6576415a2e6bab799876611743934b560da3484`. Its 20 GLBs and manifest were safely
extracted into `public/models` on this working branch. Actual file/geometry and
browser draw tests passed. Total kit size: 1,609,652 bytes; 18,222 triangles.

See [the validation report](../../design/model-review/model-validation.md) and
[inspection viewer instructions](../../design/model-review/README.md).
The viewer is an asset test, not the planner app. Draw-call batching/instancing
is still needed during world integration; hardware/mobile performance is not
proven by the software-renderer tests. Nothing was pushed to GitHub.

## Static-part optimization completed

With user approval, the uploaded GLBs were optimized outside Blender. Original
binaries are preserved in `exports-original`; the deployable kit in `public/models`
now uses 129 draw calls instead of 549 when all 20 pieces are drawn once. Raw
GLB size is 1,370,700 bytes instead of 1,609,652; all 18,222 triangles remain.
Geometry/shader equivalence and two-view browser comparisons passed. See
[optimization-report.md](../../design/model-review/optimization-report.md).

Download `deliverables/study-world-optimized-models.zip` for the local project.
No additional Blender script or remodel is needed. Rerunning Script 13 will
produce raw exports again; optimize those again before replacing deployment
assets. This is asset preparation only; planner app implementation has not begun.

## Script 14 — Mathematics artwork first pass (2026-10-16)

The app now has a newly authored Maths island for visual approval, alongside—not overwriting—the legacy kit. One complete downloadable file: `scripts/14_maths_art_island.py`. It reconstructs the same mesh data as the live GLB, without needing scripts 01–13 or external files.

**Use the user's corrected local working paths for this new step:**

- Download script: `C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts\14_maths_art_island.py`
- Manually Save As: `C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_maths_art_v2.blend`

Open Blender → Scripting → Text → Open → Run Script, then Layout or Render Image. It creates a new scene on every run and never deletes objects, saves, exports, installs anything or overwrites a `.blend` file. Save manually under a new name. Geometry and vertex colours are embedded in this one file; no paths need editing. Camera/lights are separate from the export collection. The script selects an engine from registered enums, preferring `BLENDER_EEVEE` on Blender 5.2.

Details and reproducible validation: `design/islands/README.md`. The script passed Python compilation, embedded-geometry/colour and no-automatic-write/delete checks. Blender 5.2 runtime execution is **not** claimed; local render verification remains for the user's Blender. The matching GLB is already wired into the website and was rendered/tested there. Other subject islands and animated villagers are not part of this first pass.


## Script 15 — all seven subject artwork islands (2026-10-16)

After Mathematics approval, the app artwork now covers all seven themes, including generic/custom subjects. **One complete standalone download:** `scripts/15_all_subject_art_islands.py`. It reconstructs the same mesh positions/vertex colours as all seven live GLBs. No Script 14 or earlier script, .blend file, external data, image/font, add-on or download is required. Script 14 is preserved for Maths-only use.

1. Download to `C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts\15_all_subject_art_islands.py`.
2. Blender → **Scripting → Text → Open**, select it, click **Run Script**, then **Layout**. No path editing needed. It creates a NEW scene with seven separate island collections and a separate presentation camera/lights collection; earlier scenes/manual work remain untouched.
3. Use **File → Save As** yourself: `C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_all_art_v2.blend`. Choose a fresh name if that exists. The script never automatically saves, exports or deletes anything.

Uses available engine enums, preferring `BLENDER_EEVEE`, compatible with the user's Blender 5.2. Flat island surfaces are Z=0.24 metres. Root offsets only arrange the islands for viewing. Landmarks/foliage are decorative; topic progress/villagers are not baked in.

Python syntax, exact quantized embedded-colour / rounded geometry correspondence with parsed GLBs, and safety checks passed. **Blender 5.2 application execution remains unverified** in the sandbox; matching assets were rendered/tested in Chromium. Beginner instructions, review images, budgets and reproduction: `design/islands/README.md`. The legacy Script 13/export archive still represents the old 20-part kit; do not use it to overwrite the newly authored island files.


## Script 16 — rigged animated villagers (2026-10-16)

One complete offline file: **`scripts/16_animated_villagers.py`**. Three original stylized 3D characters, each with a real 14-bone armature and Walk/Idle/LookAround/Study actions. No photographs, sprites, add-ons, external assets or previous scripts required. This is a new character-studio scene, not a destructive merge into your earlier world scene. The website separately follows safe island routes; these Blender clips walk in place.

1. Download to `C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts\16_animated_villagers.py`.
2. Blender → **Scripting → Text → Open → Run Script**, then **Layout**. Play the Timeline to see the Walk loop (frames 1–43, 30 fps). No paths need editing.
3. Manually **File → Save As** to `C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_villagers_v1.blend`, choosing a fresh name if that exists. It never automatically saves/exports/deletes work; earlier scenes/scripts/exports are preserved.

Each character has a separate export collection and armature. Camera/lights are presentation-only. Uses Blender Z-up, metric units, available engines preferring `BLENDER_EEVEE`, and keyframe insertion compatible with newer slotted actions rather than legacy `action.fcurves` access.

Python compilation, embedded GLB geometry/colour/skin-weight/bone/animation-channel correspondence and safety checks passed. Matching GLBs were actually rendered/animated in Chromium. **Blender 5.2 application execution remains unverified**; local playback/rendering still needs checking and intermediate interpolation can differ. Full beginner instructions, budgets, video and reproduction: `design/villagers/README.md`.

## Script 17 — Aurel sky drake: static model review (2026-10-16)

One complete standalone offline file: **`scripts/17_aurel_sky_drake.py`**. Original graceful low-poly sky wyvern with broad warm-coloured wings, gentle face and curling tail. **Model approval only: no armature, wingbeat animation or website flight yet.** It does not alter the existing islands/villagers or merge itself into earlier world scenes.

1. Download to `C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts\17_aurel_sky_drake.py`.
2. Blender → **Scripting → Text → Open → Run Script**, then **Layout** or **Render → Render Image**. No previous files, add-ons or path editing needed.
3. Manually **File → Save As** to `C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_aurel_sky_drake_v1.blend`, choosing a fresh name if that exists. Every run creates a new scene; it never automatically saves, exports, deletes objects or overwrites files.

Thirteen anatomical parts share an opaque vertex-colour material, 10,188 triangles. Separate presentation collection holds camera/lights. Uses proper Z-up conversion and registered engines preferring `BLENDER_EEVEE`. Python compilation, exact embedded source-data correspondence, safe offline new-scene construction and matching WebGL model rendering passed; **Blender 5.2 application execution remains unverified**. Full beginner instructions, genuine preview and next-stage boundaries: [design/sky-creature/README.md](../../design/sky-creature/README.md). Scripts 14–16 are unchanged.

## Script 18 — Aurel rig and flight loops (2026-10-16)

The user approved the Script 17 model in Blender and authorized the next animation stage. **`scripts/18_aurel_flight_animation.py`** is a complete standalone offline reconstruction of the same approved geometry/colours with a real 16-bone weighted armature and Wingbeat, Glide and TailSway actions. No Script 17 or external files are needed. **In-place motion only; no planner flight routes yet.**

1. Download to `C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts\18_aurel_flight_animation.py`.
2. Blender → **Scripting → Text → Open → Run Script**, then **Layout → Spacebar** to play/pause. In the 3D viewport, **N → Aurel → Motion** switches loops and their playback ranges (Wingbeat 1–96, Glide 1–180, Tail sway 1–144 at 30 fps). Duplicate endpoint keys are excluded from playback to avoid a one-frame hold.
3. Manually **File → Save As** to `C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_aurel_animated_v1.blend`, choosing a fresh filename if needed. Every run creates a new scene. No automatic save/export/delete/network calls; earlier scripts/scenes remain intact.

One weighted mesh / one opaque vertex-colour material, 10,188 triangles. Smooth wing/neck/tail blending; camera/lights remain presentation-only. Registered engine enums prefer `BLENDER_EEVEE`. Supports newer slotted actions and linear sampled keys. The optional Aurel sidebar is session-only, not an installed add-on; saved actions still play after reopening. Built-in Action Editor switching instructions, genuine video, budgets and reproduction: [design/sky-creature/ANIMATION.md](../../design/sky-creature/ANIMATION.md).

Actual skinned GLB motion rendered/tested in Chromium; Python syntax, full embedded positions/colours/weights/bones/channels, independent coordinate-basis skinning math and offline/new-scene safety checked. **Blender 5.2 application execution remains unverified here.** Scripts 14–17 and existing app models are byte-identical.
