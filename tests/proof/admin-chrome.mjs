/**
 * Core's admin chrome on every setup: Navigation's sidebar and top bar, and
 * contextual links (opened), plus the classic Toolbar with Admin Toolbar when
 * --toolbar is given. Shows whether they follow the chrome context's skin
 * and mode, and that Default Admin and Claro still look as before.
 *
 * Usage:
 *   cd tests/proof && node admin-chrome.mjs [--setups=stock,structure] [--pages=article] [--modes=dark] [--toolbar] [--tag=before]
 *
 * Writes out/admin-chrome/<tag>/<setup>/<page>--<mode>.jpg and logs an axe
 * count per capture. Restores the stock setup at the end.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const pick = (list, key) => (args[key] ? list.filter((x) => args[key].split(',').includes(x.id ?? x)) : list);
const OUT = join(HERE, 'out', 'admin-chrome', args.tag ?? 'latest');
const TOOLBAR = 'toolbar' in args;

const SETUPS = pick(['stock', 'claro', 'ember', 'structure'], 'setups');
const MODES = pick(['light', 'dark'], 'modes');

// Opens the contextual links of the first element that has them.
async function openContextual(page) {
  const region = page.locator('main .contextual-region, .contextual-region').first();
  if (!(await region.count())) return;
  await region.hover();
  const trigger = page.locator('.contextual .trigger').first();
  await trigger.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  if (await trigger.isVisible()) await trigger.click();
  await page.locator('.contextual-links').first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
}

// Opens the first top-level menu of whichever admin bar is on the page.
async function openMenu(page) {
  const nav = page.locator('.toolbar-block__list-item button.toolbar-button--expand--side, .admin-toolbar .toolbar-button[aria-expanded]').first();
  if (await nav.count()) {
    await nav.click().catch(() => {});
    return;
  }
  const classic = page.locator('.toolbar-tray .menu-item--expanded > a').first();
  if (await classic.count()) await classic.hover().catch(() => {});
}

const PAGES = pick([
  { id: 'article', path: '/node/2', run: openContextual },
  { id: 'front', path: '/node', run: openContextual },
  { id: 'content', path: '/admin/content', run: openMenu },
  { id: 'blocks', path: '/admin/structure/block', run: openContextual },
], 'pages');

function ddev(...cmd) {
  return execFileSync('ddev', cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Uninstalling a module that isn't installed fails; that's fine here.
function ddevMaybe(...cmd) {
  try {
    ddev(...cmd);
  }
  catch {
    // Already in the wanted state.
  }
}

const browser = await chromium.launch();
const login = () => ddev('drush', 'user:login', '--uri=' + BASE);
if (TOOLBAR) {
  ddevMaybe('drush', 'pm:uninstall', 'navigation', '-y');
  ddev('drush', 'pm:install', 'toolbar', 'admin_toolbar', 'admin_toolbar_tools', '-y');
}

try {
  for (const setup of SETUPS) {
    mkdirSync(join(OUT, setup), { recursive: true });
    ddev('demo', setup, '--no-login');
    for (const p of PAGES) {
      for (const mode of MODES) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true, colorScheme: mode });
        const page = await context.newPage();
        await page.goto(login());
        await page.goto(BASE + p.path, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        if (p.run) await p.run(page);
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(OUT, setup, `${p.id}--${mode}.jpg`), type: 'jpeg', quality: 80 });
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        console.log('chrome', setup, p.id, mode, 'axe', axe.violations.length, axe.violations.map((v) => `${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '')).join(' | ')}`).join(' '));
        await context.close();
      }
    }
  }
}
finally {
  if (TOOLBAR) {
    ddevMaybe('drush', 'pm:uninstall', 'admin_toolbar_tools', 'admin_toolbar', 'toolbar', '-y');
    ddev('drush', 'pm:install', 'navigation', '-y');
  }
  ddev('demo', 'stock', '--no-login');
  await browser.close();
}
