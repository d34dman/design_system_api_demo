/**
 * Builds one self-contained page from out/contrib/report.json and its
 * screenshots (embedded), for publishing as an artifact.
 *
 *   node contrib-gallery.mjs --out=<file> [--notes=<file.json>] [--findings=<file.html>]
 *
 * --notes: { "answer": "<html>", "scenarios": { "<id>": { "look": "<text>",
 *   "cells": { "<theme>--<approach>" | "*--<approach>" | "*": { "verdict", "caption" } } } } }
 * --findings: an HTML fragment inserted after the comparison.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'out', 'contrib');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const report = JSON.parse(readFileSync(join(DIR, 'report.json'), 'utf8'));
const notes = args.notes && existsSync(args.notes) ? JSON.parse(readFileSync(args.notes, 'utf8')) : { scenarios: {} };
const findings = args.findings && existsSync(args.findings) ? readFileSync(args.findings, 'utf8') : '';

const THEME = { olivero: 'Olivero', ds_hostile: 'Hostile theme' };
const APPROACH = {
  none: { letter: 'A', name: 'Today', what: 'No boundary. The theme’s CSS and the admin CSS both apply everywhere.' },
  systems: { letter: 'D', name: 'Scoped', what: 'Each design system’s CSS applies only inside its own areas (@scope). The UI is marked as admin, as a declared chrome or app role maps by default.' },
  patterns: { letter: 'D+', name: 'Scoped + Form API patterns', what: 'D, and every form element gets the contract’s pattern classes, as core Form API could do for all modules (study candidate 6).' },
};
// Small UIs are shown as a close crop, tall ones in the browser window.
const VIEW = { c1: 'close', c2: 'close', c3: 'close', c4: 'window', c5: 'window' };
const VERDICT = { ok: { icon: '✓', word: 'Works' }, warn: { icon: '!', word: 'Flaws' }, bad: { icon: '✕', word: 'Broken' } };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (file) => existsSync(file) ? `data:image/jpeg;base64,${readFileSync(file).toString('base64')}` : null;
const cell = (id, theme, a) => {
  const c = notes.scenarios?.[id]?.cells ?? {};
  return c[`${theme}--${a}`] ?? c[`*--${a}`] ?? c['*'] ?? {};
};
const result = (id, theme, a) => report.scenarios[id].results[`${theme}--${a}`];
const verdictOf = (id, theme, a) => cell(id, theme, a).verdict ?? (result(id, theme, a)?.visualScore >= 90 ? 'ok' : 'bad');
const badge = (v) => `<span class="verdict ${v}"><span aria-hidden="true">${VERDICT[v].icon}</span> ${VERDICT[v].word}</span>`;
const ids = Object.keys(report.scenarios);
const { themes, approaches } = report;

const overview = `<table class="overview"><thead>
  <tr><th scope="col" rowspan="2">UI</th>${themes.map((t, i) => `<th scope="colgroup" colspan="${approaches.length}"${i ? ' class="group"' : ''}>${THEME[t]}</th>`).join('')}</tr>
  <tr>${themes.map((t, i) => approaches.map((a, j) => `<th scope="col"${i && !j ? ' class="group"' : ''}><span class="letter sm">${APPROACH[a].letter}</span></th>`).join('')).join('')}</tr>
</thead><tbody>${ids.map((id) => {
  const s = report.scenarios[id];
  return `<tr><th scope="row"><a href="#${id}">${esc(s.title)}</a><span class="mod">${esc(s.module)}</span></th>${themes.map((t, i) => approaches.map((a, j) => {
    const v = verdictOf(id, t, a);
    return `<td class="${v}${i && !j ? ' group' : ''}"><span class="dot" aria-hidden="true">${VERDICT[v].icon}</span><span class="score">${result(id, t, a)?.visualScore ?? '—'}</span><span class="sr">${VERDICT[v].word}</span></td>`;
  }).join('')).join('')}</tr>`;
}).join('')}</tbody></table>`;

const sections = ids.map((id) => {
  const s = report.scenarios[id];
  const look = notes.scenarios?.[id]?.look;
  const rows = themes.map((t) => `<div class="row">
    <h4>${THEME[t]}</h4>
    <div class="shots">${approaches.map((a) => {
      const r = result(id, t, a);
      const v = verdictOf(id, t, a);
      const base = join(DIR, `${id}--${t}--${a}`);
      const win = img(`${base}--window.jpg`);
      const close = img(`${base}.jpg`);
      const shown = VIEW[id] === 'window' ? win : close;
      const caption = cell(id, t, a).caption ?? '';
      return `<figure class="shot ${v}">
        <button type="button" class="zoom" data-window="${win ?? ''}" data-close="${close ?? ''}" data-title="${esc(`${s.title} · ${THEME[t]} · ${APPROACH[a].letter} ${APPROACH[a].name}`)}" data-caption="${esc(caption)}" aria-label="Enlarge: ${esc(`${THEME[t]}, ${APPROACH[a].name}`)}">
          ${shown ? `<img src="${shown}" alt="${esc(`${s.title}, ${THEME[t]}, ${APPROACH[a].name}`)}" loading="lazy">` : ''}
        </button>
        <figcaption>
          <span class="who"><span class="letter sm">${APPROACH[a].letter}</span> ${APPROACH[a].name}</span>
          ${badge(v)}
          <span class="cap">${esc(caption)}</span>
          <span class="nums" title="Weakest of seven visual checks">looks right ${r?.visualScore ?? '—'}/100</span>
        </figcaption>
      </figure>`;
    }).join('')}</div>
  </div>`).join('');
  return `<section class="page" id="${id}">
    <header>
      <p class="eyebrow">${esc(s.module)} · role ${esc(s.role)}</p>
      <h3>${esc(s.title)}</h3>
      <p class="meta"><code>${esc(s.path)}</code>${look ? ` · <b>Look at</b> ${esc(look)}` : ''}</p>
    </header>
    ${rows}
  </section>`;
}).join('\n');

const page = `<title>Contrib UI Compared</title>
<style>
:root {
  --bg: #f5f6f3; --surface: #ffffff; --fg: #1a1c19; --soft: #5a5f58; --line: #d8dcd4;
  --accent: #2346c9; --ok: #17733f; --ok-bg: #e2f2e8; --warn: #8a5a00; --warn-bg: #fbf0d8; --bad: #b3261e; --bad-bg: #fbe7e5;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #131512; --surface: #1c1f1b; --fg: #e8ebe6; --soft: #a3a9a1; --line: #353a34;
    --accent: #9db2ff; --ok: #72d79c; --ok-bg: #12301f; --warn: #f2c46b; --warn-bg: #382a0d; --bad: #ff8a80; --bad-bg: #3b1613;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #131512; --surface: #1c1f1b; --fg: #e8ebe6; --soft: #a3a9a1; --line: #353a34;
  --accent: #9db2ff; --ok: #72d79c; --ok-bg: #12301f; --warn: #f2c46b; --warn-bg: #382a0d; --bad: #ff8a80; --bad-bg: #3b1613;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 15px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-inline-size: 1240px; margin-inline: auto; padding-inline: 16px; padding-block: 32px 64px; }
h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .5rem; text-wrap: balance; letter-spacing: -.01em; }
h2 { font-size: 1.25rem; margin: 2.6rem 0 .9rem; text-wrap: balance; }
h3 { font-size: 1.1rem; margin: 0; text-wrap: balance; }
h4 { font-size: .8rem; margin: 0; color: var(--soft); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
p { max-inline-size: 72ch; }
a { color: var(--accent); }
code { font-family: var(--mono); font-size: .84em; overflow-wrap: anywhere; }
.lede { font-size: 1.05rem; color: var(--soft); margin: 0; }
.eyebrow { font-family: var(--mono); font-size: .76rem; color: var(--accent); margin: 0 0 4px; letter-spacing: .03em; }
.meta { color: var(--soft); font-size: .9rem; margin: 4px 0 0; }
.scroll { overflow-x: auto; }
.answer { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 18px 22px; margin-block: 20px; }
.answer ul { margin: 0; padding-inline-start: 1.2rem; display: grid; gap: 6px; }
.approaches { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.approaches li { display: flex; gap: 10px; align-items: flex-start; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.approaches p { margin: 2px 0 0; color: var(--soft); font-size: .9rem; }
.letter { display: inline-grid; place-items: center; min-inline-size: 1.9rem; block-size: 1.9rem; padding-inline: 4px; border-radius: 6px; background: var(--fg); color: var(--bg); font-weight: 700; font-size: .85rem; flex: none; }
.letter.sm { min-inline-size: 1.45rem; block-size: 1.45rem; font-size: .72rem; border-radius: 5px; }
table { border-collapse: collapse; inline-size: 100%; font-size: .9rem; }
th, td { padding: 8px 10px; text-align: start; border-block-end: 1px solid var(--line); vertical-align: top; }
.overview { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; min-inline-size: 760px; }
.overview thead th { font-size: .8rem; color: var(--soft); font-weight: 600; text-align: center; }
.overview thead th:first-child { text-align: start; }
.overview tbody th { font-weight: 500; }
.overview .mod { display: block; color: var(--soft); font-size: .8rem; font-weight: 400; }
.overview td { text-align: center; vertical-align: middle; font-variant-numeric: tabular-nums; white-space: nowrap; }
.overview td .dot { font-weight: 700; margin-inline-end: 6px; }
.overview td.ok { background: var(--ok-bg); color: var(--ok); }
.overview td.warn { background: var(--warn-bg); color: var(--warn); }
.overview td.bad { background: var(--bad-bg); color: var(--bad); }
.overview .group { border-inline-start: 2px solid var(--line); }
.sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
.page { margin-block: 40px; display: grid; gap: 14px; }
.row { display: grid; gap: 8px; }
.shots { display: grid; grid-template-columns: repeat(${approaches.length}, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 820px) { .shots { grid-template-columns: minmax(0, 1fr); } }
.shot { margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; display: grid; grid-template-rows: auto 1fr; min-inline-size: 0; }
.shot.ok { border-block-start: 4px solid var(--ok); }
.shot.warn { border-block-start: 4px solid var(--warn); }
.shot.bad { border-block-start: 4px solid var(--bad); }
.zoom { all: unset; cursor: zoom-in; display: grid; place-items: center; background: #fff; block-size: 220px; overflow: hidden; border-block-end: 1px solid var(--line); }
.zoom:focus-visible { outline: 3px solid var(--accent); outline-offset: -3px; }
.zoom img { max-inline-size: 100%; max-block-size: 100%; object-fit: contain; display: block; }
figcaption { padding: 10px 12px; display: grid; gap: 6px; font-size: .88rem; align-content: start; }
.who { display: flex; gap: 6px; align-items: center; font-weight: 600; }
.cap { color: var(--fg); }
.nums { color: var(--soft); font-size: .8rem; font-variant-numeric: tabular-nums; }
.verdict { justify-self: start; font-size: .76rem; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
.verdict.ok { background: var(--ok-bg); color: var(--ok); }
.verdict.warn { background: var(--warn-bg); color: var(--warn); }
.verdict.bad { background: var(--bad-bg); color: var(--bad); }
.numbers { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
.numbers th { font-size: .8rem; color: var(--soft); }
.findings ol { padding-inline-start: 1.3rem; display: grid; gap: 10px; max-inline-size: 80ch; }
.note { color: var(--soft); font-size: .88rem; max-inline-size: 80ch; }
.findings .note { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; margin-block-start: 16px; }
dialog { border: none; border-radius: 12px; padding: 0; max-inline-size: min(1200px, 94vw); background: var(--surface); color: var(--fg); }
dialog::backdrop { background: rgb(0 0 0 / .6); }
dialog .bar { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 10px 14px; border-block-end: 1px solid var(--line); }
dialog .bar b { font-size: .95rem; }
dialog .tabs { display: flex; gap: 6px; }
dialog button { font: inherit; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); cursor: pointer; }
dialog button[aria-pressed="true"] { background: var(--fg); color: var(--bg); }
dialog .body { max-block-size: 76vh; overflow: auto; background: #fff; }
dialog .body img { display: block; max-inline-size: 100%; margin-inline: auto; }
dialog p { margin: 0; padding: 10px 14px; font-size: .9rem; }
</style>
<main>
  <header>
    <p class="eyebrow">Design System API · two design systems on one page · contrib</p>
    <h1>Contrib UI Compared</h1>
    <p class="lede">Editor UI from popular modules on frontend pages, on Olivero and on a theme with typical leaking rules, under today's Drupal, under scoping, and under scoping with contract form patterns in Form API.</p>
  </header>
  <div class="answer">${notes.answer ?? ''}</div>
  <h2>The ${approaches.length} approaches</h2>
  <ol class="approaches">${approaches.map((a) => `<li><span class="letter">${APPROACH[a].letter}</span><div><b>${APPROACH[a].name}</b><p>${APPROACH[a].what}</p></div></li>`).join('')}</ol>
  <h2>Overview</h2>
  <p class="note">Score: the weakest of seven visual checks on the UI, 0–100. Colour: our verdict from the screenshots; it can be stricter than the score where the checks can't see a problem.</p>
  <div class="scroll">${overview}</div>
  <h2>Each UI</h2>
  ${sections}
  ${findings}
</main>
<dialog id="zoom" aria-labelledby="zoom-title">
  <div class="bar"><b id="zoom-title"></b><div class="tabs"><button type="button" data-show="close" aria-pressed="true">Close-up</button><button type="button" data-show="window" aria-pressed="false">Window</button><button type="button" data-close>Close</button></div></div>
  <div class="body"><img alt=""></div>
  <p></p>
</dialog>
<script>
(() => {
  const d = document.getElementById('zoom');
  const im = d.querySelector('.body img');
  let current = null;
  const show = (which) => {
    const src = current.dataset[which] || current.dataset.window || current.dataset.close;
    im.src = src;
    d.querySelectorAll('[data-show]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.show === which)));
  };
  document.querySelectorAll('.zoom').forEach((b) => b.addEventListener('click', () => {
    current = b;
    d.querySelector('#zoom-title').textContent = b.dataset.title;
    d.querySelector('p').textContent = b.dataset.caption;
    im.alt = b.dataset.title;
    d.showModal();
    show('close');
  }));
  d.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => show(b.dataset.show)));
  d.querySelector('[data-close]').addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
})();
</script>
`;

writeFileSync(args.out ?? join(DIR, 'index.html'), page);
console.log(`wrote ${args.out ?? join(DIR, 'index.html')} (${(page.length / 1048576).toFixed(1)} MB)`);
