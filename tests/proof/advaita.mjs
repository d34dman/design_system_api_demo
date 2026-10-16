/**
 * Advaita, the dual-theme prototype: what it looks like, how it feels, and
 * an axe scan of every page.
 *
 * Usage (site on snapshot contrib-setup-2026-10-14 or later, Advaita and
 * advaita_showcase installed):
 *   cd tests/proof && node advaita.mjs [--only=looks|feels|coverage|swap]
 *
 * Sets Advaita as both the admin and the default theme, with node forms on
 * admin routes, and approach "none": Advaita needs no scoping, the Design
 * System API delivers each system's tokens to its regions. The theme carries
 * no values: the site binds its skins (site advaita_paper, chrome
 * advaita_indigo). Restores Olivero, Default Admin, both contexts bound to the
 * theme and frontend node forms afterwards.
 *
 * Writes out/advaita/report.json, looks/<page>--<mode>.jpg, feels/<state>.jpg,
 * clips/<clip>.webm and coverage/<page>.jpg.
 *
 * The swap (--only=swap, also part of a full run) binds the chrome to
 * advaita_ember, the theme unchanged, and captures the same pages with each
 * chrome skin: out/advaita-skin-swap/<page>--<mode>--<skin>.jpg and
 * report.json (the theme's own stylesheets per capture, to show they match).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'out', 'advaita');
const SWAP_OUT = join(HERE, 'out', 'advaita-skin-swap');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));

// What each page is, and which system renders it.
export const PAGES = [
  { id: 'dashboard', path: '/admin/dashboard', system: 'admin', title: 'Dashboard', note: 'Advaita components on real site data' },
  { id: 'content', path: '/admin/content', system: 'admin', title: 'Content', note: 'Views table, filters, dropbuttons, bulk actions' },
  { id: 'node-edit', path: '/node/2/edit', system: 'admin', title: 'Edit an article', note: 'Node form with Media Library widget and moderation' },
  { id: 'blocks', path: '/admin/structure/block', system: 'admin', title: 'Block layout', note: 'Tabledrag, selects, dropbuttons' },
  { id: 'article', path: '/node/2', system: 'site', title: 'Article', note: 'The site system, with the switch-user block' },
  { id: 'landing', path: '/node/3', system: 'site', title: 'Landing page', note: 'Paragraphs content' },
];

export const MODES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark', colorScheme: 'dark' },
  { id: 'rtl', label: 'Arabic (RTL)', prefix: '/ar' },
];

// Screens nobody styled for the prototype: how far core's markup gets on
// contract tokens alone.
export const COVERAGE = [
  { id: 'modules', path: '/admin/modules', title: 'Extend' },
  { id: 'status', path: '/admin/reports/status', title: 'Status report' },
  { id: 'views-ui', path: '/admin/structure/views/view/content', title: 'Views UI' },
  { id: 'permissions', path: '/admin/people/permissions', title: 'Permissions' },
  { id: 'appearance', path: '/admin/appearance', title: 'Appearance' },
  { id: 'fields', path: '/admin/structure/types/manage/article/fields', title: 'Manage fields' },
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

// Interactions: each one is a short story with a screenshot at its end.
export const FEELS = [
  {
    id: 'dropbutton', title: 'Operations dropbutton, open', path: '/admin/content',
    run: async (page) => { await page.locator('.dropbutton-toggle button').first().click(); },
  },
  {
    id: 'media-library', title: 'Media Library dialog over the node form', path: '/node/2/edit',
    run: async (page) => {
      await page.getByRole('button', { name: 'Add media' }).click();
      await page.locator('.ui-dialog .js-media-library-item').first().waitFor();
      await page.locator('.ui-dialog .js-media-library-item input[type="checkbox"]').first().check();
      await page.locator('.ui-dialog .ui-dialog-content').evaluate((el) => el.scrollTo(0, 0));
    },
  },
  {
    id: 'tabledrag', title: 'Dragging a block to a new place', path: '/admin/structure/block',
    run: async (page) => {
      const box = await page.locator('.tabledrag-handle').nth(2).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + 75, { steps: 10 });
      await page.mouse.up();
      await page.locator('.tabledrag-changed-warning').waitFor();
    },
  },
  {
    id: 'validation', title: 'A form with errors', path: '/node/add/article',
    run: async (page) => {
      await page.locator('#edit-title-0-value').evaluate((el) => el.removeAttribute('required'));
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForLoadState('networkidle');
    },
  },
  {
    id: 'focus', title: 'Keyboard focus moving through a form', path: '/node/add/article',
    run: async (page) => {
      await page.locator('#edit-title-0-value').focus();
      await page.keyboard.type('A new article');
      await page.keyboard.press('Tab');
    },
  },
  {
    id: 'autocomplete', title: 'Autocomplete suggestions', path: '/node/3/edit',
    run: async (page) => {
      await page.locator('summary', { hasText: 'Authoring information' }).click();
      const field = page.locator('#edit-uid-0-target-id');
      await field.scrollIntoViewIfNeeded();
      await field.fill('');
      await field.pressSequentially('ad', { delay: 120 });
      await page.locator('.ui-autocomplete li').first().waitFor({ timeout: 5000 }).catch(() => {});
    },
  },
  {
    id: 'mode-toggle', title: 'The admin switched to dark, the site card keeps its own values', path: '/admin/dashboard',
    run: async (page) => {
      await page.locator('[data-advaita-mode-toggle]').click();
      await page.locator('.system-card').first().scrollIntoViewIfNeeded();
    },
    after: async (page) => { await page.evaluate(() => localStorage.removeItem('advaita.mode')); },
  },
  {
    id: 'admin-on-site', title: 'Admin UI on a site page: Paragraphs in the admin system inside a site form', path: '/node/3/edit',
    frontendForms: true,
    run: async (page) => { await page.locator('.field--widget-paragraphs').scrollIntoViewIfNeeded(); },
  },
];

// The chrome skin swapped, the theme unchanged: admin pages, and admin UI on
// a site page (the switch-user block, Paragraphs on a site form).
export const SWAP = {
  skins: ['advaita_indigo', 'advaita_ember'],
  pages: [
    { id: 'dashboard', path: '/admin/dashboard', title: 'Dashboard' },
    { id: 'node-edit', path: '/node/2/edit', title: 'Edit an article' },
    { id: 'article', path: '/node/2', title: 'Article with the switch-user block (admin region on a site page)' },
    { id: 'landing-edit', path: '/node/3/edit', title: 'Paragraphs in the admin system inside a site form', frontendForms: true, focus: '.field--widget-paragraphs' },
  ],
  modes: ['light', 'dark'],
};

// Short clips: the same components moving.
export const CLIPS = [
  {
    id: 'dashboard', title: 'Dashboard: hover, open a dropbutton, switch to dark and back', path: '/admin/dashboard',
    run: async (page) => {
      for (const stat of await page.locator('a.stat').all()) {
        await stat.hover();
        await page.waitForTimeout(350);
      }
      await page.locator('.dropbutton-toggle button').first().click();
      await page.waitForTimeout(900);
      await page.keyboard.press('Escape');
      await page.locator('.dropbutton-toggle button').first().click();
      await page.waitForTimeout(400);
      await page.locator('[data-advaita-mode-toggle]').click();
      await page.waitForTimeout(1400);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(1200);
      await page.mouse.wheel(0, -500);
      await page.locator('[data-advaita-mode-toggle]').click();
      await page.waitForTimeout(1000);
    },
  },
  {
    id: 'media', title: 'Node form: pick an image in the Media Library and insert it', path: '/node/2/edit',
    run: async (page) => {
      await page.waitForTimeout(600);
      await page.getByRole('button', { name: 'Add media' }).click();
      await page.locator('.ui-dialog .js-media-library-item').first().waitFor();
      await page.waitForTimeout(900);
      await page.locator('.ui-dialog .js-media-library-item input[type="checkbox"]').nth(2).check();
      await page.waitForTimeout(700);
      await page.locator('.ui-dialog-buttonpane .button--primary, .ui-dialog-buttonpane .media-library-select').first().click();
      await page.locator('.ui-dialog').waitFor({ state: 'detached' });
      await page.waitForTimeout(1200);
    },
  },
];

mkdirSync(OUT, { recursive: true });
const only = args.only;
const browser = await chromium.launch();
const login = () => ddev('drush', 'user:login', '--uri=' + BASE);

ddev('drush', 'config:set', 'system.theme', 'default', 'advaita', '-y');
ddev('drush', 'config:set', 'system.theme', 'admin', 'advaita', '-y');
ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', '1', '-y');
ddev('drush', 'ds:bind', 'site', 'advaita_paper');
ddev('drush', 'ds:bind', 'chrome', 'advaita_indigo');
ddev('ds-scope', 'none');

const report = { generated: new Date().toISOString(), pages: {}, feels: {}, clips: {}, coverage: {} };
const save = () => writeFileSync(join(OUT, only ? `report-${only}.json` : 'report.json'), JSON.stringify(report, null, 1));

try {

if (!only || only === 'looks') {
  mkdirSync(join(OUT, 'looks'), { recursive: true });
  for (const mode of MODES) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true, colorScheme: mode.colorScheme ?? 'light' });
    const page = await context.newPage();
    await page.goto(login());
    for (const p of PAGES) {
      await page.goto(BASE + (mode.prefix ?? '') + p.path, { waitUntil: 'networkidle' });
      await settle(page);
      const file = `looks/${p.id}--${mode.id}.jpg`;
      await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 82 });
      const facts = await page.evaluate(() => ({
        system: document.documentElement.getAttribute('data-ds-system'),
        dir: document.documentElement.dir,
        font: getComputedStyle(document.body).fontFamily.split(',')[0],
      }));
      const violations = await axe(page);
      report.pages[p.id] ??= { ...p, modes: {} };
      report.pages[p.id].modes[mode.id] = { file, ...facts, violations };
      console.log('look', p.id, mode.id, facts.system, facts.font, 'axe', violations.length);
    }
    await context.close();
  }
}

if (!only || only === 'feels') {
  mkdirSync(join(OUT, 'feels'), { recursive: true });
  for (const f of FEELS) {
    if (f.frontendForms) ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', '0', '-y');
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto(login());
    await page.goto(BASE + f.path, { waitUntil: 'networkidle' });
    try {
      await f.run(page);
    }
    catch (e) {
      // A state that can't be reached is reported, not fatal.
      console.log('feel failed', f.id, e.message.split('\n')[0]);
      report.feels[f.id] = { id: f.id, title: f.title, path: f.path, error: e.message.split('\n')[0] };
      await context.close();
      if (f.frontendForms) ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', '1', '-y');
      continue;
    }
    await settle(page);
    const file = `feels/${f.id}.jpg`;
    await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 82 });
    if (f.after) await f.after(page);
    report.feels[f.id] = { id: f.id, title: f.title, path: f.path, file };
    console.log('feel', f.id);
    await context.close();
    if (f.frontendForms) ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', '1', '-y');
  }

  mkdirSync(join(OUT, 'clips'), { recursive: true });
  for (const c of CLIPS) {
    const tmp = join(OUT, 'clips', 'tmp');
    rmSync(tmp, { recursive: true, force: true });
    const setup = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const url = login();
    await (await setup.newPage()).goto(url);
    const state = await setup.storageState();
    await setup.close();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true, storageState: state, recordVideo: { dir: tmp, size: { width: 1280, height: 800 } } });
    const page = await context.newPage();
    await page.goto(BASE + c.path, { waitUntil: 'networkidle' });
    await c.run(page);
    await context.close();
    const [video] = readdirSync(tmp);
    renameSync(join(tmp, video), join(OUT, 'clips', `${c.id}.webm`));
    rmSync(tmp, { recursive: true, force: true });
    report.clips[c.id] = { id: c.id, title: c.title, path: c.path, file: `clips/${c.id}.webm` };
    console.log('clip', c.id);
  }
}

if (!only || only === 'coverage') {
  mkdirSync(join(OUT, 'coverage'), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(login());
  for (const c of COVERAGE) {
    await page.goto(BASE + c.path, { waitUntil: 'networkidle' });
    await settle(page);
    const file = `coverage/${c.id}.jpg`;
    await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 80 });
    report.coverage[c.id] = { ...c, file, violations: await axe(page) };
    console.log('coverage', c.id, report.coverage[c.id].violations.length);
  }
  await context.close();
}

if (!only || only === 'swap') {
  mkdirSync(SWAP_OUT, { recursive: true });
  const swap = { generated: new Date().toISOString(), theme: 'advaita', skins: SWAP.skins, pages: {} };
  try {
    for (const skin of SWAP.skins) {
      ddev('drush', 'ds:bind', 'chrome', skin);
      for (const p of SWAP.pages) {
        if (p.frontendForms) ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', '0', '-y');
        for (const mode of SWAP.modes) {
          const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true, colorScheme: mode });
          const page = await context.newPage();
          await page.goto(login());
          await page.goto(BASE + p.path, { waitUntil: 'networkidle' });
          if (p.focus) await page.locator(p.focus).first().scrollIntoViewIfNeeded();
          await settle(page);
          const file = `${p.id}--${mode}--${skin}.jpg`;
          await page.screenshot({ path: join(SWAP_OUT, file), type: 'jpeg', quality: 82 });
          const facts = await page.evaluate(() => ({
            theme: [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.getAttribute('href')).filter((h) => !h.includes('/design-system/')),
            tokens: [...document.querySelectorAll('link[data-design-system-skin]')].map((l) => ({ skin: l.dataset.designSystemSkin, context: l.dataset.designSystemContext, region: l.dataset.designSystemRegion ?? null, href: l.getAttribute('href') })),
            primary: getComputedStyle(document.documentElement).getPropertyValue('--ds-color-action-primary').trim(),
          }));
          const violations = await axe(page);
          swap.pages[p.id] ??= { ...p, captures: {} };
          swap.pages[p.id].captures[`${mode}--${skin}`] = { file, ...facts, violations };
          console.log('swap', p.id, mode, skin, facts.primary, 'axe', violations.length);
          await context.close();
        }
        if (p.frontendForms) ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', '1', '-y');
      }
    }
    for (const p of Object.values(swap.pages)) {
      const sheets = Object.values(p.captures).map((c) => JSON.stringify(c.theme));
      p.themeUnchanged = sheets.every((t) => t === sheets[0]);
    }
  }
  finally {
    writeFileSync(join(SWAP_OUT, 'report.json'), JSON.stringify(swap, null, 1));
    ddev('drush', 'ds:bind', 'chrome', 'advaita_indigo');
  }
}

}
finally {
  // Whatever got captured is kept, and the site goes back to its usual state.
  save();
  ddev('drush', 'ds:bind', 'site', 'theme');
  ddev('drush', 'ds:bind', 'chrome', 'theme');
  ddev('drush', 'config:set', 'system.theme', 'default', 'olivero', '-y');
  ddev('drush', 'config:set', 'system.theme', 'admin', 'default_admin', '-y');
  ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', '0', '-y');
  await browser.close();
}
