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

/**
 * The admin chrome (design_system_api_chrome) on the Canvas UI skin, under
 * Advaita: Navigation's sidebar and top bar on an article. `switch` sets
 * more contrast through the display preferences switch in the top bar (D29)
 * and reloads, so the saved choice is what the server writes on <html>.
 */
export const CHROME = {
  path: '/node/1',
  theme: 'advaita',
  bindings: { site: 'advaita_atelier', chrome: 'advaita_canvas_ui' },
  regions: ['.ds-chrome-sidebar', '.ds-chrome-top-bar'],
};

export const CHROME_VARIANTS = [
  { name: 'light', label: 'Light', emulate: { colorScheme: 'light' } },
  { name: 'dark', label: 'Dark (OS setting)', emulate: { colorScheme: 'dark' } },
  { name: 'switch-more', label: 'More contrast, from the switch', emulate: { colorScheme: 'light' }, contrast: 'more' },
  { name: 'switch-more-dark', label: 'Dark + more contrast, from the switch', emulate: { colorScheme: 'dark' }, contrast: 'more' },
  { name: 'forced', label: 'Forced colors (light palette)', emulate: { colorScheme: 'light', forcedColors: 'active' } },
  { name: 'forced-dark', label: 'Forced colors (dark palette)', emulate: { colorScheme: 'dark', forcedColors: 'active' } },
];

/**
 * Violations a skin declares, by cell key prefix, axe rule and target. The
 * Canvas UI skin draws its solid buttons white on Radix blue-9 (3.3:1), as
 * Canvas does, and declares it (D28); more contrast fixes it, so the
 * switch-more cells must not need this.
 */
export const DEPARTURES = [
  {
    cell: 'chrome/advaita_canvas_ui/',
    except: ['switch-more'],
    rule: 'color-contrast',
    target: '.toolbar-button--icon--pencil',
    reason: 'D28: Canvas UI solid button, white on blue-9 (3.3:1); more contrast holds 4.5:1',
  },
];
