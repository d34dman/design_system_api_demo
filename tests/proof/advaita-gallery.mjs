/**
 * Builds one self-contained page about Advaita, the dual-theme prototype,
 * from out/advaita/report.json (looks, feels, clips, coverage) and
 * out/contrib/report.json (the contrib comparison), for publishing as an
 * artifact. Screenshots and clips are embedded.
 *
 *   node advaita-gallery.mjs --out=<file> --notes=<file.json> [--sections=<file.html>]
 *
 * --notes: { "lede": "<html>", "answer": "<html>", "pages": { "<id>": "<caption>" },
 *   "feels": { "<id>": "<caption>" }, "coverage": { "<id>": "<caption>" },
 *   "contrib": { "<scenario>": "<caption for Advaita>" } }
 * --sections: an HTML fragment with <section> elements, inserted after the
 *   evidence (where it stops, questions, what changed).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'out', 'advaita');
const CONTRIB = join(HERE, 'out', 'contrib');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
// report.json, plus any partial runs (report-<part>.json) on top of it.
const report = JSON.parse(readFileSync(join(DIR, 'report.json'), 'utf8'));
for (const part of ['looks', 'feels', 'coverage']) {
  const file = join(DIR, `report-${part}.json`);
  if (existsSync(file)) {
    const extra = JSON.parse(readFileSync(file, 'utf8'));
    for (const key of ['pages', 'feels', 'clips', 'coverage']) {
      if (Object.keys(extra[key] ?? {}).length) report[key] = extra[key];
    }
  }
}
const contrib = JSON.parse(readFileSync(join(CONTRIB, 'report.json'), 'utf8'));
const notes = args.notes ? JSON.parse(readFileSync(args.notes, 'utf8')) : {};
const sections = args.sections && existsSync(args.sections) ? readFileSync(args.sections, 'utf8') : '';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const embed = (file, type = 'image/jpeg') => existsSync(file) ? `data:${type};base64,${readFileSync(file).toString('base64')}` : '';
const MODES = [['light', 'Light'], ['dark', 'Dark'], ['rtl', 'Arabic, right to left']];
const THEMES = { olivero: 'Olivero', ds_hostile: 'Hostile theme', advaita: 'Advaita' };
const APPROACH = { none: 'A', systems: 'D', patterns: 'D+' };

// 1. Looks: one tab per mode, a card per page.
const pages = Object.values(report.pages);
const looks = MODES.map(([mode, label], i) => `
  <div class="mode-panel" role="tabpanel" id="mode-${mode}" aria-labelledby="tab-${mode}"${i ? ' hidden' : ''}>
    <div class="shots">${pages.map((p) => {
      const m = p.modes[mode];
      const v = m.violations.reduce((n, x) => n + x.nodes, 0);
      return `<figure class="shot">
        <button type="button" class="zoom" data-title="${esc(`${p.title} · ${label}`)}" data-caption="${esc(notes.pages?.[p.id] ?? p.note)}" aria-label="Enlarge: ${esc(`${p.title}, ${label}`)}">
          <img src="${embed(join(DIR, m.file))}" alt="${esc(`${p.title}, ${label}`)}" loading="lazy">
        </button>
        <figcaption>
          <span class="system system--${p.system}">${p.system === 'admin' ? 'Admin system' : 'Site system'}</span>
          <b>${esc(p.title)}</b>
          <span class="axe ${v ? 'axe--bad' : 'axe--ok'}" title="${esc(m.violations.map((x) => `${x.id}: ${x.nodes}`).join(', ') || 'no violations')}">${v ? `${v} axe ${v === 1 ? 'issue' : 'issues'}` : 'axe: 0'}</span>
        </figcaption>
      </figure>`;
    }).join('')}</div>
  </div>`).join('');

// 2. Feels: clips, then states.
const clips = Object.values(report.clips).map((c) => `
  <figure class="clip">
    <video src="${embed(join(DIR, c.file), 'video/webm')}" controls muted loop playsinline preload="metadata" aria-label="${esc(c.title)}"></video>
    <figcaption>${esc(c.title)}</figcaption>
  </figure>`).join('');
const feels = Object.values(report.feels).filter((f) => f.file).map((f) => `
  <figure class="shot">
    <button type="button" class="zoom" data-title="${esc(f.title)}" data-caption="${esc(notes.feels?.[f.id] ?? '')}" aria-label="Enlarge: ${esc(f.title)}">
      <img src="${embed(join(DIR, f.file))}" alt="${esc(f.title)}" loading="lazy">
    </button>
    <figcaption><b>${esc(f.title)}</b>${notes.feels?.[f.id] ? `<span class="soft">${esc(notes.feels[f.id])}</span>` : ''}</figcaption>
  </figure>`).join('');

// 3. Solves it: the score table, and the best-of comparison per UI.
const ids = Object.keys(contrib.scenarios);
const score = (id, key) => contrib.scenarios[id].results[key]?.visualScore;
const cls = (s) => s === undefined ? '' : s >= 90 ? 'ok' : s >= 60 ? 'warn' : 'bad';
const head = `<thead><tr><th scope="col" rowspan="2">UI</th>${contrib.themes.map((t) => `<th scope="colgroup" colspan="${t === 'advaita' ? 1 : contrib.approaches.length}" class="group${t === 'advaita' ? ' adv' : ''}">${THEMES[t]}${t === 'advaita' ? '<span class="sub">dual theme</span>' : '<span class="sub">+ Default Admin</span>'}</th>`).join('')}</tr>
  <tr>${contrib.themes.map((t) => (t === 'advaita' ? ['none'] : contrib.approaches).map((a, j) => `<th scope="col" class="${j ? '' : 'group'}${t === 'advaita' ? ' adv' : ''}">${t === 'advaita' ? 'as is' : APPROACH[a]}</th>`).join('')).join('')}</tr></thead>`;
const body = ids.map((id) => {
  const s = contrib.scenarios[id];
  return `<tr><th scope="row">${esc(s.title)}<span class="mod">${esc(s.module)}</span></th>${contrib.themes.map((t) => (t === 'advaita' ? ['none'] : contrib.approaches).map((a, j) => {
    const v = score(id, `${t}--${a}`);
    return `<td class="num ${cls(v)}${j ? '' : ' group'}${t === 'advaita' ? ' adv' : ''}">${v ?? '–'}</td>`;
  }).join('')).join('')}</tr>`;
}).join('');
const best = ids.map((id) => {
  const s = contrib.scenarios[id];
  const view = ['c4', 'c5'].includes(id) ? '--window' : '';
  const cells = [['olivero', 'patterns'], ['ds_hostile', 'patterns'], ['advaita', 'none']].map(([t, a]) => {
    const file = join(CONTRIB, `${id}--${t}--${a}${view}.jpg`);
    const v = score(id, `${t}--${a}`);
    const label = t === 'advaita' ? 'Advaita, as is' : `${THEMES[t]}, D+`;
    return `<figure class="shot">
      <button type="button" class="zoom${view ? '' : ' zoom--fit'}" data-title="${esc(`${s.title} · ${label}`)}" data-caption="${esc(t === 'advaita' ? notes.contrib?.[id] ?? '' : '')}" aria-label="Enlarge: ${esc(label)}">
        <img src="${embed(file)}" alt="${esc(`${s.title}, ${label}`)}" loading="lazy">
      </button>
      <figcaption><b>${esc(label)}</b><span class="score ${cls(v)}">${v ?? '–'}</span></figcaption>
    </figure>`;
  }).join('');
  return `<article class="ui" id="${id}">
    <h3>${esc(s.title)} <span class="mod">${esc(s.module)}</span></h3>
    ${notes.contrib?.[id] ? `<p class="soft">${esc(notes.contrib[id])}</p>` : ''}
    <div class="shots shots--3">${cells}</div>
  </article>`;
}).join('');

// 4. Coverage: screens nobody styled.
const coverage = Object.values(report.coverage).map((c) => `
  <figure class="shot">
    <button type="button" class="zoom" data-title="${esc(c.title)}" data-caption="${esc(notes.coverage?.[c.id] ?? '')}" aria-label="Enlarge: ${esc(c.title)}">
      <img src="${embed(join(DIR, c.file))}" alt="${esc(c.title)}" loading="lazy">
    </button>
    <figcaption><b>${esc(c.title)}</b>${notes.coverage?.[c.id] ? `<span class="soft">${esc(notes.coverage[c.id])}</span>` : ''}</figcaption>
  </figure>`).join('');

const totalAxe = pages.reduce((n, p) => n + Object.values(p.modes).reduce((m, x) => m + x.violations.reduce((k, v) => k + v.nodes, 0), 0), 0);

const page = `<title>Advaita</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400..700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root {
  --bg: #faf8f4; --surface: #ffffff; --nested: #f3f0e9; --fg: #25221d; --soft: #5b5549; --line: #ddd6c9;
  --site: #0d6b5b; --site-soft: #dcefe9; --admin: #3a4fd6; --admin-soft: #e4e8fc;
  --ok: #146c2e; --ok-bg: #e2f3e6; --warn: #8a5300; --warn-bg: #f8ecd6; --bad: #b42318; --bad-bg: #fbe4e1;
  --serif: Fraunces, Georgia, serif; --sans: Inter, system-ui, sans-serif; --mono: "JetBrains Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #16140f; --surface: #1f1c16; --nested: #2a261e; --fg: #ece6da; --soft: #b8af9f; --line: #3d382e;
    --site: #62c7b1; --site-soft: #173b34; --admin: #8d9cff; --admin-soft: #272d55;
    --ok: #72d18f; --ok-bg: #143021; --warn: #f1b552; --warn-bg: #3a2a0e; --bad: #ff8f80; --bad-bg: #3d1713;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #16140f; --surface: #1f1c16; --nested: #2a261e; --fg: #ece6da; --soft: #b8af9f; --line: #3d382e;
  --site: #62c7b1; --site-soft: #173b34; --admin: #8d9cff; --admin-soft: #272d55;
  --ok: #72d18f; --ok-bg: #143021; --warn: #f1b552; --warn-bg: #3a2a0e; --bad: #ff8f80; --bad-bg: #3d1713;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 15px/1.6 var(--sans); }
main { max-inline-size: 1180px; margin-inline: auto; padding-inline: 16px; padding-block: 40px 72px; }
h1 { font-family: var(--serif); font-size: clamp(2.4rem, 6vw, 3.6rem); font-weight: 600; line-height: 1.02; letter-spacing: -.025em; margin: 0 0 .6rem; font-variation-settings: "opsz" 144; }
h2 { font-family: var(--serif); font-size: 1.7rem; font-weight: 600; letter-spacing: -.015em; margin: 3.2rem 0 .4rem; text-wrap: balance; }
h3 { font-size: 1.05rem; margin: 0 0 .3rem; text-wrap: balance; }
p { max-inline-size: 70ch; margin: 0 0 .9rem; }
a { color: var(--admin); }
code { font-family: var(--mono); font-size: .84em; overflow-wrap: anywhere; }
.eyebrow { font-family: var(--mono); font-size: .75rem; letter-spacing: .04em; color: var(--soft); margin: 0 0 .8rem; }
.lede { font-size: 1.12rem; max-inline-size: 62ch; }
.soft { color: var(--soft); }
.meta { color: var(--soft); font-size: .88rem; }
.intro { display: grid; gap: 28px; }
@media (min-width: 900px) { .intro { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); align-items: start; } }
.answer { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px 22px; }
.answer h2 { margin-top: 0; font-size: 1.15rem; font-family: var(--sans); font-weight: 650; letter-spacing: 0; }
.answer ul { margin: 0; padding-inline-start: 1.1rem; display: grid; gap: 8px; }
.toc { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 18px 0 0; padding: 0; list-style: none; font-size: .9rem; }
.split { display: grid; gap: 14px; margin-block: 18px; }
@media (min-width: 760px) { .split { grid-template-columns: 1fr 1fr 1fr; } }
.part { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); padding: 16px 18px; min-inline-size: 0; }
.part h3 { font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: var(--soft); }
.part ul { margin: 0; padding-inline-start: 1.1rem; display: grid; gap: 4px; font-size: .92rem; }
.part--module { border-top: 4px solid var(--fg); }
.part--theme { border-top: 4px solid var(--site); }
.part--pages { border-top: 4px solid var(--admin); }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0; }
.tabs button { font: inherit; font-size: .9rem; font-weight: 600; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); cursor: pointer; }
.tabs button[aria-selected="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.shots { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); }
.shots--3 { grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
.shot { margin: 0; min-inline-size: 0; display: grid; gap: 8px; align-content: start; }
.zoom { display: block; padding: 0; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--nested); cursor: zoom-in; inline-size: 100%; }
.zoom img { display: block; inline-size: 100%; aspect-ratio: 1280 / 900; object-fit: cover; object-position: top; }
.zoom--fit img { object-fit: contain; object-position: center; background: var(--surface); }
.zoom:focus-visible { outline: 3px solid var(--admin); outline-offset: 2px; }
.shot figcaption { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; font-size: .9rem; }
.shot figcaption .soft { flex-basis: 100%; font-size: .86rem; }
.system { font-size: .72rem; font-weight: 700; letter-spacing: .03em; padding: 1px 8px; border-radius: 999px; }
.system--site { color: var(--site); background: var(--site-soft); }
.system--admin { color: var(--admin); background: var(--admin-soft); }
.axe { margin-inline-start: auto; font-family: var(--mono); font-size: .75rem; }
.axe--ok { color: var(--ok); }
.axe--bad { color: var(--bad); }
.clips { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); margin-block-end: 22px; }
.clip { margin: 0; display: grid; gap: 6px; }
.clip video { inline-size: 100%; border-radius: 10px; border: 1px solid var(--line); background: #000; aspect-ratio: 16 / 10; }
.clip figcaption { font-size: .9rem; color: var(--soft); }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; font-size: .9rem; min-inline-size: 760px; inline-size: 100%; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
th, td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: start; }
thead th { font-size: .8rem; color: var(--soft); font-weight: 650; }
.sub { display: block; font-weight: 400; font-size: .74rem; }
.mod { display: block; font-weight: 400; color: var(--soft); font-size: .8rem; }
h3 .mod { display: inline; margin-inline-start: 6px; }
.group { border-inline-start: 1px solid var(--line); }
.adv { background: var(--site-soft); }
td.num { font-family: var(--mono); font-variant-numeric: tabular-nums; text-align: center; font-weight: 600; }
td.ok, .score.ok { color: var(--ok); }
td.warn, .score.warn { color: var(--warn); }
td.bad, .score.bad { color: var(--bad); }
.score { margin-inline-start: auto; font-family: var(--mono); font-weight: 700; }
.ui { margin-block: 26px; }
.note { font-size: .88rem; color: var(--soft); }
.cards { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); margin-block: 14px; }
.card { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); padding: 16px 18px; min-inline-size: 0; }
.card h3 { margin-block-end: 6px; }
.card p { font-size: .93rem; margin: 0; }
ol.questions { display: grid; gap: 12px; padding-inline-start: 1.3rem; max-inline-size: 78ch; }
ol.questions li::marker { font-family: var(--serif); font-weight: 700; color: var(--site); }
dialog { border: 0; padding: 0; background: transparent; max-inline-size: min(1280px, 96vw); }
dialog::backdrop { background: rgb(10 10 8 / .8); }
dialog figure { margin: 0; background: var(--surface); border-radius: 12px; overflow: hidden; }
dialog img { display: block; inline-size: 100%; max-block-size: 80vh; object-fit: contain; background: var(--nested); }
dialog figcaption { padding: 10px 16px; font-size: .92rem; display: flex; gap: 12px; align-items: baseline; }
dialog figcaption span { color: var(--soft); }
dialog button { margin-inline-start: auto; font: inherit; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); cursor: pointer; }
</style>
<main>
  <p class="eyebrow">Design System API · prototype · ${esc(report.generated.slice(0, 10))}</p>
  <div class="intro">
    <div>
      <h1>Advaita</h1>
      <div class="lede">${notes.lede ?? ''}</div>
      <ul class="toc">
        <li><a href="#idea">The idea</a></li>
        <li><a href="#looks">What it looks like</a></li>
        <li><a href="#feels">How it feels</a></li>
        <li><a href="#solves">Does it solve the problem?</a></li>
        ${sections.match(/<section id="[^"]+"><h2>[^<]+<\/h2>/g)?.map((m) => { const [, id, h] = m.match(/id="([^"]+)"><h2>([^<]+)</); return `<li><a href="#${id}">${h}</a></li>`; }).join('') ?? ''}
        <li><a href="#coverage">Screens nobody styled</a></li>
      </ul>
    </div>
    <div class="answer"><h2>In short</h2>${notes.answer ?? ''}</div>
  </div>

  <section id="idea">
    <h2>The idea</h2>
    <p>One theme, one set of components, two design systems. Every component in Advaita is written against the Design System API's tokens only. The theme gives those tokens two sets of values, one for the site and one for the admin. The module decides which set a region of the page gets.</p>
    <div class="split">
      <div class="part part--module"><h3>Design System API (module)</h3><ul>${(notes.module ?? []).map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div class="part part--theme"><h3>Advaita (theme)</h3><ul>${(notes.theme ?? []).map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div class="part part--pages"><h3>On a page</h3><ul>${(notes.pages_how ?? []).map((x) => `<li>${x}</li>`).join('')}</ul></div>
    </div>
  </section>

  <section id="looks">
    <h2>What it looks like</h2>
    <p>Six pages in light, dark and Arabic (right to left), as an administrator sees them. The same components draw all of them. Each page was scanned with axe (WCAG 2.1 AA): ${totalAxe ? `${totalAxe} issues in total, listed under each page` : 'no violations on any page'}.</p>
    <div class="tabs" role="tablist" aria-label="Mode">${MODES.map(([m, l], i) => `<button type="button" role="tab" id="tab-${m}" aria-controls="mode-${m}" aria-selected="${i === 0}">${l}</button>`).join('')}</div>
    ${looks}
  </section>

  <section id="feels">
    <h2>How it feels</h2>
    <p>Two short recordings, then the states that a still screenshot of a page doesn't show.</p>
    <div class="clips">${clips}</div>
    <div class="shots">${feels}</div>
  </section>

  <section id="solves">
    <h2>Does it solve the problem?</h2>
    ${notes.solves ?? ''}
    <div class="scroll"><table>${head}<tbody>${body}</tbody></table></div>
    <p class="note">Visual score of each UI (0–100, the weakest of seven checks), as on the earlier comparison page. A: today, no boundary. D: each design system's CSS scoped to its areas. D+: D plus Form API pattern classes. Olivero and the hostile theme run with Default Admin as the admin theme; Advaita runs as both.</p>
    <h3 style="margin-top:28px">The best each setup gets, side by side</h3>
    <p class="soft">Olivero and the hostile theme under D+, the best approach the earlier comparison found, next to Advaita as it is.</p>
    ${best}
  </section>

  ${sections}

  <section id="coverage">
    <h2>Screens nobody styled</h2>
    <p>${notes.coverage_intro ?? ''}</p>
    <div class="shots">${coverage}</div>
  </section>
</main>
<dialog id="zoom" aria-label="Screenshot">
  <figure><img alt=""><figcaption><b></b><span></span><button type="button" data-close>Close</button></figcaption></figure>
</dialog>
<script>
(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }));
  const dialog = document.getElementById('zoom');
  document.querySelectorAll('.zoom').forEach((b) => b.addEventListener('click', () => {
    dialog.querySelector('img').src = b.querySelector('img').src;
    dialog.querySelector('img').alt = b.dataset.title;
    dialog.querySelector('b').textContent = b.dataset.title;
    dialog.querySelector('figcaption span').textContent = b.dataset.caption || '';
    dialog.showModal();
  }));
  dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.matches('[data-close]')) dialog.close(); });
})();
</script>
`;

writeFileSync(args.out ?? join(DIR, 'index.html'), page);
console.log('wrote', args.out ?? join(DIR, 'index.html'), Math.round(page.length / 1024), 'KB');
