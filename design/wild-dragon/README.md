> **Retired design.** The user replaced Cinder with Auren, a larger male of Aurel’s species. See `design/dragon-pair/README.md` for the active implementation. Cinder's GLB is archived at `design/wild-dragon/models/cinder_wild_dragon_v1.glb`, not shipped under `public/models`. Legacy npm wild-dragon aliases now check/build the active male companion. The historical notes below describe the previous stage.

# Cinder — original wild obsidian wyvern

Second animated 3D dragon in the **World section**, alongside the approved teal Aurel. Inspired by the ancient black, heavy-winged dragon mood requested by the user; not an extracted or copied House of the Dragon/Balerion model. Original procedural geometry, no downloaded franchise assets or textures. The faceted styling matches the study islands.

## Design and integration

- Angular charcoal head, ember eyes, tooth-lined jaw, swept horn crown, plated chest/back, attached dorsal spikes, long barbed tail and broad scalloped oxblood sails with geometry ribs.
- One skinned mesh/material, **8,882 triangles**, **16 bones**, **1,420,376 bytes**, zero textures. Three seamless in-place clips: Wingbeat **5.12s**, Glide **9.6s**, TailSway **7.68s**. Runtime uses the first two, including their tail motion.
- Own slower 72-second route, deeper banks and independent motion clock. One Cinder plus one Aurel, never per island. Cinder is mounted only in immersive World; the subject editor's 3D scene and the lightweight 2D atlas do not gain another dragon.
- **Controls → Aurel flight / Cinder · wild dragon** independently pause/resume each. Villagers retain their own toggle. Reduced motion, hidden tabs and offscreen canvas stop decorative clocks. There are no study-store writes or extra persistent controls.
- Adaptive desktop corridors give Aurel priority; Cinder avoids its complete swept envelope. Phone and portrait-tablet overview use explicitly separated lower-sky circuits so a large first dragon cannot consume all available sky. Busy panels/orbit obstructions still gently fade a creature when necessary; visibility is not guaranteed through every interaction.
- Own cached optional asset and instance materials/skeleton cleanup. A failed optional fetch/parse is handled as an unavailable data state, not a global rendering exception. Cinder failure leaves Aurel, islands and study tools usable, restoring Aurel's standalone compact circuit.

## Files

- Geometry source: `scripts/art/wild-dragon.mjs`.
- Shared rig: `scripts/art/sky-drake-rig.mjs` (optional supplied geometry; default approved Aurel output byte-identical).
- Rebuild: `npm run art:wild-dragon` → `public/models/cinder_wild_dragon_v1.glb` and `cinder-flight-v1.json`.
- Actual GLB turntable: `/design/wild-dragon/review.html` on the existing Vite preview. No separate server or Blender installation is required.
- Actual screenshots: `cinder-model-preview.png`, `world-two-dragons-desktop.png`, `world-two-dragons-mobile.png`.

## Verification

Fresh `npm test`: **143 tests / 14 files passed**. `npm run build`, `npm run test:wild-assets` and `npm run test:sky-runtime-assets` passed. Asset validator checks file/hash, normalized finite skinning, sampled deformed vertices, animation/joint motion, mesh/material/bone counts, and regenerates Aurel in memory to prove byte identity with the approved deployed rig.

`npm run test:wild-dragon`: **9/9 browser groups passed**, including actual skinned actors and changing wings/routes, desktop/tablet/320/390/430 visibility/bounds/separation, physical held-pointer orbit opacity, independent pause, live reduced motion, no decorative study writes, real island/editor navigation, isolated failed Cinder download and no browser page errors. Report: `.cache/wild-dragon/report.json`; layout poses and actual orbit opacity samples are in that ignored directory. Browser dependencies use the existing `design/model-review` package.

QA caught an unavailable second corridor on portrait tablet and stale routes following resize. Explicit paired portrait circuits and invalid-size route reset address these. Initial automation also checked the native canvas fallback's DOM existence rather than paint state, read labels before island readiness, and was interrupted by development hot reloads during edits. The final run waits for actual scene size/camera stability, isolates the download-failure browser context and waits for real island labels. Other historical full World/flight suites are not fresh passes. Physical-device performance, Firefox/Safari and continuous all-pose clearance are not certified.

The existing `npm run test:world-entry` subsequently passed **6/6 groups again** with both dragons integrated, preserving the fitted overloaded Journey, clean toolbar, direct island/topic/editor navigation, legacy links and Controls. Combined fresh focused coverage: **15 browser groups**. An earlier context-destroyed automation attempt was not counted; the complete unchanged serial rerun passed.
