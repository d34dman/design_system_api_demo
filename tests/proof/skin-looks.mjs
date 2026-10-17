/**
 * Every Advaita skin pair on the pages a demo walks through, for a design
 * review: what a laptop screen shows (1440 × 1000; full-page captures cut
 * core Navigation, which is fixed).
 *
 * Usage (Advaita installed, see advaita.mjs):
 *   cd tests/proof && node skin-looks.mjs [--pairs=structure,colour] [--pages=article,dashboard] [--modes=light]
 *
 * Writes out/skin-looks/<pair>/<page>--<mode>.jpg and logs an axe count per
 * capture. Restores the site's usual
 * themes and bindings at the end.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'out', 'skin-looks');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const pick = (list, key) => (args[key] ? list.filter((x) => args[key].split(',').includes(x.id ?? x)) : list);

const PAIRS = pick([
  { id: 'colour', site: 'advaita_paper', chrome: 'advaita_indigo' },
  { id: 'ember', site: 'advaita_paper', chrome: 'advaita_ember' },
  { id: 'structure', site: 'advaita_atelier', chrome: 'advaita_canvas' },
], 'pairs');
const MODES = pick(['light', 'dark'], 'modes');
const PAGES = pick([
  { id: 'front', path: '/node' },
  { id: 'article', path: '/node/2' },
  { id: 'landing', path: '/node/3' },
  { id: 'landing-edit', path: '/node/3/edit', frontendForms: true },
  {
    id: 'media-library', path: '/node/2/edit', frontendForms: true,
    run: async (page) => {
      await page.getByRole('button', { name: 'Add media' }).click();
      await page.locator('.ui-dialog .js-media-library-item').first().waitFor();
    },
  },
  { id: 'dashboard', path: '/admin/dashboard' },
  { id: 'content', path: '/admin/content' },
  { id: 'node-edit', path: '/node/2/edit' },
  { id: 'blocks', path: '/admin/structure/block' },
], 'pages');

function ddev(...cmd) {
  return execFileSync('ddev', cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

const browser = await chromium.launch();
const login = () => ddev('drush', 'user:login', '--uri=' + BASE);
const mlAs = ddev('drush', 'state:get', 'ds_scope_poc.ml_as') || 'boundary';
ddev('drush', 'config:set', 'system.theme', 'default', 'advaita', '-y');
ddev('drush', 'config:set', 'system.theme', 'admin', 'advaita', '-y');
ddev('ds-scope', 'none');
ddev('ds-scope', 'ml-admin');

try {
  for (const pair of PAIRS) {
    mkdirSync(join(OUT, pair.id), { recursive: true });
    ddev('drush', 'ds:bind', 'site', pair.site);
    ddev('drush', 'ds:bind', 'chrome', pair.chrome);
    for (const p of PAGES) {
      ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', p.frontendForms ? '0' : '1', '-y');
      for (const mode of MODES) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true, colorScheme: mode });
        const page = await context.newPage();
        await page.goto(login());
        await page.goto(BASE + p.path, { waitUntil: 'networkidle' });
        if (p.run) await p.run(page);
        await page.mouse.move(0, 0);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(OUT, pair.id, `${p.id}--${mode}.jpg`), type: 'jpeg', quality: 80, fullPage: false });
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        console.log('look', pair.id, p.id, mode, 'axe', axe.violations.length, axe.violations.map((v) => `${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '')).join(' | ')}`).join(' '));
        await context.close();
      }
    }
  }
}
finally {
  ddev('ds-scope', `ml-${mlAs}`);
  ddev('drush', 'ds:bind', 'site', 'theme');
  ddev('drush', 'ds:bind', 'chrome', 'theme');
  ddev('drush', 'config:set', 'system.theme', 'default', 'olivero', '-y');
  ddev('drush', 'config:set', 'system.theme', 'admin', 'default_admin', '-y');
  ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', '0', '-y');
  await browser.close();
}
