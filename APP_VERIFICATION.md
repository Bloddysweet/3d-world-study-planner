# Basic app verification

Initial verification on **2026-10-15**; camera/scroll follow-up verified on **2026-10-16** in the Arena sandbox. This report covers the new React app, not just the earlier standalone model inspector.

## Results

| Check | Result |
|---|---|
| Strict TypeScript / production build | Pass (`npm run build`, including `tsc -b`) |
| Unit tests | **76 passed**, across engine, parser, repository, world-layout and analytics suites |
| Browser workflow suite, production build | **42 checks passed** (23 core workflows + 12 world checks + 7 reference-page checks) |
| Main workflow browser exceptions / console errors | **0** |
| Main workflow failed network requests | **0** |
| Responsive layouts | All six main screens checked at **390px and 320px**, no horizontal overflow |
| Automated accessibility spot-check | Twelve populated reference-page views (six pages at 1440px and 390px): no reported WCAG 2 A/AA or 2.1 AA rule violations from axe-core. Earlier immersive milestone also passed nine desktop states. |
| Hardware/mobile FPS | Not measured |
| Safari / Firefox / physical touch-device tests | Not performed |

The build emits two harmless Rollup messages about comment annotations in the installed Zod package; compilation and bundling succeed. The 3D renderer is a separate lazy-loaded bundle (~961 KB uncompressed/~262 KB gzip); the main app is ~601 KB uncompressed/~187 KB gzip. These are build measurements, not load-time or FPS benchmarks.

## Unit coverage

- Calendar arithmetic across months, years, leap days and DST dates; invalid date rejection.
- No revisions before completion; actual-completion dates; idempotent completion; per-task revision opt-out.
- Same-topic coverage consolidation, new-learning restart, separate vocabulary ranges.
- Same-day rating correction, including new learning after an earlier review on the same day.
- Forgot/Hard/Good/Easy behavior, third-review readiness and maintenance cap.
- Whole-topic readiness requires three reviews for each vocabulary range.
- Overdue reviews stay single; unfinished work carries forward; explicit priority/review/carry/new ordering.
- Overload totals and suggestions without automatic deferral.
- Score thresholds including exact boundaries; overall-only scores do not change schedules; historical scores cannot rewind newer learning.
- Test time can be absent without invented duration.
- Subject deletion cleans references and retains overall test records.
- Schema/version/reference validation; reject unfinished revision coverage and duplicate same-day review evidence.
- Local parser proposals, custom subjects, ambiguity, estimates, priority, ranges, URLs and revision opt-out.
- Storage round trips, demo isolation, corrupt original preservation, invalid backups and unavailable/throwing storage.

## Completion/edit correction follow-up

The user's reported topic-editor omissions and irreversible checkbox behavior are fixed. Thirteen additional unit tests cover undo idempotency, revision opt-out, exact prior schedule restoration, explicit deferral preservation, same-day combined coverage, out-of-order undo, genuine recall/test preservation, Forgot evidence, range isolation, pre-update saved tasks and recompletion from a new actual date.

Two additional browser checks recreate the OWS case on mobile: all task fields in the topic editor save together; Cancel does not save; row/status clicks never complete work; the named completion button has persistent Undo after reload; Today → Completed exposes Undo; and topic-editor undo is staged until Save. They also check 390px/320px layouts and removal of accidental revision schedules. The complete **23-check** suite passed against the production build after this change with zero main-workflow errors or failed requests.

## Browser checks actually passed

Run with `APP_URL=http://127.0.0.1:5174 npm run test:browser` against `npm run preview -- --port 5174` after the final production build. An earlier 19-check run also passed against the development server.

1. Personal workspace starts without fake tasks and loads all six optimized 3D islands.
2. Selecting an island previews it without changing study data; **Open subject** opens its actual subject.
3. Parsing produces four editable proposals and saves nothing before confirmation.
4. Completing real work persists across reload and schedules day +1 from the completion date.
5. Overload suggestions move work only after explicit confirmation, with no false completion.
6. A seventh custom subject creates a usable new island and subject card.
7. Rename, archive and restore preserve subject identity/history.
8. Overall-only test leaves schedules untouched; supplied topic score advances its actual schedule.
9. Demo ratings require an active-recall acknowledgement and never modify personal storage.
10. JSON export/import round-trip requires replacement confirmation; invalid backups cannot replace data.
11. Permanent deletion requires the exact subject name.
12. Every main screen fits 390px and 320px widths.
13. Native modal handles Escape and browser-managed focus restoration.
14. Confirmed personal reset restores editable starters and empty progress, not demo progress.
15. Manual task entry, revision opt-out, grouped topic creation and saved resource links work.
16. Corrupt storage remains byte-for-byte intact and exposes original-data download.
17. Unavailable storage leaves core UI usable with a persistent memory-only warning.
18. Forced WebGL failure is contained; 2D alternatives remain usable.
19. Another tab’s changes pause writes; memory-only edits cannot overwrite that tab.
20. Forced model-file and lazy 3D-module failures cannot break planner navigation.
21. Fourteen subjects remain available while the 3D scene pages groups of twelve.
22. Topic editing includes all task fields, saves atomically, and Cancel/row/status clicks cannot change completion.
23. Explicit completion has persistent Undo in subject and Today; staged topic-editor undo cleans accidental revisions only after Save.

The browser runner uses isolated, temporary profiles and software WebGL. It does not insert demo/test data into the user's interactive preview. Intentionally failed requests and expected error logs in failure-injection profiles are separate from the zero-error main workflow assertions.

## Immersive World replacement

The user rejected the earlier bounded 3D card as insufficiently immersive. World now fills the viewport; journey, island selection and actual topic tasks are floating UI. Enter island changes camera/scene state inside World, not the route. The ordinary subject editor and explicit 2D view remain accessible. The original generated concepts remain art targets; this first pass is not claimed to match their model detail.

The production build passed **9 rewritten world browser checks** (`APP_URL=http://127.0.0.1:5174 npm run test:world`):

1. Canvas bounds equal the full viewport, without page scroll on the desktop test viewport.
2. Nine successive 45° rotation commands pass a full 360° turn without an azimuth clamp. Repeated rotation is checked with reduced motion so software WebGL need not animate every turn.
3. Button zoom passes the former 1.8× limit; actual mouse wheel, drag orbit and right-button pan change the camera; dragging does not select an island.
4. Subject jump finds later groups, dialogs consume Escape, and keyboard topic selection opens actual tasks inside World with focus transfer.
5. Five evidence categories, plot/task identity, six-plot pagination and in-world topic deep links survive reload without modifying study data.
6. 320px/390px world/garden layouts fit the viewport and labels do not overlap; a Chromium-emulated two-finger pinch changes camera distance.
7. Explicit 2D mode retains navigation, search and topic editing.
8. Reduced-motion preference preserves selection and reset.
9. WebGL/model failures are contained when entering a deep-linked island; switching to 2D retains all fourteen test subjects.

Ten layout unit cases now cover perspective fit (rather than the removed orthographic zoom cap), island spacing/groups, topic positions and label separation. The **23-check core workflow suite** was rerun after the final presentation polish. Both suites report zero errors/failed requests in their main profiles; deliberate failure profiles remain separate. Scheduling, parser, persistence schema, completion and Undo engines were not changed. Test fixtures use isolated browser profiles, not the user's interactive workspace.

Rendering uses demand frames, capped DPR, instanced decorative clusters and cached static shadow maps. This is an implementation description, **not a measured FPS claim**. Browser tests use software WebGL and take several minutes for the full orbit/gesture suite. Physical-device touch, low-end-device frame rates and Safari/Firefox remain unverified.

## Visual/readability checks

Inspected rendered desktop World and Today plus mobile World, Today and Revisions. For the navigation follow-up, also inspected selected-island desktop/mobile and the six-plot subject garden at 320px/390px. Text colours were adjusted for readable contrast while retaining the approved cream/sage palette. Decorative Unicode glyphs were replaced with SVG icons where the local font subset did not include them. Browser screenshots wait for page-entry animation and fonts to finish.

