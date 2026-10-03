/**
 * Captures the proof matrix: theme × context × view, with the Media Library
 * pilot off ("before") and on ("after"), plus an axe scan of each cell.
 *
 * Usage (from the demo root, site running):
 *   cd tests/proof && npm install && npm run capture [-- --pilot=on|off|both] [--themes=a,b] [--variants=a,b]
 *
 * Writes out/<pilot>/<theme>/<variant>--<view>.jpg and out/results.json.
 * The site is left with the pilot on and the themes the demo installs with.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { THEMES, VARIANTS, VIEWS } from './capture-config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'out');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const pilots = args.pilot === 'on' ? ['on'] : args.pilot === 'off' ? ['off'] : ['off', 'on'];
const themes = args.themes ? THEMES.filter((t) => args.themes.split(',').includes(t.name)) : THEMES;
const variants = args.variants ? VARIANTS.filter((v) => args.variants.split(',').includes(v.name)) : VARIANTS;

function drush(...cmd) {
  return execFileSync('ddev', ['drush', ...cmd], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function setPilot(on) {
  if (on) drush('pm:install', 'design_system_api_media_library', '-y');
  else drush('pm:uninstall', 'design_system_api_media_library', '-y');
}

function setTheme(theme) {
  drush('theme:install', theme.name, '-y');
  if (theme.role === 'admin') {
    drush('config:set', 'system.theme', 'admin', theme.name, '-y');
    drush('config:set', 'node.settings', 'use_admin_theme', '1', '-y');
  }
  else {
    drush('config:set', 'system.theme', 'default', theme.name, '-y');
    drush('config:set', 'node.settings', 'use_admin_theme', '0', '-y');
  }
  drush('cache:rebuild');
}

async function login(context) {
  const url = drush('user:login', '--uri=' + BASE);
  const page = await context.newPage();
  await page.goto(url);
  await page.close();
}

async function shoot(page, file, target) {
  mkdirSync(dirname(file), { recursive: true });
  const options = { path: file, type: 'jpeg', quality: 72, animations: 'disabled', caret: 'hide' };
  if (target) await target.screenshot(options);
  else await page.screenshot(options);
}

async function axe(page, include) {
  try {
    const result = await new AxeBuilder({ page }).include(include).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')), summary: v.nodes[0]?.failureSummary?.slice(0, 240) }));
  }
  catch (e) {
    return [{ id: 'axe-error', impact: 'unknown', help: String(e.message).slice(0, 200), nodes: 0 }];
  }
}

const resultsFile = join(OUT, 'results.json');
const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, 'utf8')) : { cells: {} };
results.base = BASE;

async function captureCell(browser, pilot, theme, variant) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    ignoreHTTPSErrors: true,
    ...variant.emulate,
  });
  await login(context);
  const page = await context.newPage();
  await page.goto(BASE + variant.path, { waitUntil: 'networkidle' });
  // Page-side choices made with attributes (e.g. data-ds-mode="dark").
  if (variant.html) {
    await page.evaluate((attributes) => {
      for (const [name, value] of Object.entries(attributes)) document.documentElement.setAttribute(name, value);
    }, variant.html);
  }

  // View 1: the field widget on the entity form.
  const widget = page.locator('.js-media-library-widget').first();
  await widget.scrollIntoViewIfNeeded();
  const key = `${pilot}/${theme.name}/${variant.name}`;
  await shoot(page, join(OUT, pilot, theme.name, `${variant.name}--widget.jpg`), widget);
  const widgetAxe = await axe(page, '.js-media-library-widget');

  // View 2: the Media Library dialog, with one item selected.
  await page.locator('.js-media-library-open-button').first().click();
  const dialog = page.locator('.media-library-widget-modal');
  await dialog.waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle');
  // Click-to-select: core toggles the checkbox when the item is clicked.
  const item = dialog.locator('.js-click-to-select-trigger').nth(3);
  if (await item.count()) await item.click();
  await page.mouse.move(0, 0);
  await shoot(page, join(OUT, pilot, theme.name, `${variant.name}--modal.jpg`));
  const modalAxe = await axe(page, '.media-library-widget-modal');

  results.cells[key] = {
    pilot,
    theme: theme.name,
    variant: variant.name,
    axe: { widget: widgetAxe, modal: modalAxe },
    capturedAt: new Date().toISOString(),
  };
  console.log(`${key}: axe ${widgetAxe.length}+${modalAxe.length} rule(s) violated`);
  await context.close();
}

const browser = await chromium.launch();
try {
  for (const pilot of pilots) {
    setPilot(pilot === 'on');
    for (const theme of themes) {
      setTheme(theme);
      for (const variant of variants) {
        await captureCell(browser, pilot, theme, variant);
      }
    }
  }
  // Proof moment 5: the author's brand registry for Olivero.
  if (pilots.includes('on') && themes.some((t) => t.name === 'olivero')) {
    execFileSync('ddev', ['ds-brand', 'on'], { cwd: ROOT, stdio: 'ignore' });
    try {
      setTheme(THEMES.find((t) => t.name === 'olivero'));
      for (const variant of VARIANTS.filter((v) => ['light', 'contrast', 'dark-contrast'].includes(v.name))) {
        await captureCell(browser, 'brand', THEMES.find((t) => t.name === 'olivero'), variant);
      }
    }
    finally {
      execFileSync('ddev', ['ds-brand', 'off'], { cwd: ROOT, stdio: 'ignore' });
    }
  }
}
finally {
  await browser.close();
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  // Leave the demo as installed: pilot on, Olivero + Default Admin, edit in frontend.
  setPilot(true);
  drush('config:set', 'system.theme', 'default', 'olivero', '-y');
  drush('config:set', 'system.theme', 'admin', 'default_admin', '-y');
  drush('config:set', 'node.settings', 'use_admin_theme', '0', '-y');
  drush('cache:rebuild');
}
