/**
 * UI Kit's showcase (/ui-kit/showcase, test module ui_kit_test) under Advaita
 * in six variants: light, dark, more contrast, dark with more contrast,
 * forced colors and RTL. Captures the normal rows and the blank row (every
 * optional value missing or blank) separately, with an axe scan of the
 * .ui-kit-* elements per variant.
 *
 * Usage:
 *   cd tests/proof && node ui-kit-showcase.mjs [--variants=light,dark] [--tag=after]
 *
 * Writes out/ui-kit-showcase/<tag>/<variant>--<part>.png,
 * out/ui-kit-showcase/<tag>/axe.json and, for each button and the link with
 * its look, a pixel comparison in out/ui-kit-showcase/<tag>/pairs.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = join(HERE, 'out', 'ui-kit-showcase', args.tag ?? 'latest');

const VARIANTS = [
  { id: 'light', attrs: {} },
  { id: 'dark', attrs: { 'data-ds-mode': 'dark' } },
  { id: 'more-contrast', attrs: { 'data-ds-contrast': 'more' } },
  { id: 'dark-more-contrast', attrs: { 'data-ds-mode': 'dark', 'data-ds-contrast': 'more' } },
  { id: 'forced-colors', attrs: {}, forcedColors: 'active' },
  { id: 'rtl', attrs: { dir: 'rtl' } },
].filter((v) => !args.variants || args.variants.split(',').includes(v.id));

// The showcase's parts: each is a wrapper the controller marks with a class.
const PARTS = ['normal', 'blank', 'actions', 'wave1'];

// Compares two PNG screenshots pixel by pixel in the page's canvas (C-06:
// a button and the link with its look render identically).
async function comparePngs(page, a, b) {
  return page.evaluate(async ([a64, b64]) => {
    const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = 'data:image/png;base64,' + src; });
    const [ia, ib] = await Promise.all([load(a64), load(b64)]);
    if (ia.width !== ib.width || ia.height !== ib.height) {
      return { same: false, size: [[ia.width, ia.height], [ib.width, ib.height]], diff: null };
    }
    const data = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const da = data(ia), db = data(ib);
    // A channel may differ by TOLERANCE: anti-aliasing of a rounded corner
    // varies by one step with the element's place on the page.
    const TOLERANCE = 2;
    let diff = 0, exact = 0, maxDelta = 0;
    for (let i = 0; i < da.length; i += 4) {
      const delta = Math.max(...[0, 1, 2, 3].map((k) => Math.abs(da[i + k] - db[i + k])));
      if (delta > 0) exact++;
      if (delta > TOLERANCE) diff++;
      maxDelta = Math.max(maxDelta, delta);
    }
    return { same: diff === 0, size: [[ia.width, ia.height]], diff, exact, maxDelta, pixels: da.length / 4 };
  }, [a.toString('base64'), b.toString('base64')]);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const results = {};
const compare = {};
for (const variant of VARIANTS) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  if (variant.forcedColors) await page.emulateMedia({ forcedColors: variant.forcedColors });
  await page.goto(`${BASE}/ui-kit/showcase`, { waitUntil: 'networkidle' });
  await page.evaluate((attrs) => {
    for (const [name, value] of Object.entries(attrs)) document.documentElement.setAttribute(name, value);
  }, variant.attrs);
  await page.waitForTimeout(150);

  for (const part of PARTS) {
    const el = page.locator(`.ui-kit-showcase--${part}`);
    if (await el.count()) await el.screenshot({ path: join(OUT, `${variant.id}--${part}.png`) });
  }
  // Button and button-look link, per appearance (C-06).
  const pairs = {};
  for (const appearance of ['primary', 'secondary']) {
    const pair = page.locator(`.ui-kit-showcase-pair--${appearance}`);
    if (!(await pair.count())) continue;
    await page.mouse.move(0, 0);
    const button = await pair.locator('.ui-kit-button').screenshot({ path: join(OUT, `${variant.id}--pair-${appearance}-button.png`) });
    const link = await pair.locator('.ui-kit-link').screenshot({ path: join(OUT, `${variant.id}--pair-${appearance}-link.png`) });
    pairs[appearance] = await comparePngs(page, button, link);
    console.log(variant.id, 'pair', appearance, JSON.stringify(pairs[appearance]));
  }
  compare[variant.id] = pairs;

  const axe = await new AxeBuilder({ page })
    .include('[class*="ui-kit-"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  results[variant.id] = axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  console.log(variant.id, 'axe', axe.violations.length, axe.violations.map((v) => v.id).join(' '));
  await context.close();
}
writeFileSync(join(OUT, 'axe.json'), JSON.stringify(results, null, 2) + '\n');
writeFileSync(join(OUT, 'pairs.json'), JSON.stringify(compare, null, 2) + '\n');
await browser.close();