Automated axe-core spot-checks used the nine populated desktop views, WCAG 2 A/AA and WCAG 2.1 AA rule tags. They are **not** a full accessibility certification; all modal states, assistive technology and physical touch targets still warrant broader manual review.

## Reproduce

```sh
npm ci
npm test
npm run build
npm run dev
# In another terminal, after optional browser tooling installation:
npm --prefix design/model-review ci
npm run test:browser
npm run test:world
```

Optional production-server check:

```sh
npm run preview -- --port 5174
# In another terminal (POSIX shell):
APP_URL=http://127.0.0.1:5174 npm run test:browser
APP_URL=http://127.0.0.1:5174 npm run test:world
```

Generated evidence is intentionally ignored by Git:

- `.cache/app-check/results.json` — latest browser assertions, errors and failed requests.
- `.cache/app-check/world-desktop.png`, `today-desktop.png`.
- `.cache/app-check/{world,today,revisions,tests,analytics,settings}-mobile.png`.
- `.cache/app-check/topic-editor-mobile.png` and `explicit-task-actions-mobile.png` — correction follow-up.
- Temporary backup fixtures in the same directory.
- `.cache/world-check/results.json`, `world-{desktop,mobile}.png`, `selected-desktop.png`, `island-{desktop,390,320}.png` — immersive world checks.
- `.cache/immersive/a11y.json` — latest nine-view accessibility spot-check.
- `.cache/immersive/final-{world,tasks}.png` — six-subject visual review.

App source, locked dependencies, tests and reproducible scripts are the deliverables. No commits, pushes or cloud deployments were made. See [APP_GUIDE.md](APP_GUIDE.md) for intentional first-build limitations.

## Reference-page redesign

Today, paste confirmation, task details, Revisions, Tests, Analytics and Settings now use the layout/palette of mockups 03–09. Subject also has an island/topic-list split view. The immersive World, parser, study engine and browser-local data schema remain in place; the concept artwork is not a claim of exact 3D geometry fidelity.

Additional checks (`npm run test:pages`): navigable/read-only month calendar; legible mobile review titles and visible task actions at 320px/390px; explicit inline test saving; live analytics periods; unsaved preference drafts; Today-to-paste review with explicit confirmation; responsive task drawer with actual completion and Undo. Eight new analytics unit tests cover inclusive periods, future exclusion, absent averages, recall/test separation, estimates, event counting (including historical tests that do not rewind schedules) and read-only behavior.

Screenshots inspected at desktop/mobile sizes, including paste review and task details. Evidence is generated under ignored `.cache/redesign/` and `.cache/page-check/`. Fixed two discovered mobile issues rather than relying only on overflow checks: sticky dialog actions covering checkboxes, and revision badges squeezing titles to a single-letter column. Automated accessibility checks prompted named mobile navigation, valid heatmap roles and darker secondary text.

## Bounded central zoom and scroll follow-up

- Responsive min/max camera distances prevent excessive zoom-in/out while retaining close island exploration and 360° rotation. Resize/focus changes do not replay previous zoom-button commands.
- Fog starts beyond the farthest permitted world view, fixing islands fading into flat pink silhouettes at distant zoom levels.
- Wheel input is consumed only within the central 60% rectangle. Outside it, browser/page/panel scrolling remains native. Touch edge strips allow native vertical scrolling while the centre retains orbit/pinch interaction.
- Damping settles relative to elapsed frame time, rather than drifting for many slow software-rendered frames. No model files or study data changed.
- Production build and **76 unit tests passed**. The complete revised **12-check immersive suite passed**, including extreme wheel saturation at both bounds, centre-vs-edge event handling, real document scrolling and Chromium-emulated native mobile edge swipes. Earlier 23 core + 7 reference-page checks remain the baseline for unchanged workflows.
- Inspected maximum zoom-out screenshots at desktop and 390px mobile; islands remain 3D and visible. Evidence: `.cache/world-check/bounded-zoom-out.png`, `mobile-bounded-zoom-out.png`, `subject-normal-scroll.png`, `results.json`. Physical-device FPS and Safari/Firefox remain unmeasured.

## In-preview mobile layout controls

The development server now opens a same-origin app frame below a Desktop / Tablet / Mobile toolbar (initially 390 × 844 Mobile). The app mounts only inside that frame; the outer toolbar never starts a second study-data provider or a second 3D scene. Device selection, width presets, Rotate and actual-size/Fit resize the existing iframe without changing its source or remounting it. Production rendering remains the ordinary full-window app.

Validation: `npm run build` and **76 unit tests passed**. The new `npm run test:preview` passed **5 browser checks** on the development server: actual iframe media-query sizes; one app with no recursive toolbar; unsaved preference/state continuity and unchanged personal storage; 320/390/430px widths, rotation, Fit/100%, and narrow-container containment; live 3D canvas and retained demo selection; native task drawers retained while resizing. Screenshots were inspected for a mobile 3D World and the narrow outer preview container. Evidence: ignored `.cache/preview-check/`. This does not claim physical touch-device emulation or measured mobile FPS.

## Shared-header milestone (2026-10-16)

Replaced the divergent World/page headers with one `AppHeader`; removed obsolete header-specific CSS rather than stacking another set of overrides on it. All pages keep the same ordering, text labels, logo/date/Paste styling and responsive rules. The only World distinction is floating placement. Shell measurements replace fixed header/banner offsets and keep the mobile subject selector below the introduction.

Latest validations for this milestone:

- Production build/strict TypeScript passed, as did **76 unit tests**.
- **5 new header browser groups passed:** seven page types at 14 widths from 320 to 1800px (98 closed-header combinations, plus expanded-menu cases); tablet/desktop/mobile breakpoint boundaries; constant navigation labels and order; clipping and overlap geometry; menu open/close, Escape/focus restore, outside interaction, resize reset, route closing and Paste; demo notice clearance. Escape with an open navigation menu must not also exit a 3D island.
- **23 core browser workflows, 7 page checks and 5 development-preview checks rerun and passed**. Thus 40 current browser check groups passed for this milestone. The prior 12-check immersive suite remains a separately recorded baseline; it was not rerun for this header-only milestone.
- Inspected rendered desktop Today, tablet World, mobile World and 320px Today. Screenshots and JSON results are under ignored `.cache/header-check/`; existing suites retain their own evidence folders.
- Widths include desktop zoom-equivalent CSS viewport sizes; this is not a claim of testing every real browser zoom setting, OS text scaling or physical device. Previous axe results remain historical spot-checks, not a new accessibility certification of this header.

Custom icon redesign, richer island artwork and stylized animated villagers remain the next ordered visual stages. No study-engine, parser, persistence schema or Blender model changes were made in this milestone.


## Custom SVG milestone (2026-10-16)

Replaced every app/preview Lucide import with the original Study World SVG family: 50 UI glyphs and a separate full-colour brand mark. The favicon matches the header logo. Generated standalone assets/specimen use the same React source of truth; they are not separate hand-maintained drawings. Vitest now also discovers `.test.tsx` so the eight new icon tests actually run.

Current results after final icon integration:

- **Production build and strict TypeScript passed; 84 unit tests passed.** Eight new tests cover all glyphs, shared stroke/colour rules, decorative versus named-image semantics, dimensions/prop forwarding, repeated-instance safety, brand rendering, revision-versus-Undo semantics and all seven dynamic subject themes.
- **3 icon browser groups passed:** all 51 exported SVGs self-contained and labelled; geometric/stroke bounds across the 16/20/32/56px specimen; six live navigation identities; six live demo subject colours inherited by SVG; mobile Menu/Paste and Escape behavior. No browser exceptions. Evidence: ignored `.cache/icon-check/`; the compact visual review output is `design/icons/preview.png`.
- **5 header, 7 page, 23 core workflow and 5 development-preview groups rerun and passed** on the final application build/dev preview. Together with the 3 icon groups this is **43 current browser check groups**. Header checks still cover seven page types at 14 widths (320–1800px); core checks retain dynamic subjects, completion/Undo, explicit saves, data recovery and demo isolation.
- Inspected the rendered SVG specimen and mobile Today, plus desktop/tablet/mobile header screenshots. The existing 12-check full immersive-camera suite and earlier axe checks remain historical baselines; neither was rerun for this icon-only milestone. This is not physical-device/OS-zoom certification or measured mobile FPS.

