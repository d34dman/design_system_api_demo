/**
 * Two design systems on real pages: measures how much CSS leaks across region
 * boundaries under each approach (ds_scope_poc test module).
 *
 * Usage (site running, POC on: ddev ds-scope-poc on):
 *   cd tests/proof && npm run regions [-- --approaches=none,systems] [--scenarios=r1a,r4] [--merge]
 *
 * For every scenario × approach: open the page, perform its steps, and read 31
 * computed properties of every element, grouped by the region it belongs to
 * (nearest [data-ds-system] or [data-ds-boundary]). The reference is the same
 * page under approach "ref" (tokens per region, no fence, no scoping, CSS
 * files served one by one) with the other system's stylesheets disabled:
 * admin regions and boundaries without the site's CSS, site regions without
 * the admin CSS. Same markup both times, so elements match one to one; a
 * structure mismatch is reported instead of compared.
 *
 * Each approach also gets a visual score (regions-visual.mjs): an approach can
 * stop every leak and still leave the page broken.
 *
 * Writes out/regions/report.json, out/regions/<scenario>--<approach>.jpg (the
 * focus element) and <scenario>--<approach>--window.jpg (the browser window).
 * Leaves the site on approach "none", Olivero, Media Library as boundary.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { readVisual, contrast, score } from './regions-visual.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'out', 'regions');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const SYSTEMS = JSON.parse(readFileSync(join(ROOT, 'web/modules/custom/ds_scope_poc/systems.json'), 'utf8'));
delete SYSTEMS._comment;

const APPROACHES = ['none', 'fence', 'fence-id', 'systems', 'layers'];

async function openMediaLibrary(page) {
  await page.locator('.js-media-library-open-button').first().click();
  await page.locator('.media-library-widget-modal').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle');
}

async function openSectionSettings(page) {
  // The section's Configure link belongs to the builder (admin) and opens the
  // off-canvas dialog. (A block's contextual menu needs a visible block, which
  // the scoped approach can collapse: a finding, measured in r4.)
  await page.locator('.layout-builder__link--configure').first().click();
  await page.locator('.ui-dialog-off-canvas').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle');
}

export const SCENARIOS = [
  { id: 'r1a', title: 'Node edit form, Media Library as a boundary', nesting: 'site › boundary (widget, dialog)', theme: 'olivero', ml: 'boundary', path: '/node/1/edit', steps: openMediaLibrary, shot: '.media-library-widget-modal' },
  { id: 'r1b', title: 'Node edit form, Media Library as admin UI', nesting: 'site › admin (widget, dialog)', theme: 'olivero', ml: 'admin', path: '/node/1/edit', steps: openMediaLibrary, shot: '.media-library-widget-modal' },
  { id: 'r2a', title: 'Same, hostile theme, as a boundary', nesting: 'site › boundary', theme: 'ds_hostile', ml: 'boundary', path: '/node/1/edit', steps: openMediaLibrary, shot: '.media-library-widget-modal' },
  { id: 'r2b', title: 'Same, hostile theme, as admin UI', nesting: 'site › admin', theme: 'ds_hostile', ml: 'admin', path: '/node/1/edit', steps: openMediaLibrary, shot: '.media-library-widget-modal' },
  { id: 'r3', title: 'Navigation on a frontend page, hostile theme', nesting: 'site › admin', theme: 'ds_hostile', ml: 'boundary', path: '/node/1', shot: null },
  { id: 'r4', title: 'Layout Builder, hostile theme', nesting: 'site › admin › site › admin', theme: 'ds_hostile', ml: 'boundary', path: '/node/1/layout', shot: '#layout-builder' },
  { id: 'r5', title: 'Layout Builder with section settings in the off-canvas dialog', nesting: 'site › admin (off-canvas, core reset)', theme: 'ds_hostile', ml: 'boundary', path: '/node/1/layout', steps: openSectionSettings, shot: '.ui-dialog-off-canvas' },
  { id: 'r6', title: 'Node edit form in Arabic (RTL), hostile theme', nesting: 'site › admin, dir="rtl"', theme: 'ds_hostile', ml: 'admin', path: '/ar/node/1/edit', steps: openMediaLibrary, shot: '.media-library-widget-modal' },
  { id: 'r7', title: 'Dark Media Library dialog on a light page', nesting: 'site › admin, data-ds-mode="dark" on the dialog', theme: 'olivero', ml: 'admin', path: '/node/1/edit', steps: async (page) => { await openMediaLibrary(page); await page.evaluate(() => document.querySelector('.media-library-widget-modal').setAttribute('data-ds-mode', 'dark')); }, shot: '.media-library-widget-modal' },
];

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const approaches = args.approaches ? args.approaches.split(',') : APPROACHES;
const scenarios = args.scenarios ? SCENARIOS.filter((s) => args.scenarios.split(',').includes(s.id)) : SCENARIOS;

function ddev(...cmd) {
  return execFileSync('ddev', cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

let state = { theme: null, ml: null, approach: null };
function setUp(scenario, approach) {
  if (state.theme !== scenario.theme) {
    ddev('drush', 'config:set', 'system.theme', 'default', scenario.theme, '-y');
    state.approach = null;
  }
  if (state.ml !== scenario.ml) {
    ddev('ds-scope', `ml-${scenario.ml}`);
  }
  if (state.approach !== approach || state.theme !== scenario.theme || state.ml !== scenario.ml) {
    ddev('ds-scope', approach);
  }
  state = { theme: scenario.theme, ml: scenario.ml, approach };
}

/* Runs in the page: computed styles per region, plus a structure signature. */
function readRegions() {
  const PROPS = ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style',
    'line-height', 'letter-spacing', 'text-transform', 'text-decoration-line', 'text-decoration-style',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-top-width', 'border-top-style', 'border-top-color',
    'border-left-width', 'border-left-style', 'border-left-color', 'border-top-left-radius',
    'list-style-type', 'box-sizing', 'filter', 'display', 'accent-color'];
  const SKIP = new Set(['script', 'style', 'link', 'meta', 'noscript', 'template', 'title', 'head', 'br']);
  const SEL = '[data-ds-system],[data-ds-boundary]';
  const label = (el) => el.localName + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
  return [...document.querySelectorAll(SEL)].map((region) => {
    const as = region.hasAttribute('data-ds-boundary') ? 'boundary' : region.getAttribute('data-ds-system');
    const els = [region, ...region.querySelectorAll('*')].filter((el) => !SKIP.has(el.localName) && !el.closest('svg *, head') && el.closest(SEL) === region);
    return {
      as,
      label: label(region),
      elements: els.map((el) => {
        const cs = getComputedStyle(el);
        const props = el.localName === 'input' ? PROPS.concat(['width', 'height']) : PROPS;
        return { label: label(el), style: Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])) };
      }),
    };
  });
}

