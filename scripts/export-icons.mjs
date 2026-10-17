// Export the React source of truth as portable SVGs and a human-readable specimen.
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdir, writeFile } from "node:fs/promises";
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { StudyIcon, IslandMark, STUDY_ICON_NAMES } =
    await server.ssrLoadModule("/src/components/icons.tsx");
  const folder = "design/icons";
  await mkdir(folder, { recursive: true });
  const groups = {
    Navigation: [
      "world",
      "today",
      "revisions",
      "tests",
      "analytics",
      "settings",
    ],
    Subjects: [
      "maths",
      "reasoning",
      "english",
      "gk",
      "dsa",
      "software",
      "grow",
    ],
  };
  groups.Actions = STUDY_ICON_NAMES.filter(
    (name) => !Object.values(groups).flat().includes(name),
  );
  const colours = {
    maths: "#5268b2",
    reasoning: "#8764ad",
    english: "#9f752b",
    gk: "#2f8987",
    dsa: "#567e44",
    software: "#b86448",
    grow: "#567e44",
  };
  const label = (name) =>
    ({
      gk: "General knowledge",
      dsa: "Data structures",
      grow: "New subject",
      arrowRight: "Arrow right",
      arrowLeft: "Arrow left",
      chevronRight: "Chevron right",
      chevronLeft: "Chevron left",
      reading: "Active reading",
      schedule: "Reschedule",
      paste: "Paste targets",
      today: "Today",
      revisions: "Revisions",
    })[name] ?? name[0].toUpperCase() + name.slice(1);
  const svg = (name, size = 32, download = false) =>
    renderToStaticMarkup(
      createElement(StudyIcon, {
        name,
        size,
        "aria-label": label(name),
        ...(download ? { color: colours[name] ?? "#4d5d83" } : {}),
      }),
    );
  for (const name of STUDY_ICON_NAMES)
    await writeFile(`${folder}/${name}.svg`, svg(name, 32, true) + "\n");
  const brand = renderToStaticMarkup(
    createElement(IslandMark, {
      size: 40,
      "aria-label": "Study World floating island",
    }),
  );
  await writeFile(`${folder}/island-mark.svg`, brand + "\n");
  await writeFile("public/favicon.svg", brand + "\n");
  const cards = (names) =>
    names
      .map(
        (name) =>
          `<article style="--tone:${colours[name] ?? "#4d5d83"}"><div class="big">${svg(name, 56)}</div><h3>${label(name)}</h3><div class="sizes">${[16, 20, 32].map((size) => svg(name, size)).join("")}</div><a href="./${name}.svg" download>Download SVG</a></article>`,
      )
      .join("\n");
  await writeFile(
    `${folder}/index.html`,
    `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Study World · custom SVG family</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f7f4ed;color:#29354c;font:15px/1.6 system-ui,sans-serif}main{max-width:1150px;margin:auto;padding:40px 24px}header{display:flex;gap:24px;align-items:center;padding:28px;border:1px solid #e1ddd5;border-radius:24px;background:#fffefa}h1{font-size:32px;line-height:1.2;margin:4px 0 12px;letter-spacing:-1px}p{margin:0;color:#59667b}small{text-transform:uppercase;letter-spacing:2px;font-size:11px;color:#677c58}.brand{display:grid;place-items:center;min-width:135px;background:#eef0e8;border-radius:20px;padding:20px}.brand svg{width:95px;height:95px}.brand a{font-size:11px;margin-top:8px}h2{margin:36px 0 8px;font-size:22px}section>p{margin-bottom:18px;font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}article{background:#fff;border:1px solid #e4dfd6;border-radius:16px;text-align:center;padding:20px 12px;color:var(--tone)}.big{display:grid;place-items:center;min-height:70px}.sizes{display:flex;justify-content:center;align-items:center;gap:14px;min-height:48px}h3{font-size:13px;margin:10px 0 4px;color:#35415a}a{color:#424caf;font-size:11px;text-underline-offset:4px}a:focus-visible{outline:3px solid #7c86ca;outline-offset:3px}.notes{padding:18px;margin-top:28px;border-radius:12px;background:#eeedf5;font-size:12px}footer{margin-top:25px;color:#647087;font-size:12px}@media(min-width:1100px){section:nth-of-type(2) .grid{grid-template-columns:repeat(7,minmax(0,1fr))}}@media(max-width:550px){main{padding:20px 14px}header{padding:18px;gap:16px;align-items:flex-start}.brand{min-width:70px;padding:8px}.brand svg{width:55px;height:55px}h1{font-size:24px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  </style></head><body><main><header><div class="brand">${brand}<a href="./island-mark.svg" download>Brand SVG</a></div><div><small>Study World · original vector family</small><h1>Small symbols.<br>A world of their own.</h1><p>Faceted islands, rounded tools and landmark-inspired subjects.<br>${STUDY_ICON_NAMES.length} UI glyphs + 1 full-colour island mark.</p></div></header>
  ${Object.entries(groups)
    .map(
      ([group, names]) =>
        `<section><h2>${group}</h2><p>${group === "Navigation" ? "The same six destinations across every page." : group === "Subjects" ? "Abacus · logic blocks · books · globe · connected nodes · laptop · growing island." : "Familiar actions, drawn in the same family. Destructive and completion symbols retain their meanings."} Each card shows 56, 16, 20 and 32 px.</p><div class="grid">${cards(names)}</div></section>`,
    )
    .join("")}
  <div class="notes">SVG, not raster imagery. 32-unit artboard · rounded 2.1-unit strokes · currentColor + soft duotone fills · no fonts, filters, external assets or motion. Full-colour mark uses a 40-unit artboard. In the app, adjacent text or labelled buttons provide the accessible name; standalone exports are labelled images.</div><footer>Source of truth: src/components/icons.tsx. Regenerate: npm run icons:export. Artwork does not represent or change study progress.</footer></main></body></html>`,
  );
  console.log(
    `Exported ${STUDY_ICON_NAMES.length} glyphs, island mark, favicon and specimen to ${folder}/`,
  );
} finally {
  await server.close();
}
