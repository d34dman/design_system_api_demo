/**
 * The skin editor's Spacing tab and narrow preview (Breakpoint Axis plan,
 * m2-e1, C-04). Logs in with a one-time link, opens a skin, gives
 * space.section a narrow value, presses Check (nothing is saved) and
 * screenshots the Spacing tab and the preview panes (the narrow one last).
 *
 * Usage:
 *   cd tests/proof && node skin-spacing.mjs --tag=m2 --skin=advaita_paper
 *
 * Writes out/breakpoint/<tag>/skin-spacing--tab.png and --preview.png.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = join(HERE, 'out', 'breakpoint', args.tag ?? 'latest');
const SKIN = args.skin ?? 'advaita_paper';

mkdirSync(OUT, { recursive: true });
const uli = execFileSync('ddev', ['drush', 'uli', '--no-browser', `--uri=${BASE}`, `admin/appearance/design-system/skins/${SKIN}/edit`]).toString().trim();
const browser = await chromium.launch();
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 1000 } });
await page.goto(uli, { waitUntil: 'networkidle' });
await page.locator('a[href="#ds-tab-spacing"]').first().click();
await page.fill('#ds-space-narrow-section', '1rem');
await page.getByRole('button', { name: 'Check', exact: true }).click();
await page.waitForLoadState('networkidle');
await page.locator('a[href="#ds-tab-spacing"]').first().click();
await page.locator('#ds-tab-spacing').screenshot({ path: join(OUT, 'skin-spacing--tab.png') });
await page.locator('.ds-preview__panes').screenshot({ path: join(OUT, 'skin-spacing--preview.png') });
const gaps = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-ds-preview-mode]')].map((p) => {
  const [s1, s2] = p.querySelectorAll('.ds-preview__section');
  return [p.dataset.dsPreviewMode, Math.round(s2.getBoundingClientRect().top - s1.getBoundingClientRect().bottom)];
})));
console.log('Section gap per preview pane (px):', JSON.stringify(gaps));
await browser.close();
