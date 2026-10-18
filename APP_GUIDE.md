# Study World — basic app

A working, local-first sandbox built from the approved page designs and optimized Blender models. The product decisions in README §0 remain authoritative. No cloud deployment, paid AI, commit or push was performed. Optional private AI target import now has a server-side API; the core planner remains browser-local.

## Run the app

Use Node.js **22.12 or newer** (Node 22 LTS recommended). In a checkout containing the app files:

```sh
npm ci
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`). In Arena, use the **Study World planner** live preview. Servers accept the preview host and bind to `0.0.0.0`. Browser assets use same-origin URLs, not a sandbox localhost address.

```sh
npm test          # deterministic domain, parser and storage tests
npm run typecheck # strict TypeScript
npm run build     # production output, generated in ignored dist/
npm run preview   # serve the production build
```

Core planning and the explicit local manual reader need no API key. Optional AI target import requires a private OpenRouter server key, a separate import access code, consent and server network access. See [private AI setup](server/README.md). Fonts and models are bundled locally. This is not an installable/offline-cached PWA; after the app has loaded, planning and storage do not require a backend, but reopening it still needs the app server.

## Try it

1. **World:** the 3D scene fills the screen, with floating journey and island panels. Select an island, then **Enter island** to explore its topic plots without leaving World. Select a plot to open actual tasks in the floating panel. **Open subject** is the optional full editor, not the primary way to enter the island. **Island atlas** reaches every subject, including later groups.
2. **Today → Paste targets:** AI analysis is the default, with an explicit **local manual reader (no AI)** fallback. Review/edit subjects, topics, resources, alternatives and estimates; nothing is saved before confirmation. Missing AI study-time estimates must be supplied by you. See [setup and privacy](server/README.md).
3. Use the explicit **Mark completed** button only after doing the work. Clicking the task title or its status icon does not complete it. Use **Undo** on completed tasks (including Today → Completed) to reopen an accidental completion. Revision starts from actual completion; opted-out tasks do not create schedules.
4. **Revisions:** see due/overdue, upcoming dates and history. Attempt active recall and check your answers before enabling a rating. A second rating on the same day corrects that day’s record rather than increasing the count.
5. **Tests:** record a test taken elsewhere. Time and topic breakdowns are optional. Overall scores alone do not change schedules; a supplied topic score counts as a revision on the test date. Topic scores apply to every vocabulary range for that topic. Historical tests never rewind newer schedules.
6. **Settings:** change the daily budget, intervals and score thresholds; manage subjects; export/import backups.

To explore populated screens, select **Explore demo** on an empty World, or **Explore the demo workspace** in Settings. A clear demo banner remains visible. Demo progress has a separate storage key; returning to your workspace restores personal data. Reloading the browser intentionally opens the personal workspace. Demo dates are relative to the day the demo is first seeded; restart the demo in Settings to refresh them later.

### Local manual-reader paste format

```text
Maths:
! Percentage | Solve 30 questions | 50 min
Time & Work | Review examples | 25 min
English:
Vocabulary | Learn words 1-50 | 20 min
DSA:
Arrays | Practice hashing | 45 min
Software:
Java Collections | Build a small example [no revision] | 40 min
```

After explicitly selecting the local manual reader, use your actual custom subject name as a heading. That rule-based parser understands the starter aliases above, `Topic: Task`, hours/minutes, priority markers, vocabulary ranges and resource URLs. It is deliberately conservative: unmatched subjects/topics stay blank for you to resolve; absent durations receive a clearly editable 30-minute estimate. Up to 100 lines per import. This is deterministic parsing, not AI.

### Exploring the 3D world

