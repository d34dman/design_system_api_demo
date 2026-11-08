/**
 * Fixed gaps and empty children (composition-spacing plan, m1-e2, D-02, D-09).
 * On UI Kit's layout lab (which loads every layout's CSS), puts the same stack,
 * cluster and tiles markup in four places: the full width, a 24rem container,
 * a flex item and a table cell. Measures the real distance between children
 * and checks that it equals space.m everywhere, and that an empty <div> child
 * adds no gap. Light and RTL; one screenshot per direction.
 *
 * Usage:
 *   cd tests/proof && node spacing-gaps.mjs --tag=m1
 *
 * Writes out/spacing/<tag>/gaps.json and gaps--<direction>.png; exits with 1
 * when a gap differs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = join(HERE, 'out', 'spacing', args.tag ?? 'latest');

const item = (t) => `<div style="background: var(--ds-color-bg-surface, #eee); outline: 1px solid currentColor; padding: 0.25rem">${t}</div>`;
const LAYOUTS = {
  stack: `<div class="ui-kit-stack ui-kit-stack--gap-m">${item('One')}<div></div>${item('Two')}</div>`,
  cluster: `<div class="ui-kit-cluster ui-kit-cluster--gap-m ui-kit-cluster--align-center">${item('One')}<div></div>${item('Two')}</div>`,
  tiles: `<div class="ui-kit-tiles ui-kit-tiles--gap-m ui-kit-tiles--min-s">${item('One')}<div></div>${item('Two')}</div>`,
};
const CONTEXTS = {
  'full width': '<div>@@</div>',
  '24rem container': '<div style="max-inline-size: 24rem">@@</div>',
  'flex item': '<div style="display: flex"><div style="flex: 1">@@</div><div style="inline-size: 4rem"></div></div>',
  'table cell': '<table style="inline-size: 100%"><tr><td>@@</td></tr></table>',
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const dir of ['ltr', 'rtl']) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/ui-kit/layout-lab`, { waitUntil: 'networkidle' });
  const rows = await page.evaluate(({ LAYOUTS, CONTEXTS, dir }) => {
    document.documentElement.setAttribute('dir', dir);
    document.body.replaceChildren();
    const main = document.body;
    const box = document.createElement('section');
    box.id = 'spacing-gaps';
    box.style.cssText = 'box-sizing: border-box; inline-size: 100%; padding: 1rem; display: grid; gap: 1.5rem; background: var(--ds-color-bg-canvas, #fff)';
    main.prepend(box);
    const m = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ds-space-m')) * parseFloat(getComputedStyle(document.documentElement).fontSize);
    const out = [];
    for (const [ctx, wrap] of Object.entries(CONTEXTS)) {
      for (const [name, html] of Object.entries(LAYOUTS)) {
        const holder = document.createElement('div');
        holder.innerHTML = `<p style="margin: 0 0 0.25rem; font-size: 0.8rem">${name} in ${ctx}</p>` + wrap.replace('@@', html);
        box.append(holder);
        const layout = holder.querySelector(`.ui-kit-${name}`);
        const [a, empty, b] = layout.children;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const sameRow = Math.abs(ra.top - rb.top) < 1;
        const distance = sameRow ? Math.abs(dir === 'rtl' ? ra.left - rb.right : rb.left - ra.right) : rb.top - ra.bottom;
        out.push({
          context: ctx, layout: name, direction: dir,
          expected: Math.round(m * 100) / 100,
          distance: Math.round(distance * 100) / 100,
          emptyHidden: getComputedStyle(empty).display === 'none',
          width: Math.round(layout.getBoundingClientRect().width),
        });
      }
    }
    return out;
  }, { LAYOUTS, CONTEXTS, dir });
  results.push(...rows);
  await page.locator('#spacing-gaps').screenshot({ path: join(OUT, `gaps--${dir}.png`) });
  await page.close();
}
await browser.close();
writeFileSync(join(OUT, 'gaps.json'), JSON.stringify(results, null, 1));
let bad = 0;
for (const r of results) {
  const ok = Math.abs(r.distance - r.expected) < 0.6 && r.emptyHidden && r.width > 0;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.direction} ${r.layout.padEnd(7)} in ${r.context.padEnd(15)} width ${String(r.width).padStart(4)}px  gap ${r.distance}px (space.m ${r.expected}px)  empty child hidden: ${r.emptyHidden}`);
}
console.log(`\n${results.length - bad}/${results.length} cells keep the same gap with the empty child hidden.`);
if (bad) process.exit(1);
