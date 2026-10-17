# Design: concept art and 2D page mockups

Static mockups of every page, made before building the app, to guide the Blender work.
"Study World" is a placeholder name.

## Files

| File | What it is |
| --- | --- |
| `concept/world-map.jpg` | Chosen concept art for the 3D world (art direction for Blender) |
| `concept/island-maths.jpg` | Close-up of one island with its topic plots |
| `mockups/all-pages.pdf` | All pages in one file |
| `mockups/01-world-map.png` | Home: the 3D world, today's summary, selected island |
| `mockups/02-subject-island.png` | One subject: island close-up, each topic is a plot |
| `mockups/03-today.png` | Today ("study area"): paste box, priority-first plan, carry forward, overload |
| `mockups/04-paste-review.png` | Check the pasted plan before saving (questions instead of guesses) |
| `mockups/05-task-details.png` | Task drawer: progress, resources, revision link, history, notes |
| `mockups/06-revisions.png` | Due revisions, rating buttons, calendar, how the schedule works |
| `mockups/07-tests.png` | Record outside test scores; topic scores move revision dates |
| `mockups/08-analytics.png` | Activity, recall, test scores and topic strength, kept separate |
| `mockups/09-settings.png` | Study time, revision rules, test limits, subjects, world, data |

## Blender checklist (from the concept art)

The 3D world appears on two pages only: the World map (01) and the Subject view (02).
Every other page is 2D and works without 3D.

1. **Island base:** a rounded grassy top and a low-poly rocky underside with roots. Make 2–3 shape variants so new subjects look different.
2. **One landmark per subject:**
   - Maths: crystal obelisk and abacus
   - Reasoning: hedge maze and purple puzzle cubes
   - English: tower of giant books
   - GK: globe or observatory
   - DSA: tree with glowing nodes
   - Software Dev: workshop with gears and a computer
3. **Empty islands:** plain forest or waterfall islands. New subjects take one of these.
4. **Topic plot kit:** a small soil ring, a stone pedestal and a crystal. Plots sit around a stone path, one plot per topic, and more topics means more plots.
5. **Five plot looks** (the app switches between them from real progress):
   - Not started: dark crystal, bare soil
   - In revision: soft glow, a few sprouts
   - Ready for test: golden glow
   - Strong: bright crystal, full flower bed
   - Weak: warm orange glow
6. **Connections:** rope bridges and stone paths. These can light up as topics are completed.
7. **Scenery:** low-poly clouds, a few trees, rocks, flowers and small waterfalls. The pastel sky and golden-hour light will be set in code.

Keep everything low-poly and in separate pieces, so islands, landmarks and plots can be put together in code. Export as glTF Binary (`.glb`).

## Re-rendering the mockups

```bash
cd design/mockups
npm install          # headless Chromium, icons, image tools
npm run icons        # rebuilds src/icons.js from the icons the pages use
npm run render       # all pages -> PNG + all-pages.pdf  (or: npm run render -- 03 06)
```

Sources are plain HTML/CSS in `mockups/src/` (shared styles in `styles.css`, top bar in `common.js`).

## Blender build scripts

The one-at-a-time Blender scripts, local run/save instructions and validation
notes are in [`../assets/blender/README.md`](../assets/blender/README.md).
The user's Windows copy uses `blender/scripts` and `blender/source` under the
Desktop project folder; the repository stores the script sources in
`assets/blender/scripts`. No website implementation has started.

## Browser-ready optimized kit

The approved Blender exports have been optimized and browser-tested. See
[`model-review/optimization-report.md`](model-review/optimization-report.md).
Deployment assets are in `public/models`; original exports remain backed up in
`assets/blender/exports-original`. The downloadable optimized kit is
`deliverables/study-world-optimized-models.zip`. This is model preparation only;
planner application implementation still awaits confirmation.