- Drag to orbit through **360° horizontally**; scroll or pinch **inside the central zoom area**; right-drag (or two-finger pan) to move the view. Camera buttons are keyboard accessible. Wheel/pinch input can interrupt an animated focus transition.
- Zoom is perspective-camera dolly, not the old 0.8–1.8 orthographic multiplier. Near/far distance bounds adapt to the fitted screen: roughly one-quarter to 1.12× its initial distance, with absolute safety bounds of 4.5–200 scene units. Fog adapts too, so zooming out does not fade all the islands away. Vertical orbit is limited before the poles to prevent a disorienting flip; horizontal orbit has no angle clamp.
- Selecting an island previews it; **Enter island** keeps the same camera/scene and reveals up to six evidence-based topic plots per page. Other islands are hidden during exploration, then restored when returning to the overview.
- A selected plot opens its real tasks in the floating panel, with the existing explicit completion/edit/Undo actions. It does not silently complete work. Use **Open subject** for the full topic editor and topic/chapter search.
- World links retain `?island=…&view=island&topic=…`. Escape closes the topic, then exits exploration, then clears selection. An open native dialog takes precedence. Reset returns to the whole world.
- **Controls → Switch to 2D atlas** opens a real lightweight, selectable map of every active subject, with topic status and direct editor links. The map needs no WebGL. **3D world** switches back, preserving the selected subject and all study data. If WebGL/models fail, explicitly switching to 2D keeps all data. The centre owns touch gestures; scene edges retain native page scrolling on touch devices. Mouse/trackpad wheel input outside the centre never zooms the world. Scrollable panels and ordinary pages scroll independently.

The first immersive pass adds a pastel sky, 3D cloud banks, cached static shadows, stone paths, flower/grass clusters, roots and waterfall ribbons around the existing GLBs. Decorative landscaping is not earned study progress. It is **not visual parity with the original generated concept**: richer terrain silhouettes, bespoke vegetation, detailed waterfalls and landmark materials still need a Blender asset pass. No Blender files or existing exports were overwritten for this presentation pass.

### Editing topics and tasks

The topic editor includes topic name/group **and all tasks in that topic**. The first task is expanded; expand other task sections as needed. Edit task text, estimated minutes, vocabulary range, priority, revision preference and notes/resources, then choose **Save topic & tasks**. On smaller screens, scroll inside the dialog to reach notes. Nothing is saved by Cancel.

Each task row also has a visible **Edit** button for its standalone details (including subject/topic assignment). Completed tasks keep range/revision settings read-only until completion is undone. You can also select **Undo completion** inside the topic editor; this is staged until **Save topic & tasks**, so Cancel does not change completion.

Undo removes just that task from revision coverage and returns it to unfinished work. An otherwise-unused schedule is removed; prior schedule progress is restored where a snapshot exists. Genuine recall/test records and other vocabulary ranges are retained. For completions saved before this update (without a snapshot), the schedule is reconciled from remaining completed work and retained reviews rather than pretending to know lost historical preferences. No data reset is needed.

## Scheduling behavior

- Order: priority tasks → due/overdue revisions → carried tasks → new learning.
- Unfinished tasks remain on every later day’s plan without changing their original planned date. Overdue reviews remain a single item.
- Overload is visible. Suggestions never automatically delete, defer or complete anything. Calendar actions let you explicitly choose a later day.
- Default revision gaps: **1, 2, 4, 7, 16, 30 days**, followed by **60-day maintenance**. These are transparent defaults, not validated optimal intervals.
- Forgot → step 1; Hard → same step; Good → next step; Easy → two steps forward, capped at maintenance.
- Every interval starts from actual recall/test completion, including late reviews.
- One schedule per topic, except distinct vocabulary ranges. New learning restarts the combined topic/range schedule at step 1, retaining coverage of earlier tasks. This implements the proposed default in README §0.6; it remains a product decision that can be revised later.
- The third completed revision makes a topic ready for a test. With multiple ranges, each range needs three completed revisions before the whole topic is ready.
- “Strong evidence” additionally requires an actual topic score ≥80% and a latest Good/Easy rating. Low topic scores (<50%) or a latest Forgot rating flag attention. These display thresholds are separate from configurable score-to-rating boundaries. No mastery is inferred from app visits or estimated time.
- Preference changes affect future ratings/estimates, not existing due dates.

## Persistence and recovery

- Versioned, Zod-validated data goes through `src/data/repository.ts`.
- Personal key: `study-world.personal.v1`; demo key: `study-world.demo.v1`.
- Work is saved only in this browser on this origin. A different preview URL, browser or device has different data. Clearing site data removes it. **Export JSON backups regularly.**
- Import validates the version, values, references and schedule/review uniqueness. It previews counts and requires explicit replacement confirmation; it does not merge.
- Invalid/future-version storage is not overwritten. The app shows a warning and offers the unreadable original for download. Import a valid backup or explicitly reset to resume saving.
- Blocked/full storage leaves changes in memory with a persistent warning and backup export. Switching workspaces while saving is paused asks before discarding memory-only edits.
- Another tab changing or clearing the workspace pauses this tab’s writes. Export if needed, then reload to adopt that tab’s data. This is a conflict safeguard, not real-time collaboration or an atomic cross-tab database.
- Reset requires typing `RESET`. Subject deletion requires typing its exact name; archive/restore keeps learning history. Deleting a subject removes its topic breakdowns from tests but retains their overall records.

