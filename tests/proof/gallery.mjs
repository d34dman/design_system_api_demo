/**
 * Builds the proof gallery from out/ (see capture.mjs): one static page plus
 * the screenshots, in out/gallery/. Also records the CLI receipts (provenance,
 * lint) from the running demo, so the page shows real output.
 *
 * Usage: npm run gallery
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, VARIANTS, VIEWS } from './capture-config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'out');
const DEST = join(OUT, 'gallery');

const results = JSON.parse(readFileSync(join(OUT, 'results.json'), 'utf8'));

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  }
  catch (e) {
    return (e.stdout ?? '') + (e.stderr ?? '');
  }
}

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').trim();
execFileSync('ddev', ['ds-brand', 'on'], { cwd: ROOT, stdio: 'ignore' });
const receipts = {
  resolveBrand: strip(run('ddev', ['drush', 'ds:resolve', 'media-card.border', '--theme=olivero'])),
  resolveBrandDark: strip(run('ddev', ['drush', 'ds:resolve', 'media-card.border', '--theme=olivero', '--mode=dark'])),
  resolveAdmin: strip(run('ddev', ['drush', 'ds:resolve', 'media-card.border', '--theme=default_admin'])),
};
execFileSync('ddev', ['ds-brand', 'off'], { cwd: ROOT, stdio: 'ignore' });
receipts.lint = strip(run('ddev', ['ds-lint']));
receipts.registry = readFileSync(join(ROOT, 'design-system/brand/olivero.registry.yml'), 'utf8').trim();
receipts.tokens = readFileSync(join(ROOT, 'web/modules/contrib/design_system_api/modules/design_system_api_media_library/design_system_api_media_library.tokens.yml'), 'utf8').trim();

if (existsSync(DEST)) rmSync(DEST, { recursive: true });
mkdirSync(join(DEST, 'shots'), { recursive: true });
for (const pilot of ['off', 'on', 'brand']) {
  if (existsSync(join(OUT, pilot))) cpSync(join(OUT, pilot), join(DEST, 'shots', pilot), { recursive: true });
}

const data = {
  themes: THEMES,
  variants: VARIANTS.map(({ name, label }) => ({ name, label })),
  views: VIEWS,
  cells: results.cells,
  receipts,
  builtAt: new Date().toISOString(),
};

const template = readFileSync(join(HERE, 'gallery.template.html'), 'utf8');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
writeFileSync(join(DEST, 'index.html'), template.replace('/*__DATA__*/null', json));
console.log(`Gallery: ${join(DEST, 'index.html')} (${Object.keys(results.cells).length} cells)`);
