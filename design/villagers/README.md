# Stylized animated villagers — implemented

Stage 4 adds **real articulated 3D people**, not photographs, sprites, billboard images or static human substitutes. Three original low-poly villagers (scout, reader, gardener) share a 14-bone rig and four animation clips: **Walk, Idle, LookAround, Study**. Skin tones, hair/headwear and outfits vary. Each person carries a small notebook; the Study pose raises it while looking down.

The website places these independent characters on all seven supported island profiles, including new/custom subjects. They are purely decorative: they never earn, claim, complete or change study progress. Approved island models, real topic state geometry, scheduling, parser, exams, storage and backend behavior are unchanged.

## Try it

In the embedded app preview, choose **World → Find your island → Enter island**. Villagers walk the clear garden corridors, pause, look around/read, turn and walk back. The **pause/play button beside the camera reset button** is the accessible “Animate villagers” toggle. It is a temporary control for this mounted view, not a saved study preference.

- Desktop overview: **at most three total**, allocated across the first three current islands, not an unlimited crowd per subject.
- Focused island: **two total** on desktop; one per clear corridor.
- Compact canvas (under 700 CSS px, including phones): **one total**, on the middle corridor.
- Selecting another subject moves the budget to that subject. Every theme is supported; the overview intentionally does not populate every distant island.
- OS **reduced motion**, including changes while the app is open, disables motion and uses a calm Idle pose. The control cannot override that setting.
- Pause/resume freezes the actual simulation clock and pose. Hidden-document signals and an off-screen canvas stop updates. Frustum checks also skip individual out-of-view actors. Returning does not advance by the time spent hidden.
- Navigation/layout changes clean up timers, mixers, bone textures and per-person contact-shadow resources. Cached model geometry/materials remain shared. Cleanup is safe under React development StrictMode effect replay.
- A failed character download removes only optional villagers; the actual island, topic tasks and planner remain usable.

The two safe corridor centre lines are Z=0.16 and Z=1.95, X between −2.55 and +2.55. Feet stay above the low flagstones; turn/pause points are on the same clear strips. A deterministic 42-second visible simulation cycle provides eased walks, look/read pauses and turns. Time is accumulated only while actively visible, never from wall-clock dates or study data. There is no bridge crossing, pathfinding backend or autonomous AI service.

## Source and deliverables

- `src/components/Villagers.tsx` — independent optional-asset cache/boundary, skeleton-safe clones, blended AnimationMixer actions, visibility/frustum guards, one shared demand-render timer and cleanup.
- `src/domain/villagers.ts` / `.test.ts` — deterministic identity, crowd budget and safe route/activity sampling, independent of learning evidence.
- `src/components/useSceneReducedMotion.ts` — live native media-query subscription. The installed Motion hook snapshots the preference at mount, so it was insufficient for a running background character loop.
- `scripts/art/villager-rig.mjs` / `scripts/build-villagers.mjs` — original geometry, rig and animation authoring; deterministic GLBs plus the complete Blender delivery.
- `public/models/villager_{scout,reader,gardener}_v1.glb` / `villagers-v1.json` — three standalone animated assets and generated budgets/hashes.
- `assets/blender/scripts/16_animated_villagers.py` — **one complete offline file**, all three characters, real armatures and four actions each; independent of earlier scripts.
- `review.html` / `review.js` — optional dev inspection studio with real animation playback, pose scrubbing, orbit, four clips and a Maths garden view. This is a review tool, not the app runtime/budget implementation.
- `preview.png` — actual WebGL character render.
- `villagers-motion.webm` — approximately 6.6 seconds captured from the real WebGL canvas, showing Walk / LookAround / Study. It is a preview recording, not an image/video used by the app as a character substitute.

## Budgets

| Variant | Triangles | Opaque skinned batches | Bones | GLB bytes |
| --- | ---: | ---: | ---: | ---: |
| Scout | 2,568 | 1 | 14 | 391,028 |
| Reader | 2,556 | 1 | 14 | 390,124 |
| Gardener | 2,616 | 1 | 14 | 392,252 |

Each is below 3,000 triangles / 450 KB, with normalized compact vertex colours, no textures or external resources/decoders, and four embedded clips. Total download for all three is 1,173,404 bytes. The existing cache bounds downloads to these three variants, regardless of subject count.

Each runtime person adds **one skinned draw + one small translucent contact-shadow draw**. People do not cast dynamic shadow-map shadows, so walking does not force the island's static shadow map to be redrawn. One crowd timer requests demand-rendered updates at **up to 30 Hz on larger canvases / 24 Hz on compact canvases**. These are scheduling caps, **not measured physical-device FPS**. Skinning is one joint per rigid segment, an intentionally simple articulated toy-like style, not a photorealistic deforming human rig.

## Reproduce and verify