No scheduling/parser/persistence changes, new 3D models, Blender scripts or villager animations in this milestone. The next visual stage is island artwork, followed by stylized animated villagers.


## Pre-artwork layout corrections (2026-10-16)

User feedback: replace the long Revisions list and fix Today’s journey being stuck/cut off over the World. Implemented a bounded card grid (four per larger-screen page, two per phone page), full paging for schedules/history, filter/page resets, and expandable calendar/schedule panels. The journey is now an on-demand native drawer rather than a tall permanent overlay. Removed the obsolete fixed-card rules and explicitly restore modal trigger focus on cleanup.

Validation on the final application build:

- Build and strict TypeScript passed; **84 unit tests passed**.
- `npm run test:workspace`: **5 new browser groups passed**. Checked every due item across paged cards at 320/390/640/768/900/1108/1440px; card action containment/title space; subject/date/tab changes and all history records; compact calendar disclosure; real Review/Move dialogs with no implicit saves; journey action reachability and dialog bounds at 1108×628, 1440×600, 768×600, 390×844, 320×568 and 844×390; Escape/focus return; Continue navigation; unchanged personal/demo storage and no browser exceptions.
- **23 core, 7 page, 5 header and 5 development-preview browser groups rerun and passed**. Including the five new workspace groups, **45 current browser groups passed**. The prior icon-specific and full immersive-camera/axe checks remain separately recorded baselines, not newly rerun here.
- Inspected rendered compact mobile/desktop Revisions, the World with its small journey trigger and the open journey drawer. Evidence: ignored `.cache/workspace-check/`; build output `.cache/layout-fix-build.log`.

No scheduling/parser/storage schema changes or 3D artwork/villager changes. These are layout corrections before the island-artwork stage, not that next stage being marked complete.


## Scheduled revision exams (2026-10-16)

User requested actual recurring exam planning for revised topics, while retaining external result records; delegated the interval choice and chose to sit exams outside the app. Implemented a configurable seven-day default, read-only syllabus/deadline derivation from completed recall evidence, a Tests plan, Today due reminder and explicit linked completion with historical syllabus snapshots. Existing manual test recording, score thresholds and revision intervals are unchanged. No in-app questions, background notifications, backend or paid AI.

- Production build/strict TypeScript and **105 unit tests passed**. The 21 new exam tests cover first recall/learning separation, default/exact due boundaries, duplicate topic and range handling, weak recalls, future/test-source exclusion, archived subjects, overdue read-only stability, explicit completion, overall-only immutability, unrelated results, same-day replacement, actual-date anchoring, inactive periods, backdated and early exams, optional topic scores, replay/empty/future guards, historical deletion, metadata validation, interval validation, and legacy v1 storage/backup compatibility with completed-exam round trips.
- `npm run test:exams`: **7 new browser groups passed**, using validated study-engine fixtures with seven dynamic subjects and two vocabulary ranges. Checked defaulting legacy preferences; full syllabus access at 320/390/768/1440px; non-mutating paging; Today link/reminder; date clearing without a crash; draft/cancel and confirmation gating; staged/saved interval edits and persistence; unaffected ordinary journal; explicit full-syllabus save, reload and unchanged overall-only schedules; snapshot display; next recall/checkpoint without fabricated completions. No browser exceptions. Evidence: ignored `.cache/exam-check/`; build output `.cache/exam-build.log`.
- **23 core + 7 page + 5 header + 5 development-preview + 5 workspace browser groups rerun and passed** alongside the seven exam groups: **52 current browser groups**. These preserve prior compact Revisions, native journey drawer, header/device controls and existing study/data workflows. Core/page suites ran after business-logic integration, before wording/memoization polish; header/preview/workspace followed that polish, and the exam suite was rerun after the final wording/default-fallback changes.
- Inspected desktop and phone Tests with the new plan. Earlier dedicated icon, full immersive-camera and axe results remain historical, not newly rerun/certified for this feature. No physical-device FPS/OS-zoom certification.

Storage remains version 1 with a backwards-compatible defaulted `examIntervalDays` preference and optional `revisionExam` metadata on results. Syllabus IDs/names are historical provenance, not live foreign keys; deleting subjects retains that exam history while ordinary live topic-score references are cleaned by the existing deletion rule. Invalid new metadata is rejected by the same validated repository/import flow. No corrupt-storage recovery policy was weakened.


## Mathematics artwork — first island review, historical (2026-10-16)

User approved implementing Mathematics first before extending the visual direction. Added a deterministic, newly authored GLB for the maths theme, while preserving all original 20 optimized assets and their hashes. Skipped the old base/landmark/trees/dressing only for this profile; runtime topic state models remain unchanged. No scheduling/parser/exam/schema/storage edits.

Final validations:

- Build/strict TypeScript and **105 unit tests passed**.
- **5 asset validation groups passed:** actual GLB/hash/binary layout and resource/budget bounds; 11 opaque batches and finite attributes; **54 ray intersections** across all six topic footprints proving a level unobstructed Y=0.24 surface; matching Blender geometry/colour payload with no automatic deletion/save/export; unchanged hashes of all 20 legacy deployment files. Python compilation of the complete generated Script 14 passed.
- **4 new artwork browser groups passed:** actual front/back/side/phone renders, materially distinct orbit views, 15,092 triangles and 11 main-pass calls in the isolated viewer; maths-theme routing including a second dynamic maths subject; preserved five other landmarks; real topic paging/tasks and unchanged stored data; 320/390px canvas/controls; reduced motion; actual visible recovery when the new GLB is blocked, followed by working planner navigation. Evidence: `.cache/maths-art/asset-validation.json`, `browser-results.json` and screenshots; final review image: `design/islands/maths-v2-preview.png`.
- The complete **12-check immersive suite**, **23 core workflow groups** and **5 development-preview groups** were rerun and passed. With the four artwork groups, **44 current browser groups passed**. This rechecks full 360°, bounded centre-only zoom, pan, native edge scroll/swipes, all five actual topic states, deep links, topic paging, dynamic subjects, data/recovery paths and stable device-preview state.
- Updated the immersive suite's deep-linked Maths fault injection to block the new maths GLB instead of an old base no longer used by this isolated profile. Recovery waits now distinguish visible fallback UI from the HTML fallback content that legitimately remains hidden inside a healthy canvas. An initial run passed nine groups before reaching that stale interception; the corrected full rerun passed all twelve.
- Inspected clean mesh front/back/side/phone renders, the actual World overview and entered Math garden, and desktop/phone task views. Earlier dedicated header/page/exam/axe suites remain historical for this visual-only change, not newly rerun or certified here.

Budget: **1,144,080 bytes (~1.09 MiB), 15,092 triangles, 11 geometry/material batches**, no external textures, decoder, skin or animation tracks. Vertex colours use normalized 8-bit data, with only identical position/normal/colour tuples welded. No added render loop or water/character animation. Isolated main-pass counts are not whole-world counts or measured mobile FPS.

The matching Blender 5.2-targeted script is a complete offline reconstruction in a new scene on each run; it preserves existing scenes and files. Syntax/data/safety checks are verified; **Blender 5.2 itself was not executed in this sandbox**, so local Blender render approval remains outstanding. Remaining islands and stylized animated villagers are still future work. Visual approval/refinement of this first island comes first; concept-art fidelity is not claimed.


## All-theme artwork rollout — current results (2026-10-16)

User approved Mathematics and authorized extending all designs at once. Added individually authored static islands for reasoning, English, GK, DSA, software and generic/custom subjects, retaining the approved Mathematics GLB SHA256 `7afdf158c4dc3f09660286778153402ba08b6cfc2e688e3aa55417cd52184b42`. Runtime routing now depends only on the supported theme, not subject identity or a fixed six-island list. Removed the old static assembly from every runtime profile, while preserving legacy files/backups. Topic-state models and study logic are unchanged.

Final checks on the completed rollout:

