/**
 * Builds one self-contained page from out/regions/report.json and its
 * screenshots (embedded), for publishing as an artifact.
 *
 *   npm run regions:gallery [-- --out=<file>] [--findings=<file.html>]
 *
 * --findings: an HTML fragment with the write-up, inserted above the scenarios.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'out', 'regions');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = args.out ?? join(DIR, 'index.html');
const report = JSON.parse(readFileSync(join(DIR, 'report.json'), 'utf8'));
const findings = args.findings && existsSync(args.findings) ? readFileSync(args.findings, 'utf8') : '';

const LABELS = { none: 'No boundary', fence: 'Reset fence', 'fence-id': 'Reset fence, ID strength', systems: 'Scoped systems' };
const DESCS = {
  none: 'Today: the page’s own tokens, theme and module CSS as written.',
  fence: 'Tokens per region and an unlayered all: revert on every marked region’s descendants, at one-attribute strength (seanB’s admin-section).',
  'fence-id': 'The same reset at ID strength, like core’s off-canvas reset.',
  systems: 'Tokens per region, and each design system’s CSS wrapped in @scope by Drupal when it aggregates CSS.',
};
const approaches = report.approaches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (file) => existsSync(file) ? `data:image/jpeg;base64,${readFileSync(file).toString('base64')}` : null;

function totals(result) {
  if (!result || result.mismatch) return null;
  return result.regions.reduce((t, r) => ({ leaking: t.leaking + r.leaking, elements: t.elements + r.elements }), { leaking: 0, elements: 0 });
}

function topProps(diffs, n = 4) {
  const c = {};
  diffs.forEach((d) => { c[d.prop] = (c[d.prop] ?? 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map(([p]) => p);
}

const ids = Object.keys(report.scenarios);
const matrix = `<table class="matrix"><thead><tr><th scope="col">Scenario</th>${approaches.map((a) => `<th scope="col">${LABELS[a]}</th>`).join('')}</tr></thead><tbody>${ids.map((id) => {
  const s = report.scenarios[id];
  return `<tr><th scope="row"><a href="#${id}">${esc(s.title)}</a><small>${esc(s.nesting)} · ${esc(s.theme)}</small></th>${approaches.map((a) => {
    const t = totals(s.approaches[a]);
    if (!t) return '<td class="na">structure differs</td>';
    const level = t.leaking === 0 ? 'ok' : t.leaking <= 0.05 * t.elements ? 'warn' : 'bad';
    return `<td class="${level}"><b>${t.leaking}</b><small>of ${t.elements}</small></td>`;
  }).join('')}</tr>`;
}).join('')}</tbody></table>`;

const sections = ids.map((id) => {
  const s = report.scenarios[id];
  const panels = approaches.map((a, i) => {
    const r = s.approaches[a];
    const shot = img(join(DIR, `${id}--${a}.jpg`));
    const rows = r?.mismatch ? '<p>The page’s structure differed from the reference, so it wasn’t compared.</p>' : `<div class="scroll"><table class="regions"><thead><tr><th>Region</th><th>System</th><th class="num">Leaking</th><th>Most affected</th></tr></thead><tbody>${r.regions.map((g) => `<tr><td><code>${esc(g.label)}</code></td><td><span class="tag ${g.as}">${g.as}</span></td><td class="num ${g.leaking ? 'bad-t' : 'ok-t'}">${g.leaking} / ${g.elements}</td><td>${topProps(g.diffs).map((p) => `<code>${p}</code>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>`;
    return `<div class="panel" data-approach="${a}"${i === approaches.length - 1 ? '' : ' hidden'}><p class="desc">${DESCS[a]}</p>${shot ? `<img src="${shot}" alt="${esc(s.title)}, ${LABELS[a]}" loading="lazy">` : ''}${rows}</div>`;
  }).join('');
  return `<section class="scenario" id="${id}"><header><h3>${esc(s.title)}</h3><p><span class="chip">${esc(s.nesting)}</span> <code>${esc(s.path)}</code> · theme <code>${esc(s.theme)}</code> · Media Library as <code>${esc(s.ml)}</code></p></header>
  <div class="tabs" role="tablist">${approaches.map((a, i) => `<button type="button" role="tab" aria-selected="${i === approaches.length - 1}" data-approach="${a}">${LABELS[a]}</button>`).join('')}</div>${panels}</section>`;
}).join('\n');

const page = `<title>Two Design Systems</title>
<style>
/* Layout: one reading column; a results matrix first, then one card per scenario with approach tabs. */
:root {
  --bg: #f6f7f5; --surface: #ffffff; --fg: #1b1d1a; --soft: #5b605a; --line: #d9ddd6;
  --accent: #2346c9; --ok: #17733f; --ok-bg: #e4f3ea; --warn: #8a5a00; --warn-bg: #fbf1dc; --bad: #b3261e; --bad-bg: #fbe9e7;
  --site: #9a3412; --admin: #2346c9; --boundary: #6d28d9;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #141614; --surface: #1d201d; --fg: #e9ece8; --soft: #a5aba3; --line: #363b35;
    --accent: #9db2ff; --ok: #6fd69a; --ok-bg: #133222; --warn: #f2c46b; --warn-bg: #3a2c0e; --bad: #ff8a80; --bad-bg: #3d1714;
    --site: #fdba74; --admin: #9db2ff; --boundary: #c4b5fd; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #141614; --surface: #1d201d; --fg: #e9ece8; --soft: #a5aba3; --line: #363b35;
  --accent: #9db2ff; --ok: #6fd69a; --ok-bg: #133222; --warn: #f2c46b; --warn-bg: #3a2c0e; --bad: #ff8a80; --bad-bg: #3d1714;
  --site: #fdba74; --admin: #9db2ff; --boundary: #c4b5fd; color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 15px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-inline-size: 1120px; margin-inline: auto; padding-inline: 16px; padding-block: 32px 64px; }
h1 { font-size: 1.8rem; line-height: 1.2; margin: 0 0 .4rem; text-wrap: balance; letter-spacing: -.01em; }
h2 { font-size: 1.15rem; margin: 2.2rem 0 .8rem; }
h3 { font-size: 1.05rem; margin: 0; text-wrap: balance; }
p { max-inline-size: 72ch; }
.lede { color: var(--soft); margin-block: 0 1.2rem; }
a { color: var(--accent); }
code { font-family: var(--mono); font-size: .84em; overflow-wrap: anywhere; }
.scroll { overflow-x: auto; }
.matrix { border-collapse: collapse; inline-size: 100%; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; font-variant-numeric: tabular-nums; }
.matrix th, .matrix td { padding: 9px 12px; border-block-end: 1px solid var(--line); text-align: start; vertical-align: top; }
.matrix thead th { font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: var(--soft); }
.matrix tbody th { font-weight: 600; min-inline-size: 15rem; }
.matrix small { display: block; font-weight: 400; color: var(--soft); font-size: .8rem; }
.matrix td b { font-size: 1.1rem; }
.matrix td.ok { background: var(--ok-bg); color: var(--ok); }
.matrix td.warn { background: var(--warn-bg); color: var(--warn); }
.matrix td.bad { background: var(--bad-bg); color: var(--bad); }
.matrix td.na { color: var(--soft); font-size: .85rem; }
.matrix tbody tr:last-child > * { border-block-end: 0; }
.legend { color: var(--soft); font-size: .88rem; }
.findings { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 4px 20px 12px; }
.findings li { margin-block: .5rem; max-inline-size: 80ch; }
.scenario { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-block: 16px; }
.scenario header p { margin: .3rem 0 .8rem; color: var(--soft); font-size: .9rem; }
.chip { font-size: .8rem; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--fg); }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-block-end: 10px; }
.tabs button { font: inherit; font-size: .88rem; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--fg); cursor: pointer; }
.tabs button[aria-selected="true"] { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.tabs button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.panel img { display: block; max-inline-size: 100%; block-size: auto; border: 1px solid var(--line); border-radius: 6px; margin-block: 8px 12px; }
.desc { color: var(--soft); font-size: .9rem; margin: 0; }
.regions { border-collapse: collapse; inline-size: 100%; font-size: .85rem; font-variant-numeric: tabular-nums; }
.regions th, .regions td { padding: 5px 8px; border-block-start: 1px solid var(--line); text-align: start; vertical-align: top; }
.regions .num { text-align: end; white-space: nowrap; }
.bad-t { color: var(--bad); font-weight: 600; } .ok-t { color: var(--ok); }
.tag { font: 600 .72rem var(--mono); padding: 1px 6px; border-radius: 4px; border: 1px solid currentColor; }
.tag.site { color: var(--site); } .tag.admin { color: var(--admin); } .tag.boundary { color: var(--boundary); }
footer { color: var(--soft); font-size: .88rem; margin-block-start: 2.5rem; }
</style>
<main>
  <h1>Two design systems on real Drupal pages</h1>
  <p class="lede">The site’s theme and Drupal’s admin UI on the same page, nested every way core allows today:
  the Media Library widget and dialog in a frontend node form, Navigation on a frontend page, and Layout Builder (site page ›
  builder › page content › contextual links). Each page is measured under four ways of keeping one design system’s CSS
  out of the other. For the Media Library review, <a href="https://www.drupal.org/project/design_system_api/issues/3627984">#3627984</a>,
  following seanB’s suggestion; background in core issue <a href="https://www.drupal.org/project/drupal/issues/2195695">#2195695</a>.</p>

  <h2>Leaking elements per page and approach</h2>
  <div class="scroll">${matrix}</div>
  <p class="legend">An element leaks when any of 31 computed properties differs from the same page with the other design system’s CSS removed. Green: none. Amber: up to 5% of the page’s elements.</p>

  ${findings}

  <h2>Pages</h2>
  ${sections}

  <footer>
    <p>Demo site: Drupal 12.0.0-beta1 with Design System API and the Media Library pilot, plus the <code>ds_scope_poc</code> test module and the <code>ds_hostile</code> test theme (Olivero with typical leaking rules). Measured in Chromium with Playwright on ${esc(report.measuredAt.slice(0, 10))}.</p>
  </footer>
</main>
<script>
document.querySelectorAll('.scenario').forEach((card) => {
  card.querySelectorAll('.tabs button').forEach((button) => button.addEventListener('click', () => {
    card.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b === button)));
    card.querySelectorAll('.panel').forEach((p) => { p.hidden = p.dataset.approach !== button.dataset.approach; });
  }));
});
</script>
`;

writeFileSync(OUT, page);
console.log(`wrote ${OUT} (${(page.length / 1024 / 1024).toFixed(1)} MB)`);