```sh
npm ci
npm run art:villagers
npm run test:villager-assets
npm run build
npm test

# Optional real browser tooling:
npm --prefix design/model-review ci
# Keep these running in separate terminals:
npm run dev
npm run preview -- --port 5175
# Then:
npm run test:villagers
npm run test:preview
```

`APP_URL` overrides the built app URL; `VILLAGER_URL` overrides the dev inspection page. Other regression commands and server details are in `design/islands/README.md`. The rig cloner is explicitly prebundled by Vite, avoiding a dependency-discovery iframe reload on the first World visit.

### Final results

- **Build/strict TypeScript and 112 unit tests passed**, including six new route/budget/determinism/no-data-change tests.
- All three parsed GLBs pass hash/resource/budget, real skinning/14-bone hierarchy, finite weights/attributes, four non-static deformed-vertex animation checks and animated bounds. Script 16's embedded geometry (within floating-point epsilon), exact quantized colours, skin indices, rest bones and sampled animation channels match the GLBs. Python compilation and no-automatic-save/export/delete safety checks passed.
- **4,326 downward ray samples** check both complete 0.4 m-wide corridors against the seven actual island GLBs, keeping feet away from scenery, stream and landmarks. Route sampling also stays outside the reserved topic footprints. The initial rear corridor was adjusted to clear the Reasoning/English landmark plinths without changing the approved islands.
- Existing asset checks rerun: **2,058 topic-clearance rays**, the approved Maths hash, all seven island hashes and the 20 legacy asset hashes are intact.
- **13 new villager browser groups passed**: genuine skin deformation and real video capture; scene-wide crowd cap; autonomous Walk/LookAround/Study; explicit pause/resume; live reduced-motion changes; actual off-screen canvas pause/resume; a **simulated** hidden-document visibility signal; all seven profiles/custom subjects with paging/selection; animated 320/390/430px layouts and six camera/motion controls; SPA cleanup; isolated villager-download failure; development StrictMode replay and Tablet/Mobile rig replacement without binding errors.
- **24 all-theme + 4 Maths + 12 immersive World + 23 core workflow + 5 embedded preview + 3 SVG icon groups rerun and passed.** With the 13 new groups, **84 current browser check groups passed**. The icon family now includes two original pause/play glyphs (52 UI glyphs plus brand).
- Inspected the actual character poses, desktop garden with study evidence, mobile task view and embedded preview. Detailed latest evidence: ignored `.cache/villagers/`, plus existing suite evidence folders.

One development-preview run exposed synchronous mixer disposal during StrictMode replay; cleanup now immediately stops scheduling and defers irreversible disposal by one microtask, cancelled if the same rigs are retained. This fixes the issue rather than disabling StrictMode or suppressing errors. A separate first-visit Vite optimizer reload was fixed with explicit prebundling. The all-theme browser suite now waits for newly paged HTML labels to have actual projected positions before its real pointer click; counting labels alone raced their first R3F layout frame. Corrected full suites passed.

These are Chromium/software-renderer and CSS viewport tests, not Safari/Firefox, physical-phone performance or OS-power measurements. The hidden-tab check injects a visibility signal rather than certifying every browser's background throttling policy. Other dedicated header/page/workspace/exam/axe suites retain historical results; they were not rerun for this animation milestone. **Actual Blender 5.2 execution remains unverified**.

## Blender 5.2 — one complete file, beginner steps

1. Download **`16_animated_villagers.py`** into:
   `C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts`
2. Open Blender → **Scripting → Text → Open**. Select this file and click **Run Script**. There are no paths to edit and no need to run Scripts 14/15 first.
3. Choose **Layout**. A NEW scene named `Study World - Animated Villagers v1` contains all three characters. Play the Timeline (or Spacebar with the mouse over the 3D view) to see the default **Walk** loop. These clips walk in place; the website separately moves the characters along safe garden routes.
4. Use **File → Save As** manually:
   `C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_villagers_v1.blend`
   If the filename exists, choose a fresh name. The script never automatically saves/exports/deletes anything and never merges into or replaces your earlier world scenes.

Each `SW16_{variant}_EXPORT` collection contains a real armature and its coloured mesh. Presentation camera/lights are separate. The scene uses metric units, Blender's Z-up coordinate conversion and available engine enums, preferring **`BLENDER_EEVEE`**. Each rig has matching named Walk/Idle/LookAround/Study actions, kept with fake users. Default Walk playback is frames 1–43 at 30 fps. Other actions can be selected for the matching armature through **Dope Sheet → Action Editor** (Idle/LookAround: frames 1–121; Study: 1–151). No legacy `action.fcurves` access is required for Blender's newer slotted actions.

The script reconstructs the same geometry, rig and sampled poses as the GLB data. Blender's intermediate animation-curve interpolation/rendering may differ from the website; application execution/rendering in Blender 5.2 has **not** been tested here. Syntax, embedded data and safety checks passed; the GLBs were independently rendered and animated in Chromium.