- **Production build / strict TypeScript and 106 unit tests passed.** New unit coverage asserts all seven theme asset routes, including generic/custom.
- **All seven actual GLBs passed asset tests:** hashes/binary structure and metadata consistency; unique assets, finite attributes/bounds, compact normalized colours, opaque vertex-colour materials, at most 11 batches, under 16,000 triangles and 1.3 MB each; no textures, skins, animations, decoder requirements or external resources. Generated reports are in `.cache/island-art/asset-validation.json`.
- **2,058 downward ray samples** (294 per profile across all six radius-0.6 footprints) prove genuinely level unobstructed Y=0.24 topic surfaces. Every expanded GLB corner matches Script 15's embedded positions within six-decimal rounding tolerance, and embedded colours re-quantize to the exact GLB byte, accounting for glTF interleaved/padded colour buffers. Both complete Python scripts compile. New-scene-only/no-automatic-save/export/delete safety checks passed. Existing Maths tests additionally retain all 20 legacy model hashes.
- **24 new all-theme browser groups passed:** real front/back/side renders for every profile with exact isolated main-pass draw/triangle counts; reviewer theme switching and geometry disposal; thirteen custom/default subjects across 12-island groups, including generic; every custom-themed garden's six-plus-two topic paging and selection; every profile at 320/390/430px under reduced motion; a blocked non-Maths asset reaches visible 2D recovery and usable Today; stored personal study data is unchanged by browsing artwork.
- **4 Maths + 12 immersive World + 23 core workflow + 5 embedded-preview groups fully rerun and passed.** Combined with the 24 new groups, **68 current browser groups passed**. This retains camera/central-only bounded zoom/edge scroll and swipes, all actual evidence states/deep links/paging, dynamic subjects, editing/completion/Undo, explicit saves, storage/demo/recovery and live iframe device controls/drafts/dialogs.
- Updated the Maths suite's five legacy-landmark request assertions to require the new themed GLBs. Updated the core suite's model fault interception to block the new Maths GLB, which the app actually requests; failure assertions now require a visibly sized fallback rather than hidden HTML content inside healthy canvas elements. The initial new all-theme run reached the final generic phone checks before a resize-observer assertion race; the test now waits for actual canvas layout at the new width. The full final chain passed. No runtime layout workaround was needed.
- Inspected actual renders of all seven profiles and the overview, plus real desktop/mobile topic views. Durable overview/front images: `design/islands/`; detailed JSON/screenshots: `.cache/island-art/`, `.cache/maths-art/`, `.cache/world-check/`, `.cache/app-check/`, `.cache/preview-check/`.

Per-island triangles / main-pass batches: Maths 15,092 / 11; reasoning 13,114 / 11; English 13,627 / 10; GK 15,657 / 11; DSA 14,643 / 11; software 13,144 / 10; generic 13,588 / 9. These isolated counts are **not** full-world performance budgets or measured physical-device FPS. No Safari/Firefox/physical-phone, new axe, or full Blender 5.2 application claims. The other dedicated header/page/icon/workspace/exam suites retain historical results and were not rerun for this visual-only change.

**Complete delivery:** `assets/blender/scripts/15_all_subject_art_islands.py`, one offline file with all seven embedded island recipes, separate collections/roots, Z-up conversion and presentation camera/lights in a new scene. Earlier work/scripts and exports are untouched; no automatic writes or deletion. Correct Windows download/Save As paths and beginner steps are in `design/islands/README.md`. Python syntax/data/safety verified; **Blender 5.2 runtime remains unverified**. No animation or villagers yet; that is the next ordered stage. Scheduler/parser/exams/storage schema/backend were not changed.


## Stylized animated villagers — current results (2026-10-16)

Implemented the next authorized stage: three original rigged 3D characters, four clips each (Walk/Idle/LookAround/Study), moving along safe corridors on all seven island profiles/custom subjects. One skinned vertex-colour material batch, 14 bones and 2,556–2,616 triangles per variant; 390,124–392,252 bytes each. No person images, billboard sprites, texture dependencies or static substitutes. Island GLBs themselves remain unchanged/static; character animation is an independent optional layer.

Runtime budget: at most three characters across the desktop overview, two on the focused island, one on compact canvases; shared cached assets with separate skeletons/mixers, one capped demand-render timer, contact-shadow discs instead of dynamic shadow-map redraws. Explicit pause/resume; live native reduced-motion subscription (the installed Motion hook only snapshots at mount), hidden-document/canvas/frustum guards, no wall-clock catch-up, cleanup of timers/mixers/bone textures on navigation/layout replacement. A character fetch failure does not escalate to the island's 2D fallback. Decorative movement never reads/writes study evidence or scheduling.

Final verified results on the completed implementation:

- **Production build / strict TypeScript and 112 unit tests passed.** Six new pure tests cover deterministic identity, global budgets, custom subjects/no data mutation, corridor/topic separation, movement/activity/turn continuity, periodicity and stop/start speeds.
- **All three actual GLBs passed:** generated hashes/resource/size/triangle budgets; real 14-bone hierarchy and unit rigid-segment weights; finite attributes; four genuinely deforming clips; animated bounds; embedded Script 16 position epsilon / exact quantized colours / weights / rest bones / sampled animation channels. Python compilation and new-scene/no-auto-save/export/delete safety checks passed. Reports: `.cache/villagers/asset-validation.json`.
- **4,326 downward ray samples** across both full 0.4 m-wide walking corridors on all seven actual islands passed. The initial rear corridor was moved slightly forward to clear the Reasoning/English plinths without editing approved artwork. Existing **2,058 topic-clearance rays**, all seven island metadata/hashes, the approved Maths SHA and all 20 legacy hashes rerun/preserved.
- **13 new villager browser groups passed:** real skinned rendering/pose changes and real WebGL video recording; global overview/focused crowd caps; autonomous Walk/LookAround/Study; explicit simulation/pose freeze and resume; live OS reduced-motion changes and disabled override; actual offscreen-canvas pause/resume; simulated hidden-document signal; all seven themes/new generic subject with six-plus-two topics and real selection; animated 320/390/430px layouts and six controls without overlap; SPA cleanup; villager-fetch failure isolated from 3D/topics/Today; development StrictMode and Tablet/Mobile rig replacement without animation binding errors.
- **24 all-theme + 4 Maths + 12 immersive World + 23 core workflow + 5 embedded-preview + 3 SVG icon browser groups fully rerun and passed.** With the 13 new groups, **84 current browser check groups passed**. Existing 360°/bounded central zoom/edge scrolling/pinch, actual evidence and tasks, parser/completion/Undo, dynamic subjects, storage/demo/recovery, stable iframe/drafts/dialogs and native menu/Paste workflows are retained. Two original pause/play glyphs extend the SVG family to 52 UI icons plus brand, all portable exports checked.
- Inspected actual close-up character poses, a live garden with real study evidence, mobile tasks and embedded device preview. Durable PNG/approximately 6.6-second actual-canvas WebM: `design/villagers/`. Latest browser JSON/screenshots: `.cache/villagers/` plus the existing suite folders.

Issues found and corrected rather than hidden: first-visit Vite discovery of SkeletonUtils reloaded the embedded frame (fixed explicit startup prebundling); StrictMode effect replay disposed reusable mixer bindings (fixed immediate timer stop plus cancellable microtask-delayed irreversible disposal); an all-theme test pointer click raced new labels' first projected screen position (test now waits for actual visible projected geometry, not count alone, before a real click). Corrected complete reruns passed; StrictMode remains enabled and browser-error assertions were not removed.

The browser visibility test **simulates** `document.hidden`/visibilitychange; it is not certification of every real browser background-throttling policy. Frustum guards are implemented; viewport tests and scheduling caps are not physical-phone FPS, battery or Safari/Firefox certification. Other dedicated header/page/workspace/exam/axe suites retain historical results, not new passes for this stage. No parser/scheduling/exam/storage schema/backend changes.

**Blender delivery:** `assets/blender/scripts/16_animated_villagers.py`, one independent offline character-studio script, all three real armatures/four actions each, fresh scene on every run, earlier files/scenes preserved, correct Windows folders and available Blender 5.2 engine enums. Python syntax, data correspondence and safety checked; **actual Blender 5.2 application execution/rendering remains unverified**. Sampled poses match source data; Blender interpolation/rendering can differ between keys. Beginner instructions: `design/villagers/README.md`.

