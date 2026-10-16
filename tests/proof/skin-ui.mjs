/**
 * Making a skin in the UI, without touching files (plan M7's exit): a site
 * builder starts a skin from a seed, pastes a tuned ramp, checks it (a must
 * failure for a deliberately bad step, then fixed), creates it, binds it to
 * the site and looks at a site page. A screenshot of each step, and an axe
 * scan of every UI page in light, dark and more contrast.
 *
 * Usage (site running, Advaita installed, design_system_api_ui enabled):
 *   cd tests/proof && node skin-ui.mjs [--out=<dir>]
 *
 * The skin, "Harbour" (harbour), extends advaita_paper with a blue accent.
 * Advaita is set as the default theme for the site page, so the skin shows.
 * The site is restored in `finally`: the site binding and default theme as
 * they were, the skin deleted, any draft of it removed.
 *
 * Writes <out>/<nn>-<step>.jpg, axe/<page>--<mode>.json and report.json;
 * <out> defaults to out/skin-ui.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = resolve(args.out ?? join(HERE, 'out', 'skin-ui'));
const UI = '/admin/appearance/design-system';

const SKIN = { id: 'harbour', label: 'Harbour', extends: 'advaita_paper', accent: '#1d5fa8' };

// A light accent ramp tuned outside the module (as one would with AI), step
// 1 first. BAD_STEP_11 is the deliberate mistake: text that is far too light.
const LIGHT = ['#ffffff', '#f2f6fc', '#e3ecf8', '#d2e1f4', '#bdd2ee', '#a3bfe5', '#7fa3d6', '#1d5fa8', '#1d5fa8', '#174d8a', '#1a4f8f', '#0c2a4f'];
const BAD_STEP_11 = '#8fb0dc';
const DARK = ['#0b1522', '#0f1c2e', '#14263f', '#19304f', '#1f3b60', '#284a75', '#335d91', '#6fa3e6', '#6fa3e6', '#8db8ef', '#b0cff5', '#dce9fb'];

const MODES = [
  { id: 'light', emulate: { colorScheme: 'light' } },
  { id: 'dark', emulate: { colorScheme: 'dark' } },
  { id: 'more-contrast', emulate: { colorScheme: 'light', contrast: 'more' } },
];

function drush(...cmd) {
  return execFileSync('ddev', ['drush', ...cmd], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function removeSkin() {
  drush('php:eval', `$s = \\Drupal::entityTypeManager()->getStorage('design_system_skin')->load('${SKIN.id}'); if ($s) { $s->delete(); }`);
  // Drafts live in the private tempstore of the person who made them.
  drush('sql:query', "DELETE FROM key_value_expire WHERE collection = 'tempstore.private.design_system_api_ui'");
}

async function axe(page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
}

const report = { generated: new Date().toISOString(), skin: SKIN, steps: [], axe: {}, site: {} };
let step = 0;
async function shot(page, name, note, target) {
  step += 1;
  const file = `${String(step).padStart(2, '0')}-${name}.jpg`;
  await page.mouse.move(0, 0);
  const options = { path: join(OUT, file), type: 'jpeg', quality: 72, animations: 'disabled', caret: 'hide', fullPage: !target };
  if (target) await target.screenshot(options);
  else await page.screenshot(options);
  const messages = await page.locator('[data-drupal-messages] [role="alert"], [data-drupal-messages] [role="status"], .messages').allInnerTexts();
  report.steps.push({ step, file, note, url: page.url().replace(BASE, ''), messages: messages.map((m) => m.trim().slice(0, 600)) });
  console.log(`${file}: ${note}`);
}

async function pasteRamp(page, ramp, context, colors) {
  const details = page.locator('details', { has: page.locator('textarea[name="paste[colors]"]') });
  if (!(await details.getAttribute('open') !== null)) await details.locator('summary').click();
  await page.selectOption('select[name="paste[ramp]"]', ramp);
  await page.selectOption('select[name="paste[context]"]', context);
  await page.fill('textarea[name="paste[colors]"]', colors.map((c, i) => `${i + 1}: ${c}`).join('\n'));
}

mkdirSync(join(OUT, 'axe'), { recursive: true });
const original = {
  site: JSON.parse(drush('config:get', 'design_system_api.binding', 'site', '--format=json'))['design_system_api.binding:site'],
  theme: drush('config:get', 'system.theme', 'default', '--format=string'),
};
report.restore = original;
removeSkin();
drush('config:set', 'system.theme', 'default', 'advaita', '-y');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(drush('user:login', '--uri=' + BASE));

  // 1. The skins list.
  await page.goto(BASE + UI + '/skins', { waitUntil: 'networkidle' });
  await shot(page, 'skins', 'The skins list: provider, chain, use, checks');

  // 2. A skin from a seed.
  await page.getByRole('link', { name: 'Add a skin from a seed' }).click();
  await page.fill('input[name="label"]', SKIN.label);
  await page.waitForFunction(() => document.querySelector('input[name="id"]')?.value === 'harbour');
  await page.selectOption('select[name="extends"]', SKIN.extends);
  await page.fill('input[name="accent"]', SKIN.accent);
  await shot(page, 'seed', 'Seed form: label, parent, accent seed');
  await page.getByRole('button', { name: 'Start the draft' }).click();
  await page.waitForURL(`**${UI}/skins/${SKIN.id}/edit`);
  await shot(page, 'draft', 'The draft in the editor: the parent palette copied, the seed as accent-9');

  // 3. Paste a tuned light accent ramp, with a bad step 11.
  await pasteRamp(page, 'accent', 'base', LIGHT.map((c, i) => (i === 10 ? BAD_STEP_11 : c)));
  await shot(page, 'paste', 'Paste a ramp: twelve lines, step 11 deliberately too light', page.locator('details', { has: page.locator('textarea[name="paste[colors]"]') }));
  await page.getByRole('button', { name: 'Apply ramp' }).click();
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.locator('.ds-check-results').first().waitFor();
  const must = await page.locator('tr.ds-check--must').allInnerTexts();
  report.mustBeforeFix = must;
  await shot(page, 'check-must', `Check: ${must.length} must failure(s), the bad step named; nothing saved`);
  if (!must.some((row) => row.includes('palette.accent-11'))) throw new Error('Expected a must failure on palette.accent-11.');

  // 4. Fix the step, add a tuned dark ramp, check again.
  await pasteRamp(page, 'accent', 'base', LIGHT);
  await page.getByRole('button', { name: 'Apply ramp' }).click();
  await pasteRamp(page, 'accent', 'mode=dark', DARK);
  await page.getByRole('button', { name: 'Apply ramp' }).click();
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.locator('.ds-check-results').first().waitFor();
  report.mustAfterFix = await page.locator('tr.ds-check--must').count();
  await shot(page, 'check-pass', `Check after the fix: ${report.mustAfterFix} must failure(s)`);
  if (report.mustAfterFix) throw new Error('The fixed skin still fails a must check.');

  // 5. Create it: should results are shown as warnings.
  await page.getByRole('button', { name: 'Create skin' }).click();
  await page.getByText('Created skin Harbour.').waitFor();
  await shot(page, 'created', 'Created; its should results shown as warnings');

  // 6. The palette view.
  await page.getByRole('link', { name: 'Palette', exact: true }).click();
  await page.waitForURL(`**/skins/${SKIN.id}/palette`);
  await shot(page, 'palette', 'Palette view: light and dark side by side, contrast pairs per mode');

  // 7. Bind it to the site.
  await page.goto(BASE + UI + '/binding', { waitUntil: 'networkidle' });
  await page.selectOption('select[name="site[skin]"]', SKIN.id);
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.getByText('Not saved yet.').waitFor();
  await shot(page, 'binding-check', 'Binding: the site bound to harbour, checked before saving');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Saved the binding').waitFor();
  await shot(page, 'binding-saved', 'Binding saved, with its check results');

  // 8. A site page in the new skin, light and dark.
  for (const mode of MODES.slice(0, 2)) {
    await page.emulateMedia({ colorScheme: mode.emulate.colorScheme });
    await page.goto(BASE + '/node/3', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const skinCss = await page.locator('link[data-design-system-skin]').evaluateAll((links) => links.map((l) => ({ skin: l.dataset.designSystemSkin, context: l.dataset.designSystemContext })));
    const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ds-color-action-primary').trim());
    report.site[mode.id] = { skinCss, actionPrimary: primary, axe: await axe(page) };
    await shot(page, `site-${mode.id}`, `Landing page (Advaita) in ${mode.id}: --ds-color-action-primary ${primary}`, page.locator('body'));
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await context.close();

  // 9. axe on every UI page, in light, dark and more contrast.
  const pages = {
    skins: UI + '/skins',
    seed: UI + '/skins/add',
    editor: UI + `/skins/${SKIN.id}/edit`,
    palette: UI + `/skins/${SKIN.id}/palette`,
    binding: UI + '/binding',
    themes: UI,
  };
  for (const mode of MODES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true, ...mode.emulate });
    const p = await ctx.newPage();
    await p.goto(drush('user:login', '--uri=' + BASE));
    for (const [name, path] of Object.entries(pages)) {
      await p.goto(BASE + path, { waitUntil: 'networkidle' });
      if (name === 'editor') {
        // Check, so the results tables are scanned too.
        await p.getByRole('button', { name: 'Check', exact: true }).click();
        await p.locator('.ds-check-results').first().waitFor();
      }
      const violations = await axe(p);
      report.axe[`${name}--${mode.id}`] = violations.length;
      writeFileSync(join(OUT, 'axe', `${name}--${mode.id}.json`), JSON.stringify(violations, null, 1));
      console.log(`axe ${name} ${mode.id}: ${violations.length} rule(s) violated`);
    }
    await ctx.close();
  }
}
finally {
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
  const site = JSON.stringify(original.site ?? { skin: 'theme', dark: null, contrast: null, mode: 'follow' });
  drush('php:eval', `\\Drupal::configFactory()->getEditable('design_system_api.binding')->set('site', json_decode('${site}', TRUE))->save();`);
  removeSkin();
  drush('config:set', 'system.theme', 'default', original.theme || 'olivero', '-y');
  console.log(`Restored: site bound to ${original.site?.skin ?? 'theme'}, default theme ${original.theme}, skin ${SKIN.id} removed.`);
}
