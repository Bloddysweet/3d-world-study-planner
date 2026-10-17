// Renders every src/NN-*.html page to a PNG (1440x900 at 2x) and builds all-pages.pdf
// Usage: npm run render            -> all pages + PDF
//        npm run render -- 01 03    -> only pages starting with 01 / 03 (no PDF)
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const only = process.argv.slice(2);
const pages = readdirSync("src").filter((f) => /^\d\d-.*\.html$/.test(f)).sort()
  .filter((f) => !only.length || only.some((p) => f.startsWith(p)));
const scale = Number(process.env.SCALE || 2);

const browser = await puppeteer.launch({
  args: chromium.args, executablePath: await chromium.executablePath(), headless: "shell",
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: scale },
});
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("  [console]", m.text()); });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
const outputs = [];
for (const f of pages) {
  await page.goto(pathToFileURL(resolve("src", f)).href, { waitUntil: "load" });
  await page.waitForFunction("window.__ready === true", { timeout: 15000 });
  const out = f.replace(/\.html$/, ".png");
  await page.screenshot({ path: out });
  outputs.push(out);
  console.log("rendered", out);
}
if (!only.length) {
  // one PDF with every page (JPEG inside keeps it small)
  mkdirSync("/tmp/mock-pdf", { recursive: true });
  const imgs = [];
  for (const o of outputs) {
    const jpg = `/tmp/mock-pdf/${o.replace(".png", ".jpg")}`;
    await sharp(o).jpeg({ quality: 84, mozjpeg: true }).toFile(jpg);
    imgs.push(jpg);
  }
  const html = `<html><head><style>@page{size:1440px 900px;margin:0}body{margin:0}
    img{display:block;width:1440px;height:900px;break-after:page}</style></head><body>
    ${imgs.map((p) => `<img src="${pathToFileURL(p).href}">`).join("")}</body></html>`;
  writeFileSync("/tmp/mock-pdf/all.html", html);
  await page.goto(pathToFileURL("/tmp/mock-pdf/all.html").href, { waitUntil: "load" });
  await page.pdf({ path: "all-pages.pdf", width: "1440px", height: "900px", printBackground: true });
  console.log("built all-pages.pdf");
}
await browser.close();