## Aurel sky drake — static model review (2026-10-16)

New art-only approval stage, not a planner feature rollout. `design/sky-creature/models/aurel_sky_drake_v1.glb` is rendered in a separate dev-only interactive studio (5176), outside deployed `public/models`. **No armature/clips, app flight paths, planner components, scheduling, schemas or storage changes.** Full instructions/report scope: `design/sky-creature/README.md`.

- Strict TypeScript/production build and **112 existing unit tests** passed anew. Build has non-fatal dependency comment-annotation warnings.
- **7 new actual Chromium/WebGL review groups** passed: real 13-part / 10,188-triangle GLB rendering without animation; all named camera views including face/underside; real wireframe geometry changes; drag/orbit/zoom/Hero reset; 320/390/430px layouts without overflow or clipped controls; static demand-only rendering under reduced motion and no storage writes; zero page/console errors. Screenshots inspected from hero/top/underside/head plus mobile.
- GLB SHA/budget/resources, finite positions/colours, mirrored membranes, one opaque material with no double-sided hiding, 50 closed consistently wound positive-volume components across 13 parts verified. GLB is 875,036 bytes, no textures/external dependencies/skins/animations. Distinct anatomical components may overlap at joints: this is not a unified printable solid.
- Complete offline **Script 17**: Python compilation and embedded geometry/colour equality to the exact source recipe checked. AST safety audit verifies only allowed offline imports, no file IO/destructive calls/operators or automatic export/save, a fresh scene and proper orientation-preserving coordinate conversion. **Actual Blender 5.2 application execution is unverified.** 56 previous app-model and script files hash-preserved. Fresh builder runs retain the same GLB SHA.
- **Prior 84 app browser groups are historical villager-stage results, not rerun claims for this separate static art delivery.** No real-phone FPS, rig quality or flight-path performance claim. Runtime integration and reduced-motion/count policies will require their own tests after user model approval.

Current scratch reports: `.cache/sky-creature/{asset-report,blender-report,browser-report}.json`. Durable deliverables: `assets/blender/scripts/17_aurel_sky_drake.py`, `design/sky-creature/{README.md,preview.png,manifest.json,models/aurel_sky_drake_v1.glb}`.

## Aurel flight rig — Script 18 current results (2026-10-16)

User-approved static geometry is now smoothly weighted to a real 16-bone FK armature with Wingbeat (3.2 s), Glide (6 s) and TailSway (4.8 s). The development-only rigged GLB/studio is separate from the planner. No app imports, production model files, flight routes or learning-state changes. Full delivery and beginner instructions: `design/sky-creature/ANIMATION.md`.

- **13 actual Chromium/WebGL groups passed:** real one-draw skinned model (10,188 triangles / 16 bones / three clips); distinct up/downstroke pixels; clip/play/pause/scrub controls; actual skeleton links; camera/orbit/zoom/reset; all controls at 320/390/430 × 844; live and first-load reduced-motion freeze/disabled override with static pose control retained; simulated document-hidden signal; actual non-intersecting canvas suspension/resumption; genuine approximately 9.2-second canvas recording; original static review availability; zero page/console errors or storage writes. Up/downstroke, face/underside, skeleton and mobile screenshots inspected.
- Rigged GLB **1,688,464 bytes**, one skinned mesh/material, no textures/external buffers. SHA and geometry budget, unchanged approved source vertices/colours, all indexed positions/colours/skin indices/weights, unit weight sums, 10,137 blended indexed vertices, 16-bone parent/rest hierarchy, exact embedded animation samples and finite normalized periodic quaternions checked. All three loops genuinely deform the tail; Wingbeat sampled wingtip travel exceeds 3.5 model units, Glide is restrained, TailSway keeps wings fixed. Sampled animated bounds remain finite/bounded.
- An independent hierarchy/skin-matrix calculation validates orientation-preserving Blender-basis conversion against transformed Three CPU skinning. **This is math/data verification, not Blender execution or intermediate-render identity.** Blender and browser interpolation/rendering can differ slightly. Complete offline Python compiles, full payload equals the current rig source; new scene, only mode-changing bpy operators, no save/export/deletion/file/network calls; slotted actions and linear keys audited. Duplicate endpoint keys are excluded from Blender playback ranges. 64 prior asset/script/static-review files hash-preserved.
- **Strict TypeScript/production build and 112 unit tests passed anew**; static Script 17 geometry/Python/safety checks also rerun. Non-fatal dependency annotation warnings remain. The **84 earlier planner browser groups remain historical**, not fresh app regression claims for this isolated art stage. No physical-phone FPS, real browser-background throttling, Safari/Firefox or Blender 5.2 runtime certification.

Durable motion deliverables: `assets/blender/scripts/18_aurel_flight_animation.py`, `design/sky-creature/{ANIMATION.md,animation.html,animation.js,animation-manifest.json,animated-preview.png,aurel-flight-motion.webm,models/aurel_sky_drake_rigged_v1.glb}`. Current reports: `.cache/sky-animation/{asset-report,blender-report,browser-report}.json`. Studio 5176 opens animated review; planner 5173 and Script 17 remain untouched. Website flight-path integration is pending a later authorization/review.

## Aurel live-world flight — current integration verification (2026-10-16)

The user authorized website integration without requiring manual Blender reproduction. The approved skinned GLB is now optionally loaded in the real R3F world. One creature per canvas on desktop/compact layouts; view-aware 48-second depth/bank circuit, smooth three-second Wingbeat/Glide weight transitions, independent Sky pause and no raycast/shadow interaction. Existing islands, villagers, study logic and storage are unchanged. Source/placement/budget details: `design/sky-creature/FLIGHT.md`.

**Current results:** strict TypeScript/production build, **117 unit tests / 10 files**, **96 browser groups**, runtime asset/byte/hash/budget checks and existing Script 18 rig/Python checks passed.

- **12 new flight integration browser groups:** one actual skinned flyer and changing route/joints; independent flight freeze/resume while villagers continue; actual time-driven transition into Glide; live reduced motion stops clocks and prevents overrides; simulated hidden-document signal and genuinely offscreen canvas freeze/resume; six-plus-two plots, real pointer selection/task panel and projected UI clearance; 320/390/430px single-creature layouts with visible flight/no overlapping Sky/panel/camera controls; custom subjects and SPA removal; 14-subject Next/Previous paging at 800/320px; failed optional creature download isolated from the real island/Today; StrictMode/repeated Tablet/Mobile replacement; no page errors or learning-storage writes during decorative controls. Report: `.cache/sky-flight/browser-report.json`.
- **84 existing browser groups rerun and passed:** villagers 13, embedded preview 5, SVG icons 3, all-theme artwork 24, Maths 4, immersive World 12, core planner 23. These now include the integrated optional sky layer. Other dedicated page/header/workspace/exam/accessibility suites remain historical, not new passes for this stage.
- Five new pure unit tests cover bounded/periodic/smooth path, blend continuity, compact/desktop footprint and sky-band policy, arbitrary/empty anchors without mutation, and padded exclusions. Existing 112 tests still pass.
- Deployed GLB exactly matches the approved source: **1,688,464 bytes / 10,188 triangles / one mesh/material / 16 bones**, SHA `fbae5bbbc0ee6fa0f14b5de5388f7179ac69d35ca3e537a8c025cc9cced73933`. Runtime publish copies only that asset and metadata; earlier model/script hashes remain preserved by the rig-stage audit. No additional textures, rig rebuild or Blender export required.
- Screenshot delivery: `design/sky-creature/world-flight-preview.png`; compact/task/embedded captures: `.cache/sky-flight/`. Motion guards, timer ceilings (24/18 Hz, 8 Hz clearance checks), shared cached resources and instance-only cleanup are implemented. These are not hardware FPS/battery or all-browser background-throttling guarantees. UI exclusion rectangles refresh about every 160ms; projected plot safety is per frame, and DOM overlays always retain higher stacking priority.