## Structure

```text
src/domain/       Typed schemas, date helpers, parser and deterministic scheduling
src/data/         Storage repository, context and separate relative-date demo
src/components/   Forms, accessible native modal primitives and lazy 3D scene
src/pages/        World/subject, Today, Revisions, Tests, Analytics and Settings
src/assets/fonts/ Local Inter/Fredoka fonts and their SIL OFL licenses
public/models/    Approved, optimized GLB kit and provenance manifest
scripts/          Browser workflow regression suite
```

The 3D module is lazy-loaded; planning pages do not need to load Three.js. Scenes share cached geometry/materials and clone object transforms. Rendering is demand-driven, DPR is capped at 1.5, and only 12 islands are drawn per world group. Larger subject collections have previous/next world controls and all subject cards remain accessible. Overview islands display up to three representative plots; the focused subject garden pages six plots at a time, and the ordinary subject list always includes every topic. Projected labels are separated on small screens. Static shadow maps update when the scene changes, rather than on every orbit frame. WebGL/model/chunk errors are contained to the world view, with working 2D alternatives. Hardware/mobile FPS has not been benchmarked.

## Browser regression suite

Optional browser tools are already pinned in the model-review package:

```sh
npm --prefix design/model-review ci
# Start a production preview in another terminal for these app suites, then:
APP_URL=http://127.0.0.1:5174 npm run test:browser
APP_URL=http://127.0.0.1:5174 npm run test:world
APP_URL=http://127.0.0.1:5174 npm run test:pages
```

The script uses headless Chromium with software WebGL; `APP_URL` can select a different server (default `http://127.0.0.1:5173`). It uses temporary isolated browser contexts, not your interactive browser’s data. Screenshots, temporary backup fixtures and `results.json` are generated in ignored `.cache/app-check/`.

See [APP_VERIFICATION.md](APP_VERIFICATION.md) for the checks actually run.

## Deliberate limits of this first build

- Local sandbox, not a production deployment; no device sync, auth, Supabase, Cloudflare or secure remote AI.
- No generated quizzes, question bank, flashcards or AI-generated claims of mastery.
- Daily budget is a single editable default, not a separate date-by-date availability calendar.
- Test records can be viewed but not edited/deleted individually yet; a validated backup can replace the workspace. Schedule-safe retrospective score editing needs a separate history/replay design.
- Completion uses a named button, not a checkbox. It is reversible through Undo without deleting genuine recall or test evidence. Incomplete tasks can be edited/deleted; completed tasks retain their learning history.
- No attempt to infer exam readiness, grade forecasts or actual study time from estimates.
- Browser checks cover current Chromium, including 320px/390px layouts and forced WebGL/storage failures; physical touch devices and Safari/Firefox remain manual verification work.

## Reference-style working pages

- **Today:** paste text in the side card, review editable proposals, then explicitly confirm. The planner still orders priority, due reviews, carried work and new learning.
- **Task details:** click a task title for the right-side evidence drawer. Edit, complete, undo or deliberately move work from there. Estimates are not tracked time or question accuracy.
- **Revisions:** change month or select a calendar day to filter actual due schedules. Calendar clicks never record a review.
- **Tests:** record an external result inline, or use a ready-topic action. Only Save records it; topic scores and overall scores retain their separate effects.
- **Analytics:** 7-day, 30-day and all-time summaries derive from saved evidence. Heatmap, recall ratings and topic-score means remain separate. Scheduled/completed minutes are task estimates, not measured study.
- **Settings:** all preference fields share the explicit Save preferences action. Daily budget is still one value for every day. Subject/data actions retain their own saves and confirmations.

### Preview sizes inside Arena

The development server includes a **Desktop / Tablet / Mobile** toolbar and opens in Mobile at 390 × 844. This works inside Arena's authorized preview; no public link or access token is needed.

