/**
 * Two systems on one page that differ in structure, not only in colour.
 *
 * Usage (Advaita installed, see advaita.mjs):
 *   cd tests/proof && node skin-contrast.mjs
 *
 * Captures the same mixed pages with two skin pairs bound to Advaita:
 * - colour: site advaita_paper, chrome advaita_indigo. The skins differ in
 *   palette, typeface and radius; a chrome region on a site page can read as a
 *   highlighted section.
 * - structure: site advaita_atelier (whitespace, large type, tall controls,
 *   soft depth), chrome advaita_canvas (hairline edges, flat surfaces, compact
 *   controls, small type). The chrome region reads as another tool.
 *
 * The Media Library declares its dialog as chrome; the run maps chrome to the
 * admin system (ddev ds-scope ml-admin) so the dialog over a site form takes
 * the chrome skin, and puts the previous mapping back at the end.
 *
 * Records the structural tokens each region resolves (control height, base
 * font size, space, edge width) next to an axe scan of every capture.
 * Writes out/skin-contrast/<page>--<mode>--<pair>.jpg and report.json.
 * Restores the site's usual themes and bindings at the end.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'out', 'skin-contrast');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';

const PAIRS = [
  { id: 'colour', site: 'advaita_paper', chrome: 'advaita_indigo' },
  { id: 'structure', site: 'advaita_atelier', chrome: 'advaita_canvas' },
];
const MODES = ['light', 'dark'];
const PAGES = [
  { id: 'article', path: '/node/2', title: 'Article with the switch-user block (chrome region on a site page)' },
  {
    id: 'landing-edit', path: '/node/3/edit', title: 'Paragraphs in the chrome inside a site form', frontendForms: true,
    run: async (page) => { await page.locator('.field--widget-paragraphs').first().scrollIntoViewIfNeeded(); },
  },
  {
    id: 'media-library', path: '/node/2/edit', title: 'Media Library dialog over a site form', frontendForms: true,
    run: async (page) => {
      await page.getByRole('button', { name: 'Add media' }).click();
      await page.locator('.ui-dialog .js-media-library-item').first().waitFor();
      await page.locator('.ui-dialog .js-media-library-item input[type="checkbox"]').first().check();
      await page.locator('.ui-dialog .ui-dialog-content').evaluate((el) => el.scrollTo(0, 0));
    },
  },
  {
    id: 'dashboard', path: '/admin/dashboard', title: 'Dashboard: the site card inside the chrome',
    run: async (page) => { await page.locator('.system-card').first().scrollIntoViewIfNeeded(); },
  },
];

function ddev(...cmd) {
  return execFileSync('ddev', cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function settle(page) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

async function axe(page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
}

// The structural tokens at the page root and inside the first region of each
// other system on the page.
function structure() {
  const names = ['--ds-control-height-m', '--ds-font-size-m', '--ds-space-m', '--ds-border-width-s', '--ds-font-line-height-base', '--ds-radius-m'];
  const read = (el) => Object.fromEntries(names.map((n) => [n.slice(5), getComputedStyle(el).getPropertyValue(n).trim()]));
  const out = { page: read(document.body) };
  for (const el of document.querySelectorAll('[data-ds-system]')) {
    const key = `region:${el.dataset.dsSystem}`;
    if (!(key in out) && el.getClientRects().length) out[key] = read(el);
  }
  return out;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const login = () => ddev('drush', 'user:login', '--uri=' + BASE);
const report = { generated: new Date().toISOString(), theme: 'advaita', pairs: PAIRS, pages: {} };

ddev('drush', 'config:set', 'system.theme', 'default', 'advaita', '-y');
ddev('drush', 'config:set', 'system.theme', 'admin', 'advaita', '-y');
ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', '1', '-y');
ddev('ds-scope', 'none');
const mlAs = ddev('drush', 'state:get', 'ds_scope_poc.ml_as') || 'boundary';
ddev('ds-scope', 'ml-admin');

try {
  for (const pair of PAIRS) {
    ddev('drush', 'ds:bind', 'site', pair.site);
    ddev('drush', 'ds:bind', 'chrome', pair.chrome);
    for (const p of PAGES) {
      ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', p.frontendForms ? '0' : '1', '-y');
      for (const mode of MODES) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true, colorScheme: mode });
        const page = await context.newPage();
        await page.goto(login());
        await page.goto(BASE + p.path, { waitUntil: 'networkidle' });
        if (p.run) await p.run(page);
        await settle(page);
        const file = `${p.id}--${mode}--${pair.id}.jpg`;
        await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 82 });
        const tokens = await page.evaluate(structure);
        const violations = await axe(page);
        report.pages[p.id] ??= { id: p.id, path: p.path, title: p.title, captures: {} };
        report.pages[p.id].captures[`${mode}--${pair.id}`] = { file, site: pair.site, chrome: pair.chrome, tokens, violations };
        console.log('contrast', p.id, mode, pair.id, 'axe', violations.length, JSON.stringify(tokens));
        await context.close();
      }
    }
  }
}
finally {
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  ddev('ds-scope', `ml-${mlAs}`);
  ddev('drush', 'ds:bind', 'site', 'theme');
  ddev('drush', 'ds:bind', 'chrome', 'theme');
  ddev('drush', 'config:set', 'system.theme', 'default', 'olivero', '-y');
  ddev('drush', 'config:set', 'system.theme', 'admin', 'default_admin', '-y');
  ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', '0', '-y');
  await browser.close();
}