Issues caught and corrected: initial conservative placement collided with the header/top tools (moved into responsive open sky bands); the compact Sky button touched the panel by two pixels (reduced its compact height); the core suite exposed Sky covering the group pager's Previous button (shifted for paged worlds and added a direct pointer-click regression). One heavily parallel World run timed out waiting for the camera; the unchanged complete suite passed serially. The first long core run outlived a shell wait, was allowed to finish, and failed on that pager issue; a controlled complete rerun after the fix passed all 23 groups. No failure was suppressed or selection assertion removed.

Actual Blender execution, Safari/Firefox and physical-phone performance remain unverified. No parser/schedule/exam/storage-schema/backend changes, commits or pushes. The normal embedded planner is on 5173; the optional source animation studio stays on 5176. No new Blender action is required from the user.

## Default embedded mobile dragon visibility correction

The previous focused-mobile checks missed a default-overview bug: the closed Island atlas returned a nonzero descendant rectangle and incorrectly blocked Aurel. Reproduced at the actual default 390×844 embedded viewport (0/16 visible samples). Fixed by filtering unpainted overlays, projecting conservative animated bone bounds instead of a whole-body cube, enlarging the creature and moving its compact overview lane lower and in front of distant clouds. Study UI/plot exclusions remain active.

Fresh verification for this correction: production build, **125 unit tests**, approved runtime model/hash audit and **13 flight browser groups passed**. The new default embedded regression tests 320/390/430 widths, requires sustained visible samples, confirms **1,534 changing rendered pixels** in the creature footprint, and checks atlas-open clearance and atlas-close recovery. Independent pause, reduced motion, hidden/offscreen clocks, topic/group paging, task selection, optional-download recovery and StrictMode/tablet/mobile switching all passed in the same flight suite. Actual screenshot: `design/sky-creature/world-flight-mobile.png`. Other older browser suites above were not rerun for this correction.

## Desktop/tablet popping correction

Cause: checking only the current wing pose on a fixed route allowed that route to cross header/panel exclusions, abruptly hiding and restoring the entire dragon. Added deterministic whole-route corridor planning for canvas widths >=700px, using padded swept bounds, actual painted UI and all projected plot regions. It fits the horizontal route and size into clear sky, preferring upper sky but falling back to lower sky on crowded tablet layouts. The mobile placement and all final UI/plot exclusions remain intact.

New `npm run test:sky-continuity`: **six embedded layout cases, 4,800 actual scene-object samples, zero hidden poses and zero visibility transitions**. Desktop and tablet overviews span the full combined 144-second route/wing cycle; narrower desktop, tablet landscape and focused desktop/tablet each span 48 seconds. The test advances real R3F subscribers using a deterministic test-only clock at 100ms steps, renders WebGL checkpoints and captures actual screenshots. It is not a real-time FPS or battery claim. An initial wall-clock run stayed visible but timed out before completing its simulated route on software WebGL; it was not counted as a pass.

Fresh production build, **129 unit tests** and approved-runtime-asset/hash audit passed. Desktop/tablet screenshots: `design/sky-creature/world-flight-desktop-overview.png`, `world-flight-tablet-overview.png`. No study data/schema, parser, scheduling, art bytes or Blender changes.

The existing **13 flight integration groups also passed again** after this correction, including mobile 320/390/430 visibility (1,593 changing rendered pixels), atlas open/close protection, independent pause, reduced motion, hidden/offscreen clocks, topic/group paging, selection, optional-download isolation and StrictMode/device switching. Other historical browser suites were not rerun for this correction.

## World enhancement pass: compact tools, orbit transitions, 2D atlas and clouds

Implemented the user's current World-only feedback:

- Non-modal, content-height Journey popover; no full-height drawer/backdrop/scroll lock. Dismissal and live plan counts preserved.
- One expandable Controls button with labelled camera actions, independent villager/dragon toggles and the 2D switch. It portals above the selected-island card, fixing a real pointer-blocking issue found during QA.
- Removed the duplicate Find your island dropdown; the single Island atlas retains selection/Enter island and group access.
- Dragon keeps a still-safe corridor, speed-limits interpolation between replacements and never teleports back to the default path when no replacement fits. Short overlaps are debounced, long obstructions fade; instance-only materials are released on real unmount. Pausing also freezes route interpolation. This is not a promise that the dragon never fades or becomes occluded during interaction.
- Replaced the faceted sphere bank with 22 soft camera-facing cloud clusters, one locally generated 128×128 alpha texture, no shadows or independent cloud scheduler. Popover surfaces are opaque rather than continuously re-blurring the moving WebGL scene.
- Actual lightweight 2D subject atlas, real topic/status/editor links, no fixed subject cap, no WebGL, preserved mode/subject selection and study data.

**Fresh verification:** strict TypeScript/production build, **132 unit tests**, approved runtime GLB byte/hash audit, and **all 7 new World-enhancement browser groups passed**. Report: `.cache/world-enhancements/report.json`. Groups cover closed-control clutter, compact Journey and Controls across desktop/tablet/mobile, actual held mouse drags, sole-atlas selection/entry, fourteen-subject 2D/deep links, 320/390/430 mode round-trips, and no browser page errors. The test uses correctly scaled physical pointer coordinates in the embedded iframe, not synthetic DOM clicks. Actual per-rendered-frame orbit traces cover 56 desktop, 55 tablet and 55 mobile frames; the largest opacity change was 0.444, with no 1→0 hard cuts. The speed-capped steering unit tests cover continuity, convergence, non-mutation and rate limits. A separate fresh-browser pointer smoke passed Zoom in, Turn right, Reset view, independent villager/dragon toggles, and final screenshot capture.

Early runs exposed an automation coordinate error for scaled iframes, a real panel stacking issue, a missing wait after async map selection, and software-WebGL screenshot timeouts during repeated animated device resizing. Coordinates/stacking/waits were corrected; the final interaction suite passed serially. Repeated GL screenshots are separated from the interaction loop; fresh final desktop/Controls/Journey screenshots were captured successfully. Physical-device FPS, Safari/Firefox, and real-phone touch performance are not certified.

Existing World/sky/villager browser scripts were adapted for the intentionally collapsed controls and revised atlas/2D selectors, but their complete older suites were **not rerun** for this pass. Historical counts above are not new passes. No parser/scheduling/exam/storage-schema/backend changes, approved asset rebuild, commit or push. Live preview remains 5173.

Actual screenshots: `design/world-enhancements/world-desktop.png`, `world-controls-desktop.png`, `world-journey-desktop.png`, `2d-desktop.png`, `2d-mobile.png`.

## Follow-up: dynamically fitted Journey and direct island entry

Journey now measures the iframe's actual visible viewport, world, header/notices and bottom tools. It chooses a below/above/clamped position, resizes when the viewport or content changes, and scrolls its body independently while keeping its close header accessible. This replaces the earlier fixed-height approximation. Island labels and the single atlas now immediately enter the selected garden; there is no second Enter island step. A prominent, nonshrinking Open subject footer opens the actual subject editor, including the selected topic. All islands and Escape preserve the expected navigation hierarchy.

**Fresh verification:** production build and **138 unit tests across 13 files** passed, including six popover-fitting tests. `npm run test:world-entry` passed **all five browser groups**: overloaded demo Journey on desktop, short/very-short desktop, tablet and 320/390/430 phones (resizing the same open panel); atlas/direct garden/Back/popover Escape; physical world-label and topic selection followed by real editor navigation; legacy island-only deep links and fitted Controls; no browser page errors. Report: `.cache/world-entry/report.json`. Browser dependencies are installed using `npm --prefix design/model-review ci` when needed.

QA initially exposed fixture issues: demo mode was lost by a full reload, keyboard focus remained in the outer preview toolbar, software-WebGL layout settled after a fixed delay, and a first topic label was occluded. The final checker retains SPA demo state, explicitly focuses the iframe, waits for measured bounds/camera stability, and physically clicks an actually visible, unobstructed plot. It does not bypass topic selection with a synthetic DOM click. Older full World/flight suites were updated for the removed Enter action and portal selectors but were not rerun in full for this follow-up.

