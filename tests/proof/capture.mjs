/**
 * Captures the proof matrix: theme × context × view, with the Media Library
 * pilot off ("before") and on ("after"), plus an axe scan of each cell
 * (WCAG 2.0–2.2 A and AA). Theme cells bind both contexts to the theme.
 * Then the chrome cells (CHROME): the admin chrome on the Canvas UI skin in
 * light, dark, more contrast from the switch, and forced colours.
 *
 * Usage (from the demo root, site running):
 *   cd tests/proof && npm install && npm run capture [-- --pilot=on|off|both] [--themes=a,b] [--variants=a,b] [--chrome=off|only]
 *
 * Writes out/<pilot>/<theme>/<variant>--<view>.jpg, out/chrome/<variant>.jpg
 * and out/results.json. Exits 1 when a cell captured in this run with the
 * contract in force has an axe violation the skin doesn't declare (B8). The site is left as it was found: themes, bindings, user
 * 1's display preferences; the pilot on.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { CHROME, CHROME_VARIANTS, DEPARTURES, THEMES, VARIANTS, VIEWS } from './capture-config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'out');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const pilots = args.chrome === 'only' ? [] : args.pilot === 'on' ? ['on'] : args.pilot === 'off' ? ['off'] : ['off', 'on'];
const chrome = args.chrome !== 'off';
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
  bindBoth('theme', 'theme');
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

async function axe(page, include, forced = false) {
  try {
    let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
    // Under forced colours the system palette draws text and backgrounds;
    // axe reads the author's colours there, so its contrast check is moot.
    if (forced) builder = builder.disableRules(['color-contrast']);
    for (const selector of [include].flat()) builder = builder.include(selector);
    const result = await builder.analyze();
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')), summary: v.nodes[0]?.failureSummary?.slice(0, 240) }));
  }
  catch (e) {
    return [{ id: 'axe-error', impact: 'unknown', help: String(e.message).slice(0, 200), nodes: 0 }];
  }
}

// The state to restore: themes, bindings, user 1's display preferences.
const php = (code) => drush('php:eval', code);
const before = {
  default: drush('config:get', 'system.theme', 'default', '--format=string'),
  admin: drush('config:get', 'system.theme', 'admin', '--format=string'),
  useAdminTheme: php("echo (int) Drupal::config('node.settings')->get('use_admin_theme');"),
  binding: php("echo base64_encode(serialize(Drupal::config('design_system_api.binding')->getRawData()));"),
  preferences: php("echo base64_encode(serialize(Drupal::service('user.data')->get('design_system_api', 1, 'preferences')));"),
};
const clearPreferences = () => php("Drupal::service('user.data')->delete('design_system_api', 1, 'preferences');");
clearPreferences();

function bindBoth(site, chromeSkin) {
  drush('ds:bind', 'site', site);
  drush('ds:bind', 'chrome', chromeSkin);
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
  const forced = variant.emulate.forcedColors === 'active';
  const widgetAxe = await axe(page, '.js-media-library-widget', forced);

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
  const modalAxe = await axe(page, '.media-library-widget-modal', forced);

  results.cells[key] = {
    pilot,
    theme: theme.name,
    variant: variant.name,
    axe: { widget: widgetAxe, modal: modalAxe },
    capturedAt: new Date().toISOString(),
  };
  captured.push(key);
  console.log(`${key}: axe ${widgetAxe.length}+${modalAxe.length} rule(s) violated`);
  await context.close();
}

// Violations a skin declares (DEPARTURES in capture-config.mjs) are kept
// in the results, marked, and don't fail the run.
function departures(key, violations) {
  return violations.map((v) => {
    const d = DEPARTURES.find((x) => key.startsWith(x.cell) && !(x.except ?? []).some((e) => key.includes(e)) && x.rule === v.id && v.targets.every((t) => t.includes(x.target)));
    return d ? { ...v, departure: d.reason } : v;
  });
}

// Keys captured in this run, for the exit code.
const captured = [];

async function captureChrome(browser, variant) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, ignoreHTTPSErrors: true, ...variant.emulate });
  await login(context);
  const page = await context.newPage();
  await page.goto(BASE + CHROME.path, { waitUntil: 'networkidle' });
  if (variant.contrast) {
    const option = page.locator(`.ds-chrome-top-bar [data-ds-preference="contrast"] input[value="${variant.contrast}"]`);
    const saved = page.waitForResponse((r) => r.url().includes('/design-system/preferences') && r.request().method() === 'POST');
    await option.check();
    if (!(await saved).ok()) throw new Error('The switch could not save the choice.');
    await page.reload({ waitUntil: 'networkidle' });
    const applied = await page.evaluate(() => document.documentElement.getAttribute('data-ds-contrast'));
    if (applied !== variant.contrast) throw new Error(`The switch did not save contrast=${variant.contrast} (got ${applied}).`);
  }
  await page.mouse.move(0, 0);
  const key = `chrome/${CHROME.bindings.chrome}/${variant.name}`;
  await shoot(page, join(OUT, 'chrome', `${variant.name}.jpg`));
  // Keyboard focus on the first sidebar link, for the focus ring.
  await page.locator(`${CHROME.regions[0]} a`).first().focus();
  await page.keyboard.press('Shift');
  await shoot(page, join(OUT, 'chrome', `${variant.name}--focus.jpg`), page.locator(CHROME.regions[0]));
  const chromeAxe = departures(key, await axe(page, CHROME.regions, variant.emulate.forcedColors === 'active'));
  results.cells[key] = { pilot: 'chrome', theme: CHROME.bindings.chrome, variant: variant.name, axe: { chrome: chromeAxe }, capturedAt: new Date().toISOString() };
  captured.push(key);
  console.log(`${key}: axe ${chromeAxe.length} rule(s) violated`);
  clearPreferences();
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
  if (chrome) {
    setPilot(true);
    drush('config:set', 'system.theme', 'default', CHROME.theme, '-y');
    drush('config:set', 'system.theme', 'admin', CHROME.theme, '-y');
    bindBoth(CHROME.bindings.site, CHROME.bindings.chrome);
    drush('cache:rebuild');
    for (const variant of CHROME_VARIANTS) {
      await captureChrome(browser, variant);
    }
  }
}
finally {
  await browser.close();
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  // Leave the demo as it was found, with the pilot on.
  setPilot(true);
  drush('config:set', 'system.theme', 'default', before.default, '-y');
  drush('config:set', 'system.theme', 'admin', before.admin, '-y');
  drush('config:set', 'node.settings', 'use_admin_theme', before.useAdminTheme, '-y');
  php(`Drupal::configFactory()->getEditable('design_system_api.binding')->setData(unserialize(base64_decode('${before.binding}')))->save();`);
  php(`$v = unserialize(base64_decode('${before.preferences}')); if ($v !== NULL) { Drupal::service('user.data')->set('design_system_api', 1, 'preferences', $v); }`);
  drush('cache:rebuild');
}

// B8: a violation in a cell of this run fails it, where the contract is in
// force (pilot on, brand, chrome). Pilot-off cells show the themes' own CSS,
// the "before"; their violations are reported, not failed.
const failing = captured.filter((key) => !key.startsWith('off/') && Object.values(results.cells[key].axe).some((list) => list.some((v) => !v.departure)));
if (failing.length) {
  console.error(`\n${failing.length} cell(s) with axe violations: ${failing.join(', ')}`);
  process.exitCode = 1;
}
