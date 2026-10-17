import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const scratch = fileURLToPath(new URL('../../.cache/model-optimization/', import.meta.url));
await mkdir(scratch, { recursive: true });
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: 'shell' });
const errors = [];
try {
  const base = process.env.REVIEW_BASE || 'http://127.0.0.1:4173';
  const pages = [];
  for (const source of ['original', 'candidate']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(request.url() + ': ' + request.failure()?.errorText));
    await page.goto(base + '/?source=' + source, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.__review?.ready || window.__review?.errors.length, { timeout: 120000 });
    const state = await page.evaluate(() => ({ ready: window.__review.ready, errors: window.__review.errors, models: window.__review.assets.length }));
    if (!state.ready || state.errors.length || state.models !== 20) throw new Error(JSON.stringify(state));
    pages.push(page);
  }
  const manifest = JSON.parse(await readFile(fileURLToPath(new URL('../../assets/blender/exports-original/manifest.json', import.meta.url)), 'utf8'));
  const checks = [];
  for (const asset of manifest.assets) {
    const views = [];
    let beforeCalls, afterCalls;
    for (const angle of [null, [1.7, .32]]) {
      const captures = [];
      for (const page of pages) {
        const capture = await page.evaluate(async ({ file, angle }) => {
          window.__review.select(file);
          if (angle) window.__review.setAngle(...angle);
          for (let frame = 0; frame < 6; frame++) await new Promise(r => requestAnimationFrame(r));
          return { png: window.__review.capture(), metrics: window.__review.metrics() };
        }, { file: asset.file, angle });
        if (capture.metrics.glError || capture.metrics.triangles !== asset.triangles) throw new Error('Render error: ' + asset.file);
        captures.push(capture);
      }
      const [before, after] = captures.map(c => PNG.sync.read(Buffer.from(c.png.split(',')[1], 'base64')));
      if (before.width !== after.width || before.height !== after.height) throw new Error('Canvas sizes differ');
      let foreground = 0, changed = 0, maximum = 0, totalError = 0;
      for (let i = 0; i < before.data.length; i += 4) {
        if (before.data[i + 3] <= 8 && after.data[i + 3] <= 8) continue;
        foreground++;
        let error = 0;
        for (let c = 0; c < 4; c++) error = Math.max(error, Math.abs(before.data[i + c] - after.data[i + c]));
        if (error > 4) changed++;
        maximum = Math.max(maximum, error);
        totalError += error;
      }
      if (foreground < 100 || changed / foreground > .01) {
        for (let i = 0; i < captures.length; i++) await writeFile(scratch + asset.file + '-' + (i ? 'after' : 'before') + '.png', Buffer.from(captures[i].png.split(',')[1], 'base64'));
        throw new Error('Visual comparison failed: ' + JSON.stringify({ file: asset.file, foreground, changed, maximum }));
      }
      beforeCalls = captures[0].metrics.calls;
      afterCalls = captures[1].metrics.calls;
      if (afterCalls > beforeCalls) throw new Error('Draw calls increased: ' + asset.file);
      views.push({ angle: angle || 'default', foregroundPixels: foreground, changedPixelsOver4: changed,
        changedFraction: changed / foreground, maximumChannelError: maximum, meanMaximumChannelError: totalError / foreground });
    }
    const candidateBytes = await readFile(fileURLToPath(new URL('../../.cache/model-optimization/staged/' + asset.file, import.meta.url)));
    const originalBytes = await readFile(fileURLToPath(new URL('../../assets/blender/exports-original/' + asset.file, import.meta.url)));
    const digest = bytes => createHash('sha256').update(bytes).digest('hex');
    checks.push({ file: asset.file, beforeCalls, afterCalls, triangles: asset.triangles,
      candidateSha256: digest(candidateBytes), originalSha256: digest(originalBytes), views });
    console.log('PASS', asset.file, 'draws', beforeCalls, '->', afterCalls, 'two-view visual match');
  }
  const kit = [];
  for (const page of pages) kit.push(await page.evaluate(async () => {
    window.__review.showKit();
    for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
    return window.__review.metrics();
  }));
  if (errors.length || kit.some(k => k.glError || k.triangles !== 18222)) throw new Error(JSON.stringify({ errors, kit }));
  const report = { testedIn: 'Chromium 153 / software WebGL; not an FPS benchmark', models: checks.length,
    viewsPerModel: 2, tolerance: 'At most 1% of foreground pixels may differ by more than 4/255 per channel',
    beforeKitCalls: kit[0].calls, afterKitCalls: kit[1].calls, triangles: kit[0].triangles, checks, errors };
  await writeFile(fileURLToPath(new URL('./optimization-browser-results.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
  console.log('KIT DRAW CALLS:', kit[0].calls, '->', kit[1].calls);
} finally { await browser.close(); }
