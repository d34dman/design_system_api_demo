/**
 * UI Kit's content components (content plan) under Advaita in six variants:
 * light, dark, more contrast, dark with more contrast, forced colors and RTL.
 * Captures each content part of the showcase (and, with --demo, the demo's
 * article preview), runs axe on .ui-kit-* per variant and measures the claims
 * the plan's evidence makes.
 *
 * Usage:
 *   cd tests/proof && node ui-kit-content.mjs [--variants=light,dark] [--tag=m1] [--demo]
 *
 * Writes out/ui-kit-content/<tag>/<variant>--<part>.png, axe.json and
 * checks.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v = 'true'] = a.replace(/^--/, '').split('='); return [k, v]; }));
const OUT = join(HERE, 'out', 'ui-kit-content', args.tag ?? 'latest');

const VARIANTS = [
  { id: 'light', attrs: {} },
  { id: 'dark', attrs: { 'data-ds-mode': 'dark' } },
  { id: 'more-contrast', attrs: { 'data-ds-contrast': 'more' } },
  { id: 'dark-more-contrast', attrs: { 'data-ds-mode': 'dark', 'data-ds-contrast': 'more' } },
  { id: 'forced-colors', attrs: {}, forcedColors: 'active' },
  { id: 'rtl', attrs: { dir: 'rtl' } },
].filter((v) => !args.variants || args.variants.split(',').includes(v.id));

const PARTS = ['headings', 'text', 'rich-text', 'quote', 'content-blank', 'media', 'media-blank'];

async function prepare(browser, variant, path, width = 1200) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: 900 } });
  const page = await context.newPage();
  if (variant.forcedColors) await page.emulateMedia({ forcedColors: variant.forcedColors });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate((attrs) => {
    for (const [name, value] of Object.entries(attrs)) document.documentElement.setAttribute(name, value);
  }, variant.attrs);
  await page.waitForTimeout(150);
  return { context, page };
}

// The showcase's content parts only: wave 2's blank rows have deliberately
// unnamed parts. The demo screen is scanned whole.
async function axe(page, includes = ['[class*="ui-kit-"]']) {
  let builder = new AxeBuilder({ page });
  for (const selector of includes) builder = builder.include(selector);
  const result = await builder
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
}


// Compares two PNG screenshots pixel by pixel (content plan m2-e3).
async function comparePngs(page, a, b) {
  return page.evaluate(async ([a64, b64]) => {
    const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = 'data:image/png;base64,' + src; });
    const [ia, ib] = await Promise.all([load(a64), load(b64)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { same: false, size: [[ia.width, ia.height], [ib.width, ib.height]] };
    const data = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const da = data(ia), db = data(ib);
    let diff = 0, maxDelta = 0;
    for (let i = 0; i < da.length; i += 4) {
      const delta = Math.max(...[0, 1, 2, 3].map((k) => Math.abs(da[i + k] - db[i + k])));
      if (delta > 2) diff++;
      maxDelta = Math.max(maxDelta, delta);
    }
    return { same: diff === 0, diff, maxDelta, pixels: da.length / 4 };
  }, [a.toString('base64'), b.toString('base64')]);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const axeResults = {};
const checks = {};
for (const variant of VARIANTS) {
  const { context, page } = await prepare(browser, variant, '/ui-kit/showcase');
  for (const part of PARTS) {
    const el = page.locator(`.ui-kit-showcase--${part}`);
    if (await el.count()) await el.first().screenshot({ path: join(OUT, `${variant.id}--${part}.png`) });
  }
  checks[variant.id] = await page.evaluate(() => {
    const out = {};
    // m1-e2: each heading's element and the size it renders at.
    out.headings = [...document.querySelectorAll('.ui-kit-showcase--headings .ui-kit-heading')].map((h) => ({
      element: h.localName, text: h.textContent, fontSize: getComputedStyle(h).fontSize,
    }));
    // m1-e3: the paragraph CKEditor centred stays centred.
    const centred = document.querySelector('.ui-kit-rich-text .text-align-center');
    out.centred = centred ? getComputedStyle(centred).textAlign : null;
    // D-02: flow spacing; first child touches the top, a heading gets more above.
    const rich = document.querySelector('.ui-kit-showcase--rich-text .ui-kit-rich-text');
    if (rich) {
      const kids = [...rich.children];
      const mt = (el) => getComputedStyle(el).marginBlockStart;
      out.flow = {
        first: mt(kids[0]),
        paragraphAfterHeading: mt(rich.querySelector('h2 + p')),
        listAfterParagraph: mt(rich.querySelector('h3 + ul ~ ol') ?? kids[3]),
        headingAfterBlock: mt(rich.querySelector('ul + ol ~ blockquote + h4') ?? rich.querySelector('h3')),
        h3: mt(rich.querySelector('h3')),
        floatContained: rich.getBoundingClientRect().bottom >= rich.querySelector('.align-left').getBoundingClientRect().bottom,
      };
    }
    // m2-e1/e2: image and frame geometry, when present.
    out.frames = [...document.querySelectorAll('.ui-kit-showcase--media .ui-kit-frame')].map((f) => {
      const r = f.getBoundingClientRect();
      return { class: f.className, ratio: +(r.width / r.height).toFixed(3) };
    });
    return out;
  });
  // m2-e3: the provider's icon and UI Kit's, pixel by pixel.
  const icons = {};
  for (const pair of await page.locator('.ui-kit-showcase-icon-pair').all()) {
    const name = await pair.getAttribute('data-icon');
    // Whole-pixel clips of the 32px boxes, so a subpixel offset can't differ.
    const shot = async (sel) => { const r = await pair.locator(sel).boundingBox(); return page.screenshot({ clip: { x: Math.round(r.x), y: Math.round(r.y), width: 32, height: 32 } }); };
    const a = await shot('.ui-kit-showcase-icon-box--provider');
    const b = await shot('.ui-kit-showcase-icon-box--ui-kit');
    icons[name] = await comparePngs(page, a, b);
  }
  checks[variant.id].icons = icons;
  axeResults[variant.id] = await axe(page, ['.ui-kit-showcase--content', ...(await page.locator('.ui-kit-showcase--media').count() ? ['.ui-kit-showcase--media'] : [])]);
  console.log(variant.id, 'axe', axeResults[variant.id].length, axeResults[variant.id].map((v) => v.id).join(' '));
  await context.close();

  if (args.demo) {
    for (const width of [1200, 390]) {
      const demo = await prepare(browser, variant, '/ui-kit/demo/article-preview', width);
      await demo.page.screenshot({ path: join(OUT, `${variant.id}--preview-${width}.png`), fullPage: true });
      const v = await axe(demo.page);
      axeResults[`${variant.id}--preview-${width}`] = v;
      console.log(variant.id, 'preview', width, 'axe', v.length, v.map((x) => x.id).join(' '));
      await demo.context.close();
    }
  }
}
if (args.lab) {
  const { context, page } = await prepare(browser, VARIANTS[0], '/ui-kit/layout-lab');
  checks.lab = await page.evaluate(() => [...document.querySelectorAll('[data-case^="frame-"]')].map((c) => {
    const f = c.querySelector('.ui-kit-frame').getBoundingClientRect();
    const i = c.querySelector('.ui-kit-frame img').getBoundingClientRect();
    return { case: c.dataset.case, width: Math.round(f.width), ratio: +(f.width / f.height).toFixed(3), imageFills: Math.abs(i.width - f.width) < 1 && Math.abs(i.height - f.height) < 1, overflowsParent: f.width > c.getBoundingClientRect().width + 0.5 };
  }));
  await page.locator('[data-case^="frame-"]').first().screenshot({ path: join(OUT, 'lab--frame.png') });
  console.log('lab', JSON.stringify(checks.lab));
  await context.close();
}
writeFileSync(join(OUT, 'axe.json'), JSON.stringify(axeResults, null, 2) + '\n');
writeFileSync(join(OUT, 'checks.json'), JSON.stringify(checks, null, 2) + '\n');
await browser.close();