- **Mobile:** choose 320, 390 or 430 CSS pixels.
- **Tablet:** 768 × 1024; **Desktop:** fills the available preview area.
- **Rotate:** swap portrait/landscape dimensions.
- **100%:** toggle actual size versus Fit. In actual-size mode, scroll the surrounding preview area if the device is larger than the panel.

These controls resize a real same-origin iframe, not just a narrow div or scaled desktop page. There is exactly one running app: the workspace, unsaved drafts, open dialogs, demo selection and 3D scene survive device changes. Scaling the frame to fit does not alter its internal viewport dimensions. This is a layout preview, not physical touch-device emulation.

The toolbar is development-only (`npm run dev`, port 5173), and is not included in the production app UI. Run `npm run test:preview` against the development server to verify the toolbar. Run the existing core/world/page browser suites against a production preview instead, for example:

```sh
npm run build
npm run preview -- --port 5174
# In another terminal:
APP_URL=http://127.0.0.1:5174 npm run test:browser
APP_URL=http://127.0.0.1:5174 npm run test:world
APP_URL=http://127.0.0.1:5174 npm run test:pages
```

Direct E2B sandbox links may return a missing-traffic-access-token error outside Arena. Use the working embedded preview; do not share credentials or access tokens.

## Shared responsive header

All seven page types now use the same logo, labelled destinations and Paste action. At 1280px and above the navigation shares the first row; at 761–1279px the navigation has its own labelled second row. At 760px and below, use the **Menu** button: all six destinations retain text labels in the expanded menu. Very narrow screens use a labelled-for-assistive-technology Paste icon to keep the header unclipped.

The menu closes on navigation, outside interaction, Escape and widening the viewport. Escape restores the menu trigger's focus and does not also exit an explored 3D island. Header/notices/World-introduction heights are measured so the floating World interface stays clear at different widths.

Run `APP_URL=http://127.0.0.1:5175 npm run test:header` against a production preview to check geometry, labels, mobile navigation and focus. The live development preview retains its separate Desktop/Tablet/Mobile device toolbar. The remaining approved visual-work order is recorded in [design/IMPLEMENTATION_PLAN.md](design/IMPLEMENTATION_PLAN.md): custom SVG icons, island artwork, then stylized animated villagers. Those three stages are not claimed complete by the header milestone.


## Custom SVG family

The brand/favicon, shared navigation, subject symbols, page actions and preview-device controls now use original vectors from `src/components/icons.tsx` (50 UI glyphs plus one full-colour island mark). Subject colours still come from each subject, including newly created subjects; their meanings, buttons and workflows have not changed. Lucide is no longer an app dependency.

Use named exports such as `RevisionIcon`, or `<StudyIcon name="revisions" size={20} />`. The default is decorative (`aria-hidden`, not focusable), for use beside a text label or inside an already-labelled button. Provide `aria-label` or `aria-labelledby` when a standalone image needs an accessible name. Strokes/fills inherit `currentColor`; the brand intentionally uses its own palette. Do not remove existing button labels or use decoration to imply saved progress.

- `npm run icons:export`: regenerate the portable SVGs, matching favicon and self-contained specimen at `design/icons/index.html`.
- `design/icons/preview.png`: compact logo/navigation/subject overview; the HTML specimen also includes every action glyph and download links.
- `npm run test:icons`: optional browser artwork/integration checks. Run the dev server on 5173 (specimen) and a built preview on 5175 (app), or override `GALLERY_URL` / `APP_URL`.

Richer island models and animated stylized villagers are separate, upcoming stages; the icon milestone does not alter the 3D artwork.


## Compact revisions and World journey

Revisions uses a card workspace, not an indefinitely growing row list: four cards per desktop/tablet page and two per narrow-phone page. Due, Upcoming, History, subject filters and calendar dates all keep access to the full collection through Previous/Next controls. Changing filters returns to the first page; ratings/moves keep their existing explicit-save dialogs. The duplicated Coming up list was removed in favour of the Upcoming tab. Review calendar and schedule guide are expandable, initially closed on phones and open on larger screens.

World now has a compact Today’s journey button instead of the tall permanently overlaid card. It opens a compact, non-modal popover with the same live estimates/counts and a Continue your journey link to Today. There is no backdrop, full-height drawer or page scroll lock. Close/Escape returns focus to its trigger; clicking outside dismisses it.


