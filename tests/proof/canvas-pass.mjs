/**
 * The Canvas chrome pass: screenshots and an axe scan (WCAG 2.1 AA) of the
 * admin pages the chrome draws, under the chrome skin, in light and dark.
 *
 * Usage (site running): cd tests/proof && node canvas-pass.mjs
 *   [--out=<dir>] [--only=<case,case>] [--modes=light,dark]
 * Writes <case>-<mode>.png and axe.json; <out> defaults to
 * out/canvas-align/pass. Reduced motion: Navigation animates its width when
 * a full-page shot resizes the window, which a shot would catch midway.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BASE = 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = resolve(args.out ?? join(HERE, 'out', 'canvas-align', 'pass'));
const only = args.only?.split(',');
const modes = (args.modes ?? 'light').split(',');
mkdirSync(OUT, { recursive: true });
// A full-page shot resizes the viewport, which briefly crosses Navigation's
// 64rem breakpoint; with motion its sidebar is caught mid width transition
// (labels clipped). Navigation drops its transitions for reduced motion.
const login = () => execFileSync('ddev', ['drush', 'user:login', '--uri=' + BASE], { cwd: ROOT, encoding: 'utf8' }).trim();
const CASES = [
  { id: 'node-media', path: '/node/1/edit', target: '.field--type-entity-reference, [data-drupal-selector="edit-field-media-wrapper"], .field--widget-media-library-widget' },
  { id: 'pages', path: '/admin/content/pages' },
  { id: 'pages-flyout', path: '/admin/content/pages', act: async (p) => { await p.locator('.dropbutton-toggle button').first().click(); await p.waitForTimeout(200); const item = p.locator('.dropbutton-menu__list a').first(); await item.hover(); } },
  { id: 'content', path: '/admin/content' },
  { id: 'content-flyout', path: '/admin/content', act: async (p) => { await p.locator('.dropbutton-toggle button').first().click(); await p.waitForTimeout(200); await p.locator('.dropbutton-menu__list a').first().hover(); } },
  { id: 'media', path: '/admin/content/media' },
  { id: 'media-grid', path: '/admin/content/media-grid' },
  { id: 'media-add', path: '/media/add/image' },
  { id: 'ml', path: '/node/1/edit', act: async (p) => { await p.locator('.js-media-library-open-button').first().click(); await p.waitForSelector('.media-library-widget-modal .js-media-library-item', { timeout: 20000 }); await p.waitForTimeout(800); }, dialog: true },
  { id: 'people', path: '/admin/people' },
  { id: 'site-info', path: '/admin/config/system/site-information' },
  { id: 'modules', path: '/admin/modules' },
  { id: 'blocks', path: '/admin/structure/block' },
  { id: 'types', path: '/admin/structure/types' },
  { id: 'fields', path: '/admin/structure/types/manage/article/fields' },
  { id: 'status', path: '/admin/reports/status' },
  { id: 'appearance', path: '/admin/appearance' },
  { id: 'taxonomy', path: '/admin/structure/taxonomy/manage/tags/overview' },
  { id: 'config', path: '/admin/config' },
  { id: 'dblog-pager', path: '/admin/reports/dblog?page=2' },
  { id: 'ml-pager', path: '/node/1/edit', act: async (p) => { await p.locator('input[value="Add media"], button:has-text("Add media")').first().click(); const pg = p.locator('.media-library-widget-modal nav[aria-labelledby]').first(); await pg.waitFor({ timeout: 20000 }); await p.waitForTimeout(800); await pg.scrollIntoViewIfNeeded(); await p.waitForTimeout(200); }, dialog: true },
  // Needs views.view.content at 5 items per page (set and restore it around the run).
  { id: 'content-pager', path: '/admin/content?page=1', act: async (p) => { await p.locator('nav.pager').first().scrollIntoViewIfNeeded(); await p.locator('nav.pager a').nth(1).hover(); await p.waitForTimeout(150); } },
  { id: 'content-flyout-delete', path: '/admin/content', act: async (p) => { await p.locator('.dropbutton-toggle button').first().click(); await p.waitForTimeout(200); await p.locator('.dropbutton-menu__list a[href*="/delete"]').first().hover(); } },
  { id: 'dashboard', path: '/admin/dashboard' },
  { id: 'pages-flyout-view', path: '/admin/content/pages', act: async (p) => { await p.locator('.dropbutton-toggle button').first().click(); await p.waitForTimeout(200); await p.locator('.dropbutton-menu__list a').last().hover(); await p.waitForTimeout(150); } },
  { id: 'user-edit', path: '/user/1/edit' },
  { id: 'spec-sheet', path: '/admin/advaita/spec' },
  { id: 'files', path: '/admin/content/files' },
  { id: 'moderated', path: '/admin/content/moderated' },
  { id: 'delete-modal', path: '/admin/content', act: async (p) => { await p.locator('.dropbutton-toggle button').first().click(); await p.waitForTimeout(200); await p.locator('.dropbutton-menu__list a[href*="/delete"]').first().click(); await p.waitForSelector('.ui-dialog', { timeout: 20000 }); await p.waitForTimeout(800); }, dialog: true },
  { id: 'block-remove', path: '/admin/structure/block/manage/advaita_account_menu?destination=/node' },
  { id: 'front', path: '/' },
];
const browser = await chromium.launch();
const report = {};
for (const mode of modes) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 }, colorScheme: mode, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(login());
  for (const c of CASES) {
    if (only && !only.includes(c.id)) continue;
    try {
      await page.goto(BASE + c.path, { waitUntil: 'networkidle' });
      if (c.act) await c.act(page);
      const file = join(OUT, `${c.id}-${mode}.png`);
      if (c.target && !c.act) {
        const t = page.locator(c.target).first();
        if (await t.count()) { await t.scrollIntoViewIfNeeded(); await t.screenshot({ path: file }); }
        else await page.screenshot({ path: file, fullPage: true });
      } else if (c.dialog) {
        await page.screenshot({ path: file });
      } else {
        await page.screenshot({ path: file, fullPage: !c.act });
      }
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      report[`${c.id}-${mode}`] = r.violations.map((v) => `${v.id}:${v.nodes.length} ${v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' | ')}`);
      console.log(c.id, mode, r.violations.length);
    } catch (e) { console.log(c.id, mode, 'ERR', e.message.split('\n')[0]); }
  }
  await ctx.close();
}
writeFileSync(join(OUT, 'axe.json'), JSON.stringify(report, null, 2));
await browser.close();
