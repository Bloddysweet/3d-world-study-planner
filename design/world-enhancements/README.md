# World enhancements

This pass implements the user's World-only feedback, not a redesign of the planner's other pages.

- One **Controls** trigger at the bottom. Labelled controls and the 2D switch appear only when expanded. Dismiss via its trigger, X, Escape, or outside click. Controls are portalled above the selected-island panel so their buttons remain reachable.
- Compact non-modal **Today's journey** popover: no full-height drawer, blurred backdrop, focus trap or body scroll lock. Live plan totals/counts and the Today link remain.
- **Island atlas** is the only island picker; the Find your island dropdown is removed.
- Dragon: retain still-safe routes; interpolate replacements at capped screen-space steering speed; no fallback teleport when no replacement fits. Short projected overlaps are debounced and opacity is eased, instead of hard-cutting the entire mesh as the camera is held/rotated. Materials are cloned per instance and disposed on actual unmount; cached art is not mutated. Long obstructions may fade it temporarily. Pause/reduced-motion/offscreen guards remain.
- Clouds: 22 soft transparent cloud clusters in one instanced draw, sharing a locally generated 128×128 alpha texture. Billboards update only on camera rotation; no cloud animation scheduler or dynamic shadows. The original GLBs are unchanged.
- Lightweight 2D atlas: actual subject islands, all active/custom subjects, selected-subject topics/statuses and working editor/deep links. No WebGL. Both modes share existing study data and the worldMode preference.

## Reproduction

Normal embedded preview: port **5173**. No Blender work or external services.

```sh
npm ci
npm run dev -- --port 5173 --strictPort
# Browser dependencies if not installed:
npm --prefix design/model-review ci
npm run test:world-enhancements
npm test
npm run build
npm run test:sky-runtime-assets
```

Browser checks use physical mouse clicks transformed through the actual embedded iframe scale (Puppeteer child-frame bounding boxes otherwise omit that CSS scaling). Orbit checks hold and drag the actual canvas in desktop/tablet/mobile and sample the real scene object's opacity/position each rendered frame. They do not infer success from actor count alone. All QA data additions are limited to an isolated test browser, not the user's workspace.

See `APP_VERIFICATION.md` for final verification scope/results. Screenshots in this directory are from the actual embedded app; scratch traces/failure captures remain in ignored `.cache/world-enhancements/`.

## Verified result

Production build, **132 unit tests**, approved-art byte/hash audit and all **7 World-enhancement browser groups** passed. A separate physical-pointer smoke passed Zoom in, Turn right, Reset view and independent villager/dragon toggles. Full previous browser suites were not rerun. A longer obstruction may gently fade the dragon; the fix removes hard cuts/route snaps, not all possible occlusion.

## Follow-up: fitted Journey and immediate garden entry

The newer implementation replaces the fixed-height Journey sizing with live viewport/header/tool measurements and an internally scrolling body. Selecting an island (world label or atlas) immediately enters its garden; Enter island is removed. Open subject is a prominent footer action and retains the chosen topic in the actual editor link.

Fresh checks: `npm run test:world-entry` **5/5 browser groups**, `npm test` **138 tests / 13 files**, and `npm run build` passed. The browser run covers an overloaded demo plan, live resizing across desktop/short desktop/tablet/320/390/430 phones, internal scroll/Continue accessibility, direct atlas and scene-label entry, topic/editor navigation, Back/Escape, old island-only links, Controls and no page errors. Full older browser suites were not rerun. See `APP_VERIFICATION.md` for scope and automation corrections.

Newest actual embedded screenshots:

- `journey-demo-fitted.png`: overloaded Journey within the available mobile viewport.
- `journey-short-fitted.png`: very short desktop; the body is scrolled to Continue while the close header remains visible.
- `island-direct-open.png`: immediate garden entry and prominent Open subject.

## Cleaner World introduction

Removed the large effort/extraordinary-world copy and curiosity subtitle. Journey and New subject now share an aligned top row below a compact World heading; the desktop subject panel has matching clearance. Atlas and Controls stay at the bottom, leaving the central islands unobstructed. Current verification: **138 unit tests**, production build and **6/6 focused World-entry browser groups** passed, including toolbar alignment/nonoverlap at desktop/tablet/320/390/430 widths.

Newest overview screenshots: `world-clean-overview-desktop.png` and `world-clean-overview-mobile.png`.
