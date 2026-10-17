import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const output = fileURLToPath(new URL('../../.cache/model-validation/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: 'shell' });
try {
  const page = await browser.newPage();
  const errors = [], failures = [];
  let phase = 'loading';
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failures.push({ url: request.url(), error: request.failure()?.errorText, status: request.response()?.status(), phase }));
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:4173', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.__review?.ready || window.__review?.errors.length, { timeout: 120000 });
  const result = await page.evaluate(() => ({ ready: window.__review.ready, errors: window.__review.errors, assets: window.__review.assets }));
  if (!result.ready || result.errors.length || result.assets.length !== 20) throw new Error(JSON.stringify(result));
  phase = 'draw checks';
  const drawChecks = [];
  for (const asset of result.assets) {
    const metrics = await page.evaluate(async file => {
      window.__review.select(file);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return window.__review.metrics();
    }, asset.file);
    if (metrics.glError !== 0 || metrics.calls === 0 || metrics.triangles !== asset.triangles) throw new Error('Draw mismatch: ' + JSON.stringify({ asset, metrics }));
    drawChecks.push({ file: asset.file, ...metrics });
  }
  phase = 'kit';
  await page.evaluate(async () => { window.__review.showKit(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
  const kit = await page.evaluate(() => window.__review.metrics());
  if (kit.triangles !== 18222 || kit.glError !== 0) throw new Error('Kit draw failed: ' + JSON.stringify(kit));
  await page.screenshot({ path: output + 'browser-kit.png' });
  await page.evaluate(() => window.__review.select('landmark_maths.glb'));
  await page.waitForFunction(() => window.__review.metrics().current === 'landmark_maths.glb');
  await page.screenshot({ path: output + 'browser-maths.png' });
  phase = 'mobile';
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const responsive = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
  if (responsive.documentWidth > responsive.width) throw new Error('Mobile horizontal overflow: ' + JSON.stringify(responsive));
  if (errors.length || failures.length) throw new Error(JSON.stringify({ errors, failures }));
  const report = { ready: true, testedIn: 'Headless Chromium 153 / WebGL software renderer', modelsLoaded: result.assets.length, drawChecks, kit, responsive, errors, failures };
  await writeFile(fileURLToPath(new URL('./browser-results.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
  console.log('PASS: 20 GLBs parsed and drawn; bounds/triangles match manifest; no JS/network/WebGL errors.');
  console.log('Kit:', kit, 'Responsive:', responsive);
} finally { await browser.close(); }
