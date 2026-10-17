# Visual-world implementation order

User-approved sequence (2026-10-16). Preserve README §0, existing scheduling/parser/storage rules, dynamic subjects and the immersive 3D world.

## 1. Shared responsive header — implemented

- One AppHeader for World, subject pages, Today, Revisions, Tests, Analytics and Settings.
- Desktop: one labelled navigation row; medium widths: labelled second row; narrow widths: accessible Menu disclosure.
- Same logo, navigation order, active states and Paste entry point everywhere. World may float the header without changing its navigation layout.
- Measure header/notices/World introduction heights instead of fixed offsets. Remove obsolete conflicting header styles.
- Validate breakpoint boundaries, keyboard/menu behavior, ordinary workflows and the in-preview device controls. Effective zoom-width checks are not a claim of physical-browser/device testing.

## 2. Custom SVG icon system — implemented

- Original full-colour floating-island brand/logo/favicon plus 50 inline SVG glyphs replace the previous Lucide symbols throughout the app and development-preview toolbar.
- One 32-unit artboard, rounded strokes, inherited currentColor and restrained duotone fill. Navigation has six distinct symbols; seven subject themes preserve dynamic colours and the generic/new-subject fallback. Revision learning has its own book-and-loop mark, distinct from Undo.
- Decorative in labelled controls; labelled images for standalone exports. No icon fonts, external image requests, filters or animation.
- Portable SVGs and responsive specimen: `design/icons/`; source: `src/components/icons.tsx`; regenerate with `npm run icons:export`. A compact visual overview is `design/icons/preview.png`.
- Strict TypeScript/build, 84 unit tests and 43 current browser groups passed. Header, page, core-data and device-preview regressions remain green; icon checks include artboard bounds at 16/20/32/56px and live inherited subject colours. UI icons do not require Blender. No study rules, data schemas or 3D assets changed.

## Pre-artwork user corrections — implemented

- Replace the long Revisions list with bounded card pages (four larger-screen, two phone), retain every due/upcoming/history entry and all subject/date filters. Calendar and guide disclose on demand, collapsed initially on phones.
- Replace the clipped/stuck World journey card with a compact trigger and native scrollable drawer; preserve live plan data and Today navigation. Keep close/Escape/focus return working at short and landscape sizes.
- Build/strict TypeScript, 84 unit tests and 45 current browser groups passed, including the new five-group workspace suite. See APP_VERIFICATION.md for scope.

## Scheduled external exams — implemented user-requested addition

- Retain the test journal; add a separate rolling exam plan from completed recall evidence with a practical seven-day default, configurable 1–90 days.
- Bounded topic/range syllabus, due date and Today reminder; sit the exam externally. Explicitly confirmed result saves a syllabus snapshot and consumes covered recall dates; overall-only scores still do not alter revision schedules.
- Preserve old backups through additive defaulted/optional fields, dynamic subjects, range identities and historical snapshots. No in-app question generation.
- Build/TypeScript, 105 unit tests and 52 current browser groups passed. See APP_VERIFICATION.md for scope and historical-suite distinctions.

## 3. Island artwork — all seven themes implemented

After approving the Mathematics first pass, the user authorized all remaining designs together. The runtime now uses a complete authored island for each theme (`maths/reasoning/english/gk/dsa/software/generic`), including any new/custom subject with that theme. Mathematics is byte-for-byte unchanged. Shared functional garden spacing remains, with distinct landmarks, planting palettes, cliff colours/depths and outline variation; DSA has a conifer grove and English an autumn grove.

- Reasoning: inlaid logic cubes / small hedge maze. English: stacked/open books / reading lamp. GK: globe observatory / compass terrace. DSA: binary-tree monument. Software: code workbench / roofed studio. Generic: seedling arbor / bench.
- Six live topic footprints, evidence geometry, tasks/paging, full 360°, bounded central zoom, edge scroll, deep links, dynamic subjects and 2D recovery are preserved. Static decoration never represents earned learning progress. Villagers remain separate; water is static.
- Complete **Script 15** reconstructs all seven islands in one new Blender scene, separate island collections, no previous scripts/data needed and no automatic saving/exporting/deleting. Script 14 and all 20 legacy assets/backups are preserved. Correct Windows folders and Blender 5.2 engine enums are included. Python/data/safety checks passed; actual Blender 5.2 application execution is still unverified.
- Build/strict TypeScript, **106 unit tests**, all-profile asset/embedded-data validation, **2,058 plot-clearance rays**, and **68 current browser groups** passed. Detailed scope and historical-suite limitations: APP_VERIFICATION.md.
- Overview: `design/islands/all-themes-overview.png`; reviewer: `design/islands/review.html`; complete beginner/download/reproduction instructions: `design/islands/README.md`.

This is stylized low-poly artwork, not exact concept-art fidelity or a claim of measured physical-phone FPS. The next ordered visual stage is animated villagers; no villagers have been implemented in this rollout.

## 4. Stylized animated villagers — implemented

Three original articulated low-poly characters (scout, reader, gardener), each one vertex-colour skinned mesh / 14 bones with Walk, Idle, LookAround and Study clips. No human photos, sprites or static substitutes. The app places them on safe corridors on every supported theme, including custom subjects; decorative movement never represents or changes learning evidence.

