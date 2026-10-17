/**
 * What the design probe compares (probe.mjs).
 *
 * COMPONENTS: one entry per Radix sample in radix-reference.html (its
 * data-spec id). `variants` are further Drupal elements measured against the
 * same sample (data-spec="id@variant"). `drupal` overrides where an element
 * lives when it isn't on the spec sheet: a path, a selector, an action that
 * opens it. `states` adds hover or focus measurements. `ignore` skips
 * properties that don't apply.
 *
 * DEPARTURES: differences that are decided, keyed "<id>[:state].<prop>" or
 * "*.<prop>", each with its reason. Anything else that differs fails.
 */

export const SHEET = '/admin/advaita/spec';

const openRowMenu = async (page) => {
  await page.locator('.dropbutton-toggle button').first().click();
  await page.waitForTimeout(150);
};

export const COMPONENTS = [
  // Buttons.
  { id: 'button-solid', label: 'Button, solid (main submit)', states: ['hover'], variants: ['actions'] },
  { id: 'button-surface', label: 'Button, surface (default)', states: ['hover'], variants: ['link'] },
  { id: 'button-soft', label: 'Button, soft', states: ['hover'] },
  { id: 'button-neutral', label: 'Button, surface gray (neutral)', states: ['hover'] },
  { id: 'button-ghost', label: 'Button, ghost gray', states: ['hover'] },
  { id: 'button-danger', label: 'Button, danger (soft red)', states: ['hover'], variants: ['link'] },
  { id: 'button-danger-solid', label: 'Button, danger solid', states: ['hover'] },
  { id: 'button-disabled', label: 'Button, disabled' },
  { id: 'button-small', label: 'Button, size 1' },
  { id: 'button-small-neutral', label: 'Button, size 1 gray (row operations)' },
  {
    id: 'icon-button-ghost', label: 'Icon button, ghost (mode toggle)', ignore: ['fontSize', 'fontWeight', 'fontFamily'],
    drupal: { 'icon-button-ghost': { path: '/admin/content', selector: '[data-ds-mode-toggle], .mode-toggle, .advaita-mode-toggle' } },
  },
  // Fields.
  { id: 'textfield', label: 'Text field', states: ['hover', 'focus'], variants: ['email', 'file'] },
  { id: 'textfield-placeholder', label: 'Text field, placeholder', ignore: ['color'] },
  { id: 'textfield-disabled', label: 'Text field, disabled' },
  { id: 'select', label: 'Select', states: ['hover'] },
  { id: 'textarea', label: 'Text area', ignore: ['height'] },
  {
    id: 'label', label: 'Field label', ignore: ['height', 'paddingInline', 'radius', 'fill', 'edge', 'elevated'],
    drupal: { label: { selector: '.form-item-text label' } },
  },
  {
    id: 'description', label: 'Field description', ignore: ['height', 'paddingInline', 'radius', 'fill', 'edge', 'elevated'],
    drupal: { description: { selector: '.form-item-text .description' } },
  },
  // Choices.
  { id: 'checkbox', label: 'Checkbox', ignore: ['paddingInline', 'fontSize', 'fontWeight', 'fontFamily', 'color'] },
  { id: 'checkbox-checked', label: 'Checkbox, checked', ignore: ['paddingInline', 'fontSize', 'fontWeight', 'fontFamily', 'color'] },
  { id: 'checkbox-disabled', label: 'Checkbox, disabled', ignore: ['paddingInline', 'fontSize', 'fontWeight', 'fontFamily', 'color'] },
  { id: 'radio', label: 'Radio', ignore: ['paddingInline', 'fontSize', 'fontWeight', 'fontFamily', 'color'] },
  { id: 'radio-checked', label: 'Radio, checked', ignore: ['paddingInline', 'fontSize', 'fontWeight', 'fontFamily', 'color'] },
  // Navigation.
  {
    id: 'tab-active', label: 'Page tab, current',
    drupal: { 'tab-active': { path: '/admin/content/moderated', selector: '.ds-tabs:not(.ds-tabs--small) :is(a, button):is(.is-active, [aria-current])' } },
  },
  {
    id: 'tab', label: 'Page tab', states: ['hover'],
    drupal: { tab: { path: '/admin/content/moderated', selector: '.ds-tabs:not(.ds-tabs--small) li:not(.is-active) > a' } },
  },
  {
    id: 'tab-small-active', label: 'Secondary tab, current',
    drupal: { 'tab-small-active': { path: '/admin/content/moderated', selector: '.ds-tabs--small :is(a, button):is(.is-active, [aria-current])' } },
  },
  {
    id: 'tab-small', label: 'Secondary tab',
    drupal: { 'tab-small': { path: '/admin/content/moderated', selector: '.ds-tabs--small li:not(.is-active) > a' } },
  },
  {
    id: 'segmented', label: 'Segmented control', ignore: ['paddingInline', 'fontSize', 'fontWeight', 'fontFamily', 'color'],
    drupal: { segmented: { path: '/admin/content/media', selector: '.ds-segmented' } },
  },
  {
    id: 'segmented-active', label: 'Segmented control, current',
    drupal: { 'segmented-active': { path: '/admin/content/media', selector: '.ds-segmented :is(a, button):is(.is-active, [aria-current])' } },
  },
  // Menu (a row's operations).
  {
    id: 'menu', label: 'Dropdown menu', ignore: ['fontSize', 'fontWeight', 'fontFamily', 'color', 'height', 'paddingInline'],
    drupal: { menu: { path: '/admin/content', act: openRowMenu, selector: '.dropbutton-wrapper.open .ds-menu, .dropbutton-wrapper [aria-expanded="true"] ~ * .ds-menu, .ds-menu:visible' } },
  },
  {
    id: 'menu-item', label: 'Menu item',
    drupal: { 'menu-item': { path: '/admin/content', act: openRowMenu, selector: '.ds-menu:visible li:nth-child(2) > a' } },
  },
  {
    id: 'menu-item-highlighted', label: 'Menu item, highlighted', states: ['hover'],
    drupal: { 'menu-item-highlighted': { path: '/admin/content', act: openRowMenu, selector: '.ds-menu:visible li:first-child > a' } },
  },
  // Table.
  { id: 'table-header', label: 'Table header cell', ignore: ['radius', 'elevated'] },
  { id: 'table-cell', label: 'Table cell', ignore: ['radius', 'elevated'] },
  // Feedback and containers.
  {
    id: 'callout-status', label: 'Message, status',
    drupal: { 'callout-status': { selector: '[data-drupal-messages] :is(.messages--status, [data-ds-tone="success"], .message--status)' } },
  },
  {
    id: 'callout-error', label: 'Message, error',
    drupal: { 'callout-error': { selector: '[data-drupal-messages] :is(.messages--error, [data-ds-tone="danger"], .message--error)' } },
  },
  {
    id: 'callout-warning', label: 'Message, warning',
    drupal: { 'callout-warning': { selector: '[data-drupal-messages] :is(.messages--warning, [data-ds-tone="warning"], .message--warning)' } },
  },
  {
    id: 'badge-success', label: 'Badge',
    drupal: { 'badge-success': { path: '/admin/dashboard', selector: '.badge' } },
  },
  { id: 'card', label: 'Card (details, fieldset)', ignore: ['height', 'paddingInline', 'fontSize', 'fontWeight', 'color'], variants: ['details', 'fieldset'] },
  {
    id: 'dialog', label: 'Dialog', ignore: ['height', 'fontSize', 'fontWeight', 'color', 'fontFamily'],
    drupal: {
      dialog: {
        path: '/admin/content',
        act: async (page) => {
          await openRowMenu(page);
          await page.locator('.ds-menu:visible a[href*="/delete"]').first().click();
          await page.waitForSelector('.ui-dialog', { timeout: 15000 });
          await page.waitForTimeout(400);
        },
        selector: '.ui-dialog',
      },
    },
  },
];

