# Exported GLB review (not the planner app)

A temporary-purpose, self-contained Three.js asset-inspection page. Uses the
actual 20 exported GLBs in `../../public/models`, with no CDN dependencies or
browser requests to localhost. Models can be inspected at native scale; the
complete-kit display normalizes them for comparison without modifying files.

See [model-validation.md](model-validation.md) for findings, provenance and
performance caveats. No planner features or production world implementation.

```bash
npm install
npm run validate          # Python stdlib GLB/geometry/manifest checks
npm start                 # 0.0.0.0:4173; accepts the Arena preview host
npm run check             # separate terminal, server must be running
```

`PORT` overrides the default server port. `REVIEW_URL` overrides the browser-test
URL, which is otherwise loopback for the *sandbox-side test runner only*.
The browser app itself always uses same-origin relative URLs.

The server exposes only the review page, Three.js vendor files and exported
models. It is an inspection tool, not a production deployment server.
`npm run check` uses Chromium's software renderer; it does not benchmark actual
mobile hardware. Screenshots go into the root `.cache/model-validation/` folder
and are not intended to be committed. The versioned JSON files contain the small
reproducible validation results; run the scripts to refresh them after changes.


## Optimized models

The live viewer now loads the optimized deployment kit from `public/models`.
See [optimization-report.md](optimization-report.md) for measured reductions and
verification. Original upload files are retained in `assets/blender/exports-original`.

With the server running in another terminal, `npm run optimize` performs the
reproducible stage/geometry/browser/publish/check pipeline. It never mutates the
original backup. `npm test` runs negative-control unit tests without a browser.
The optimizer does not remove vertices or triangles, and no decoder is required.

`?source=original` inspects the backup. `?source=candidate` inspects the disposable
stage after `npm run optimize:stage`. These routes are for inspection tests; the
normal viewer uses the final optimized kit. Candidate files must pass geometry,
shader, two-view browser and hash checks before the publisher replaces active
models. Original node-part names should not be used as application API contracts.