## Scheduled external revision exams

Tests now has a separate Revision exam panel in addition to the existing result journal.

1. Complete a real recall revision. Its first exam checkpoint is seven days later by default; merely completing new learning or having a future revision due is not enough.
2. Check **Tests → Revision exam** for the date and syllabus. Actual pending recall dates are deduplicated by topic/range; vocabulary ranges remain visible. Four topics per desktop page or two per phone page keep this compact. Weak topics are included too: the existing three-recall readiness label is a separate milestone, not a prerequisite for the scheduled exam.
3. Take the exam using a book, PDF or external platform. The app does not generate questions or host the exam.
4. Choose **Record revision exam result**, enter the date you actually took it, optional time/notes, overall result and optional real topic scores, and confirm that you covered every listed topic/range. Cancel/drafts do not save. Backdated records cover only revisions completed by that date; early exams are allowed if actually taken.
5. The saved result includes a historical syllabus snapshot in Recent results. It consumes only covered recall dates. Overall-only scores leave revision schedules untouched; actual topic scores follow the unchanged rating rules. Ordinary **Record a test** entries remain available and are not automatically labelled as completed revision exams.

A due exam also appears as a reminder on Today; it is not fabricated study work or an invented time estimate. Missing a checkpoint keeps one pending exam and never creates duplicate completed records. New recalls within the next interval use the actual last exam date as the next anchor. If there is no revised material, no empty exam is due; after a longer inactive interval, the first new recall starts a fresh interval.

Change **Settings → Tests → Revision exam interval (days)**, then **Save preferences** (1–90 days, default 7). Only the unsaved checkpoint changes; existing revision dates and historical exams do not. Weekly is a manageable default, not a proven optimum. This is a backward-compatible v1 data extension: old data/backups receive the default interval, and new result metadata round-trips through existing JSON export/import. Historical syllabus names survive renaming/deletion; personal and demo storage remain isolated.


## Mathematics island — initial artwork review pass (historical)

Maths-themed subjects now use a newly authored static 3D island (`public/models/island_maths_v2.glb`): taller faceted blue crystal, larger abacus, deeper mineral cliffs, soft rear tree clusters, low flowers, pavers, stream/footbridge and a clearer front waterfall. Only the maths theme changes; the five other landmarks, original backups and old model files are untouched. Custom maths subjects use the same profile automatically.

In the embedded preview, choose Mathematics in **Island atlas**, then **Enter island**. Rotate it with the existing controls, or select a real topic plot. Topic status geometry still comes entirely from study evidence, not from the decorative art; six-plot paging, tasks, full 360°, bounded central zoom and native edge scroll are unchanged. Water in this first pass is static. Villagers and the other theme artwork are not implemented by this milestone.

A clean actual-mesh preview is `design/islands/maths-v2-preview.png`; a dedicated optional dev inspection page is at `design/islands/review.html`. Reproduce with `npm run art:maths`; validate with `npm run test:maths-assets`, and optionally `npm run test:maths` with the documented dev/built servers. The asset is 15,092 triangles / 11 opaque batches / ~1.09 MiB, shared through the existing resource cache and rendered on demand; physical-device FPS remains unmeasured.

One complete offline Blender file is ready at `assets/blender/scripts/14_maths_art_island.py`. Download it to the user's `C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts`, run it through Blender's Scripting Text Editor, and manually Save As into `C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_maths_art_v2.blend` under a fresh name. It creates a new scene every run and does not save/export/delete anything. Full beginner instructions and the explicit Blender-runtime verification limitation are in `design/islands/README.md`. This is a first visual-review pass, not approval of all island artwork.


## All subject islands — current artwork rollout

Following approval of Mathematics, all seven supported themes now have matching improved 3D artwork, automatically selected by theme rather than subject ID. Mathematics keeps its approved crystal/abacus. Reasoning has logic cubes and a small maze; English has stacked/open books and a reading lamp; GK has a globe and compass; DSA has a binary-tree monument and conifer grove; Software has a code workbench and studio; generic/custom subjects have a seedling arbor. Terrain/planting palettes and rock silhouettes vary while the usable topic garden layout stays consistent.

