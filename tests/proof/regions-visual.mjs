/**
 * Visual checks for regions.mjs: does the page still look intact?
 *
 * The leak count compares each region with the same page without the other
 * system's CSS, so a region that lost the styling it needs scores as well as
 * one that kept it. These checks need no reference. Each one reports the share
 * of items that pass, inside the scenario's focus element (the dialog, the
 * builder, or the whole page):
 *
 *   visible   sample points of the focus element (inside the viewport) not
 *             covered by something else, such as an overlay over a dialog.
 *             For an element in the page flow, fixed or sticky chrome it
 *             scrolls under (Navigation's top bar) doesn't count.
 *   readable  text elements that are laid out: not collapsed to zero size and
 *             at least 4 characters per line on average (visually hidden text
 *             is skipped)
 *   controls  visible buttons, inputs, selects and textareas whose box isn't
 *             the browser's default (background, border, radius)
 *   fonts     text elements not in the browser's default font
 *   hidden    screen-reader-only text (.visually-hidden) that stays hidden
 *             (clipped, or inside a 1px box)
 *   overlap   text elements whose text doesn't overlap another element's text
 *   contrast  axe color-contrast: passing nodes / checked nodes
 *
 * The visual score is the weakest check that applies, 0 to 100: a dialog that
 * can't be clicked isn't made acceptable by readable text.
 */

import { AxeBuilder } from '@axe-core/playwright';

