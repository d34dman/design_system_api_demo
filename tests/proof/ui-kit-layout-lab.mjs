/**
 * UI Kit's layout lab (/ui-kit/layout-lab, test module ui_kit_test): every
 * layout measured in frames of a fixed width (320, 640, 1280px), in six
 * variants (light, dark, more contrast, dark with more contrast, forced
 * colors, RTL) and at 400% zoom.
 *
 * - compare: each of the provider's stack, cluster, sidebar and tiles next to
 *   UI Kit's, pixel by pixel (plan m1-e1).
 * - geometry: no layout box leaves its frame; gaps between a layout's
 *   children equal its gap; columns split by ratio at 40rem and wider and
 *   stack below, also in a narrow side of a wide frame; center keeps its
 *   measure; a caller's --ui-kit-stack-gap on the outer stack doesn't reach
 *   the inner ones (m2-e1, m3-e1).
 * - zoom: the lab and the demo's screens at 1280px and 400% (a 320px
 *   viewport): no sideways scrolling of the page (m3-e2).
 * - axe on the lab per variant (m3-e3).
 *
 * Usage:
 *   cd tests/proof && node ui-kit-layout-lab.mjs [--variants=light,rtl] [--tag=after]
 *
 * Writes out/ui-kit-layout-lab/<tag>/: <variant>--<section>.png,
 * zoom--<page>.png, compare.json, geometry.json, zoom.json, axe.json.
 * Exits 1 if a geometry check or a zoom check fails, or axe finds anything.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = join(HERE, 'out', 'ui-kit-layout-lab', args.tag ?? 'latest');

const VARIANTS = [
  { id: 'light', attrs: {} },
  { id: 'dark', attrs: { 'data-ds-mode': 'dark' } },
  { id: 'more-contrast', attrs: { 'data-ds-contrast': 'more' } },
  { id: 'dark-more-contrast', attrs: { 'data-ds-mode': 'dark', 'data-ds-contrast': 'more' } },
  { id: 'forced-colors', attrs: {}, forcedColors: 'active' },
  { id: 'rtl', attrs: { dir: 'rtl' } },
].filter((v) => !args.variants || args.variants.split(',').includes(v.id));

const DEMO_PAGES = ['/ui-kit/demo', '/ui-kit/demo/content', '/ui-kit/demo/projects', '/ui-kit/demo/article', '/ui-kit/demo/login'];

// Pixel comparison of two PNGs in the page's canvas, as ui-kit-showcase.mjs.
async function comparePngs(page, a, b) {
  return page.evaluate(async ([a64, b64]) => {
    const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = 'data:image/png;base64,' + src; });
    const [ia, ib] = await Promise.all([load(a64), load(b64)]);
    if (ia.width !== ib.width || ia.height !== ib.height) {
      return { same: false, size: [[ia.width, ia.height], [ib.width, ib.height]], diff: null };
    }
    const data = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const da = data(ia), db = data(ib);
    const TOLERANCE = 2;
    let diff = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.max(...[0, 1, 2, 3].map((k) => Math.abs(da[i + k] - db[i + k]))) > TOLERANCE) diff++;
    }
    return { same: diff === 0, size: [[ia.width, ia.height]], diff, pixels: da.length / 4 };
  }, [a.toString('base64'), b.toString('base64')]);
}

// Every measurement, in the page. Returns a list of { case, check, ok, detail }.
function measure() {
  const results = [];
  const px = (v) => parseFloat(v) || 0;
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
  const add = (kase, check, ok, detail) => results.push({ case: kase, check, ok, detail });
  const kids = (el) => [...el.children].filter((c) => getComputedStyle(c).display !== 'none');

  for (const frame of document.querySelectorAll('.ui-kit-lab-frame')) {
    const kase = frame.dataset.case;
    if (kase.startsWith('compare-')) continue;
    const f = frame.getBoundingClientRect();

    // No layout box leaves its frame, and the frame doesn't scroll.
    const out = [...frame.querySelectorAll('[class*="ui-kit-"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.left < f.left - 0.5 || r.right > f.right + 0.5;
    });
    add(kase, 'no overflow', out.length === 0 && frame.scrollWidth <= frame.clientWidth + 1,
      out.length ? out.map((el) => `${el.className} ${Math.round(el.getBoundingClientRect().width)}px`).join('; ') : `scrollWidth ${frame.scrollWidth} / ${frame.clientWidth}`);

    // Gaps between a layout's children equal its gap.
    for (const el of frame.querySelectorAll('.ui-kit-stack, .ui-kit-cluster, .ui-kit-tiles, .ui-kit-columns, .ui-kit-sidebar')) {
      const cs = getComputedStyle(el);
      const rowGap = px(cs.rowGap), colGap = px(cs.columnGap);
      const items = kids(el).map((c) => c.getBoundingClientRect());
      const bad = [];
      for (let i = 1; i < items.length; i++) {
        const a = items[i - 1], b = items[i];
        const sameLine = near(a.top, b.top);
        if (sameLine) {
          const gap = cs.direction === 'rtl' ? a.left - b.right : b.left - a.right;
          if (!near(gap, colGap)) bad.push(`inline ${gap.toFixed(1)} ≠ ${colGap}`);
        }
        else if (b.top > a.top) {
          // A new line: the gap to the lowest box of the line above.
          const above = items.slice(0, i).filter((r) => r.bottom <= b.top + 0.5);
          const bottom = Math.max(...above.map((r) => r.bottom));
          if (!near(b.top - bottom, rowGap)) bad.push(`block ${(b.top - bottom).toFixed(1)} ≠ ${rowGap}`);
        }
      }
      add(kase, `gaps ${el.classList[0]}`, bad.length === 0, bad.join('; ') || `row ${rowGap}, column ${colGap}, ${items.length} items`);
    }

    // Columns: side by side by ratio at 40rem and wider, stacked below.
    for (const el of frame.querySelectorAll('.ui-kit-columns')) {
      const w = el.getBoundingClientRect().width;
      const regions = kids(el).map((c) => c.getBoundingClientRect());
      const switchAt = 40 * px(getComputedStyle(document.documentElement).fontSize);
      const ratio = [...el.classList].find((c) => c.startsWith('ui-kit-columns--ratio-')).replace('ui-kit-columns--ratio-', '').split('-').map(Number).slice(0, regions.length);
      if (w >= switchAt - 0.5) {
        const sum = ratio.reduce((a, b) => a + b, 0);
        const free = w - px(getComputedStyle(el).columnGap) * (regions.length - 1);
        const ok = regions.every((r, i) => near(r.top, regions[0].top) && near(r.width, free * ratio[i] / sum, 1.5));
        add(kase, `columns split ${ratio.join('-')} at ${Math.round(w)}px`, ok, regions.map((r) => Math.round(r.width)).join(' / '));
      }
      else {
        const ok = regions.every((r) => near(r.width, w)) && regions.every((r, i) => i === 0 || r.top > regions[i - 1].top);
        add(kase, `columns stack at ${Math.round(w)}px`, ok, regions.map((r) => Math.round(r.width)).join(' / '));
      }
    }

    // Center: as wide as its parent up to the measure, centred.
    for (const el of frame.querySelectorAll('.ui-kit-center')) {
      const r = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect();
      const measure = px(getComputedStyle(el).maxInlineSize);
      const ok = near(r.width, Math.min(p.width, measure)) && near(r.left - p.left, p.right - r.right);
      add(kase, `center ${Math.round(measure)}px`, ok, `${Math.round(r.width)}px in ${Math.round(p.width)}px`);
    }

    // A caller's --ui-kit-stack-gap on the outer stack stays there (D-04).
    const outer = frame.querySelector('.ui-kit-lab-outer > .ui-kit-stack');
    if (outer) {
      const inner = [...outer.querySelectorAll('.ui-kit-stack')];
      const og = px(getComputedStyle(outer).rowGap);
      const leaked = inner.filter((s) => near(px(getComputedStyle(s).rowGap), og));
      add(kase, 'public property does not leak', og === 48 && leaked.length === 0, `outer ${og}px; inner ${inner.map((s) => getComputedStyle(s).rowGap).join(', ')}`);
    }
  }
  return results;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const compare = {}, geometry = {}, axe = {}, zoom = {};
let failed = 0;

for (const variant of VARIANTS) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  if (variant.forcedColors) await page.emulateMedia({ forcedColors: variant.forcedColors });
  await page.goto(`${BASE}/ui-kit/layout-lab`, { waitUntil: 'networkidle' });
  await page.evaluate((attrs) => {
    for (const [name, value] of Object.entries(attrs)) document.documentElement.setAttribute(name, value);
  }, variant.attrs);
  await page.waitForTimeout(150);

  // The provider's layout and UI Kit's, pixel by pixel (m1-e1).
  compare[variant.id] = {};
  for (const name of await page.locator('[data-compare]').evaluateAll((els) => els.map((e) => e.dataset.compare))) {
    const shots = {};
    for (const side of ['provider', 'ui-kit']) {
      const el = page.locator(`[data-case="compare-${name}-${side}"] > *`).first();
      if (await el.count()) shots[side] = await el.screenshot({ path: join(OUT, `${variant.id}--compare-${name}-${side}.png`) });
    }
    compare[variant.id][name] = shots.provider ? await comparePngs(page, shots.provider, shots['ui-kit']) : { provider: 'absent' };
    console.log(variant.id, 'compare', name, JSON.stringify(compare[variant.id][name]));
  }

  geometry[variant.id] = await page.evaluate(measure);
  const bad = geometry[variant.id].filter((r) => !r.ok);
  failed += bad.length;
  console.log(variant.id, 'geometry', geometry[variant.id].length - bad.length, '/', geometry[variant.id].length, bad.map((r) => `${r.case}: ${r.check} (${r.detail})`).join(' | '));

  for (const section of ['compare', 'columns', 'nested']) {
    await page.locator(`#lab-${section}`).screenshot({ path: join(OUT, `${variant.id}--${section}.png`) });
  }

  const result = await new AxeBuilder({ page })
    .include('.ui-kit-lab')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  axe[variant.id] = result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  failed += result.violations.length;
  console.log(variant.id, 'axe', result.violations.length, result.violations.map((v) => v.id).join(' '));
  await context.close();
}

// 400% zoom of a 1280px window is a 320px viewport (WCAG 1.4.10 reflow).
// The lab's frames take the page's width here, so the page itself is tested.
if (!args.variants || args.variants.split(',').includes('zoom')) {
  for (const dir of ['ltr', 'rtl']) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 320, height: 640 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    for (const path of ['/ui-kit/layout-lab', ...DEMO_PAGES]) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      await page.evaluate((d) => document.documentElement.setAttribute('dir', d), dir);
      await page.addStyleTag({ content: '.ui-kit-lab-frame { inline-size: 100% !important; box-sizing: border-box; } .ui-kit-lab-compare { display: none; }' });
      await page.waitForTimeout(100);
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      const geo = path.endsWith('layout-lab') ? (await page.evaluate(measure)).filter((r) => r.check === 'no overflow' && !r.ok) : [];
      const ok = sizes.scroll <= sizes.client && geo.length === 0;
      if (!ok) failed++;
      const name = `${dir}${path.replaceAll('/', '-')}`;
      zoom[name] = { ...sizes, ok, overflow: geo };
      await page.screenshot({ path: join(OUT, `zoom--${name}.png`), fullPage: true });
      console.log('zoom', name, ok ? 'ok' : 'SCROLLS', JSON.stringify(sizes));
    }
    await context.close();
  }
}

writeFileSync(join(OUT, 'compare.json'), JSON.stringify(compare, null, 2) + '\n');
writeFileSync(join(OUT, 'geometry.json'), JSON.stringify(geometry, null, 2) + '\n');
writeFileSync(join(OUT, 'zoom.json'), JSON.stringify(zoom, null, 2) + '\n');
writeFileSync(join(OUT, 'axe.json'), JSON.stringify(axe, null, 2) + '\n');
await browser.close();
console.log(failed ? `FAILED: ${failed}` : 'All checks pass');
process.exit(failed ? 1 : 0);