Use **World → Island atlas → Enter island** in the existing embedded preview. New/custom subjects can choose any supported theme; the site is not restricted to six subjects. Actual topic status, tasks, six-plot paging, 360° orbit, bounded central zoom, edge scrolling and 2D recovery remain unchanged. Decorative graph nodes/seedlings are not study evidence. Water is static. Animated stylized villagers are the next stage, not part of these models.

See `design/islands/all-themes-overview.png` for all seven real-mesh renders. The optional dev reviewer at `design/islands/review.html` now has a subject-theme selector. Build with `npm run art:all`; validate with `npm run test:art-assets` and the optional `npm run test:art`. Existing Maths-only commands still work. Per-island assets stay below 16,000 triangles and 1.3 MB, with 9–11 opaque batches and no textures/animations/external resources; those are not physical-phone FPS claims.

**One complete Blender download:** `assets/blender/scripts/15_all_subject_art_islands.py`. Save it as `C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts\15_all_subject_art_islands.py`. In Blender choose **Scripting → Text → Open → Run Script**, then Layout. It makes one NEW scene containing seven separate island collections; it needs no previous scripts and never automatically saves, exports or deletes work. Manually **File → Save As** to `C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_all_art_v2.blend`, choosing a fresh name if that file exists. Script 14 is preserved. Python syntax, embedded mesh data and safety checks passed; **Blender 5.2 runtime execution is not verified**. Full beginner instructions: `design/islands/README.md`.


## Animated villagers — current visual stage

The islands now have real stylized 3D villagers with moving joints: three original character styles that walk, pause, look around and read. They are decorative and never complete tasks or claim study progress. Every theme and custom subject supports them. The overview deliberately uses a small global crowd (up to three on desktop); a selected island has two, and compact/phone canvases have one.

Use **World → Island atlas → Enter island** to see them close up. The new **Villagers toggle inside Controls** toggles “Animate villagers” for the current view. OS reduced-motion settings stop movement automatically, including a live settings change, and cannot be overridden by the button. Hidden/offscreen scenes pause their clocks. No study preference/data is saved by this control. A failed character model leaves the island and all study tools usable.

Actual character preview: `design/villagers/preview.png`; short real-canvas video: `design/villagers/villagers-motion.webm`. Optional dev reviewer: `design/villagers/review.html`, with animation/pose controls. The app uses the real animated GLBs, not these images/videos. Build with `npm run art:villagers`; validate with `npm run test:villager-assets` and optional `npm run test:villagers` using the documented dev/built servers. Mobile update scheduling is capped; physical-device FPS is not measured.

**One complete Blender download:** `assets/blender/scripts/16_animated_villagers.py`. Save it to `C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts\16_animated_villagers.py`, open it in **Scripting → Text → Open**, click **Run Script**, then Layout and play the Timeline. It creates a NEW character-studio scene with three real armatures and four actions per person; no earlier scripts or files are required, and your earlier world scenes remain untouched. Website route motion is separate from these walk-in-place clips. Manually **File → Save As** to `C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_villagers_v1.blend`, using a fresh name. No automatic saving/exporting/deleting. Full beginner steps and the **Blender 5.2 runtime-unverified** limitation: `design/villagers/README.md`.

### New art review: Aurel sky drake (Script 17)

An original sky creature is available for **static visual approval**, not yet flying in the planner. The separate **Aurel — 3D model review** embedded preview on port 5176 supports drag/orbit, pinch/scroll zoom and named views. The normal planner stays on 5173 unchanged. Complete one-file Blender script, exact Windows folders, safe manual Save As and preview: `design/sky-creature/README.md`. Rigging/animation comes only after the model review; flight integration follows later. Blender 5.2 execution is not verified in the sandbox.

### Aurel motion review (Script 18)

After user approval of the static model, the **Aurel — animated 3D review** embedded preview on 5176 now opens real Wingbeat/Glide/TailSway loops with play/pause, pose slider and skeleton inspection. The static study remains available through its studio link. The planner on 5173 is unchanged: Aurel is **not yet flying above the islands**. Complete standalone Blender Script 18, Spacebar playback, N → Aurel loop controls and exact manual-save folders: `design/sky-creature/ANIMATION.md`. Actual Blender runtime remains unverified in this environment.

### Aurel now flies in the world — no Blender required

