/**
 * The proof matrix, shared by capture.mjs and gallery.mjs.
 */

/** Themes: role decides how the node form is rendered in it. */
export const THEMES = [
  { name: 'default_admin', label: 'Default Admin', role: 'admin' },
  { name: 'claro', label: 'Claro', role: 'admin' },
  { name: 'olivero', label: 'Olivero', role: 'frontend' },
  { name: 'stark', label: 'Stark (no CSS)', role: 'frontend' },
];

/** Page-side contexts, emulated in the browser. */
export const VARIANTS = [
  { name: 'light', label: 'Light', path: '/node/1/edit', emulate: { colorScheme: 'light' } },
  { name: 'dark', label: 'Dark (OS setting)', path: '/node/1/edit', emulate: { colorScheme: 'dark' } },
  { name: 'rtl', label: 'RTL (Arabic)', path: '/ar/node/1/edit', emulate: { colorScheme: 'light' } },
  { name: 'contrast', label: 'prefers-contrast: more', path: '/node/1/edit', emulate: { colorScheme: 'light', contrast: 'more' } },
  // Dark chosen on the page plus more contrast: dark must win (ds.context layers).
  { name: 'dark-contrast', label: 'data-ds-mode="dark" + more contrast', path: '/node/1/edit', emulate: { colorScheme: 'light', contrast: 'more' }, html: { 'data-ds-mode': 'dark' } },
  { name: 'forced', label: 'Forced colors', path: '/node/1/edit', emulate: { colorScheme: 'light', forcedColors: 'active' } },
];

export const VIEWS = [
  { name: 'widget', label: 'Field widget' },
  { name: 'modal', label: 'Media Library dialog' },
];
