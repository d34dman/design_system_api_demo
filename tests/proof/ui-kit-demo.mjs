/**
 * UI Kit's demo app (/ui-kit/demo, submodule ui_kit_demo) under the front-end
 * theme in six variants: light, dark, more contrast, dark with more contrast,
 * forced colors and RTL. One full-page screenshot per screen and variant, one
 * more per screen with "Show what's missing" on (light), and an axe scan per
 * screen and variant. Violations are split into UI Kit's own elements
 * (.ui-kit-*) and the stand-ins for parts it lacks ([data-ui-kit-gap]).
 *
 * Usage:
 *   cd tests/proof && node ui-kit-demo.mjs [--variants=light,dark] [--tag=after]
 *
 * Writes out/ui-kit-demo/<tag>/<variant>--<screen>.png, gaps--<screen>.png
 * and axe.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = join(HERE, 'out', 'ui-kit-demo', args.tag ?? 'latest');

const VARIANTS = [
  { id: 'light', attrs: {} },
  { id: 'dark', attrs: { 'data-ds-mode': 'dark' } },
  { id: 'more-contrast', attrs: { 'data-ds-contrast': 'more' } },
  { id: 'dark-more-contrast', attrs: { 'data-ds-mode': 'dark', 'data-ds-contrast': 'more' } },
  { id: 'forced-colors', attrs: {}, forcedColors: 'active' },
  { id: 'rtl', attrs: { dir: 'rtl' } },
].filter((v) => !args.variants || args.variants.split(',').includes(v.id));

const SCREENS = { home: '', login: '/login', content: '/content', projects: '/projects', article: '/article' };

async function open(page, path, variant) {
  await page.goto(`${BASE}/ui-kit/demo${path}`, { waitUntil: 'networkidle' });
  await page.evaluate((attrs) => {
    for (const [name, value] of Object.entries(attrs)) document.documentElement.setAttribute(name, value);
  }, variant.attrs);
  await page.waitForTimeout(150);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const results = {};
for (const variant of VARIANTS) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  if (variant.forcedColors) await page.emulateMedia({ forcedColors: variant.forcedColors });
  for (const [screen, path] of Object.entries(SCREENS)) {
    await open(page, path, variant);
    await page.screenshot({ path: join(OUT, `${variant.id}--${screen}.png`), fullPage: true });
    const axe = await new AxeBuilder({ page })
      .include('.ui-kit-demo')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const where = (node) => (node.target.join(' ').includes('data-ui-kit-gap') || node.html.includes('data-ui-kit-gap')) ? 'stand-in' : 'other';
    results[`${variant.id}/${screen}`] = axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 160), where: where(n) })),
    }));
    if (variant.id === 'light') {
      await page.goto(`${BASE}/ui-kit/demo${path}?gaps=1`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: join(OUT, `gaps--${screen}.png`), fullPage: true });
    }
  }
  await context.close();
}
await browser.close();
writeFileSync(join(OUT, 'axe.json'), JSON.stringify(results, null, 1));
for (const [key, violations] of Object.entries(results)) {
  console.log(`${key}: ${violations.length ? violations.map((v) => `${v.id} (${v.nodes.length})`).join(', ') : 'no violations'}`);
}
