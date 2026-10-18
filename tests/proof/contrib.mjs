/**
 * Contrib and core editor UI on frontend pages: screenshots and a visual
 * score per UI, theme and approach.
 *
 * Usage (site on snapshot contrib-setup-2026-10-14 or later, POC on):
 *   cd tests/proof && node contrib.mjs [--scenarios=c1,c3] [--themes=advaita]
 *
 * Advaita (the dual-theme prototype) runs as both the admin and the default
 * theme, with its skins bound (site advaita_paper, chrome advaita_indigo: the
 * theme carries no values); every other theme runs with Default Admin as the
 * admin theme and both contexts bound to the theme. Node
 * forms render in the frontend theme (node.settings use_admin_theme off), as
 * scenarios c4 and c5 need.
 *
 * Under approaches "systems" and "patterns" (systems plus Form API pattern
 * classes on every form element) the test module marks each UI as admin (regions.js),
 * as a declared chrome or app role would map it by default. Module CSS is not
 * listed in systems.json, so it stays unscoped under every approach.
 *
 * Writes out/contrib/report.json and out/contrib/<scenario>--<theme>--<approach>.jpg
 * (the UI) and ...--window.jpg. Leaves the site on approach "none", Olivero
 * and Default Admin, both contexts bound to the theme.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { readVisual, contrast, score } from './regions-visual.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'out', 'contrib');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const ALL_THEMES = ['olivero', 'ds_hostile', 'advaita'];
const APPROACHES = ['none', 'systems', 'patterns'];

async function openCoffee(page) {
  // The first open after a cache rebuild can miss Coffee's data: reload once.
  for (const attempt of [1, 2]) {
    await page.keyboard.press('Alt+d');
    await page.locator('.coffee-form-wrapper input').waitFor({ state: 'visible' });
    await page.keyboard.type('cont');
    try {
      await page.locator('.coffee-form-wrapper li').first().waitFor({ state: 'visible', timeout: attempt === 1 ? 10000 : 30000 });
      return;
    }
    catch (e) {
      if (attempt === 2) throw e;
      await page.reload({ waitUntil: 'networkidle' });
    }
  }
}

async function hoverComponent(page) {
  // A component that the approach hides can't be hovered: that is a result, not an error.
  const component = page.locator('.lp-builder .js-lpb-component').last();
  await page.locator('.lp-builder').scrollIntoViewIfNeeded();
  await component.hover({ timeout: 3000 }).catch(() => {});
}

export const SCENARIOS = [
  { id: 'c1', module: 'Coffee 2.0.1', title: 'Command palette over a page', role: 'chrome', path: '/node/2', steps: openCoffee, shot: '#coffee-form-inner' },
  { id: 'c2', module: 'Masquerade 2.2.0', title: 'Switch-user block in the page sidebar', role: 'chrome', path: '/node/2', shot: '.block-masquerade' },
  { id: 'c3', module: 'Content Moderation (core)', title: 'Moderation control on the latest revision', role: 'app', path: '/node/2/latest', shot: '.entity-moderation-form' },
  // The landing page and the Layout Paragraphs page get their node IDs at
  // install (scripts/demo-content.php), so they are found by their aliases.
  { id: 'c4', module: 'Paragraphs 1.23.0', title: 'Paragraphs widget on a frontend edit form', role: 'app', alias: '/about', edit: true, shot: '.field--widget-paragraphs' },
  { id: 'c5', module: 'Layout Paragraphs 3.0.0', title: 'Layout Paragraphs builder around page content', role: 'app', alias: '/issue-14', edit: true, steps: hoverComponent, shot: '.lp-builder' },
];

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const scenarios = args.scenarios ? SCENARIOS.filter((s) => args.scenarios.split(',').includes(s.id)) : SCENARIOS;
const THEMES = args.themes ? ALL_THEMES.filter((t) => args.themes.split(',').includes(t)) : ALL_THEMES;

function ddev(...cmd) {
  return execFileSync('ddev', cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// The system path behind an alias, e.g. /about → /node/13.
function systemPath(alias) {
  return ddev('drush', 'php:eval', `echo Drupal::service('path_alias.manager')->getPathByAlias('${alias}');`);
}

function useTheme(theme) {
  ddev('drush', 'config:set', 'system.theme', 'default', theme, '-y');
  ddev('drush', 'config:set', 'system.theme', 'admin', theme === 'advaita' ? 'advaita' : 'default_admin', '-y');
  ddev('drush', 'ds:bind', 'site', theme === 'advaita' ? 'advaita_paper' : 'theme');
  ddev('drush', 'ds:bind', 'chrome', theme === 'advaita' ? 'advaita_indigo' : 'theme');
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true, colorScheme: 'light' });
ddev('drush', 'config:set', 'node.settings', 'use_admin_theme', '0', '-y');
await (await context.newPage()).goto(ddev('drush', 'user:login', '--uri=' + BASE));

// A run with --scenarios or --themes replaces only those cells in an existing report.
const old = (args.scenarios || args.themes) && existsSync(join(OUT, 'report.json')) ? JSON.parse(readFileSync(join(OUT, 'report.json'), 'utf8')) : null;
const report = { generated: new Date().toISOString(), themes: ALL_THEMES.filter((t) => THEMES.includes(t) || old?.themes.includes(t)), approaches: APPROACHES, scenarios: structuredClone(old?.scenarios ?? {}) };
for (const s of scenarios) {
  if (s.alias) s.path = systemPath(s.alias) + (s.edit ? '/edit' : '');
  const results = report.scenarios[s.id]?.results ?? {};
  for (const key of Object.keys(results)) {
    if (THEMES.includes(key.split('--')[0])) delete results[key];
  }
  report.scenarios[s.id] = { module: s.module, title: s.title, role: s.role, path: s.path, results };
}

try {
for (const theme of THEMES) {
  useTheme(theme);
  for (const approach of APPROACHES) {
    ddev('ds-scope', approach);
    for (const s of scenarios) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
      if (s.steps) await s.steps(page);
      else await page.mouse.move(0, 0);
      await page.waitForTimeout(800);
      const base = join(OUT, `${s.id}--${theme}--${approach}`);
      const focus = page.locator(s.shot).first();
      await focus.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${base}--window.jpg`, type: 'jpeg', quality: 80 });
      await focus.screenshot({ path: `${base}.jpg`, type: 'jpeg', quality: 85 });
      const visual = await page.evaluate(readVisual, s.shot);
      visual.contrast = await contrast(page, s.shot);
      const marked = await page.evaluate((sel) => document.querySelector(sel)?.closest('[data-ds-system],[data-ds-boundary]')?.getAttribute('data-ds-system') ?? null, s.shot);
      report.scenarios[s.id].results[`${theme}--${approach}`] = { visual, visualScore: score(visual), marked, errors };
      console.log(s.id, theme, approach, 'score', score(visual), 'in', marked);
      await page.close();
    }
  }
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
}
finally {
  useTheme('olivero');
  ddev('ds-scope', 'none');
  await browser.close();
}
