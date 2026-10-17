/**
 * The design probe: measures each component on the Radix reference
 * (radix-reference.html, Canvas's own CSS) and its Drupal counterpart (the
 * spec sheet at /admin/advaita/spec, or a real page from spec.config.mjs),
 * and reports every difference.
 *
 * Measured per element and state: height, inline padding, corner radius,
 * fill and text colour composited over what is behind them, the edge (a
 * border or an inset ring, whichever draws it), an outer shadow, font size,
 * weight and family. Colours compare in CIELAB (ΔE76 ≤ 3 counts as equal),
 * lengths within 1px.
 *
 * A difference listed in spec.config.mjs DEPARTURES, with its reason, is
 * reported as a departure, not a failure.
 *
 * Usage (site running, chrome bound to the skin under test):
 *   cd tests/proof && node spec/probe.mjs [--modes=light,dark] [--only=id,id]
 * Writes out/spec/report.md and report.json; exits 1 on any failure.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { COMPONENTS, DEPARTURES, SHEET } from './spec.config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const MODES = (args.modes ?? 'light,dark').split(',');
const ONLY = args.only?.split(',');
const OUT = resolve(args.out ?? join(HERE, '..', 'out', 'spec'));
const REFERENCE = pathToFileURL(join(HERE, 'radix-reference.html')).href;

/** Runs in the page: the measurements of one element. */
function measure(el) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rgba = (paint) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.globalCompositeOperation = 'source-over';
    for (const c of paint) { ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); }
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  };
  const transparent = (c) => /rgba\(.*,\s*0\)$/.test(c) || c === 'transparent';
  // The fills behind and on the element, outermost first, from the first opaque one.
  const layers = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (!transparent(bg)) {
      layers.unshift(bg);
      if (rgba([bg]).a === 1) break;
    }
  }
  if (!layers.length || rgba([layers[0]]).a < 1) layers.unshift('#ffffff');
  const own = getComputedStyle(el).backgroundColor;
  const behind = transparent(own) ? layers : layers.slice(0, -1);
  const fill = rgba(layers);
  const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

  const s = getComputedStyle(el);
  const text = el.matches('input, textarea, select, button, a, th, td') ? el : (el.querySelector('input, textarea, .rt-SelectTriggerInner, .rt-TabNavLinkInner, .rt-SegmentedControlItemLabelActive, .rt-CalloutText, .rt-Heading') ?? el);
  const t = getComputedStyle(text);

  // Shadows, split on commas outside parentheses.
  const shadows = [];
  let depth = 0, cur = '';
  for (const ch of s.boxShadow === 'none' ? '' : s.boxShadow) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { shadows.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) shadows.push(cur.trim());
  const parsed = shadows.map((sh) => {
    const color = sh.match(/^(rgba?\([^)]*\)|color\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\)|#[0-9a-f]+)/i)?.[1] ?? 'rgba(0,0,0,0)';
    const nums = (sh.replace(color, '').match(/-?[\d.]+px/g) ?? []).map(parseFloat);
    return { color, inset: /inset/.test(sh), x: nums[0] ?? 0, y: nums[1] ?? 0, blur: nums[2] ?? 0, spread: nums[3] ?? 0 };
  });
  let edge = null;
  const bw = parseFloat(s.borderTopWidth);
  if (bw > 0 && s.borderTopStyle !== 'none' && !transparent(s.borderTopColor)) {
    edge = { width: bw, color: hex(rgba([...layers, s.borderTopColor])) };
  }
  else {
    const ring = parsed.find((p) => p.x === 0 && p.y === 0 && p.blur === 0 && p.spread > 0 && rgba([p.color]).a > 0);
    if (ring) edge = { width: ring.spread, color: hex(rgba([...(ring.inset ? layers : behind), ring.color])) };
  }
  const elevated = parsed.some((p) => !p.inset && p.blur > 0 && rgba([p.color]).a > 0);
  const r = el.getBoundingClientRect();
  return {
    height: Math.round(r.height * 10) / 10,
    width: Math.round(r.width * 10) / 10,
    // Start padding of the element plus that of its text element (Radix pads
    // a field's input, Drupal the input itself) plus any text indent.
    paddingInline: parseFloat(s.paddingInlineStart) + (text === el ? 0 : parseFloat(t.paddingInlineStart)) + (parseFloat(t.textIndent) || 0),
    radius: parseFloat(s.borderTopLeftRadius),
    fill: hex(fill),
    color: hex(rgba([...layers, t.color])),
    edge: edge ? `${edge.width}px ${edge.color}` : 'none',
    elevated,
    fontSize: parseFloat(t.fontSize),
    fontWeight: Number(t.fontWeight),
    fontFamily: t.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
  };
}