// The entries without a Drupal element of their own (not on the sheet).
for (const c of COMPONENTS) {
  c.drupal ??= {};
}

export const DEPARTURES = {
  // White on Radix blue-9 (#0090ff) is 3.3:1; the solid fill is the darkest
  // step of the accent that holds 4.5:1 on the selected tint (D26). In dark,
  // the fill is blue-9 and the text dark (5.6:1) instead of white (3.3:1).
  'button-solid.fill': 'contrast: white on blue-9 is 3.3:1 (D26)',
  'button-solid:hover.fill': 'contrast: white on blue-10 is 3.5:1 (D26)',
  'button-solid.color': 'contrast: dark text on blue-9 in dark mode (D26)',
  'button-solid:hover.color': 'contrast: dark text on blue-9 in dark mode (D26)',
  // Red-9 (#e5484d) takes white at 3.9:1: the contract's error colour holds 4.5:1.
  'button-danger-solid.fill': 'contrast: white on red-9 is 3.9:1; status.error',
  'button-danger-solid:hover.fill': 'contrast: white on red-10 is 3.6:1; status.error',
  'button-danger-solid.color': 'contrast: dark text on the light error red in dark mode',
  'button-danger-solid:hover.color': 'contrast: dark text on the light error red in dark mode',
  // Radix's resting field edge (gray-a7) is 1.6:1; it is the contract's
  // border.default, so this holds unless the skin moves it (a11y/field-edge).
};
