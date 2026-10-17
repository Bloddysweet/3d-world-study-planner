# Aurel & Auren — matching sky-drake pair

Replaces the retired Balerion-inspired Cinder with **Auren**, a larger male of the original Aurel species. Two matching teal dragons, not a third dragon or a black/red recolour. Original Aurel stays byte-for-byte unchanged.

## Model

Auren derives directly from the approved Aurel rig and topology, keeping the exact vertex-colour palette, gentle face, soft head fins, warm wing membranes and leaf-shaped tail rudder. Relative bind-space morphology:

- Body: **14% wider, 18% taller, 16% longer**.
- Outer wing span: **42% broader**, with expanded wing chord.
- Tail extension behind its root: **65% longer**, including its attached leaf tip.

Both skin vertices and bone pivots receive the same continuous morph; the skeleton is rebound afterwards. This avoids wing-root gaps and a detached tail tip. The male's wingbeat/glide clips run 18% slower. Actual geometry is **10,188 triangles / 16 bones / one mesh/material / zero textures / 1,689,048 bytes**. The model review shows both individuals at the same scene scale.

## World integration

- Auren replaces Cinder in the existing second actor slot. Two dragons total, never one per island. Phone/portrait-tablet overview retains separated companion circuits and a larger male footprint; the longer tail has additional tablet plot clearance. Desktop corridors remain adaptive, so visual footprint can shrink when available sky is crowded.
- **Controls → Aurel flight / Auren · male companion** independently pause each. Live reduced motion overrides both; villagers remain independent. No new persistent toolbars, study writes, schema/parser/scheduling changes or backend services.
- Cached optional GLB, posed bounds, protected UI/plots, graceful obstruction fades, hidden/offscreen guards and instance cleanup remain. Unavailable male artwork leaves Aurel and the actual islands/study editor usable.
- Normalizes the male's longer/wider bind silhouette against its reserved screen footprint rather than allowing the enlarged mesh to overrun controls. This is not a promise of uninterrupted visibility through every crowded interaction.
- Cinder's old GLB is archived under `design/wild-dragon/models/`, not shipped from `public/models` or requested by World. The subject editor's own 3D scene and the 2D atlas do not gain another dragon.

## Files and reproduction

- `scripts/build-male-dragon.mjs`: deterministic morphology/rebind/export using the approved rig builder.
- `public/models/auren_male_companion_v1.glb`, `auren-flight-v1.json`: active male asset/metadata.
- `manifest.json`: matching review metadata.
- `/design/dragon-pair/review.html`: actual interactive pair comparison on the existing Vite server; no Blender work or separate server required.
- Screenshots: `dragon-pair-model-preview.png`, `world-two-dragons-desktop.png`, `world-two-dragons-mobile.png`.

```sh
npm run art:male-dragon
npm run test:male-assets
npm test
npm run build
npm run test:dragon-pair
```

Browser dependencies remain in `design/model-review`. Legacy wild-dragon npm aliases point to the current male builder/checks; some internal route/diagnostic identifiers retain the old slot name for compatibility, not the old species/design.

## Fresh verification

**143 unit tests / 14 files**, production build, male asset validator and original Aurel runtime/hash audit passed. The male validator also checks exact palette equality with Aurel, equal topology/vertex count, expanded wing/tail bounds, rebound rest-pose vertices, finite sampled animated skinning, normalized weights and real moving joints. It regenerates the default Aurel rig in memory and proves its complete deployed GLB remains byte-identical.

`npm run test:dragon-pair`: **9/9 browser groups passed**, covering actual animated pair review; two real skinned actors with changing routes/joints; desktop/tablet/320/390/430 bounds/visibility/separation; actual held-pointer orbit opacity; independent pause; live reduced-motion/no decorative study writes; actual garden/editor navigation; isolated failed male-model download; no browser page errors. It also asserts the retired Cinder GLB is never requested. Report and measured layout/orbit data: `.cache/dragon-pair/`.

First browser run caught the enlarged tail touching portrait-tablet plot clearance. Lowered the male's tablet lane without shrinking the tail or altering Aurel; the complete rerun passed. Screenshots were visually reviewed. Older full browser suites and previous World-entry checks are historical, not fresh passes for this replacement. Physical-device FPS, Safari/Firefox and all-pose uninterrupted visibility remain unverified.
