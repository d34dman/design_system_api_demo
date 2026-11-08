/**
 * Composition spacing check (composition-spacing plan, C-07, D-01, D-02, D-05).
 * Opens UI Kit's showcase and the six demo screens at desktop and phone width
 * (light) and reports three kinds of finding:
 *
 *   touching   two neighbouring siblings that each are or hold a UI Kit root
 *              sit closer than space.2xs (0.25rem): nobody owns the space
 *              between them (D-01, D-06).
 *   empty-gap  a child of a flex or grid container with a gap that renders
 *              nothing but still takes part in the layout, so it adds a
 *              second gap (D-02).
 *   surface    a UI Kit root with a visible background or border around
 *              content, but no padding (D-05).
 *
 * A UI Kit root is an element with a class ui-kit-<name> (no __ or --).
 *
 * Usage:
 *   cd tests/proof && node spacing.mjs [--tag=baseline] [--against=baseline]
 *     [--pages=showcase,home] [--widths=desktop,phone] [--strict]
 *
 * Writes out/spacing/<tag>/findings.json and a text summary to stdout.
 * --against prints what is new and what is gone compared with another tag.
 * --strict exits with 1 when anything is found.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const TAG = args.tag ?? 'latest';
const OUT = join(HERE, 'out', 'spacing', TAG);

const PAGES = {
  showcase: '/ui-kit/showcase',
  home: '/ui-kit/demo',
  login: '/ui-kit/demo/login',
  content: '/ui-kit/demo/content',
  projects: '/ui-kit/demo/projects',
  article: '/ui-kit/demo/article',
  'article-preview': '/ui-kit/demo/article-preview',
};
const WIDTHS = { desktop: { width: 1280, height: 900 }, phone: { width: 390, height: 844 } };
const pick = (all, list) => Object.fromEntries(Object.entries(all).filter(([k]) => !list || list.split(',').includes(k)));

// Runs in the page: returns the findings for the current document.
function check() {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const MIN = 0.25 * rem - 0.5; // space.2xs, minus rounding.
  const ROOT = /^ui-kit-[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const isRoot = (el) => [...el.classList].some((c) => ROOT.test(c));
  const rootName = (el) => [...el.classList].find((c) => ROOT.test(c));
  const shown = (el) => {
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.position !== 'absolute' && s.position !== 'fixed';
  };
  const holdsRoot = (el) => isRoot(el) || el.querySelector('[class*="ui-kit-"]') !== null && [...el.querySelectorAll('[class*="ui-kit-"]')].some(isRoot);
  // A readable path: the nearest named ancestors, then the element.
  const label = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.body && parts.length < 4; n = n.parentElement) {
      const name = rootName(n) ?? (n.id ? `#${n.id}` : [...n.classList].find((c) => c.includes('__') || c.startsWith('ui-kit-')) ?? (n.classList[0] ? `.${n.classList[0]}` : n.tagName.toLowerCase()));
      parts.unshift(name);
    }
    return parts.join(' > ');
  };
  // Nearest heading before the element, so a finding says where on the page it is.
  const section = (el) => {
    const all = [...document.querySelectorAll('h1, h2, h3')];
    let last = '';
    for (const h of all) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) last = h.textContent.trim().replace(/\s+/g, ' ').slice(0, 60);
    }
    return last;
  };
  const describe = (el) => (isRoot(el) ? rootName(el) : `${el.tagName.toLowerCase()}${el.classList[0] ? '.' + el.classList[0] : ''} (holds ${[...el.querySelectorAll('*')].filter(isRoot).slice(0, 2).map(rootName).join(', ')})`);

  const findings = [];
  const scope = document.querySelector('main') ?? document.body;
  for (const parent of [scope, ...scope.querySelectorAll('*')]) {
    if (!shown(parent) && parent !== scope) continue;
    const ps = getComputedStyle(parent);
    const kids = [...parent.children].filter((k) => !['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK'].includes(k.tagName));

    // empty-gap: a child that renders nothing in a container with a gap.
    const flexOrGrid = /flex|grid/.test(ps.display);
    const gap = Math.max(parseFloat(ps.rowGap) || 0, parseFloat(ps.columnGap) || 0);
    if (flexOrGrid && gap > 0 && kids.filter(shown).length > 1) {
      for (const k of kids) {
        if (!shown(k) || getComputedStyle(k).display === 'contents') continue;
        const r = k.getBoundingClientRect();
        if (r.width < 0.5 || r.height < 0.5) {
          findings.push({ kind: 'empty-gap', where: label(k), section: section(k), detail: `${describe(k)} renders nothing but takes a ${gap}px gap in ${rootName(parent) ?? parent.tagName.toLowerCase()}` });
        }
      }
    }

    // touching: neighbouring visible siblings that are or hold UI Kit roots.
    const boxes = kids.filter((k) => shown(k) && getComputedStyle(k).display !== 'contents')
      .map((k) => ({ k, r: k.getBoundingClientRect() }))
      .filter(({ r }) => r.width >= 0.5 && r.height >= 0.5);
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i - 1], b = boxes[i];
      if (!holdsRoot(a.k) || !holdsRoot(b.k)) continue;
      const sameRow = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 1;
      const distance = sameRow
        ? Math.max(b.r.left - a.r.right, a.r.left - b.r.right)
        : b.r.top - a.r.bottom;
      // Overlapping boxes (negative distance) are a positioning choice, not touching.
      if (distance >= -0.5 && distance < MIN) {
        findings.push({ kind: 'touching', where: label(b.k), section: section(b.k), detail: `${describe(a.k)} and ${describe(b.k)} are ${Math.round(distance * 10) / 10}px apart ${sameRow ? 'side by side' : 'one above the other'} in ${rootName(parent) ?? label(parent)}` });
      }
    }

    // surface: a UI Kit root with a background or border and content, no padding.
    if (isRoot(parent) && parent !== scope) {
      const bg = ps.backgroundColor;
      const hasBg = bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg);
      const borders = ['Top', 'Right', 'Bottom', 'Left'].filter((s) => parseFloat(ps[`border${s}Width`]) > 0 && ps[`border${s}Style`] !== 'none');
      const ring = borders.length === 4 || (hasBg);
      const padding = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(ps[`padding${s}`]) || 0);
      const text = [...parent.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || parent.children.length > 0;
      // Content that fills its box edge to edge (an image, a table) needs no padding.
      const filled = parent.matches('img, table, svg, picture, video, hr') || ['image', 'figure', 'table', 'avatar', 'progress', 'spinner', 'divider', 'icon', 'frame'].some((n) => rootName(parent) === `ui-kit-${n}`);
      if (ring && text && !filled && padding.every((p) => p === 0)) {
        findings.push({ kind: 'surface', where: label(parent), section: section(parent), detail: `${rootName(parent)} has a ${hasBg ? 'background' : 'border'} but no padding` });
      }
    }
  }
  return findings;
}

const pages = pick(PAGES, args.pages);
const widths = pick(WIDTHS, args.widths);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const results = {};
const roots = {};
for (const [wid, viewport] of Object.entries(widths)) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport });
  const page = await context.newPage();
  for (const [name, path] of Object.entries(pages)) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    results[`${name}/${wid}`] = await page.evaluate(check);
    roots[`${name}/${wid}`] = await page.evaluate(() => [...document.querySelectorAll('[class*="ui-kit-"]')].filter((el) => [...el.classList].some((c) => /^ui-kit-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c))).length);
  }
  await context.close();
}
await browser.close();
writeFileSync(join(OUT, 'findings.json'), JSON.stringify(results, null, 1));

const key = (f) => `${f.kind}|${f.where}|${f.detail}`;
let total = 0;
for (const [cell, list] of Object.entries(results)) {
  total += list.length;
  const counts = ['touching', 'empty-gap', 'surface'].map((k) => `${k} ${list.filter((f) => f.kind === k).length}`).join(', ');
  console.log(`${cell} (${roots[cell]} UI Kit roots): ${list.length ? counts : 'nothing found'}`);
  for (const f of list) console.log(`  [${f.kind}] ${f.section ? `«${f.section}» ` : ''}${f.detail}\n      at ${f.where}`);
}
console.log(`\nTotal: ${total} finding(s) in ${Object.keys(results).length} page/width cells.`);

if (args.against) {
  const file = join(HERE, 'out', 'spacing', args.against, 'findings.json');
  if (existsSync(file)) {
    const before = JSON.parse(readFileSync(file, 'utf8'));
    let gone = 0, added = 0;
    for (const cell of new Set([...Object.keys(before), ...Object.keys(results)])) {
      const b = new Set((before[cell] ?? []).map(key));
      const a = new Set((results[cell] ?? []).map(key));
      gone += [...b].filter((k) => !a.has(k)).length;
      const fresh = [...a].filter((k) => !b.has(k));
      added += fresh.length;
      for (const k of fresh) console.log(`  new in ${cell}: ${k}`);
    }
    console.log(`Against ${args.against}: ${gone} gone, ${added} new.`);
  }
}
if (args.strict !== undefined && total > 0) process.exit(1);
