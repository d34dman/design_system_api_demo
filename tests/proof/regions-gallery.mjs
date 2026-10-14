/**
 * Builds one self-contained page from out/regions/report.json and its
 * screenshots (embedded), for publishing as an artifact.
 *
 *   npm run regions:gallery [-- --out=<file>] [--notes=<file.json>] [--findings=<file.html>]
 *
 * --notes: the reading of this run, written after looking at the screenshots:
 *   { "answer": "<html>", "scenarios": { "<id>": { "look": "<what to look at>",
 *     "approaches": { "<approach>": { "verdict": "ok|warn|bad", "caption": "<text>" } } } } }
 * --findings: an HTML fragment with the write-up, inserted after the results.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'out', 'regions');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = args.out ?? join(DIR, 'index.html');
const report = JSON.parse(readFileSync(join(DIR, 'report.json'), 'utf8'));
const notes = args.notes && existsSync(args.notes) ? JSON.parse(readFileSync(args.notes, 'utf8')) : { scenarios: {} };
const findings = args.findings && existsSync(args.findings) ? readFileSync(args.findings, 'utf8') : '';

const APPROACH = {
  none: { letter: 'A', name: 'No boundary', what: 'Today’s Drupal. The theme’s CSS and the admin CSS both apply everywhere.' },
  fence: { letter: 'B', name: 'Reset fence', what: 'Each admin area resets the styles it inherits from the theme, at one-attribute strength (seanB’s admin-section class).' },
  'fence-id': { letter: 'C', name: 'Strong reset fence', what: 'The same reset at ID strength, like core’s off-canvas dialog does.' },
  systems: { letter: 'D', name: 'Scoped design systems', what: 'Drupal wraps each design system’s CSS so it only applies inside its own areas (CSS @scope).' },
};
const VERDICT = {
  ok: { icon: '✓', word: 'Works' },
  warn: { icon: '!', word: 'Works, with flaws' },
  bad: { icon: '✕', word: 'Broken' },
};
const CHECKS = {
  visible: 'Not covered by other UI',
  readable: 'Text laid out (not collapsed)',
  controls: 'Buttons and fields styled',
  fonts: 'Fonts styled',
  contrast: 'Text contrast (axe)',
  hidden: 'Screen-reader text stays hidden',
  overlap: 'No overlapping text',
};

const approaches = report.approaches;
const ids = Object.keys(report.scenarios);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (file) => existsSync(file) ? `data:image/jpeg;base64,${readFileSync(file).toString('base64')}` : null;
const leaking = (r) => r && !r.mismatch ? r.regions.reduce((n, g) => n + g.leaking, 0) : null;
const note = (id, a) => notes.scenarios?.[id]?.approaches?.[a] ?? {};
const verdictOf = (id, a) => note(id, a).verdict ?? (report.scenarios[id].approaches[a]?.visualScore >= 90 ? 'ok' : 'bad');
const badge = (v) => `<span class="verdict ${v}"><span aria-hidden="true">${VERDICT[v].icon}</span> ${VERDICT[v].word}</span>`;

const approachCards = approaches.map((a) => `<li><span class="letter">${APPROACH[a].letter}</span><div><b>${APPROACH[a].name}</b><p>${APPROACH[a].what}</p></div></li>`).join('');

const overview = `<table class="overview"><thead><tr><th scope="col">Page</th>${approaches.map((a) => `<th scope="col"><span class="letter sm">${APPROACH[a].letter}</span> ${APPROACH[a].name}</th>`).join('')}</tr></thead><tbody>${ids.map((id) => {
  const s = report.scenarios[id];
  return `<tr><th scope="row"><a href="#${id}">${esc(s.title)}</a></th>${approaches.map((a) => `<td>${badge(verdictOf(id, a))}</td>`).join('')}</tr>`;
}).join('')}</tbody></table>`;

const numbersTable = (r) => {
  if (!r) return '';
  const checks = Object.entries(CHECKS).filter(([k]) => r.visual?.[k]?.total).map(([k, name]) => {
    const c = r.visual[k];
    const pct = Math.floor(100 * c.ok / c.total);
    return `<tr><td>${name}</td><td class="num ${pct >= 90 ? 'good' : 'poor'}">${pct}%</td><td>${(c.examples ?? []).map((e) => `<code>${esc(e)}</code>`).join('<br>')}</td></tr>`;
  }).join('');
  const regions = r.mismatch ? '<tr><td colspan="3">Structure differed from the reference; not compared.</td></tr>' : r.regions.map((g) => `<tr><td><code>${esc(g.label)}</code> <span class="tag ${g.as}">${g.as}</span></td><td class="num ${g.leaking ? 'poor' : 'good'}">${g.leaking} of ${g.elements}</td><td>${[...new Set(g.diffs.map((d) => d.prop))].slice(0, 4).map((p) => `<code>${p}</code>`).join(' ')}</td></tr>`).join('');
  return `<table class="numbers"><thead><tr><th>Check</th><th class="num">Passing</th><th>Failing, for example</th></tr></thead><tbody>${checks}</tbody>
  <thead><tr><th>Area</th><th class="num">Leaking</th><th>Properties that differ</th></tr></thead><tbody>${regions}</tbody></table>`;
};

const pages = ids.map((id) => {
  const s = report.scenarios[id];
  const look = notes.scenarios?.[id]?.look;
  const figures = approaches.map((a) => {
    const r = s.approaches[a];
    const v = verdictOf(id, a);
    const win = img(join(DIR, `${id}--${a}--window.jpg`));
    const close = img(join(DIR, `${id}--${a}.jpg`));
    const caption = note(id, a).caption ?? '';
    const l = leaking(r);
    return `<figure class="shot ${v}">
      <button type="button" class="zoom" data-window="${win ?? ''}" data-close="${close ?? ''}" data-title="${esc(`${s.title} · ${APPROACH[a].letter} ${APPROACH[a].name}`)}" data-caption="${esc(caption)}" aria-label="Enlarge: ${esc(APPROACH[a].name)}">
        ${win ? `<img src="${win}" alt="${esc(s.title)}, ${esc(APPROACH[a].name)}" loading="lazy">` : ''}
      </button>
      <figcaption>
        <span class="who"><span class="letter sm">${APPROACH[a].letter}</span> ${APPROACH[a].name}</span>
        ${badge(v)}
        <span class="cap">${esc(caption)}</span>
        <span class="nums"><span title="Elements styled by the wrong design system">${l == null ? '—' : l} leaking</span><span title="Weakest of seven visual checks">looks right ${r?.visualScore ?? '—'}/100</span></span>
      </figcaption>
    </figure>`;
  }).join('');
  return `<section class="page" id="${id}">
    <header><h3>${esc(s.title)}</h3>
    <p class="meta"><code>${esc(s.path)}</code> · theme ${s.theme === 'ds_hostile' ? 'Olivero with leaking rules added' : 'Olivero'} · ${esc(s.nesting)}</p>
    ${look ? `<p class="look"><b>Look at:</b> ${esc(look)}</p>` : ''}</header>
    <div class="shots">${figures}</div>
    <details><summary>Numbers for this page</summary>${approaches.map((a) => `<h4><span class="letter sm">${APPROACH[a].letter}</span> ${APPROACH[a].name}</h4><div class="scroll">${numbersTable(s.approaches[a])}</div>`).join('')}</details>
  </section>`;
}).join('\n');

const page = `<title>Two Design Systems</title>
<style>
:root {
  --bg: #f5f6f3; --surface: #ffffff; --fg: #1a1c19; --soft: #5a5f58; --line: #d8dcd4;
  --accent: #2346c9; --ok: #17733f; --ok-bg: #e2f2e8; --warn: #8a5a00; --warn-bg: #fbf0d8; --bad: #b3261e; --bad-bg: #fbe7e5;
  --site: #9a3412; --admin: #2346c9; --boundary: #6d28d9;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #131512; --surface: #1c1f1b; --fg: #e8ebe6; --soft: #a3a9a1; --line: #353a34;
    --accent: #9db2ff; --ok: #72d79c; --ok-bg: #12301f; --warn: #f2c46b; --warn-bg: #382a0d; --bad: #ff8a80; --bad-bg: #3b1613;
    --site: #fdba74; --admin: #9db2ff; --boundary: #c4b5fd; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #131512; --surface: #1c1f1b; --fg: #e8ebe6; --soft: #a3a9a1; --line: #353a34;
  --accent: #9db2ff; --ok: #72d79c; --ok-bg: #12301f; --warn: #f2c46b; --warn-bg: #382a0d; --bad: #ff8a80; --bad-bg: #3b1613;
  --site: #fdba74; --admin: #9db2ff; --boundary: #c4b5fd; color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 15px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-inline-size: 1240px; margin-inline: auto; padding-inline: 16px; padding-block: 32px 64px; }
h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .5rem; text-wrap: balance; letter-spacing: -.01em; }
h2 { font-size: 1.25rem; margin: 2.6rem 0 .9rem; text-wrap: balance; }
h3 { font-size: 1.1rem; margin: 0; text-wrap: balance; }
h4 { font-size: .95rem; margin: 1.2rem 0 .4rem; display: flex; gap: 8px; align-items: center; }
p { max-inline-size: 72ch; }
a { color: var(--accent); }
code { font-family: var(--mono); font-size: .84em; overflow-wrap: anywhere; }
.lede { font-size: 1.05rem; color: var(--soft); margin: 0; }
.scroll { overflow-x: auto; }

.answer { background: var(--surface); border: 1px solid var(--line); border-inline-start: 4px solid var(--accent); border-radius: 10px; padding: 14px 20px; margin-block-start: 1.6rem; }
.answer h2 { margin: 0 0 .4rem; font-size: 1.05rem; }
.answer ul { margin: 0; padding-inline-start: 1.2rem; }
.answer li { margin-block: .35rem; max-inline-size: 85ch; }

.read { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.read > div { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; min-inline-size: 0; }
.read > div > b { display: block; margin-block-end: 2px; }
.read p { margin: 0; color: var(--soft); font-size: .92rem; }

.approaches { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.approaches li { display: flex; gap: 10px; align-items: flex-start; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.approaches p { margin: 2px 0 0; color: var(--soft); font-size: .9rem; }
.letter { flex: none; display: inline-grid; place-items: center; inline-size: 1.7rem; block-size: 1.7rem; border-radius: 50%; background: var(--fg); color: var(--bg); font-weight: 700; font-size: .9rem; }
.letter.sm { inline-size: 1.3rem; block-size: 1.3rem; font-size: .72rem; }

.verdict { display: inline-flex; gap: 5px; align-items: center; font-size: .8rem; font-weight: 600; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.verdict.ok { background: var(--ok-bg); color: var(--ok); }
.verdict.warn { background: var(--warn-bg); color: var(--warn); }
.verdict.bad { background: var(--bad-bg); color: var(--bad); }

.overview { border-collapse: collapse; inline-size: 100%; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
.overview th, .overview td { padding: 8px 10px; border-block-end: 1px solid var(--line); text-align: start; vertical-align: middle; }
.overview thead th { font-size: .82rem; font-weight: 600; white-space: nowrap; }
.overview tbody th { font-weight: 500; min-inline-size: 14rem; }
.overview tbody tr:last-child > * { border-block-end: 0; }

.page { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px; margin-block: 18px; scroll-margin-block-start: 16px; }
.page .meta { margin: .2rem 0 0; color: var(--soft); font-size: .85rem; }
.page .look { margin: .5rem 0 0; }
.shots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-block-start: 14px; }
@media (max-width: 1000px) { .shots { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .shots { grid-template-columns: minmax(0, 1fr); } }
.shot { margin: 0; display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; }
.zoom { padding: 0; border: 3px solid var(--line); border-radius: 8px; background: var(--bg); cursor: zoom-in; overflow: hidden; aspect-ratio: 1280 / 900; max-inline-size: 100%; }
.shot.ok .zoom { border-color: var(--ok); } .shot.warn .zoom { border-color: var(--warn); } .shot.bad .zoom { border-color: var(--bad); }
.zoom img { display: block; inline-size: 100%; block-size: 100%; object-fit: cover; object-position: top left; }
.zoom:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
figcaption { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; font-size: .88rem; }
.who { display: inline-flex; gap: 6px; align-items: center; font-weight: 600; }
.nums { display: flex; flex-wrap: wrap; gap: 4px 12px; color: var(--soft); font-size: .8rem; font-variant-numeric: tabular-nums; }
details { margin-block-start: 14px; border-block-start: 1px solid var(--line); padding-block-start: 10px; }
summary { cursor: pointer; color: var(--accent); font-weight: 600; font-size: .9rem; }
.numbers { border-collapse: collapse; inline-size: 100%; font-size: .82rem; font-variant-numeric: tabular-nums; }
.numbers th, .numbers td { padding: 4px 8px; border-block-start: 1px solid var(--line); text-align: start; vertical-align: top; }
.numbers thead th { color: var(--soft); font-weight: 600; }
.numbers .num { text-align: end; white-space: nowrap; }
.good { color: var(--ok); } .poor { color: var(--bad); font-weight: 600; }
.tag { font: 600 .7rem var(--mono); padding: 0 5px; border-radius: 4px; border: 1px solid currentColor; }
.tag.site { color: var(--site); } .tag.admin { color: var(--admin); } .tag.boundary { color: var(--boundary); }

.findings { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 4px 20px 12px; }
.findings li { margin-block: .55rem; max-inline-size: 85ch; }
.findings .note { margin-block: 1rem; max-inline-size: 85ch; }
.findings .note ul { margin-block: .3rem; }
.findings .note li { margin-block: .1rem; }
footer { color: var(--soft); font-size: .88rem; margin-block-start: 2.5rem; }

dialog#zoom { inline-size: min(1320px, 96vw); max-block-size: 94vh; padding: 0; border: 0; border-radius: 12px; background: var(--surface); color: var(--fg); }
dialog#zoom::backdrop { background: rgb(15 17 14 / .78); } /* ::backdrop doesn’t inherit custom properties everywhere */
.zbar { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: space-between; padding: 10px 14px; border-block-end: 1px solid var(--line); position: sticky; inset-block-start: 0; background: var(--surface); }
.zbar b { font-size: .95rem; }
.zbar p { margin: 2px 0 0; font-size: .88rem; color: var(--soft); }
.zbtns { display: flex; flex-wrap: wrap; gap: 6px; }
.zbtns button { font: inherit; font-size: .85rem; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--fg); cursor: pointer; }
.zbtns button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.zimg { padding: 12px; overflow: auto; }
.zimg img { display: block; max-inline-size: 100%; margin-inline: auto; border: 1px solid var(--line); }
</style>
<main>
  <h1>Two design systems on one page</h1>
  <p class="lede">Can a site’s theme and Drupal’s admin UI share a page without breaking each other? We put both on real Drupal pages, nested every way core allows, and tried four ways of keeping them apart.</p>

  ${notes.answer ? `<section class="answer"><h2>Short answer</h2>${notes.answer}</section>` : ''}

  <h2>What you’re looking at</h2>
  <div class="read">
    <div><b>Two design systems</b><p>The <em>site</em> (the frontend theme, Olivero) and the <em>admin UI</em> (Navigation, the Media Library dialog, Layout Builder’s controls). Some pages use “Olivero with leaking rules added”: Olivero plus the kind of broad CSS real themes ship, to stress the boundary.</p></div>
    <div><b>Screenshots</b><p>Each is the whole browser window, 1280 × 900, after opening the dialog or builder. The border colour is the verdict. Click one to enlarge it, or to see a close-up of the dialog or builder.</p></div>
    <div><b>Two numbers</b><p><b>Leaking:</b> elements styled by the wrong design system; lower is better. <b>Looks right:</b> 0–100, the weakest of seven automatic checks (not covered by other UI, text laid out, no overlapping text, screen-reader text stays hidden, buttons and fields styled, fonts styled, contrast). An approach needs both.</p></div>
  </div>

  <h2>The four approaches</h2>
  <ol class="approaches">${approachCards}</ol>

  <h2>Verdict per page</h2>
  <div class="scroll">${overview}</div>

  <h2>The pages</h2>
  ${pages}

  ${findings}

  <footer>
    <p>Demo site: Drupal 12.0.0-beta1 with Design System API and the Media Library pilot, plus the <code>ds_scope_poc</code> test module and the <code>ds_hostile</code> test theme. Measured in Chromium with Playwright on ${esc(report.measuredAt.slice(0, 10))}. Verdicts and captions are our reading of the screenshots, backed by the two numbers. For the Media Library review, <a href="https://www.drupal.org/project/design_system_api/issues/3627984">#3627984</a>, following seanB’s suggestion; background in core issue <a href="https://www.drupal.org/project/drupal/issues/2195695">#2195695</a>.</p>
  </footer>