/* Runs in the page: disable one system's stylesheets (unaggregated files). */
function disableSystem([prefixes, on]) {
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    const path = new URL(link.href).pathname.replace(/^\//, '');
    if (prefixes.some((p) => path.startsWith(p))) link.disabled = on;
  }
}

async function open(context, scenario) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + scenario.path, { waitUntil: 'networkidle' });
  if (scenario.steps) await scenario.steps(page);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
  return { page, errors };
}

function compare(got, refSite, refAdmin) {
  const result = { regions: [], mismatch: null };
  if (got.length !== refSite.length || got.some((r, i) => r.label !== refSite[i].label || r.elements.length !== refSite[i].elements.length)) {
    result.mismatch = { got: got.map((r) => `${r.label} (${r.elements.length})`), ref: refSite.map((r) => `${r.label} (${r.elements.length})`) };
    return result;
  }
  got.forEach((region, i) => {
    // Site regions are compared without the admin CSS; admin regions and
    // boundaries without the site's.
    const want = (region.as === 'site' ? refAdmin : refSite)[i];
    const diffs = [];
    region.elements.forEach((el, j) => {
      const w = want.elements[j];
      for (const [prop, value] of Object.entries(el.style)) {
        if (w.style[prop] !== value) diffs.push({ el: j, label: el.label, prop, got: value, want: w.style[prop] });
      }
    });
    result.regions.push({ label: region.label, as: region.as, elements: region.elements.length, leaking: new Set(diffs.map((d) => d.el)).size, diffs });
  });
  return result;
}

mkdirSync(OUT, { recursive: true });
// --merge: keep the other scenarios of an earlier report and replace only the
// ones measured now (same approaches).
const earlier = 'merge' in args ? JSON.parse(readFileSync(join(OUT, 'report.json'), 'utf8')) : null;
const report = { base: BASE, measuredAt: new Date().toISOString(), scenarios: { ...(earlier?.scenarios ?? {}) }, approaches };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true, colorScheme: 'light' });
await (await context.newPage()).goto(ddev('drush', 'user:login', '--uri=' + BASE));

try {
  for (const scenario of scenarios) {
    const { id, title, nesting, theme, ml, path } = scenario;
    report.scenarios[id] = { title, nesting, theme, ml, path, approaches: {} };

    // References first.
    // References first, one page load each (re-enabling a disabled stylesheet
    // isn't reliable).
    setUp(scenario, 'ref');
    const reference = async (prefixes) => {
      const { page } = await open(context, scenario);
      await page.evaluate(disableSystem, [prefixes, true]);
      await page.waitForTimeout(300);
      const regions = await page.evaluate(readRegions);
      await page.close();
      return regions;
    };
    const refSite = await reference(SYSTEMS.site);
    const refAdmin = await reference(SYSTEMS.admin);

    for (const approach of approaches) {
      setUp(scenario, approach);
      const { page, errors } = await open(context, scenario);
      const got = await page.evaluate(readRegions);
      // The window first, scrolled to the top of the focus element (below
      // Navigation's top bar); then a close-up of the focus element.
      await page.evaluate((sel) => { const el = sel && document.querySelector(sel); if (el) scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - 80)); }, scenario.shot);
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(OUT, `${id}--${approach}--window.jpg`), type: 'jpeg', quality: 72, animations: 'disabled', caret: 'hide' });
      const target = scenario.shot ? page.locator(scenario.shot).first() : page;
      await target.screenshot({ path: join(OUT, `${id}--${approach}.jpg`), type: 'jpeg', quality: 72, animations: 'disabled', caret: 'hide' });
      const result = compare(got, refSite, refAdmin);
      result.errors = errors;
      const focus = scenario.shot ?? 'body';
      result.visual = await page.evaluate(readVisual, focus);
      result.visual.contrast = await contrast(page, focus);
      result.visualScore = score(result.visual);
      report.scenarios[id].approaches[approach] = result;
      const leaking = result.mismatch ? 'structure mismatch' : result.regions.reduce((n, r) => n + r.leaking, 0) + ' leaking element(s)';
      console.log(`${id} ${approach}: ${leaking}, visual ${result.visualScore} ${JSON.stringify(Object.fromEntries(Object.entries(result.visual).filter(([, c]) => c).map(([k, c]) => [k, `${c.ok}/${c.total}`])))}${errors.length ? `, ${errors.length} JS error(s)` : ''}`);
      await page.close();
      writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    }
  }
}
finally {
  await browser.close();
  ddev('drush', 'config:set', 'system.theme', 'default', 'olivero', '-y');
  ddev('ds-scope', 'ml-boundary');
  ddev('ds-scope', 'none');
}
