/**
 * Core's controls under Advaita, drawn by Design System API: Patterns: forms,
 * tables and details in light, dark, more contrast and forced colours, with an
 * axe scan per shot. Run once before and once after a change to the patterns
 * and compare the two folders.
 *
 * Usage (Advaita as the admin and default theme, as advaita.mjs sets it):
 *   cd tests/proof && node patterns-ui-kit.mjs --phase=before|after [--out=d66-m3]
 *
 * Writes out/<out>/<phase>/<page>--<variant>.jpg and report.json (axe
 * violations per shot). Changes no configuration: the mode and contrast are
 * set on <html> in the page, as a saved preference would.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const PHASE = args.phase ?? 'now';
const OUT = join(HERE, 'out', args.out ?? 'patterns-ui-kit', PHASE);

// Forms, tables and details: core's own output, nothing the theme drew itself.
export const PAGES = [
  { id: 'node-add', path: '/node/add/article', kind: 'form', note: 'Fields, a file field, checkboxes, Save and Preview, details in the sidebar' },
  { id: 'site-information', path: '/admin/config/system/site-information', kind: 'form', note: 'A settings form with its primary button' },
  { id: 'node-delete', path: '/node/2/delete', kind: 'form', note: 'A delete confirmation: the danger button' },
  { id: 'content', path: '/admin/content', kind: 'table', note: 'Views table, exposed filters, bulk form, dropbuttons' },
  { id: 'people', path: '/admin/people', kind: 'table', note: 'Views table with checkboxes' },
  { id: 'blocks', path: '/admin/structure/block', kind: 'table', note: 'Tabledrag table with selects and buttons' },
  { id: 'performance', path: '/admin/config/development/performance', kind: 'details', note: 'Details groups on a settings form', open: true },
  { id: 'node-edit', path: '/node/2/edit', kind: 'details', note: 'The node form sidebar: details, one opened', open: true },
];

export const VARIANTS = [
  { id: 'light', mode: 'light' },
  { id: 'dark', mode: 'dark', colorScheme: 'dark' },
  { id: 'more-contrast', mode: 'light', contrast: 'more' },
  { id: 'forced-colors', mode: 'light', forcedColors: 'active' },
];

function ddev(...cmd) {
  return execFileSync('ddev', cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function axe(page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }));
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const report = { phase: PHASE, generated: new Date().toISOString(), shots: {} };

try {
  for (const v of VARIANTS) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      ignoreHTTPSErrors: true,
      colorScheme: v.colorScheme ?? 'light',
      forcedColors: v.forcedColors ?? 'none',
    });
    const page = await context.newPage();
    await page.goto(ddev('drush', 'user:login', '--uri=' + BASE));
    for (const p of PAGES) {
      await page.goto(BASE + p.path, { waitUntil: 'networkidle' });
      await page.evaluate(({ mode, contrast }) => {
        const root = document.documentElement;
        root.setAttribute('data-ds-mode', mode);
        if (contrast) {
          root.setAttribute('data-ds-contrast', contrast);
        }
        else {
          root.removeAttribute('data-ds-contrast');
        }
      }, v);
      if (p.open) {
        // Open every details group, so the content shows too.
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
      }
      await page.mouse.move(0, 0);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const file = `${p.id}--${v.id}.jpg`;
      await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 80, fullPage: true });
      const violations = await axe(page);
      const facts = await page.evaluate(() => ({
        buttons: document.querySelectorAll('.ds-button').length,
        uiKitButtons: document.querySelectorAll('.ui-kit-button').length,
        tables: document.querySelectorAll('table.ds-table').length,
        uiKitTables: document.querySelectorAll('table.ui-kit-table, .ui-kit-table table').length,
        details: document.querySelectorAll('details').length,
        uiKitDetails: document.querySelectorAll('details.ui-kit-details').length,
      }));
      report.shots[`${p.id}--${v.id}`] = { page: p.id, variant: v.id, path: p.path, kind: p.kind, file, ...facts, violations };
      console.log(PHASE, p.id, v.id, 'axe', violations.length, violations.map((x) => `${x.id}×${x.nodes}`).join(' '));
    }
    await context.close();
  }
}
finally {
  await browser.close();
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
}