The live 3D planner on **5173** now includes one original animated Aurel sky drake, smoothly switching between wingbeats and gliding. Use the separate **Sky** button to pause/resume flight and wing motion; the original villager pause stays independent. Motion does not change learning progress or any saved study preference.

Reduced-motion users get a calm static pose and a disabled motion override. Hidden/offscreen canvases stop both flight and wing clocks. The view-aware route uses open sky, adapting its band on phones; the creature is temporarily hidden where it would crowd topic footprints, labels, panels or controls. It cannot intercept clicks. Mobile and desktop both cap the population at one. If its download fails, islands and study tools remain available.

No more Blender steps are needed. The optional Script 17/18 studio remains on 5176 if you want to inspect/edit the source. Details and limits: `design/sky-creature/FLIGHT.md`.

## World enhancement pass — compact tools and calmer motion

- The bottom **Controls** button opens/closes labelled camera actions, independent Villagers/Dragon flight toggles, and **Switch to 2D atlas**. X, Escape and outside click dismiss it. Controls render above the selected-island panel so they stay clickable. The old persistent camera/video-like bar and separate Sky pill are gone.
- **Island atlas** is the single island picker. The duplicate Find your island dropdown is removed. Selecting an island, Enter island, topic plots, paging and Open subject still work.
- **Today’s journey** is now a small, content-height, non-modal popover instead of a full-screen side drawer. It does not blur or lock the world.
- Dragon routes retain safe corridors and ease between them with capped steering speed during camera changes. Brief projected overlaps are debounced; longer obstructions ease opacity instead of abruptly toggling the complete mesh. Normal study panels keep higher stacking priority, and the decorative mesh still has no raycast targets. A blocked creature can fade temporarily; this is not a claim that it can never be occluded.
- The cloud bank uses soft, translucent, camera-facing puffs from one shared, locally generated 128×128 alpha texture. No faceted cloud spheres, external image requests, cloud animation loop or cloud shadows.
- The 2D atlas renders all actual active subjects, including custom subjects. Select a map island for real topic/status links and Open subject. Small screens use a two-column map and a compact selection card.

The scope is the World presentation and shared scene controls. Study parsing, scheduling, tasks, revisions, exams, storage schema and approved art files are unchanged.

## Direct island entry and fitted Journey panels

Click a world island or choose it in **Island atlas** to open its topic garden immediately. There is no intermediate Enter island step. **All islands** returns to the overview; Escape closes a selected topic first, then returns to all islands. Existing island-only deep links also enter the garden. The full-width **Open subject** button opens the real subject editor (and preserves a selected topic in its URL). The button remains outside the scrolling island details.

**Today’s journey** now measures the visible viewport, header/demo notices and bottom toolbar, then opens below, above, or refitted into the available space. It updates while the preview/window resizes. The close button stays in the header; long/overloaded plans scroll inside the card so the Continue action remains reachable. The panel is above the HUD rather than clipped inside it. It is still non-modal and does not lock or blur the page. Controls uses the same fitted-panel behaviour.

### Cleaner World layout

The large “A little effort / An extraordinary world” introduction and curiosity subtitle have been removed. The small World heading remains, with Today’s journey and New subject aligned beneath it across desktop, tablet and mobile. The desktop subject panel sits below that row, leaving the islands more open. Atlas, Controls, fitted Journey and direct garden/editor navigation are unchanged.

### Second World dragon: Cinder

World now has two original animated 3D dragons: teal Aurel and **Cinder**, a darker, heavier wild wyvern inspired by the requested ancient black-dragon look. Cinder has swept horns, plated charcoal scales, broad oxblood wings and slower wingbeats; it is not a copied series asset.

Open **Controls** to pause/resume **Aurel flight** or **Cinder · wild dragon** separately. Villager motion remains independent. Reduced motion takes priority. Phone/portrait-tablet overview gives the two dragons separate lower-sky circuits; crowded panels can gently fade a dragon to protect the study UI. Cinder is decorative: no tasks, progress or schedules are changed, and the 2D atlas stays lightweight. No Blender setup is needed.

### Matching dragon couple: Aurel & Auren

The black/red wild dragon has been replaced by **Auren**, a larger male of Aurel's original species. Both now share the teal colouring, gentle face, warm wing membranes and leaf-tipped tail. Auren has a larger body, broader wings and a much longer tail; Aurel's original model is unchanged.