Actual embedded screenshots: `design/world-enhancements/journey-demo-fitted.png`, `journey-short-fitted.png`, and `island-direct-open.png`. No scheduling, parser, storage-schema, backend or approved artwork changes. Physical-phone performance and Safari/Firefox remain unverified. No commit or push; live embedded preview remains on port 5173.

## Follow-up: remove the slogan and rebalance World tools

Removed the large effort/extraordinary-world heading and curiosity subtitle. Kept the compact World label as the page's semantic heading, removed obsolete introduction/exploring styles, and replaced the old slogan-dependent spacing with a compact aligned Journey/New subject row. Desktop subject panels now clear this row by 18px; mobile panels retain their bottom placement. Shrink-wrapped the left HUD so its interactive/exclusion area does not reserve the former large introduction width.

Fresh production build and **138 unit tests / 13 files passed**. The expanded `npm run test:world-entry` passed **all six browser groups**, including new assertions for removed copy, aligned/nonoverlapping top actions across desktop/tablet/320/390/430 phones, and desktop subject-panel clearance. Existing overloaded Journey fitting, direct island/topic/editor navigation, Back/Escape, Controls and no-page-error checks also passed. Other historical browser suites were not rerun. Actual new screenshots were visually reviewed: `design/world-enhancements/world-clean-overview-desktop.png` and `world-clean-overview-mobile.png`. The existing fitted-Journey/garden captures were refreshed in the same run. No changes outside World layout, its focused QA and documentation; no commit or push.

## Second World dragon: Cinder, original wild obsidian wyvern

Added an original dark, heavier wyvern alongside Aurel, with broad scalloped oxblood wings, swept horns, tooth-lined angular muzzle, geometric armour and a barbed tail. Actual skinned GLB, not a sprite or recoloured Aurel: **8,882 triangles / 16 bones / one mesh/material / zero textures / 1,420,376 bytes**. Three in-place clips; slower Wingbeat/Glide blending runs on a separate 72-second route clock. Two individuals total in immersive World, not per island. Standalone subject scenes/2D do not mount Cinder. Both flight toggles remain inside Controls, independent of villagers and one another; OS reduced motion overrides them.

Existing protected UI/plots, safe-route retention, capped corridor steering and graceful obstruction fades are reused. Cinder gives Aurel priority, reserving its swept route; explicit paired phone/portrait-tablet circuits prevent an unavailable second corridor. Invalid old-size corridors are discarded on resize. Optional fetch/parse errors now become an unavailable data state rather than a recovered render exception. A failed Cinder asset leaves the original dragon/islands/study tools working. Assets/material cleanup remains per-instance; no scheduler/parser/exam/storage-schema/backend changes.

**Fresh checks:** production build; **143 unit tests / 14 files**, including five wild-flight route/size/envelope tests; new Cinder asset validator; existing approved Aurel runtime/hash audit. All passed. The new validator also regenerates Aurel in memory through the shared rig's unchanged default path and verifies that the complete GLB is **byte-identical** to the approved deployed file.

`npm run test:wild-dragon`: **all nine browser groups passed**. Actual GLB review; two distinct real skinned actors plus changing route/wing joints; desktop/tablet/320/390/430 visibility, bounds and separation; physical held-pointer orbit with no hard opacity cuts; separate flight pause; live reduced-motion freeze/disabled overrides and no decorative learning-storage writes; real island/editor navigation; isolated failed optional Cinder download; no browser page errors. Report: `.cache/wild-dragon/report.json`; actual pose/bounds and orbit-opacity evidence alongside it. Presence/bounds samples are not a guarantee of uninterrupted visibility throughout every route/interaction.

QA corrected a real unavailable tablet corridor, stale resized routes and optional-fetch recoverable global error reporting. Automation corrections included waiting for actual R3F viewport size/camera stability, waiting for island readiness rather than just sky readiness, distinguishing an unpainted native canvas fallback from a failed rendered scene, isolating the failed-download context, and not editing live modules/package configuration while a browser run was in progress. Early incomplete runs were not counted as passes.

Source, manifest, actual review and screenshots: `design/wild-dragon/README.md`, `cinder-model-preview.png`, `world-two-dragons-desktop.png`, `world-two-dragons-mobile.png`. Other full historical flight/villager/World suites have not been rerun for this addition. Physical-phone performance, Firefox/Safari and actual Blender execution are not newly certified. No commit or push; live preview remains 5173.

The existing `npm run test:world-entry` also passed **all six groups again with both dragons integrated**: overloaded Journey through live short/desktop/tablet/phone resizing, slogan removal/aligned toolbar, atlas/direct garden/Back/Escape, physical topic selection and topic-aware real editor navigation, legacy links/fitted Controls, and no browser page errors. One earlier attempt lost the iframe execution context after screenshot capture and was not counted; the unchanged complete serial rerun passed. Combined fresh focused browser coverage is **9 new dragon groups + 6 World-entry regressions**; this does not replace every historical suite.

## User revision: same-species couple, larger male Auren replaces Cinder

Replaced the second World dragon with a larger male derived from the approved original Aurel species. Same exact vertex colours, face/fins, wing membrane styling and leaf rudder; no third actor. New bind geometry has a 14% wider/18% taller/16% longer body, 42% broader outer wing span and 65% longer tail extension. Applied the continuous morphology to vertices and joint pivots, then rebound the skeleton. Clips are 18% slower than Aurel's; banks are gentler than the retired wild profile. Original Aurel remains unchanged. Active male GLB: **1,689,048 bytes / 10,188 triangles / 16 bones / one mesh/material / zero textures**.

World uses the existing optional second slot, larger paired footprint, protected plots/UI and independent pause/reduced-motion guards. The longer silhouette is normalized against reserved screen space. A first browser run exposed tablet-tail plot overlap; moved the male's portrait-tablet lane lower, preserving the long tail and Aurel. Original Cinder GLB is archived in `design/wild-dragon/models`, removed from public deployment, and asserted not to be requested. Labels now identify Auren as the male companion.

**Fresh verification:** production build, **143 unit tests / 14 files**, new male asset validation and existing Aurel runtime/hash audit all passed. Asset validation checks exact species palette/topology, enlarged wing/tail bounds, rebound rest skin matching bind vertices, normalized weights, finite sampled deformation and actual animation; it also regenerates Aurel in memory and proves full deployed GLB byte identity.

`npm run test:dragon-pair`: **9/9 focused browser groups passed** on the completed replacement: actual model-pair review; two real skinned actors and changing route/wing joints; desktop/tablet/320/390/430 layout bounds/visibility/separation; held-pointer orbit with gentle opacity transitions; independent flight toggles; live reduced motion and no decorative learning writes; real island/editor navigation; failed optional male download isolation; no browser page errors. Report `.cache/dragon-pair/report.json`; screenshots and reproducible sources in `design/dragon-pair/README.md`. The three actual pair/World screenshots were visually reviewed.

Previous full suites/World-entry results remain historical, not new passes for this revision. No parser/scheduling/exam/storage-schema/backend changes, commits or pushes. Main embedded live preview remains on 5173. Physical-device FPS, Safari/Firefox and uninterrupted visibility in every pose/interaction are not certified.

## AI-assisted target import — current verification

Implemented the optional private OpenRouter API, free-only discovery/routing, strict grounded proposals, editable AI review and atomic explicit confirmation. The original rule reader remains an explicitly selected no-AI fallback. New source fixtures preserve the user's messy sample and the clarified ten multiplication questions. No World/dragon assets, completion/revision/test logic or persisted storage schema changes were made for this feature.

Fresh checks after integration:

- `npm run typecheck`: passed.
- `npm test`: **171 tests / 16 files passed**, including **28 AI tests** (13 domain, 15 mocked-service/local HTTP tests).
- `npm run build`: passed; Rollup emitted two non-blocking third-party Zod comment-annotation warnings.
- `npm run test:ai:browser`: **8 focused groups passed** in Chromium against the actual same-origin embedded app, with explicitly mocked provider responses: honest unconfigured/manual entry, ten-target editable review/no premature saves, desktop and 320/390/430 phone bounds/native scrolling, atomic explicit confirmation with selected alternative/resources, duplicate approval protection, failed/invalid/cancelled analysis preserving paste/data, separate new-subject approval, no browser page errors.