/* Runs in the page. */
export function readVisual(focusSelector) {
  const focus = document.querySelector(focusSelector) ?? document.body;
  const whole = focus === document.body;
  const label = (el) => el.localName + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
  const shown = (el) => el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  // Hidden the way screen-reader text is: clipped, or inside a 1px box that
  // hides its overflow.
  const clipped = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if ((cs.clip && cs.clip !== 'auto') || cs.clipPath !== 'none') return true;
      if (cs.overflow !== 'visible') { const r = e.getBoundingClientRect(); if (r.width <= 2 || r.height <= 2) return true; }
    }
    return false;
  };
  const result = {};

  // visible
  if (!whole) {
    const r = focus.getBoundingClientRect();
    const x0 = Math.max(r.left, 0), x1 = Math.min(r.right, innerWidth);
    const y0 = Math.max(r.top, 0), y1 = Math.min(r.bottom, innerHeight);
    let total = 0, ok = 0;
    const covers = {};
    const pinned = (el) => { for (let e = el; e; e = e.parentElement) if (['fixed', 'sticky'].includes(getComputedStyle(e).position)) return true; return false; };
    const inFlow = !pinned(focus);
    if (x1 > x0 && y1 > y0) {
      for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
        const x = x0 + (x1 - x0) * (i + 0.5) / 20, y = y0 + (y1 - y0) * (j + 0.5) / 20;
        const top = document.elementFromPoint(x, y);
        total++;
        if (top && inFlow && !focus.contains(top) && pinned(top)) { total--; continue; }
        if (top && focus.contains(top)) ok++;
        else if (top) { const k = label(top.closest('aside,header,nav') ?? top); covers[k] = (covers[k] ?? 0) + 1; }
      }
    }
    result.visible = { total, ok, examples: Object.entries(covers).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `covered by ${k} (${n} of ${total} points)`) };
  }

  // readable and fonts
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
  const SKIP = new Set(['script', 'style', 'noscript', 'template', 'option', 'title']);
  const texts = [focus, ...focus.querySelectorAll('*')].filter((el) => !SKIP.has(el.localName) && !el.closest('svg, .visually-hidden, .sr-only') && ownText(el).length && shown(el));

  // The browser's defaults, from a blank document.
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:auto;width:10px;height:10px;opacity:0;pointer-events:none';
  document.body.append(frame);
  const blank = frame.contentDocument;
  blank.open(); blank.write('<!doctype html><html><body></body></html>'); blank.close();
  const defaultFont = frame.contentWindow.getComputedStyle(blank.body).fontFamily;

  const readable = { total: 0, ok: 0, examples: [] };
  const fonts = { total: 0, ok: 0, examples: [] };
  for (const el of texts) {
    const chars = ownText(el).reduce((n, t) => n + t.textContent.trim().length, 0);
    const lines = new Set();
    let area = 0;
    for (const t of ownText(el)) {
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const rect of range.getClientRects()) {
        if (rect.width && rect.height) { lines.add(Math.round(rect.top)); area += rect.width * rect.height; }
      }
    }
    readable.total++;
    const perLine = lines.size ? chars / lines.size : 0;
    if (area > 0 && (chars < 4 || perLine >= 4)) readable.ok++;
    else if (readable.examples.length < 3) readable.examples.push(`${label(el)}: ${area ? `${perLine.toFixed(1)} characters per line` : 'collapsed'}`);
    fonts.total++;
    if (getComputedStyle(el).fontFamily !== defaultFont) fonts.ok++;
    else if (fonts.examples.length < 3) fonts.examples.push(`${label(el)} in the browser’s default font`);
  }
  result.readable = readable;
  result.fonts = fonts;

  // hidden
  const hidden = { total: 0, ok: 0, examples: [] };
  for (const el of focus.querySelectorAll('.visually-hidden:not(:focus), .sr-only:not(:focus)')) {
    if (!shown(el) || !el.textContent.trim()) continue;
    const r = el.getBoundingClientRect();
    hidden.total++;
    if (r.width <= 2 || r.height <= 2 || clipped(el)) hidden.ok++;
    else if (hidden.examples.length < 3) hidden.examples.push(`“${el.textContent.trim().slice(0, 40)}” shows (${Math.round(r.width)} × ${Math.round(r.height)} px)`);
  }
  if (hidden.total) result.hidden = hidden;

  // overlap
  const pinnedEl = (el) => { for (let e = el; e; e = e.parentElement) if (['fixed', 'sticky'].includes(getComputedStyle(e).position)) return e; return null; };
  const boxes = [];
  for (const el of [focus, ...focus.querySelectorAll('*')]) {
    if (SKIP.has(el.localName) || el.closest('svg') || !shown(el) || clipped(el)) continue;
    const rects = [];
    for (const t of ownText(el)) {
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const rect of range.getClientRects()) if (rect.width > 2 && rect.height > 2) rects.push(rect);
    }
    if (rects.length) boxes.push({ el, rects, layer: pinnedEl(el) });
  }
  const hit = new Set();
  const examples = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.layer !== b.layer || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const clash = a.rects.some((p) => b.rects.some((q) => {
      const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      return w > 0 && h > 0 && w * h > 0.25 * Math.min(p.width * p.height, q.width * q.height);
    }));
    if (clash) {
      hit.add(a.el); hit.add(b.el);
      if (examples.length < 3) examples.push(`“${a.el.textContent.trim().slice(0, 24)}” over “${b.el.textContent.trim().slice(0, 24)}”`);
    }
  }
  result.overlap = { total: boxes.length, ok: boxes.length - hit.size, examples };

  // controls
  const PROPS = ['background-color', 'border-top-color', 'border-top-width', 'border-top-style', 'border-top-left-radius'];
  const controls = { total: 0, ok: 0, examples: [] };
  const sel = 'button, select, textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file])';
  for (const el of [focus, ...focus.querySelectorAll(sel)].filter((e) => e.matches(sel))) {
    const r = el.getBoundingClientRect();
    if (!shown(el) || r.width <= 1 || r.height <= 1 || el.closest('.visually-hidden')) continue;
    const cs = getComputedStyle(el);
    blank.documentElement.style.colorScheme = cs.colorScheme;
    const twin = blank.createElement(el.localName);
    if (el.localName === 'input') twin.type = el.type;
    blank.body.append(twin);
    const ua = frame.contentWindow.getComputedStyle(twin);
    const same = PROPS.filter((p) => ua.getPropertyValue(p) === cs.getPropertyValue(p)).length;
    twin.remove();
    controls.total++;
    if (same < PROPS.length) controls.ok++;
    else if (controls.examples.length < 3) controls.examples.push(`${label(el)} looks like the browser default`);
  }
  if (controls.total) result.controls = controls;
  frame.remove();
  return result;
}

export async function contrast(page, focusSelector) {
  try {
    const res = await new AxeBuilder({ page }).include(focusSelector).withRules(['color-contrast']).analyze();
    const count = (list) => list.reduce((n, r) => n + r.nodes.length, 0);
    const bad = count(res.violations);
    const total = bad + count(res.passes);
    return total ? { total, ok: total - bad, examples: res.violations.flatMap((r) => r.nodes).slice(0, 3).map((n) => `${n.target.join(' ')}: ${n.any[0]?.data?.contrastRatio ?? '?'}:1`) } : null;
  }
  catch (e) {
    return null;
  }
}

export function score(checks) {
  const parts = Object.values(checks).filter((c) => c && c.total);
  return parts.length ? Math.floor(100 * Math.min(...parts.map((c) => c.ok / c.total))) : null;
}