Use **Controls → Aurel flight / Auren · male companion** to pause each independently. There are still only two dragons. The former Cinder design is archived, not loaded in World. Everything remains actual animated 3D; no Blender setup or study-data changes are needed.

## AI-assisted Paste targets

Optional AI import is implemented, not yet connected to a real key here. It preserves the paste, uses only eligible free OpenRouter models server-side, and requires editable review plus confirmation. A model can still make semantic mistakes; no real-model accuracy is claimed. **10 Multiply** means **10 multiplication questions**. Video coverage is not assumed study time; choose-one alternatives are not two compulsory tasks.

Private setup, network requirement, free-model/provider limitations and deployment instructions: [server/README.md](server/README.md). Never paste the OpenRouter key in chat or in the import dialog. World, Aurel/Auren and scheduling mechanics are unchanged by this feature.

## Production hosting and CI

After `npm ci --include=dev` and `npm run build`, use **`npm start`** for one same-origin website + private API service. It honours the host's `PORT` and exposes `/healthz`. Do not use Vite's development/preview server as production hosting. `render.yaml` and `.github/workflows/ci.yml` prepare free Render hosting and deployment after CI checks pass; neither has been pushed/executed on those platforms yet. Enter real secrets only in Render's private Environment settings. Full instructions: [server/README.md](server/README.md); review findings/current verification: [CODE_REVIEW.md](CODE_REVIEW.md).

## Phone World interaction (local follow-up fix)

On narrow screens and coarse-pointer landscape phones, the World uses a 1× pixel-density budget. During an actual camera gesture and its short settling period, captions stay visible at compact sizes, follow the camera with stable offsets and become temporarily non-interactive, the two dragons briefly rest out of view, and villagers stop animating. This gives the camera priority instead of moving everything at once. Caption taps and flight resume automatically after settling. Short taps still select islands/topics, central pinch/drag still works, and touch edges retain native page scrolling. Desktop and normal tablet views retain the standard profile and independent decorative motion.

This is a local follow-up patch, not yet on the hosted site. This session closed after its original PR merged; you can publish manually from your own computer/GitHub account, or use a new coding session. No Render secrets, study data, scheduling rules or dragon assets are changed. Physical-phone performance must still be checked after redeployment.

### Smaller, persistent World names

World captions now use smaller pills, lighter shadows and no backdrop blur, including on desktop/tablet. Full subject/topic names remain in accessible labels and hover titles. During rotation the labels stay visible and keep their settled offsets instead of repeatedly swapping places to avoid each other; overlap resolution runs again at rest. Camera-only transform updates reuse cached dimensions. This supersedes the earlier fade-out approach.

## Accounts and private cloud saving — local update, pending publication

Optional Supabase accounts are now implemented in the local app source. Open **Settings → Account & cloud saving** (or desktop **Sign in**) to create/sign into an account. Email confirmation stays required; callback and reset-password routes are included. Render must build the new source with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Secret/service-role keys are rejected before a production bundle is generated. Real confirmation/reset-email delivery still needs testing/provider setup; no custom SMTP was configured here.

Local study records stay separate and are never uploaded automatically. After login, explicitly choose **Import this browser’s progress** on the original browser to replace the account workspace after a warning/backup download. Demo data is never uploaded. Cloud saves use owner/revision filtering; conflicts keep local edits and require an explicit choice, not last-write-wins. **Check cloud / Retry**, online/window-focus checks and per-tab account recovery copies support interrupted saves. The whole study UI remounts on account changes so prior-account forms/dialogs cannot carry over.

Existing browser backups, local mode, all study rules and World artwork remain. This is not realtime collaborative merging. Unsynced copies can be downloaded/restored from Account settings; account caches remain on the device and are not encrypted. On shared devices, export needed work, sign out, then clear site data.

The live site has not received this source update. Use **deliverables/study-world-login-cloud-update.zip** and **deliverables/HOW-TO-APPLY-LOGIN-UPDATE.md** for manual publication without a new Arena session. This new ZIP also includes the prior smaller-visible-label/mobile changes; do not mix it with the older patch. Supabase setup details and verification limitations: [supabase/README.md](supabase/README.md). Do not rerun its already-applied SQL.
