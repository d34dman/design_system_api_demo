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
 * Writes out/ui-kit-showcase/<tag>/<variant>--<part>.png and
 * out/ui-kit-showcase/<tag>/axe.json.
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
const PARTS = ['normal', 'blank'];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const results = {};
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
  const axe = await new AxeBuilder({ page })
    .include('[class*="ui-kit-"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  results[variant.id] = axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  console.log(variant.id, 'axe', axe.violations.length, axe.violations.map((v) => v.id).join(' '));
  await context.close();
}
writeFileSync(join(OUT, 'axe.json'), JSON.stringify(results, null, 2) + '\n');
await browser.close();