The browser suite verifies absent times (including video coverage), unchanged paste, minimal outbound browser payload, transient access code, no generated scores/revision dates/completion, and actual browser-local persistence. Screenshots `design/ai-import/review-desktop.png` and `review-mobile.png` were inspected; report `.cache/ai-import/browser-report.json`. Reproduce using `server/README.md`. Optional Chromium tooling is installed separately under `design/model-review`. Older full-browser/World suites are historical and were not rerun for the AI feature; desktop/mobile resizing here is not physical-device or Safari/Firefox certification.

**Not verified:** no real API key was provided or stored; no live OpenRouter model discovery/inference or model-quality comparison ran. This sandbox's outbound allowlist excludes openrouter.ai. Passing fixture/mocked tests does not establish real-model extraction accuracy. Real use requires private configuration and a server permitted to reach OpenRouter; free quotas/privacy-compatible providers may be unavailable. Limits/cache are process-local, not account-level billing controls. Setup/privacy/deployment: `server/README.md`. No commit or push performed.

## Pre-push code review — 17 October 2026

See **CODE_REVIEW.md** for findings/fixes, exact evidence and remaining limitations. Added one same-origin production server (`npm start`), Render blueprint and pinned-action CI workflow; corrected Unicode/oversized-body handling, concurrent quota reservation, video-duration evidence and free-fee validation; updated vulnerable test tooling. Private resource URLs in fixtures are anonymised before publication. No user study state or World/dragon assets were changed.

Fresh final verification: **182 tests / 17 files**, strict typecheck, production build, **0 reported root and optional-browser-tool audit vulnerabilities**, fake-secret sentinel bundle-isolation check, **8 AI browser groups**, **23 app-wide browser groups on the actual production server**, original/male dragon asset audits and `git diff --check` all passed. The final production interaction run disabled screenshots to avoid costly software-WebGL captures; all assertions remained enabled. An obsolete 2D selector discovered after 19 passing browser groups was fixed and the complete suite rerun successfully. See the review for the earlier timeout and report paths.

No real key, live inference, cloud CI/deploy, commit or push was performed. Render/GitHub configuration is prepared locally, not remotely certified. Enter secrets only in Render's private environment, never repository files/chat. Live model quality/availability still needs verification after hosting. This review does not promise zero defects.

## Mobile camera interaction follow-up — local only

Identified repeated layout reads/writes for every label on every decorative frame, expensive mesh picking on drag, and per-frame dragon route/posed-bound work while orbiting. Camera matrices are now synchronised before projecting HTML/sky objects. Label dimensions are observed/cached, layout reads precede writes, and unchanged/sub-pixel camera poses do not trigger caption layout. Captions remain visible during camera motion and follow camera projection with stable settled offsets; on phones they become temporarily inert, detailed mesh picking is suspended only after a real drag (restored on release/cancel/unmount), and decorative timers/rig/clearance updates pause. Dragons rest out of view during that interval and fade back at rest; villagers hold their pose. Phone DPR is capped at 1; antialiasing is omitted when a renderer initially starts in the phone profile. Desktop/tablet profiles and existing artwork remain. Profile changes retain the existing canvas/iframe; WebGL antialiasing is a creation-time setting, not a reason to remount the app.

Fresh unit/type/build verification: **187 tests / 18 files**, strict TypeScript and production build passed. Two upstream Zod annotation warnings remain non-blocking. `npm run test:mobile-world`: **7 browser groups passed**, using real Chromium touch events and 4× CPU emulation at 320/390/430, a simulated 3× display, gesture cancellation, restored mesh picking, stationary-label mutation tracking, landscape phones, desktop/tablet profile preservation, automatic dragon-clock resumption and real touch selection after gestures/resizing. Personal/demo storage remained unchanged; no browser page errors. Report `.cache/mobile-world/report.json`.

This is not measured real-device FPS or Safari/Firefox certification; the deployed Render site has not changed. This closed session cannot push or open another PR. The source/test/docs follow-up can be exported as a patch and applied/published manually by the user, or in a new coding session. No API credentials or backend changes are needed.

`npm run test:dragon-pair` also completed **9/9 browser groups** on this follow-up, covering real skinned actors, desktop/tablet/phone bounds/separation, held-pointer desktop orbit, independent pause controls, live reduced motion, direct garden/editor navigation, optional-model failure isolation and no page errors. One intervening run was interrupted by an iframe detachment; the subsequent uninterrupted run passed in full. Final log `.cache/mobile-world/dragon-regression-verified.log`. The generated comparison screenshots remain local evidence; the distributable code patch does not include those binary images.

### Visible-caption refinement and manual installation

Supersedes the prior hidden-caption version: compact labels remain visible during actual rotation on mobile and other profiles, full names remain in titles/accessible names, transforms only change with the camera, and ResizeObserver only invalidates cached label dimensions when their sizes actually change. The strengthened seven-group mobile browser suite measures dimension reads during real touch drags (no per-frame measuring), verifies captions stay visible and compact, and checks native touch selection after cancellation/resize/profile changes. Fresh 187-test/typecheck/build and mobile browser passes; actual local mobile/desktop screenshots inspected. No live-site modification is claimed. A changed-file ZIP and an updated context-checked patch allow manual publication without another Arena session. Keep existing custom edits/backups; no secrets, dependencies, models or generated production build are in the update ZIP.

The final visible-caption version also passed all **9/9 dragon-pair browser groups**; fresh log `.cache/mobile-world/visible-labels-dragon-regression.log`. This is the same version included in the regenerated patch and replacement-file ZIP.

## Login/cloud integration — 18 October 2026, local source pending publication

Implemented optional Supabase email/password accounts, PKCE confirmation/recovery routes, signup/logout, Settings account/import/conflict/recovery UI and account-scoped cloud state. All application forms/dialogs remount on account identity changes. Guest/demo data remains separate; no silent first-login import; no initial empty row creation until explicit edits. Validated account caches and independent per-tab drafts preserve pending copies. Saves are serialized/coalesced, owner- and revision-filtered, with explicit conflict selection, raw-cache preservation, abort/generation guards and reconnect/focus/manual checks. Unchanged cloud refreshes retain data identity; unsaved preference drafts are not reset by background checks.

Final checks: **206 tests / 20 files**, strict TypeScript, production builds and zero reported production dependency audit vulnerabilities. A synthetic privileged-key configuration was rejected before bundling. Two upstream Zod annotation warnings are non-blocking. **14 focused account browser groups** passed in both the dev iframe and actual Express production application against an intercepted **fake** Supabase service: invalid login, separate account load/reload/logout, owner/revision save queries, explicit guest import/backup prompt, demo exclusion, conflicts, offline retry, first insert, signup/recovery requests, a single PKCE reset-code exchange and 320/390/430 form widths. Reports `.cache/accounts/browser-report.json` and `browser-report-production.json`; errors arrays empty. No real credentials, user accounts, emails, database rows or inference were used for these browser checks.

Regressions after integration: **23 production app-wide groups**, **7 mobile-world groups**, **9 dragon-pair groups**, **5 header groups** (seven pages × 14 widths, 320–1800) passed. The initial parallel header run hit its 30-second software-WebGL navigation timeout; the standalone run used a 60-second navigation timeout and passed all unchanged layout assertions. Two early account-run failures were test input-selection/selector issues (not successful-save claims); the completed runs passed in full. An early production test output under a hidden `.cache` directory was rejected by Express sendFile's dotfile protection; the final production test used a normal `dist/account-checks` output with the same production application.

The remote database/auth settings were applied and read back earlier, as recorded in `supabase/README.md`; they are not a certification of live two-user endpoint isolation. Real signup/confirmation/reset email delivery, two-real-account privacy and cross-device sync remain deployment checks. No custom SMTP was configured here. This source update has not been pushed or deployed; the user reports only setting Render variables and rebuilding the previously deployed source so far. The replacement-file ZIP includes mobile fixes plus accounts, with no keys, `.env`, build, models or dependencies. Google login/realtime merge are not implemented. Physical-device FPS/Safari/Firefox certification is not claimed.
