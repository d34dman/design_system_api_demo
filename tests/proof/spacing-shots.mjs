/**
 * Screenshots of the showcase's two composition cases (composition-spacing
 * plan, C-08): case 1 the button and link rows (.ui-kit-showcase--actions),
 * case 2 the badges on the stat tiles and the heading after them
 * (.ui-kit-showcase--normal, with the start of the next section). Seven
 * contexts: light, dark, more contrast, forced colors, RTL, phone width and a
 * 24rem container.
 *
 * Usage:
 *   cd tests/proof && node spacing-shots.mjs --tag=before
 *
 * Writes out/spacing/<tag>/shots/<context>--<case>.png.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = join(HERE, 'out', 'spacing', args.tag ?? 'latest', 'shots');

const DESKTOP = { width: 1280, height: 900 };
const CONTEXTS = [
  { id: 'light', attrs: {}, viewport: DESKTOP },
  { id: 'dark', attrs: { 'data-ds-mode': 'dark' }, viewport: DESKTOP },
  { id: 'more-contrast', attrs: { 'data-ds-contrast': 'more' }, viewport: DESKTOP },
  { id: 'forced-colors', attrs: {}, viewport: DESKTOP, forcedColors: 'active' },
  { id: 'rtl', attrs: { dir: 'rtl' }, viewport: DESKTOP },
  { id: 'phone', attrs: {}, viewport: { width: 390, height: 844 } },
  { id: 'narrow', attrs: {}, viewport: DESKTOP, narrow: true },
];
// Each case: the element to frame, and how far below it to extend the shot
// so the next section's heading (or the gap before it) is in view.
const CASES = {
  buttons: { selector: '.ui-kit-showcase--actions', below: 80 },
  'badges-stats': { selector: '.ui-kit-showcase--normal', below: 80 },
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const ctx of CONTEXTS) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: ctx.viewport });
  const page = await context.newPage();
  if (ctx.forcedColors) await page.emulateMedia({ forcedColors: ctx.forcedColors });
  await page.goto(`${BASE}/ui-kit/showcase`, { waitUntil: 'networkidle' });
  await page.evaluate((attrs) => {
    for (const [name, value] of Object.entries(attrs)) document.documentElement.setAttribute(name, value);
  }, ctx.attrs);
  if (ctx.narrow) {
    await page.addStyleTag({ content: Object.values(CASES).map((c) => c.selector).join(', ') + ' { max-inline-size: 24rem; }' });
  }
  await page.waitForTimeout(200);
  for (const [name, c] of Object.entries(CASES)) {
    const el = page.locator(c.selector).first();
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
    const width = ctx.narrow ? Math.min(box.width + 32, ctx.viewport.width) : box.width + 32;
    await page.screenshot({
      path: join(OUT, `${ctx.id}--${name}.png`),
      fullPage: true,
      clip: { x: Math.max(0, box.x + scroll.x - 16), y: Math.max(0, box.y + scroll.y - 16), width, height: box.height + 16 + c.below },
    });
  }
  await context.close();
}
await browser.close();
console.log(`Wrote ${CONTEXTS.length * Object.keys(CASES).length} screenshots to ${OUT}`);