</main>
<dialog id="zoom" aria-labelledby="ztitle">
  <div class="zbar"><div><b id="ztitle"></b><p id="zcap"></p></div>
    <div class="zbtns"><button type="button" data-view="window" aria-pressed="true">Whole window</button><button type="button" data-view="close" aria-pressed="false">Close-up</button><button type="button" data-close>Close</button></div></div>
  <div class="zimg"><img id="zimg" alt=""></div>
</dialog>
<script>
const zoom = document.getElementById('zoom');
let current = null;
const show = (view) => {
  document.getElementById('zimg').src = current.dataset[view] || current.dataset.window;
  zoom.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
};
document.querySelectorAll('.zoom').forEach((button) => button.addEventListener('click', () => {
  current = button;
  document.getElementById('ztitle').textContent = button.dataset.title;
  document.getElementById('zcap').textContent = button.dataset.caption;
  document.getElementById('zimg').alt = button.dataset.title;
  zoom.querySelector('[data-view="close"]').hidden = !button.dataset.close;
  show('window');
  zoom.showModal();
}));
zoom.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
zoom.querySelector('[data-close]').addEventListener('click', () => zoom.close());
zoom.addEventListener('click', (e) => { if (e.target === zoom) zoom.close(); });
</script>
`;

writeFileSync(OUT, page);
console.log(`wrote ${OUT} (${(page.length / 1024 / 1024).toFixed(1)} MB)`);
