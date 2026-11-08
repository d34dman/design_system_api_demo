/**
 * Section gaps by screen width (Breakpoint Axis plan, m0-e1 and m4-e1, C-05).
 * On UI Kit's showcase, measures the gap between the first two top-level sections
 * (the outer stack, gap xl today, section once M4 lands) at 375px and 1280px,
 * and screenshots the boundary between them at each width.
 *
 * Usage:
 *   cd tests/proof && node section-gaps.mjs --tag=m0
 *
 * Writes out/breakpoint/<tag>/section-gaps.json and section-gap--<width>.png.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = join(HERE, 'out', 'breakpoint', args.tag ?? 'latest');
const WIDTHS = [375, 1280];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const rows = [];
for (const width of WIDTHS) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width, height: 900 } });
  await page.goto(`${BASE}/ui-kit/showcase`, { waitUntil: 'networkidle' });
  const r = await page.evaluate(() => {
    const first = document.querySelector('[class*="ui-kit-showcase--"]');
    let outer = first;
    // The outer stack is the nearest stack whose direct children hold the sections.
    while (outer && !(outer.parentElement?.classList.contains('ui-kit-stack') && outer.parentElement.children.length > 2)) outer = outer.parentElement;
    const stack = outer.parentElement;
    const [a, b] = [...stack.children].filter((c) => getComputedStyle(c).display !== 'none');
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const v = (n) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) * rem;
    window.scrollTo(0, ra.bottom + scrollY - 200);
    return {
      gap: Math.round((rb.top - ra.bottom) * 100) / 100,
      stackGap: getComputedStyle(stack).rowGap,
      xl: v('--ds-space-xl'), l: v('--ds-space-l'),
      section: getComputedStyle(document.documentElement).getPropertyValue('--ds-space-section').trim() || null,
      boundary: ra.bottom + scrollY,
    };
  });
  rows.push({ width, ...r });
  await page.screenshot({ path: join(OUT, `section-gap--${width}.png`), clip: { x: 0, y: Math.max(0, r.boundary - 120), width, height: 240 }, fullPage: true });
  await page.close();
}
await browser.close();
writeFileSync(join(OUT, 'section-gaps.json'), JSON.stringify(rows, null, 1));
for (const r of rows) console.log(`${String(r.width).padStart(4)}px  gap between sections ${r.gap}px  (stack gap ${r.stackGap}; space.xl ${r.xl}px, space.l ${r.l}px; --ds-space-section ${r.section ?? 'not declared'})`);