// Colour difference (CIE76 in Lab).
function lab(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const [x, y, z] = [
    (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047,
    c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722,
    (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883,
  ].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
const edgeParts = (e) => (e === 'none' ? null : { width: parseFloat(e), color: e.split(' ')[1] });

const PROPS = ['height', 'paddingInline', 'radius', 'fill', 'color', 'edge', 'elevated', 'fontSize', 'fontWeight', 'fontFamily'];
function same(prop, a, b) {
  if (a === undefined || b === undefined) return true;
  if (['fill', 'color'].includes(prop)) return deltaE(a, b) <= 3;
  if (prop === 'edge') {
    const x = edgeParts(a), y = edgeParts(b);
    if (!x || !y) return !x && !y;
    return Math.abs(x.width - y.width) <= 0.5 && deltaE(x.color, y.color) <= 3;
  }
  if (typeof a === 'number') return Math.abs(a - b) <= (prop === 'fontSize' ? 0.25 : 1);
  return a === b;
}

const login = () => execFileSync('ddev', ['drush', 'user:login', '--uri=' + BASE], { cwd: ROOT, encoding: 'utf8' }).trim();

async function measureAt(page, selector, state, act) {
  if (act) await act(page);
  const el = page.locator(selector).first();
  if (!(await el.count())) return null;
  await el.scrollIntoViewIfNeeded();
  if (state === 'hover') await el.hover();
  else await page.mouse.move(0, 0);
  if (state === 'focus') await el.focus();
  await page.waitForTimeout(state ? 180 : 0);
  return el.evaluate(measure);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const mode of MODES) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 }, colorScheme: mode, reducedMotion: 'reduce' });
  const ref = await ctx.newPage();
  await ref.goto(`${REFERENCE}?mode=${mode}`);
  const site = await ctx.newPage();
  await site.goto(login());
  let at = null;
  for (const c of COMPONENTS) {
    const ids = [c.id, ...(c.variants ?? []).map((v) => `${c.id}@${v}`)];
    for (const id of ids) {
      if (ONLY && !ONLY.includes(c.id)) continue;
      const d = c.drupal?.[id] ?? {};
      const path = d.path ?? SHEET;
      for (const state of [null, ...(c.states ?? [])]) {
        const radix = await measureAt(ref, c.radix ?? `[data-spec="${c.id}"]`, state);
        if (path !== at || d.act) { await site.goto(BASE + path, { waitUntil: 'networkidle' }); at = d.act ? null : path; }
        let drupal = null;
        try {
          drupal = await measureAt(site, d.selector ?? `[data-spec="${id}"]`, state, d.act);
        }
        catch (e) {
          drupal = null;
        }
        const key = `${id}${state ? ':' + state : ''}`;
        const rows = PROPS.filter((p) => !(c.ignore ?? []).includes(p)).map((p) => {
          const ok = radix && drupal ? same(p, radix[p], drupal[p]) : false;
          const why = DEPARTURES[`${c.id}${state ? ':' + state : ''}.${p}`] ?? DEPARTURES[`${c.id}.${p}`] ?? DEPARTURES[`*.${p}`];
          return { prop: p, radix: radix?.[p], drupal: drupal?.[p], status: ok ? 'ok' : why ? 'departure' : 'fail', why };
        });
        results.push({ mode, key, label: c.label, missing: !drupal ? 'drupal' : !radix ? 'radix' : null, rows });
        const fails = rows.filter((r) => r.status === 'fail').length;
        console.log(`${mode} ${key.padEnd(32)} ${drupal ? (fails ? `${fails} differ` : 'ok') : 'MISSING in Drupal'}`);
      }
    }
  }
  await ctx.close();
}
await browser.close();

const fails = results.flatMap((r) => (r.missing ? [{ ...r, prop: '(element)' }] : r.rows.filter((x) => x.status === 'fail')));
let md = `# Design probe: Drupal chrome vs. Radix (Canvas)\n\nGenerated ${new Date().toISOString()}. ${fails.length} failures, ${results.flatMap((r) => r.rows.filter((x) => x.status === 'departure')).length} departures.\n`;
for (const mode of MODES) {
  md += `\n## ${mode}\n\n| Component | Property | Radix | Drupal | |\n|---|---|---|---|---|\n`;
  for (const r of results.filter((x) => x.mode === mode)) {
    if (r.missing) { md += `| ${r.key} | (element) | | missing in ${r.missing} | ✗ |\n`; continue; }
    for (const x of r.rows.filter((y) => y.status !== 'ok')) {
      md += `| ${r.key} | ${x.prop} | ${x.radix} | ${x.drupal} | ${x.status === 'fail' ? '✗' : `departure: ${x.why}`} |\n`;
    }
  }
}
writeFileSync(join(OUT, 'report.md'), md);
writeFileSync(join(OUT, 'report.json'), JSON.stringify(results, null, 2));
console.log(`\n${fails.length} failures. Report: ${join(OUT, 'report.md')}`);
process.exit(fails.length ? 1 : 0);