- Global budget: three in desktop overview, two on the focused island, one on compact canvases. Shared cached geometry/materials, independent skeleton clones, capped demand updates, cheap contact shadows, no dynamic island shadow redraw.
- Explicit pause/play beside camera reset. Live reduced-motion settings use a calm static Idle pose, without an override. Hidden/offscreen/frustum guards pause simulation; navigation/size changes clean up timers, mixers and bone textures, safely under StrictMode replay.
- Optional download failures remove only villagers, not the actual island or planner. Existing full 360°, bounded centre zoom, edge scroll, topic evidence/paging/tasks, dynamic subjects, 2D recovery and embedded preview continuity are preserved.
- **112 unit tests and 84 current browser groups passed**, including 13 new villager groups and reruns of all-theme/Maths/World/core/preview/icons. 4,326 corridor-clearance rays, all three real rigs/animations/embedded Blender payloads, 2,058 existing topic-clearance rays and unchanged island/legacy hashes verified.
- Complete standalone **Script 16** supplies all three rigged characters/four actions each in a NEW Blender scene, with correct Windows folders and no automatic saves/exports/deletion. Earlier scripts/scenes are untouched. Python/data/safety checks passed; Blender 5.2 application execution remains unverified.
- Actual character preview and short WebGL motion recording: `design/villagers/`. Full instructions/budgets/limitations: `design/villagers/README.md`. No physical-phone FPS claims, backend or autonomous NPC AI.

The four ordered visual stages now have working implementations. Further character/landscape refinements can follow user review; no additional feature stage is assumed.

## 5. Original sky creature — static approval model delivered

User authorized the model-first sky-creature stage after discussing graceful Avatar-like atmosphere, with an original design rather than a franchise replica. **Aurel sky drake** now has broad scalloped wings, teal/sand/coral palette, friendly face, folded legs and curling tail. Complete offline **Script 17** and a genuine interactive GLB review/PNG are supplied under `design/sky-creature/`.

- Static only: no rig, animation or app integration in this approval step. The planner and existing models are unchanged; approval precedes wingbeat/glide/tail animation, then separate flight-path integration.
- 13 parts / one opaque shared material / 10,188 triangles / 875,036-byte GLB; closed outward-wound components, no textures or external resources. Future batching and mobile flight budgets remain to be designed.
- Seven new Chromium review groups, geometry/Python/safety checks, strict TypeScript/production build and 112 unit tests passed. 56 earlier model/script files hash-preserved. Prior app browser suites were not rerun for this art-only addition; actual Blender 5.2 runtime remains unverified.
- Review studio on 5176; unchanged planner stays on 5173. Beginner Windows paths and safe manual save instructions: `design/sky-creature/README.md`.

## 6. Aurel flight rig — in-place animation delivered

After viewing Script 17 output in Blender, the user approved its appearance and authorized moving forward. Script 18 now reconstructs the approved shape/colours with a real **16-bone smooth-weighted rig**, **Wingbeat / Glide / TailSway** actions, and beginner playback/loop-switch controls in a fresh standalone Blender scene. Script 17 remains intact. Duplicate endpoint keys are outside Blender's playback ranges for clean looping.

- One skinned mesh / one shared opaque vertex-colour material / 10,188 triangles / 1,688,464-byte GLB. Three-joint wing flex, three-part tail chain/rudder and restrained head/body movement, not rigid image-card motion.
- Actual animated studio/video on 5176, with pose scrubbing, real bone links, reduced-motion/hidden/offscreen guards and bounded orbit/zoom. Root opens motion review; the original static reviewer stays at its explicit URL. Planner 5173 and deployed assets are unchanged.
- **13 new browser groups**, GLB/source/embedded skin/clip checks, Python/safety checks, independent Blender-basis skinning math, static Script 17 asset checks, strict TypeScript/build and **112 unit tests** passed. 64 older model/script/static-review files hash-preserved. Actual Blender 5.2 runtime and physical-device performance remain unverified; prior planner browser groups are historical, not rerun here.
- Complete one-file Script 18 and manual Windows save instructions: `design/sky-creature/ANIMATION.md`. No commits/pushes or study-logic/storage/schema/backend changes.

**Next boundary:** user reviews local animation first; website flight routes/counts, safe UI/topic clearance and runtime budget/integration tests are still a later stage, not silently implemented here.

## 7. Aurel website flight — implemented with user authorization

User explicitly approved direct integration, with no manual Blender dependency. The approved rig now runs as an optional 3D scenery layer, one creature per canvas on desktop/mobile, with a view-aware looping depth/bank path and smooth Wingbeat/Glide mixing. Independent Sky pause; live reduced motion, hidden/offscreen stop, optional download-failure isolation and StrictMode-safe cleanup.

Conservative projected footprint/real six-plot and UI exclusion, non-raycast meshes and no dynamic shadows preserve study interaction. Compact focus uses upper sky; compact overview uses open lower sky to clear header/subject controls. Existing full 360°, bounded central zoom, native edge scroll, dynamic subjects/group/topic paging, actual evidence/tasks, 2D recovery and embedded preview continuity remain. No progress/storage/parser/scheduling/exam/backend changes.

Build/strict TypeScript, **117 unit tests and 96 current browser check groups passed** (12 flight integration + 84 existing groups). Approved rig bytes/hash and one-instance budget validated; Script 18 asset/Python checks remain green. A group-pager hit-target overlap was caught by the core suite and corrected with a dedicated 800/320px 14-subject regression. One overloaded parallel World run timed out; the full unchanged suite passed when run serially. No physical-phone FPS/Blender runtime claim.

Runtime/source/budget/user instructions: `design/sky-creature/FLIGHT.md`. Normal planner stays on 5173; motion source review stays on 5176. Further visual/flight refinements await user review, not an assumed next feature.
